// @vitest-environment jsdom
/**
 * 回归测试：动态加载/虚拟滚动范围外大文档的跳转（issue #34 修复，第三版：siyuan:// 协议链路）
 * -----------------------------------------------------------------------------
 * Bug 现象：旧实现在"动态加载/虚拟滚动范围外"的大文档里点击大纲条目【无法跳转】；
 *           而原始的 window.open(siyuan://blocks/...) 之所以能用，正是因为它被思源
 *           前端协议拦截器接住、最终走到 openFileById（含 CB_GET_CONTEXT，触发 mode=3 动态加载）。
 *
 * 修复方案：直接复用思源官方 siyuan:// 协议链路——
 *   window.top.openFileByURL("siyuan://blocks/"+id) -> openFileById，应用内完成并动态加载块；
 *   openTab（含 cb-get-context 的 action）仅作兜底。
 *
 * 核心不变量（本测试守护）：
 *   - 主路径：window.top.openFileByURL 被以 siyuan://blocks/{id}（折叠态带 ?focus=1）调用；
 *   - 兜底路径：openTab 必须收到 doc.id === blockId 且 action 含 cb-get-context；
 *   - 全程【不得】调用 window.open。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { navigateToBlock } from "../utils/navigation";

const SAMPLE_BLOCK_ID = "20260719222948-bc15awl";

describe("navigateToBlock - 动态加载/虚拟滚动范围外跳转（siyuan:// 协议链路）", () => {
    let openTab: ReturnType<typeof vi.fn>;
    let plugin: any;

    beforeEach(() => {
        // jsdom 自带 window.open，替换为可断言的 spy，避免「Not implemented」噪声
        vi.spyOn(window, "open").mockImplementation(() => null);
        // 主路径：思源顶层 window 暴露 openFileByURL
        (window.top as any).openFileByURL = vi.fn();
        openTab = vi.fn().mockResolvedValue(undefined);
        plugin = { app: {}, openTab };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window.top as any).openFileByURL;
    });

    it("A. 正常块 -> window.top.openFileByURL 被以 siyuan://blocks/{id}（无 focus）调用，且不调 window.open", async () => {
        const ok = await navigateToBlock(plugin, SAMPLE_BLOCK_ID);

        expect(ok).toBe(true);
        expect((window.top as any).openFileByURL).toHaveBeenCalledTimes(1);
        expect((window.top as any).openFileByURL).toHaveBeenCalledWith(
            `siyuan://blocks/${SAMPLE_BLOCK_ID}`
        );
        expect(window.open).not.toHaveBeenCalled();
    });

    it("B. 折叠态（isFolded=true）-> window.top.openFileByURL 参数为 siyuan://blocks/{id}?focus=1", async () => {
        await navigateToBlock(plugin, SAMPLE_BLOCK_ID, true);

        expect((window.top as any).openFileByURL).toHaveBeenCalledWith(
            `siyuan://blocks/${SAMPLE_BLOCK_ID}?focus=1`
        );
        expect(window.open).not.toHaveBeenCalled();
    });

    it("C. openFileByURL 不存在 -> 回退 plugin.openTab（doc.id===blockId，action 含 cb-get-context）", async () => {
        (window.top as any).openFileByURL = undefined;

        const ok = await navigateToBlock(plugin, SAMPLE_BLOCK_ID);

        expect(ok).toBe(true);
        expect(openTab).toHaveBeenCalledTimes(1);
        const doc = openTab.mock.calls[0][0].doc;
        expect(doc.id).toBe(SAMPLE_BLOCK_ID);
        expect(doc.action).toContain("cb-get-context");
        expect(window.open).not.toHaveBeenCalled();
    });

    it("D. openFileByURL 与 openTab 均缺失 -> 返回 false", async () => {
        (window.top as any).openFileByURL = undefined;
        const legacyPlugin = { app: {} }; // 无 openTab 能力

        const ok = await navigateToBlock(legacyPlugin, SAMPLE_BLOCK_ID);

        expect(ok).toBe(false);
        expect(window.open).not.toHaveBeenCalled();
    });

    it("E. 全分支串联确认 window.open 从未被调用（普通/折叠/兜底/缺失）", async () => {
        // 普通态 + 折叠态：走主路径
        await navigateToBlock(plugin, SAMPLE_BLOCK_ID);
        await navigateToBlock(plugin, SAMPLE_BLOCK_ID, true);
        // 兜底路径：openFileByURL 不存在 -> openTab
        (window.top as any).openFileByURL = undefined;
        await navigateToBlock(plugin, SAMPLE_BLOCK_ID);
        // 完全缺失：openFileByURL 与 openTab 均不存在
        await navigateToBlock({ app: {} }, SAMPLE_BLOCK_ID);

        expect(window.open).not.toHaveBeenCalled();
    });

    it("F. openFileByURL 抛错 -> 捕获异常并回退 openTab，且不调 window.open", async () => {
        (window.top as any).openFileByURL = vi.fn().mockImplementation(() => {
            throw new Error("openFileByURL boom");
        });

        const ok = await navigateToBlock(plugin, SAMPLE_BLOCK_ID);

        expect(ok).toBe(true);
        expect(openTab).toHaveBeenCalledTimes(1);
        const doc = openTab.mock.calls[0][0].doc;
        expect(doc.id).toBe(SAMPLE_BLOCK_ID);
        expect(doc.action).toContain("cb-get-context");
        expect(window.open).not.toHaveBeenCalled();
    });
});

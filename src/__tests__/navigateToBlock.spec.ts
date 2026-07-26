// @vitest-environment jsdom
/**
 * 回归测试：navigateToBlock 严禁触发外部/浏览器跳转（issue #34 修复，第三版）
 * -----------------------------------------------------------------------------
 * Bug 现象：点击悬浮大纲条目（尤其是尚未被思源动态加载进 DOM 的标题）时，
 *           旧实现会唤醒浏览器跳转到 siyuan://blocks/<id>。
 *
 * 修复方案：直接复用思源官方 siyuan:// 协议链路——
 *   window.top.openFileByURL("siyuan://blocks/"+id) -> openFileById（含 CB_GET_CONTEXT），
 *   在「应用内」完成跳转并动态加载目标块，不经过 window.open，故不弹浏览器。
 *   plugin.openTab（含 cb-get-context 的 action）仅作兜底。
 *
 * 核心不变量（本测试守护）：
 *   - 主路径下，window.top.openFileByURL 被以 siyuan://blocks/{id}（折叠态带 ?focus=1）调用；
 *   - 全程【不得】调用 window.open（绝不唤醒系统/浏览器处理 siyuan:// 协议）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { navigateToBlock } from "../utils/navigation";

const SAMPLE_BLOCK_ID = "20260719222948-bc15awl";

describe("navigateToBlock - 禁止外部/浏览器跳转（复用 siyuan:// 协议链路）", () => {
    beforeEach(() => {
        // jsdom 自带 window.open，替换为可断言的 spy，避免「Not implemented」噪声
        vi.spyOn(window, "open").mockImplementation(() => null);
        // 主路径：思源顶层 window 暴露 openFileByURL（iframe 下通过 window.top 访问）
        (window.top as any).openFileByURL = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete (window.top as any).openFileByURL;
    });

    it("A. 主路径：window.top.openFileByURL 可用 -> 以 siyuan://blocks/{id} 调用且不调 window.open", async () => {
        const plugin = { app: {}, openTab: vi.fn().mockResolvedValue(undefined) };

        const ok = await navigateToBlock(plugin, SAMPLE_BLOCK_ID);

        expect(ok).toBe(true);
        expect((window.top as any).openFileByURL).toHaveBeenCalledTimes(1);
        expect((window.top as any).openFileByURL).toHaveBeenCalledWith(
            `siyuan://blocks/${SAMPLE_BLOCK_ID}`
        );
        expect(window.open).not.toHaveBeenCalled();
    });

    it("B. 折叠态（isFolded=true）-> openFileByURL 参数为 siyuan://blocks/{id}?focus=1，且不调 window.open", async () => {
        const plugin = { app: {}, openTab: vi.fn().mockResolvedValue(undefined) };

        const ok = await navigateToBlock(plugin, SAMPLE_BLOCK_ID, true);

        expect(ok).toBe(true);
        expect((window.top as any).openFileByURL).toHaveBeenCalledWith(
            `siyuan://blocks/${SAMPLE_BLOCK_ID}?focus=1`
        );
        expect(window.open).not.toHaveBeenCalled();
    });

    it("C. openFileByURL 不存在 -> 回退 openTab（doc.id===blockId，action 含 cb-get-context），且不调 window.open", async () => {
        // 模拟顶层 window 未暴露 openFileByURL（兜底路径）
        (window.top as any).openFileByURL = undefined;
        const openTab = vi.fn().mockResolvedValue(undefined);
        const plugin = { app: {}, openTab };

        const ok = await navigateToBlock(plugin, SAMPLE_BLOCK_ID);

        expect(ok).toBe(true);
        expect(openTab).toHaveBeenCalledTimes(1);
        const doc = openTab.mock.calls[0][0].doc;
        expect(doc.id).toBe(SAMPLE_BLOCK_ID);
        expect(doc.action).toContain("cb-get-context");
        expect(doc.zoomIn).toBe(false);
        expect(window.open).not.toHaveBeenCalled();
    });

    it("D. openFileByURL 与 openTab 均缺失 -> 返回 false，且不调 window.open", async () => {
        (window.top as any).openFileByURL = undefined;
        const plugin = { app: {} }; // 无 openTab 能力

        const ok = await navigateToBlock(plugin, SAMPLE_BLOCK_ID);

        expect(ok).toBe(false);
        expect(window.open).not.toHaveBeenCalled();
    });

    it("E. plugin 为 null/undefined 时：仍复用 siyuan:// 链路（不依赖 openTab），且不调 window.open", async () => {
        const okNull = await navigateToBlock(null, SAMPLE_BLOCK_ID);
        const okUndefined = await navigateToBlock(undefined, SAMPLE_BLOCK_ID);

        // 主路径不依赖 plugin：openFileByURL 可用即成功发起应用内跳转
        expect(okNull).toBe(true);
        expect(okUndefined).toBe(true);
        expect((window.top as any).openFileByURL).toHaveBeenCalledTimes(2);
        expect(window.open).not.toHaveBeenCalled();
    });
});

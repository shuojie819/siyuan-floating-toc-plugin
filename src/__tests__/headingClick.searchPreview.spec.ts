// @vitest-environment jsdom
/**
 * 回归测试：悬浮大纲条目点击跳转分支（issue #34 搜索预览分支 · 已回退为 DOM-only）
 * -----------------------------------------------------------------------------
 * 背景：issue #34 第三版曾把搜索预览(.search__preview / dialog-search)从「DOM-only」改为
 *       「走 navigateToBlock」，以期支持跳转到动态加载外的块。经评审/实测确认回退：
 *
 * 回退技术原因：
 *   - 搜索预览是思源「全局搜索面板」内的【只读预览表面】，标题已随预览文档片段渲染进
 *     preview protyle 的 DOM，DOM-only 滚动已足够定位，无需 navigateToBlock；
 *   - navigateToBlock（openFileById）会驱动【主工作区编辑器】跳转到该块——对搜索预览而言
 *     会抢走搜索上下文、切换/打开文档页签、打断当前预览，体验错位；
 *   - 因此搜索预览应与历史记录 / 集市页面 / 数据库分组一致，归入 DOM-only（找不到即放弃）。
 *
 * 本测试守护的核心不变量：
 *   - 搜索预览(.search__preview)上下文（isSearchTarget=true，非历史、非集市、非 av-group）下，
 *     DOM 中不存在的 heading → 【不】调用 navigateToBlock，也【不】进入 checkBlockFold（直接放弃）；
 *   - 搜索预览上下文下，heading 已渲染进 DOM → 仅 DOM 滚动，不调用 navigateToBlock；
 *   - 历史记录 / 集市页面 / 数据库分组：DOM 中找不到时【不】调用 navigateToBlock（行为不变）；
 *   - 普通文档：DOM 中找不到 → 调用 navigateToBlock（对照，确保正常路径未被破坏）；
 *   - checkBlockFold 抛错 → 普通文档以 isFolded=false 兜底调用 navigateToBlock（不中断）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleHeadingClick } from "../utils/scrollOrNavigate";

const mkHeading = (id: string, subType?: string) => ({ id, subType });

/** 构造依赖集合，所有副作用默认可被 spy 断言；通过 overrides 调整特定行为。 */
const baseDeps = (overrides: Record<string, any> = {}) => ({
    // 默认：DOM 中找不到目标块（模拟「动态加载范围外 / 祖先折叠」）
    findTargetBlockInDom: vi.fn().mockReturnValue(null),
    scrollToBlockInDom: vi.fn(),
    checkBlockFold: vi.fn().mockResolvedValue(false),
    isHistoryTarget: () => false,
    isBazaarTarget: () => false,
    isSearchTarget: () => false,
    navigateToBlock: vi.fn().mockResolvedValue(true),
    ...overrides,
});

const PLUGIN = { app: {}, openTab: vi.fn().mockResolvedValue(undefined) };

describe("handleHeadingClick - 搜索预览/特殊模式跳转分支（DOM-only 回退）", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("A. 搜索预览(.search__preview)：动态加载外块（DOM 中无）→ 仅 DOM-only，不调用 navigateToBlock", async () => {
        const deps = baseDeps({ isSearchTarget: () => true });
        await handleHeadingClick(mkHeading("blk-dynamic-1"), PLUGIN, deps);

        expect(deps.navigateToBlock).not.toHaveBeenCalled();
        expect(deps.scrollToBlockInDom).not.toHaveBeenCalled();
    });

    it("B. 搜索预览：即便 checkBlockFold 检测为折叠态，仍仅 DOM-only（不进入折叠检测、不调用 navigateToBlock）", async () => {
        const deps = baseDeps({ isSearchTarget: () => true, checkBlockFold: vi.fn().mockResolvedValue(true) });
        await handleHeadingClick(mkHeading("blk-dynamic-2"), PLUGIN, deps);

        expect(deps.checkBlockFold).not.toHaveBeenCalled();
        expect(deps.navigateToBlock).not.toHaveBeenCalled();
    });

    it("C. 搜索预览：heading 已渲染进 DOM（可定位）→ 仅 DOM 滚动，不调用 navigateToBlock", async () => {
        const fakeEl = document.createElement("div");
        const deps = baseDeps({ isSearchTarget: () => true, findTargetBlockInDom: vi.fn().mockReturnValue(fakeEl) });
        await handleHeadingClick(mkHeading("blk-in-dom"), PLUGIN, deps);

        expect(deps.scrollToBlockInDom).toHaveBeenCalledTimes(1);
        expect(deps.scrollToBlockInDom).toHaveBeenCalledWith(fakeEl);
        expect(deps.navigateToBlock).not.toHaveBeenCalled();
    });

    it("D. 历史记录(history)：DOM 中无目标块 → 仍仅 DOM-only，不调用 navigateToBlock（行为不变）", async () => {
        const deps = baseDeps({ isHistoryTarget: () => true });
        await handleHeadingClick(mkHeading("blk-history"), PLUGIN, deps);

        expect(deps.scrollToBlockInDom).not.toHaveBeenCalled();
        expect(deps.navigateToBlock).not.toHaveBeenCalled();
    });

    it("E. 集市页面(bazaar)：DOM 中无目标块 → 仍仅 DOM-only，不调用 navigateToBlock（行为不变）", async () => {
        const deps = baseDeps({ isBazaarTarget: () => true });
        await handleHeadingClick(mkHeading("blk-bazaar"), PLUGIN, deps);

        expect(deps.scrollToBlockInDom).not.toHaveBeenCalled();
        expect(deps.navigateToBlock).not.toHaveBeenCalled();
    });

    it("F. 数据库分组(av-group)：DOM 中无目标块 → 仍仅 DOM-only，不调用 navigateToBlock（行为不变）", async () => {
        const deps = baseDeps();
        await handleHeadingClick(mkHeading("blk-av", "av-group"), PLUGIN, deps);

        expect(deps.scrollToBlockInDom).not.toHaveBeenCalled();
        expect(deps.navigateToBlock).not.toHaveBeenCalled();
    });

    it("G. 普通文档：动态加载外块（DOM 中无）→ 调用 navigateToBlock（对照，确保正常路径未被破坏）", async () => {
        const deps = baseDeps();
        await handleHeadingClick(mkHeading("blk-normal"), PLUGIN, deps);

        expect(deps.navigateToBlock).toHaveBeenCalledWith(PLUGIN, "blk-normal", false);
    });

    it("H. checkBlockFold 抛错 → 捕获异常并以 isFolded=false 兜底调用 navigateToBlock（不中断）", async () => {
        const deps = baseDeps({
            checkBlockFold: vi.fn().mockRejectedValue(new Error("api boom")),
        });
        await handleHeadingClick(mkHeading("blk-err"), PLUGIN, deps);

        expect(deps.navigateToBlock).toHaveBeenCalledWith(PLUGIN, "blk-err", false);
    });
});

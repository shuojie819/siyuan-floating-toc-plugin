// @vitest-environment jsdom
/**
 * Issue #36 ①② 验收：悬浮大纲不应误挂到思源「闪卡 / 卡片复习」场景。
 * -----------------------------------------------------------------------------
 * 现象：进入闪卡复习后，复习视图容器 .card__main 内部用 Protyle 渲染卡片块，
 *       插件 checkProtyles 的全局 .protyle 扫描把它当成了文档宿主并挂上悬浮大纲；
 *       「拖动闪卡成浮窗后大纲不跟随」亦是同一根因（浮窗只是把 .card__main 搬走）。
 *
 * 修复（集中 domUtils.ts）：
 *   - 新增 isFlashcardContext()：element.closest('.card__main, #cardPreview')；
 *   - shouldShowToc() 中命中即返回 false（不再挂载）。
 *
 * 本测试覆盖：
 *   1) .protyle 位于 <div class="card__main"> 内 → isFlashcardContext true / shouldShowToc false；
 *   2) .protyle 位于挂在 body 下的 <div id="cardPreview"> 内 → shouldShowToc false；
 *   3) 防误伤回归：普通文档 .protyle「包含」一个 .card__main 后代 → isFlashcardContext false /
 *      shouldShowToc true（closest 只向上查找，不误伤正常文档）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isFlashcardContext, shouldShowToc } from "../utils/domUtils";

/** 确定性 mock window.getComputedStyle（仅暴露 isCovered* 实际读取的字段）。 */
function mockGetComputedStyle(): void {
    vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) => {
        const inline = (el as HTMLElement).style;
        return {
            display: inline.display || "",
            visibility: inline.visibility || "visible",
            opacity: inline.opacity || "1"
        } as unknown as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle);
}

/** 从 document 中取到指定选择器的第一个元素（断言用）。 */
function q(selector: string): HTMLElement {
    return document.querySelector(selector) as HTMLElement;
}

beforeEach(() => {
    mockGetComputedStyle();
});

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe("isFlashcardContext / shouldShowToc - 闪卡复习视图（.card__main）", () => {
    it("1. .protyle 位于 .card__main 内 → isFlashcardContext true / shouldShowToc false", () => {
        document.body.innerHTML = `
            <div class="card__main">
                <div class="protyle">
                    <div class="protyle-content"></div>
                    <div class="protyle-wysiwyg" data-type="render"></div>
                </div>
            </div>`;

        const protyle = q(".card__main .protyle");
        expect(isFlashcardContext(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("2. .protyle 位于挂在 body 下的 #cardPreview 内 → shouldShowToc false", () => {
        document.body.innerHTML = `
            <div id="cardPreview">
                <div class="protyle">
                    <div class="protyle-content"></div>
                </div>
            </div>`;

        const protyle = q("#cardPreview .protyle");
        expect(isFlashcardContext(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("3. 防误伤回归：普通文档 .protyle「包含」.card__main 后代 → isFlashcardContext false / shouldShowToc true", () => {
        document.body.innerHTML = `
            <div class="protyle">
                <div class="protyle-content">
                    <div class="card__main"></div>
                </div>
            </div>`;

        const protyle = q(".protyle");
        // .card__main 是后代而非祖先：closest 只向上查找，不应命中
        expect(isFlashcardContext(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
    });
});

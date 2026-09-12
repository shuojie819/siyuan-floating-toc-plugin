// @vitest-environment jsdom
/**
 * Issue #35 + #37 验收：悬浮大纲不应误挂到「底部反链面板」与「数据库（属性视图）编辑上下文」。
 * -----------------------------------------------------------------------------
 * #35 底部反链面板：
 *   Bug 现象：底部反链面板里为「引用该文档的那个文档」渲染的 .protyle 被当成正常宿主，
 *            挂上悬浮大纲，显示的是引用者的标题层级。
 *   根因：思源创建底部反链面板时仅添加 `sy__backlink--bottom` / `sy__backlink--pending`
 *        两个 class token，并【不含】`sy__backlink`；而旧版 isBacklinkArea 只用
 *        `element.closest('.sy__backlink')` 判断，匹配不到 → shouldShowToc 返回 true。
 *   修复：isBacklinkArea 新增 `element.closest('.sy__backlink--bottom')` 判断。
 *
 * #37 数据库（属性视图）编辑上下文：
 *   背景：思源 3.8.3 起数据库文本字段支持块元素/行级元素，单元格/弹层内会出现可编辑
 *         的迷你 protyle（会被全局 querySelectorAll('.protyle, ...') 命中），内容与正在
 *         编辑的单元格毫不相干。
 *   修复：新增 isDatabaseEditorContext()，并在 shouldShowToc 排除列表中加入该判断。
 *
 * 回归保护：普通文档的 .protyle 只是「包含」数据库块（.av 是其后代），closest 只向上查找，
 *          不得误伤正常文档；侧边栏反链 dock（.sy__backlink）语义保持不变。
 *
 * 注意：jsdom 里 getBoundingClientRect() 全为 0，isCoveredByDialog 会提前返回 false，
 *      不会干扰 shouldShowToc 的断言（见 domUtils.ts isCoveredByDialog 的宽高守卫）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    isBacklinkArea,
    isDatabaseEditorContext,
    isLiteEditorFragment,
    shouldShowToc
} from "../utils/domUtils";

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

beforeEach(() => {
    mockGetComputedStyle();
});

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe("Issue #35 - 底部反链面板（.sy__backlink--bottom）不得误挂 TOC", () => {
    it("1. .protyle 位于 <div class=\"sy__backlink--bottom\"> 内 → isBacklinkArea true / shouldShowToc false", () => {
        document.body.innerHTML = `
            <div class="fn__none sy__backlink--bottom sy__backlink--pending">
                <div class="protyle">
                    <div class="protyle-content" data-node-id="20240101000000-refdoc1"></div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isBacklinkArea(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("6. 侧边栏反链 dock（.sy__backlink）语义保持不变 → isBacklinkArea true / shouldShowToc false", () => {
        document.body.innerHTML = `
            <div class="sy__backlink">
                <div class="protyle">
                    <div class="protyle-content" data-node-id="20240101000000-backlink"></div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isBacklinkArea(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });
});

describe("Issue #37 - 数据库（属性视图）编辑上下文不得误挂 TOC", () => {
    it("2. .protyle 位于 <div class=\"av__cell\"> 内 → isDatabaseEditorContext true / shouldShowToc false", () => {
        document.body.innerHTML = `
            <div class="av__cell">
                <div class="protyle">
                    <div class="protyle-content" data-node-id="20240101000000-avcell1"></div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isDatabaseEditorContext(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("3. .protyle 位于挂在 document.body 下的 <div class=\"av__panel\"> 内 → shouldShowToc false", () => {
        document.body.innerHTML = `
            <div class="av__panel">
                <div class="protyle">
                    <div class="protyle-content" data-node-id="20240101000000-avpanel"></div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isDatabaseEditorContext(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("4. .protyle 位于 <div class=\"av\" data-type=\"NodeAttributeView\"> 内 → shouldShowToc false", () => {
        document.body.innerHTML = `
            <div class="av" data-type="NodeAttributeView">
                <div class="protyle">
                    <div class="protyle-content" data-node-id="20240101000000-avroot"></div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isDatabaseEditorContext(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });
});

describe("回归 - 普通文档不受影响", () => {
    it("5. 普通文档 .protyle「包含」数据库块（.av 为后代）→ isDatabaseEditorContext false / shouldShowToc true", () => {
        // .av / [data-type="NodeAttributeView"] 是 .protyle 的【后代】而非祖先，
        // closest 只向上查找，因此不得判定为数据库编辑上下文，正常文档仍应显示大纲。
        document.body.innerHTML = `
            <div class="protyle">
                <div class="protyle-content" data-node-id="20240101000000-docaaa1">
                    <div class="av" data-type="NodeAttributeView">
                        <div class="av__row">
                            <div class="av__cell"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isDatabaseEditorContext(protyle)).toBe(false);
        expect(isBacklinkArea(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
    });
});

describe("加固 - 轻量编辑器片段（protyle-lite）不得误挂 TOC", () => {
    it("7. .protyle 位于 <div class=\"av__cell\"><div class=\"protyle-lite-fragment\"> 内 → isLiteEditorFragment true / shouldShowToc false", () => {
        // 思源 3.8.3 起数据库文本字段支持富文本/块元素编辑，单元格内使用 protyle-lite 迷你编辑器；
        // 该片段不是完整文档，必须排除以免误挂悬浮大纲。
        document.body.innerHTML = `
            <div class="av__cell">
                <div class="protyle-lite-fragment">
                    <div class="protyle">
                        <div class="protyle-content" data-node-id="20240101000000-litefrag"></div>
                    </div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isLiteEditorFragment(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("7b. 【隔离 lite 分支，无 .av 祖先】<div class=\"protyle-lite-fragment\"> 直接包住 .protyle（整棵树不含 .av*）→ isLiteEditorFragment true / isDatabaseEditorContext false / shouldShowToc false", () => {
        // 关键：本用例整棵树不含任何 .av* / [data-type="NodeAttributeView"] 祖先，
        // 因此 shouldShowToc 只能依赖 isLiteEditorFragment 分支返回 false；
        // 与用例 7（.av__cell 内嵌 lite，被 isDatabaseEditorContext 短路遮蔽）不同，
        // 删掉 shouldShowToc 里那一行后本用例必定变红。
        document.body.innerHTML = `
            <div class="protyle-lite-fragment">
                <div class="protyle">
                    <div class="protyle-content" data-node-id="20260101000000-litefrag"></div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isLiteEditorFragment(protyle)).toBe(true);
        expect(isDatabaseEditorContext(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("8. 【防误伤回归】普通文档 .protyle 包含一个 [data-protyle-lite-render=\"safe\"] 后代 → isLiteEditorFragment false / shouldShowToc true", () => {
        // [data-protyle-lite-render] 是 .protyle 的【后代】而非祖先，closest 只向上查找，
        // 因此不得判定为轻量编辑器片段，正常文档仍应显示大纲。
        document.body.innerHTML = `
            <div class="protyle">
                <div class="protyle-content" data-node-id="20240101000000-normdoc">
                    <div class="av__celltext av__celltext--rich b3-typography" data-protyle-lite-render="safe"></div>
                </div>
            </div>`;
        const protyle = document.querySelector(".protyle") as HTMLElement;

        expect(isLiteEditorFragment(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
    });
});

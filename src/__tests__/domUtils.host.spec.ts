// @vitest-environment jsdom
/**
 * getTocHostElement 修复验收（针对「固定搜索」下 TOC 无限叠加 bug）
 * -----------------------------------------------------------------------------
 * Bug 现象：使用思源「固定搜索」（搜索面板 dock/常驻侧边，非弹窗）时，文档悬浮大纲
 *           被无限创建/叠加，同一区域出现多个 TOC。
 *
 * 根因：getTocHostElement 对 .search__preview / .search__doc 这类容器（自身不是 protyle，
 *       但包含 .protyle-content）会命中 `if (hasContent) return candidate;`，
 *       把「搜索面板容器本身」当成 TOC 宿主返回，随后 createToc 给容器挂载 TOC，
 *       且每次 checkProtyles 都可能重复创建 → 无限叠加。
 *
 * 修复：在 hasContent 分支之前，对 .search__preview / .search__doc 容器直接返回 null，
 *       只挂载其内部真正的 .protyle 文档（上层 innerProtyle 分支已覆盖）；
 *       同时 checkProtyles 候选选择器改为 .search__preview .protyle / .search__doc .protyle。
 *
 * 本测试直接覆盖 getTocHostElement 的各类输入，验证：
 *   - 纯搜索预览/文档容器（含 .protyle-content、无内部 .protyle）→ null（核心修复）
 *   - 含内部 .protyle 的搜索容器 → 返回内部 .protyle（不误挂容器）
 *   - 自身即 .protyle（兼容旧行为）/ 普通 .protyle → 返回自身
 *   - 回归：.history__text 容器（含 .protyle-content）仍返回自身（不误伤历史面板）
 *
 * 注意：getTocHostElement 不依赖 getBoundingClientRect / getComputedStyle，无需 mock 矩形。
 */
import { describe, it, expect, afterEach } from "vitest";
import { getTocHostElement } from "../utils/domUtils";

/** 在 document.body 下创建一个带指定 class 的元素。 */
function createEl(cls: string, parent: HTMLElement = document.body): HTMLElement {
    const el = document.createElement("div");
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
}

afterEach(() => {
    document.body.replaceChildren();
});

describe("getTocHostElement - 固定搜索容器不应被误识别为宿主（核心修复）", () => {
    it("1. .search__preview 容器（含 .protyle-content、无内部 .protyle）→ 返回 null", () => {
        const container = createEl("search__preview");
        const content = document.createElement("div");
        content.className = "protyle-content";
        container.appendChild(content);

        expect(getTocHostElement(container)).toBeNull();
    });

    it("2. .search__doc 容器（含 .protyle-content、无内部 .protyle）→ 返回 null", () => {
        const container = createEl("search__doc");
        const content = document.createElement("div");
        content.className = "protyle-content";
        container.appendChild(content);

        expect(getTocHostElement(container)).toBeNull();
    });

    it("3. .search__preview 容器内部含 .protyle → 返回内部 protyle 元素（不误挂容器）", () => {
        const container = createEl("search__preview");
        const innerProtyle = document.createElement("div");
        innerProtyle.className = "protyle";
        const content = document.createElement("div");
        content.className = "protyle-content";
        innerProtyle.appendChild(content);
        container.appendChild(innerProtyle);

        const host = getTocHostElement(container);
        expect(host).not.toBeNull();
        expect(host).toBe(innerProtyle);
        expect(host).not.toBe(container);
    });

    it("4. .search__preview 自身就是 .protyle → 返回自身（兼容旧行为）", () => {
        const el = createEl("search__preview protyle");
        const content = document.createElement("div");
        content.className = "protyle-content";
        el.appendChild(content);

        expect(getTocHostElement(el)).toBe(el);
    });
});

describe("getTocHostElement - 普通文档与兼容行为", () => {
    it("5. 普通 .protyle 文档（含 .protyle-content）→ 返回自身", () => {
        const protyle = createEl("protyle");
        const content = document.createElement("div");
        content.className = "protyle-content";
        protyle.appendChild(content);

        expect(getTocHostElement(protyle)).toBe(protyle);
    });

    it("6. 回归：.history__text 容器（含 .protyle-content）→ 仍返回自身（不误伤历史面板）", () => {
        const container = createEl("history__text");
        const content = document.createElement("div");
        content.className = "protyle-content";
        container.appendChild(content);

        const host = getTocHostElement(container);
        expect(host).not.toBeNull();
        expect(host).toBe(container);
    });
});

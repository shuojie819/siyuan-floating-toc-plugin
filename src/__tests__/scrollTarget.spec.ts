// @vitest-environment jsdom
/**
 * findScrollableElement 单元测试（改动 3：统一滚动容器探测）。
 *
 * 背景：集市（bazaar）README 的真实滚动容器随思源版本变化，原先硬编码
 * `.item__main || .item__readme` 易失效 —— 直接导致「置顶/置底无效」「scroll-spy 失准」。
 * 新引入 findScrollableElement 按「实际可滚动」这一行为事实向上探测，本测试锁住其判定契约。
 *
 * 判定：`scrollHeight - clientHeight > 1` 且 `computedStyle.overflowY ∈ auto|scroll|overlay`。
 * jsdom 不产生真实滚动尺寸，故用 Object.defineProperty 覆写 scrollHeight/clientHeight；
 * overflowY 通过 dataset 注入 + mock getComputedStyle，避免依赖 jsdom 对 CSS 值的解析差异。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { findScrollableElement, resolveBazaarScrollContainer } from "../utils/domUtils";

/** 覆写元素的滚动尺寸（jsdom 默认全 0）。 */
function setScrollSize(el: HTMLElement, scrollHeight: number, clientHeight: number): void {
    Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
    Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
}

/** 确定性 mock getComputedStyle：overflowY 取自 dataset.oy（默认 visible）。 */
function mockComputedStyle(): void {
    vi.spyOn(window, "getComputedStyle").mockImplementation(((el: Element) => {
        const elm = el as HTMLElement;
        return { overflowY: elm.dataset.oy || "visible" } as unknown as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle);
}

/** 创建元素并设置 overflowY / 滚动尺寸，挂到 body 下。 */
function makeEl(overflowY: string, scrollHeight: number, clientHeight: number): HTMLElement {
    const el = document.createElement("div");
    el.dataset.oy = overflowY;
    setScrollSize(el, scrollHeight, clientHeight);
    return el;
}

describe("findScrollableElement（统一滚动容器探测）", () => {
    beforeEach(() => {
        document.body.replaceChildren();
        mockComputedStyle();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("① 自身即可纵向滚动 → 返回自身", () => {
        const el = makeEl("auto", 200, 100);
        document.body.appendChild(el);
        expect(findScrollableElement(el)).toBe(el);
    });

    it("② 自身不可滚、祖先可滚 → 返回最近的祖先", () => {
        const outer = makeEl("auto", 300, 100);
        const inner = makeEl("visible", 300, 300); // 尺寸无差 → 不可滚
        outer.appendChild(inner);
        document.body.appendChild(outer);
        expect(findScrollableElement(inner)).toBe(outer);
    });

    it("③ 自身与所有祖先均不可滚 → 返回 null", () => {
        const outer = makeEl("visible", 500, 500);
        const inner = makeEl("visible", 100, 100);
        outer.appendChild(inner);
        document.body.appendChild(outer);
        expect(findScrollableElement(inner)).toBeNull();
    });

    it("④ 多级嵌套且皆可滚 → 只取最近者", () => {
        const outer = makeEl("auto", 400, 100);
        const mid = makeEl("scroll", 300, 100);
        const leaf = makeEl("visible", 200, 200); // 不可滚
        outer.appendChild(mid);
        mid.appendChild(leaf);
        document.body.appendChild(outer);
        expect(findScrollableElement(leaf)).toBe(mid);
    });

    it("⑤ overflowY=hidden：即便尺寸可滚也不视为滚动容器", () => {
        const el = makeEl("hidden", 500, 100);
        document.body.appendChild(el);
        expect(findScrollableElement(el)).toBeNull();
    });

    it("⑥ overflowY=visible：尺寸可滚但样式非滚动 → 不算", () => {
        const el = makeEl("visible", 500, 100);
        document.body.appendChild(el);
        expect(findScrollableElement(el)).toBeNull();
    });

    it("⑦ 尺寸差 <= 1 视为不可滚", () => {
        const el = makeEl("auto", 100, 100);
        document.body.appendChild(el);
        expect(findScrollableElement(el)).toBeNull();
    });

    it("⑧ overflowY=overlay 亦视为可滚", () => {
        const el = makeEl("overlay", 300, 100);
        document.body.appendChild(el);
        expect(findScrollableElement(el)).toBe(el);
    });

    it("⑨ 起点为 null → 返回 null", () => {
        expect(findScrollableElement(null)).toBeNull();
    });

    it("⑩ 超出 maxDepth 的可滚祖先不被返回", () => {
        const outer = makeEl("auto", 400, 100);
        let cur: HTMLElement = outer;
        for (let i = 0; i < 5; i++) {
            const child = makeEl("visible", 10, 10);
            cur.appendChild(child);
            cur = child;
        }
        document.body.appendChild(outer);
        // 从最深处出发，maxDepth=2 时回溯层数不足，找不到 outer
        expect(findScrollableElement(cur, 2)).toBeNull();
        // 放宽 maxDepth 则能找到 outer
        expect(findScrollableElement(cur, 20)).toBe(outer);
    });
});

/**
 * 集成级回归（对应 QA 复核发现的方向性缺陷）：
 * 集市 TOC 的宿主是 #configBazaarReadme 面板**本体**，而真实滚动容器 `.item__main` 是它的**后代**。
 * 若调用点以面板本体为起点做「向上」探测 → 恒为 null（置顶/置底失效、scroll-spy 退化）。
 * resolveBazaarScrollContainer 必须从 README 后代起向上探测，才能取到 `.item__main`。
 * 本组用真实形状 `#configBazaarReadme > .item__main > .item__readme` 锁定该契约。
 */
describe("resolveBazaarScrollContainer（集市 README 真实滚动容器，方向性契约）", () => {
    beforeEach(() => {
        document.body.replaceChildren();
        mockComputedStyle();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** 构建真实形状：panel(host) > .item__main(可滚) > .item__readme(内容)。 */
    function buildPanel(): { panel: HTMLElement; main: HTMLElement; readme: HTMLElement } {
        const panel = makeEl("visible", 800, 800);
        panel.id = "configBazaarReadme";
        const main = makeEl("auto", 600, 300); // .item__main 纵向可滚
        main.className = "item__main";
        const readme = makeEl("visible", 600, 600); // 内容本身不可滚
        readme.className = "item__readme b3-typography";
        main.appendChild(readme);
        panel.appendChild(main);
        document.body.appendChild(panel);
        return { panel, main, readme };
    }

    it("① 从 README 后代上溯 → 得 .item__main（不是 null）", () => {
        const { panel, main } = buildPanel();
        // 反例：以 host（面板本体）为起点向上搜（错误的调用点写法）→ null
        expect(findScrollableElement(panel)).toBeNull();
        // 正确：resolveBazaarScrollContainer 从后代上溯
        expect(resolveBazaarScrollContainer(panel)).toBe(main);
    });

    it("② 结果必须是宿主的后代（.item__main 本身），绝不能是 null", () => {
        const { panel, main } = buildPanel();
        const scroller = resolveBazaarScrollContainer(panel);
        expect(scroller).not.toBeNull();
        expect(panel.contains(scroller!)).toBe(true);
        expect(scroller).toBe(main);
    });

    it("③ 无 .item__readme 时回退到 .b3-typography 后代", () => {
        const panel = document.createElement("div");
        panel.id = "configBazaarReadme";
        const main = makeEl("auto", 600, 300);
        main.className = "item__main";
        const typo = makeEl("visible", 600, 600);
        typo.className = "b3-typography"; // 无 .item__readme
        main.appendChild(typo);
        panel.appendChild(main);
        document.body.appendChild(panel);
        expect(resolveBazaarScrollContainer(panel)).toBe(main);
    });

    it("④ host 自身即为滚动容器时也能取到（内容直接可滚）", () => {
        const panel = makeEl("auto", 700, 200); // 面板本身可滚
        panel.id = "configBazaarReadme";
        const readme = makeEl("visible", 700, 700);
        readme.className = "item__readme";
        panel.appendChild(readme);
        document.body.appendChild(panel);
        expect(resolveBazaarScrollContainer(panel)).toBe(panel);
    });

    it("⑤ host 为 null → 返回 null（不抛错）", () => {
        expect(resolveBazaarScrollContainer(null)).toBeNull();
    });
});


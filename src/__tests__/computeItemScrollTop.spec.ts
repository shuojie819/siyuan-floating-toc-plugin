// @vitest-environment jsdom
/**
 * 「只滚动自己」工具集测试（集市滚动会把祖先一起滚走 → P0 缺陷修复）。
 * -----------------------------------------------------------------------------
 * Bug 现象：集市里滚动 README，会把「祖先容器」（#configBazaarReadme 面板/弹窗）一起滚动，
 *          导致 README 被推离、下方露出大片空白，且绝对定位的 TOC（连同顶部按钮）被带出可视区。
 * 根因：scrollIntoView 会滚动目标元素的**所有可滚动祖先**；v0.1.31 把 TOC 容器搬进集市面板内部后，
 *      TOC 元素的祖先链里多了面板/弹窗的滚动容器，而「激活项跟随」每次滚动都会触发它。
 * 修复：弃用该 API，改为只操作「明确指定的滚动容器自己的 scrollTop」。
 *
 * 本文件覆盖：
 *   1. computeItemScrollTop（纯函数）：居中 / nearest 三分支 / 容器高 0 / 项高 > 容器高 / 越界钳制 / 脏数据；
 *   2. clampScrollTop（纯函数）：上下界钳制；
 *   3. scrollItemWithinOwnScroller（DOM）：**绝不写入 TOC 以外祖先的 scrollTop**（核心验收）；
 *   4. computeRelativeOffset + scrollScrollerToOffset：README 跳转只滚自己的滚动容器。
 *
 * 注：jsdom 不实现布局，clientHeight / scrollHeight / getBoundingClientRect 恒为 0，
 *     故在 DOM 用例中用 Object.defineProperty 显式注入这些度量值。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    clampScrollTop,
    computeItemScrollTop,
    computeRelativeOffset,
    scrollItemWithinOwnScroller,
    scrollScrollerToOffset,
    resolveOwnScroller,
} from "../utils/domUtils";

/**
 * 构造带「可写 scrollTop + 可控度量」的容器替身。
 * @param className    class 名
 * @param opts.clientHeight  可视高度
 * @param opts.scrollHeight  内容高度
 * @param opts.scrollTop     初始 scrollTop
 * @param opts.overflowY     overflow-y 值（默认 auto）
 * @param opts.rectTop       getBoundingClientRect().top
 */
function makeScroller(
    className: string,
    opts: {
        clientHeight: number;
        scrollHeight: number;
        scrollTop?: number;
        overflowY?: string;
        rectTop?: number;
    }
) {
    const el = document.createElement("div");
    el.className = className;
    el.style.setProperty("overflow-y", opts.overflowY ?? "auto");

    Object.defineProperty(el, "clientHeight", { value: opts.clientHeight, configurable: true });
    Object.defineProperty(el, "scrollHeight", { value: opts.scrollHeight, configurable: true });

    let current = opts.scrollTop ?? 0;
    const writes: number[] = [];
    Object.defineProperty(el, "scrollTop", {
        get: () => current,
        set: (v: number) => {
            current = v;
            writes.push(v);
        },
        configurable: true,
    });

    el.getBoundingClientRect = () =>
        ({ top: opts.rectTop ?? 0, height: opts.clientHeight, width: 200, left: 0, right: 200, bottom: (opts.rectTop ?? 0) + opts.clientHeight, x: 0, y: opts.rectTop ?? 0, toJSON: () => ({}) }) as DOMRect;

    return { el, writes, get top() { return current; } };
}

/**
 * 构造目标项替身：可视位置 = 内容偏移 - 容器当前 scrollTop（与真实浏览器一致）。
 */
function makeItem(clientScrollTop: number, offsetTop: number, height: number) {
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
        ({ top: offsetTop - clientScrollTop, height, width: 200, left: 0, right: 200, bottom: offsetTop - clientScrollTop + height, x: 0, y: offsetTop - clientScrollTop, toJSON: () => ({}) }) as DOMRect;
    return el;
}

describe("computeItemScrollTop（纯函数 · 激活项滚动量计算）", () => {
    it("mode=center：让目标项居中（中心差 = offsetTop + h/2 - H/2）", () => {
        const target = computeItemScrollTop({
            containerScrollTop: 0,
            containerHeight: 200,
            itemOffsetTop: 500,
            itemHeight: 30,
            mode: "center",
        });
        expect(target).toBe(415);
    });

    it("mode=center 上越界：结果被钳制为 0（不允许出现负 scrollTop）", () => {
        const target = computeItemScrollTop({
            containerScrollTop: 0,
            containerHeight: 200,
            itemOffsetTop: 10,
            itemHeight: 20,
            mode: "center",
            containerScrollHeight: 800,
        });
        expect(target).toBe(0);
    });

    it("mode=center 下越界：结果被钳制为 scrollHeight - containerHeight", () => {
        const target = computeItemScrollTop({
            containerScrollTop: 0,
            containerHeight: 200,
            itemOffsetTop: 900,
            itemHeight: 30,
            mode: "center",
            containerScrollHeight: 1000,
        });
        // 理想 815，但最大可滚动量 = 1000 - 200 = 800
        expect(target).toBe(800);
    });

    it("mode=nearest 已在可视区：完全不动（返回原 scrollTop）", () => {
        const target = computeItemScrollTop({
            containerScrollTop: 100,
            containerHeight: 200,
            itemOffsetTop: 150,
            itemHeight: 30,
            mode: "nearest",
            containerScrollHeight: 900,
        });
        expect(target).toBe(100);
    });

    it("mode=nearest 在可视区下方：最小下移到底边", () => {
        const target = computeItemScrollTop({
            containerScrollTop: 0,
            containerHeight: 200,
            itemOffsetTop: 300,
            itemHeight: 30,
            mode: "nearest",
            containerScrollHeight: 900,
        });
        expect(target).toBe(130);
    });

    it("mode=nearest 在可视区上方：最小上移到顶边", () => {
        const target = computeItemScrollTop({
            containerScrollTop: 500,
            containerHeight: 200,
            itemOffsetTop: 300,
            itemHeight: 30,
            mode: "nearest",
            containerScrollHeight: 900,
        });
        expect(target).toBe(300);
    });

    it("容器高度为 0（尚未布局）：不计算、原样返回", () => {
        const target = computeItemScrollTop({
            containerScrollTop: 42,
            containerHeight: 0,
            itemOffsetTop: 100,
            itemHeight: 20,
            mode: "center",
        });
        expect(target).toBe(42);
    });

    it("项高 > 容器高：无法完整可见 → 对齐顶边", () => {
        const target = computeItemScrollTop({
            containerScrollTop: 0,
            containerHeight: 100,
            itemOffsetTop: 260,
            itemHeight: 400,
            mode: "nearest",
            containerScrollHeight: 1200,
        });
        expect(target).toBe(260);
    });

    it("脏数据防御：NaN / undefined 入参不产生 NaN 结果", () => {
        const target = computeItemScrollTop({
            containerScrollTop: Number.NaN,
            containerHeight: Number.NaN,
            itemOffsetTop: Number.NaN,
            itemHeight: Number.NaN,
            mode: "center",
        });
        expect(Number.isFinite(target)).toBe(true);
        expect(target).toBe(0);
    });

    it("mode 缺省/非法值按 nearest 处理（默认最小移动，最保守）", () => {
        const illegal = computeItemScrollTop({
            containerScrollTop: 0,
            containerHeight: 200,
            itemOffsetTop: 150,
            itemHeight: 30,
            mode: "CENTER" as any,
        });
        // 该项已完整可见 → nearest 语义下不动；若为 center 则会变成 -55 → 0
        expect(illegal).toBe(0);
    });
});

describe("clampScrollTop（越界钳制）", () => {
    it("负值 → 0", () => {
        expect(clampScrollTop(-30, 800, 200)).toBe(0);
    });

    it("超过最大值 → scrollHeight - clientHeight", () => {
        expect(clampScrollTop(9999, 800, 200)).toBe(600);
    });

    it("区间内 → 原值", () => {
        expect(clampScrollTop(350, 800, 200)).toBe(350);
    });

    it("容器未布局（clientHeight 0）→ 0", () => {
        expect(clampScrollTop(120, 800, 0)).toBe(0);
    });

    it("scrollHeight 非法 → 只做下界钳制", () => {
        expect(clampScrollTop(Number.NaN, Number.NaN, 200)).toBe(0);
        expect(clampScrollTop(123, Number.NaN, 200)).toBe(123);
    });
});

describe("scrollItemWithinOwnScroller（关键验收：绝不滚动 TOC 之外的祖先）", () => {
    let outer: ReturnType<typeof makeScroller>;
    let root: HTMLElement;

    beforeEach(() => {
        document.body.innerHTML = "";
        // 模拟集市场景：面板/弹窗级别的可滚动祖先（TOC 容器就挂在它里面）
        outer = makeScroller("panel-scroller", { clientHeight: 600, scrollHeight: 4000, scrollTop: 0 });
        document.body.appendChild(outer.el);
        root = document.createElement("div");
        root.className = "floating-toc bazaar";
        outer.el.appendChild(root);
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("展开态：只写 .toc-content 的 scrollTop，祖先容器一次都不被写入", () => {
        const list = makeScroller("toc-content", { clientHeight: 200, scrollHeight: 1000, scrollTop: 0 });
        root.appendChild(list.el);
        const item = makeItem(0, 300, 30);
        list.el.appendChild(item);

        const ok = scrollItemWithinOwnScroller(item, root, "nearest", "auto");

        expect(ok).toBe(true);
        expect(list.el.scrollTop).toBe(130); // 300 + 30 - 200
        expect(list.writes.length).toBeGreaterThan(0);
        expect(outer.writes).toEqual([]); // ← 核心断言：祖先容器未被触碰
        expect(outer.el.scrollTop).toBe(0);
    });

    it("折叠态：只写最近的自滚动祖先（.collapsed-strip），祖先容器不受影响", () => {
        const strip = makeScroller("collapsed-strip", { clientHeight: 120, scrollHeight: 900, scrollTop: 0 });
        const stripContent = document.createElement("div"); // .strip-content 自身不可滚
        stripContent.className = "strip-content";
        strip.el.appendChild(stripContent);
        root.appendChild(strip.el);
        const stripItem = makeItem(0, 400, 4);
        stripContent.appendChild(stripItem);

        const ok = scrollItemWithinOwnScroller(stripItem, root, "nearest", "auto");

        expect(ok).toBe(true);
        expect(strip.el.scrollTop).toBe(284); // 400 + 4 - 120
        expect(outer.writes).toEqual([]);
    });

    it("展开时定位：mode=center 让激活项居中，且只动列表容器", () => {
        const list = makeScroller("toc-content", { clientHeight: 200, scrollHeight: 1000, scrollTop: 0 });
        root.appendChild(list.el);
        const item = makeItem(0, 500, 30);
        list.el.appendChild(item);

        scrollItemWithinOwnScroller(item, root, "center", "auto");

        expect(list.el.scrollTop).toBe(415);
        expect(outer.writes).toEqual([]);
    });

    it("behavior=smooth：走容器自身的 scrollTo({behavior:'smooth'})，不触碰祖先", () => {
        const list = makeScroller("toc-content", { clientHeight: 200, scrollHeight: 1000, scrollTop: 0 });
        const spy = vi.fn();
        (list.el as any).scrollTo = spy;
        root.appendChild(list.el);
        const item = makeItem(0, 300, 30);
        list.el.appendChild(item);

        const ok = scrollItemWithinOwnScroller(item, root, "nearest", "smooth");

        expect(ok).toBe(true);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith({ top: 130, behavior: "smooth" });
        expect(outer.writes).toEqual([]);
    });

    it("目标项已在可视区：产生 0 次写入（无意义 scroll 事件抖动）", () => {
        const list = makeScroller("toc-content", { clientHeight: 200, scrollHeight: 1000, scrollTop: 100 });
        root.appendChild(list.el);
        const item = makeItem(100, 150, 30);
        list.el.appendChild(item);

        scrollItemWithinOwnScroller(item, root, "nearest", "auto");

        expect(list.writes).toEqual([]);
        expect(list.el.scrollTop).toBe(100);
        expect(outer.writes).toEqual([]);
    });

    it("边界内没有自滚动容器 → 返回 false，且绝不向外扩散到祖先容器", () => {
        const plainWrap = document.createElement("div");
        plainWrap.className = "toc-content"; // 未设 overflow / 不可滚（这种写法下视作不具备滚动能力）
        root.appendChild(plainWrap);
        const item = makeItem(0, 300, 30);
        plainWrap.appendChild(item);

        expect(resolveOwnScroller(item, root)).toBeNull();
        expect(scrollItemWithinOwnScroller(item, root, "nearest", "auto")).toBe(false);
        expect(outer.writes).toEqual([]);
        expect(outer.el.scrollTop).toBe(0);
    });

    it("目标项为 null：安全 no-op", () => {
        expect(scrollItemWithinOwnScroller(null, root)).toBe(false);
        expect(outer.writes).toEqual([]);
    });
});

describe("computeRelativeOffset + scrollScrollerToOffset（README 跳转只滚自己的容器）", () => {
    it("偏移 = 目标相对容器内容起点的坐标（嵌套容器内也正确，QA 实测基线值）", () => {
        const readme = makeScroller("item__main", { clientHeight: 500, scrollHeight: 3000, scrollTop: 2000, rectTop: 100 });
        const wrapper = document.createElement("div");
        wrapper.className = "b3-typography";
        const heading = document.createElement("h2");
        heading.setAttribute("data-type", "NodeHeading");
        // 视口内 top = 600 → 内容偏移 = 600 - 100 + 2000 = 2500（与 QA 实跑一致）
        heading.getBoundingClientRect = () => ({ top: 600, height: 40 } as DOMRect);
        wrapper.appendChild(heading);
        readme.el.appendChild(wrapper);

        expect(computeRelativeOffset(heading, readme.el)).toBe(2500);
    });

    it("跳转只写 README 滚动容器，面板祖先不参与", () => {
        document.body.innerHTML = "";
        const panel = makeScroller("config-bazaar-panel", { clientHeight: 600, scrollHeight: 4000, scrollTop: 0 });
        document.body.appendChild(panel.el);
        const readme = makeScroller("item__main", { clientHeight: 500, scrollHeight: 3000, scrollTop: 0 });
        panel.el.appendChild(readme.el);
        const heading = document.createElement("h2");
        heading.setAttribute("data-type", "NodeHeading");
        heading.getBoundingClientRect = () => ({ top: 800, height: 40 } as DOMRect);
        readme.el.appendChild(heading);

        const offset = computeRelativeOffset(heading, readme.el);
        expect(offset).toBe(800);
        expect(scrollScrollerToOffset(readme.el, offset as number, "smooth")).toBe(true);

        expect(readme.el.scrollTop).toBe(800);
        expect(readme.writes).toEqual([800]);
        expect(panel.writes).toEqual([]); // ← 核心断言：祖先未被连带滚动
        expect(panel.el.scrollTop).toBe(0);
        document.body.innerHTML = "";
    });

    it("scroller / target 缺失 → 返回 null，不做任何兜底滚动", () => {
        const heading = document.createElement("h2");
        expect(scrollScrollerToOffset(null, 100, "auto")).toBe(false);
        expect(computeRelativeOffset(heading, null)).toBeNull();
        expect(computeRelativeOffset(null, readmeDummy())).toBeNull();
    });

    it("偏移超过最大可滚动量 → 钳制到 scrollHeight - clientHeight", () => {
        const readme = makeScroller("item__main", { clientHeight: 500, scrollHeight: 1000, scrollTop: 0 });
        expect(scrollScrollerToOffset(readme.el, 99999, "auto")).toBe(true);
        expect(readme.el.scrollTop).toBe(500);
    });
});

/** 仅用于构造一个非 null 的滚动容器占位（缺失参数用例用） */
function readmeDummy(): HTMLElement {
    const el = document.createElement("div");
    document.body.appendChild(el);
    return el;
}

describe("computeRelativeOffset 包含性校验（QA 实测：不同源必须 null，不得返回视差数字）", () => {
    /**
     * 构造 QA 复现场：宿主内有两个 .protyle-content，目标标题在**第二个**里，
     * 而 resolveScrollContainer 取到的（模拟为第一个）与 target 不同源。
     */
    function buildTwoContentHost() {
        document.body.innerHTML = "";
        const host = document.createElement("div");
        host.className = "protyle";
        const first = makeScroller("protyle-content", { clientHeight: 500, scrollHeight: 3000, scrollTop: 0, rectTop: 50 });
        const second = makeScroller("protyle-content", { clientHeight: 500, scrollHeight: 3000, scrollTop: 0, rectTop: 50 });
        const heading = document.createElement("h2");
        heading.setAttribute("data-type", "NodeHeading");
        heading.getBoundingClientRect = () => ({ top: 3150, height: 40 } as DOMRect);
        second.el.appendChild(heading);
        host.appendChild(first.el);
        host.appendChild(second.el);
        document.body.appendChild(host);
        return { first, second, heading };
    }

    it("target 不在 scroller 内 → 返回 null（绝不返回 0：0 会滚到顶部，比不滚更糟）", () => {
        const { first, heading } = buildTwoContentHost();
        expect(first.el.contains(heading)).toBe(false);
        // 无条件做差值会得到 3150 - 50 + 0 = 3100 这类纯视差数字（正是 QA 实测到的错值）
        const parallax = heading.getBoundingClientRect().top - first.el.getBoundingClientRect().top;
        expect(parallax).toBe(3100);
        expect(computeRelativeOffset(heading, first.el)).toBeNull();
        document.body.innerHTML = "";
    });

    it("target 在 scroller 子树内 → 正常返回偏移（不同源才拒绝）", () => {
        const { second, heading } = buildTwoContentHost();
        expect(computeRelativeOffset(heading, second.el)).toBe(3100);
        document.body.innerHTML = "";
    });

    it("target 自身就是 scroller：contains 为真（含自身），按 scrollTop 返回", () => {
        const scroller = makeScroller("protyle-content", { clientHeight: 500, scrollHeight: 2000, scrollTop: 120 });
        expect(computeRelativeOffset(scroller.el, scroller.el)).toBe(120);
    });

    it("调用链路：offset 为 null 时不产生任何滚动写入（scrollTop / scrollTo 均未被触碰）", () => {
        const { first, heading } = buildTwoContentHost();
        const scrollToSpy = vi.fn();
        (first.el as any).scrollTo = scrollToSpy;

        // 复刻 FloatingToc.svelte 中「点击大纲项跳转」的真实调用序列
        let didScroll = false;
        const offsetTop = computeRelativeOffset(heading, first.el);
        if (offsetTop !== null) {
            didScroll = scrollScrollerToOffset(first.el, offsetTop, "smooth");
        }

        expect(offsetTop).toBeNull();
        expect(didScroll).toBe(false);
        expect(scrollToSpy).not.toHaveBeenCalled();
        expect(first.writes).toEqual([]);
        expect(first.el.scrollTop).toBe(0);
        document.body.innerHTML = "";
    });
});

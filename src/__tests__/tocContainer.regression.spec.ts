// @vitest-environment jsdom
/**
 * 多实例叠加 bug 回归测试（v0.1.22 修复验收）
 * -----------------------------------------------------------------------------
 * Bug 现象：同一文档右侧出现多个悬浮大纲叠加、移到左侧后右侧仍存在、颜色变深。
 * 根因：Svelte 4 的 `toc.$destroy()` 只移除组件内部 DOM（.floating-toc），
 *       不会移除 createToc 中手动创建的外层容器 .siyuan-floating-toc-plugin-container，
 *       导致容器在 DOM 中累积叠加；且旧 checkProtyles 清理只 delete map 不销毁组件、不移除容器。
 *
 * 核心不变量：对同一个 protyle host 反复执行「创建 TOC → 触发弹窗/面板覆盖销毁 → 再创建」
 *             .siyuan-floating-toc-plugin-container 在 DOM 中的数量始终 = 1（不累积、不残留）。
 *
 * 实现说明：
 *   - jsdom 下无法干净实例化真实 Svelte 组件（依赖思源内核运行时），故用 vi.mock 将
 *     ../FloatingToc.svelte 替换为最小桩：构造函数向 target 容器注入 .floating-toc，
 *     $destroy 时移除该内部 DOM。这样既隔离了内核依赖，又能驱动真实的 createToc /
 *     destroyTocForHost / checkProtyles 逻辑（修复点所在）。
 *   - 普通文档容器挂在 host 下；集市场景容器挂在 document.body 并标记 data-bazaar=true、
 *     通过 (container as any)._tocHost 关联 host。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProtyleManager } from "../modules/protyleManager";

/**
 * 用最小桩替换真实 Svelte 组件，仅保留 ProtyleManager.createToc 所需的接口：
 *   - constructor({ target, props })：向 target 注入 .floating-toc 内部 DOM
 *   - $destroy()：移除 .floating-toc（模拟 Svelte 组件销毁内部 DOM）
 *   - updateHeadings() / setVisible() / toggle()：no-op
 */
vi.mock("../FloatingToc.svelte", () => {
    return {
        default: class FloatingTocStub {
            target: HTMLElement;
            props: Record<string, unknown>;
            destroyed = false;
            constructor(options: { target: HTMLElement; props: Record<string, unknown> }) {
                this.target = options.target;
                this.props = options.props;
                const inner = document.createElement("div");
                inner.className = "floating-toc";
                this.target.appendChild(inner);
            }
            $destroy(): void {
                this.destroyed = true;
                const inner = this.target.querySelector(".floating-toc");
                if (inner) inner.remove();
            }
            updateHeadings(): void {
                /* no-op */
            }
            setVisible(): void {
                /* no-op */
            }
            toggle(): void {
                /* no-op */
            }
        }
    };
});

type Rect = { left: number; top: number; width: number; height: number };

/** mock getBoundingClientRect，返回非零宽高矩形（jsdom 默认全 0）。 */
function setRect(el: HTMLElement, r: Rect): void {
    const right = r.left + r.width;
    const bottom = r.top + r.height;
    el.getBoundingClientRect = () =>
        ({
            x: r.left,
            y: r.top,
            left: r.left,
            top: r.top,
            right,
            bottom,
            width: r.width,
            height: r.height,
            toJSON: () => ({})
        }) as DOMRect;
}

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

/** 在 document.body 下创建普通文档 protyle host，并挂上 .protyle-content[data-node-id]。 */
function createProtyleHost(docId: string): HTMLElement {
    const protyle = document.createElement("div");
    protyle.className = "protyle";
    const content = document.createElement("div");
    content.className = "protyle-content";
    content.setAttribute("data-node-id", docId);
    protyle.appendChild(content);
    document.body.appendChild(protyle);
    // 给 host 一个非零可见矩形，避免 isElementVisible 因面积为 0 误判
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    return protyle;
}

/** 创建一个覆盖 protyle 的面板/弹窗（用于模拟 设置/全局搜索/历史 遮挡）。 */
function createCoverPanel(cls: string, dataKey?: string): HTMLElement {
    const el = document.createElement("div");
    if (cls) el.className = cls;
    if (dataKey) el.setAttribute("data-key", dataKey);
    document.body.appendChild(el);
    setRect(el, { left: 0, top: 0, width: 500, height: 500 });
    return el;
}

/** 统计某 host 下（普通文档场景）的 TOC 容器数量。 */
function countInHost(host: HTMLElement): number {
    return host.querySelectorAll(".siyuan-floating-toc-plugin-container").length;
}

/** 统计整个 document 下（含集市场景）的 TOC 容器数量。 */
function countInDocument(): number {
    return document.querySelectorAll(".siyuan-floating-toc-plugin-container").length;
}

describe("多实例叠加回归 - 容器数量不累积/不残留", () => {
    let manager: ProtyleManager;
    // 最小 plugin mock：仅包含 ProtyleManager 实际访问的字段/方法
    const plugin: any = {
        data: {},
        tocVisible: true,
        tocInstances: new Map<HTMLElement, any>(),
        tocDocIds: new Map<HTMLElement, string>(),
        eventHandlers: {
            scheduleSearchUpdate() {},
            scheduleHistoryUpdate() {},
            addSearchListItemListeners() {}
        },
        createToc: (host: HTMLElement, docId: string) => manager.createToc(host, docId)
    };

    beforeEach(() => {
        document.body.replaceChildren();
        mockGetComputedStyle();
        plugin.tocInstances.clear();
        plugin.tocDocIds.clear();
        manager = new ProtyleManager(plugin);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("A. createToc 普通文档重复创建：容器数量恒为 1（不累积）", () => {
        const host = createProtyleHost("20240101000000-aaaaaaa");
        // 模拟未走 checkProtyles 清理、直接多次 rebuild 的边缘场景
        for (let i = 0; i < 5; i++) {
            manager.createToc(host, "20240101000000-aaaaaaa");
            expect(countInHost(host)).toBe(1);
        }
        expect(plugin.tocInstances.size).toBe(1);
    });

    it("B. destroyTocForHost：销毁组件后同时移除外层容器 DOM（核心修复）", () => {
        const host = createProtyleHost("20240101000000-bbbbbbb");
        manager.createToc(host, "20240101000000-bbbbbbb");
        expect(countInHost(host)).toBe(1);

        // 旧实现只 delete map + toc.$destroy()，容器 DOM 会残留叠加；修复后应被移除
        (manager as any).destroyTocForHost(host);

        expect(countInHost(host)).toBe(0);
        expect(plugin.tocInstances.has(host)).toBe(false);
        expect(plugin.tocDocIds.has(host)).toBe(false);
    });

    it("C. removeContainerForHost：普通文档与集市场景均移除对应容器", () => {
        // 普通文档
        const host = createProtyleHost("20240101000000-ccccccc");
        manager.createToc(host, "20240101000000-ccccccc");
        expect(countInHost(host)).toBe(1);
        (manager as any).removeContainerForHost(host);
        expect(countInHost(host)).toBe(0);

        // 集市场景（容器挂在 body，data-bazaar=true，_tocHost 关联）
        const bazaar = document.createElement("div");
        bazaar.id = "configBazaarReadme";
        document.body.appendChild(bazaar);
        manager.createToc(bazaar, "bazaar");
        expect(
            document.querySelectorAll('.siyuan-floating-toc-plugin-container[data-bazaar="true"]').length
        ).toBe(1);
        (manager as any).removeContainerForHost(bazaar);
        expect(
            document.querySelectorAll('.siyuan-floating-toc-plugin-container[data-bazaar="true"]').length
        ).toBe(0);
    });

    it("D. 集成：模拟 设置→全局搜索→历史→设置 循环，容器数量始终 = 1 不残留", () => {
        const host = createProtyleHost("20240101000000-dddddddd");

        // 初始：文档可见、无遮挡 → 应创建 1 个 TOC
        manager.checkProtyles();
        expect(countInHost(host)).toBe(1);
        expect(countInDocument()).toBe(1);

        // 1) 打开「设置」弹窗（覆盖文档）
        const settings = createCoverPanel("b3-dialog", "dialog-setting");
        manager.checkProtyles();
        expect(countInHost(host)).toBe(0); // 被设置弹窗遮挡 → 销毁，容器移除不残留
        settings.remove();

        // 关闭设置 → 重新创建
        manager.checkProtyles();
        expect(countInHost(host)).toBe(1);

        // 2) 打开「全局搜索」面板（.search__panel）
        const search = createCoverPanel("search__panel");
        manager.checkProtyles();
        expect(countInHost(host)).toBe(0);
        search.remove();

        manager.checkProtyles();
        expect(countInHost(host)).toBe(1);

        // 3) 打开「文件历史」面板（.history__panel）
        const history = createCoverPanel("history__panel");
        manager.checkProtyles();
        expect(countInHost(host)).toBe(0);
        history.remove();

        manager.checkProtyles();
        expect(countInHost(host)).toBe(1);

        // 4) 再次打开「设置」（序列以设置收尾）
        const settings2 = createCoverPanel("b3-dialog", "dialog-setting");
        manager.checkProtyles();
        expect(countInHost(host)).toBe(0);
        settings2.remove();

        manager.checkProtyles();

        // 不变量：末尾同 host 仅 1 个容器，全文档也仅 1 个，map 无累积
        expect(countInHost(host)).toBe(1);
        expect(countInDocument()).toBe(1);
        expect(plugin.tocInstances.size).toBe(1);
        expect(plugin.tocDocIds.size).toBe(1);
    });

    it("E. cleanup：卸载时移除所有 TOC 容器（无残留叠加）", () => {
        const h1 = createProtyleHost("20240101000000-eeeeeee");
        const h2 = createProtyleHost("20240101000000-fffffff");
        manager.createToc(h1, "20240101000000-eeeeeee");
        manager.createToc(h2, "20240101000000-fffffff");
        expect(countInDocument()).toBe(2);

        manager.cleanup();
        expect(countInDocument()).toBe(0);
        expect(plugin.tocInstances.size).toBe(0);
        expect(plugin.tocDocIds.size).toBe(0);
    });
});

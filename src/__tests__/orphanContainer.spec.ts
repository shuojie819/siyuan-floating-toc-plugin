// @vitest-environment jsdom
/**
 * Issue #44 验收：孤儿 TOC 容器判定 与 destroy-protyle 即时清理。
 * -----------------------------------------------------------------------------
 * Bug 现象（偶发）：收起右侧文档后，编辑器元素穿透到左侧菜单之上。
 *
 * 修复点：
 *   1) ProtyleManager 新增 destroyTocForProtyle(protyle)：响应思源 destroy-protyle 事件，
 *      宿主 protyle 销毁时立即清理其 TOC（含外层容器 DOM），消除「已销毁宿主的 TOC
 *      仍短暂停留于文档中」的残留窗口；
 *   2) checkProtyles 末尾新增 sweepOrphanContainers()：清扫所有孤儿容器
 *      （宿主脱离文档 / 集市容器 _tocHost 失效 / 无宿主祖先），并回收关联实例。
 *
 * 不变量：任何时刻，DOM 中不应存在「宿主已销毁」的 .siyuan-floating-toc-plugin-container。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProtyleManager } from "../modules/protyleManager";
import { isOrphanTocContainer } from "../utils/domUtils";

/** 用最小桩替换真实 Svelte 组件（同 tocContainer.regression.spec）。 */
vi.mock("../FloatingToc.svelte", () => {
    return {
        default: class FloatingTocStub {
            target: HTMLElement;
            constructor(options: { target: HTMLElement }) {
                this.target = options.target;
                const inner = document.createElement("div");
                inner.className = "floating-toc";
                this.target.appendChild(inner);
            }
            $destroy(): void {
                const inner = this.target.querySelector(".floating-toc");
                if (inner) inner.remove();
            }
            updateHeadings(): void { /* no-op */ }
            setVisible(): void { /* no-op */ }
            toggle(): void { /* no-op */ }
        }
    };
});

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

/** 在 body 下创建普通文档 protyle host，并挂上 .protyle-content[data-node-id]。 */
function createProtyleHost(docId: string): HTMLElement {
    const protyle = document.createElement("div");
    protyle.className = "protyle";
    const content = document.createElement("div");
    content.className = "protyle-content";
    content.setAttribute("data-node-id", docId);
    protyle.appendChild(content);
    document.body.appendChild(protyle);
    protyle.getBoundingClientRect = () =>
        ({ x: 100, y: 100, left: 100, top: 100, right: 300, bottom: 500, width: 200, height: 400, toJSON: () => ({}) }) as DOMRect;
    return protyle;
}

const countInDocument = () => document.querySelectorAll(".siyuan-floating-toc-plugin-container").length;

describe("isOrphanTocContainer - 孤儿容器判定", () => {
    beforeEach(() => { document.body.replaceChildren(); });
    afterEach(() => { vi.restoreAllMocks(); });
    const connected = (h: HTMLElement) => document.contains(h);

    it("1. 未连接文档的容器一律视为孤儿", () => {
        const c = document.createElement("div");
        c.className = "siyuan-floating-toc-plugin-container";
        expect(isOrphanTocContainer(c, connected)).toBe(true);
    });

    it("2. 内嵌于「仍连接」的 .protyle 宿主 → 非孤儿", () => {
        const host = createProtyleHost("20240101000000-aaaaaaa");
        const c = document.createElement("div");
        c.className = "siyuan-floating-toc-plugin-container";
        host.appendChild(c);
        expect(isOrphanTocContainer(c, connected)).toBe(false);
    });

    it("3. 宿主已脱离文档（容器随之脱离）→ 孤儿", () => {
        const host = createProtyleHost("20240101000000-bbbbbbb");
        const c = document.createElement("div");
        c.className = "siyuan-floating-toc-plugin-container";
        host.appendChild(c);
        host.remove();
        expect(isOrphanTocContainer(c, connected)).toBe(true);
    });

    it("4. 集市容器：_tocHost 有效 → 非孤儿；缺失/失效 → 孤儿", () => {
        const c = document.createElement("div");
        c.className = "siyuan-floating-toc-plugin-container";
        c.dataset.bazaar = "true";
        document.body.appendChild(c);

        // 无 _tocHost
        expect(isOrphanTocContainer(c, connected)).toBe(true);

        // _tocHost 有效（连接于文档）
        const goodHost = document.createElement("div");
        document.body.appendChild(goodHost);
        (c as any)._tocHost = goodHost;
        expect(isOrphanTocContainer(c, connected)).toBe(false);

        // _tocHost 失效（未连接文档）
        const badHost = document.createElement("div");
        (c as any)._tocHost = badHost;
        expect(isOrphanTocContainer(c, connected)).toBe(true);
    });

    it("5. 连接于文档但无宿主祖先的容器 → 孤儿", () => {
        const c = document.createElement("div");
        c.className = "siyuan-floating-toc-plugin-container";
        document.body.appendChild(c);
        expect(isOrphanTocContainer(c, connected)).toBe(true);
    });
});

describe("ProtyleManager - 孤儿容器清扫 与 destroy-protyle 即时清理", () => {
    let manager: ProtyleManager;
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
    afterEach(() => { vi.restoreAllMocks(); });

    it("A. destroyTocForProtyle：立即移除容器 + 回收实例（模拟收起右侧文档）", () => {
        const host = createProtyleHost("20240101000000-ccccccc");
        manager.createToc(host, "20240101000000-ccccccc");
        expect(countInDocument()).toBe(1);
        expect(plugin.tocInstances.has(host)).toBe(true);

        // 模拟 destroy-protyle 事件：宿主即将/已被销毁
        manager.destroyTocForProtyle({ element: host });

        expect(host.querySelectorAll(".siyuan-floating-toc-plugin-container").length).toBe(0);
        expect(plugin.tocInstances.has(host)).toBe(false);
        expect(plugin.tocDocIds.has(host)).toBe(false);
    });

    it("B. 宿主脱离文档后，checkProtyles 兜底清扫 → 无残留容器", () => {
        const host = createProtyleHost("20240101000000-dddddddd");
        manager.createToc(host, "20240101000000-dddddddd");
        expect(countInDocument()).toBe(1);

        // 宿主被移除但未收到 destroy 事件（时序竞态）
        host.remove();
        manager.checkProtyles();

        expect(countInDocument()).toBe(0);
        expect(plugin.tocInstances.size).toBe(0);
    });

    it("C. sweepOrphanContainers 清理「_tocHost 失效」的孤儿集市容器", () => {
        const orphan = document.createElement("div");
        orphan.className = "siyuan-floating-toc-plugin-container";
        orphan.dataset.bazaar = "true";
        (orphan as any)._tocHost = document.createElement("div"); // 未连接文档
        document.body.appendChild(orphan);
        expect(countInDocument()).toBe(1);

        manager.checkProtyles();

        expect(countInDocument()).toBe(0);
    });

    it("D. 安全网不误伤：有效宿主（连接于文档且在实例表内）的容器保留", () => {
        const host = createProtyleHost("20240101000000-eeeeeee");
        manager.checkProtyles();
        expect(countInDocument()).toBe(1);
        // 再次 sweep（宿主仍有效）→ 不应被当作孤儿移除
        manager.checkProtyles();
        expect(countInDocument()).toBe(1);
        expect(plugin.tocInstances.has(host)).toBe(true);
    });
});

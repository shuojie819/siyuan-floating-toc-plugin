// @vitest-environment jsdom
/**
 * Issue #52（第二轮）验收：智能体「沉浸式全屏」时，文档的悬浮大纲必须隐藏。
 * -----------------------------------------------------------------------------
 * 上一版做了什么（正确，保留）：`isCoveredByDialog()` 的容器白名单加入了
 *   `.sy__agentChat, .agent-chat`（利用既有「矩形重叠」判定区分停靠/全屏两态）。
 *
 * 为什么上一版装了包仍然不行（本轮根因，已确凿）：
 *   闸门正确，但**从未被求值**。清理循环在 protyleManager.checkProtyles 里跑，而触发
 *   checkProtyles 的 MutationObserver 过滤逻辑**完全不认智能体容器**；且实测 3.8.5 中
 *   「智能体全屏」没有任何 agent+fullscreen 专属类名（切换方式未知），观察器也不会命中。
 *   → 只要那轮扫描从未跑过，闸门再对也无效。
 *
 * 本轮两层修复：
 *   (a) 观察器过滤补上智能体容器：`isAgentContainerRelated(node)` → `shouldCheck = true`（即时触发）；
 *   (b) ⭐ 低频兜底扫描（IDLE_SWEEP_INTERVAL_MS）：**不依赖任何 DOM 信号**的保证，
 *       每轮复用防抖调度入口 `debouncedCheckProtyles()`，`document.hidden` 时跳过，
 *       卸载时 `clearInterval`。
 *
 * ⚠️ 本测试仅覆盖「代码 / 单测支持」。真机行为（进入全屏大纲消失 / 退出恢复 / 停靠仍正常）
 *    依赖 jsdom 无法提供的布局引擎与真实 MutationObserver 时序，**必须真机验收**。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isAgentContainerRelated, shouldRunIdleSweep } from "../utils/domUtils";
import { ProtyleManager, IDLE_SWEEP_INTERVAL_MS } from "../modules/protyleManager";
import { TIMING } from "../types";

/** 用最小桩替换真实 Svelte 组件（同 orphanContainer.spec / domUtils.ai.spec）。 */
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

/** 在给定父节点下创建一个带 class 的元素。 */
function createEl(cls: string, parent: HTMLElement = document.body): HTMLElement {
    const el = document.createElement("div");
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
}

// ===========================================================================
// (1) 纯函数：isAgentContainerRelated
// ===========================================================================
describe("isAgentContainerRelated - 智能体容器相关判定（Issue #52 (a)）", () => {
    beforeEach(() => { document.body.replaceChildren(); });
    afterEach(() => { document.body.replaceChildren(); });

    it("1. 节点自身是 `.sy__agentChat` → true", () => {
        const el = createEl("fn__flex-1 sy__agentChat dockPanel layout__t");
        expect(isAgentContainerRelated(el)).toBe(true);
    });

    it("2. 节点自身是 `.agent-chat` → true", () => {
        const el = createEl("agent-chat fn__flex-column fn__flex-1");
        expect(isAgentContainerRelated(el)).toBe(true);
    });

    it("3. 节点位于 `.sy__agentChat` 内部（子节点增删场景）→ true", () => {
        const panel = createEl("sy__agentChat dockPanel");
        const agentChat = createEl("agent-chat", panel);
        const msg = createEl("agent-chat__msg", agentChat);
        expect(isAgentContainerRelated(msg)).toBe(true);
    });

    it("4. 节点包含 `.agent-chat`（整块子树被添加/移除场景）→ true", () => {
        const wrapper = createEl("fn__flex-1"); // 外层包裹本身无智能体类名
        createEl("agent-chat fn__flex-column", wrapper);
        expect(isAgentContainerRelated(wrapper)).toBe(true);
    });

    it("5. 无关节点（普通文档 .protyle）→ false", () => {
        const protyle = createEl("protyle");
        createEl("protyle-content", protyle);
        expect(isAgentContainerRelated(protyle)).toBe(false);
    });

    it("6. 无关节点（集市 / 搜索 / 历史容器）→ false", () => {
        expect(isAgentContainerRelated(createEl("config-bazaar__readme"))).toBe(false);
        expect(isAgentContainerRelated(createEl("search__preview"))).toBe(false);
        expect(isAgentContainerRelated(createEl("history__text"))).toBe(false);
    });

    it("7. 非 HTMLElement / null / undefined → false（防御）", () => {
        expect(isAgentContainerRelated(null)).toBe(false);
        expect(isAgentContainerRelated(undefined)).toBe(false);
        expect(isAgentContainerRelated(document.createTextNode("x"))).toBe(false);
    });
});

// ===========================================================================
// (2) 纯函数：shouldRunIdleSweep
// ===========================================================================
describe("shouldRunIdleSweep - 兜底扫描「是否应当执行」判定", () => {
    it("页面可见（hidden=false）→ 执行", () => {
        expect(shouldRunIdleSweep(false)).toBe(true);
    });

    it("页面不可见（hidden=true）→ 跳过", () => {
        expect(shouldRunIdleSweep(true)).toBe(false);
    });
});

// ===========================================================================
// (3) 低频兜底扫描：定时触发 / hidden 跳过 / 卸载清理
// ===========================================================================
describe("Issue #52 - 低频兜底扫描（不依赖 DOM 信号）", () => {
    let manager: ProtyleManager;
    let checkSpy: ReturnType<typeof vi.spyOn>;
    const plugin: any = {
        data: {},
        tocVisible: true,
        tocInstances: new Map<HTMLElement, any>(),
        tocDocIds: new Map<HTMLElement, string>(),
        eventHandlers: {
            scheduleSearchUpdate() { /* no-op */ },
            scheduleHistoryUpdate() { /* no-op */ },
            addSearchListItemListeners() { /* no-op */ }
        },
        createToc: () => { /* no-op */ }
    };

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.replaceChildren();
        plugin.tocInstances.clear();
        plugin.tocDocIds.clear();
        manager = new ProtyleManager(plugin);
        // 隔离扫描本体：只关心「是否被调度」，用桩替换真实 checkProtyles。
        checkSpy = vi.spyOn(manager, "checkProtyles").mockImplementation(() => { /* no-op */ });
    });

    afterEach(() => {
        manager.cleanup();
        vi.useRealTimers();
        vi.restoreAllMocks();
        // 移除可能被覆盖的 document.hidden 自有属性，恢复 prototype getter
        delete (document as any).hidden;
        document.body.replaceChildren();
    });

    it("A. 定时器到点触发扫描（且经由防抖调度入口）", () => {
        manager.startIdleSweep();

        // 未到点：不触发
        vi.advanceTimersByTime(IDLE_SWEEP_INTERVAL_MS - 1);
        expect(checkSpy).not.toHaveBeenCalled();

        // 恰好到点：仅「调度」了防抖（150ms 后执行），此刻尚未真正扫描 →
        // 证明走的是 debouncedCheckProtyles 而非裸调 checkProtyles
        vi.advanceTimersByTime(1);
        expect(checkSpy).not.toHaveBeenCalled();

        // 越过防抖延迟后真正执行
        vi.advanceTimersByTime(TIMING.DEBOUNCE_DELAY);
        expect(checkSpy).toHaveBeenCalled();
    });

    it("B. document.hidden 为 true 时不触发", () => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });

        manager.startIdleSweep();
        vi.advanceTimersByTime(IDLE_SWEEP_INTERVAL_MS * 3 + TIMING.DEBOUNCE_DELAY);

        expect(checkSpy).not.toHaveBeenCalled();
    });

    it("C. document.hidden 为 false 时正常触发（对照 B）", () => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });

        manager.startIdleSweep();
        vi.advanceTimersByTime(IDLE_SWEEP_INTERVAL_MS + TIMING.DEBOUNCE_DELAY);

        expect(checkSpy).toHaveBeenCalled();
    });

    it("D. 卸载（cleanup）后 clearInterval 生效：推进时间不再触发", () => {
        manager.startIdleSweep();
        manager.cleanup();

        vi.advanceTimersByTime(IDLE_SWEEP_INTERVAL_MS * 5 + TIMING.DEBOUNCE_DELAY);
        expect(checkSpy).not.toHaveBeenCalled();
    });

    it("E. 幂等：重复 startIdleSweep 不产生多重定时器（每轮至多一次调度）", () => {
        manager.startIdleSweep();
        manager.startIdleSweep();
        manager.startIdleSweep();

        vi.advanceTimersByTime(IDLE_SWEEP_INTERVAL_MS + TIMING.DEBOUNCE_DELAY);

        // 防抖会合并三个定时器在相同时刻的调度为一次真正扫描
        expect(checkSpy).toHaveBeenCalledTimes(1);
    });
});

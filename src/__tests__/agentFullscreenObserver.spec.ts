// @vitest-environment jsdom
/**
 * Issue #52 第二轮补测：MutationObserver **接线级**用例 —— 专门堵住 M-C 覆盖缺口。
 * -----------------------------------------------------------------------------
 * 缺口来源（独立变异校验 M-C 暴露）：
 *   删掉 `src/modules/protyleManager.ts` 的 `monitorProtyles()` 里那 4 处
 *   `isAgentContainerRelated(...)` 插入后，**原有全部用例依旧全绿**（纯函数层 +
 *   定时器层都无法报警）—— 即修复 (a) 的「观察器过滤 → 调度」接线此前**零测试保护**。
 *   这正是上一轮「只测原语、不测接线」同类假绿点，故本轮显式补齐。
 *
 * 本用例与既有纯函数用例的关键区别：
 *   **真正经过 MutationObserver 回调**（`manager.monitorProtyles()` 建立真实观察器，
 *   向 DOM 变更后由观察器回调把 mutation 送进被测的「过滤 → shouldCheck → 防抖调度」路径），
 *   而**不是**直接调用 `isAgentContainerRelated()`。
 *
 * 断言策略：
 *   1. 正向：加入 `.sy__agentChat` → 排空观察器微任务 → 越过防抖时长 → 扫描被调度（≥1 次）；
 *   2. 反向对照：加入无关节点 → 同样推进 → 扫描 **0 次**（防止将来把过滤放宽成「任何变更都扫」）。
 *
 * 注：使用假定时器；观察器回调在微任务中投递，靠 `vi.advanceTimersByTimeAsync` 排空，
 *     仅推进 < 兜底周期（1000ms），故命中只可能来自观察器而非 idle sweep。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProtyleManager } from "../modules/protyleManager";
import { TIMING } from "../types";

vi.mock("../FloatingToc.svelte", () => ({
    default: class FloatingTocStub {
        constructor(_: any) {}
        $destroy(): void {}
        updateHeadings(): void {}
        setVisible(): void {}
        toggle(): void {}
    }
}));

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
    createToc: () => {}
};

let manager: ProtyleManager;
let checkSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
    plugin.tocInstances.clear();
    plugin.tocDocIds.clear();
    manager = new ProtyleManager(plugin);
    // 建立真实 MutationObserver + 「过滤 → shouldCheck → 防抖调度」接线
    manager.monitorProtyles();
    // 隔离扫描本体：只关心「是否被调度」
    checkSpy = vi.spyOn(manager, "checkProtyles").mockImplementation(() => { /* no-op */ });
});

afterEach(() => {
    manager.cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
});

describe("Issue #52 (a) - MutationObserver 接线级（堵 M-C 缺口）", () => {
    it("加入 `.sy__agentChat` → 经观察器回调触发防抖调度 → checkProtyles 被调用（≥1 次）", async () => {
        const agent = document.createElement("div");
        agent.className = "sy__agentChat dockPanel layout__t";
        document.body.appendChild(agent);

        // 排空 MutationObserver 的微任务投递（此时仅「调度」了防抖，尚未真正扫描）
        await vi.advanceTimersByTimeAsync(0);
        expect(checkSpy).not.toHaveBeenCalled();

        // 越过防抖延迟 → 真正执行扫描（严格 < 兜底周期 1000ms，排除 idle sweep 干扰）
        await vi.advanceTimersByTimeAsync(TIMING.DEBOUNCE_DELAY);

        expect(checkSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("反向对照：加入无关节点 → 观察器过滤不置 shouldCheck → 扫描 0 次", async () => {
        const plain = document.createElement("div");
        plain.className = "totally-unrelated-node";
        document.body.appendChild(plain);

        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(TIMING.DEBOUNCE_DELAY);

        expect(checkSpy).not.toHaveBeenCalled();
    });
});

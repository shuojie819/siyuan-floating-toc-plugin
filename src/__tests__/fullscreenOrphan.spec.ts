// @vitest-environment jsdom
/**
 * Issue #44 验收：FullscreenHelper 残留浮层兜底清扫。
 * -----------------------------------------------------------------------------
 * 风险：宿主（.render-node / protyle）销毁后，
 *   - elementCleanups 中的失效条目会让闭包/监听器长期驻留（内存泄漏）；
 *   - 内联注入的 .fullscreen-helper-btn-container（z-index:30）若父宿主不再被跟踪，
 *     可能残留在文档中；
 *   - 异常/重复进入全屏还可能遗留未被跟踪的 .fullscreen-helper-overlay（z-index:9999）。
 *
 * 修复：scanAllChartElements 起始处调用 sweepStaleEntries()，清理上述三类残留。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FullscreenHelper } from "../libs/FullscreenHelper";

const mockPlugin: any = { i18n: { fullscreen: "Fullscreen" } };

describe("FullscreenHelper - 残留浮层兜底清扫（Issue #44）", () => {
    beforeEach(() => { document.body.replaceChildren(); });
    afterEach(() => { vi.restoreAllMocks(); });

    it("1. init 时回收「宿主已脱离文档」的 cleanup 条目（防闭包/监听器泄漏）", () => {
        const helper: any = new FullscreenHelper(mockPlugin, { enableFullscreenHelper: true });

        const deadHost = document.createElement("div");
        deadHost.className = "render-node";
        document.body.appendChild(deadHost);
        deadHost.remove(); // 宿主销毁

        let cleaned = 0;
        helper.elementCleanups.set(deadHost, () => { cleaned++; });

        helper.init();

        expect(cleaned).toBe(1);                                  // 失效 cleanup 被回收
        expect(helper.elementCleanups.has(deadHost)).toBe(false); // 失效条目被删除

        helper.destroy();
    });

    it("2. 移除父宿主不被跟踪的残留按钮容器（z-index:30）", () => {
        const helper: any = new FullscreenHelper(mockPlugin, { enableFullscreenHelper: true });

        // 仍连接于文档，但其父宿主未登记在 elementCleanups → 视为孤儿浮层
        const host = document.createElement("div");
        host.className = "render-node";
        const btnContainer = document.createElement("div");
        btnContainer.className = "fullscreen-helper-btn-container";
        btnContainer.style.zIndex = "30";
        host.appendChild(btnContainer);
        document.body.appendChild(host);

        helper.init();

        expect(btnContainer.parentElement).toBeNull();

        helper.destroy();
    });

    it("3. 移除未被跟踪的孤儿全屏浮层（z-index:9999），保留本实例跟踪的浮层", () => {
        const helper: any = new FullscreenHelper(mockPlugin, { enableFullscreenHelper: true });

        const orphanOverlay = document.createElement("div");
        orphanOverlay.className = "fullscreen-helper-overlay";
        document.body.appendChild(orphanOverlay);

        const trackedOverlay = document.createElement("div");
        trackedOverlay.className = "fullscreen-helper-overlay";
        document.body.appendChild(trackedOverlay);
        helper.fullscreenContainer = trackedOverlay;

        helper.init();

        expect(orphanOverlay.isConnected).toBe(false);  // 孤儿浮层被清除
        expect(trackedOverlay.isConnected).toBe(true);  // 当前浮层保留

        helper.destroy();
    });

    it("4. 安全网不误伤：正常宿主（连接且被跟踪）的按钮容器与条目保留", () => {
        const helper: any = new FullscreenHelper(mockPlugin, { enableFullscreenHelper: true });

        const liveHost = document.createElement("div");
        liveHost.className = "render-node";
        const liveBtn = document.createElement("div");
        liveBtn.className = "fullscreen-helper-btn-container";
        liveHost.appendChild(liveBtn);
        document.body.appendChild(liveHost);

        let cleaned = 0;
        helper.elementCleanups.set(liveHost, () => { cleaned++; });

        helper.init();

        expect(cleaned).toBe(0);
        expect(helper.elementCleanups.has(liveHost)).toBe(true);
        expect(liveBtn.isConnected).toBe(true);

        helper.destroy();
    });
});

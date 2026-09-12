// @vitest-environment jsdom
/**
 * Issue #9 验收：固定模式下「大纲与正文之间的间距」可配置。
 * -----------------------------------------------------------------------------
 * 原实现把编辑器内边距硬编码：左侧固定且需挤压时 effectiveTocWidth + 42，
 * 其它左侧情况 (isPinned ? effectiveTocWidth : miniTocWidth) + 10。
 * 分屏窄窗口下空白过大，用户要求间距可自定义。
 *
 * 修复：抽出纯函数 computeLeftDockPadding(width, tocGap, pinnedNeeded)：
 *   - 返回值 = width + tocGap + (pinnedNeeded ? 32 : 0)
 *   - 以 tocGap = 10 调用时与历史硬编码完全一致（零行为变化）。
 *
 * 本测试覆盖（≥5 例）：
 *   (250, 10, false) === 260            # 历史：250 + 10
 *   (250, 10, true)  === 292            # 历史：250 + 42（= 250 + 10 + 32）
 *   (200, 10, false) === 210
 *   (250, 40, false) === 290            # 间距可调生效
 *   (250, 0,  false) === 250            # 允许 0
 */
import { describe, it, expect } from "vitest";
import { computeLeftDockPadding } from "../utils/domUtils";
import { DEFAULT_CONFIG } from "../types";

describe("computeLeftDockPadding - 左侧停靠正文让位宽度（Issue #9）", () => {
    it("1. 非挤压、gap=10：(250, 10, false) === 260", () => {
        expect(computeLeftDockPadding(250, 10, false)).toBe(260);
    });

    it("2. 固定且需挤压、gap=10：(250, 10, true) === 292（等于历史硬编码 42 + 250）", () => {
        expect(computeLeftDockPadding(250, 10, true)).toBe(292);
        // 与历史实现 effectiveTocWidth + 42 完全等价
        expect(computeLeftDockPadding(250, 10, true)).toBe(250 + 42);
    });

    it("3. 非挤压、gap=10：(200, 10, false) === 210", () => {
        expect(computeLeftDockPadding(200, 10, false)).toBe(210);
    });

    it("4. 间距可调：(250, 40, false) === 290", () => {
        expect(computeLeftDockPadding(250, 40, false)).toBe(290);
    });

    it("5. 允许 gap=0：(250, 0, false) === 250", () => {
        expect(computeLeftDockPadding(250, 0, false)).toBe(250);
    });

    it("6. 默认 tocGap 必须等于 10，且与历史硬编码（左侧挤压 +42 / 其余 +10）逐值等价", () => {
        // 契约：默认值即历史行为，保证零行为变化（Issue #9 兼容性锁）
        expect(DEFAULT_CONFIG.tocGap).toBe(10);
        // 用默认值代入，结果必须等于历史硬编码 42 / 10
        expect(computeLeftDockPadding(250, DEFAULT_CONFIG.tocGap, true)).toBe(292); // 250 + 42
        expect(computeLeftDockPadding(250, DEFAULT_CONFIG.tocGap, false)).toBe(260); // 250 + 10
    });
});

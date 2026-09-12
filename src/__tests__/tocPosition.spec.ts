// @vitest-environment jsdom
/**
 * 外观可配置验收：悬浮大纲的层级（tocZIndex）/顶部偏移（tocTopOffset）/边缘留白（tocEdgeMargin）可配。
 * ----------------------------------------------------------------------------------------------
 * 原实现的定位逻辑内联在 FloatingToc.svelte 的 calculateTocPosition 闭包里（依赖闭包变量与常量），
 * 本次将其原样抽成纯函数 calculateTocPosition(params) 以便单测覆盖，并把边缘常量参数化（默认 14）。
 *
 * 本测试断言固定数值（直接由现有逻辑推导），用于锁死「抽函数时逻辑不变」：
 *   1. 展开 + 右侧  → left = rect.right - effectiveTocWidth - 6           （拖拽手柄避让常量 6）
 *   2. 展开 + 左侧（非固定）→ left = max(rect.left + 6, wRect.left - effectiveTocWidth)
 *   3. 展开 + 左侧（固定）  → isPinned 强制 paddingNeeded = true
 *   4. 收起 + 右侧  → left = rect.right - miniTocWidth - edgeMargin(14)
 *   5. 收起 + 左侧  → left = rect.left + edgeMargin(14)
 *   6. edgeMargin 可配生效（传入 30）
 *   7. 默认值契约：DEFAULT_CONFIG 三项默认值必须保持历史行为（20 / 80 / 14）。
 *
 * DOMRect 在 jsdom 里可直接用普通对象断言（函数内只读 left/right/top/bottom）。
 */
import { describe, it, expect } from "vitest";
import { calculateTocPosition } from "../utils/domUtils";
import { DEFAULT_CONFIG } from "../types";

const baseRect = { left: 0, right: 1000, top: 0, bottom: 800, width: 1000, height: 800 } as DOMRect;

describe("calculateTocPosition - 悬浮大纲定位纯函数", () => {
    it("1. 展开 + 右侧：left === 744（=1000-250-6），paddingNeeded === true", () => {
        const wRect = { left: 0, right: 900, top: 0, bottom: 800, width: 900, height: 800 } as DOMRect;
        const result = calculateTocPosition({
            rect: baseRect,
            wRect,
            effectiveTocWidth: 250,
            miniTocWidth: 32,
            currentPaddingLeft: 0,
            currentPaddingRight: 0,
            isExpanded: true,
            isPinned: false,
            dockSide: "right"
        });
        expect(result.left).toBe(744);
        expect(result.paddingNeeded).toBe(true);
    });

    it("2. 展开 + 左侧、非固定：left === 6（=max(0+6, 200-250)），paddingNeeded === true", () => {
        const wRect = { left: 200, right: 900, top: 0, bottom: 800, width: 700, height: 800 } as DOMRect;
        const result = calculateTocPosition({
            rect: baseRect,
            wRect,
            effectiveTocWidth: 250,
            miniTocWidth: 32,
            currentPaddingLeft: 0,
            currentPaddingRight: 0,
            isExpanded: true,
            isPinned: false,
            dockSide: "left"
        });
        expect(result.left).toBe(6);
        expect(result.paddingNeeded).toBe(true);
    });

    it("3. 展开 + 左侧、固定：left === 350（=max(6, 600-250)），paddingNeeded === true（isPinned 强制）", () => {
        const wRect = { left: 600, right: 900, top: 0, bottom: 800, width: 300, height: 800 } as DOMRect;
        const result = calculateTocPosition({
            rect: baseRect,
            wRect,
            effectiveTocWidth: 250,
            miniTocWidth: 32,
            currentPaddingLeft: 0,
            currentPaddingRight: 0,
            isExpanded: true,
            isPinned: true,
            dockSide: "left"
        });
        expect(result.left).toBe(350);
        expect(result.paddingNeeded).toBe(true);
    });

    it("4. 收起 + 右侧：left === 954（=1000-32-14），paddingNeeded === false", () => {
        const result = calculateTocPosition({
            rect: baseRect,
            wRect: null,
            effectiveTocWidth: 250,
            miniTocWidth: 32,
            currentPaddingLeft: 0,
            currentPaddingRight: 0,
            isExpanded: false,
            isPinned: false,
            dockSide: "right"
        });
        expect(result.left).toBe(954);
        expect(result.paddingNeeded).toBe(false);
    });

    it("5. 收起 + 左侧：left === 14，paddingNeeded === true", () => {
        const result = calculateTocPosition({
            rect: baseRect,
            wRect: null,
            effectiveTocWidth: 250,
            miniTocWidth: 32,
            currentPaddingLeft: 0,
            currentPaddingRight: 0,
            isExpanded: false,
            isPinned: false,
            dockSide: "left"
        });
        expect(result.left).toBe(14);
        expect(result.paddingNeeded).toBe(true);
    });

    it("6. edgeMargin 可配生效：收起 + 右侧、edgeMargin=30 → left === 938（=1000-32-30）", () => {
        const result = calculateTocPosition({
            rect: baseRect,
            wRect: null,
            effectiveTocWidth: 250,
            miniTocWidth: 32,
            currentPaddingLeft: 0,
            currentPaddingRight: 0,
            isExpanded: false,
            isPinned: false,
            dockSide: "right",
            edgeMargin: 30
        });
        expect(result.left).toBe(938);
        expect(result.paddingNeeded).toBe(false);
    });

    it("7. 默认值契约：tocZIndex=20 / tocTopOffset=80 / tocEdgeMargin=14（保证零行为变化）", () => {
        expect(DEFAULT_CONFIG.tocZIndex).toBe(20);
        expect(DEFAULT_CONFIG.tocTopOffset).toBe(80);
        expect(DEFAULT_CONFIG.tocEdgeMargin).toBe(14);
    });
});

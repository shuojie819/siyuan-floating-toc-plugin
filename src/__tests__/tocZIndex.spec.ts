// @vitest-environment jsdom
/**
 * Issue #44 验收：悬浮大纲层级（z-index）安全计算。
 * -----------------------------------------------------------------------------
 * Bug 现象：收起右侧文档后偶发层级错乱，编辑器元素穿透到左侧菜单之上。
 * 根因线索：`.floating-toc` 历史硬编码 `position: fixed; z-index: 20`，
 *           而思源原生浮层（左侧菜单/停靠栏/对话框）由全局计数器 `window.siyuan.zIndex`
 *           统一分配（实测基线 16，每次 +1）。写死 20 会盖在部分原生浮层之上。
 *
 * 修复：抽出纯函数 computeTocZIndex(configured, siyuanZIndex)，
 *   把插件层级稳定放在「高于正文内容、但不高于思源原生浮层」：
 *     - 计数器可用 → 上限收敛为 counter - 1；
 *     - 计数器不可用/异常小 → 退回 configured（保持历史行为，不劣化）；
 *     - 下限兜底 1（仍高于 z-index:auto 的正文）。
 *     - **例外（Issue #36③）**：用户显式把层级调到默认值(20)之上时原样放行
 *       —— 「被其它插件面板遮挡时调大」是用户自担风险的显式覆盖，不被收敛。
 */
import { describe, it, expect } from "vitest";
import { computeTocZIndex, DEFAULT_TOC_Z_INDEX } from "../utils/domUtils";
import { DEFAULT_CONFIG } from "../types";

describe("computeTocZIndex - 悬浮大纲层级安全计算（Issue #44）", () => {
    it("1. 默认20 + 思源计数器16 → 收敛为15（低于原生浮层）", () => {
        expect(computeTocZIndex(20, 16)).toBe(15);
    });

    it("2. 计数器不可用（undefined）→ 退回配置值20（不劣化历史行为）", () => {
        expect(computeTocZIndex(20, undefined)).toBe(20);
    });

    it("3. 计数器异常小（0 / <=1）→ 退回配置值", () => {
        expect(computeTocZIndex(20, 0)).toBe(20);
        expect(computeTocZIndex(20, 1)).toBe(20);
    });

    it("4. 非数字计数器（字符串/NaN）→ 退回配置值", () => {
        expect(computeTocZIndex(20, "16")).toBe(20);
        expect(computeTocZIndex(20, NaN)).toBe(20);
        expect(computeTocZIndex(20, null)).toBe(20);
    });

    it("5. 配置值本身已低于上限 → 保持不变", () => {
        expect(computeTocZIndex(10, 16)).toBe(10);
        expect(computeTocZIndex(5, 16)).toBe(5);
    });

    it("6. 默认值(20)及以下的配置 → 收敛，绝不高于思源原生浮层", () => {
        expect(computeTocZIndex(20, 16)).toBe(15);
        expect(computeTocZIndex(15, 16)).toBe(15);
        expect(computeTocZIndex(10, 16)).toBe(10);
    });

    it("6b. 用户显式抬高到默认值之上 → 原样放行（Issue #36③，自担风险）", () => {
        expect(computeTocZIndex(21, 16)).toBe(21);
        expect(computeTocZIndex(500, 16)).toBe(500);
        expect(computeTocZIndex(999, 16)).toBe(999);
        expect(computeTocZIndex(999, undefined)).toBe(999);
    });

    it("7. 下限兜底为1：0/负数配置仍高于正文内容", () => {
        expect(computeTocZIndex(0, 16)).toBe(1);
        expect(computeTocZIndex(-5, undefined)).toBe(1);
    });

    it("8. 计数器极小边界（counter=2 → cap=1）", () => {
        expect(computeTocZIndex(3, 2)).toBe(1);
    });

    it("9. 契约：默认值仍为20；代入思源计数器16 → 15（不劣化，且不高于原生UI）", () => {
        expect(DEFAULT_CONFIG.tocZIndex).toBe(20);
        expect(DEFAULT_TOC_Z_INDEX).toBe(20);
        const safe = computeTocZIndex(DEFAULT_CONFIG.tocZIndex, 16);
        expect(safe).toBe(15);
        expect(safe).toBeLessThan(16); // 严格低于思源原生浮层基线
        expect(safe).toBeGreaterThan(0); // 仍高于正文内容
    });
});

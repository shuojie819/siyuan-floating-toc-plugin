// @vitest-environment jsdom
/**
 * computeBazaarInlineStyle 单元测试（集市嵌入态「尺寸同步」契约）。
 *
 * 背景：集市 TOC 的定位交给 CSS（absolute 锚定），但宽度/高度必须由 JS 内联同步，
 * 否则用户可见能力（拖拽改宽 tocWidth / 设置项 miniTocWidth / adaptiveHeight）在集市里静默失效。
 *
 * 契约：
 *   - 展开宽度 = effectiveTocWidth（已含窄屏兜底，默认即为 tocWidth 250）；
 *   - 折叠宽度 = miniTocWidth（默认 32），并随配置变化；
 *   - adaptiveHeight → height: auto（贴合内容）；否则 height: 100%（撑满面板）。
 */
import { describe, it, expect } from "vitest";
import { computeBazaarInlineStyle } from "../utils/domUtils";

describe("computeBazaarInlineStyle（集市嵌入态尺寸同步）", () => {
    it("展开 + 非自适应：宽度 = effectiveTocWidth(250)，高度撑满(100%)", () => {
        expect(computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: false
        })).toBe("width: 250px; height: 100%;");
    });

    it("折叠 + 非自适应：宽度 = miniTocWidth(32)", () => {
        expect(computeBazaarInlineStyle({
            isExpanded: false, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: false
        })).toBe("width: 32px; height: 100%;");
    });

    it("折叠宽度跟随 miniTocWidth 配置（改为 48）", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: false, effectiveTocWidth: 250, miniTocWidth: 48, adaptiveHeight: false
        });
        expect(s).toContain("width: 48px");
        expect(s).not.toContain("width: 32px");
    });

    it("展开宽度跟随 effectiveTocWidth（拖拽改宽为 300）", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 300, miniTocWidth: 32, adaptiveHeight: false
        });
        expect(s).toContain("width: 300px");
    });

    it("窄屏兜底宽度（effectiveTocWidth=200）被采用", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 200, miniTocWidth: 32, adaptiveHeight: false
        });
        expect(s).toBe("width: 200px; height: 100%;");
    });

    it("adaptiveHeight=true：高度 auto 贴合内容，不拉满面板", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: true
        });
        expect(s).toContain("height: auto");
        expect(s).not.toContain("height: 100%");
    });

    it("adaptiveHeight=true 且折叠：宽度仍 = miniTocWidth", () => {
        expect(computeBazaarInlineStyle({
            isExpanded: false, effectiveTocWidth: 250, miniTocWidth: 40, adaptiveHeight: true
        })).toBe("width: 40px; height: auto;");
    });

    it("不产出定位属性（left/top/position 交给 CSS）", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: false
        });
        expect(s).not.toMatch(/left|top|position/);
    });
});

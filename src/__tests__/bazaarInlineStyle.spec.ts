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
 *   - adaptiveHeight → height: auto + max-height: 100%（贴合内容，但**必须有上界**）；
 *     否则 height: 100%（撑满面板）。
 *
 * 关键不变量：adaptiveHeight 分支若只写 `height: auto` 而无 `max-height`，高度 = 内容高度（无上界），
 * 内部 .toc-panel/.toc-content 永不产生溢出 → 集市里标题列表不可上下滚动、下方标题被裁掉。
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
        // 用 (^|;) 锚定，避免误伤 max-height: 100%（其本身含子串 "height: 100%"）
        expect(s).not.toMatch(/(^|;)\s*height:\s*100%/);
        expect(s).toMatch(/max-height:\s*100%/);
    });

    it("adaptiveHeight=true 且折叠：宽度仍 = miniTocWidth", () => {
        expect(computeBazaarInlineStyle({
            isExpanded: false, effectiveTocWidth: 250, miniTocWidth: 40, adaptiveHeight: true
        })).toBe("width: 40px; height: auto; max-height: 100%;");
    });

    it("adaptiveHeight=true 且展开：完整串（宽度 250 + auto + max-height 上界）", () => {
        expect(computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: true
        })).toBe("width: 250px; height: auto; max-height: 100%;");
    });

    it("不产出定位属性（left/top/position 交给 CSS）", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: false
        });
        expect(s).not.toMatch(/left|top|position/);
    });
});

describe("computeBazaarInlineStyle（高度有上界 边界不变量）", () => {
    /**
     * 变异校验目标：若把实现里的 `max-height: 100%;` 删掉，以下用例必须变红。
     */

    it("不变量1：adaptiveHeight=true 时返回串必须包含 max-height（高度有上界）", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: true
        });
        expect(s).toMatch(/max-height\s*:\s*100%\s*;/);
    });

    it("不变量1b：adaptiveHeight=true 且折叠态同样必须包含 max-height", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: false, effectiveTocWidth: 250, miniTocWidth: 40, adaptiveHeight: true
        });
        expect(s).toMatch(/max-height\s*:\s*100%\s*;/);
    });

    it("不变量2：不允许出现「有 height: auto 但没有 max-height」的裸形态", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: true
        });
        if (/height:\s*auto/.test(s)) {
            expect(s).toMatch(/max-height/);
        } else {
            // 若实现改为非 auto 形态，则必须显式给出确定高度（同样是有上界）
            expect(s).toMatch(/height:\s*\d+(px|%)/);
        }
    });

    it("不变量3：非自适应分支自身即为确定高度，不需要额外 max-height", () => {
        const s = computeBazaarInlineStyle({
            isExpanded: true, effectiveTocWidth: 250, miniTocWidth: 32, adaptiveHeight: false
        });
        expect(s).toMatch(/height:\s*100%\s*;/);
        expect(s).not.toMatch(/height:\s*auto/);
    });
});

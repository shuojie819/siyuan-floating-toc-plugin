// @vitest-environment jsdom
/**
 * 防回归的静态断言（集市两大 P0 缺陷修复的「结构性护栏」）。
 * -----------------------------------------------------------------------------
 * 为什么是「文本级静态断言」而不是 DOM/样式断言？
 *   - 这些判定点位于 Svelte 组件的 `<style>` 块与 `<script>` 内部闭包中：
 *     jsdom 不会编译 .svelte，也不会对 `<style>` 里的规则求值（getComputedStyle 拿不到），
 *     而 `onScroll` 等回调是组件内部私有函数，无法从外部实例化后取值。
 *   - 因此这里把「源码不得出现某种形态」固化为断言，作为回归防线：
 *     一旦有人把某处改回危险的 API、或把集市场景的隐藏规则加回来，用例立即变红。
 * 与之互补的行为级覆盖见 computeItemScrollTop.spec.ts（纯函数 + DOM 替身，
 * 断言「祖先容器 scrollTop 一次都不被写入」）。
 *
 * 覆盖：
 *   缺陷1 ① src/FloatingToc.svelte 内不得再出现 scrollIntoView（含注释也不允许，便于 grep 字面检索）；
 *         ② 必须保留「只滚自己」的替代调用（改回旧 API 时该断言也会变红）。
 *   缺陷2 ③ 集市场景不得再整体隐藏 .header-actions / .scroll-toolbar（display:none 组合）；
 *         ④ 集市只隐藏 dock-side-btn，且该按钮就是 Switch Side；其余按钮不得被连带隐藏。
 */
import { describe, it, expect } from "vitest";
// 用 Vite 的 raw 导入读取组件源码：既不依赖 node: 模块（本项目未装 @types/node），
// 也避免 jsdom 下 import.meta.url 非 file: scheme 导致的读文件失败。
// raw 视图保留 <style> / <script> 原样文本，正好用于静态形态断言。
import SOURCE_TEXT from "../FloatingToc.svelte?raw";

/** 去掉注释后的源码（用于解析 CSS 规则，避免注释里的文字被误当作规则） */
const SOURCE_NO_COMMENTS = SOURCE_TEXT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");

/** `<style>` 块内容（去注释） */
const STYLE_BLOCK = (() => {
    const match = /<style[^>]*>([\s\S]*)<\/style>/.exec(SOURCE_NO_COMMENTS);
    return match ? match[1] : "";
})();

/**
 * 解析形如 `选择器A, 选择器B { 声明 }` 的规则。
 * @param css 样式文本
 */
function parseRules(css: string): { selector: string; body: string }[] {
    const rules: { selector: string; body: string }[] = [];
    const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = rulePattern.exec(css)) !== null) {
        rules.push({ selector: match[1].trim(), body: match[2].trim() });
    }
    return rules;
}

/** 选择器清单里存在「作用于 .floating-toc.bazaar 且命中某个 class 名」的规则 */
function findBazaarRule(className: string): { selector: string; body: string } | undefined {
    return parseRules(STYLE_BLOCK).find(rule => {
        const selectors = rule.selector.split(",").map(s => s.trim());
        return selectors.some(
            s => s.includes(".floating-toc.bazaar") && new RegExp(`\\.${className}\\b`).test(s)
        );
    });
}

describe("缺陷1：FloatingToc.svelte 全面弃用 scrollIntoView（静态断言）", () => {
    it("① 源码（含注释）中不得再出现 scrollIntoView 字面量", () => {
        expect(SOURCE_TEXT.includes("scrollIntoView")).toBe(false);
    });

    it("② 三处「滚动跟随/跳转」必须改用只滚自己的实现", () => {
        // 展开时居中同步 + onScroll 跟随（.toc-item / .strip-item）
        expect(SOURCE_TEXT).toContain("scrollItemWithinOwnScroller");
        expect(SOURCE_TEXT).toContain("resolveScrollContainer");
        // 点击大纲项跳转到标题：只滚 README 自己的滚动容器
        expect(SOURCE_TEXT).toContain("computeRelativeOffset");
        expect(SOURCE_TEXT).toContain("scrollScrollerToOffset");
    });

    it("③ 跳转分支拿不到滚动容器时必须 no-op（不得保留任何兜底滚动）", () => {
        expect(SOURCE_TEXT).toMatch(/if\s*\(!scroller\)\s*return false;/);
    });

    it("③b 包含性兜底：computeRelativeOffset 返回 null 时必须 no-op（不得拿着视差数字去滚）", () => {
        // 目标块不在解析出的滚动容器内 → 差值是无意义的视差数字，必须直接放弃滚动
        expect(SOURCE_TEXT).toMatch(/if\s*\(offsetTop === null\)\s*return false;/);
        // 且顺序上：必须先算 offset、判 null，再滚动
        expect(SOURCE_TEXT).toMatch(/const offsetTop = computeRelativeOffset\(headingBlock, scroller\);\s*\r?\n\s*if \(offsetTop === null\) return false;\s*\r?\n\s*\r?\n\s*scrollScrollerToOffset\(/);
    });
});

describe("缺陷2：集市场景按钮可见性（静态断言）", () => {
    it("④ 集市不得再整体隐藏 .header-actions", () => {
        const rule = findBazaarRule("header-actions");
        // 规则不存在，或存在但不包含 display: none —— 两种都算通过；写这条是为了让「加回来」变红
        if (rule) {
            expect(rule.body.replace(/\s+/g, " ").toLowerCase()).not.toContain("display: none");
        } else {
            expect(rule).toBeUndefined();
        }
    });

    it("⑤ 集市不得再隐藏 .scroll-toolbar（↑/↓ 现已真正生效）", () => {
        const rule = findBazaarRule("scroll-toolbar");
        if (rule) {
            expect(rule.body.replace(/\s+/g, " ").toLowerCase()).not.toContain("display: none");
        } else {
            expect(rule).toBeUndefined();
        }
    });

    it("⑥ 集市只隐藏 dock-side-btn，且隐藏方式就是 display: none", () => {
        const rule = findBazaarRule("dock-side-btn");
        expect(rule).toBeDefined();
        expect(rule!.body.replace(/\s+/g, " ").toLowerCase()).toContain("display: none");
    });

    it("⑦ dock-side-btn 精确挂在 Switch Side 按钮上，其余按钮未被连带隐藏", () => {
        const buttons = SOURCE_TEXT.match(/<button[\s\S]*?>/g) || [];
        const dockSideBtn = buttons.filter(b => b.includes("dock-side-btn"));
        expect(dockSideBtn.length).toBe(1);
        expect(dockSideBtn[0]).toContain('aria-label="Switch Dock Side"');

        // 图钉 / 折叠全部 / 展开全部：不得带 dock-side-btn 类（否则会被一块隐藏）
        for (const label of ["Toggle Pin", "Collapse All", "Expand All"]) {
            const target = buttons.find(b => b.includes(`aria-label="${label}"`));
            expect(target, `缺失按钮: ${label}`).toBeDefined();
            expect(target!.includes("dock-side-btn")).toBe(false);
        }
    });

    it("⑧ 文档场景样式未被波及：芥蒂规则必须带 .bazaar 作用域", () => {
        // .header-actions / .scroll-toolbar 的基础规则仍然存在且不带 bazaar 作用域
        const baseHeader = parseRules(STYLE_BLOCK).find(r => r.selector === ".header-actions");
        expect(baseHeader).toBeDefined();
        const baseToolbar = parseRules(STYLE_BLOCK).find(r => r.selector === ".scroll-toolbar");
        expect(baseToolbar).toBeDefined();
        expect(baseToolbar!.body.toLowerCase()).not.toContain("display: none");
    });
});

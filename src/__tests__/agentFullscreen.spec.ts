// @vitest-environment jsdom
/**
 * Issue #52 验收：智能体「沉浸式全屏」时，文档的悬浮大纲必须隐藏（退出全屏后恢复）。
 * -----------------------------------------------------------------------------
 * Bug 现象：进入「智能体」全屏后，文档的悬浮大纲（.floating-toc）仍漂浮在全屏界面之上
 *           （截图里压在智能体全屏界面的右上/左上角）。
 *
 * 根因（真机 DevTools 运行时读数，见 domUtils.ts isCoveredByDialog 注释）：
 *   - 智能体全屏容器实测 `class="... sy__agentChat dockPanel ..."`，尺寸 1920×692（占满视口），
 *     z-index = 8；
 *   - 文档宿主 protyle 的内容区**仍有真实尺寸**（1256×643 @ (278,41)）→ isElementVisible(host)
 *     判为可见 → TOC 不会被销毁；
 *   - TOC 本体 `position: fixed; z-index: 18`（= window.siyuan.zIndex(19) - 1）→ 18 > 8，
 *     于是 TOC 画在智能体全屏之上；
 *   - isCoveredByDialog 的容器白名单**不含**智能体容器 → 无规则命中 → TOC 保持显示。
 *
 * 修复：把 `.sy__agentChat` / `.agent-chat` 纳入 isCoveredByDialog 的覆盖容器列表；
 *       该函数已有的「矩形重叠」判定天然区分停靠 / 全屏两态（无需额外分支）。
 *
 * 本测试用**可控矩形 mock**（jsdom 无布局引擎，getBoundingClientRect 默认全 0，必须 mock）：
 *   1. 全屏态：`.sy__agentChat`（rect = 整个视口 1920×692）+ 宿主 `.protyle`（1256×643 @(278,41)）
 *      → isCoveredByDialog(宿主) === true（应隐藏）。
 *   2. 停靠态（反向，必须绿）：`.sy__agentChat` dock 在文档**右侧、与宿主不重叠**
 *      → isCoveredByDialog(宿主) === false（不能误伤，否则停靠时大纲会消失）。
 *      注：宿主右缘 = 278 + 1256 = 1534px，故右侧 dock 的 left 必须 >= 1534 才不重叠。
 *   3. 无智能体（反向）：无该容器 → false。
 *   4. 既有白名单项（.b3-dialog / .search__panel / .history__panel）行为不变（回归）。
 *   5. 边界：容器 display:none / 尺寸 0 → 不判覆盖。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isCoveredByDialog, shouldShowToc } from "../utils/domUtils";

type Rect = { left: number; top: number; width: number; height: number };

/** 用 mock 替换 getBoundingClientRect，返回非零宽高矩形（jsdom 默认全 0）。 */
function setRect(el: HTMLElement, r: Rect): void {
    const right = r.left + r.width;
    const bottom = r.top + r.height;
    el.getBoundingClientRect = () =>
        ({
            x: r.left,
            y: r.top,
            left: r.left,
            top: r.top,
            right,
            bottom,
            width: r.width,
            height: r.height,
            toJSON: () => ({})
        }) as DOMRect;
}

/** 在 document.body 下创建一个带 class 的元素。 */
function createEl(cls: string, parent: HTMLElement = document.body): HTMLElement {
    const el = document.createElement("div");
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
}

/**
 * 确定性 mock window.getComputedStyle：
 * 仅暴露 isCoveredByDialog 实际读取的 display / visibility / opacity 三个字段，
 * 默认显示态，可被元素 inline style 覆盖。
 */
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

/** 真机读数下的文档宿主 protyle 矩形（正文内容区）。 */
const DOC_HOST_RECT: Rect = { left: 278, top: 41, width: 1256, height: 643 }; // 右缘 1534

/** 真机读数下的智能体**全屏**容器矩形（占满 1920×692 视口）。 */
const AGENT_FULLSCREEN_RECT: Rect = { left: 0, top: 0, width: 1920, height: 692 };

/**
 * 智能体**停靠**在右侧 dock 时的容器矩形：位于文档宿主右缘（1534）之外，
 * 与宿主矩形**不重叠** —— 对齐真实停靠布局（文档未被覆盖）。
 */
const AGENT_DOCKED_RIGHT_RECT: Rect = { left: 1560, top: 0, width: 360, height: 692 };

beforeEach(() => {
    mockGetComputedStyle();
});

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe("Issue #52 - 智能体全屏时文档 TOC 应被隐藏（核心修复）", () => {
    it.each(["sy__agentChat dockPanel layout__t", "agent-chat fn__flex-column fn__flex-1"])(
        "1. 全屏态：智能体容器 .%s 覆盖整个视口 → isCoveredByDialog(宿主) === true",
        (cls) => {
            const protyle = createEl("protyle");
            setRect(protyle, DOC_HOST_RECT);
            const agent = createEl(cls);
            setRect(agent, AGENT_FULLSCREEN_RECT);

            expect(isCoveredByDialog(protyle)).toBe(true);
        }
    );

    it("2. 全屏态：shouldShowToc(宿主) === false（隐藏 TOC）", () => {
        const protyle = createEl("protyle");
        setRect(protyle, DOC_HOST_RECT);
        const agent = createEl("sy__agentChat dockPanel layout__t");
        setRect(agent, AGENT_FULLSCREEN_RECT);

        expect(shouldShowToc(protyle)).toBe(false);
    });
});

describe("Issue #52 - 智能体停靠态不得误伤（反向，必须绿）", () => {
    it.each(["sy__agentChat dockPanel", "agent-chat fn__flex-1"])(
        "3. 停靠态：智能体容器 .%s dock 在右侧、与宿主不重叠 → isCoveredByDialog(宿主) === false",
        (cls) => {
            const protyle = createEl("protyle");
            setRect(protyle, DOC_HOST_RECT); // 右缘 1534
            const agent = createEl(cls);
            setRect(agent, AGENT_DOCKED_RIGHT_RECT); // left 1560，在宿主右缘之外

            expect(isCoveredByDialog(protyle)).toBe(false);
        }
    );

    it("4. 停靠态：shouldShowToc(宿主) === true（大纲照常显示）", () => {
        const protyle = createEl("protyle");
        setRect(protyle, DOC_HOST_RECT);
        const agent = createEl("sy__agentChat dockPanel");
        setRect(agent, AGENT_DOCKED_RIGHT_RECT);

        expect(shouldShowToc(protyle)).toBe(true);
    });
});

describe("Issue #52 - 无智能体容器时不影响既有行为（反向）", () => {
    it("5. DOM 中不存在智能体容器 → isCoveredByDialog(宿主) === false", () => {
        const protyle = createEl("protyle");
        setRect(protyle, DOC_HOST_RECT);

        expect(isCoveredByDialog(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
    });
});

describe("回归 - 既有白名单项行为不变", () => {
    it.each([".b3-dialog", ".search__panel", ".history__panel"])(
        "6. %s 覆盖文档宿主 → isCoveredByDialog 仍返回 true",
        (cls) => {
            const protyle = createEl("protyle");
            setRect(protyle, DOC_HOST_RECT);
            const panel = createEl(cls.replace(/^\./, ""));
            setRect(panel, AGENT_FULLSCREEN_RECT);

            expect(isCoveredByDialog(protyle)).toBe(true);
        }
    );
});

describe("边界 - 智能体容器不可见 / 尺寸为 0 时不判覆盖", () => {
    it("7. 全屏容器 display:none → 跳过，返回 false", () => {
        const protyle = createEl("protyle");
        setRect(protyle, DOC_HOST_RECT);
        const agent = createEl("sy__agentChat dockPanel");
        agent.style.display = "none";
        setRect(agent, AGENT_FULLSCREEN_RECT);

        expect(isCoveredByDialog(protyle)).toBe(false);
    });

    it("8. 全屏容器尺寸为 0（未 mock 矩形，默认宽高 0）→ 跳过，返回 false", () => {
        const protyle = createEl("protyle");
        setRect(protyle, DOC_HOST_RECT);
        createEl("sy__agentChat dockPanel"); // 不 mock 矩形 → 默认 0×0

        expect(isCoveredByDialog(protyle)).toBe(false);
    });
});

describe("边界 - 精确几何契约（贴边不重叠 / 任何像素重叠即覆盖）", () => {
    it("9. 精确贴边：dock.left === 宿主右缘 1534 → 判为不重叠（false / true）", () => {
        // 边界契约：现有重叠公式用 `elementRect.right <= dialogRect.left`（`<=` **含等号**）
        // 判定「水平分离」，故「左缘 == 右缘」= 不重叠。本用例锁定该契约，
        // 防止将来有人把 `<=` 误改成 `<`（那样贴边会被误判成被覆盖 → 停靠态大纲误消失）。
        const protyle = createEl("protyle");
        setRect(protyle, DOC_HOST_RECT); // 右缘 = 278 + 1256 = 1534
        const agent = createEl("sy__agentChat dockPanel layout__t");
        setRect(agent, { left: 1534, top: 41, width: 380, height: 643 }); // left 恰 == 1534

        expect(isCoveredByDialog(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
    });

    it("10. 1px 重叠：dock.left = 1533（与宿主重叠 1px）→ 判为被覆盖（true / false）", () => {
        // 既有公式的既定语义：任何像素重叠即视为「被覆盖 → 隐藏大纲」，这是**预期行为而非 bug**。
        // 因公式为严格不等：`1534 <= 1533` 为 false → 继续判其余三边 → 落入重叠。
        // 真机侧由用户验收「停靠态整条 dock 不误消失」（见发布验收清单）。
        const protyle = createEl("protyle");
        setRect(protyle, DOC_HOST_RECT);
        const agent = createEl("sy__agentChat dockPanel layout__t");
        setRect(agent, { left: 1533, top: 41, width: 387, height: 643 });

        expect(isCoveredByDialog(protyle)).toBe(true);
        expect(shouldShowToc(protyle)).toBe(false);
    });
});

// @vitest-environment jsdom
/**
 * Issue #50 验收：悬浮大纲不应误挂到「第三方插件浮层 / popover」内。
 * -----------------------------------------------------------------------------
 * Bug 现象：鲸鱼快速批注（第三方插件 HaoCeans/siyuan-comment v2.8.3）的批注弹层里
 *           出现了悬浮大纲，而那里不应该有。
 *
 * 根因：
 *   - 对方批注弹层模板里存在**字面量带 protyle 类**的元素：
 *       class="protyle siyuan-comment-popover__protyle"
 *     且该插件确实在弹层内 new Protyle(...) 渲染小编辑器（共 2 处）；
 *   - 我方 checkProtyles 候选选择器含 `.protyle` → 命中对方 `.protyle.siyuan-comment-popover__protyle`；
 *   - getTocHostElement 命中 classList.contains("protyle") → 直接把它当宿主；
 *   - shouldShowToc 的全部排除闸门都是「已知内置容器白名单」（设置面板 / 反链 / 数据库 /
 *     protyle-lite / 闪卡 / 智能体 / 图谱 / 被集市或弹窗覆盖），**没有一条能匹配第三方插件浮层**
 *     → 放行 → 误挂 TOC。
 *
 * 修复（集中 domUtils.ts）：
 *   1) 新增通用闸门 isFloatingPopoverPanel(element)：位于 `.block__popover` /
 *      `[class*="popover"]` / `[class*="siyuan-comment-"]` 内的 .protyle 一律不作为宿主；
 *   2) getTocHostElement 开头加双保险 `if (isFloatingPopoverPanel(candidate)) return null;`；
 *   3) shouldShowToc 加 `if (isFloatingPopoverPanel(protyleElement)) return false;`。
 *
 * ⚠️ 事实校正（QA 在思源全量产物 grep 实测）：
 *   - 思源原生浮层（块引用 / Hover 悬浮预览）的真实类名是 **`.block__popover`**（另有
 *     `.block__popover--open` / `.popover__block`）；
 *   - 思源中**不存在** `.b3-popover` 这个类（全量产物 0 命中，属常见误传），因此不再写入选择器；
 *   - `data-type="popover"` 亦无实测依据，同样不写入。
 *   本文件的用例据此使用 `.block__popover` 承载「思源原生浮层」断言。
 *
 * 本测试覆盖：
 *   - 正向（真实串）：siyuan-comment-popover 批注弹层内的 .protyle → 三条断言（核心修复）
 *   - 分类覆盖：.block__popover（思源原生）/ xxx-popover-yyy（子串，钉住 [class*="popover"] 通用分支）
 *               / siyuan-comment-ai-panel / siyuan-comment-slide-veil 各 ≥1 例
 *   - 反向（防误伤）：主编辑器 / 搜索预览 / 搜索文档 / 历史 / 历史预览 / 集市 README → 均**不**被排除
 *   - 加分：vi.mock 隔离 FloatingToc，构造 mock plugin + ProtyleManager，把批注弹层 .protyle
 *           注入 document 驱动 checkProtyles，断言其未被误挂（端到端）
 *
 * 注意：本测试只证明「代码/单测层面」已拦截。真机行为（对方插件弹层里不再出现大纲）
 *       依赖对方产物类名 + 我方选择器推理，**必须真机验收**，沙箱无法覆盖。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    isFloatingPopoverPanel,
    shouldShowToc,
    getTocHostElement
} from "../utils/domUtils";
import { ProtyleManager } from "../modules/protyleManager";

/** 在指定父节点下创建一个带指定 class 的元素。 */
function createEl(cls: string, parent: HTMLElement = document.body): HTMLElement {
    const el = document.createElement("div");
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
}

/** 创建一个 .protyle > .protyle-content 结构，返回 protyle。 */
function createProtyle(parent: HTMLElement = document.body): HTMLElement {
    const protyle = createEl("protyle", parent);
    createEl("protyle-content", protyle);
    return protyle;
}

/** 确定性 mock window.getComputedStyle（仅暴露 isCovered* 实际读取的字段）。 */
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

/**
 * 构建鲸鱼快速批注的真实弹层 DOM 片段（对齐 issue #50 证据）：
 *   div.siyuan-comment-popover
 *     └ div.protyle.siyuan-comment-popover__protyle   ← 字面量带 protyle 类（被误挂的就是它）
 *         └ div.protyle-content
 */
function buildCommentPopover(): HTMLElement {
    const popover = createEl("siyuan-comment-popover");
    const protyle = createEl("protyle siyuan-comment-popover__protyle", popover);
    createEl("protyle-content", protyle);
    return protyle;
}

beforeEach(() => {
    mockGetComputedStyle();
});

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 正向：真实串（核心修复）
// ---------------------------------------------------------------------------
describe("isFloatingPopoverPanel - 鲸鱼快速批注弹层（核心修复，issue #50）", () => {
    it("1. 批注弹层内的 .protyle.siyuan-comment-popover__protyle → isFloatingPopoverPanel 返回 true", () => {
        const protyle = buildCommentPopover();
        expect(isFloatingPopoverPanel(protyle)).toBe(true);
    });

    it("2. 批注弹层内的 .protyle → shouldShowToc 返回 false（不被挂载）", () => {
        const protyle = buildCommentPopover();
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("3. 双保险：批注弹层内的 .protyle → getTocHostElement 返回 null（源头拦截）", () => {
        const protyle = buildCommentPopover();
        expect(getTocHostElement(protyle)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 分类覆盖：各类浮层容器各 ≥1 例
// ---------------------------------------------------------------------------
describe("isFloatingPopoverPanel - 浮层容器分类覆盖", () => {
    it("4. .block__popover（思源原生：块引用 / Hover 悬浮预览）内的 .protyle → 命中", () => {
        // 实测类名（QA 在思源全量产物 grep：base.css `.block__popover{…}` / export/protyle-method.js）。
        const popover = createEl("block__popover");
        const protyle = createProtyle(popover);
        expect(isFloatingPopoverPanel(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBeNull();
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("5. class 含 popover 子串（xxx-popover-yyy）→ 命中（钉住 [class*=\"popover\"] 通用分支）", () => {
        const popover = createEl("xxx-popover-yyy");
        const protyle = createProtyle(popover);
        expect(isFloatingPopoverPanel(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBeNull();
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("6. siyuan-comment-ai-panel（鲸鱼快速批注 AI 面板）内的 .protyle → 命中", () => {
        const panel = createEl("siyuan-comment-ai-panel");
        const protyle = createProtyle(panel);
        expect(isFloatingPopoverPanel(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBeNull();
        expect(shouldShowToc(protyle)).toBe(false);
    });

    it("7. siyuan-comment-slide-veil（鲸鱼快速批注遮罩层）内的 .protyle → 命中", () => {
        const veil = createEl("siyuan-comment-slide-veil");
        const protyle = createProtyle(veil);
        expect(isFloatingPopoverPanel(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBeNull();
        expect(shouldShowToc(protyle)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 反向：既有正经宿主不得被误伤
// ---------------------------------------------------------------------------
describe("isFloatingPopoverPanel - 反向（既有正经宿主不被误伤）", () => {
    it("8. 主编辑器 .layout__center .protyle → 不被排除，仍是有效宿主", () => {
        const center = createEl("layout__center");
        const protyle = createProtyle(center);
        expect(isFloatingPopoverPanel(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBe(protyle);
    });

    it("9. 搜索预览 .search__preview .protyle → 不被排除，仍返回内部 protyle", () => {
        const preview = createEl("search__preview");
        const protyle = createProtyle(preview);
        expect(isFloatingPopoverPanel(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBe(protyle);
        // 传入容器本身也应解析到内部 protyle，而非被误判为浮层
        expect(getTocHostElement(preview)).toBe(protyle);
    });

    it("10. 搜索文档 .search__doc .protyle → 不被排除，仍返回内部 protyle", () => {
        const doc = createEl("search__doc");
        const protyle = createProtyle(doc);
        expect(isFloatingPopoverPanel(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBe(protyle);
        expect(getTocHostElement(doc)).toBe(protyle);
    });

    it("11. 历史 .history__text .protyle → 不被排除，仍返回内部 protyle", () => {
        const historyText = createEl("history__text");
        const protyle = createProtyle(historyText);
        expect(isFloatingPopoverPanel(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBe(protyle);
        expect(getTocHostElement(historyText)).toBe(protyle);
    });

    it("12. 历史预览 #historyPreview .protyle → 不被排除，仍返回内部 protyle", () => {
        const preview = createEl("");
        preview.id = "historyPreview";
        const protyle = createProtyle(preview);
        expect(isFloatingPopoverPanel(protyle)).toBe(false);
        expect(shouldShowToc(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBe(protyle);
        expect(getTocHostElement(preview)).toBe(protyle);
    });

    it("13. 集市 #configBazaarReadme → 不被排除，仍返回自身作为宿主", () => {
        const readme = createEl("");
        readme.id = "configBazaarReadme";
        createEl("protyle-content", readme);
        expect(isFloatingPopoverPanel(readme)).toBe(false);
        expect(shouldShowToc(readme)).toBe(true);
        expect(getTocHostElement(readme)).toBe(readme);
    });
});

// ---------------------------------------------------------------------------
// 加分：集成驱动 checkProtyles，验证批注弹层 .protyle 不会被误挂 TOC
// ---------------------------------------------------------------------------
vi.mock("../FloatingToc.svelte", () => {
    return {
        default: class FloatingTocStub {
            target: HTMLElement;
            props: Record<string, unknown>;
            constructor(options: { target: HTMLElement; props: Record<string, unknown> }) {
                this.target = options.target;
                this.props = options.props;
                const inner = document.createElement("div");
                inner.className = "floating-toc";
                this.target.appendChild(inner);
            }
            $destroy(): void {
                const inner = this.target.querySelector(".floating-toc");
                if (inner) inner.remove();
            }
            updateHeadings(): void {}
            setVisible(): void {}
            toggle(): void {}
        }
    };
});

type Rect = { left: number; top: number; width: number; height: number };
function setRect(el: HTMLElement, r: Rect): void {
    const right = r.left + r.width;
    const bottom = r.top + r.height;
    el.getBoundingClientRect = () =>
        ({
            x: r.left, y: r.top, left: r.left, top: r.top, right, bottom,
            width: r.width, height: r.height, toJSON: () => ({})
        }) as DOMRect;
}

describe("checkProtyles 集成 - 批注弹层 .protyle 不得被误挂（Issue #50 端到端）", () => {
    let manager: ProtyleManager;
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
        createToc: (host: HTMLElement, docId: string) => manager.createToc(host, docId)
    };

    beforeEach(() => {
        document.body.replaceChildren();
        mockGetComputedStyle();
        plugin.tocInstances.clear();
        plugin.tocDocIds.clear();
        manager = new ProtyleManager(plugin);
    });

    it("A. 批注弹层内 .protyle（继承当前文档 ID）→ checkProtyles 后未挂载 TOC", () => {
        const protyle = buildCommentPopover();
        // 模拟继承了当前笔记页签的文档 ID（bug 实际触发的前提）
        const content = protyle.querySelector(".protyle-content") as HTMLElement;
        content.setAttribute("data-node-id", "20240101000000-ccccccc");
        setRect(protyle, { left: 100, top: 100, width: 200, height: 80 });

        manager.checkProtyles();

        expect(plugin.tocInstances.has(protyle)).toBe(false);
        const popover = protyle.closest(".siyuan-comment-popover") as HTMLElement;
        expect(popover.querySelectorAll(".siyuan-floating-toc-plugin-container").length).toBe(0);
    });

    it("B. 回归：同一页面里的普通文档 .protyle 仍正常挂载 TOC（修复未误伤）", () => {
        const docProtyle = document.createElement("div");
        docProtyle.className = "protyle";
        const content = document.createElement("div");
        content.className = "protyle-content";
        content.setAttribute("data-node-id", "20240101000000-ddddddd");
        docProtyle.appendChild(content);
        document.body.appendChild(docProtyle);
        setRect(docProtyle, { left: 100, top: 100, width: 200, height: 400 });

        // 同时存在批注弹层（不应被挂）
        const commentProtyle = buildCommentPopover();
        (commentProtyle.querySelector(".protyle-content") as HTMLElement)
            .setAttribute("data-node-id", "20240101000000-eeeeeee");
        setRect(commentProtyle, { left: 100, top: 100, width: 200, height: 80 });

        manager.checkProtyles();

        expect(plugin.tocInstances.has(docProtyle)).toBe(true);
        expect(plugin.tocInstances.has(commentProtyle)).toBe(false);
    });
});

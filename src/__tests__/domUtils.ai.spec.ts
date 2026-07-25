// @vitest-environment jsdom
/**
 * Issue #33 验收：悬浮大纲不应误挂到思源「智能体（Agent）」对话框。
 * -----------------------------------------------------------------------------
 * Bug 现象：把「回到顶部 / 回到底部 / 刷新」三个 scroll-toolbar 按钮插到了智能体输入框里。
 *
 * 根因：checkProtyles 的候选选择器含 `.protyle`，而智能体 AI 回复消息与输入框（composer，
 *       new Protyle 渲染）都会生成 .protyle；旧版 isAiOrChatPanel 的选择器未覆盖智能体对话框
 *       的真实容器 class，导致 isAiOrChatPanel 命中 false → shouldShowToc 返回 true → createToc。
 *
 * 经查官方源码 app/src/layout/dock/agent/AgentChat.ts，智能体对话框真实 DOM 结构为：
 *   - 最外层 dock 面板：class="... sy__agentChat file-tree dockPanel"
 *   - 内层总包裹（同时包住消息区与输入框 composer）：class="agent-chat fn__flex-column fn__flex-1"
 *   - 消息列表容器：agent-chat__messages；单条消息气泡：agent-chat__msg / agent-chat__msg--ai ...
 *   - 输入框 composer 本身就是一个 new Protyle(...) → 内部是 .protyle（被误挂的就是它）
 *
 * 修复（集中 domUtils.ts）：
 *   1) isAiOrChatPanel 增加 .sy__agentChat / .agent-chat 等真实容器 class；
 *   2) getTocHostElement 开头加双保险 `if (isAiOrChatPanel(candidate)) return null;`
 *
 * 本测试覆盖：
 *   - 智能体容器（含内部 .protyle）→ isAiOrChatPanel true / shouldShowToc false / getTocHostElement null
 *   - 回归：已有 AI 侧栏选择器仍命中（[data-type="sidebar-ai"] / .b3-chat / .ai__chat 等）
 *   - 回归：普通文档 .protyle 仍为有效 host（isAiOrChatPanel false / shouldShowToc true / 自身）
 *   - 加分：vi.mock 隔离 FloatingToc，构造 mock plugin + ProtyleManager，把智能体 .protyle 注入
 *           document 驱动 checkProtyles，断言其 tocInstances 中没有该 host（未误挂）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    isAiOrChatPanel,
    shouldShowToc,
    getTocHostElement
} from "../utils/domUtils";
import { ProtyleManager } from "../modules/protyleManager";

/** 在 document.body 下创建一个带指定 class 的元素。 */
function createEl(cls: string, parent: HTMLElement = document.body): HTMLElement {
    const el = document.createElement("div");
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
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
 * 构建真实的智能体（Agent）对话框 DOM 片段，结构对齐官方源码 AgentChat.ts：
 *   .sy__agentChat（dock 面板）
 *     └ .agent-chat（内层总包裹：消息区 + 输入框 composer）
 *         ├ .agent-chat__messages（消息列表）
 *         │    └ .agent-chat__msg.agent-chat__msg--ai  > .agent-chat__body.b3-typography > .protyle（AI 回复）
 *         └ .agent-composer  > .protyle（输入框，被误挂的就是它）
 * 若 withDocId 为真，则给 composer 的 .protyle 注入 .protyle-content[data-node-id]，
 * 以模拟「智能体继承了当前笔记页签的文档 ID」（这也是 bug 能实际触发的前提）。
 */
function buildAgentDialog(withDocId = false): {
    panel: HTMLElement;
    composerProtyle: HTMLElement;
    messageProtyle: HTMLElement;
} {
    const panel = createEl("sy__agentChat file-tree dockPanel");
    const agentChat = createEl("agent-chat fn__flex-column fn__flex-1", panel);

    // 消息区
    const messages = createEl("agent-chat__messages", agentChat);
    const msg = createEl("agent-chat__msg agent-chat__msg--ai", messages);
    const body = createEl("agent-chat__body b3-typography", msg);
    const messageProtyle = document.createElement("div");
    messageProtyle.className = "protyle";
    body.appendChild(messageProtyle);

    // 输入框 composer（new Protyle 渲染 → 内部 .protyle）
    const composer = createEl("agent-composer", agentChat);
    const composerProtyle = document.createElement("div");
    composerProtyle.className = "protyle";
    if (withDocId) {
        const content = document.createElement("div");
        content.className = "protyle-content";
        content.setAttribute("data-node-id", "20240101000000-aaaaaaa");
        composerProtyle.appendChild(content);
    }
    composer.appendChild(composerProtyle);

    return { panel, composerProtyle, messageProtyle };
}

beforeEach(() => {
    mockGetComputedStyle();
});

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe("isAiOrChatPanel / shouldShowToc - 智能体对话框（核心修复）", () => {
    it("1. 智能体输入框 .protyle（在 .sy__agentChat / .agent-chat 内）→ isAiOrChatPanel 返回 true", () => {
        const { composerProtyle } = buildAgentDialog();
        expect(isAiOrChatPanel(composerProtyle)).toBe(true);
    });

    it("2. 智能体 AI 回复 .protyle（在 .agent-chat__msg 内）→ isAiOrChatPanel 返回 true", () => {
        const { messageProtyle } = buildAgentDialog();
        expect(isAiOrChatPanel(messageProtyle)).toBe(true);
    });

    it("3. 智能体 .protyle → shouldShowToc 返回 false（不被挂载）", () => {
        const { composerProtyle } = buildAgentDialog();
        expect(shouldShowToc(composerProtyle)).toBe(false);
    });

    it("4. 双保险：智能体 .protyle → getTocHostElement 返回 null（源头拦截）", () => {
        const { composerProtyle } = buildAgentDialog(true);
        expect(getTocHostElement(composerProtyle)).toBeNull();
    });

    it("5. 仅 .sy__agentChat 外层（无内层 .agent-chat）也能命中", () => {
        const panel = createEl("sy__agentChat file-tree dockPanel");
        const protyle = document.createElement("div");
        protyle.className = "protyle";
        panel.appendChild(protyle);
        expect(isAiOrChatPanel(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBeNull();
    });

    it("6. 仅 .agent-chat 内层（无 .sy__agentChat）也能命中", () => {
        const agentChat = createEl("agent-chat fn__flex-column fn__flex-1");
        const protyle = document.createElement("div");
        protyle.className = "protyle";
        agentChat.appendChild(protyle);
        expect(isAiOrChatPanel(protyle)).toBe(true);
        expect(getTocHostElement(protyle)).toBeNull();
    });
});

describe("isAiOrChatPanel - 回归（既有 AI 侧栏选择器仍命中）", () => {
    const cases: Array<[string, string, string?]> = [
        ['[data-type="sidebar-ai"]', "", "sidebar-ai"],
        [".b3-chat", "b3-chat"],
        [".ai__chat", "ai__chat"],
        ['[data-type="ai-chat"]', "", "ai-chat"],
        ['[data-type="chat"]', "", "chat"],
        [".protyle-ai", "protyle-ai"],
        ['[data-type="agent"]', "", "agent"],
        [".agent-panel", "agent-panel"],
        [".sidebar-ai", "sidebar-ai"],
        ['[data-type="sidebar-chat"]', "", "sidebar-chat"]
    ];

    it.each(cases)("选择器 %s 仍被识别为 AI/对话面板", (cls, className, dataKey) => {
        const el = document.createElement("div");
        el.className = className;
        if (dataKey) el.setAttribute("data-type", dataKey);
        const protyle = document.createElement("div");
        protyle.className = "protyle";
        el.appendChild(protyle);
        document.body.appendChild(el);
        expect(isAiOrChatPanel(protyle)).toBe(true);
    });
});

describe("shouldShowToc / getTocHostElement - 回归（普通文档不受影响）", () => {
    it("7. 普通文档 .protyle → isAiOrChatPanel 返回 false", () => {
        const protyle = createEl("protyle");
        const content = document.createElement("div");
        content.className = "protyle-content";
        protyle.appendChild(content);
        expect(isAiOrChatPanel(protyle)).toBe(false);
    });

    it("8. 普通文档 .protyle → shouldShowToc 返回 true", () => {
        const protyle = createEl("protyle");
        const content = document.createElement("div");
        content.className = "protyle-content";
        protyle.appendChild(content);
        expect(shouldShowToc(protyle)).toBe(true);
    });

    it("9. 普通文档 .protyle → getTocHostElement 返回自身（有效 host）", () => {
        const protyle = createEl("protyle");
        const content = document.createElement("div");
        content.className = "protyle-content";
        protyle.appendChild(content);
        expect(getTocHostElement(protyle)).toBe(protyle);
    });
});

// ---------------------------------------------------------------------------
// 加分：集成驱动 checkProtyles，验证智能体 .protyle 不会被误挂 TOC
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

describe("checkProtyles 集成 - 智能体 .protyle 不得被误挂（Issue #33 端到端）", () => {
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

    it("A. 智能体对话框内的 composer .protyle（带当前文档 ID）→ checkProtyles 后未挂载 TOC", () => {
        const { composerProtyle } = buildAgentDialog(true); // 带 data-node-id，模拟继承当前笔记页签
        setRect(composerProtyle, { left: 100, top: 100, width: 200, height: 80 });

        manager.checkProtyles();

        // 核心断言：智能体内部 .protyle 不应出现在 tocInstances（未误挂）
        expect(plugin.tocInstances.has(composerProtyle)).toBe(false);
        // 且智能体面板内不应出现任何 TOC 容器
        const agentPanel = composerProtyle.closest(".sy__agentChat") as HTMLElement;
        expect(agentPanel.querySelectorAll(".siyuan-floating-toc-plugin-container").length).toBe(0);
    });

    it("B. 智能体 AI 回复 .protyle → 同样未被挂载", () => {
        const { messageProtyle } = buildAgentDialog();
        setRect(messageProtyle, { left: 100, top: 100, width: 200, height: 80 });

        manager.checkProtyles();

        expect(plugin.tocInstances.has(messageProtyle)).toBe(false);
    });

    it("C. 回归：同一页面里的普通文档 .protyle 仍正常挂载 TOC（修复未误伤）", () => {
        // 普通文档
        const docProtyle = document.createElement("div");
        docProtyle.className = "protyle";
        const content = document.createElement("div");
        content.className = "protyle-content";
        content.setAttribute("data-node-id", "20240101000000-bbbbbbb");
        docProtyle.appendChild(content);
        document.body.appendChild(docProtyle);
        setRect(docProtyle, { left: 100, top: 100, width: 200, height: 400 });

        // 同时存在智能体对话框（不应被挂）
        const { composerProtyle } = buildAgentDialog(true);
        setRect(composerProtyle, { left: 100, top: 100, width: 200, height: 80 });

        manager.checkProtyles();

        expect(plugin.tocInstances.has(docProtyle)).toBe(true);
        expect(plugin.tocInstances.has(composerProtyle)).toBe(false);
    });
});

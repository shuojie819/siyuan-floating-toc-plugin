/**
 * DOM 工具函数模块
 * 提供 TOC 相关的 DOM 操作和查询功能
 */

/**
 * 检查元素是否为集市主机
 * @param element 要检查的元素
 * @returns 是否为集市主机
 */
export function isBazaarHost(element: HTMLElement): boolean {
    // 设置面板里的非集市区域不算集市 host（集市配置页仍要显示 TOC，因此通过了上面判断）
    if (isSettingsPanel(element)) return false;
    if (element.id === "configBazaarReadme") return true;
    if (element.closest("#configBazaarReadme")) return true;
    if (element.classList.contains("config-bazaar__readme")) return true;
    if (element.classList.contains("config-bazaar__panel")) return true;
    if (element.closest(".config-bazaar__panel")) return true;
    if (element.classList.contains("item__readme")) return true;
    return false;
}

/**
 * 判断集市（bazaar）详情页当前是否处于「已展开显示」状态。
 *
 * 思源 ≤ 3.8.2 用 `config-bazaar__readme--show`；
 * 思源 3.8.3+ 重写了集市 UI，把该显示类改名为 `config__view--show`
 * （实测 `#configBazaarReadme` 的 class 为 `config-bazaar__readme config__view--show`）。
 * 两个都兼容，避免再次因思源改类名而失效。
 */
export function isBazaarPanelShown(element: HTMLElement): boolean {
    return element.classList.contains('config-bazaar__readme--show')
        || element.classList.contains('config__view--show');
}

/**
 * 检查元素是否位于思源设置面板的非集市区域
 * 注意：设置面板里的集市配置页（README）仍应显示悬浮大纲，因此集市部分不算设置面板
 */
export function isSettingsPanel(element: HTMLElement): boolean {
    const inSettings = element.closest(
        '.config__panel, .config__tab, .config__tab-container, .config__content'
    );
    if (!inSettings) return false;
    // 设置面板里的集市部分（如 设置 → 集市 的 README）仍要显示大纲，不算设置面板
    const inBazaar = element.closest(
        '.config-bazaar__panel, .item__readme, #configBazaarReadme'
    );
    return !inBazaar;
}

/**
 * 获取 TOC 主机元素
 * @param candidate 候选元素
 * @returns 主机元素或 null
 */
export function getTocHostElement(candidate: HTMLElement): HTMLElement | null {
    // 双保险：智能体（Agent）对话框内的 .protyle（AI 回复消息 / 输入框 composer）直接排除，
    // 不再作为 TOC 宿主。比仅依赖 shouldShowToc 更稳健，且普通文档 .protyle 不在任何 AI 容器内，
    // closest 不会命中，不受影响；搜索/历史/集市等既有逻辑也不受影响。
    if (isAiOrChatPanel(candidate)) return null;
    if (candidate.id === "configBazaarReadme") return candidate;
    if (candidate.classList.contains("config-bazaar__readme")) return candidate;
    if (candidate.classList.contains("config-bazaar__panel")) return candidate;
    if (candidate.classList.contains("item__readme")) {
        const readmeContainer = candidate.closest("#configBazaarReadme, .config-bazaar__readme, .config-bazaar__panel");
        if (readmeContainer instanceof HTMLElement) return readmeContainer;
        return candidate;
    }
    
    if (candidate.classList.contains("protyle")) return candidate;
    const innerProtyle = candidate.querySelector(".protyle");
    if (innerProtyle instanceof HTMLElement) return innerProtyle;
    const docPanel = candidate.querySelector("[data-type='docPanel']");
    if (docPanel instanceof HTMLElement && docPanel.querySelector(".protyle-content")) return docPanel;
    // 搜索预览/文档面板容器本身不是 TOC 宿主：只挂载其内部的真实 protyle 文档。
    // 否则在「固定搜索」（dock/常驻侧边，非弹窗）场景下，容器因包含 .protyle-content
    // 会被误识别为 host，导致 createToc 反复给容器挂上 TOC，造成同一区域多个大纲无限叠加。
    // 内部存在 .protyle 时已在上方 innerProtyle 分支返回其本身；此处对无内部 protyle 的
    // 纯容器直接返回 null，由 getSearchPreviewHosts() 专门处理其内部真实文档。
    if (candidate.classList.contains("search__preview") || candidate.classList.contains("search__doc")) {
        return null;
    }
    const hasContent = candidate.querySelector(".protyle-content");
    if (hasContent) return candidate;
    return null;
}

/**
 * 获取搜索预览主机元素
 * @returns 搜索预览主机元素数组
 */
export function getSearchPreviewHosts(): HTMLElement[] {
    const hostSet = new Set<HTMLElement>();
    const candidates = document.querySelectorAll("#searchPreview, .search__preview, .search__doc");
    candidates.forEach((candidate) => {
        if (!(candidate instanceof HTMLElement)) return;
        const host = getTocHostElement(candidate);
        if (host) hostSet.add(host);
    });
    return Array.from(hostSet);
}

/**
 * 获取历史预览主机元素
 * @returns 历史预览主机元素数组
 */
export function getHistoryPreviewHosts(): HTMLElement[] {
    const hostSet = new Set<HTMLElement>();
    const candidates = document.querySelectorAll(
        "#historyPreview, .history__text, .history__text.protyle, .history__text .protyle, [data-type='docPanel'].history__text, " +
        ".b3-dialog--open[data-key='dialog-history'] .protyle, .b3-dialog--open[data-key='dialog-historydoc'] .protyle, " +
        ".b3-dialog--open[data-key='dialog-history'] [data-type='docPanel'], .b3-dialog--open[data-key='dialog-historydoc'] [data-type='docPanel']"
    );
    candidates.forEach((candidate) => {
        if (!(candidate instanceof HTMLElement)) return;
        const host = getTocHostElement(candidate);
        if (host) hostSet.add(host);
    });
    return Array.from(hostSet);
}

/**
 * 检查元素是否为历史主机
 * @param element 要检查的元素
 * @returns 是否为历史主机
 */
export function isHistoryHost(element: HTMLElement): boolean {
    if (element.classList.contains("history__text")) return true;
    if (element.closest(".history__text")) return true;
    if (element.closest(".history__panel, .history")) return true;
    if (element.closest(".b3-dialog--open[data-key='dialog-history'], .b3-dialog--open[data-key='dialog-historydoc']")) return true;
    return false;
}

/**
 * 从路径中提取文档 ID
 * @param path 路径字符串
 * @returns 文档 ID 或空字符串
 */
export function extractDocIdFromPath(path: string | null | undefined): string {
    if (!path) return "";
    const match = String(path).match(/(?:^|[\\/])(\d{14}-[a-z0-9]{7})\.(?:syx|sy)$/i);
    if (match) return match[1];
    const allIds = String(path).match(/\d{14}-[a-z0-9]{7}/gi);
    if (allIds && allIds.length > 0) {
        return allIds[allIds.length - 1];
    }
    return "";
}

/**
 * 检查元素是否为面包屑相关元素
 * @param element 元素
 * @returns 是否为面包屑元素
 */
export function isBreadcrumbElement(element: HTMLElement): boolean {
    return element.classList.contains('protyle-breadcrumb') || 
           element.classList.contains('protyle-breadcrumb__bar') ||
           element.closest('.protyle-breadcrumb') !== null;
}

/**
 * 检查元素是否在反链区域内
 * 反链区域包括：
 * - 官方反链面板：.sy__backlink, .backlinkList, .backlinkMList
 * - 第三方插件生成的反链区域：通常包含 data-defid 或 data-ismention 属性
 * @param element 元素
 * @returns 是否在反链区域内
 */
export function isBacklinkArea(element: HTMLElement): boolean {
    if (element.closest('.sy__backlink')) return true;
    // 思源新版「底部反链面板」的 class 是 sy__backlink--bottom（不含 sy__backlink token），
    // 必须单独判断，否则面板内引用文档的 .protyle 会被误挂悬浮大纲
    if (element.closest('.sy__backlink--bottom')) return true;
    if (element.closest('.backlinkList')) return true;
    if (element.closest('.backlinkMList')) return true;
    if (element.closest('[data-defid]')) return true;
    if (element.closest('[data-ismention]')) return true;
    if (element.closest('.backlink-panel')) return true;
    return false;
}

/**
 * 检查元素是否为 protyle 相关元素
 * @param element 元素
 * @returns 是否为 protyle 相关元素
 */
export function isProtyleRelatedElement(element: HTMLElement): boolean {
    if (isBacklinkArea(element)) return false;
    return element.classList.contains('protyle') || 
           !!element.querySelector('.protyle') ||
           element.classList.contains('dialog-globalsearch') ||
           element.classList.contains('b3-dialog');
}

/**
 * 检查 protyle 元素是否应该显示 TOC
 * 排除：反链区域、嵌入块、悬浮预览、被集市面板覆盖的元素等
 * @param protyleElement protyle 元素
 * @returns 是否应该显示 TOC
 */
/**
 * 检查元素是否位于 AI / 智能体 / 对话侧栏内
 * 思源 3.x 的「智能体侧栏」会在对话中渲染 .protyle，需排除以免误挂大纲
 */
export function isAiOrChatPanel(element: HTMLElement): boolean {
    return !!element.closest(
        '[data-type="sidebar-ai"], .ai__chat, [data-type="ai-chat"], .b3-chat, ' +
        '[data-type="chat"], .protyle-ai, [data-type="agent"], .agent-panel, ' +
        '.sidebar-ai, [data-type="sidebar-chat"], ' +
        // 思源内置「智能体（Agent）」对话框容器（实锤自官方源码 app/src/layout/dock/agent/AgentChat.ts）
        // 其最外层 dock 面板 = .sy__agentChat，内层总包裹 = .agent-chat（同时包住消息区与输入框 composer）。
        // 智能体内 AI 回复消息与输入框（composer 用 new Protyle 渲染）都会生成 .protyle，
        // 必须整框排除，否则悬浮大纲（含回到顶部/回到底部/刷新 scroll-toolbar）会被误挂到智能体里。
        // .agent-chat__messages / .agent-chat__msg 作为补充兜底，覆盖局部 DOM 片段。
        '.sy__agentChat, .agent-chat, .agent-chat__messages, .agent-chat__msg'
    );
}

/**
 * 检查元素是否位于关系图/图谱视图内
 */
export function isGraphView(element: HTMLElement): boolean {
    return !!element.closest('[data-type="graph"], .graph, .fullscreen-graph, [data-type="graphView"], .relation-graph');
}

/**
 * 判断元素是否位于数据库（属性视图）的编辑上下文内。
 * 思源 3.8.3 起数据库文本字段支持块元素/行级元素，单元格/弹层内会出现可编辑的 protyle，
 * 这类迷你编辑器不应挂载悬浮大纲。
 * 注意：普通文档的 .protyle 只是「包含」数据库块（.av 是其后代），
 * closest 只向上查找，因此不会误伤正常文档。
 */
export function isDatabaseEditorContext(element: HTMLElement): boolean {
    return !!element.closest(
        '.av__panel, .av__cell, .av__row, .av__body, .av__container, [data-type="NodeAttributeView"]'
    );
}

/**
 * 判断元素是否位于思源「轻量编辑器片段（protyle-lite）」内。
 * 思源 3.8.3 起数据库文本字段支持富文本/块元素编辑，单元格内使用 protyle-lite；
 * 该类迷你编辑器（数据库单元格、智能体输入框等）不是完整文档，不应挂载悬浮大纲。
 * 实锤类名/属性：.protyle-lite-fragment、[data-protyle-lite-render]
 */
export function isLiteEditorFragment(element: HTMLElement): boolean {
    return !!element.closest('.protyle-lite-fragment, [data-protyle-lite-render]');
}

/**
 * 判断元素是否位于思源「闪卡 / 卡片复习」上下文内。
 * 闪卡复习视图容器是 .card__main（内部用 Protyle 渲染卡片块，无论是否浮窗/全屏都是它），
 * 闪卡预览对话框是 #cardPreview；这些都不是文档阅读场景，不应挂载悬浮大纲。
 */
export function isFlashcardContext(element: HTMLElement): boolean {
    return !!element.closest('.card__main, #cardPreview');
}

/**
 * 左侧停靠时，正文应让出的像素宽度（Issue #9：间距可配置）。
 * tocGap 表示「大纲与正文之间的间距」，历史硬编码值为 10。
 * pinnedNeeded 为真（固定模式且确实需要挤压）时，额外再留 32px ——
 * 历史实现是硬编码 42，即 10 + 32。
 * 以 tocGap = 10 调用时，返回值与历史实现完全一致（零行为变化）。
 */
export function computeLeftDockPadding(width: number, tocGap: number, pinnedNeeded: boolean): number {
    return width + tocGap + (pinnedNeeded ? 32 : 0);
}

/**
 * calculateTocPosition 的参数集合。
 * 由 FloatingToc.svelte 的 calculateTocPosition 抽出（逻辑不变），
 * 仅把原先的闭包依赖（isExpanded / isPinned / dockSide / miniTocWidth）与两个常量参数化，
 * 以便单测覆盖层级/位置相关改动。
 */
export interface TocPositionParams {
    /** .protyle-content 的矩形 */
    rect: DOMRect;
    /** .protyle-wysiwyg 的矩形（可能为空） */
    wRect: DOMRect | null;
    effectiveTocWidth: number;
    miniTocWidth: number;
    currentPaddingLeft: number;
    currentPaddingRight: number;
    isExpanded: boolean;
    isPinned: boolean;
    dockSide: 'left' | 'right';
    /** 边缘留白，默认 14（历史上是常量 EDGE_MARGIN） */
    edgeMargin?: number;
    /** 拖拽手柄避让，默认 6 */
    resizeHandleOffset?: number;
}

/**
 * 计算悬浮大纲的 left 与是否需要给正文加内边距。
 * 由 FloatingToc.svelte 的 calculateTocPosition 原样抽出（逻辑不变），仅把闭包依赖与常量参数化，
 * 以便单测覆盖 #36 的层级/位置相关改动。默认 edgeMargin=14 / resizeHandleOffset=6 时结果与历史完全一致。
 */
export function calculateTocPosition(params: TocPositionParams): { left: number; paddingNeeded: boolean } {
    const {
        rect, wRect, effectiveTocWidth, miniTocWidth,
        currentPaddingLeft, currentPaddingRight,
        isExpanded, isPinned, dockSide,
        edgeMargin = 14,
        resizeHandleOffset = 6
    } = params;

    if (isExpanded && wRect) {
        if (dockSide === 'left') {
            const naturalTextLeft = wRect.left - (currentPaddingLeft / 2);
            const idealLeft = naturalTextLeft - effectiveTocWidth;
            const minLeft = rect.left + resizeHandleOffset;
            const left = Math.max(minLeft, idealLeft);
            const paddingNeeded = isPinned || (left + effectiveTocWidth > naturalTextLeft - 42);
            return { left, paddingNeeded };
        } else {
            const naturalTextRight = wRect.right + (currentPaddingRight / 2);
            const idealLeft = naturalTextRight;
            const maxLeft = rect.right - effectiveTocWidth - resizeHandleOffset;
            const left = Math.min(maxLeft, idealLeft);
            const paddingNeeded = left < naturalTextRight;
            return { left, paddingNeeded };
        }
    } else {
        if (dockSide === 'left') {
            return { left: rect.left + edgeMargin, paddingNeeded: true };
        } else {
            return {
                left: rect.right - (isExpanded ? effectiveTocWidth : miniTocWidth) - edgeMargin,
                paddingNeeded: false
            };
        }
    }
}

export function shouldShowToc(protyleElement: HTMLElement): boolean {
    // 设置面板的非集市区域不挂 TOC（集市配置页 README 仍显示大纲）
    if (isSettingsPanel(protyleElement)) return false;
    if (isBacklinkArea(protyleElement)) return false;
    // 数据库（属性视图）编辑上下文不挂 TOC（数据库文本字段的富文本/块编辑器）
    if (isDatabaseEditorContext(protyleElement)) return false;
    // 轻量编辑器片段（数据库单元格富文本、智能体输入框等）不挂 TOC
    if (isLiteEditorFragment(protyleElement)) return false;
    // 闪卡 / 卡片复习场景（含浮窗、全屏、卡片预览对话框）不挂 TOC
    if (isFlashcardContext(protyleElement)) return false;
    if (isAiOrChatPanel(protyleElement)) return false;
    if (isGraphView(protyleElement)) return false;
    if (protyleElement.closest('.protyle-wysiwyg__embed')) return false;
    
    // 检查是否被集市面板覆盖
    if (isCoveredByBazaar(protyleElement)) return false;

    // 被任意打开的弹窗遮挡时不挂 TOC（如设置弹窗打开时隐藏文档 TOC）
    if (isCoveredByDialog(protyleElement)) return false;

    return true;
}

/**
 * 检查元素是否被集市面板覆盖
 * @param element 元素
 * @returns 是否被覆盖
 */
export function isCoveredByBazaar(element: HTMLElement): boolean {
    const bazaarReadme = document.querySelector('#configBazaarReadme');
    if (!bazaarReadme) return false;
    
    // 检查集市面板是否可见
    const bazaarStyle = getComputedStyle(bazaarReadme);
    if (bazaarStyle.display === 'none' || bazaarStyle.visibility === 'hidden') return false;
    
    // 检查元素是否在集市面板内
    if (bazaarReadme.contains(element)) return false;
    
    // 检查元素是否被集市面板覆盖
    const elementRect = element.getBoundingClientRect();
    const bazaarRect = bazaarReadme.getBoundingClientRect();
    
    // 如果元素在集市面板的左侧或右侧，不被覆盖
    if (elementRect.right <= bazaarRect.left || elementRect.left >= bazaarRect.right) {
        return false;
    }
    
    // 如果元素在集市面板的上方或下方，不被覆盖
    if (elementRect.bottom <= bazaarRect.top || elementRect.top >= bazaarRect.bottom) {
        return false;
    }
    
    // 元素被集市面板覆盖
    return true;
}

/**
 * 检查元素是否被打开的弹窗（dialog）遮挡
 * 用于设置弹窗打开时隐藏/销毁文档 TOC，同时保留弹窗内部的 TOC（如集市详情弹窗里的 README 大纲）
 * @param element 元素
 * @returns 是否被弹窗遮挡
 */
export function isCoveredByDialog(element: HTMLElement): boolean {
    const dialogs = document.querySelectorAll(
        '.b3-dialog, .b3-dialog--open, [data-key^="dialog-"], .search__panel, .search__preview, .history__panel, .history__side, .history__text'
    );
    const elementRect = element.getBoundingClientRect();
    if (elementRect.width === 0 || elementRect.height === 0) return false;

    for (const dialog of Array.from(dialogs)) {
        if (!(dialog instanceof HTMLElement)) continue;
        // 元素本身在弹窗内部，不算被遮挡（弹窗内部的 TOC 应保留）
        if (dialog === element || dialog.contains(element)) continue;

        const style = getComputedStyle(dialog);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

        const dialogRect = dialog.getBoundingClientRect();
        if (dialogRect.width === 0 || dialogRect.height === 0) continue;

        // 判断两个矩形是否重叠
        const overlap = !(elementRect.right <= dialogRect.left ||
                          elementRect.left >= dialogRect.right ||
                          elementRect.bottom <= dialogRect.top ||
                          elementRect.top >= dialogRect.bottom);
        if (overlap) return true;
    }
    return false;
}

/**
 * 检查元素是否为搜索结果项
 * @param node 节点
 * @returns 是否为搜索结果项
 */
export function isSearchResultItem(node: Node): boolean {
    if (!(node instanceof HTMLElement)) return false;
    return node.classList.contains('b3-list-item') && node.closest('.search__list') !== null;
}

/**
 * 检查元素是否为历史相关元素
 * @param element 元素
 * @returns 是否为历史相关元素
 */
export function isHistoryRelatedElement(element: HTMLElement): boolean {
    return element.classList.contains('history__panel') ||
           element.classList.contains('history__side') ||
           element.classList.contains('history__list') ||
           element.classList.contains('history__text') ||
           !!element.querySelector('.history__side') ||
           !!element.querySelector('.history__text');
}

/**
 * 检查历史列表项是否有属性变化
 * @param element 元素
 * @returns 是否有属性变化
 */
export function isHistoryListItem(element: HTMLElement): boolean {
    return element.classList.contains('b3-list-item') &&
           element.closest('.history__side, .history__list, .history__repo') !== null;
}

/**
 * 检查元素是否为历史面板元素
 * @param element 元素
 * @returns 是否为历史面板元素
 */
export function isHistoryPanelElement(element: HTMLElement): boolean {
    return element.classList.contains('history__side') ||
           element.classList.contains('history__list') ||
           element.classList.contains('history__text') ||
           element.classList.contains('history__panel');
}

/**
 * 检查元素是否为搜索属性变化元素
 * @param element 元素
 * @param attributeName 属性名
 * @returns 是否为搜索属性变化元素
 */
export function isSearchAttributeChanged(element: HTMLElement, attributeName: string | null): boolean {
    if (element.classList.contains('b3-list-item') &&
        attributeName === 'class' &&
        element.closest('.search__list')) {
        return true;
    }
    if (element.classList.contains('protyle-breadcrumb__item') ||
        element.classList.contains('protyle-breadcrumb') ||
        element.classList.contains('protyle-breadcrumb__icon')) {
        return true;
    }
    if (element.classList.contains('protyle-content') ||
        element.classList.contains('search__preview') ||
        element.classList.contains('search__doc')) {
        return true;
    }
    return false;
}

/**
 * 检查元素是否为历史属性变化元素
 * @param element 元素
 * @param attributeName 属性名
 * @returns 是否为历史属性变化元素
 */
export function isHistoryAttributeChanged(element: HTMLElement, attributeName: string | null): boolean {
    if (element.classList.contains('b3-list-item') &&
        attributeName === 'class' &&
        element.closest('.history__side, .history__list, .history__repo')) {
        return true;
    }
    return isHistoryPanelElement(element);
}

/**
 * 应用编辑器内边距
 * @param protyleElement protyle 元素
 * @param offset 偏移量
 * @param dockSide 停靠侧
 */
export function updateEditorPadding(protyleElement: HTMLElement, offset: number, dockSide: 'left' | 'right' = 'right'): void {
    const content = protyleElement.querySelector('.protyle-content') as HTMLElement;
    if (!content) return;
    
    if (offset > 0) {
        if (dockSide === 'left') {
            content.style.paddingLeft = `${offset}px`;
            content.style.paddingRight = '';
        } else {
            content.style.paddingRight = `${offset}px`;
            content.style.paddingLeft = '';
        }
    } else {
        content.style.paddingLeft = '';
        content.style.paddingRight = '';
    }
}

/**
 * 清除编辑器内边距
 * @param protyleElement protyle 元素
 */
export function clearEditorPadding(protyleElement: HTMLElement): void {
    const content = protyleElement.querySelector('.protyle-content') as HTMLElement;
    if (content) {
        content.style.paddingLeft = '';
        content.style.paddingRight = '';
    }
}

// ============================================
// 层叠（z-index）安全计算 与 孤儿容器判定（Issue #44）
// ============================================

/**
 * 悬浮大纲的默认层叠值（与 DEFAULT_CONFIG.tocZIndex 保持一致）。
 * 仅作为配置缺失时的回退；运行时实际写入的层级由 computeTocZIndex 收敛到思源原生 UI 之下。
 */
export const DEFAULT_TOC_Z_INDEX = 20;

/**
 * 计算悬浮大纲实际使用的 z-index，确保它「高于文档正文，但不高于思源原生浮层」。
 *
 * 背景（Issue #44）：历史上 `.floating-toc` 硬编码 `position: fixed; z-index: 20`。
 * 而思源自身的浮层（左侧停靠栏、右键菜单 `.b3-menu`、对话框等）由全局计数器
 * `window.siyuan.zIndex` 统一分配（实测基线为 16，每次 +1）。当插件写死 20 时，
 * 会盖在部分原生浮层之上，破坏思源既有的层叠关系，出现「收起右侧文档后偶发层级错乱、
 * 编辑器元素穿透到左侧菜单之上」的现象。
 *
 * 修复思路：把插件 TOC 稳定地放在「原生浮层之下、正文内容之上」：
 *   - 能拿到 siyuan.zIndex 时，**默认/未抬高的配置**上限收敛为 counter - 1
 *     （保证不高于思源 UI 层级，修复 Issue #44 的层叠穿透）；
 *   - **用户显式把层级调到默认值之上**（Issue #36③：被其它插件面板遮挡时调大）
 *     属于自担风险的显式覆盖，原样放行、不做收敛 —— 保留 #36③ 的原始诉求；
 *   - 拿不到 / 计数器异常时退回配置值（保持历史行为，不劣化）；
 *   - 下限兜底为 1，保证仍高于 z-index:auto 的正文内容。
 *
 * @param configuredZIndex 用户/默认配置的 z-index（通常为 DEFAULT_TOC_Z_INDEX）
 * @param siyuanZIndex `window.siyuan.zIndex` 计数器的当前值（可能为 undefined）
 * @returns 实际应写入的、安全的 z-index（>= 1 的整数）
 */
export function computeTocZIndex(configuredZIndex: number, siyuanZIndex: unknown): number {
    const fallback = Number.isFinite(configuredZIndex)
        ? Math.floor(configuredZIndex as number)
        : DEFAULT_TOC_Z_INDEX;
    // 用户显式抬高到默认值之上（Issue #36③ 的合法用法）→ 原样放行
    if (fallback > DEFAULT_TOC_Z_INDEX) {
        return Math.max(1, fallback);
    }
    const counter =
        typeof siyuanZIndex === 'number' && Number.isFinite(siyuanZIndex)
            ? Math.floor(siyuanZIndex)
            : NaN;
    // 计数器不可用 / 异常小 → 保持配置值（避免劣化既有行为）
    if (!Number.isFinite(counter) || counter <= 1) {
        return Math.max(1, fallback);
    }
    const safeCap = counter - 1;
    return Math.max(1, Math.min(fallback, safeCap));
}

/**
 * 判定一个 `.siyuan-floating-toc-plugin-container` 是否为「孤儿容器」——
 * 即宿主已销毁/脱离文档、不应继续存在于 DOM 中的残留容器（Issue #44 兜底清理）。
 *
 * - 集市容器挂在 `document.body`，通过 `(container)._tocHost` 关联宿主；
 * - 普通文档/历史/集市 README 容器内嵌于宿主子树内，通过 `closest` 回溯宿主。
 *
 * @param container 待判定的容器元素
 * @param isHostConnected 判定「宿主是否仍然有效（连接在文档中）」的谓词
 * @returns 是否为孤儿容器（`true` 表示应被移除）
 */
export function isOrphanTocContainer(
    container: HTMLElement,
    isHostConnected: (host: HTMLElement) => boolean
): boolean {
    if (!container.isConnected) return true;

    if (container.dataset.bazaar === 'true') {
        const host = (container as any)._tocHost as HTMLElement | undefined;
        if (!(host instanceof HTMLElement)) return true;
        return !isHostConnected(host);
    }

    const host = container.closest(
        '.protyle, .history__text, #configBazaarReadme, .config-bazaar__readme, .config-bazaar__panel'
    );
    if (!(host instanceof HTMLElement)) return true;
    return !isHostConnected(host);
}

/**
 * 检查元素是否实际可见（在 DOM 中且未被 display:none / visibility:hidden / 面积为 0）
 * 用于切换标签页后销毁旧文档的 TOC 实例
 * @param element 要检查的元素
 * @returns 是否实际可见
 */
export function isElementVisible(element: HTMLElement): boolean {
    if (!document.contains(element)) return false;
    if (!element.offsetParent) {
        // offsetParent 为 null 通常表示 display:none 或不在布局中；
        // 但 fixed/absolute 在某些情况下也会为 null，需要进一步用 rect 判断
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

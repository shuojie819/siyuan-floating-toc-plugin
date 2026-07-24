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
    if (element.id === "configBazaarReadme") return true;
    if (element.closest("#configBazaarReadme")) return true;
    if (element.classList.contains("config-bazaar__readme")) return true;
    if (element.classList.contains("config-bazaar__panel")) return true;
    if (element.closest(".config-bazaar__panel")) return true;
    if (element.classList.contains("item__readme")) return true;
    return false;
}

/**
 * 获取 TOC 主机元素
 * @param candidate 候选元素
 * @returns 主机元素或 null
 */
export function getTocHostElement(candidate: HTMLElement): HTMLElement | null {
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
        '.sidebar-ai, [data-type="sidebar-chat"]'
    );
}

/**
 * 检查元素是否位于关系图/图谱视图内
 */
export function isGraphView(element: HTMLElement): boolean {
    return !!element.closest('[data-type="graph"], .graph, .fullscreen-graph, [data-type="graphView"], .relation-graph');
}

export function shouldShowToc(protyleElement: HTMLElement): boolean {
    if (isBacklinkArea(protyleElement)) return false;
    if (isAiOrChatPanel(protyleElement)) return false;
    if (isGraphView(protyleElement)) return false;
    if (protyleElement.closest('.protyle-wysiwyg__embed')) return false;
    
    // 检查是否被集市面板覆盖
    if (isCoveredByBazaar(protyleElement)) return false;
    
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

/**
 * 检查元素是否可见
 * @param element 元素
 * @returns 是否可见
 */
export function isElementVisible(element: HTMLElement): boolean {
    return element.offsetParent !== null && 
           element.offsetWidth > 0 && 
           element.offsetHeight > 0 && 
           element.style.display !== 'none' && 
           element.style.visibility !== 'hidden';
}

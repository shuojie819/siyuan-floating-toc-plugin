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
 * computeBazaarInlineStyle 的参数集合（集市「嵌入面板」态下的尺寸同步）。
 */
export interface BazaarInlineStyleParams {
    /** 是否处于展开态 */
    isExpanded: boolean;
    /** 展开态宽度（已含窄屏兜底，调用方传入 getEffectiveTocWidth()） */
    effectiveTocWidth: number;
    /** 折叠态宽度（用户配置 miniTocWidth） */
    miniTocWidth: number;
    /** 是否自适应高度（true → 贴合内容，不拉满面板） */
    adaptiveHeight: boolean;
}

/**
 * 计算集市（bazaar）「嵌入 #configBazaarReadme 面板」态下，TOC 本体需要 **由 JS 内联同步** 的尺寸样式。
 *
 * 设计：定位完全交给 CSS（容器 absolute + top/right 锚定，见 FloatingToc.svelte 样式区）；
 * 本函数 **只产出宽度/高度**，不产出 left/top，避免与 CSS 定位耦合、也避免重蹈「fixed 相对 transform 祖先」的错位。
 *
 * 宽度必须由 JS 同步，才能让用户可见能力在集市里生效：
 *   - 展开态宽度 = effectiveTocWidth（跟随「拖拽改宽」的 tocWidth，及窄屏 200 兜底）；
 *   - 折叠态宽度 = miniTocWidth（跟随设置项「Mini 大纲宽度」）。
 * 高度（**两个分支都必须有上界**，否则列表不可滚）：
 *   - adaptiveHeight → `height: auto; max-height: 100%`（贴合内容，但不超出容器）；
 *   - 否则 → `height: 100%`（撑满容器 = 面板可用高度）。
 *
 * ⚠️ adaptiveHeight 分支**必须**同时给出 max-height，不能只写 `height: auto`：
 * 容器 `[data-bazaar-inline="true"]` 是 `position:absolute; top:16px; bottom:16px`（高度确定），
 * 而 `.floating-toc` 是 `position:absolute`。若只给 `height: auto`，其高度 = 内容高度（无上界），
 * 内部 `.toc-panel{flex:1;overflow:hidden}` / `.toc-content{flex:1;overflow-y:auto}` **永不产生溢出**，
 * 于是标题列表无法上下滚动、超出面板的部分被直接裁掉（用户报告：集市里看不到下方标题）。
 * 这里沿用文档场景（FloatingToc.svelte 中 `max-height: ${maxHeight}px; height: auto;`）的既有模式，
 * 内联态下容器的确定高度即为天然上界，故用 `100%` 即可，无需 JS 计算 px。
 * 百分比可解析：`.floating-toc` 绝对定位，其包含块 = 容器，而容器高度由 top/bottom 撑开、是确定值。
 *
 * @param p 参数集合
 * @returns 可直接赋给 `.floating-toc` 的 style 字符串
 */
export function computeBazaarInlineStyle(p: BazaarInlineStyleParams): string {
    const w = p.isExpanded ? p.effectiveTocWidth : p.miniTocWidth;
    return p.adaptiveHeight
        ? `width: ${w}px; height: auto; max-height: 100%;`
        : `width: ${w}px; height: 100%;`;
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

/**
 * 从 start（含自身）向上寻找第一个「纵向可滚动」的元素。
 *
 * 判定：`scrollHeight - clientHeight > 1` 且 `computedStyle.overflowY ∈ auto|scroll|overlay`。
 * 找不到返回 null。
 *
 * 用途：统一集市（bazaar）等场景的滚动容器探测，替代原先硬编码的 `.item__main || .item__readme`
 * ——集市 README 的真实滚动容器随思源版本变化，硬编码易失效；本函数按「实际可滚动」这一
 * 行为事实探测，对结构变化更健壮。
 *
 * @param start    起始元素（可为 null）
 * @param maxDepth 向上回溯的最大层数，默认 8
 * @returns 第一个纵向上可滚动的元素；无则返回 null
 */
export function findScrollableElement(start: Element | null, maxDepth = 8): HTMLElement | null {
    let el: Element | null = start;
    let depth = 0;
    while (el instanceof HTMLElement && depth < maxDepth) {
        const overflowY = getComputedStyle(el).overflowY;
        const scrollable =
            el.scrollHeight - el.clientHeight > 1 &&
            (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay');
        if (scrollable) return el;
        el = el.parentElement;
        depth++;
    }
    return null;
}

/**
 * 解析集市（bazaar）详情页 README 的**真实滚动容器**。
 *
 * ⚠️ 方向性要点（易错）：集市 TOC 的宿主 `targetElement` = `#configBazaarReadme` 面板**本身**，
 * 而其滚动容器 `.item__main{overflow:auto}` 是宿主的**后代**（README 内容 `.item__readme` /
 * `.b3-typography` 位于其内）。`findScrollableElement` 只沿 `parentElement` **向上**探测，
 * 若直接以宿主为起点，永远到不了后代 → 恒为 null（置顶/置底失效、scroll-spy 退化）。
 * 因此必须**从 README 内容（后代）起，向上取最近的纵向上可滚动祖先**：
 *   `.item__readme`（或其自身可滚）→ `.item__main` → … 取最近者。
 *
 * 找不到时返回 null（调用方据此跳过，不报错）。
 *
 * @param host 集市 TOC 宿主（`#configBazaarReadme` / `.config-bazaar__readme` 等）
 * @returns README 的真实滚动容器；无则 null
 */
export function resolveBazaarScrollContainer(host: Element | null): HTMLElement | null {
    if (!host) return null;
    const readmeRoot: Element = host.querySelector('.item__readme')
        || host.querySelector('.b3-typography')
        || host;
    return findScrollableElement(readmeRoot);
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

// ============================================
// 「只滚动自己」工具集：替代 scrollIntoView
// ============================================

/**
 * 把非有限值（NaN / Infinity / undefined / null）收敛为有限数字。
 *
 * @param value     待收敛的值
 * @param fallback  无效时的回退值，默认 0
 * @returns 有限数字
 */
function toFiniteNumber(value: unknown, fallback: number = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * 把目标 scrollTop 钳制到容器的合法滚动区间 `[0, scrollHeight - clientHeight]`。
 *
 * 单独导出为纯函数，便于单测覆盖「下越界 / 上越界 / 未布局」三类边界。
 *
 * 边界约定：
 *   - `clientHeight <= 0`（容器尚未参与布局）→ 无可视区间，合法滚动量为 0；
 *   - `scrollHeight` 非有限值 → 只做下界钳制（>= 0），不臆造上界。
 *
 * @param top          期望的 scrollTop
 * @param scrollHeight 容器内容总高（`element.scrollHeight`）
 * @param clientHeight 容器可视高度（`element.clientHeight`）
 * @returns 钳制后的 scrollTop（一定 >= 0）
 */
export function clampScrollTop(top: number, scrollHeight: number, clientHeight: number): number {
    const visibleHeight = Math.max(0, toFiniteNumber(clientHeight, 0));
    const contentHeight = toFiniteNumber(scrollHeight, NaN);
    const desired = toFiniteNumber(top, 0);

    // 下界：永不为负
    if (desired < 0) return 0;
    // 容器未布局：无可视区间 → 不允许滚动（避免写入一个无意义的 scrollTop）
    if (visibleHeight <= 0) return 0;

    // 上界：内容不足以滚动时（scrollHeight 缺失/非法）只取正值；否则钳到极值
    if (!Number.isFinite(contentHeight)) return desired;
    const maxScrollTop = Math.max(0, contentHeight - visibleHeight);
    return Math.min(desired, maxScrollTop);
}

/**
 * 激活项滚动语义：`mode` 与 `scrollIntoView({ block })` 对齐。
 *   - `center`：尽量让目标项居中；
 *   - `nearest`：只在不可见时做「最小移动」（等价于 `block: 'nearest'`）。
 */
export type ItemScrollMode = 'center' | 'nearest';

/**
 * `computeItemScrollTop` 的入参（全部为纯数值，便于单测）。
 */
export interface ItemScrollTopParams {
    /** 容器当前 scrollTop */
    containerScrollTop: number;
    /** 容器可视高度（clientHeight） */
    containerHeight: number;
    /** 目标项在容器内容坐标系中的偏移（含当前滚动量之外的绝对位置） */
    itemOffsetTop: number;
    /** 目标项自身高度 */
    itemHeight: number;
    /** 滚动语义：居中 / 最小移动 */
    mode: ItemScrollMode;
    /** 容器内容总高（scrollHeight），可选；提供时用于上界钳制 */
    containerScrollHeight?: number;
}

/**
 * 计算「让目标项在容器可视区内出现」所需的 scrollTop。
 *
 * 存在的理由（为什么不用 `scrollIntoView`）：
 * `scrollIntoView` 会滚动目标元素的**所有可滚动祖先**。集市侧的 TOC 容器自 v0.1.31 起
 * 挂在面板 `#configBazaarReadme` 内部，于是 TOC 内元素的祖先链上多了面板/弹窗滚动容器；
 * 每次滚动都会引发的「激活项跟随」连带把外层面板滚走（README 被推离、下方露白），
 * 并把绝对定位的 TOC 连同顶部按钮一起带出可视区。本函数是「只操作指定容器 scrollTop」
 * 方案的计算内核，纯数值输入输出、可单测。
 *
 * 语义与边界：
 *   - `mode: 'center'` → `itemOffsetTop + itemHeight / 2 - containerHeight / 2`；
 *   - `mode: 'nearest'`：
 *       · 已完整可见 → 原样返回 `containerScrollTop`（不动）；
 *       · 在可视区上方 → 对齐顶边（`itemOffsetTop`）；
 *       · 在可视区下方 → 对齐底边（`itemOffsetTop + itemHeight - containerHeight`）；
 *       · 项高 > 容器高 → 无法完整可见，与浏览器 `nearest` 一致对齐顶边；
 *   - `containerHeight <= 0`（未布局）→ 无法计算，保持原状；
 *   - 结果经 `clampScrollTop` 钳制到 `[0, scrollHeight - containerHeight]`。
 *
 * @param params 见 {@link ItemScrollTopParams}
 * @returns 应写入该容器 `scrollTop` 的目标值
 */
export function computeItemScrollTop(params: ItemScrollTopParams): number {
    if (!params) return 0;

    const containerScrollTop = Math.max(0, toFiniteNumber(params.containerScrollTop, 0));
    const containerHeight = Math.max(0, toFiniteNumber(params.containerHeight, 0));
    const itemOffsetTop = toFiniteNumber(params.itemOffsetTop, 0);
    const itemHeight = Math.max(0, toFiniteNumber(params.itemHeight, 0));
    const mode: ItemScrollMode = params.mode === 'center' ? 'center' : 'nearest';

    // 容器尚未参与布局（高度为 0）：任何 scrollTop 都无从算起 → 保持原状
    if (containerHeight <= 0) return containerScrollTop;

    let target: number;
    if (mode === 'center') {
        target = itemOffsetTop + itemHeight / 2 - containerHeight / 2;
    } else {
        // 目标项相对容器可视区的坐标（0 = 容器顶边，containerHeight = 容器底边）
        const itemTopRel = itemOffsetTop - containerScrollTop;
        const itemBottomRel = itemTopRel + itemHeight;

        if (itemHeight > containerHeight) {
            // 项比容器还高（超长标题 / 极窄容器）：不可能完整可见 → 对齐顶边
            target = itemOffsetTop;
        } else if (itemTopRel >= 0 && itemBottomRel <= containerHeight) {
            // 已完整可见 → 不移动
            target = containerScrollTop;
        } else if (itemTopRel < 0) {
            // 在可视区上方 → 上移到刚好露出顶边
            target = itemOffsetTop;
        } else {
            // 在可视区下方 → 下移到刚好露出底边
            target = itemOffsetTop + itemHeight - containerHeight;
        }
    }

    return clampScrollTop(target, toFiniteNumber(params.containerScrollHeight, NaN), containerHeight);
}

/**
 * 判定元素是否为「纵向上实际可滚动」的容器。
 *
 * 判定条件与既有的 {@link findScrollableElement} 保持一致：
 * `overflowY ∈ auto|scroll|overlay` 且 `scrollHeight - clientHeight > 1`。
 *
 * @param element 待判定元素
 * @returns 是否纵向上可滚动
 */
export function isVerticallyScrollable(element: Element | null | undefined): boolean {
    if (!(element instanceof HTMLElement)) return false;
    const overflowY = getComputedStyle(element).overflowY;
    const overflowAllowed = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    return overflowAllowed && element.scrollHeight - element.clientHeight > 1;
}

/**
 * 在给定边界内查找目标项「自己的」滚动容器。
 *
 * 这是替代 `scrollIntoView` 的关键安全边界：**绝不越过 root**。
 * 集市场景下 TOC 挂在 `#configBazaarReadme` 面板内部，若沿用 `scrollIntoView`，
 * 祖先链上的面板/弹窗容器会被连带滚动；此处限定只认 root（`.floating-toc` 本体）
 * 以内的自滚动容器（展开态为 `.toc-content`，折叠态为 `.collapsed-strip`）。
 *
 * @param item 目标项元素（如 `.toc-item` / `.strip-item`）
 * @param root 回溯边界（通常为 TOC 根容器 `.floating-toc`）；到达即终止
 * @returns 目标项在边界内的自滚动容器；没有则返回 null（调用方据此 no-op）
 */
export function resolveOwnScroller(item: Element | null | undefined, root?: Element | null): HTMLElement | null {
    if (!item) return null;
    let node: HTMLElement | null = item.parentElement;

    while (node) {
        if (isVerticallyScrollable(node)) return node;
        // 到达边界仍未找到 → 立即停止，绝不向 outside root 的祖先扩散
        if (root && node === root) return null;
        node = node.parentElement;
    }
    return null;
}

/**
 * 计算目标元素相对滚动容器**内容原点**的偏移。
 *
 * 用 rect 差值而非 `offsetTop` 链：`offsetTop` 只相对最近的 `offsetParent`，
 * 在嵌套 `position: relative/absolute`（TOC 即为绝对定位）时容易算错；
 * rect 差值加上容器当前 scrollTop，得到内容与坐标系无关的绝对偏移。
 *
 * ⚠️ 包含性校验（必须）：rect 差值在「target 不在 scroller 子树内」时仍然成立为
 * 一个**纯视差数字**（两个无关元素的屏幕距离），而它与容器内容坐标系毫无关系；
 * 若把它当作偏移写进 scrollTop，会被钳制后**真实滚动到错误位置**（静默跳锚、比不滚更糟）。
 * 触发场景：宿主内含 ≥2 个 `.protyle-content`，解析出的 scroller 与 target 不同源。
 * 因此：target 不在 scroller 内 → **返回 null（绝不返回 0，0 会滚到顶部）**，调用方据此 no-op。
 *
 * @param target   目标元素
 * @param scroller 滚动容器
 * @returns 目标相对容器内容起点的偏移（px）；参数缺失或 target 不在 scroller 内时返回 null
 */
export function computeRelativeOffset(target: Element | null, scroller: Element | null): number | null {
    if (!target || !scroller) return null;
    if (!scroller.contains(target)) return null;
    const targetRect = target.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const currentScrollTop = (scroller as HTMLElement).scrollTop || 0;
    return (targetRect.top - scrollerRect.top) + currentScrollTop;
}

/**
 * 只滚动指定容器本身到给定偏移（不触碰任何祖先容器）。
 *
 * @param scroller 目标滚动容器（null → 直接返回 false，不做任何兜底）
 * @param offsetTop 期望的内容偏移
 * @param behavior  'smooth' 走 `scrollTo({behavior})`，'auto' 直接赋值 scrollTop
 * @returns 是否执行了滚动（容器不存在时为 false）
 */
export function scrollScrollerToOffset(
    scroller: HTMLElement | null,
    offsetTop: number,
    behavior: ScrollBehavior = 'auto'
): boolean {
    if (!(scroller instanceof HTMLElement)) return false;

    const top = clampScrollTop(offsetTop, scroller.scrollHeight, scroller.clientHeight);
    if (behavior !== 'auto' && typeof scroller.scrollTo === 'function') {
        try {
            scroller.scrollTo({ top, behavior });
            return true;
        } catch (error) {
            // 部分环境（含老版 jsdom）未实现 Element.scrollTo → 退回直接赋值
        }
    }
    scroller.scrollTop = top;
    return true;
}

/**
 * 「激活项跟随」的滚动实现：只在 TOC 自己内部滚动，绝不使用 `scrollIntoView`。
 *
 * @param item     目标项（`.toc-item` / `.strip-item`）
 * @param root     TOC 根容器 `container`（作为回溯边界）
 * @param mode     'center'（展开时定位）/ 'nearest'（滚动跟随）
 * @param behavior 默认 'auto'（即时）；传 'smooth' 可保持原有平滑观感
 * @returns 是否命中了自滚动容器并执行滚动
 */
export function scrollItemWithinOwnScroller(
    item: Element | null | undefined,
    root?: Element | null,
    mode: ItemScrollMode = 'nearest',
    behavior: ScrollBehavior = 'auto'
): boolean {
    if (!item) return false;
    const scroller = resolveOwnScroller(item, root);
    if (!scroller) return false;

    // scroller 是沿 item 的 parentElement 链找到的，理论上必包含 item；
    // 仍显式处理返回 null 的情形（防御：绝不把无效偏移喂给滚动量计算）。
    const itemOffsetTop = computeRelativeOffset(item, scroller);
    if (itemOffsetTop === null) return false;

    const target = computeItemScrollTop({
        containerScrollTop: scroller.scrollTop || 0,
        containerHeight: scroller.clientHeight,
        itemOffsetTop,
        itemHeight: (item as HTMLElement).getBoundingClientRect().height,
        containerScrollHeight: scroller.scrollHeight,
        mode
    });

    // 目标值未变化（差值在亚像素内）→ 不产生写操作，避免无意义的 scroll 事件抖动
    if (Math.abs(target - (scroller.scrollTop || 0)) < 0.5) return true;
    return scrollScrollerToOffset(scroller, target, behavior);
}

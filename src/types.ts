/**
 * 思源笔记浮动目录插件 - 类型定义
 * 参考官方 petal 类型定义
 */

// ============================================
// 插件配置类型
// ============================================

/**
 * 插件配置类型定义
 */
export interface PluginConfig {
    dockSide: 'left' | 'right';
    isPinned: boolean;
    tocWidth: number;
    followFocus: boolean;
    miniTocWidth: number;
    adaptiveHeight: boolean;
    toolbarConfig: ToolbarAction[];
    customCss?: string;
    fullscreenConfig: FullscreenConfig;
}

export type ToolbarAction = 
    | 'scrollToTop' 
    | 'scrollToBottom' 
    | 'refreshDoc' 
    | 'togglePin' 
    | 'toggleDockSide' 
    | 'collapseAll' 
    | 'expandAll';

export interface FullscreenConfig {
    enableFullscreenHelper: boolean;
    enableMermaid: boolean;
    enableECharts: boolean;
    enableSheetMusic: boolean;
    enableGraphviz: boolean;
    enableFlowchart: boolean;
    enableIFrame: boolean;
    enableDoubleClick: boolean;
    buttonPosition: 'top-right' | 'top-left';
}

// ============================================
// 大纲相关类型
// ============================================

/**
 * 标题项类型（用于 TOC 显示）
 */
export interface Heading {
    id: string;
    content: string;
    depth: number;
    subType?: string;
    element?: HTMLElement | null;
}

/**
 * API 返回的大纲项类型
 * 参考 /api/outline/getDocOutline 返回格式
 */
export interface IOutlineItem {
    id: string;
    name?: string;
    content?: string;
    type?: string;
    subType?: string;
    subtype?: string;  // 兼容不同版本
    depth?: number;
    count?: number;
    children?: IOutlineItem[];
    blocks?: IOutlineItem[];  // 兼容不同版本
}

// ============================================
// Protyle 相关类型
// ============================================

/**
 * Protyle 块信息
 */
export interface IProtyleBlock {
    id?: string;
    rootID?: string;
    parentID?: string;
    showAll?: boolean;
    scroll?: boolean;
    mode?: number;
    blockCount?: number;
    action?: string[];
}

/**
 * 思源笔记 Protyle 接口
 * 参考官方 protyle.d.ts
 */
export interface IProtyle {
    element: HTMLElement;
    block?: IProtyleBlock;
    contentElement?: HTMLElement;
    disabled?: boolean;
    preview?: {
        element: HTMLElement;
    };
    wysiwyg?: {
        element: HTMLElement;
    };
    reload?: (keepCursor?: boolean) => void;
    getInstance?: () => IProtyle;
}

// ============================================
// API 相关类型
// ============================================

/**
 * API 响应基础结构
 */
export interface IApiResponse<T = any> {
    code: number;
    msg: string;
    data: T;
}

/**
 * WebSocket 数据结构
 * 参考官方 index.d.ts
 */
export interface IWebSocketData {
    cmd?: string;
    callback?: string;
    data?: {
        rootID?: string;
        sources?: Array<{
            doOperations?: IOperation[];
            undoOperations?: IOperation[];
        }>;
        [key: string]: any;
    };
    msg?: string;
    code?: number;
    sid?: string;
}

/**
 * 操作类型
 */
export type TOperation = 
    | 'insert' 
    | 'update' 
    | 'delete' 
    | 'move' 
    | 'foldHeading' 
    | 'unfoldHeading'
    | 'setAttrs'
    | 'updateAttrs';

/**
 * 块操作接口
 */
export interface IOperation {
    action: TOperation | string;
    id?: string;
    data?: string;
    parentID?: string;
    previousID?: string;
    nextID?: string;
    retData?: any;
    srcIDs?: string[];
    name?: string;
    type?: string;
}

/**
 * 文档信息
 */
export interface IDocInfo {
    id: string;
    rootID: string;
    name: string;
    icon?: string;
    ial?: Record<string, string>;
    refCount?: number;
    refIDs?: string[];
    subFileCount?: number;
}

// ============================================
// 事件相关类型
// ============================================

/**
 * 支持的事件总线事件类型
 */
export type TEventBus = 
    | 'switch-protyle'
    | 'loaded-protyle'
    | 'loaded-protyle-static'
    | 'loaded-protyle-dynamic'
    | 'destroy-protyle'
    | 'update-block'
    | 'ws-main'
    | 'click-blockicon'
    | 'click-editorcontent'
    | 'open-menu-doctree'
    | 'open-menu-blockref'
    | 'paste';

/**
 * Protyle 事件详情
 */
export interface IProtyleEvent {
    protyle: IProtyle;
}

// ============================================
// 全局类型声明
// ============================================

/**
 * 思源笔记全局对象接口
 */
export interface ISiyuanGlobal {
    config?: {
        editor?: {
            fullWidth?: boolean;
        };
        appearance?: {
            lang?: string;
        };
    };
    languages?: Record<string, any>;
    user?: {
        userId?: string;
    };
}

declare global {
    interface Window {
        siyuan?: ISiyuanGlobal;
    }
}

// ============================================
// 常量定义
// ============================================

/**
 * 时间常量（毫秒）
 */
export const TIMING = {
    /** 搜索预览检查间隔 */
    SEARCH_PREVIEW_CHECK_INTERVAL: 800,
    /** 防抖延迟 */
    DEBOUNCE_DELAY: 150,
    /** 搜索更新延迟 */
    SEARCH_UPDATE_DELAY: 300,
    /** 历史更新延迟 */
    HISTORY_UPDATE_DELAY: 300,
    /** 搜索预览重试延迟 */
    SEARCH_PREVIEW_RETRY_DELAY: 200,
    /** 文档切换更新延迟 */
    SWITCH_PROTYLE_DELAY: 300
} as const;

/**
 * MutationObserver 配置
 */
export const MUTATION_OBSERVER_CONFIG: MutationObserverInit = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-loading', 'data-node-id', 'data-root-id']
};

/**
 * 默认插件配置
 */
export const DEFAULT_CONFIG: PluginConfig = {
    dockSide: "right",
    isPinned: false,
    tocWidth: 250,
    followFocus: true,
    miniTocWidth: 32,
    adaptiveHeight: true,
    toolbarConfig: ["scrollToTop", "scrollToBottom", "refreshDoc"],
    fullscreenConfig: {
        enableFullscreenHelper: true,
        enableMermaid: true,
        enableECharts: true,
        enableSheetMusic: true,
        enableGraphviz: true,
        enableFlowchart: true,
        enableIFrame: true,
        enableDoubleClick: true,
        buttonPosition: "top-left"
    }
};

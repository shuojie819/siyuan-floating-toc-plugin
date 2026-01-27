/**
 * 事件处理模块
 * 负责注册和管理插件的事件监听器
 */

import { getSearchPreviewHosts, getHistoryPreviewHosts, isHistoryHost } from "../utils/domUtils";
import { DocIdResolver } from "./docIdResolver";
import { parseWsTransactions } from "../api";
import type { IWebSocketData, IProtyle } from "../types";
import { TIMING } from "../types";
import type FloatingTocPlugin from "../index";
import type FloatingToc from "../FloatingToc.svelte";

/**
 * 事件处理器类
 * 管理插件的所有事件监听
 */
export class EventHandlers {
    private plugin: FloatingTocPlugin;
    private searchPreviewCheckInterval: number | undefined;
    private searchUpdateTimer: number | undefined;
    private historyUpdateTimer: number | undefined;
    private switchProtyleUpdateTimer: number | undefined;
    
    // 预绑定的事件处理函数（避免 bind 导致的内存泄漏）
    private boundHandlers = {
        switchProtyle: null as ((event: CustomEvent<any>) => void) | null,
        blockUpdate: null as ((event: CustomEvent<any>) => void) | null,
        wsMain: null as ((event: CustomEvent<any>) => void) | null,
        loadedProtyle: null as ((event: CustomEvent<any>) => void) | null,
        searchListClick: null as ((event: MouseEvent) => void) | null,
        keydown: null as ((event: KeyboardEvent) => void) | null
    };

    constructor(plugin: FloatingTocPlugin) {
        this.plugin = plugin;
        
        // 预绑定所有事件处理函数
        this.boundHandlers.switchProtyle = this.onSwitchProtyle.bind(this);
        this.boundHandlers.blockUpdate = this.handleBlockUpdate.bind(this);
        this.boundHandlers.wsMain = this.handleWsMain.bind(this);
        this.boundHandlers.loadedProtyle = this.onLoadedProtyle.bind(this);
        this.boundHandlers.searchListClick = this.handleSearchListItemClick.bind(this);
        this.boundHandlers.keydown = this.handleGlobalKeydown.bind(this);
    }

    /**
     * 注册所有事件监听器
     */
    register(): void {
        this.plugin.eventBus.on("switch-protyle", this.boundHandlers.switchProtyle!);
        this.plugin.eventBus.on("update-block", this.boundHandlers.blockUpdate!);
        this.plugin.eventBus.on("ws-main", this.boundHandlers.wsMain!);
        this.plugin.eventBus.on("loaded-protyle", this.boundHandlers.loadedProtyle!);
        
        // 添加全局键盘监听
        document.addEventListener('keydown', this.boundHandlers.keydown!);
        
        // 为现有的搜索列表添加事件监听
        document.querySelectorAll('.search__list').forEach(list => {
            this.addSearchListItemListeners(list as HTMLElement);
        });
    }

    /**
     * 注销所有事件监听器
     */
    unregister(): void {
        if (this.boundHandlers.switchProtyle) {
            this.plugin.eventBus.off("switch-protyle", this.boundHandlers.switchProtyle);
        }
        if (this.boundHandlers.blockUpdate) {
            this.plugin.eventBus.off("update-block", this.boundHandlers.blockUpdate);
        }
        if (this.boundHandlers.wsMain) {
            this.plugin.eventBus.off("ws-main", this.boundHandlers.wsMain);
        }
        if (this.boundHandlers.loadedProtyle) {
            this.plugin.eventBus.off("loaded-protyle", this.boundHandlers.loadedProtyle);
        }
        
        // 移除全局键盘监听
        if (this.boundHandlers.keydown) {
            document.removeEventListener('keydown', this.boundHandlers.keydown);
        }
        
        // 清理所有定时器
        this.clearAllTimers();
    }

    /**
     * 清理所有定时器
     */
    private clearAllTimers(): void {
        if (this.searchUpdateTimer) {
            clearTimeout(this.searchUpdateTimer);
            this.searchUpdateTimer = undefined;
        }
        if (this.historyUpdateTimer) {
            clearTimeout(this.historyUpdateTimer);
            this.historyUpdateTimer = undefined;
        }
        if (this.switchProtyleUpdateTimer) {
            clearTimeout(this.switchProtyleUpdateTimer);
            this.switchProtyleUpdateTimer = undefined;
        }
        if (this.searchPreviewCheckInterval) {
            clearInterval(this.searchPreviewCheckInterval);
            this.searchPreviewCheckInterval = undefined;
        }
    }

    /**
     * 开始周期性检查搜索预览的 TOC 更新
     */
    startSearchPreviewCheck(): void {
        this.searchPreviewCheckInterval = window.setInterval(() => {
            this.checkSearchPreviewTOC();
            this.checkHistoryPreviewTOC();
        }, TIMING.SEARCH_PREVIEW_CHECK_INTERVAL);
    }

    /**
     * 停止周期性检查
     */
    stopSearchPreviewCheck(): void {
        if (this.searchPreviewCheckInterval) {
            clearInterval(this.searchPreviewCheckInterval);
            this.searchPreviewCheckInterval = undefined;
        }
    }

    /**
     * 检查搜索预览的 TOC 是否需要更新
     */
    private checkSearchPreviewTOC(): void {
        const searchHosts = getSearchPreviewHosts();
        searchHosts.forEach((protyleElement) => {
            const docId = DocIdResolver.getDocIdFromProtyleElement(protyleElement);
            if (!docId) return;
            this.updateTocForHost(protyleElement, docId, (protyleElement as any).protyle);
        });
    }

    /**
     * 检查历史预览的 TOC 是否需要更新
     */
    private checkHistoryPreviewTOC(): void {
        const historyHosts = getHistoryPreviewHosts();
        historyHosts.forEach((protyleElement) => {
            let docId = DocIdResolver.getDocIdFromProtyleElement(protyleElement);
            if (!docId && isHistoryHost(protyleElement)) {
                docId = "history";
            }
            if (!docId) return;
            this.updateTocForHost(protyleElement, docId, (protyleElement as any).protyle);
        });
    }

    /**
     * 处理搜索结果切换事件
     */
    handleSearchResultChange(): void {
        const searchHosts = getSearchPreviewHosts();
        searchHosts.forEach((protyleElement) => {
            const rootId = DocIdResolver.getDocIdFromProtyleElement(protyleElement);
            if (!rootId) return;
            this.updateTocForHost(protyleElement, rootId, (protyleElement as any).protyle);
        });
    }

    /**
     * 处理历史结果切换事件
     */
    handleHistoryResultChange(): void {
        const historyHosts = getHistoryPreviewHosts();
        if (historyHosts.length === 0) {
            return;
        }
        historyHosts.forEach((protyleElement) => {
            let docId = DocIdResolver.getDocIdFromProtyleElement(protyleElement);
            if (!docId && isHistoryHost(protyleElement)) {
                docId = "history";
            }
            if (!docId) return;
            this.updateTocForHost(protyleElement, docId, (protyleElement as any).protyle);
        });
    }

    /**
     * 调度搜索更新（使用防抖）
     */
    scheduleSearchUpdate(): void {
        if (this.searchUpdateTimer) {
            clearTimeout(this.searchUpdateTimer);
        }
        // 立即执行一次
        this.handleSearchResultChange();
        // 延迟再执行一次确保内容加载完成
        this.searchUpdateTimer = window.setTimeout(() => {
            this.handleSearchResultChange();
            this.searchUpdateTimer = undefined;
        }, TIMING.SEARCH_UPDATE_DELAY);
    }

    /**
     * 调度历史更新（使用防抖）
     */
    scheduleHistoryUpdate(): void {
        if (this.historyUpdateTimer) {
            clearTimeout(this.historyUpdateTimer);
        }
        this.handleHistoryResultChange();
        this.historyUpdateTimer = window.setTimeout(() => {
            this.handleHistoryResultChange();
            this.historyUpdateTimer = undefined;
        }, TIMING.HISTORY_UPDATE_DELAY);
    }

    /**
     * 处理 protyle 加载完成事件
     */
    private onLoadedProtyle(event: CustomEvent<any>): void {
        const protyle = event.detail.protyle;
        if (protyle && protyle.element) {
            const isSearchPreview = protyle.element.closest(".search__preview, .search__doc") !== null;
            
            let toc = this.plugin.tocInstances.get(protyle.element);
            let resolvedDocId = DocIdResolver.getDocIdFromProtyleElement(protyle.element, protyle);
            if (!resolvedDocId && isHistoryHost(protyle.element)) {
                resolvedDocId = "history";
            }
            const prevDocId = this.plugin.tocDocIds.get(protyle.element);
            const docKey = resolvedDocId ? DocIdResolver.getDocKeyForHost(protyle.element, resolvedDocId) : "";
            const hadToc = !!toc;
            
            if (!toc) {
                if (resolvedDocId) {
                    this.plugin.createToc(protyle.element, resolvedDocId);
                    toc = this.plugin.tocInstances.get(protyle.element);
                }
            }
            
            if (toc && resolvedDocId && hadToc && prevDocId !== docKey) {
                this.updateTocForHost(protyle.element, resolvedDocId, protyle, true);
                
                if (isSearchPreview) {
                    setTimeout(() => {
                        const finalDocId = DocIdResolver.getDocIdFromProtyleElement(protyle.element, protyle);
                        if (finalDocId) {
                            this.updateTocForHost(protyle.element, finalDocId, protyle, true);
                        }
                    }, TIMING.SEARCH_PREVIEW_RETRY_DELAY);
                }
            }
        }
    }

    /**
     * 处理文档切换事件
     */
    private onSwitchProtyle(event: CustomEvent<any>): void {
        const protyle = event.detail.protyle;
        if (protyle && protyle.element) {
            // 立即尝试更新
            this.handleSwitchProtyleUpdate(protyle);
            
            // 使用单个调度器代替多个 setTimeout
            if (this.switchProtyleUpdateTimer) {
                clearTimeout(this.switchProtyleUpdateTimer);
            }
            this.switchProtyleUpdateTimer = window.setTimeout(() => {
                this.handleSwitchProtyleUpdate(protyle);
                this.switchProtyleUpdateTimer = undefined;
            }, TIMING.SWITCH_PROTYLE_DELAY);
        }
    }

    /**
     * 处理文档切换更新
     */
    private handleSwitchProtyleUpdate(protyle: any): void {
        if (!protyle || !protyle.element) return;
        
        let toc = this.plugin.tocInstances.get(protyle.element);
        const docId = DocIdResolver.getDocIdFromProtyleElement(protyle.element, protyle);
        
        if (!toc) {
            if (docId) {
                this.plugin.createToc(protyle.element, docId);
                toc = this.plugin.tocInstances.get(protyle.element);
            }
        }
        
        if (toc && docId) {
            // 强制更新，确保聚焦模式切换时能刷新大纲
            toc.updateHeadings(docId, protyle);
            this.plugin.tocDocIds.set(protyle.element, DocIdResolver.getDocKeyForHost(protyle.element, docId));
        }
    }

    /**
     * 处理 WebSocket 消息
     * 参考思源笔记官方实现：siyuan/app/src/layout/dock/Outline.ts
     */
    private handleWsMain(event: CustomEvent<IWebSocketData>): void {
        const data = event.detail;
        if (!data) return;

        // 处理 savedoc/transactions 命令（文档保存/更新）
        if (data.cmd === "savedoc" || data.cmd === "transactions") {
            // 使用 API 层解析事务数据
            const parsed = parseWsTransactions(data);
            
            // 遍历所有 TOC 实例
            this.plugin.tocInstances.forEach((toc, hostElement) => {
                const docId = DocIdResolver.getDocIdFromProtyleElement(hostElement);
                if (!docId) return;

                // 获取当前 protyle 的文档 rootID
                const protyleObj = (hostElement as any).protyle as IProtyle | undefined;
                const fileRootId = protyleObj?.block?.rootID || docId;

                // 检查 rootID 是否匹配（过滤不相关的更新）
                if (parsed.rootID && parsed.rootID !== fileRootId) {
                    return;
                }

                // 检查是否有标题变更
                let needReload = parsed.hasHeadingChange;
                
                // 额外检查：通过 DOM 验证删除/移动操作是否涉及标题
                if (!needReload) {
                    for (const op of parsed.operations) {
                        if (op.action === "delete" || op.action === "move") {
                            // 检查该 ID 是否在当前大纲中
                            if (typeof (toc as any).hasHeading === "function" && 
                                (toc as any).hasHeading(op.id)) {
                                needReload = true;
                                break;
                            }
                            // 检查 DOM 中是否有该标题
                            const block = hostElement.querySelector(`[data-node-id="${op.id}"]`);
                            if (block?.getAttribute("data-type") === "NodeHeading") {
                                needReload = true;
                                break;
                            }
                        }
                    }
                }

                if (needReload) {
                    toc.updateHeadings(docId, { element: hostElement });
                    this.plugin.tocDocIds.set(hostElement, DocIdResolver.getDocKeyForHost(hostElement, docId));
                }
            });
        }
    }

    /**
     * 处理块更新事件
     */
    private handleBlockUpdate(event: CustomEvent<any>): void {
        const data = event.detail;
        
        // 遍历所有活跃的 TOC 实例，检查它们是否需要更新
        this.plugin.tocInstances.forEach((toc, hostElement) => {
            const docId = DocIdResolver.getDocIdFromProtyleElement(hostElement);
            if (!docId) return;

            let shouldUpdate = false;
            
            if (data && data.id) {
                // 尝试查找块是否存在于当前 protyle 中
                const blockInHost = hostElement.querySelector(`[data-node-id="${data.id}"]`);
                if (blockInHost) {
                    shouldUpdate = true;
                }
            } else {
                // 如果没有特定 id，可能是通用更新，建议刷新
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                toc.updateHeadings(docId, { element: hostElement });
                this.plugin.tocDocIds.set(hostElement, DocIdResolver.getDocKeyForHost(hostElement, docId));
            }
        });
    }

    /**
     * 为搜索列表项添加点击事件监听
     */
    addSearchListItemListeners(searchList: HTMLElement): void {
        // 使用预绑定的处理函数
        searchList.removeEventListener('click', this.boundHandlers.searchListClick!);
        searchList.addEventListener('click', this.boundHandlers.searchListClick!);
    }

    /**
     * 处理搜索列表项点击事件
     */
    private handleSearchListItemClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const listItem = target.closest('.b3-list-item');
        if (listItem) {
            // 使用单次延迟调用代替多次调用
            this.scheduleSearchUpdate();
        }
    }

    /**
     * 处理全局键盘事件
     */
    private handleGlobalKeydown(event: KeyboardEvent): void {
        // 检查是否在搜索对话框中
        const activeDialog = document.querySelector('.b3-dialog--open[data-key="dialog-globalsearch"]');
        if (activeDialog && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key)) {
            this.scheduleSearchUpdate();
        }
    }

    /**
     * 更新指定主机的 TOC
     */
    private updateTocForHost(host: HTMLElement, docId: string, protyle?: any, force: boolean = false): void {
        const docKey = DocIdResolver.getDocKeyForHost(host, docId);
        const lastDocId = this.plugin.tocDocIds.get(host);
        let toc = this.plugin.tocInstances.get(host);
        if (toc && !force && lastDocId === docKey) {
            return;
        }
        if (toc) {
            toc.updateHeadings(docId, protyle || { element: host });
        } else {
            this.plugin.createToc(host, docId);
            toc = this.plugin.tocInstances.get(host);
        }
        if (toc) {
            this.plugin.tocDocIds.set(host, docKey || docId);
        }
    }
}

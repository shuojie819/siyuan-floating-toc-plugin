/**
 * Protyle 管理模块
 * 负责监控和管理 protyle 实例及其对应的 TOC
 */

import {
    getTocHostElement,
    isHistoryHost,
    isBreadcrumbElement,
    isProtyleRelatedElement,
    isSearchResultItem,
    isHistoryRelatedElement,
    isSearchAttributeChanged,
    isHistoryAttributeChanged,
    shouldShowToc
} from "../utils/domUtils";
import { DocIdResolver } from "./docIdResolver";
import { TIMING, MUTATION_OBSERVER_CONFIG } from "../types";
import type FloatingTocPlugin from "../index";
import FloatingToc from "../FloatingToc.svelte";

/**
 * Protyle 管理器类
 * 管理所有 protyle 实例的 TOC 组件
 */
export class ProtyleManager {
    private plugin: FloatingTocPlugin;
    private observer: MutationObserver | undefined;
    private checkProtylesDebounceTimer: number | undefined;
    private clickDelegationHandler: ((event: MouseEvent) => void) | null = null;

    constructor(plugin: FloatingTocPlugin) {
        this.plugin = plugin;
    }

    /**
     * 监控 protyle 实例的创建和销毁
     */
    monitorProtyles(): void {
        const targetNode = document.body;
        
        this.observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            let searchResultChanged = false;
            let historyResultChanged = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    if (mutation.target instanceof HTMLElement) {
                        if (isBreadcrumbElement(mutation.target)) {
                            shouldCheck = true;
                        }
                    }

                    for (const node of mutation.addedNodes) {
                        if (node instanceof HTMLElement) {
                            if (isProtyleRelatedElement(node)) {
                                shouldCheck = true;
                            }
                            if (node.classList.contains('search__list')) {
                                this.plugin.eventHandlers.addSearchListItemListeners(node);
                                searchResultChanged = true;
                            }
                            if (isSearchResultItem(node)) {
                                searchResultChanged = true;
                            }
                            if (isHistoryRelatedElement(node)) {
                                shouldCheck = true;
                                historyResultChanged = true;
                            }
                            if (node.classList.contains('b3-list-item') &&
                                node.closest('.history__side, .history__list, .history__repo')) {
                                historyResultChanged = true;
                            }
                        }
                    }
                    for (const node of mutation.removedNodes) {
                        if (node instanceof HTMLElement) {
                            if (isProtyleRelatedElement(node)) {
                                shouldCheck = true;
                            }
                        }
                    }
                } else if (mutation.type === 'attributes') {
                    if (mutation.target instanceof HTMLElement) {
                        if (isSearchAttributeChanged(mutation.target, mutation.attributeName)) {
                            searchResultChanged = true;
                            shouldCheck = true;
                        }
                        if (isHistoryAttributeChanged(mutation.target, mutation.attributeName)) {
                            historyResultChanged = true;
                            shouldCheck = true;
                        }
                        if (mutation.target.classList.contains('protyle') &&
                            mutation.attributeName === 'data-loading') {
                            searchResultChanged = true;
                            shouldCheck = true;
                        }
                    }
                }
            }
            
            if (shouldCheck) {
                this.debouncedCheckProtyles();
            }
            
            // 使用调度器代替多次 setTimeout
            if (searchResultChanged) {
                this.plugin.eventHandlers.scheduleSearchUpdate();
            }
            if (historyResultChanged) {
                this.plugin.eventHandlers.scheduleHistoryUpdate();
            }
        });
        
        this.observer.observe(targetNode, MUTATION_OBSERVER_CONFIG);
        
        // 设置点击事件委托
        this.setupClickDelegation();
    }

    /**
     * 设置点击事件委托
     */
    private setupClickDelegation(): void {
        this.clickDelegationHandler = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            // 搜索预览区域点击
            if (target.closest('.search__preview, .search__doc')) {
                this.plugin.eventHandlers.scheduleSearchUpdate();
            }
            
            // 历史列表点击
            if (target.closest('.history__side, .history__list, .history__repo')) {
                this.plugin.eventHandlers.scheduleHistoryUpdate();
            }
        };
        
        document.body.addEventListener('click', this.clickDelegationHandler);
    }

    /**
     * 防抖检查 protyle 实例
     */
    debouncedCheckProtyles(): void {
        if (this.checkProtylesDebounceTimer) {
            clearTimeout(this.checkProtylesDebounceTimer);
        }
        this.checkProtylesDebounceTimer = window.setTimeout(() => {
            this.checkProtyles();
            this.checkProtylesDebounceTimer = undefined;
        }, TIMING.DEBOUNCE_DELAY);
    }

    /**
     * 检查所有 protyle 实例，创建或销毁对应的 TOC
     */
    checkProtyles(): void {
        const candidates = Array.from(document.querySelectorAll(
            ".protyle, .search__preview, .search__doc, .history__text, .history__text .protyle, [data-type='docPanel'].history__text"
        ));
        const hostSet = new Set<HTMLElement>();
        candidates.forEach((candidate) => {
            if (!(candidate instanceof HTMLElement)) return;
            const host = getTocHostElement(candidate);
            if (host && shouldShowToc(host)) hostSet.add(host);
        });
        const protyles = Array.from(hostSet);
        
        protyles.forEach((p: HTMLElement) => {
            const content = p.querySelector(".protyle-content") || p.querySelector(".protyle-wysiwyg");
            if (!content) return;
            
            let docId = DocIdResolver.getDocIdFromProtyleElement(p);
            if (!docId && isHistoryHost(p)) {
                docId = "history";
            }
            if (!docId) return;
            
            if (!this.plugin.tocInstances.has(p)) {
                this.plugin.createToc(p, docId);
            } else {
                const lastDocId = this.plugin.tocDocIds.get(p);
                const docKey = DocIdResolver.getDocKeyForHost(p, docId);
                if (docKey !== lastDocId) {
                    this.updateTocForHost(p, docId, (p as any).protyle);
                }
            }
        });

        // 清理已移除的 protyle 实例
        for (const [p, toc] of this.plugin.tocInstances.entries()) {
            if (!document.contains(p)) {
                toc.$destroy();
                this.plugin.tocInstances.delete(p);
                this.plugin.tocDocIds.delete(p);
            }
        }
    }

    /**
     * 创建 TOC 实例
     */
    createToc(protyleElement: HTMLElement, docId: string): void {
        // 创建容器
        const container = document.createElement("div");
        container.className = "siyuan-floating-toc-plugin-container";
        protyleElement.appendChild(container);

        const config = this.plugin.data["config.json"] || {};
        const dockSide = (config.dockSide === "left" || config.dockSide === "right") ? config.dockSide : "right";
        const followFocus = config.followFocus !== false;
        const adaptiveHeight = config.adaptiveHeight === true;
        const miniTocWidth = config.miniTocWidth || 32;
        const toolbarConfig = config.toolbarConfig || ["scrollToTop", "scrollToBottom", "refreshDoc"];

        // 创建 TOC 组件
        const toc = new FloatingToc({
            target: container,
            props: {
                plugin: this.plugin,
                targetElement: protyleElement,
                dockSide: dockSide,
                followFocus: followFocus,
                adaptiveHeight: adaptiveHeight,
                miniTocWidth: miniTocWidth,
                toolbarConfig: toolbarConfig
            }
        });
        
        if (typeof (toc as any).setVisible === "function") {
            (toc as any).setVisible(this.plugin.tocVisible);
        }

        // 初始化数据
        const protyleObj = (protyleElement as any).protyle || { element: protyleElement };
        toc.updateHeadings(docId, protyleObj);
        this.plugin.tocDocIds.set(protyleElement, DocIdResolver.getDocKeyForHost(protyleElement, docId));
        
        this.plugin.tocInstances.set(protyleElement, toc);
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
            this.createToc(host, docId);
            toc = this.plugin.tocInstances.get(host);
        }
        if (toc) {
            this.plugin.tocDocIds.set(host, docKey || docId);
        }
    }

    /**
     * 切换 TOC 显示状态
     */
    toggleTocVisibility(visible: boolean): void {
        this.plugin.tocInstances.forEach((toc) => {
            if (typeof (toc as any).setVisible === "function") {
                (toc as any).setVisible(visible);
            } else if (typeof (toc as any).toggle === "function") {
                (toc as any).toggle();
            }
        });
    }

    /**
     * 清理所有资源
     */
    cleanup(): void {
        // 清理 MutationObserver
        if (this.observer) {
            this.observer.disconnect();
            this.observer = undefined;
        }
        
        // 清理防抖定时器
        if (this.checkProtylesDebounceTimer) {
            clearTimeout(this.checkProtylesDebounceTimer);
            this.checkProtylesDebounceTimer = undefined;
        }
        
        // 移除点击事件委托
        if (this.clickDelegationHandler) {
            document.body.removeEventListener('click', this.clickDelegationHandler);
            this.clickDelegationHandler = null;
        }
        
        // 清理所有 TOC 实例
        this.plugin.tocInstances.forEach((toc) => {
            toc.$destroy();
        });
        this.plugin.tocInstances.clear();
        this.plugin.tocDocIds.clear();
    }
}

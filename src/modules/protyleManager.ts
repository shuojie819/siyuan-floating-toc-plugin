/**
 * Protyle 管理模块
 * 负责监控和管理 protyle 实例及其对应的 TOC
 */

import {
    getTocHostElement,
    isHistoryHost,
    isBazaarHost,
    isBreadcrumbElement,
    isProtyleRelatedElement,
    isSearchResultItem,
    isHistoryRelatedElement,
    isSearchAttributeChanged,
    isHistoryAttributeChanged,
    shouldShowToc,
    isCoveredByBazaar,
    isAiOrChatPanel
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
            let bazaarChanged = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    if (mutation.target instanceof HTMLElement) {
                        if (isBreadcrumbElement(mutation.target)) {
                            shouldCheck = true;
                        }
                        // 监听集市页面的显示
                        if (mutation.target.id === 'configBazaarReadme' ||
                            mutation.target.classList.contains('config-bazaar__readme')) {
                            bazaarChanged = true;
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
                            // 监听集市页面元素的添加
                            if (node.id === 'configBazaarReadme' ||
                                node.classList.contains('config-bazaar__readme') ||
                                node.classList.contains('item__readme')) {
                                bazaarChanged = true;
                                shouldCheck = true;
                            }
                        }
                    }
                    for (const node of mutation.removedNodes) {
                        if (node instanceof HTMLElement) {
                            if (isProtyleRelatedElement(node)) {
                                shouldCheck = true;
                            }
                            // 监听集市页面元素的移除
                            if (node.id === 'configBazaarReadme' ||
                                node.classList.contains('config-bazaar__readme')) {
                                bazaarChanged = true;
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
                        // 监听集市页面的显示类变化
                        if (mutation.target.id === 'configBazaarReadme' &&
                            mutation.attributeName === 'class') {
                            bazaarChanged = true;
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
            
            // 集市页面点击 - 点击卡片时触发
            if (target.closest('.b3-card') || target.closest('#configBazaarReadme')) {
                // 延迟检查，等待 README 内容加载
                setTimeout(() => {
                    this.checkProtyles();
                }, 100);
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
            ".protyle, .search__preview, .search__doc, .history__text, .history__text .protyle, [data-type='docPanel'].history__text, #configBazaarReadme, .config-bazaar__readme, .config-bazaar__panel, .item__readme"
        ));
        const hostSet = new Set<HTMLElement>();
        candidates.forEach((candidate) => {
            if (!(candidate instanceof HTMLElement)) return;
            const host = getTocHostElement(candidate);
            if (host && shouldShowToc(host)) hostSet.add(host);
        });
        const protyles = Array.from(hostSet);
        
        protyles.forEach((p: HTMLElement) => {
            const content = p.querySelector(".protyle-content") || 
                           p.querySelector(".protyle-wysiwyg") ||
                           p.querySelector(".item__readme") ||
                           p.querySelector(".b3-typography");
            if (!content) return;
            
            let docId = DocIdResolver.getDocIdFromProtyleElement(p);
            if (!docId && isHistoryHost(p)) {
                docId = "history";
            }
            if (!docId && isBazaarHost(p)) {
                docId = "bazaar";
            }
            if (!docId) return;
            
            // 检查 TOC 实例是否有效（检查容器内是否有 .floating-toc 元素）
            const existingToc = this.plugin.tocInstances.get(p);
            let hasValidTocDom = false;
            
            if (existingToc) {
                // 对于集市场景，检查 body 中的容器
                if (isBazaarHost(p)) {
                    const bazaarContainer = document.querySelector(
                        '.siyuan-floating-toc-plugin-container[data-bazaar="true"]'
                    );
                    hasValidTocDom = !!(bazaarContainer?.querySelector('.floating-toc'));
                } else {
                    // 对于普通文档，检查 protyle 内的容器
                    const container = p.querySelector('.siyuan-floating-toc-plugin-container');
                    hasValidTocDom = !!(container?.querySelector('.floating-toc'));
                }
            }
            
            if (!existingToc || !hasValidTocDom) {
                // 清理无效的实例记录
                if (existingToc) {
                    this.plugin.tocInstances.delete(p);
                    this.plugin.tocDocIds.delete(p);
                }
                this.plugin.createToc(p, docId);
            } else {
                const lastDocId = this.plugin.tocDocIds.get(p);
                const docKey = DocIdResolver.getDocKeyForHost(p, docId);
                if (docKey !== lastDocId) {
                    this.updateTocForHost(p, docId, (p as any).protyle);
                }
            }
        });

        // 清理已移除的 protyle 实例或被集市面板覆盖的 TOC
        for (const [p, toc] of this.plugin.tocInstances.entries()) {
            if (!document.contains(p) || isCoveredByBazaar(p) || isAiOrChatPanel(p)) {
                toc.$destroy();
                this.plugin.tocInstances.delete(p);
                this.plugin.tocDocIds.delete(p);
            }
        }
        
        // 清理孤立的集市容器
        document.querySelectorAll('.siyuan-floating-toc-plugin-container[data-bazaar="true"]').forEach(container => {
            const host = (container as any)._tocHost;
            if (!host || !document.contains(host)) {
                const toc = this.plugin.tocInstances.get(host);
                if (toc) {
                    toc.$destroy();
                    this.plugin.tocInstances.delete(host);
                    this.plugin.tocDocIds.delete(host);
                }
                container.remove();
            }
        });
    }

    /**
     * 创建 TOC 实例
     */
    createToc(protyleElement: HTMLElement, docId: string): void {
        const isBazaar = isBazaarHost(protyleElement);
        
        // 如果是集市场景，先清理所有旧的集市容器
        if (isBazaar) {
            document.querySelectorAll('.siyuan-floating-toc-plugin-container[data-bazaar="true"]').forEach(container => {
                const host = (container as any)._tocHost;
                const toc = this.plugin.tocInstances.get(host);
                if (toc) {
                    toc.$destroy();
                    this.plugin.tocInstances.delete(host);
                    this.plugin.tocDocIds.delete(host);
                }
                container.remove();
            });
        }
        
        const container = document.createElement("div");
        container.className = "siyuan-floating-toc-plugin-container";
        
        if (isBazaar) {
            container.dataset.bazaar = "true";
            (container as any)._tocHost = protyleElement;
            document.body.appendChild(container);
        } else {
            protyleElement.appendChild(container);
        }

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
                overlayMode: config.overlayMode === true,
                smoothScroll: config.smoothScroll !== false,
                miniTocWidth: miniTocWidth,
                toolbarConfig: toolbarConfig,
                isBazaar: isBazaar
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
        
        // 清理所有集市容器
        document.querySelectorAll('.siyuan-floating-toc-plugin-container[data-bazaar="true"]').forEach(container => {
            container.remove();
        });
    }
}

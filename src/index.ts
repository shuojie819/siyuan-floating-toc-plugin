import { Plugin } from "siyuan";
import FloatingToc from "./FloatingToc.svelte";

/**
 * 浮动目录插件
 * 为思源笔记提供浮动的文档目录功能
 */
export default class FloatingTocPlugin extends Plugin {
    private tocInstances: Map<HTMLElement, FloatingToc> = new Map();
    private tocDocIds: Map<HTMLElement, string> = new Map();
    private tocVisible = true;
    private observer: MutationObserver | undefined;
    private switchProtyleHandler: (event: CustomEvent<any>) => void;
    private checkProtylesDebounceTimer: number | undefined;
    private searchPreviewCheckInterval: number | undefined;

    async onload() {
        console.log("Floating TOC loaded");
        
        // 绑定事件处理函数
        this.switchProtyleHandler = this.onSwitchProtyle.bind(this);
        
        // 添加顶栏图标
        this.addTopBar({
            icon: "iconAlignLeft",
            title: this.i18n.displayName || "Floating TOC",
            position: "right",
            callback: () => {
                this.toggleToc();
            }
        });
    }

    onLayoutReady() {
        // 监听文档切换事件
        this.eventBus.on("switch-protyle", this.switchProtyleHandler);
        
        // 监听文档内容更新事件
        this.eventBus.on("update-block", this.handleBlockUpdate.bind(this));
        
        // 监听 protyle 加载完成事件（用于搜索预览和文档切换）
        this.eventBus.on("loaded-protyle", this.onLoadedProtyle.bind(this));
        
        // 监控 protyle 实例
        this.monitorProtyles();
        
        // 初始扫描
        this.checkProtyles();
        
        // 添加周期性检查，确保搜索预览的 TOC 正确更新
        this.startSearchPreviewCheck();
    }

    onunload() {
        // 清理 MutationObserver
        if (this.observer) {
            this.observer.disconnect();
            this.observer = undefined;
        }
        
        // 清理事件监听
        this.eventBus.off("switch-protyle", this.switchProtyleHandler);
        this.eventBus.off("update-block", this.handleBlockUpdate.bind(this));
        this.eventBus.off("loaded-protyle", this.onLoadedProtyle.bind(this));
        
        // 清理防抖定时器
        if (this.checkProtylesDebounceTimer) {
            clearTimeout(this.checkProtylesDebounceTimer);
            this.checkProtylesDebounceTimer = undefined;
        }
        
        // 清理周期性检查
        if (this.searchPreviewCheckInterval) {
            clearInterval(this.searchPreviewCheckInterval);
            this.searchPreviewCheckInterval = undefined;
        }
        
        // 清理所有 TOC 实例
        this.tocInstances.forEach((toc) => {
            toc.$destroy();
        });
        this.tocInstances.clear();
        this.tocDocIds.clear();
    }

    private onLoadedProtyle(event: CustomEvent<any>) {
        const protyle = event.detail.protyle;
        if (protyle && protyle.element) {
            console.log("Floating TOC: onLoadedProtyle - protyle.block.rootID:", protyle.block?.rootID, "protyle.element:", protyle.element);
            
            // Search preview/document protyle
            const isSearchPreview = protyle.element.closest(".search__preview, .search__doc") !== null;
            console.log("Floating TOC: onLoadedProtyle - isSearchPreview:", isSearchPreview);
            
            let toc = this.tocInstances.get(protyle.element);
            let resolvedDocId = this.getDocIdFromProtyleElement(protyle.element, protyle);
            if (!resolvedDocId && this.isHistoryHost(protyle.element)) {
                resolvedDocId = "history";
            }
            const prevDocId = this.tocDocIds.get(protyle.element);
            const docKey = resolvedDocId ? this.getDocKeyForHost(protyle.element, resolvedDocId) : "";
            const hadToc = !!toc;
            
            if (!toc) {
                if (resolvedDocId) {
                    console.log("Floating TOC: onLoadedProtyle - Creating new TOC instance");
                    this.createToc(protyle.element, resolvedDocId);
                    toc = this.tocInstances.get(protyle.element);
                }
            }
            
            if (toc && resolvedDocId && hadToc && prevDocId !== docKey) {
                console.log("Floating TOC: onLoadedProtyle - Updating TOC with rootID:", resolvedDocId);
                this.updateTocForHost(protyle.element, resolvedDocId, protyle, true);
                
                if (isSearchPreview) {
                    setTimeout(() => {
                        const finalDocId = this.getDocIdFromProtyleElement(protyle.element, protyle);
                        if (finalDocId) {
                            console.log("Floating TOC: onLoadedProtyle - Search preview delayed update with rootID:", finalDocId);
                            this.updateTocForHost(protyle.element, finalDocId, protyle, true);
                        }
                    }, 200);
                }
            }
        }
    }

    /**
     * 开始周期性检查搜索预览的 TOC 更新
     */
    private startSearchPreviewCheck() {
        // Reduced polling to avoid excessive outline requests.
        this.searchPreviewCheckInterval = window.setInterval(() => {
            this.checkSearchPreviewTOC();
            this.checkHistoryPreviewTOC();
        }, 800);
    }

    /**
     * 检查搜索预览的 TOC 是否需要更新
     */
    private checkSearchPreviewTOC() {
        const searchHosts = this.getSearchPreviewHosts();
        searchHosts.forEach((protyleElement) => {
            const docId = this.getDocIdFromProtyleElement(protyleElement);
            if (!docId) return;
            this.updateTocForHost(protyleElement, docId, (protyleElement as any).protyle);
        });
    }

    private checkHistoryPreviewTOC() {
        const historyHosts = this.getHistoryPreviewHosts();
        historyHosts.forEach((protyleElement) => {
            let docId = this.getDocIdFromProtyleElement(protyleElement);
            if (!docId && this.isHistoryHost(protyleElement)) {
                docId = "history";
            }
            if (!docId) return;
            this.updateTocForHost(protyleElement, docId, (protyleElement as any).protyle);
        });
    }


    /**
     * 处理搜索结果切换事件
     */
    private handleSearchResultChange() {
        console.log("Floating TOC: handleSearchResultChange called");
        
        const searchHosts = this.getSearchPreviewHosts();
        if (searchHosts.length === 0) {
            console.warn("Floating TOC: No search preview hosts found");
        }
        searchHosts.forEach((protyleElement) => {
            const rootId = this.getDocIdFromProtyleElement(protyleElement);
            if (!rootId) {
                console.warn("Floating TOC: Could not get rootId for search result");
                return;
            }
            
            console.log("Floating TOC: Updating search TOC with rootId:", rootId);
            this.updateTocForHost(protyleElement, rootId, (protyleElement as any).protyle);
            
            setTimeout(() => {
                const delayedRootId = this.getDocIdFromProtyleElement(protyleElement);
                if (!delayedRootId) return;
                console.log("Floating TOC: Delayed TOC update with rootId:", delayedRootId);
                this.updateTocForHost(protyleElement, delayedRootId, (protyleElement as any).protyle);
            }, 200);
        });
    }

    private handleHistoryResultChange() {
        const historyHosts = this.getHistoryPreviewHosts();
        if (historyHosts.length === 0) {
            return;
        }
        historyHosts.forEach((protyleElement) => {
            let docId = this.getDocIdFromProtyleElement(protyleElement);
            if (!docId && this.isHistoryHost(protyleElement)) {
                docId = "history";
            }
            if (!docId) return;
            this.updateTocForHost(protyleElement, docId, (protyleElement as any).protyle);
        });
    }


    /**
     * 监控 protyle 实例的创建和销毁
     */
    private monitorProtyles() {
        // 监控整个文档，包括对话框中的 protyle 实例
        const targetNode = document.body;
        
        this.observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            let searchResultChanged = false;
            let historyResultChanged = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // 检查是否有 protyle 相关的节点变化，包括对话框中的
                    for (const node of mutation.addedNodes) {
                        if (node instanceof HTMLElement) {
                            if (node.classList.contains('protyle') || 
                                node.querySelector('.protyle') ||
                                node.classList.contains('dialog-globalsearch') ||
                                node.classList.contains('b3-dialog')) {
                                shouldCheck = true;
                            }
                            // 为搜索列表项添加点击事件监听
                            if (node.classList.contains('search__list')) {
                                this.addSearchListItemListeners(node);
                                searchResultChanged = true;
                            }
                            // 检查是否有搜索结果项被添加
                            if (node.classList.contains('b3-list-item') && 
                                node.closest('.search__list')) {
                                searchResultChanged = true;
                            }
                            if (node.classList.contains('history__panel') ||
                                node.classList.contains('history__side') ||
                                node.classList.contains('history__list') ||
                                node.classList.contains('history__text') ||
                                node.querySelector('.history__side') ||
                                node.querySelector('.history__text')) {
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
                            if (node.classList.contains('protyle') || 
                                node.querySelector('.protyle') ||
                                node.classList.contains('dialog-globalsearch') ||
                                node.classList.contains('b3-dialog')) {
                                shouldCheck = true;
                            }
                        }
                    }
                } else if (mutation.type === 'attributes') {
                    if (mutation.target instanceof HTMLElement) {
                        // 检查搜索列表项的焦点变化
                        if (mutation.target.classList.contains('b3-list-item') &&
                            mutation.attributeName === 'class' &&
                            mutation.target.closest('.search__list')) {
                            // 不管是否有焦点，只要搜索列表项的类发生变化，就认为搜索结果可能切换了
                            searchResultChanged = true;
                            shouldCheck = true;
                        }
                        // 检查面包屑变化
                        if (mutation.target.classList.contains('protyle-breadcrumb__item') ||
                            mutation.target.classList.contains('protyle-breadcrumb')) {
                            searchResultChanged = true;
                            shouldCheck = true;
                        }
                        // 检查 protyle 内容变化
                        if (mutation.target.classList.contains('protyle-content') ||
                            mutation.target.classList.contains('search__preview') ||
                            mutation.target.classList.contains('search__doc')) {
                            searchResultChanged = true;
                            shouldCheck = true;
                        }
                        if (mutation.target.classList.contains('b3-list-item') &&
                            mutation.attributeName === 'class' &&
                            mutation.target.closest('.history__side, .history__list, .history__repo')) {
                            historyResultChanged = true;
                            shouldCheck = true;
                        }
                        if (mutation.target.classList.contains('history__side') ||
                            mutation.target.classList.contains('history__list') ||
                            mutation.target.classList.contains('history__text') ||
                            mutation.target.classList.contains('history__panel')) {
                            historyResultChanged = true;
                            shouldCheck = true;
                        }
                        // 检查 protyle 元素的数据属性变化
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
            
            // 只要检测到搜索结果可能变化，就立即处理
            if (searchResultChanged) {
                // 立即处理一次
                this.handleSearchResultChange();
                // 延迟再处理一次，确保文档内容已完全加载
                setTimeout(() => {
                    this.handleSearchResultChange();
                }, 300);
                // 再延迟一次，确保所有异步操作完成
                setTimeout(() => {
                    this.handleSearchResultChange();
                }, 600);
            }
            if (historyResultChanged) {
                this.handleHistoryResultChange();
                setTimeout(() => {
                    this.handleHistoryResultChange();
                }, 300);
            }
        });
        
        this.observer.observe(targetNode, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-loading', 'data-node-id', 'data-root-id']
        });
        
        // 为现有的搜索列表添加事件监听
        const searchLists = document.querySelectorAll('.search__list');
        searchLists.forEach(list => {
            this.addSearchListItemListeners(list as HTMLElement);
        });
        
        // 添加键盘事件监听，处理搜索结果的键盘导航
        document.addEventListener('keydown', (event) => {
            // 检查是否在搜索对话框中
            const activeDialog = document.querySelector('.b3-dialog--open[data-key="dialog-globalsearch"]');
            if (activeDialog) {
                // 检查是否是导航键
                if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key)) {
                    // 延迟处理，确保焦点已更新
                    setTimeout(() => {
                        this.handleSearchResultChange();
                    }, 100);
                    // 再延迟一次，确保文档内容已加载
                    setTimeout(() => {
                        this.handleSearchResultChange();
                    }, 400);
                }
            }
        });
        
        // 直接监听搜索预览区域的点击事件
        const searchPreviews = document.querySelectorAll('.search__preview');
        searchPreviews.forEach(preview => {
            preview.addEventListener('click', () => {
                this.handleSearchResultChange();
                setTimeout(() => {
                    this.handleSearchResultChange();
                }, 200);
            });
        });
        const searchDocs = document.querySelectorAll('.search__doc');
        searchDocs.forEach(doc => {
            doc.addEventListener('click', () => {
                this.handleSearchResultChange();
                setTimeout(() => {
                    this.handleSearchResultChange();
                }, 200);
            });
        });
        const historyLists = document.querySelectorAll('.history__side, .history__list, .history__repo');
        historyLists.forEach(list => {
            list.addEventListener('click', () => {
                this.handleHistoryResultChange();
                setTimeout(() => {
                    this.handleHistoryResultChange();
                }, 200);
            });
        });
    }
    
    /**
     * 为搜索列表项添加点击事件监听
     */
    private addSearchListItemListeners(searchList: HTMLElement) {
        // 移除现有的事件监听，避免重复添加
        searchList.removeEventListener('click', this.handleSearchListItemClick.bind(this));
        // 添加新的事件监听
        searchList.addEventListener('click', this.handleSearchListItemClick.bind(this));
    }
    
    /**
     * 处理搜索列表项点击事件
     */
    private handleSearchListItemClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const listItem = target.closest('.b3-list-item');
        if (listItem) {
            // 立即处理一次，确保大纲开始更新
            this.handleSearchResultChange();
            // 延迟处理，确保文档内容已完全加载
            setTimeout(() => {
                this.handleSearchResultChange();
            }, 300);
        }
    }

    /**
     * 防抖检查 protyle 实例
     */
    private debouncedCheckProtyles() {
        if (this.checkProtylesDebounceTimer) {
            clearTimeout(this.checkProtylesDebounceTimer);
        }
        this.checkProtylesDebounceTimer = window.setTimeout(() => {
            this.checkProtyles();
        }, 100);
    }

    /**
     * 检查所有 protyle 实例，创建或销毁对应的 TOC
     */
    private checkProtyles() {
        const candidates = Array.from(document.querySelectorAll(".protyle, .search__preview, .search__doc, .history__text, .history__text .protyle, [data-type='docPanel'].history__text"));
        const hostSet = new Set<HTMLElement>();
        candidates.forEach((candidate) => {
            if (!(candidate instanceof HTMLElement)) return;
            const host = this.getTocHostElement(candidate);
            if (host) hostSet.add(host);
        });
        const protyles = Array.from(hostSet);
        
        protyles.forEach((p: HTMLElement) => {
            console.log("Floating TOC: checkProtyles - protyle:", p);
            const content = p.querySelector(".protyle-content") || p.querySelector(".protyle-wysiwyg");
            if (!content) return;
            
            let docId = this.getDocIdFromProtyleElement(p);
            if (!docId && this.isHistoryHost(p)) {
                docId = "history";
            }
            if (!docId) return;
            
            if (!this.tocInstances.has(p)) {
                console.log("Floating TOC: Creating TOC for protyle:", p, "with docId:", docId);
                this.createToc(p, docId);
            } else {
                const lastDocId = this.tocDocIds.get(p);
                const docKey = this.getDocKeyForHost(p, docId);
                if (docKey !== lastDocId) {
                    console.log("Floating TOC: Updating TOC for protyle:", p, "with new docId:", docId);
                    this.updateTocForHost(p, docId, (p as any).protyle);
                }
            }
        });

        for (const [p, toc] of this.tocInstances.entries()) {
            if (!document.contains(p)) {
                console.log("Floating TOC: Removing TOC for protyle:", p);
                toc.$destroy();
                this.tocInstances.delete(p);
                this.tocDocIds.delete(p);
            }
        }
    }

    /**
     * 创建 TOC 实例
     */
    private createToc(protyleElement: HTMLElement, docId: string) {
        // Create container
        const container = document.createElement("div");
        container.className = "syplugin-floating-toc-container";
        protyleElement.appendChild(container);

        // Create TOC component
        const toc = new FloatingToc({
            target: container,
            props: {
                plugin: this,
                targetElement: protyleElement
            }
        });
        if (typeof (toc as any).setVisible === "function") {
            (toc as any).setVisible(this.tocVisible);
        }

        // Initialize data
        toc.updateHeadings(docId, { element: protyleElement });
        this.tocDocIds.set(protyleElement, this.getDocKeyForHost(protyleElement, docId));
        
        this.tocInstances.set(protyleElement, toc);
    }

    /**
     * 切换当前活动文档的 TOC 显示状态
     */
    private toggleToc() {
        this.tocVisible = !this.tocVisible;
        this.tocInstances.forEach((toc) => {
            if (typeof (toc as any).setVisible === "function") {
                (toc as any).setVisible(this.tocVisible);
            } else if (typeof (toc as any).toggle === "function") {
                (toc as any).toggle();
            }
        });
    }

    /**
     * 处理文档切换事件
     */
    private onSwitchProtyle(event: CustomEvent<any>) {
        const protyle = event.detail.protyle;
        if (protyle && protyle.element) {
            let toc = this.tocInstances.get(protyle.element);
            const docId = this.getDocIdFromProtyleElement(protyle.element, protyle);
            
            if (!toc) {
                if (docId) {
                    this.createToc(protyle.element, docId);
                    toc = this.tocInstances.get(protyle.element);
                }
            }
            
            if (toc && docId) {
                toc.updateHeadings(docId, protyle);
                this.tocDocIds.set(protyle.element, this.getDocKeyForHost(protyle.element, docId));
            }
        }
    }

    private getTocHostElement(candidate: HTMLElement): HTMLElement | null {
        if (candidate.classList.contains("protyle")) return candidate;
        const innerProtyle = candidate.querySelector(".protyle");
        if (innerProtyle instanceof HTMLElement) return innerProtyle;
        const docPanel = candidate.querySelector("[data-type='docPanel']");
        if (docPanel instanceof HTMLElement && docPanel.querySelector(".protyle-content")) return docPanel;
        const hasContent = candidate.querySelector(".protyle-content");
        if (hasContent) return candidate;
        return null;
    }

    private getSearchPreviewHosts(): HTMLElement[] {
        const hostSet = new Set<HTMLElement>();
        const candidates = document.querySelectorAll("#searchPreview, .search__preview, .search__doc");
        candidates.forEach((candidate) => {
            if (!(candidate instanceof HTMLElement)) return;
            const host = this.getTocHostElement(candidate);
            if (host) hostSet.add(host);
        });
        return Array.from(hostSet);
    }

    private getHistoryPreviewHosts(): HTMLElement[] {
        const hostSet = new Set<HTMLElement>();
        const candidates = document.querySelectorAll(
            "#historyPreview, .history__text, .history__text.protyle, .history__text .protyle, [data-type='docPanel'].history__text, " +
            ".b3-dialog--open[data-key='dialog-history'] .protyle, .b3-dialog--open[data-key='dialog-historydoc'] .protyle, " +
            ".b3-dialog--open[data-key='dialog-history'] [data-type='docPanel'], .b3-dialog--open[data-key='dialog-historydoc'] [data-type='docPanel']"
        );
        candidates.forEach((candidate) => {
            if (!(candidate instanceof HTMLElement)) return;
            const host = this.getTocHostElement(candidate);
            if (host) hostSet.add(host);
        });
        return Array.from(hostSet);
    }

    private isHistoryHost(element: HTMLElement): boolean {
        if (element.classList.contains("history__text")) return true;
        if (element.closest(".history__text")) return true;
        if (element.closest(".history__panel, .history")) return true;
        if (element.closest(".b3-dialog--open[data-key='dialog-history'], .b3-dialog--open[data-key='dialog-historydoc']")) return true;
        return false;
    }

    private getHistorySnapshotKey(element: HTMLElement, docId: string): string {
        const baseId = docId || "history";
        const panel = element.closest(".history__panel, .history, .b3-dialog") || document;
        const listContainer =
            panel.querySelector(".history__side, .history__list, .history__repo") ||
            panel;
        const activeItem = listContainer.querySelector(
            ".b3-list-item--focus, .b3-list-item--selected, .b3-list-item--current"
        );
        const item = (activeItem || listContainer.querySelector(".b3-list-item")) as HTMLElement | null;
        const path = item?.getAttribute("data-path") || (item as any)?.dataset?.path;
        if (path) return `${baseId}|${path}`;
        return baseId;
    }

    private getHistoryContentSignature(element: HTMLElement): string {
        const contentRoot =
            element.querySelector(".protyle-content") ||
            element;
        const headingNodes = contentRoot.querySelectorAll(
            '[data-type="NodeHeading"], h1, h2, h3, h4, h5, h6'
        );
        const count = headingNodes.length;
        if (count === 0) return "c0";
        const first = headingNodes[0] as HTMLElement;
        const firstId =
            first?.getAttribute?.("data-node-id") ||
            first?.getAttribute?.("data-id") ||
            first?.getAttribute?.("data-oid") ||
            "";
        return `c${count}:${firstId}`;
    }

    private getDocKeyForHost(element: HTMLElement, docId: string): string {
        if (!docId) return "";
        if (this.isHistoryHost(element)) {
            const snapshotKey = this.getHistorySnapshotKey(element, docId);
            const loading = element.getAttribute("data-loading") || "";
            const signature = this.getHistoryContentSignature(element);
            return `${snapshotKey}|${loading}|${signature}`;
        }
        return docId;
    }


    private getDocIdFromSearchContext(element: HTMLElement): string | null {
        const searchContainer =
            element.closest(".b3-dialog--open[data-key='dialog-globalsearch'], .search") || document;
        const activeItem = searchContainer.querySelector(".search__list .b3-list-item--focus");
        const fallbackItem = searchContainer.querySelector(".search__list .b3-list-item");
        const item = (activeItem || fallbackItem) as HTMLElement | null;
        if (!item) return null;
        return (
            item.getAttribute("data-root-id") ||
            item.getAttribute("data-node-id") ||
            item.getAttribute("data-doc-id")
        );
    }

    private getDocIdFromHistoryContext(element: HTMLElement): string | null {
        const panel = element.closest(".history__panel, .history, .b3-dialog") || document;
        const listContainer =
            panel.querySelector(".history__side, .history__list, .history__repo") ||
            panel;

        const activeItem = listContainer.querySelector(
            ".b3-list-item--focus, .b3-list-item--selected, .b3-list-item--current"
        );
        let item = (activeItem || listContainer.querySelector(".b3-list-item")) as HTMLElement | null;

        if (!item) return null;

        const path = item.getAttribute("data-path") || (item as any).dataset?.path;
        const fromPath = this.extractDocIdFromPath(path);
        if (fromPath) return fromPath;

        const itemDocId =
            item.getAttribute("data-root-id") ||
            item.getAttribute("data-node-id") ||
            item.getAttribute("data-doc-id") ||
            item.getAttribute("data-id");
        if (itemDocId) return itemDocId;

        const containerPath =
            listContainer.getAttribute?.("data-path") ||
            (listContainer as any).dataset?.path ||
            panel.getAttribute?.("data-path") ||
            (panel as any).dataset?.path ||
            element.getAttribute?.("data-path") ||
            (element as any).dataset?.path;
        const fromContainerPath = this.extractDocIdFromPath(containerPath);
        if (fromContainerPath) return fromContainerPath;

        const pathNodes = Array.from(panel.querySelectorAll("[data-path]")) as HTMLElement[];
        for (const node of pathNodes) {
            const nodePath = node.getAttribute("data-path") || (node as any).dataset?.path;
            const fromNodePath = this.extractDocIdFromPath(nodePath);
            if (fromNodePath) return fromNodePath;
        }

        const titleInput = panel.querySelector(".protyle-title__input") as HTMLElement | null;
        const titleId =
            titleInput?.getAttribute("data-node-id") ||
            titleInput?.getAttribute("data-doc-id") ||
            titleInput?.getAttribute("data-id");
        if (titleId) return titleId;

        return null;
    }

    private extractDocIdFromPath(path: string | null | undefined): string {
        if (!path) return "";
        const match = String(path).match(/(?:^|[\\/])(\d{14}-[a-z0-9]{7})\.(?:syx|sy)$/i);
        if (match) return match[1];
        const allIds = String(path).match(/\d{14}-[a-z0-9]{7}/gi);
        if (allIds && allIds.length > 0) {
            return allIds[allIds.length - 1];
        }
        return "";
    }


    private getDocIdFromProtyleElement(protyleElement: HTMLElement, protyle?: any): string | null {
        const content = protyleElement.querySelector(".protyle-content") as HTMLElement | null;
        const wysiwyg = protyleElement.querySelector(".protyle-wysiwyg") as HTMLElement | null;
        const docRoot = protyleElement.querySelector('[data-type="NodeDocument"]') as HTMLElement | null;
        const titleInput = protyleElement.querySelector(".protyle-title__input") as HTMLElement | null;
        const titleWrapper = protyleElement.querySelector(".protyle-title") as HTMLElement | null;

        let docId =
            content?.getAttribute("data-node-id") ||
            content?.getAttribute("data-root-id") ||
            content?.getAttribute("data-doc-id") ||
            content?.getAttribute("data-id") ||
            content?.getAttribute("data-oid") ||
            wysiwyg?.getAttribute("data-node-id") ||
            docRoot?.getAttribute("data-node-id") ||
            docRoot?.getAttribute("data-id") ||
            titleInput?.getAttribute("data-node-id") ||
            titleInput?.getAttribute("data-doc-id") ||
            titleInput?.getAttribute("data-id") ||
            titleWrapper?.getAttribute("data-node-id") ||
            titleWrapper?.getAttribute("data-doc-id") ||
            titleWrapper?.getAttribute("data-id") ||
            protyleElement.getAttribute("data-node-id") ||
            protyleElement.getAttribute("data-root-id") ||
            protyleElement.getAttribute("data-doc-id") ||
            protyleElement.getAttribute("data-id") ||
            protyleElement.getAttribute("data-oid") ||
            "";

        const protyleObj = protyle || (protyleElement as any).protyle;
        if (!docId && protyleObj && protyleObj.block && protyleObj.block.rootID) {
            docId = protyleObj.block.rootID;
        }

        if (!docId) {
            const breadcrumb = protyleElement.querySelector(".protyle-breadcrumb");
            if (breadcrumb) {
                const breadcrumbItems = breadcrumb.querySelectorAll(".protyle-breadcrumb__item");
                for (const item of breadcrumbItems) {
                    const nodeId = item.getAttribute("data-node-id");
                    if (nodeId) {
                        docId = nodeId;
                        break;
                    }
                }
            }
        }

        if (!docId) {
            docId = this.getDocIdFromSearchContext(protyleElement) || this.getDocIdFromHistoryContext(protyleElement) || "";
        }

        return docId || null;
    }

    private updateTocForHost(host: HTMLElement, docId: string, protyle?: any, force: boolean = false) {
        const docKey = this.getDocKeyForHost(host, docId);
        const lastDocId = this.tocDocIds.get(host);
        let toc = this.tocInstances.get(host);
        if (toc && !force && lastDocId === docKey) {
            return;
        }
        if (toc) {
            toc.updateHeadings(docId, protyle || { element: host });
        } else {
            this.createToc(host, docId);
            toc = this.tocInstances.get(host);
        }
        if (toc) {
            this.tocDocIds.set(host, docKey || docId);
        }
    }

    /**
     * 处理块更新事件
     */
    private handleBlockUpdate(event: CustomEvent<any>) {
        const data = event.detail;
        if (data && data.id) {
            // Find the protyle that contains this block.
            const blockElement = document.querySelector(`[data-node-id="${data.id}"]`);
            if (blockElement) {
                const protyleElement = blockElement.closest(".protyle") as HTMLElement;
                if (protyleElement && this.tocInstances.has(protyleElement)) {
                    const toc = this.tocInstances.get(protyleElement);
                    if (toc) {
                        const docId = this.getDocIdFromProtyleElement(protyleElement);
                        if (docId) {
                            toc.updateHeadings(docId, { element: protyleElement });
                            this.tocDocIds.set(protyleElement, this.getDocKeyForHost(protyleElement, docId));
                        }
                    }
                }
            }
        }
    }
}

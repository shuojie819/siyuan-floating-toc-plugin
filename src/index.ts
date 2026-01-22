import { Plugin } from "siyuan";
import FloatingToc from "./FloatingToc.svelte";

/**
 * 浮动目录插件
 * 为思源笔记提供浮动的文档目录功能
 */
export default class FloatingTocPlugin extends Plugin {
    private tocInstances: Map<HTMLElement, FloatingToc> = new Map();
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
    }

    /**
     * 处理 protyle 加载完成事件
     */
    private onLoadedProtyle(event: CustomEvent<any>) {
        const protyle = event.detail.protyle;
        if (protyle && protyle.element) {
            console.log("Floating TOC: onLoadedProtyle - protyle.block.rootID:", protyle.block?.rootID, "protyle.element:", protyle.element);
            
            // 检查是否是搜索预览中的 protyle
            const isSearchPreview = protyle.element.closest(".search__preview") !== null;
            console.log("Floating TOC: onLoadedProtyle - isSearchPreview:", isSearchPreview);
            
            // 检查是否已有实例
            let toc = this.tocInstances.get(protyle.element);
            
            if (!toc) {
                // 如果没有实例，创建新实例
                if (protyle.block && protyle.block.rootID) {
                    console.log("Floating TOC: onLoadedProtyle - Creating new TOC instance");
                    this.createToc(protyle.element, protyle.block.rootID);
                    toc = this.tocInstances.get(protyle.element);
                }
            }
            
            // 无论是否已有实例，都强制刷新数据，特别是搜索预览中的 protyle
            if (toc && protyle.block && protyle.block.rootID) {
                console.log("Floating TOC: onLoadedProtyle - Updating TOC with rootID:", protyle.block.rootID);
                toc.updateHeadings(protyle.block.rootID, protyle);
            }
            
            // 延迟再刷新一次，确保文档内容已完全加载（特别是搜索预览）
            setTimeout(() => {
                if (toc && protyle.block && protyle.block.rootID) {
                    console.log("Floating TOC: onLoadedProtyle - Delayed update with rootID:", protyle.block.rootID);
                    toc.updateHeadings(protyle.block.rootID, protyle);
                }
            }, 300);
            
            // 对于搜索预览，再延迟一次更新，确保所有内容都已渲染完成
            if (isSearchPreview) {
                setTimeout(() => {
                    if (toc && protyle.block && protyle.block.rootID) {
                        console.log("Floating TOC: onLoadedProtyle - Search preview final update with rootID:", protyle.block.rootID);
                        toc.updateHeadings(protyle.block.rootID, protyle);
                    }
                }, 500);
            }
        }
    }

    /**
     * 开始周期性检查搜索预览的 TOC 更新
     */
    private startSearchPreviewCheck() {
        // 每隔 150ms 检查一次搜索预览的 protyle 实例
        this.searchPreviewCheckInterval = window.setInterval(() => {
            this.checkSearchPreviewTOC();
        }, 150);
    }

    /**
     * 检查搜索预览的 TOC 是否需要更新
     */
    private checkSearchPreviewTOC() {
        // 查找所有全局搜索对话框
        const dialogs = Array.from(document.querySelectorAll(".b3-dialog--open[data-key='dialog-globalsearch']"));
        dialogs.forEach(dialog => {
            // 获取搜索预览中的 protyle 实例
            const protyleElement = dialog.querySelector(".search__preview .protyle");
            if (protyleElement instanceof HTMLElement) {
                // 获取当前 protyle 的 rootID
                const protyle = (protyleElement as any).protyle;
                if (protyle && protyle.block && protyle.block.rootID) {
                    const currentRootId = protyle.block.rootID;
                    
                    // 获取对应的 TOC 实例
                    const toc = this.tocInstances.get(protyleElement);
                    if (toc) {
                        // 强制更新 TOC，无论之前的 ID 是什么
                        toc.updateHeadings(currentRootId, protyle);
                    } else {
                        // 如果没有 TOC 实例，创建新实例
                        this.createToc(protyleElement, currentRootId);
                    }
                }
            }
        });
    }

    /**
     * 处理搜索结果切换事件
     */
    private handleSearchResultChange() {
        console.log("Floating TOC: handleSearchResultChange called");
        
        // 查找所有全局搜索对话框
        const dialogs = Array.from(document.querySelectorAll(".b3-dialog--open[data-key='dialog-globalsearch']"));
        dialogs.forEach(dialog => {
            console.log("Floating TOC: Found global search dialog");
            
            // 获取搜索预览中的 protyle 实例
            const protyleElement = dialog.querySelector(".search__preview .protyle");
            if (protyleElement instanceof HTMLElement) {
                console.log("Floating TOC: Found search preview protyle element");
                
                // 直接从 protyle 实例获取文档 ID（思源原生方式，最可靠）
                let rootId = "";
                const protyle = (protyleElement as any).protyle;
                if (protyle && protyle.block && protyle.block.rootID) {
                    rootId = protyle.block.rootID;
                    console.log("Floating TOC: Got rootId from protyle.block.rootID:", rootId);
                }
                
                // 如果从 protyle 实例获取失败，从当前激活的搜索列表项获取
                if (!rootId) {
                    const activeItem = dialog.querySelector(".b3-list-item--focus");
                    if (activeItem) {
                        rootId = activeItem.getAttribute("data-root-id") || "";
                        console.log("Floating TOC: Got rootId from active list item:", rootId);
                    }
                }
                
                // 如果还是没有，从面包屑中获取文档 ID
                if (!rootId) {
                    const breadcrumb = protyleElement.querySelector(".protyle-breadcrumb");
                    if (breadcrumb) {
                        // 面包屑中可能有多个项目，遍历所有项目寻找文档 ID
                        const breadcrumbItems = breadcrumb.querySelectorAll(".protyle-breadcrumb__item");
                        for (const item of breadcrumbItems) {
                            if (item.getAttribute("data-node-id")) {
                                rootId = item.getAttribute("data-node-id") || "";
                                console.log("Floating TOC: Got rootId from breadcrumb:", rootId);
                                break;
                            }
                        }
                    }
                }
                
                // 从搜索列表的第一个项目获取（作为最后的后备）
                if (!rootId) {
                    const firstItem = dialog.querySelector(".b3-list-item");
                    if (firstItem) {
                        rootId = firstItem.getAttribute("data-root-id") || "";
                        console.log("Floating TOC: Got rootId from first list item:", rootId);
                    }
                }
                
                if (rootId) {
                    // 检查是否已有 TOC 实例
                    let toc = this.tocInstances.get(protyleElement);
                    if (toc) {
                        // 无论当前 TOC 实例的文档 ID 是什么，都强制更新
                        console.log("Floating TOC: Forcing TOC update with rootId:", rootId);
                        toc.updateHeadings(rootId, { element: protyleElement });
                        
                        // 额外添加一个延迟更新，确保文档内容已完全渲染
                        setTimeout(() => {
                            console.log("Floating TOC: Delayed TOC update with rootId:", rootId);
                            toc.updateHeadings(rootId, { element: protyleElement });
                        }, 200);
                    } else {
                        // 创建新的 TOC 实例
                        console.log("Floating TOC: Creating new TOC instance for rootId:", rootId);
                        this.createToc(protyleElement, rootId);
                    }
                } else {
                    console.warn("Floating TOC: Could not get rootId for search result");
                }
            }
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
                            mutation.target.classList.contains('search__preview')) {
                            searchResultChanged = true;
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
        // 查找所有 protyle 实例，包括搜索预览中的
        const protyles = Array.from(document.querySelectorAll(".protyle"));
        
        // 1. 添加新实例
        protyles.forEach((p: HTMLElement) => {
            console.log("Floating TOC: checkProtyles - protyle:", p);
            
            if (!this.tocInstances.has(p)) {
                // 确保是有效的 protyle 编辑器
                const content = p.querySelector(".protyle-content");
                if (!content) return;
                
                // 获取文档 ID，多种方式尝试
                let docId = content.getAttribute("data-node-id");
                
                // 如果没有直接的 data-node-id，尝试从 protyle 实例的 block 属性获取
                if (!docId && (p as any).protyle && (p as any).protyle.block) {
                    docId = (p as any).protyle.block.rootID;
                }
                
                // 如果还是没有文档 ID，尝试从面包屑中获取所有项目
                if (!docId) {
                    const breadcrumb = p.querySelector(".protyle-breadcrumb");
                    if (breadcrumb) {
                        const breadcrumbItems = breadcrumb.querySelectorAll(".protyle-breadcrumb__item");
                        for (const item of breadcrumbItems) {
                            if (item.getAttribute("data-node-id")) {
                                docId = item.getAttribute("data-node-id");
                                break;
                            }
                        }
                    }
                }
                
                // 对于搜索预览中的 protyle，尝试从最近的搜索列表项获取 root-id
                if (!docId) {
                    const dialog = p.closest(".b3-dialog");
                    if (dialog) {
                        // 先尝试获取当前激活的列表项
                        let activeItem = dialog.querySelector(".b3-list-item--focus");
                        if (activeItem) {
                            docId = activeItem.getAttribute("data-root-id");
                        }
                        
                        // 如果没有激活项，尝试获取第一个列表项
                        if (!docId) {
                            const firstItem = dialog.querySelector(".b3-list-item");
                            if (firstItem) {
                                docId = firstItem.getAttribute("data-root-id");
                            }
                        }
                    }
                }
                
                console.log("Floating TOC: checkProtyles - docId:", docId);
                
                if (docId) {
                    console.log("Floating TOC: Creating TOC for protyle:", p, "with docId:", docId);
                    this.createToc(p, docId);
                }
            }
        });

        // 2. 移除不再存在的实例
        for (const [p, toc] of this.tocInstances.entries()) {
            if (!document.contains(p)) {
                console.log("Floating TOC: Removing TOC for protyle:", p);
                toc.$destroy();
                this.tocInstances.delete(p);
            }
        }
    }

    /**
     * 创建 TOC 实例
     */
    private createToc(protyleElement: HTMLElement, docId: string) {
        // 创建容器
        const container = document.createElement("div");
        container.className = "syplugin-floating-toc-container";
        protyleElement.appendChild(container);

        // 创建 TOC 组件
        const toc = new FloatingToc({
            target: container,
            props: {
                plugin: this,
                targetElement: protyleElement
            }
        });

        // 初始化数据
        toc.updateHeadings(docId, { element: protyleElement });
        
        this.tocInstances.set(protyleElement, toc);
    }

    /**
     * 切换当前活动文档的 TOC 显示状态
     */
    private toggleToc() {
        const activeProtyle = document.querySelector(".layout__wnd--active .protyle") as HTMLElement;
        if (activeProtyle && this.tocInstances.has(activeProtyle)) {
            const toc = this.tocInstances.get(activeProtyle);
            if (toc) {
                (toc as any).toggle();
            }
        }
    }

    /**
     * 处理文档切换事件
     */
    private onSwitchProtyle(event: CustomEvent<any>) {
        const protyle = event.detail.protyle;
        if (protyle && protyle.element) {
            // 检查是否已有实例
            let toc = this.tocInstances.get(protyle.element);
            
            if (!toc) {
                // 可能是新窗口/标签页
                if (protyle.block && protyle.block.rootID) {
                    this.createToc(protyle.element, protyle.block.rootID);
                    toc = this.tocInstances.get(protyle.element);
                }
            }
            
            // 刷新数据
            if (toc && protyle.block && protyle.block.rootID) {
                toc.updateHeadings(protyle.block.rootID, protyle);
            }
        }
    }

    /**
     * 处理块更新事件
     */
    private handleBlockUpdate(event: CustomEvent<any>) {
        const data = event.detail;
        if (data && data.id) {
            // 找到包含该块的 protyle
            const blockElement = document.querySelector(`[data-node-id="${data.id}"]`);
            if (blockElement) {
                const protyleElement = blockElement.closest(".protyle") as HTMLElement;
                if (protyleElement && this.tocInstances.has(protyleElement)) {
                    const toc = this.tocInstances.get(protyleElement);
                    if (toc) {
                        // 获取文档 ID
                        const content = protyleElement.querySelector(".protyle-content");
                        let docId = content?.getAttribute("data-node-id");
                        
                        // 如果没有直接的 data-node-id，尝试从 protyle 实例的 block 属性获取
                        if (!docId && (protyleElement as any).protyle && (protyleElement as any).protyle.block) {
                            docId = (protyleElement as any).protyle.block.rootID;
                        }
                        
                        if (docId) {
                            toc.updateHeadings(docId, { element: protyleElement });
                        }
                    }
                }
            }
        }
    }
}

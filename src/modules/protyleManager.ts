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
    isCoveredByDialog,
    isAiOrChatPanel,
    isElementVisible,
    isOrphanTocContainer
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
            let dialogChanged = false;
            
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
                            // 监听弹窗被添加到 DOM（设置/搜索/集市详情弹窗等）
                            if (node.classList.contains('b3-dialog') || node.classList.contains('b3-dialog--open') ||
                                node.querySelector('.b3-dialog, .b3-dialog--open')) {
                                dialogChanged = true;
                                shouldCheck = true;
                            }
                            // 监听全局搜索/文件历史弹窗/面板被添加到 DOM
                            // dialogChanged 覆盖含义：包含普通弹窗以及搜索/历史面板（覆盖层）的增删与属性变化
                            if (node.classList.contains('search__panel') || node.classList.contains('search__preview') ||
                                node.classList.contains('history__panel') || node.classList.contains('history__side') || node.classList.contains('history__text') ||
                                node.hasAttribute('data-key') && String(node.getAttribute('data-key')).startsWith('dialog-') ||
                                node.querySelector('.search__panel, .search__preview, .history__panel, .history__side, .history__text, [data-key^="dialog-"]')) {
                                dialogChanged = true;
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
                            // 监听弹窗被移除
                            if (node.classList.contains('b3-dialog') || node.classList.contains('b3-dialog--open') ||
                                node.querySelector('.b3-dialog, .b3-dialog--open')) {
                                dialogChanged = true;
                                shouldCheck = true;
                            }
                            // 监听全局搜索/文件历史弹窗/面板被移除
                            // dialogChanged 覆盖含义：包含普通弹窗以及搜索/历史面板（覆盖层）的增删与属性变化
                            if (node.classList.contains('search__panel') || node.classList.contains('search__preview') ||
                                node.classList.contains('history__panel') || node.classList.contains('history__side') || node.classList.contains('history__text') ||
                                node.hasAttribute('data-key') && String(node.getAttribute('data-key')).startsWith('dialog-') ||
                                node.querySelector('.search__panel, .search__preview, .history__panel, .history__side, .history__text, [data-key^="dialog-"]')) {
                                dialogChanged = true;
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
                        // 监听弹窗显示/隐藏类变化（.b3-dialog 复用时常见 class/style 变化）
                        if (mutation.target.classList.contains('b3-dialog') &&
                            (mutation.attributeName === 'class' || mutation.attributeName === 'style' || mutation.attributeName === 'hidden')) {
                            dialogChanged = true;
                            shouldCheck = true;
                        }
                        // 监听搜索/历史面板或 dialog 的 class/style/hidden 变化（复用场景）
                        // dialogChanged 覆盖含义：包含普通弹窗以及搜索/历史面板（覆盖层）的增删与属性变化
                        if ((mutation.target.classList.contains('search__panel') || mutation.target.classList.contains('search__preview') ||
                             mutation.target.classList.contains('history__panel') || mutation.target.classList.contains('history__side') || mutation.target.classList.contains('history__text') ||
                             (mutation.target.hasAttribute('data-key') && String(mutation.target.getAttribute('data-key')).startsWith('dialog-'))) &&
                            (mutation.attributeName === 'class' || mutation.attributeName === 'style' || mutation.attributeName === 'hidden')) {
                            dialogChanged = true;
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
            ".protyle, .search__preview .protyle, .search__doc .protyle, .history__text, .history__text .protyle, [data-type='docPanel'].history__text, #configBazaarReadme, .config-bazaar__readme, .config-bazaar__panel, .item__readme"
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
                // 清理无效的实例（销毁组件并移除容器），再重建，
                // 确保同一 host 只对应一个 TOC 容器，避免出现多个悬浮大纲叠加
                if (existingToc) {
                    this.destroyTocForHost(p);
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

        // 清理已移除的 protyle 实例、被集市面板覆盖的 TOC，或因设置面板等导致 shouldShowToc 为 false 的残留 TOC
        for (const [p] of this.plugin.tocInstances.entries()) {
            if (!document.contains(p) || isCoveredByBazaar(p) || isCoveredByDialog(p) || isAiOrChatPanel(p) || !shouldShowToc(p) || !isElementVisible(p)) {
                // 使用 destroyTocForHost 确保同时移除外层容器 DOM，
                // 避免弹窗/面板切换（设置、全局搜索、文件历史）后旧 TOC 容器残留叠加
                this.destroyTocForHost(p);
            }
        }
        
        // 兜底：清理 DOM 中所有孤儿 TOC 容器（宿主已销毁 / 脱离文档 / 无关联宿主）
        this.sweepOrphanContainers();
    }

    /**
     * 移除指定 host 对应的 TOC 外层容器 DOM 元素。
     * 普通文档：容器是 host 的子元素 .siyuan-floating-toc-plugin-container；
     * 集市：容器挂在 document.body 上并标记 data-bazaar="true"，通过 _tocHost 关联。
     */
    private removeContainerForHost(host: HTMLElement): void {
        if (isBazaarHost(host)) {
            document.querySelectorAll('.siyuan-floating-toc-plugin-container[data-bazaar="true"]').forEach((c) => {
                if ((c as any)._tocHost === host) {
                    c.remove();
                }
            });
        } else {
            host.querySelectorAll('.siyuan-floating-toc-plugin-container').forEach((c) => c.remove());
        }
    }

    /**
     * 兜底清扫 DOM 中所有孤儿 TOC 容器（Issue #44）。
     *
     * 覆盖两类残留：
     *   1) 集市容器（挂在 body、`_tocHost` 缺失或已脱离文档）；
     *   2) 宿主已销毁但容器因边缘时序（protyle 销毁/重建的竞态）而残留在文档中的普通容器。
     *
     * 移除容器时同步回收其关联的 Svelte 实例，避免实例 / 映射泄漏。
     * 该清扫在每轮 checkProtyles 末尾执行，属于「安全网」——正常运行路径的容器由
     * destroyTocForHost 精确移除，不会被误伤（其宿主仍在 tocInstances 中且连接于文档）。
     */
    private sweepOrphanContainers(): void {
        document.querySelectorAll('.siyuan-floating-toc-plugin-container').forEach((node) => {
            const container = node as HTMLElement;
            if (!isOrphanTocContainer(container, (host) => document.contains(host))) return;

            const host = (container as any)._tocHost as HTMLElement | undefined;
            if (host) {
                const toc = this.plugin.tocInstances.get(host);
                if (toc) {
                    try { toc.$destroy(); } catch (e) { /* ignore */ }
                }
                this.plugin.tocInstances.delete(host);
                this.plugin.tocDocIds.delete(host);
            }
            container.remove();
        });
    }

    /**
     * 响应思源 `destroy-protyle` 事件：宿主 protyle 被销毁时，立即清理其 TOC。
     *
     * 「收起右侧文档」「关闭标签页」等操作会销毁 protyle。若只依赖 MutationObserver
     * 的防抖 sweep，会存在一个「残留窗口」——已被销毁宿主的 TOC（`position: fixed` +
     * 插件层级）仍短暂停留在文档中，可能与思源原生浮层叠加，正是 issue #44 所述
     * 「偶发层级错乱」的合理来源之一。此方法把清理提前到事件发生的当下。
     */
    destroyTocForProtyle(protyle: any): void {
        const host = protyle?.element;
        if (!(host instanceof HTMLElement)) return;
        if (this.plugin.tocInstances.has(host)) {
            this.destroyTocForHost(host);
        } else {
            // 映射中已无实例，也兜底移除该宿主下的残留容器
            this.removeContainerForHost(host);
        }
    }

    /**
     * 销毁指定 host 对应的 TOC 组件，并同时移除其外层容器 DOM 元素。
     *
     * 这是修复“同一文档出现多个悬浮大纲叠加”的核心：
     * Svelte 组件实例的 toc.$destroy() 只会移除组件内部渲染的 DOM（.floating-toc），
     * 不会移除 createToc 中手动创建的 .siyuan-floating-toc-plugin-container 容器，
     * 导致空容器在 DOM 中累积、重建时多个容器叠加、阴影/透明度叠加变深。
     * 因此销毁时必须显式移除该容器。
     */
    private destroyTocForHost(host: HTMLElement): void {
        const toc = this.plugin.tocInstances.get(host);
        if (toc) {
            try {
                toc.$destroy();
            } catch (e) {
                // 组件已销毁时忽略异常
            }
            this.plugin.tocInstances.delete(host);
            this.plugin.tocDocIds.delete(host);
        }
        // 无论组件是否销毁成功，都确保残留容器被移除，避免空容器叠加
        this.removeContainerForHost(host);
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
                    try { toc.$destroy(); } catch (e) { /* ignore */ }
                    this.plugin.tocInstances.delete(host);
                    this.plugin.tocDocIds.delete(host);
                }
                container.remove();
            });
        } else {
            // 普通文档场景：先清理该 host 上已存在的容器，确保同一 host 只对应一个
            // TOC 容器，避免重建时多个容器（及多个悬浮大纲）叠加（修复叠加 bug）
            this.removeContainerForHost(protyleElement);
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
                tocZIndex: config.tocZIndex ?? 20,
                tocTopOffset: config.tocTopOffset ?? 80,
                tocEdgeMargin: config.tocEdgeMargin ?? 14,
                tocGap: config.tocGap ?? 10,
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
        
        // 清理所有 TOC 实例（销毁组件并移除容器）
        this.plugin.tocInstances.forEach((toc) => {
            try {
                toc.$destroy();
            } catch (e) {
                // 组件已销毁时忽略异常
            }
        });
        this.plugin.tocInstances.clear();
        this.plugin.tocDocIds.clear();
        
        // 清理所有 TOC 容器（含普通文档场景，避免卸载后容器残留叠加）
        document.querySelectorAll('.siyuan-floating-toc-plugin-container').forEach(container => {
            container.remove();
        });
    }
}

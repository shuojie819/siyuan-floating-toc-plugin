/**
 * 文档 ID 解析器模块
 * 负责从各种上下文中解析文档 ID
 */

import { extractDocIdFromPath, isHistoryHost } from "../utils/domUtils";
import type { IProtyle } from "../types";

/**
 * 文档 ID 解析器类
 * 提供静态方法用于从不同上下文获取文档 ID
 */
export class DocIdResolver {
    /**
     * 从搜索上下文获取文档 ID
     * @param element 元素
     * @returns 文档 ID 或 null
     */
    static getDocIdFromSearchContext(element: HTMLElement): string | null {
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

    /**
     * 从历史上下文获取文档 ID
     * @param element 元素
     * @returns 文档 ID 或 null
     */
    static getDocIdFromHistoryContext(element: HTMLElement): string | null {
        const panel = element.closest(".history__panel, .history, .b3-dialog") || document;
        const listContainer =
            panel.querySelector(".history__side, .history__list, .history__repo") ||
            panel;

        const activeItem = listContainer.querySelector(
            ".b3-list-item--focus, .b3-list-item--selected, .b3-list-item--current"
        );
        const item = (activeItem || listContainer.querySelector(".b3-list-item")) as HTMLElement | null;

        if (!item) return null;

        const path = item.getAttribute("data-path") || (item as any).dataset?.path;
        const fromPath = extractDocIdFromPath(path);
        if (fromPath) return fromPath;

        const itemDocId =
            item.getAttribute("data-root-id") ||
            item.getAttribute("data-node-id") ||
            item.getAttribute("data-doc-id") ||
            item.getAttribute("data-id");
        if (itemDocId) return itemDocId;

        const containerPath =
            (listContainer as HTMLElement).getAttribute?.("data-path") ||
            (listContainer as any).dataset?.path ||
            (panel as HTMLElement).getAttribute?.("data-path") ||
            (panel as any).dataset?.path ||
            element.getAttribute?.("data-path") ||
            (element as any).dataset?.path;
        const fromContainerPath = extractDocIdFromPath(containerPath);
        if (fromContainerPath) return fromContainerPath;

        const pathNodes = Array.from(panel.querySelectorAll("[data-path]")) as HTMLElement[];
        for (const node of pathNodes) {
            const nodePath = node.getAttribute("data-path") || (node as any).dataset?.path;
            const fromNodePath = extractDocIdFromPath(nodePath);
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

    /**
     * 从 protyle 元素获取文档 ID
     * 支持普通模式和聚焦模式
     * @param protyleElement protyle 元素
     * @param protyle protyle 实例（可选）
     * @returns 文档 ID 或 null
     */
    static getDocIdFromProtyleElement(protyleElement: HTMLElement, protyle?: IProtyle): string | null {
        const content = protyleElement.querySelector(".protyle-content") as HTMLElement | null;
        const wysiwyg = protyleElement.querySelector(".protyle-wysiwyg") as HTMLElement | null;
        const docRoot = protyleElement.querySelector('[data-type="NodeDocument"]') as HTMLElement | null;
        const titleInput = protyleElement.querySelector(".protyle-title__input") as HTMLElement | null;
        const titleWrapper = protyleElement.querySelector(".protyle-title") as HTMLElement | null;

        // 1. 尝试通过 DOM 检测是否处于聚焦模式 (Focus Mode / Zoom In)
        const exitFocusBtn = protyleElement.querySelector('.protyle-breadcrumb__icon[data-type="exit-focus"]');
        const isFocusModeViaDOM = exitFocusBtn && !exitFocusBtn.classList.contains("fn__none");

        const protyleObj = protyle || (protyleElement as any).protyle;
        
        // 2. 优先检查 protyle 对象的状态
        if (protyleObj && protyleObj.block) {
            // 结合 DOM 检测和 protyle 状态判断聚焦模式
            // 注意：protyle.block.showAll 在聚焦模式下为 false
            const isFocusMode = protyleObj.block.showAll === false || isFocusModeViaDOM;

            if (isFocusMode) {
                // 聚焦模式下，block.id 应该是聚焦块的 ID
                if (protyleObj.block.id) {
                    return protyleObj.block.id;
                }
            } else {
                // 普通模式下，使用 rootID
                if (protyleObj.block.rootID) {
                    return protyleObj.block.rootID;
                }
            }
        }

        // 3. 如果 protyle 对象不可用或未能返回 ID，尝试从 DOM 获取
        // 聚焦模式下的特殊处理：尝试从面包屑获取 ID
        if (isFocusModeViaDOM) {
            const breadcrumb = protyleElement.querySelector(".protyle-breadcrumb");
            if (breadcrumb) {
                const items = breadcrumb.querySelectorAll(".protyle-breadcrumb__item");
                if (items.length > 0) {
                    // 在聚焦模式下，面包屑的最后一项通常是当前视图的根节点
                    const lastItem = items[items.length - 1];
                    const nodeId = lastItem.getAttribute("data-node-id");
                    if (nodeId) {
                        return nodeId;
                    }
                }
            }
        }

        // 4. 常规 DOM 获取逻辑 (主要用于非聚焦模式或无法识别模式时)
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

        if (!docId) {
            // 最后的尝试：遍历面包屑（取第一个，假设是普通模式下的文档根）
            const breadcrumb = protyleElement.querySelector(".protyle-breadcrumb");
            if (breadcrumb) {
                const items = breadcrumb.querySelectorAll(".protyle-breadcrumb__item");
                for (const item of items) {
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

    /**
     * 获取历史快照键
     * @param element 元素
     * @param docId 文档 ID
     * @returns 快照键
     */
    static getHistorySnapshotKey(element: HTMLElement, docId: string): string {
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

    /**
     * 获取历史内容签名
     * 用于检测历史内容是否发生变化
     * @param element 元素
     * @returns 内容签名
     */
    static getHistoryContentSignature(element: HTMLElement): string {
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

    /**
     * 获取主机的文档键
     * 用于缓存和比较文档状态
     * @param element 元素
     * @param docId 文档 ID
     * @returns 文档键
     */
    static getDocKeyForHost(element: HTMLElement, docId: string): string {
        if (!docId) return "";
        if (isHistoryHost(element)) {
            const snapshotKey = this.getHistorySnapshotKey(element, docId);
            const loading = element.getAttribute("data-loading") || "";
            const signature = this.getHistoryContentSignature(element);
            return `${snapshotKey}|${loading}|${signature}`;
        }
        return docId;
    }
}

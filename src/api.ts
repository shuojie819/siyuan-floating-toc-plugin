/**
 * 思源笔记 API 封装层
 * 参考官方文档和 plugin-sample 实现
 */

import type { IOutlineItem, IWebSocketData, IApiResponse } from "./types";

/**
 * 发送 POST 请求到思源 API
 * 参考官方 fetchPost 实现
 */
export async function fetchPost<T = any>(
    url: string, 
    data?: Record<string, any>,
    callback?: (response: IApiResponse<T>) => void
): Promise<IApiResponse<T>> {
    const init: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    };
    
    if (data) {
        init.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, init);
        const result = await response.json() as IApiResponse<T>;
        
        if (callback) {
            callback(result);
        }
        
        return result;
    } catch (error) {
        console.error(`API request failed: ${url}`, error);
        const errorResponse: IApiResponse<T> = {
            code: -1,
            msg: error instanceof Error ? error.message : "Unknown error",
            data: null as any
        };
        if (callback) {
            callback(errorResponse);
        }
        return errorResponse;
    }
}

/**
 * 获取文档大纲
 * @param id 文档或块 ID
 * @param preview 是否为预览模式（默认 false）
 */
export async function getDocOutline(
    id: string, 
    preview: boolean = false
): Promise<IOutlineItem[]> {
    const result = await fetchPost<IOutlineItem[]>("/api/outline/getDocOutline", {
        id,
        preview
    });
    
    if (result.code === 0) {
        return result.data || [];
    }
    
    console.warn(`Failed to get outline for ${id}: ${result.msg}`);
    return [];
}

/**
 * 获取块信息
 */
export async function getBlockInfo(id: string): Promise<any> {
    const result = await fetchPost("/api/block/getBlockInfo", { id });
    return result.code === 0 ? result.data : null;
}

/**
 * 获取文档信息
 */
export async function getDocInfo(id: string): Promise<any> {
    const result = await fetchPost("/api/block/getDocInfo", { id });
    return result.code === 0 ? result.data : null;
}

/**
 * 解析 WebSocket 消息中的操作数据
 * 参考官方 Outline.ts 实现
 */
export function parseWsTransactions(data: IWebSocketData): {
    hasHeadingChange: boolean;
    rootID?: string;
    operations: Array<{
        action: string;
        id?: string;
        data?: string;
        parentID?: string;
    }>;
} {
    const result = {
        hasHeadingChange: false,
        rootID: data.data?.rootID,
        operations: [] as Array<{
            action: string;
            id?: string;
            data?: string;
            parentID?: string;
        }>
    };
    
    const sources = data.data?.sources || [];
    if (sources.length === 0) return result;
    
    const ops = sources[0];
    
    // 检查 doOperations
    if (ops?.doOperations) {
        for (const item of ops.doOperations) {
            const operation = {
                action: item.action,
                id: item.id,
                data: item.data,
                parentID: item.parentID
            };
            result.operations.push(operation);
            
            // 检查是否涉及标题
            if (isHeadingOperation(item)) {
                result.hasHeadingChange = true;
            }
        }
    }
    
    // 检查 undoOperations
    if (ops?.undoOperations) {
        for (const item of ops.undoOperations) {
            if (item.action === "update" && isHeadingOperation(item)) {
                result.hasHeadingChange = true;
            }
        }
    }
    
    return result;
}

/**
 * 检查操作是否涉及标题块
 */
function isHeadingOperation(operation: any): boolean {
    const data = operation.data || "";
    
    // 检查数据中是否包含 NodeHeading
    if (typeof data === "string" && data.includes('data-type="NodeHeading"')) {
        return true;
    }
    
    // insert/update 操作的其他标题标识
    if (operation.action === "insert" || operation.action === "update") {
        if (typeof data === "string" && /data-subtype="h[1-6]"/.test(data)) {
            return true;
        }
    }
    
    return false;
}

/**
 * 获取文档内容并滚动到指定块
 * 用于处理长文档的动态加载跳转
 * @param blockId 目标块 ID
 * @param rootId 文档根 ID（可选）
 */
export async function getDocWithScroll(
    blockId: string,
    rootId?: string
): Promise<{ success: boolean; content?: string }> {
    const result = await fetchPost("/api/filetree/getDoc", {
        id: blockId,
        mode: 0,  // 正常模式
        size: 102400,
        // action 参数：cb-get-outline 用于大纲跳转，cb-get-hl 用于高亮
        // 这会触发 protyle 加载目标块周围的内容
    });
    
    if (result.code === 0 && result.data) {
        return {
            success: true,
            content: result.data.content
        };
    }
    
    return { success: false };
}

/**
 * 检查块是否存在
 * @param id 块 ID
 */
export async function checkBlockExist(id: string): Promise<boolean> {
    const result = await fetchPost("/api/block/checkBlockExist", { id });
    return result.code === 0 && result.data === true;
}

/**
 * 检查块是否已折叠
 * @param id 块 ID
 */
export async function checkBlockFold(id: string): Promise<boolean> {
    const result = await fetchPost("/api/block/checkBlockFold", { id });
    return result.code === 0 && result.data === true;
}

/**
 * 扁平化大纲数据
 * 将树形结构转换为扁平数组
 */
export function flattenOutline(
    items: IOutlineItem[], 
    decoder?: HTMLElement
): Array<{
    id: string;
    content: string;
    depth: number;
    subType?: string;
}> {
    const flat: Array<{
        id: string;
        content: string;
        depth: number;
        subType?: string;
    }> = [];
    
    // 创建解码器用于解析 HTML 内容
    const htmlDecoder = decoder || document.createElement("div");
    
    const getPlainText = (html: string): string => {
        if (!html) return "";
        htmlDecoder.innerHTML = html;
        return htmlDecoder.textContent || htmlDecoder.innerText || "";
    };
    
    const traverse = (nodes: IOutlineItem[], level: number) => {
        if (!nodes) return;
        
        for (const node of nodes) {
            const rawContent = node.content || node.name || "Untitled";
            const content = getPlainText(rawContent);
            
            // 解析标题深度
            let depth = node.depth || level;
            const subType = node.subType || node.subtype;
            
            if (subType && /^h[1-6]$/i.test(subType)) {
                depth = parseInt(subType.substring(1), 10);
            }
            
            flat.push({
                id: node.id,
                content,
                depth,
                subType
            });
            
            // 递归处理子节点
            const children = node.children || node.blocks;
            if (children && children.length > 0) {
                traverse(children, depth + 1);
            }
        }
    };
    
    traverse(items, 1);
    return flat;
}

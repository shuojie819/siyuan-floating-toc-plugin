/**
 * 思源应用内块跳转工具
 * 复用思源官方 siyuan://blocks/{id} 协议链路（openFileById），在「应用内」完成跳转，
 * 绝不使用 window.open("siyuan://...") 这类会唤醒系统/浏览器的外部跳转方式。
 *
 * 为什么不用 openTab / scrollToBlockId？
 *  - 思源自身大纲点击走的是 openFileById({ id, action:[CB_GET_FOCUS, CB_GET_CONTEXT, ...] })；
 *    对已打开文档，openFileById → switchEditor：若目标块尚未渲染进 DOM（动态加载/虚拟滚动外），
 *    会 fetchPost("/api/filetree/getDoc", { id, mode: 含 CB_GET_CONTEXT?3:0 }) 把块动态加载进来再滚动定位。
 *  - plugin.openTab 在文档已打开时仅聚焦已有页签、不滚动也不加载块；protyle.util.scrollToBlockId
 *    之类纯滚动 API 在块不在 DOM 时直接空转。两者都跳不到动态加载块。
 *  - 原始 window.open("siyuan://blocks/...") 之所以能用，正是因为它被思源前端协议拦截器接住，
 *    最终同样走到 openFileById（含 CB_GET_CONTEXT）。本实现直接调用顶层 window.openFileByURL，
 *    复用同一链路，但不经过 window.open，故不弹浏览器。
 */

// 备忘录（issue #34 已弃用）：原始兜底，会弹浏览器，故改为官方 openFileByURL/openFileById
// window.open(`siyuan://blocks/${blockId}`);

/**
 * 在思源应用内跳转到指定块（绝不在应用外打开浏览器）。
 * @param plugin   插件实例（需具备 openTab / app，用于兜底）
 * @param blockId 目标块 ID（标题块或任意块）
 * @param isFolded 目标块是否处于折叠态（决定展开动作）
 * @returns 是否成功发起应用内跳转
 */
export async function navigateToBlock(
    plugin: any,
    blockId: string,
    isFolded = false
): Promise<boolean> {
    // 走思源官方 siyuan:// 协议链路（openFileById），应用内完成，支持动态加载块，不弹浏览器。
    const url = isFolded
        ? `siyuan://blocks/${blockId}?focus=1`   // 折叠态：zoomIn 展开
        : `siyuan://blocks/${blockId}`;
    const top = (typeof window !== "undefined" && window.top) || (typeof window !== "undefined" ? window : undefined);
    const openFileByURL =
        (top as any)?.openFileByURL ||
        (typeof window !== "undefined" ? (window as any).openFileByURL : undefined);
    if (typeof openFileByURL === "function") {
        try {
            openFileByURL(url);
            return true;
        } catch (e) {
            console.warn("Floating TOC: openFileByURL failed, trying openTab fallback", e);
        }
    }
    // 兜底：官方 openTab（直接传块 id + 含 CB_GET_CONTEXT 的 action，尽量触发动态加载）
    if (plugin && typeof plugin.openTab === "function") {
        try {
            await plugin.openTab({
                app: plugin.app,
                doc: {
                    id: blockId,
                    action: ["cb-get-focus", "cb-get-context", "cb-get-rootscroll"],
                    zoomIn: false,
                },
            });
            return true;
        } catch (e) {
            console.warn("Floating TOC: navigateToBlock openTab fallback failed", e);
            return false;
        }
    }
    return false;
}

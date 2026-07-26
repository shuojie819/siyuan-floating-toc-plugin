/**
 * 悬浮大纲条目点击跳转的核心分支逻辑。
 *
 * 提取自 FloatingToc.svelte 的 handleClick，目的是让分支策略可被单元测试覆盖
 * （issue #34 搜索预览分支修复 / 回退）。通过依赖注入（deps）将 DOM 滚动、折叠检测、
 * 模式判定、应用内跳转等副作用与纯分支逻辑解耦。
 *
 * 分支策略（DOM-only 视图 → 找不到即放弃；其余 → navigateToBlock 兜底）：
 *  - 数据库分组(av-group) / 历史记录(history) / 集市页面(bazaar) / 搜索预览(.search__preview, dialog-search)：
 *    仅做 DOM 滚动。这些视图要么不存在「动态加载/虚拟滚动范围外」的块，要么属于受限的只读预览表面，
 *    navigateToBlock（openFileById）会把【主工作区编辑器】跳转到该块——对搜索预览（全局搜索面板内的
 *    只读预览）而言会抢走搜索上下文、切换/打开文档页签、打断当前预览，故一律不回退应用内跳转。
 *  - 其余（普通文档）：先 DOM 滚动定位，若目标块不在 DOM 中（祖先折叠 / 动态加载范围外 / 非当前文档），
 *    再 checkBlockFold + navigateToBlock 在应用内完成跳转。
 *
 * 【回退技术根因】issue #34 第三版曾把搜索预览从「DOM-only」改为「走 navigateToBlock」，
 * 以期跳转到动态加载外的块。实测发现：在搜索预览区点击动态加载外的块，会直接打开主文档并跳转到
 * 对应大纲位置，而预览区本身毫无变化。根因如下：
 *
 *   1. 搜索预览区(.search__preview)是思源内部创建的【独立只读 Protyle 实例】，并非主编辑器页签。
 *      它加载文档走思源内部逻辑：fetchPost("/api/filetree/getDoc", {id, mode:3}) → onGet(...)。
 *   2. onGet 是思源内部函数，【未挂载到 window 或任何 protyle 实例上】，插件运行时无法访问；
 *      protyle.reload() 只能重载【当前已打开】的文档，不能按任意块 id 重新加载。
 *      → 因此当目标标题不在预览区 DOM 中（虚拟滚动范围外 / 祖先折叠）时，插件没有稳定接口
 *        可以命令预览区 protyle 把它动态加载进来。
 *   3. 而 window.top.openFileByURL("siyuan://blocks/{id}") 的设计语义是：
 *      「在【主编辑器区域】打开目标文档并定位」——它没有参数可以指定「在搜索预览区打开」。
 *      → 所以在搜索预览区里调用它会【激活主文档页签并跳过去，预览区本身毫无变化】，
 *        这正是用户实测看到的现象，并非 bug，而是思源插件架构的硬边界。
 *
 * 结论：搜索预览区的大纲点击只能做「DOM 内滚动」（DOM-only）。动态加载范围外 / 祖先折叠的块在
 * 预览区内不跳转——这是当前版本的既定行为。若未来思源开放预览区 protyle 的按需加载 API，可在此处
 * 接回 navigateToBlock（见下方 isSearchTarget 判定）。
 */
import type { Heading } from "../types";
import { navigateToBlock } from "./navigation";

/** 点击跳转所需的依赖（副作用/视图状态），由调用方注入以支撑单测。 */
export interface HeadingClickDeps {
    /** 在 DOM 中定位目标块元素；找不到返回 null */
    findTargetBlockInDom: (heading: Heading) => Element | null;
    /** 在 DOM 中将目标块滚动到可视区域 */
    scrollToBlockInDom: (targetBlock: Element) => void;
    /** 调用思源 API 检测块是否折叠（祖先折叠返回 true） */
    checkBlockFold: (id: string) => Promise<boolean>;
    /** 当前是否为「历史记录」视图 */
    isHistoryTarget: () => boolean;
    /** 当前是否为「集市页面」视图 */
    isBazaarTarget: () => boolean;
    /** 当前是否为「搜索预览」只读表面（.search__preview / dialog-search） */
    isSearchTarget: () => boolean;
    /** 应用内跳转实现（默认复用 navigation.navigateToBlock） */
    navigateToBlock?: (plugin: any, id: string, isFolded: boolean) => Promise<boolean>;
}

/**
 * 执行悬浮大纲条目点击跳转。
 * @param heading 被点击的标题项
 * @param plugin  插件实例（透传给 navigateToBlock 兜底）
 * @param deps    依赖集合（DOM 滚动 / 模式判定 / 应用内跳转）
 */
export async function handleHeadingClick(
    heading: Heading,
    plugin: any,
    deps: HeadingClickDeps
): Promise<void> {
    // 数据库分组 / 历史记录 / 集市页面 / 搜索预览：仅做 DOM 滚动。
    // 这些视图要么无「动态加载范围外」的块，要么是只读预览表面——navigateToBlock(openFileById)
    // 会驱动主工作区编辑器跳转，对搜索预览会抢走搜索上下文、打断预览，故不回退应用内跳转。
    const isDomScrollOnly =
        heading.subType === "av-group" ||
        deps.isSearchTarget() ||
        deps.isHistoryTarget() ||
        deps.isBazaarTarget();

    // 优先尝试在 DOM 中直接定位并滚动（健壮，不依赖 checkBlockFold API）
    const targetBlock = deps.findTargetBlockInDom(heading);
    if (targetBlock) {
        deps.scrollToBlockInDom(targetBlock);
        return;
    }

    // DOM 中找不到（祖先折叠 / 动态加载范围外 / 非当前文档）
    if (isDomScrollOnly) {
        // 历史/集市/数据库分组：无动态加载外块，放弃跳转
        return;
    }

    // 普通文档：使用官方 API 跳转（支持动态加载块，应用内不弹浏览器）
    const navigate = deps.navigateToBlock ?? navigateToBlock;
    let isFolded = false;
    try {
        isFolded = await deps.checkBlockFold(heading.id);
    } catch (e) {
        console.warn("Floating TOC: checkBlockFold failed", e);
    }
    await navigate(plugin, heading.id, isFolded);
}

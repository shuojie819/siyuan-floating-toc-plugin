/**
 * 浮动目录插件
 * 为思源笔记提供浮动的文档目录功能
 * 
 * 模块化架构：
 * - modules/eventHandlers.ts - 事件处理
 * - modules/protyleManager.ts - Protyle 管理
 * - modules/docIdResolver.ts - 文档 ID 解析
 * - utils/domUtils.ts - DOM 工具函数
 */

import { Plugin, Dialog } from "siyuan";
import { FullscreenHelper } from "./libs/FullscreenHelper";
import { EventHandlers } from "./modules/eventHandlers";
import { ProtyleManager } from "./modules/protyleManager";
import type { PluginConfig, FullscreenConfig } from "./types";
import { DEFAULT_CONFIG } from "./types";
// @ts-ignore
import fullscreenCss from "./assets/fullscreen-helper.scss?inline";
import FloatingToc from "./FloatingToc.svelte";
import SettingPanel from "./Setting.svelte";

/**
 * 浮动目录插件主类
 */
export default class FloatingTocPlugin extends Plugin {
    /** TOC 实例映射 */
    tocInstances: Map<HTMLElement, FloatingToc> = new Map();
    /** TOC 文档 ID 映射 */
    tocDocIds: Map<HTMLElement, string> = new Map();
    /** TOC 可见状态 */
    tocVisible = true;
    
    /** 事件处理器 */
    eventHandlers!: EventHandlers;
    /** Protyle 管理器 */
    protyleManager!: ProtyleManager;
    /** 全屏辅助 */
    private fullscreenHelper!: FullscreenHelper;

    async onload() {
        // 添加图标
        this.addIcons(`<symbol id="iconFullscreen" viewBox="0 0 32 32">
<path d="M5 5v8h3v10h10v3h-13a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3H5zm19 0v8h3v10h10v3h-13a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3h-3z"></path>
<path d="M8 8h8v3H8v-3zm0 14h8v3H8v-3zm14-14h3v8h3v-8h3v-3h-9v3z"></path>
</symbol>
<symbol id="iconFullscreenExit" viewBox="0 0 32 32">
<path d="M8 3v6h5v11h11v5H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h6zM3 24h6v-5H3v11a1 1 0 0 1-1 1H0V24a1 1 0 0 1 1-1h2zm19 0v6h6v-5h-5V8h-6v5h11v11h5z"></path>
</symbol>`);
        
        // 加载配置，使用深度合并确保所有字段都有默认值
        await this.loadData("config.json");
        this.data["config.json"] = this.mergeConfig(DEFAULT_CONFIG, this.data["config.json"] || {});

        // 初始化模块
        this.eventHandlers = new EventHandlers(this);
        this.protyleManager = new ProtyleManager(this);
        this.fullscreenHelper = new FullscreenHelper(this, this.data["config.json"].fullscreenConfig);
        
        // 添加顶栏图标
        this.addTopBar({
            icon: "iconAlignLeft",
            title: this.i18n.displayName || "Floating TOC",
            position: "right",
            callback: () => {
                this.toggleToc();
            }
        });
        
        // 注入全屏辅助 CSS
        this.applyFullscreenCss(fullscreenCss);
    }
    
    /**
     * 深度合并配置，确保所有字段都有值
     */
    private mergeConfig(defaults: PluginConfig, saved: Partial<PluginConfig> | null): PluginConfig {
        const result = { ...defaults };
        if (!saved) return result;
        
        for (const key of Object.keys(defaults) as (keyof PluginConfig)[]) {
            if (saved[key] !== undefined) {
                if (key === 'fullscreenConfig' && typeof saved[key] === 'object') {
                    result[key] = { ...defaults[key], ...saved[key] as FullscreenConfig };
                } else {
                    (result as any)[key] = saved[key];
                }
            }
        }
        return result;
    }

    /**
     * 应用全屏辅助 CSS
     */
    applyFullscreenCss(css: string): void {
        if (!css) return;
        let style = document.getElementById("fullscreen-helper-css");
        if (!style) {
            style = document.createElement("style");
            style.id = "fullscreen-helper-css";
            document.head.appendChild(style);
        }
        style.textContent = css;
    }

    /**
     * 应用自定义 CSS
     */
    applyCustomCss(css: string): void {
        let style = document.getElementById("floating-toc-custom-css");
        if (!style) {
            style = document.createElement("style");
            style.id = "floating-toc-custom-css";
            document.head.appendChild(style);
        }
        style.textContent = css || "";
    }

    /**
     * 更新全屏辅助配置
     */
    updateFullscreenHelperConfig(config: FullscreenConfig): void {
        if (this.fullscreenHelper) {
            this.fullscreenHelper.updateConfig(config);
        }
    }

    /**
     * 打开设置面板
     */
    openSetting(): void {
        const dialog = new Dialog({
            title: this.i18n.displayName || "Floating TOC",
            content: `<div id="SettingPanel" style="height: 100%;"></div>`,
            width: "800px",
            height: "700px",
            destroyCallback: () => {
                pannel.$destroy();
            }
        });

        const pannel = new SettingPanel({
            target: dialog.element.querySelector("#SettingPanel"),
            props: {
                plugin: this
            }
        });
    }

    /**
     * 布局就绪时调用
     */
    onLayoutReady(): void {
        // 初始化全屏辅助
        if (this.fullscreenHelper) {
            this.fullscreenHelper.init();
        }

        // 注册事件监听
        this.eventHandlers.register();
        
        // 监控 protyle 实例
        this.protyleManager.monitorProtyles();
        
        // 初始扫描
        this.protyleManager.checkProtyles();
        
        // 开始周期性检查搜索预览
        this.eventHandlers.startSearchPreviewCheck();
    }

    /**
     * 插件卸载时调用
     */
    onunload(): void {
        // 注销事件监听
        this.eventHandlers.unregister();
        
        // 清理全屏辅助
        if (this.fullscreenHelper) {
            this.fullscreenHelper.destroy();
        }
        
        // 清理 Protyle 管理器
        this.protyleManager.cleanup();
    }

    /**
     * 插件卸载时删除配置
     */
    uninstall(): void {
        this.removeData("config.json");
    }

    /**
     * 创建 TOC 实例（供模块调用）
     */
    createToc(protyleElement: HTMLElement, docId: string): void {
        this.protyleManager.createToc(protyleElement, docId);
    }

    /**
     * 切换 TOC 显示状态
     */
    private toggleToc(): void {
        this.tocVisible = !this.tocVisible;
        this.protyleManager.toggleTocVisibility(this.tocVisible);
    }
}

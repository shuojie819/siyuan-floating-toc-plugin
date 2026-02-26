<script lang="ts">
    import { onMount } from 'svelte';
    import SettingItem from './components/SettingItem.svelte';
    import type { PluginConfig, ToolbarAction, FullscreenConfig } from './types';

    export let plugin: any;
    
    // 默认配置
    const DEFAULT_CONFIG: PluginConfig = {
        dockSide: "right",
        isPinned: false,
        tocWidth: 250,
        followFocus: true,
        miniTocWidth: 32,
        adaptiveHeight: false,
        toolbarConfig: ["scrollToTop", "scrollToBottom", "refreshDoc"],
        customCss: "",
        fullscreenConfig: {
            enableFullscreenHelper: true,
            enableMermaid: true,
            enableECharts: true,
            enableSheetMusic: true,
            enableGraphviz: true,
            enableFlowchart: true,
            enableIFrame: true,
            enableDoubleClick: true,
            enableRightClickExit: true,
            buttonPosition: "top-left"
        }
    };
    
    let config: PluginConfig = { ...DEFAULT_CONFIG };

    let activeTab = 'outline';
    
    $: tabs = [
        { id: 'outline', label: '大纲功能' },
        { id: 'toolbar', label: '功能区功能' },
        { id: 'fullscreen', label: '全屏辅助' },
        { id: 'style', label: plugin.i18n.style || '样式' }
    ];

    // 工具栏操作定义
    const toolbarActions: Array<{ id: ToolbarAction }> = [
        { id: "scrollToTop" },
        { id: "scrollToBottom" },
        { id: "refreshDoc" },
        { id: "togglePin" },
        { id: "toggleDockSide" },
        { id: "collapseAll" },
        { id: "expandAll" }
    ];

    onMount(async () => {
        await loadConfig();
    });

    async function loadConfig() {
        if (plugin.data?.["config.json"]) {
            // 深度合并配置
            const saved = plugin.data["config.json"];
            config = {
                ...DEFAULT_CONFIG,
                ...saved,
                fullscreenConfig: {
                    ...DEFAULT_CONFIG.fullscreenConfig,
                    ...(saved.fullscreenConfig || {})
                }
            };
        }
    }

    async function saveConfig() {
        plugin.data["config.json"] = config;
        await plugin.saveData("config.json", config);
        
        // 应用自定义 CSS
        if (typeof plugin.applyCustomCss === 'function') {
            plugin.applyCustomCss(config.customCss);
        }
        
        // 通知所有 TOC 实例更新
        plugin.tocInstances?.forEach((toc: any) => {
            toc.$set({ 
                dockSide: config.dockSide,
                followFocus: config.followFocus,
                adaptiveHeight: config.adaptiveHeight,
                miniTocWidth: config.miniTocWidth,
                toolbarConfig: config.toolbarConfig
            });
            
            // 跟随聚焦设置变更时刷新大纲
            if (config.followFocus && toc.targetElement) {
                const docId = plugin.getDocIdFromProtyleElement?.(toc.targetElement);
                if (docId) {
                    toc.updateHeadings(docId, toc.targetElement.protyle);
                }
            }
        });
    }

    function handleSettingChange<K extends keyof PluginConfig>(key: K, value: PluginConfig[K]) {
        config[key] = value;
        saveConfig();
    }

    function handleToolbarChange(actionId: ToolbarAction, checked: boolean) {
        let newConfig = [...config.toolbarConfig];
        if (checked) {
            if (!newConfig.includes(actionId)) {
                newConfig.push(actionId);
            }
        } else {
            newConfig = newConfig.filter(id => id !== actionId);
        }
        
        // 按定义顺序排序
        newConfig.sort((a, b) => {
            const indexA = toolbarActions.findIndex(item => item.id === a);
            const indexB = toolbarActions.findIndex(item => item.id === b);
            return indexA - indexB;
        });

        config.toolbarConfig = newConfig;
        saveConfig();
    }
    
    function handleFullscreenChange<K extends keyof FullscreenConfig>(key: K, value: FullscreenConfig[K]) {
        config.fullscreenConfig[key] = value;
        saveConfig();
        if (typeof plugin.updateFullscreenHelperConfig === 'function') {
            plugin.updateFullscreenHelperConfig(config.fullscreenConfig);
        }
    }
</script>

<div class="config__panel">
    <ul class="b3-tab-bar b3-list b3-list--background">
        {#each tabs as tab}
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <li class="b3-list-item {activeTab === tab.id ? 'b3-list-item--selected' : ''}" 
                on:click={() => activeTab = tab.id}
                on:keydown={() => {}}>
                <span class="b3-list-item__text">{tab.label}</span>
            </li>
        {/each}
    </ul>
    
    <div class="config__tab-wrap">
        {#if activeTab === 'outline'}
            <SettingItem 
                type="select" 
                title={plugin.i18n.dockPosition} 
                description={plugin.i18n.dockPositionDesc}
                value={config.dockSide}
                options={{'left': plugin.i18n.left, 'right': plugin.i18n.right}}
                on:change={(e) => handleSettingChange('dockSide', e.detail)}
            />
            
            <SettingItem 
                type="checkbox" 
                title={plugin.i18n.followFocus} 
                description={plugin.i18n.followFocusDesc}
                value={config.followFocus}
                on:change={(e) => handleSettingChange('followFocus', e.detail)}
            />

            <SettingItem 
                type="checkbox" 
                title={plugin.i18n.adaptiveHeight} 
                description={plugin.i18n.adaptiveHeightDesc}
                value={config.adaptiveHeight}
                on:change={(e) => handleSettingChange('adaptiveHeight', e.detail)}
            />
            
            <SettingItem 
                type="slider" 
                title={plugin.i18n.miniTocWidth} 
                description={plugin.i18n.miniTocWidthDesc}
                value={config.miniTocWidth}
                slider={{ min: 20, max: 50, step: 1 }}
                on:change={(e) => handleSettingChange('miniTocWidth', e.detail)}
            />
        {/if}
        
        {#if activeTab === 'toolbar'}
            <div class="b3-label" style="display: block;">
                <div class="fn__flex-1">
                    <div class="fn__flex-center">{plugin.i18n.toolbarActions}</div>
                    <div class="b3-label__text">{plugin.i18n.toolbarActionsDesc}</div>
                </div>
            </div>
            
            {#each toolbarActions as action}
                <div class="b3-label" style="justify-content: flex-start; gap: 8px;">
                    <input class="b3-switch" type="checkbox" 
                        checked={config.toolbarConfig.includes(action.id)} 
                        on:change={(e) => handleToolbarChange(action.id, e.currentTarget.checked)}
                    />
                    <span>{plugin.i18n[action.id]}</span>
                </div>
            {/each}
        {/if}

        {#if activeTab === 'fullscreen'}
            <div class="b3-label" style="display: block;">
                <div class="fn__flex-1">
                    <div class="fn__flex-center">{plugin.i18n.settingsTitle || '全屏辅助设置'}</div>
                    <div class="b3-label__text">{plugin.i18n.fullscreenSettingsDesc || '开启或关闭各类图表的全屏查看功能'}</div>
                </div>
            </div>

            <SettingItem 
                type="checkbox" 
                title={plugin.i18n.enableFullscreenHelper || '启用全屏辅助'} 
                description={plugin.i18n.enableFullscreenHelperDesc || '总开关：开启或关闭全屏辅助功能'}
                value={config.fullscreenConfig.enableFullscreenHelper}
                on:change={(e) => handleFullscreenChange('enableFullscreenHelper', e.detail)}
            />

            {#if config.fullscreenConfig.enableFullscreenHelper}
                <div class="fn__hr"></div>

                <SettingItem 
                    type="select" 
                    title={plugin.i18n.buttonPosition || '按钮位置'} 
                    description=""
                    value={config.fullscreenConfig.buttonPosition}
                    options={{'top-left': plugin.i18n.buttonPositionTopLeft || '左上角', 'top-right': plugin.i18n.buttonPositionTopRight || '右上角'}}
                    on:change={(e) => handleFullscreenChange('buttonPosition', e.detail)}
                />

                <SettingItem 
                    type="checkbox" 
                    title={plugin.i18n.enableDoubleClick || '双击进入全屏'} 
                    description={plugin.i18n.enableDoubleClickDesc || '双击图表区域快速进入全屏模式'}
                    value={config.fullscreenConfig.enableDoubleClick}
                    on:change={(e) => handleFullscreenChange('enableDoubleClick', e.detail)}
                />

                <SettingItem 
                    type="checkbox" 
                    title={plugin.i18n.enableRightClickExit || '右键退出全屏'} 
                    description={plugin.i18n.enableRightClickExitDesc || '在全屏模式下点击鼠标右键退出全屏'}
                    value={config.fullscreenConfig.enableRightClickExit}
                    on:change={(e) => handleFullscreenChange('enableRightClickExit', e.detail)}
                />

                <div class="b3-label__text" style="margin: 20px 0 10px;">{plugin.i18n.supportedTypes || '支持的类型'}</div>

                <SettingItem 
                    type="checkbox" 
                    title={plugin.i18n.enableMermaid || 'Mermaid 流程图'} 
                    description=""
                    value={config.fullscreenConfig.enableMermaid}
                    on:change={(e) => handleFullscreenChange('enableMermaid', e.detail)}
                />

                <SettingItem 
                    type="checkbox" 
                    title={plugin.i18n.enableECharts || 'ECharts 图表'} 
                    description=""
                    value={config.fullscreenConfig.enableECharts}
                    on:change={(e) => handleFullscreenChange('enableECharts', e.detail)}
                />

                <SettingItem 
                    type="checkbox" 
                    title={plugin.i18n.enableFlowchart || 'Flowchart 流程图'} 
                    description=""
                    value={config.fullscreenConfig.enableFlowchart}
                    on:change={(e) => handleFullscreenChange('enableFlowchart', e.detail)}
                />

                <SettingItem 
                    type="checkbox" 
                    title={plugin.i18n.enableGraphviz || 'Graphviz 关系图'} 
                    description=""
                    value={config.fullscreenConfig.enableGraphviz}
                    on:change={(e) => handleFullscreenChange('enableGraphviz', e.detail)}
                />

                <SettingItem 
                    type="checkbox" 
                    title={plugin.i18n.enableSheetMusic || '五线谱 (abcjs)'} 
                    description=""
                    value={config.fullscreenConfig.enableSheetMusic}
                    on:change={(e) => handleFullscreenChange('enableSheetMusic', e.detail)}
                />

                <SettingItem 
                    type="checkbox" 
                    title={plugin.i18n.enableIFrame || 'IFrame 内嵌网页'} 
                    description=""
                    value={config.fullscreenConfig.enableIFrame}
                    on:change={(e) => handleFullscreenChange('enableIFrame', e.detail)}
                />
            {/if}
        {/if}

        {#if activeTab === 'style'}
            <div class="b3-label" style="display: block;">
                <div class="fn__flex-1">
                    <div class="fn__flex-center">{plugin.i18n.customCss}</div>
                    <div class="b3-label__text">{@html plugin.i18n.customCssDesc}</div>
                </div>
            </div>
            <textarea 
                class="b3-text-field fn__block" 
                style="height: 400px; width: 100%; font-family: monospace; resize: vertical;"
                value={config.customCss}
                placeholder={plugin.i18n.customCssPlaceholder}
                on:input={(e) => handleSettingChange('customCss', e.currentTarget.value)}
            ></textarea>
        {/if}
    </div>
</div>

<style>
    .config__panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .b3-tab-bar {
        display: flex;
        flex-wrap: wrap;
        width: 100%;
        border-bottom: 1px solid var(--b3-border-color);
        margin: 0;
        padding: 0;
        list-style: none;
        background: var(--b3-theme-background);
        flex-shrink: 0;
    }
    .config__tab-wrap {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 10px;
    }
    .b3-list-item {
        cursor: pointer;
        padding: 8px 12px;
        border-right: 1px solid var(--b3-border-color);
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        min-width: 0;
    }
    .b3-list-item:last-child {
        border-right: none;
    }
    .b3-list-item--selected {
        background-color: var(--b3-theme-surface);
        color: var(--b3-theme-primary);
    }
    .b3-list-item__text {
        display: inline !important;
        font-size: 14px;
    }
    .b3-label {
        display: flex;
        margin-bottom: 12px;
        align-items: center;
    }

    @media (min-width: 769px) {
        .config__panel {
            flex-direction: row;
        }
        .b3-tab-bar {
            flex-direction: column;
            flex-wrap: nowrap;
            width: 200px;
            height: 100%;
            border-right: 1px solid var(--b3-border-color);
            border-bottom: none;
            flex-shrink: 0;
        }
        .b3-list-item {
            border-right: none;
            border-bottom: 1px solid var(--b3-border-color);
            flex: none;
            justify-content: flex-start;
            padding: 8px 16px;
        }
        .b3-list-item:first-child {
            border-top: 1px solid var(--b3-border-color);
        }
    }
</style>

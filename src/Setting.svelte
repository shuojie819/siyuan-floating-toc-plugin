<script lang="ts">
    import { onMount } from 'svelte';
    import SettingItem from './components/SettingItem.svelte';

    export let plugin: any;
    
    // Default settings
    let config = {
        dockSide: "right",
        followFocus: true,
        miniTocWidth: 32,
        toolbarConfig: ["scrollToTop", "scrollToBottom", "refreshDoc"],
        customCss: ""
    };

    let activeTab = 'outline';
    
    $: tabs = [
        { id: 'outline', label: '大纲功能' }, // Outline Functions
        { id: 'toolbar', label: '功能区功能' }, // Toolbar Functions
        { id: 'style', label: plugin.i18n.style || '样式' }
    ];

    // Toolbar actions definition
    const toolbarActions = [
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
        if (plugin.data && plugin.data["config.json"]) {
            config = { ...config, ...plugin.data["config.json"] };
        }
    }

    async function saveConfig() {
        plugin.data["config.json"] = config;
        await plugin.saveData("config.json", config);
        
        // Apply custom CSS
        if (typeof plugin.applyCustomCss === 'function') {
            plugin.applyCustomCss(config.customCss);
        }
        
        // Notify instances to update
        plugin.tocInstances.forEach((toc) => {
             // Update props
             toc.$set({ 
                 dockSide: config.dockSide,
                 followFocus: config.followFocus,
                 miniTocWidth: config.miniTocWidth,
                 toolbarConfig: config.toolbarConfig
             });
             
             // Special handling for followFocus
             // We force update headings if followFocus changed, or just in general to be safe
             // In the original code, it specifically re-fetched docId and called updateHeadings
             if (config.followFocus) {
                 const protyleElement = toc.targetElement;
                 if (protyleElement) {
                     // We need to access the method on plugin to get Doc ID
                     // Since `plugin` is passed as any, we assume it has the method
                     const docId = plugin.getDocIdFromProtyleElement(protyleElement);
                     if (docId) {
                         toc.updateHeadings(docId, protyleElement.protyle);
                     }
                 }
             }
        });
    }

    function handleSettingChange(key, value) {
        config[key] = value;
        saveConfig();
    }

    function handleToolbarChange(actionId, checked) {
        let newConfig = [...config.toolbarConfig];
        if (checked) {
            if (!newConfig.includes(actionId)) {
                newConfig.push(actionId);
            }
        } else {
            newConfig = newConfig.filter(id => id !== actionId);
        }
        
        // Sort
        newConfig.sort((a, b) => {
            const indexA = toolbarActions.findIndex(item => item.id === a);
            const indexB = toolbarActions.findIndex(item => item.id === b);
            return indexA - indexB;
        });

        config.toolbarConfig = newConfig;
        saveConfig();
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
        overflow: hidden;
    }
    .b3-tab-bar {
        width: 200px;
        height: 100%;
        border-right: 1px solid var(--b3-border-color);
        overflow-y: auto;
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .config__tab-wrap {
        flex: 1;
        height: 100%;
        overflow-y: auto;
        padding: 10px;
    }
    .b3-list-item {
        cursor: pointer;
        padding: 8px 16px;
        border-bottom: 1px solid var(--b3-border-color);
    }
    .b3-list-item:first-child {
        border-top: 1px solid var(--b3-border-color);
    }
    .b3-list-item--selected {
        background-color: var(--b3-theme-surface);
        color: var(--b3-theme-primary);
    }
    .b3-label {
        display: flex;
        margin-bottom: 12px;
        align-items: center;
    }
</style>

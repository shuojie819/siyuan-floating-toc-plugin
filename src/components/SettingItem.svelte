<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let type: 'checkbox' | 'select' | 'slider' | 'text' = 'text';
    export let title: string = '';
    export let description: string = '';
    export let value: any;
    export let options: Record<string, string> = {}; // For select
    export let slider: { min: number; max: number; step: number } = { min: 0, max: 100, step: 1 };

    function onChange() {
        dispatch('change', value);
    }
</script>

<div class="b3-label">
    <div class="fn__flex-1">
        <div class="config-item-title">{title}</div>
        <div class="b3-label__text">{description}</div>
    </div>
    <div class="fn__flex-center">
        {#if type === 'checkbox'}
            <input class="b3-switch" type="checkbox" bind:checked={value} on:change={onChange} />
        {:else if type === 'select'}
            <select class="b3-select fn__size200" bind:value={value} on:change={onChange}>
                {#each Object.entries(options) as [val, label]}
                    <option value={val}>{label}</option>
                {/each}
            </select>
        {:else if type === 'slider'}
            <div class="fn__flex-center">
                <input class="b3-slider fn__size200" type="range" 
                    min={slider.min} max={slider.max} step={slider.step} 
                    bind:value={value} on:change={onChange} on:input />
                <span style="width: 40px; text-align: right;">{value}px</span>
            </div>
        {:else}
            <input class="b3-text-field fn__size200" bind:value={value} on:change={onChange} />
        {/if}
    </div>
</div>

<style>
    .b3-label {
        display: flex;
        margin-bottom: 12px;
        align-items: center;
        justify-content: space-between;
    }
    .fn__flex-1 {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .b3-label__text {
        font-size: 12px;
        opacity: 0.6;
    }
    .fn__flex-center {
        display: flex;
        align-items: center;
    }
    .config-item-title {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
    }
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DataSourceTag } from '$lib/types/market';
	import SourceBadge from './SourceBadge.svelte';

	type Props = {
		title: string;
		meta?: string;
		source?: DataSourceTag;
		id?: string;
		stale?: boolean;
		children: Snippet;
	};

	let { title, meta, source, id, stale = false, children }: Props = $props();

	const fallbackHint = $derived(
		source === 'fallback' ? 'Using fallback baselines — provider unreachable' : null
	);
</script>

<section class="dash-panel" class:opacity-75={stale || source === 'fallback'} aria-labelledby={id}>
	<div class="dash-panel-header">
		<h2 {id} class="dash-panel-title">
			{title}<SourceBadge {source} />
		</h2>
		{#if meta}
			<span class="dash-panel-meta">{meta}</span>
		{/if}
		{#if fallbackHint}
			<span class="dash-panel-meta dash-panel-meta--warn">{fallbackHint}</span>
		{/if}
	</div>
	<div class="dash-panel-body">
		{@render children()}
	</div>
</section>

<style>
	.dash-panel-meta--warn {
		color: rgba(251, 113, 133, 0.85);
	}
</style>

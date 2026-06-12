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
</script>

<section class="dash-panel" class:opacity-75={stale || source === 'fallback'} aria-labelledby={id}>
	<div class="dash-panel-header">
		<h2 {id} class="dash-panel-title">
			{title}<SourceBadge {source} />
		</h2>
		{#if meta}
			<span class="dash-panel-meta">{meta}</span>
		{/if}
	</div>
	<div class="dash-panel-body">
		{@render children()}
	</div>
</section>

<style>
	.dash-panel {
		background: rgba(24, 24, 27, 0.78);
		backdrop-filter: blur(8px);
		border-radius: 4px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.04),
			0 1px 2px rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(63, 63, 70, 0.45);
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.dash-panel-header {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 10px 12px 8px;
		border-bottom: 1px solid rgba(63, 63, 70, 0.45);
		background: rgba(0, 0, 0, 0.35);
		border-radius: 4px 4px 0 0;
	}

	.dash-panel-title {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: #e4e4e7;
		line-height: 1.3;
	}

	.dash-panel-meta {
		font-size: 10px;
		color: #71717a;
		letter-spacing: 0.02em;
	}

	.dash-panel-body {
		padding: 6px 8px 10px;
		flex: 1;
	}
</style>

<script lang="ts">
	import { MACRO_FORECASTS_UPDATED } from '$lib/config/macro-forecasts';

	type Props = {
		loadedAt?: string;
	};

	let { loadedAt }: Props = $props();

	const loadedLabel = $derived(
		loadedAt
			? new Date(loadedAt).toLocaleString('en-US', {
					month: 'short',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
					hour12: false
				})
			: null
	);
</script>

<footer class="dash-footer">
	<div class="dash-footer-inner">
		<p class="dash-footer-line">Data: Yahoo Finance · TradingView · FRED · Kalshi</p>
		<p class="dash-footer-line dash-footer-muted">
			Macro forecasts are manually maintained placeholders (updated {MACRO_FORECASTS_UPDATED}) — not
			live consensus.
		</p>
		{#if loadedLabel}
			<p class="dash-footer-line dash-footer-muted">Last server refresh: {loadedLabel}</p>
		{/if}
	</div>
</footer>

<style>
	.dash-footer {
		margin-top: 16px;
		padding: 12px 0 8px;
		border-top: 1px solid var(--color-border-subtle);
	}

	.dash-footer-inner {
		max-width: 1600px;
		margin: 0 auto;
		padding: 0 16px;
	}

	.dash-footer-line {
		margin: 0;
		font-size: 10px;
		letter-spacing: 0.04em;
		color: var(--color-text-secondary);
		line-height: 1.6;
	}

	.dash-footer-muted {
		color: var(--color-text-muted);
	}
</style>

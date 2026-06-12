<script lang="ts">
	import type { CentralBanks, DataSourceTag } from '$lib/types/market';
	import SourceBadge from './SourceBadge.svelte';

	type Props = {
		centralBanks: CentralBanks;
		centralBanksSource?: DataSourceTag;
	};

	let { centralBanks, centralBanksSource }: Props = $props();

	const POLICY_BANKS = [
		{ key: 'us' as const, label: 'FED' },
		{ key: 'eu' as const, label: 'ECB' },
		{ key: 'in' as const, label: 'RBI' },
		{ key: 'jp' as const, label: 'BOJ' },
		{ key: 'ca' as const, label: 'BoC' },
		{ key: 'gb' as const, label: 'BoE' },
		{ key: 'au' as const, label: 'RBA' }
	];
</script>

<div
	class="policyStrip"
	class:opacity-75={centralBanksSource === 'fallback'}
	aria-label="Global policy rates"
>
	<div class="policyStripInner">
		<span class="policyStripLabel">
			Policy Rates<SourceBadge source={centralBanksSource} />
		</span>

		<div class="policyStripTrack scrollbar-none">
			{#each POLICY_BANKS as bank (bank.key)}
				<div class="policy-pill">
					<span class="policy-pill-label">{bank.label}</span>
					<span class="policy-pill-rate">{centralBanks[bank.key]}%</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.policyStrip {
		width: 100%;
		margin-bottom: 12px;
		border-bottom: 1px solid var(--color-border-subtle);
		background: rgba(15, 15, 18, 0.65);
		backdrop-filter: blur(6px);
	}

	.policyStripInner {
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: 1600px;
		margin: 0 auto;
		padding: 10px 16px;
	}

	.policyStripLabel {
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		color: var(--color-text-muted);
		padding-right: 12px;
		border-right: 1px solid var(--color-border-subtle);
	}

	.policyStripTrack {
		display: flex;
		flex-wrap: nowrap;
		overflow-x: auto;
		gap: 8px;
		align-items: center;
		flex: 1;
		min-width: 0;
		-webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%);
		mask-image: linear-gradient(to right, black 90%, transparent 100%);
	}
</style>

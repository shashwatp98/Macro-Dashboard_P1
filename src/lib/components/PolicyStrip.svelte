<script lang="ts">
	import type { CentralBanks, DataSourceTag } from '$lib/types/market';

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
	class="policyStrip w-full flex flex-nowrap overflow-x-auto select-none scrollbar-none items-center gap-3 bg-neutral-900/50 border-b border-neutral-800 p-2 px-4 mb-4"
	class:opacity-75={centralBanksSource === 'fallback'}
	aria-label="Global policy rates"
>
	<span
		class="shrink-0 text-xs font-bold uppercase tracking-wider text-neutral-400 mr-2 border-r border-neutral-700 pr-3"
		>POLICY RATES:{#if centralBanksSource === 'cache'}<span class="sourceBadge sourceBadgeCache">CACHED</span>{:else if centralBanksSource === 'fallback'}<span class="sourceBadge sourceBadgeStale">[STALE]</span>{/if}</span
	>
	{#each POLICY_BANKS as bank (bank.key)}
		<div class="flex shrink-0 items-center gap-1.5 text-xs">
			<span class="text-neutral-400 font-medium">{bank.label}</span>
			<span class="font-mono font-bold text-neutral-100">{centralBanks[bank.key]}%</span>
		</div>
	{/each}
</div>

<style>
	.sourceBadge {
		display: inline-block;
		margin-left: 6px;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.1em;
		vertical-align: middle;
		white-space: nowrap;
	}

	.sourceBadgeCache {
		color: rgb(113 113 122);
	}

	.sourceBadgeStale {
		color: rgba(244, 63, 94, 0.8);
	}
</style>

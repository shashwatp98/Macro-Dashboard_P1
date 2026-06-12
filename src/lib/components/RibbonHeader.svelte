<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { FedWatch, MacroReleaseAlert } from '../../routes/+page.server';
	import type { DataSourceTag } from '$lib/types/market';
	import SourceBadge from './SourceBadge.svelte';
	import StatusPill from './StatusPill.svelte';
	import { buildMacroReleaseAlertLine } from '$lib/dashboard/marketSections';

	type Props = {
		fedWatch: FedWatch;
		fedWatchSource?: DataSourceTag;
		releaseAlertsSource?: DataSourceTag;
		macroReleaseAlerts: MacroReleaseAlert[];
		loadedAt?: string;
		children: Snippet;
	};

	let {
		fedWatch,
		fedWatchSource,
		releaseAlertsSource,
		macroReleaseAlerts,
		loadedAt,
		children
	}: Props = $props();

	let now = $state('');
	let macroReleaseAlertLine = $state('');

	const headerTime = () => {
		const d = new Date();
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		const ss = String(d.getSeconds()).padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	};

	const loadedChip = $derived(
		loadedAt
			? new Date(loadedAt).toLocaleTimeString('en-GB', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
					hour12: false
				})
			: null
	);

	$effect(() => {
		const tick = () => {
			now = headerTime();
			macroReleaseAlertLine = buildMacroReleaseAlertLine(macroReleaseAlerts);
		};
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="dash-ribbon">
	<div class="mx-auto max-w-[1600px] px-4 py-2.5">
		<div class="ribbon-top">
			<div class="dash-title">
				<span class="dash-title-accent" aria-hidden="true"></span>
				<span class="dash-title-text">Global Macro Dashboard</span>
			</div>

			{#if macroReleaseAlertLine}
				<div class="macro-release-alert ribbon-alert" aria-live="polite">
					{macroReleaseAlertLine}
					{#if releaseAlertsSource}<SourceBadge source={releaseAlertsSource} />{/if}
				</div>
			{/if}

			<div class="ribbon-meta">
				<span class="hidden text-[10px] tracking-wider text-zinc-500 uppercase sm:inline"
					>Local</span
				>
				<span class="font-data text-zinc-200 tabular-nums">{now}</span>
				{#if loadedChip}
					<span class="loaded-chip font-data">REF {loadedChip}</span>
				{/if}
				<div class="fomc-chip">
					<span class="font-semibold tracking-wide text-amber-500/80">FOMC</span>
					<span class="text-zinc-500">[Kalshi]</span>
					<span>{fedWatch.meetingDate}</span>
					<StatusPill kind="fed" action={fedWatch.action} />
					<span class="text-zinc-400">({fedWatch.probability})</span>
					<SourceBadge source={fedWatchSource} />
				</div>
			</div>
		</div>

		<div class="ribbon-divider" aria-hidden="true"></div>

		<div class="mt-2.5">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.ribbon-top {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		min-height: 22px;
	}

	.ribbon-alert {
		flex: 1 1 100%;
		order: 3;
		text-align: center;
		font-size: 11px;
		font-family: var(--font-data);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 4px 0;
	}

	@media (min-width: 768px) {
		.ribbon-alert {
			flex: 1 1 auto;
			order: unset;
			position: absolute;
			left: 50%;
			max-width: 50vw;
			transform: translateX(-50%);
			padding: 0;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}

	.ribbon-meta {
		margin-left: auto;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		font-size: 11px;
	}

	.loaded-chip {
		font-size: 10px;
		color: var(--color-text-muted);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid var(--color-border-subtle);
		background: rgba(24, 24, 27, 0.45);
	}

	.ribbon-divider {
		height: 1px;
		margin-top: 10px;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(245, 158, 11, 0.25) 20%,
			rgba(34, 211, 238, 0.2) 80%,
			transparent
		);
	}
</style>

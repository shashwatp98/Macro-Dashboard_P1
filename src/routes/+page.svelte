<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { PUBLIC_REFRESH_ENABLED } from '$env/static/public';
	import type { PageData } from './$types';
	import type { MacroStatus } from '$lib/types/market';
	import ClockBanner from '$lib/components/ClockBanner.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import MacroTable from '$lib/components/MacroTable.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import PolicyStrip from '$lib/components/PolicyStrip.svelte';
	import QuoteRow from '$lib/components/QuoteRow.svelte';
	import RibbonHeader from '$lib/components/RibbonHeader.svelte';
	import TickerRibbon from '$lib/components/TickerRibbon.svelte';
	import YieldCurveInline from '$lib/components/YieldCurveInline.svelte';
	import {
		MACRO_DATA_KEYS,
		MACRO_OUT_FLASH_KEYS,
		PRICE_TRACKERS,
		macroOutcomeBlink
	} from '$lib/dashboard/priceFlash';
	import {
		buildMarketLayout,
		chgDirection,
		fmtChg,
		fmtNum,
		fmtSigned
	} from '$lib/dashboard/marketSections';

	let { data }: { data: PageData } = $props();

	type FlashDirection = 'up' | 'down' | null;

	const REFRESH_MS = 15_000;
	const refreshEnabled = PUBLIC_REFRESH_ENABLED !== 'false';

	let flashStates = $state<Record<string, FlashDirection>>({});
	const flashTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
	const prevPrices: Record<string, number> = {};
	const prevMacroSnapshots: Record<string, { actual: number; change: number }> = {};

	const marketsSource = $derived(data.dataSources?.markets);
	const macroSource = $derived(data.dataSources?.macro);
	const centralBanksSource = $derived(data.dataSources?.centralBanks);
	const fedWatchSource = $derived(data.dataSources?.fedWatch);
	const releaseAlertsSource = $derived(data.dataSources?.releaseAlerts);

	const layout = $derived(buildMarketLayout(data));

	const setFlash = (id: string, direction: 'up' | 'down') => {
		const existing = flashTimeouts.get(id);
		if (existing) clearTimeout(existing);

		flashStates = { ...flashStates, [id]: direction };
		flashTimeouts.set(
			id,
			setTimeout(() => {
				flashStates = { ...flashStates, [id]: null };
				flashTimeouts.delete(id);
			}, 800)
		);
	};

	$effect(() => {
		for (const { id, read } of PRICE_TRACKERS) {
			const newPrice = read(data);
			if (typeof newPrice !== 'number') continue;

			const cached = prevPrices[id];
			if (cached !== undefined && newPrice !== cached) {
				setFlash(id, newPrice > cached ? 'up' : 'down');
			}
			prevPrices[id] = newPrice;
		}

		for (const key of MACRO_DATA_KEYS) {
			const block = data?.[key];
			if (!block) continue;

			const snap = prevMacroSnapshots[key];
			if (snap) {
				if (block.price !== snap.actual) {
					const outcomeBlink = macroOutcomeBlink(block.status);
					const outKey = MACRO_OUT_FLASH_KEYS[key];
					if (outcomeBlink === 'up') setFlash(outKey, 'up');
					else if (outcomeBlink === 'down') setFlash(outKey, 'down');
				}
			}
			prevMacroSnapshots[key] = { actual: block.price, change: block.changeFromPrior };
		}
	});

	onMount(() => {
		for (const key of MACRO_DATA_KEYS) {
			const blink = macroOutcomeBlink(data?.[key]?.status as MacroStatus);
			const outKey = MACRO_OUT_FLASH_KEYS[key];
			if (blink === 'up') setFlash(outKey, 'up');
			else if (blink === 'down') setFlash(outKey, 'down');
		}

		let refreshInterval: ReturnType<typeof setInterval> | null = null;

		const stopRefresh = () => {
			if (refreshInterval !== null) {
				clearInterval(refreshInterval);
				refreshInterval = null;
			}
		};

		const startRefresh = () => {
			if (!refreshEnabled) return;
			stopRefresh();
			refreshInterval = setInterval(() => invalidateAll(), REFRESH_MS);
		};

		const onVisibilityChange = () => {
			if (document.hidden) {
				stopRefresh();
				return;
			}
			invalidateAll();
			startRefresh();
		};

		if (refreshEnabled) {
			startRefresh();
			document.addEventListener('visibilitychange', onVisibilityChange);
		}

		return () => {
			stopRefresh();
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	onDestroy(() => {
		for (const timeout of flashTimeouts.values()) clearTimeout(timeout);
		flashTimeouts.clear();
	});
</script>

<main class="dash-page">
	<ClockBanner />

	<RibbonHeader
		fedWatch={data.fedWatch}
		{fedWatchSource}
		{releaseAlertsSource}
		macroReleaseAlerts={data.macroReleaseAlerts}
		loadedAt={data.loadedAt}
	>
		<TickerRibbon items={layout.tickerItems} {flashStates} />
	</RibbonHeader>

	<PolicyStrip centralBanks={data.centralBanks} {centralBanksSource} />

	<div class="mx-auto max-w-[1600px] px-4 pt-4 pb-4">
		<div class="dashboardLayout">
			<div class="blocksStack">
				<div class="blocksRow blocksRowPrimary" role="region" aria-label="Primary market panels">
					{#each layout.primaryRow as section (section.id)}
						<Panel title={section.title} source={marketsSource} id="{section.id}-heading">
							{#each section.items as item (item.symbol)}
								<QuoteRow
									symbol={item.symbol}
									label={item.label}
									value={item.value}
									changeText={fmtChg(item.change)}
									changeDirection={chgDirection(item.change)}
									flashUp={flashStates[item.symbol] === 'up'}
									flashDown={flashStates[item.symbol] === 'down'}
								/>
							{/each}
						</Panel>
					{/each}
				</div>

				<div
					class="blocksRow blocksRowSecondary"
					role="region"
					aria-label="Secondary market panels"
				>
					<Panel title="YIELD SPREADS & CRYPTO" source={marketsSource} id="yield-spreads-heading">
						{#each layout.computedSpreadTickers as item (item.symbol)}
							<QuoteRow
								symbol={item.symbol}
								label={item.label}
								value={item.value}
								changeText={fmtChg(item.change)}
								changeDirection={chgDirection(item.change)}
								flashUp={flashStates[item.symbol] === 'up'}
								flashDown={flashStates[item.symbol] === 'down'}
							/>
						{/each}
						<QuoteRow
							symbol={layout.bitcoin.symbol}
							label={layout.bitcoin.label}
							value={'$' + fmtNum(layout.bitcoin.currentPrice, 2)}
							changeText={fmtSigned(layout.bitcoin.changePct, 2) + '%'}
							changeDirection={chgDirection({ mode: 'pct', value: layout.bitcoin.changePct })}
							flashUp={flashStates[layout.bitcoin.symbol] === 'up'}
							flashDown={flashStates[layout.bitcoin.symbol] === 'down'}
						/>
					</Panel>

					{#each layout.secondaryRow as section (section.id)}
						<Panel title={section.title} source={marketsSource} id="{section.id}-heading">
							{#each section.items as item (item.symbol)}
								<QuoteRow
									symbol={item.symbol}
									label={item.label}
									value={item.value}
									changeText={fmtChg(item.change)}
									changeDirection={chgDirection(item.change)}
									flashUp={flashStates[item.symbol] === 'up'}
									flashDown={flashStates[item.symbol] === 'down'}
								/>
							{/each}
						</Panel>
					{/each}
				</div>
			</div>

			<section
				class="curveMacroRow grid grid-cols-1 gap-4 lg:grid-cols-2"
				aria-label="Yield curve and macro data"
			>
				<div class="curveCol min-w-0">
					<YieldCurveInline
						us3mYield={layout.usRates['3M'].yield}
						us2yYield={layout.usRates.US2Y.yield}
						us10yYield={layout.usRates.US10Y.yield}
						us30yYield={layout.usRates.US30Y.yield}
						spread2s10s={data?.spread2s10s?.price ?? 0.05}
						spread10s30s={data?.spread10s30s?.price ?? 0.52}
						{marketsSource}
					/>
				</div>

				<div class="macroCol min-w-0">
					<MacroTable
						uscpi={data.uscpi}
						uscpicore={data.uscpicore}
						uspce={data.uspce}
						usnfp={data.usnfp}
						usur={data.usur}
						usgdp={data.usgdp}
						{macroSource}
						{flashStates}
					/>
				</div>
			</section>
		</div>

		<Footer loadedAt={data.loadedAt} />
	</div>
</main>

<style>
	.dashboardLayout {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.blocksStack {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.blocksRow {
		display: grid;
		gap: 10px;
		align-items: stretch;
		grid-template-columns: 1fr;
	}

	@media (min-width: 768px) {
		.blocksRowPrimary {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.blocksRowSecondary {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.curveMacroRow {
		width: 100%;
		margin-top: 2px;
	}
</style>

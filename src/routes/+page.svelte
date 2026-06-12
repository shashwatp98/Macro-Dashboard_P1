<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { PUBLIC_REFRESH_ENABLED } from '$env/static/public';
	import type { PageData } from './$types';
	import type { MacroStatus } from './+page.server';
	import MacroTable from '$lib/components/MacroTable.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import PolicyStrip from '$lib/components/PolicyStrip.svelte';
	import QuoteRow from '$lib/components/QuoteRow.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import YieldCurveInline from '$lib/components/YieldCurveInline.svelte';

	let { data }: { data: PageData } = $props();

	type FlashDirection = 'up' | 'down' | null;

	const REFRESH_MS = 15_000;
	const refreshEnabled = PUBLIC_REFRESH_ENABLED !== 'false';

	const prevPrices: Record<string, number> = {};
	let flashStates = $state<Record<string, FlashDirection>>({});

	const flashTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

	const PRICE_TRACKERS: { id: string; read: (d: PageData) => number | undefined }[] = [
		{ id: 'BTC', read: (d) => d.liveBitcoin?.price },
		{ id: 'SPX', read: (d) => d.spx?.price },
		{ id: 'NDX', read: (d) => d.ndx?.price },
		{ id: 'DJI', read: (d) => d.dji?.price },
		{ id: 'UKX', read: (d) => d.ftse?.price },
		{ id: 'NSE', read: (d) => d.nse?.price },
		{ id: 'CSI', read: (d) => d.csi?.price },
		{ id: 'GC', read: (d) => d.gold?.price },
		{ id: 'SI', read: (d) => d.silver?.price },
		{ id: 'BZ', read: (d) => d.crude?.price },
		{ id: 'DXY', read: (d) => d.dxy?.price },
		{ id: 'USDJPY', read: (d) => d.usdjpy?.price },
		{ id: 'USDINR', read: (d) => d.usdinr?.price },
		{ id: 'EFFR', read: (d) => d.effr?.price },
		{ id: 'SOFR', read: (d) => d.sofr?.price },
		{ id: '3M', read: (d) => d.us3m?.price },
		{ id: 'US2Y', read: (d) => d.us2y?.price },
		{ id: 'US10Y', read: (d) => d.us10y?.price },
		{ id: 'US30Y', read: (d) => d.us30y?.price },
		{ id: '2s10s', read: (d) => d.spread2s10s?.price },
		{ id: '10s30s', read: (d) => d.spread10s30s?.price },
		{ id: 'DE10Y', read: (d) => d.de10y?.price },
		{ id: 'JP10Y', read: (d) => d.jp10y?.price },
		{ id: 'AU10Y', read: (d) => d.au10y?.price }
	];

	const MACRO_DATA_KEYS = [
		'uscpi',
		'uscpicore',
		'uspce',
		'usnfp',
		'usur',
		'usgdp'
	] as const;

	const MACRO_FLASH_KEYS: Record<(typeof MACRO_DATA_KEYS)[number], string> = {
		uscpi: 'MACRO_CPI',
		uscpicore: 'MACRO_CORE_CPI',
		uspce: 'MACRO_PCE',
		usnfp: 'MACRO_NFP',
		usur: 'MACRO_UR',
		usgdp: 'MACRO_GDP'
	};

	const MACRO_OUT_FLASH_KEYS: Record<(typeof MACRO_DATA_KEYS)[number], string> = {
		uscpi: 'MACRO_CPI_OUT',
		uscpicore: 'MACRO_CORE_CPI_OUT',
		uspce: 'MACRO_PCE_OUT',
		usnfp: 'MACRO_NFP_OUT',
		usur: 'MACRO_UR_OUT',
		usgdp: 'MACRO_GDP_OUT'
	};

	const macroOutcomeBlink = (status: MacroStatus | null | undefined): FlashDirection => {
		if (status === 'EXP. BEAT' || status === 'COOL MISS') return 'up';
		if (status === 'HOT BEAT' || status === 'MISS') return 'down';
		return null;
	};

	const marketsSource = $derived(data.dataSources?.markets);
	const macroSource = $derived(data.dataSources?.macro);
	const centralBanksSource = $derived(data.dataSources?.centralBanks);

	const setFlash = (id: string, direction: 'up' | 'down') => {
		const existing = flashTimeouts.get(id);
		if (existing) {
			clearTimeout(existing);
		}

		flashStates = { ...flashStates, [id]: direction };

		flashTimeouts.set(
			id,
			setTimeout(() => {
				flashStates = { ...flashStates, [id]: null };
				flashTimeouts.delete(id);
			}, 800)
		);
	};

	const prevMacroSnapshots: Record<string, { actual: number; change: number }> = {};

	$effect(() => {
		for (const { id, read } of PRICE_TRACKERS) {
			const newPrice = read(data);
			if (typeof newPrice !== 'number') {
				continue;
			}

			const cached = prevPrices[id];
			if (cached !== undefined && newPrice !== cached) {
				setFlash(id, newPrice > cached ? 'up' : 'down');
			}

			prevPrices[id] = newPrice;
		}

		for (const key of MACRO_DATA_KEYS) {
			const block = data?.[key];
			if (!block) {
				continue;
			}

			const flashKey = MACRO_FLASH_KEYS[key];
			const snap = prevMacroSnapshots[key];

			if (snap) {
				if (block.price !== snap.actual) {
					setFlash(flashKey, block.price > snap.actual ? 'up' : 'down');
					const outcomeBlink = macroOutcomeBlink(block.status);
					const outKey = MACRO_OUT_FLASH_KEYS[key];
					if (outcomeBlink === 'up') {
						setFlash(outKey, 'up');
					} else if (outcomeBlink === 'down') {
						setFlash(outKey, 'down');
					}
				}
				if (block.changeFromPrior !== snap.change) {
					setFlash(
						`${flashKey}_CHG`,
						block.changeFromPrior > snap.change ? 'up' : 'down'
					);
				}
			}

			prevMacroSnapshots[key] = {
				actual: block.price,
				change: block.changeFromPrior
			};
		}
	});

	type UsRateKey = 'EFFR' | 'SOFR' | '3M' | 'US2Y' | 'US10Y' | 'US30Y';

	const US_RATE_KEYS: UsRateKey[] = ['EFFR', 'SOFR', '3M', 'US2Y', 'US10Y', 'US30Y'];

	const US_RATES = $derived({
		EFFR: {
			label: 'EFFR',
			yield: data?.effr?.price ?? 3.65,
			change: data?.effr?.change ?? 0
		},
		SOFR: {
			label: 'SOFR',
			yield: data?.sofr?.price ?? 3.65,
			change: data?.sofr?.changePct ?? 0.02
		},
		'3M': {
			label: 'US 3-Month T-Bill',
			yield: data?.us3m?.price ?? 4.15,
			change: data?.us3m?.changePct ?? 0.09
		},
		US2Y: {
			label: 'US 2-Year Treasury',
			yield: data?.us2y?.price ?? 4.38,
			change: data?.us2y?.changePct ?? -0.46
		},
		US10Y: {
			label: 'US 10-Year Treasury',
			yield: data?.us10y?.price ?? 4.43,
			change: data?.us10y?.changePct ?? -0.9
		},
		US30Y: {
			label: 'US 30-Year Treasury',
			yield: data?.us30y?.price ?? 4.95,
			change: data?.us30y?.changePct ?? -0.61
		}
	});

	type PriceFormat = 'index' | 'usd' | 'fx';

	type PricedAsset = {
		symbol: string;
		label: string;
		currentPrice: number;
		changePct: number;
		format: PriceFormat;
	};

	type YieldAsset = {
		symbol: string;
		label: string;
		currentYield: number;
		changePct: number;
	};

	const GLOBAL_EQUITIES = $derived<PricedAsset[]>([
		{
			symbol: 'SPX',
			label: 'S&P 500',
			currentPrice: data?.spx?.price ?? 5300.25,
			changePct: data?.spx?.changePct ?? 0.45,
			format: 'index'
		},
		{
			symbol: 'NDX',
			label: 'NASDAQ 100',
			currentPrice: data?.ndx?.price ?? 18500.5,
			changePct: data?.ndx?.changePct ?? 0.62,
			format: 'index'
		},
		{
			symbol: 'DJI',
			label: 'Dow Jones',
			currentPrice: data?.dji?.price ?? 39120.0,
			changePct: data?.dji?.changePct ?? -0.12,
			format: 'index'
		},
		{
			symbol: 'UKX',
			label: 'FTSE 100',
			currentPrice: data?.ftse?.price ?? 8230.1,
			changePct: data?.ftse?.changePct ?? 0.18,
			format: 'index'
		},
		{
			symbol: 'NSE',
			label: 'Nifty 50',
			currentPrice: data?.nse?.price ?? 23200.4,
			changePct: data?.nse?.changePct ?? -0.7,
			format: 'index'
		},
		{
			symbol: 'CSI',
			label: 'CSI 300',
			currentPrice: data?.csi?.price ?? 4104.33,
			changePct: data?.csi?.changePct ?? 0.55,
			format: 'index'
		}
	]);

	const COMMODITIES_FX = $derived<PricedAsset[]>([
		{
			symbol: 'GC',
			label: 'Gold',
			currentPrice: data?.gold?.price ?? 2345.6,
			changePct: data?.gold?.changePct ?? 0.61,
			format: 'usd'
		},
		{
			symbol: 'SI',
			label: 'Silver',
			currentPrice: data?.silver?.price ?? 29.45,
			changePct: data?.silver?.changePct ?? 1.2,
			format: 'usd'
		},
		{
			symbol: 'BZ',
			label: 'Brent Crude',
			currentPrice: data?.crude?.price ?? 78.45,
			changePct: data?.crude?.changePct ?? -1.41,
			format: 'usd'
		},
		{
			symbol: 'DXY',
			label: 'US Dollar Index',
			currentPrice: data?.dxy?.price ?? 104.65,
			changePct: data?.dxy?.changePct ?? 0.14,
			format: 'fx'
		},
		{
			symbol: 'USDJPY',
			label: 'USD/JPY',
			currentPrice: data?.usdjpy?.price ?? 156.2,
			changePct: data?.usdjpy?.changePct ?? 0.45,
			format: 'fx'
		},
		{
			symbol: 'USDINR',
			label: 'USD/INR',
			currentPrice: data?.usdinr?.price ?? 83.55,
			changePct: data?.usdinr?.changePct ?? -0.08,
			format: 'fx'
		}
	]);

	const BITCOIN = $derived.by(() => ({
		symbol: 'BTC',
		label: 'Bitcoin',
		currentPrice: data?.liveBitcoin?.price ?? 67500.0,
		changePct: data?.liveBitcoin?.changePct ?? 0.0
	}));

	const GLOBAL_SOVEREIGN = $derived<YieldAsset[]>([
		{
			symbol: 'DE10Y',
			label: 'Bunds 10Y (Germany)',
			currentYield: data?.de10y?.price ?? 2.45,
			changePct: data?.de10y?.changePct ?? -0.12
		},
		{
			symbol: 'JP10Y',
			label: 'JGB 10Y (Japan)',
			currentYield: data?.jp10y?.price ?? 1.02,
			changePct: data?.jp10y?.changePct ?? 0.05
		},
		{
			symbol: 'AU10Y',
			label: 'Australia 10Y',
			currentYield: data?.au10y?.price ?? 4.25,
			changePct: data?.au10y?.changePct ?? -0.47
		}
	]);

	type ChangeMode = 'pct' | 'abs';

	type Change = {
		mode: ChangeMode;
		value: number;
	};

	type Ticker = {
		symbol: string;
		label: string;
		value: string;
		change: Change;
	};

	type MarketSection = {
		id: string;
		title: string;
		items: Ticker[];
	};

	const fmtNum = (n: number, decimals: number) =>
		n.toLocaleString('en-US', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});

	const formatPricedDisplay = (asset: PricedAsset): string => {
		switch (asset.format) {
			case 'index':
				return fmtNum(asset.currentPrice, 2);
			case 'usd':
				return `$${fmtNum(asset.currentPrice, 2)}`;
			case 'fx':
				return fmtNum(asset.currentPrice, 2);
		}
	};

	const toPricedTicker = (asset: PricedAsset): Ticker => ({
		symbol: asset.symbol,
		label: asset.label,
		value: formatPricedDisplay(asset),
		change: { mode: 'pct', value: asset.changePct }
	});

	const toYieldTicker = (asset: YieldAsset): Ticker => ({
		symbol: asset.symbol,
		label: asset.label,
		value: `${asset.currentYield.toFixed(2)}%`,
		change: { mode: 'pct', value: asset.changePct }
	});

	const toUsRateTicker = (key: UsRateKey): Ticker => {
		const r = US_RATES[key];
		const pctChange =
			key === 'SOFR' || key === '3M' || key === 'US2Y' || key === 'US10Y' || key === 'US30Y';
		return {
			symbol: key,
			label: r.label,
			value: `${r.yield.toFixed(2)}%`,
			change: pctChange
				? { mode: 'pct', value: r.change }
				: { mode: 'abs', value: r.change }
		};
	};

	const bitcoinTicker = $derived.by((): Ticker => ({
		symbol: BITCOIN.symbol,
		label: BITCOIN.label,
		value: `$${fmtNum(BITCOIN.currentPrice, 2)}`,
		change: { mode: 'pct', value: BITCOIN.changePct }
	}));

	const usRatesSection = $derived<MarketSection>({
		id: 'usRatesFunding',
		title: 'US RATES & FUNDING',
		items: US_RATE_KEYS.map((key) => toUsRateTicker(key))
	});

	const equitiesSection = $derived<MarketSection>({
		id: 'globalEquities',
		title: 'GLOBAL EQUITIES',
		items: GLOBAL_EQUITIES.map((a) => toPricedTicker(a))
	});

	const commoditiesFxSection = $derived<MarketSection>({
		id: 'commoditiesFx',
		title: 'COMMODITIES & GLOBAL FX',
		items: COMMODITIES_FX.map((a) => toPricedTicker(a))
	});

	const sovereignSection = $derived<MarketSection>({
		id: 'globalSovereign',
		title: 'GLOBAL SOVEREIGN 10Y',
		items: GLOBAL_SOVEREIGN.map((a) => toYieldTicker(a))
	});

	const computedSpreadTickers = $derived<Ticker[]>([
		{
			symbol: '2s10s',
			label: '2s10s Spread',
			value: `${(data?.spread2s10s?.price ?? 0.05).toFixed(2)}%`,
			change: { mode: 'abs', value: data?.spread2s10s?.change ?? -0.02 }
		},
		{
			symbol: '10s30s',
			label: '10s30s Spread',
			value: `${(data?.spread10s30s?.price ?? 0.52).toFixed(2)}%`,
			change: { mode: 'abs', value: data?.spread10s30s?.change ?? 0.01 }
		}
	]);

	const primaryRow = $derived<MarketSection[]>([
		usRatesSection,
		equitiesSection,
		commoditiesFxSection
	]);

	const secondaryRow = $derived<MarketSection[]>([sovereignSection]);

	const fmtSigned = (n: number, digits = 2) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;

	const fmtChg = (c: Change) => {
		if (c.mode === 'pct') return `${fmtSigned(c.value, 2)}%`;
		return fmtSigned(c.value, 2);
	};

	const clsFor = (c: Change) => {
		if (c.value > 0) return 'text-emerald-500';
		if (c.value < 0) return 'text-rose-500';
		return 'text-zinc-300';
	};

	const chgDirection = (c: Change): 'up' | 'down' | 'flat' => {
		if (c.value > 0) return 'up';
		if (c.value < 0) return 'down';
		return 'flat';
	};

	const headerTime = () => {
		const d = new Date();
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		const ss = String(d.getSeconds()).padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	};

	const formatReleaseCountdown = (ms: number): string => {
		const totalSec = Math.floor(ms / 1000);
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		if (h >= 1) {
			return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
		}
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	};

	const buildMacroReleaseAlertLine = (): string => {
		const alerts = data.macroReleaseAlerts ?? [];
		if (alerts.length === 0) {
			return '';
		}

		const nowMs = Date.now();
		const segments = alerts
			.map((alert) => {
				const ms = Date.parse(alert.releaseAt) - nowMs;
				if (ms <= 0) {
					return null;
				}
				return `${alert.labels.join(' · ')} in ${formatReleaseCountdown(ms)}`;
			})
			.filter((segment): segment is string => segment !== null);

		if (segments.length === 0) {
			return '';
		}

		return `CRITICAL MACRO — ${segments.join(' · ')}`;
	};

	const formatZoneClock = (timeZone: string) =>
		new Date().toLocaleTimeString('en-GB', {
			timeZone,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});

	let nyTime = $state('');
	let lonTime = $state('');
	let delTime = $state('');
	let tokTime = $state('');
	let now = $state('');
	let macroReleaseAlertLine = $state('');
	let ustOpen = $state(false);

	const updateClocks = () => {
		const d = new Date();
		now = headerTime();
		macroReleaseAlertLine = buildMacroReleaseAlertLine();
		nyTime = formatZoneClock('America/New_York');
		lonTime = formatZoneClock('Europe/London');
		delTime = formatZoneClock('Asia/Kolkata');
		tokTime = formatZoneClock('Asia/Tokyo');

		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).formatToParts(d);

		const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
		const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00';
		const minuteStr = parts.find((p) => p.type === 'minute')?.value ?? '00';
		const hour = Number(hourStr);
		const minute = Number(minuteStr);

		const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
		const afterOpen = hour > 8 || (hour === 8 && minute >= 0);
		const beforeClose = hour < 17 || (hour === 17 && minute === 0);
		ustOpen = isWeekday && afterOpen && beforeClose;
	};

	const tickerItems = $derived([
		...primaryRow.flatMap((s) => s.items),
		...computedSpreadTickers,
		bitcoinTicker,
		...secondaryRow.flatMap((s) => s.items)
	]);

	onMount(() => {
		updateClocks();

		for (const key of MACRO_DATA_KEYS) {
			const status = data?.[key]?.status;
			const outKey = MACRO_OUT_FLASH_KEYS[key];
			const blink = macroOutcomeBlink(status);
			if (blink === 'up') {
				setFlash(outKey, 'up');
			} else if (blink === 'down') {
				setFlash(outKey, 'down');
			}
		}

		const clockInterval = setInterval(updateClocks, 1000);

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
			refreshInterval = setInterval(() => {
				invalidateAll();
			}, REFRESH_MS);
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
			clearInterval(clockInterval);
			stopRefresh();
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	onDestroy(() => {
		for (const timeout of flashTimeouts.values()) {
			clearTimeout(timeout);
		}
		flashTimeouts.clear();
	});
</script>

<main class="dash-page">
	<!-- Clock & Market Status banner -->
	<div class="clock-banner">
		<div class="mx-auto max-w-[1600px] px-4 py-1.5">
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-data text-zinc-400">
				<div class="flex items-center gap-3">
					<span class="text-zinc-200">NY <span class="text-zinc-500">·</span> {nyTime}</span>
					<span class="text-zinc-600">|</span>
					<span>LDN <span class="text-zinc-500">·</span> {lonTime}</span>
					<span class="text-zinc-600">|</span>
					<span>TKY <span class="text-zinc-500">·</span> {tokTime}</span>
					<span class="text-zinc-600">|</span>
					<span>DEL <span class="text-zinc-500">·</span> {delTime}</span>
				</div>

				<div class="ml-auto flex items-center gap-2">
					<span
						class={'status-dot ' + (ustOpen ? 'status-dot--open' : 'status-dot--closed')}
						aria-hidden="true"
					></span>
					<span class={ustOpen ? 'text-emerald-400 font-medium' : 'text-rose-400/80'}>
						US TREASURY: {ustOpen ? 'OPEN' : 'CLOSED'}
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Sticky summary ribbon -->
	<div class="dash-ribbon">
		<div class="mx-auto max-w-[1600px] px-4 py-2.5">
			<div class="relative flex items-center gap-3 min-h-[22px]">
				<div class="dash-title">
					<span class="dash-title-accent" aria-hidden="true"></span>
					<span class="dash-title-text">Global Macro Dashboard</span>
				</div>

				{#if macroReleaseAlertLine}
					<div
						class="macro-release-alert pointer-events-none absolute left-1/2 max-w-[50vw] -translate-x-1/2 truncate text-center text-[11px] font-data uppercase tracking-wider"
						aria-live="polite"
					>
						{macroReleaseAlertLine}
					</div>
				{/if}

				<div class="ml-auto flex items-center gap-3 text-[11px]">
					<span class="hidden sm:inline text-zinc-500 uppercase tracking-wider">Local</span>
					<span class="font-data text-zinc-200 tabular-nums">{now}</span>
					<div class="h-3 w-px bg-zinc-700/60"></div>
					<div class="fomc-chip">
						<span class="text-amber-500/80 font-semibold tracking-wide">FOMC</span>
						<span class="text-zinc-500">[Kalshi]</span>
						<span>{data.fedWatch.meetingDate}</span>
						<StatusPill kind="fed" action={data.fedWatch.action} />
						<span class="text-zinc-400">({data.fedWatch.probability})</span>
					</div>
				</div>
			</div>

			<div class="ribbon-divider" aria-hidden="true"></div>

			<div class="mt-2.5 ticker" aria-label="Market summary ticker">
				<div class="tickerMask">
					<div class="tickerTrack">
						{#each tickerItems as r (r.symbol)}
							<div class="tick">
								<div class="tickSym">{r.symbol}</div>
								<div
									class="tickVal font-data price-flash"
									class:blink-green={flashStates[r.symbol] === 'up'}
									class:blink-red={flashStates[r.symbol] === 'down'}
								>
									{r.value}
								</div>
								<div class={'tickChg font-data ' + clsFor(r.change)}>
									{fmtChg(r.change)}
								</div>
							</div>
						{/each}
					</div>
					<div class="tickerTrack" aria-hidden="true">
						{#each tickerItems as r (r.symbol + '__dup')}
							<div class="tick">
								<div class="tickSym">{r.symbol}</div>
								<div
									class="tickVal font-data price-flash"
									class:blink-green={flashStates[r.symbol] === 'up'}
									class:blink-red={flashStates[r.symbol] === 'down'}
								>
									{r.value}
								</div>
								<div class={'tickChg font-data ' + clsFor(r.change)}>
									{fmtChg(r.change)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>

	<PolicyStrip centralBanks={data.centralBanks} {centralBanksSource} />

	<div class="mx-auto max-w-[1600px] px-4 pb-8 pt-4">
		<div class="dashboardLayout">
			<div class="blocksStack">
				<div class="blocksRow blocksRowPrimary" role="region" aria-label="Primary market panels">
					{#each primaryRow as section (section.id)}
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

				<div class="blocksRow blocksRowSecondary" role="region" aria-label="Secondary market panels">
					<Panel
						title="YIELD SPREADS & CRYPTO"
						source={marketsSource}
						id="yield-spreads-heading"
					>
						{#each computedSpreadTickers as item (item.symbol)}
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
							symbol={BITCOIN.symbol}
							label={BITCOIN.label}
							value={'$' + fmtNum(BITCOIN.currentPrice, 2)}
							changeText={fmtSigned(BITCOIN.changePct, 2) + '%'}
							changeDirection={chgDirection({ mode: 'pct', value: BITCOIN.changePct })}
							flashUp={flashStates[BITCOIN.symbol] === 'up'}
							flashDown={flashStates[BITCOIN.symbol] === 'down'}
						/>
					</Panel>

					{#each secondaryRow as section (section.id)}
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
						us3mYield={US_RATES['3M'].yield}
						us2yYield={US_RATES.US2Y.yield}
						us10yYield={US_RATES.US10Y.yield}
						us30yYield={US_RATES.US30Y.yield}
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
	</div>
</main>

<style>
	.clock-banner {
		border-bottom: 1px solid var(--color-border-subtle);
		background: rgba(9, 9, 11, 0.6);
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
	}

	.status-dot--open {
		background: #6ee7b7;
		box-shadow: 0 0 8px rgba(110, 231, 183, 0.5);
		animation: pulse 2s ease-in-out infinite;
	}

	.status-dot--closed {
		background: rgba(251, 113, 133, 0.55);
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

	.ticker {
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		background: rgba(9, 9, 11, 0.35);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
	}

	.tickerMask {
		position: relative;
		overflow: hidden;
		white-space: nowrap;
		padding: 7px 8px;
	}

	.tickerMask::before,
	.tickerMask::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 32px;
		pointer-events: none;
		z-index: 2;
	}

	.tickerMask::before {
		left: 0;
		background: linear-gradient(to right, rgba(9, 9, 11, 0.95), transparent);
	}

	.tickerMask::after {
		right: 0;
		background: linear-gradient(to left, rgba(9, 9, 11, 0.95), transparent);
	}

	.tickerTrack {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		will-change: transform;
		animation: tickerScroll 42s linear infinite;
	}

	.ticker:hover .tickerTrack {
		animation-play-state: paused;
	}

	@keyframes tickerScroll {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-100%);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.tick {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		background: rgba(24, 24, 27, 0.55);
		padding: 4px 10px;
		transition: border-color 150ms ease;
	}

	.tick:hover {
		border-color: rgba(245, 158, 11, 0.2);
	}

	.tickSym {
		font-family: var(--font-data);
		color: var(--color-accent-cyan);
		opacity: 0.75;
		letter-spacing: 0.08em;
		font-size: 10px;
	}

	.tickVal {
		color: var(--color-text-primary);
		letter-spacing: 0.02em;
		font-weight: 600;
	}

	.tickChg {
		letter-spacing: 0.02em;
		transition: color 150ms ease;
	}
</style>

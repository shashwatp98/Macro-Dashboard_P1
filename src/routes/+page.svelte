<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { MacroBlock, MacroStatus } from './+page.server';

	let { data }: { data: PageData } = $props();

	type FlashDirection = 'up' | 'down' | null;

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

	const macroOutcomeIsRed = (status: MacroStatus | null | undefined): boolean =>
		status === 'HOT BEAT' || status === 'MISS';

	const macroOutcomeIsGreen = (status: MacroStatus | null | undefined): boolean =>
		status === 'EXP. BEAT' || status === 'COOL MISS';

	const macroOutcomeBlink = (status: MacroStatus | null | undefined): 'up' | 'down' | null => {
		if (macroOutcomeIsGreen(status)) {
			return 'up';
		}
		if (macroOutcomeIsRed(status)) {
			return 'down';
		}
		return null;
	};

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

	// ---------------------------------------------------------------------------
	// MARKET DATA — single source of truth (V1 mock; swap for API/store later)
	// ---------------------------------------------------------------------------

	type UsRateKey = 'EFFR' | 'SOFR' | '3M' | 'US2Y' | 'US10Y' | 'US30Y';

	const US_RATE_KEYS: UsRateKey[] = ['EFFR', 'SOFR', '3M', 'US2Y', 'US10Y', 'US30Y'];

	/** US rates & funding — Yahoo 10Y/30Y + TradingView EFFR/SOFR/2Y/3M */
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

	const CURVE_TENORS: { key: UsRateKey; tenor: string }[] = [
		{ key: '3M', tenor: '3M' },
		{ key: 'US2Y', tenor: '2Y' },
		{ key: 'US10Y', tenor: '10Y' },
		{ key: 'US30Y', tenor: '30Y' }
	];

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

	/** Global equities — live quotes from server load */
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

	/** Commodities & FX — live quotes from server load */
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

	/** Bitcoin — daily % vs prior close; maps directly to server load (no client-side math) */
	const BITCOIN = $derived.by(() => ({
		symbol: 'BTC',
		label: 'Bitcoin',
		currentPrice: data?.liveBitcoin?.price ?? 67500.0,
		changePct: data?.liveBitcoin?.changePct ?? 0.0
	}));

	const bitcoinTicker = $derived.by((): Ticker => ({
		symbol: BITCOIN.symbol,
		label: BITCOIN.label,
		value: `$${fmtNum(BITCOIN.currentPrice, 2)}`,
		change: { mode: 'pct', value: BITCOIN.changePct }
	}));

	/** Global sovereign 10Y — live Yahoo yields (^GD10Y, ^GJ10Y, ^GA10Y) */
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

	const MARKET_DATA = {
		layout: {
			primaryRow: ['usRatesFunding', 'globalEquities', 'commoditiesFx'] as const,
			secondaryRow: ['globalSovereign'] as const
		},
		sections: {
			usRatesFunding: {
				title: 'US RATES & FUNDING'
			},
			yieldSpreads: {
				title: 'YIELD SPREADS & CRYPTO'
			},
			globalSovereign: {
				title: 'GLOBAL SOVEREIGN 10Y'
			},
			globalEquities: {
				title: 'GLOBAL EQUITIES'
			},
			commoditiesFx: {
				title: 'COMMODITIES & GLOBAL FX'
			}
		}
	} as const;

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

	type CurvePoint = {
		tenor: string;
		yield: number;
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

	const usRatesSection = $derived<MarketSection>({
		id: 'usRatesFunding',
		title: MARKET_DATA.sections.usRatesFunding.title,
		items: US_RATE_KEYS.map((key) => toUsRateTicker(key))
	});

	const equitiesSection = $derived<MarketSection>({
		id: 'globalEquities',
		title: MARKET_DATA.sections.globalEquities.title,
		items: GLOBAL_EQUITIES.map((a) => toPricedTicker(a))
	});

	const commoditiesFxSection = $derived<MarketSection>({
		id: 'commoditiesFx',
		title: MARKET_DATA.sections.commoditiesFx.title,
		items: COMMODITIES_FX.map((a) => toPricedTicker(a))
	});

	const sovereignSection = $derived<MarketSection>({
		id: 'globalSovereign',
		title: MARKET_DATA.sections.globalSovereign.title,
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

	const spreadsAndCryptoItems = $derived<Ticker[]>([
		...computedSpreadTickers,
		bitcoinTicker
	]);

	const primaryRow = $derived<MarketSection[]>([
		usRatesSection,
		equitiesSection,
		commoditiesFxSection
	]);

	const secondaryRow = $derived<MarketSection[]>([sovereignSection]);

	const curve = $derived<CurvePoint[]>(
		CURVE_TENORS.map(({ key, tenor }) => ({
			tenor,
			yield: US_RATES[key].yield
		}))
	);

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

	const fmtMacroPctDelta = (value: number | undefined) => {
		const v = value ?? 0;
		return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
	};

	const fmtMacroJobsDelta = (value: number | undefined) => {
		const v = value ?? 0;
		return `${v >= 0 ? '+' : ''}${Math.round(v)}K`;
	};

	const w = 720;
	const h = 180;
	const padX = 16;
	const padY = 14;

	const minY = $derived(Math.min(...curve.map((p) => p.yield)));
	const maxY = $derived(Math.max(...curve.map((p) => p.yield)));
	const rangeY = $derived(Math.max(0.0001, maxY - minY));

	const xAt = (i: number, len: number) => padX + (i * (w - padX * 2)) / Math.max(1, len - 1);
	const yAt = (v: number, min: number, range: number) => {
		const t = (v - min) / range;
		return padY + (1 - t) * (h - padY * 2);
	};

	const pathD = $derived(
		curve
			.map(
				(p, i) =>
					`${i === 0 ? 'M' : 'L'} ${xAt(i, curve.length).toFixed(2)} ${yAt(p.yield, minY, rangeY).toFixed(2)}`
			)
			.join(' ')
	);

	const invLevel = $derived((US_RATES.US10Y.yield - US_RATES.US2Y.yield) * 100);

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
		...spreadsAndCryptoItems,
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
		const refreshInterval = setInterval(() => {
			invalidateAll();
		}, 15000);

		return () => {
			clearInterval(clockInterval);
			clearInterval(refreshInterval);
		};
	});

	onDestroy(() => {
		for (const timeout of flashTimeouts.values()) {
			clearTimeout(timeout);
		}
		flashTimeouts.clear();
	});
</script>

<main class="min-h-screen bg-zinc-950 text-zinc-100">
	<!-- Clock & Market Status banner -->
	<div class="border-b border-zinc-800 bg-zinc-950">
		<div class="mx-auto max-w-[1600px] px-3 py-1">
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-zinc-300">
				<div class="flex items-center gap-3">
					<span class="text-zinc-200">NY: {nyTime}</span>
					<span class="text-zinc-500">|</span>
					<span>LDN: {lonTime}</span>
					<span class="text-zinc-500">|</span>
					<span>TKY: {tokTime}</span>
					<span class="text-zinc-500">|</span>
					<span>DEL: {delTime}</span>
				</div>

				<div class="ml-auto flex items-center gap-2">
					<span
						class={
							'h-1.5 w-1.5 rounded-full ' +
							(ustOpen ? 'bg-emerald-300 animate-pulse' : 'bg-rose-400/60')
						}
						aria-hidden="true"
					/>
					<span class={ustOpen ? 'text-emerald-300' : 'text-rose-300'}>
						US TREASURY: {ustOpen ? 'OPEN' : 'CLOSED'}
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Top summary ticker -->
	<div class="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
		<div class="mx-auto max-w-[1600px] px-3 py-2">
			<div class="relative flex items-center gap-3">
				<div class="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
					Global Macro Dashboard
				</div>
				{#if macroReleaseAlertLine}
					<div
						class="macro-release-alert pointer-events-none absolute left-1/2 max-w-[50vw] -translate-x-1/2 truncate text-center text-[11px] font-mono uppercase tracking-wider text-rose-400"
						aria-live="polite"
					>
						{macroReleaseAlertLine}
					</div>
				{/if}
				<div class="ml-auto flex items-center gap-3 text-[11px] text-zinc-400">
					<div class="hidden sm:block">LOCAL</div>
					<div class="font-mono text-zinc-200">{now}</div>
					<div class="h-3 w-px bg-zinc-800"></div>
					<div class="font-mono text-[11px] text-zinc-400">
						FOMC [Kalshi] {data.fedWatch.meetingDate}:
						<span
							class="font-mono font-bold"
							class:text-emerald-400={data.fedWatch.action === '25bps CUT'}
							class:text-neutral-200={data.fedWatch.action === 'HOLD'}
							class:text-rose-400={data.fedWatch.action === '25bps HIKE'}
						>
							{data.fedWatch.action} ({data.fedWatch.probability})
						</span>
					</div>
				</div>
			</div>

			<div class="mt-2 ticker" aria-label="Market summary ticker">
				<div class="tickerMask">
					<div class="tickerTrack">
						{#each tickerItems as r (r.symbol)}
							<div class="tick">
								<div class="tickSym">{r.symbol}</div>
								<div
									class="tickVal font-mono price-flash"
									class:blink-green={flashStates[r.symbol] === 'up'}
									class:blink-red={flashStates[r.symbol] === 'down'}
								>
									{r.value}
								</div>
								<div class={"tickChg font-mono " + clsFor(r.change)}>
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
									class="tickVal font-mono price-flash"
									class:blink-green={flashStates[r.symbol] === 'up'}
									class:blink-red={flashStates[r.symbol] === 'down'}
								>
									{r.value}
								</div>
								<div class={"tickChg font-mono " + clsFor(r.change)}>
									{fmtChg(r.change)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>

	<div
		class="w-full flex flex-nowrap overflow-x-auto select-none scrollbar-none items-center gap-3 bg-neutral-900/50 border-b border-neutral-800 p-2 px-4 mb-4"
		aria-label="Global policy rates"
	>
		<span
			class="shrink-0 text-xs font-bold uppercase tracking-wider text-neutral-400 mr-2 border-r border-neutral-700 pr-3"
			>POLICY RATES:</span
		>
		<div class="flex shrink-0 items-center gap-1.5 text-xs">
			<span class="text-neutral-400 font-medium">FED</span>
			<span class="font-mono font-bold text-neutral-100">{data.centralBanks.us}%</span>
		</div>
		<div class="flex shrink-0 items-center gap-1.5 text-xs">
			<span class="text-neutral-400 font-medium">ECB</span>
			<span class="font-mono font-bold text-neutral-100">{data.centralBanks.eu}%</span>
		</div>
		<div class="flex shrink-0 items-center gap-1.5 text-xs">
			<span class="text-neutral-400 font-medium">RBI</span>
			<span class="font-mono font-bold text-neutral-100">{data.centralBanks.in}%</span>
		</div>
		<div class="flex shrink-0 items-center gap-1.5 text-xs">
			<span class="text-neutral-400 font-medium">BOJ</span>
			<span class="font-mono font-bold text-neutral-100">{data.centralBanks.jp}%</span>
		</div>
		<div class="flex shrink-0 items-center gap-1.5 text-xs">
			<span class="text-neutral-400 font-medium">BoC</span>
			<span class="font-mono font-bold text-neutral-100">{data.centralBanks.ca}%</span>
		</div>
		<div class="flex shrink-0 items-center gap-1.5 text-xs">
			<span class="text-neutral-400 font-medium">BoE</span>
			<span class="font-mono font-bold text-neutral-100">{data.centralBanks.gb}%</span>
		</div>
		<div class="flex shrink-0 items-center gap-1.5 text-xs">
			<span class="text-neutral-400 font-medium">RBA</span>
			<span class="font-mono font-bold text-neutral-100">{data.centralBanks.au}%</span>
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-3 pb-6 pt-3">
		<div class="dashboardLayout">
			<div class="blocksStack">
				<div class="blocksRow blocksRowPrimary">
					{#each primaryRow as section (section.id)}
						{@render sectionPanel(section)}
					{/each}
				</div>
				<div class="blocksRow blocksRowSecondary">
					<section class="sectionPanel border border-zinc-800">
						<div class="sectionBand">
							<h2 class="sectionHeading">{MARKET_DATA.sections.yieldSpreads.title}</h2>
						</div>
						<div class="sectionBody">
							<div class="tickerGrid">
								{#each computedSpreadTickers as item (item.symbol)}
									<div class="tickerCard border border-zinc-800">
										<div class="tickerCardTop">
											<span class="tickerSym">{item.symbol}</span>
											<span class={"tickerChg font-mono " + clsFor(item.change)}>{fmtChg(item.change)}</span>
										</div>
										<div class="tickerLbl">{item.label}</div>
										<div
											class="tickerVal font-mono price-flash"
											class:blink-green={flashStates[item.symbol] === 'up'}
											class:blink-red={flashStates[item.symbol] === 'down'}
										>
											{item.value}
										</div>
									</div>
								{/each}
								<div class="tickerCard border border-zinc-800">
									<div class="tickerCardTop">
										<span class="tickerSym">{BITCOIN.symbol}</span>
										<span
											class={
												'tickerChg font-mono ' +
												clsFor({ mode: 'pct', value: BITCOIN.changePct })
											}
										>
											{fmtSigned(BITCOIN.changePct, 2)}%
										</span>
									</div>
									<div class="tickerLbl">{BITCOIN.label}</div>
									<div
										class="tickerVal font-mono price-flash"
										class:blink-green={flashStates[BITCOIN.symbol] === 'up'}
										class:blink-red={flashStates[BITCOIN.symbol] === 'down'}
									>
										${fmtNum(BITCOIN.currentPrice, 2)}
									</div>
								</div>
							</div>
						</div>
					</section>
					{#each secondaryRow as section (section.id)}
						{@render sectionPanel(section)}
					{/each}
				</div>
			</div>

			<!-- Yield Curve + US Macro -->
			<section class="curveMacroRow grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div class="curveCol min-w-0">
					<div class="widget border border-zinc-800 h-full">
						<div class="widgetHeader">
							<div class="widgetTitle">Yield Curve Monitor</div>
							<div class="widgetMeta">UST curve — 3M / 2Y / 10Y / 30Y</div>
						</div>
						<div class="widgetBody">
							<div class="curveWrap border border-zinc-800">
								<svg
									viewBox={`0 0 ${w} ${h}`}
									class="curveSvg"
									role="img"
									aria-label="Yield curve line chart"
								>
									<defs>
										<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
											<stop offset="0%" stop-color="rgb(16 185 129)" stop-opacity="0.45" />
											<stop offset="55%" stop-color="rgb(52 211 153)" stop-opacity="0.5" />
											<stop offset="100%" stop-color="rgb(244 63 94)" stop-opacity="0.55" />
										</linearGradient>
									</defs>

									{#each Array.from({ length: 6 }) as _, i (i)}
										<line
											x1={padX}
											y1={padY + (i * (h - padY * 2)) / 5}
											x2={w - padX}
											y2={padY + (i * (h - padY * 2)) / 5}
											class="curveGrid"
										/>
									{/each}

									<path d={pathD} fill="none" stroke="url(#g)" stroke-width="2.2" stroke-linecap="round" />

									{#each curve as p, i (p.tenor)}
										<circle
											cx={xAt(i, curve.length)}
											cy={yAt(p.yield, minY, rangeY)}
											r="2.4"
											class="curvePt"
										/>
									{/each}
								</svg>

								<div class="tenors">
									{#each curve as p (p.tenor)}
										<div class="tenor font-mono">{p.tenor}</div>
									{/each}
								</div>
							</div>

							<div class="mt-3 grid grid-cols-2 gap-2">
								{#each curve as p (p.tenor + '-kpi')}
									<div class="miniKpi border border-zinc-800">
										<div class="k">{p.tenor}</div>
										<div class="v font-mono">{p.yield.toFixed(2)}%</div>
									</div>
								{/each}
							</div>

							<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
								<div class="badge border border-zinc-800">
									<span class="bKey">2s10s</span>
									<span class={"bVal font-mono " + clsFor({ mode: 'abs', value: invLevel })}>
										{invLevel.toFixed(1)}bp
									</span>
								</div>
								<div class="badge border border-zinc-800">
									<span class="bKey">RANGE</span>
									<span class="bVal font-mono">{minY.toFixed(2)}–{maxY.toFixed(2)}%</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="macroCol min-w-0">
					<div class="widget border border-zinc-800 h-full">
						<div class="widgetHeader">
							<div class="widgetTitle">US Macro Data Blocks</div>
							<div class="widgetMeta">Actual vs consensus — FRED prints</div>
						</div>
						<div class="widgetBody macroBody">
							<div class="macroTableWrap border border-zinc-800">
								<table class="macroTable w-full table-fixed">
									<thead>
										<tr>
											<th scope="col" class="w-[30%] p-3 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500"
												>INDICATOR</th
											>
											<th scope="col" class="w-[15%] p-3 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500"
												>ACTUAL</th
											>
											<th scope="col" class="w-[20%] p-3 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500"
												>Δ VS PRIOR</th
											>
											<th scope="col" class="w-[15%] p-3 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500"
												>FORECAST</th
											>
											<th scope="col" class="w-[20%] p-3 text-right text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-500"
												>OUTCOME</th
											>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td class="p-3 text-left font-medium">
												US CPI<br /><span class="text-xs text-neutral-500">YoY</span>
											</td>
											<td class="p-3 text-right font-mono font-bold">
												{data?.uscpi?.price.toFixed(2)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{fmtMacroPctDelta(data?.uscpi?.changeFromPrior)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{data?.uscpi?.forecast.toFixed(2)}%
											</td>
											<td class="p-3 text-right">
												<span
													class="macroOutcome font-mono font-bold tracking-wider price-flash"
													class:text-rose-500={data?.uscpi?.status === 'HOT BEAT' ||
														data?.uscpi?.status === 'MISS'}
													class:text-emerald-500={data?.uscpi?.status === 'EXP. BEAT' ||
														data?.uscpi?.status === 'COOL MISS'}
													class:blink-green={macroOutcomeBlink(data?.uscpi?.status) === 'up' &&
														flashStates.MACRO_CPI_OUT === 'up'}
													class:blink-red={macroOutcomeBlink(data?.uscpi?.status) === 'down' &&
														flashStates.MACRO_CPI_OUT === 'down'}
												>
													{data?.uscpi?.status}
												</span>
											</td>
										</tr>
										<tr>
											<td class="p-3 text-left font-medium">
												Core CPI<br /><span class="text-xs text-neutral-500">YoY</span>
											</td>
											<td class="p-3 text-right font-mono font-bold">
												{data?.uscpicore?.price.toFixed(2)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{fmtMacroPctDelta(data?.uscpicore?.changeFromPrior)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{data?.uscpicore?.forecast.toFixed(2)}%
											</td>
											<td class="p-3 text-right">
												<span
													class="macroOutcome font-mono font-bold tracking-wider price-flash"
													class:text-rose-500={data?.uscpicore?.status === 'HOT BEAT' ||
														data?.uscpicore?.status === 'MISS'}
													class:text-emerald-500={data?.uscpicore?.status === 'EXP. BEAT' ||
														data?.uscpicore?.status === 'COOL MISS'}
													class:blink-green={macroOutcomeBlink(data?.uscpicore?.status) ===
														'up' && flashStates.MACRO_CORE_CPI_OUT === 'up'}
													class:blink-red={macroOutcomeBlink(data?.uscpicore?.status) ===
														'down' && flashStates.MACRO_CORE_CPI_OUT === 'down'}
												>
													{data?.uscpicore?.status}
												</span>
											</td>
										</tr>
										<tr>
											<td class="p-3 text-left font-medium">
												Core PCE<br /><span class="text-xs text-neutral-500">YoY</span>
											</td>
											<td class="p-3 text-right font-mono font-bold">
												{data?.uspce?.price.toFixed(2)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{fmtMacroPctDelta(data?.uspce?.changeFromPrior)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{data?.uspce?.forecast.toFixed(2)}%
											</td>
											<td class="p-3 text-right">
												<span
													class="macroOutcome font-mono font-bold tracking-wider price-flash"
													class:text-rose-500={data?.uspce?.status === 'HOT BEAT' ||
														data?.uspce?.status === 'MISS'}
													class:text-emerald-500={data?.uspce?.status === 'EXP. BEAT' ||
														data?.uspce?.status === 'COOL MISS'}
													class:blink-green={macroOutcomeBlink(data?.uspce?.status) === 'up' &&
														flashStates.MACRO_PCE_OUT === 'up'}
													class:blink-red={macroOutcomeBlink(data?.uspce?.status) === 'down' &&
														flashStates.MACRO_PCE_OUT === 'down'}
												>
													{data?.uspce?.status}
												</span>
											</td>
										</tr>
										<tr>
											<td class="p-3 text-left font-medium">
												Nonfarm Payrolls<br /><span class="text-xs text-neutral-500"
													>Net Monthly Change</span
												>
											</td>
											<td class="p-3 text-right font-mono font-bold">
												{Math.round(data?.usnfp?.price ?? 0)}K
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{fmtMacroJobsDelta(data?.usnfp?.changeFromPrior)}
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{data?.usnfp?.forecast}K
											</td>
											<td class="p-3 text-right">
												<span
													class="macroOutcome font-mono font-bold tracking-wider price-flash"
													class:text-rose-500={data?.usnfp?.status === 'HOT BEAT' ||
														data?.usnfp?.status === 'MISS'}
													class:text-emerald-500={data?.usnfp?.status === 'EXP. BEAT' ||
														data?.usnfp?.status === 'COOL MISS'}
													class:blink-green={macroOutcomeBlink(data?.usnfp?.status) === 'up' &&
														flashStates.MACRO_NFP_OUT === 'up'}
													class:blink-red={macroOutcomeBlink(data?.usnfp?.status) === 'down' &&
														flashStates.MACRO_NFP_OUT === 'down'}
												>
													{data?.usnfp?.status}
												</span>
											</td>
										</tr>
										<tr>
											<td class="p-3 text-left font-medium">
												Unemployment Rate<br /><span class="text-xs text-neutral-500"
													>Spot Rate</span
												>
											</td>
											<td class="p-3 text-right font-mono font-bold">
												{data?.usur?.price.toFixed(2)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{fmtMacroPctDelta(data?.usur?.changeFromPrior)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{data?.usur?.forecast.toFixed(2)}%
											</td>
											<td class="p-3 text-right">
												<span
													class="macroOutcome font-mono font-bold tracking-wider price-flash"
													class:text-rose-500={data?.usur?.status === 'HOT BEAT' ||
														data?.usur?.status === 'MISS'}
													class:text-emerald-500={data?.usur?.status === 'EXP. BEAT' ||
														data?.usur?.status === 'COOL MISS'}
													class:blink-green={macroOutcomeBlink(data?.usur?.status) === 'up' &&
														flashStates.MACRO_UR_OUT === 'up'}
													class:blink-red={macroOutcomeBlink(data?.usur?.status) === 'down' &&
														flashStates.MACRO_UR_OUT === 'down'}
												>
													{data?.usur?.status}
												</span>
											</td>
										</tr>
										<tr>
											<td class="p-3 text-left font-medium">
												GDP<br /><span class="text-xs text-neutral-500">QoQ Ann.</span>
											</td>
											<td class="p-3 text-right font-mono font-bold">
												{data?.usgdp?.price.toFixed(2)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{fmtMacroPctDelta(data?.usgdp?.changeFromPrior)}%
											</td>
											<td class="p-3 text-right font-mono text-neutral-400">
												{data?.usgdp?.forecast.toFixed(2)}%
											</td>
											<td class="p-3 text-right">
												<span
													class="macroOutcome font-mono font-bold tracking-wider price-flash"
													class:text-rose-500={data?.usgdp?.status === 'HOT BEAT' ||
														data?.usgdp?.status === 'MISS'}
													class:text-emerald-500={data?.usgdp?.status === 'EXP. BEAT' ||
														data?.usgdp?.status === 'COOL MISS'}
													class:blink-green={macroOutcomeBlink(data?.usgdp?.status) === 'up' &&
														flashStates.MACRO_GDP_OUT === 'up'}
													class:blink-red={macroOutcomeBlink(data?.usgdp?.status) === 'down' &&
														flashStates.MACRO_GDP_OUT === 'down'}
												>
													{data?.usgdp?.status}
												</span>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</main>

{#snippet sectionPanel(section: MarketSection)}
	<section class="sectionPanel border border-zinc-800">
		<div class="sectionBand">
			<h2 class="sectionHeading">{section.title}</h2>
		</div>
		<div class="sectionBody">
			<div class="tickerGrid">
				{#each section.items as item (item.symbol)}
					<div class="tickerCard border border-zinc-800">
						<div class="tickerCardTop">
							<span class="tickerSym">{item.symbol}</span>
							<span class={"tickerChg font-mono " + clsFor(item.change)}>{fmtChg(item.change)}</span>
						</div>
						<div class="tickerLbl">{item.label}</div>
						<div
							class="tickerVal font-mono price-flash"
							class:blink-green={flashStates[item.symbol] === 'up'}
							class:blink-red={flashStates[item.symbol] === 'down'}
						>
							{item.value}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
{/snippet}

<style>
	:global(html) {
		background: #09090b;
	}

	.dashboardLayout {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.blocksStack {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.blocksRow {
		display: grid;
		gap: 8px;
		align-items: stretch;
		grid-template-columns: 1fr;
	}

	.blocksRowPrimary {
		grid-template-columns: 1fr;
	}

	@media (min-width: 768px) {
		.blocksRowPrimary {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.blocksRowSecondary {
		grid-template-columns: 1fr;
	}

	@media (min-width: 768px) {
		.blocksRowSecondary {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.sectionPanel {
		background: rgba(24, 24, 27, 0.78);
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.sectionBand {
		padding: 10px 10px 8px 10px;
		border-bottom: 1px solid rgb(39 39 42);
		background: rgba(0, 0, 0, 0.55);
	}

	.sectionHeading {
		margin: 0;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: rgb(228 228 231);
		line-height: 1.3;
	}

	.sectionBody {
		padding: 6px 8px 8px 8px;
		flex: 1;
	}

	.tickerGrid {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tickerCard {
		background: rgba(24, 24, 27, 0.65);
		padding: 6px 8px;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.tickerCardTop {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.tickerSym {
		font-size: 10px;
		letter-spacing: 0.1em;
		color: rgb(113 113 122);
		text-transform: uppercase;
	}

	.tickerLbl {
		font-size: 10px;
		color: rgb(161 161 170);
		margin-top: 2px;
		line-height: 1.25;
	}

	.tickerVal {
		font-size: 12px;
		color: rgb(250 250 250);
		margin-top: 4px;
		letter-spacing: 0.02em;
	}

	.price-flash {
		display: inline-block;
		border-radius: 2px;
		padding: 0 2px;
		will-change: background-color, color;
	}

	@keyframes flashGreen {
		0% {
			background-color: rgba(34, 197, 94, 0.4);
			color: #22c55e;
		}
		100% {
			background-color: transparent;
			color: rgb(250 250 250);
		}
	}

	@keyframes flashRed {
		0% {
			background-color: rgba(239, 68, 68, 0.4);
			color: #ef4444;
		}
		100% {
			background-color: transparent;
			color: rgb(250 250 250);
		}
	}

	:global(.blink-green) {
		animation: flashGreen 0.8s ease-out;
	}

	:global(.blink-red) {
		animation: flashRed 0.8s ease-out;
	}

	@keyframes macroReleasePulse {
		0%,
		100% {
			color: #ef4444;
			opacity: 1;
			text-shadow: 0 0 8px rgba(239, 68, 68, 0.35);
		}
		50% {
			color: #fca5a5;
			opacity: 0.65;
			text-shadow: none;
		}
	}

	:global(.macro-release-alert) {
		animation: macroReleasePulse 1.2s ease-in-out infinite;
	}

	.curveMacroRow {
		width: 100%;
	}

	.macroBody {
		padding: 6px 8px 8px 8px;
	}

	.macroTableWrap {
		background: rgba(9, 9, 11, 0.22);
		overflow-x: auto;
	}

	.macroTable {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		font-size: 11px;
	}

	.macroTable thead th {
		border-bottom: 1px solid rgb(39 39 42);
		vertical-align: bottom;
		white-space: nowrap;
	}

	.macroTable tbody td {
		border-bottom: 1px solid rgba(39, 39, 42, 0.65);
		vertical-align: middle;
	}

	.macroTable tbody td:first-child {
		white-space: normal;
		word-break: break-word;
	}

	.macroTable tbody td:not(:first-child) {
		white-space: nowrap;
	}

	.macroTable tbody tr:last-child td {
		border-bottom: none;
	}

	.macroTable tbody td:last-child {
		text-align: right;
	}

	:global(.macroTable .macroOutcome.price-flash) {
		display: inline-block;
		border-radius: 2px;
		padding: 0 2px;
	}

	:global(.macroTable .macroOutcome.price-flash.blink-green),
	:global(.macroTable .macroOutcome.price-flash.blink-red) {
		border-radius: 2px;
		padding: 0 2px;
	}

	.tickerChg {
		font-size: 11px;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.widget {
		background: rgba(24, 24, 27, 0.78);
	}

	.widgetHeader {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 10px 10px 8px 10px;
		border-bottom: 1px solid rgb(39 39 42);
		background: rgba(9, 9, 11, 0.35);
	}

	.widgetTitle {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.22em;
		color: rgb(212 212 216);
	}

	.widgetMeta {
		font-size: 11px;
		color: rgb(113 113 122);
	}

	.widgetBody {
		padding: 8px 10px 10px 10px;
	}

	.miniKpi {
		background: rgba(9, 9, 11, 0.22);
		padding: 8px 10px;
	}

	.miniKpi .k {
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgb(113 113 122);
	}

	.miniKpi .v {
		margin-top: 4px;
		font-size: 13px;
		color: rgb(244 244 245);
		letter-spacing: 0.02em;
	}

	.curveWrap {
		background: rgba(9, 9, 11, 0.2);
		padding: 10px 10px 8px 10px;
	}

	.curveSvg {
		width: 100%;
		height: auto;
		display: block;
	}

	.curveGrid {
		stroke: rgba(39, 39, 42, 0.65);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.curvePt {
		fill: rgb(244 244 245);
		opacity: 0.85;
	}

	.tenors {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
		margin-top: 8px;
	}

	.tenor {
		text-align: center;
		font-size: 10px;
		color: rgb(161 161 170);
		letter-spacing: 0.08em;
		border-top: 1px solid rgba(39, 39, 42, 0.7);
		padding-top: 6px;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: rgba(24, 24, 27, 0.5);
		padding: 4px 8px;
	}

	.bKey {
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgb(113 113 122);
	}

	.bVal {
		font-size: 11px;
		color: rgb(212 212 216);
	}

	.ticker {
		border: 1px solid rgb(39 39 42);
		background: rgba(9, 9, 11, 0.25);
	}

	.tickerMask {
		position: relative;
		overflow: hidden;
		white-space: nowrap;
		padding: 6px 6px;
	}

	.tickerMask::before,
	.tickerMask::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 28px;
		pointer-events: none;
		z-index: 2;
	}

	.tickerMask::before {
		left: 0;
		background: linear-gradient(to right, rgba(24, 24, 27, 0.95), rgba(24, 24, 27, 0));
	}

	.tickerMask::after {
		right: 0;
		background: linear-gradient(to left, rgba(24, 24, 27, 0.95), rgba(24, 24, 27, 0));
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

	@media (prefers-reduced-motion: reduce) {
		.tickerTrack {
			animation: none;
		}
	}

	.tick {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		border: 1px solid rgba(39, 39, 42, 0.9);
		background: rgba(24, 24, 27, 0.6);
		padding: 4px 8px;
	}

	.tickSym {
		color: rgb(113 113 122);
		letter-spacing: 0.08em;
	}

	.tickVal {
		color: rgb(244 244 245);
		letter-spacing: 0.02em;
	}

	.tickVal.price-flash {
		border-radius: 2px;
		padding: 0 2px;
	}

	.tickChg {
		letter-spacing: 0.02em;
	}
</style>

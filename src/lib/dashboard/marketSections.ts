import type { PageData } from '../../routes/$types';

export type ChangeMode = 'pct' | 'abs';

export type Change = {
	mode: ChangeMode;
	value: number;
};

export type Ticker = {
	symbol: string;
	label: string;
	value: string;
	change: Change;
};

export type MarketSection = {
	id: string;
	title: string;
	items: Ticker[];
};

export type UsRateKey = 'EFFR' | 'SOFR' | '3M' | 'US2Y' | 'US10Y' | 'US30Y';

export type PriceFormat = 'index' | 'usd' | 'fx';

export type PricedAsset = {
	symbol: string;
	label: string;
	currentPrice: number;
	changePct: number;
	format: PriceFormat;
};

export type YieldAsset = {
	symbol: string;
	label: string;
	currentYield: number;
	changePct: number;
};

export type UsRatesMap = Record<
	UsRateKey,
	{
		label: string;
		yield: number;
		change: number;
	}
>;

const US_RATE_KEYS: UsRateKey[] = ['EFFR', 'SOFR', '3M', 'US2Y', 'US10Y', 'US30Y'];

export const fmtNum = (n: number, decimals: number) =>
	n.toLocaleString('en-US', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	});

export const fmtSigned = (n: number, digits = 2) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;

export const fmtChg = (c: Change) => {
	if (c.mode === 'pct') return `${fmtSigned(c.value, 2)}%`;
	return fmtSigned(c.value, 2);
};

export const clsFor = (c: Change) => {
	if (c.value > 0) return 'text-emerald-500';
	if (c.value < 0) return 'text-rose-500';
	return 'text-zinc-300';
};

export const chgDirection = (c: Change): 'up' | 'down' | 'flat' => {
	if (c.value > 0) return 'up';
	if (c.value < 0) return 'down';
	return 'flat';
};

export const buildUsRates = (data: PageData): UsRatesMap => ({
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

const toUsRateTicker = (key: UsRateKey, usRates: UsRatesMap): Ticker => {
	const r = usRates[key];
	const pctChange =
		key === 'SOFR' || key === '3M' || key === 'US2Y' || key === 'US10Y' || key === 'US30Y';
	return {
		symbol: key,
		label: r.label,
		value: `${r.yield.toFixed(2)}%`,
		change: pctChange ? { mode: 'pct', value: r.change } : { mode: 'abs', value: r.change }
	};
};

export const buildMarketLayout = (data: PageData) => {
	const usRates = buildUsRates(data);

	const globalEquities: PricedAsset[] = [
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
	];

	const commoditiesFx: PricedAsset[] = [
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
	];

	const bitcoin = {
		symbol: 'BTC',
		label: 'Bitcoin',
		currentPrice: data?.liveBitcoin?.price ?? 67500.0,
		changePct: data?.liveBitcoin?.changePct ?? 0.0
	};

	const globalSovereign: YieldAsset[] = [
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
	];

	const computedSpreadTickers: Ticker[] = [
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
	];

	const primaryRow: MarketSection[] = [
		{
			id: 'usRatesFunding',
			title: 'US RATES & FUNDING',
			items: US_RATE_KEYS.map((key) => toUsRateTicker(key, usRates))
		},
		{
			id: 'globalEquities',
			title: 'GLOBAL EQUITIES',
			items: globalEquities.map((a) => toPricedTicker(a))
		},
		{
			id: 'commoditiesFx',
			title: 'COMMODITIES & GLOBAL FX',
			items: commoditiesFx.map((a) => toPricedTicker(a))
		}
	];

	const secondaryRow: MarketSection[] = [
		{
			id: 'globalSovereign',
			title: 'GLOBAL SOVEREIGN 10Y',
			items: globalSovereign.map((a) => toYieldTicker(a))
		}
	];

	const bitcoinTicker: Ticker = {
		symbol: bitcoin.symbol,
		label: bitcoin.label,
		value: `$${fmtNum(bitcoin.currentPrice, 2)}`,
		change: { mode: 'pct', value: bitcoin.changePct }
	};

	const tickerItems: Ticker[] = [
		...primaryRow.flatMap((s) => s.items),
		...computedSpreadTickers,
		bitcoinTicker,
		...secondaryRow.flatMap((s) => s.items)
	];

	return {
		usRates,
		bitcoin,
		bitcoinTicker,
		computedSpreadTickers,
		primaryRow,
		secondaryRow,
		tickerItems
	};
};

export const formatReleaseCountdown = (ms: number): string => {
	const totalSec = Math.floor(ms / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (h >= 1) {
		return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
	}
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const buildMacroReleaseAlertLine = (
	alerts: PageData['macroReleaseAlerts'],
	nowMs = Date.now()
): string => {
	if (!alerts?.length) {
		return '';
	}

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

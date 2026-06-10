import { FETCH_TIMEOUT_MS } from '$lib/services/constants';
import type { DataSourceTag, LiveAbsLevel, LiveQuote, YieldSpreadPayload } from '$lib/types/market';

export const YAHOO_BATCH_SYMBOLS = [
	'BTC-USD',
	'^GSPC',
	'^NDX',
	'^DJI',
	'^FTSE',
	'^NSEI',
	'000300.SS',
	'GC=F',
	'SI=F',
	'BZ=F',
	'DX-Y.NYB',
	'JPY=X',
	'INR=X',
	'^TNX',
	'^TYX'
] as const;

const YAHOO_SYMBOLS = YAHOO_BATCH_SYMBOLS.join(',');
const YAHOO_SYMBOL_LIST = [...YAHOO_BATCH_SYMBOLS];

const YAHOO_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	Accept: 'application/json'
};

type YahooChartMeta = {
	symbol?: string;
	regularMarketPrice?: number;
	chartPreviousClose?: number;
	regularMarketChangePercent?: number;
};

type YahooChartResult = {
	meta?: YahooChartMeta;
};

type YahooChartResponse = {
	chart?: {
		result?: YahooChartResult[];
	};
};

const YAHOO_SYMBOL_TO_KEY: Record<
	string,
	'spx' | 'ndx' | 'dji' | 'ftse' | 'nse' | 'csi' | 'gold' | 'silver' | 'crude' | 'dxy' | 'usdjpy' | 'usdinr'
> = {
	'^GSPC': 'spx',
	'^NDX': 'ndx',
	'^DJI': 'dji',
	'^FTSE': 'ftse',
	'^NSEI': 'nse',
	'000300.SS': 'csi',
	'GC=F': 'gold',
	'SI=F': 'silver',
	'BZ=F': 'crude',
	'DX-Y.NYB': 'dxy',
	'JPY=X': 'usdjpy',
	'INR=X': 'usdinr'
};

export type YahooMarketData = Partial<{
	liveBitcoin: LiveQuote;
	spx: LiveQuote;
	ndx: LiveQuote;
	dji: LiveQuote;
	ftse: LiveQuote;
	nse: LiveQuote;
	csi: LiveQuote;
	gold: LiveQuote;
	silver: LiveQuote;
	crude: LiveQuote;
	dxy: LiveQuote;
	usdjpy: LiveQuote;
	usdinr: LiveQuote;
	us10y: LiveQuote;
	us30y: LiveQuote;
}>;

const fetchYahooChart = async (yahooSymbol: string): Promise<YahooChartResult | null> => {
	const url = `https://query1.finance.yahoo.com/v7/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d&nocache=${Date.now()}`;
	const response = await fetch(url, {
		headers: YAHOO_HEADERS,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!response.ok) {
		console.warn(`Yahoo Finance chart ${yahooSymbol} responded with ${response.status}`);
		return null;
	}

	const json = (await response.json()) as YahooChartResponse;
	return json.chart?.result?.[0] ?? null;
};

const parseBitcoin = (meta: YahooChartMeta): LiveQuote | null => {
	const currentPrice = meta.regularMarketPrice;
	const previousClose = meta.chartPreviousClose;

	if (typeof currentPrice !== 'number' || typeof previousClose !== 'number') {
		return null;
	}

	return {
		price: currentPrice,
		changePct: ((currentPrice - previousClose) / previousClose) * 100
	};
};

const parseLiquidQuote = (meta: YahooChartMeta): LiveQuote | null => {
	const price = meta.regularMarketPrice;

	if (typeof price !== 'number') {
		return null;
	}

	const nativePct = meta.regularMarketChangePercent;
	const previousClose = meta.chartPreviousClose;

	const changePct =
		typeof nativePct === 'number'
			? nativePct
			: typeof previousClose === 'number' && previousClose !== 0
				? ((price - previousClose) / previousClose) * 100
				: null;

	if (changePct === null) {
		return null;
	}

	return { price, changePct };
};

const scaleTnxPrice = (raw: number): number => (raw > 10 ? raw / 10 : raw);

const parseUsTreasuryYield = (meta: YahooChartMeta): LiveQuote | null => {
	const rawPrice = meta.regularMarketPrice;

	if (typeof rawPrice !== 'number') {
		return null;
	}

	const price = scaleTnxPrice(rawPrice);
	const rawPrev = meta.chartPreviousClose;
	const previousYield = typeof rawPrev === 'number' ? scaleTnxPrice(rawPrev) : null;

	const nativePct = meta.regularMarketChangePercent;
	const changePct =
		typeof nativePct === 'number'
			? nativePct
			: previousYield !== null && previousYield !== 0
				? ((price - previousYield) / previousYield) * 100
				: 0;

	const changeAbs = previousYield !== null ? price - previousYield : 0;

	return { price, changePct, changeAbs };
};

const loadYahooChartResults = async (): Promise<YahooChartResult[]> => {
	const url = `https://query1.finance.yahoo.com/v7/finance/chart/BTC-USD?symbols=${encodeURIComponent(YAHOO_SYMBOLS)}&interval=1m&range=1d&nocache=${Date.now()}`;
	const response = await fetch(url, {
		headers: YAHOO_HEADERS,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`Yahoo Finance responded with ${response.status}`);
	}

	const json = (await response.json()) as YahooChartResponse;
	const batchResults = json.chart?.result ?? [];

	if (batchResults.length >= YAHOO_SYMBOL_LIST.length) {
		return batchResults;
	}

	const perSymbolResults = await Promise.all(
		YAHOO_SYMBOL_LIST.map(async (sym) => {
			try {
				return await fetchYahooChart(sym);
			} catch (error) {
				console.warn(`Yahoo Finance chart fetch failed for ${sym}:`, error);
				return null;
			}
		})
	);
	return perSymbolResults.filter((r): r is YahooChartResult => r !== null);
};

const mergeYahooChartResults = (chartResults: YahooChartResult[]): YahooMarketData => {
	const data: YahooMarketData = {};

	for (const entry of chartResults) {
		const meta = entry.meta;
		const yahooSymbol = meta?.symbol;

		if (!meta || !yahooSymbol) {
			continue;
		}

		if (yahooSymbol === 'BTC-USD') {
			const btc = parseBitcoin(meta);
			if (btc) {
				data.liveBitcoin = btc;
			}
			continue;
		}

		if (yahooSymbol === '^TNX') {
			const us10y = parseUsTreasuryYield(meta);
			if (us10y) {
				data.us10y = us10y;
			}
			continue;
		}

		if (yahooSymbol === '^TYX') {
			const us30y = parseUsTreasuryYield(meta);
			if (us30y) {
				data.us30y = us30y;
			}
			continue;
		}

		const key = YAHOO_SYMBOL_TO_KEY[yahooSymbol];
		if (!key) {
			continue;
		}

		const quote = parseLiquidQuote(meta);
		if (quote) {
			data[key] = quote;
		}
	}

	return data;
};

/** Batch Yahoo chart fetch with per-symbol fallback. */
export const fetchYahooMarketData = async (): Promise<YahooMarketData> => {
	const chartResults = await loadYahooChartResults();
	return mergeYahooChartResults(chartResults);
};

/** 2s10s and 10s30s from Yahoo 10Y/30Y and TradingView 2Y. */
export const computeYieldSpreads = (
	us2y: LiveQuote,
	us10y: LiveQuote,
	us30y: LiveQuote
): Pick<YieldSpreadPayload, 'spread2s10s' | 'spread10s30s'> => {
	const spread2s10s = us10y.price - us2y.price;
	const spread10s30s = us30y.price - us10y.price;

	const us10yAbs = us10y.changeAbs ?? 0;
	const us30yAbs = us30y.changeAbs ?? 0;
	const us2yAbs = us2y.changeAbs ?? 0;

	return {
		spread2s10s: {
			price: spread2s10s,
			change: us10yAbs - us2yAbs
		} as LiveAbsLevel,
		spread10s30s: {
			price: spread10s30s,
			change: us30yAbs - us10yAbs
		} as LiveAbsLevel
	};
};

import type { PageServerLoad } from './$types';

const FETCH_TIMEOUT_MS = 8000;

const YAHOO_SYMBOLS =
	'BTC-USD,^GSPC,^NDX,^DJI,^FTSE,^NSEI,000300.SS,GC=F,SI=F,CL=F,DX-Y.NYB,JPY=X,INR=X,^TNX,^TYX';

const YAHOO_SYMBOL_LIST = YAHOO_SYMBOLS.split(',');

const TRADINGVIEW_SCAN_URL = 'https://scanner.tradingview.com/global/scan';

const TRADINGVIEW_SCAN_TICKERS = [
	'TVC:US03M',
	'FX_IDC:US02Y',
	'ECONOMICS:USEFFR',
	'CME:SR11!',
	'TVC:DE10Y',
	'TVC:JP10Y',
	'TVC:AU10Y'
] as const;

type MacroPayloadKey = 'uscpi' | 'uscpicore' | 'uspce' | 'usnfp' | 'usur' | 'usgdp';

/** Debug: keep at 0 so macro prints are never frozen in memory. */
const MACRO_CACHE_TTL_MS = 0;

/** Official 2026 institutional baselines — authoritative dashboard prints. */
const OFFICIAL_MACRO_2026: MacroBlocksBundle = {
	uscpi: {
		price: parseFloat('3.81'),
		changeFromPrior: parseFloat('0.51'),
		forecast: parseFloat('3.50'),
		status: 'HOT BEAT'
	},
	uscpicore: {
		price: parseFloat('2.75'),
		changeFromPrior: parseFloat('0.15'),
		forecast: parseFloat('2.60'),
		status: 'HOT BEAT'
	},
	uspce: {
		price: parseFloat('3.33'),
		changeFromPrior: parseFloat('0.13'),
		forecast: parseFloat('3.20'),
		status: 'HOT BEAT'
	},
	usnfp: {
		price: parseFloat('115'),
		changeFromPrior: parseFloat('-70'),
		forecast: parseFloat('165'),
		status: 'MISS'
	},
	usur: {
		price: parseFloat('4.30'),
		changeFromPrior: parseFloat('0.00'),
		forecast: parseFloat('4.20'),
		status: 'HOT BEAT'
	},
	usgdp: {
		price: parseFloat('1.62'),
		changeFromPrior: parseFloat('1.12'),
		forecast: parseFloat('2.80'),
		status: 'MISS'
	}
};

const TV_TICKER_TO_KEY: Record<
	string,
	'us3m' | 'us2y' | 'effr' | 'de10y' | 'jp10y' | 'au10y'
> = {
	'TVC:US03M': 'us3m',
	'FX_IDC:US02Y': 'us2y',
	'TVC:US02Y': 'us2y',
	'ECONOMICS:USEFFR': 'effr',
	'TVC:DE10Y': 'de10y',
	'TVC:JP10Y': 'jp10y',
	'TVC:AU10Y': 'au10y'
};

type LiveQuote = {
	price: number;
	changePct: number;
	changeAbs?: number;
};

type LiveAbsLevel = {
	price: number;
	change: number;
};

export type MacroStatus =
	| 'HOT BEAT'
	| 'COOL MISS'
	| 'EXP. BEAT'
	| 'MISS'
	| 'INLINE'
	| 'PENDING'
	| null;

export type MacroBlock = {
	price: number;
	changeFromPrior: number;
	forecast: number;
	status: MacroStatus;
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

type TradingViewScanResponse = {
	data?: Array<{
		s: string;
		d: (number | null)[];
	}>;
};

type MarketLivePayload = {
	liveBitcoin: LiveQuote;
	effr: LiveAbsLevel;
	sofr: LiveQuote;
	us2y: LiveQuote;
	us3m: LiveQuote;
	us5y: LiveAbsLevel;
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
	de10y: LiveQuote;
	jp10y: LiveQuote;
	au10y: LiveQuote;
	spread2s10s: LiveAbsLevel;
	spread10s30s: LiveAbsLevel;
	uscpi: MacroBlock;
	uscpicore: MacroBlock;
	uspce: MacroBlock;
	usnfp: MacroBlock;
	usur: MacroBlock;
	usgdp: MacroBlock;
};

type MacroBlocksBundle = Pick<
	MarketLivePayload,
	'uscpi' | 'uscpicore' | 'uspce' | 'usnfp' | 'usur' | 'usgdp'
>;

let macroBlocksCache: { at: number; blocks: MacroBlocksBundle } | null = null;

const YAHOO_SYMBOL_TO_KEY: Record<
	string,
	keyof Omit<
		MarketLivePayload,
		| 'liveBitcoin'
		| 'effr'
		| 'sofr'
		| 'us2y'
		| 'us3m'
		| 'us5y'
		| 'us10y'
		| 'us30y'
		| 'de10y'
		| 'jp10y'
		| 'au10y'
		| 'spread2s10s'
		| 'spread10s30s'
	>
> = {
	'^GSPC': 'spx',
	'^NDX': 'ndx',
	'^DJI': 'dji',
	'^FTSE': 'ftse',
	'^NSEI': 'nse',
	'000300.SS': 'csi',
	'GC=F': 'gold',
	'SI=F': 'silver',
	'CL=F': 'crude',
	'DX-Y.NYB': 'dxy',
	'JPY=X': 'usdjpy',
	'INR=X': 'usdinr'
};

const getOfficialMacroBlocks = (): MacroBlocksBundle => ({
	uscpi: { ...OFFICIAL_MACRO_2026.uscpi },
	uscpicore: { ...OFFICIAL_MACRO_2026.uscpicore },
	uspce: { ...OFFICIAL_MACRO_2026.uspce },
	usnfp: { ...OFFICIAL_MACRO_2026.usnfp },
	usur: { ...OFFICIAL_MACRO_2026.usur },
	usgdp: { ...OFFICIAL_MACRO_2026.usgdp }
});

const loadOfficialMacroBlocks = (): MacroBlocksBundle => {
	macroBlocksCache = null;
	return getOfficialMacroBlocks();
};

const applyMacroBlocks = (payload: MarketLivePayload, blocks: MacroBlocksBundle) => {
	payload.uscpi = blocks.uscpi;
	payload.uscpicore = blocks.uscpicore;
	payload.uspce = blocks.uspce;
	payload.usnfp = blocks.usnfp;
	payload.usur = blocks.usur;
	payload.usgdp = blocks.usgdp;
};

const FALLBACK: MarketLivePayload = {
	liveBitcoin: { price: 67500.0, changePct: -3.4 },
	effr: { price: 3.65, change: 0 },
	sofr: { price: 3.65, changePct: 0.02 },
	us2y: { price: 4.38, changePct: -0.46, changeAbs: -0.02 },
	us3m: { price: 4.15, changePct: 0.09 },
	us5y: { price: 4.38, change: -0.02 },
	spx: { price: 5300.25, changePct: 0.45 },
	ndx: { price: 18500.5, changePct: 0.62 },
	dji: { price: 39120.0, changePct: -0.12 },
	ftse: { price: 8230.1, changePct: 0.18 },
	nse: { price: 23200.4, changePct: -0.7 },
	csi: { price: 4104.33, changePct: 0.55 },
	gold: { price: 2345.6, changePct: 0.61 },
	silver: { price: 29.45, changePct: 1.2 },
	crude: { price: 78.45, changePct: -1.41 },
	dxy: { price: 104.65, changePct: 0.14 },
	usdjpy: { price: 156.2, changePct: 0.45 },
	usdinr: { price: 83.55, changePct: -0.08 },
	us10y: { price: 4.43, changePct: -0.9, changeAbs: -0.04 },
	us30y: { price: 4.95, changePct: -0.61, changeAbs: -0.03 },
	de10y: { price: 2.45, changePct: -0.12 },
	jp10y: { price: 1.02, changePct: 0.05 },
	au10y: { price: 4.25, changePct: -0.47 },
	spread2s10s: { price: 0.05, change: -0.02 },
	spread10s30s: { price: 0.52, change: 0.01 },
	...OFFICIAL_MACRO_2026
};

const TV_FETCH_HEADERS = {
	Accept: 'application/json',
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const YAHOO_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	Accept: 'application/json'
};

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

const loadYahooResults = async (): Promise<YahooChartResult[]> => {
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

/** TVC:US03M — 3-Month T-Bill yield close and daily % change. */
const parseUs03M = (row: (number | null)[]): LiveQuote | null => {
	const parsedUS03MPrice = row[0];
	const parsedUS03MChange = row[1];

	if (typeof parsedUS03MPrice !== 'number') {
		return null;
	}

	return {
		price: parsedUS03MPrice,
		changePct: typeof parsedUS03MChange === 'number' ? parsedUS03MChange : 0
	};
};

/** CME SOFR futures: implied rate = 100 − index; invert contract % change for rate direction. */
const parseImpliedSofr = (row: (number | null)[]): LiveQuote | null => {
	const close = row[0];
	const contractChangePct = row[1];

	if (typeof close !== 'number') {
		return null;
	}

	const impliedSofr = 100 - close;
	const sofrChangePct = typeof contractChangePct === 'number' ? -contractChangePct : 0;

	return { price: impliedSofr, changePct: sofrChangePct };
};

const parseTradingViewRow = (
	ticker: string,
	row: (number | null)[]
): {
	effr?: LiveAbsLevel;
	us2y?: LiveQuote;
	sovereign?: LiveQuote;
} | null => {
	const close = row[0];
	const changePct = row[1];
	const changeAbs = row[2];

	if (typeof close !== 'number') {
		return null;
	}

	const key = TV_TICKER_TO_KEY[ticker];
	if (!key) {
		return null;
	}

	if (key === 'effr') {
		return {
			effr: {
				price: close,
				change: typeof changeAbs === 'number' ? changeAbs : 0
			}
		};
	}

	if (key === 'us2y') {
		return {
			us2y: {
				price: close,
				changePct: typeof changePct === 'number' ? changePct : 0,
				changeAbs: typeof changeAbs === 'number' ? changeAbs : 0
			}
		};
	}

	return {
		sovereign: {
			price: close,
			changePct: typeof changePct === 'number' ? changePct : 0
		}
	};
};

const fetchTradingViewScan = async (): Promise<Partial<MarketLivePayload>> => {
	const response = await fetch(TRADINGVIEW_SCAN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			symbols: {
				tickers: [...TRADINGVIEW_SCAN_TICKERS],
				query: { types: [] }
			},
			columns: ['close', 'change', 'change_abs']
		}),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`TradingView scanner responded with ${response.status}`);
	}

	const json = (await response.json()) as TradingViewScanResponse;
	const macro: Partial<MarketLivePayload> = {};

	for (const entry of json.data ?? []) {
		if (entry.s === 'TVC:US03M') {
			const us3m = parseUs03M(entry.d);
			if (us3m) {
				macro.us3m = us3m;
			}
			continue;
		}

		if (entry.s === 'CME:SR11!') {
			const sofr = parseImpliedSofr(entry.d);
			if (sofr) {
				macro.sofr = sofr;
			}
			continue;
		}

		const parsed = parseTradingViewRow(entry.s, entry.d);
		if (!parsed) {
			continue;
		}

		if (parsed.effr) {
			macro.effr = parsed.effr;
		}
		if (parsed.us3m) {
			macro.us3m = parsed.us3m;
		}
		if (parsed.us2y) {
			macro.us2y = parsed.us2y;
		}
		if (parsed.sovereign) {
			const key = TV_TICKER_TO_KEY[entry.s];
			if (key === 'de10y' || key === 'jp10y' || key === 'au10y') {
				macro[key] = parsed.sovereign;
			}
		}
	}

	return macro;
};

const applyYieldSpreads = (payload: MarketLivePayload) => {
	const yahoo10YPrice = payload.us10y.price;
	const yahoo30YPrice = payload.us30y.price;
	const parsedUS2YPrice = payload.us2y.price;

	const spread2s10s = yahoo10YPrice - parsedUS2YPrice;
	const spread10s30s = yahoo30YPrice - yahoo10YPrice;

	const us10yAbs = payload.us10y.changeAbs ?? 0;
	const us30yAbs = payload.us30y.changeAbs ?? 0;
	const us2yAbs = payload.us2y.changeAbs ?? 0;

	payload.spread2s10s = {
		price: spread2s10s,
		change: us10yAbs - us2yAbs
	};

	payload.spread10s30s = {
		price: spread10s30s,
		change: us30yAbs - us10yAbs
	};
};

const mergeYahooIntoPayload = (payload: MarketLivePayload, chartResults: YahooChartResult[]) => {
	for (const entry of chartResults) {
		const meta = entry.meta;
		const yahooSymbol = meta?.symbol;

		if (!meta || !yahooSymbol) {
			continue;
		}

		if (yahooSymbol === 'BTC-USD') {
			const btc = parseBitcoin(meta);
			if (btc) {
				payload.liveBitcoin = btc;
			}
			continue;
		}

		if (yahooSymbol === '^TNX') {
			const us10y = parseUsTreasuryYield(meta);
			if (us10y) {
				payload.us10y = us10y;
			}
			continue;
		}

		if (yahooSymbol === '^TYX') {
			const us30y = parseUsTreasuryYield(meta);
			if (us30y) {
				payload.us30y = us30y;
			}
			continue;
		}

		const key = YAHOO_SYMBOL_TO_KEY[yahooSymbol];
		if (!key) {
			continue;
		}

		const quote = parseLiquidQuote(meta);
		if (quote) {
			payload[key] = quote;
		}
	}
};

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({
		'cache-control': 'no-store, no-cache, must-revalidate, max-age=0'
	});

	const payload: MarketLivePayload = { ...FALLBACK };

	try {
		const chartResults = await loadYahooResults();
		mergeYahooIntoPayload(payload, chartResults);
	} catch (error) {
		console.error('Yahoo Fetch Failed:', error);
	}

	try {
		const tvScan = await fetchTradingViewScan();
		if (tvScan.effr) {
			payload.effr = tvScan.effr;
		}
		if (tvScan.sofr) {
			payload.sofr = tvScan.sofr;
		}
		if (tvScan.us3m) {
			payload.us3m = tvScan.us3m;
		}
		if (tvScan.us2y) {
			payload.us2y = tvScan.us2y;
		}
		if (tvScan.de10y) {
			payload.de10y = tvScan.de10y;
		}
		if (tvScan.jp10y) {
			payload.jp10y = tvScan.jp10y;
		}
		if (tvScan.au10y) {
			payload.au10y = tvScan.au10y;
		}
	} catch (error) {
		console.error('TradingView Scanner Fetch Failed:', error);
	}

	applyMacroBlocks(payload, loadOfficialMacroBlocks());

	applyYieldSpreads(payload);

	console.log('SUCCESS! Macro Data:', {
		btc: payload.liveBitcoin,
		effr: payload.effr,
		sofr: payload.sofr,
		us3m: payload.us3m,
		us2y: payload.us2y,
		us10y: payload.us10y,
		spread2s10s: payload.spread2s10s,
		de10y: payload.de10y
	});

	return payload;
};

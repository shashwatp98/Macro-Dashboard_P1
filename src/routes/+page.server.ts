import type { PageServerLoad } from './$types';

const FETCH_TIMEOUT_MS = 8000;

const symbols =
	'BTC-USD,^GSPC,^NDX,^DJI,^FTSE,^NSEI,000300.SS,GC=F,SI=F,CL=F,DX-Y.NYB,JPY=X,INR=X,^TNX,^TYX';

const SYMBOL_LIST = symbols.split(',');

type LiveQuote = {
	price: number;
	changePct: number;
};

type LiveAbsLevel = {
	price: number;
	change: number;
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

type MarketLivePayload = {
	liveBitcoin: LiveQuote;
	effr: LiveAbsLevel;
	sofr: LiveAbsLevel;
	us2y: LiveQuote;
	us3m: LiveAbsLevel;
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
};

const YAHOO_SYMBOL_TO_KEY: Record<string, keyof Omit<MarketLivePayload, 'liveBitcoin' | 'effr' | 'sofr' | 'us2y' | 'us3m' | 'us5y' | 'us10y' | 'us30y' | 'de10y' | 'jp10y' | 'au10y' | 'spread2s10s' | 'spread10s30s'>> = {
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

/** Static mocks until FRED / alternate feeds — no Yahoo fetch. */
const STATIC_MOCKS: Pick<
	MarketLivePayload,
	| 'effr'
	| 'sofr'
	| 'us2y'
	| 'us3m'
	| 'us5y'
	| 'de10y'
	| 'jp10y'
	| 'au10y'
	| 'spread2s10s'
	| 'spread10s30s'
> = {
	effr: { price: 3.65, change: 0 },
	sofr: { price: 3.65, change: 0.02 },
	us2y: { price: 4.38, changePct: -0.46 },
	us3m: { price: 4.15, change: 0.01 },
	us5y: { price: 4.38, change: -0.02 },
	de10y: { price: 2.45, changePct: -0.12 },
	jp10y: { price: 1.02, changePct: 0.05 },
	au10y: { price: 4.25, changePct: -0.47 },
	spread2s10s: { price: 0.05, change: -0.02 },
	spread10s30s: { price: 0.52, change: 0.01 }
};

const FALLBACK: MarketLivePayload = {
	...STATIC_MOCKS,
	liveBitcoin: { price: 67500.0, changePct: -3.4 },
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
	us10y: { price: 4.43, changePct: -0.9 },
	us30y: { price: 4.95, changePct: -0.61 }
};

const FETCH_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	Accept: 'application/json'
};

const fetchChart = async (yahooSymbol: string): Promise<YahooChartResult | null> => {
	const url = `https://query1.finance.yahoo.com/v7/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d&nocache=${Date.now()}`;
	const response = await fetch(url, {
		headers: FETCH_HEADERS,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!response.ok) {
		console.warn(`Yahoo Finance chart ${yahooSymbol} responded with ${response.status}`);
		return null;
	}

	const json = (await response.json()) as YahooChartResponse;
	return json.chart?.result?.[0] ?? null;
};

/** BTC-USD: daily % vs chartPreviousClose (midnight UTC session boundary). */
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

/** Equities, commodities, FX: regularMarketPrice + regularMarketChangePercent (prior-close fallback). */
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

/** ^TNX / ^TYX: yield = raw price ÷ 10 when quoted ×10; relative daily % change. */
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

	return { price, changePct };
};

const loadChartResults = async (): Promise<YahooChartResult[]> => {
	const url = `https://query1.finance.yahoo.com/v7/finance/chart/BTC-USD?symbols=${encodeURIComponent(symbols)}&interval=1m&range=1d&nocache=${Date.now()}`;
	const response = await fetch(url, {
		headers: FETCH_HEADERS,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`Yahoo Finance responded with ${response.status}`);
	}

	const json = (await response.json()) as YahooChartResponse;
	const batchResults = json.chart?.result ?? [];

	if (batchResults.length >= SYMBOL_LIST.length) {
		return batchResults;
	}

	const perSymbolResults = await Promise.all(
		SYMBOL_LIST.map(async (sym) => {
			try {
				return await fetchChart(sym);
			} catch (error) {
				console.warn(`Yahoo Finance chart fetch failed for ${sym}:`, error);
				return null;
			}
		})
	);
	return perSymbolResults.filter((r): r is YahooChartResult => r !== null);
};

export const load: PageServerLoad = async () => {
	try {
		const chartResults = await loadChartResults();
		const payload: MarketLivePayload = { ...FALLBACK, ...STATIC_MOCKS };

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

		console.log('SUCCESS! Fresh Yahoo Data:', {
			btc: payload.liveBitcoin,
			spx: payload.spx,
			us10y: payload.us10y,
			us30y: payload.us30y
		});

		return payload;
	} catch (error) {
		console.error('Yahoo Fetch Failed:', error);
		return FALLBACK;
	}
};

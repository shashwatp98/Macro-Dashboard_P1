import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

const FETCH_TIMEOUT_MS = 8000;

/** Tiered Cache Engine — track TTLs (Fast Track: Yahoo + TV scan, no server cache). */
const CB_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const MACRO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FED_WATCH_CACHE_TTL_MS = 60 * 60 * 1000;
const RELEASE_WINDOW_TZ = 'America/New_York';
const RELEASE_WINDOW_START_MIN = 8 * 60 + 29;
const RELEASE_WINDOW_END_MIN = 8 * 60 + 35;

const YAHOO_BATCH_SYMBOLS = [
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

const TV_CB_QUOTE_SYMBOLS =
	'ECONOMICS:USINTR,ECONOMICS:EUINTR,ECONOMICS:ININTR,ECONOMICS:JPINTR,ECONOMICS:CAINTR,ECONOMICS:GBINTR,ECONOMICS:AUINTR';

const TV_CB_QUOTES_URL = `https://widgets.tradingview.com/api/v1/quotes?symbols=${TV_CB_QUOTE_SYMBOLS}`;

const CB_SYMBOL_SUFFIX_TO_KEY: Record<
	'USINTR' | 'EUINTR' | 'ININTR' | 'JPINTR' | 'CAINTR' | 'GBINTR' | 'AUINTR',
	keyof CentralBanks
> = {
	USINTR: 'us',
	EUINTR: 'eu',
	ININTR: 'in',
	JPINTR: 'jp',
	CAINTR: 'ca',
	GBINTR: 'gb',
	AUINTR: 'au'
};

type MacroPayloadKey = 'uscpi' | 'uscpicore' | 'uspce' | 'usnfp' | 'usur' | 'usgdp';

const FRED_OBSERVATIONS_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_API_BASE = 'https://api.stlouisfed.org/fred';
const FRED_GRAPH_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const FRED_OBSERVATION_START = '2018-01-01';
const FRED_OBS_LIMIT = 48;

type FredMacroKind = 'yoy' | 'nfp_net' | 'spot' | 'gdp_qoq';

type FredMacroSeriesConfig = {
	seriesId: string;
	kind: FredMacroKind;
	forecast: number;
};

const FRED_MACRO_SERIES: Record<MacroPayloadKey, FredMacroSeriesConfig> = {
	uscpi: { seriesId: 'CPIAUCSL', kind: 'yoy', forecast: 3.5 },
	uscpicore: { seriesId: 'CPILFESL', kind: 'yoy', forecast: 2.6 },
	uspce: { seriesId: 'PCEPILFE', kind: 'yoy', forecast: 3.2 },
	usnfp: { seriesId: 'PAYEMS', kind: 'nfp_net', forecast: 165 },
	usur: { seriesId: 'UNRATE', kind: 'spot', forecast: 4.2 },
	usgdp: { seriesId: 'GDPC1', kind: 'gdp_qoq', forecast: 2.8 }
};

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
		price: parseFloat('172'),
		changeFromPrior: parseFloat('-7'),
		forecast: parseFloat('165'),
		status: 'EXP. BEAT'
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

export type CentralBanks = {
	us: string;
	eu: string;
	in: string;
	jp: string;
	ca: string;
	gb: string;
	au: string;
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

export type FedWatchAction = '25bps CUT' | 'HOLD' | '25bps HIKE';

export type FedWatch = {
	meetingDate: string;
	action: FedWatchAction;
	probability: string;
};

export type MacroReleaseAlert = {
	labels: string[];
	releaseAt: string;
};

export type MacroReleaseAlerts = MacroReleaseAlert[];

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

type FredRawObservation = {
	date: string;
	value: string;
};

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
	'BZ=F': 'crude',
	'DX-Y.NYB': 'dxy',
	'JPY=X': 'usdjpy',
	'INR=X': 'usdinr'
};

const roundMacroRate = (value: number, decimals = 2): number => {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
};

const evaluateMacroStatus = (
	key: MacroPayloadKey,
	actual: number,
	forecast: number
): MacroStatus => {
	if (actual === forecast) {
		return 'INLINE';
	}

	if (key === 'usnfp' || key === 'usgdp') {
		return actual > forecast ? 'EXP. BEAT' : 'MISS';
	}

	return actual > forecast ? 'HOT BEAT' : 'COOL MISS';
};

const buildMacroBlock = (
	key: MacroPayloadKey,
	price: number,
	changeFromPrior: number,
	forecast: number
): MacroBlock => {
	const forecastNum = parseFloat(String(forecast));

	return {
		price,
		changeFromPrior,
		forecast: forecastNum,
		status: evaluateMacroStatus(key, price, forecastNum)
	};
};

const parseFredCsvDesc = (csv: string): FredRawObservation[] => {
	const observations: FredRawObservation[] = [];

	for (const line of csv.trim().split('\n')) {
		if (!line || line.startsWith('observation') || line.startsWith('DATE')) {
			continue;
		}

		const [date, rawValue] = line.split(',');
		if (!date || !rawValue || rawValue === '.') {
			continue;
		}

		const value = rawValue.trim();
		if (!Number.isFinite(Number.parseFloat(value))) {
			continue;
		}

		observations.push({ date: date.trim(), value });
	}

	return observations.reverse();
};

type FredApiObservationsResponse = {
	observations?: Array<{ date?: string; value?: string }>;
};

const parseFredApiObservationsDesc = (json: FredApiObservationsResponse): FredRawObservation[] => {
	const observations: FredRawObservation[] = [];

	for (const row of json.observations ?? []) {
		if (!row.date || !row.value || row.value === '.') {
			continue;
		}

		if (!Number.isFinite(Number.parseFloat(row.value))) {
			continue;
		}

		observations.push({ date: row.date, value: row.value });
	}

	return observations;
};

const fetchFredObservationsDesc = async (seriesId: string): Promise<FredRawObservation[]> => {
	const apiKey = env.FRED_API_KEY?.trim();

	if (apiKey) {
		const params = new URLSearchParams({
			series_id: seriesId,
			api_key: apiKey,
			file_type: 'json',
			sort_order: 'desc',
			observation_start: FRED_OBSERVATION_START,
			limit: String(FRED_OBS_LIMIT)
		});
		const url = `${FRED_OBSERVATIONS_BASE}?${params.toString()}`;
		const response = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});

		if (!response.ok) {
			throw new Error(`FRED API ${seriesId} responded with ${response.status}`);
		}

		const json = (await response.json()) as FredApiObservationsResponse;
		return parseFredApiObservationsDesc(json);
	}

	const csvUrl = `${FRED_GRAPH_BASE}?id=${encodeURIComponent(seriesId)}&cosd=${FRED_OBSERVATION_START}&sort_order=desc&_=${Date.now()}`;
	const response = await fetch(csvUrl, {
		headers: { Accept: 'text/csv' },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`FRED ${seriesId} responded with ${response.status}`);
	}

	return parseFredCsvDesc(await response.text());
};

const formatObsDate = (year: number, month: number): string =>
	`${year}-${String(month).padStart(2, '0')}-01`;

const yearAgoDate = (date: string): string => {
	const [yearStr, monthStr] = date.split('-');
	return formatObsDate(Number(yearStr) - 1, Number(monthStr));
};

const priorMonthDate = (date: string): string => {
	const year = Number(date.split('-')[0]);
	const month = Number(date.split('-')[1]);
	if (month === 1) {
		return formatObsDate(year - 1, 12);
	}
	return formatObsDate(year, month - 1);
};

/** FRED quarterly prints use Jan/Apr/Jul/Oct anchor dates. */
const priorQuarterDate = (date: string): string => {
	const year = Number(date.split('-')[0]);
	const month = Number(date.split('-')[1]);
	if (month <= 3) {
		return formatObsDate(year - 1, 10);
	}
	if (month <= 6) {
		return formatObsDate(year, 1);
	}
	if (month <= 9) {
		return formatObsDate(year, 4);
	}
	return formatObsDate(year, 7);
};

const buildObsValueMap = (obs: FredRawObservation[]): Map<string, number> => {
	const byDate = new Map<string, number>();
	for (const row of obs) {
		byDate.set(row.date, parseFloat(row.value));
	}
	return byDate;
};

const metricSeriesFromObs = (
	kind: FredMacroKind,
	obs: FredRawObservation[]
): number[] | null => {
	if (obs.length < 2) {
		return null;
	}

	const byDate = buildObsValueMap(obs);

	switch (kind) {
		case 'yoy': {
			const metrics: number[] = [];
			for (const row of obs) {
				const yearAgo = byDate.get(yearAgoDate(row.date));
				if (yearAgo === undefined || yearAgo === 0) {
					continue;
				}
				const current = parseFloat(row.value);
				metrics.push(roundMacroRate(((current / yearAgo) - 1) * 100));
			}
			return metrics.length >= 2 ? metrics : null;
		}
		case 'nfp_net': {
			const metrics: number[] = [];
			for (const row of obs) {
				const priorMonth = byDate.get(priorMonthDate(row.date));
				if (priorMonth === undefined) {
					continue;
				}
				metrics.push(parseFloat(row.value) - priorMonth);
			}
			return metrics.length >= 2 ? metrics : null;
		}
		case 'spot': {
			const latest = parseFloat(obs[0].value);
			const priorMonth = byDate.get(priorMonthDate(obs[0].date));
			if (priorMonth === undefined) {
				return null;
			}
			return [roundMacroRate(latest), roundMacroRate(priorMonth)];
		}
		case 'gdp_qoq': {
			const metrics: number[] = [];
			for (const row of obs) {
				const priorQuarter = byDate.get(priorQuarterDate(row.date));
				if (priorQuarter === undefined || priorQuarter === 0) {
					continue;
				}
				const current = parseFloat(row.value);
				metrics.push(roundMacroRate((Math.pow(current / priorQuarter, 4) - 1) * 100));
			}
			return metrics.length >= 2 ? metrics : null;
		}
		default:
			return null;
	}
};

const buildMacroBlockFromObs = (
	key: MacroPayloadKey,
	config: FredMacroSeriesConfig,
	obs: FredRawObservation[]
): MacroBlock | null => {
	const metrics = metricSeriesFromObs(config.kind, obs);
	if (!metrics || metrics.length < 2) {
		return null;
	}

	const price = parseFloat(String(metrics[0]));
	const changeFromPrior = parseFloat(String(metrics[0] - metrics[1]));

	return buildMacroBlock(key, price, changeFromPrior, config.forecast);
};

const fetchFredMacroBlocks = async (): Promise<MacroBlocksBundle> => {
	const keys = Object.keys(FRED_MACRO_SERIES) as MacroPayloadKey[];
	const blocks: MacroBlocksBundle = {
		uscpi: { ...OFFICIAL_MACRO_2026.uscpi },
		uscpicore: { ...OFFICIAL_MACRO_2026.uscpicore },
		uspce: { ...OFFICIAL_MACRO_2026.uspce },
		usnfp: { ...OFFICIAL_MACRO_2026.usnfp },
		usur: { ...OFFICIAL_MACRO_2026.usur },
		usgdp: { ...OFFICIAL_MACRO_2026.usgdp }
	};

	const seriesResults = await Promise.all(
		keys.map(async (key) => {
			const config = FRED_MACRO_SERIES[key];
			const obs = await fetchFredObservationsDesc(config.seriesId);
			return { key, config, obs };
		})
	);

	for (const { key, config, obs } of seriesResults) {
		const block = buildMacroBlockFromObs(key, config, obs);
		if (block) {
			blocks[key] = block;
		}
	}

	return blocks;
};

type TieredCacheEntry<T> = {
	at: number;
	data: T;
};

let centralBanksCache: TieredCacheEntry<CentralBanks> | null = null;
let macroBlocksCache: TieredCacheEntry<MacroBlocksBundle> | null = null;
let fedWatchCache: TieredCacheEntry<FedWatch> | null = null;

/** FOMC decision dates (ET) — second day when applicable. */
const FOMC_DECISION_DATES = [
	'2025-01-29',
	'2025-03-19',
	'2025-05-07',
	'2025-06-18',
	'2025-07-30',
	'2025-09-17',
	'2025-10-29',
	'2025-12-10',
	'2026-01-29',
	'2026-03-18',
	'2026-04-29',
	'2026-06-17',
	'2026-07-29',
	'2026-09-17',
	'2026-11-05',
	'2026-12-16',
	'2027-01-27',
	'2027-03-17',
	'2027-04-28',
	'2027-06-16',
	'2027-07-28',
	'2027-09-15',
	'2027-11-03',
	'2027-12-15'
] as const;

const getTodayEtIsoDate = (date = new Date()): string => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: RELEASE_WINDOW_TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);

	const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
	const month = parts.find((part) => part.type === 'month')?.value ?? '01';
	const day = parts.find((part) => part.type === 'day')?.value ?? '01';
	return `${year}-${month}-${day}`;
};

const getNextFomcDecisionDate = (date = new Date()): string => {
	const todayEt = getTodayEtIsoDate(date);
	const upcoming = FOMC_DECISION_DATES.find((decisionDate) => decisionDate >= todayEt);
	return upcoming ?? FOMC_DECISION_DATES[FOMC_DECISION_DATES.length - 1];
};

const formatFomcMeetingDate = (isoDate: string): string => {
	const label = new Intl.DateTimeFormat('en-US', {
		timeZone: RELEASE_WINDOW_TZ,
		month: 'short',
		day: 'numeric'
	}).format(new Date(`${isoDate}T12:00:00`));

	const [month, day] = label.split(' ');
	return `${month.toUpperCase()} ${day}`;
};

const FALLBACK_FED_WATCH: FedWatch = {
	meetingDate: 'JUN 17',
	action: 'HOLD',
	probability: '98.0%'
};

const KALSHI_API_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

type KalshiMarket = {
	subtitle?: string;
	yes_sub_title?: string;
	last_price_dollars?: string;
	yes_bid_dollars?: string;
	yes_ask_dollars?: string;
	status?: string;
};

type KalshiMarketsResponse = {
	markets?: KalshiMarket[];
};

const KALSHI_MONTH_CODES = [
	'JAN',
	'FEB',
	'MAR',
	'APR',
	'MAY',
	'JUN',
	'JUL',
	'AUG',
	'SEP',
	'OCT',
	'NOV',
	'DEC'
] as const;

const toKalshiEventTicker = (decisionIso: string): string => {
	const monthIndex = Number(decisionIso.split('-')[1]) - 1;
	const monthCode = KALSHI_MONTH_CODES[monthIndex] ?? 'JUN';
	const yearCode = decisionIso.slice(2, 4);
	return `KXFEDDECISION-${yearCode}${monthCode}`;
};

const parseKalshiProbability = (market: KalshiMarket): number => {
	for (const field of ['last_price_dollars', 'yes_bid_dollars', 'yes_ask_dollars'] as const) {
		const raw = market[field];
		if (!raw) {
			continue;
		}
		const value = Number.parseFloat(raw);
		if (Number.isFinite(value)) {
			return value * 100;
		}
	}
	return 0;
};

const classifyKalshiMarket = (market: KalshiMarket): 'HOLD' | 'CUT' | 'HIKE' | null => {
	const label = (market.yes_sub_title ?? market.subtitle ?? '').toLowerCase();
	if (!label) {
		return null;
	}
	if (label.includes('maintain') || label.includes('hold') || label.includes('0bps')) {
		return 'HOLD';
	}
	if (label.includes('cut')) {
		return 'CUT';
	}
	if (label.includes('hike')) {
		return 'HIKE';
	}
	return null;
};

const fetchKalshiFedWatch = async (decisionIso: string): Promise<FedWatch> => {
	const eventTicker = toKalshiEventTicker(decisionIso);
	const url = `${KALSHI_API_BASE}/markets?event_ticker=${encodeURIComponent(eventTicker)}&limit=50`;
	const response = await fetch(url, {
		headers: { Accept: 'application/json' },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`Kalshi Fed Decision API responded with ${response.status}`);
	}

	const json = (await response.json()) as KalshiMarketsResponse;
	const markets = (json.markets ?? []).filter((market) => market.status !== 'closed');

	const buckets: Record<'HOLD' | 'CUT' | 'HIKE', number> = {
		HOLD: 0,
		CUT: 0,
		HIKE: 0
	};

	for (const market of markets) {
		const bucket = classifyKalshiMarket(market);
		if (!bucket) {
			continue;
		}
		buckets[bucket] += parseKalshiProbability(market);
	}

	const meetingDate = formatFomcMeetingDate(decisionIso);
	const total = buckets.HOLD + buckets.CUT + buckets.HIKE;
	if (total <= 0) {
		throw new Error(`Kalshi returned no usable markets for ${eventTicker}`);
	}

	let action: FedWatchAction = 'HOLD';
	let probability = buckets.HOLD;
	if (buckets.CUT > probability) {
		action = '25bps CUT';
		probability = buckets.CUT;
	}
	if (buckets.HIKE > probability) {
		action = '25bps HIKE';
		probability = buckets.HIKE;
	}

	return {
		meetingDate,
		action,
		probability: `${probability.toFixed(1)}%`
	};
};

const buildFedWatchSnapshot = async (): Promise<FedWatch> => {
	const decisionDate = getNextFomcDecisionDate();
	return fetchKalshiFedWatch(decisionDate);
};

const loadFedWatchTiered = async (): Promise<FedWatch> => {
	if (isTieredCacheFresh(fedWatchCache, FED_WATCH_CACHE_TTL_MS)) {
		return fedWatchCache.data;
	}

	try {
		const fedWatch = await buildFedWatchSnapshot();
		fedWatchCache = { at: Date.now(), data: fedWatch };
		return fedWatch;
	} catch (error) {
		if (fedWatchCache) {
			console.warn('Kalshi Fed Watch fetch failed — serving cached snapshot:', error);
			return fedWatchCache.data;
		}
		console.error('Kalshi Fed Watch fetch failed:', error);
		return { ...FALLBACK_FED_WATCH, meetingDate: formatFomcMeetingDate(getNextFomcDecisionDate()) };
	}
};

const getEasternMinutesSinceMidnight = (date = new Date()): number => {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: RELEASE_WINDOW_TZ,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).formatToParts(date);

	const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
	const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
	return hour * 60 + minute;
};

/** 8:29–8:35 AM ET — bypass macro cache so CPI/NFP releases snap live. */
const isFredReleaseWindow = (date = new Date()): boolean => {
	const minutes = getEasternMinutesSinceMidnight(date);
	return minutes >= RELEASE_WINDOW_START_MIN && minutes <= RELEASE_WINDOW_END_MIN;
};

const isTieredCacheFresh = <T>(cache: TieredCacheEntry<T> | null, ttlMs: number): cache is TieredCacheEntry<T> =>
	cache !== null && Date.now() - cache.at < ttlMs;

const MACRO_RELEASE_DATES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MACRO_RELEASE_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
const MACRO_RELEASE_HOUR_ET = 8;
const MACRO_RELEASE_MINUTE_ET = 30;

const MACRO_INDICATOR_LABELS: Record<MacroPayloadKey, string> = {
	uscpi: 'US CPI',
	uscpicore: 'Core CPI',
	uspce: 'Core PCE',
	usnfp: 'NFP',
	usur: 'Unemployment',
	usgdp: 'GDP'
};

type MacroReleaseGroupConfig = {
	id: string;
	seriesId: string;
	keys: MacroPayloadKey[];
};

const MACRO_RELEASE_GROUPS: MacroReleaseGroupConfig[] = [
	{ id: 'bls_cpi', seriesId: 'CPIAUCSL', keys: ['uscpi', 'uscpicore'] },
	{ id: 'bls_jobs', seriesId: 'PAYEMS', keys: ['usnfp', 'usur'] },
	{ id: 'bea_pce', seriesId: 'PCEPILFE', keys: ['uspce'] },
	{ id: 'bea_gdp', seriesId: 'GDPC1', keys: ['usgdp'] }
];

/** Official BLS/BEA 2026 print dates — fallback when FRED release API is unavailable. */
const MACRO_RELEASE_FALLBACK_DATES: Record<string, readonly string[]> = {
	bls_cpi: [
		'2026-01-13',
		'2026-02-13',
		'2026-03-11',
		'2026-04-10',
		'2026-05-12',
		'2026-06-10',
		'2026-07-14',
		'2026-08-12',
		'2026-09-11',
		'2026-10-14',
		'2026-11-10',
		'2026-12-10'
	],
	bls_jobs: [
		'2026-01-09',
		'2026-02-11',
		'2026-03-06',
		'2026-04-03',
		'2026-05-08',
		'2026-06-05',
		'2026-07-02',
		'2026-08-07',
		'2026-09-04',
		'2026-10-02',
		'2026-11-06',
		'2026-12-04'
	],
	bea_pce: [
		'2026-02-20',
		'2026-03-27',
		'2026-04-30',
		'2026-05-28',
		'2026-06-26',
		'2026-07-31',
		'2026-08-28',
		'2026-09-30',
		'2026-10-30',
		'2026-11-25',
		'2026-12-23'
	],
	bea_gdp: [
		'2026-02-20',
		'2026-04-30',
		'2026-05-28',
		'2026-06-25',
		'2026-07-30',
		'2026-08-27',
		'2026-09-25',
		'2026-10-29',
		'2026-11-25',
		'2026-12-23'
	]
};

type MacroReleaseGroupSchedule = {
	groupId: string;
	releaseDate: string;
	keys: MacroPayloadKey[];
};

let macroReleaseDatesCache: TieredCacheEntry<MacroReleaseGroupSchedule[]> | null = null;
const fredReleaseIdCache = new Map<string, number>();

type FredSeriesReleaseResponse = {
	release?: { id?: number };
};

type FredReleaseDatesResponse = {
	release_dates?: Array<{ date?: string }>;
};

const getEtOffsetForDate = (isoDate: string): string => {
	const utc = new Date(`${isoDate}T12:00:00Z`);
	const etHour = Number(
		new Intl.DateTimeFormat('en-US', {
			timeZone: RELEASE_WINDOW_TZ,
			hour: 'numeric',
			hour12: false
		})
			.formatToParts(utc)
			.find((part) => part.type === 'hour')?.value ?? 12
	);
	const offsetHours = etHour - 12;
	const sign = offsetHours <= 0 ? '-' : '+';
	return `${sign}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;
};

const releaseAtIsoFromDate = (isoDate: string): string =>
	`${isoDate}T${String(MACRO_RELEASE_HOUR_ET).padStart(2, '0')}:${String(MACRO_RELEASE_MINUTE_ET).padStart(2, '0')}:00${getEtOffsetForDate(isoDate)}`;

const nextReleaseDateOnOrAfter = (dates: readonly string[], todayEt: string): string | null =>
	dates.find((date) => date >= todayEt) ?? null;

const fetchFredApiJson = async <T>(endpoint: string, params: Record<string, string>): Promise<T> => {
	const apiKey = env.FRED_API_KEY?.trim();
	if (!apiKey) {
		throw new Error('FRED_API_KEY is not configured');
	}

	const searchParams = new URLSearchParams({
		...params,
		api_key: apiKey,
		file_type: 'json'
	});
	const response = await fetch(`${FRED_API_BASE}/${endpoint}?${searchParams.toString()}`, {
		headers: { Accept: 'application/json' },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`FRED ${endpoint} responded with ${response.status}`);
	}

	return (await response.json()) as T;
};

const fetchFredReleaseId = async (seriesId: string): Promise<number> => {
	const cached = fredReleaseIdCache.get(seriesId);
	if (cached !== undefined) {
		return cached;
	}

	const json = await fetchFredApiJson<FredSeriesReleaseResponse>('series/release', {
		series_id: seriesId
	});
	const releaseId = json.release?.id;
	if (!releaseId) {
		throw new Error(`FRED returned no release id for ${seriesId}`);
	}

	fredReleaseIdCache.set(seriesId, releaseId);
	return releaseId;
};

const fetchFredNextReleaseDate = async (
	releaseId: number,
	todayEt: string
): Promise<string | null> => {
	const json = await fetchFredApiJson<FredReleaseDatesResponse>('release/dates', {
		release_id: String(releaseId),
		realtime_start: todayEt,
		realtime_end: '2027-12-31',
		include_release_dates_with_no_data: 'true',
		sort_order: 'asc',
		limit: '5'
	});

	for (const row of json.release_dates ?? []) {
		if (row.date && row.date >= todayEt) {
			return row.date;
		}
	}

	return null;
};

const fetchFredMacroReleaseSchedules = async (
	todayEt: string
): Promise<MacroReleaseGroupSchedule[]> => {
	const schedules: MacroReleaseGroupSchedule[] = [];

	for (const group of MACRO_RELEASE_GROUPS) {
		const releaseId = await fetchFredReleaseId(group.seriesId);
		const releaseDate = await fetchFredNextReleaseDate(releaseId, todayEt);
		if (!releaseDate) {
			continue;
		}

		schedules.push({
			groupId: group.id,
			releaseDate,
			keys: group.keys
		});
	}

	if (schedules.length === 0) {
		throw new Error('FRED returned no upcoming macro release dates');
	}

	return schedules;
};

const buildFallbackMacroReleaseSchedules = (todayEt: string): MacroReleaseGroupSchedule[] => {
	const schedules: MacroReleaseGroupSchedule[] = [];

	for (const group of MACRO_RELEASE_GROUPS) {
		const dates = MACRO_RELEASE_FALLBACK_DATES[group.id];
		if (!dates) {
			continue;
		}

		const releaseDate = nextReleaseDateOnOrAfter(dates, todayEt);
		if (!releaseDate) {
			continue;
		}

		schedules.push({
			groupId: group.id,
			releaseDate,
			keys: group.keys
		});
	}

	return schedules;
};

const loadMacroReleaseSchedules = async (): Promise<MacroReleaseGroupSchedule[]> => {
	if (isTieredCacheFresh(macroReleaseDatesCache, MACRO_RELEASE_DATES_CACHE_TTL_MS)) {
		return macroReleaseDatesCache.data;
	}

	const todayEt = getTodayEtIsoDate();
	let schedules: MacroReleaseGroupSchedule[];

	try {
		schedules = await fetchFredMacroReleaseSchedules(todayEt);
	} catch (error) {
		console.warn('FRED macro release dates fetch failed — using fallback calendar:', error);
		schedules = buildFallbackMacroReleaseSchedules(todayEt);
	}

	macroReleaseDatesCache = { at: Date.now(), data: schedules };
	return schedules;
};

const buildMacroReleaseAlerts = async (now = new Date()): Promise<MacroReleaseAlert[]> => {
	const schedules = await loadMacroReleaseSchedules();
	const nowMs = now.getTime();
	const windowEndMs = nowMs + MACRO_RELEASE_LOOKAHEAD_MS;
	const alertsByReleaseAt = new Map<string, MacroReleaseAlert>();

	for (const schedule of schedules) {
		const releaseAt = releaseAtIsoFromDate(schedule.releaseDate);
		const releaseMs = Date.parse(releaseAt);
		if (releaseMs <= nowMs || releaseMs > windowEndMs) {
			continue;
		}

		const labels = schedule.keys.map((key) => MACRO_INDICATOR_LABELS[key]);
		const existing = alertsByReleaseAt.get(releaseAt);
		if (existing) {
			existing.labels.push(...labels);
			continue;
		}

		alertsByReleaseAt.set(releaseAt, { labels: [...labels], releaseAt });
	}

	return [...alertsByReleaseAt.values()]
		.map((alert) => ({
			releaseAt: alert.releaseAt,
			labels: [...new Set(alert.labels)]
		}))
		.sort((a, b) => Date.parse(a.releaseAt) - Date.parse(b.releaseAt));
};

const loadMacroReleaseAlerts = async (): Promise<MacroReleaseAlert[]> => {
	try {
		return await buildMacroReleaseAlerts();
	} catch (error) {
		console.error('Macro release alert build failed:', error);
		return [];
	}
};

const loadCentralBankRatesTiered = async (): Promise<CentralBanks> => {
	if (isTieredCacheFresh(centralBanksCache, CB_CACHE_TTL_MS)) {
		return centralBanksCache.data;
	}

	try {
		const rates = await fetchCentralBankRates();
		centralBanksCache = { at: Date.now(), data: rates };
		return rates;
	} catch (error) {
		if (centralBanksCache) {
			console.warn('TradingView CB Quotes Fetch Failed — serving cached policy rates:', error);
			return centralBanksCache.data;
		}
		throw error;
	}
};

const loadFredMacroBlocksTiered = async (): Promise<MacroBlocksBundle> => {
	const bypassMacroCache = isFredReleaseWindow();

	if (!bypassMacroCache && isTieredCacheFresh(macroBlocksCache, MACRO_CACHE_TTL_MS)) {
		return macroBlocksCache.data;
	}

	try {
		const blocks = await fetchFredMacroBlocks();
		macroBlocksCache = { at: Date.now(), data: blocks };
		return blocks;
	} catch (error) {
		if (macroBlocksCache) {
			console.warn('FRED Macro Fetch Failed — serving cached macro blocks:', error);
			return macroBlocksCache.data;
		}
		throw error;
	}
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

const CENTRAL_BANK_KEYS = ['us', 'eu', 'in', 'jp', 'ca', 'gb', 'au'] as const satisfies readonly (keyof CentralBanks)[];

const FALLBACK_CENTRAL_BANKS: CentralBanks = {
	us: '3.75',
	eu: '2.15',
	in: '5.25',
	jp: '0.75',
	ca: '2.25',
	gb: '3.75',
	au: '4.35'
};

const validateCentralBanks = (banks: CentralBanks): CentralBanks => {
	for (const key of CENTRAL_BANK_KEYS) {
		const rate = parseFloat(banks[key]);
		if (!Number.isFinite(rate) || rate < 0 || rate > 30) {
			throw new Error(`Invalid policy rate for ${key}: ${banks[key]}`);
		}
	}
	return banks;
};

const TV_FETCH_HEADERS = {
	Accept: 'application/json',
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

type TvWidgetQuoteValues = {
	lp?: number;
	bid?: number;
	ask?: number;
	close?: number;
	prev_close_price?: number;
	[key: string]: unknown;
};

type TvWidgetQuotesResponse = {
	results?: Array<{
		s?: string;
		v?: number | TvWidgetQuoteValues;
	}>;
};

const formatPolicyRate = (rate: number): string => rate.toFixed(2);

/** EUINTR widgets feed often surfaces deposit facility; MRO = deposit + 15bp since Sep 2024. */
const normalizeEcbMroRate = (rate: number): number => {
	const cents = Math.round(rate * 100);
	if (cents % 25 === 0) {
		return roundMacroRate(rate + 0.15);
	}
	return rate;
};

/** Live policy yield from nested quote fields — raw numeric `v` and `.close` are stale indexes. */
const extractLivePolicyRate = (value: number | TvWidgetQuoteValues | undefined): number | null => {
	if (typeof value === 'number' || !value || typeof value !== 'object') {
		return null;
	}

	for (const field of ['lp', 'bid', 'ask'] as const) {
		const candidate = value[field];
		if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 && candidate <= 30) {
			return candidate;
		}
	}

	return null;
};

const fetchCentralBankRates = async (): Promise<CentralBanks> => {
	const rates: CentralBanks = { ...FALLBACK_CENTRAL_BANKS };

	const cbResponse = await fetch(TV_CB_QUOTES_URL, {
		headers: TV_FETCH_HEADERS,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});

	if (!cbResponse.ok) {
		throw new Error(`TradingView CB quotes responded with ${cbResponse.status}`);
	}

	const json = (await cbResponse.json()) as TvWidgetQuotesResponse;

	for (const entry of json.results ?? []) {
		const suffix = entry.s?.split(':')[1] as keyof typeof CB_SYMBOL_SUFFIX_TO_KEY | undefined;
		if (!suffix) {
			continue;
		}

		const key = CB_SYMBOL_SUFFIX_TO_KEY[suffix];
		if (!key) {
			continue;
		}

		const rate = extractLivePolicyRate(entry.v);
		if (rate !== null) {
			const normalized = key === 'eu' ? normalizeEcbMroRate(rate) : rate;
			rates[key] = formatPolicyRate(normalized);
		}
	}

	return validateCentralBanks(rates);
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

	// Fast Track — Yahoo batch + TradingView yield curves (every load / ~15s client refresh).
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

	let macroBlocks: MacroBlocksBundle = {
		uscpi: { ...OFFICIAL_MACRO_2026.uscpi },
		uscpicore: { ...OFFICIAL_MACRO_2026.uscpicore },
		uspce: { ...OFFICIAL_MACRO_2026.uspce },
		usnfp: { ...OFFICIAL_MACRO_2026.usnfp },
		usur: { ...OFFICIAL_MACRO_2026.usur },
		usgdp: { ...OFFICIAL_MACRO_2026.usgdp }
	};

	// Macro Track — FRED series (12h TTL; bypass cache 8:29–8:35 AM ET on release days).
	try {
		macroBlocks = await loadFredMacroBlocksTiered();
	} catch (error) {
		console.error('FRED Macro Fetch Failed:', error);
	}

	applyMacroBlocks(payload, macroBlocks);

	applyYieldSpreads(payload);

	let centralBanks: CentralBanks = { ...FALLBACK_CENTRAL_BANKS };

	// Slow Track — central bank policy rates (4h TTL).
	try {
		centralBanks = await loadCentralBankRatesTiered();
	} catch (error) {
		console.error('TradingView CB Quotes Fetch Failed:', error);
		centralBanks = validateCentralBanks(centralBanks);
	}

	const fedWatch = await loadFedWatchTiered();
	const macroReleaseAlerts = await loadMacroReleaseAlerts();

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

	return { ...payload, centralBanks, fedWatch, macroReleaseAlerts };
};

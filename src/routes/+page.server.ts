import { FETCH_TIMEOUT_MS } from '$lib/services/constants';
import {
	fetchFredMacroData,
	fetchFredMacroReleaseSchedules,
	OFFICIAL_MACRO_2026,
	type MacroReleaseGroupSchedule
} from '$lib/services/fred';
import {
	FALLBACK_CENTRAL_BANKS,
	fetchCentralBankRates,
	fetchTradingViewScan,
	validateCentralBanks
} from '$lib/services/tradingview';
import { computeYieldSpreads, fetchYahooMarketData, type YahooMarketData } from '$lib/services/yahoo';
import type {
	CentralBanks,
	DataSourceTag,
	DataSources,
	LiveAbsLevel,
	LiveQuote,
	MacroBlock,
	MacroBlocksBundle,
	MacroPayloadKey,
	MacroStatus
} from '$lib/types/market';
import type { TradingViewScanData } from '$lib/services/tradingview';
import type { PageServerLoad } from './$types';

export type { CentralBanks, MacroBlock, MacroStatus, DataSourceTag, DataSources };

/** Tiered Cache Engine — track TTLs. */
const FAST_TRACK_CACHE_TTL_MS = 30 * 1000;
const CB_CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const MACRO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FED_WATCH_CACHE_TTL_MS = 60 * 60 * 1000;
const RELEASE_WINDOW_TZ = 'America/New_York';
const RELEASE_WINDOW_START_MIN = 8 * 60 + 29;
const RELEASE_WINDOW_END_MIN = 8 * 60 + 35;

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

type TieredCacheEntry<T> = {
	at: number;
	data: T;
};

let centralBanksCache: TieredCacheEntry<CentralBanks> | null = null;
let macroBlocksCache: TieredCacheEntry<MacroBlocksBundle> | null = null;
let fedWatchCache: TieredCacheEntry<FedWatch> | null = null;
let yahooMarketCache: TieredCacheEntry<YahooMarketData> | null = null;
let tradingViewScanCache: TieredCacheEntry<TradingViewScanData> | null = null;

type TrackResult<T> = {
	data: T;
	source: DataSourceTag;
};

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

const MACRO_RELEASE_GROUPS = [
	{ id: 'bls_cpi', seriesId: 'CPIAUCSL', keys: ['uscpi', 'uscpicore'] as MacroPayloadKey[] },
	{ id: 'bls_jobs', seriesId: 'PAYEMS', keys: ['usnfp', 'usur'] as MacroPayloadKey[] },
	{ id: 'bea_pce', seriesId: 'PCEPILFE', keys: ['uspce'] as MacroPayloadKey[] },
	{ id: 'bea_gdp', seriesId: 'GDPC1', keys: ['usgdp'] as MacroPayloadKey[] }
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

let macroReleaseDatesCache: TieredCacheEntry<MacroReleaseGroupSchedule[]> | null = null;

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
		schedules = await fetchFredMacroReleaseSchedules(todayEt, MACRO_RELEASE_GROUPS);
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

const loadCentralBankRatesTiered = async (): Promise<TrackResult<CentralBanks>> => {
	if (isTieredCacheFresh(centralBanksCache, CB_CACHE_TTL_MS)) {
		return { data: centralBanksCache.data, source: 'cache' };
	}

	try {
		const rates = await fetchCentralBankRates();
		centralBanksCache = { at: Date.now(), data: rates };
		return { data: rates, source: 'live' };
	} catch (error) {
		if (centralBanksCache) {
			console.warn('TradingView CB Quotes Fetch Failed — serving cached policy rates:', error);
			return { data: centralBanksCache.data, source: 'cache' };
		}
		console.error('TradingView CB Quotes Fetch Failed:', error);
		return { data: { ...FALLBACK_CENTRAL_BANKS }, source: 'fallback' };
	}
};

const loadFredMacroBlocksTiered = async (): Promise<TrackResult<MacroBlocksBundle>> => {
	const bypassMacroCache = isFredReleaseWindow();

	if (!bypassMacroCache && isTieredCacheFresh(macroBlocksCache, MACRO_CACHE_TTL_MS)) {
		return { data: macroBlocksCache.data, source: 'cache' };
	}

	try {
		const blocks = await fetchFredMacroData();
		macroBlocksCache = { at: Date.now(), data: blocks };
		return { data: blocks, source: 'live' };
	} catch (error) {
		if (macroBlocksCache) {
			console.warn('FRED Macro Fetch Failed — serving cached macro blocks:', error);
			return { data: macroBlocksCache.data, source: 'cache' };
		}
		console.error('FRED Macro Fetch Failed:', error);
		return {
			data: {
				uscpi: { ...OFFICIAL_MACRO_2026.uscpi },
				uscpicore: { ...OFFICIAL_MACRO_2026.uscpicore },
				uspce: { ...OFFICIAL_MACRO_2026.uspce },
				usnfp: { ...OFFICIAL_MACRO_2026.usnfp },
				usur: { ...OFFICIAL_MACRO_2026.usur },
				usgdp: { ...OFFICIAL_MACRO_2026.usgdp }
			},
			source: 'fallback'
		};
	}
};

const loadYahooMarketTrack = async (): Promise<TrackResult<YahooMarketData>> => {
	try {
		const data = await fetchYahooMarketData();
		yahooMarketCache = { at: Date.now(), data };
		return { data, source: 'live' };
	} catch (error) {
		if (isTieredCacheFresh(yahooMarketCache, FAST_TRACK_CACHE_TTL_MS)) {
			console.warn('Yahoo Fetch Failed — serving fast-track cache:', error);
			return { data: yahooMarketCache.data, source: 'cache' };
		}
		console.error('Yahoo Fetch Failed:', error);
		return { data: {}, source: 'fallback' };
	}
};

const loadTradingViewScanTrack = async (): Promise<TrackResult<TradingViewScanData>> => {
	try {
		const data = await fetchTradingViewScan();
		tradingViewScanCache = { at: Date.now(), data };
		return { data, source: 'live' };
	} catch (error) {
		if (isTieredCacheFresh(tradingViewScanCache, FAST_TRACK_CACHE_TTL_MS)) {
			console.warn('TradingView Scanner Fetch Failed — serving fast-track cache:', error);
			return { data: tradingViewScanCache.data, source: 'cache' };
		}
		console.error('TradingView Scanner Fetch Failed:', error);
		return { data: {}, source: 'fallback' };
	}
};

const combineMarketsSource = (yahooSource: DataSourceTag, tvSource: DataSourceTag): DataSourceTag => {
	if (yahooSource === 'fallback' || tvSource === 'fallback') {
		return 'fallback';
	}
	if (yahooSource === 'cache' || tvSource === 'cache') {
		return 'cache';
	}
	return 'live';
};

const applyTradingViewScan = (payload: MarketLivePayload, tvScan: TradingViewScanData) => {
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

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({
		'cache-control': 'no-store, no-cache, must-revalidate, max-age=0'
	});

	const payload: MarketLivePayload = { ...FALLBACK };

	const [coreSettled, fedWatch, macroReleaseAlerts] = await Promise.all([
		Promise.allSettled([
			loadYahooMarketTrack(),
			loadTradingViewScanTrack(),
			loadCentralBankRatesTiered(),
			loadFredMacroBlocksTiered()
		]),
		loadFedWatchTiered(),
		loadMacroReleaseAlerts()
	]);

	const [yahooResult, tvResult, cbResult, macroResult] = coreSettled;

	let yahooSource: DataSourceTag = 'fallback';
	let tvSource: DataSourceTag = 'fallback';

	if (yahooResult.status === 'fulfilled') {
		Object.assign(payload, yahooResult.value.data);
		yahooSource = yahooResult.value.source;
	} else {
		console.error('Yahoo track rejected:', yahooResult.reason);
		if (isTieredCacheFresh(yahooMarketCache, FAST_TRACK_CACHE_TTL_MS)) {
			Object.assign(payload, yahooMarketCache.data);
			yahooSource = 'cache';
		}
	}

	if (tvResult.status === 'fulfilled') {
		applyTradingViewScan(payload, tvResult.value.data);
		tvSource = tvResult.value.source;
	} else {
		console.error('TradingView scan track rejected:', tvResult.reason);
		if (isTieredCacheFresh(tradingViewScanCache, FAST_TRACK_CACHE_TTL_MS)) {
			applyTradingViewScan(payload, tradingViewScanCache.data);
			tvSource = 'cache';
		}
	}

	const spreads = computeYieldSpreads(payload.us2y, payload.us10y, payload.us30y);
	payload.spread2s10s = spreads.spread2s10s;
	payload.spread10s30s = spreads.spread10s30s;

	let macroSource: DataSourceTag = 'fallback';
	if (macroResult.status === 'fulfilled') {
		applyMacroBlocks(payload, macroResult.value.data);
		macroSource = macroResult.value.source;
	} else {
		console.error('Macro track rejected:', macroResult.reason);
		if (macroBlocksCache) {
			applyMacroBlocks(payload, macroBlocksCache.data);
			macroSource = 'cache';
		} else {
			applyMacroBlocks(payload, {
				uscpi: { ...OFFICIAL_MACRO_2026.uscpi },
				uscpicore: { ...OFFICIAL_MACRO_2026.uscpicore },
				uspce: { ...OFFICIAL_MACRO_2026.uspce },
				usnfp: { ...OFFICIAL_MACRO_2026.usnfp },
				usur: { ...OFFICIAL_MACRO_2026.usur },
				usgdp: { ...OFFICIAL_MACRO_2026.usgdp }
			});
		}
	}

	let centralBanks: CentralBanks = { ...FALLBACK_CENTRAL_BANKS };
	let centralBanksSource: DataSourceTag = 'fallback';
	if (cbResult.status === 'fulfilled') {
		centralBanks = cbResult.value.data;
		centralBanksSource = cbResult.value.source;
	} else {
		console.error('Central bank track rejected:', cbResult.reason);
		if (centralBanksCache) {
			centralBanks = centralBanksCache.data;
			centralBanksSource = 'cache';
		} else {
			centralBanks = validateCentralBanks(centralBanks);
		}
	}

	const dataSources: DataSources = {
		markets: combineMarketsSource(yahooSource, tvSource),
		macro: macroSource,
		centralBanks: centralBanksSource
	};

	console.log('SUCCESS! Macro Data:', {
		btc: payload.liveBitcoin,
		effr: payload.effr,
		sofr: payload.sofr,
		us3m: payload.us3m,
		us2y: payload.us2y,
		us10y: payload.us10y,
		spread2s10s: payload.spread2s10s,
		de10y: payload.de10y,
		dataSources
	});

	return { ...payload, centralBanks, fedWatch, macroReleaseAlerts, dataSources };
};

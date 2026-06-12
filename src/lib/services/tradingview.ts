import { FETCH_TIMEOUT_MS } from '$lib/services/constants';
import type { CentralBanks, LiveAbsLevel, LiveQuote } from '$lib/types/market';

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

const TV_TICKER_TO_KEY: Record<string, 'us3m' | 'us2y' | 'effr' | 'de10y' | 'jp10y' | 'au10y'> = {
	'TVC:US03M': 'us3m',
	'FX_IDC:US02Y': 'us2y',
	'TVC:US02Y': 'us2y',
	'ECONOMICS:USEFFR': 'effr',
	'TVC:DE10Y': 'de10y',
	'TVC:JP10Y': 'jp10y',
	'TVC:AU10Y': 'au10y'
};

type TradingViewScanResponse = {
	data?: Array<{
		s: string;
		d: (number | null)[];
	}>;
};

export type TradingViewScanData = Partial<{
	effr: LiveAbsLevel;
	sofr: LiveQuote;
	us3m: LiveQuote;
	us2y: LiveQuote;
	de10y: LiveQuote;
	jp10y: LiveQuote;
	au10y: LiveQuote;
}>;

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

const CENTRAL_BANK_KEYS = [
	'us',
	'eu',
	'in',
	'jp',
	'ca',
	'gb',
	'au'
] as const satisfies readonly (keyof CentralBanks)[];

export const FALLBACK_CENTRAL_BANKS: CentralBanks = {
	us: '3.75',
	eu: '2.15',
	in: '5.25',
	jp: '0.75',
	ca: '2.25',
	gb: '3.75',
	au: '4.35'
};

const roundMacroRate = (value: number, decimals = 2): number => {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
};

const formatPolicyRate = (rate: number): string => rate.toFixed(2);

/** EUINTR widgets feed often surfaces deposit facility; MRO = deposit + 15bp since Sep 2024. */
export const normalizeEcbMroRate = (rate: number): number => {
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
		if (
			typeof candidate === 'number' &&
			Number.isFinite(candidate) &&
			candidate >= 0 &&
			candidate <= 30
		) {
			return candidate;
		}
	}

	return null;
};

export const validateCentralBanks = (banks: CentralBanks): CentralBanks => {
	for (const key of CENTRAL_BANK_KEYS) {
		const rate = parseFloat(banks[key]);
		if (!Number.isFinite(rate) || rate < 0 || rate > 30) {
			throw new Error(`Invalid policy rate for ${key}: ${banks[key]}`);
		}
	}
	return banks;
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

export const fetchTradingViewScan = async (): Promise<TradingViewScanData> => {
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
	const macro: TradingViewScanData = {};

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

export const fetchCentralBankRates = async (): Promise<CentralBanks> => {
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

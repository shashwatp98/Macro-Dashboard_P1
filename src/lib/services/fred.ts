import { env } from '$env/dynamic/private';
import { getMacroForecast } from '$lib/config/macro-forecasts';
import { FETCH_TIMEOUT_MS } from '$lib/services/constants';
import type { MacroBlock, MacroBlocksBundle, MacroPayloadKey } from '$lib/types/market';
import { evaluateMacroStatus } from './macroStatus';

export { evaluateMacroStatus } from './macroStatus';

const FRED_OBSERVATIONS_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_API_BASE = 'https://api.stlouisfed.org/fred';
const FRED_GRAPH_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv';
const FRED_OBSERVATION_START = '2018-01-01';
const FRED_OBS_LIMIT = 48;

type FredMacroKind = 'yoy' | 'nfp_net' | 'spot' | 'gdp_qoq';

type FredMacroSeriesConfig = {
	seriesId: string;
	kind: FredMacroKind;
};

const FRED_MACRO_SERIES: Record<MacroPayloadKey, FredMacroSeriesConfig> = {
	uscpi: { seriesId: 'CPIAUCSL', kind: 'yoy' },
	uscpicore: { seriesId: 'CPILFESL', kind: 'yoy' },
	uspce: { seriesId: 'PCEPILFE', kind: 'yoy' },
	usnfp: { seriesId: 'PAYEMS', kind: 'nfp_net' },
	usur: { seriesId: 'UNRATE', kind: 'spot' },
	usgdp: { seriesId: 'GDPC1', kind: 'gdp_qoq' }
};

/** Official 2026 institutional baselines — authoritative dashboard prints. */
export const OFFICIAL_MACRO_2026: MacroBlocksBundle = {
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

type FredRawObservation = {
	date: string;
	value: string;
};

type FredApiObservationsResponse = {
	observations?: Array<{ date?: string; value?: string }>;
};

type FredSeriesReleaseResponse = {
	release?: { id?: number };
};

type FredReleaseDatesResponse = {
	release_dates?: Array<{ date?: string }>;
};

export type MacroReleaseGroupSchedule = {
	groupId: string;
	releaseDate: string;
	keys: MacroPayloadKey[];
};

const fredReleaseIdCache = new Map<string, number>();

const roundMacroRate = (value: number, decimals = 2): number => {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
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

const metricSeriesFromObs = (kind: FredMacroKind, obs: FredRawObservation[]): number[] | null => {
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
				metrics.push(roundMacroRate((current / yearAgo - 1) * 100));
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

	return buildMacroBlock(key, price, changeFromPrior, getMacroForecast(key));
};

/** Dual-pipeline FRED macro fetch — JSON API when keyed, public CSV graph otherwise. */
export const fetchFredMacroData = async (): Promise<MacroBlocksBundle> => {
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

export const fetchFredApiJson = async <T>(
	endpoint: string,
	params: Record<string, string>
): Promise<T> => {
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

export const fetchFredReleaseId = async (seriesId: string): Promise<number> => {
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

export const fetchFredNextReleaseDate = async (
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

export const fetchFredMacroReleaseSchedules = async (
	todayEt: string,
	groups: Array<{ id: string; seriesId: string; keys: MacroPayloadKey[] }>
): Promise<MacroReleaseGroupSchedule[]> => {
	const schedules: MacroReleaseGroupSchedule[] = [];

	for (const group of groups) {
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

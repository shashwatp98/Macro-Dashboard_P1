import type { MacroPayloadKey } from '$lib/types/market';

/** Update this date when revising consensus placeholders before CPI/NFP week. */
export const MACRO_FORECASTS_UPDATED = '2026-06-01';

export type MacroForecastConfig = {
	forecast: number;
};

export const MACRO_FORECASTS: Record<MacroPayloadKey, MacroForecastConfig> = {
	uscpi: { forecast: 3.5 },
	uscpicore: { forecast: 2.6 },
	uspce: { forecast: 3.2 },
	usnfp: { forecast: 165 },
	usur: { forecast: 4.2 },
	usgdp: { forecast: 2.8 }
};

export const getMacroForecast = (key: MacroPayloadKey): number => MACRO_FORECASTS[key].forecast;

import type { MacroStatus } from '$lib/types/market';
import type { PageData } from '../../routes/$types';

export type FlashDirection = 'up' | 'down' | null;

export const MACRO_DATA_KEYS = ['uscpi', 'uscpicore', 'uspce', 'usnfp', 'usur', 'usgdp'] as const;

export const MACRO_OUT_FLASH_KEYS: Record<(typeof MACRO_DATA_KEYS)[number], string> = {
	uscpi: 'MACRO_CPI_OUT',
	uscpicore: 'MACRO_CORE_CPI_OUT',
	uspce: 'MACRO_PCE_OUT',
	usnfp: 'MACRO_NFP_OUT',
	usur: 'MACRO_UR_OUT',
	usgdp: 'MACRO_GDP_OUT'
};

export const PRICE_TRACKERS: { id: string; read: (d: PageData) => number | undefined }[] = [
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

export const macroOutcomeBlink = (status: MacroStatus | null | undefined): FlashDirection => {
	if (status === 'EXP. BEAT' || status === 'COOL MISS') return 'up';
	if (status === 'HOT BEAT' || status === 'MISS') return 'down';
	return null;
};

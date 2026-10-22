import type { LiveQuote } from '../types/market.js';

const roundMacroRate = (value: number, decimals = 2): number => {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
};

/** EUINTR often surfaces deposit facility; MRO = deposit + 15bp since Sep 2024. */
export const normalizeEcbMroRate = (rate: number): number => {
	const cents = Math.round(rate * 100);
	if (cents % 25 === 0) {
		return roundMacroRate(rate + 0.15);
	}
	return rate;
};

/**
 * TVC:US03MY is the 3-month yield. TVC:US03M is a bond *price* (~99), not a yield —
 * reject values outside a plausible yield range so the curve never plots ~99%.
 */
export const parseUs3mYield = (row: (number | null)[]): LiveQuote | null => {
	const price = row[0];
	const changePct = row[1];

	if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 20) {
		return null;
	}

	return {
		price,
		changePct: typeof changePct === 'number' ? changePct : 0
	};
};

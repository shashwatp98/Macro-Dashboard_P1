import type { LiveAbsLevel, LiveQuote } from '../types/market.js';

/** 2s10s and 10s30s from Yahoo 10Y/30Y and TradingView 2Y. */
export const computeYieldSpreads = (
	us2y: LiveQuote,
	us10y: LiveQuote,
	us30y: LiveQuote
): { spread2s10s: LiveAbsLevel; spread10s30s: LiveAbsLevel } => {
	const spread2s10s = us10y.price - us2y.price;
	const spread10s30s = us30y.price - us10y.price;

	const us10yAbs = us10y.changeAbs ?? 0;
	const us30yAbs = us30y.changeAbs ?? 0;
	const us2yAbs = us2y.changeAbs ?? 0;

	return {
		spread2s10s: {
			price: spread2s10s,
			change: us10yAbs - us2yAbs
		},
		spread10s30s: {
			price: spread10s30s,
			change: us30yAbs - us10yAbs
		}
	};
};

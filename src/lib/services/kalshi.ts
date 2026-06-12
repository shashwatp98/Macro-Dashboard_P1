export type KalshiMarketLabel = {
	yes_sub_title?: string;
	subtitle?: string;
};

export type KalshiBucket = 'HOLD' | 'CUT' | 'HIKE';

/** Classify a Kalshi FOMC market bucket from yes_sub_title (preferred) or subtitle. */
export const classifyKalshiMarket = (market: KalshiMarketLabel): KalshiBucket | null => {
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

export type KalshiBucketTotals = Record<KalshiBucket, number>;

/** Pick dominant FOMC action from aggregated Kalshi bucket probabilities. */
export const pickDominantKalshiAction = (
	buckets: KalshiBucketTotals
): { action: '25bps CUT' | 'HOLD' | '25bps HIKE'; probability: number } => {
	let action: '25bps CUT' | 'HOLD' | '25bps HIKE' = 'HOLD';
	let probability = buckets.HOLD;

	if (buckets.CUT > probability) {
		action = '25bps CUT';
		probability = buckets.CUT;
	}
	if (buckets.HIKE > probability) {
		action = '25bps HIKE';
		probability = buckets.HIKE;
	}

	return { action, probability };
};

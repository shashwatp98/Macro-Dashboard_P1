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

export type KalshiEventRef = {
	event_ticker?: string;
	strike_date?: string;
};

/** Pick the soonest Kalshi Fed event whose strike date is today or later. */
export const pickNextKalshiFedEvent = (
	events: KalshiEventRef[],
	todayIso: string
): { eventTicker: string; decisionIso: string } | null => {
	const upcoming = events
		.map((event) => {
			const eventTicker = event.event_ticker?.trim();
			const decisionIso = event.strike_date?.slice(0, 10);
			if (!eventTicker || !decisionIso) {
				return null;
			}
			return { eventTicker, decisionIso };
		})
		.filter((event): event is { eventTicker: string; decisionIso: string } => {
			return event !== null && event.decisionIso >= todayIso;
		})
		.sort((a, b) => a.decisionIso.localeCompare(b.decisionIso));

	return upcoming[0] ?? null;
};

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

import type { MacroPayloadKey, MacroStatus } from '../types/market.js';

export const evaluateMacroStatus = (
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

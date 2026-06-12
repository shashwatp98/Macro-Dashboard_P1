import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

let fredKeyWarned = false;

/** Warn once in production when FRED_API_KEY is missing (macro + release calendar degrade). */
export const warnMissingFredKey = (): void => {
	if (dev || fredKeyWarned || env.FRED_API_KEY?.trim()) {
		return;
	}
	fredKeyWarned = true;
	console.warn(
		'[macro-dashboard] FRED_API_KEY is not set — macro fetch uses CSV fallback and release dates use hardcoded 2026 calendar.'
	);
};

export const isDebugLoad = (): boolean => dev || env.DEBUG_LOAD === 'true';

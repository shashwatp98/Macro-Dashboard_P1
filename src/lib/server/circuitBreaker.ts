export type CircuitState = {
	failures: number;
	openUntil: number;
};

export const CIRCUIT_FAILURE_THRESHOLD = 3;
export const CIRCUIT_OPEN_MS = 60_000;

export const createCircuitState = (): CircuitState => ({ failures: 0, openUntil: 0 });

export const isCircuitOpen = (circuit: CircuitState, now = Date.now()): boolean =>
	now < circuit.openUntil;

export const recordCircuitSuccess = (circuit: CircuitState): void => {
	circuit.failures = 0;
	circuit.openUntil = 0;
};

export const recordCircuitFailure = (circuit: CircuitState, now = Date.now()): void => {
	circuit.failures += 1;
	if (circuit.failures >= CIRCUIT_FAILURE_THRESHOLD) {
		circuit.openUntil = now + CIRCUIT_OPEN_MS;
	}
};

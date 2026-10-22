import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeEcbMroRate, parseUs3mYield } from './tvParse.ts';

describe('parseUs3mYield', () => {
	it('accepts a plausible 3-month yield from TVC:US03MY', () => {
		assert.deepEqual(parseUs3mYield([4.125, -0.94, -0.039]), {
			price: 4.125,
			changePct: -0.94
		});
	});

	it('rejects TVC:US03M bond prices that are not yields', () => {
		assert.equal(parseUs3mYield([98.993118, 0.009, 0.009]), null);
	});

	it('defaults missing change to zero', () => {
		assert.deepEqual(parseUs3mYield([4.12, null]), {
			price: 4.12,
			changePct: 0
		});
	});
});

describe('normalizeEcbMroRate', () => {
	it('adds 15bp when the widget prints a 25bp-grid deposit rate', () => {
		assert.equal(normalizeEcbMroRate(2.0), 2.15);
	});

	it('leaves an already-normalized MRO unchanged', () => {
		assert.equal(normalizeEcbMroRate(2.65), 2.65);
	});
});

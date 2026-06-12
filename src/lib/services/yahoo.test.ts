import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeYieldSpreads } from './yieldSpreads.ts';

type LiveQuote = {
	price: number;
	changePct: number;
	changeAbs?: number;
};

const quote = (price: number, changeAbs: number): LiveQuote => ({
	price,
	changePct: 0,
	changeAbs
});

describe('computeYieldSpreads', () => {
	it('computes 2s10s and 10s30s spreads and changes', () => {
		const us2y = quote(4.0, -0.1);
		const us10y = quote(4.5, -0.05);
		const us30y = quote(4.8, 0.02);

		const result = computeYieldSpreads(us2y, us10y, us30y);

		assert.equal(result.spread2s10s.price, 0.5);
		assert.equal(result.spread2s10s.change, 0.05);
		assert.ok(Math.abs(result.spread10s30s.price - 0.3) < 1e-9);
		assert.equal(result.spread10s30s.change, 0.07);
	});

	it('defaults missing changeAbs to zero', () => {
		const us2y: LiveQuote = { price: 3.5, changePct: 0 };
		const us10y: LiveQuote = { price: 4.0, changePct: 0 };
		const us30y: LiveQuote = { price: 4.2, changePct: 0 };

		const result = computeYieldSpreads(us2y, us10y, us30y);

		assert.equal(result.spread2s10s.change, 0);
		assert.equal(result.spread10s30s.change, 0);
	});
});

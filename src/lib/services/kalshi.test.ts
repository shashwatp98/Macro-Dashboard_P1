import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	classifyKalshiMarket,
	pickDominantKalshiAction,
	type KalshiBucketTotals
} from './kalshi.ts';

describe('classifyKalshiMarket', () => {
	it('classifies hold from maintain, hold, or 0bps labels', () => {
		assert.equal(classifyKalshiMarket({ yes_sub_title: 'Fed maintains rate' }), 'HOLD');
		assert.equal(classifyKalshiMarket({ subtitle: 'Hike 0bps' }), 'HOLD');
		assert.equal(classifyKalshiMarket({ yes_sub_title: 'Hold at current level' }), 'HOLD');
	});

	it('classifies cut and hike', () => {
		assert.equal(classifyKalshiMarket({ yes_sub_title: '25bps cut' }), 'CUT');
		assert.equal(classifyKalshiMarket({ yes_sub_title: '25bps hike' }), 'HIKE');
	});

	it('returns null for empty labels', () => {
		assert.equal(classifyKalshiMarket({}), null);
	});
});

describe('pickDominantKalshiAction', () => {
	it('picks the highest probability bucket', () => {
		const buckets: KalshiBucketTotals = { HOLD: 40, CUT: 55, HIKE: 5 };
		assert.deepEqual(pickDominantKalshiAction(buckets), {
			action: '25bps CUT',
			probability: 55
		});
	});

	it('defaults to HOLD when tied or highest', () => {
		const buckets: KalshiBucketTotals = { HOLD: 60, CUT: 30, HIKE: 10 };
		assert.deepEqual(pickDominantKalshiAction(buckets), {
			action: 'HOLD',
			probability: 60
		});
	});
});

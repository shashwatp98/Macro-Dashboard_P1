import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	classifyKalshiMarket,
	pickDominantKalshiAction,
	pickNextKalshiFedEvent,
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

describe('pickNextKalshiFedEvent', () => {
	it('picks the soonest open meeting on or after today', () => {
		const next = pickNextKalshiFedEvent(
			[
				{ event_ticker: 'KXFEDDECISION-26SEP', strike_date: '2026-09-17T18:00:00Z' },
				{ event_ticker: 'KXFEDDECISION-26OCT', strike_date: '2026-10-28T18:00:00Z' },
				{ event_ticker: 'KXFEDDECISION-26DEC', strike_date: '2026-12-09T19:00:00Z' }
			],
			'2026-10-22'
		);
		assert.deepEqual(next, {
			eventTicker: 'KXFEDDECISION-26OCT',
			decisionIso: '2026-10-28'
		});
	});

	it('returns null when no future events exist', () => {
		assert.equal(
			pickNextKalshiFedEvent(
				[{ event_ticker: 'KXFEDDECISION-26SEP', strike_date: '2026-09-17T18:00:00Z' }],
				'2026-10-22'
			),
			null
		);
	});
});

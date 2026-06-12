import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateMacroStatus } from './macroStatus.ts';

describe('evaluateMacroStatus', () => {
	it('returns INLINE when actual equals forecast', () => {
		assert.equal(evaluateMacroStatus('uscpi', 3.2, 3.2), 'INLINE');
	});

	it('uses hot/cool logic for inflation indicators', () => {
		assert.equal(evaluateMacroStatus('uscpi', 3.5, 3.2), 'HOT BEAT');
		assert.equal(evaluateMacroStatus('uscpicore', 3.0, 3.2), 'COOL MISS');
	});

	it('uses beat/miss logic for NFP and GDP', () => {
		assert.equal(evaluateMacroStatus('usnfp', 250, 200), 'EXP. BEAT');
		assert.equal(evaluateMacroStatus('usgdp', 1.5, 2.0), 'MISS');
	});
});

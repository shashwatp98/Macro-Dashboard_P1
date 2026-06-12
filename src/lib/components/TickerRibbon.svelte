<script lang="ts">
	import type { Ticker } from '$lib/dashboard/marketSections';
	import { clsFor, fmtChg } from '$lib/dashboard/marketSections';

	type FlashDirection = 'up' | 'down' | null;

	type Props = {
		items: Ticker[];
		flashStates: Record<string, FlashDirection>;
	};

	let { items, flashStates }: Props = $props();
</script>

<div class="ticker" aria-label="Market summary ticker">
	<div class="tickerMask">
		<div class="tickerTrack">
			{#each items as r (r.symbol)}
				<div class="tick">
					<div class="tickSym">{r.symbol}</div>
					<div
						class="tickVal price-flash font-data"
						class:blink-green={flashStates[r.symbol] === 'up'}
						class:blink-red={flashStates[r.symbol] === 'down'}
					>
						{r.value}
					</div>
					<div class={'tickChg font-data ' + clsFor(r.change)}>{fmtChg(r.change)}</div>
				</div>
			{/each}
		</div>
		<div class="tickerTrack" aria-hidden="true">
			{#each items as r (r.symbol + '__dup')}
				<div class="tick">
					<div class="tickSym">{r.symbol}</div>
					<div
						class="tickVal price-flash font-data"
						class:blink-green={flashStates[r.symbol] === 'up'}
						class:blink-red={flashStates[r.symbol] === 'down'}
					>
						{r.value}
					</div>
					<div class={'tickChg font-data ' + clsFor(r.change)}>{fmtChg(r.change)}</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.ticker {
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		background: rgba(9, 9, 11, 0.35);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
	}

	.tickerMask {
		position: relative;
		overflow: hidden;
		white-space: nowrap;
		padding: 7px 8px;
	}

	.tickerMask::before,
	.tickerMask::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 32px;
		pointer-events: none;
		z-index: 2;
	}

	.tickerMask::before {
		left: 0;
		background: linear-gradient(to right, rgba(9, 9, 11, 0.95), transparent);
	}

	.tickerMask::after {
		right: 0;
		background: linear-gradient(to left, rgba(9, 9, 11, 0.95), transparent);
	}

	.tickerTrack {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		will-change: transform;
		animation: tickerScroll 42s linear infinite;
	}

	.ticker:hover .tickerTrack {
		animation-play-state: paused;
	}

	@keyframes tickerScroll {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(-100%);
		}
	}

	.tick {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		background: rgba(24, 24, 27, 0.55);
		padding: 4px 10px;
		transition: border-color 150ms ease;
	}

	.tick:hover {
		border-color: rgba(245, 158, 11, 0.2);
	}

	.tickSym {
		font-family: var(--font-data);
		color: var(--color-accent-cyan);
		opacity: 0.75;
		letter-spacing: 0.08em;
		font-size: 10px;
	}

	.tickVal {
		color: var(--color-text-primary);
		letter-spacing: 0.02em;
		font-weight: 600;
	}

	.tickChg {
		letter-spacing: 0.02em;
		transition: color 150ms ease;
	}
</style>

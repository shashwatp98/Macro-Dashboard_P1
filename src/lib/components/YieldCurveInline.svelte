<script lang="ts">
	import type { DataSourceTag } from '$lib/types/market';

	type Props = {
		us3mYield: number;
		us2yYield: number;
		us10yYield: number;
		us30yYield: number;
		spread2s10s: number;
		spread10s30s: number;
		marketsSource?: DataSourceTag;
	};

	let {
		us3mYield,
		us2yYield,
		us10yYield,
		us30yYield,
		spread2s10s,
		spread10s30s: _spread10s30s,
		marketsSource
	}: Props = $props();

	type CurvePoint = {
		tenor: string;
		yield: number;
	};

	const curve = $derived<CurvePoint[]>([
		{ tenor: '3M', yield: us3mYield },
		{ tenor: '2Y', yield: us2yYield },
		{ tenor: '10Y', yield: us10yYield },
		{ tenor: '30Y', yield: us30yYield }
	]);

	const w = 720;
	const h = 180;
	const padX = 16;
	const padY = 14;

	const minY = $derived(Math.min(...curve.map((p) => p.yield)));
	const maxY = $derived(Math.max(...curve.map((p) => p.yield)));
	const rangeY = $derived(Math.max(0.0001, maxY - minY));

	const xAt = (i: number, len: number) => padX + (i * (w - padX * 2)) / Math.max(1, len - 1);
	const yAt = (v: number, min: number, range: number) => {
		const t = (v - min) / range;
		return padY + (1 - t) * (h - padY * 2);
	};

	const pathD = $derived(
		curve
			.map(
				(p, i) =>
					`${i === 0 ? 'M' : 'L'} ${xAt(i, curve.length).toFixed(2)} ${yAt(p.yield, minY, rangeY).toFixed(2)}`
			)
			.join(' ')
	);

	const invLevel = $derived(spread2s10s * 100);

	const clsFor = (value: number) => {
		if (value > 0) return 'text-emerald-500';
		if (value < 0) return 'text-rose-500';
		return 'text-zinc-300';
	};
</script>

<div class="widget border border-zinc-800 h-full" class:opacity-75={marketsSource === 'fallback'}>
	<div class="widgetHeader">
		<div class="widgetTitle">
			Yield Curve Monitor{#if marketsSource === 'cache'}<span class="sourceBadge sourceBadgeCache">CACHED</span>{:else if marketsSource === 'fallback'}<span class="sourceBadge sourceBadgeStale">[STALE]</span>{/if}
		</div>
		<div class="widgetMeta">UST curve — 3M / 2Y / 10Y / 30Y</div>
	</div>
	<div class="widgetBody">
		<div class="curveWrap border border-zinc-800">
			<svg viewBox={`0 0 ${w} ${h}`} class="curveSvg" role="img" aria-label="Yield curve line chart">
				<defs>
					<linearGradient id="yieldCurveGradient" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stop-color="rgb(16 185 129)" stop-opacity="0.45" />
						<stop offset="55%" stop-color="rgb(52 211 153)" stop-opacity="0.5" />
						<stop offset="100%" stop-color="rgb(244 63 94)" stop-opacity="0.55" />
					</linearGradient>
				</defs>

				{#each Array.from({ length: 6 }) as _, i (i)}
					<line
						x1={padX}
						y1={padY + (i * (h - padY * 2)) / 5}
						x2={w - padX}
						y2={padY + (i * (h - padY * 2)) / 5}
						class="curveGrid"
					/>
				{/each}

				<path
					d={pathD}
					fill="none"
					stroke="url(#yieldCurveGradient)"
					stroke-width="2.2"
					stroke-linecap="round"
				/>

				{#each curve as p, i (p.tenor)}
					<circle
						cx={xAt(i, curve.length)}
						cy={yAt(p.yield, minY, rangeY)}
						r="2.4"
						class="curvePt"
					/>
				{/each}
			</svg>

			<div class="tenors">
				{#each curve as p (p.tenor)}
					<div class="tenor font-mono">{p.tenor}</div>
				{/each}
			</div>
		</div>

		<div class="mt-3 grid grid-cols-2 gap-2">
			{#each curve as p (p.tenor + '-kpi')}
				<div class="miniKpi border border-zinc-800">
					<div class="k">{p.tenor}</div>
					<div class="v font-mono">{p.yield.toFixed(2)}%</div>
				</div>
			{/each}
		</div>

		<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
			<div class="badge border border-zinc-800">
				<span class="bKey">2s10s</span>
				<span class={'bVal font-mono ' + clsFor(invLevel)}>
					{invLevel.toFixed(1)}bp
				</span>
			</div>
			<div class="badge border border-zinc-800">
				<span class="bKey">RANGE</span>
				<span class="bVal font-mono">{minY.toFixed(2)}–{maxY.toFixed(2)}%</span>
			</div>
		</div>
	</div>
</div>

<style>
	.widget {
		background: rgba(24, 24, 27, 0.78);
	}

	.widgetHeader {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 10px 10px 8px 10px;
		border-bottom: 1px solid rgb(39 39 42);
		background: rgba(9, 9, 11, 0.35);
	}

	.widgetTitle {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.22em;
		color: rgb(212 212 216);
	}

	.widgetMeta {
		font-size: 11px;
		color: rgb(113 113 122);
	}

	.widgetBody {
		padding: 8px 10px 10px 10px;
	}

	.miniKpi {
		background: rgba(9, 9, 11, 0.22);
		padding: 8px 10px;
	}

	.miniKpi .k {
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgb(113 113 122);
	}

	.miniKpi .v {
		margin-top: 4px;
		font-size: 13px;
		color: rgb(244 244 245);
		letter-spacing: 0.02em;
	}

	.curveWrap {
		background: rgba(9, 9, 11, 0.2);
		padding: 10px 10px 8px 10px;
	}

	.curveSvg {
		width: 100%;
		height: auto;
		display: block;
	}

	.curveGrid {
		stroke: rgba(39, 39, 42, 0.65);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.curvePt {
		fill: rgb(244 244 245);
		opacity: 0.85;
	}

	.tenors {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
		margin-top: 8px;
	}

	.tenor {
		text-align: center;
		font-size: 10px;
		color: rgb(161 161 170);
		letter-spacing: 0.08em;
		border-top: 1px solid rgba(39, 39, 42, 0.7);
		padding-top: 6px;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: rgba(24, 24, 27, 0.5);
		padding: 4px 8px;
	}

	.bKey {
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgb(113 113 122);
	}

	.bVal {
		font-size: 11px;
		color: rgb(212 212 216);
	}

	.sourceBadge {
		display: inline-block;
		margin-left: 6px;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.1em;
		vertical-align: middle;
		white-space: nowrap;
	}

	.sourceBadgeCache {
		color: rgb(113 113 122);
	}

	.sourceBadgeStale {
		color: rgba(244, 63, 94, 0.8);
	}
</style>

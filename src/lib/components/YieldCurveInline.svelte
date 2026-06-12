<script lang="ts">
	import type { DataSourceTag } from '$lib/types/market';
	import Panel from './Panel.svelte';

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
		color: string;
	};

	const TENOR_COLORS = ['#22d3ee', '#34d399', '#f59e0b', '#fb7185'];

	const curve = $derived<CurvePoint[]>([
		{ tenor: '3M', yield: us3mYield, color: TENOR_COLORS[0] },
		{ tenor: '2Y', yield: us2yYield, color: TENOR_COLORS[1] },
		{ tenor: '10Y', yield: us10yYield, color: TENOR_COLORS[2] },
		{ tenor: '30Y', yield: us30yYield, color: TENOR_COLORS[3] }
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

	const areaD = $derived(
		`${pathD} L ${xAt(curve.length - 1, curve.length).toFixed(2)} ${(h - padY).toFixed(2)} L ${xAt(0, curve.length).toFixed(2)} ${(h - padY).toFixed(2)} Z`
	);

	const invLevel = $derived(spread2s10s * 100);
	const isInverted = $derived(spread2s10s < 0);

	const spread2s10sClass = $derived(
		isInverted ? 'badgeVal--danger' : invLevel > 0 ? 'badgeVal--positive' : 'badgeVal--neutral'
	);
</script>

<Panel title="Yield Curve Monitor" meta="UST curve — 3M / 2Y / 10Y / 30Y" source={marketsSource}>
	<div class="curveWrap">
		<svg viewBox={`0 0 ${w} ${h}`} class="curveSvg" role="img" aria-label="Yield curve line chart">
			<defs>
				<linearGradient id="yieldCurveGradient" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0%" stop-color="rgb(34 211 238)" stop-opacity="0.7" />
					<stop offset="45%" stop-color="rgb(52 211 153)" stop-opacity="0.75" />
					<stop offset="100%" stop-color="rgb(245 158 11)" stop-opacity="0.8" />
				</linearGradient>
				<linearGradient id="yieldAreaGradient" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="rgb(34 211 238)" stop-opacity="0.12" />
					<stop offset="100%" stop-color="rgb(34 211 238)" stop-opacity="0" />
				</linearGradient>
				<filter id="curveGlow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
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

			<path d={areaD} fill="url(#yieldAreaGradient)" />

			<path
				d={pathD}
				fill="none"
				stroke="url(#yieldCurveGradient)"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				filter="url(#curveGlow)"
				opacity="0.95"
			/>

			{#each curve as p, i (p.tenor)}
				<circle
					cx={xAt(i, curve.length)}
					cy={yAt(p.yield, minY, rangeY)}
					r="4"
					fill={p.color}
					stroke="rgba(9,9,11,0.8)"
					stroke-width="1.5"
				/>
			{/each}
		</svg>

		<div class="tenors">
			{#each curve as p (p.tenor)}
				<div class="tenor">
					<span class="tenorDot" style:background={p.color}></span>
					<span class="tenorLabel font-data">{p.tenor}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="miniKpiGrid">
		{#each curve as p (p.tenor + '-kpi')}
			<div class="miniKpi">
				<div class="miniKpiHead">
					<span class="tenorDot" style:background={p.color}></span>
					<span class="miniKpiKey">{p.tenor}</span>
				</div>
				<div class="miniKpiVal font-data">{p.yield.toFixed(2)}%</div>
			</div>
		{/each}
	</div>

	<div class="badgeRow">
		<div class="statBadge">
			<span class="badgeKey">2s10s</span>
			<span class="badgeVal font-data {spread2s10sClass}">
				{invLevel.toFixed(1)}bp
				{#if isInverted}
					<span class="invertedTag">INV</span>
				{/if}
			</span>
		</div>
		<div class="statBadge">
			<span class="badgeKey">Range</span>
			<span class="badgeVal font-data badgeVal--neutral"
				>{minY.toFixed(2)}–{maxY.toFixed(2)}%</span
			>
		</div>
	</div>
</Panel>

<style>
	.curveWrap {
		background: rgba(9, 9, 11, 0.35);
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		padding: 12px 12px 8px;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
	}

	.curveSvg {
		width: 100%;
		height: auto;
		display: block;
	}

	.curveGrid {
		stroke: rgba(63, 63, 70, 0.45);
		stroke-width: 1;
		shape-rendering: crispEdges;
	}

	.tenors {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
		margin-top: 10px;
	}

	.tenor {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding-top: 8px;
		border-top: 1px solid rgba(63, 63, 70, 0.5);
	}

	.tenorDot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.tenorLabel {
		font-size: 10px;
		color: var(--color-text-secondary);
		letter-spacing: 0.08em;
	}

	.miniKpiGrid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
		margin-top: 12px;
	}

	.miniKpi {
		background: rgba(9, 9, 11, 0.3);
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		padding: 8px 10px;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
		transition: border-color 150ms ease;
	}

	.miniKpi:hover {
		border-color: rgba(34, 211, 238, 0.2);
	}

	.miniKpiHead {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.miniKpiKey {
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.miniKpiVal {
		margin-top: 4px;
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.badgeRow {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}

	.statBadge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: rgba(24, 24, 27, 0.55);
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		padding: 5px 10px;
	}

	.badgeKey {
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.badgeVal {
		font-size: 11px;
		font-weight: 600;
		transition: color 150ms ease;
	}

	.badgeVal--positive {
		color: #34d399;
	}

	.badgeVal--danger {
		color: #fb7185;
	}

	.badgeVal--neutral {
		color: #d4d4d8;
	}

	.invertedTag {
		margin-left: 4px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #fb7185;
		opacity: 0.85;
	}
</style>

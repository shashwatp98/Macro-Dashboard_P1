<script lang="ts">
	import { onDestroy } from 'svelte';

	type Change = {
		mode: 'pct' | 'bp';
		value: number;
	};

	type WidgetRow = {
		symbol: string;
		label: string;
		value: string;
		change: Change;
		note?: string;
		forceNegative?: boolean;
	};

	type CurvePoint = {
		tenor: string;
		yield: number;
	};

	const fmtSigned = (n: number, digits = 2) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
	const fmtSignedBp = (n: number, digits = 3) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
	const clsFor = (c: Change, forceNegative = false) => {
		const v = forceNegative ? -Math.abs(c.value) : c.value;
		if (v > 0) return 'text-emerald-300';
		if (v < 0) return 'text-rose-300';
		return 'text-zinc-300';
	};

	const rates: WidgetRow[] = [
		{ symbol: 'US2Y', label: 'US 2Y', value: '4.82%', change: { mode: 'bp', value: 0.012 } },
		{ symbol: 'US10Y', label: 'US 10Y', value: '4.45%', change: { mode: 'bp', value: -0.034 } },
		{ symbol: 'US30Y', label: 'US 30Y', value: '4.58%', change: { mode: 'bp', value: -0.021 } }
	];

	const spreads: WidgetRow[] = [
		{
			symbol: '2s10s',
			label: '2s10s Spread',
			value: '-0.37%',
			change: { mode: 'pct', value: -0.37 },
			note: 'inverted',
			forceNegative: true
		},
		{ symbol: '5s30s', label: '5s30s Spread', value: '+0.13%', change: { mode: 'pct', value: 0.13 } }
	];

	const equities: WidgetRow[] = [
		{ symbol: 'SPX', label: 'S&P 500', value: '5,300', change: { mode: 'pct', value: 0.45 } },
		{ symbol: 'NDX', label: 'Nasdaq 100', value: '18,500', change: { mode: 'pct', value: 0.62 } },
		{ symbol: 'RUT', label: 'Russell 2000', value: '2,020', change: { mode: 'pct', value: -0.15 } }
	];

	const commodities: WidgetRow[] = [
		{ symbol: 'XAU', label: 'Gold', value: '$2,345.60', change: { mode: 'pct', value: 0.61 } },
		{ symbol: 'WTI', label: 'WTI Crude', value: '$78.45', change: { mode: 'pct', value: -1.41 } },
		{ symbol: 'BRN', label: 'Brent Crude', value: '$82.90', change: { mode: 'pct', value: -1.13 } },
		{ symbol: 'HG', label: 'Copper', value: '$4.62', change: { mode: 'pct', value: 1.09 } }
	];

	const important: WidgetRow[] = [
		{ symbol: 'DXY', label: 'DXY', value: '104.65', change: { mode: 'pct', value: 0.14 } },
		{ symbol: 'VIX', label: 'VIX', value: '13.25', change: { mode: 'pct', value: -2.3 } }
	];

	const curve: CurvePoint[] = [
		{ tenor: '1M', yield: 5.3 },
		{ tenor: '3M', yield: 5.25 },
		{ tenor: '6M', yield: 5.15 },
		{ tenor: '1Y', yield: 4.95 },
		{ tenor: '2Y', yield: 4.82 },
		{ tenor: '5Y', yield: 4.6 },
		{ tenor: '10Y', yield: 4.45 },
		{ tenor: '30Y', yield: 4.58 }
	];

	const w = 720;
	const h = 180;
	const padX = 16;
	const padY = 14;

	const minY = Math.min(...curve.map((p) => p.yield));
	const maxY = Math.max(...curve.map((p) => p.yield));
	const rangeY = Math.max(0.0001, maxY - minY);

	const xAt = (i: number) => padX + (i * (w - padX * 2)) / Math.max(1, curve.length - 1);
	const yAt = (v: number) => {
		const t = (v - minY) / rangeY;
		return padY + (1 - t) * (h - padY * 2);
	};

	const pathD = curve
		.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(p.yield).toFixed(2)}`)
		.join(' ');

	const invLevel = (() => {
		const a = curve.find((p) => p.tenor === '2Y')?.yield ?? 0;
		const b = curve.find((p) => p.tenor === '10Y')?.yield ?? 0;
		return (b - a) * 100;
	})();

	const headerTime = () => {
		const d = new Date();
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		const ss = String(d.getSeconds()).padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	};

	const clockFmt = (timeZone: string) =>
		new Intl.DateTimeFormat('en-GB', {
			timeZone,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});

	const fmtNY = clockFmt('America/New_York');
	const fmtLDN = clockFmt('Europe/London');
	const fmtTKY = clockFmt('Asia/Tokyo');
	const fmtDEL = clockFmt('Asia/Kolkata');

	const nyParts = (d: Date) =>
		new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).formatToParts(d);

	const tickerItems = [...rates, ...equities, ...commodities, ...important];

	let now = headerTime();
	let ny = 'NY: --:--:--';
	let ldn = 'LDN: --:--:--';
	let tky = 'TKY: --:--:--';
	let del = 'DEL: --:--:--';
	let ustOpen = false;

	const tick = () => {
		const d = new Date();
		now = headerTime();

		ny = `NY: ${fmtNY.format(d)}`;
		ldn = `LDN: ${fmtLDN.format(d)}`;
		tky = `TKY: ${fmtTKY.format(d)}`;
		del = `DEL: ${fmtDEL.format(d)}`;

		const parts = nyParts(d);
		const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
		const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00';
		const minuteStr = parts.find((p) => p.type === 'minute')?.value ?? '00';
		const hour = Number(hourStr);
		const minute = Number(minuteStr);

		const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
		const afterOpen = hour > 8 || (hour === 8 && minute >= 0);
		const beforeClose = hour < 17 || (hour === 17 && minute === 0);
		ustOpen = isWeekday && afterOpen && beforeClose;
	};

	tick();
	const interval = setInterval(tick, 1000);
	onDestroy(() => clearInterval(interval));
</script>

<main class="min-h-screen bg-zinc-900 text-zinc-100">
	<!-- Clock & Market Status banner -->
	<div class="border-b border-zinc-800 bg-zinc-900">
		<div class="mx-auto max-w-[1600px] px-3 py-1">
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-zinc-300">
				<div class="flex items-center gap-3">
					<span class="text-zinc-200">{ny}</span>
					<span class="text-zinc-500">|</span>
					<span>{ldn}</span>
					<span class="text-zinc-500">|</span>
					<span>{tky}</span>
					<span class="text-zinc-500">|</span>
					<span>{del}</span>
				</div>

				<div class="ml-auto flex items-center gap-2">
					<span
						class={
							'h-1.5 w-1.5 rounded-full ' +
							(ustOpen ? 'bg-emerald-300 animate-pulse' : 'bg-rose-400/60')
						}
						aria-hidden="true"
					/>
					<span class={ustOpen ? 'text-emerald-300' : 'text-rose-300'}>
						US TREASURY: {ustOpen ? 'OPEN' : 'CLOSED'}
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Top summary ticker -->
	<div class="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
		<div class="mx-auto max-w-[1600px] px-3 py-2">
			<div class="flex items-center gap-3">
				<div class="flex items-baseline gap-2">
					<div class="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
						Global Macro Dashboard
					</div>
				</div>
				<div class="ml-auto flex items-center gap-3 text-[11px] text-zinc-400">
					<div class="hidden sm:block">LOCAL</div>
					<div class="font-mono text-zinc-200">{now}</div>
					<div class="h-3 w-px bg-zinc-800" />
					<div class="font-mono">
						2s10s&nbsp;
						<span class={clsFor({ mode: 'bp', value: invLevel }, true)}>{invLevel.toFixed(1)}bp</span>
					</div>
				</div>
			</div>

			<div class="mt-2 ticker" aria-label="Market summary ticker (mock)">
				<div class="tickerMask">
					<div class="tickerTrack">
						{#each tickerItems as r (r.symbol)}
							<div class="tick">
								<div class="tickSym">{r.symbol}</div>
								<div class="tickVal font-mono">{r.value}</div>
								<div class={"tickChg font-mono " + clsFor(r.change, r.forceNegative ?? false)}>
									{r.change.mode === 'pct'
										? `${fmtSigned(r.change.value, 2)}%`
										: `${fmtSignedBp(r.change.value, 3)}`}
								</div>
							</div>
						{/each}
					</div>
					<div class="tickerTrack" aria-hidden="true">
						{#each tickerItems as r (r.symbol + '__dup')}
							<div class="tick">
								<div class="tickSym">{r.symbol}</div>
								<div class="tickVal font-mono">{r.value}</div>
								<div class={"tickChg font-mono " + clsFor(r.change, r.forceNegative ?? false)}>
									{r.change.mode === 'pct'
										? `${fmtSigned(r.change.value, 2)}%`
										: `${fmtSignedBp(r.change.value, 3)}`}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-3 pb-6 pt-3">
		<!-- Main 3-column market grid -->
		<div class="grid grid-cols-1 gap-2 lg:grid-cols-3">
			<section class="space-y-2">
				<div class="widget">
					<div class="widgetHeader">
						<div class="widgetTitle">Rates</div>
						<div class="widgetMeta">UST yields</div>
					</div>
					<div class="widgetBody">
						{#each rates as r (r.symbol)}
							<div class="row">
								<div class="rowL">
									<div class="sym">{r.symbol}</div>
									<div class="lbl">{r.label}</div>
								</div>
								<div class="rowR">
									<div class="val font-mono">{r.value}</div>
									<div class={"chg font-mono " + clsFor(r.change)}>
										{fmtSignedBp(r.change.value, 3)}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="widget">
					<div class="widgetHeader">
						<div class="widgetTitle">Spreads</div>
						<div class="widgetMeta">curve / inversion</div>
					</div>
					<div class="widgetBody">
						{#each spreads as s (s.symbol)}
							<div class="row">
								<div class="rowL">
									<div class="sym">{s.symbol}</div>
									<div class="lbl">{s.label}</div>
								</div>
								<div class="rowR">
									<div class="val font-mono">{s.value}</div>
									<div class={"chg font-mono " + clsFor(s.change, s.forceNegative ?? false)}>
										{s.change.mode === 'pct' ? `${fmtSigned(s.change.value, 2)}%` : fmtSignedBp(s.change.value, 3)}
									</div>
								</div>
							</div>
							{#if s.note}
								<div class="noteRow">
									<span class="noteTag">FLAG</span>
									<span class="noteText">{s.note.toUpperCase()}</span>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			</section>

			<section class="space-y-2">
				<div class="widget">
					<div class="widgetHeader">
						<div class="widgetTitle">Equities</div>
						<div class="widgetMeta">major indices</div>
					</div>
					<div class="widgetBody">
						{#each equities as e (e.symbol)}
							<div class="row">
								<div class="rowL">
									<div class="sym">{e.symbol}</div>
									<div class="lbl">{e.label}</div>
								</div>
								<div class="rowR">
									<div class="val font-mono">{e.value}</div>
									<div class={"chg font-mono " + clsFor(e.change)}>
										{fmtSigned(e.change.value, 2)}%
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="widget">
					<div class="widgetHeader">
						<div class="widgetTitle">Commodities</div>
						<div class="widgetMeta">spot / front month</div>
					</div>
					<div class="widgetBody">
						{#each commodities as c (c.symbol)}
							<div class="row">
								<div class="rowL">
									<div class="sym">{c.symbol}</div>
									<div class="lbl">{c.label}</div>
								</div>
								<div class="rowR">
									<div class="val font-mono">{c.value}</div>
									<div class={"chg font-mono " + clsFor(c.change)}>
										{fmtSigned(c.change.value, 2)}%
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</section>

			<section class="space-y-2">
				<div class="widget">
					<div class="widgetHeader">
						<div class="widgetTitle">Important Tickers</div>
						<div class="widgetMeta">risk / dollar</div>
					</div>
					<div class="widgetBody">
						{#each important as t (t.symbol)}
							<div class="row">
								<div class="rowL">
									<div class="sym">{t.symbol}</div>
									<div class="lbl">{t.label}</div>
								</div>
								<div class="rowR">
									<div class="val font-mono">{t.value}</div>
									<div class={"chg font-mono " + clsFor(t.change)}>
										{fmtSigned(t.change.value, 2)}%
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="widget">
					<div class="widgetHeader">
						<div class="widgetTitle">System</div>
						<div class="widgetMeta">snapshot</div>
					</div>
					<div class="widgetBody">
						<div class="grid grid-cols-2 gap-2">
							<div class="miniKpi">
								<div class="k">REGIME</div>
								<div class="v font-mono">TIGHT</div>
							</div>
							<div class="miniKpi">
								<div class="k">LIQUIDITY</div>
								<div class="v font-mono">NEUTRAL</div>
							</div>
							<div class="miniKpi">
								<div class="k">VOL</div>
								<div class="v font-mono">LOW</div>
							</div>
							<div class="miniKpi">
								<div class="k">RISK</div>
								<div class="v font-mono">MIXED</div>
							</div>
						</div>
						<div class="mt-2 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
							Mock terminal layout. Numbers are static for this version.
						</div>
					</div>
				</div>
			</section>

			<!-- Dedicated yield curve section -->
			<section class="lg:col-span-3">
				<div class="widget">
					<div class="widgetHeader">
						<div class="widgetTitle">Yield Curve Monitor</div>
						<div class="widgetMeta">UST curve (inversion visible)</div>
					</div>
					<div class="widgetBody">
						<div class="curveWrap">
							<svg
								viewBox={`0 0 ${w} ${h}`}
								class="curveSvg"
								role="img"
								aria-label="Yield curve line chart (mock)"
							>
								<defs>
									<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
										<stop offset="0%" stop-color="rgb(16 185 129)" stop-opacity="0.45" />
										<stop offset="70%" stop-color="rgb(244 63 94)" stop-opacity="0.55" />
										<stop offset="100%" stop-color="rgb(244 63 94)" stop-opacity="0.65" />
									</linearGradient>
								</defs>

								<!-- grid -->
								{#each Array.from({ length: 6 }) as _, i (i)}
									<line
										x1={padX}
										y1={padY + (i * (h - padY * 2)) / 5}
										x2={w - padX}
										y2={padY + (i * (h - padY * 2)) / 5}
										class="curveGrid"
									/>
								{/each}

								<!-- curve -->
								<path d={pathD} fill="none" stroke="url(#g)" stroke-width="2.2" stroke-linecap="round" />

								<!-- points -->
								{#each curve as p, i (p.tenor)}
									<circle cx={xAt(i)} cy={yAt(p.yield)} r="2.4" class="curvePt" />
								{/each}
							</svg>

							<div class="tenors">
								{#each curve as p (p.tenor)}
									<div class="tenor font-mono">{p.tenor}</div>
								{/each}
							</div>
						</div>

						<div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
							<div class="miniKpi">
								<div class="k">1M</div>
								<div class="v font-mono">{curve[0].yield.toFixed(2)}%</div>
							</div>
							<div class="miniKpi">
								<div class="k">2Y</div>
								<div class="v font-mono">{(curve.find((p) => p.tenor === '2Y')?.yield ?? 0).toFixed(2)}%</div>
							</div>
							<div class="miniKpi">
								<div class="k">10Y</div>
								<div class="v font-mono">{(curve.find((p) => p.tenor === '10Y')?.yield ?? 0).toFixed(2)}%</div>
							</div>
						</div>

						<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
							<div class="badge">
								<span class="bKey">INVERSION</span>
								<span class={"bVal " + clsFor({ mode: 'bp', value: invLevel }, true)}>
									{invLevel.toFixed(1)}bp
								</span>
							</div>
							<div class="badge">
								<span class="bKey">RANGE</span>
								<span class="bVal font-mono">{minY.toFixed(2)}–{maxY.toFixed(2)}%</span>
							</div>
							<div class="badge">
								<span class="bKey">MODE</span>
								<span class="bVal font-mono">STATIC</span>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</main>

<style>
	:global(html) {
		background: #18181b;
	}

	.widget {
		border: 1px solid rgb(39 39 42);
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

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 7px 0;
		border-bottom: 1px solid rgba(39, 39, 42, 0.7);
	}

	.row:last-child {
		border-bottom: none;
	}

	.rowL {
		display: flex;
		align-items: baseline;
		gap: 10px;
		min-width: 0;
	}

	.sym {
		font-size: 11px;
		color: rgb(113 113 122);
		min-width: 44px;
	}

	.lbl {
		font-size: 12px;
		color: rgb(228 228 231);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rowR {
		display: flex;
		align-items: baseline;
		gap: 12px;
	}

	.val {
		font-size: 12px;
		color: rgb(244 244 245);
		min-width: 92px;
		text-align: right;
		letter-spacing: 0.02em;
	}

	.chg {
		font-size: 12px;
		min-width: 78px;
		text-align: right;
		letter-spacing: 0.02em;
	}

	.noteRow {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0 4px 0;
	}

	.noteTag {
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgb(161 161 170);
		border: 1px solid rgb(39 39 42);
		padding: 2px 6px;
		background: rgba(24, 24, 27, 0.6);
	}

	.noteText {
		font-size: 11px;
		color: rgb(244 63 94);
		letter-spacing: 0.12em;
	}

	.miniKpi {
		border: 1px solid rgb(39 39 42);
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
		border: 1px solid rgba(39, 39, 42, 0.85);
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
		grid-template-columns: repeat(8, minmax(0, 1fr));
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
		border: 1px solid rgb(39 39 42);
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

	/* Ticker (marquee-style) */
	.ticker {
		border: 1px solid rgb(39 39 42);
		background: rgba(9, 9, 11, 0.25);
	}

	.tickerMask {
		position: relative;
		overflow: hidden;
		white-space: nowrap;
		padding: 6px 6px;
	}

	.tickerMask::before,
	.tickerMask::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 28px;
		pointer-events: none;
		z-index: 2;
	}

	.tickerMask::before {
		left: 0;
		background: linear-gradient(to right, rgba(24, 24, 27, 0.95), rgba(24, 24, 27, 0));
	}

	.tickerMask::after {
		right: 0;
		background: linear-gradient(to left, rgba(24, 24, 27, 0.95), rgba(24, 24, 27, 0));
	}

	.tickerTrack {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		will-change: transform;
		animation: tickerScroll 34s linear infinite;
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

	@media (prefers-reduced-motion: reduce) {
		.tickerTrack {
			animation: none;
		}
	}

	.tick {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		border: 1px solid rgba(39, 39, 42, 0.9);
		background: rgba(24, 24, 27, 0.6);
		padding: 4px 8px;
	}

	.tickSym {
		color: rgb(113 113 122);
		letter-spacing: 0.08em;
	}

	.tickVal {
		color: rgb(244 244 245);
		letter-spacing: 0.02em;
	}

	.tickChg {
		letter-spacing: 0.02em;
	}
</style>

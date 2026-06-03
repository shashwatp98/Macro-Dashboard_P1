<script lang="ts">
	import { onDestroy } from 'svelte';

	type Change = {
		mode: 'pct' | 'abs' | 'bp';
		value: number;
	};

	type Ticker = {
		symbol: string;
		label: string;
		value: string;
		change: Change;
	};

	type MarketSection = {
		id: string;
		title: string;
		items: Ticker[];
	};

	type CurvePoint = {
		tenor: string;
		yield: number;
	};

	const fmtSigned = (n: number, digits = 2) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
	const fmtSignedBp = (n: number, digits = 3) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;

	const fmtChg = (c: Change) => {
		if (c.mode === 'pct') return `${fmtSigned(c.value, 2)}%`;
		if (c.mode === 'bp') return fmtSignedBp(c.value, 3);
		return fmtSigned(c.value, 2);
	};

	const clsFor = (c: Change) => {
		if (c.value > 0) return 'text-emerald-300';
		if (c.value < 0) return 'text-rose-300';
		return 'text-zinc-300';
	};

	const usRatesFunding: Ticker[] = [
		{ symbol: 'EFFR', label: 'EFFR', value: '3.65%', change: { mode: 'abs', value: 0 } },
		{ symbol: 'SOFR', label: 'SOFR', value: '3.65%', change: { mode: 'abs', value: 0.02 } },
		{ symbol: '3M', label: 'US 3-Month T-Bill', value: '4.15%', change: { mode: 'abs', value: 0.01 } },
		{ symbol: 'US2Y', label: 'US 2-Year Treasury', value: '4.38%', change: { mode: 'abs', value: -0.02 } },
		{ symbol: 'US10Y', label: 'US 10-Year Treasury', value: '4.43%', change: { mode: 'abs', value: -0.04 } },
		{ symbol: 'US30Y', label: 'US 30-Year Treasury', value: '4.95%', change: { mode: 'abs', value: -0.03 } }
	];

	const yieldSpreads: Ticker[] = [
		{ symbol: '2s10s', label: '2s10s Spread', value: '0.05%', change: { mode: 'abs', value: -0.02 } },
		{ symbol: '10s30s', label: '10s30s Spread', value: '0.52%', change: { mode: 'abs', value: 0.01 } }
	];

	const globalSovereign: Ticker[] = [
		{ symbol: 'DE10Y', label: 'Bunds 10Y (Germany)', value: '2.45%', change: { mode: 'abs', value: -0.01 } },
		{ symbol: 'JP10Y', label: 'JGB 10Y (Japan)', value: '1.02%', change: { mode: 'abs', value: 0.03 } },
		{ symbol: 'AU10Y', label: 'Australia 10Y', value: '4.25%', change: { mode: 'abs', value: -0.02 } }
	];

	const globalEquities: Ticker[] = [
		{ symbol: 'SPX', label: 'S&P 500', value: '5,300.25', change: { mode: 'pct', value: 0.45 } },
		{ symbol: 'NDX', label: 'NASDAQ 100', value: '18,500.50', change: { mode: 'pct', value: 0.62 } },
		{ symbol: 'DJI', label: 'Dow Jones', value: '39,120.00', change: { mode: 'pct', value: -0.12 } },
		{ symbol: 'UKX', label: 'FTSE 100', value: '8,230.10', change: { mode: 'pct', value: 0.18 } },
		{ symbol: 'NSE', label: 'Nifty 50', value: '23,200.40', change: { mode: 'pct', value: -0.7 } },
		{ symbol: 'SSEC', label: 'Shanghai Composite', value: '4,104.33', change: { mode: 'pct', value: 0.55 } }
	];

	const commoditiesFx: Ticker[] = [
		{ symbol: 'GC', label: 'Gold', value: '$2,345.60', change: { mode: 'pct', value: 0.61 } },
		{ symbol: 'SI', label: 'Silver', value: '$29.45', change: { mode: 'pct', value: 1.2 } },
		{ symbol: 'CL', label: 'WTI Crude', value: '$78.45', change: { mode: 'pct', value: -1.41 } },
		{ symbol: 'DXY', label: 'US Dollar Index', value: '104.65', change: { mode: 'pct', value: 0.14 } },
		{ symbol: 'USDJPY', label: 'USD/JPY', value: '156.20', change: { mode: 'pct', value: 0.45 } },
		{ symbol: 'USDINR', label: 'USD/INR', value: '83.55', change: { mode: 'pct', value: -0.08 } }
	];

	const primaryRow: MarketSection[] = [
		{ id: 'us-rates', title: 'US RATES & FUNDING', items: usRatesFunding },
		{ id: 'equities', title: 'GLOBAL EQUITIES', items: globalEquities },
		{ id: 'commodities-fx', title: 'COMMODITIES & GLOBAL FX', items: commoditiesFx }
	];

	const secondaryRow: MarketSection[] = [
		{ id: 'spreads', title: 'YIELD SPREADS', items: yieldSpreads },
		{ id: 'sovereign', title: 'GLOBAL SOVEREIGN 10Y', items: globalSovereign }
	];

	const sections = [...primaryRow, ...secondaryRow];

	const curve: CurvePoint[] = [
		{ tenor: '3M', yield: 4.15 },
		{ tenor: '2Y', yield: 4.38 },
		{ tenor: '10Y', yield: 4.43 },
		{ tenor: '30Y', yield: 4.95 }
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

	const tickerItems = sections.flatMap((s) => s.items);

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
				<div class="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
					Global Macro Dashboard
				</div>
				<div class="ml-auto flex items-center gap-3 text-[11px] text-zinc-400">
					<div class="hidden sm:block">LOCAL</div>
					<div class="font-mono text-zinc-200">{now}</div>
					<div class="h-3 w-px bg-zinc-800" />
					<div class="font-mono">
						2s10s&nbsp;
						<span class={clsFor({ mode: 'abs', value: invLevel })}>{invLevel.toFixed(1)}bp</span>
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
								<div class={"tickChg font-mono " + clsFor(r.change)}>
									{fmtChg(r.change)}
								</div>
							</div>
						{/each}
					</div>
					<div class="tickerTrack" aria-hidden="true">
						{#each tickerItems as r (r.symbol + '__dup')}
							<div class="tick">
								<div class="tickSym">{r.symbol}</div>
								<div class="tickVal font-mono">{r.value}</div>
								<div class={"tickChg font-mono " + clsFor(r.change)}>
									{fmtChg(r.change)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-3 pb-6 pt-3">
		<div class="dashboardLayout">
			<div class="blocksStack">
				<div class="blocksRow blocksRowPrimary">
					{#each primaryRow as section (section.id)}
						{@render sectionPanel(section)}
					{/each}
				</div>
				<div class="blocksRow blocksRowSecondary">
					{#each secondaryRow as section (section.id)}
						{@render sectionPanel(section)}
					{/each}
				</div>
			</div>

			<!-- Yield Curve Monitor -->
			<section class="curveSection">
				<div class="widget border border-zinc-800">
					<div class="widgetHeader">
						<div class="widgetTitle">Yield Curve Monitor</div>
						<div class="widgetMeta">UST curve — 3M / 2Y / 10Y / 30Y</div>
					</div>
					<div class="widgetBody">
						<div class="curveWrap border border-zinc-800">
							<svg
								viewBox={`0 0 ${w} ${h}`}
								class="curveSvg"
								role="img"
								aria-label="Yield curve line chart (mock)"
							>
								<defs>
									<linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
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

								<path d={pathD} fill="none" stroke="url(#g)" stroke-width="2.2" stroke-linecap="round" />

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

						<div class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
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
								<span class={"bVal font-mono " + clsFor({ mode: 'abs', value: invLevel })}>
									{invLevel.toFixed(1)}bp
								</span>
							</div>
							<div class="badge border border-zinc-800">
								<span class="bKey">RANGE</span>
								<span class="bVal font-mono">{minY.toFixed(2)}–{maxY.toFixed(2)}%</span>
							</div>
							<div class="badge border border-zinc-800">
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

{#snippet sectionPanel(section: MarketSection)}
	<section class="sectionPanel border border-zinc-800">
		<div class="sectionBand">
			<h2 class="sectionHeading">{section.title}</h2>
		</div>
		<div class="sectionBody">
			<div class="tickerGrid">
				{#each section.items as item (item.symbol)}
					<div class="tickerCard border border-zinc-800">
						<div class="tickerCardTop">
							<span class="tickerSym">{item.symbol}</span>
							<span class={"tickerChg font-mono " + clsFor(item.change)}>{fmtChg(item.change)}</span>
						</div>
						<div class="tickerLbl">{item.label}</div>
						<div class="tickerVal font-mono">{item.value}</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
{/snippet}

<style>
	:global(html) {
		background: #18181b;
	}

	.dashboardLayout {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.blocksStack {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.blocksRow {
		display: grid;
		gap: 8px;
		align-items: stretch;
		grid-template-columns: 1fr;
	}

	.blocksRowPrimary {
		grid-template-columns: 1fr;
	}

	@media (min-width: 768px) {
		.blocksRowPrimary {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.blocksRowSecondary {
		grid-template-columns: 1fr;
	}

	@media (min-width: 768px) {
		.blocksRowSecondary {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.sectionPanel {
		background: rgba(24, 24, 27, 0.78);
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.sectionBand {
		padding: 10px 10px 8px 10px;
		border-bottom: 1px solid rgb(39 39 42);
		background: rgba(0, 0, 0, 0.55);
	}

	.sectionHeading {
		margin: 0;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: rgb(228 228 231);
		line-height: 1.3;
	}

	.sectionBody {
		padding: 6px 8px 8px 8px;
		flex: 1;
	}

	.tickerGrid {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tickerCard {
		background: rgba(24, 24, 27, 0.65);
		padding: 6px 8px;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.tickerCardTop {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.tickerSym {
		font-size: 10px;
		letter-spacing: 0.1em;
		color: rgb(113 113 122);
		text-transform: uppercase;
	}

	.tickerLbl {
		font-size: 10px;
		color: rgb(161 161 170);
		margin-top: 2px;
		line-height: 1.25;
	}

	.tickerVal {
		font-size: 12px;
		color: rgb(250 250 250);
		margin-top: 4px;
		letter-spacing: 0.02em;
	}

	.curveSection {
		width: 100%;
	}

	.tickerChg {
		font-size: 11px;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

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

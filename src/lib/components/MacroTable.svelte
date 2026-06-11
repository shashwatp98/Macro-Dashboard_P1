<script lang="ts">
	import type { MacroBlock, MacroStatus, DataSourceTag } from '$lib/types/market';

	type FlashDirection = 'up' | 'down' | null;

	type Props = {
		uscpi?: MacroBlock;
		uscpicore?: MacroBlock;
		uspce?: MacroBlock;
		usnfp?: MacroBlock;
		usur?: MacroBlock;
		usgdp?: MacroBlock;
		macroSource?: DataSourceTag;
		flashStates?: Record<string, FlashDirection>;
	};

	let {
		uscpi,
		uscpicore,
		uspce,
		usnfp,
		usur,
		usgdp,
		macroSource,
		flashStates = {}
	}: Props = $props();

	type MacroRowKey = 'uscpi' | 'uscpicore' | 'uspce' | 'usnfp' | 'usur' | 'usgdp';

	type MacroRowDef = {
		key: MacroRowKey;
		label: string;
		sub: string;
		kind: 'pct' | 'jobs';
		outFlashKey: string;
	};

	const MACRO_ROWS: MacroRowDef[] = [
		{ key: 'uscpi', label: 'US CPI', sub: 'YoY', kind: 'pct', outFlashKey: 'MACRO_CPI_OUT' },
		{ key: 'uscpicore', label: 'Core CPI', sub: 'YoY', kind: 'pct', outFlashKey: 'MACRO_CORE_CPI_OUT' },
		{ key: 'uspce', label: 'Core PCE', sub: 'YoY', kind: 'pct', outFlashKey: 'MACRO_PCE_OUT' },
		{ key: 'usnfp', label: 'Nonfarm Payrolls', sub: 'Net Monthly Change', kind: 'jobs', outFlashKey: 'MACRO_NFP_OUT' },
		{ key: 'usur', label: 'Unemployment Rate', sub: 'Spot Rate', kind: 'pct', outFlashKey: 'MACRO_UR_OUT' },
		{ key: 'usgdp', label: 'GDP', sub: 'QoQ Ann.', kind: 'pct', outFlashKey: 'MACRO_GDP_OUT' }
	];

	const blocks: Record<MacroRowKey, MacroBlock | undefined> = $derived({
		uscpi,
		uscpicore,
		uspce,
		usnfp,
		usur,
		usgdp
	});

	const macroOutcomeBlink = (status: MacroStatus | null | undefined): FlashDirection => {
		if (status === 'EXP. BEAT' || status === 'COOL MISS') return 'up';
		if (status === 'HOT BEAT' || status === 'MISS') return 'down';
		return null;
	};

	const fmtMacroPctDelta = (value: number | undefined) => {
		const v = value ?? 0;
		return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
	};

	const fmtMacroJobsDelta = (value: number | undefined) => {
		const v = value ?? 0;
		return `${v >= 0 ? '+' : ''}${Math.round(v)}K`;
	};

	const formatActual = (block: MacroBlock | undefined, kind: 'pct' | 'jobs') => {
		if (!block) return '—';
		if (kind === 'jobs') return `${Math.round(block.price)}K`;
		return `${block.price.toFixed(2)}%`;
	};

	const formatDelta = (block: MacroBlock | undefined, kind: 'pct' | 'jobs') => {
		if (!block) return '—';
		return kind === 'jobs'
			? fmtMacroJobsDelta(block.changeFromPrior)
			: `${fmtMacroPctDelta(block.changeFromPrior)}%`;
	};

	const formatForecast = (block: MacroBlock | undefined, kind: 'pct' | 'jobs') => {
		if (!block) return '—';
		return kind === 'jobs' ? `${block.forecast}K` : `${block.forecast.toFixed(2)}%`;
	};
</script>

<div class="widget border border-zinc-800 h-full" class:opacity-75={macroSource === 'fallback'}>
	<div class="widgetHeader">
		<div class="widgetTitle">
			US Macro Data Blocks{#if macroSource === 'cache'}<span class="sourceBadge sourceBadgeCache">CACHED</span>{:else if macroSource === 'fallback'}<span class="sourceBadge sourceBadgeStale">[STALE]</span>{/if}
		</div>
		<div class="widgetMeta">Actual vs consensus — FRED prints</div>
	</div>
	<div class="widgetBody macroBody">
		<div class="macroTableWrap border border-zinc-800">
			<table class="macroTable w-full table-fixed">
				<thead>
					<tr>
						<th
							scope="col"
							class="w-[30%] p-3 text-left text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500"
							>INDICATOR</th
						>
						<th
							scope="col"
							class="w-[15%] p-3 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500"
							>ACTUAL</th
						>
						<th
							scope="col"
							class="w-[20%] p-3 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500"
							>Δ VS PRIOR</th
						>
						<th
							scope="col"
							class="w-[15%] p-3 text-right text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500"
							>FORECAST</th
						>
						<th
							scope="col"
							class="w-[20%] p-3 text-right text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-500"
							>OUTCOME</th
						>
					</tr>
				</thead>
				<tbody>
					{#each MACRO_ROWS as row (row.key)}
						{@const block = blocks[row.key]}
						{@const status = block?.status}
						<tr>
							<td class="p-3 text-left font-medium">
								{row.label}<br /><span class="text-xs text-neutral-500">{row.sub}</span>
							</td>
							<td class="p-3 text-right font-mono font-bold">
								{formatActual(block, row.kind)}
							</td>
							<td class="p-3 text-right font-mono text-neutral-400">
								{formatDelta(block, row.kind)}
							</td>
							<td class="p-3 text-right font-mono text-neutral-400">
								{formatForecast(block, row.kind)}
							</td>
							<td class="p-3 text-right">
								<span
									class="macroOutcome font-mono font-bold tracking-wider price-flash"
									class:text-rose-500={status === 'HOT BEAT' || status === 'MISS'}
									class:text-emerald-500={status === 'EXP. BEAT' || status === 'COOL MISS'}
									class:blink-green={macroOutcomeBlink(status) === 'up' &&
										flashStates[row.outFlashKey] === 'up'}
									class:blink-red={macroOutcomeBlink(status) === 'down' &&
										flashStates[row.outFlashKey] === 'down'}
								>
									{status ?? '—'}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
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

	.macroBody {
		padding: 6px 8px 8px 8px;
	}

	.macroTableWrap {
		background: rgba(9, 9, 11, 0.22);
		overflow-x: auto;
	}

	.macroTable {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		font-size: 11px;
	}

	.macroTable thead th {
		border-bottom: 1px solid rgb(39 39 42);
		vertical-align: bottom;
		white-space: nowrap;
	}

	.macroTable tbody td {
		border-bottom: 1px solid rgba(39, 39, 42, 0.65);
		vertical-align: middle;
	}

	.macroTable tbody td:first-child {
		white-space: normal;
		word-break: break-word;
	}

	.macroTable tbody td:not(:first-child) {
		white-space: nowrap;
	}

	.macroTable tbody tr:last-child td {
		border-bottom: none;
	}

	.macroTable tbody td:last-child {
		text-align: right;
	}

	:global(.macroTable .macroOutcome.price-flash) {
		display: inline-block;
		border-radius: 2px;
		padding: 0 2px;
	}

	:global(.macroTable .macroOutcome.price-flash.blink-green),
	:global(.macroTable .macroOutcome.price-flash.blink-red) {
		border-radius: 2px;
		padding: 0 2px;
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

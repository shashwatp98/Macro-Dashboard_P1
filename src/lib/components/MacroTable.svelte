<script lang="ts">
	import type { MacroBlock, MacroStatus, DataSourceTag } from '$lib/types/market';
	import { MACRO_FORECASTS_UPDATED } from '$lib/config/macro-forecasts';
	import Panel from './Panel.svelte';
	import StatusPill from './StatusPill.svelte';

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
		{
			key: 'uscpicore',
			label: 'Core CPI',
			sub: 'YoY',
			kind: 'pct',
			outFlashKey: 'MACRO_CORE_CPI_OUT'
		},
		{ key: 'uspce', label: 'Core PCE', sub: 'YoY', kind: 'pct', outFlashKey: 'MACRO_PCE_OUT' },
		{
			key: 'usnfp',
			label: 'Nonfarm Payrolls',
			sub: 'Net Monthly Change',
			kind: 'jobs',
			outFlashKey: 'MACRO_NFP_OUT'
		},
		{
			key: 'usur',
			label: 'Unemployment Rate',
			sub: 'Spot Rate',
			kind: 'pct',
			outFlashKey: 'MACRO_UR_OUT'
		},
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

	const rowOutcomeClass = (status: MacroStatus | null | undefined): string => {
		if (status === 'HOT BEAT' || status === 'MISS') return 'row-outcome--hot';
		if (status === 'EXP. BEAT' || status === 'COOL MISS') return 'row-outcome--cool';
		return 'row-outcome--neutral';
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

<Panel
	title="US Macro Data Blocks"
	meta="Actual vs manual consensus — FRED prints (forecasts updated {MACRO_FORECASTS_UPDATED})"
	source={macroSource}
	id="macro-table-heading"
>
	<div class="macroTableWrap">
		<table class="macroTable w-full table-fixed">
			<thead>
				<tr>
					<th
						scope="col"
						class="w-[30%] p-3 text-left text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase"
						>INDICATOR</th
					>
					<th
						scope="col"
						class="w-[15%] p-3 text-right text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase"
						>ACTUAL</th
					>
					<th
						scope="col"
						class="w-[20%] p-3 text-right text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase"
						>Δ VS PRIOR</th
					>
					<th
						scope="col"
						class="w-[15%] p-3 text-right text-[9px] font-bold tracking-[0.14em] text-neutral-500 uppercase"
						>FORECAST</th
					>
					<th
						scope="col"
						class="w-[20%] p-3 text-right text-[9px] font-bold tracking-[0.08em] text-neutral-500 uppercase"
						>OUTCOME</th
					>
				</tr>
			</thead>
			<tbody>
				{#each MACRO_ROWS as row (row.key)}
					{@const block = blocks[row.key]}
					{@const status = block?.status}
					<tr class={rowOutcomeClass(status)}>
						<td class="p-3 text-left font-medium">
							{row.label}<br /><span class="text-xs text-neutral-500">{row.sub}</span>
						</td>
						<td class="actual-cell p-3 text-right font-data">
							{formatActual(block, row.kind)}
						</td>
						<td class="p-3 text-right font-data text-neutral-400">
							{formatDelta(block, row.kind)}
						</td>
						<td class="p-3 text-right font-data text-neutral-400">
							{formatForecast(block, row.kind)}
						</td>
						<td class="p-3 text-right">
							<StatusPill
								kind="macro"
								{status}
								flashUp={macroOutcomeBlink(status) === 'up' &&
									flashStates[row.outFlashKey] === 'up'}
								flashDown={macroOutcomeBlink(status) === 'down' &&
									flashStates[row.outFlashKey] === 'down'}
							/>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</Panel>

<style>
	.macroTableWrap {
		background: rgba(9, 9, 11, 0.25);
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		overflow-x: auto;
	}

	.macroTable {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		font-size: 11px;
	}

	.macroTable thead th {
		border-bottom: 1px solid var(--color-border-subtle);
		vertical-align: bottom;
		white-space: nowrap;
	}

	.macroTable tbody td {
		border-bottom: 1px solid rgba(63, 63, 70, 0.35);
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
</style>

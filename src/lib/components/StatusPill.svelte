<script lang="ts">
	import type { MacroStatus } from '$lib/types/market';

	type FedAction = '25bps CUT' | 'HOLD' | '25bps HIKE';

	type Props =
		| { kind: 'fed'; action: FedAction }
		| {
				kind: 'macro';
				status: MacroStatus | null | undefined;
				flashUp?: boolean;
				flashDown?: boolean;
		  };

	let props: Props = $props();

	const fedClass = $derived.by(() => {
		if (props.kind !== 'fed') return 'status-pill--neutral';
		if (props.action === '25bps CUT') return 'status-pill--cut';
		if (props.action === '25bps HIKE') return 'status-pill--hike';
		return 'status-pill--hold';
	});

	const macroClass = $derived.by(() => {
		if (props.kind !== 'macro') return 'status-pill--neutral';
		const s = props.status;
		if (s === 'HOT BEAT') return 'status-pill--hot';
		if (s === 'MISS') return 'status-pill--miss';
		if (s === 'EXP. BEAT') return 'status-pill--beat';
		if (s === 'COOL MISS') return 'status-pill--cool';
		return 'status-pill--neutral';
	});

	const label = $derived.by(() => {
		if (props.kind === 'fed') return props.action;
		return props.status ?? '—';
	});
</script>

{#if props.kind === 'fed'}
	<span class="status-pill {fedClass}">{label}</span>
{:else}
	<span
		class="macroOutcome status-pill {macroClass} price-flash"
		class:blink-green={props.flashUp}
		class:blink-red={props.flashDown}
	>
		{label}
	</span>
{/if}

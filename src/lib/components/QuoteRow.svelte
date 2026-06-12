<script lang="ts">
	type Props = {
		symbol: string;
		label: string;
		value: string;
		changeText: string;
		changeDirection: 'up' | 'down' | 'flat';
		flashUp?: boolean;
		flashDown?: boolean;
	};

	let {
		symbol,
		label,
		value,
		changeText,
		changeDirection,
		flashUp = false,
		flashDown = false
	}: Props = $props();

	const changeClass = $derived(
		changeDirection === 'up'
			? 'change-up'
			: changeDirection === 'down'
				? 'change-down'
				: 'change-flat'
	);

	const showLabel = $derived(label.trim().toLowerCase() !== symbol.trim().toLowerCase());
</script>

<div class="quote-row">
	<div class="quote-row-left">
		<div class="quote-row-symbol">{symbol}</div>
		{#if showLabel}
			<div class="quote-row-label">{label}</div>
		{/if}
	</div>
	<div class="quote-row-right">
		<div
			class="quote-row-value price-flash"
			class:blink-green={flashUp}
			class:blink-red={flashDown}
		>
			{value}
		</div>
		<div class="quote-row-change {changeClass}">{changeText}</div>
	</div>
</div>

<style>
	.quote-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 10px;
		border-bottom: 1px solid rgba(63, 63, 70, 0.35);
		transition: background-color 150ms ease;
	}

	.quote-row:last-child {
		border-bottom: none;
	}

	.quote-row:hover {
		background: rgba(255, 255, 255, 0.025);
	}

	.quote-row-left {
		min-width: 0;
		flex: 1;
	}

	.quote-row-symbol {
		font-family: var(--font-data);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #22d3ee;
		opacity: 0.85;
	}

	.quote-row-label {
		font-size: 10px;
		color: #71717a;
		margin-top: 1px;
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.quote-row-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		flex-shrink: 0;
	}

	.quote-row-value {
		font-family: var(--font-data);
		font-size: 15px;
		font-weight: 600;
		color: #fafafa;
		letter-spacing: 0.01em;
		line-height: 1.2;
	}

	.quote-row-change {
		font-family: var(--font-data);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.02em;
		transition: color 150ms ease;
	}

	.change-up {
		color: #34d399;
	}

	.change-down {
		color: #fb7185;
	}

	.change-flat {
		color: #a1a1aa;
	}
</style>

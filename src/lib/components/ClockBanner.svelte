<script lang="ts">
	let nyTime = $state('');
	let lonTime = $state('');
	let tokTime = $state('');
	let delTime = $state('');
	let ustOpen = $state(false);

	const formatZoneClock = (timeZone: string) =>
		new Date().toLocaleTimeString('en-GB', {
			timeZone,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});

	const updateClocks = () => {
		const d = new Date();
		nyTime = formatZoneClock('America/New_York');
		lonTime = formatZoneClock('Europe/London');
		delTime = formatZoneClock('Asia/Kolkata');
		tokTime = formatZoneClock('Asia/Tokyo');

		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).formatToParts(d);

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

	$effect(() => {
		updateClocks();
		const interval = setInterval(updateClocks, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="clock-banner">
	<div class="mx-auto max-w-[1600px] px-4 py-1.5">
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-data text-xs text-zinc-400">
			<div class="flex items-center gap-3">
				<span class="text-zinc-200">NY <span class="text-zinc-500">·</span> {nyTime}</span>
				<span class="text-zinc-600">|</span>
				<span>LDN <span class="text-zinc-500">·</span> {lonTime}</span>
				<span class="text-zinc-600">|</span>
				<span>TKY <span class="text-zinc-500">·</span> {tokTime}</span>
				<span class="text-zinc-600">|</span>
				<span>DEL <span class="text-zinc-500">·</span> {delTime}</span>
			</div>

			<div class="ml-auto flex items-center gap-2">
				<span
					class={'status-dot ' + (ustOpen ? 'status-dot--open' : 'status-dot--closed')}
					aria-hidden="true"
				></span>
				<span class={ustOpen ? 'font-medium text-emerald-400' : 'text-rose-400/80'}>
					US TREASURY: {ustOpen ? 'OPEN' : 'CLOSED'}
				</span>
			</div>
		</div>
	</div>
</div>

<style>
	.clock-banner {
		border-bottom: 1px solid var(--color-border-subtle);
		background: rgba(9, 9, 11, 0.6);
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
	}

	.status-dot--open {
		background: #6ee7b7;
		box-shadow: 0 0 8px rgba(110, 231, 183, 0.5);
		animation: pulse 2s ease-in-out infinite;
	}

	.status-dot--closed {
		background: rgba(251, 113, 133, 0.55);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>

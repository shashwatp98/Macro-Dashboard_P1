<script lang="ts">
	import type { DataSourceTag } from '$lib/types/market';

	type Props = {
		source?: DataSourceTag;
	};

	let { source }: Props = $props();
</script>

{#if source === 'cache'}
	<span class="source-badge source-badge--cache">CACHED</span>
{:else if source === 'fallback'}
	<span class="source-badge source-badge--stale">[STALE]</span>
{/if}

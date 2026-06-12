<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Global Macro Dashboard</title>
	<meta
		name="description"
		content="Live macro monitoring dashboard — US rates, equities, FRED macro data, central bank policy rates, and Kalshi FOMC probabilities."
	/>
	<meta name="theme-color" content="#09090b" />
</svelte:head>
{@render children()}

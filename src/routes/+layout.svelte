<script>
	import { onMount } from 'svelte';
	let { children } = $props();
	import { ThemePicker, Nav } from '$lib';
	import '$lib/css/reset.css';
	import '$lib/css/styles.css';
	let ready = $state(false);

	function setTheme(theme) {
		const body = document.querySelector('body');
		body.classList.remove('default', 'bp');
		body.classList.add(theme);
		localStorage.setItem('theme', theme);
	}

	onMount(() => {
		const theme = localStorage.getItem('theme');
		if (theme) {
			setTheme(theme);
			ready = true;
		} else {
			ready = true;
		}
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link
		href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Roboto+Slab:wght@100..900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#if ready}
	<ThemePicker />
	<Nav />
	<main>{@render children()}</main>
{/if}

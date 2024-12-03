<script>
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';
	let { children } = $props();
	import { ThemePicker, Nav } from '$lib';
	import '$lib/css/reset.css';
	import '$lib/css/styles.css';

	let ready = $state(false);
	const themeStore = writable('default');
	const isMobileStore = writable(false);

	setContext('theme', themeStore);
	setContext('isMobile', isMobileStore);

	function setTheme(newTheme) {
		const body = document.querySelector('body');
		body.classList.remove('default', 'bp', 'glacier', 'light');
		body.classList.add(newTheme);
		localStorage.setItem('theme', newTheme);
		themeStore.set(newTheme);
	}

	let innerWidth = $state();

	function checkIsMobile() {
		isMobileStore.set(innerWidth <= 768);
	}

	onMount(() => {
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme) {
			setTheme(savedTheme);
			ready = true;
		} else {
			themeStore.set('default');
			ready = true;
		}

		// Set initial mobile state
		isMobileStore.set(window.innerWidth <= 768);

		// Update on resize
		window.addEventListener('resize', () => {
			isMobileStore.set(window.innerWidth <= 768);
		});
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

<svelte:window bind:innerWidth onresize={checkIsMobile} />

{#if ready}
	<ThemePicker onSetTheme={(theme) => setTheme(theme)} />
	<Nav />
	<main>{@render children()}</main>
{/if}

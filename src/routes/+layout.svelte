<script>
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';
	let { data, children } = $props();
	import { AuthMenu, ThemePicker, Nav } from '$lib';
	import '$lib/css/reset.css';
	import '$lib/css/styles.css';

	let ready = $state(false);
	let sidebarCollapsed = $state(false);
	let mobileSidebarOpen = $state(false);
	const themeStore = writable('dark');
	const isMobileStore = writable(false);

	setContext('theme', themeStore);
	setContext('isMobile', isMobileStore);

	function normalizeTheme(theme) {
		return theme === 'light' ? 'light' : 'dark';
	}

	function setTheme(newTheme) {
		const normalizedTheme = normalizeTheme(newTheme);
		const body = document.querySelector('body');
		body.classList.remove('dark', 'light');
		body.classList.add(normalizedTheme);
		localStorage.setItem('theme', normalizedTheme);
		themeStore.set(normalizedTheme);
	}

	let innerWidth = $state();

	function checkIsMobile() {
		const isMobile = innerWidth <= 768;
		isMobileStore.set(isMobile);
		if (isMobile) {
			sidebarCollapsed = false;
		} else {
			mobileSidebarOpen = false;
		}
	}

	onMount(() => {
		const savedTheme = localStorage.getItem('theme');
		setTheme(savedTheme ? normalizeTheme(savedTheme) : 'dark');
		ready = true;

		// Set initial mobile state
		innerWidth = window.innerWidth;
		checkIsMobile();
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
	<div class="appShell" class:sidebarCollapsed>
		<button
			type="button"
			class="mobileMenuButton"
			aria-label={mobileSidebarOpen ? 'Close navigation' : 'Open navigation'}
			aria-expanded={mobileSidebarOpen}
			onclick={() => {
				mobileSidebarOpen = !mobileSidebarOpen;
			}}
		>
			<span aria-hidden="true"></span>
			<span aria-hidden="true"></span>
			<span aria-hidden="true"></span>
		</button>
		{#if mobileSidebarOpen}
			<button
				type="button"
				class="mobileSidebarBackdrop"
				aria-label="Close navigation"
				onclick={() => {
					mobileSidebarOpen = false;
				}}
			></button>
		{/if}
		<aside class="sidebar" class:mobileSidebarOpen aria-label="Primary sidebar">
			<div class="sidebarTop">
				<button
					type="button"
					class="sidebarToggle"
					aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					aria-expanded={!sidebarCollapsed}
					onclick={() => {
						sidebarCollapsed = !sidebarCollapsed;
					}}
				>
					<span class="toggleIcon" aria-hidden="true">
						{#if sidebarCollapsed}
							<svg viewBox="0 0 24 24">
								<path d="M9 5l7 7-7 7" />
							</svg>
						{:else}
							<svg viewBox="0 0 24 24">
								<path d="M15 5l-7 7 7 7" />
							</svg>
						{/if}
					</span>
				</button>
				<Nav
					collapsed={sidebarCollapsed}
					onNavigate={() => {
						mobileSidebarOpen = false;
					}}
				/>
			</div>
			<div class="sidebarBottom">
				<AuthMenu
					user={data.user}
					collapsed={sidebarCollapsed}
					onExpand={() => {
						sidebarCollapsed = false;
					}}
				/>
				<ThemePicker collapsed={sidebarCollapsed} onSetTheme={(theme) => setTheme(theme)} />
			</div>
		</aside>
		<main>{@render children()}</main>
	</div>
{/if}

<style>
	.appShell {
		display: grid;
		grid-template-columns: 15rem minmax(0, 1fr);
		min-height: 100dvh;
		transition: grid-template-columns 0.28s ease;
	}

	.appShell.sidebarCollapsed {
		grid-template-columns: 4.5rem minmax(0, 1fr);
	}

	.sidebar {
		position: sticky;
		top: 0;
		align-self: start;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-height: 100dvh;
		border-right: 1px solid var(--borderColor);
		background: var(--navBackgroundColor);
		box-shadow: 8px 0 24px rgba(0, 0, 0, 0.12);
		padding: 0.85rem;
		transition:
			padding 0.28s ease,
			background 0.28s ease,
			transform 0.28s ease;
	}

	.mobileMenuButton,
	.mobileSidebarBackdrop {
		display: none;
	}

	.sidebarTop,
	.sidebarBottom {
		display: grid;
		gap: 0.9rem;
	}

	.sidebarBottom {
		margin-top: auto;
	}

	.sidebarToggle {
		display: inline-grid;
		place-items: center;
		justify-self: end;
		width: 2rem;
		height: 2rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--fontColor);
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			transform 0.2s ease;
	}

	.sidebarToggle:hover,
	.sidebarToggle:focus-visible {
		background: rgba(255, 255, 255, 0.05);
		border-color: var(--accentColor);
		color: var(--accentColor);
		transform: translateY(-1px);
	}

	.toggleIcon,
	.toggleIcon svg {
		width: 1rem;
		height: 1rem;
	}

	.toggleIcon svg {
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.3;
	}

	main {
		min-width: 0;
		padding: 1.5rem;
	}

	@media (max-width: 768px) {
		.appShell {
			grid-template-columns: 1fr;
		}

		.appShell.sidebarCollapsed {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: fixed;
			z-index: 30;
			top: 0;
			bottom: 0;
			left: 0;
			width: min(18rem, calc(100vw - 4rem));
			min-height: 100dvh;
			border-right: 1px solid var(--borderColor);
			border-bottom: none;
			padding-top: 4rem;
			transform: translateX(-105%);
		}

		.sidebar.mobileSidebarOpen {
			transform: translateX(0);
		}

		.sidebarToggle {
			display: none;
		}

		main {
			padding: 4.5rem 1rem 1rem;
		}

		.mobileMenuButton {
			position: fixed;
			z-index: 40;
			top: 0.85rem;
			left: 0.85rem;
			display: grid;
			gap: 0.22rem;
			place-content: center;
			width: 2.4rem;
			height: 2.4rem;
			border: 1px solid var(--borderColor);
			border-radius: 0.55rem;
			background: var(--navBackgroundColor);
			color: var(--fontColor);
			cursor: pointer;
		}

		.mobileMenuButton span {
			display: block;
			width: 1.15rem;
			height: 2px;
			border-radius: 999px;
			background: currentColor;
			transition:
				rotate 0.2s ease,
				translate 0.2s ease,
				opacity 0.2s ease;
		}

		.mobileMenuButton[aria-expanded='true'] span:nth-child(1) {
			rotate: 45deg;
			translate: 0 0.34rem;
		}

		.mobileMenuButton[aria-expanded='true'] span:nth-child(2) {
			opacity: 0;
		}

		.mobileMenuButton[aria-expanded='true'] span:nth-child(3) {
			rotate: -45deg;
			translate: 0 -0.34rem;
		}

		.mobileSidebarBackdrop {
			position: fixed;
			z-index: 20;
			inset: 0;
			display: block;
			border: 0;
			background: rgba(0, 0, 0, 0.45);
			cursor: pointer;
		}
	}
</style>

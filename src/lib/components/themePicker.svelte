<script>
	import { getContext } from 'svelte';

	const themeStore = getContext('theme');
	let currentTheme = $state('dark');
	themeStore?.subscribe((value) => {
		currentTheme = value === 'light' ? 'light' : 'dark';
	});

	let { collapsed = false, onSetTheme } = $props();

	function toggleTheme() {
		onSetTheme(currentTheme === 'light' ? 'dark' : 'light');
	}
</script>

<div class="themeToggleWrapper" class:collapsed>
	<button
		type="button"
		class="themeToggle"
		onclick={toggleTheme}
		aria-label={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
		title={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
	>
		<span class="icon" aria-hidden="true">{currentTheme === 'light' ? '🌙' : '☀️'}</span>
		<span class="themeLabel">{currentTheme === 'light' ? 'Dark mode' : 'Light mode'}</span>
	</button>
</div>

<style>
	.themeToggleWrapper {
		display: flex;
		justify-content: flex-start;
		margin: 0;
	}
	.themeToggle {
		display: grid;
		grid-template-columns: 1.8rem minmax(0, 1fr);
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 2.2rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--fontColor);
		padding: 0.15rem 0.4rem 0.15rem 0.15rem;
		cursor: pointer;
		font-size: 0.82rem;
		font-weight: 600;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			transform 0.2s ease;
	}

	.themeToggle:hover,
	.themeToggle:focus-visible {
		background: rgba(255, 255, 255, 0.05);
		border-color: var(--accentColor);
		transform: translateX(1px);
	}

	.icon {
		display: inline-grid;
		place-items: center;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 0.4rem;
		background: transparent;
		color: var(--accentColor);
		font-size: 0.95rem;
		line-height: 1;
	}

	.themeLabel {
		white-space: nowrap;
		opacity: 1;
		transition:
			opacity 0.18s ease,
			transform 0.22s ease;
	}

	.collapsed {
		justify-content: center;
	}

	.collapsed .themeToggle {
		grid-template-columns: 1.8rem 0fr;
		width: 2.1rem;
		padding-inline: 0.15rem;
		overflow: hidden;
	}

	.collapsed .themeLabel {
		pointer-events: none;
		opacity: 0;
		transform: translateX(-0.4rem);
	}
</style>

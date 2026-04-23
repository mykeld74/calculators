<script>
	import { getContext } from 'svelte';

	const themeStore = getContext('theme');
	let currentTheme = $state('dark');
	themeStore?.subscribe((value) => {
		currentTheme = value === 'light' ? 'light' : 'dark';
	});

	let { onSetTheme } = $props();

	function toggleTheme() {
		onSetTheme(currentTheme === 'light' ? 'dark' : 'light');
	}
</script>

<div class="themeToggleWrapper">
	<button
		type="button"
		class="themeToggle"
		onclick={toggleTheme}
		aria-label={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
		title={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
	>
		<span class="icon" aria-hidden="true">{currentTheme === 'light' ? '🌙' : '☀️'}</span>
	</button>
</div>

<style>
	.themeToggleWrapper {
		display: flex;
		justify-content: flex-end;
		margin-inline-end: 2rem;
		margin-top: 10px;
	}
	.themeToggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--borderColor);
		border-radius: 999px;
		background: transparent;
		color: var(--fontColor);
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
	}
	.icon {
		font-size: 1rem;
		line-height: 1;
	}
</style>

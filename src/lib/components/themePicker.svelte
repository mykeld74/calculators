<script>
	let theme = $state('default');

	function setTheme(theme) {
		const body = document.querySelector('body');
		body.classList.remove('default', 'bp');
		body.classList.add(theme);
		localStorage.setItem('theme', theme);
	}
</script>

<div class="themePicker">
	<p class="noMargin">Theme:</p>
	<button
		onclick={() => {
			setTheme('default');
		}}
		class="default themeButton"
		aria-label="Default Theme"
	></button>
	<button onclick={() => setTheme('bp')} class="bp themeButton" aria-label="Black/Purple Theme"
	></button>
</div>

<style>
	.themePicker {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}
	.themeButton {
		width: 30px;
		height: 30px;
		border-radius: 200px;
		border: 2px solid #777777;
		cursor: pointer;
	}
	.default {
		background: linear-gradient(51deg, oklch(1 0 270) 0%, oklch(42.32% 0.0364 256.13) 100%);
	}
	.bp {
		background: linear-gradient(51deg, oklch(44.03% 0.1603 303.37) 0%, oklch(0 0 270) 100%);
	}
</style>

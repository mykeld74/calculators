<script>
	let theme = $state('default');

	function setTheme(theme) {
		const body = document.querySelector('body');
		body.classList.remove('default', 'bp', 'glacier', 'light');
		body.classList.add(theme);
		localStorage.setItem('theme', theme);
	}
</script>

<div class="themePicker">
	<p class="noMargin">Themes:</p>
	<button
		onclick={() => {
			setTheme('default');
		}}
		class="default themeButton"
		aria-label="default Theme"
		title="Default"
	>
		<span class="tipText">Default Theme</span>
	</button>
	<button
		onclick={() => {
			setTheme('light');
		}}
		class="light themeButton"
		aria-label="light Theme"
		title="Light"
	>
		<span class="tipText">Light Theme</span>
	</button>
	<button
		onclick={() => {
			setTheme('glacier');
		}}
		class="glacier themeButton"
		aria-label="Glacier Theme"
		title="Glacier"
	>
		<span class="tipText">Glacier Theme</span>
	</button>
	<button
		onclick={() => setTheme('bp')}
		class="bp themeButton"
		aria-label="Black/Purple Theme"
		title="Black/Purple"
	>
		<span class="tipText">Eclipse Theme</span>
	</button>
</div>

<style>
	.themePicker {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-inline-end: 2rem;
	}
	.themeButton {
		width: 30px;
		height: 30px;
		border-radius: 200px;
		border: 2px solid #777777;
		cursor: pointer;
		position: relative;
	}
	.default {
		background: linear-gradient(51deg, oklch(1 0 0) 0%, oklch(0.1 0 0) 100%);
	}
	.light {
		background: linear-gradient(51deg, oklch(0.1 0 0) 0%, oklch(1 0 0) 100%);
	}
	.glacier {
		background: linear-gradient(51deg, oklch(1 0 270) 0%, oklch(42.32% 0.0364 256.13) 100%);
	}
	.bp {
		background: linear-gradient(51deg, oklch(44.03% 0.1603 303.37) 0%, oklch(0 0 270) 100%);
	}
	.tipText {
		visibility: hidden;
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
	}
	.themeButton:hover .tipText {
		visibility: visible;
		opacity: 0.8;
		position: absolute;
		bottom: calc((100% + 2rem) * -1);
		left: 50%;
		transform: translateX(-50%);
		background: #dedede;
		padding: 0.5rem;
		border-radius: 0.15rem;
		font-size: 0.8rem;
		transition: opacity 0.3s ease-in-out;
	}
</style>

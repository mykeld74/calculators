<script>
	let { children } = $props();
	let pages = [
		{ name: 'Retirement', href: '/' },
		{ name: 'Mortgage', href: '/mortgage' }
	];

	let isOpen = $state(false);

	function closePopover() {
		document.getElementById('nav')?.hidePopover();
	}
</script>

<button class="navButton" aria-label="Toggle Navigation" popovertarget="nav">
	<svg viewBox="0 0 622 414" fill="none" xmlns="http://www.w3.org/2000/svg">
		<path d="M35 35H587.004" class="navLine" />
		<path d="M35 379H587.004" class="navLine" />
		<path d="M35 203H587.004" class="navLine" />
	</svg>
</button>
<dialog class="nav" popover id="nav">
	{#each pages as page}
		<div class="nav-item">
			<a
				href={`${page.href}`}
				onclick={() => {
					closePopover();
				}}
			>
				<p class="nav-item-text">{page.name}</p>
			</a>
		</div>
	{/each}
</dialog>

<style lang="postcss">
	.nav {
		position: absolute;
		position-anchor: --navButton;
		gap: 0.5rem;
		margin: 0;
		opacity: 0;
		border: none;
		inset: auto;
		top: anchor(bottom);
		left: anchor(left);
		padding-inline: 1.5rem;
		padding-block: 1rem;
		border-radius: 10px;
		margin-block-start: 1rem;
		box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.4);
		transition:
			display 0.3s ease-in-out,
			opacity 0.3s ease-in-out;
		transition-behavior: allow-discrete;

		a {
			text-decoration: none;
		}
		p {
			margin: 0;
		}
	}
	.nav:popover-open {
		display: grid;

		border: 1px solid var(--fontColor);
		background: var(--navBackgroundColor);
		opacity: 1;

		@starting-style {
			display: grid;
			opacity: 0;
		}
	}
	.nav::backdrop {
		background: oklch(0 0 0 / 50%);
	}

	.nav-item-text {
		color: var(--fontColor);
		text-decoration: none;
		transition: opacity 0.3s ease-in-out;
	}
	.navButton {
		width: 3rem;
		position: absolute;
		anchor-name: --navButton;
		top: 1.5rem;
		left: 2rem;
		background: transparent;
		border: none;
		cursor: pointer;
		transition:
			rotate 0.3s ease-in-out,
			margin-left 0.3s ease-in-out;
	}
	.navLine {
		stroke: var(--fontColor);
		stroke-width: 70;
		stroke-linecap: round;
	}
</style>

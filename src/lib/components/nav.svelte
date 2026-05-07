<script>
	let { collapsed = false, onNavigate = () => {} } = $props();
	let pages = [
		{ name: 'Retirement', href: '/', icon: 'retirement' },
		{ name: 'Mortgage', href: '/mortgage', icon: 'mortgage' }
	];
</script>

<nav class="nav" class:collapsed aria-label="Calculator navigation">
	<div class="navLinks">
		{#each pages as page (page.href)}
			<a
				class="navLink"
				href={page.href}
				title={page.name}
				aria-label={page.name}
				onclick={onNavigate}
			>
				<span class="navIcon" aria-hidden="true">
					{#if page.icon === 'retirement'}
						<svg viewBox="0 0 24 24">
							<path d="M4 19h16" />
							<path d="M7 16V9" />
							<path d="M12 16V5" />
							<path d="M17 16v-4" />
							<path d="M6 9l6-4 6 7" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24">
							<path d="M3 11.5 12 4l9 7.5" />
							<path d="M5.5 10.5V20h13v-9.5" />
							<path d="M9.5 20v-6h5v6" />
						</svg>
					{/if}
				</span>
				<span class="navText">{page.name}</span>
			</a>
		{/each}
	</div>
</nav>

<style lang="postcss">
	.nav {
		display: grid;
		gap: 1rem;
		width: 100%;
	}

	.brand,
	.navLink {
		color: var(--fontColor);
		text-decoration: none;
	}

	.brand {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		align-items: center;
		gap: 0.65rem;
		font-family: 'Roboto Slab', serif;
		font-size: 1.25rem;
		font-weight: 800;
		line-height: 1.1;
		min-height: 2.25rem;
		overflow: hidden;
	}

	.navLinks {
		display: grid;
		gap: 0.25rem;
	}

	.navLink {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		align-items: center;
		gap: 0.65rem;
		min-height: 2.35rem;
		border: 1px solid transparent;
		border-radius: 0.55rem;
		background: transparent;
		padding: 0.15rem 0.45rem 0.15rem 0.15rem;
		overflow: hidden;
		transition:
			background 0.2s ease-in-out,
			border-color 0.2s ease-in-out,
			color 0.2s ease-in-out,
			transform 0.2s ease-in-out;
	}

	.navLink:hover,
	.navLink:focus-visible {
		background: rgba(255, 255, 255, 0.05);
		border-color: var(--accentColor);
		color: var(--fontColor);
		transform: translateX(1px);
	}

	.brandMark,
	.navIcon {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--accentColor);
	}

	.brandMark svg,
	.navIcon svg {
		width: 1.2rem;
		height: 1.2rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.9;
	}

	.navText {
		white-space: nowrap;
		opacity: 1;
		transition:
			opacity 0.18s ease,
			transform 0.22s ease;
	}

	.collapsed {
		justify-items: center;
	}

	.collapsed .brand,
	.collapsed .navLink {
		grid-template-columns: 2rem 0fr;
		width: 2.3rem;
		padding-inline: 0.15rem;
	}

	.collapsed .navText {
		pointer-events: none;
		opacity: 0;
		transform: translateX(-0.4rem);
	}
</style>

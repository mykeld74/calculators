<script>
	let { children } = $props();
	let pages = [
		{ name: 'Retirement', href: '/' },
		{ name: 'Mortgage', href: '/mortgage' }
	];

	let isOpen = $state(false);
</script>

<nav class:open={isOpen}>
	<button
		class="navButton"
		class:navOpen={isOpen}
		onclick={() => (isOpen = !isOpen)}
		aria-label="Toggle Navigation"
	>
		<svg viewBox="0 0 316 667" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M30.9355 636.53L285.466 333.192"
				stroke="white"
				stroke-width="60"
				stroke-linecap="round"
			/>
			<path
				d="M285.34 333.467L30.8089 30.1292"
				stroke="white"
				stroke-width="60"
				stroke-linecap="round"
			/>
		</svg>
	</button>
	{#each pages as page}
		<div class="nav-item">
			<a href={`${page.href}`}>
				<p class="nav-item-text">{page.name}</p>
			</a>
		</div>
	{/each}
</nav>

<style>
	nav {
		position: fixed;
		top: 0;
		left: -10%;
		width: 10%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.4);
		transition: left 0.3s ease-in-out;
		&.open {
			left: 0;
		}

		a {
			text-decoration: none;
		}
	}
	.nav-item-text {
		color: #fff;
		text-decoration: none;
	}
	.navButton {
		width: 1.5rem;
		color: #fff;
		position: absolute;
		top: 0.5rem;
		right: -2rem;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: rotate 0.3s ease-in-out;

		&.navOpen {
			rotate: 180deg;
			&:hover {
				&:before {
					content: 'Hide Nav';
					rotate: 180deg;
					right: auto;
					left: -80px;
					transform: translateY(50%);
				}
			}
		}
		&:hover {
			&:before {
				content: 'Show Nav';
				opacity: 1;
			}
		}
		&:before {
			content: '';
			width: 80px;
			position: absolute;
			top: 50%;
			right: -80px;
			transform: translateY(-50%);
			opacity: 0;
			transition: opacity 0.3s ease-in-out;
		}
	}
</style>

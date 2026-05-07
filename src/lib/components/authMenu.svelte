<script>
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client.js';

	let { user: initialUser = null, collapsed = false, onExpand = () => {} } = $props();

	const session = authClient.useSession();
	let mode = $state('signIn');
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let message = $state('');
	let isSubmitting = $state(false);
	let user = $derived($session.data?.user ?? initialUser);

	function resetForm() {
		email = '';
		password = '';
		name = '';
		message = '';
	}

	async function handleSubmit(event) {
		event.preventDefault();
		isSubmitting = true;
		message = '';

		const result =
			mode === 'signUp'
				? await authClient.signUp.email({
						email,
						password,
						name: name || email.split('@')[0]
					})
				: await authClient.signIn.email({ email, password });

		isSubmitting = false;
		if (result?.error) {
			message = result.error.message ?? 'Authentication failed.';
			return;
		}

		resetForm();
		await invalidateAll();
	}

	async function handleSignOut() {
		isSubmitting = true;
		message = '';
		await authClient.signOut();
		isSubmitting = false;
		await invalidateAll();
	}
</script>

<section class="authMenu" class:collapsed aria-label="Account">
	{#if user}
		<div class="accountCard">
			<span class="authIcon" aria-hidden="true">
				<svg viewBox="0 0 24 24">
					<path d="M20 21a8 8 0 0 0-16 0" />
					<path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
				</svg>
			</span>
			<p class="accountLabel">
				<span class="muted">Signed in</span>
				<span class="accountEmail">{user.email}</span>
			</p>
		</div>
		<button
			type="button"
			class="authButton iconButton"
			onclick={handleSignOut}
			disabled={isSubmitting}
			title="Sign out"
			aria-label="Sign out"
		>
			<span class="authIcon" aria-hidden="true">
				<svg viewBox="0 0 24 24">
					<path d="M10 17l5-5-5-5" />
					<path d="M15 12H3" />
					<path d="M21 19V5" />
				</svg>
			</span>
			<span class="authText">Sign out</span>
		</button>
	{:else if collapsed}
		<button
			type="button"
			class="authButton iconButton"
			onclick={onExpand}
			title="Sign in"
			aria-label="Expand sidebar to sign in"
		>
			<span class="authIcon" aria-hidden="true">
				<svg viewBox="0 0 24 24">
					<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
					<path d="M10 17l5-5-5-5" />
					<path d="M15 12H3" />
				</svg>
			</span>
			<span class="authText">Sign in</span>
		</button>
	{:else}
		<form class="authForm" onsubmit={handleSubmit}>
			<p class="accountLabel">
				<span class="muted">{mode === 'signUp' ? 'Create account' : 'Sync your data'}</span>
				<span class="accountEmail">Save calculators across devices</span>
			</p>
			{#if mode === 'signUp'}
				<label>
					Name
					<input bind:value={name} autocomplete="name" />
				</label>
			{/if}
			<label>
				Email
				<input bind:value={email} type="email" autocomplete="email" required />
			</label>
			<label>
				Password
				<input
					bind:value={password}
					type="password"
					autocomplete={mode === 'signUp' ? 'new-password' : 'current-password'}
					minlength="8"
					required
				/>
			</label>
			{#if message}
				<p class="authMessage" role="alert">{message}</p>
			{/if}
			<button type="submit" class="authButton" disabled={isSubmitting}>
				<span class="authIcon" aria-hidden="true">
					<svg viewBox="0 0 24 24">
						<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
						<path d="M10 17l5-5-5-5" />
						<path d="M15 12H3" />
					</svg>
				</span>
				<span>{isSubmitting ? 'Working...' : mode === 'signUp' ? 'Sign up' : 'Sign in'}</span>
			</button>
			<button
				type="button"
				class="linkButton"
				onclick={() => {
					mode = mode === 'signUp' ? 'signIn' : 'signUp';
					message = '';
				}}
			>
				{mode === 'signUp' ? 'Already have an account?' : 'Create an account'}
			</button>
		</form>
	{/if}
</section>

<style>
	.authMenu {
		border-top: 1px solid var(--borderColorSoft);
		padding-top: 0.75rem;
	}

	.authForm,
	.authMenu {
		display: grid;
		gap: 0.45rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
		color: var(--fontColor);
		font-size: 0.75rem;
	}

	input {
		border: 1px solid var(--borderColor);
		border-radius: 0.45rem;
		background: rgba(255, 255, 255, 0.05);
		color: var(--fontColor);
		font-size: 0.85rem;
		height: auto;
		padding: 0.5rem 0.55rem;
	}

	.accountCard {
		display: grid;
		grid-template-columns: 1.8rem minmax(0, 1fr);
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
	}

	.accountLabel {
		display: grid;
		gap: 0.15rem;
		margin: 0;
		color: var(--fontColor);
		font-size: 0.78rem;
		min-width: 0;
	}

	.muted {
		color: var(--tableFontColor);
		font-size: 0.68rem;
		line-height: 1.2;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.accountEmail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.authMessage {
		margin: 0;
		color: var(--errorColor, #d33);
		font-size: 0.85rem;
	}

	.authButton,
	.linkButton {
		display: inline-grid;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		color: var(--fontColor);
		cursor: pointer;
		min-height: 2.2rem;
		padding: 0.15rem 0.4rem 0.15rem 0.15rem;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			transform 0.2s ease;
	}

	.authButton {
		grid-template-columns: 1.8rem minmax(0, 1fr);
		background: transparent;
		font-weight: 700;
	}

	.authButton:hover,
	.authButton:focus-visible {
		background: rgba(255, 255, 255, 0.05);
		border-color: var(--accentColor);
		transform: translateX(1px);
	}

	.linkButton {
		background: transparent;
		border-color: transparent;
		text-align: left;
		padding-inline: 0.45rem;
	}

	.authIcon {
		display: inline-grid;
		place-items: center;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 0.4rem;
		background: transparent;
		color: var(--accentColor);
	}

	.authIcon svg {
		width: 1.05rem;
		height: 1.05rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.9;
	}

	.authText {
		white-space: nowrap;
	}

	.collapsed {
		justify-items: center;
	}

	.collapsed .accountCard {
		grid-template-columns: 1.8rem 0fr;
		width: 2.1rem;
	}

	.collapsed .accountLabel {
		opacity: 0;
		pointer-events: none;
	}

	.collapsed .iconButton {
		grid-template-columns: 1.8rem 0fr;
		width: 2.1rem;
		padding-inline: 0.15rem;
		overflow: hidden;
	}

	.collapsed .authText {
		opacity: 0;
		pointer-events: none;
	}
</style>

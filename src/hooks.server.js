import { building } from '$app/environment';
import { auth } from '$lib/server/auth.js';
import { svelteKitHandler } from 'better-auth/svelte-kit';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	try {
		const session = await auth.api.getSession({
			headers: event.request.headers
		});

		if (session) {
			event.locals.session = session.session;
			event.locals.user = session.user;
		}
	} catch (error) {
		console.error('Unable to load auth session.', error);
	}

	return svelteKitHandler({ event, resolve, auth, building });
}

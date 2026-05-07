import { getCalculatorDataForUser } from '$lib/server/calculator-data.js';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals }) {
	const user = locals.user ?? null;

	return {
		user,
		session: locals.session ?? null,
		calculatorData: user ? await getCalculatorDataForUser(user.id) : {}
	};
}

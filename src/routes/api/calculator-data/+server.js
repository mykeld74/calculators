import {
	calculatorKeys,
	getCalculatorDataForUser,
	upsertCalculatorData
} from '$lib/server/calculator-data.js';
import { json } from '@sveltejs/kit';
import { z } from 'zod';

const saveCalculatorDataSchema = z.object({
	calculatorKey: z.enum(calculatorKeys),
	schemaVersion: z.string().min(1).max(50),
	payload: z.record(z.string(), z.unknown())
});

function unauthorized() {
	return json({ error: 'Sign in to sync calculator data.' }, { status: 401 });
}

export async function GET({ locals }) {
	if (!locals.user) return unauthorized();

	return json({
		calculatorData: await getCalculatorDataForUser(locals.user.id)
	});
}

export async function PUT({ request, locals }) {
	if (!locals.user) return unauthorized();

	const parsed = saveCalculatorDataSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: 'Invalid calculator data.' }, { status: 400 });
	}

	const row = await upsertCalculatorData({
		userId: locals.user.id,
		...parsed.data
	});

	return json({
		calculatorData: {
			[row.calculatorKey]: {
				schemaVersion: row.schemaVersion,
				payload: row.payload,
				updatedAt: row.updatedAt.toISOString()
			}
		}
	});
}

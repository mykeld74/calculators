import { and, desc, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { calculatorData } from './db/schema.js';

export const calculatorKeys = ['retirement', 'mortgage'];

export function serializeCalculatorRows(rows) {
	return Object.fromEntries(
		rows.map((row) => [
			row.calculatorKey,
			{
				schemaVersion: row.schemaVersion,
				payload: row.payload,
				updatedAt: row.updatedAt.toISOString()
			}
		])
	);
}

export async function getCalculatorDataForUser(userId) {
	if (!userId) return {};

	const rows = await db
		.select()
		.from(calculatorData)
		.where(eq(calculatorData.userId, userId))
		.orderBy(desc(calculatorData.updatedAt));

	return serializeCalculatorRows(rows);
}

export async function upsertCalculatorData({ userId, calculatorKey, schemaVersion, payload }) {
	const [row] = await db
		.insert(calculatorData)
		.values({
			userId,
			calculatorKey,
			schemaVersion,
			payload,
			updatedAt: new Date()
		})
		.onConflictDoUpdate({
			target: [calculatorData.userId, calculatorData.calculatorKey],
			set: {
				schemaVersion,
				payload,
				updatedAt: new Date()
			}
		})
		.returning();

	return row;
}

export async function getCalculatorDataItem(userId, calculatorKey) {
	const [row] = await db
		.select()
		.from(calculatorData)
		.where(and(eq(calculatorData.userId, userId), eq(calculatorData.calculatorKey, calculatorKey)))
		.limit(1);

	return row ?? null;
}

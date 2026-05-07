export function readLocalSnapshot(storageKey) {
	try {
		const raw = localStorage.getItem(storageKey);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function writeLocalSnapshot(storageKey, payload) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(payload));
	} catch {
		// Local persistence should not break calculator interactions.
	}
}

export function createServerSync(calculatorKey, schemaVersion, delay = 800) {
	let timeoutId;
	let lastSerializedPayload = '';

	return (payload) => {
		const serializedPayload = JSON.stringify(payload);
		if (serializedPayload === lastSerializedPayload) return;
		lastSerializedPayload = serializedPayload;

		clearTimeout(timeoutId);
		timeoutId = setTimeout(async () => {
			try {
				await fetch('/api/calculator-data', {
					method: 'PUT',
					headers: {
						'content-type': 'application/json'
					},
					body: JSON.stringify({
						calculatorKey,
						schemaVersion,
						payload
					})
				});
			} catch {
				// Sync failures keep local data intact and can retry on the next edit.
			}
		}, delay);
	};
}

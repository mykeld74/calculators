<script>
	import { LineChart, NumberOrRange } from '$lib';
	import { onMount } from 'svelte';
	import { currentAge, computeResults, calculateSuggestedWithdrawalRate } from '$lib/retirement.js';

	const STORAGE_KEY = 'retirement-scenarios-v2';
	const PALETTE = ['#4bc0c0', '#ff9f40', '#9966ff', '#ff6384', '#36a2eb', '#ffce56', '#8ed081'];
	const TAX_PRESETS = {
		custom: { label: 'Custom' },
		retiredModerate: {
			label: 'Retired (moderate)',
			federalRate: 12,
			stateRate: 4,
			medicareRate: 1.45
		},
		noStateTax: { label: 'No state tax', federalRate: 12, stateRate: 0, medicareRate: 1.45 },
		highTaxState: { label: 'High-tax state', federalRate: 16, stateRate: 8, medicareRate: 1.45 }
	};

	function makeDefaults(overrides = {}) {
		return {
			currentBalance: 115000,
			birthdate: '1974-01-01',
			annualSalary: 120000,
			contributionPercent: 13,
			employerMatch: 4,
			interestRate: 10,
			timesCompounded: 12,
			retirementAge: 65,
			lifeExpectancyAge: 90,
			withdrawalRate: 4,
			taxPreset: 'retiredModerate',
			monthlySS: 2948,
			federalRate: 18,
			stateRate: 4.4,
			medicareRate: 1.45,
			inheritanceAmount: 0,
			inheritanceAge: 65,
			inheritanceInvested: true,
			inheritanceReturnRate: 8,
			...overrides
		};
	}

	let scenarios = $state([
		{ id: 1, label: 'Retire at 65', ...makeDefaults() },
		{ id: 2, label: 'Retire at 67', ...makeDefaults({ retirementAge: 67, monthlySS: 3468 }) }
	]);
	let activeScenarioId = $state(1);
	let nextId = 3;
	let hydrated = $state(false);

	function migrateScenario(s) {
		const merged = { ...makeDefaults(), ...s };
		if (!s.birthdate && typeof s.currentAge === 'number') {
			const year = new Date().getFullYear() - s.currentAge;
			merged.birthdate = `${year}-01-01`;
		}
		delete merged.currentAge;
		return merged;
	}

	onMount(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed.scenarios) && parsed.scenarios.length) {
					scenarios = parsed.scenarios.map(migrateScenario);
					activeScenarioId = parsed.activeScenarioId ?? scenarios[0].id;
					nextId = Math.max(...scenarios.map((s) => s.id)) + 1;
				}
			}
		} catch {}
		hydrated = true;
	});

	$effect(() => {
		if (!hydrated) return;
		const snapshot = JSON.stringify({ scenarios, activeScenarioId });
		try {
			localStorage.setItem(STORAGE_KEY, snapshot);
		} catch {}
	});

	let activeScenario = $derived(scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0]);

	function usd(n) {
		return (n ?? 0).toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		});
	}

	function applyTaxPreset(scenario, presetKey) {
		if (!scenario || !TAX_PRESETS[presetKey] || presetKey === 'custom') return;
		const preset = TAX_PRESETS[presetKey];
		scenario.federalRate = preset.federalRate;
		scenario.stateRate = preset.stateRate;
		scenario.medicareRate = preset.medicareRate;
	}

	function runOutDelta(result, scenario) {
		if (result.runOutAge === null) return null;
		return result.runOutAge - scenario.lifeExpectancyAge;
	}

	function formatUsdInput(n) {
		const safe = Number.isFinite(n) ? n : 0;
		return safe.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		});
	}

	function parseUsdInput(value) {
		const numeric = Number(value.replace(/[^\d.-]/g, ''));
		return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
	}

	function updateCurrencyField(scenario, key, value) {
		if (!scenario) return;
		scenario[key] = parseUsdInput(value);
	}

	const monthOptions = [
		{ value: 1, label: 'Jan' },
		{ value: 2, label: 'Feb' },
		{ value: 3, label: 'Mar' },
		{ value: 4, label: 'Apr' },
		{ value: 5, label: 'May' },
		{ value: 6, label: 'Jun' },
		{ value: 7, label: 'Jul' },
		{ value: 8, label: 'Aug' },
		{ value: 9, label: 'Sep' },
		{ value: 10, label: 'Oct' },
		{ value: 11, label: 'Nov' },
		{ value: 12, label: 'Dec' }
	];

	const CURRENT_YEAR = new Date().getFullYear();
	const YEAR_OPTIONS = Array.from(
		{ length: CURRENT_YEAR - 1900 + 1 },
		(_, idx) => CURRENT_YEAR - idx
	);

	function daysInMonth(year, month) {
		return new Date(year, month, 0).getDate();
	}

	function getBirthdateParts(s) {
		const fallback = { year: 1974, month: 1, day: 1 };
		if (!s?.birthdate) return fallback;
		const [yRaw, mRaw, dRaw] = s.birthdate.split('-');
		const year = Number(yRaw);
		const month = Number(mRaw);
		const day = Number(dRaw);
		if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day))
			return fallback;
		const safeYear = Math.min(Math.max(year, 1900), CURRENT_YEAR);
		const safeMonth = Math.min(Math.max(month, 1), 12);
		const safeDay = Math.min(Math.max(day, 1), daysInMonth(safeYear, safeMonth));
		return { year: safeYear, month: safeMonth, day: safeDay };
	}

	let activeBirthdateParts = $derived(getBirthdateParts(activeScenario));
	let activeDaysInMonth = $derived(
		Array.from(
			{ length: daysInMonth(activeBirthdateParts.year, activeBirthdateParts.month) },
			(_, i) => i + 1
		)
	);

	function updateBirthdatePart(scenario, part, rawValue) {
		if (!scenario) return;
		const parts = getBirthdateParts(scenario);
		const value = Number(rawValue);
		if (!Number.isInteger(value)) return;
		const next = { ...parts, [part]: value };
		next.year = Math.max(1900, Math.min(next.year, CURRENT_YEAR));
		next.month = Math.max(1, Math.min(next.month, 12));
		next.day = Math.max(1, Math.min(next.day, daysInMonth(next.year, next.month)));
		const mm = String(next.month).padStart(2, '0');
		const dd = String(next.day).padStart(2, '0');
		scenario.birthdate = `${next.year}-${mm}-${dd}`;
	}

	function monthlyEmployeeContributionFromPercent(s) {
		return (s.annualSalary * (s.contributionPercent / 100)) / 12;
	}

	function updateContributionFromAmount(scenario, value) {
		if (!scenario) return;
		const monthlyAmount = parseUsdInput(value);
		if (scenario.annualSalary <= 0) {
			scenario.contributionPercent = 0;
			return;
		}
		const nextPercent = (monthlyAmount * 12 * 100) / scenario.annualSalary;
		scenario.contributionPercent = Math.max(0, Math.min(50, Math.round(nextPercent * 10) / 10));
	}

	function adjustWithdrawalRateToLifeExpectancy(s) {
		if (!s) return;
		const suggestedRate = calculateSuggestedWithdrawalRate(s);
		s.withdrawalRate = Math.max(0.1, Math.min(20, suggestedRate));
	}

	let allResults = $derived(scenarios.map((s) => ({ scenario: s, results: computeResults(s) })));
	let activeResults = $derived(
		allResults.find((r) => r.scenario.id === activeScenarioId) ?? allResults[0]
	);

	let activeRunOutDelta = $derived(
		activeResults ? runOutDelta(activeResults.results, activeResults.scenario) : null
	);

	let chartDatasets = $derived(
		allResults.flatMap((r, idx) => {
			const color = PALETTE[idx % PALETTE.length];
			const accumulation = {
				label: r.scenario.label,
				data: r.results.series,
				color,
				fill: r.scenario.id === activeScenarioId,
				legendGroup: 'Accumulation'
			};
			const drawdown =
				r.results.drawdownSeries?.length > 1
					? {
							label: `${r.scenario.label} - Retired`,
							data: r.results.drawdownSeries,
							color,
							fill: false,
							borderDash: [6, 4],
							legendGroup: 'Retired'
						}
					: null;
			return drawdown ? [accumulation, drawdown] : [accumulation];
		})
	);

	let chartMarkers = $derived.by(() => {
		if (!activeScenario || !activeResults) return [];
		const now = new Date();
		const retirementMonths = Math.max(
			(activeScenario.retirementAge - currentAge(activeScenario)) * 12,
			0
		);
		const retirementDate = new Date(
			now.getFullYear(),
			now.getMonth() + retirementMonths,
			1
		).getTime();
		const markers = [
			{ x: retirementDate, label: 'Retirement', color: 'rgba(255,255,255,0.45)', dash: [6, 4] }
		];
		if (activeResults.results.runOutAge !== null) {
			const runOutMonths = Math.max(
				(activeResults.results.runOutAge - currentAge(activeScenario)) * 12,
				0
			);
			const runOutDate = new Date(now.getFullYear(), now.getMonth() + runOutMonths, 1).getTime();
			markers.push({
				x: runOutDate,
				label: 'Runs out',
				color: 'rgba(255,120,120,0.7)',
				dash: [3, 3]
			});
		}
		return markers;
	});

	function addScenario() {
		const base = activeScenario ?? scenarios[0];
		const id = nextId++;
		scenarios.push({
			...base,
			id,
			label: `Scenario ${id}`
		});
		activeScenarioId = id;
	}

	function duplicateScenario() {
		if (!activeScenario) return;
		const id = nextId++;
		scenarios.push({
			...activeScenario,
			id,
			label: `${activeScenario.label} (copy)`
		});
		activeScenarioId = id;
	}

	function removeScenario(id) {
		if (scenarios.length <= 1) return;
		const idx = scenarios.findIndex((s) => s.id === id);
		if (idx === -1) return;
		scenarios.splice(idx, 1);
		if (activeScenarioId === id) activeScenarioId = scenarios[0].id;
	}

	function resetAll() {
		if (!confirm('Reset all scenarios to defaults?')) return;
		scenarios = [{ id: 1, label: 'Retire at 65', ...makeDefaults() }];
		activeScenarioId = 1;
		nextId = 2;
	}

	$effect(() => {
		if (!activeScenario) return;
		const age = currentAge(activeScenario);
		if (age >= activeScenario.retirementAge) {
			activeScenario.retirementAge = age + 1;
		}
		if (activeScenario.lifeExpectancyAge <= activeScenario.retirementAge) {
			activeScenario.lifeExpectancyAge = activeScenario.retirementAge + 1;
		}
	});
</script>

<svelte:head>
	<title>Retirement Calculator | Big Bearded Dev</title>
</svelte:head>

<div class="container">
	<h1>Retirement Calculator</h1>

	<section class="panel">
		<div class="tabs-header">
			<div class="tabs" role="tablist">
				{#each scenarios as scenario, idx (scenario.id)}
					<button
						type="button"
						role="tab"
						class="tab"
						class:active={scenario.id === activeScenarioId}
						style:--swatch={PALETTE[idx % PALETTE.length]}
						onclick={() => (activeScenarioId = scenario.id)}
					>
						<span class="swatch"></span>
						{scenario.label}
					</button>
				{/each}
			</div>
			<div class="tab-actions">
				<button type="button" class="ghost-btn" onclick={addScenario}>+ Add</button>
				<button type="button" class="ghost-btn" onclick={duplicateScenario}>Duplicate</button>
				<button type="button" class="ghost-btn danger" onclick={resetAll}>Reset</button>
			</div>
		</div>

		{#if activeScenario}
			<div class="scenario-form">
				<div class="field field-wide">
					<label for="scenarioLabel">Scenario Name</label>
					<input id="scenarioLabel" type="text" bind:value={activeScenario.label} />
				</div>

				<fieldset class="group">
					<legend>Today</legend>
					<div class="group-grid">
						<div class="field">
							<label for="birthdate">Birthdate</label>
							<div class="datePickerGrid">
								<select
									id="birthMonth"
									value={activeBirthdateParts.month}
									onchange={(e) =>
										updateBirthdatePart(activeScenario, 'month', e.currentTarget.value)}
								>
									{#each monthOptions as month}
										<option value={month.value}>{month.label}</option>
									{/each}
								</select>
								<select
									id="birthDay"
									value={activeBirthdateParts.day}
									onchange={(e) =>
										updateBirthdatePart(activeScenario, 'day', e.currentTarget.value)}
								>
									{#each activeDaysInMonth as day}
										<option value={day}>{day}</option>
									{/each}
								</select>
								<select
									id="birthYear"
									value={activeBirthdateParts.year}
									onchange={(e) =>
										updateBirthdatePart(activeScenario, 'year', e.currentTarget.value)}
								>
									{#each YEAR_OPTIONS as year}
										<option value={year}>{year}</option>
									{/each}
								</select>
							</div>
							<div class="field-note">Age {currentAge(activeScenario)}</div>
						</div>
						<div class="field">
							<label for="currentBalance">Current 401k Balance</label>
							<input
								type="text"
								id="currentBalance"
								inputmode="numeric"
								value={formatUsdInput(activeScenario.currentBalance)}
								oninput={(e) =>
									updateCurrencyField(activeScenario, 'currentBalance', e.currentTarget.value)}
							/>
						</div>
						<div class="field">
							<label for="annualSalary">Annual Salary</label>
							<input
								type="text"
								id="annualSalary"
								inputmode="numeric"
								value={formatUsdInput(activeScenario.annualSalary)}
								oninput={(e) =>
									updateCurrencyField(activeScenario, 'annualSalary', e.currentTarget.value)}
							/>
						</div>
					</div>
				</fieldset>

				<fieldset class="group">
					<legend>Saving</legend>
					<div class="group-grid">
						<div class="field">
							<div class="field-head">
								<label for="contributionPercent">Your Contribution</label>
								<span class="field-value">{activeScenario.contributionPercent}%</span>
							</div>
							<NumberOrRange
								id="contributionPercent"
								bind:value={activeScenario.contributionPercent}
								min="0"
								max="50"
								step="0.5"
							/>
							<input
								type="text"
								id="contributionAmount"
								inputmode="numeric"
								value={formatUsdInput(monthlyEmployeeContributionFromPercent(activeScenario))}
								oninput={(e) => updateContributionFromAmount(activeScenario, e.currentTarget.value)}
							/>
							<div class="field-note">Monthly contribution (editable)</div>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="employerMatch">Employer Match</label>
								<span class="field-value">{activeScenario.employerMatch}%</span>
							</div>
							<NumberOrRange
								id="employerMatch"
								bind:value={activeScenario.employerMatch}
								min="0"
								max="4"
								step="0.25"
							/>
							<div class="field-note">
								{usd((activeScenario.annualSalary * (activeScenario.employerMatch / 100)) / 12)} / mo
							</div>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="interestRate">Interest Rate</label>
								<span class="field-value">{activeScenario.interestRate}%</span>
							</div>
							<NumberOrRange
								id="interestRate"
								bind:value={activeScenario.interestRate}
								min="1"
								max="20"
								step="0.25"
							/>
						</div>
						<div class="field">
							<label for="timesCompounded">Compounded</label>
							<select id="timesCompounded" bind:value={activeScenario.timesCompounded}>
								<option value={1}>Annually</option>
								<option value={4}>Quarterly</option>
								<option value={12}>Monthly</option>
							</select>
						</div>
					</div>
				</fieldset>

				<fieldset class="group">
					<legend>Retirement</legend>
					<div class="group-grid">
						<div class="field">
							<div class="field-head">
								<label for="retirementAge">Retirement Age</label>
								<span class="field-value">{activeScenario.retirementAge}</span>
							</div>
							<NumberOrRange
								id="retirementAge"
								bind:value={activeScenario.retirementAge}
								min={currentAge(activeScenario) + 1}
								max="100"
								step="1"
							/>
							<div class="field-note">
								{Math.max(activeScenario.retirementAge - currentAge(activeScenario), 0)} years from now
							</div>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="withdrawalRate">Withdrawal Rate</label>
								<span class="field-value">{activeScenario.withdrawalRate}%</span>
							</div>
							<NumberOrRange
								id="withdrawalRate"
								bind:value={activeScenario.withdrawalRate}
								min="2"
								max="20"
								step="0.1"
							/>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="lifeExpectancyAge">Life Expectancy Age</label>
								<span class="field-value">{activeScenario.lifeExpectancyAge}</span>
							</div>
							<NumberOrRange
								id="lifeExpectancyAge"
								bind:value={activeScenario.lifeExpectancyAge}
								min={activeScenario.retirementAge + 1}
								max="120"
								step="1"
							/>
							<div class="field-note">Use this target to tune withdrawal rate</div>
						</div>
						<div class="field action-field">
							<button
								type="button"
								class="action-btn"
								onclick={() => adjustWithdrawalRateToLifeExpectancy(activeScenario)}
							>
								Match withdrawal rate to life expectancy
							</button>
						</div>
						<div class="field">
							<label for="monthlySS">Monthly Social Security</label>
							<input
								id="monthlySS"
								type="text"
								inputmode="numeric"
								value={formatUsdInput(activeScenario.monthlySS)}
								oninput={(e) =>
									updateCurrencyField(activeScenario, 'monthlySS', e.currentTarget.value)}
							/>
						</div>
					</div>
				</fieldset>

				<fieldset class="group">
					<legend>Taxes</legend>
					<div class="group-grid">
						<div class="field">
							<label for="taxPreset">Tax Preset</label>
							<select
								id="taxPreset"
								bind:value={activeScenario.taxPreset}
								onchange={(e) => applyTaxPreset(activeScenario, e.currentTarget.value)}
							>
								{#each Object.entries(TAX_PRESETS) as [key, preset]}
									<option value={key}>{preset.label}</option>
								{/each}
							</select>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="federalRate">Federal</label>
								<span class="field-value">{activeScenario.federalRate}%</span>
							</div>
							<NumberOrRange
								id="federalRate"
								bind:value={activeScenario.federalRate}
								min="0"
								max="40"
								step="0.5"
							/>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="stateRate">State</label>
								<span class="field-value">{activeScenario.stateRate}%</span>
							</div>
							<NumberOrRange
								id="stateRate"
								bind:value={activeScenario.stateRate}
								min="0"
								max="15"
								step="0.1"
							/>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="medicareRate">Medicare</label>
								<span class="field-value">{activeScenario.medicareRate}%</span>
							</div>
							<NumberOrRange
								id="medicareRate"
								bind:value={activeScenario.medicareRate}
								min="0"
								max="5"
								step="0.05"
							/>
						</div>
					</div>
				</fieldset>

				<fieldset class="group">
					<legend>Inheritance</legend>
					<div class="group-grid">
						<div class="field">
							<label for="inheritanceAmount">Amount</label>
							<input
								type="text"
								id="inheritanceAmount"
								inputmode="numeric"
								value={formatUsdInput(activeScenario.inheritanceAmount)}
								oninput={(e) =>
									updateCurrencyField(activeScenario, 'inheritanceAmount', e.currentTarget.value)}
							/>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="inheritanceAge">Age Received</label>
								<span class="field-value">{activeScenario.inheritanceAge}</span>
							</div>
							<NumberOrRange
								id="inheritanceAge"
								bind:value={activeScenario.inheritanceAge}
								min={currentAge(activeScenario)}
								max="100"
								step="1"
							/>
						</div>
						<div class="field checkbox-field">
							<label>
								<input
									type="checkbox"
									bind:checked={activeScenario.inheritanceInvested}
									disabled={activeScenario.inheritanceAmount <= 0}
								/>
								Invest in index fund
							</label>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="inheritanceReturnRate">Index Return</label>
								<span class="field-value">{activeScenario.inheritanceReturnRate}%</span>
							</div>
							<NumberOrRange
								id="inheritanceReturnRate"
								bind:value={activeScenario.inheritanceReturnRate}
								min="0"
								max="15"
								step="0.25"
								disabled={!activeScenario.inheritanceInvested ||
									activeScenario.inheritanceAmount <= 0}
							/>
						</div>
					</div>
				</fieldset>

				{#if scenarios.length > 1}
					<div class="remove-row">
						<button
							type="button"
							class="remove-btn"
							onclick={() => removeScenario(activeScenario.id)}
						>
							Remove “{activeScenario.label}”
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</section>

	{#if activeResults}
		<section class="panel results-panel">
			<h2>{activeResults.scenario.label} — Results</h2>
			<div class="hero-summary">
				<div class="hero-main">
					<span>Take-Home Monthly</span>
					<strong>{usd(activeResults.results.takeHome)}</strong>
				</div>
				<div
					class="hero-runout"
					class:good={activeRunOutDelta === null || activeRunOutDelta >= 0}
					class:risk={activeRunOutDelta !== null && activeRunOutDelta < 0}
				>
					<span>Money Runs Out</span>
					<strong>
						{activeResults.results.runOutAge === null
							? 'Never (through age 120)'
							: `Age ${activeResults.results.runOutAge.toFixed(1)}`}
					</strong>
					{#if activeRunOutDelta !== null}
						<small>
							{activeRunOutDelta >= 0
								? `${activeRunOutDelta.toFixed(1)} years past target`
								: `${Math.abs(activeRunOutDelta).toFixed(1)} years short of target`}
						</small>
					{/if}
				</div>
			</div>
			<div class="results-grid">
				<div class="result">
					<span>Years Invested</span><strong>{activeResults.results.years}</strong>
				</div>
				<div class="result">
					<span>Your Monthly Contribution</span>
					<strong>{usd(activeResults.results.monthlyEmployeeContribution)}</strong>
				</div>
				<div class="result">
					<span>Employer Contribution ({activeResults.results.employerPct.toFixed(2)}%)</span>
					<strong>{usd(activeResults.results.monthlyEmployerContribution)}</strong>
				</div>
				<div class="result">
					<span>Total Monthly In</span>
					<strong>{usd(activeResults.results.monthlyContribution)}</strong>
				</div>
				<div class="result">
					<span>401k Balance at Retirement</span>
					<strong>{usd(activeResults.results.finalBalance)}</strong>
				</div>
				{#if activeResults.results.inheritanceBalance > 0}
					<div class="result">
						<span
							>+ Index Account (inheritance @ {activeResults.scenario.inheritanceReturnRate}%)</span
						>
						<strong>{usd(activeResults.results.inheritanceBalance)}</strong>
					</div>
				{/if}
				{#if activeResults.results.uninvestedInheritance > 0}
					<div class="result">
						<span>+ Inheritance (cash)</span>
						<strong>{usd(activeResults.results.uninvestedInheritance)}</strong>
					</div>
				{/if}
				<div class="result">
					<span>Total Nest Egg</span>
					<strong>{usd(activeResults.results.totalNestEgg)}</strong>
				</div>
				<div class="result">
					<span
						>Monthly Withdrawal ({activeResults.results.effectiveWithdrawalRate.toFixed(1)}%)</span
					>
					<strong>
						{usd(activeResults.results.monthlyWithdrawal)}
					</strong>
				</div>
				<div class="result">
					<span>Life Expectancy Target</span>
					<strong>Age {activeResults.scenario.lifeExpectancyAge}</strong>
				</div>
				<div class="result">
					<span>Monthly Social Security</span>
					<strong>{usd(activeResults.scenario.monthlySS)}</strong>
				</div>
				<div class="result highlight">
					<span>Gross Monthly Income</span>
					<strong>{usd(activeResults.results.gross)}</strong>
				</div>
				<div class="result deduction">
					<span>− Federal ({activeResults.scenario.federalRate}%)</span>
					<strong>{usd(activeResults.results.federal)}</strong>
				</div>
				<div class="result deduction">
					<span>− State ({activeResults.scenario.stateRate}%)</span>
					<strong>{usd(activeResults.results.stateTax)}</strong>
				</div>
				<div class="result deduction">
					<span>− Medicare ({activeResults.scenario.medicareRate}%)</span>
					<strong>{usd(activeResults.results.medicare)}</strong>
				</div>
				<div class="result">
					<span>Take-Home Annual</span>
					<strong>{usd(activeResults.results.takeHome * 12)}</strong>
				</div>
			</div>
		</section>
	{/if}

	{#if scenarios.length > 1}
		<section class="panel">
			<h2>Compare Scenarios</h2>
			<div class="compare-wrapper">
				<table class="compare">
					<thead>
						<tr>
							<th></th>
							{#each allResults as { scenario }, idx (scenario.id)}
								<th
									class:active={scenario.id === activeScenarioId}
									style:--swatch={PALETTE[idx % PALETTE.length]}
								>
									<span class="swatch"></span>{scenario.label}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						<tr>
							<th>Retirement Age</th>
							{#each allResults as { scenario } (scenario.id)}
								<td>{scenario.retirementAge}</td>
							{/each}
						</tr>
						<tr>
							<th>Years Invested</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>{results.years}</td>
							{/each}
						</tr>
						<tr>
							<th>Your Contribution</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>{usd(results.monthlyEmployeeContribution)}/mo</td>
							{/each}
						</tr>
						<tr>
							<th>Employer Match</th>
							{#each allResults as { scenario, results }, i (allResults[i].scenario.id)}
								<td>
									{scenario.employerMatch}% → {usd(results.monthlyEmployerContribution)}/mo
								</td>
							{/each}
						</tr>
						<tr>
							<th>Total Monthly In</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>{usd(results.monthlyContribution)}</td>
							{/each}
						</tr>
						<tr>
							<th>Interest Rate</th>
							{#each allResults as { scenario } (scenario.id)}
								<td>{scenario.interestRate}%</td>
							{/each}
						</tr>
						<tr>
							<th>Inheritance</th>
							{#each allResults as { scenario } (scenario.id)}
								<td>
									{#if scenario.inheritanceAmount > 0}
										{usd(scenario.inheritanceAmount)} @ {scenario.inheritanceAge}
										{scenario.inheritanceInvested
											? `(index @ ${scenario.inheritanceReturnRate}%)`
											: '(cash)'}
									{:else}
										—
									{/if}
								</td>
							{/each}
						</tr>
						<tr class="section-row">
							<th>401k at Retirement</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>{usd(results.finalBalance)}</td>
							{/each}
						</tr>
						<tr>
							<th>Index Account at Retirement</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>{usd(results.inheritanceBalance)}</td>
							{/each}
						</tr>
						<tr>
							<th>Inheritance Cash</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>{usd(results.uninvestedInheritance)}</td>
							{/each}
						</tr>
						<tr>
							<th>Total Nest Egg</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td><strong>{usd(results.totalNestEgg)}</strong></td>
							{/each}
						</tr>
						<tr>
							<th>Monthly Withdrawal</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>
									{usd(results.monthlyWithdrawal)}
									({results.effectiveWithdrawalRate.toFixed(1)}%)
								</td>
							{/each}
						</tr>
						<tr>
							<th>Life Expectancy Target</th>
							{#each allResults as { scenario } (scenario.id)}
								<td>Age {scenario.lifeExpectancyAge}</td>
							{/each}
						</tr>
						<tr>
							<th>Money Runs Out</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>
									{results.runOutAge === null
										? 'Never (120+)'
										: `Age ${results.runOutAge.toFixed(1)}`}
								</td>
							{/each}
						</tr>
						<tr>
							<th>Monthly SS</th>
							{#each allResults as { scenario } (scenario.id)}
								<td>{usd(scenario.monthlySS)}</td>
							{/each}
						</tr>
						<tr>
							<th>Gross Monthly</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>{usd(results.gross)}</td>
							{/each}
						</tr>
						<tr class="highlight-row">
							<th>Take-Home Monthly</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td><strong>{usd(results.takeHome)}</strong></td>
							{/each}
						</tr>
						<tr>
							<th>Take-Home Annual</th>
							{#each allResults as { results }, i (allResults[i].scenario.id)}
								<td>{usd(results.takeHome * 12)}</td>
							{/each}
						</tr>
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<section class="panel chart-panel">
		<h2>Balance Over Time</h2>
		<LineChart datasets={chartDatasets} markers={chartMarkers} />
	</section>
</div>

<style>
	.panel {
		width: 100%;
		max-width: 1100px;
		padding: 1.5rem;
		border: 1px solid var(--borderColor);
		border-radius: 10px;
	}
	.panel h2 {
		margin: 0 0 1rem 0;
		font-size: 1.3rem;
		font-family: 'Roboto Slab', serif;
	}
	.scenario-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.group {
		border: 1px solid var(--borderColorSoft);
		border-radius: 8px;
		padding: 1rem 1.25rem 1.25rem;
		margin: 0;
	}
	.group legend {
		padding: 0 0.5rem;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-weight: 700;
		opacity: 0.7;
	}
	.group-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.5rem 2rem;
		@container (max-width: 650px) {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}
	.field-wide {
		width: 100%;
	}
	.field label {
		font-size: 1rem;
		font-weight: 500;
		opacity: 0.9;
	}
	.field input[type='text'],
	.field select {
		height: 2.6rem;
		font-size: 1.1rem;
	}
	.datePickerGrid {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr 1fr;
		gap: 0.5rem;
	}
	.field-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.field-value {
		font-family: 'Roboto Slab', serif;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--accentColor);
	}
	.field-note {
		font-size: 0.85rem;
		opacity: 0.6;
	}
	.action-field {
		justify-content: flex-end;
	}
	.action-field .action-btn {
		align-self: flex-start;
		width: 100%;
	}
	.action-btn {
		background: var(--accentColor);
		color: var(--mainBackgroundColor);
		border: 1px solid var(--accentColor);
		padding: 0.7rem 1rem;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		transition:
			transform 140ms ease,
			filter 140ms ease;
	}
	.action-btn:hover {
		filter: brightness(1.06);
		transform: translateY(-1px);
	}
	.action-btn:active {
		transform: translateY(0);
	}
	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		cursor: pointer;
		font-size: 1rem;
	}
	.checkbox-field input[type='checkbox'] {
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
	}

	.tabs-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}
	.tabs {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: transparent;
		color: var(--fontColor);
		border: 1px solid var(--borderColor);
		padding: 0.6rem 1.2rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 1rem;
	}
	.tab.active {
		background: var(--fontColor);
		color: var(--mainBackgroundColor);
		font-weight: 600;
	}
	.swatch {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--swatch, #888);
		flex-shrink: 0;
	}
	.tab-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.ghost-btn,
	.remove-btn {
		background: transparent;
		color: var(--fontColor);
		border: 1px solid var(--borderColor);
		padding: 0.6rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.95rem;
	}
	.ghost-btn.danger,
	.remove-btn {
		border-color: rgba(255, 100, 100, 0.4);
		color: rgba(255, 160, 160, 0.95);
	}
	.remove-row {
		display: flex;
		justify-content: flex-end;
	}

	.results-panel {
		background: rgba(255, 255, 255, 0.03);
	}
	.hero-summary {
		display: grid;
		grid-template-columns: 1.6fr 1fr;
		gap: 0.9rem;
		margin-bottom: 1rem;
		@container (max-width: 650px) {
			grid-template-columns: 1fr;
		}
	}
	.hero-main,
	.hero-runout {
		border: 1px solid var(--borderColorSoft);
		border-radius: 8px;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.hero-main strong,
	.hero-runout strong {
		font-size: 1.5rem;
		font-family: 'Roboto Slab', serif;
	}
	.hero-runout small {
		opacity: 0.75;
		font-size: 0.85rem;
	}
	.hero-runout.good {
		background: rgba(120, 220, 160, 0.08);
		border-color: rgba(120, 220, 160, 0.35);
	}
	.hero-runout.risk {
		background: rgba(255, 120, 120, 0.08);
		border-color: rgba(255, 120, 120, 0.35);
	}
	.results-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.6rem 1.5rem;
		@container (max-width: 650px) {
			grid-template-columns: 1fr;
		}
	}
	.result {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0.5rem 0;
		border-bottom: 1px dashed var(--borderColorSoft);
	}
	.result span {
		font-size: 1rem;
	}
	.result strong {
		font-family: 'Roboto Slab', serif;
		font-size: 1.1rem;
		text-align: right;
		min-width: 9.5rem;
	}
	.result.highlight {
		background: var(--accentSurface);
		padding: 0.6rem 0.75rem;
		border-radius: 5px;
		border: none;
	}
	.result.deduction strong {
		color: rgba(255, 160, 160, 0.9);
	}

	.compare-wrapper {
		overflow-x: auto;
	}
	.compare {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}
	.compare th,
	.compare td {
		text-align: left;
		padding: 0.6rem 0.9rem;
		border-bottom: 1px solid var(--borderColorSoft);
		white-space: nowrap;
	}
	.compare th:first-child {
		position: sticky;
		left: 0;
		z-index: 2;
		background: var(--mainBackgroundColor);
		box-shadow: 10px 0 12px -12px rgba(0, 0, 0, 0.45);
	}
	.compare thead th:first-child {
		z-index: 3;
	}
	.compare thead th {
		font-weight: 600;
		border-bottom: 1px solid var(--borderColor);
	}
	.compare thead th.active {
		color: var(--swatch);
	}
	.compare tbody th {
		font-weight: 500;
		opacity: 0.75;
	}
	.compare td {
		font-family: 'Roboto Slab', serif;
		text-align: right;
	}
	.compare .section-row th,
	.compare .section-row td {
		border-top: 2px solid var(--borderColorSoft);
	}
	.compare .highlight-row td,
	.compare .highlight-row th {
		background: var(--accentSurface);
	}

	.chart-panel :global(canvas) {
		max-width: 100%;
	}
</style>

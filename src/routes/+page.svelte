<script>
	import { LineChart } from '$lib';
	import { onMount } from 'svelte';

	const STORAGE_KEY = 'retirement-scenarios-v2';
	const PALETTE = ['#4bc0c0', '#ff9f40', '#9966ff', '#ff6384', '#36a2eb', '#ffce56', '#8ed081'];

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

	function currentAge(s) {
		if (!s?.birthdate) return 0;
		const birth = new Date(s.birthdate);
		if (Number.isNaN(birth.getTime())) return 0;
		const now = new Date();
		let age = now.getFullYear() - birth.getFullYear();
		const m = now.getMonth() - birth.getMonth();
		if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
		return age;
	}

	function employerPercent(s) {
		return s.employerMatch ?? 0;
	}

	function calculateRunOutAge(
		s,
		retirementBalanceStart,
		inheritanceBalanceStart,
		uninvestedCashStart
	) {
		if (s.withdrawalRate <= 0) return null;

		const monthlyWithdrawal =
			((retirementBalanceStart + inheritanceBalanceStart + uninvestedCashStart) *
				(s.withdrawalRate / 100)) /
			12;
		if (monthlyWithdrawal <= 0) return null;

		let retirementBalance = retirementBalanceStart;
		let inheritanceBalance = inheritanceBalanceStart;
		let uninvestedCash = uninvestedCashStart;

		const retirementRate = s.interestRate / 100;
		const inheritanceRate = (s.inheritanceReturnRate ?? 0) / 100;
		const retirementCompoundEvery = 12 / s.timesCompounded;
		const inheritanceCompoundEvery = 12 / s.timesCompounded;
		const maxMonths = Math.max((120 - s.retirementAge) * 12, 0);

		for (let i = 1; i <= maxMonths; i++) {
			if (retirementBalance > 0 && i % retirementCompoundEvery === 0) {
				retirementBalance = retirementBalance * (1 + retirementRate / s.timesCompounded);
			}
			if (inheritanceBalance > 0 && i % inheritanceCompoundEvery === 0) {
				inheritanceBalance = inheritanceBalance * (1 + inheritanceRate / s.timesCompounded);
			}

			const totalBeforeWithdrawal = retirementBalance + inheritanceBalance + uninvestedCash;
			if (totalBeforeWithdrawal <= 0) return s.retirementAge + (i - 1) / 12;

			const withdrawal = Math.min(monthlyWithdrawal, totalBeforeWithdrawal);
			const retirementShare = retirementBalance / totalBeforeWithdrawal;
			const inheritanceShare = inheritanceBalance / totalBeforeWithdrawal;
			const cashShare = uninvestedCash / totalBeforeWithdrawal;

			retirementBalance = Math.max(retirementBalance - withdrawal * retirementShare, 0);
			inheritanceBalance = Math.max(inheritanceBalance - withdrawal * inheritanceShare, 0);
			uninvestedCash = Math.max(uninvestedCash - withdrawal * cashShare, 0);

			if (retirementBalance + inheritanceBalance + uninvestedCash <= 0) {
				return s.retirementAge + i / 12;
			}
		}

		return null;
	}

	function calculateSuggestedWithdrawalRate(s) {
		const { finalBalance, inheritanceBalance, uninvestedInheritance } = projectBalance(s);
		const totalAtRetirement = finalBalance + inheritanceBalance + uninvestedInheritance;
		if (totalAtRetirement <= 0) return s.withdrawalRate;

		const targetAge = Math.max(s.lifeExpectancyAge ?? 90, s.retirementAge + 1);
		const minRate = 0.1;
		const maxRate = 20;

		const runOutAtMin = calculateRunOutAge(
			{ ...s, withdrawalRate: minRate },
			finalBalance,
			inheritanceBalance,
			uninvestedInheritance
		);
		if (runOutAtMin !== null && runOutAtMin < targetAge) return minRate;

		const runOutAtMax = calculateRunOutAge(
			{ ...s, withdrawalRate: maxRate },
			finalBalance,
			inheritanceBalance,
			uninvestedInheritance
		);
		if (runOutAtMax === null || runOutAtMax > targetAge) return maxRate;

		let low = minRate;
		let high = maxRate;
		for (let i = 0; i < 28; i++) {
			const mid = (low + high) / 2;
			const runOutAtMid = calculateRunOutAge(
				{ ...s, withdrawalRate: mid },
				finalBalance,
				inheritanceBalance,
				uninvestedInheritance
			);
			if (runOutAtMid === null || runOutAtMid > targetAge) low = mid;
			else high = mid;
		}

		return Math.round(high * 10) / 10;
	}

	function adjustWithdrawalRateToLifeExpectancy(s) {
		if (!s) return;
		const suggestedRate = calculateSuggestedWithdrawalRate(s);
		s.withdrawalRate = Math.max(0.1, Math.min(20, suggestedRate));
	}

	function projectBalance(s) {
		const age = currentAge(s);
		const years = Math.max(s.retirementAge - age, 0);
		const totalMonths = years * 12;
		const employerPct = employerPercent(s);
		const totalContribPercent = s.contributionPercent + employerPct;
		const monthlyContribution = (s.annualSalary * (totalContribPercent / 100)) / 12;
		const monthlyEmployeeContribution = (s.annualSalary * (s.contributionPercent / 100)) / 12;
		const monthlyEmployerContribution = (s.annualSalary * (employerPct / 100)) / 12;

		const retirementRate = s.interestRate / 100;
		const retirementCompoundEvery = 12 / s.timesCompounded;

		const inheritanceRate = (s.inheritanceReturnRate ?? 0) / 100;
		const inheritanceCompoundEvery = 12 / s.timesCompounded;

		const inheritanceMonthFromNow = (s.inheritanceAge - age) * 12;
		const hasInheritance = s.inheritanceAmount > 0;
		const alreadyReceived = hasInheritance && inheritanceMonthFromNow <= 0;

		const now = new Date();
		let month = now.getMonth();
		let year = now.getFullYear();

		let retirementBalance = s.currentBalance;
		let inheritanceBalance = 0;
		let uninvestedInheritance = 0;

		if (alreadyReceived) {
			if (s.inheritanceInvested) inheritanceBalance += s.inheritanceAmount;
			else uninvestedInheritance += s.inheritanceAmount;
		}

		const series = [
			{
				x: new Date(year, month).getTime(),
				y: +(retirementBalance + inheritanceBalance + uninvestedInheritance).toFixed(2)
			}
		];

		for (let i = 1; i <= totalMonths; i++) {
			if (i % retirementCompoundEvery === 0) {
				retirementBalance = retirementBalance * (1 + retirementRate / s.timesCompounded);
			}
			retirementBalance += monthlyContribution;

			if (hasInheritance && inheritanceMonthFromNow > 0 && i === inheritanceMonthFromNow) {
				if (s.inheritanceInvested) inheritanceBalance += s.inheritanceAmount;
				else uninvestedInheritance += s.inheritanceAmount;
			}

			if (inheritanceBalance > 0 && i % inheritanceCompoundEvery === 0) {
				inheritanceBalance = inheritanceBalance * (1 + inheritanceRate / s.timesCompounded);
			}

			month++;
			if (month > 11) {
				month = 0;
				year++;
			}
			series.push({
				x: new Date(year, month).getTime(),
				y: +(retirementBalance + inheritanceBalance + uninvestedInheritance).toFixed(2)
			});
		}

		return {
			finalBalance: retirementBalance,
			inheritanceBalance,
			uninvestedInheritance,
			series,
			years,
			monthlyContribution,
			monthlyEmployeeContribution,
			monthlyEmployerContribution,
			employerPct
		};
	}

	function computeResults(s) {
		const {
			finalBalance,
			inheritanceBalance,
			uninvestedInheritance,
			series,
			years,
			monthlyContribution,
			monthlyEmployeeContribution,
			monthlyEmployerContribution,
			employerPct
		} = projectBalance(s);
		const totalNestEgg = finalBalance + inheritanceBalance + uninvestedInheritance;
		const monthlyWithdrawal = (totalNestEgg * (s.withdrawalRate / 100)) / 12;
		const runOutAge = calculateRunOutAge(
			s,
			finalBalance,
			inheritanceBalance,
			uninvestedInheritance
		);
		const gross = monthlyWithdrawal + s.monthlySS;
		const federal = gross * (s.federalRate / 100);
		const stateTax = gross * (s.stateRate / 100);
		const medicare = gross * (s.medicareRate / 100);
		const takeHome = gross - federal - stateTax - medicare;
		return {
			years,
			monthlyContribution,
			monthlyEmployeeContribution,
			monthlyEmployerContribution,
			employerPct,
			finalBalance,
			inheritanceBalance,
			uninvestedInheritance,
			totalNestEgg,
			monthlyWithdrawal,
			runOutAge,
			gross,
			federal,
			stateTax,
			medicare,
			takeHome,
			series
		};
	}

	let allResults = $derived(scenarios.map((s) => ({ scenario: s, results: computeResults(s) })));
	let activeResults = $derived(
		allResults.find((r) => r.scenario.id === activeScenarioId) ?? allResults[0]
	);

	let chartDatasets = $derived(
		allResults.map((r, idx) => ({
			label: r.scenario.label,
			data: r.results.series,
			color: PALETTE[idx % PALETTE.length],
			fill: r.scenario.id === activeScenarioId
		}))
	);

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
							<input
								type="date"
								id="birthdate"
								bind:value={activeScenario.birthdate}
								max={new Date().toISOString().slice(0, 10)}
							/>
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
							<input
								type="range"
								id="contributionPercent"
								bind:value={activeScenario.contributionPercent}
								min="0"
								max="50"
								step="0.5"
							/>
							<div class="field-note">
								{usd(
									(activeScenario.annualSalary * (activeScenario.contributionPercent / 100)) / 12
								)} / mo
							</div>
						</div>
						<div class="field">
							<div class="field-head">
								<label for="employerMatch">Employer Match</label>
								<span class="field-value">{activeScenario.employerMatch}%</span>
							</div>
							<input
								type="range"
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
							<input
								type="range"
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
							<input
								id="retirementAge"
								type="range"
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
							<input
								type="range"
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
							<input
								id="lifeExpectancyAge"
								type="range"
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
								class="ghost-btn"
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
							<div class="field-head">
								<label for="federalRate">Federal</label>
								<span class="field-value">{activeScenario.federalRate}%</span>
							</div>
							<input
								type="range"
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
							<input
								type="range"
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
							<input
								type="range"
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
							<input
								type="range"
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
							<input
								type="range"
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
					<span>Monthly Withdrawal ({activeResults.scenario.withdrawalRate}%)</span>
					<strong>{usd(activeResults.results.monthlyWithdrawal)}</strong>
				</div>
				<div class="result">
					<span>Life Expectancy Target</span>
					<strong>Age {activeResults.scenario.lifeExpectancyAge}</strong>
				</div>
				<div class="result">
					<span>Money Runs Out</span>
					<strong>
						{activeResults.results.runOutAge === null
							? 'Never (through age 120)'
							: `Age ${activeResults.results.runOutAge.toFixed(1)}`}
					</strong>
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
				<div class="result highlight big">
					<span>Take-Home Monthly</span>
					<strong>{usd(activeResults.results.takeHome)}</strong>
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
								<td>{usd(results.monthlyWithdrawal)}</td>
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
		<LineChart datasets={chartDatasets} />
	</section>
</div>

<style>
	.panel {
		width: 100%;
		max-width: 1100px;
		padding: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
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
		border: 1px solid rgba(255, 255, 255, 0.12);
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
	.field input[type='date'],
	.field select {
		height: 2.6rem;
		font-size: 1.1rem;
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
		color: rgba(120, 220, 220, 0.95);
	}
	.field-note {
		font-size: 0.85rem;
		opacity: 0.6;
	}
	.field input[type='range'] {
		margin-top: 0.25rem;
	}
	.action-field {
		justify-content: flex-end;
	}
	.action-field .ghost-btn {
		align-self: flex-start;
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
		border: 1px solid rgba(255, 255, 255, 0.25);
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
		border: 1px solid rgba(255, 255, 255, 0.25);
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
		border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
	}
	.result span {
		font-size: 1rem;
	}
	.result strong {
		font-family: 'Roboto Slab', serif;
		font-size: 1.1rem;
	}
	.result.highlight {
		background: rgba(75, 192, 192, 0.08);
		padding: 0.6rem 0.75rem;
		border-radius: 5px;
		border: none;
	}
	.result.highlight.big strong {
		font-size: 1.5rem;
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
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		white-space: nowrap;
	}
	.compare thead th {
		font-weight: 600;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
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
	}
	.compare .section-row th,
	.compare .section-row td {
		border-top: 2px solid rgba(255, 255, 255, 0.12);
	}
	.compare .highlight-row td,
	.compare .highlight-row th {
		background: rgba(75, 192, 192, 0.08);
	}

	.chart-panel :global(canvas) {
		max-width: 100%;
	}
</style>

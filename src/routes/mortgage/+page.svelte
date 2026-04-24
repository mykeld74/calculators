<script>
	import { onMount } from 'svelte';
	import { LineChart } from '../../lib';
	const STORAGE_KEY = 'mortgage-calculator-v1';
	let principal = $state(342700);
	let downPayment = $state(0);
	let downPaymentPercentage = $state(0);
	let loanAmount = $derived(Math.max(0, principal - downPayment));
	let interestRate = $state(2.625);
	let years = $state(20);
	let extraPaymentScenarios = $state([]);
	let nextExtraPaymentScenarioId = 1;
	let activeExtraScenarioId = $state(null);
	const recurringFrequencyOptions = [
		{ value: 1, label: 'Monthly' },
		{ value: 3, label: 'Quarterly' },
		{ value: 6, label: 'Every 6 months' },
		{ value: 12, label: 'Yearly' }
	];
	const recurringFrequencyValues = recurringFrequencyOptions.map((option) => option.value);
	let hydrated = $state(false);
	let monthlyEscrowPayment = $state(508);
	let monthlyAssistance = $state(0);
	let assistanceEditValue = $state('');
	let assistanceInputFocused = $state(false);
	let pmiInputMode = $state('dollar');
	let pmiRate = $state(0.5);
	let pmiDollarAmount = $state(0);
	const pmiLtvThreshold = 0.8;
	let birthdate = $state('1985-01-01');
	let loanOriginationDate = $state();
	let baselinePayments = $derived.by(() =>
		calculateMonthlyPayment(loanAmount, interestRate, years, 0)
	);
	let startDate = $derived.by(() => {
		const parsedStartDate = new Date(loanOriginationDate);
		return Number.isNaN(parsedStartDate.getTime()) ? new Date() : parsedStartDate;
	});
	let extraScenarioSummaries = $derived.by(() =>
		extraPaymentScenarios.map((scenario) => {
			const scenarioPayments = calculateMonthlyPayment(
				loanAmount,
				interestRate,
				years,
				scenario.extraMonthlyPayment,
				startDate,
				scenario.oneTimePayments
			);
			const totalInterest = scenarioPayments[scenarioPayments.length - 1]?.totalInterest ?? 0;
			const totalAmountPaid = loanAmount + totalInterest;
			const completionMonth = scenarioPayments[scenarioPayments.length - 1]?.month;
			const completionDate = getCompletionDate(startDate, completionMonth);
			const pmiEndMonth = getPmiEndMonth(scenarioPayments, loanAmount, principal, pmiLtvThreshold);
			const pmiEndDate = getCompletionDate(startDate, pmiEndMonth);
			const totalMonthlyPayment = Math.max(
				0,
				(scenarioPayments[0]?.payment || 0) +
					monthlyEscrowPayment +
					baselineMonthlyPmi -
					monthlyAssistance
			);
			return {
				id: scenario.id,
				name: scenario.name,
				payments: scenarioPayments,
				totalInterest,
				totalAmountPaid,
				completionDate,
				pmiEndDate,
				totalMonthlyPayment
			};
		})
	);
	let activeExtraScenarioSummary = $derived.by(() => {
		if (extraScenarioSummaries.length === 0) return null;
		return (
			extraScenarioSummaries.find((scenario) => scenario.id === Number(activeExtraScenarioId)) ??
			extraScenarioSummaries[0]
		);
	});
	let hasExtraScenario = $derived(extraScenarioSummaries.length > 0);
	let baselineTotalInterest = $derived(
		baselinePayments[baselinePayments.length - 1]?.totalInterest ?? 0
	);
	let extraTotalInterest = $derived(activeExtraScenarioSummary?.totalInterest ?? 0);
	let totalAmountPaid = $derived(loanAmount + baselineTotalInterest);
	let totalNumberOfPayments = $derived(activeExtraScenarioSummary?.payments.length ?? 0);
	let totalAmountPaidWithExtra = $derived(
		activeExtraScenarioSummary?.totalAmountPaid ?? loanAmount
	);
	let baselineCompletionDate = $derived.by(() =>
		getCompletionDate(startDate, baselinePayments[baselinePayments.length - 1]?.month)
	);
	let baselinePayoffAge = $derived.by(() => calculateAgeAtDate(birthdate, baselineCompletionDate));
	let extraCompletionDate = $derived.by(() => activeExtraScenarioSummary?.completionDate ?? null);
	let baselineMonthlyPmi = $derived.by(() =>
		calculateMonthlyPmi(loanAmount, principal, pmiInputMode, pmiRate, pmiDollarAmount)
	);
	let extraMonthlyPmi = $derived.by(() =>
		calculateMonthlyPmi(loanAmount, principal, pmiInputMode, pmiRate, pmiDollarAmount)
	);
	let baselinePmiEndMonth = $derived.by(() =>
		getPmiEndMonth(baselinePayments, loanAmount, principal, pmiLtvThreshold)
	);
	let extraPmiEndMonth = $derived.by(() => null);
	let baselinePmiEndDate = $derived.by(() => getCompletionDate(startDate, baselinePmiEndMonth));
	let extraPmiEndDate = $derived.by(() => activeExtraScenarioSummary?.pmiEndDate ?? null);
	let baselineTotalMonthlyPayment = $derived.by(() =>
		Math.max(
			0,
			(baselinePayments[0]?.payment || 0) +
				monthlyEscrowPayment +
				baselineMonthlyPmi -
				monthlyAssistance
		)
	);
	let extraTotalMonthlyPayment = $derived.by(() =>
		Math.max(
			0,
			(activeExtraScenarioSummary?.payments[0]?.payment || 0) +
				monthlyEscrowPayment +
				extraMonthlyPmi -
				monthlyAssistance
		)
	);
	let assistanceInputValue = $derived.by(() =>
		assistanceInputFocused ? assistanceEditValue : formatUsdInput(monthlyAssistance, 2)
	);
	let baselineChartPoints = $derived.by(() => {
		return baselinePayments
			.map((payment) => ({
				x: new Date(startDate.getFullYear(), startDate.getMonth() + (payment.month - 1)).getTime(),
				y: +payment.remainingBalance.toFixed(2)
			}))
			.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
	});
	let extraChartPoints = $derived.by(() => {
		return (activeExtraScenarioSummary?.payments ?? [])
			.map((payment) => ({
				x: new Date(startDate.getFullYear(), startDate.getMonth() + (payment.month - 1)).getTime(),
				y: +payment.remainingBalance.toFixed(2)
			}))
			.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
	});
	let chartDatasets = $derived.by(() => {
		const datasets = [
			{
				label: 'Remaining Balance (No Extra)',
				data: baselineChartPoints,
				color: '#36a2eb',
				fill: false
			}
		];
		extraScenarioSummaries.forEach((scenario, idx) => {
			const colors = ['#4bc0c0', '#ff9f40', '#9966ff', '#ff6384', '#36a2eb', '#ffce56'];
			const scenarioPoints = scenario.payments
				.map((payment) => ({
					x: new Date(
						startDate.getFullYear(),
						startDate.getMonth() + (payment.month - 1)
					).getTime(),
					y: +payment.remainingBalance.toFixed(2)
				}))
				.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
			datasets.push({
				label: `Remaining Balance (${scenario.name})`,
				data: scenarioPoints,
				color: colors[idx % colors.length],
				fill: false
			});
		});
		return datasets;
	});
	function formatUsdInput(value, maximumFractionDigits = 0) {
		const numericValue = Number(value);
		const safeValue = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
		return safeValue.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits
		});
	}
	function parseUsdInput(value) {
		const numericValue = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
		return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
	}

	const updateDownPaymentPercentage = () => {
		if (principal <= 0) {
			downPaymentPercentage = 0;
			return;
		}
		downPaymentPercentage = (downPayment / principal) * 100;
		downPaymentPercentage = Math.min(
			100,
			Math.max(0, Math.round(downPaymentPercentage * 100) / 100)
		);
	};
	const updateDownPayment = () => {
		downPayment = principal * (downPaymentPercentage / 100);
		downPayment = Math.min(principal, Math.max(0, Math.round(downPayment * 100) / 100));
	};
	function monthKey(date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
	}
	function createExtraPaymentScenario(name = '') {
		const scenarioId = nextExtraPaymentScenarioId++;
		return {
			id: scenarioId,
			name: name || `Scenario ${scenarioId}`,
			extraMonthlyPayment: 0,
			oneTimePayments: [],
			nextOneTimePaymentId: 1
		};
	}
	function addExtraPaymentScenario() {
		const scenario = createExtraPaymentScenario();
		extraPaymentScenarios.push(scenario);
		activeExtraScenarioId = scenario.id;
	}
	function removeExtraPaymentScenario(id) {
		const idx = extraPaymentScenarios.findIndex((scenario) => scenario.id === id);
		if (idx < 0) return;
		extraPaymentScenarios.splice(idx, 1);
		if (activeExtraScenarioId === id) {
			activeExtraScenarioId = extraPaymentScenarios[0]?.id ?? null;
		}
	}
	function addOneTimePayment(scenario) {
		scenario.oneTimePayments.push({
			id: scenario.nextOneTimePaymentId++,
			date: loanOriginationDate || new Date().toISOString().split('T')[0],
			amount: 0,
			recurringEnabled: false,
			recurringFrequencyMonths: 12,
			recurringEndDate: ''
		});
	}
	function removeOneTimePayment(scenario, id) {
		const idx = scenario.oneTimePayments.findIndex((payment) => payment.id === id);
		if (idx >= 0) scenario.oneTimePayments.splice(idx, 1);
	}
	function updatePrincipalInput(rawValue) {
		principal = parseUsdInput(rawValue);
		updateDownPaymentPercentage();
	}
	function updateDownPaymentInput(rawValue) {
		downPayment = parseUsdInput(rawValue);
		updateDownPaymentPercentage();
	}
	function updateExtraMonthlyPaymentInput(scenario, rawValue) {
		scenario.extraMonthlyPayment = parseUsdInput(rawValue);
	}
	function updateMonthlyEscrowPaymentInput(rawValue) {
		monthlyEscrowPayment = parseUsdInput(rawValue);
	}
	function updateMonthlyAssistanceInput(rawValue) {
		assistanceEditValue = rawValue;
		monthlyAssistance = parseUsdInput(rawValue);
	}
	function handleAssistanceFocus() {
		assistanceInputFocused = true;
		assistanceEditValue = monthlyAssistance.toFixed(2);
	}
	function handleAssistanceBlur() {
		assistanceInputFocused = false;
		assistanceEditValue = '';
	}
	function updatePmiRateInput(rawValue) {
		const parsedValue = Number(rawValue);
		pmiRate = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;
	}
	function updateOneTimePaymentAmount(payment, rawValue) {
		payment.amount = parseUsdInput(rawValue);
	}
	function normalizeExtraPaymentScenario(scenario, fallbackId) {
		const normalizedScenario = {
			id: Number.isInteger(scenario?.id) ? scenario.id : fallbackId,
			name:
				typeof scenario?.name === 'string' && scenario.name.trim() !== ''
					? scenario.name.trim()
					: `Scenario ${fallbackId}`,
			extraMonthlyPayment: parseUsdInput(scenario?.extraMonthlyPayment),
			oneTimePayments: Array.isArray(scenario?.oneTimePayments)
				? scenario.oneTimePayments.map((payment, idx) => normalizeOneTimePayment(payment, idx + 1))
				: [],
			nextOneTimePaymentId: 1
		};
		normalizedScenario.nextOneTimePaymentId =
			Math.max(0, ...normalizedScenario.oneTimePayments.map((payment) => Number(payment.id) || 0)) +
			1;
		return normalizedScenario;
	}
	function calculateMonthlyPmi(
		currentBalance,
		propertyValue,
		pmiMode,
		annualPmiRate,
		monthlyPmiAmount
	) {
		const safePropertyValue = Number(propertyValue);
		const safeBalance = Number(currentBalance);
		const safeAnnualPmiRate = Number(annualPmiRate);
		const safeMonthlyPmiAmount = Number(monthlyPmiAmount);
		if (
			!Number.isFinite(safePropertyValue) ||
			!Number.isFinite(safeBalance) ||
			safePropertyValue <= 0 ||
			safeBalance <= 0
		) {
			return 0;
		}
		const loanToValue = safeBalance / safePropertyValue;
		if (loanToValue <= pmiLtvThreshold) return 0;
		if (pmiMode === 'dollar') {
			return Number.isFinite(safeMonthlyPmiAmount) ? Math.max(0, safeMonthlyPmiAmount) : 0;
		}
		if (!Number.isFinite(safeAnnualPmiRate) || safeAnnualPmiRate <= 0) return 0;
		return (safeBalance * (safeAnnualPmiRate / 100)) / 12;
	}
	function getPmiEndMonth(paymentSchedule, startingLoanAmount, propertyValue, ltvThreshold) {
		if (!Array.isArray(paymentSchedule) || paymentSchedule.length === 0) return null;
		let priorRemainingBalance = Number(startingLoanAmount);
		const safePropertyValue = Number(propertyValue);
		if (
			!Number.isFinite(priorRemainingBalance) ||
			!Number.isFinite(safePropertyValue) ||
			safePropertyValue <= 0
		) {
			return null;
		}
		if (priorRemainingBalance / safePropertyValue <= ltvThreshold) return null;
		for (const payment of paymentSchedule) {
			const month = Number(payment?.month);
			const loanToValue = priorRemainingBalance / safePropertyValue;
			if (loanToValue <= ltvThreshold) return Math.max(1, month);
			priorRemainingBalance = Number(payment?.remainingBalance);
			if (!Number.isFinite(priorRemainingBalance)) break;
		}
		return null;
	}
	function getCompletionDate(baseDate, paymentMonth) {
		if (!paymentMonth || !baseDate) return null;
		const completionDate = new Date(
			baseDate.getFullYear(),
			baseDate.getMonth() + (paymentMonth - 1),
			1
		);
		return Number.isNaN(completionDate.getTime()) ? null : completionDate;
	}
	function formatCompletionDate(date) {
		if (!date) return '--';
		return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}
	function calculateAgeAtDate(birthdateValue, targetDate) {
		const birthDate = new Date(birthdateValue);
		if (!targetDate || Number.isNaN(birthDate.getTime())) return null;
		const monthsDifference =
			(targetDate.getFullYear() - birthDate.getFullYear()) * 12 +
			(targetDate.getMonth() - birthDate.getMonth());
		if (!Number.isFinite(monthsDifference) || monthsDifference < 0) return null;
		return monthsDifference / 12;
	}
	function normalizeOneTimePayment(payment, fallbackId) {
		const recurringFrequencyMonths = Number(payment?.recurringFrequencyMonths);
		const parsedDate = new Date(payment?.date);
		return {
			id: Number.isInteger(payment?.id) ? payment.id : fallbackId,
			date: Number.isNaN(parsedDate.getTime())
				? loanOriginationDate || new Date().toISOString().split('T')[0]
				: payment.date,
			amount: parseUsdInput(payment?.amount),
			recurringEnabled: Boolean(payment?.recurringEnabled),
			recurringFrequencyMonths: recurringFrequencyValues.includes(recurringFrequencyMonths)
				? recurringFrequencyMonths
				: 12,
			recurringEndDate:
				typeof payment?.recurringEndDate === 'string' ? payment.recurringEndDate : ''
		};
	}
	function calculateMonthlyPayment(
		loanAmount,
		interestRate,
		years,
		extraPayment = 0,
		scheduleStartDate = new Date(),
		extraDatePayments = []
	) {
		const loanAmountValue = Number(loanAmount);
		const interestRateValue = Number(interestRate);
		const yearsValue = Number(years);
		const extraPaymentValue = Number(extraPayment);
		const safeLoanAmount = Number.isFinite(loanAmountValue) ? Math.max(0, loanAmountValue) : 0;
		const safeInterestRate = Number.isFinite(interestRateValue)
			? Math.max(0, interestRateValue)
			: 0;
		const safeYears = Number.isFinite(yearsValue) ? Math.max(0, yearsValue) : 0;
		const numberOfPayments = Math.round(safeYears * 12);
		const safeExtraPayment = Number.isFinite(extraPaymentValue)
			? Math.max(0, extraPaymentValue)
			: 0;
		const safeStartDate =
			scheduleStartDate instanceof Date && !Number.isNaN(scheduleStartDate.getTime())
				? scheduleStartDate
				: new Date();
		const maxScheduleDate = new Date(
			safeStartDate.getFullYear(),
			safeStartDate.getMonth() + (numberOfPayments + 1_200),
			1
		);
		const oneTimePaymentByMonth = new Map();
		for (const payment of extraDatePayments) {
			const amount = Number(payment?.amount);
			const startPaymentDate = new Date(payment?.date);
			if (!Number.isFinite(amount) || amount <= 0 || Number.isNaN(startPaymentDate.getTime()))
				continue;
			if (!payment?.recurringEnabled) {
				const key = monthKey(startPaymentDate);
				oneTimePaymentByMonth.set(key, (oneTimePaymentByMonth.get(key) ?? 0) + amount);
				continue;
			}
			const parsedFrequencyMonths = Math.round(Number(payment?.recurringFrequencyMonths));
			const frequencyMonths = recurringFrequencyValues.includes(parsedFrequencyMonths)
				? parsedFrequencyMonths
				: 12;
			const rawRecurringEndDate = String(payment?.recurringEndDate ?? '').trim();
			const parsedRecurringEndDate = new Date(rawRecurringEndDate);
			// Blank/invalid end date means repeat until the loan is paid off
			const recurringEndDate =
				rawRecurringEndDate === '' || Number.isNaN(parsedRecurringEndDate.getTime())
					? null
					: new Date(parsedRecurringEndDate.getFullYear(), parsedRecurringEndDate.getMonth(), 1);
			let occurrenceDate = new Date(startPaymentDate.getFullYear(), startPaymentDate.getMonth(), 1);
			while (
				occurrenceDate <= maxScheduleDate &&
				(recurringEndDate === null || occurrenceDate <= recurringEndDate)
			) {
				const key = monthKey(occurrenceDate);
				oneTimePaymentByMonth.set(key, (oneTimePaymentByMonth.get(key) ?? 0) + amount);
				occurrenceDate = new Date(
					occurrenceDate.getFullYear(),
					occurrenceDate.getMonth() + frequencyMonths,
					1
				);
			}
		}
		if (safeLoanAmount <= 0 || numberOfPayments <= 0) return [];

		const monthlyRate = safeInterestRate / 12 / 100;
		const baseMonthlyPayment =
			monthlyRate === 0
				? safeLoanAmount / numberOfPayments
				: (safeLoanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
					(Math.pow(1 + monthlyRate, numberOfPayments) - 1);

		let balance = safeLoanAmount;
		let month = 0;
		let totalInterest = 0;
		const payments = [];

		while (balance > 0.005 && month < numberOfPayments + 1_200) {
			month++;
			const interestPayment = balance * monthlyRate;
			totalInterest += interestPayment;
			const currentMonthDate = new Date(
				safeStartDate.getFullYear(),
				safeStartDate.getMonth() + (month - 1),
				1
			);
			const oneTimePrincipalPayment = oneTimePaymentByMonth.get(monthKey(currentMonthDate)) ?? 0;

			const principalPayment = baseMonthlyPayment - interestPayment;
			const totalPrincipalPayment = Math.min(
				balance,
				Math.max(0, principalPayment + safeExtraPayment + oneTimePrincipalPayment)
			);
			const paymentAmount = interestPayment + totalPrincipalPayment;
			balance = Math.max(0, balance - totalPrincipalPayment);

			payments.push({
				month,
				payment: paymentAmount,
				principalPayment: totalPrincipalPayment,
				interestPayment,
				remainingBalance: balance,
				totalInterest
			});
		}

		return payments;
	}

	onMount(() => {
		const today = new Date().toISOString().split('T')[0];
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				principal = parseUsdInput(parsed?.principal ?? principal);
				downPayment = parseUsdInput(parsed?.downPayment ?? downPayment);
				interestRate = Number.isFinite(Number(parsed?.interestRate))
					? Math.max(0, Number(parsed.interestRate))
					: interestRate;
				years = Number.isFinite(Number(parsed?.years)) ? Math.max(0, Number(parsed.years)) : years;
				const parsedMonthlyEscrowPayment = parseUsdInput(parsed?.monthlyEscrowPayment);
				if (parsedMonthlyEscrowPayment > 0) {
					monthlyEscrowPayment = parsedMonthlyEscrowPayment;
				} else {
					// Backwards compatibility for older saved annual tax/insurance values
					const parsedAnnualTaxes = parseUsdInput(parsed?.annualTaxes);
					const parsedAnnualInsurance = parseUsdInput(parsed?.annualInsurance);
					monthlyEscrowPayment = (parsedAnnualTaxes + parsedAnnualInsurance) / 12;
				}
				monthlyAssistance = parseUsdInput(parsed?.monthlyAssistance ?? monthlyAssistance);
				pmiInputMode = parsed?.pmiInputMode === 'percentage' ? 'percentage' : 'dollar';
				pmiRate = Number.isFinite(Number(parsed?.pmiRate))
					? Math.max(0, Number(parsed.pmiRate))
					: pmiRate;
				pmiDollarAmount = parseUsdInput(parsed?.pmiDollarAmount ?? pmiDollarAmount);
				birthdate =
					typeof parsed?.birthdate === 'string' &&
					!Number.isNaN(new Date(parsed.birthdate).getTime())
						? parsed.birthdate
						: birthdate;
				loanOriginationDate =
					typeof parsed?.loanOriginationDate === 'string' && parsed.loanOriginationDate
						? parsed.loanOriginationDate
						: today;
				if (
					Array.isArray(parsed?.extraPaymentScenarios) &&
					parsed.extraPaymentScenarios.length > 0
				) {
					extraPaymentScenarios = parsed.extraPaymentScenarios.map((scenario, idx) =>
						normalizeExtraPaymentScenario(scenario, idx + 1)
					);
				} else if (
					parseUsdInput(parsed?.extraMonthlyPayment) > 0 ||
					(Array.isArray(parsed?.oneTimePayments) && parsed.oneTimePayments.length > 0)
				) {
					// Backwards compatibility for older single-scenario format
					extraPaymentScenarios = [
						normalizeExtraPaymentScenario(
							{
								id: 1,
								name: 'Scenario 1',
								extraMonthlyPayment: parseUsdInput(parsed?.extraMonthlyPayment),
								oneTimePayments: Array.isArray(parsed?.oneTimePayments)
									? parsed.oneTimePayments
									: []
							},
							1
						)
					];
				} else {
					extraPaymentScenarios = [];
				}
				nextExtraPaymentScenarioId =
					Math.max(0, ...extraPaymentScenarios.map((scenario) => Number(scenario.id) || 0)) + 1;
				activeExtraScenarioId =
					extraPaymentScenarios.find(
						(scenario) => scenario.id === Number(parsed?.activeExtraScenarioId)
					)?.id ??
					extraPaymentScenarios[0]?.id ??
					null;
			} else {
				loanOriginationDate = today;
			}
		} catch {
			loanOriginationDate = today;
		}
		updateDownPaymentPercentage();
		hydrated = true;
	});

	$effect(() => {
		if (!hydrated) return;
		const snapshot = JSON.stringify({
			principal,
			downPayment,
			interestRate,
			years,
			extraPaymentScenarios,
			activeExtraScenarioId,
			monthlyEscrowPayment,
			monthlyAssistance,
			pmiInputMode,
			pmiRate,
			pmiDollarAmount,
			birthdate,
			loanOriginationDate
		});
		try {
			localStorage.setItem(STORAGE_KEY, snapshot);
		} catch {}
	});
</script>

<svelte:head>
	<title>Mortgage Calculator | Big Bearded Dev</title>
</svelte:head>

<div class="container">
	<h1>Mortgage Calculator</h1>
	<section class="panel">
		<div class="scenario-form">
			<fieldset class="group">
				<legend>Home and Loan</legend>
				<div class="group-grid">
					<div class="form-group homePrice">
						<label for="principal">Home Price:</label>
						<input
							type="text"
							id="principal"
							inputmode="numeric"
							value={formatUsdInput(principal)}
							oninput={(event) => updatePrincipalInput(event.currentTarget.value)}
						/>
					</div>
					<div class="form-group downPayment">
						<label for="downPayment">
							Down Payment <span class="small">(Amount)</span>
						</label>
						<input
							type="text"
							id="downPayment"
							inputmode="numeric"
							value={formatUsdInput(downPayment)}
							oninput={(event) => updateDownPaymentInput(event.currentTarget.value)}
						/>
					</div>
					<div class="form-group downPaymentSlider">
						<label for="downPaymentSlider">
							Down Payment <span class="small">({downPaymentPercentage}%)</span>
						</label>
						<input
							type="range"
							id="downPaymentSlider"
							bind:value={downPaymentPercentage}
							min="0"
							max="100"
							step="1"
							oninput={updateDownPayment}
						/>
					</div>
					<div class="form-group interestRate">
						<label for="interestRate">Interest Rate</label>
						<input type="number" id="interestRate" bind:value={interestRate} />
					</div>
					<div class="form-group years">
						<label for="years">Years</label>
						<input type="number" id="years" bind:value={years} />
					</div>
					<div class="form-group loanOriginationDate">
						<label for="loanOriginationDate">Loan Origination Date</label>
						<input type="date" id="loanOriginationDate" bind:value={loanOriginationDate} />
					</div>
					<div class="form-group birthdate">
						<label for="birthdate">Birthdate (to calculate age at payoff)</label>
						<input type="date" id="birthdate" bind:value={birthdate} />
					</div>
				</div>
			</fieldset>

			<fieldset class="group">
				<legend>Escrow Payment</legend>
				<div class="group-grid">
					<div class="form-group escrowPayment">
						<label for="monthlyEscrowPayment">Monthly Escrow Payment</label>
						<input
							type="text"
							id="monthlyEscrowPayment"
							inputmode="numeric"
							value={formatUsdInput(monthlyEscrowPayment)}
							oninput={(event) => updateMonthlyEscrowPaymentInput(event.currentTarget.value)}
						/>
					</div>
					<div class="form-group pmiRate">
						<label for="pmiRate">
							PMI
							<span class="pmiModeOptions">
								<label for="pmiModeDollar">
									<input
										type="radio"
										id="pmiModeDollar"
										name="pmiInputMode"
										value="dollar"
										bind:group={pmiInputMode}
									/>
									$
								</label>
								<label for="pmiModePercentage">
									<input
										type="radio"
										id="pmiModePercentage"
										name="pmiInputMode"
										value="percentage"
										bind:group={pmiInputMode}
									/>
									%
								</label>
							</span>
						</label>
						<div class="pmiInputRow">
							{#if pmiInputMode === 'percentage'}
								<input
									type="number"
									id="pmiRate"
									min="0"
									step="0.01"
									value={pmiRate}
									oninput={(event) => updatePmiRateInput(event.currentTarget.value)}
								/>
							{:else}
								<input
									type="number"
									id="pmiDollarAmount"
									min="0"
									step="0.01"
									bind:value={pmiDollarAmount}
								/>
							{/if}
						</div>
					</div>
					<div class="form-group monthlyAssistance">
						<label for="monthlyAssistance">Assistance</label>
						<input
							type="text"
							id="monthlyAssistance"
							inputmode="decimal"
							value={assistanceInputValue}
							onfocus={handleAssistanceFocus}
							onblur={handleAssistanceBlur}
							oninput={(event) => updateMonthlyAssistanceInput(event.currentTarget.value)}
						/>
					</div>
				</div>
			</fieldset>

			<fieldset class="group">
				<legend>Extra Payments</legend>
				<div class="scenarioList">
					{#each extraPaymentScenarios as scenario (scenario.id)}
						<div class="scenarioCard">
							<div class="scenarioCardHeader">
								<input type="text" bind:value={scenario.name} class="scenarioNameInput" />
								<div class="scenarioCardActions">
									<button
										type="button"
										class="removePaymentButton"
										onclick={() => removeExtraPaymentScenario(scenario.id)}>Remove</button
									>
								</div>
							</div>
							<div class="group-grid">
								<div class="form-group extraMonthlyPayment">
									<label for={`extraMonthlyPayment-${scenario.id}`}>Extra Monthly Payment</label>
									<input
										type="text"
										id={`extraMonthlyPayment-${scenario.id}`}
										inputmode="numeric"
										value={formatUsdInput(scenario.extraMonthlyPayment)}
										oninput={(event) =>
											updateExtraMonthlyPaymentInput(scenario, event.currentTarget.value)}
									/>
								</div>
								<div class="form-group oneTimePayments">
									<div class="oneTimePaymentsLabel">Scheduled Extra Payments</div>
									<div class="oneTimePaymentsList">
										{#each scenario.oneTimePayments as payment (payment.id)}
											<div class="oneTimePaymentRow">
												<div class="oneTimePaymentMain">
													<div class="oneTimePaymentField">
														<label for={`payment-date-${scenario.id}-${payment.id}`}
															>{payment.recurringEnabled ? 'Start Date' : 'Payment Date'}</label
														>
														<input
															type="date"
															id={`payment-date-${scenario.id}-${payment.id}`}
															bind:value={payment.date}
														/>
													</div>
													<div class="oneTimePaymentField">
														<label for={`payment-amount-${scenario.id}-${payment.id}`}>Amount</label
														>
														<input
															type="text"
															id={`payment-amount-${scenario.id}-${payment.id}`}
															inputmode="numeric"
															value={formatUsdInput(payment.amount)}
															oninput={(event) =>
																updateOneTimePaymentAmount(payment, event.currentTarget.value)}
															placeholder="Amount"
														/>
													</div>
													<div class="oneTimePaymentRecurring">
														<label>
															<input type="checkbox" bind:checked={payment.recurringEnabled} />
															Recurring
														</label>
													</div>
												</div>
												{#if payment.recurringEnabled}
													<div class="oneTimePaymentRecurringRow">
														<div class="oneTimePaymentField">
															<label for={`payment-frequency-${scenario.id}-${payment.id}`}
																>Frequency</label
															>
															<select
																id={`payment-frequency-${scenario.id}-${payment.id}`}
																bind:value={payment.recurringFrequencyMonths}
															>
																{#each recurringFrequencyOptions as option}
																	<option value={option.value}>{option.label}</option>
																{/each}
															</select>
														</div>
														<div class="oneTimePaymentField">
															<label for={`payment-end-date-${scenario.id}-${payment.id}`}
																>End Date (optional)</label
															>
															<input
																type="date"
																id={`payment-end-date-${scenario.id}-${payment.id}`}
																bind:value={payment.recurringEndDate}
															/>
														</div>
													</div>
												{/if}
												<div class="oneTimePaymentActions">
													<button
														type="button"
														class="removePaymentButton"
														onclick={() => removeOneTimePayment(scenario, payment.id)}
														>Remove</button
													>
												</div>
											</div>
										{/each}
										<button
											type="button"
											class="addPaymentButton"
											onclick={() => addOneTimePayment(scenario)}
										>
											{scenario.oneTimePayments.length === 0
												? '+ Add scheduled extra payment'
												: '+ Add one-time payment'}
										</button>
									</div>
								</div>
							</div>
						</div>
					{/each}
					<button type="button" class="addPaymentButton" onclick={addExtraPaymentScenario}>
						+ Add payoff scenario
					</button>
				</div>
			</fieldset>
		</div>
	</section>
	<section class="panel results-panel">
		<h2>Results</h2>
		{#if extraScenarioSummaries.length > 1}
			<div class="activeScenarioSelector">
				<label for="activeExtraScenarioId">Compare Scenario</label>
				<select id="activeExtraScenarioId" bind:value={activeExtraScenarioId}>
					{#each extraScenarioSummaries as scenarioSummary (scenarioSummary.id)}
						<option value={scenarioSummary.id}>{scenarioSummary.name}</option>
					{/each}
				</select>
			</div>
		{/if}
		<div class="results">
			<div class="monthlyPaymentSummary">
				<div class="monthlyPaymentCard">
					<span>Total Monthly Payment (No Extra)</span>
					<strong
						>{baselineTotalMonthlyPayment.toLocaleString('en-US', {
							style: 'currency',
							currency: 'USD'
						})}</strong
					>
					<small>Payoff: {formatCompletionDate(baselineCompletionDate)}</small>
					<small
						>Age at payoff: {baselinePayoffAge === null
							? '--'
							: baselinePayoffAge.toFixed(1)}</small
					>
				</div>
				{#each extraScenarioSummaries as scenarioSummary (scenarioSummary.id)}
					<div class="monthlyPaymentCard">
						<span>{scenarioSummary.name}</span>
						<strong
							>{scenarioSummary.totalMonthlyPayment.toLocaleString('en-US', {
								style: 'currency',
								currency: 'USD'
							})}</strong
						>
						<small>Payoff: {formatCompletionDate(scenarioSummary.completionDate)}</small>
						<small
							>Age at payoff: {calculateAgeAtDate(birthdate, scenarioSummary.completionDate) ===
							null
								? '--'
								: calculateAgeAtDate(birthdate, scenarioSummary.completionDate).toFixed(1)}</small
						>
					</div>
				{/each}
			</div>
			<table>
				<thead>
					<tr>
						<th></th>
						{#if hasExtraScenario}
							<th>Without Extra Payment</th>
							<th>{activeExtraScenarioSummary?.name ?? 'Selected Scenario'}</th>
							<th>Difference</th>
						{:else}
							<th>Results</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Monthly P&I Payment:</td>
						<td>
							{(baselinePayments[0]?.payment || 0).toLocaleString('en-US', {
								style: 'currency',
								currency: 'USD'
							})}
						</td>
						{#if hasExtraScenario}
							<td>
								{(activeExtraScenarioSummary?.payments[0]?.payment || 0).toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}
							</td>
							<td>
								{(
									(activeExtraScenarioSummary?.payments[0]?.payment || 0) -
									(baselinePayments[0]?.payment || 0)
								).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
							</td>
						{/if}
					</tr>
					<tr>
						<td>Escrow Payment:</td>
						<td colspan="1"
							>{monthlyEscrowPayment.toLocaleString('en-US', {
								style: 'currency',
								currency: 'USD'
							})}</td
						>
						{#if hasExtraScenario}
							<td colspan="2"></td>
						{/if}
					</tr>
					{#if baselineMonthlyPmi > 0 || extraMonthlyPmi > 0}
						<tr>
							<td>Monthly PMI:</td>
							<td
								>{baselineMonthlyPmi.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}</td
							>
							{#if hasExtraScenario}
								<td
									>{extraMonthlyPmi.toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD'
									})}</td
								>
								<td>
									{(baselineMonthlyPmi - extraMonthlyPmi).toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD'
									})}
								</td>
							{/if}
						</tr>
					{/if}
					{#if monthlyAssistance > 0}
						<tr>
							<td>Assistance:</td>
							<td
								>{(monthlyAssistance * -1).toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}</td
							>
							{#if hasExtraScenario}
								<td
									>{(monthlyAssistance * -1).toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD'
									})}</td
								>
								<td>{(0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td>
							{/if}
						</tr>
					{/if}
					<tr>
						<td>Total Monthly Payment:</td>
						<td
							>{baselineTotalMonthlyPayment.toLocaleString('en-US', {
								style: 'currency',
								currency: 'USD'
							})}</td
						>
						{#if hasExtraScenario}
							<td
								>{extraTotalMonthlyPayment.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}</td
							>
							<td>
								{(extraTotalMonthlyPayment - baselineTotalMonthlyPayment).toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}
							</td>
						{/if}
					</tr>
					<tr>
						<td>Total P&I Paid:</td>
						<td>
							{totalAmountPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
						</td>
						{#if hasExtraScenario}
							<td>
								{totalAmountPaidWithExtra.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}
							</td>
							<td>
								{((totalAmountPaidWithExtra - totalAmountPaid) * -1).toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}
							</td>
						{/if}
					</tr>
					<tr>
						<td>Total Interest Paid:</td>
						<td>
							{baselineTotalInterest.toLocaleString('en-US', {
								style: 'currency',
								currency: 'USD'
							})}
						</td>
						{#if hasExtraScenario}
							<td>
								{extraTotalInterest.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
							</td>
							<td>
								{(baselineTotalInterest - extraTotalInterest).toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}
							</td>
						{/if}
					</tr>
					<tr>
						<td>Number of Payments:</td>
						<td>{baselinePayments.length} ({(baselinePayments.length / 12).toFixed(2)} years)</td>
						{#if hasExtraScenario}
							<td>{totalNumberOfPayments} ({(totalNumberOfPayments / 12).toFixed(2)} years)</td>
							<td
								>{baselinePayments.length - totalNumberOfPayments} ({(
									(baselinePayments.length - totalNumberOfPayments) /
									12
								).toFixed(2)} years)</td
							>
						{/if}
					</tr>
					<tr>
						<td>Loan Completion Date:</td>
						<td>{formatCompletionDate(baselineCompletionDate)}</td>
						{#if hasExtraScenario}
							<td>{formatCompletionDate(extraCompletionDate)}</td>
							<td>
								{#if baselineCompletionDate && extraCompletionDate}
									{Math.max(
										(baselineCompletionDate.getFullYear() - extraCompletionDate.getFullYear()) *
											12 +
											(baselineCompletionDate.getMonth() - extraCompletionDate.getMonth()),
										0
									)} months earlier
								{:else}
									--
								{/if}
							</td>
						{/if}
					</tr>
				</tbody>
			</table>
		</div>
	</section>

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
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 1.25rem;
		@media (max-width: 768px) {
			grid-template-columns: 1fr;
		}
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}
	.form-group label,
	.oneTimePaymentsLabel {
		font-size: 1rem;
		font-weight: 500;
		opacity: 0.9;
	}
	.form-group input[type='text'],
	.form-group input[type='number'],
	.form-group input[type='date'],
	.form-group select {
		height: 2.6rem;
		font-size: 1.1rem;
	}
	.scenarioList {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.scenarioCard {
		border: 1px solid var(--borderColorSoft);
		border-radius: 8px;
		padding: 1rem;
	}
	.scenarioCardHeader {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}
	.scenarioNameInput {
		flex: 1;
		min-width: 160px;
	}
	.activeScenarioSelector {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.activeScenarioSelector select {
		max-width: 320px;
	}
	.pmiInputRow {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.5rem;
	}
	.pmiModeOptions {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		margin-left: 0.75rem;
		font-family: inherit;
		font-weight: 500;
	}
	.pmiModeOptions label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-family: inherit;
		font-weight: 500;
	}
	.homePrice {
		grid-column: 1 / 4;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.downPaymentSlider {
		grid-column: 1 / -1;
	}
	.downPayment {
		grid-column: 4 / 7;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}

	.interestRate,
	.escrowPayment {
		grid-column: 1 / 3;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.years {
		grid-column: 3 / 5;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.pmiRate {
		grid-column: 3 / 5;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.monthlyAssistance {
		grid-column: 5 / 7;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.extraMonthlyPayment {
		grid-column: 1 / 3;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.loanOriginationDate {
		grid-column: 5 / 7;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.birthdate {
		grid-column: 1 / 3;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.oneTimePayments {
		grid-column: 1 / -1;
	}
	.oneTimePaymentsList {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.oneTimePaymentRow {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas:
			'main actions'
			'recurring actions';
		gap: 1.25rem;
		align-items: start;
		@media (max-width: 768px) {
			grid-template-columns: 1fr;
			grid-template-areas:
				'main'
				'recurring'
				'actions';
		}
	}
	.oneTimePaymentMain {
		grid-area: main;
		display: grid;
		grid-template-columns: 1fr 1fr minmax(180px, 1fr);
		gap: 1.25rem;
		@media (max-width: 768px) {
			grid-template-columns: 1fr;
		}
	}
	.oneTimePaymentField {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.oneTimePaymentRecurring {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		justify-content: flex-end;
	}
	.oneTimePaymentRecurring label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.oneTimePaymentRecurringRow {
		grid-area: recurring;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
		@media (max-width: 768px) {
			grid-template-columns: 1fr;
		}
	}
	.oneTimePaymentActions {
		grid-area: actions;
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
	}
	.addPaymentButton,
	.removePaymentButton {
		background: transparent;
		color: var(--fontColor);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 6px;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
	}
	span {
		font-weight: 700;
		font-family: 'Roboto Slab', serif;
	}
	.results {
		width: 100%;
		max-width: none;
		margin-block: 0;
		border: none;
		border-radius: 0;
		padding: 0;
		box-shadow: none;
		.monthlyPaymentSummary {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 1rem;
			margin-bottom: 1rem;
			@media (max-width: 768px) {
				grid-template-columns: 1fr;
			}
		}
		.monthlyPaymentCard {
			border: 1px solid var(--borderColorSoft);
			border-radius: 8px;
			padding: 0.85rem 1rem;
			background: var(--accentSurface);
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}
		.monthlyPaymentCard span {
			font-family: inherit;
			font-weight: 600;
			opacity: 0.85;
		}
		.monthlyPaymentCard strong {
			font-size: 1.5rem;
			line-height: 1.2;
		}

		table {
			width: 100%;
			border-collapse: collapse;
			margin: 1rem 0;
		}
		th {
			text-align: left;
			border-bottom: 3px solid rgba(255, 255, 255, 0.5);
			padding-bottom: 0.5rem;
			&:last-child {
				text-align: right;
			}
		}

		td {
			padding: 0.5rem;
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		}

		td:first-child {
			color: var(--tableFontColor);
		}

		td:last-child {
			text-align: right;
			font-weight: 700;
			font-family: 'Roboto Slab', serif;
		}
	}
	.chart-panel :global(canvas) {
		max-width: 100%;
	}
</style>

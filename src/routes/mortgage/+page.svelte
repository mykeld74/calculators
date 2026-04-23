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
	let extraMonthlyPayment = $state(0);
	let oneTimePayments = $state([]);
	let nextOneTimePaymentId = 1;
	const recurringFrequencyOptions = [
		{ value: 1, label: 'Monthly' },
		{ value: 3, label: 'Quarterly' },
		{ value: 6, label: 'Every 6 months' },
		{ value: 12, label: 'Yearly' }
	];
	const recurringFrequencyValues = recurringFrequencyOptions.map((option) => option.value);
	let hydrated = $state(false);
	let annualTaxes = $state(3230);
	let monthlyTaxes = $derived(annualTaxes / 12);
	let annualInsurance = $state(2860);
	let monthlyInsurance = $derived(annualInsurance / 12);
	let loanOriginationDate = $state();
	let baselinePayments = $derived.by(() =>
		calculateMonthlyPayment(loanAmount, interestRate, years, 0)
	);
	let startDate = $derived.by(() => {
		const parsedStartDate = new Date(loanOriginationDate);
		return Number.isNaN(parsedStartDate.getTime()) ? new Date() : parsedStartDate;
	});
	let payments = $derived.by(() =>
		calculateMonthlyPayment(
			loanAmount,
			interestRate,
			years,
			extraMonthlyPayment,
			startDate,
			oneTimePayments
		)
	);
	let hasOneTimePayments = $derived(
		oneTimePayments.some(
			(payment) => Number(payment.amount) > 0 && !Number.isNaN(new Date(payment.date).getTime())
		)
	);
	let hasExtraScenario = $derived(extraMonthlyPayment > 0 || hasOneTimePayments);
	let baselineTotalInterest = $derived(
		baselinePayments[baselinePayments.length - 1]?.totalInterest ?? 0
	);
	let extraTotalInterest = $derived(payments[payments.length - 1]?.totalInterest ?? 0);
	let totalAmountPaid = $derived(loanAmount + baselineTotalInterest);
	let totalNumberOfPayments = $derived(payments.length);
	let totalAmountPaidWithExtra = $derived(loanAmount + extraTotalInterest);
	let baselineCompletionDate = $derived.by(() =>
		getCompletionDate(startDate, baselinePayments[baselinePayments.length - 1]?.month)
	);
	let extraCompletionDate = $derived.by(() =>
		getCompletionDate(startDate, payments[payments.length - 1]?.month)
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
		return payments
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
		if (hasExtraScenario) {
			datasets.push({
				label: 'Remaining Balance (With Extra)',
				data: extraChartPoints,
				color: '#4bc0c0',
				fill: false
			});
		}
		return datasets;
	});
	function formatUsdInput(value) {
		const numericValue = Number(value);
		const safeValue = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
		return safeValue.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
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
		downPaymentPercentage = Math.min(100, Math.max(0, Math.round(downPaymentPercentage * 100) / 100));
	};
	const updateDownPayment = () => {
		downPayment = principal * (downPaymentPercentage / 100);
		downPayment = Math.min(principal, Math.max(0, Math.round(downPayment * 100) / 100));
	};
	function monthKey(date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
	}
	function addOneTimePayment() {
		oneTimePayments.push({
			id: nextOneTimePaymentId++,
			date: loanOriginationDate || new Date().toISOString().split('T')[0],
			amount: 0,
			recurringEnabled: false,
			recurringFrequencyMonths: 12,
			recurringEndDate: ''
		});
	}
	function removeOneTimePayment(id) {
		const idx = oneTimePayments.findIndex((payment) => payment.id === id);
		if (idx >= 0) oneTimePayments.splice(idx, 1);
	}
	function updatePrincipalInput(rawValue) {
		principal = parseUsdInput(rawValue);
		updateDownPaymentPercentage();
	}
	function updateDownPaymentInput(rawValue) {
		downPayment = parseUsdInput(rawValue);
		updateDownPaymentPercentage();
	}
	function updateExtraMonthlyPaymentInput(rawValue) {
		extraMonthlyPayment = parseUsdInput(rawValue);
	}
	function updateAnnualTaxesInput(rawValue) {
		annualTaxes = parseUsdInput(rawValue);
	}
	function updateAnnualInsuranceInput(rawValue) {
		annualInsurance = parseUsdInput(rawValue);
	}
	function updateOneTimePaymentAmount(payment, rawValue) {
		payment.amount = parseUsdInput(rawValue);
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
				extraMonthlyPayment = parseUsdInput(parsed?.extraMonthlyPayment ?? extraMonthlyPayment);
				annualTaxes = parseUsdInput(parsed?.annualTaxes ?? annualTaxes);
				annualInsurance = parseUsdInput(parsed?.annualInsurance ?? annualInsurance);
				loanOriginationDate =
					typeof parsed?.loanOriginationDate === 'string' && parsed.loanOriginationDate
						? parsed.loanOriginationDate
						: today;
				oneTimePayments = Array.isArray(parsed?.oneTimePayments)
					? parsed.oneTimePayments.map((payment, idx) => normalizeOneTimePayment(payment, idx + 1))
					: [];
				nextOneTimePaymentId =
					Math.max(0, ...oneTimePayments.map((payment) => Number(payment.id) || 0)) + 1;
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
			extraMonthlyPayment,
			annualTaxes,
			annualInsurance,
			loanOriginationDate,
			oneTimePayments
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
				</div>
			</fieldset>

			<fieldset class="group">
				<legend>Extra Payments</legend>
				<div class="group-grid">
					<div class="form-group extraMonthlyPayment">
						<label for="extraMonthlyPayment">Extra Monthly Payment</label>
						<input
							type="text"
							id="extraMonthlyPayment"
							inputmode="numeric"
							value={formatUsdInput(extraMonthlyPayment)}
							oninput={(event) => updateExtraMonthlyPaymentInput(event.currentTarget.value)}
						/>
					</div>
					<div class="form-group oneTimePayments">
						<div class="oneTimePaymentsLabel">Scheduled Extra Payments</div>
						<div class="oneTimePaymentsList">
							{#each oneTimePayments as payment (payment.id)}
								<div class="oneTimePaymentRow">
									<div class="oneTimePaymentMain">
										<div class="oneTimePaymentField">
											<label for={`payment-date-${payment.id}`}
												>{payment.recurringEnabled ? 'Start Date' : 'Payment Date'}</label
											>
											<input
												type="date"
												id={`payment-date-${payment.id}`}
												bind:value={payment.date}
											/>
										</div>
										<div class="oneTimePaymentField">
											<label for={`payment-amount-${payment.id}`}>Amount</label>
											<input
												type="text"
												id={`payment-amount-${payment.id}`}
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
												<label for={`payment-frequency-${payment.id}`}>Frequency</label>
												<select
													id={`payment-frequency-${payment.id}`}
													bind:value={payment.recurringFrequencyMonths}
												>
													{#each recurringFrequencyOptions as option}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select>
											</div>
											<div class="oneTimePaymentField">
												<label for={`payment-end-date-${payment.id}`}>End Date (optional)</label>
												<input
													type="date"
													id={`payment-end-date-${payment.id}`}
													bind:value={payment.recurringEndDate}
												/>
											</div>
										</div>
									{/if}
									<div class="oneTimePaymentActions">
										<button
											type="button"
											class="removePaymentButton"
											onclick={() => removeOneTimePayment(payment.id)}>Remove</button
										>
									</div>
								</div>
							{/each}
							<button type="button" class="addPaymentButton" onclick={addOneTimePayment}>
								{oneTimePayments.length === 0
									? '+ Add scheduled extra payment'
									: '+ Add one-time payment'}
							</button>
						</div>
					</div>
				</div>
			</fieldset>

			<fieldset class="group">
				<legend>Taxes and Insurance</legend>
				<div class="group-grid">
					<div class="form-group annualTaxes">
						<label for="annualTaxes">Annual Taxes</label>
						<input
							type="text"
							id="annualTaxes"
							inputmode="numeric"
							value={formatUsdInput(annualTaxes)}
							oninput={(event) => updateAnnualTaxesInput(event.currentTarget.value)}
						/>
					</div>
					<div class="form-group annualInsurance">
						<label for="annualInsurance">Annual Insurance</label>
						<input
							type="text"
							id="annualInsurance"
							inputmode="numeric"
							value={formatUsdInput(annualInsurance)}
							oninput={(event) => updateAnnualInsuranceInput(event.currentTarget.value)}
						/>
					</div>
				</div>
			</fieldset>
		</div>
	</section>
	<section class="panel results-panel">
		<h2>Results</h2>
		<div class="results">
			<table>
				<thead>
					<tr>
						<th></th>
						{#if hasExtraScenario}
							<th>Without Extra Payment</th>
							<th>With Extra Payment</th>
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
								{(payments[0]?.payment || 0).toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}
							</td>
							<td>
								{((payments[0]?.payment || 0) - (baselinePayments[0]?.payment || 0)).toLocaleString(
									'en-US',
									{ style: 'currency', currency: 'USD' }
								)}
							</td>
						{/if}
					</tr>
					<tr>
						<td>Monthly Taxes:</td>
						<td colspan="1"
							>{monthlyTaxes.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td
						>
						{#if hasExtraScenario}
							<td colspan="2"></td>
						{/if}
					</tr>
					<tr>
						<td>Monthly Insurance:</td>
						<td colspan="1"
							>{monthlyInsurance.toLocaleString('en-US', {
								style: 'currency',
								currency: 'USD'
							})}</td
						>
						{#if hasExtraScenario}
							<td colspan="2"></td>
						{/if}
					</tr>
					<tr>
						<td>Total Monthly Payment:</td>
						<td>
							{(
								(baselinePayments[0]?.payment || 0) +
								monthlyTaxes +
								monthlyInsurance
							).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
						</td>
						{#if hasExtraScenario}
							<td>
								{((payments[0]?.payment || 0) + monthlyTaxes + monthlyInsurance).toLocaleString(
									'en-US',
									{ style: 'currency', currency: 'USD' }
								)}
							</td>
							<td>
								{((payments[0]?.payment || 0) - (baselinePayments[0]?.payment || 0)).toLocaleString(
									'en-US',
									{ style: 'currency', currency: 'USD' }
								)}
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
	.annualTaxes {
		grid-column: 1 / 3;
		@media (max-width: 768px) {
			grid-column: 1 / -1;
		}
	}
	.years,
	.annualInsurance {
		grid-column: 3 / 5;
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

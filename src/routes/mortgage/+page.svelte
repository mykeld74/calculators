<script>
	import { onMount } from 'svelte';
	import { LineChart } from '../../lib';
	import { getContext } from 'svelte';
	const isMobileStore = getContext('isMobile');
	let isMobile = $state(false);
	let principal = $state(342700);
	let downPayment = $state(0);
	let downPaymentPercentage = $state(0);
	let loanAmount = $derived(principal - downPayment);
	let interestRate = $state(2.625);
	let years = $state(20);
	let chartData = $state([]);
	let chart1Data = $state([]);
	let payments = $state([]);
	let extraMonthlyPayment = $state(0);
	let totalAmountPaid = $state(0);
	let totalNumberOfPayments = $state(0);
	let totalInterestPaid = $state(0);
	let annualTaxes = $state(3230);
	let monthlyTaxes = $derived(annualTaxes / 12);
	let annualInsurance = $state(2860);
	let monthlyInsurance = $derived(annualInsurance / 12);
	let loanOriginationDate = $state();
	let baselineTotalInterest = $state(0);
	let extraTotalInterest = $state(0);
	let totalAmountPaidWithExtra = $state(0);

	const updateDownPaymentPercentage = () => {
		downPaymentPercentage = (downPayment / principal) * 100;
		downPaymentPercentage = Math.round(downPaymentPercentage * 100) / 100;
	};
	const updateDownPayment = () => {
		downPayment = principal * (downPaymentPercentage / 100);
		downPayment = Math.round(downPayment * 100) / 100;
	};
	isMobileStore.subscribe((value) => {
		isMobile = value;
	});

	function calculateMonthlyPayment(loanAmount, interestRate, years, extraPayment = 0) {
		const monthlyRate = interestRate / 12 / 100;
		const numberOfPayments = years * 12;
		const baseMonthlyPayment =
			(loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
			(Math.pow(1 + monthlyRate, numberOfPayments) - 1);

		let balance = loanAmount;
		let month = 0;
		let totalInterest = 0;
		const payments = [];

		while (balance > 1) {
			month++;
			const interestPayment = balance * monthlyRate;
			totalInterest += interestPayment;

			// Apply base payment
			const principalPayment = baseMonthlyPayment - interestPayment;
			// Apply extra payment directly to principal
			balance = Math.max(0, balance - principalPayment - extraPayment);

			payments.push({
				month,
				payment: baseMonthlyPayment + extraPayment,
				principalPayment: principalPayment + extraPayment,
				interestPayment,
				remainingBalance: balance,
				totalInterest
			});

			// Break if we've paid off the loan
			if (balance === 0) break;
		}

		return payments;
	}

	$effect(() => {
		// Calculate baseline scenario (no extra payment)
		const baselinePayments = calculateMonthlyPayment(loanAmount, interestRate, years, 0);
		const baselineInterest = baselinePayments[baselinePayments.length - 1].totalInterest;

		// Calculate scenario with extra payment
		const extraPayments = calculateMonthlyPayment(
			loanAmount,
			interestRate,
			years,
			extraMonthlyPayment
		);
		const extraInterest = extraPayments[extraPayments.length - 1].totalInterest;

		payments = extraPayments;
		totalAmountPaid = principal + baselineInterest;
		totalNumberOfPayments = extraPayments.length;
		totalInterestPaid = extraInterest;
		totalAmountPaidWithExtra = principal + totalInterestPaid;

		// Store both interest values for comparison
		baselineTotalInterest = baselineInterest;
		extraTotalInterest = extraInterest;

		// Convert loanOriginationDate string to Date object
		const startDate = new Date(loanOriginationDate);

		chartData = extraPayments.map((payment) => ({
			date: new Date(
				startDate.getFullYear(),
				startDate.getMonth() + payment.month - 1
			).toLocaleDateString('en-US', {
				month: 'short',
				year: 'numeric'
			}),
			amount: +payment.remainingBalance.toFixed(2)
		}));
		chart1Data = extraPayments.map((payment) => ({
			x: new Date(startDate.getFullYear(), startDate.getMonth() + (payment.month - 1)).getTime(),
			y: +payment.remainingBalance.toFixed(2)
		}));
	});

	let monthlyPayment = $derived(
		((payments[0]?.payment || 0) + monthlyTaxes + monthlyInsurance).toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD'
		})
	);

	onMount(() => {
		updateDownPaymentPercentage();
		loanOriginationDate = new Date();
	});
</script>

<svelte:head>
	<title>Mortgage Calculator | Big Bearded Dev</title>
</svelte:head>

<div class="container">
	<h1>Mortgage Calculator</h1>
	<div class="form">
		<div class="form-group homePrice">
			<label for="principal">Home Price:</label>
			<input type="number" id="principal" bind:value={principal} />
		</div>
		<div class="form-group downPayment">
			<label for="downPayment">
				Down Payment <span class="small">(Amount)</span>
			</label>
			<input
				type="number"
				id="downPayment"
				bind:value={downPayment}
				oninput={updateDownPaymentPercentage}
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
		<div class="form-group extraMonthlyPayment">
			<label for="extraMonthlyPayment">Extra Monthly Payment</label>
			<input type="number" id="extraMonthlyPayment" bind:value={extraMonthlyPayment} />
		</div>
		<div class="form-group annualTaxes">
			<label for="annualTaxes">Annual Taxes</label>
			<input type="number" id="annualTaxes" bind:value={annualTaxes} />
		</div>
		<div class="form-group annualInsurance">
			<label for="annualInsurance">Annual Insurance</label>
			<input type="number" id="annualInsurance" bind:value={annualInsurance} />
		</div>
		<div class="form-group loanOriginationDate">
			<label for="loanOriginationDate">Loan Origination Date</label>
			<input type="date" id="loanOriginationDate" bind:value={loanOriginationDate} />
		</div>
	</div>
	<div class="results">
		<table>
			<thead>
				<tr>
					<th></th>
					{#if extraMonthlyPayment > 0}
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
						{(payments[0]?.payment || 0).toLocaleString('en-US', {
							style: 'currency',
							currency: 'USD'
						})}
					</td>
					{#if extraMonthlyPayment > 0}
						<td>
							{((payments[0]?.payment || 0) + extraMonthlyPayment).toLocaleString('en-US', {
								style: 'currency',
								currency: 'USD'
							})}
						</td>
						<td>
							{extraMonthlyPayment.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
						</td>
					{/if}
				</tr>
				<tr>
					<td>Monthly Taxes:</td>
					<td colspan="1"
						>{monthlyTaxes.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td
					>
					{#if extraMonthlyPayment > 0}
						<td colspan="2"></td>
					{/if}
				</tr>
				<tr>
					<td>Monthly Insurance:</td>
					<td colspan="1"
						>{monthlyInsurance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td
					>
					{#if extraMonthlyPayment > 0}
						<td colspan="2"></td>
					{/if}
				</tr>
				<tr>
					<td>Total Monthly Payment:</td>
					<td>
						{((payments[0]?.payment || 0) + monthlyTaxes + monthlyInsurance).toLocaleString(
							'en-US',
							{ style: 'currency', currency: 'USD' }
						)}
					</td>
					{#if extraMonthlyPayment > 0}
						<td>
							{(
								(payments[0]?.payment || 0) +
								extraMonthlyPayment +
								monthlyTaxes +
								monthlyInsurance
							).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
						</td>
						<td>
							{extraMonthlyPayment.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
						</td>
					{/if}
				</tr>
				<tr>
					<td>Total P&I Paid:</td>
					<td>
						{totalAmountPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
					</td>
					{#if extraMonthlyPayment > 0}
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
						{baselineTotalInterest.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
					</td>
					{#if extraMonthlyPayment > 0}
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
					<td>{years * 12} ({years.toFixed(2)} years)</td>
					{#if extraMonthlyPayment > 0}
						<td>{totalNumberOfPayments} ({(totalNumberOfPayments / 12).toFixed(2)} years)</td>
						<td
							>{years * 12 - totalNumberOfPayments} ({(
								(years * 12 - totalNumberOfPayments) /
								12
							).toFixed(2)} years)</td
						>
					{/if}
				</tr>
			</tbody>
		</table>
	</div>

	<LineChart data={chart1Data} />
</div>

<style>
	.homePrice {
		grid-column: 1 / 4;
	}
	.downPaymentSlider {
		grid-column: 1 / 7;
	}
	.downPayment {
		grid-column: 4 / 7;
	}

	.interestRate,
	.annualTaxes {
		grid-column: 1 / 3;
	}
	.years,
	.annualInsurance {
		grid-column: 3 / 5;
	}
	.extraMonthlyPayment,
	.loanOriginationDate {
		grid-column: 5 / 7;
	}
	span {
		font-weight: 700;
		font-family: 'Roboto Slab', serif;
	}
	.results {
		width: 100%;
		max-width: 960px;
		margin-block: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 0.5rem;
		padding: 1rem;
		box-shadow: 3px 3px 20px rgba(0, 0, 0, 0.75);

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
</style>

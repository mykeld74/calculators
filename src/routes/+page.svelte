<script>
	import { LineChart, interestRates, currentAgeDropdown, retirementAgeDropdown } from '$lib';
	import { getContext } from 'svelte';
	const isMobileStore = getContext('isMobile');
	let isMobile = $state(false);
	let principal = $state(115000);
	let interestRate = $state(10);
	let timesCompounded = $state(12);
	let monthlyContribution = $state(1500);
	let currentAge = $state(50);
	let retirementAge = $state(65);
	let years = $derived(Math.max(retirementAge - currentAge, 1));
	let totalArray = $state([]);
	let total = $state('');
	let width = $state(1200);

	isMobileStore.subscribe((value) => {
		isMobile = value;
	});

	function calculateCompoundInterest(principal, interestRate, years) {
		const ir = interestRate / 100;
		const totalMonths = years * 12;
		let newArray = [];

		// starting with the current month add the month and year to the running total
		let currentMonth = new Date().getMonth();
		let currentYear = new Date().getFullYear();

		let runningTotal = principal;
		for (let month = 1; month <= totalMonths; month++) {
			if (month % (12 / timesCompounded) === 0) {
				runningTotal = runningTotal * (1 + ir / timesCompounded);
			}
			runningTotal += monthlyContribution;

			newArray.push({
				x: new Date(currentYear, currentMonth).getTime(),
				y: +runningTotal.toFixed(2)
			});

			currentMonth++;
			if (currentMonth > 11) {
				currentMonth = 0;
				currentYear++;
			}
		}

		totalArray = newArray;

		return newArray[newArray.length - 1].y.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD'
		});
	}

	$effect(() => {
		total = calculateCompoundInterest(principal, interestRate, years);
	});

	$effect(() => {
		if (currentAge > retirementAge) {
			currentAge = retirementAge - 1;
		}
	});
	$effect(() => {
		if (retirementAge < currentAge) {
			retirementAge = currentAge + 1;
		}
	});
</script>

<svelte:head>
	<title>Retirement Calculator | Big Bearded Dev</title>
</svelte:head>

<div class="container" bind:clientWidth={width}>
	<h1>Retirement Calculator</h1>
	<div class="form">
		<div class="form-group contribution">
			<label for="monthlyContribution">Monthly Contribution:</label>
			<input type="number" bind:value={monthlyContribution} id="monthlyContribution" />
		</div>
		<div class="form-group principal">
			<label for="principal">Initial Principal:</label>
			<input type="number" bind:value={principal} id="principal" />
		</div>
		<div class="form-group interestRate">
			<label for="interestRate">Interest Rate: {interestRate}%</label>
			{#if isMobile}
				<select bind:value={interestRate}>
					{#each interestRates() as rate}
						<option value={rate}>{rate}%</option>
					{/each}
				</select>
			{:else}
				<input
					type="range"
					bind:value={interestRate}
					id="interestRate"
					min="4"
					max="30"
					step=".25"
				/>
			{/if}
		</div>
		<div class="form-group compounding">
			<label for="timesCompounded">Compounded:</label>
			<select bind:value={timesCompounded} id="timesCompounded">
				<option value={1}>Annually</option>
				<option value={4}>Quarterly</option>
				<option value={12}>Monthly</option>
			</select>
		</div>
		<div class="form-group currentAge">
			<label for="currentAge">Current Age: {currentAge}</label>
			{#if isMobile}
				<select bind:value={currentAge}>
					{#each currentAgeDropdown() as age}
						<option value={age}>{age}</option>
					{/each}
				</select>
			{:else}
				<input type="range" bind:value={currentAge} id="currentAge" min="18" max="100" step="1" />
			{/if}
		</div>
		<div class="form-group retirementAge">
			<label for="retirementAge">Retirement Age: {retirementAge}</label>
			{#if isMobile}
				<select bind:value={retirementAge}>
					{#each retirementAgeDropdown() as age}
						<option value={age}>{age}</option>
					{/each}
				</select>
			{:else}
				<input
					type="range"
					bind:value={retirementAge}
					id="retirementAge"
					min="19"
					max="100"
					step="1"
				/>
			{/if}
		</div>
	</div>

	<div class="results">
		<p class="years">Years of investing: <span>{years}</span></p>
		<p class="total">Total: <span>{total}</span></p>
	</div>

	<LineChart data={totalArray} />
</div>

<style>
	.contribution {
		grid-column: 1 / 4;
		@container (max-width: 650px) {
			grid-column: 1;
		}
	}
	.principal {
		grid-column: 4 / 7;
		@container (max-width: 650px) {
			grid-column: 1;
		}
	}
	.compounding {
		grid-column: 4 / 7;
		@container (max-width: 650px) {
			grid-column: 1;
		}
	}
	.interestRate {
		grid-column: 1 / 4;
		@container (max-width: 650px) {
			grid-column: 1;
		}
	}
	.currentAge {
		grid-column: 1 / 4;
		@container (max-width: 650px) {
			grid-column: 1;
		}
	}
	.retirementAge {
		grid-column: 4 / 7;
		@container (max-width: 650px) {
			grid-column: 1;
		}
	}

	.years,
	.total {
		font-size: 1.5rem;
		margin: 0;
		width: 100%;
		text-align: center;
		span {
			font-weight: 700;
			font-family: 'Roboto Slab', serif;
		}
	}
	.results {
		display: flex;
		gap: 1rem;
		width: 100%;
		max-width: 800px;
		border-top: 1px solid #fff;
		margin-top: 1rem;
		padding-top: 1rem;
	}
</style>

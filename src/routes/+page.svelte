<script>
	import { Button, ChartD3 } from '$lib';
	let principal = $state(115000);
	let interestRate = $state(10);
	let timesCompounded = $state(12);
	let monthlyContribution = $state(1500);
	let currentAge = $state(50);
	let retirementAge = $state(65);
	let years = $derived(retirementAge - currentAge);
	let totalArray = $state([]);
	let total = $state('');
	let width = $state(1200);

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
				date: new Date(currentYear, currentMonth).toLocaleDateString('en-US', {
					month: 'short',
					year: 'numeric'
				}),
				amount: +runningTotal.toFixed(2)
			});

			currentMonth++;
			if (currentMonth > 11) {
				currentMonth = 0;
				currentYear++;
			}
		}

		totalArray = newArray;

		return newArray[newArray.length - 1].amount.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD'
		});
	}

	$effect(() => {
		total = calculateCompoundInterest(principal, interestRate, years);
	});
</script>

<div class="container" bind:clientWidth={width}>
	<h1>Retirement Calculator</h1>
	<div class="form">
		<div class="form-group">
			<label for="monthlyContribution">Monthly Contribution:</label>
			<input type="number" bind:value={monthlyContribution} id="monthlyContribution" />
		</div>
		<div class="form-group">
			<label for="principal">Initial Principal:</label>
			<input type="number" bind:value={principal} id="principal" />
		</div>
		<div class="form-group">
			<label for="interestRate">Interest Rate:</label>
			<input type="number" bind:value={interestRate} id="interestRate" />
		</div>
		<div class="form-group">
			<label for="currentAge">Current Age:</label>
			<input type="number" bind:value={currentAge} id="currentAge" />
		</div>
		<div class="form-group">
			<label for="retirementAge">Retirement Age:</label>
			<input type="number" bind:value={retirementAge} id="retirementAge" />
		</div>
		<div class="form-group">
			<label for="timesCompounded">Times Compounded:</label>
			<div class="radio-group">
				<label>
					<input type="radio" name="compounding" bind:group={timesCompounded} value={1} />
					Annually
				</label>
				<label>
					<input type="radio" name="compounding" bind:group={timesCompounded} value={4} />
					Quarterly
				</label>
				<label>
					<input type="radio" name="compounding" bind:group={timesCompounded} value={12} />
					Monthly
				</label>
			</div>
		</div>
	</div>

	<p>Total: {total}</p>

	<ChartD3 data={totalArray} {width} />
</div>

<style>
	.container {
		width: 100vw;
		max-width: 1200px;
		margin: 0 auto;
		display: grid;
		place-items: center;
		gap: 1.5rem;
	}
	.form {
		width: 100vw;
		max-width: 1200px;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1rem;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
	}
</style>

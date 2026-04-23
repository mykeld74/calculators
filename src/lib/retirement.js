export function parseBirthdate(birthdate) {
	if (typeof birthdate !== 'string') return null;
	const [yRaw, mRaw, dRaw] = birthdate.split('-');
	const year = Number(yRaw);
	const month = Number(mRaw);
	const day = Number(dRaw);
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
	return { year, month, day };
}

export function currentAge(scenario, now = new Date()) {
	const parts = parseBirthdate(scenario?.birthdate);
	if (!parts) return 0;
	let age = now.getFullYear() - parts.year;
	const monthDiff = now.getMonth() + 1 - parts.month;
	if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parts.day)) age--;
	return age;
}

function monthIndexFromStartDate(startDate, now) {
	if (typeof startDate !== 'string') return null;
	const date = new Date(startDate);
	if (Number.isNaN(date.getTime())) return null;
	const nowYear = now.getFullYear();
	const nowMonth = now.getMonth();
	const startYear = date.getFullYear();
	const startMonth = date.getMonth();
	return Math.max((startYear - nowYear) * 12 + (startMonth - nowMonth), 0);
}

function normalizeFutureChanges(changes, now) {
	const recurringFrequencyValues = [1, 3, 6, 12];
	if (!Array.isArray(changes)) return [];
	return changes
		.map((change) => {
			const yearsFromNow = Number(change?.yearsFromNow);
			const startDateMonthIndex = monthIndexFromStartDate(change?.startDate, now);
			const annualSalary = Number(change?.annualSalary);
			const contributionPercent = Number(change?.contributionPercent);
			const changeType =
				change?.changeType === 'salary' || change?.changeType === 'contribution'
					? change.changeType
					: 'salary';
			const recurringEnabled = Boolean(change?.recurringEnabled);
			const recurringPercent = Number(change?.recurringPercent);
			const recurringFrequencyMonths = Number(change?.recurringFrequencyMonths);
			const recurringEndAfterYears = Number(change?.recurringEndAfterYears);

			return {
				monthIndex:
					startDateMonthIndex !== null
						? startDateMonthIndex
						: Math.max(Math.round(yearsFromNow * 12), 0),
				changeType,
				annualSalary: Number.isFinite(annualSalary) ? Math.max(annualSalary, 0) : null,
				contributionPercent: Number.isFinite(contributionPercent)
					? Math.min(Math.max(contributionPercent, 0), 50)
					: null,
				recurringEnabled,
				recurringPercent: Number.isFinite(recurringPercent)
					? Math.min(Math.max(recurringPercent, -100), 100)
					: 0,
				recurringFrequencyMonths: recurringFrequencyValues.includes(
					Math.round(recurringFrequencyMonths)
				)
					? Math.round(recurringFrequencyMonths)
					: 12,
				recurringDurationMonths: Number.isFinite(recurringEndAfterYears)
					? Math.max(Math.round(recurringEndAfterYears * 12), 0)
					: 0
			};
		})
		.filter((change) => Number.isFinite(change.monthIndex))
		.sort((a, b) => a.monthIndex - b.monthIndex);
}

function normalizeTimesCompounded(timesCompounded) {
	const parsed = Math.round(Number(timesCompounded));
	return [1, 4, 12].includes(parsed) ? parsed : 12;
}

export function projectBalance(s, now = new Date()) {
	const age = currentAge(s, now);
	const years = Math.max(s.retirementAge - age, 0);
	const totalMonths = years * 12;
	const employerPct = s.employerMatch ?? 0;
	let annualSalary = s.annualSalary;
	let contributionPercent = s.contributionPercent;
	const futureChanges = normalizeFutureChanges(s.futureChanges, now);
	let futureChangeIndex = 0;

	const computeMonthlyContributions = () => {
		const totalContribPercent = contributionPercent + employerPct;
		return {
			monthlyContribution: (annualSalary * (totalContribPercent / 100)) / 12,
			monthlyEmployeeContribution: (annualSalary * (contributionPercent / 100)) / 12,
			monthlyEmployerContribution: (annualSalary * (employerPct / 100)) / 12
		};
	};

	const applyFutureChange = (change) => {
		if (change.changeType === 'salary' && change.annualSalary !== null) {
			annualSalary = change.annualSalary;
		}
		if (change.changeType === 'contribution' && change.contributionPercent !== null) {
			contributionPercent = change.contributionPercent;
		}
	};

	const applyRecurringFutureChange = (change) => {
		const multiplier = 1 + change.recurringPercent / 100;
		if (change.changeType === 'salary') {
			annualSalary = Math.max(annualSalary * multiplier, 0);
		}
		if (change.changeType === 'contribution') {
			contributionPercent = Math.min(Math.max(contributionPercent * multiplier, 0), 50);
		}
	};

	while (
		futureChangeIndex < futureChanges.length &&
		futureChanges[futureChangeIndex].monthIndex <= 0
	) {
		const change = futureChanges[futureChangeIndex];
		if (change.recurringEnabled) applyRecurringFutureChange(change);
		else applyFutureChange(change);
		futureChangeIndex++;
	}
	const baseMonthly = computeMonthlyContributions();

	const timesCompounded = normalizeTimesCompounded(s.timesCompounded);
	const retirementRate = Number(s.interestRate) / 100;
	const compoundEvery = 12 / timesCompounded;
	const inheritanceRate = (Number(s.inheritanceReturnRate) || 0) / 100;

	const inheritanceMonthFromNow = (s.inheritanceAge - age) * 12;
	const hasInheritance = s.inheritanceAmount > 0;
	const alreadyReceived = hasInheritance && inheritanceMonthFromNow <= 0;

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
		while (
			futureChangeIndex < futureChanges.length &&
			futureChanges[futureChangeIndex].monthIndex === i - 1
		) {
			const change = futureChanges[futureChangeIndex];
			if (change.recurringEnabled) applyRecurringFutureChange(change);
			else applyFutureChange(change);
			futureChangeIndex++;
		}

		for (const change of futureChanges) {
			if (!change.recurringEnabled) continue;
			const monthOffset = i - 1 - change.monthIndex;
			if (monthOffset <= 0) continue;
			if (monthOffset > change.recurringDurationMonths) continue;
			if (monthOffset % change.recurringFrequencyMonths !== 0) continue;
			applyRecurringFutureChange(change);
		}

		const { monthlyContribution } = computeMonthlyContributions();

		if (i % compoundEvery === 0) {
			retirementBalance *= 1 + retirementRate / timesCompounded;
		}
		retirementBalance += monthlyContribution;

		if (inheritanceBalance > 0 && i % compoundEvery === 0) {
			inheritanceBalance *= 1 + inheritanceRate / timesCompounded;
		}

		if (hasInheritance && inheritanceMonthFromNow > 0 && i === inheritanceMonthFromNow) {
			if (s.inheritanceInvested) inheritanceBalance += s.inheritanceAmount;
			else uninvestedInheritance += s.inheritanceAmount;
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
		monthlyContribution: baseMonthly.monthlyContribution,
		monthlyEmployeeContribution: baseMonthly.monthlyEmployeeContribution,
		monthlyEmployerContribution: baseMonthly.monthlyEmployerContribution,
		employerPct
	};
}

export function calculateRunOutAge(
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

	const timesCompounded = normalizeTimesCompounded(s.timesCompounded);
	const retirementRate = Number(s.interestRate) / 100;
	const inheritanceRate = (Number(s.inheritanceReturnRate) || 0) / 100;
	const compoundEvery = 12 / timesCompounded;
	const maxMonths = Math.max((120 - s.retirementAge) * 12, 0);

	for (let i = 1; i <= maxMonths; i++) {
		if (retirementBalance > 0 && i % compoundEvery === 0) {
			retirementBalance *= 1 + retirementRate / timesCompounded;
		}
		if (inheritanceBalance > 0 && i % compoundEvery === 0) {
			inheritanceBalance *= 1 + inheritanceRate / timesCompounded;
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

export function projectDrawdownSeries(
	s,
	retirementBalanceStart,
	inheritanceBalanceStart,
	uninvestedCashStart,
	now = new Date()
) {
	const monthlyWithdrawal =
		((retirementBalanceStart + inheritanceBalanceStart + uninvestedCashStart) *
			(s.withdrawalRate / 100)) /
		12;
	const age = currentAge(s, now);
	const monthsToRetirement = Math.max((s.retirementAge - age) * 12, 0);
	const maxMonths = Math.max((120 - s.retirementAge) * 12, 0);
	const timesCompounded = normalizeTimesCompounded(s.timesCompounded);
	const retirementRate = Number(s.interestRate) / 100;
	const inheritanceRate = (Number(s.inheritanceReturnRate) || 0) / 100;
	const compoundEvery = 12 / timesCompounded;

	let retirementBalance = retirementBalanceStart;
	let inheritanceBalance = inheritanceBalanceStart;
	let uninvestedCash = uninvestedCashStart;
	let currentDate = new Date(now.getFullYear(), now.getMonth() + monthsToRetirement);

	const series = [
		{
			x: currentDate.getTime(),
			y: +(retirementBalance + inheritanceBalance + uninvestedCash).toFixed(2)
		}
	];

	if (monthlyWithdrawal <= 0) return series;

	for (let i = 1; i <= maxMonths; i++) {
		if (retirementBalance > 0 && i % compoundEvery === 0) {
			retirementBalance *= 1 + retirementRate / timesCompounded;
		}
		if (inheritanceBalance > 0 && i % compoundEvery === 0) {
			inheritanceBalance *= 1 + inheritanceRate / timesCompounded;
		}

		const totalBeforeWithdrawal = retirementBalance + inheritanceBalance + uninvestedCash;
		if (totalBeforeWithdrawal <= 0) break;

		const withdrawal = Math.min(monthlyWithdrawal, totalBeforeWithdrawal);
		const retirementShare = retirementBalance / totalBeforeWithdrawal;
		const inheritanceShare = inheritanceBalance / totalBeforeWithdrawal;
		const cashShare = uninvestedCash / totalBeforeWithdrawal;

		retirementBalance = Math.max(retirementBalance - withdrawal * retirementShare, 0);
		inheritanceBalance = Math.max(inheritanceBalance - withdrawal * inheritanceShare, 0);
		uninvestedCash = Math.max(uninvestedCash - withdrawal * cashShare, 0);

		currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
		series.push({
			x: currentDate.getTime(),
			y: +(retirementBalance + inheritanceBalance + uninvestedCash).toFixed(2)
		});

		if (retirementBalance + inheritanceBalance + uninvestedCash <= 0) break;
	}

	return series;
}

export function calculateSuggestedWithdrawalRate(s, now = new Date()) {
	const { finalBalance, inheritanceBalance, uninvestedInheritance } = projectBalance(s, now);
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
	for (let i = 0; i < 20; i++) {
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

	return Math.round(low * 10) / 10;
}

export function computeResults(s, now = new Date()) {
	const projection = projectBalance(s, now);
	const { finalBalance, inheritanceBalance, uninvestedInheritance } = projection;
	const totalNestEgg = finalBalance + inheritanceBalance + uninvestedInheritance;
	const monthlyWithdrawal = (totalNestEgg * (s.withdrawalRate / 100)) / 12;
	const effectiveWithdrawalRate =
		totalNestEgg > 0 ? (monthlyWithdrawal * 12 * 100) / totalNestEgg : 0;
	const runOutAge = calculateRunOutAge(s, finalBalance, inheritanceBalance, uninvestedInheritance);
	const drawdownSeries = projectDrawdownSeries(
		s,
		finalBalance,
		inheritanceBalance,
		uninvestedInheritance,
		now
	);
	const gross = monthlyWithdrawal + s.monthlySS;
	const federal = gross * (s.federalRate / 100);
	const stateTax = gross * (s.stateRate / 100);
	const medicare = gross * (s.medicareRate / 100);
	const takeHome = gross - federal - stateTax - medicare;
	return {
		...projection,
		totalNestEgg,
		monthlyWithdrawal,
		effectiveWithdrawalRate,
		runOutAge,
		drawdownSeries,
		gross,
		federal,
		stateTax,
		medicare,
		takeHome
	};
}

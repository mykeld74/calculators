export const interestRates = () => {
	let rates = [];

	for (let i = 4; i <= 30; i += 0.25) {
		rates.push(i);
	}
	return rates;
};

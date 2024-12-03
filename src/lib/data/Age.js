const currentAgeDropdown = () => {
	let ages = [];
	for (let i = 20; i <= 100; i++) {
		ages.push(i);
	}
	return ages;
};

const retirementAgeDropdown = () => {
	let ages = [];
	for (let i = 20; i <= 100; i++) {
		ages.push(i);
	}
	return ages;
};

export { currentAgeDropdown, retirementAgeDropdown };

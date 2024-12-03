<script>
	import { onMount, getContext } from 'svelte';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';

	let { data } = $props();
	let canvas;
	let chart;
	const themeStore = getContext('theme');
	let currentTheme = $state('default');
	let tickColor = $derived(currentTheme === 'light' ? '#000' : '#dedede');

	themeStore.subscribe((value) => {
		currentTheme = value;
	});

	$effect(() => {
		if (canvas && data) {
			if (chart) chart.destroy();

			const chartData = {
				labels: data.map((d) => d.x),
				datasets: [
					{
						label: 'Balance',
						data: data.map((d) => ({ x: d.x, y: d.y })),
						borderColor: 'rgb(75, 192, 192)',
						fill: true,
						tension: 0.1,
						pointRadius: 0.5,
						pointHitRadius: 10,
						backgroundColor: 'rgba(75, 192, 192, 0.1)'
					}
				]
			};

			chart = new Chart(canvas, {
				type: 'line',
				data: chartData,
				options: {
					responsive: true,
					scales: {
						x: {
							type: 'time',
							time: {
								unit: 'month'
							},
							ticks: {
								color: tickColor
							},
							grid: {
								color: 'rgba(255, 255, 255, 0.1)'
							}
						},
						y: {
							ticks: {
								color: tickColor,
								callback: (value) => {
									return `${value.toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD'
									})}`;
								}
							},
							grid: {
								color: 'rgba(255, 255, 255, 0.1)'
							}
						}
					},
					plugins: {
						tooltip: {
							callbacks: {
								title: (context) => {
									const date = new Date(context[0].parsed.x);
									return date.toLocaleDateString('en-US', {
										month: 'long',
										year: 'numeric'
									});
								},
								label: (context) => {
									return `Balance: ${context.parsed.y.toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD'
									})}`;
								}
							}
						},
						legend: {
							labels: {
								color: tickColor
							}
						}
					},
					parsing: true,
					normalized: true
				}
			});
		}
	});

	onMount(() => {
		return () => {
			if (chart) chart.destroy();
		};
	});
</script>

<canvas bind:this={canvas}></canvas>

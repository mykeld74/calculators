<script>
	import { onMount, getContext } from 'svelte';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';

	let { datasets } = $props();
	let canvas;
	let chart;
	const themeStore = getContext('theme');
	let currentTheme = $state('default');
	let tickColor = $derived(currentTheme === 'light' ? '#000' : '#dedede');

	themeStore.subscribe((value) => {
		currentTheme = value;
	});

	$effect(() => {
		if (!canvas || !datasets || datasets.length === 0) return;

		if (chart) chart.destroy();

		const chartData = {
			datasets: datasets.map((ds) => ({
				label: ds.label,
				data: ds.data.map((d) => ({ x: d.x, y: d.y })),
				borderColor: ds.color,
				backgroundColor: ds.fill ? hexToRgba(ds.color, 0.1) : 'transparent',
				fill: !!ds.fill,
				tension: 0.1,
				pointRadius: 0.5,
				pointHitRadius: 10,
				borderWidth: 2
			}))
		};

		chart = new Chart(canvas, {
			type: 'line',
			data: chartData,
			options: {
				responsive: true,
				interaction: { mode: 'nearest', intersect: false },
				scales: {
					x: {
						type: 'time',
						time: { unit: 'month' },
						ticks: { color: tickColor },
						grid: { color: 'rgba(255, 255, 255, 0.1)' }
					},
					y: {
						ticks: {
							color: tickColor,
							callback: (value) =>
								`${value.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD',
									maximumFractionDigits: 0
								})}`
						},
						grid: { color: 'rgba(255, 255, 255, 0.1)' }
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
							label: (context) =>
								`${context.dataset.label}: ${context.parsed.y.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD',
									maximumFractionDigits: 0
								})}`
						}
					},
					legend: { labels: { color: tickColor } }
				},
				parsing: true,
				normalized: true
			}
		});
	});

	function hexToRgba(color, alpha) {
		if (color.startsWith('rgb')) {
			return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
		}
		const hex = color.replace('#', '');
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	onMount(() => {
		return () => {
			if (chart) chart.destroy();
		};
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		max-width: 90%;
	}
</style>

<script>
	import { onMount, getContext } from 'svelte';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';

	let { datasets, markers = [] } = $props();
	let canvas;
	let chart;
	const themeStore = getContext('theme');
	let currentTheme = $state('default');
	let tickColor = $derived(currentTheme === 'light' ? '#000' : '#dedede');
	let gridColor = $derived(
		currentTheme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
	);

	function buildDatasets(list) {
		return list.map((ds) => ({
			label: ds.label,
			data: ds.data.map((d) => ({ x: d.x, y: d.y })),
			borderColor: ds.color,
			backgroundColor: ds.fill ? hexToRgba(ds.color, 0.1) : 'transparent',
			fill: !!ds.fill,
			borderDash: ds.borderDash ?? [],
			tension: 0.1,
			pointRadius: 0.5,
			pointHitRadius: 10,
			borderWidth: 2
		}));
	}

	function buildMarkerDatasets(markerList, list) {
		if (!markerList.length || !list.length) return [];
		const values = list.flatMap((ds) => ds.data.map((d) => d.y)).filter(Number.isFinite);
		if (!values.length) return [];
		const minY = Math.min(...values);
		const maxY = Math.max(...values);
		return markerList.map((marker) => ({
			label: marker.label,
			data: [
				{ x: marker.x, y: minY },
				{ x: marker.x, y: maxY }
			],
			borderColor: marker.color ?? 'rgba(255,255,255,0.35)',
			borderDash: marker.dash ?? [6, 4],
			fill: false,
			tension: 0,
			pointRadius: 0,
			pointHitRadius: 0,
			borderWidth: 1.5
		}));
	}

	$effect(() => {
		if (!canvas || !datasets || datasets.length === 0) return;

		if (!chart) {
			chart = new Chart(canvas, {
				type: 'line',
				data: { datasets: [...buildDatasets(datasets), ...buildMarkerDatasets(markers, datasets)] },
				options: {
					responsive: true,
					interaction: { mode: 'nearest', intersect: false },
					scales: {
						x: {
							type: 'time',
							time: { unit: 'month' },
							ticks: { color: tickColor },
							grid: { color: gridColor }
						},
						y: {
							ticks: {
								color: tickColor,
								callback: (value) =>
									value.toLocaleString('en-US', {
										style: 'currency',
										currency: 'USD',
										maximumFractionDigits: 0
									})
							},
							grid: { color: gridColor }
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
			return;
		}

		chart.data.datasets = [...buildDatasets(datasets), ...buildMarkerDatasets(markers, datasets)];
		chart.options.scales.x.ticks.color = tickColor;
		chart.options.scales.y.ticks.color = tickColor;
		chart.options.scales.x.grid.color = gridColor;
		chart.options.scales.y.grid.color = gridColor;
		chart.options.plugins.legend.labels.color = tickColor;
		chart.update();
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
		const unsubscribe = themeStore.subscribe((value) => {
			currentTheme = value;
		});
		return () => {
			unsubscribe();
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

<script>
	import { onMount, getContext } from 'svelte';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';

	let { datasets, markers = [] } = $props();
	let canvas;
	let chart;
	const themeStore = getContext('theme');
	let currentTheme = $state('dark');
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
			showInLegend: ds.showInLegend ?? true,
			tension: 0.1,
			pointRadius: 0.5,
			pointHitRadius: 10,
			borderWidth: 2
		}));
	}

	function legendItemsByGroup(list) {
		const visibleItems = list.filter((ds) => ds.showInLegend !== false);
		return {
			accumulation: visibleItems.filter((ds) => ds.legendGroup !== 'Retired'),
			retired: visibleItems.filter((ds) => ds.legendGroup === 'Retired')
		};
	}

	let legendGroups = $derived(legendItemsByGroup(datasets ?? []));

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
			showInLegend: false,
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
						legend: { display: false }
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

<div class="chartShell">
	<div class="legendFlyout">
		<button type="button" class="legendIcon" aria-label="Show chart legend">Legend</button>
		<div class="legendPanel">
			{#if legendGroups.accumulation.length > 0}
				<div class="legendSection">
					<div class="legendTitle">Accumulation</div>
					{#each legendGroups.accumulation as item}
						<div class="legendItem">
							<span
								class="legendLine"
								style:border-color={item.color}
								style:border-style={item.borderDash?.length ? 'dashed' : 'solid'}
							></span>
							<span class="legendLabel">{item.label}</span>
						</div>
					{/each}
				</div>
			{/if}
			{#if legendGroups.retired.length > 0}
				<div class="legendSection">
					<div class="legendTitle">Retired</div>
					{#each legendGroups.retired as item}
						<div class="legendItem">
							<span
								class="legendLine"
								style:border-color={item.color}
								style:border-style={item.borderDash?.length ? 'dashed' : 'solid'}
							></span>
							<span class="legendLabel">{item.label}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	canvas {
		max-width: 90%;
	}
	.chartShell {
		position: relative;
	}
	.legendFlyout {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		z-index: 5;
	}
	.legendIcon {
		height: 1.9rem;
		padding: 0 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		background: rgba(0, 0, 0, 0.35);
		color: #fff;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.legendPanel {
		display: none;
		position: absolute;
		top: 2.1rem;
		right: 0;
		min-width: 220px;
		background: rgba(0, 0, 0, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		backdrop-filter: blur(2px);
	}
	.legendFlyout:hover .legendPanel,
	.legendFlyout:focus-within .legendPanel {
		display: block;
	}
	.legendSection + .legendSection {
		margin-top: 0.6rem;
		padding-top: 0.55rem;
		border-top: 1px solid rgba(255, 255, 255, 0.14);
	}
	.legendTitle {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		opacity: 0.75;
		margin-bottom: 0.4rem;
	}
	.legendItem {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	.legendItem + .legendItem {
		margin-top: 0.25rem;
	}
	.legendLine {
		display: inline-block;
		width: 24px;
		border-top-width: 2px;
		border-top-style: solid;
	}
	.legendLabel {
		line-height: 1.2;
	}
</style>

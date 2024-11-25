<script>
	let { children, data, ...props } = $props();
	import { scaleTime, scaleLinear, extent, max, line, curveBasis } from 'd3';
	import Axis from './axis.svelte';
	import GridLines from './GridLines.svelte';
	import { draw } from 'svelte/transition';

	let width = $state(1200);
	let height = $derived((width * 9) / 16);
	const margin = { top: 50, right: 50, bottom: 50, left: 100 };

	console.log('data ', data);

	const xScale = $derived(
		data && width
			? scaleTime()
					.domain(extent(data, (d) => new Date(d.date)))
					.range([margin.left, width - margin.right])
			: undefined
	);

	const yScale = $derived(
		data && width
			? scaleLinear()
					.domain([0, max(data, (d) => +d.amount + 4)])
					.range([height - margin.bottom, margin.top])
			: undefined
	);

	const lineGenerator = $derived(
		line()
			.x((d) => xScale(new Date(d.date)))
			.y((d) => yScale(+d.amount))
			.curve(curveBasis)
	);
</script>

<!-- bind width of the container div to the svg width-->
<!-- what this will to is to set the width of the svg responsively, same width like its container div -->
<div class="wrapper" bind:clientWidth={width}>
	{#if data && width}
		<svg {width} {height}>
			<!-- Add gridlines before the line chart -->
			<GridLines {width} {height} {margin} scale={xScale} position="bottom" />
			<GridLines {width} {height} {margin} scale={yScale} position="left" />

			<Axis
				{width}
				{height}
				{margin}
				tick_number={width > 600 ? 30 : 6}
				scale={xScale}
				position="bottom"
			/>
			<Axis
				{width}
				{height}
				{margin}
				scale={yScale}
				position="left"
				tick_number={Math.min(20, Math.ceil((max(data, (d) => +d.amount / 10) + 4) / 10000))}
			/>
			{#key data}
				<path
					in:draw={{ duration: 750 }}
					d={lineGenerator(data)}
					stroke-linecap="round"
					fill="none"
					class="line"
				/>
			{/key}

			<!-- Add data points -->
			{#each data as point}
				<g transform="translate({xScale(new Date(point.date))},{yScale(+point.amount)})">
					<circle r="4" class="data-point" />
					<text class="tooltip" y="-30" text-anchor="middle">
						{point.date}
					</text>
					<text class="tooltip" y="-5" text-anchor="middle">
						${point.amount?.toLocaleString()}
					</text>
				</g>
			{/each}

			<!-- Add X-axis label -->
			<text x={width / 2} y={height - margin.bottom / 3} text-anchor="middle" class="axis-label">
				Date
			</text>

			<!-- Add Y-axis label -->
			<text
				x={-height / 2}
				y={margin.left / 3}
				transform="rotate(-90)"
				text-anchor="middle"
				class="axis-label"
			>
				Amount ($)
			</text>
		</svg>
	{/if}
</div>

<style>
	.wrapper {
		container-type: inline-size;
		width: 100%;
	}
	.line {
		stroke: oklch(59.26% 0.0863 237.71);
		stroke-width: 3px;
	}

	.data-point {
		fill: oklch(59.26% 0.0863 237.71);
		opacity: 0;
	}

	.data-point:hover {
		opacity: 1;
		r: 6;
		transition: all 0.2s;
	}

	.tooltip {
		opacity: 0;
		font-family: 'Roboto Slab', serif;
		font-size: 16px;
		transition: opacity 0.3s;
	}

	.data-point:hover ~ .tooltip {
		opacity: 1;
		transform: translate(0, -20px);
	}

	.axis-label {
		font-size: 14px;
		fill: currentColor;
	}
</style>

<script>
	let { children, data, width, ...props } = $props();
	import { scaleTime, scaleLinear, extent, max, line, curveBasis } from 'd3';
	import Axis from './axis.svelte';
	import GridLines from './GridLines.svelte';

	import { onMount } from 'svelte';
	import { draw } from 'svelte/transition';

	const height = (width * 9) / 16;
	const margin = { top: 50, right: 50, bottom: 20, left: 100 };

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

	// Line function from d3 to create the d attribute for a path element
	// which will be our line,
	const lineGenerator = $derived(
		line()
			.x((d) => xScale(new Date(d.date)))
			.y((d) => yScale(+d.amount))
			.curve(curveBasis)
	);
</script>

<!-- bind width of the container div to the svg width-->
<!-- what this will to is to set the width of the svg responsively, same width like its container div -->
<div class="wrapper">
	{#if data && width}
		<svg {width} {height}>
			<!-- Add gridlines before the line chart -->
			<GridLines {width} {height} {margin} scale={xScale} position="bottom" />
			<GridLines {width} {height} {margin} scale={yScale} position="left" />

			<Axis
				{width}
				{height}
				{margin}
				tick_number={width > 380 ? 30 : 4}
				scale={xScale}
				position="bottom"
			/>
			<Axis {width} {height} {margin} scale={yScale} position="left" />

			<path
				in:draw={{ duration: 2000 }}
				d={lineGenerator(data)}
				stroke-linecap="round"
				fill="none"
				class="line"
			/>

			<!-- Add data points -->
			{#each data as point}
				<g transform="translate({xScale(new Date(point.date))},{yScale(+point.amount)})">
					<circle r="4" class="data-point" />
					<text class="tooltip" y="-20" text-anchor="middle">
						{point.date}
					</text>
					<text class="tooltip" y="-5" text-anchor="middle">
						${point.amount.toLocaleString()}
					</text>
				</g>
			{/each}
		</svg>
	{/if}
</div>

<style>
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
		font-size: 16px;
		transition: opacity 0.3s;
	}

	.data-point:hover ~ .tooltip {
		opacity: 1;
		transform: translate(0, -20px);
	}
</style>

<!-- Axis.svelte -->
<script>
	import { select, axisBottom, axisLeft, format } from 'd3';
	let {
		width,
		height,
		margin,
		position,
		scale,
		tick_outer,
		tick_number,
		to_format,
		no_domain,
		formatString = '$.0f',
		format_mobile
	} = $props();

	const formatMobile = (tick) => {
		return "'" + tick.toString().slice(13, 15);
	};

	const formatter = format(formatString);
	let transform = $state();
	let g;

	$effect(() => {
		select(g).selectAll('*').remove();

		let axis;

		if (width && scale) {
			switch (position) {
				case 'bottom':
					if (format_mobile) {
						axis = axisBottom(scale)
							.tickFormat((d) => formatMobile(d))
							.tickSizeOuter(tick_outer || 0);
						transform = `translate(0, ${height - margin.bottom})`;
					} else {
						axis = axisBottom(scale)
							.ticks(tick_number || 8)
							.tickSizeOuter(tick_outer || 0);
						transform = `translate(0, ${height - margin.bottom})`;
					}
					break;
				case 'left':
					if (to_format) {
						axis = axisLeft(scale)
							.tickSizeOuter(tick_outer || 0)
							.tickFormat((d) => formatter(d))
							.ticks(tick_number || 5);
						transform = `translate(${margin.left}, 0)`;
					} else {
						axis = axisLeft(scale)
							.ticks(tick_number || 5)
							.tickSizeOuter(tick_outer || 0);
						transform = `translate(${margin.left}, 0)`;
					}
			}

			if (no_domain) {
				select(g).call(axis).select('.domain').remove();
			} else {
				select(g).call(axis);
			}
		}
	});
</script>

<g class="axis" bind:this={g} {transform} />

<style>
	.axis {
		shape-rendering: crispEdges;
	}
</style>

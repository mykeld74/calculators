<script>
	let { scale, width, height, margin, position } = $props();

	const ticks = $derived(scale.ticks(position === 'left' ? 25 : 90));
</script>

{#if position === 'left'}
	{#each ticks as tick}
		<line
			x1={margin.left}
			x2={width - margin.right}
			y1={scale(tick)}
			y2={scale(tick)}
			class="grid-line"
		/>
	{/each}
{:else}
	{#each ticks as tick}
		<line
			x1={scale(tick)}
			x2={scale(tick)}
			y1={margin.top}
			y2={height - margin.bottom}
			class="grid-line"
		/>
	{/each}
{/if}

<style>
	.grid-line {
		stroke: #e5e5e5;
		stroke-width: 1px;
		/* stroke-dasharray: 2, 2; */
	}
</style>

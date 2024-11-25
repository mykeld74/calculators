<!-- Labels.svelte -->
<script>
	let {
		width,
		height,
		margin,
		label,
		yoffset,
		xoffset,
		labelforx = 'Money',
		labelfory = true,
		textanchor = 'end'
	} = $props();
</script>

{#if width}
	<g class="labels-x-y text-sm">
		{#if labelforx}
			<text
				fill="white"
				x={+margin.left + width - 5 + xoffset}
				y={+height + margin.top - 40 + yoffset}
				text-anchor={textanchor}>{label}</text
			>
		{/if}
		{#if labelfory}
			<text
				fill="white"
				x={+margin.left + xoffset}
				y={-margin.top + 80 + yoffset}
				text-anchor={textanchor}>{label}</text
			>
		{/if}
	</g>
{/if}

<style>
</style>

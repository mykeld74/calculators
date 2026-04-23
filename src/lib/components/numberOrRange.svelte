<script>
	import { getContext } from 'svelte';

	let {
		id,
		value = $bindable(),
		min,
		max,
		step,
		disabled = false
	} = $props();

	const isMobileStore = getContext('isMobile');
	let isMobile = $state(false);
	isMobileStore?.subscribe((v) => {
		isMobile = v;
	});
</script>

{#if isMobile}
	<input type="number" {id} bind:value {min} {max} {step} {disabled} />
{:else}
	<input type="range" {id} bind:value {min} {max} {step} {disabled} />
{/if}

<script>
	let { children, class: CLASS, ...props } = $props();
</script>

<button class="btn {CLASS}" {...props}>{@render children()}</button>

<style>
	.btn {
		width: 150px;
		height: 40px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: 5px;
		background: steelblue;
		color: white;
		font-size: 20px;
		cursor: pointer;
	}
</style>

<script>
	import Searchbar from '@components/Searchbar.svelte';
	export let title;
</script>

<div class="flex justify-between items-center px-8 py-6 ">
	<h1>{title}</h1>
	<Searchbar />
</div>

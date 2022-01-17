<script>
	import { login } from '@stores/spotify.js';
</script>

<nav class="flex justify-between items-center px-8 py-6">
	<a class="inline-block" href="/">make it pop</a>
	<div class="inline-block">
		<button class="pl-3" on:click={login}>connect</button>
		<a class="pl-3" href="/info">info</a>
	</div>
</nav>

<script>
	import '../styles/global-output.css';
	import Nav from '../components/Nav.svelte';
	import { deviceSettings } from '@stores/spotify';
	$: {
		console.log('DEVICE SETTINGS CHANGE', $deviceSettings);
	}
</script>

{#if !$deviceSettings['active']}
	<div class="fixed w-screen h-screen left-0 top-0 flex bg-black/50 items-center justify-center">
		<h1 class="text-white text-3xl text-center font-bold uppercase">
			choose the right device to continue
		</h1>
	</div>
{/if}

<Nav />
<slot />

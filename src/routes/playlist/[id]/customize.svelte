<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { videosData, videoPlaylistLength } from '@stores/visualizerStore.js';
	import { cameraMode, cameraStream, customVideos } from '@stores/cameraStore.js';
	import ThreeScene from '@utils/threeScene.svelte';

	const { params } = $page;
	const { id: playlistId } = params;

	let searchTerm = '';
	let searching = false;
	let cameraVideo;
	let stream = null;
	let inputEl;

	onMount(async () => {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user' },
				audio: false
			});
			if (cameraVideo) {
				cameraVideo.srcObject = stream;
				cameraVideo.play().catch(() => {});
			}
		} catch (e) {
			console.log('camera error', e);
		}
	});

	onDestroy(() => {
		if (stream && !$cameraMode) {
			stream.getTracks().forEach(t => t.stop());
		}
	});

	async function handleSearch() {
		if (!searchTerm.trim()) return;
		searching = true;
		const { fetchVideos } = await import('@utils/videoAPI');
		const result = await fetchVideos(searchTerm);
		videosData.set(result);
		videoPlaylistLength.set(result?.videos?.length ?? 0);
		searching = false;
		cameraMode.set(false);
		customVideos.set(true);
		goto(`/playlist/${playlistId}`);
	}

	function useCamera() {
		cameraStream.set(stream);
		cameraMode.set(true);
		customVideos.set(true);
		goto(`/playlist/${playlistId}`);
	}
</script>

<svelte:head>
	<style>
		body { overflow: hidden; background: black; }
		input::placeholder { color: rgba(255,255,255,0.4); }
	</style>
</svelte:head>

<!-- Hidden camera video fed to ThreeScene -->
<video
	bind:this={cameraVideo}
	playsinline
	muted
	style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; object-fit: cover; z-index: 0; visibility: hidden;"
/>

{#if cameraVideo}
	<ThreeScene video={cameraVideo} />
{/if}

<!-- Dark overlay -->
<div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.4); z-index: 1; pointer-events: none;"></div>

<!-- Back button — same position as nav -->
<a
	href={`/playlist/${playlistId}`}
	style="position: fixed; top: 1.5rem; left: 2rem; z-index: 3; color: white; font-size: 1rem; text-decoration: none;"
>back</a>

<!-- Search title + button — same position as playlist name + play button -->
<div style="position: fixed; top: 5rem; left: 2rem; z-index: 3; display: flex; flex-direction: column; gap: 24px;">
	<!-- Input styled like playlist name with blinking caret -->
	<div style="position: relative; display: flex; align-items: center;">
		<input
			bind:this={inputEl}
			bind:value={searchTerm}
			on:keydown={(e) => e.key === 'Enter' && handleSearch()}
			type="text"
			placeholder="VIDEOS"
			style="background: transparent; border: none; outline: none; color: white; font-size: 1.8rem; text-transform: uppercase; letter-spacing: 0.05em; font-family: inherit; width: 100%; caret-color: white;"
		/>
	</div>

	<!-- Search button — circle, same style as play -->
	<button
		on:click={handleSearch}
		style="width: 8rem; height: 8rem; border-radius: 50%; border: 2px solid white; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); color: white; font-size: 1rem; line-height: 115%; cursor: pointer; align-self: flex-start; white-space: pre-line;"
	>{searching ? '...' : 'search\nvideos'}</button>
</div>

<!-- Use camera — bottom right, same circle style -->
<button
	on:click={useCamera}
	style="position: fixed; bottom: 2rem; right: 2rem; z-index: 3; width: 8rem; height: 8rem; border-radius: 50%; border: 2px solid white; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); color: white; font-size: 1rem; line-height: 115%; cursor: pointer; white-space: pre-line;"
>use<br>camera</button>

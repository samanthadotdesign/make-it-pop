<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { videosData, videoPlaylistLength } from '@stores/visualizerStore.js';
	import { cameraMode, cameraStream } from '@stores/cameraStore.js';
	import ThreeScene from '@utils/threeScene.svelte';

	const { params } = $page;
	const { id: playlistId } = params;

	let searchTerm = '';
	let searching = false;
	let cameraVideo;
	let stream = null;

	onMount(async () => {
		// Start front-facing camera immediately as background
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
		// Stop camera if navigating away without selecting it
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
		// Disable camera mode when new videos are searched
		cameraMode.set(false);
		goto(`/playlist/${playlistId}`);
	}

	function useCamera() {
		// Store the stream globally and enable camera mode
		cameraStream.set(stream);
		cameraMode.set(true);
		goto(`/playlist/${playlistId}`);
	}
</script>

<svelte:head>
	<style>body { overflow: hidden; background: black; }</style>
</svelte:head>

<!-- Hidden video element fed to ThreeScene as background -->
<video
	bind:this={cameraVideo}
	playsinline
	muted
	style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; object-fit: cover; z-index: 0; visibility: hidden;"
/>

<!-- ThreeScene uses the camera as texture with distortion -->
{#if cameraVideo}
	<ThreeScene video={cameraVideo} />
{/if}

<!-- Dark overlay -->
<div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.4); z-index: 1; pointer-events: none;"></div>

<!-- Back button -->
<a
	href={`/playlist/${playlistId}`}
	style="position: fixed; top: 1.5rem; left: 2rem; z-index: 3; color: white; font-size: 1rem; text-decoration: none;"
>back</a>

<!-- UI controls -->
<div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 6rem 2rem 4rem; gap: 3rem; z-index: 2; pointer-events: none;">

	<!-- Search videos -->
	<div style="display: flex; flex-direction: column; gap: 1rem; width: 100%; pointer-events: all;">
		<h2 style="color: white; font-size: 1.8rem; text-transform: lowercase; margin: 0;">videos</h2>
		<div style="display: flex; gap: 0.75rem; align-items: center;">
			<input
				type="text"
				placeholder="find a mood"
				bind:value={searchTerm}
				on:keydown={(e) => e.key === 'Enter' && handleSearch()}
				style="flex: 1; padding: 0.6rem 1rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; color: white; font-size: 1rem; outline: none;"
			/>
			<button
				on:click={handleSearch}
				style="padding: 0.6rem 1.2rem; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.4); border-radius: 4px; color: white; font-size: 1rem; cursor: pointer;"
			>{searching ? '...' : 'search'}</button>
		</div>
	</div>

	<!-- Use camera button -->
	<button
		on:click={useCamera}
		style="pointer-events: all; width: 8rem; height: 8rem; border-radius: 50%; border: 1px solid rgba(255,255,255,0.6); background: rgba(255,255,255,0.1); color: white; font-size: 0.9rem; cursor: pointer; align-self: flex-end;"
	>use<br>camera</button>
</div>

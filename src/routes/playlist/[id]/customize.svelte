<script>
	import { page } from '$app/stores';
	import { videosData, videoPlaylistLength } from '@stores/visualizerStore.js';

	const { params } = $page;
	const { id: playlistId } = params;

	let searchTerm = '';
	let cameraStream = null;
	let videoEl;
	let usingCamera = false;
	let searching = false;

	async function handleSearch() {
		if (!searchTerm.trim()) return;
		searching = true;
		const { fetchVideos } = await import('@utils/videoAPI');
		const result = await fetchVideos(searchTerm);
		videosData.set(result);
		videoPlaylistLength.set(result?.videos?.length ?? 0);
		searching = false;
	}

	async function startCamera() {
		try {
			cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
			usingCamera = true;
			if (videoEl) {
				videoEl.srcObject = cameraStream;
				videoEl.play();
			}
		} catch (e) {
			console.log('camera error', e);
		}
	}

	function stopCamera() {
		if (cameraStream) {
			cameraStream.getTracks().forEach(t => t.stop());
			cameraStream = null;
		}
		usingCamera = false;
	}
</script>

<svelte:head>
	<style>body { overflow: hidden; background: black; }</style>
</svelte:head>

<!-- Back button -->
<a
	href={`/playlist/${playlistId}`}
	style="position: fixed; top: 1.5rem; left: 2rem; z-index: 3; color: white; font-size: 1rem; text-decoration: none;"
>back</a>

<!-- Main content -->
<div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 6rem 2rem 4rem; gap: 3rem; z-index: 2;">

	<!-- Search videos -->
	<div style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
		<h2 style="color: white; font-size: 1.8rem; text-transform: lowercase; margin: 0;">videos</h2>
		<div style="display: flex; gap: 0.75rem; align-items: center;">
			<input
				type="text"
				placeholder="find a mood"
				bind:value={searchTerm}
				on:keydown={(e) => e.key === 'Enter' && handleSearch()}
				style="flex: 1; padding: 0.6rem 1rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; color: white; font-size: 1rem; outline: none; backdrop-filter: blur(4px);"
			/>
			<button
				on:click={handleSearch}
				style="padding: 0.6rem 1.2rem; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.4); border-radius: 4px; color: white; font-size: 1rem; cursor: pointer; backdrop-filter: blur(4px);"
			>{searching ? '...' : 'search'}</button>
		</div>
	</div>

	<!-- Camera input -->
	<div style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
		{#if !usingCamera}
			<button
				on:click={startCamera}
				style="width: 8rem; height: 8rem; border-radius: 50%; border: 1px solid rgba(255,255,255,0.6); background: rgba(255,255,255,0.1); backdrop-filter: blur(4px); color: white; font-size: 0.9rem; cursor: pointer; align-self: flex-end;"
			>use<br>camera</button>
		{:else}
			<div style="position: relative; width: 100%; max-width: 360px; align-self: flex-end;">
				<video
					bind:this={videoEl}
					autoplay
					playsinline
					muted
					style="width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"
				></video>
				<button
					on:click={stopCamera}
					style="position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.4); border-radius: 4px; color: white; padding: 0.3rem 0.6rem; font-size: 0.8rem; cursor: pointer;"
				>stop</button>
			</div>
		{/if}
	</div>
</div>

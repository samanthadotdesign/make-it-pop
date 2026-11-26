<script>
	import RecordView from '@components/Playlist/RecordView.svelte';
	import { shelfRecords } from '@utils/shelfCatalog.js';
</script>

<svelte:head>
	<title>make it pop</title>
</svelte:head>

<main>
	<RecordView items={shelfRecords} />
</main>

<script context="module">
	import { shelfRecords } from '@utils/shelfCatalog.js';

	export function load({ params, url }) {
		const record = shelfRecords.find(({ id }) => id === params.id);
		if (!record) return { status: 404, error: 'Record not found' };
		return { props: { record, autoplay: url.searchParams.get('play') === '1' } };
	}
</script>

<script>
	import ListeningRoom from '@components/Playlist/ListeningRoom.svelte';

	export let record;
	export let autoplay;
</script>

<ListeningRoom initialRecord={record} {autoplay} />

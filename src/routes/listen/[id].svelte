<script context="module">
	import { shelfRecords } from '@utils/shelfCatalog.js';

	export function load({ params }) {
		const record = shelfRecords.find(({ id }) => id === params.id);
		if (!record) return { status: 404, error: 'Record not found' };
		return {};
	}
</script>

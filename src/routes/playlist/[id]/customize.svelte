<script context="module">
	import { base } from '$app/paths';
	import { shelfRecords } from '@utils/shelfCatalog.js';

	export function load({ params }) {
		const record = shelfRecords.find(({ id }) => id === params.id);
		return { status: 302, redirect: record ? `${base}${record.path}` : `${base}/` };
	}
</script>

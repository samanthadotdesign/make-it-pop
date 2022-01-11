export async function fetchVideos(searchTerm) {

	const videosUrl = `https://api.pexels.com/videos/search?query=${searchTerm}&per_page=20`;
	
	return await fetch(videosUrl, {
		method: 'GET',
		headers: {
			Authorization: import.meta.env.VITE_PEXELS_API_KEY,
			'Content-Type': 'application/json'
		}
	}).then(async (response)=>{
		return await response.json()
	}).catch((error)=>{
		return {error}
	})

}
import audioFiles from './recordAudio.json';

const cc0 = { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };

export const recordAlbums = [
	{
		id: 'public-domain-lo-fi-2',
		name: 'Public Domain Lo-Fi 2',
		artist: 'Holizna',
		year: 2026,
		color: '#cab660',
		source: 'https://holiznacc0.bandcamp.com/album/public-domain-lo-fi-2',
		missingTrackSource: 'https://holiznacc0.bandcamp.com/track/youre-nature',
		license: cc0,
		trackNames: [
			'Cold (Salt) Water',
			'Currents We Used To Know',
			"I Don't Understand A Thing",
			'Ocean Memory',
			'Washed Up',
			'Feeling Human Again',
			'Foley Of Man',
			'Hope On Repeat',
			'Seasonal Depression',
			'Spring In Sight',
			'Toy Box',
			'August Never Lasts',
			'Faded In Sunlight',
			'Roof Tops',
			'Summer Felt Longer Then',
			'The Last Long Day',
			'Kitsune',
			'Kodama',
			'Tanuki',
			'Tengu',
			'Tsukumogami',
			'Yuki-onna',
			"You're Nature"
		]
	},
	{
		id: 'to-chill-and-stay-awake',
		name: 'To Chill and Stay Awake',
		artist: 'Loyalty Freak Music',
		year: 2017,
		color: '#e99a72',
		source: 'https://loyaltyfreakmusic.com/music/to-chill-and-stay-awake/',
		license: cc0,
		trackNames: [
			'Coexistenz',
			'Everyone',
			'Chillin with a drink at the club',
			'You know why',
			'Traveling in your mind',
			'People are spinning',
			'Monarch of the street'
		]
	},
	{
		id: 'ashes',
		name: 'Ashes',
		artist: 'Josh Woodward',
		year: 2010,
		color: '#cf8b8b',
		source: 'https://freemusicarchive.org/music/Josh_Woodward/Ashes/',
		license: { name: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
		trackNames: [
			'Let It In',
			'Cherubs',
			'Infinite Horizon',
			'A Thousand Skins (Part 2)',
			"The Handyman's Lament",
			'Anchor',
			'Already There',
			'Together On Our Own',
			'Pompeii',
			'Swimming in Turpentine',
			'A Thousand Skins (Part 1)',
			'Motionless Land'
		]
	},
	{
		id: 'open-goldberg-variations',
		name: 'The Open Goldberg Variations',
		artist: 'Kimiko Ishizaka',
		year: 2012,
		color: '#9fb2d1',
		source: 'https://opengoldbergvariations.org/',
		credit: 'Composed by Johann Sebastian Bach',
		license: cc0,
		trackNames: [
			'Aria',
			'Variatio 1 a 1 Clav.',
			'Variatio 2 a 1 Clav.',
			'Variatio 3 a 1 Clav. Canone all’Unisuono',
			'Variatio 4 a 1 Clav.',
			'Variatio 5 a 1 ovvero 2 Clav.',
			'Variatio 6 a 1 Clav. Canone alla Seconda',
			'Variatio 7 a 1 ovvero 2 Clav.',
			'Variatio 8 a 2 Clav.',
			'Variatio 9 a 1 Clav. Canone alla Terza',
			'Variatio 10 a 1 Clav. Fughetta',
			'Variatio 11 a 2 Clav.',
			'Variatio 12 Canone alla Quarta',
			'Variatio 13 a 2 Clav.',
			'Variatio 14 a 2 Clav.',
			'Variatio 15 a 1 Clav. Canone alla Quinta',
			'Variatio 16 a 1 Clav. Ouverture',
			'Variatio 17 a 2 Clav.',
			'Variatio 18 a 1 Clav. Canone alla Sexta',
			'Variatio 19 a 1 Clav.',
			'Variatio 20 a 2 Clav.',
			'Variatio 21 Canone alla Settima',
			'Variatio 22 a 1 Clav.',
			'Variatio 23 a 2 Clav.',
			'Variatio 24 a 1 Clav. Canone all’Ottava',
			'Variatio 25 a 2 Clav.',
			'Variatio 26 a 2 Clav.',
			'Variatio 27 a 2 Clav. Canone alla Nona',
			'Variatio 28 a 2 Clav.',
			'Variatio 29 a 1 ovvero 2 Clav.',
			'Variatio 30 a 1 Clav. Quodlibet',
			'Aria da Capo è Fine'
		]
	},
	{
		id: 'point-of-no-return',
		name: 'Point of No Return',
		artist: 'Cutside',
		year: 2017,
		color: '#a5ba93',
		source: 'https://blocsonic.com/releases/cutside/point-of-no-return/',
		credit: 'Released by blocSonic',
		license: {
			name: 'CC BY-NC-SA 4.0 · Noncommercial',
			url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
		},
		trackNames: [
			'Welcome to Reality (featuring Unkle Rasta aka Rasta Cee)',
			'Shivering Shadows (featuring Viktor Van River)',
			'Dances with the Rain',
			'Tuman (featuring Sgt. Penarlaster)',
			'Message for Us',
			'Solaris (featuring Lion from Struggle Crew)',
			'Greenlight',
			'Amaterasu',
			'Temple (Part III)',
			'From Then to Now (Outro)',
			'Little Heart (Bonus Track)'
		]
	}
].map(({ trackNames, ...album }) => ({
	...album,
	path: `/albums/${album.id}`,
	tracks: trackNames.map((title, index) => ({
		title,
		src: audioFiles[album.id]?.[index + 1] ?? null
	}))
}));

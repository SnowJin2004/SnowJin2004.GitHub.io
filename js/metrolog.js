// Default zoom levels
const DEFAULT_BOUNDS = [[-100, -100], [100, 100]];
const DEFAULT_IMAGE = '';
const DEFAULT_ZOOM = 2;
const DEFAULT_MAX_ZOOM = 4;
const DEFAULT_MIN_ZOOM = 1;

// Map configurations with only essential inputs
const mapConfigs = [
	{ name: 'Shanghai', label: '上海', bounds: [[520, -1220], [-940, 1120]], image: 'img/fp-Shanghai.webp', maxZoom: 10, minZoom: 2 },
	{ name: 'Nanjing', label: '南京' },
	{ name: 'Suzhou', label: '苏州' },
	{ name: 'Jiaxing', label: '嘉兴', bounds: [[-20, -40], [100, 60]], image: 'img/fp-Jiaxing.webp' },
	{ name: 'Guangzhou', label: '广州' },
	{ name: 'Singapore', label: '新加坡', bounds: [[380, -540], [-160, 360]], image: 'img/fp-Singapore.webp' },
	{ name: 'Barcelona', label: '巴塞罗那', bounds: [[430, 0], [-1160, 1490]], image: 'img/fp-Barcelona.webp', minZoom: 3 },
	{ name: 'Budapest', label: '布达佩斯', bounds: [[-230, -180], [190, 270]], image: 'img/fp-Budapest.webp', maxZoom: 4 },
	{ name: 'London', label: '伦敦' },
	{ name: 'Manchester', label: '曼彻斯特' },
	{ name: 'TyneAndWear', label: '纽卡斯尔' },
	{ name: 'Sheffield', label: '谢菲尔德' },
	{ name: 'Nottingham', label: '诺丁汉' },
	{ name: 'Blackpool', label: '黑谭' },
	{ name: 'Edinburgh', label: '爱丁堡', bounds: [[-80, -220], [50, 10]], image: 'img/fp-Edinburgh.webp', minZoom: 1, maxZoom: 4 },
	{ name: 'Glasgow', label: '格拉斯哥', bounds: [[120, -180], [-80, 40]], image: 'img/fp-Glasgow.webp', maxZoom: 12 },
];
// Generate HTML dynamically
const mapBtnContainer = document.querySelector('.mapBtn');
const mapAreaContainer = document.querySelector('.mapArea');

mapConfigs.forEach((config, index) => {
	const id = `map_fp${config.name}`;
	const mapId = `map${config.name}`;

	// Add navigation tab
	const li = document.createElement('li');
	li.textContent = config.label;
	li.setAttribute('data-target', id);
	if (index === 0) li.classList.add('on'); // Set the first tab as active by default
	mapBtnContainer.appendChild(li);

	// Add map container
	const div = document.createElement('div');
	div.className = `imageBox${index === 0 ? ' active' : ''}`; // Set the first map as active by default
	div.id = id;
	div.innerHTML = `<div id="${mapId}" style="width: 100%; height: 100%;"></div>`;
	mapAreaContainer.appendChild(div);
});

// Initialize maps dynamically
const maps = {};
mapConfigs.forEach(config => {
	const id = `map_fp${config.name}`;
	const mapId = `map${config.name}`;
	const zoom = config.zoom || DEFAULT_ZOOM;
	const bounds = config.bounds || DEFAULT_BOUNDS;
	const image = config.image || DEFAULT_IMAGE;
	const maxZoom = config.maxZoom || DEFAULT_MAX_ZOOM;
	const minZoom = config.minZoom || DEFAULT_MIN_ZOOM;

	// Create the Leaflet map
	const map = L.map(mapId, {
		crs: L.CRS.Simple,
		center: [0, 0],
		zoom: zoom,
		maxBounds: bounds,
		maxZoom: maxZoom,
		minZoom: minZoom,
	}).fitBounds(bounds);

	// Add the image overlay to the map
	L.imageOverlay(image, bounds).addTo(map);

	// Remove the default Leaflet attribution
	map.attributionControl.setPrefix('');

	// Store the map instance for later use
	maps[id] = map;
});

// Tab switching logic
document.querySelectorAll('.mapBtn li').forEach(tab => {
	tab.addEventListener('click', () => {
		// Remove active state from all tabs
		document.querySelectorAll('.mapBtn li').forEach(t => t.classList.remove('on'));

		// Add active state to the clicked tab
		tab.classList.add('on');

		// Hide all map containers
		document.querySelectorAll('.imageBox').forEach(box => box.classList.remove('active'));

		// Show the target map container
		const targetId = tab.getAttribute('data-target');
		document.getElementById(targetId).classList.add('active');

		// Invalidate the size of the visible map to ensure it renders correctly
		if (maps[targetId]) {
			maps[targetId].invalidateSize();
		}
	});
});
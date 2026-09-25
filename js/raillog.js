// Default zoom levels
const DEFAULT_MAX_ZOOM = 8;
const DEFAULT_MIN_ZOOM = 0;

// Map configurations with zoom-specific logic
const mapConfigs = [
    {
        name: 'CR',
        label: '中国铁路',
        bounds: [[-800, -840], [80, 70]],
        image: 'img/fp-CR.webp',
    },
    {
        name: 'NR',
        label: '英国铁路',
        bounds: [[910, -480], [-140, 180]],
        image: 'img/fp-NR.webp',
        zoomLogic: {
            threshold: 3,
            images: [
                {
                    url: 'img/fp-NR-ayr.webp',
                    bounds: [[629.6713, -433.601], [596.5142, -407.4585]],
                },
                {
                    url: 'img/fp-NR-chatham.webp',
                    bounds: [[-0.4409, 33.8183], [-26.6665, 60.0581]],
                },
                {
                    url: 'img/fp-NR-gartforth.webp',
                    bounds: [[360.497, -138.3309], [334.8301, -112.3375]],
                },
                {
                    url: 'img/fp-NR-glasgow.webp',
                    bounds: [[714.8301, -457.5284], [640.4809, -277.7091]],
                },
                {
                    url: 'img/fp-NR-manchester.webp',
                    bounds: [[345.4182, -284.8592], [268.1239, -179.4929]],
                },
            ],
        },
    },
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
    const maxZoom = config.maxZoom || DEFAULT_MAX_ZOOM;
    const minZoom = config.minZoom || DEFAULT_MIN_ZOOM;

    // Create the Leaflet map
    const map = L.map(mapId, {
        crs: L.CRS.Simple,
        maxBounds: config.bounds,
        maxZoom: maxZoom,
        minZoom: minZoom,
    }).fitBounds(config.bounds);

    // Add the image overlay to the map
    L.imageOverlay(config.image, config.bounds).addTo(map);

    // Remove the default Leaflet attribution
    map.attributionControl.setPrefix('');

    // Handle zoom-specific logic if defined
    if (config.zoomLogic) {
        const { threshold, images } = config.zoomLogic;
        const overlays = images.map(image => ({
            ...image,
            overlay: null,
        }));

        map.on('zoom', () => {
            const currentZoom = map.getZoom();

            overlays.forEach(image => {
                if (currentZoom >= threshold) {
                    if (!image.overlay) {
                        image.overlay = L.imageOverlay(image.url, image.bounds).addTo(map);
                    }
                } else {
                    if (image.overlay) {
                        map.removeLayer(image.overlay);
                        image.overlay = null;
                    }
                }
            });
        });
    }

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
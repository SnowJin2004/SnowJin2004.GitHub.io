const fpCR = L.tileLayer('', {});
const fpNR = L.tileLayer('', {});

const CRbounds = [[-800, -840], [80, 70]];
const CRimage = L.imageOverlay('img/fp-CR.webp', CRbounds);

const NRbounds = [[790, -480], [-140, 180]];
const NRimage = L.imageOverlay('img/fp-NR.webp', NRbounds);

const map = L.map('map', {
	crs: L.CRS.Simple,
	layers: [fpCR],
	maxBounds: CRbounds,
	maxZoom: 8,
});

const options = {
	position: "tbottomright", // toolbar position, options are 'topleft', 'topright', 'bottomleft', 'bottomright'
	drawMarker: true, // adds button to draw markers
};

const NRenlargeImages = [
	// [-Y, X]
	{
		url: 'img/fp-NR-London.webp',
		bounds: [[65, -110], [-110, 105]],
		overlay: null // Placeholder for the overlay instance
	},{
		url: 'img/fp-NR-Manchester.webp',
		bounds: [[336.25, -277.65], [278.75, -175]],
		overlay: null
	},
	{
		url: 'img/fp-NR-Glasgow.webp',
		bounds: [[718.75, -448.75], [605, -285]],
		overlay: null
	}
];

const baseMaps = {
	"中国铁路": fpCR,
	"英国铁路": fpNR
};

const layerControl = L.control.layers(baseMaps).addTo(map);

map.on('baselayerchange', function (e) {
	if (e.name === "中国铁路") {
		map.fitBounds(CRbounds);
		map.setMaxBounds(CRbounds);
		map.setMaxZoom(4);
		map.addLayer(CRimage);
	} else if (e.name === "英国铁路") {
		map.fitBounds(NRbounds);
		map.setMaxBounds(NRbounds);
		map.setMaxZoom(7);
		map.addLayer(NRimage);
	}

	if (e.name !== "中国铁路") {
		map.removeLayer(CRimage)
	} else if (e.name !== "英国铁路") {
		map.removeLayer(NRimage);
		NRenlargeImages.forEach(image => {
			if (image.overlay) {
				map.removeLayer(image.overlay);
				image.overlay = null;
			}
		});
	}
});

map.on('zoom', () => {
	const currentZoom = map.getZoom();

	NRenlargeImages.forEach(image => {
		if (map.hasLayer(fpNR)) {
			if (currentZoom >= 3) {
				if (!image.overlay) {
					image.overlay = L.imageOverlay(image.url, image.bounds).addTo(map);
				}
			} else {
				if (image.overlay) {
					map.removeLayer(image.overlay);
					image.overlay = null;
				}
			}
		}
	});
});

map.fitBounds(CRbounds);

map.attributionControl.setPrefix('');

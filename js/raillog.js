const fpCR = L.tileLayer('', {});
const fpNR = L.tileLayer('', {});

const CRbounds = [[-800, -840], [80, 70]];
const CRimage = L.imageOverlay('img/fp-CR.webp', CRbounds);

const NRbounds = [[910, -480], [-140, 180]];
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
	// [左上，右下]，[-Y, X]
	{
		url: 'img/fp-NR-ayr.webp',
		bounds: [[629.6713, -433.601], [596.5142, -407.4585]],
		overlay: null
	},{
		url: 'img/fp-NR-chatham.webp',
		bounds: [[-0.4409, 33.8183], [-26.6665, 60.0581]],
		overlay: null
	},{
		url: 'img/fp-NR-gartforth.webp',
		bounds: [[360.497, -138.3309], [334.8301, -112.3375]],
		overlay: null
	},{
		url: 'img/fp-NR-glasgow.webp',
		bounds: [[714.8301, -457.5284], [640.4809, -277.7091]],
		overlay: null
	},{
		url: 'img/fp-NR-manchester.webp',
		bounds: [[345.4182, -284.8592], [268.1239, -179.4929]],
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

const fpShanghai = L.tileLayer('', {});
const fpSingapore = L.tileLayer('', {});
const fpGlasgow = L.tileLayer('', {});
const fpBarcelona = L.tileLayer('', {});

const Shanghaibounds = [[520, -1220], [-940, 1120]];
const Shanghaiimage = L.imageOverlay('img/fp-Shanghai.webp', Shanghaibounds);

const Singaporebounds = [[380, -540], [-160, 360]];
const Singaporeimage = L.imageOverlay('img/fp-Singapore.webp', Singaporebounds);

const Glasgowbounds = [[120, -180], [-80, 40]];
const Glasgowimage = L.imageOverlay('img/fp-Glasgow.webp', Glasgowbounds);

const Barcelonabounds = [[430, 0], [-1160, 1490]];
const Barcelonaimage = L.imageOverlay('img/fp-Barcelona.webp', Barcelonabounds);

const map = L.map('map', {
	crs: L.CRS.Simple,
	layers: [fpShanghai],
	maxBounds: Shanghaibounds,
	maxZoom: 4,
});

const options = {
	position: "tbottomright", // toolbar position, options are 'topleft', 'topright', 'bottomleft', 'bottomright'
	drawMarker: true, // adds button to draw markers
};

const baseMaps = {
	"上海": fpShanghai,
	"新加坡": fpSingapore,
	"格拉斯哥": fpGlasgow,
	"巴塞罗那": fpBarcelona
};

const layerControl = L.control.layers(baseMaps).addTo(map);

map.on('baselayerchange', function (e) {
	map.removeLayer(Shanghaiimage);
	map.removeLayer(Singaporeimage);
	map.removeLayer(Glasgowimage);
	map.removeLayer(Barcelonaimage);

	if (e.name === "上海") {
		map.fitBounds(Shanghaibounds);
		map.setMaxBounds(Shanghaibounds);
		map.setMinZoom(-1);
		map.addLayer(Shanghaiimage);
		map.setView([-1.1431, 0.4574]);
	} else if (e.name === "新加坡") {
		map.fitBounds(Singaporebounds);
		map.setMaxBounds(Singaporebounds);
		map.setMinZoom(0);
		map.addLayer(Singaporeimage);
	} else if (e.name === "格拉斯哥") {
		map.fitBounds(Glasgowbounds);
		map.setMaxBounds(Glasgowbounds);
		map.setMinZoom(1);
		map.addLayer(Glasgowimage);
	} else if (e.name === "巴塞罗那") {
		map.fitBounds(Barcelonabounds);
		map.setMaxBounds(Barcelonabounds);
		map.setMinZoom(-1);
		map.addLayer(Barcelonaimage);
	}
});

map.fitBounds(Shanghaibounds);

map.attributionControl.setPrefix('');

const map = L.map('map', { worldCopyJump: true }).setView([35, 57.5], 3);
const mtLayer = L.maptiler.maptilerLayer({
	apiKey: "VZpKyiwtn3lKpsQyX1q3",
	style: "0196a77a-0a22-7d58-aaf2-16585ce4913c",
}).addTo(map);

const flightPolylineMap = {}; // Define flightPolylineMap globally to store flight data

function toLatLng(coords) {
	if (!Array.isArray(coords) || coords.length === 0) return [];

	return coords.map(segment =>
		Array.isArray(segment[0])
			? segment.map(([lng, lat]) => [lat, lng])
			: [segment[1], segment[0]]
	);
}

fetch('../asset/airport.json')
	.then(response => response.json())
	.then(airports => {
		const airportMarkerMap = {};
		const dynamicStyle = document.createElement("style");
		document.head.appendChild(dynamicStyle);

		function setAirportActive(iata) {
			dynamicStyle.textContent = iata
				? `.airport { font-weight: 350; color: var(--grey_1); }
                    .${iata} { font-weight: 600; color: inherit; }`
				: '';

			// Update flight polyline transparency based on active airport
			Object.values(flightPolylineMap).forEach(({ polyline, from, to }) => {
				if (iata && (from === iata || to === iata)) {
					polyline.setStyle({ opacity: 1 }); // Show associated flights
				} else if (iata) {
					polyline.setStyle({ opacity: 0.25 }); // Hide unrelated flights
				} else {
					polyline.setStyle({ opacity: 1 }); // Reset all flights to full opacity
				}
			});
		}

		airports.forEach(airport => {
			const icon = L.icon({
				iconUrl: `../img/transp/air/${airport.icon ?? airport.iata}.png`,
				iconSize: [32, 32],
				iconAnchor: [16, 16],
				popupAnchor: [0, -24]
			});

			const marker = L.marker([airport.lat, airport.lng], { icon }).addTo(map);
			marker.bindPopup(`
                <h2>${airport.iata}/${airport.icao}</h2>
                <table>
                    <tr><th>Name</th><td>${airport.name}</td></tr>
                    <tr><th>Time Zone</th><td>${airport.timezone}</td></tr>
                </table>
            `);

			airportMarkerMap[airport.iata] = marker;

			marker.on("click", () => setAirportActive(airport.iata));
			map.on("click", () => setAirportActive(null));
		});

		document.querySelectorAll(".airport").forEach(el => {
			el.addEventListener("click", () => {
				const iata = [...el.classList].find(cls => cls !== "airport");
				const marker = airportMarkerMap[iata];
				if (marker) {
					map.flyTo(marker.getLatLng(), 7, { animate: true, duration: 1 });
					marker.openPopup();
					setAirportActive(iata);
				}
			});
		});
	})
	.catch(error => console.error('Error loading airport data:', error));


const airlineColors = {
	"BA": "#0032a0",
	"CA": "#d51b1b",
	"CZ": "#008aca",
	"FM": "#e6042e",
	"HO": "#801c39",
	"KL": "#00a1de",
	"MU": "#d1161b",
	"T3": "#262262",
	"U2": "#fe6600",
	"ZQ": "#b8193f"
};

function snake() {
	path.snakeIn();
}

fetch('../asset/flight.json')
	.then(response => response.json())
	.then(flights => {
		flights.forEach(flight => {
			const latlngs = toLatLng(flight.coords);

			const color = airlineColors[flight.airline] || 'gray';

			const popup = `
                        <h2>${flight.number}</h2>
                        <table>
                        <tbody>
                            <tr><th>From</th><td>${flight.from}</td></tr>
                            <tr><th>To</th><td>${flight.to}</td></tr>
                            <tr><th>Date</th><td>${flight.date}</td></tr>
                            <tr><th>Time</th><td>${flight.time}</td></tr>
                        </tbody>
                        </table>`;

			const polyline = L.Wrapped.wrappedPolyline(latlngs, { color: color, weight: 5 }).addTo(map);
			polyline.bindPopup(popup);

			// Store flight data in flightPolylineMap
			flightPolylineMap[flight.number + flight.date] = { polyline, from: flight.from, to: flight.to };

			polyline.on('mouseover', () => {
				polyline.setStyle({ weight: 7.5 });
			});

			polyline.on('mouseout', () => {
				polyline.setStyle({ weight: 5 });
			});

			// polyline.on('click', () => {
			// 	if (map.getZoom() <= 3) {
			// 		polyline.setStyle({ snakingSpeed: 200 });
			// 		polyline.snakeIn();
			// 	} else if (map.getZoom() <= 4) {
			// 		polyline.setStyle({ snakingSpeed: 400 });
			// 		polyline.snakeIn();
			// 	} else if (map.getZoom() <= 5) {
			// 		polyline.setStyle({ snakingSpeed: 600 });
			// 		polyline.snakeIn();
			// 	}
			// });
		});
	})
	.catch(error => console.error('Error loading flight data:', error));

fetch('../asset/flightOOC.json')
	.then(response => response.json())
	.then(flights => {
		flights.forEach(flight => {
			if (flight.length === 2) {
				const [startRaw, endRaw] = flight;

				const start = [startRaw[1], startRaw[0]];
				const end = [endRaw[1], endRaw[0]];

				L.Polyline.Arc(start, end, { color: "#fff", weight: 5, zIndexOffset: -100 }).addTo(map);
			} else {
				console.warn("Invalid flight format:", flight);
			}
		});
	})
	.catch(error => console.error('Error loading flight data:', error));

map.attributionControl.setPrefix('');
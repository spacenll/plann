const GITHUB_USER = 'spacenll'; 
const GITHUB_REPO = 'plann';      

const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20 });
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20 });
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{y}/{x}{r}.png', { maxZoom: 20 });

const labelLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    opacity: 0.9 
});

const map = L.map('map', {
    center: [17.0151, 54.0924],
    zoom: 13,
    layers: [satelliteLayer, labelLayer]
});

const baseMaps = {
    "القمر الصناعي + مسميات": L.layerGroup([satelliteLayer, labelLayer]),
    "خريطة الشوارع": streetLayer,
    "الوضع الليلي": darkLayer
};

L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

const landsGroup = L.layerGroup().addTo(map);
const allLandsLayers = [];

document.getElementById("searchBtn").addEventListener("click", runSearch);
document.getElementById("clearSearch").addEventListener("click", clearSearch);

document.getElementById("landSearch").addEventListener("keydown", function(e) {
    if (e.key === "Enter") runSearch();
});

function getKmlMeasurements(layer) {
    let html = '';
    let totalPerimeter = 0;
    let points = [];

    if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
        let latlngs = layer.getLatLngs();
        points = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
    }

    if (points.length > 1) {
        html += `<div class="measurements-box"><h4>الأضلاع:</h4><ul>`;

        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const distance = map.distance(p1, p2);
            totalPerimeter += distance;

            html += `<li>الضلع ${i + 1}: <b>${distance.toFixed(1)} م</b></li>`;
        }

        html += `</ul><div class="total-perimeter">${totalPerimeter.toFixed(1)} م</div></div>`;
    }

    return html;
}

function runSearch() {

    const landNumber = document.getElementById("landSearch").value.trim();
    if (!landNumber) return;

    let foundLayer = null;

    allLandsLayers.forEach(layer => {

        const data = layer.customData;
        if (!data) return;

        const match = String(data.plotNum).includes(landNumber);

        if (match) {

            landsGroup.addLayer(layer);

            if (!foundLayer) foundLayer = layer;

        } else {
            landsGroup.removeLayer(layer);
        }
    });

    if (foundLayer) {

        const bounds = foundLayer.getBounds();

        map.fitBounds(bounds, {
            maxZoom: 18,
            padding: [80, 80]
        });

        map.once("moveend", () => {

            const center = bounds.getCenter();

            L.popup()
                .setLatLng(center)
                .setContent(
                    createPopupContent(
                        foundLayer,
                        foundLayer.customData.plotNum,
                        foundLayer.customData.area,
                        foundLayer.customData.isSold
                    )
                )
                .openOn(map);
        });
    }
}

function clearSearch() {

    document.getElementById("landSearch").value = "";

    allLandsLayers.forEach(layer => {
        landsGroup.addLayer(layer);
    });

    map.setView([17.0151, 54.0924], 13);
}

function createPopupContent(layer, plotNum, area, isSold) {

    if (isSold) {
        return `
            <div class="custom-popup sold-popup">
                <h3>أرض رقم: ${plotNum}</h3>
                <p class="area-text"><b>المساحة :</b> ${area} م²</p>
                <div class="sold-badge">تـم الـبـيـع</div>
            </div>`;
    }

    const measurementsHtml = getKmlMeasurements(layer);

    return `
        <div class="custom-popup">
            <h3>أرض رقم: ${plotNum}</h3>
            <p class="area-text"><b>المساحة :</b> ${area} م²</p>
            ${measurementsHtml}
            <a href="/plann/kmls/img/${plotNum}.jpg" target="_blank" class="kroki-btn">عرض الكروكي</a>
        </div>`;
}

function processAndDisplayLayer(kmlText, plotNum, area, isSold) {

    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(kmlText, 'text/xml');
    const kmlLayer = new L.KML(kmlDom);

    const styleOptions = isSold
        ? { color: '#e74c3c', weight: 3, fillColor: '#c0392b', fillOpacity: 0.6 }
        : { color: '#d4af37', weight: 3, fillColor: '#46306e', fillOpacity: 0.4 };

    const icon = L.icon({
        iconUrl: '/plann/yellow-pin.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    let targetPolygon = null;

    kmlLayer.eachLayer(function(layer) {

        if (layer instanceof L.Marker) {
            kmlLayer.removeLayer(layer);
            return;
        }

        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {

            let points = layer.getLatLngs();
            if (points.length < 3) return;

            const first = points[0];
            const last = points[points.length - 1];

            if (first.lat !== last.lat || first.lng !== last.lng) {
                points.push(first);
            }

            kmlLayer.removeLayer(layer);

            const polygon = L.polygon(points, styleOptions);

            targetPolygon = polygon;

            polygon.customData = { plotNum, area, isSold };

            allLandsLayers.push(polygon);
            landsGroup.addLayer(polygon);

            polygon.on('click', e => {
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent(createPopupContent(polygon, plotNum, area, isSold))
                    .openOn(map);
            });

            kmlLayer.addLayer(polygon);
        }

        if (layer instanceof L.Polygon) {

            layer.setStyle(styleOptions);

            targetPolygon = layer;

            layer.customData = { plotNum, area, isSold };

            allLandsLayers.push(layer);
            landsGroup.addLayer(layer);

            layer.on('click', e => {
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent(createPopupContent(layer, plotNum, area, isSold))
                    .openOn(map);
            });
        }
    });

    if (targetPolygon) {

        const center = targetPolygon.getBounds().getCenter();

        const marker = L.marker(center, { icon });

        marker.on('click', () => {
            marker.bindPopup(
                createPopupContent(targetPolygon, plotNum, area, isSold)
            ).openPopup();
        });

        landsGroup.addLayer(marker);
    }

    return kmlLayer;
}

async function fetchSingleKml(landName, isSold) {

    const folder = isSold ? 'sold_kmls' : 'kmls';

    const fileUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${folder}/${landName}.kml`;

    try {
        const res = await fetch(fileUrl);
        if (!res.ok) return null;

        let kmlText = await res.text();
        kmlText = kmlText.replace(/http:\/\//g, 'https://');

        const parts = landName.split('_');
        const plotNum = parts[0] || 'غير محدد';
        const area = parts[1] || 'غير محدد';

        const layer = processAndDisplayLayer(kmlText, plotNum, area, isSold);
        allLandsLayers.push(...landsGroup.getLayers());

        return layer;

    } catch (err) {
        console.error(err);
        return null;
    }
}

async function handleRoutingAndData() {

    const urlParams = new URLSearchParams(window.location.search);
    const targetLand = urlParams.get('land');

    if (targetLand) {

        let layer = await fetchSingleKml(targetLand, false);
        if (!layer) layer = await fetchSingleKml(targetLand, true);

        if (layer) {
            setTimeout(() => {
                const bounds = layer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { maxZoom: 18, padding: [50, 50] });
                }
            }, 500);
        }

    } else {

        const dbUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/database.json`;

        try {
            const res = await fetch(dbUrl);
            const db = await res.json();

            db.available?.forEach(name => fetchSingleKml(name, false));
            db.sold?.forEach(name => fetchSingleKml(name, true));

        } catch (err) {
            console.error(err);
        }
    }
}

handleRoutingAndData();

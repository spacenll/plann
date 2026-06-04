
const GITHUB_USER = 'spacenll'; 
const GITHUB_REPO = 'plann';      

const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20 });
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20 });
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 });

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

const allLandsLayers = [];

function getKmlMeasurements(layer) {
    let html = '';
    let totalPerimeter = 0;
    let points = [];

    if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
        let latlngs = layer.getLatLngs();
        if (latlngs.length > 0 && Array.isArray(latlngs[0])) {
            points = latlngs[0]; 
        } else {
            points = latlngs;
        }
    }

    if (points.length > 1) {
        html += `<div class="measurements-box">
                    <h4>الأضلاع:</h4>
                    <ul>`;
        
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            if (p1.lat === p2.lat && p1.lng === p2.lng) continue;
            const distance = map.distance(p1, p2);
            totalPerimeter += distance;
            html += `<li>الضلع ${i + 1}: <b>${distance.toFixed(1)} م</b></li>`;
        }
        
        html += `</ul>
                 <div class="total-perimeter">المحيط الإجمالي: ${totalPerimeter.toFixed(1)} متر</div>
                 </div>`;
    } else {
        html += `<div class="measurements-box"><p style="color:#e74c3c; font-size:13px;">لا توجد بيانات قياس.</p></div>`;
    }
    return html;
}


function filterLands() {

    const landNumber = document
        .getElementById("landSearch")
        .value
        .trim();

    allLandsLayers.forEach(layer => {

        const data = layer.customData;

        if (!data) return;

        const match =
            !landNumber ||
            String(data.plotNum).includes(landNumber);

        if (match) {

            if (!map.hasLayer(layer)) {
                map.addLayer(layer);
            }

        } else {

            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    });
}
document
.getElementById("landSearch")
.addEventListener("input", filterLands);

function createPopupContent(layer, plotNum, area, isSold) {
    if (isSold) {
        return `
            <div class="custom-popup sold-popup">
                <h3>أرض رقم: ${plotNum}</h3>
                <p class="area-text"><b>المساحة :</b> ${area} م²</p>
                <div class="sold-badge">تـم الـبـيـع</div>
            </div>`;
    } else {
        const measurementsHtml = getKmlMeasurements(layer);
        const whatsappMsg = encodeURIComponent(`مرحبا، أريد معلومات أكثر عن أرض رقم (${plotNum})`);

return `
    <div class="custom-popup">
        <h3>أرض رقم: ${plotNum}</h3>
        <p class="area-text"><b>المساحة :</b> ${area} م²</p>
        ${measurementsHtml}

        <a href="/plann/kmls/img/${plotNum}.jpg" target="_blank" class="kroki-btn">
            عرض الكروكي 
        </a>
    </div>`;
}
}

function processAndDisplayLayer(kmlText, plotNum, area, isSold) {
    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(kmlText, 'text/xml');
    const kmlLayer = new L.KML(kmlDom);

    let styleOptions = {};
    let labelClass = "";

    if (isSold) {
        styleOptions = { color: '#e74c3c', weight: 3, fillColor: '#c0392b', fillOpacity: 0.6 };
        labelClass = "land-label-sold";
    } else {
        styleOptions = { color: '#d4af37', weight: 3, fillColor: '#46306e', fillOpacity: 0.4 };
        labelClass = "land-label";
    }

    const yellowPinIcon = L.icon({
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

        if (
            first.lat !== last.lat ||
            first.lng !== last.lng
        ) {
            points.push(first);
        }

        kmlLayer.removeLayer(layer);

        const polygon = L.polygon(points, styleOptions);

        targetPolygon = polygon;

        polygon.customData = {
            plotNum,
            area,
            isSold
        };

        allLandsLayers.push(polygon);

        polygon.on('click', function(e) {
            const content = createPopupContent(
                polygon,
                plotNum,
                area,
                isSold
            );

            L.popup()
                .setLatLng(e.latlng)
                .setContent(content)
                .openOn(map);
        });

        kmlLayer.addLayer(polygon);

        return;
    }

    if (layer instanceof L.Polygon) {

        layer.setStyle(styleOptions);

        targetPolygon = layer;

        layer.customData = {
            plotNum,
            area,
            isSold
        };

        allLandsLayers.push(layer);

        layer.on('click', function(e) {
            const content = createPopupContent(
                layer,
                plotNum,
                area,
                isSold
            );

            L.popup()
                .setLatLng(e.latlng)
                .setContent(content)
                .openOn(map);
        });
    }
});

 if (targetPolygon) {

    const centerLatLng =
        targetPolygon.getBounds().getCenter();

    const customMarker = L.marker(
        centerLatLng,
        { icon: yellowPinIcon }
    );

    customMarker.on('click', function() {

        const content = createPopupContent(
            targetPolygon,
            plotNum,
            area,
            isSold
        );

        customMarker.bindPopup(content).openPopup();
    });

    kmlLayer.addLayer(customMarker);
}

    map.addLayer(kmlLayer);
    return kmlLayer;
}

map.on('click', function(e) {
    for (let i = 0; i < allLandsLayers.length; i++) {
        const layer = allLandsLayers[i];
        
   
    }
});

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

        return processAndDisplayLayer(kmlText, plotNum, area, isSold);
    } catch (err) {
        console.error("خطأ في جلب ملف الكيه إم إل:", landName, err);
        return null;
    }
}

async function handleRoutingAndData() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetLand = urlParams.get('land');

    if (targetLand) {
        console.log(`عرض الأرض المحددة فقط: ${targetLand}`);
        let layer = await fetchSingleKml(targetLand, false);
        if (!layer) {
            layer = await fetchSingleKml(targetLand, true);
        }

        if (layer) {
            setTimeout(() => {
                const bounds = layer.getBounds();
                if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 18, padding: [50, 50] });
            }, 500);
        } else {
            alert("عذراً، لم يتم العثور على ملف الأرض المطلوبة.");
        }
    } 
    else {
        const dbUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/database.json`;
        try {
            const dbResponse = await fetch(dbUrl);
            const db = await dbResponse.json();

            if (db.available) {
                db.available.forEach(landName => fetchSingleKml(landName, false));
            }
            if (db.sold) {
                db.sold.forEach(landName => fetchSingleKml(landName, true));
            }
        } catch (error) {
            console.error("خطأ في قراءة ملف دليل الأراضي database.json", error);
        }
    }
}

// تشغيل الفحص
handleRoutingAndData();

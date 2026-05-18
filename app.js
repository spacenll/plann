// === إعدادات مستودع GitHub الخاص بك ===
const GITHUB_USER = 'spacenll'; 
const GITHUB_REPO = 'plann';      
const FOLDER_NAME = 'kmls';              

// --- 1. إعداد طبقات الخريطة المختلفة ---
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20 });
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20 });
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 });

// بدء الخريطة
const map = L.map('map', {
    center: [17.0151, 54.0924],
    zoom: 13,
    layers: [satelliteLayer] 
});

const baseMaps = {
    "القمر الصناعي": satelliteLayer,
    "خريطة الشوارع": streetLayer,
    "الوضع الليلي": darkLayer
};
L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

// --- 2. دالة حساب المقاسات (تم تحديثها لتبحث في العمق) ---
function getKmlMeasurements(layerGroup) {
    let html = '';
    let totalPerimeter = 0;
    let points = [];

    // دالة حفر عميقة (Recursive) لاستخراج النقاط من أي طبقة متداخلة
    function extractPoints(layer) {
        if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            let latlngs = layer.getLatLngs();
            // معالجة المصفوفات المتداخلة (في حال كان المضلع معقداً)
            if (latlngs.length > 0 && Array.isArray(latlngs[0])) {
                points = latlngs[0];
            } else {
                points = latlngs;
            }
        } else if (layer.eachLayer) {
            layer.eachLayer(function(childLayer) {
                extractPoints(childLayer);
            });
        }
    }

    // تشغيل دالة الاستخراج على ملف الـ KML
    extractPoints(layerGroup);

    // إذا وجدنا نقاطاً قابلة للقياس
    if (points.length > 1) {
        html += `<div class="measurements-box">
                    <h4>📏 قياسات الأضلاع:</h4>
                    <ul>`;
        
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length]; // لربط النقطة الأخيرة بالأولى وإغلاق الشكل
            
            if (p1.lat === p2.lat && p1.lng === p2.lng) continue;

            const distance = map.distance(p1, p2); // القياس بالمتر
            totalPerimeter += distance;
            html += `<li>الضلع ${i + 1}: <b>${distance.toFixed(1)} م</b></li>`;
        }
        
        html += `</ul>
                 <div class="total-perimeter">المحيط الإجمالي: ${totalPerimeter.toFixed(1)} متر</div>
                 </div>`;
    } else {
        html += `<div class="measurements-box"><p style="color:#e74c3c; font-size:13px;">لم يتم التعرف على أضلاع قابلة للقياس هندسياً في هذا الملف.</p></div>`;
    }

    return html;
}

// --- 3. جلب الأراضي من جيتهاب ---
async function loadLands() {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FOLDER_NAME}`;
    
    try {
        const response = await fetch(apiUrl);
        const files = await response.json();

        files.forEach(async (file) => {
            if (file.name.endsWith('.kml')) {
                const nameWithoutExt = file.name.replace('.kml', '');
                const parts = nameWithoutExt.split('_');
                const plotNum = parts[0] || 'غير محدد';
                const area = parts[1] || 'غير محدد';

                const kmlRes = await fetch(file.download_url);
                let kmlText = await kmlRes.text();

                // إصلاح جذري لمشكلة الـ Mixed Content (تحويل كل http إلى https)
                kmlText = kmlText.replace(/http:\/\//g, 'https://');

                const parser = new DOMParser();
                const kmlDom = parser.parseFromString(kmlText, 'text/xml');
                const kmlLayer = new L.KML(kmlDom);

                const measurementsHtml = getKmlMeasurements(kmlLayer);

                kmlLayer.bindPopup(`
                    <div class="custom-popup">
                        <h3>أرض رقم: ${plotNum}</h3>
                        <p class="area-text"><b>المساحة المكتوبة:</b> ${area} م²</p>
                        ${measurementsHtml}
                    </div>
                `);

                kmlLayer.setStyle({
                    color: '#d4af37',
                    weight: 3,
                    fillColor: '#46306e',
                    fillOpacity: 0.4
                });

                map.addLayer(kmlLayer);
            }
        });
    } catch (error) {
        console.error("حدث خطأ في جلب الملفات:", error);
    }
}

loadLands();

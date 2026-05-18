// === إعدادات مستودع GitHub الخاص بك ===
const GITHUB_USER = 'spacenll';
const GITHUB_REPO = 'plann';
const FOLDER_NAME = 'kmls';              // اسم المجلد الذي يحتوي على الملفات

const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20 });
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20 });
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 });

// بدء الخريطة (الوضع الافتراضي هو القمر الصناعي)
const map = L.map('map', {
    center: [17.0151, 54.0924],
    zoom: 13,
    layers: [satelliteLayer] 
});

// إضافة قائمة التحكم بالطبقات
const baseMaps = {
    "القمر الصناعي": satelliteLayer,
    "خريطة الشوارع": streetLayer,
    "الوضع الليلي": darkLayer
};
L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

// --- 2. دالة حساب أطوال أضلاع الـ KML ---
function getKmlMeasurements(layerGroup) {
    let html = '';
    layerGroup.eachLayer(function(layer) {
        // التحقق مما إذا كانت الطبقة مضلع (Polygon)
        if (layer instanceof L.Polygon) {
            const latlngs = layer.getLatLngs()[0]; // جلب نقاط المضلع
            let totalPerimeter = 0;
            
            html += `<div class="measurements-box">
                        <h4>📏 قياسات الأضلاع:</h4>
                        <ul>`;
            
            for (let i = 0; i < latlngs.length; i++) {
                const p1 = latlngs[i];
                const p2 = latlngs[(i + 1) % latlngs.length]; // النقطة التالية (مع العودة لنقطة البداية للإغلاق)
                
                // تجاهل النقاط المكررة في بعض ملفات KML
                if (p1.lat === p2.lat && p1.lng === p2.lng) continue;

                const distance = map.distance(p1, p2); // حساب المسافة بالمتر
                totalPerimeter += distance;
                html += `<li>الضلع ${i + 1}: <b>${distance.toFixed(1)} م</b></li>`;
            }
            
            html += `</ul>
                     <div class="total-perimeter">المحيط الإجمالي: ${totalPerimeter.toFixed(1)} متر</div>
                     </div>`;
        }
    });
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
                const kmlText = await kmlRes.text();

                const parser = new DOMParser();
                const kmlDom = parser.parseFromString(kmlText, 'text/xml');
                const kmlLayer = new L.KML(kmlDom);

                // حساب القياسات وإضافتها للنافذة المنبثقة
                const measurementsHtml = getKmlMeasurements(kmlLayer);

                kmlLayer.bindPopup(`
                    <div class="custom-popup">
                        <h3>أرض رقم: ${plotNum}</h3>
                        <p class="area-text"><b>المساحة المكتوبة:</b> ${area} م²</p>
                        ${measurementsHtml}
                    </div>
                `);

                // تغيير ستايل الـ KML ليصبح واضحاً مع لون أنيق
                kmlLayer.setStyle({
                    color: '#d4af37', // لون الحدود (ذهبي)
                    weight: 3,
                    fillColor: '#46306e', // لون التعبئة (بنفسجي عميق)
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

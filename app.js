// === إعدادات مستودع GitHub الخاص بك ===
const GITHUB_USER = 'spacenll'; 
const GITHUB_REPO = 'plann';      

// --- 1. إعداد طبقات الخريطة المختلفة ---
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20 });
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20 });
const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 });

// طبقة المسميات الرسمية (تظهر فوق القمر الصناعي)
const labelLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    opacity: 0.9 
});

const map = L.map('map', {
    center: [17.0151, 54.0924],
    zoom: 13,
    layers: [satelliteLayer, labelLayer] // تشغيل القمر الصناعي والمسميات افتراضياً
});

const baseMaps = {
    "القمر الصناعي + مسميات": L.layerGroup([satelliteLayer, labelLayer]),
    "خريطة الشوارع": streetLayer,
    "الوضع الليلي": darkLayer
};
L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

// --- 2. دالة حساب المقاسات (تبحث في العمق) ---
function getKmlMeasurements(layerGroup) {
    let html = '';
    let totalPerimeter = 0;
    let points = [];

    function extractPoints(layer) {
        if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            let latlngs = layer.getLatLngs();
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

    extractPoints(layerGroup);

    if (points.length > 1) {
        html += `<div class="measurements-box">
                    <h4>📏 الأضلاع:</h4>
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

// دالة مساعدة لبناء وتجهيز طبقة الأرض المفردة بناءً على حالتها
function processAndDisplayLayer(kmlText, plotNum, area, isSold) {
    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(kmlText, 'text/xml');
    const kmlLayer = new L.KML(kmlDom);

    let popupHtml = "";
    let styleOptions = {};
    let labelClass = "";

    if (isSold) {
        popupHtml = `
            <div class="custom-popup sold-popup">
                <h3>أرض رقم: ${plotNum}</h3>
                <p class="area-text"><b>المساحة :</b> ${area} م²</p>
                <div class="sold-badge">تـم الـبـيـع</div>
            </div>`;
        styleOptions = { color: '#e74c3c', weight: 3, fillColor: '#c0392b', fillOpacity: 0.6 };
        labelClass = "land-label-sold";
    } else {
        const measurementsHtml = getKmlMeasurements(kmlLayer);
        const whatsappMsg = encodeURIComponent(`مرحبا، أريد معلومات أكثر عن أرض رقم (${plotNum})`);
        popupHtml = `
            <div class="custom-popup">
                <h3>أرض رقم: ${plotNum}</h3>
                <p class="area-text"><b>المساحة :</b> ${area} م²</p>
                ${measurementsHtml}
                <a href="https://api.whatsapp.com/send?phone=96899481717&text=${whatsappMsg}" target="_blank" class="whatsapp-btn">
                    استفسر عبر واتساب 💬
                </a>
            </div>`;
        styleOptions = { color: '#d4af37', weight: 3, fillColor: '#46306e', fillOpacity: 0.4 };
        labelClass = "land-label";
    }

    kmlLayer.eachLayer(function(layer) {
        if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            layer.bindTooltip(`أرض ${plotNum}`, {
                permanent: true,
                direction: 'center',
                className: labelClass 
            }).openTooltip();
        }
    });

    kmlLayer.bindPopup(popupHtml);
    kmlLayer.setStyle(styleOptions);
    map.addLayer(kmlLayer);
    
    return kmlLayer;
}

// --- 3. الدالة الرئيسية لجلب البيانات العامة (متاحة أو مباعة) ---
async function fetchAndDisplay(folderName, isSold = false) {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folderName}`;
    
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return; 
        const files = await response.json();

        files.forEach(async (file) => {
            if (file.name.endsWith('.kml')) {
                const nameWithoutExt = file.name.replace('.kml', '');
                const parts = nameWithoutExt.split('_');
                const plotNum = parts[0] || 'غير محدد';
                const area = parts[1] || 'غير محدد';

                const kmlRes = await fetch(file.download_url);
                let kmlText = await kmlRes.text();
                kmlText = kmlText.replace(/http:\/\//g, 'https://'); 

                processAndDisplayLayer(kmlText, plotNum, area, isSold);
            }
        });
    } catch (error) {
        console.error("خطأ في جلب بيانات المجلد: " + folderName, error);
    }
}

// --- 4. نظام التحكم بالتوجيه وعرض الأرض المفردة (Deep Linking) ---
async function handleRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetLand = urlParams.get('land'); // جلب القيمة الممررة مثل ?land=1146D_1274

    if (targetLand) {
        console.log(`محاولة عرض الأرض المستهدفة المحددة فقط: ${targetLand}`);
        
        // 1. محاولة فحص وجلب الملف كأرض متاحة أولاً
        let fileUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/kmls/${targetLand}.kml`;
        let isSold = false;
        let checkResponse = await fetch(fileUrl);
        
        // 2. إذا لم يجدها في المتاحة، يحاول البحث في مجلد الأراضي المباعة
        if (!checkResponse.ok) {
            fileUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/sold_kmls/${targetLand}.kml`;
            isSold = true;
            checkResponse = await fetch(fileUrl);
        }

        // 3. في حال تم العثور على الملف في أحد المجلدين
        if (checkResponse.ok) {
            let kmlText = await checkResponse.text();
            kmlText = kmlText.replace(/http:\/\//g, 'https://');

            const parts = targetLand.split('_');
            const plotNum = parts[0] || 'غير محدد';
            const area = parts[1] || 'غير محدد';

            const activeLayer = processAndDisplayLayer(kmlText, plotNum, area, isSold);

            // الانتقال وعمل تركيز (Zoom) على موقع الأرض المحددة بدقة
            setTimeout(() => {
                const bounds = activeLayer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { maxZoom: 18, padding: [50, 50] });
                }
            }, 500);

        } else {
            console.log("الرمز الممرر غير موجود، سيتم التحويل للعرض العام.");
            // كخطة بديلة إذا كان رابط الأرض خاطئاً، اعرض كل شيء لمنع تعليق الصفحة
            fetchAndDisplay('kmls', false);
            fetchAndDisplay('sold_kmls', true);
        }
    } else {
        // إذا دخل على الرابط الرئيسي الافتراضي بدون أي إضافات، اعرض كل الملفات
        fetchAndDisplay('kmls', false);      
        fetchAndDisplay('sold_kmls', true);  
    }
}

// تشغيل الفحص والتنفيذ التلقائي فور تحميل الصفحة
handleRouting();

// === إعدادات مستودع GitHub الخاص بك ===
const GITHUB_USER = 'spacenll'; 
const GITHUB_REPO = 'plann';      

// --- 1. إعداد طبقات الخريطة المختلفة ---
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

// مصفوفة عامة لتخزين كل مضلعات الأراضي للرجوع إليها عند النقر الشامل
const allLandsLayers = [];

// --- 2. دالة حساب المقاسات ---
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

// دالة مساعدة لإنشاء محتوى الـ Popup
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
                <a href="https://api.whatsapp.com/send?phone=96899481717&text=${whatsappMsg}" target="_blank" class="whatsapp-btn">
                    استفسر عبر واتساب 💬
                </a>
            </div>`;
    }
}

// دالة مساعدة لمعالجة ورسم طبقة الأرض
// دالة مساعدة لمعالجة ورسم طبقة الأرض
// دالة مساعدة لمعالجة ورسم طبقة الأرض
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

    // إعداد شكل الدبوس الأصفر المخصص (أيقونة مخصصة متوافقة مع الحجم)
    const yellowPinIcon = L.icon({
        iconUrl: '/plann/yellow-pin.png', // أو رابط صورة yellow-pin.png الخاصة بك
        iconSize: [32, 32],      // حجم الدبوس
        iconAnchor: [16, 32],    // نقطة تثبيت الدبوس (الأسفل في المنتصف)
        popupAnchor: [0, -32]    // مكان ظهور النافذة المنبثقة بالنسبة للدبوس
    });

    let targetPolygon = null;

    // الفحص الأول: تنظيف وتجهيز المضلعات والحذف
    kmlLayer.eachLayer(function(layer) {
        // حذف الدبوس الافتراضي القادم من الـ KML لأنه يسبب المشاكل
        if (layer instanceof L.Marker) {
            kmlLayer.removeLayer(layer); 
            return; 
        }

        if (layer.setStyle) {
            layer.setStyle(styleOptions);
        }

        if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            targetPolygon = layer;
            
            // إضافة التلميح النصي التلقائي
            layer.bindTooltip(` ${plotNum}`, {
                permanent: true,
                direction: 'center',
                className: labelClass,
                interactive: false 
            }).openTooltip();

            // حفظ البيانات في المضلع والمصفوفة العامة
            layer.customData = { plotNum, area, isSold };
            allLandsLayers.push(layer);

            // عند الضغط على المضلع
           layer.on('click', function(e) {
                const content = createPopupContent(layer, plotNum, area, isSold);
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent(content)
                    .openOn(map);
            });
        }
    });

    // الفحص الثاني: إذا وجدنا مضلع أرض، نحسب منتصفه الجغرافي ونزرع الدبوس الجديد الخاص بنا
    if (targetPolygon) {
        // جلب مركز المضلع الجغرافي الدقيق (Center)
        const centerLatLng = targetPolygon.getBounds().getCenter();
        
        // إنشاء الدبوس الجديد في المنتصف تماماً
        const customMarker = L.marker(centerLatLng, { icon: yellowPinIcon });
        
        // ربط الدبوس الجديد بنفس النافذة المنبثقة وحساب الأبعاد للأرض التابعة له
        customMarker.on('click', function(e) {
            const content = createPopupContent(targetPolygon, plotNum, area, isSold);
            customMarker.bindPopup(content).openPopup();
        });

        // إضافة الدبوس الجديد إلى الخريطة مع طبقة الأرض
        kmlLayer.addLayer(customMarker);
    }

    map.addLayer(kmlLayer);
    return kmlLayer;
}

// --- الحل السحري: الاستماع للنقر على مستوى الخريطة كاملة وفحص الإحداثيات ---
map.on('click', function(e) {
    // التحقق مما إذا كان هناك مضلع أرض يقع تحت نقطة النقر الحالية
    for (let i = 0; i < allLandsLayers.length; i++) {
        const layer = allLandsLayers[i];
        
        // فحص ما إذا كانت النقطة المضغوطة تقع داخل حدود المضلع
        if (layer instanceof L.Polygon) {
            const bounds = layer.getBounds();
            
            // فحص أولي سريع عبر الحدود (Bounds) لسرعة الأداء
            if (bounds.contains(e.latlng)) {
                const data = layer.customData;
                if (data) {
                    const content = createPopupContent(layer, data.plotNum, data.area, data.isSold);
                    
                    // فتح النافذة عند نقطة الضغط مباشرة
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(content)
                        .openOn(map);
                    break; // التوقف فور العثور على الأرض المطلوبة
                }
            }
        }
    }
});

// دالة جلب ملف KML واحد ورسمه
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

// --- 3. نظام التوجيه وإدارة البيانات الجديد بدون قيود ---
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

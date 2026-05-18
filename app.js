// === إعدادات مستودع GitHub الخاص بك ===
const GITHUB_USER = 'spacenll';
const GITHUB_REPO = 'plann';
const FOLDER_NAME = 'kmls';              // اسم المجلد الذي يحتوي على الملفات

// تهيئة الخريطة والتركيز على إحداثيات صلالة
const map = L.map('map').setView([17.0151, 54.0924], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// دالة فحص المجلد وجلب الأراضي
async function loadLands() {
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FOLDER_NAME}`;
    
    try {
        // 1. جلب محتويات المجلد من GitHub
        const response = await fetch(apiUrl);
        const files = await response.json();

        // 2. المرور على كل ملف في المجلد
        files.forEach(async (file) => {
            if (file.name.endsWith('.kml')) {
                
                // استخراج البيانات من اسم الملف (مثال: 154_600.kml)
                const nameWithoutExt = file.name.replace('.kml', '');
                const parts = nameWithoutExt.split('_');
                const plotNum = parts[0] || 'غير محدد';
                const area = parts[1] || 'غير محدد';

                // 3. جلب محتوى ملف الكيه إم إل نفسه
                const kmlRes = await fetch(file.download_url);
                const kmlText = await kmlRes.text();

                // 4. تحويل النص إلى طبقة خريطة ورسمها
                const parser = new DOMParser();
                const kmlDom = parser.parseFromString(kmlText, 'text/xml');
                const kmlLayer = new L.KML(kmlDom);

                // إضافة النافذة المنبثقة بمعلومات واسم الملف
                kmlLayer.bindPopup(`
                    <div class="custom-popup">
                        <h3>أرض رقم: ${plotNum}</h3>
                        <p><b>المساحة:</b> ${area} متر مربع</p>
                    </div>
                `);

                map.addLayer(kmlLayer);
            }
        });
    } catch (error) {
        console.error("حدث خطأ في جلب الملفات:", error);
    }
}

// تشغيل النظام
loadLands();

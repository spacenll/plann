// ضع رابط الـ Web App الخاص بجوجل سكريبت هنا
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwiHgLHr0cgK3accmmkCuNOcGWaO1SUzF_pYiqwxKtn0qINLq5zX11shgwS8B-YxlGl/exec"; 

// إعداد الخريطة والتركيز على صلالة
const map = L.map('map').setView([17.0151, 54.0924], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

let currentPassHash = "";

// 1. دالة التشفير SHA-256
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 2. التحقق من الدخول وإظهار النموذج
async function checkLogin() {
    const pass = document.getElementById('adminPassword').value;
    currentPassHash = await hashPassword(pass);
    
    const targetHash = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"; 

    if (currentPassHash === targetHash) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('admin-form').style.display = 'block';
    } else {
        alert("كلمة المرور غير صحيحة!");
    }
}

// 3. تحويل الملفات إلى Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
            name: file.name,
            mimeType: file.type,
            data: reader.result.split(',')[1]
        });
        reader.onerror = error => reject(error);
    });
}

// 4. إرسال بيانات الأرض لجوجل درايف
document.getElementById('landForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = "جاري الرفع للحفظ السحابي، يرجى الانتظار...";
    submitBtn.disabled = true;

    try {
        const kmlData = await fileToBase64(document.getElementById('kmlFile').files[0]);
        const imageData = await fileToBase64(document.getElementById('imageFile').files[0]);

        const payload = {
            passHash: currentPassHash, // إرسال التشفير للسيرفر للتأكيد
            location: document.getElementById('location').value,
            block: document.getElementById('block').value,
            area: document.getElementById('area').value,
            floors: document.getElementById('floors').value,
            type: document.getElementById('type').value,
            kmlFile: kmlData,
            imageFile: imageData
        };

        await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        alert("تم الحفظ بنجاح!");
        window.location.reload();

    } catch (error) {
        alert("حدث خطأ أثناء الرفع: " + error.message);
        submitBtn.disabled = false;
        submitBtn.innerText = "حفظ الأرض في جوجل درايف";
    }
});

// 5. جلب الأراضي وعرضها على الخريطة للزوار
// 5. جلب الأراضي وعرضها على الخريطة للزوار
async function loadLandsOnMap() {
    try {
        const res = await fetch(WEB_APP_URL);
        const lands = await res.json();

        lands.forEach(land => {
            const kmlId = land['رابط ملف KML'];
            
            // التأكد أن الحقل يحتوي على ID صحيح لتفادي الأسطر الفارغة
            if (kmlId && kmlId.length > 10) {
                
                // نطلب محتوى الملف عبر سكريبت جوجل الخاص بنا لتخطي الحظر
                const kmlContentUrl = `${WEB_APP_URL}?kmlId=${kmlId}`;

                fetch(kmlContentUrl)
                    .then(response => response.text())
                    .then(kmlText => {
                        if(kmlText.includes("Error")) return; // تجاهل في حال فشل القراءة

                        const parser = new DOMParser();
                        const kmlDom = parser.parseFromString(kmlText, 'text/xml');
                        const kmlLayer = new L.KML(kmlDom);
                        
                        map.addLayer(kmlLayer);

                        kmlLayer.bindPopup(`
                            <div style="direction:rtl; text-align:right; font-family: sans-serif;">
                                <h3 style="color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 5px;">المنطقة: ${land['المنطقة']}</h3>
                                <p><b>المربع:</b> ${land['المربع']}</p>
                                <p><b>المساحة:</b> ${land['المساحة']} م²</p>
                                <p><b>الاستخدام:</b> ${land['النوع']}</p>
                                <p><b>عدد الطوابق:</b> ${land['عدد الطوابق']}</p>
                                <div style="margin-top: 10px; text-align: center;">
                                    <a href="${land['رابط صورة الكروكي']}" target="_blank" style="background: #3498db; color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none; display: inline-block;">عرض صورة الكروكي</a>
                                </div>
                            </div>
                        `);
                    })
                    .catch(err => console.log("خطأ في رسم الـ KML:", err));
            }
        });
    } catch (err) {
        console.log("لم يتم العثور على أراضي مضافة مسبقاً لعرضها أو الجدول فارغ.");
    }
}

// تشغيل الخريطة عند تحميل الصفحة
loadLandsOnMap();

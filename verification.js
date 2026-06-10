import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBPTYL-3jOhcLi9UkjQWmSG6ArRVio5QKE",
    authDomain: "loyiha-98a22.firebaseapp.com",
    projectId: "loyiha-98a22",
    storageBucket: "loyiha-98a22.firebasestorage.app",
    messagingSenderId: "1022023262123",
    appId: "1:1022023262123:web:55c0bcf456391fdf80fcee",
    measurementId: "G-PPR0TL0CLX"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user || { id: "777", username: "DexoGram", first_name: "User" };
const userId = String(user.id);

const ADS_REQUIRED = 5;

// =============================================
// HAR BIR REKLAMA UCHUN ALOHIDA ADSGRAM BLOCK ID
// 1-reklama → BLOCK_IDS[0], 2-reklama → BLOCK_IDS[1] ...
// O'z block ID laringizni shu yerga kiriting
// =============================================
const BLOCK_IDS = [
    "int-34680",   // 1-reklama
    "int-34681",   // 2-reklama
    "int-34682",   // 3-reklama
    "int-34683",   // 4-reklama
    "int-34684"    // 5-reklama
];

// =============================================
// SAHIFA YUKLANGANDA
// =============================================
window.addEventListener("load", async () => {
    await loadStatus();
});

async function loadStatus() {
    try {
        const snap = await get(ref(db, `users/${userId}/verification`));
        const data = snap.exists() ? snap.val() : { adsWatched: 0, status: "none" };
        updateUI(data);
    } catch (e) {
        console.error("Holat yuklanmadi:", e);
    }
}

// =============================================
// UI YANGILASH
// =============================================
function updateUI(data) {
    const adsWatched = data.adsWatched || 0;
    const status = data.status || "none";

    // Progress raqami
    document.getElementById("adsWatched").textContent = adsWatched;
    document.getElementById("progressFill").style.width = `${Math.min((adsWatched / ADS_REQUIRED) * 100, 100)}%`;
    document.getElementById("progressText").textContent = `${adsWatched} / ${ADS_REQUIRED} ta reklama ko'rildi`;

    if (adsWatched >= ADS_REQUIRED) {
        document.getElementById("adsCheck").textContent = "✓";
        document.getElementById("adsCheck").classList.add("passed");
    }

    // Har bir step indikatorini yangilaymiz
    for (let i = 1; i <= ADS_REQUIRED; i++) {
        const stepEl = document.getElementById(`step${i}`);
        if (!stepEl) continue;
        stepEl.classList.remove("done", "active");
        if (i <= adsWatched) {
            stepEl.textContent = `✅ ${i}-reklama`;
            stepEl.classList.add("done");
        } else if (i === adsWatched + 1 && status === "none") {
            stepEl.textContent = `▶ ${i}-reklama`;
            stepEl.classList.add("active");
        } else {
            stepEl.textContent = `📺 ${i}-reklama`;
        }
    }

    // Tugma yozuvini yangilaymiz
    const nextNum = adsWatched + 1;
    if (adsWatched < ADS_REQUIRED) {
        document.getElementById("watchAdBtn").textContent = `📺 ${nextNum}-reklamani ko'rish`;
        document.getElementById("adNote").textContent = `${nextNum} / ${ADS_REQUIRED} — Bosing va reklamani to'liq ko'ring`;
    }

    // Barcha kartalarni yashiramiz
    hide("adSection");
    hide("submitSection");
    hide("pendingCard");
    hide("verifiedCard");
    hide("rejectedCard");

    if (status === "approved") {
        document.getElementById("statusIcon").textContent = "✅";
        document.getElementById("statusTitle").textContent = "Hisob tasdiqlangan!";
        const badge = document.getElementById("statusBadge");
        badge.textContent = "✓ Tasdiqlangan";
        badge.className = "status-badge active";
        document.getElementById("statusCard").classList.add("verified-glow");
        show("verifiedCard");

    } else if (status === "pending") {
        document.getElementById("statusIcon").textContent = "⏳";
        document.getElementById("statusTitle").textContent = "Tekshiruvda...";
        document.getElementById("statusBadge").textContent = "Admin ko'rib chiqmoqda";
        show("pendingCard");

    } else if (status === "rejected") {
        document.getElementById("statusIcon").textContent = "❌";
        document.getElementById("statusTitle").textContent = "Ariza rad etildi";
        document.getElementById("statusBadge").textContent = "Rad etildi";
        const reason = data.rejectedReason || "Admin tomonidan rad etildi.";
        document.getElementById("rejectedReason").textContent = reason;
        show("rejectedCard");

        document.getElementById("retryBtn").addEventListener("click", async () => {
            await update(ref(db, `users/${userId}/verification`), {
                adsWatched: 0,
                status: "none",
                rejectedReason: null
            });
            location.reload();
        });

    } else {
        // status === "none"
        if (adsWatched >= ADS_REQUIRED) {
            show("submitSection");
        } else {
            show("adSection");
        }
    }
}

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

// =============================================
// REKLAMA KO'RISH TUGMASI
// =============================================
document.getElementById("watchAdBtn").addEventListener("click", async () => {
    const snap = await get(ref(db, `users/${userId}/verification`));
    const data = snap.exists() ? snap.val() : { adsWatched: 0, status: "none" };
    const adsWatched = data.adsWatched || 0;

    if (adsWatched >= ADS_REQUIRED) {
        show("submitSection");
        hide("adSection");
        return;
    }

    // Navbatdagi reklama uchun block ID
    const blockId = BLOCK_IDS[adsWatched]; // 0-indexed: 0,1,2,3,4

    showAdsgram(blockId, adsWatched + 1, async () => {
        // Reklama muvaffaqiyatli ko'rildi — Firebase yangilaymiz
        const newCount = adsWatched + 1;
        await update(ref(db, `users/${userId}/verification`), {
            adsWatched: newCount,
            status: "none"
        });
        updateUI({ adsWatched: newCount, status: "none" });
    });
});

// =============================================
// ADSGRAM SDK ORQALI REKLAMA KO'RSATISH
// blockId    — shu reklamaning Adsgram block ID si
// adNumber   — 1,2,3,4,5 (foydalanuvchiga ko'rsatish uchun)
// onComplete — reklama ko'rilgandan so'ng chaqiriladi
// =============================================
function showAdsgram(blockId, adNumber, onComplete) {
    const overlay = document.getElementById("adOverlay");
    const overlayText = document.getElementById("adOverlayText");
    const btn = document.getElementById("watchAdBtn");

    overlay.classList.remove("hidden");
    overlayText.textContent = `${adNumber}-reklama yuklanmoqda...`;
    document.getElementById("adCountdown").textContent = "Iltimos kuting";
    btn.disabled = true;

    // Adsgram SDK bilan reklama chaqirish
    if (window.Adsgram) {
        const AdController = window.Adsgram.init({ blockId: blockId });

        AdController.show()
            .then(() => {
                // Reklama to'liq ko'rildi
                overlay.classList.add("hidden");
                btn.disabled = false;
                document.getElementById("adCountdown").textContent = `${adNumber}-reklama ko'rildi ✅`;
                onComplete();
            })
            .catch((result) => {
                // Foydalanuvchi reklamani yopdi yoki xatolik
                // skip bo'lsa hisoblamaymiz
                overlay.classList.add("hidden");
                btn.disabled = false;
                if (result && result.done) {
                    // To'liq ko'rildi lekin catch ga tushdi
                    onComplete();
                } else {
                    showAlert("⚠️", "Reklamani to'liq ko'ring! O'rtada yopilsa hisoblanmaydi.");
                }
            });
    } else {
        // Adsgram SDK yuklanmagan (test rejimi — 5 soniya simulyatsiya)
        let seconds = 5;
        const countdownEl = document.getElementById("adCountdown");
        countdownEl.textContent = `${seconds} soniya qoldi`;

        const timer = setInterval(() => {
            seconds--;
            if (seconds > 0) {
                countdownEl.textContent = `${seconds} soniya qoldi`;
            } else {
                clearInterval(timer);
                countdownEl.textContent = `${adNumber}-reklama ko'rildi ✅`;
                setTimeout(() => {
                    overlay.classList.add("hidden");
                    btn.disabled = false;
                    onComplete();
                }, 500);
            }
        }, 1000);
    }
}

// =============================================
// TEKSHIRUVGA YUBORISH TUGMASI
// =============================================
document.getElementById("submitBtn").addEventListener("click", async () => {
    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Yuborilmoqda...";

    try {
        await set(ref(db, `verification_requests/${userId}`), {
            userId: userId,
            username: user.username || "",
            firstName: user.first_name || "",
            lastName: user.last_name || "",
            requestedAt: Date.now(),
            status: "pending"
        });

        await update(ref(db, `users/${userId}/verification`), {
            status: "pending",
            requestedAt: Date.now()
        });

        updateUI({ adsWatched: ADS_REQUIRED, status: "pending" });
        showAlert("📨", "Arizangiz adminга muvaffaqiyatli yuborildi! Admin tekshirib tasdiqlaydi.");

    } catch (e) {
        console.error("Yuborishda xatolik:", e);
        btn.disabled = false;
        btn.textContent = "📨 Tekshiruvga yuborish";
        showAlert("⚠️", "Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    }
});

// =============================================
// CHIROYLI ALERT
// =============================================
function showAlert(icon, message) {
    const existing = document.getElementById("customAlert");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "customAlert";
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.8);
        display:flex; align-items:center; justify-content:center;
        z-index:9999; padding:20px;
    `;
    modal.innerHTML = `
        <div style="background:#161b22;border:1px solid #30363d;border-radius:20px;
            padding:32px 24px;max-width:300px;width:100%;text-align:center;">
            <div style="font-size:50px;margin-bottom:14px;">${icon}</div>
            <p style="font-size:15px;color:#f0f6fc;line-height:1.5;">${message}</p>
            <button onclick="document.getElementById('customAlert').remove()" style="
                margin-top:20px;padding:12px 32px;
                background:linear-gradient(45deg,#00ffff,#007fff);
                color:#000;border:none;border-radius:10px;
                font-size:14px;font-weight:800;cursor:pointer;">OK</button>
        </div>
    `;
    document.body.appendChild(modal);
}
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
// status: "none" | "pending" | "approved" | "rejected"
// =============================================
function updateUI(data) {
    const adsWatched = data.adsWatched || 0;
    const status = data.status || "none";

    // Progress
    document.getElementById("adsWatched").textContent = adsWatched;
    document.getElementById("progressFill").style.width = `${Math.min((adsWatched / ADS_REQUIRED) * 100, 100)}%`;
    document.getElementById("progressText").textContent = `${adsWatched} / ${ADS_REQUIRED} ta reklama ko'rildi`;

    if (adsWatched >= ADS_REQUIRED) {
        document.getElementById("adsCheck").textContent = "✓";
        document.getElementById("adsCheck").classList.add("passed");
    }

    // Barcha kartalarni yashiramiz
    hide("adSection");
    hide("submitSection");
    hide("pendingCard");
    hide("verifiedCard");
    hide("rejectedCard");

    if (status === "approved") {
        // TASDIQLANGAN
        document.getElementById("statusIcon").textContent = "✅";
        document.getElementById("statusTitle").textContent = "Hisob tasdiqlangan!";
        const badge = document.getElementById("statusBadge");
        badge.textContent = "✓ Tasdiqlangan";
        badge.className = "status-badge active";
        document.getElementById("statusCard").classList.add("verified-glow");
        show("verifiedCard");

    } else if (status === "pending") {
        // KUTILMOQDA
        document.getElementById("statusIcon").textContent = "⏳";
        document.getElementById("statusTitle").textContent = "Tekshiruvda...";
        document.getElementById("statusBadge").textContent = "Admin ko'rib chiqmoqda";
        show("pendingCard");

    } else if (status === "rejected") {
        // RAD ETILDI
        document.getElementById("statusIcon").textContent = "❌";
        document.getElementById("statusTitle").textContent = "Ariza rad etildi";
        document.getElementById("statusBadge").textContent = "Rad etildi";
        const reason = data.rejectedReason || "Admin tomonidan rad etildi.";
        document.getElementById("rejectedReason").textContent = reason;
        show("rejectedCard");

        // Qaytadan yuborish tugmasi
        document.getElementById("retryBtn").addEventListener("click", async () => {
            // Statusni nollaymiz — qaytadan reklama ko'radi
            await update(ref(db, `users/${userId}/verification`), {
                adsWatched: 0,
                status: "none",
                rejectedReason: null
            });
            location.reload();
        });

    } else {
        // HALI YUBORILMAGAN
        if (adsWatched >= ADS_REQUIRED) {
            // 5 ta reklama ko'rilgan — yuborish tugmasi
            show("submitSection");
        } else {
            // Hali reklama ko'rish kerak
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

    showAdOverlay(async () => {
        const newCount = adsWatched + 1;
        await update(ref(db, `users/${userId}/verification`), {
            adsWatched: newCount,
            status: "none"
        });

        if (newCount >= ADS_REQUIRED) {
            updateUI({ adsWatched: newCount, status: "none" });
        } else {
            updateUI({ adsWatched: newCount, status: "none" });
        }
    });
});

// =============================================
// TEKSHIRUVGA YUBORISH TUGMASI
// =============================================
document.getElementById("submitBtn").addEventListener("click", async () => {
    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Yuborilmoqda...";

    try {
        // verification_requests ga yozamiz — admin shu joydan o'qiydi
        await set(ref(db, `verification_requests/${userId}`), {
            userId: userId,
            username: user.username || "",
            firstName: user.first_name || "",
            lastName: user.last_name || "",
            requestedAt: Date.now(),
            status: "pending"
        });

        // Foydalanuvchi statusini ham yangilaymiz
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
// ADSGRAM REKLAMA OVERLAY
// =============================================
function showAdOverlay(onComplete) {
    const overlay = document.getElementById("adOverlay");
    const countdownEl = document.getElementById("adCountdown");
    const btn = document.getElementById("watchAdBtn");

    overlay.classList.remove("hidden");
    btn.disabled = true;

    if (window.Adsgram) {
        const adController = window.Adsgram.init({ blockId: "YOUR_ADSGRAM_BLOCK_ID" });
        adController.show().then(() => {
            overlay.classList.add("hidden");
            btn.disabled = false;
            onComplete();
        }).catch(() => {
            overlay.classList.add("hidden");
            btn.disabled = false;
            onComplete();
        });
    } else {
        let seconds = 5;
        countdownEl.textContent = `${seconds} soniya qoldi`;
        const timer = setInterval(() => {
            seconds--;
            countdownEl.textContent = seconds > 0 ? `${seconds} soniya qoldi` : "Reklama tugadi!";
            if (seconds <= 0) {
                clearInterval(timer);
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
// CHIROYLI ALERT
// =============================================
function showAlert(icon, message) {
    const existing = document.getElementById("customAlert");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "customAlert";
    modal.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 20px;
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

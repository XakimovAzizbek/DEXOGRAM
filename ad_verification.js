import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const user = tg.initDataUnsafe?.user || { id: "777" };
const adminId = String(user.id);

// =============================================
// ADMIN ID LARINI SHU YERGA KIRITING
// Masalan: const ADMIN_IDS = ["123456789", "987654321"];
// =============================================
const ADMIN_IDS = ["7915445661"];

let currentFilter = "pending";
let pendingRejectUserId = null;
let allRequests = {};

// =============================================
// KIRISH TEKSHIRUVI
// =============================================
window.addEventListener("load", () => {
    if (!ADMIN_IDS.includes(adminId)) {
        document.getElementById("accessDenied").classList.remove("hidden");
        return;
    }
    document.getElementById("adminPanel").classList.remove("hidden");
    loadRequests();
    setupFilters();
    setupRejectModal();
});

// =============================================
// ARIZALARNI YUKLASH — REAL TIME
// =============================================
function loadRequests() {
    const reqRef = ref(db, "verification_requests");

    onValue(reqRef, (snapshot) => {
        document.getElementById("loadingEl").classList.add("hidden");
        allRequests = snapshot.exists() ? snapshot.val() : {};
        updateStats();
        renderRequests();
    });
}

// =============================================
// STATISTIKA YANGILASH
// =============================================
function updateStats() {
    let pending = 0, approved = 0, rejected = 0;
    Object.values(allRequests).forEach(r => {
        if (r.status === "pending") pending++;
        else if (r.status === "approved") approved++;
        else if (r.status === "rejected") rejected++;
    });
    document.getElementById("statPending").textContent = pending;
    document.getElementById("statApproved").textContent = approved;
    document.getElementById("statRejected").textContent = rejected;
}

// =============================================
// ARIZALARNI RENDER QILISH
// =============================================
function renderRequests() {
    const list = document.getElementById("requestsList");
    list.innerHTML = "";

    let entries = Object.entries(allRequests);

    // Filterlash
    if (currentFilter !== "all") {
        entries = entries.filter(([, r]) => r.status === currentFilter);
    }

    // Eng yangilari tepada
    entries.sort(([, a], [, b]) => (b.requestedAt || 0) - (a.requestedAt || 0));

    if (entries.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p class="empty-text">Bu bo'limda arizalar yo'q</p>
            </div>
        `;
        return;
    }

    entries.forEach(([userId, req]) => {
        const card = document.createElement("div");
        card.className = `request-card ${req.status}`;

        const date = req.requestedAt
            ? new Date(req.requestedAt).toLocaleString("uz-UZ")
            : "Noma'lum";

        const avatarLetter = (req.firstName || req.username || "U")[0].toUpperCase();

        const isPending = req.status === "pending";

        card.innerHTML = `
            <div class="req-header">
                <div class="req-user">
                    <div class="req-avatar">${avatarLetter}</div>
                    <div>
                        <div class="req-name">${req.firstName || ""} ${req.lastName || ""}</div>
                        <div class="req-meta">@${req.username || "noma'lum"}</div>
                    </div>
                </div>
                <span class="req-status ${req.status}">
                    ${req.status === "pending" ? "⏳ Kutmoqda"
                    : req.status === "approved" ? "✅ Tasdiqlandi"
                    : "❌ Rad etildi"}
                </span>
            </div>

            <div class="req-info">
                <div class="req-info-row">
                    <span class="req-info-label">Telegram ID</span>
                    <span class="req-info-value">${userId}</span>
                </div>
                <div class="req-info-row">
                    <span class="req-info-label">Yuborilgan vaqt</span>
                    <span class="req-info-value">${date}</span>
                </div>
                ${req.status === "rejected" && req.rejectedReason ? `
                <div class="req-info-row">
                    <span class="req-info-label">Rad sababi</span>
                    <span class="req-info-value" style="color:#ff007f">${req.rejectedReason}</span>
                </div>` : ""}
                ${req.status === "approved" && req.approvedAt ? `
                <div class="req-info-row">
                    <span class="req-info-label">Tasdiqlangan vaqt</span>
                    <span class="req-info-value" style="color:#3fb950">
                        ${new Date(req.approvedAt).toLocaleString("uz-UZ")}
                    </span>
                </div>` : ""}
            </div>

            ${isPending ? `
            <div class="req-actions">
                <button class="btn-approve" data-uid="${userId}">✅ Tasdiqlash</button>
                <button class="btn-reject" data-uid="${userId}">❌ Rad etish</button>
            </div>` : ""}
        `;

        if (isPending) {
            card.querySelector(".btn-approve").addEventListener("click", () => approveUser(userId));
            card.querySelector(".btn-reject").addEventListener("click", () => openRejectModal(userId));
        }

        list.appendChild(card);
    });
}

// =============================================
// TASDIQLASH
// =============================================
async function approveUser(userId) {
    try {
        // verification_requests da yangilaymiz
        await update(ref(db, `verification_requests/${userId}`), {
            status: "approved",
            approvedAt: Date.now(),
            approvedBy: adminId
        });

        // Foydalanuvchi profili
        await update(ref(db, `users/${userId}/verification`), {
            status: "approved"
        });

        // Asosiy verified flag — profile.js shu joydan o'qiydi
        await update(ref(db, `users/${userId}`), {
            verified: true
        });

        showToast("✅ Foydalanuvchi tasdiqlandi!");

    } catch (e) {
        console.error("Tasdiqlashda xatolik:", e);
        showToast("⚠️ Xatolik yuz berdi!");
    }
}

// =============================================
// RAD ETISH MODAL
// =============================================
function openRejectModal(userId) {
    pendingRejectUserId = userId;
    document.getElementById("rejectReason").value = "";
    document.getElementById("rejectModal").classList.remove("hidden");
}

function setupRejectModal() {
    document.getElementById("modalCancel").addEventListener("click", () => {
        document.getElementById("rejectModal").classList.add("hidden");
        pendingRejectUserId = null;
    });

    document.getElementById("modalConfirm").addEventListener("click", async () => {
        if (!pendingRejectUserId) return;
        const reason = document.getElementById("rejectReason").value.trim()
            || "Admin tomonidan rad etildi.";

        try {
            await update(ref(db, `verification_requests/${pendingRejectUserId}`), {
                status: "rejected",
                rejectedAt: Date.now(),
                rejectedBy: adminId,
                rejectedReason: reason
            });

            await update(ref(db, `users/${pendingRejectUserId}/verification`), {
                status: "rejected",
                rejectedReason: reason
            });

            document.getElementById("rejectModal").classList.add("hidden");
            pendingRejectUserId = null;
            showToast("❌ Ariza rad etildi.");

        } catch (e) {
            console.error("Rad etishda xatolik:", e);
            showToast("⚠️ Xatolik yuz berdi!");
        }
    });
}

// =============================================
// FILTER TUGMALARI
// =============================================
function setupFilters() {
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            renderRequests();
        });
    });
}

// =============================================
// TOAST XABARI
// =============================================
function showToast(message) {
    const existing = document.getElementById("toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
        position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
        background:#161b22; border:1px solid #30363d;
        color:#f0f6fc; padding:12px 24px; border-radius:30px;
        font-size:14px; font-weight:600; z-index:9999;
        box-shadow:0 4px 20px rgba(0,0,0,0.5);
        animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
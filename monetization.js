import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase, ref, get, set, update, onValue
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase config
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

// Telegram user
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: "777", username: "DexoGram" };
const userId = String(user.id);

// Ko'rish uchun 1 soat = millisekund
// Bitta foydalanuvchi bitta videoni 2 soatda 1 marta ko'rishi hisoblanadi
const VIEW_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 soat

// 1 ta ko'rish narxi (USDT)
const RATE_PER_VIEW = 0.000003;

// =============================================
// SAHIFA YUKLANGANDA
// =============================================
window.addEventListener("load", async () => {
    await loadPageData();
});

async function loadPageData() {
    try {
        // Foydalanuvchining barcha postlarini olamiz
        const postsSnap = await get(ref(db, "posts"));
        if (!postsSnap.exists()) return;

        const posts = postsSnap.val();

        // Faqat bu foydalanuvchining postlari
        const myPosts = Object.entries(posts).filter(([, post]) => String(post.userId) === userId);

        // Jami layklar hisoblash
        let totalLikes = 0;
        myPosts.forEach(([, post]) => {
            const likesObj = post.likes_users || {};
            totalLikes += Object.keys(likesObj).length;
        });

        // Ekranga chiqarish
        document.getElementById("totalLikesDisplay").textContent = totalLikes;

        // Layk shartini tekshirish
        if (totalLikes >= 100) {
            document.getElementById("likesCheck").textContent = "✓";
            document.getElementById("likesCheck").classList.add("passed");
        }

        // Monetizatsiya holati Firebase'dan
        const monoSnap = await get(ref(db, `users/${userId}/monetization`));
        const monoData = monoSnap.exists() ? monoSnap.val() : null;

        if (monoData && monoData.enabled) {
            showActiveState(monoData);
        }

    } catch (e) {
        console.error("Error loading page:", e);
    }
}

// =============================================
// MONETIZATSIYA FAOL HOLATINI KO'RSATISH
// =============================================
function showActiveState(monoData) {
    // Status badge
    document.getElementById("statusIcon").textContent = "🏆";
    document.getElementById("statusTitle").textContent = "Monetization is active.!";
    const badge = document.getElementById("statusBadge");
    badge.textContent = "✅ Active";
    badge.className = "status-badge active";

    // Stats kartasini ko'rsatish
    document.getElementById("statsCard").classList.remove("hidden");

    // Ko'rishlar va balans
    listenToStats();
}

// =============================================
// REAL-TIME KO'RISHLAR VA BALANS
// =============================================
function listenToStats() {
    const monoRef = ref(db, `users/${userId}/monetization`);
    onValue(monoRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();

        const totalViews = data.totalViews || 0;
        const balance = (totalViews * RATE_PER_VIEW).toFixed(5);

        document.getElementById("totalViewsDisplay").textContent = totalViews.toLocaleString();
        document.getElementById("balanceDisplay").textContent = `$${balance}`;
    });
}

// =============================================
// TEKSHIRISH TUGMASI
// =============================================
document.getElementById("checkBtn").addEventListener("click", async () => {
    const overlay = document.getElementById("checkingOverlay");
    const btn = document.getElementById("checkBtn");

    // Overlay ko'rsatish
    overlay.classList.remove("hidden");
    btn.disabled = true;

    try {
        // Biroz kuting — real hissiyot uchun
        await delay(1800);

        // Firebase'dan postlarni qayta yuklaymiz
        const postsSnap = await get(ref(db, "posts"));
        if (!postsSnap.exists()) {
            overlay.classList.add("hidden");
            btn.disabled = false;
            showAlert("❌", "No posts found.!");
            return;
        }

        const posts = postsSnap.val();
        const myPosts = Object.entries(posts).filter(([, post]) => String(post.userId) === userId);

        // Jami layklar
        let totalLikes = 0;
        myPosts.forEach(([, post]) => {
            const likesObj = post.likes_users || {};
            totalLikes += Object.keys(likesObj).length;
        });

        overlay.classList.add("hidden");

        // Shart bajarilganmi?
        if (totalLikes < 100) {
            showAlert("❌", `You have collected ${totalLikes} likes so far. At least 100 likes are needed for monetization!`);
            btn.disabled = false;
            return;
        }

        // Monetizatsiya allaqachon yoqilganmi?
        const monoSnap = await get(ref(db, `users/${userId}/monetization`));
        if (monoSnap.exists() && monoSnap.val().enabled) {
            showAlert("✅", "Monetization is already enabled.!");
            showActiveState(monoSnap.val());
            btn.disabled = false;
            return;
        }

        // Monetizatsiyani yoqamiz
        await set(ref(db, `users/${userId}/monetization`), {
            enabled: true,
            enabledAt: Date.now(),
            totalViews: 0,
            balance: 0
        });

        showAlert("🎉", "Congratulations! Monetization has been successfully enabled.!");
        showActiveState({ enabled: true, totalViews: 0 });

    } catch (e) {
        console.error("Tekshirishda xatolik:", e);
        overlay.classList.add("hidden");
        btn.disabled = false;
        showAlert("⚠️", "An error occurred. Please try again..");
    }
});

// =============================================
// YORDAMCHI FUNKSIYALAR
// =============================================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showAlert(icon, message) {
    // Oddiy alert o'rniga chiroyli modal
    const existing = document.getElementById("alertModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "alertModal";
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 20px;
    `;
    modal.innerHTML = `
        <div style="
            background: #161b22; border: 1px solid #30363d;
            border-radius: 20px; padding: 32px 24px;
            max-width: 300px; width: 100%; text-align: center;
        ">
            <div style="font-size: 48px; margin-bottom: 14px;">${icon}</div>
            <p style="font-size: 15px; color: #f0f6fc; line-height: 1.5;">${message}</p>
            <button onclick="document.getElementById('alertModal').remove()" style="
                margin-top: 20px; padding: 12px 32px;
                background: linear-gradient(45deg, #00ffff, #00bbff);
                color: #000; border: none; border-radius: 10px;
                font-size: 14px; font-weight: 700; cursor: pointer;
            ">OK</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// =============================================
// REELS'DAN CHAQIRILADIGAN KO'RISH FUNKSIYASI
// Bu funksiya reels.js dan ham chaqirilishi mumkin
// yoki shu fayldan export qilinishi mumkin.
// Quyidagi mantiq reels.js da IntersectionObserver'ga qo'shilishi kerak
// =============================================
// posts/${postId}/post_views/${viewerUserId}/lastSeen — timestamp saqlanadi
// Agar lastSeen dan 2 soat o'tgan bo'lsa → ko'rish hisoblanadi

export async function recordPostView(postId, viewerUserId) {
    // Post egasini aniqlaymiz
    try {
        const postSnap = await get(ref(db, `posts/${postId}`));
        if (!postSnap.exists()) return;

        const post = postSnap.val();
        const postOwnerId = String(post.userId);

        // Post egasining monetizatsiyasi yoqilganmi?
        const monoSnap = await get(ref(db, `users/${postOwnerId}/monetization`));
        if (!monoSnap.exists() || !monoSnap.val().enabled) return;

        // Ko'ruvchining oxirgi ko'rish vaqtini tekshiramiz
        const viewRef = ref(db, `posts/${postId}/post_views/${viewerUserId}`);
        const viewSnap = await get(viewRef);

        const now = Date.now();

        if (viewSnap.exists()) {
            const lastSeen = viewSnap.val().lastSeen || 0;
            // 2 soat o'tmagan bo'lsa → hisoblamaymiz
            if (now - lastSeen < VIEW_COOLDOWN_MS) return;
        }

        // Ko'rishni qayd qilamiz
        await set(viewRef, { lastSeen: now });

        // Post egasining totalViews ni oshiramiz
        const monoData = monoSnap.val();
        const newTotal = (monoData.totalViews || 0) + 1;
        await update(ref(db, `users/${postOwnerId}/monetization`), {
            totalViews: newTotal
        });

    } catch (e) {
        console.error("Error while recording view:", e);
    }
}
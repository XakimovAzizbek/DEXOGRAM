// ── FIRESTORE versiyasi ────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection, getDocs,
    doc, getDoc, setDoc, updateDoc,
    onSnapshot, increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db  = getFirestore(app);

const tg     = window.Telegram.WebApp;
tg.expand();
const user   = tg.initDataUnsafe?.user || { id: "777", username: "DexoGram" };
const userId = String(user.id);

const VIEW_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 soat
const RATE_PER_VIEW    = 0.000003;

// ── SAHIFA YUKLANGANDA ─────────────────────────────────────
window.addEventListener("load", async () => {
    await loadPageData();
});

async function loadPageData() {
    try {
        // Barcha postlarni Firestore dan olamiz
        const querySnap = await getDocs(collection(db, "posts"));

        let totalLikes = 0;
        querySnap.forEach(docSnap => {
            const post = docSnap.data();
            if (String(post.userId) !== userId) return;
            const likesObj = post.likes_users || {};
            totalLikes += Object.keys(likesObj).length;
        });

        document.getElementById("totalLikesDisplay").textContent = totalLikes;

        if (totalLikes >= 100) {
            document.getElementById("likesCheck").textContent = "✓";
            document.getElementById("likesCheck").classList.add("passed");
        }

        // Monetizatsiya holati Firestore dan
        const userSnap = await getDoc(doc(db, "users", userId));
        const monoData = userSnap.exists() ? (userSnap.data().monetization || null) : null;

        if (monoData && monoData.enabled) {
            showActiveState(monoData);
        }

    } catch (e) {
        console.error("Error loading page:", e);
    }
}

// ── FAOL HOLAT ────────────────────────────────────────────
function showActiveState(monoData) {
    document.getElementById("statusIcon").textContent  = "🏆";
    document.getElementById("statusTitle").textContent = "Monetization is active!";
    const badge = document.getElementById("statusBadge");
    badge.textContent = "✅ Active";
    badge.className   = "status-badge active";
    document.getElementById("statsCard").classList.remove("hidden");
    listenToStats();
}

// ── REAL-TIME KO'RISHLAR VA BALANS ────────────────────────
function listenToStats() {
    onSnapshot(doc(db, "users", userId), (snap) => {
        if (!snap.exists()) return;
        const monoData  = snap.data().monetization || {};
        const totalViews = monoData.totalViews || 0;
        const balance    = (totalViews * RATE_PER_VIEW).toFixed(5);

        document.getElementById("totalViewsDisplay").textContent = totalViews.toLocaleString();
        document.getElementById("balanceDisplay").textContent    = `$${balance}`;
    });
}

// ── TEKSHIRISH TUGMASI ────────────────────────────────────
document.getElementById("checkBtn").addEventListener("click", async () => {
    const overlay = document.getElementById("checkingOverlay");
    const btn     = document.getElementById("checkBtn");

    overlay.classList.remove("hidden");
    btn.disabled = true;

    try {
        await delay(1800);

        const querySnap = await getDocs(collection(db, "posts"));
        if (querySnap.empty) {
            overlay.classList.add("hidden");
            btn.disabled = false;
            showAlert("❌", "No posts found!");
            return;
        }

        let totalLikes = 0;
        querySnap.forEach(docSnap => {
            const post = docSnap.data();
            if (String(post.userId) !== userId) return;
            totalLikes += Object.keys(post.likes_users || {}).length;
        });

        overlay.classList.add("hidden");

        if (totalLikes < 100) {
            showAlert("❌", `You have ${totalLikes} likes. At least 100 needed for monetization!`);
            btn.disabled = false;
            return;
        }

        // Monetizatsiya allaqachon yoqilganmi?
        const userSnap = await getDoc(doc(db, "users", userId));
        const monoData = userSnap.exists() ? (userSnap.data().monetization || null) : null;

        if (monoData && monoData.enabled) {
            showAlert("✅", "Monetization is already enabled!");
            showActiveState(monoData);
            btn.disabled = false;
            return;
        }

        // Monetizatsiyani yoqamiz — Firestore ga yozamiz
        await setDoc(doc(db, "users", userId), {
            monetization: {
                enabled:   true,
                enabledAt: Date.now(),
                totalViews: 0,
                balance:   0
            }
        }, { merge: true });

        showAlert("🎉", "Congratulations! Monetization has been successfully enabled!");
        showActiveState({ enabled: true, totalViews: 0 });

    } catch (e) {
        console.error("Tekshirishda xatolik:", e);
        overlay.classList.add("hidden");
        btn.disabled = false;
        showAlert("⚠️", "An error occurred. Please try again.");
    }
});

// ── YORDAMCHI FUNKSIYALAR ─────────────────────────────────
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showAlert(icon, message) {
    const existing = document.getElementById("alertModal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "alertModal";
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;`;
    modal.innerHTML = `
        <div style="background:#161b22;border:1px solid #30363d;border-radius:20px;padding:32px 24px;max-width:300px;width:100%;text-align:center;">
            <div style="font-size:48px;margin-bottom:14px;">${icon}</div>
            <p style="font-size:15px;color:#f0f6fc;line-height:1.5;">${message}</p>
            <button onclick="document.getElementById('alertModal').remove()" style="margin-top:20px;padding:12px 32px;background:linear-gradient(45deg,#00ffff,#00bbff);color:#000;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">OK</button>
        </div>`;
    document.body.appendChild(modal);
}

// ── KO'RISH QAYD QILISH (export — reels.js chaqiradi) ─────
export async function recordPostView(postId, viewerUserId) {
    try {
        const postRef  = doc(db, "posts", postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return;

        const post        = postSnap.data();
        const postOwnerId = String(post.userId);

        // Post egasining monetizatsiyasi yoqilganmi?
        const ownerSnap = await getDoc(doc(db, "users", postOwnerId));
        if (!ownerSnap.exists()) return;
        const ownerMono = ownerSnap.data().monetization || {};
        if (!ownerMono.enabled) return;

        // Ko'ruvchining oxirgi ko'rish vaqtini tekshiramiz
        const postViews  = post.post_views || {};
        const userView   = postViews[viewerUserId] || {};
        const now        = Date.now();
        const lastSeen   = userView.lastSeen || 0;

        // 2 soat o'tmagan bo'lsa — hisoblamaymiz
        if (now - lastSeen < VIEW_COOLDOWN_MS) return;

        // post_views ni yangilaymiz
        await updateDoc(postRef, {
            [`post_views.${viewerUserId}.lastSeen`]: now
        });

        // Post egasining totalViews ni oshiramiz (atomik)
        await updateDoc(doc(db, "users", postOwnerId), {
            "monetization.totalViews": increment(1)
        });

    } catch (e) {
        console.error("Error while recording view:", e);
    }
}

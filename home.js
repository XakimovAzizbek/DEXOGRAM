// ── FIRESTORE versiyasi ────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection, getDocs,
    doc, getDoc, updateDoc, deleteField,
    onSnapshot
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

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Link orqali kirgan bo'lsa — share_reels.html ga yo'naltirish
const startParam = tg.initDataUnsafe?.start_param;
if (startParam) {
    window.location.href = "share_reels.html";
}

const user = tg.initDataUnsafe?.user || {
    id: "777",
    username: "DexoGram",
    first_name: "DEXOGRAM"
};

document.getElementById("userBadge").innerText = `@${user.username}`;

// ── POSTLARNI YUKLASH ─────────────────────────────────────
async function loadFeed() {
    const feedContainer = document.getElementById("feedContainer");

    try {
        const querySnap = await getDocs(collection(db, "posts"));
        feedContainer.innerHTML = "";

        if (querySnap.empty) {
            feedContainer.innerHTML = `<div class="loading">There are no posts yet. Be the first to post!</div>`;
            return;
        }

        const postsArray = querySnap.docs.map(docSnap => {
            const post = docSnap.data();
            const likesObj     = post.likes_users   || {};
            const likesCount   = Object.keys(likesObj).length;
            const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
            return { id: docSnap.id, ...post, likesCount, commentsCount };
        });

        // TOP 5: eng ko'p layk + koment
        const top5 = postsArray
            .sort((a, b) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount))
            .slice(0, 5);

        if (top5.length === 0) {
            feedContainer.innerHTML = `<div class="loading">Hozircha post yo'q.</div>`;
            return;
        }

        top5.forEach((post, index) => {
            const card = document.createElement("div");
            card.className = "post-card";
            const hasLiked = post.likes_users && post.likes_users[user.id] ? "liked" : "";

            card.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar"></div>
                    <div class="post-username">@${post.username || 'anonim'}</div>
                    <div class="top-badge">#${index + 1} Top</div>
                </div>
                <video class="post-video" src="${post.video_url}" controls loop playsinline></video>
                <div class="post-actions">
                    <button class="action-btn ${hasLiked}" data-id="${post.id}">
                        <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.5 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </button>
                </div>
                <div class="post-info">
                    <div class="likes-count" id="likes-count-${post.id}">${post.likesCount} ta layk · ${post.commentsCount} ta izoh</div>
                    <div class="post-caption"><span>@${post.username || 'anonim'}</span> ${post.caption || ''}</div>
                </div>
            `;

            const likeBtn = card.querySelector(".action-btn");
            likeBtn.addEventListener("click", () => toggleLike(post.id, likeBtn));
            feedContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Xatolik:", error);
        feedContainer.innerHTML = `<div class="loading" style="color:red;">Ma'lumotlarni yuklashda xatolik!</div>`;
    }
}

// ── LAYK ─────────────────────────────────────────────────
async function toggleLike(postId, button) {
    const postRef     = doc(db, "posts", postId);
    const likesCountEl = document.getElementById(`likes-count-${postId}`);

    try {
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) return;

        const postData  = postSnap.data();
        const likesUsers = postData.likes_users || {};

        if (likesUsers[user.id]) {
            // Laykni olamiz
            await updateDoc(postRef, { [`likes_users.${user.id}`]: deleteField() });
            button.classList.remove("liked");
        } else {
            // Layk qo'shamiz
            await updateDoc(postRef, { [`likes_users.${user.id}`]: true });
            button.classList.add("liked");
        }

        // Yangilangan son
        const updatedSnap = await getDoc(postRef);
        if (updatedSnap.exists()) {
            const d = updatedSnap.data();
            const newLikes    = Object.keys(d.likes_users || {}).length;
            const newComments = Object.keys(d.comments   || {}).length;
            likesCountEl.innerText = `${newLikes} ta layk · ${newComments} ta izoh`;
        }
    } catch (error) {
        console.error("Layk bosishda xatolik:", error);
    }
}

window.onload = loadFeed;

// ── PUSH NOTIFICATION (Firestore) ─────────────────────────
(function initPushNotification() {
    const pushNotif    = document.getElementById("pushNotif");
    const pushClose    = document.getElementById("pushClose");
    const pushTitle    = document.getElementById("pushTitle");
    const pushDesc     = document.getElementById("pushDesc");
    const pushBtn      = document.getElementById("pushActionBtn");
    const pushProgress = document.getElementById("pushProgress");

    let hideTimer = null;

    function showPush(data) {
        if (hideTimer) clearTimeout(hideTimer);

        pushTitle.textContent = data.title       || "";
        pushDesc.textContent  = data.description || "";

        if (data.buttonText && data.buttonLink) {
            pushBtn.textContent   = data.buttonText;
            pushBtn.href          = data.buttonLink;
            pushBtn.style.display = "inline-block";
        } else {
            pushBtn.style.display = "none";
        }

        pushProgress.style.transition = "none";
        pushProgress.style.width      = "100%";
        pushNotif.style.display       = "flex";

        requestAnimationFrame(() => pushNotif.classList.add("push-show"));

        setTimeout(() => {
            pushProgress.style.transition = "width 10s linear";
            pushProgress.style.width      = "0%";
        }, 50);

        hideTimer = setTimeout(() => hidePush(), 10000);
    }

    function hidePush() {
        if (hideTimer) clearTimeout(hideTimer);
        pushNotif.classList.remove("push-show");
        setTimeout(() => { pushNotif.style.display = "none"; }, 400);
    }

    pushClose.addEventListener("click", hidePush);

    // Firestore real-time tinglash
    onSnapshot(doc(db, "pushNotification", "main"), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.enabled === true) {
            showPush(data);
        } else {
            hidePush();
        }
    });
})();

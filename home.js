// 1. Firebase Modullarini CDN orqali import qilamiz
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, runTransaction, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 2. Sizning Firebase Konfiguratsiyangiz
const firebaseConfig = {
  apiKey: "AIzaSyBPTYL-3jOhcLi9UkjQWmSG6ArRVio5QKE",
  authDomain: "loyiha-98a22.firebaseapp.com",
  projectId: "loyiha-98a22",
  storageBucket: "loyiha-98a22.firebasestorage.app",
  messagingSenderId: "1022023262123",
  appId: "1:1022023262123:web:55c0bcf456391fdf80fcee",
  measurementId: "G-PPR0TL0CLX"
};

// 3. Firebase-ni ishga tushiramiz
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 4. Telegram WebApp API sozlamalari
const tg = window.Telegram.WebApp;
tg.expand();

// LINK ORQALI KIRGAN BO'LSA - share_reels.html GA YO'NALTIRISH
// https://t.me/dexogram_bot/dexo?startapp=POST_ID
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

// 5. Postlarni yuklash - faqat TOP 5 ta (eng ko'p layk + koment)
async function loadFeed() {
    const feedContainer = document.getElementById("feedContainer");
    const postsRef = ref(db, 'posts');

    try {
        const snapshot = await get(postsRef);
        feedContainer.innerHTML = "";

        if (!snapshot.exists()) {
            feedContainer.innerHTML = `<div class="loading">There are no posts yet. Be the first to post.!</div>`;
            return;
        }

        const data = snapshot.val();

        // Har bir postning layk va koment sonini hisoblaymiz
        // Reels bilan bir xil format: likes_users ob'ekti ishlatiladi
        const postsArray = Object.keys(data).map(key => {
            const post = data[key];

            // Layklar likes_users ob'ektida saqlanadi (reels bilan bir xil)
            const likesObj = post.likes_users || {};
            const likesCount = Object.keys(likesObj).length;

            // Komentlar soni
            const commentsCount = post.comments ? Object.keys(post.comments).length : 0;

            return {
                id: key,
                ...post,
                likesCount,
                commentsCount
            };
        });

        // TOP 5 ta: eng ko'p layk + koment yig'gan postlar
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

            // Foydalanuvchi bu postga layk bosganmi — likes_users dan tekshiramiz
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

            // Layk tugmasi
            const likeBtn = card.querySelector(".action-btn");
            likeBtn.addEventListener("click", () => toggleLike(post.id, likeBtn));

            feedContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Xatolik yuz berdi:", error);
        feedContainer.innerHTML = `<div class="loading" style="color:red;">Ma'lumotlarni yuklashda xatolik yuz berdi!</div>`;
    }
}

// 6. Layk bosish — reels bilan bir xil likes_users formatida
async function toggleLike(postId, button) {
    const likeRef = ref(db, `posts/${postId}/likes_users/${user.id}`);
    const likesCountEl = document.getElementById(`likes-count-${postId}`);

    try {
        const snapshot = await get(likeRef);

        if (snapshot.exists()) {
            // Laykni olib tashlaymiz
            await set(likeRef, null);
            button.classList.remove("liked");
        } else {
            // Layk qo'shamiz
            await set(likeRef, true);
            button.classList.add("liked");
        }

        // Yangilangan layk sonini Firebase'dan o'qib ekranda ko'rsatamiz
        const postSnapshot = await get(ref(db, `posts/${postId}`));
        if (postSnapshot.exists()) {
            const post = postSnapshot.val();
            const newLikesCount = Object.keys(post.likes_users || {}).length;
            const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
            likesCountEl.innerText = `${newLikesCount} ta layk · ${commentsCount} ta izoh`;
        }

    } catch (error) {
        console.error("Layk bosishda xatolik:", error);
    }
}

// Sahifa ochilishi bilan feedni yuklaymiz
window.onload = loadFeed;
// ── PUSH NOTIFICATION ─────────────────────────────────────
// Firebase: pushNotification/{enabled, title, description, buttonText, buttonLink}
// Faqat shu qism qo'shildi — boshqa hech narsa o'zgartirilmadi
(function initPushNotification() {
    const pushNotif   = document.getElementById("pushNotif");
    const pushClose   = document.getElementById("pushClose");
    const pushTitle   = document.getElementById("pushTitle");
    const pushDesc    = document.getElementById("pushDesc");
    const pushBtn     = document.getElementById("pushActionBtn");
    const pushProgress = document.getElementById("pushProgress");

    let hideTimer    = null;
    let progInterval = null;

    function showPush(data) {
        // Eski timerni o'chiramiz
        if (hideTimer)    clearTimeout(hideTimer);
        if (progInterval) clearInterval(progInterval);

        pushTitle.textContent = data.title       || "";
        pushDesc.textContent  = data.description || "";

        if (data.buttonText && data.buttonLink) {
            pushBtn.textContent = data.buttonText;
            pushBtn.href        = data.buttonLink;
            pushBtn.style.display = "inline-block";
        } else {
            pushBtn.style.display = "none";
        }

        // Progress bar
        pushProgress.style.transition = "none";
        pushProgress.style.width      = "100%";

        pushNotif.style.display = "flex";
        // Animate in
        requestAnimationFrame(() => {
            pushNotif.classList.add("push-show");
        });

        // Progress bar animatsiyasi 10 soniya
        setTimeout(() => {
            pushProgress.style.transition = "width 10s linear";
            pushProgress.style.width      = "0%";
        }, 50);

        // 10 soniyadan keyin yashiramiz
        hideTimer = setTimeout(() => hidePush(), 10000);
    }

    function hidePush() {
        if (hideTimer)    clearTimeout(hideTimer);
        if (progInterval) clearInterval(progInterval);
        pushNotif.classList.remove("push-show");
        setTimeout(() => { pushNotif.style.display = "none"; }, 400);
    }

    pushClose.addEventListener("click", hidePush);

    // Firebase dan real-time tinglash
    onValue(ref(db, "pushNotification"), (snap) => {
        if (!snap.exists()) return;
        const data = snap.val();
        if (data.enabled === true) {
            showPush(data);
        } else {
            hidePush();
        }
    });
})();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user || { id: "777", username: "DexoGram" };

// =============================================
// POST ID NI OLISH
// Link: https://t.me/dexogram_bot/dexo?startapp=POST_ID
// Telegram uni tg.initDataUnsafe.start_param yoki
// URLdan tgWebAppStartParam sifatida beradi
// =============================================
function getPostId() {
    // 1. Telegram start_param (eng ishonchli)
    const startParam = tg.initDataUnsafe?.start_param;
    if (startParam) return startParam;

    // 2. URL parametrlaridan (fallback)
    const urlParams = new URLSearchParams(window.location.search);
    const tgParam = urlParams.get("tgWebAppStartParam");
    if (tgParam) return tgParam;

    // 3. Hash dan (fallback)
    const hash = window.location.hash.replace("#", "");
    if (hash) return hash;

    return null;
}

// =============================================
// ASOSIY FUNKSIYA
// =============================================
async function loadSharedVideo() {
    const postId = getPostId();

    if (!postId) {
        showError();
        return;
    }

    try {
        const postSnap = await get(ref(db, `posts/${postId}`));

        if (!postSnap.exists()) {
            showError();
            return;
        }

        const post = postSnap.val();

        // Elementlarni to'ldirish
        const video = document.getElementById("reelVideo");
        video.src = post.video_url;

        document.getElementById("reelUserId").textContent = `👤 ID: ${post.userId}`;
        document.getElementById("reelCaption").textContent = post.caption || "";

        // Layklar
        const likesObj = post.likes_users || {};
        const likesCount = Object.keys(likesObj).length;
        document.getElementById("likeCount").textContent = likesCount;

        const isLiked = likesObj[user.id];
        if (isLiked) {
            document.getElementById("likeIcon").textContent = "❤️";
            document.getElementById("likeBtn").classList.add("liked");
        }

        // Komentlar soni
        const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
        document.getElementById("commentCount").textContent = commentsCount;

        // Ekranga chiqarish
        document.getElementById("loadingScreen").classList.add("hidden");
        document.getElementById("reelWrapper").classList.remove("hidden");

        // Videoni ishga tushirish
        video.muted = true;
        video.play().catch(() => {});

        // Tugmalarni ulash
        setupControls(postId, post);
        setupComments(postId);

    } catch (e) {
        console.error("Xatolik:", e);
        showError();
    }
}

// =============================================
// TUGMALAR
// =============================================
function setupControls(postId, post) {
    const video = document.getElementById("reelVideo");
    const audioIcon = document.getElementById("audioIcon");
    const likeBtn = document.getElementById("likeBtn");
    const commentBtn = document.getElementById("commentBtn");
    const shareBtn = document.getElementById("shareBtn");
    let muted = true;
    let pressTimer;

    // Video bosish — ovoz / pauza
    video.addEventListener("pointerdown", () => {
        pressTimer = setTimeout(() => video.pause(), 300);
    });

    video.addEventListener("pointerup", () => {
        clearTimeout(pressTimer);
        if (video.paused) {
            video.play();
        } else {
            muted = !muted;
            video.muted = muted;
            audioIcon.textContent = muted ? "🔇" : "🔊";
            audioIcon.style.opacity = "1";
            setTimeout(() => audioIcon.style.opacity = "0", 600);
        }
    });

    // Layk
    likeBtn.addEventListener("click", async () => {
        const likeRef = ref(db, `posts/${postId}/likes_users/${user.id}`);
        const likeCountEl = document.getElementById("likeCount");

        if (likeBtn.classList.contains("liked")) {
            await set(likeRef, null);
            likeBtn.classList.remove("liked");
            document.getElementById("likeIcon").textContent = "🤍";
            likeCountEl.textContent = Math.max(0, parseInt(likeCountEl.textContent) - 1);
        } else {
            await set(likeRef, true);
            likeBtn.classList.add("liked");
            document.getElementById("likeIcon").textContent = "❤️";
            likeCountEl.textContent = parseInt(likeCountEl.textContent) + 1;
        }
    });

    // Koment
    commentBtn.addEventListener("click", () => {
        document.getElementById("commentModal").classList.remove("hidden");
    });

    // Ulashish — xuddi reels dagi kabi
    shareBtn.addEventListener("click", () => {
        const miniAppShareUrl = `https://t.me/dexogram_bot/dexo?startapp=${postId}`;
        const shareText = "Dexogram-da ajoyib videoni ko'ring! 🎬";
        tg.openTelegramLink(
            `https://t.me/share/url?url=${encodeURIComponent(miniAppShareUrl)}&text=${encodeURIComponent(shareText)}`
        );
    });

    // Modal yopish
    document.getElementById("closeCommentBtn").addEventListener("click", () => {
        document.getElementById("commentModal").classList.add("hidden");
    });
    document.getElementById("modalBackdrop").addEventListener("click", () => {
        document.getElementById("commentModal").classList.add("hidden");
    });
}

// =============================================
// SHARHLAR
// =============================================
function setupComments(postId) {
    const commentsRef = ref(db, `posts/${postId}/comments`);
    const commentsList = document.getElementById("commentsList");
    const commentInput = document.getElementById("commentInput");
    const sendBtn = document.getElementById("sendCommentBtn");

    // Real-time yangilanish
    onValue(commentsRef, (snapshot) => {
        commentsList.innerHTML = "";
        const data = snapshot.val();

        if (!data) {
            commentsList.innerHTML = `<div style="text-align:center;color:#8e8e8e;padding:20px;">Hali izohlar yo'q. Birinchi bo'ling!</div>`;
            document.getElementById("commentCount").textContent = 0;
            return;
        }

        const comments = Object.values(data);
        document.getElementById("commentCount").textContent = comments.length;

        comments.forEach(comment => {
            commentsList.insertAdjacentHTML("beforeend", `
                <div class="comment-item">
                    <img src="https://ui-avatars.com/api/?name=${comment.userId}&background=random&color=fff" class="comment-avatar" alt="avatar">
                    <div>
                        <span class="comment-user">ID: ${comment.userId}</span>
                        <span class="comment-text">${comment.text}</span>
                    </div>
                </div>
            `);
        });

        commentsList.scrollTop = commentsList.scrollHeight;
    });

    // Izoh yuborish
    sendBtn.addEventListener("click", async () => {
        const text = commentInput.value.trim();
        if (!text) return;

        const newRef = push(ref(db, `posts/${postId}/comments`));
        await set(newRef, {
            userId: user.id,
            text: text,
            timestamp: Date.now()
        });

        commentInput.value = "";
    });
}

// =============================================
// XATOLIK EKRANI
// =============================================
function showError() {
    document.getElementById("loadingScreen").classList.add("hidden");
    document.getElementById("errorScreen").classList.remove("hidden");
}

// =============================================
// ISHGA TUSHIRISH
// =============================================
loadSharedVideo();

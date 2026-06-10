import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update, push, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Firebase Sozlamalari
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

// 2. Telegram WebApp ma'lumotlari
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || {
    id: "777",
    username: "DexoGram"
};

const reelsContainer = document.getElementById("reelsContainer");
const commentModal = document.getElementById("commentModal");
const closeCommentBtn = document.getElementById("closeCommentBtn");
const modalBackdrop = document.getElementById("modalBackdrop");
const commentsList = document.getElementById("commentsList");
const commentInput = document.getElementById("commentInput");
const sendCommentBtn = document.getElementById("sendCommentBtn");

let activeCommentPostId = null;
let globalMuted = true;

// REKLAMA MANTIQI UCHUN O'ZGARUVCHILAR
let userViewCount = 0; 
const AD_TRIGGER_COUNT = 9;
let globalObserver = null;

// Ko'rish uchun 2 soat cooldown (millisekund)
const VIEW_COOLDOWN_MS = 2 * 60 * 60 * 1000;

// =============================================
// YANGI: DexoGram (ID:777) videolari uchun
// maxsus layk animatsiyasi CSS — bir marta inject
// =============================================
(function injectDexoAnimStyle() {
    if (document.getElementById('dexo-like-style')) return;
    const style = document.createElement('style');
    style.id = 'dexo-like-style';
    style.textContent = `
        @keyframes dexoLikePop {
            0%   { transform: translate(-50%, -50%) scale(0) rotate(-20deg); opacity: 1; }
            40%  { transform: translate(-50%, -50%) scale(1.6) rotate(10deg); opacity: 1; }
            65%  { transform: translate(-50%, -50%) scale(1.1) rotate(-5deg); opacity: 1; }
            80%  { transform: translate(-50%, -50%) scale(1.3) rotate(0deg);  opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(0.5) rotate(0deg);  opacity: 0; }
        }
        @keyframes dexoLikeIconPop {
            0%   { transform: scale(1); }
            30%  { transform: scale(0.6); }
            60%  { transform: scale(1.3); }
            100% { transform: scale(1); }
        }
        .dexo-like-img {
            position: absolute;
            width: 64px;
            height: 64px;
            object-fit: contain;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%) scale(0);
            pointer-events: none;
            z-index: 9999;
            animation: dexoLikePop 0.7s cubic-bezier(.36,.07,.19,.97) forwards;
        }
        .dexo-icon-pop {
            animation: dexoLikeIconPop 0.4s ease forwards !important;
        }
    `;
    document.head.appendChild(style);
})();

// =============================================
// YANGI: DexoGram layk animatsiyasini ishga tushirish
// faqat postOwnerId === "777" bo'lganda chaqiriladi
// =============================================
function playDexoLikeAnimation(likeBtn) {
    // Eski animatsiyalarni tozalaymiz
    likeBtn.querySelectorAll('.dexo-like-img').forEach(el => el.remove());

    // dexogram.png rasm yaratamiz
    const img = document.createElement('img');
    img.src = 'https://xakimovazizbek.github.io/DEXOGRAM/dexogram.png';
    img.className = 'dexo-like-img';
    img.draggable = false;

    // Tugma relative bo'lishi kerak
    likeBtn.style.position = 'relative';
    likeBtn.style.overflow = 'visible';
    likeBtn.appendChild(img);

    // Tugmadagi ikonkani ham qisqacha "pop" qilishini
    const iconEl = likeBtn.querySelector('.icon');
    if (iconEl) {
        iconEl.classList.remove('dexo-icon-pop');
        void iconEl.offsetWidth; // reflow — animatsiyani qayta boshlash uchun
        iconEl.classList.add('dexo-icon-pop');
    }

    // 700ms keyin rasm o'chiriladi
    img.addEventListener('animationend', () => {
        img.remove();
        if (iconEl) iconEl.classList.remove('dexo-icon-pop');
    });
}

// Firebase'dan foydalanuvchining ko'rishlar sonini yuklash
async function loadUserViewCount() {
    const userRef = ref(db, `users/${user.id}/viewCount`);
    try {
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            userViewCount = snapshot.val();
        } else {
            userViewCount = 0;
        }
    } catch (e) {
        console.error("Error loading counter:", e);
    }
}

// =============================================
// MONETIZATSIYA: Ko'rishni qayd qilish
// =============================================
async function recordPostView(postId, viewerUserId) {
    try {
        const postSnap = await get(ref(db, `posts/${postId}`));
        if (!postSnap.exists()) return;

        const post = postSnap.val();
        const postOwnerId = String(post.userId);

        const monoSnap = await get(ref(db, `users/${postOwnerId}/monetization`));
        if (!monoSnap.exists() || !monoSnap.val().enabled) return;

        const viewRef = ref(db, `posts/${postId}/post_views/${viewerUserId}`);
        const viewSnap = await get(viewRef);

        const now = Date.now();

        if (viewSnap.exists()) {
            const lastSeen = viewSnap.val().lastSeen || 0;
            if (now - lastSeen < VIEW_COOLDOWN_MS) return;
        }

        await set(viewRef, { lastSeen: now });

        const monoData = monoSnap.val();
        const newTotal = (monoData.totalViews || 0) + 1;
        await update(ref(db, `users/${postOwnerId}/monetization`), {
            totalViews: newTotal
        });

    } catch (e) {
        console.error("Error while recording view:", e);
    }
}

// 3. Firebase'dan postlarni yuklab olish va ekranga chiqarish
const postsRef = ref(db, 'posts');

async function initReels() {
    await loadUserViewCount();

    get(postsRef).then((snapshot) => {
        reelsContainer.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        // Postlarni random tartibda chiqarish — Fisher-Yates shuffle
        const postsArray = Object.entries(data);
        for (let i = postsArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [postsArray[i], postsArray[j]] = [postsArray[j], postsArray[i]];
        }

        postsArray.forEach(([postId, post]) => {
            const likesObj = post.likes_users || {};
            const likesCount = Object.keys(likesObj).length;
            const isLiked = likesObj[user.id] ? "liked" : "";
            const likeIcon = likesObj[user.id] ? "❤️" : "🤍";
            const commentsCount = post.comments ? Object.keys(post.comments).length : 0;

            // data-owner-id qo'shamiz — layk animatsiyasi uchun kerak
            const reelHTML = `
                <div class="reel-post real-video-post" id="post_${postId}" data-post-id="${postId}" data-owner-id="${post.userId}">
                    <video src="${post.video_url}" class="reel-video" loop playsinline webkit-playsinline muted preload="auto"></video>
                    
                    <div class="audio-status-icon">🔊</div>

                    <div class="reel-overlay-left">
                        <div class="reel-user-id" id="userId_${postId}">👤 ID: ${post.userId}</div>
                        <div class="reel-caption">${post.caption || ''}</div>
                    </div>

                    <div class="reel-overlay-right">
                        <button class="action-btn ${isLiked}" id="likeBtn_${postId}">
                            <span class="icon">${likeIcon}</span>
                            <span id="likeCount_${postId}">${likesCount}</span>
                        </button>
                        <button class="action-btn" id="commentBtn_${postId}">
                            <span>💬</span>
                            <span>${commentsCount}</span>
                        </button>
                        <button class="action-btn" id="shareBtn_${postId}">
                            <span>✈️</span>
                            <span>Ulashish</span>
                        </button>
                    </div>
                </div>
            `;
            reelsContainer.insertAdjacentHTML('beforeend', reelHTML);
            setupVideoControls(postId);
            checkVerifiedBadge(postId, String(post.userId));
        });

        if (userViewCount >= AD_TRIGGER_COUNT) {
            const firstPost = reelsContainer.querySelector('.real-video-post');
            if (firstPost) {
                insertAdCardAfterElement(firstPost);
            }
        }

        handleIntersectionObserver();
    });
}

// Reklamani aynan kerakli elementdan keyingi o'ringa joylashtirish
function insertAdCardAfterElement(element) {
    const oldAd = document.getElementById('adsgram_post');
    if (oldAd) oldAd.remove();
    
    const adHTML = `
        <div class="reel-post ad-post" id="adsgram_post">
            <iframe src="ads.html" class="ad-iframe" style="width:100%; height:100%; border:none;"></iframe>
            <div class="reel-overlay-left" style="bottom: 80px; z-index: 999;">
                <div class="reel-caption" style="background:rgba(0,0,0,0.7); padding:8px 12px; border-radius:8px; font-weight:bold; color:#00ffff;">
                    📢 Sponsored advertising (Adsgram)
                </div>
            </div>
        </div>
    `;
    element.insertAdjacentHTML('afterend', adHTML);
    
    const newAd = document.getElementById('adsgram_post');
    if (newAd && globalObserver) {
        globalObserver.observe(newAd);
    }
}

// 3b. Verified badge tekshirish
async function checkVerifiedBadge(postId, ownerId) {
    try {
        const verSnap = await get(ref(db, "users/" + ownerId + "/verified"));
        if (verSnap.exists() && verSnap.val() === true) {
            const userIdEl = document.getElementById("userId_" + postId);
            if (!userIdEl) return;
            const badge = document.createElement("img");
            badge.src = "https://xakimovazizbek.github.io/DEXOGRAM/6270448.png";
            badge.alt = "Tasdiqlangan";
            badge.draggable = false;
            badge.style.cssText = "width:18px; height:18px; margin-left:6px; vertical-align:middle; pointer-events:none; user-select:none; -webkit-user-select:none;";
            userIdEl.appendChild(badge);
        }
    } catch (e) {}
}

// 4. Video boshqaruv datchiklari
function setupVideoControls(postId) {
    const postEl = document.getElementById(`post_${postId}`);
    if (!postEl) return;

    const video = postEl.querySelector('.reel-video');
    const audioIcon = postEl.querySelector('.audio-status-icon');

    optimizeVideoBuffer(video);

    const likeBtn = document.getElementById(`likeBtn_${postId}`);
    const commentBtn = document.getElementById(`commentBtn_${postId}`);
    const shareBtn = document.getElementById(`shareBtn_${postId}`);

    // Post egasining ID sini DOM dan o'qiymiz
    const postOwnerId = String(postEl.dataset.ownerId || "");

    let pressTimer;

    video.addEventListener('pointerdown', (e) => {
        pressTimer = setTimeout(() => {
            video.pause();
        }, 300);
    });

    video.addEventListener('pointerup', (e) => {
        clearTimeout(pressTimer);
        if (video.paused) {
            video.play();
        } else {
            globalMuted = !globalMuted;
            document.querySelectorAll('.reel-video').forEach(v => v.muted = globalMuted);
            
            audioIcon.innerText = globalMuted ? "🔇" : "🔊";
            audioIcon.style.opacity = "1";
            setTimeout(() => audioIcon.style.opacity = "0", 600);
        }
    });

    likeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const likeRef = ref(db, `posts/${postId}/likes_users/${user.id}`);
        const likeCountEl = document.getElementById(`likeCount_${postId}`);
        const likeIconEl = likeBtn.querySelector('.icon');

        if (likeBtn.classList.contains('liked')) {
            // ── Laykni OLIB TASHLAYMIZ ──
            likeBtn.classList.remove('liked');
            if (likeIconEl) likeIconEl.textContent = '🤍';
            const cur = parseInt(likeCountEl.textContent) || 0;
            likeCountEl.textContent = Math.max(0, cur - 1);

            // Faqat ID:777 videosi bo'lsa — maxsus animatsiya
            if (postOwnerId === "777") {
                playDexoLikeAnimation(likeBtn);
            }

            await set(likeRef, null);
        } else {
            // ── Layk QO'SHAMIZ ──
            likeBtn.classList.add('liked');
            if (likeIconEl) likeIconEl.textContent = '❤️';
            const cur = parseInt(likeCountEl.textContent) || 0;
            likeCountEl.textContent = cur + 1;

            // Faqat ID:777 videosi bo'lsa — maxsus animatsiya
            if (postOwnerId === "777") {
                playDexoLikeAnimation(likeBtn);
            }

            await set(likeRef, true);
        }
    });

    commentBtn.addEventListener('click', () => {
        activeCommentPostId = postId;
        commentModal.hidden = false;
        loadComments(postId);
    });

    shareBtn.addEventListener('click', () => {
        const miniAppShareUrl = `https://t.me/dexogram_bot/dexo?startapp=${postId}`;
        const shareText = "Dexogram-da ajoyib videoni ko'ring! 🎬";
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(miniAppShareUrl)}&text=${encodeURIComponent(shareText)}`);
    });
}

// 4b. Video buffer va stream optimizatsiyasi
function optimizeVideoBuffer(video) {
    video.preload = "auto";

    if (video.readyState < 2) {
        video.load();
    }

    video.addEventListener("canplay", () => {
        if (!video.paused) return;
        if (video.dataset.shouldPlay === "true") {
            video.play().catch(() => {});
        }
    }, { once: false });

    video.addEventListener("waiting", () => {
        if (video.dataset.shouldPlay === "true") {
            video.play().catch(() => {});
        }
    });

    video.addEventListener("stalled", () => {
        if (video.dataset.shouldPlay === "true") {
            setTimeout(() => {
                video.load();
                video.play().catch(() => {});
            }, 500);
        }
    });

    video.addEventListener("error", () => {
        if (video.dataset.shouldPlay === "true") {
            setTimeout(() => {
                const currentSrc = video.src;
                video.src = "";
                video.src = currentSrc;
                video.load();
                video.play().catch(() => {});
            }, 1000);
        }
    });
}

// 5. Sharhlarni Firebase'dan yuklash
function loadComments(postId) {
    const commentsRef = ref(db, `posts/${postId}/comments`);
    onValue(commentsRef, (snapshot) => {
        commentsList.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            commentsList.innerHTML = `<div style="text-align:center;color:#8e8e8e;margin-top:20px;">Hali sharhlar yo'q. Birinchi bo'ling!</div>`;
            return;
        }

        Object.values(data).forEach(comment => {
            const commentHTML = `
                <div class="comment-item">
                    <img src="https://ui-avatars.com/api/?name=${comment.userId}&background=random&color=fff" class="comment-avatar" alt="avatar">
                    <div class="comment-details">
                        <span class="comment-user">ID: ${comment.userId}</span>
                        <span class="comment-text">${comment.text}</span>
                    </div>
                </div>
            `;
            commentsList.insertAdjacentHTML('beforeend', commentHTML);
        });
        commentsList.scrollTop = commentsList.scrollHeight;
    });
}

sendCommentBtn.addEventListener('click', async () => {
    const text = commentInput.value.trim();
    if (!text || !activeCommentPostId) return;

    const postCommentRef = ref(db, `posts/${activeCommentPostId}/comments`);
    const newCommentRef = push(postCommentRef);

    await set(newCommentRef, {
        userId: user.id,
        text: text,
        timestamp: Date.now()
    });

    commentInput.value = "";
});

closeCommentBtn.addEventListener('click', () => commentModal.hidden = true);
modalBackdrop.addEventListener('click', () => commentModal.hidden = true);

// 6. AVTOMATIK IJRO VA DINAMIK ORALIK REKLAMA TIZIMI
function handleIntersectionObserver() {
    let lastViewedPostId = null;

    globalObserver = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
            if (entry.target.classList.contains('real-video-post')) {
                const video = entry.target.querySelector('.reel-video');
                const currentPostId = entry.target.getAttribute('data-post-id');

                if (entry.isIntersecting) {
                    video.muted = globalMuted;
                    video.dataset.shouldPlay = "true";
                    video.play().catch(err => console.log("Auto-play blocked"));

                    if (lastViewedPostId !== currentPostId) {
                        lastViewedPostId = currentPostId;
                        userViewCount++;

                        await update(ref(db, `users/${user.id}`), {
                            viewCount: userViewCount
                        });

                        recordPostView(currentPostId, String(user.id));

                        if (userViewCount >= AD_TRIGGER_COUNT) {
                            insertAdCardAfterElement(entry.target);
                        }
                    }
                } else {
                    video.dataset.shouldPlay = "false";
                    video.pause();
                }
            } 
            else if (entry.target.classList.contains('ad-post')) {
                if (entry.isIntersecting) {
                    console.log("User is viewing an advertising post.");
                    
                    userViewCount = 0;
                    await update(ref(db, `users/${user.id}`), {
                        viewCount: userViewCount
                    });
                }
            }
        });
    }, { threshold: 0.6 });

    document.querySelectorAll('.reel-post').forEach(post => {
        globalObserver.observe(post);
    });
}

// Loyihani ishga tushirish
initReels();
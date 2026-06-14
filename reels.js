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
const user = tg.initDataUnsafe?.user || { id: "777", username: "DexoGram" };

const reelsContainer  = document.getElementById("reelsContainer");
const commentModal    = document.getElementById("commentModal");
const closeCommentBtn = document.getElementById("closeCommentBtn");
const modalBackdrop   = document.getElementById("modalBackdrop");
const commentsList    = document.getElementById("commentsList");
const commentInput    = document.getElementById("commentInput");
const sendCommentBtn  = document.getElementById("sendCommentBtn");

let activeCommentPostId = null;
let globalMuted         = true;

let userViewCount    = 0;
const AD_TRIGGER_COUNT = 9;
let globalObserver   = null;

const VIEW_COOLDOWN_MS = 2 * 60 * 60 * 1000;

// ── Tasdiqlangan foydalanuvchilar cache ──────────────────
const verifiedUsersCache = new Set();

async function loadVerifiedUsersCache() {
    try {
        const snap = await get(ref(db, "users"));
        if (!snap.exists()) return;
        Object.entries(snap.val()).forEach(([uid, d]) => {
            if (d.verified === true) verifiedUsersCache.add(uid);
        });
    } catch (e) {}
}

// ── DexoGram (777) layk animatsiyasi ────────────────────
(function injectDexoAnimStyle() {
    if (document.getElementById('dexo-like-style')) return;
    const s = document.createElement('style');
    s.id = 'dexo-like-style';
    s.textContent = `
        @keyframes dexoLikePop {
            0%   { transform:translate(-50%,-50%) scale(0) rotate(-20deg); opacity:1; }
            40%  { transform:translate(-50%,-50%) scale(1.6) rotate(10deg); opacity:1; }
            65%  { transform:translate(-50%,-50%) scale(1.1) rotate(-5deg); opacity:1; }
            80%  { transform:translate(-50%,-50%) scale(1.3) rotate(0deg);  opacity:1; }
            100% { transform:translate(-50%,-50%) scale(0.5) rotate(0deg);  opacity:0; }
        }
        @keyframes dexoLikeIconPop {
            0%  { transform:scale(1); }
            30% { transform:scale(0.6); }
            60% { transform:scale(1.3); }
            100%{ transform:scale(1); }
        }
        .dexo-like-img {
            position:absolute; width:64px; height:64px; object-fit:contain;
            left:50%; top:50%;
            transform:translate(-50%,-50%) scale(0);
            pointer-events:none; z-index:9999;
            animation:dexoLikePop 0.7s cubic-bezier(.36,.07,.19,.97) forwards;
        }
        .dexo-icon-pop { animation:dexoLikeIconPop 0.4s ease forwards !important; }
    `;
    document.head.appendChild(s);
})();

function playDexoLikeAnimation(likeBtn) {
    likeBtn.querySelectorAll('.dexo-like-img').forEach(el => el.remove());
    const img = document.createElement('img');
    img.src = 'https://xakimovazizbek.github.io/DEXOGRAM/dexogram.png';
    img.className = 'dexo-like-img';
    img.draggable = false;
    likeBtn.style.position = 'relative';
    likeBtn.style.overflow  = 'visible';
    likeBtn.appendChild(img);
    const iconEl = likeBtn.querySelector('.icon');
    if (iconEl) {
        iconEl.classList.remove('dexo-icon-pop');
        void iconEl.offsetWidth;
        iconEl.classList.add('dexo-icon-pop');
    }
    img.addEventListener('animationend', () => {
        img.remove();
        if (iconEl) iconEl.classList.remove('dexo-icon-pop');
    });
}

// ── viewCount ────────────────────────────────────────────
async function loadUserViewCount() {
    try {
        const snap = await get(ref(db, `users/${user.id}/viewCount`));
        userViewCount = snap.exists() ? snap.val() : 0;
    } catch (e) {}
}

// ── Rewards counter ──────────────────────────────────────
async function updateReelsRewardCounter() {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const r = ref(db, `users/${user.id}/rewards`);
        const snap = await get(r);
        const d = snap.exists() ? snap.val() : {};
        if (d.reelsWatchDate === today) {
            await update(r, { reelsWatchedToday: (d.reelsWatchedToday || 0) + 1 });
        } else {
            await update(r, { reelsWatchedToday: 1, reelsWatchDate: today });
        }
    } catch (e) {}
}

// ── Monetizatsiya ko'rish qayd ───────────────────────────
async function recordPostView(postId, viewerUserId) {
    try {
        const postSnap = await get(ref(db, `posts/${postId}`));
        if (!postSnap.exists()) return;
        const ownerId = String(postSnap.val().userId);
        const monoSnap = await get(ref(db, `users/${ownerId}/monetization`));
        if (!monoSnap.exists() || !monoSnap.val().enabled) return;
        const viewRef  = ref(db, `posts/${postId}/post_views/${viewerUserId}`);
        const viewSnap = await get(viewRef);
        const now = Date.now();
        if (viewSnap.exists() && now - (viewSnap.val().lastSeen || 0) < VIEW_COOLDOWN_MS) return;
        await set(viewRef, { lastSeen: now });
        const newTotal = (monoSnap.val().totalViews || 0) + 1;
        await update(ref(db, `users/${ownerId}/monetization`), { totalViews: newTotal });
    } catch (e) {}
}

// ════════════════════════════════════════════════════════
// VIDEO MENEJERI — bitta aktiv video boshqaruvchisi
// Maqsad: faqat ekrandagi videoga internet kuchi berilsin,
//         qolganlarning src ni bo'shatib tashlaymiz.
// ════════════════════════════════════════════════════════
let currentActiveVideo = null;  // hozir ijro etilayotgan video elementi
let currentActiveSrc   = null;  // uning asl URL si

// Videoni aktivlashtirish — internet kuchini shu videoga to'liq beradi
function activateVideo(video) {
    // Agar boshqa video aktiv bo'lsa — uni to'liq o'chirib qo'yamiz
    if (currentActiveVideo && currentActiveVideo !== video) {
        deactivateVideo(currentActiveVideo);
    }

    // data-src dan asl URL ni olamiz
    const src = video.dataset.src;
    if (!src) return;

    currentActiveVideo = video;
    currentActiveSrc   = src;

    // Agar src yo'q yoki boshqa src bo'lsa — qayta yuklaymiz
    if (video.getAttribute('src') !== src) {
        video.setAttribute('src', src);
        video.load();
    }

    video.dataset.shouldPlay = "true";
    video.muted = globalMuted;

    // canplay hodisasini kutamiz — buffer yetarli bo'lganda ijro boshlaymiz
    const tryPlay = () => {
        if (video.dataset.shouldPlay !== "true") return;
        video.play().catch(() => {});
    };

    if (video.readyState >= 3) {
        // Yetarli buffer bor — darhol ijro
        tryPlay();
    } else {
        video.addEventListener('canplay', tryPlay, { once: true });
    }
}

// Videoni deaktivlashtirish — internetni bo'shatadi
function deactivateVideo(video) {
    video.dataset.shouldPlay = "false";
    video.pause();
    // src ni tozalaymiz — brauzer bu video uchun tarmoqni to'xtatadi
    // va resursni keyingi videoga beradi
    video.removeAttribute('src');
    video.load(); // abort — tarmoq so'rovini bekor qiladi
    if (currentActiveVideo === video) {
        currentActiveVideo = null;
        currentActiveSrc   = null;
    }
}

// Video to'xtalib qolganda (buffer tugaса) — qayta urinish
function setupBufferRecovery(video) {
    // Faqat bir marta ulashimiz kerak — dataset bilan tekshiramiz
    if (video.dataset.bufferSetup === "1") return;
    video.dataset.bufferSetup = "1";

    video.addEventListener("waiting", () => {
        if (video.dataset.shouldPlay !== "true") return;
        // Buffer kutmoqda — brauzer o'zi yuklab oladi, biz kutamiz
        // Agar 3 soniyada ham boshlanmasa — src ni refresh qilamiz
        const waitTimer = setTimeout(() => {
            if (video.dataset.shouldPlay !== "true") return;
            if (video.paused) {
                const src = video.dataset.src;
                if (src) {
                    video.setAttribute('src', src);
                    video.load();
                    video.play().catch(() => {});
                }
            }
        }, 3000);
        // Agar o'zi boshlansa — timerni bekor qilamiz
        video.addEventListener('playing', () => clearTimeout(waitTimer), { once: true });
    });

    video.addEventListener("stalled", () => {
        if (video.dataset.shouldPlay !== "true") return;
        setTimeout(() => {
            if (video.dataset.shouldPlay !== "true") return;
            video.play().catch(() => {});
        }, 800);
    });

    video.addEventListener("error", () => {
        if (video.dataset.shouldPlay !== "true") return;
        setTimeout(() => {
            const src = video.dataset.src;
            if (!src) return;
            video.setAttribute('src', src);
            video.load();
            video.play().catch(() => {});
        }, 1500);
    });

    // ── Video oxiriga yetganda qayta boshlash (loop o'rniga)
    // Muammo: loop="true" ba'zan to'liq ko'rsatmay qayta boshlaydi
    // Yechim: ended hodisasida currentTime = 0 qilib o'zimiz boshlaymiz
    video.addEventListener("ended", () => {
        if (video.dataset.shouldPlay !== "true") return;
        video.currentTime = 0;
        video.play().catch(() => {});
    });
}

// ── Postlarni yuklash ─────────────────────────────────────
const postsRef = ref(db, 'posts');

async function initReels() {
    await Promise.all([loadUserViewCount(), loadVerifiedUsersCache()]);

    const snapshot = await get(postsRef);
    reelsContainer.innerHTML = "";
    const data = snapshot.val();
    if (!data) return;

    // Random tartib — Fisher-Yates shuffle
    const postsArray = Object.entries(data);
    for (let i = postsArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [postsArray[i], postsArray[j]] = [postsArray[j], postsArray[i]];
    }

    postsArray.forEach(([postId, post]) => {
        const likesObj     = post.likes_users || {};
        const likesCount   = Object.keys(likesObj).length;
        const isLiked      = likesObj[user.id] ? "liked" : "";
        const likeIcon     = likesObj[user.id] ? "❤️" : "🤍";
        const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
        const isVerified   = verifiedUsersCache.has(String(post.userId));
        const verifiedBadge = isVerified
            ? `<img src="https://xakimovazizbek.github.io/DEXOGRAM/6270448.png"
                    alt="✓" draggable="false"
                    style="width:18px;height:18px;margin-left:6px;vertical-align:middle;
                           pointer-events:none;user-select:none;-webkit-user-select:none;">`
            : "";

        // loop YO'Q — ended hodisasida o'zimiz boshqaramiz (to'liq ko'rsatish uchun)
        // preload="none" — src berilmaydi, faqat ekranga chiqqanda yuklanadi
        const reelHTML = `
            <div class="reel-post real-video-post"
                 id="post_${postId}"
                 data-post-id="${postId}"
                 data-owner-id="${post.userId}">
                <video class="reel-video"
                       playsinline webkit-playsinline muted
                       preload="none"
                       data-src="${post.video_url}"></video>

                <div class="audio-status-icon">🔊</div>

                <div class="reel-overlay-left">
                    <div class="reel-user-id" id="userId_${postId}">
                        👤 ID: ${post.userId}${verifiedBadge}
                    </div>
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
    });

    if (userViewCount >= AD_TRIGGER_COUNT) {
        const first = reelsContainer.querySelector('.real-video-post');
        if (first) insertAdCardAfterElement(first);
    }

    handleIntersectionObserver();
}

// ── Reklama kartasi ──────────────────────────────────────
function insertAdCardAfterElement(element) {
    const old = document.getElementById('adsgram_post');
    if (old) old.remove();
    const adHTML = `
        <div class="reel-post ad-post" id="adsgram_post">
            <iframe src="ads.html" style="width:100%;height:100%;border:none;"></iframe>
            <div class="reel-overlay-left" style="bottom:80px;z-index:999;">
                <div class="reel-caption"
                     style="background:rgba(0,0,0,0.7);padding:8px 12px;
                            border-radius:8px;font-weight:bold;color:#00ffff;">
                    📢 Sponsored advertising (Adsgram)
                </div>
            </div>
        </div>`;
    element.insertAdjacentHTML('afterend', adHTML);
    const newAd = document.getElementById('adsgram_post');
    if (newAd && globalObserver) globalObserver.observe(newAd);
}

// ── Video boshqaruv datchiklari ──────────────────────────
function setupVideoControls(postId) {
    const postEl   = document.getElementById(`post_${postId}`);
    if (!postEl) return;
    const video    = postEl.querySelector('.reel-video');
    const audioIcon = postEl.querySelector('.audio-status-icon');
    const likeBtn  = document.getElementById(`likeBtn_${postId}`);
    const commentBtn = document.getElementById(`commentBtn_${postId}`);
    const shareBtn = document.getElementById(`shareBtn_${postId}`);
    const postOwnerId = String(postEl.dataset.ownerId || "");

    // Buffer recovery bir marta ulaymiz
    setupBufferRecovery(video);

    let pressTimer;
    video.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(() => video.pause(), 300);
    });
    video.addEventListener('pointerup', () => {
        clearTimeout(pressTimer);
        if (video.paused) {
            video.play().catch(() => {});
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
        const likeRef    = ref(db, `posts/${postId}/likes_users/${user.id}`);
        const likeCountEl = document.getElementById(`likeCount_${postId}`);
        const likeIconEl  = likeBtn.querySelector('.icon');

        if (likeBtn.classList.contains('liked')) {
            likeBtn.classList.remove('liked');
            const cur = parseInt(likeCountEl.textContent) || 0;
            likeCountEl.textContent = Math.max(0, cur - 1);
            if (postOwnerId === "777") {
                playDexoLikeAnimation(likeBtn);
            } else {
                if (likeIconEl) likeIconEl.textContent = '🤍';
            }
            await set(likeRef, null);
        } else {
            likeBtn.classList.add('liked');
            const cur = parseInt(likeCountEl.textContent) || 0;
            likeCountEl.textContent = cur + 1;
            if (postOwnerId === "777") {
                playDexoLikeAnimation(likeBtn);
            } else {
                if (likeIconEl) likeIconEl.textContent = '❤️';
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
        const url  = `https://t.me/dexogram_bot/dexo?startapp=${postId}`;
        const text = "Dexogram-da ajoyib videoni ko'ring! 🎬";
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    });
}

// ── Sharhlar ─────────────────────────────────────────────
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
            commentsList.insertAdjacentHTML('beforeend', `
                <div class="comment-item">
                    <img src="https://ui-avatars.com/api/?name=${comment.userId}&background=random&color=fff"
                         class="comment-avatar" alt="avatar">
                    <div class="comment-details">
                        <span class="comment-user">ID: ${comment.userId}</span>
                        <span class="comment-text">${comment.text}</span>
                    </div>
                </div>
            `);
        });
        commentsList.scrollTop = commentsList.scrollHeight;
    });
}

sendCommentBtn.addEventListener('click', async () => {
    const text = commentInput.value.trim();
    if (!text || !activeCommentPostId) return;
    const r = push(ref(db, `posts/${activeCommentPostId}/comments`));
    await set(r, { userId: user.id, text, timestamp: Date.now() });
    commentInput.value = "";
});

closeCommentBtn.addEventListener('click', () => commentModal.hidden = true);
modalBackdrop.addEventListener('click',   () => commentModal.hidden = true);

// ── IntersectionObserver ──────────────────────────────────
function handleIntersectionObserver() {
    let lastViewedPostId = null;

    globalObserver = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {

            // ── HAQIQIY VIDEO POST ──
            if (entry.target.classList.contains('real-video-post')) {
                const video = entry.target.querySelector('.reel-video');
                const currentPostId = entry.target.getAttribute('data-post-id');

                if (entry.isIntersecting) {
                    // Internet kuchini faqat shu videoga beramiz
                    activateVideo(video);

                    if (lastViewedPostId !== currentPostId) {
                        lastViewedPostId = currentPostId;
                        userViewCount++;
                        update(ref(db, `users/${user.id}`), { viewCount: userViewCount });
                        recordPostView(currentPostId, String(user.id));
                        updateReelsRewardCounter();
                        if (userViewCount >= AD_TRIGGER_COUNT) {
                            insertAdCardAfterElement(entry.target);
                        }
                    }
                } else {
                    // Ekrandan chiqqan video — internetni bo'shatamiz
                    deactivateVideo(video);
                }
            }

            // ── REKLAMA POST ──
            else if (entry.target.classList.contains('ad-post')) {
                if (entry.isIntersecting) {
                    userViewCount = 0;
                    update(ref(db, `users/${user.id}`), { viewCount: 0 });
                }
            }
        });
    }, { threshold: 0.7 }); // 70% ko'ringanda faollashadi

    document.querySelectorAll('.reel-post').forEach(p => globalObserver.observe(p));
}

// Ishga tushirish
initReels();

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
let globalMuted = true; // Sukut bo'yicha videolar ovozsiz boshlanadi

// REKLAMA MANTIQI UCHUN O'ZGARUVCHILAR
let userViewCount = 0; 
const AD_TRIGGER_COUNT = 9; // 9 ta post ko'rilgandan keyin keyingisi reklama bo'ladi
let globalObserver = null; // Observerni dinamik yangilash uchun

// Ko'rish uchun 2 soat cooldown (millisekund)
const VIEW_COOLDOWN_MS = 2 * 60 * 60 * 1000;

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
// Bitta foydalanuvchi bitta videoni 2 soatda 1 marta ko'rishi hisoblanadi
// Post egasining monetizatsiyasi yoqiq bo'lsa totalViews oshadi
// =============================================
async function recordPostView(postId, viewerUserId) {
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

// 3. Firebase'dan postlarni yuklab olish va ekranga chiqarish
const postsRef = ref(db, 'posts');

async function initReels() {
    await loadUserViewCount(); // Birinchi bo'lib Firebase'dan hisoblagichni o'qiymiz

    get(postsRef).then((snapshot) => {
        reelsContainer.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        // Postlarni random (tasodifiy) tartibda chiqarish — Fisher-Yates shuffle
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

            const reelHTML = `
                <div class="reel-post real-video-post" id="post_${postId}" data-post-id="${postId}">
                    <video src="${post.video_url}" class="reel-video" loop playsinline webkit-playsinline muted preload="auto"></video>
                    
                    <div class="audio-status-icon">🔊</div>

                    <div class="reel-overlay-left">
                        <div class="reel-user-id">👤 ID: ${post.userId}</div>
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

        // AGAR FOYDALANUVCHI ALLAQACHON 9 TA POST KO'RIB KIRGAN BO'LSA
        // Uni birinchi turgan postdan keyinoq ko'rinadigan qilib joylaymiz (oxirida emas!)
        if (userViewCount >= AD_TRIGGER_COUNT) {
            const firstPost = reelsContainer.querySelector('.real-video-post');
            if (firstPost) {
                insertAdCardAfterElement(firstPost);
            }
        }

        handleIntersectionObserver();
    });
}

// Reklamani aynan kerakli elementdan (postdan) keyingi o'ringa joylashtirish funksiyasi
function insertAdCardAfterElement(element) {
    // Eski reklama bo'lsa o'chiramiz, chalkashlik bo'lmasligi uchun
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
    
    // Agar observer ishlayotgan bo'lsa, yangi reklamani ham kuzatuvga qo'shamiz
    const newAd = document.getElementById('adsgram_post');
    if (newAd && globalObserver) {
        globalObserver.observe(newAd);
    }
}

// 4. Video boshqaruv datchiklari (O'zgarishsiz qoldi)
function setupVideoControls(postId) {
    const postEl = document.getElementById(`post_${postId}`);
    if (!postEl) return;

    const video = postEl.querySelector('.reel-video');
    const audioIcon = postEl.querySelector('.audio-status-icon');

    // Video buffer optimizatsiyasi — past internetda ham ijro boshlaydi
    optimizeVideoBuffer(video);
    const likeBtn = document.getElementById(`likeBtn_${postId}`);
    const commentBtn = document.getElementById(`commentBtn_${postId}`);
    const shareBtn = document.getElementById(`shareBtn_${postId}`);

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
            // Laykni olib tashlaymiz - UI darhol yangilanadi
            likeBtn.classList.remove('liked');
            if (likeIconEl) likeIconEl.textContent = '🤍';
            const cur = parseInt(likeCountEl.textContent) || 0;
            likeCountEl.textContent = Math.max(0, cur - 1);
            await set(likeRef, null);
        } else {
            // Layk qo'shamiz - UI darhol yangilanadi
            likeBtn.classList.add('liked');
            if (likeIconEl) likeIconEl.textContent = '❤️';
            const cur = parseInt(likeCountEl.textContent) || 0;
            likeCountEl.textContent = cur + 1;
            await set(likeRef, true);
        }
    });

    commentBtn.addEventListener('click', () => {
        activeCommentPostId = postId;
        commentModal.hidden = false;
        loadComments(postId);
    });

    // shareBtn voqeasini quyidagicha o'zgartiring:
shareBtn.addEventListener('click', () => {
    // Siz so'ragan maxsus Mini App havolasi formatini quramiz
    // postId bu yerda Firebase'dagi postning unikal ID raqami (masalan: -O1abcde...)
    const miniAppShareUrl = `https://t.me/dexogram_bot/dexo?startapp=${postId}`;
    
    // Matn yaratamiz
    const shareText = "Dexogram-da ajoyib videoni ko'ring! 🎬";

    // Telegram'ning rasmiy ulashish oynasini ochamiz
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(miniAppShareUrl)}&text=${encodeURIComponent(shareText)}`);
});

}

// 4b. Video buffer va stream optimizatsiyasi
// Brauzerga: "Bu videoni qo'ldan kelgancha oldindan yukla" deb buyruq beramiz
// preload="auto" + video.load() + buffered tekshiruvi bilan
function optimizeVideoBuffer(video) {
    // Brauzer bu videoga maksimal resurs ajratsin
    video.preload = "auto";

    // Agar video hali boshlanmagan bo'lsa, load chaqirib cache'ga olamiz
    if (video.readyState < 2) { // HAVE_CURRENT_DATA dan kam
        video.load();
    }

    // canplay — birinchi 1MB+ kelganida darhol ijro boshlaydi (to'liq kutmaydi)
    video.addEventListener("canplay", () => {
        if (!video.paused) return;
        // IntersectionObserver ko'rinmoqda deb belgilagan bo'lsa ijro et
        if (video.dataset.shouldPlay === "true") {
            video.play().catch(() => {});
        }
    }, { once: false });

    // Agar video to'xtab qolsa (buffer tugasa) — avtomatik davom ettiradi
    video.addEventListener("waiting", () => {
        // Brauzer buffering qilyapti — play() ni qayta chaqiramiz
        // Bu signal beradi: "davom et, yuklashni to'xtatma"
        if (video.dataset.shouldPlay === "true") {
            video.play().catch(() => {});
        }
    });

    // Stall (tarmoq uzilib qolsa) — qayta urinib ko'ramiz
    video.addEventListener("stalled", () => {
        if (video.dataset.shouldPlay === "true") {
            setTimeout(() => {
                video.load();
                video.play().catch(() => {});
            }, 500);
        }
    });

    // Error bo'lsa (masalan timeout) — 1 soniya kutib qayta yuklaydi
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

// 5. Sharhlarni Firebase'dan yuklash (O'zgarishsiz qoldi)
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

// 6. AVTOMATIK IJRO VA DINAMIK ORALIK REKLAMA TIZIMI (To'liq yangilangan qism)
function handleIntersectionObserver() {
    let lastViewedPostId = null;

    globalObserver = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
            // Agar ko'rinayotgan element haqiqiy video post bo'lsa
            if (entry.target.classList.contains('real-video-post')) {
                const video = entry.target.querySelector('.reel-video');
                const currentPostId = entry.target.getAttribute('data-post-id');

                if (entry.isIntersecting) {
                    video.muted = globalMuted;
                    video.dataset.shouldPlay = "true";
                    video.play().catch(err => console.log("Auto-play blocked"));

                    // Faqat foydalanuvchi yangi postga scroll qilgandagina hisoblaymiz
                    if (lastViewedPostId !== currentPostId) {
                        lastViewedPostId = currentPostId;
                        userViewCount++;

                        // Firebase-ga yangilangan ko'rishlar sonini darhol yuboramiz
                        await update(ref(db, `users/${user.id}`), {
                            viewCount: userViewCount
                        });

                        // Monetizatsiya uchun ko'rishni qayd qilamiz (2 soat cooldown bilan)
                        recordPostView(currentPostId, String(user.id));

                        // KALIT MANTIQ: Agar hisoblagich 9 taga yetsa, reklamani oxiriga emas, 
                        // aynan hozir foydalanuvchi ko'rib turgan joriy postdan keyingi o'ringa (afterend) joylaymiz!
                        if (userViewCount >= AD_TRIGGER_COUNT) {
                            insertAdCardAfterElement(entry.target);
                        }
                    }
                } else {
                    video.dataset.shouldPlay = "false";
                    video.pause();
                }
            } 
            // Agar ko'rinayotgan element REKLAMA POSTI bo'lsa
            else if (entry.target.classList.contains('ad-post')) {
                if (entry.isIntersecting) {
                    console.log("User is viewing an advertising post.");
                    
                    // Reklama postiga o'tishi bilan Firebase hisoblagichini nollaymiz
                    userViewCount = 0;
                    await update(ref(db, `users/${user.id}`), {
                        viewCount: userViewCount
                    });
                }
            }
        });
    }, { threshold: 0.6 }); // 60% ekranda ko'rinsa faollashadi

    // Barcha mavjud elementlarni kuzatuvga olamiz
    document.querySelectorAll('.reel-post').forEach(post => {
        globalObserver.observe(post);
    });
}

// Loyihani ishga tushirish
initReels();
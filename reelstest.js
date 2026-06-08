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
    id: "999999",
    username: "Dexo_Test"
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

// Reklama uchun o'zgaruvchilar
let userViewCount = 0; 
const AD_INTERVAL = 9; // Har 9 ta postdan keyin reklama chiqadi

// Foydalanuvchining Firebase'dagi ko'rishlar sonini yuklab olish
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
        console.error("Hisoblagichni yuklashda xatolik:", e);
    }
}

// 3. Firebase'dan postlarni yuklab olish va ekranga chiqarish
const postsRef = ref(db, 'posts');

async function initReels() {
    await loadUserViewCount(); // Birinchi bo'lib eski hisoblagichni tiklaymiz

    onValue(postsRef, (snapshot) => {
        reelsContainer.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        const postsArray = Object.entries(data).reverse();
        let postCounter = 0;

        postsArray.forEach(([postId, post]) => {
            postCounter++;

            // Oddiy Reels Post yaratish
            const likesObj = post.likes_users || {};
            const likesCount = Object.keys(likesObj).length;
            const isLiked = likesObj[user.id] ? "liked" : "";
            const likeIcon = likesObj[user.id] ? "❤️" : "🤍";
            const commentsCount = post.comments ? Object.keys(post.comments).length : 0;

            const reelHTML = `
                <div class="reel-post real-video-post" id="post_${postId}" data-post-id="${postId}">
                    <video src="${post.video_url}" class="reel-video" loop playsinline webkit-playsinline muted></video>
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

            // KRITIK QISM: Har 9-chi postdan keyin sun'iy Adsgram reklama kartasini joylashtiramiz
            if (postCounter % AD_INTERVAL === 0) {
                const adHTML = `
                    <div class="reel-post ad-post" id="ad_post_${postCounter}">
                        <iframe src="ads.html" class="ad-iframe" style="width:100%; height:100%; border:none;"></iframe>
                        <div class="reel-overlay-left" style="bottom: 80px;">
                            <div class="reel-caption" style="background:rgba(0,0,0,0.6); padding:5px 10px; border-radius:5px;">
                                📢 Homiylik reklamsi (Adsgram)
                            </div>
                        </div>
                    </div>
                `;
                reelsContainer.insertAdjacentHTML('beforeend', adHTML);
            }
        });

        handleIntersectionObserver();
    });
}

// 4. Video boshqaruv datchiklari
function setupVideoControls(postId) {
    const postEl = document.getElementById(`post_${postId}`);
    if (!postEl) return;
    
    const video = postEl.querySelector('.reel-video');
    const audioIcon = postEl.querySelector('.audio-status-icon');
    const likeBtn = document.getElementById(`likeBtn_${postId}`);
    const commentBtn = document.getElementById(`commentBtn_${postId}`);
    const shareBtn = document.getElementById(`shareBtn_${postId}`);

    let pressTimer;

    video.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(() => { video.pause(); }, 300);
    });

    video.addEventListener('pointerup', () => {
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

    likeBtn.addEventListener('click', async () => {
        const likeRef = ref(db, `posts/${postId}/likes_users/${user.id}`);
        if (likeBtn.classList.contains('liked')) {
            await set(likeRef, null);
        } else {
            await set(likeRef, true);
        }
    });

    commentBtn.addEventListener('click', () => {
        activeCommentPostId = postId;
        commentModal.hidden = false;
        loadComments(postId);
    });

    shareBtn.addEventListener('click', () => {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(video.src)}&text=${encodeURIComponent("Dexogram-da ajoyib videoni ko'ring!")}`);
    });
}

// 5. Sharhlar bilan ishlash (O'zgarishsiz qoldi)
function loadComments(postId) {
    const commentsRef = ref(db, `posts/${postId}/comments`);
    onValue(commentsRef, (snapshot) => {
        commentsList.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            commentsList.innerHTML = `<div style="text-align:center;color:#8e8e8e;margin-top:20px;">Hali sharhlar yo'q.</div>`;
            return;
        }
        Object.values(data).forEach(comment => {
            const commentHTML = `
                <div class="comment-item">
                    <img src="https://ui-avatars.com/api/?name=${comment.userId}&background=random&color=fff" class="comment-avatar">
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
    await set(newCommentRef, { userId: user.id, text: text, timestamp: Date.now() });
    commentInput.value = "";
});

closeCommentBtn.addEventListener('click', () => commentModal.hidden = true);
modalBackdrop.addEventListener('click', () => commentModal.hidden = true);

// 6. AVTOMATIK IJRO VA REKLAMA HISOBLAGICHI
function handleIntersectionObserver() {
    let lastViewedPostId = null;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
            // Agar bu haqiqiy video post bo'lsa
            if (entry.target.classList.contains('real-video-post')) {
                const video = entry.target.querySelector('.reel-video');
                const currentPostId = entry.target.getAttribute('data-post-id');

                if (entry.isIntersecting) {
                    video.muted = globalMuted;
                    video.play().catch(err => console.log("Avto-ijro bloklandi"));

                    // Foydalanuvchi yangi postga o'tsa hisoblagichni oshiramiz
                    if (lastViewedPostId !== currentPostId) {
                        lastViewedPostId = currentPostId;
                        userViewCount++;

                        // Agar hisoblagich 10 ga yetsa, reklama ko'rsatilgan deb hisoblab nollaymiz (yoki moduloga qarab ketadi)
                        if (userViewCount > AD_INTERVAL) {
                            userViewCount = 1; // Reklamadan keyingi birinchi post
                        }

                        // Firebase-ga ko'rishlar sonini saqlash
                        await update(ref(db, `users/${user.id}`), {
                            viewCount: userViewCount
                        });
                    }
                } else {
                    video.pause();
                }
            } 
            // Agar bu Reklama kartasi bo'lsa
            else if (entry.target.classList.contains('ad-post')) {
                if (entry.isIntersecting) {
                    console.log("Foydalanuvchi reklamani ko'rmoqda");
                    // Bu yerda iframe ichidagi ads.html avtomat ishga tushadi
                }
            }
        });
    }, { threshold: 0.6 }); // 60% ekranda ko'rinsa faollashadi

    document.querySelectorAll('.reel-post').forEach(post => {
        observer.observe(post);
    });
}

// Kodni ishga tushiramiz
initReels();

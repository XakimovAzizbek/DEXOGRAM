import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let globalMuted = true; // Sukut bo'yicha videolar ovozsiz boshlanadi (Barcha zamonaviy brauzerlar talabi)

// 3. Firebase'dan postlarni yuklab olish va ekranga chiqarish
const postsRef = ref(db, 'posts');
onValue(postsRef, (snapshot) => {
    reelsContainer.innerHTML = "";
    const data = snapshot.val();
    if (!data) return;

    // Postlarni eng yangisini tepaga saralash
    const postsArray = Object.entries(data).reverse();

    postsArray.forEach(([postId, post]) => {
        // Layklar ob'ektini tekshiramiz
        const likesObj = post.likes_users || {};
        const likesCount = Object.keys(likesObj).length;
        const isLiked = likesObj[user.id] ? "liked" : "";
        const likeIcon = likesObj[user.id] ? "❤️" : "🤍";

        // Komentariyalar sonini hisoblash
        const commentsCount = post.comments ? Object.keys(post.comments).length : 0;

        const reelHTML = `
            <div class="reel-post" id="post_${postId}">
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

        // Dinamik yaratilgan elementlarga hodisalarni bog'laymiz
        setupVideoControls(postId);
    });

    // Har bir scroll bo'lganda faol videoni aniqlash va avtomatik ijro etish
    handleIntersectionObserver();
});

// 4. Video boshqaruv datchiklari (Ovoz ochish, Stop qilish, Layk, Koment, Share)
function setupVideoControls(postId) {
    const postEl = document.getElementById(`post_${postId}`);
    const video = postEl.querySelector('.reel-video');
    const audioIcon = postEl.querySelector('.audio-status-icon');
    const likeBtn = document.getElementById(`likeBtn_${postId}`);
    const commentBtn = document.getElementById(`commentBtn_${postId}`);
    const shareBtn = document.getElementById(`shareBtn_${postId}`);

    let pressTimer;

    // --- SENSORLAR: EKRAŇGA URILSA OVOZ O'ZGARISHI VA BOSIB TURILSA STOP ---
    
    // Ekranga qisqa bosilganda ovozni ochish/yopish, uzoq bosilganda stop qilish mantiqi
    video.addEventListener('pointerdown', (e) => {
        // Uzoq bosib turishni aniqlash (0.3 soniyadan ko'p bosilsa video to'xtaydi)
        pressTimer = setTimeout(() => {
            video.pause();
        }, 300);
    });

    video.addEventListener('pointerup', (e) => {
        clearTimeout(pressTimer);
        // Agar video uzoq bosilish sababli to'xtagan bo'lsa, qo'lni uzganda yana ijro etiladi
        if (video.paused) {
            video.play();
        } else {
            // Agar shunchaki qisqa chertilgan (click) bo'lsa, ovoz rejimi o'zgaradi
            globalMuted = !globalMuted;
            document.querySelectorAll('.reel-video').forEach(v => v.muted = globalMuted);
            
            // Ovoz belgisini ekranda miltillatib ko'rsatish
            audioIcon.innerText = globalMuted ? "🔇" : "🔊";
            audioIcon.style.opacity = "1";
            setTimeout(() => audioIcon.style.opacity = "0", 600);
        }
    });

    // --- LAYK BOSISH TIZIMI (Har bir userga 1 marta, qayta bossa o'chadi) ---
    likeBtn.addEventListener('click', async () => {
        const likeRef = ref(db, `posts/${postId}/likes_users/${user.id}`);
        
        if (likeBtn.classList.contains('liked')) {
            // Agar oldin layk bosgan bo'lsa - laykni o'chiramiz
            await set(likeRef, null);
        } else {
            // Agar birinchi marta bossa - layk yozamiz
            await set(likeRef, true);
        }
    });

    // --- SHARHLAR OYNASINI OCHISH ---
    commentBtn.addEventListener('click', () => {
        activeCommentPostId = postId;
        commentModal.hidden = false;
        loadComments(postId);
    });

    // --- TELEGRAM ORQALI ULASHISH (SHARE) TUGMASI ---
    shareBtn.addEventListener('click', () => {
        const shareUrl = `https://cdn.jsdelivr.net/gh/XakimovAzizbek/instagram-videos/videos/`; 
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(video.src)}&text=${encodeURIComponent("Dexogram-da ajoyib videoni ko'ring!")}`);
    });
}

// 5. Sharhlarni Firebase'dan yuklash va chiroyli tartibda chiqarish
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
        commentsList.scrollTop = commentsList.scrollHeight; // Avtomatik pastga tushirish
    });
}

// Sharh yuborish tugmasi bosilganda
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

// Sharhlar oynasini yopish
closeCommentBtn.addEventListener('click', () => commentModal.hidden = true);
modalBackdrop.addEventListener('click', () => commentModal.hidden = true);

// 6. AVTOMATIK IJRO (Scroll bo'lganda faqat ekrandagi video chaladi, qolganlari to'xtaydi)
function handleIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('.reel-video');
            if (entry.isIntersecting) {
                video.muted = globalMuted;
                video.play().catch(err => console.log("Avto-ijro bloklandi"));
            } else {
                video.pause();
            }
        });
    }, { threshold: 0.6 }); // Video kamida 60% ekranda ko'rinsa ijro etiladi

    document.querySelectorAll('.reel-post').forEach(post => {
        observer.observe(post);
    });
}

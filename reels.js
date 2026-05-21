import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Konfiguratsiyasi
const firebaseConfig = {
  apiKey: "AIzaSyApRt8MNq4YvsjxQVhyQK3p5km8G7Hi9iE",
  authDomain: "webtelegram-9a1d6.firebaseapp.com",
  databaseURL: "https://webtelegram-9a1d6-default-rtdb.firebaseio.com",
  projectId: "webtelegram-9a1d6",
  storageBucket: "webtelegram-9a1d6.firebasestorage.app",
  messagingSenderId: "991268167197",
  appId: "1:991268167197:web:ba16232c584dd15800b0f4",
  measurementId: "G-5R1B1SGFFD"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const reelsContainer = document.getElementById('reelsContainer');

// Telegram WebApp sozlamalari
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Kirgan foydalanuvchining haqiqiy Telegram ID raqami
const currentUserId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "8383416300"; 

function loadDexoGramReels() {
    const allVideosRef = ref(db, 'users_videos');

    onValue(allVideosRef, (snapshot) => {
        const rootData = snapshot.val();
        if (!rootData) {
            reelsContainer.innerHTML = '<p style="text-align:center; padding:50px; color:#64748b;">Hozircha Reels videolar mavjud emas.</p>';
            return;
        }

        reelsContainer.innerHTML = ''; // Sahifani tozalash
        let allPostsArray = [];

        // Ma'lumotlarni massivga yig'ish
        Object.keys(rootData).forEach(userId => {
            const userVideos = rootData[userId];
            Object.keys(userVideos).forEach(postId => {
                const post = userVideos[postId];
                allPostsArray.push({
                    id: postId,
                    author_id: userId,
                    username: post.username || "user",
                    video_url: post.video_url,
                    caption: post.caption || "",
                    likes: post.likes || 0,
                    likes_list: post.likes_list || {},
                    timestamp: post.timestamp || 0
                });
            });
        });

        // Vaqt bo'yicha saralash (Eng yangisi tepada)
        allPostsArray.sort((a, b) => b.timestamp - a.timestamp);

        allPostsArray.forEach(post => {
            // Avtomatik ijro va toza rejim uchun iframe havolasini shakllantirish
            // Admin paneldan kiritilgan link oxiridagi parmetrlarni to'g'rilaymiz
            let cleanUrl = post.video_url.split('?')[0];
            const embedUrl = `${cleanUrl}?embed=1&autoplay=1&muted=1&mode=default`;

            const firstLetter = post.username.charAt(0).toUpperCase();
            const hasLiked = post.likes_list && post.likes_list[currentUserId] === true;
            const heartClass = hasLiked ? "fa-solid fa-heart liked" : "fa-regular fa-heart";

            const reelCardHTML = `
                <div class="reels-card" id="reel-${post.id}">
                    <div class="video-wrapper">
                        <iframe src="${embedUrl}" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                    </div>

                    <div class="reels-overlay">
                        <div class="reels-user-info">
                            <div class="reels-avatar">${firstLetter}</div>
                            <span class="reels-username">@${post.username}</span>
                            <span class="reels-user-id"><i class="fa-solid fa-fingerprint"></i> ID: ${post.author_id}</span>
                        </div>
                        <p class="reels-caption">${post.caption}</p>
                    </div>

                    <div class="reels-sidebar">
                        <div class="sidebar-icon btn-like" data-post-id="${post.id}" data-author-id="${post.author_id}">
                            <i class="${heartClass}"></i>
                            <span class="like-count">${post.likes}</span>
                        </div>
                        <div class="sidebar-icon">
                            <i class="fa-regular fa-paper-plane"></i>
                            <span>Share</span>
                        </div>
                    </div>
                </div>
            `;
            reelsContainer.insertAdjacentHTML('beforeend', reelCardHTML);
        });

        // Like tugmalarini hodisaga bog'lash
        document.querySelectorAll('.btn-like').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const targetNode = e.currentTarget;
                const postId = targetNode.getAttribute('data-post-id');
                const authorId = targetNode.getAttribute('data-author-id');
                toggleLikeSystem(authorId, postId);
            });
        });
    });
}

// Like/Unlike Tranzaksiya tizimi
function toggleLikeSystem(authorId, postId) {
    const postRef = ref(db, `users_videos/${authorId}/${postId}`);
    runTransaction(postRef, (post) => {
        if (post) {
            if (!post.likes_list) post.likes_list = {};
            
            if (post.likes_list[currentUserId]) {
                post.likes--;
                post.likes_list[currentUserId] = null; // Laykni qaytarib olish
            } else {
                post.likes = (post.likes || 0) + 1;
                post.likes_list[currentUserId] = true; // Yangi layk qo'shish
            }
        }
        return post;
    }).catch((err) => console.error("Xatolik:", err));
}

// Tizimni ishga tushirish
loadDexoGramReels();

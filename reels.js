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

// Kirgan foydalanuvchining shaxsiy Telegram ID raqami
const currentUserId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "8383416300"; 

let youtubePlayers = {}; // Yuklangan pleyer obyektlarini saqlash uchun

// YouTube linkidan ID qismini ajratib olish (Shorts yoki Oddiy havola uchun)
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function loadDexoGramReels() {
    const allVideosRef = ref(db, 'users_videos');

    onValue(allVideosRef, (snapshot) => {
        const rootData = snapshot.val();
        if (!rootData) {
            reelsContainer.innerHTML = '<p style="text-align:center; padding:50px;">Hozircha videolar yo‘q.</p>';
            return;
        }

        reelsContainer.innerHTML = ''; 
        let allPostsArray = [];

        // Bazadagi barcha foydalanuvchilarning videolarini bitta massivga yig'ish
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

        // Vaqt bo'yicha eng yangilarini tepaga tartiblash
        allPostsArray.sort((a, b) => b.timestamp - a.timestamp);

        allPostsArray.forEach((post, index) => {
            const ytId = extractYouTubeId(post.video_url);
            if (!ytId) return; // Agar link noto'g'ri bo'lsa o'tkazib yuboradi

            const firstLetter = post.username.charAt(0).toUpperCase();
            const hasLiked = post.likes_list && post.likes_list[currentUserId] === true;
            const heartClass = hasLiked ? "fa-solid fa-heart liked" : "fa-regular fa-heart";

            const reelCardHTML = `
                <div class="reels-card" id="card-${post.id}" data-post-id="${post.id}">
                    <div class="video-wrapper">
                        <div id="player-${post.id}"></div>
                    </div>

                    <div class="reels-overlay">
                        <div class="reels-user-info">
                            <div class="reels-avatar">${firstLetter}</div>
                            <span class="reels-username">@${post.username}</span>
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

            // Dinamik ravishda YouTube API Player obyektini yaratish
            setTimeout(() => {
                youtubePlayers[post.id] = new YT.Player(`player-${post.id}`, {
                    videoId: ytId,
                    playerVars: {
                        'autoplay': index === 0 ? 1 : 0, // Faqat birinchi video srazu yonadi
                        'controls': 0, // YouTube-ning boshqaruv tugmalarini butunlay yashirish
                        'rel': 0,
                        'showinfo': 0,
                        'modestbranding': 1, // Logotiplarni kamaytirish
                        'loop': 1,
                        'playlist': ytId, // Cheksiz aylanish (loop) ishlashi uchun playlist parametri shart
                        'mute': 1, // Avto-ijro brauzerlarda bloklanmasligi uchun ovozsiz ochiladi
                        'playsinline': 1
                    },
                    events: {
                        'onReady': (event) => {
                            if (index === 0) {
                                event.target.playVideo();
                            }
                        }
                    }
                });
            }, 150);
        });

        // DexoGram Layk tugmalarini hodisaga bog'lash
        document.querySelectorAll('.btn-like').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const targetNode = e.currentTarget;
                const postId = targetNode.getAttribute('data-post-id');
                const authorId = targetNode.getAttribute('data-author-id');
                toggleLikeSystem(authorId, postId);
            });
        });

        // Skrol tekshirgichni ishga tushirish
        setupScrollObserver();
    });
}

// Foydalanuvchi lentani skrol qilganda faqat ko'rinib turgan videoni qo'yish tizimi
function setupScrollObserver() {
    const observerOptions = {
        root: reelsContainer,
        threshold: 0.6 // Karta kamida 60% ekranda ko'rinsa ishlaydi
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const postId = entry.target.getAttribute('data-post-id');
            const player = youtubePlayers[postId];

            if (player && typeof player.playVideo === 'function') {
                if (entry.isIntersecting) {
                    player.playVideo(); // Ekranga kelganda videoni davom ettirish
                } else {
                    player.pauseVideo(); // Ekrandan chiqib ketganda pauza qilish
                }
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reels-card').forEach(card => {
        observer.observe(card);
    });
}

// DexoGram Like/Unlike Tranzaksiya tizimi
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
    }).catch((err) => console.error("Like amali xatoligi:", err));
}

// YouTube API to'liq yuklanib bo'lganidan so'ng ushbu funksiya avtomatik trigger bo'ladi
window.onYouTubeIframeAPIReady = function() {
    loadDexoGramReels();
};

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

const currentUserId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "8383416300"; 

let isGlobalUnmuted = false; // Bir marta bosilganda keyingi videolar ham ovozli chiqishi uchun

function loadDexoGramReels() {
    // Ham 'users_videos' ham 'posts' tugunidagi videolarni xavfsiz tekshirish
    const allVideosRef = ref(db, 'users_videos');

    onValue(allVideosRef, (snapshot) => {
        const rootData = snapshot.val();
        if (!rootData) {
            reelsContainer.innerHTML = '<p style="text-align:center; padding:50px;">Hozircha videolar yo‘q.</p>';
            return;
        }

        reelsContainer.innerHTML = ''; 
        let allPostsArray = [];

        // Ma'lumotlarni yig'ish
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

        // Eng yangi yuklangan videolarni tepaga chiqarish
        allPostsArray.sort((a, b) => b.timestamp - a.timestamp);

        if (allPostsArray.length === 0) {
            reelsContainer.innerHTML = '<p style="text-align:center; padding:50px;">Videolar topilmadi.</p>';
            return;
        }

        allPostsArray.forEach((post, index) => {
            const firstLetter = post.username.charAt(0).toUpperCase();
            const hasLiked = post.likes_list && post.likes_list[currentUserId] === true;
            const heartClass = hasLiked ? "fa-solid fa-heart liked" : "fa-regular fa-heart";

            const reelCardHTML = `
                <div class="reels-card" id="card-${post.id}" data-post-id="${post.id}">
                    <div class="video-wrapper">
                        <video class="reels-video" id="video-${post.id}" src="${post.video_url}" loop muted playsinline></video>
                    </div>

                    <div class="volume-status-notice" id="volume-notice-${post.id}">
                        <i class="fa-solid fa-volume-high"></i>
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
        });

        // 1-videoni darhol avtomatik ijro etish
        setTimeout(() => {
            const firstVideo = document.querySelector('.reels-video');
            if (firstVideo) {
                firstVideo.play().catch(err => console.log("Avtopley cheklovi:", err));
            }
        }, 200);

        // Voqealarni bog'lash (Events)
        initReelsEvents();
    });
}

function initReelsEvents() {
    // Layk bosish tizimi
    document.querySelectorAll('.btn-like').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation(); // Videoga bosilish ta'sir qilmasligi uchun
            const targetNode = e.currentTarget;
            const postId = targetNode.getAttribute('data-post-id');
            const authorId = targetNode.getAttribute('data-author-id');
            toggleLikeSystem(authorId, postId);
        });
    });

    // Video ustiga bosilganda Mute / Unmute (Ovozni yoqish-o'chirish)
    document.querySelectorAll('.reels-card').forEach(card => {
        card.addEventListener('click', () => {
            const postId = card.getAttribute('data-post-id');
            const video = document.getElementById(`video-${postId}`);
            const notice = document.getElementById(`volume-notice-${postId}`);
            const icon = notice.querySelector('i');

            if (video) {
                if (video.muted) {
                    video.muted = false;
                    isGlobalUnmuted = true; // Tanlovni eslab qolish
                    icon.className = "fa-solid fa-volume-high";
                } else {
                    video.muted = true;
                    isGlobalUnmuted = false;
                    icon.className = "fa-solid fa-volume-xmark";
                }

                // Ekranda vizual belgi ko'rsatib yashirish
                notice.classList.add('show');
                setTimeout(() => notice.classList.remove('show'), 700);
            }
        });
    });

    // Skrolni kuzatish (Intersection Observer)
    setupScrollObserver();
}

function setupScrollObserver() {
    const observerOptions = {
        root: reelsContainer,
        threshold: 0.6
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const postId = entry.target.getAttribute('data-post-id');
            const video = document.getElementById(`video-${postId}`);

            if (video) {
                if (entry.isIntersecting) {
                    // Video ekranga kelganda holatga qarab ovoz bilan ijro etiladi
                    video.muted = !isGlobalUnmuted;
                    video.currentTime = 0; // Videoni boshidan boshlash
                    video.play().catch(err => console.log("Ijro etishda xato:", err));
                } else {
                    // Ekrandan chiqib ketganda pauza bo'ladi
                    video.pause();
                }
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reels-card').forEach(card => {
        observer.observe(card);
    });
}

function toggleLikeSystem(authorId, postId) {
    const postRef = ref(db, `users_videos/${authorId}/${postId}`);
    runTransaction(postRef, (post) => {
        if (post) {
            if (!post.likes_list) post.likes_list = {};
            
            if (post.likes_list[currentUserId]) {
                post.likes--;
                post.likes_list[currentUserId] = null;
            } else {
                post.likes = (post.likes || 0) + 1;
                post.likes_list[currentUserId] = true;
            }
        }
        return post;
    }).catch((err) => console.error("Like xatosi:", err));
}

// Yuklashni boshlash
loadDexoGramReels();

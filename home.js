// 1. Firebase Modullarini CDN orqali import qilamiz
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
tg.expand(); // Oynani to'liq ochish

// Foydalanuvchini aniqlash (Telegramdan kirmasa, test rejim)
const user = tg.initDataUnsafe?.user || {
    id: "999999",
    username: "Dexo_Test",
    first_name: "Loyiha Sinovchisi"
};

// Header-ga foydalanuvchi nomini yozish
document.getElementById("userBadge").innerText = `@${user.username}`;

// 5. Postlarni Realtime Database-dan yuklab olish funksiyasi
async function loadFeed() {
    const feedContainer = document.getElementById("feedContainer");
    const postsRef = ref(db, 'posts');

    try {
        const snapshot = await get(postsRef);
        feedContainer.innerHTML = ""; // "Yuklanmoqda..." yozuvini tozalash

        if (!snapshot.exists()) {
            feedContainer.innerHTML = `<div class="loading">Hozircha hech qanday post yo'q. Birinchi bo'lib post joylang!</div>`;
            return;
        }

        const data = snapshot.val();
        // Postlarni massivga o'tkazish va eng yangisini tepaga chiqarish
        const postsArray = Object.keys(data).map(key => ({ id: key, ...data[key] })).reverse();

        postsArray.forEach(post => {
            const card = document.createElement("div");
            card.className = "post-card";
            
            // Foydalanuvchi ushbu postga oldin layk bosganmi yoki yo'qmi tekshirish
            const hasLiked = post.liked_users && post.liked_users[user.id] ? "liked" : "";

            card.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar"></div>
                    <div class="post-username">@${post.username || 'anonim'}</div>
                </div>
                
                <video class="post-video" src="${post.video_url}" controls loop playsinline></video>
                
                <div class="post-actions">
                    <button class="action-btn ${hasLiked}" data-id="${post.id}">
                        <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.5 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </button>
                </div>
                
                <div class="post-info">
                    <div class="likes-count" id="likes-count-${post.id}">${post.likes || 0} ta layk</div>
                    <div class="post-caption"><span>@${post.username || 'anonim'}</span> ${post.caption || ''}</div>
                </div>
            `;
            
            // Layk tugmasiga bosish hodisasini biriktiramiz
            const likeBtn = card.querySelector(".action-btn");
            likeBtn.addEventListener("click", () => toggleLike(post.id, likeBtn));

            feedContainer.appendChild(card);
        });

    } catch (error) {
        console.error("Xatolik yuz berdi:", error);
        feedContainer.innerHTML = `<div class="loading" style="color:red;">Ma'lumotlarni yuklashda xatolik yuz berdi!</div>`;
    }
}

// 6. Realtime Database-da Layk bosish tizimi (Transaction bilan xavfsiz o'zgartirish)
async function toggleLike(postId, button) {
    const postLikesRef = ref(db, `posts/${postId}`);
    
    try {
        // Transaction birdaniga ko'p odam layk bossa ham chalkashmaslikni ta'minlaydi
        await runTransaction(postLikesRef, (post) => {
            if (post) {
                if (!post.liked_users) {
                    post.liked_users = {};
                }
                
                if (post.liked_users[user.id]) {
                    // Agar oldin layk bosgan bo'lsa -> laykni olib tashlaymiz
                    post.likes = (post.likes || 1) - 1;
                    delete post.liked_users[user.id];
                    button.classList.remove("liked");
                } else {
                    // Agar birinchi marta bossa -> layk qo'shamiz
                    post.likes = (post.likes || 0) + 1;
                    post.liked_users[user.id] = true;
                    button.classList.add("liked");
                }
                
                // Ekrandagi sonni darhol yangilash
                document.getElementById(`likes-count-${postId}`).innerText = `${post.likes} ta layk`;
            }
            return post;
        });
    } catch (error) {
        console.error("Layk bosishda xatolik:", error);
    }
}

// Sahifa ochilishi bilan feedni yuklaymiz
window.onload = loadFeed;

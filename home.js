// 1. Firebase SDK modullarini import qilish (CDN orqali)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 2. Sizning Firebase konfiguratsiyangiz
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

// 3. Firebase-ni ishga tushirish
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 4. Telegram Web App sozlamalari
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// 5. Firebase-dan postlarni real vaqtda olish (Realtime)
const feedContainer = document.getElementById('feedContainer');

function loadPosts() {
    // Faraz qilamiz, botingiz bazadagi "posts" tuguniga ma'lumot yozadi
    const postsRef = ref(db, 'posts');
    
    onValue(postsRef, (snapshot) => {
        feedContainer.innerHTML = ''; // Eski postlarni tozalash
        
        const data = snapshot.val();
        if (!data) {
            feedContainer.innerHTML = '<p style="text-align:center; padding:20px;">Hozircha postlar yoq.</p>';
            return;
        }

        // Barcha postlarni aylanib chiqish
        Object.keys(data).forEach(key => {
            const post = data[key];
            
            // Telegram bot yuborgan video URL yoki maxfiy kanal post linki
            // Agar bot faqat file_id yuborayotgan bo'lsa, uni yorug'lik tezligida ko'rsatish uchun 
            // bot orqali linkka aylantirib bazaga yozish tavsiya etiladi.
            const videoUrl = post.video_url; 
            const username = post.username || "anonim_user";
            const caption = post.caption || "";
            const likes = post.likes || 0;

            const postHTML = `
                <div class="post-card" id="post-${key}">
                    <div class="post-header">
                        <img src="https://via.placeholder.com/40" alt="Avatar" class="user-avatar">
                        <span class="username">${username}</span>
                    </div>
                    <div class="post-media">
                        <video src="${videoUrl}" controls loop muted playsinline></video>
                    </div>
                    <div class="post-actions">
                        <div class="left-actions">
                            <i class="fa-regular fa-heart action-btn" onclick="toggleLike('${key}')"></i>
                            <i class="fa-regular fa-comment action-btn"></i>
                            <i class="fa-regular fa-paper-plane action-btn"></i>
                        </div>
                        <i class="fa-regular fa-bookmark action-btn"></i>
                    </div>
                    <div class="post-info">
                        <p class="likes-count">${likes} likes</p>
                        <p class="post-caption"><strong>${username}</strong> ${caption}</p>
                    </div>
                </div>
            `;
            
            // Postni lentaga qo'shish (eng yangilari tepada chiqishi uchun)
            feedContainer.insertAdjacentHTML('afterbegin', postHTML);
        });
    });
}

// Sahifa yuklanganda postlarni chaqirish
loadPosts();

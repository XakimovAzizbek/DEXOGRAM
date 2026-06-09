import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.expand();

// DOM Elementlar
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("resultsContainer");

// Qidiruv funksiyasi
async function burchakliQidiruv() {
    const queryId = searchInput.value.trim();

    if (!queryId) {
        resultsContainer.innerHTML = `<div class="search-placeholder">Iltimos, Telegram ID raqamini yozing.</div>`;
        return;
    }

    resultsContainer.innerHTML = `<div class="loading">Dexogram qidirilmoqda...</div>`;

    try {
        // "posts" tugunidan foydalanuvchini qidiramiz
        const postsRef = ref(db, 'posts');
        const snapshot = await get(postsRef);

        if (!snapshot.exists()) {
            resultsContainer.innerHTML = `<div class="no-results">Natija topilmadi.<br>Hali hech kim post joylamagan.</div>`;
            return;
        }

        let topilganUser = null;

        // Barcha postlarni aylanib chiqib, userId mos kelishini tekshiramiz
        snapshot.forEach((childSnapshot) => {
            const post = childSnapshot.val();
            // ID ham raqam, ham string ko'rinishida solishtiriladi
            if (String(post.userId) === queryId) {
                topilganUser = {
                    id: post.userId,
                    username: post.username || "anonim",
                    first_name: post.first_name || "Dexogram Foydalanuvchisi",
                    // Agar bazada rasm bo'lsa olinadi, bo'lmasa standart rasm qo'yiladi
                    avatar: post.user_avatar || "https://www.w3schools.com/howto/img_avatar.png"
                };
            }
        });

        // Natijani ekranga chiqarish
        if (topilganUser) {
            resultsContainer.innerHTML = `
                <div class="user-card" id="userCard" data-id="${topilganUser.id}">
                    <img class="user-avatar" src="${topilganUser.avatar}" alt="Avatar" onerror="this.src='https://www.w3schools.com/howto/img_avatar.png'">
                    <div class="user-details">
                        <div class="user-name">${escapeHtml(topilganUser.first_name)}</div>
                        <div class="user-username">@${escapeHtml(topilganUser.username)}</div>
                        <div class="user-id-badge">ID: ${topilganUser.id}</div>
                    </div>
                </div>
            `;

            // Kartaga bosganda profil sahifasiga ID bilan yo'naltirish
            document.getElementById("userCard").addEventListener("click", function() {
                const targetId = this.getAttribute("data-id");
                window.location.href = `user_profile.html?id=${targetId}`;
            });

        } else {
            resultsContainer.innerHTML = `<div class="no-results">Natija topilmadi.<br>Bu ID egasi Dexogramda mavjud emas!</div>`;
        }

    } catch (error) {
        console.error("Qidiruvda xato:", error);
        resultsContainer.innerHTML = `<div class="no-results" style="color:red;">Xatolik yuz berdi. Qayta urinib ko'ring.</div>`;
    }
}

// Xavfsizlik uchun XSS himoyasi
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Tugma bosilganda yoki Enter bosilganda ishga tushirish
searchBtn.addEventListener("click", burchakliQidiruv);
searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        burchakliQidiruv();
    }
});

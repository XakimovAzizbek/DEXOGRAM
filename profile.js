import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Konfiguratsiyasi
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

// Telegram WebApp sozlamasi
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "999999", username: "Dexo_Test" };

// Profil interfeysini sozlash
document.getElementById("profileUsername").innerText = `@${user.username || 'anonim'}`;
document.getElementById("profileId").innerText = `ID: ${user.id}`;

// 3 ta chiziq (Settings) bosilganda o'tish mantiqi
document.getElementById("settingsBtn").addEventListener("click", () => {
    window.location.href = "setting.html";
});

// Global o'zgaruvchilar
let myPostsData = {};
let selectedPostId = null;

// Elementlarni chaqirib olish
const videoGrid = document.getElementById("videoGrid");
const videoModal = document.getElementById("videoModal");
const modalVideo = document.getElementById("modalVideo");
const modalUserId = document.getElementById("modalUserId");
const modalCaption = document.getElementById("modalCaption");
const modalLikeCount = document.getElementById("modalLikeCount");
const modalCommentCount = document.getElementById("modalCommentCount");

const ownerMenuContainer = document.getElementById("ownerMenuContainer");
const dropdownMenu = document.getElementById("dropdownMenu");
const editModal = document.getElementById("editModal");
const editCaptionInput = document.getElementById("editCaptionInput");

// 1. Videolarni va Statistikani Yuklash
function loadProfileData() {
    const postsRef = ref(db, 'posts');
    
    onValue(postsRef, (snapshot) => {
        videoGrid.innerHTML = "";
        myPostsData = {};
        let totalLikes = 0;
        let postCount = 0;

        if (!snapshot.exists()) {
            videoGrid.innerHTML = `<div class="loading">Siz hali video joylamagansiz.</div>`;
            document.getElementById("totalLikesCount").innerText = "0";
            return;
        }

        const allPosts = snapshot.val();
        
        // Faqat joriy foydalanuvchiga tegishli postlarni ajratib olamiz
        Object.entries(allPosts).forEach(([id, post]) => {
            if (String(post.userId) === String(user.id)) {
                myPostsData[id] = post;
                postCount++;
                totalLikes += (post.likes || 0);

                // Grid elementi tuzilishi
                const gridItem = document.createElement("div");
                gridItem.className = "grid-item";
                gridItem.innerHTML = `<video src="${post.video_url}" muted preload="metadata"></video>`;
                
                // Bosilganda modal pleyerni ochish
                gridItem.addEventListener("click", () => openVideoModal(id));
                videoGrid.appendChild(gridItem);
            }
        });

        if (postCount === 0) {
            videoGrid.innerHTML = `<div class="loading">Siz hali video joylamagansiz.</div>`;
        }

        // Statistikani yangilash
        document.getElementById("totalLikesCount").innerText = totalLikes;
        // Obunachilar va obunalar uchun test ma'lumot (agar bazada bo'lmasa)
        document.getElementById("followersCount").innerText = "2.6K";
        document.getElementById("followingCount").innerText = "142";
    });
}

// 2. Modal Oynani ochish va to'ldirish
function openVideoModal(postId) {
    selectedPostId = postId;
    const post = myPostsData[postId];
    if (!post) return;

    modalVideo.src = post.video_url;
    modalUserId.innerText = `ID: ${post.userId}`;
    modalCaption.innerText = post.caption || "";
    modalLikeCount.innerText = post.likes || 0;
    modalCommentCount.innerText = post.comments ? Object.keys(post.comments).length : 0;

    // Tekshiruv: Agar video egasi o'zi bo'lsa 3 ta nuqtani ko'rsatish
    if (String(post.userId) === String(user.id)) {
        ownerMenuContainer.hidden = false;
    } else {
        ownerMenuContainer.hidden = true;
    }

    videoModal.hidden = false;
    modalVideo.play().catch(() => {});
}

// Modalni yopish tizimi
function closeVideoModal() {
    videoModal.hidden = true;
    modalVideo.pause();
    modalVideo.src = "";
    dropdownMenu.hidden = true;
}

document.getElementById("closeModalBtn").addEventListener("click", closeVideoModal);
document.getElementById("modalBackdrop").addEventListener("click", closeVideoModal);

// 3. Uchta nuqta (Dropdown) menyu boshqaruvi
document.getElementById("ownerMenuBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu.hidden = !dropdownMenu.hidden;
});

// 4. Videoni o'chirish mantiqi
document.getElementById("deletePostBtn").addEventListener("click", async () => {
    if (!selectedPostId) return;
    
    tg.showConfirm("Haqiqatdan ham ushbu videoni oʻchirib tashlamoqchimisiz?", async (confirmed) => {
        if (confirmed) {
            try {
                const postRef = ref(db, `posts/${selectedPostId}`);
                await remove(postRef);
                closeVideoModal();
                tg.showAlert("Video muvaffaqiyatli oʻchirildi!");
            } catch (error) {
                tg.showAlert("O'chirishda xatolik: " + error.message);
            }
        }
    });
});

// 5. Videoni tahrirlash (Tavsifni o'zgartirish)
document.getElementById("editPostBtn").addEventListener("click", () => {
    const post = myPostsData[selectedPostId];
    if (!post) return;

    editCaptionInput.value = post.caption || "";
    dropdownMenu.hidden = true;
    editModal.hidden = false;
});

document.getElementById("cancelEditBtn").addEventListener("click", () => {
    editModal.hidden = true;
});

document.getElementById("saveEditBtn").addEventListener("click", async () => {
    const newCaption = editCaptionInput.value.trim();
    if (!selectedPostId) return;

    try {
        const postRef = ref(db, `posts/${selectedPostId}`);
        await update(postRef, { caption: newCaption });
        
        // Ekrandagi tekstlarni darhol yangilash
        modalCaption.innerText = newCaption;
        myPostsData[selectedPostId].caption = newCaption;
        
        editModal.hidden = true;
        tg.showAlert("Tavsif yangilandi!");
    } catch (error) {
        tg.showAlert("Saqlashda xatolik: " + error.message);
    }
});

// Ulashish (Share) tugmasi funksiyasi
document.getElementById("modalShareBtn").addEventListener("click", () => {
    if (!modalVideo.src) return;
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(modalVideo.src)}&text=Mening profilimdagi videoni tomosha qiling!`);
});

// Likening vizual ko'rinishi
document.getElementById("modalLikeBtn").addEventListener("click", () => {
    tg.showAlert("Ushbu videoga allaqachon layk bosgansiz!");
});

// Sahifa yuklanganda tizimni ishga tushirish
window.onload = loadProfileData;

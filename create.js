import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Telegram Web App sozlamalari
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// DOM Elementlarini olish
const youtubeLinkInput = document.getElementById('youtubeLinkInput');
const linkError = document.getElementById('linkError');
const previewSection = document.getElementById('previewSection');
const youtubePreviewFrame = document.getElementById('youtubePreviewFrame');
const captionInput = document.getElementById('captionInput');
const shareBtn = document.getElementById('shareBtn');
const loaderContainer = document.getElementById('loaderContainer');

// Foydalanuvchi ma'lumotlari (Telegram xavfsiz muhitidan olinadi)
const username = tg.initDataUnsafe?.user?.username || "anonim_user";
const currentUserId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "8383416300"; 

// Istalgan ko'rinishdagi YouTube linkidan 11 xonali ID-ni qirqib olish RegEx funksiyasi
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Foydalanuvchi havolani yozayotgan (yoki joylashtirgan) paytda tekshirish
youtubeLinkInput.addEventListener('input', () => {
    const inputValue = youtubeLinkInput.value.trim();
    
    if (inputValue === "") {
        linkError.style.display = 'none';
        previewSection.style.display = 'none';
        shareBtn.disabled = true;
        return;
    }

    const videoId = extractYouTubeId(inputValue);

    if (videoId) {
        // Havola To'g'ri bo'lsa
        linkError.style.display = 'none';
        
        // Preview qismida pleyerga solib ko'rsatamiz
        youtubePreviewFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=0`;
        previewSection.style.display = 'block';
        
        // Ulashish tugmasini aktivlashtiramiz
        shareBtn.disabled = false;
    } else {
        // Havola Noto'g'ri bo'lsa qizil ogohlantirishni chiqarish
        linkError.style.display = 'block';
        previewSection.style.display = 'none';
        youtubePreviewFrame.src = "";
        shareBtn.disabled = true;
    }
});

// Ulashish tugmasi bosilganda ma'lumotlarni Firebase Realtime Database-ga yozish
shareBtn.addEventListener('click', async () => {
    const videoUrl = youtubeLinkInput.value.trim();
    const caption = captionInput.value.trim();
    const videoId = extractYouTubeId(videoUrl);

    if (!videoId) {
        alert("Iltimos, avval to'g'ri YouTube havolasini kiriting!");
        return;
    }

    // Yuklanish holatini yoqish
    shareBtn.disabled = true;
    loaderContainer.style.display = 'block';

    try {
        // Sizning reels.js sahifangiz ma'lumotlarni aynan 'users_videos/foydalanuvchi_id/random_post_id' joyidan o'qiydi
        // Shuning uchun arxitekturani aynan shu tuzilmaga moslaymiz:
        const userVideosRef = ref(db, `users_videos/${currentUserId}`);
        const newPostRef = push(userVideosRef); // Yangi unikal ID yaratadi

        await set(newPostRef, {
            username: username,
            video_url: videoUrl, // Kiritilgan original havola
            caption: caption,
            likes: 0,
            likes_list: {},
            timestamp: Date.now()
        });

        alert("Reels muvaffaqiyatli ulashildi! 🚀");
        
        // Tizimni muvaffaqiyatli yakunlab Reels sahifasiga yo'naltiramiz
        window.location.href = "reels.html";

    } catch (error) {
        console.error("Firebase database xatoligi:", error);
        alert("Baza bilan bog'lanishda xatolik yuz berdi. Qayta urinib ko'ring!");
        
        // Xatolik bo'lsa yuklashni to'xtatish
        shareBtn.disabled = false;
        loaderContainer.style.display = 'none';
    }
});

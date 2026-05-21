import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Sizning Firebase konfiguratsiyangiz
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

// --- TELEGRAM BOT VA KANAL MA'LUMOTLARI ---
const BOT_TOKEN = "8785312159:AAGDR76v_ASLoFFZDxU32YejHyAXj5tIi1M"; // O'zingizning bot tokeningizni yozing
const CHANNEL_ID = "-3825803639"; // O'zingizning maxfiy kanalingiz ID-sini yozing (Format: -100...)
// ------------------------------------------

const uploadBox = document.getElementById('uploadBox');
const videoInput = document.getElementById('videoInput');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const videoPreview = document.getElementById('videoPreview');
const captionInput = document.getElementById('captionInput');
const shareBtn = document.getElementById('shareBtn');
const loaderContainer = document.getElementById('loaderContainer');
const progressText = document.getElementById('progressText');

let selectedFile = null;

// Oynani bossa, galereyani ochish
uploadBox.addEventListener('click', () => videoInput.click());

// Video tanlanganda ishlaydigan funksiya
videoInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        // Tanlangan video formatini tekshirish
        if (!selectedFile.type.startsWith('video/')) {
            alert('Iltimos, faqat video fayl tanlang!');
            return;
        }

        // Preview ko'rsatish
        const fileURL = URL.createObjectURL(selectedFile);
        videoPreview.src = fileURL;
        videoPreview.style.display = 'block';
        uploadPlaceholder.style.display = 'none';
        
        // Ulashish tugmasini faollashtirish
        shareBtn.disabled = false;
    }
});

// "Ulashish" tugmasi bosilganda
shareBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    // Tugma va oynani bloklash, yuklash rejimini yoqish
    shareBtn.disabled = true;
    loaderContainer.style.display = 'block';
    progressText.innerText = "Video Telegram maxfiy kanaliga yuklanmoqda...";

    // Telegram foydalanuvchi ma'lumotlarini olish
    const username = tg.initDataUnsafe?.user?.username || "anonim_user";
    const caption = captionInput.value;

    // 1-QADAM: Videoni Telegram Bot orqali maxfiy kanalga yuborish
    const formData = new FormData();
    formData.append('chat_id', CHANNEL_ID);
    formData.append('video', selectedFile);
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.ok) {
            // Telegram videoni qabul qildi va bizga ma'lumot qaytardi
            const videoData = result.result.video;
            const fileId = videoData.file_id; // Telegram ichidagi maxfiy ID
            
            // MUHIM: Reelsda avtomatik ijro etilishi uchun bizga to'g'ridan-to'g'ri video linki kerak.
            // Telegram bot orqali fayl yuklanganda to'g'ridan-to'g'ri link olish uchun:
            const fileResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
            const fileJson = await fileResponse.json();
            
            let finalVideoUrl = "";
            if(fileJson.ok) {
                const filePath = fileJson.result.file_path;
                // Bu link orqali HTML5 <video> tegi videoni to'g'ridan-to'g'ri o'qiy oladi va avtomatik ijro eta oladi (Reelsda)
                finalVideoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
            } else {
                // Agar muammo bo'lsa, tma o'zi o'qiydigan umumiy bot havolasi (buni keyin sozlash mumkin)
                finalVideoUrl = `https://t.me/c/${CHANNEL_ID.replace('-100', '')}/${result.result.message_id}`;
            }

            progressText.innerText = "Firebase bazasiga yozilmoqda...";

            // 2-QADAM: Ma'lumotlarni Firebase Realtime Database-ga yozish
            const postsRef = ref(db, 'posts');
            const newPostRef = push(postsRef); // Avtomatik random ID yaratadi
            
            await set(newPostRef, {
                username: username,
                video_url: finalVideoUrl,
                caption: caption,
                likes: 0,
                views: 0,
                timestamp: Date.now()
            });

            alert("Post muvaffaqiyatli ulashildi! 🚀");
            // Bosh sahifaga qaytarish
            window.location.href = "home.html";

        } else {
            alert("Telegramga yuklashda xatolik: " + result.description);
            shareBtn.disabled = false;
            loaderContainer.style.display = 'none';
        }

    } catch (error) {
        console.error(error);
        alert("Tarmoqda xatolik yuz berdi!");
        shareBtn.disabled = false;
        loaderContainer.style.display = 'none';
    }
});
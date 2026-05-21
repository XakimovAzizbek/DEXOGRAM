import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Firebase konfiguratsiyasi
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

// --- TELEGRAM BOT VA OYNAYDIGAN OMMIYA KANAL SOZLAMALARI ---
const BOT_TOKEN = "8785312159:AAGDR76v_ASLoFFZDxU32YejHyAXj5tIi1M";
const CHANNEL_USERNAME = "@DEXO_VIDEO"; // Videolar boradigan Ommaviy (Public) kanalingiz username'i!

// UI Elementlarini ulash
const uploadBox = document.getElementById('uploadBox');
const videoInput = document.getElementById('videoInput');
const videoPreview = document.getElementById('videoPreview');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const captionInput = document.getElementById('captionInput');
const shareBtn = document.getElementById('shareBtn');
const loaderContainer = document.getElementById('loaderContainer');
const progressText = document.getElementById('progressText');

let selectedFile = null;

// Blok bosilganda fayl tanlash oynasini ochish
uploadBox.addEventListener('click', () => {
    videoInput.click();
});

// Fayl tanlanganida uning previewsini ko'rsatish
videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        
        const fileURL = URL.createObjectURL(file);
        videoPreview.src = fileURL;
        videoPreview.style.display = "block";
        uploadPlaceholder.style.display = "none";
        
        shareBtn.disabled = false;
    }
});

// "Ulashish" tugmasi bosilganda yuklash jarayoni
shareBtn.addEventListener('click', () => {
    if (!selectedFile) return;

    shareBtn.disabled = true;
    loaderContainer.style.display = 'block';
    progressText.innerText = "Video Telegram serveriga yuborilmoqda: 0%";

    const formData = new FormData();
    formData.append('chat_id', CHANNEL_USERNAME);
    formData.append('video', selectedFile);

    const xhr = new XMLHttpRequest();

    // Yuklanish jarayoni foizini hisoblash
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressText.innerText = `Video Telegram serveriga yuborilmoqda: ${percentComplete}%`;
        }
    });

    // Telegram yuklab bo'lganidan so'ng javobni qabul qilish
    xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
            try {
                const result = JSON.parse(xhr.responseText);
                
                if (result.ok) {
                    progressText.innerText = "Firebase bazasiga yozilmoqda...";

                    // Foydalanuvchi ma'lumotlarini olish
                    const username = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || "DexoUser";
                    const userId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "anonymous";
                    const caption = captionInput.value.trim();
                    
                    // Telegram kanaldagi xabar ID-si (Message ID)
                    const messageId = result.result.message_id;

                    // Firebase Realtime Database-ga yozish
                    const userVideosRef = ref(db, `users_videos/${userId}`);
                    const newPostRef = push(userVideosRef);
                    const postKey = newPostRef.key;

                    // Telegram kanali va xabar ID-sini bazaga joylaymiz
                    await set(newPostRef, {
                        telegram_msg_id: messageId,
                        caption: caption,
                        username: username,
                        likes: 0,
                        views: 0,
                        timestamp: Date.now(),
                        post_id: postKey,
                        author_id: userId
                    });

                    alert("Post muvaffaqiyatli ulashildi! 🚀");
                    window.location.href = "reels.html";

                } else {
                    alert("Telegramga yuklashda xatolik: " + result.description);
                    resetUploadState();
                }
            } catch (err) {
                alert("Javobni tahlil qilishda xatolik yuz berdi.");
                resetUploadState();
            }
        } else {
            alert("Telegram serveri rad etdi: " + xhr.statusText);
            resetUploadState();
        }
    });

    // Tarmoq uzilib qolgandagi xatolik
    xhr.addEventListener('error', () => {
        alert("Internet aloqasi uzildi!");
        resetUploadState();
    });

    xhr.open('POST', `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`);
    xhr.send(formData);
});

function resetUploadState() {
    shareBtn.disabled = false;
    loaderContainer.style.display = 'none';
}
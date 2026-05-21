import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase konfiguratsiyasi
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

// Telegram Web App yuklanishi
const tg = window.Telegram.WebApp;
tg.ready();

// Telegram Bot va Kanalingiz sozlamalari
const BOT_TOKEN = "8785312159:AAGDR76v_ASLoFFZDxU32YejHyAXj5tIi1M";
const CHANNEL_USERNAME = "@DEXO_video"; // Videolar yuklanadigan ommaviy kanalingiz manzili

// Dom elementlarini bog'lash
const uploadBox = document.getElementById('uploadBox');
const videoInput = document.getElementById('videoInput');
const videoPreview = document.getElementById('videoPreview');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const captionInput = document.getElementById('captionInput');
const shareBtn = document.getElementById('shareBtn');
const loaderContainer = document.getElementById('loaderContainer');
const progressText = document.getElementById('progressText');

let selectedFile = null;

// Blok bosilganda fayl/galereya oynasini majburiy chaqirish
uploadBox.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.tagName === 'VIDEO') return; 
    videoInput.click();
});

// Fayl tanlanganida uning video ekanligini JS darajasida qattiq tekshirish
videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Qattiq xavfsizlik filtri: Faqat video fayllarga ruxsat berish
        if (!file.type.startsWith('video/')) {
            alert("Xatolik: Iltimos, faqat video fayl tanlang! (Rasm yoki hujjat mumkin emas)");
            videoInput.value = ""; // Inputni tozalash
            return;
        }

        // Maksimal 50 MBlik cheklov (Telegram Bot API limiti uchun)
        if (file.size > 50 * 1024 * 1024) {
            alert("Video hajmi juda katta! Iltimos, 50 MB dan kam bo'lgan qisqa video yuklang.");
            videoInput.value = "";
            return;
        }

        selectedFile = file;

        // Eski URL bo'lsa xotirani bo'shatish
        if (videoPreview.src) {
            URL.revokeObjectURL(videoPreview.src);
        }

        const fileURL = URL.createObjectURL(file);
        videoPreview.src = fileURL;
        videoPreview.style.display = "block";
        uploadPlaceholder.style.display = "none";
        uploadBox.style.border = "none"; 

        shareBtn.disabled = false; 
    }
});

// "Ulashish" tugmasi bosilganda Telegram serveriga yuborish
shareBtn.addEventListener('click', () => {
    if (!selectedFile) return;

    shareBtn.disabled = true;
    loaderContainer.style.display = 'block';
    progressText.innerText = "Video Telegram serveriga yuborilmoqda: 0%";

    const formData = new FormData();
    formData.append('chat_id', CHANNEL_USERNAME);
    formData.append('video', selectedFile);

    const xhr = new XMLHttpRequest();

    // Jonli ravishda yuklanish foizini aniqlash
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressText.innerText = `Video Telegram serveriga yuborilmoqda: ${percentComplete}%`;
        }
    });

    // Yuklanish tugagandan keyingi natija
    xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
            try {
                const result = JSON.parse(xhr.responseText);
                
                if (result.ok) {
                    progressText.innerText = "Muvaffaqiyatli! Firebase bazasiga yozilmoqda...";

                    // Telegram foydalanuvchi ma'lumotlarini yig'ish
                    const username = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || "DexoUser";
                    const userId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : "anonymous";
                    const caption = captionInput.value.trim();
                    
                    // Telegram kanaldan qaytgan xabar ID-si (Message ID)
                    const messageId = result.result.message_id;

                    // Firebase Realtime Database yo'li
                    const userVideosRef = ref(db, `users_videos/${userId}`);
                    const newPostRef = push(userVideosRef);
                    const postKey = newPostRef.key;

                    // Ma'lumotlarni bazaga joylash
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
                    alert("Telegram yuklash xatosi: " + result.description);
                    resetUploadState();
                }
            } catch (err) {
                alert("Javob matnini tahlil qilishda xatolik.");
                resetUploadState();
            }
        } else {
            alert("Telegram serveri yuklashni rad etdi. Status: " + xhr.status);
            resetUploadState();
        }
    });

    xhr.addEventListener('error', () => {
        alert("Internet aloqasi uzilib qoldi!");
        resetUploadState();
    });

    xhr.open('POST', `https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`);
    xhr.send(formData);
});

function resetUploadState() {
    shareBtn.disabled = false;
    loaderContainer.style.display = 'none';
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Firebase Sozlamalari (Siz bergan config)
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

// 2. GitHub API Sozlamalari (O'zingiznikini qo'ying)
const GITHUB_TOKEN = "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"; 
const OWNER = "XakimovAzizbek"; 
const REPO = "instagram-videos"; // Repository nomi
const RELEASE_TAG = "v1.0.0"; // Oldindan yaratilgan Release tag nomi

// 3. Telegram WebApp ma'lumotlari
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || {
    id: "999999",
    username: "Dexo_Test",
    first_name: "Loyiha Sinovchisi"
};

// HTML elementlarni ushlab olamiz
const uploadZone = document.getElementById("uploadZone");
const videoInput = document.getElementById("videoInput");
const uploadContent = document.getElementById("uploadContent");
const videoPreview = document.getElementById("videoPreview");
const captionInput = document.getElementById("captionInput");
const shareBtn = document.getElementById("shareBtn");
const statusContainer = document.getElementById("statusContainer");
const statusText = document.getElementById("statusText");

let selectedFile = null;

// Yuklash zonasini bossa, fayl tanlash oynasi ochiladi
uploadZone.addEventListener("click", () => videoInput.click());

// Fayl tanlanganda ishlaydigan hodisa
videoInput.addEventListener("change", (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        // Tanlangan videoni ekranda ko'rsatish (Preview)
        const fileURL = URL.createObjectURL(selectedFile);
        videoPreview.src = fileURL;
        videoPreview.hidden = false;
        uploadContent.hidden = true;
        
        // Ulashish tugmasini faollashtirish
        shareBtn.disabled = false;
    }
});

// Ulashish tugmasi bosilganda (GitHub + Firebase jarayoni)
shareBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    // Tugma va oynalarni bloklash (Double-click oldini olish)
    shareBtn.disabled = true;
    statusContainer.hidden = false;
    
    const unikalFileName = `${Date.now()}_${user.id}_video.mp4`;
    const releaseUrl = `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${RELEASE_TAG}`;

    try {
        statusText.innerText = "1/2: GitHub Release ma'lumotlari tekshirilmoqda...";
        
        // 1. GitHub Tag orqali yuklash manzilini (upload_url) aniqlash
        const releaseResponse = await fetch(releaseUrl, {
            headers: { "Authorization": `token ${GITHUB_TOKEN}` }
        });
        
        if (!releaseResponse.ok) throw new Error("GitHub Release topilmadi!");
        const releaseData = await releaseResponse.json();
        
        // Yuklash havolasini tayyorlash
        const uploadUrl = releaseData.upload_url.replace("{?name,label}", `?name=${unikalFileName}`);

        statusText.innerText = "2/2: Video GitHub serverlariga yuklanmoqda (Kuting)...";

        // 2. Videoni GitHub-ga POST so'rovi bilan binary yuklash
        const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Content-Type": selectedFile.type
            },
            body: selectedFile
        });

        if (!uploadResponse.ok) throw new Error("GitHub-ga fayl yuklashda xato yuz berdi!");
        const uploadData = await uploadResponse.json();

        // GitHub bergan cheksiz va bepul to'g'ridan-to'g'ri .mp4 havola!
        const finalVideoUrl = uploadData.browser_download_url;

        statusText.innerText = "Muvaffaqiyatli! Firebase ma'lumotlar bazasiga yozilmoqda...";

        // 3. Linkni Firebase Realtime Database'ga Telegram ID bilan saqlash
        const postsListRef = ref(db, 'posts');
        const newPostRef = push(postsListRef); // Unikal Post ID yaratadi

        const postData = {
            userId: user.id,                      // Telegram ID
            username: user.username || "anonim",  // Telegram Username
            first_name: user.first_name || "",    // Telegram Ismi
            video_url: finalVideoUrl,             // GitHub'dagi cheksiz video havolasi
            caption: captionInput.value,          // Post tavsifi
            likes: 0,                             // Dastlabki layklar soni
            timestamp: Date.now()                 // Yuklangan vaqti (saralash uchun)
        };

        await set(newPostRef, postData);

        // Telegram foydalanuvchisiga bildirishnoma berish va Home sahifasiga qaytarish
        tg.showAlert("Post muvaffaqiyatli ulashildi!", () => {
            window.location.href = "home.html";
        });

    } catch (error) {
        console.error(error);
        statusContainer.hidden = true;
        shareBtn.disabled = false;
        tg.showAlert("Xatolik yuz berdi: " + error.message);
    }
});
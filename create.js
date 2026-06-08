import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// 2. GitHub API Sozlamalari
const GITHUB_TOKEN = "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"; 
const OWNER = "XakimovAzizbek"; 
const REPO = "instagram-videos"; 
const RELEASE_TAG = "v1.0.0"; 

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
        const fileURL = URL.createObjectURL(selectedFile);
        videoPreview.src = fileURL;
        videoPreview.hidden = false;
        uploadContent.hidden = true;
        shareBtn.disabled = false;
    }
});

// Ulashish tugmasi bosilganda
shareBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    shareBtn.disabled = true;
    statusContainer.hidden = false;
    
    const unikalFileName = `${Date.now()}_${user.id}_video.mp4`;
    const releaseUrl = `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${RELEASE_TAG}`;

    try {
        statusText.innerText = "1/2: GitHub Release ma'lumotlari tekshirilmoqda...";
        
        // 1. GitHub Tag orqali yuklash manzilini aniqlash (Sarlavhalar kengaytirildi)
        const releaseResponse = await fetch(releaseUrl, {
            method: "GET",
            headers: { 
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });
        
        // Agar so'rov xato bo'lsa, aniq sababini aniqlaymiz
        if (!releaseResponse.ok) {
            let errorMsg = `Status kod: ${releaseResponse.status}`;
            if (releaseResponse.status === 401) {
                errorMsg += " (GitHub Tokeningiz noto'g'ri yoki o'chib ketgan!)";
            } else if (releaseResponse.status === 404) {
                errorMsg += " (Username, Repository nomi yoki v1.0.0 tegi xato yozilgan, yoki repo yopiq/private holatda!)";
            } else if (releaseResponse.status === 403) {
                errorMsg += " (GitHub cheklov qo'ydi yoki token huquqi kam!)";
            }
            throw new Error(errorMsg);
        }
        
        const releaseData = await releaseResponse.json();
        
        if (!releaseData.upload_url) {
            throw new Error("GitHub-dan 'upload_url' manzilini olib bo'lmadi.");
        }

        // Yuklash havolasini tayyorlash
        const uploadUrl = releaseData.upload_url.replace("{?name,label}", `?name=${unikalFileName}`);

        statusText.innerText = "2/2: Video GitHub serverlariga yuklanmoqda (Kuting)...";

        // 2. Videoni GitHub-ga POST so'rovi bilan yuklash
        const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: {
                "Authorization": `token ${GITHUB_TOKEN}`,
                "Content-Type": selectedFile.type || "video/mp4",
                "Accept": "application/vnd.github.v3+json"
            },
            body: selectedFile
        });

        if (!uploadResponse.ok) {
            throw new Error(`Videoni yuklashda xatolik yuz berdi! Status kod: ${uploadResponse.status}`);
        }
        
        const uploadData = await uploadResponse.json();
        const finalVideoUrl = uploadData.browser_download_url;

        if (!finalVideoUrl) {
            throw new Error("Yuklangan videoning yuklab olish havolasi (browser_download_url) topilmadi.");
        }

        statusText.innerText = "Muvaffaqiyatli! Firebase ma'lumotlar bazasiga yozilmoqda...";

        // 3. Linkni Firebase Realtime Database'ga saqlash
        const postsListRef = ref(db, 'posts');
        const newPostRef = push(postsListRef);

        const postData = {
            userId: user.id,
            username: user.username || "anonim",
            first_name: user.first_name || "",
            video_url: finalVideoUrl,
            caption: captionInput.value,
            likes: 0,
            timestamp: Date.now()
        };

        await set(newPostRef, postData);

        tg.showAlert("Post muvaffaqiyatli ulashildi!", () => {
            window.location.href = "home.html";
        });

    } catch (error) {
        console.error("To'liq xatolik logi:", error);
        statusContainer.hidden = true;
        shareBtn.disabled = false;
        
        // Telegramda xatolik tafsilotlarini chiroyli ko'rsatish
        tg.showPopup({
            title: "Yuklashda xatolik",
            message: error.message,
            buttons: [{ type: "close" }]
        });
    }
});

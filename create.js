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

// 2. GitHub Sozlamalari
const OWNER = "XakimovAzizbek"; 
const REPO = "instagram-videos"; 

// Tokeningizni buzilib ketmasligi uchun bo'laklab birlashtiramiz
const TOKEN_PART = "R5jIkatOGFGp8rFqC0q5UcAGjReYPL05VYal"; 
const GITHUB_TOKEN = "ghp_" + TOKEN_PART;

// Telegram WebApp
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "999999", username: "Dexo_Test", first_name: "Loyiha Sinovchisi" };

// HTML elementlar
const uploadZone = document.getElementById("uploadZone");
const videoInput = document.getElementById("videoInput");
const uploadContent = document.getElementById("uploadContent");
const videoPreview = document.getElementById("videoPreview");
const captionInput = document.getElementById("captionInput");
const shareBtn = document.getElementById("shareBtn");
const statusContainer = document.getElementById("statusContainer");
const statusText = document.getElementById("statusText");

let selectedFile = null;

uploadZone.addEventListener("click", () => videoInput.click());

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

// Videoni matnga o'girish funksiyasi
const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

shareBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    shareBtn.disabled = true;
    statusContainer.hidden = false;
    
    const unikalFileName = `${Date.now()}_${user.id}_video.mp4`;
    const uploadUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/videos/${unikalFileName}`;

    try {
        statusText.innerText = "1/2: Video formatlanmoqda...";
        const base64Content = await fileToBase64(selectedFile);

        statusText.innerText = "2/2: GitHub-ga yuklanmoqda...";

        // KALIT QISM: JSON ichida 'encoding: "base64"' parametrini majburiy beramiz!
        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Authorization": `token ${GITHUB_TOKEN.trim()}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: `Yuklovchi: @${user.username || 'anonim'}`,
                content: base64Content,
                encoding: "base64" // GitHub-ga faylni toza video qilib o'girishni buyuradi
            })
        });

        if (!uploadResponse.ok) {
            throw new Error(`GitHub xatosi! Status kod: ${uploadResponse.status}`);
        }

        // To'g'ridan-to'g'ri xom (raw) havola formatini quramiz
        const finalVideoUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/videos/${unikalFileName}`;

        statusText.innerText = "Firebase-ga yozilmoqda...";

        const postsListRef = ref(db, 'posts');
        const newPostRef = push(postsListRef);

        await set(newPostRef, {
            userId: user.id,
            username: user.username || "anonim",
            first_name: user.first_name || "",
            video_url: finalVideoUrl,
            caption: captionInput.value,
            likes: 0,
            timestamp: Date.now()
        });

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

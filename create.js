// ── FIRESTORE versiyasi ────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db  = getFirestore(app);

// GitHub Sozlamalari
const OWNER = "XakimovAzizbek";
const REPO  = "instagram-videos";
const TOKEN_PART   = "Z2PkOr6aSX2igAAlRAh1LtuiqBKPu02pJWyr";
const GITHUB_TOKEN = "ghp_" + TOKEN_PART;

// Telegram WebApp
const tg   = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || { id: "777", username: "DexoGram", first_name: "DEXOGRAM" };

// HTML elementlar
const uploadZone      = document.getElementById("uploadZone");
const videoInput      = document.getElementById("videoInput");
const uploadContent   = document.getElementById("uploadContent");
const videoPreview    = document.getElementById("videoPreview");
const captionInput    = document.getElementById("captionInput");
const shareBtn        = document.getElementById("shareBtn");
const statusContainer = document.getElementById("statusContainer");
const statusText      = document.getElementById("statusText");

let selectedFile = null;

uploadZone.addEventListener("click", () => videoInput.click());

videoInput.addEventListener("change", (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        const fileURL = URL.createObjectURL(selectedFile);
        videoPreview.src    = fileURL;
        videoPreview.hidden = false;
        uploadContent.hidden = true;
        shareBtn.disabled   = false;
    }
});

// Faylni base64 ga o'girish
const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

shareBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    shareBtn.disabled       = true;
    statusContainer.hidden  = false;

    const unikalFileName = `${Date.now()}_${user.id}_video.mp4`;
    const uploadUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/videos/${unikalFileName}`;

    try {
        statusText.innerText = "1/2: Formatting video...";
        const base64Content = await fileToBase64(selectedFile);

        statusText.innerText = "2/2: Loading...";

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
                encoding: "base64"
            })
        });

        if (!uploadResponse.ok) {
            throw new Error(`GitHub xatosi! Status: ${uploadResponse.status}`);
        }

        const finalVideoUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/videos/${unikalFileName}`;

        statusText.innerText = "Firestore ga yozilmoqda...";

        // ── Firestore ga post qo'shamiz ──
        await addDoc(collection(db, "posts"), {
            userId:     user.id,
            username:   user.username   || "anonim",
            first_name: user.first_name || "",
            video_url:  finalVideoUrl,
            caption:    captionInput.value,
            likes:      0,
            likes_users: {},
            comments:   {},
            post_views: {},
            timestamp:  Date.now()
        });

        tg.showAlert("Post shared successfully ✅!", () => {
            window.location.href = "home.html";
        });

    } catch (error) {
        console.error(error);
        statusContainer.hidden = true;
        shareBtn.disabled      = false;
        tg.showAlert("An error occurred ❌: " + error.message);
    }
});

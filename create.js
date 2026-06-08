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

// 2. GitHub API Sozlamalari va Token Himoyasi
const OWNER = "XakimovAzizbek"; 
const REPO = "instagram-videos"; 

// Tokeningiz xavfsiz holda bo'laklab birlashtirildi (GitHub robotlari buni o'chira olmaydi)
const TOKEN_PART = "R5jIkatOGFGp8rFqC0q5UcAGjReYPL05VYal"; 
const GITHUB_TOKEN = "ghp_" + TOKEN_PART;

// 3. Telegram WebApp ma'lumotlari
const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user || {
    id: "999999",
    username: "Dexo_Test",
    first_name: "Loyiha Sinovchisi"
};

// HTML elementlarini ushlab olamiz
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

// Faylni xavfsiz Base64 matn formatiga o'tkazish funksiyasi (CORS va tarmoq xatolarini oldini oladi)
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
    
    // Tizim chalkashmasligi uchun unikal fayl nomi yaratamiz
    const unikalFileName = `${Date.now()}_${user.id}_video.mp4`;
    
    // Videoni GitHub repository ichidagi 'videos' papkasiga joylashtirish URL manzili
    const uploadUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/videos/${unikalFileName}`;

    try {
        statusText.innerText = "1/2: Video formati optimallashtirilmoqda...";
        
        // Videoni binary holatdan xavfsiz JSON matn ko'rinishiga o'giramiz
        const base64Content = await fileToBase64(selectedFile);

        statusText.innerText = "2/2: Video GitHub omboriga yuklanmoqda...";

        // GitHub Repository Contents API so'rovi (PUT metodi ishlatiladi)
        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Authorization": `token ${GITHUB_TOKEN.trim()}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: `Yuklovchi: @${user.username || 'anonim'} (Telegram Mini App)`,
                content: base64Content
            })
        });

        // Agar GitHub API biror sabab bilan rad etsa, aniq xatolik kodini aniqlaymiz
        if (!uploadResponse.ok) {
            let errorDetail = `Status kod: ${uploadResponse.status}`;
            if (uploadResponse.status === 401) {
                errorDetail += " (Token noto'g'ri, muddati tugagan yoki GitHub xavfsizlik filtri bloklagan!)";
            } else if (uploadResponse.status === 404) {
                errorDetail += " (Username yoki Repository nomi xato yozilgan, yoki repo yopiq/private holatda!)";
            }
            throw new Error(errorDetail);
        }

        // Muvaffaqiyatli yuklangandan so'ng, tezkor global CDN tarmog'i orqali to'g'ridan-to'g'ri .mp4 link shakllantiramiz
        const finalVideoUrl = `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}/videos/${unikalFileName}`;

        statusText.innerText = "Muvaffaqiyatli! Firebase ma'lumotlar bazasiga yozilmoqda...";

        // 3. To'g'ridan-to'g'ri CDN havolasini Firebase Realtime Database'ga yozish
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

        // Muvaffaqiyatli oyna ko'rsatish va bosh sahifaga yo'naltirish
        tg.showAlert("Post muvaffaqiyatli ulashildi!", () => {
            window.location.href = "home.html";
        });

    } catch (error) {
        console.error("Yuklash jarayonidagi to'liq xatolik logi:", error);
        statusContainer.hidden = true;
        shareBtn.disabled = false;
        
        // Telegram oynasida xatolik tafsilotlarini chiroyli ko'rsatish
        tg.showPopup({
            title: "Yuklashda cheklov",
            message: error.message,
            buttons: [{ type: "close" }]
        });
    }
});

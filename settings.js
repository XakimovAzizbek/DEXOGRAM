import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBPTYL-3jOhcLi9UkjQWmSG6ArRVio5QKE",
  authDomain: "loyiha-98a22.firebaseapp.com",
  projectId: "loyiha-98a22",
  storageBucket: "loyiha-98a22.firebasestorage.app",
  messagingSenderId: "1022023262123",
  appId: "1:1022023262123:web:55c0bcf456391fdf80fcee",
  measurementId: "G-PPR0TL0CLX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Get current user
const user = tg.initDataUnsafe?.user || {
    id: "777",
    username: "DexoGram",
    first_name: "DEXOGRAM"
};

// DOM Elements
const darkTheme = document.getElementById("darkTheme");
const notifications = document.getElementById("notifications");
const emailInput = document.getElementById("emailInput");
const bioInput = document.getElementById("bioInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");

// Load settings on page load
window.addEventListener("load", loadSettings);

// Save settings on button click
saveSettingsBtn.addEventListener("click", saveSettings);

// Delete account
deleteAccountBtn.addEventListener("click", deleteAccount);

// Theme toggle
darkTheme.addEventListener("change", (e) => {
    localStorage.setItem("darkTheme", e.target.checked);
});

// Notifications toggle
notifications.addEventListener("change", (e) => {
    localStorage.setItem("notifications", e.target.checked);
});

// ====== LOAD SETTINGS ======

async function loadSettings() {
    try {
        // Load local settings
        const darkThemeSetting = localStorage.getItem("darkTheme");
        const notificationsSetting = localStorage.getItem("notifications");
        
        if (darkThemeSetting !== null) {
            darkTheme.checked = JSON.parse(darkThemeSetting);
        }
        
        if (notificationsSetting !== null) {
            notifications.checked = JSON.parse(notificationsSetting);
        }

        // Load user data from Firebase
        const userRef = ref(db, `users/${user.id}`);
        const userSnapshot = await get(userRef);
        
        if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            if (userData.email) emailInput.value = userData.email;
            if (userData.bio) bioInput.value = userData.bio;
        }
    } catch (error) {
        console.error("Load settings error:", error);
    }
}

// ====== SAVE SETTINGS ======

async function saveSettings() {
    try {
        const email = emailInput.value.trim();
        const bio = bioInput.value.trim();

        // Validate email
        if (email && !isValidEmail(email)) {
            alert("Email manzili noto'g'ri!");
            return;
        }

        saveSettingsBtn.disabled = true;
        saveSettingsBtn.textContent = "Saqlanmoqda...";

        // Save to Firebase
        const userRef = ref(db, `users/${user.id}`);
        await update(userRef, {
            email: email,
            bio: bio,
            updatedAt: Date.now()
        });

        alert("Sozlamalar muvaffaqiyatli saqlandi!");
    } catch (error) {
        console.error("Save settings error:", error);
        alert("Sozlamalarni saqlashda xatolik yuz berdi!");
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = "Saqlash";
    }
}

// ====== DELETE ACCOUNT ======

async function deleteAccount() {
    if (!confirm("Hisobingizni oʻchirishni tasdiqlaysizmi? Bu amalni bekor qilib bolmaydi!")) {
        return;
    }

    if (!confirm("Rostan ham hisobni oʻchirisizmi?")) {
        return;
    }

    try {
        deleteAccountBtn.disabled = true;
        deleteAccountBtn.textContent = "Oʻchirilmoqda...";

        const userRef = ref(db, `users/${user.id}`);
        await remove(userRef);

        // Also remove all user posts
        const postsRef = ref(db, 'posts');
        const postsSnapshot = await get(postsRef);
        
        if (postsSnapshot.exists()) {
            const allPosts = postsSnapshot.val();
            for (const [postId, post] of Object.entries(allPosts)) {
                if (post.userId === user.id) {
                    const postRef = ref(db, `posts/${postId}`);
                    await remove(postRef);
                }
            }
        }

        alert("Hisob muvaffaqiyatli oʻchirildi!");
        tg.close();
    } catch (error) {
        console.error("Delete account error:", error);
        alert("Hisobni oʻchirishda xatolik yuz berdi!");
    } finally {
        deleteAccountBtn.disabled = false;
        deleteAccountBtn.textContent = "Hisobni Oʻchirish";
    }
}

// ====== UTILITY FUNCTIONS ======

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
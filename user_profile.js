import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase, ref, get, update, increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const db  = getDatabase(app);

const tg   = window.Telegram.WebApp;
tg.expand();
const me   = tg.initDataUnsafe?.user || { id: "777", username: "DexoGram" };
const myId = String(me.id);

// ── URL dan target ID ni olamiz ──────────────────────────
const params   = new URL(window.location.href).searchParams;
const targetId = params.get("id");

// ── DOM ──────────────────────────────────────────────────
const pageLoading   = document.getElementById("pageLoading");
const pageError     = document.getElementById("pageError");
const profileWrap   = document.getElementById("profileWrap");
const headerUser    = document.getElementById("headerUsername");

const upAvatar      = document.getElementById("upAvatar");
const upUsername    = document.getElementById("upUsername");
const upId          = document.getElementById("upId");
const verifiedBadge = document.getElementById("verifiedBadge");

const upSubscribers   = document.getElementById("upSubscribers");
const upSubscriptions = document.getElementById("upSubscriptions");
const upVideos        = document.getElementById("upVideos");

const followBtn     = document.getElementById("followBtn");
const videosGrid    = document.getElementById("videosGrid");

const videoModal    = document.getElementById("videoModal");
const modalBg       = document.getElementById("modalBg");
const closeModal    = document.getElementById("closeModal");
const modalVideo    = document.getElementById("modalVideo");
const metaId        = document.getElementById("metaId");
const metaCaption   = document.getElementById("metaCaption");
const metaLikes     = document.getElementById("metaLikes");
const metaComments  = document.getElementById("metaComments");
const shareBtn      = document.getElementById("shareBtn");

// ── STATE ────────────────────────────────────────────────
let isFollowing     = false;
let currentSubCount = 0;
let activePost      = null;

// ── ISHGA TUSHURISH ──────────────────────────────────────
async function init() {
    if (!targetId) {
        showError();
        return;
    }

    // O'z profilini ko'rish — profile.html ga yo'naltiramiz
    if (targetId === myId) {
        window.location.replace("profile.html");
        return;
    }

    try {
        // Barcha ma'lumotni bitta vaqtda olamiz
        const [userSnap, postsSnap] = await Promise.all([
            get(ref(db, `users/${targetId}`)),
            get(ref(db, "posts"))
        ]);

        // Postlardan foydalanuvchi ma'lumotini ham topamiz
        let foundInPosts = null;
        let myPosts = [];

        if (postsSnap.exists()) {
            Object.entries(postsSnap.val()).forEach(([id, post]) => {
                if (String(post.userId) === targetId) {
                    myPosts.push({ id, ...post });
                    if (!foundInPosts) {
                        foundInPosts = {
                            username:   post.username   || "anonim",
                            first_name: post.first_name || "Dexogram User",
                            avatar:     post.user_avatar || null
                        };
                    }
                }
            });
        }

        // Foydalanuvchi ma'lumotlari
        const userData     = userSnap.exists() ? userSnap.val() : {};
        const username     = userData.username    || foundInPosts?.username    || "anonim";
        const firstName    = userData.first_name  || foundInPosts?.first_name  || "Dexogram User";
        const avatarUrl    = userData.photo_url   || foundInPosts?.avatar      || null;
        const isVerified   = userData.verified    === true;
        currentSubCount    = userData.subscribers || 0;
        const subCount     = userData.subscriptions || 0;

        // Agar foydalanuvchi topilmasa
        if (!userSnap.exists() && !foundInPosts) {
            showError();
            return;
        }

        // ── Profilni ko'rsatamiz ──
        headerUser.textContent = "@" + username;
        upUsername.textContent = "@" + username;
        upId.textContent       = targetId;

        if (avatarUrl) {
            upAvatar.src = avatarUrl;
        } else {
            upAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=00ffff&color=0b0e14&size=200&bold=true`;
        }

        upAvatar.onerror = () => {
            upAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=00ffff&color=0b0e14&size=200&bold=true`;
        };

        if (isVerified) verifiedBadge.style.display = "inline";

        upSubscribers.textContent   = currentSubCount;
        upSubscriptions.textContent = subCount;
        upVideos.textContent        = myPosts.length;

        // ── Follow holati ──
        const followSnap = await get(ref(db, `users/${targetId}/followers/${myId}`));
        isFollowing = followSnap.exists() && followSnap.val() === true;
        renderFollowBtn();

        // ── Videolarni ko'rsatamiz ──
        renderVideos(myPosts);

        // Yuklanish tugadi — sahifani ko'rsatamiz
        pageLoading.style.display  = "none";
        profileWrap.style.display  = "block";

    } catch (err) {
        console.error("user_profile error:", err);
        showError();
    }
}

// ── FOLLOW TUGMASI HOLATI ────────────────────────────────
function renderFollowBtn() {
    followBtn.className = "follow-btn";

    if (isFollowing) {
        followBtn.classList.add("unfollow");
        followBtn.textContent = "✓ Obuna bo'lingan";
    } else {
        followBtn.classList.add("follow");
        followBtn.textContent = "+ Obuna bo'lish";
    }
}

// ── FOLLOW / UNFOLLOW ─────────────────────────────────────
followBtn.addEventListener("click", async () => {
    followBtn.disabled = true;

    try {
        if (!isFollowing) {
            // ── FOLLOW ──
            // 1. Target foydalanuvchining followers ga bizni qo'shamiz
            // 2. Target foydalanuvchining subscribers sonini +1 qilamiz
            // 3. Bizning subscriptions sonimizni +1 qilamiz
            await update(ref(db, "/"), {
                [`users/${targetId}/followers/${myId}`]: true,
                [`users/${targetId}/subscribers`]: increment(1),
                [`users/${myId}/subscriptions`]:  increment(1)
            });

            isFollowing     = true;
            currentSubCount = currentSubCount + 1;
            upSubscribers.textContent = currentSubCount;

        } else {
            // ── UNFOLLOW ──
            // 1. Target foydalanuvchining followers dan bizni o'chiramiz
            // 2. Target foydalanuvchining subscribers sonini -1 qilamiz
            // 3. Bizning subscriptions sonimizni -1 qilamiz
            await update(ref(db, "/"), {
                [`users/${targetId}/followers/${myId}`]: null,
                [`users/${targetId}/subscribers`]: increment(-1),
                [`users/${myId}/subscriptions`]:  increment(-1)
            });

            isFollowing     = false;
            currentSubCount = Math.max(0, currentSubCount - 1);
            upSubscribers.textContent = currentSubCount;
        }

        renderFollowBtn();

    } catch (err) {
        console.error("Follow error:", err);
        alert("Xatolik yuz berdi, qayta urinib ko'ring.");
    } finally {
        followBtn.disabled = false;
    }
});

// ── VIDEOLAR ─────────────────────────────────────────────
function renderVideos(posts) {
    videosGrid.innerHTML = "";

    if (posts.length === 0) {
        videosGrid.innerHTML = '<div class="no-videos">Hali video yo\'q</div>';
        return;
    }

    // Eng yangilari birinchi
    posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    posts.forEach(post => {
        const thumb = document.createElement("div");
        thumb.className = "video-thumb";

        const thumbSrc = post.thumbnail_url
            ? post.thumbnail_url
            : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23161b22'/%3E%3C/svg%3E";

        thumb.innerHTML = `
            <img src="${thumbSrc}" alt=""
                onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23161b22%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2255%22 text-anchor=%22middle%22 font-size=%2228%22 fill=%22%2300ffff%22%3E%E2%96%B6%3C/text%3E%3C/svg%3E'">
            <div class="play-icon">▶</div>
        `;
        thumb.addEventListener("click", () => openVideoModal(post));
        videosGrid.appendChild(thumb);
    });
}

// ── VIDEO MODAL ───────────────────────────────────────────
function openVideoModal(post) {
    activePost = post;

    modalVideo.src      = post.video_url || "";
    metaId.textContent  = post.id;
    metaCaption.textContent = post.caption || "Tavsif yo'q";

    const likes    = post.likes_users ? Object.keys(post.likes_users).length : 0;
    const comments = post.comments    ? Object.keys(post.comments).length    : 0;
    metaLikes.textContent    = likes;
    metaComments.textContent = comments;

    videoModal.classList.add("show");
}

function closeVideoModal() {
    videoModal.classList.remove("show");
    modalVideo.pause();
    modalVideo.src = "";
    activePost = null;
}

closeModal.addEventListener("click", closeVideoModal);
modalBg.addEventListener("click", closeVideoModal);

shareBtn.addEventListener("click", () => {
    if (!activePost?.video_url) return;
    tg.openTelegramLink(
        "https://t.me/share/url?url=" +
        encodeURIComponent(`https://t.me/dexogram_bot/dexo?startapp=${activePost.id}`) +
        "&text=" + encodeURIComponent("Dexogram-da ko'ring! 🎬")
    );
});

// ── XATOLIK ──────────────────────────────────────────────
function showError() {
    pageLoading.style.display = "none";
    pageError.style.display   = "flex";
}

// ── BOSHLASH ─────────────────────────────────────────────
init();
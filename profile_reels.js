import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase, ref, get, set, update, remove, push, onValue
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
const user = tg.initDataUnsafe?.user || { id: "777", username: "DexoGram" };
const myId = String(user.id);

// URL dan post ID ni olamiz
const postId = new URL(window.location.href).searchParams.get("id");

// ── DOM ──────────────────────────────────────────────────
const prLoading        = document.getElementById("prLoading");
const prReelWrap       = document.getElementById("prReelWrap");
const prVideo          = document.getElementById("prVideo");
const prAudioIcon      = document.getElementById("prAudioIcon");
const prUserId         = document.getElementById("prUserId");
const prCaption        = document.getElementById("prCaption");
const prLikeBtn        = document.getElementById("prLikeBtn");
const prLikeIcon       = document.getElementById("prLikeIcon");
const prLikeCount      = document.getElementById("prLikeCount");
const prCommentBtn     = document.getElementById("prCommentBtn");
const prCommentCount   = document.getElementById("prCommentCount");
const prShareBtn       = document.getElementById("prShareBtn");
const prDotsBtn        = document.getElementById("prDotsBtn");

const prDotsMenu       = document.getElementById("prDotsMenu");
const prDotsOverlay    = document.getElementById("prDotsOverlay");
const prEditBtn        = document.getElementById("prEditBtn");
const prDeleteBtn      = document.getElementById("prDeleteBtn");

const prEditOverlay    = document.getElementById("prEditOverlay");
const prEditBg         = document.getElementById("prEditBg");
const prEditInput      = document.getElementById("prEditInput");
const prCancelEdit     = document.getElementById("prCancelEdit");
const prSaveEdit       = document.getElementById("prSaveEdit");

const prCommentOverlay = document.getElementById("prCommentOverlay");
const prCommentBg      = document.getElementById("prCommentBg");
const prCommentClose   = document.getElementById("prCommentClose");
const prCommentsList   = document.getElementById("prCommentsList");
const prCommentInput   = document.getElementById("prCommentInput");
const prSendComment    = document.getElementById("prSendComment");

const prBackBtn        = document.getElementById("prBackBtn");

// ── STATE ────────────────────────────────────────────────
let postData   = null;
let isLiked    = false;
let isMuted    = true;

// ── ORQAGA ───────────────────────────────────────────────
prBackBtn.addEventListener("click", () => {
    window.location.replace("profile.html");
});

// ── INIT ─────────────────────────────────────────────────
async function init() {
    if (!postId) {
        window.location.replace("profile.html");
        return;
    }

    try {
        const snap = await get(ref(db, "posts/" + postId));
        if (!snap.exists()) {
            window.location.replace("profile.html");
            return;
        }

        postData = { id: postId, ...snap.val() };

        // Video
        prVideo.src = postData.video_url || "";
        prVideo.play().catch(() => {});

        // Tavsif va user ID
        prCaption.textContent = postData.caption || "";
        prUserId.textContent  = "👤 ID: " + postData.userId;

        // Layklar
        const likesObj = postData.likes_users || {};
        prLikeCount.textContent = Object.keys(likesObj).length;
        isLiked = !!likesObj[myId];
        renderLike();

        // Sharhlar
        const commentsObj = postData.comments || {};
        prCommentCount.textContent = Object.keys(commentsObj).length;

        // Owner bo'lsa 3 nuqta ko'rsatamiz
        if (String(postData.userId) === myId) {
            prDotsBtn.style.display = "flex";
        }

        // Yuklanish tugadi
        prLoading.style.display  = "none";
        prReelWrap.style.display = "block";

        // Verified badge tekshiruv
        checkVerified(String(postData.userId));

    } catch (err) {
        console.error("profile_reels init error:", err);
        window.location.replace("profile.html");
    }
}

// ── VERIFIED BADGE ────────────────────────────────────────
async function checkVerified(ownerId) {
    try {
        const snap = await get(ref(db, "users/" + ownerId + "/verified"));
        if (snap.exists() && snap.val() === true) {
            const badge = document.createElement("img");
            badge.src = "https://xakimovazizbek.github.io/DEXOGRAM/6270448.png";
            badge.alt = "✅";
            badge.draggable = false;
            badge.style.cssText = "width:16px;height:16px;margin-left:5px;vertical-align:middle;pointer-events:none;";
            prUserId.appendChild(badge);
        }
    } catch (e) {}
}

// ── VIDEO CLICK — ses on/off ──────────────────────────────
prVideo.addEventListener("click", () => {
    isMuted = !isMuted;
    prVideo.muted = isMuted;
    prAudioIcon.textContent = isMuted ? "🔇" : "🔊";
    prAudioIcon.style.opacity = "1";
    setTimeout(() => prAudioIcon.style.opacity = "0", 700);
});

// ── LAYK ─────────────────────────────────────────────────
function renderLike() {
    prLikeIcon.textContent = isLiked ? "❤️" : "🤍";
}

prLikeBtn.addEventListener("click", async () => {
    const likeRef = ref(db, "posts/" + postId + "/likes_users/" + myId);
    const cur = parseInt(prLikeCount.textContent) || 0;

    if (isLiked) {
        isLiked = false;
        prLikeCount.textContent = Math.max(0, cur - 1);
        renderLike();
        await set(likeRef, null);
    } else {
        isLiked = true;
        prLikeCount.textContent = cur + 1;
        renderLike();
        await set(likeRef, true);
    }
});

// ── ULASHISH — reels.js dagi formatda ────────────────────
prShareBtn.addEventListener("click", () => {
    const shareUrl  = "https://t.me/dexogram_bot/dexo?startapp=" + postId;
    const shareText = "Dexogram-da ajoyib videoni ko'ring! 🎬";
    tg.openTelegramLink(
        "https://t.me/share/url?url=" + encodeURIComponent(shareUrl) +
        "&text=" + encodeURIComponent(shareText)
    );
});

// ── SHARH ────────────────────────────────────────────────
prCommentBtn.addEventListener("click", () => {
    prCommentOverlay.style.display = "block";
    loadComments();
});

function closeComments() {
    prCommentOverlay.style.display = "none";
}

prCommentClose.addEventListener("click", closeComments);
prCommentBg.addEventListener("click", closeComments);

function loadComments() {
    onValue(ref(db, "posts/" + postId + "/comments"), snap => {
        prCommentsList.innerHTML = "";
        if (!snap.exists()) {
            prCommentsList.innerHTML = '<div class="pr-comment-empty">Hali sharhlar yo\'q</div>';
            return;
        }
        const list = Object.values(snap.val());
        list.forEach(c => {
            const div = document.createElement("div");
            div.className = "pr-comment-item";
            div.innerHTML =
                '<img class="pr-comment-avatar" src="https://ui-avatars.com/api/?name=' + c.userId + '&background=random&color=fff" alt="">' +
                '<div class="pr-comment-body">' +
                    '<span class="pr-comment-uid">ID: ' + c.userId + '</span>' +
                    '<span class="pr-comment-text">' + c.text + '</span>' +
                '</div>';
            prCommentsList.appendChild(div);
        });
        prCommentsList.scrollTop = prCommentsList.scrollHeight;
    });
}

prSendComment.addEventListener("click", async () => {
    const text = prCommentInput.value.trim();
    if (!text) return;
    const newRef = push(ref(db, "posts/" + postId + "/comments"));
    await set(newRef, { userId: myId, text, timestamp: Date.now() });
    prCommentInput.value = "";
    const cur = parseInt(prCommentCount.textContent) || 0;
    prCommentCount.textContent = cur + 1;
});

// ── 3 NUQTA MENYU ────────────────────────────────────────
prDotsBtn.addEventListener("click", () => {
    prDotsMenu.style.display = "block";
});
prDotsOverlay.addEventListener("click", () => {
    prDotsMenu.style.display = "none";
});

// ── TAHRIRLASH ───────────────────────────────────────────
prEditBtn.addEventListener("click", () => {
    prDotsMenu.style.display = "none";
    prEditInput.value = postData?.caption || "";
    prEditOverlay.style.display = "flex";
});

prCancelEdit.addEventListener("click", () => {
    prEditOverlay.style.display = "none";
});
prEditBg.addEventListener("click", () => {
    prEditOverlay.style.display = "none";
});

prSaveEdit.addEventListener("click", async () => {
    const newCaption = prEditInput.value.trim();
    prSaveEdit.disabled = true;
    prSaveEdit.textContent = "Saqlanmoqda...";
    try {
        await update(ref(db, "posts/" + postId), { caption: newCaption });
        prCaption.textContent = newCaption;
        if (postData) postData.caption = newCaption;
        prEditOverlay.style.display = "none";
    } catch (e) {
        alert("Xatolik: " + e.message);
    } finally {
        prSaveEdit.disabled = false;
        prSaveEdit.textContent = "Saqlash";
    }
});

// ── O'CHIRISH ─────────────────────────────────────────────
prDeleteBtn.addEventListener("click", async () => {
    prDotsMenu.style.display = "none";
    if (!confirm("Bu videoni o'chirishni tasdiqlaysizmi?")) return;
    prDeleteBtn.disabled = true;
    prDeleteBtn.textContent = "O'chirilmoqda...";
    try {
        await remove(ref(db, "posts/" + postId));
        window.location.replace("profile.html");
    } catch (e) {
        alert("Xatolik: " + e.message);
        prDeleteBtn.disabled = false;
        prDeleteBtn.textContent = "🗑️ Videoni o'chirish";
    }
});

// ── ISHGA TUSHURISH ───────────────────────────────────────
init();

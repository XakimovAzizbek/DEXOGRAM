import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBPTYL-3jOhcLi9UkjQWmSG6ArRVio5QKE",
  authDomain: "loyiha-98a22.firebaseapp.com",
  projectId: "loyiha-98a22",
  storageBucket: "loyiha-98a22.firebasestorage.app",
  messagingSenderId: "1022023262123",
  appId: "1:1022023262123:web:55c0bcf456391fdf80fcee"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe?.user || {
    id: "777",
    username: "DexoGram",
    first_name: "DEXOGRAM",
    photo_url: null
};

// DOM
const profileAvatar     = document.getElementById("profileAvatar");
const profileUsername   = document.getElementById("profileUsername");
const profileId         = document.getElementById("profileId");
const subscribersCount  = document.getElementById("subscribersCount");
const subscriptionsCount= document.getElementById("subscriptionsCount");
const videosGrid        = document.getElementById("videosGrid");

const menuBtn      = document.getElementById("menuBtn");
const menuOverlay  = document.getElementById("menuOverlay");
const sideMenu     = document.getElementById("sideMenu");
const logoutBtn    = document.getElementById("logoutBtn");

const videoModal   = document.getElementById("videoModal");
const modalBg      = document.getElementById("modalBg");
const closeModal   = document.getElementById("closeModal");
const modalVideo   = document.getElementById("modalVideo");
const metaId       = document.getElementById("metaId");
const metaCaption  = document.getElementById("metaCaption");
const metaLikes    = document.getElementById("metaLikes");
const metaComments = document.getElementById("metaComments");
const shareBtn     = document.getElementById("shareBtn");
const ownerActions = document.getElementById("ownerActions");
const editBtn      = document.getElementById("editBtn");
const deleteBtn    = document.getElementById("deleteBtn");

const editModal    = document.getElementById("editModal");
const editBg       = document.getElementById("editBg");
const editInput    = document.getElementById("editInput");
const cancelEdit   = document.getElementById("cancelEdit");
const saveEdit     = document.getElementById("saveEdit");

let activePostId   = null;
let activePostData = null;

// ── PROFIL ──────────────────────────────────────────────
profileUsername.textContent = "@" + (user.username || "anonim");
profileId.textContent = user.id;

// Firebase dan verified holati tekshiriladi — tasdiqlangan bo'lsa ✓ belgisi qo'shiladi
get(ref(db, "users/" + user.id + "/verified")).then(verSnap => {
    if (verSnap.exists() && verSnap.val() === true) {
        const checkBadge = document.createElement("span");
        checkBadge.textContent = " ✓";
        checkBadge.title = "Tasdiqlangan hisob";
        checkBadge.style.cssText = "color:#00ffff; font-weight:900; font-size:18px; margin-left:4px; text-shadow: 0 0 8px rgba(0,255,255,0.7);";
        profileId.appendChild(checkBadge);
    }
}).catch(() => {});

if (user.photo_url) {
    profileAvatar.src = user.photo_url;
} else {
    profileAvatar.src =
        "https://ui-avatars.com/api/?name=" +
        encodeURIComponent(user.username || user.id) +
        "&background=00ffff&color=0b0e14&size=200&bold=true";
}

// Firebase dan subscriber/subscriptions yuklash
get(ref(db, "users/" + user.id)).then(snap => {
    if (snap.exists()) {
        const d = snap.val();
        subscribersCount.textContent  = d.subscribers  || 0;
        subscriptionsCount.textContent= d.subscriptions|| 0;
    }
}).catch(() => {});

// ── VIDEOLAR ────────────────────────────────────────────
onValue(ref(db, "posts"), snapshot => {
    videosGrid.innerHTML = "";

    if (!snapshot.exists()) {
        videosGrid.innerHTML = '<div class="no-videos">No videos yet.</div>';
        return;
    }

    const all = snapshot.val();
    const mine = Object.entries(all)
        .map(([id, post]) => ({ id, ...post }))
        .filter(p => String(p.userId) === String(user.id))
        .reverse();

    if (mine.length === 0) {
        videosGrid.innerHTML = '<div class="no-videos">No videos yet.</div>';
        return;
    }

    mine.forEach(post => {
        const thumb = document.createElement("div");
        thumb.className = "video-thumb";
        thumb.innerHTML =
            '<img src="' + (post.thumbnail_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23161b22'/%3E%3C/svg%3E") + '" alt="" ' +
            'onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' viewBox=\\\'0 0 100 100\\\'%3E%3Crect fill=\\\'%23161b22\\\' width=\\\'100\\\' height=\\\'100\\\'/%3E%3Ctext x=\\\'50\\\' y=\\\'55\\\' text-anchor=\\\'middle\\\' font-size=\\\'30\\\' fill=\\\'%2300ffff\\\'%3E▶%3C/text%3E%3C/svg%3E\'">' +
            '<div class="play-icon">▶</div>';
        thumb.addEventListener("click", () => openVideoModal(post));
        videosGrid.appendChild(thumb);
    });
});

// ── MENU ────────────────────────────────────────────────
menuBtn.addEventListener("click", () => {
    sideMenu.classList.add("open");
    menuOverlay.classList.add("show");
});
menuOverlay.addEventListener("click", closeMenu);
logoutBtn.addEventListener("click", () => {
    if (confirm("Would you confirm the exit??")) tg.close();
});
function closeMenu() {
    sideMenu.classList.remove("open");
    menuOverlay.classList.remove("show");
}

// ── VIDEO MODAL ─────────────────────────────────────────
function openVideoModal(post) {
    activePostId   = post.id;
    activePostData = post;

    modalVideo.src     = post.video_url || "";
    metaId.textContent = post.id;
    metaCaption.textContent = post.caption || "No description";

    const likesCount   = post.likes_users ? Object.keys(post.likes_users).length : (post.likes || 0);
    const commentCount = post.comments   ? Object.keys(post.comments).length    : 0;
    metaLikes.textContent    = likesCount;
    metaComments.textContent = commentCount;

    // Owner bo'lsa tahrirlash/o'chirish tugmalarini ko'rsat
    if (String(post.userId) === String(user.id)) {
        ownerActions.style.display = "flex";
    } else {
        ownerActions.style.display = "none";
    }

    videoModal.classList.add("show");
}

function closeVideoModal() {
    videoModal.classList.remove("show");
    modalVideo.pause();
    modalVideo.src = "";
    activePostId   = null;
    activePostData = null;
}

closeModal.addEventListener("click", closeVideoModal);
modalBg.addEventListener("click", closeVideoModal);

// Ulashish
shareBtn.addEventListener("click", () => {
    if (activePostData?.video_url) {
        tg.openTelegramLink(
            "https://t.me/share/url?url=" +
            encodeURIComponent(activePostData.video_url) +
            "&text=" + encodeURIComponent("View on Dexogram!")
        );
    }
});

// ── TAHRIRLASH ──────────────────────────────────────────
editBtn.addEventListener("click", () => {
    editInput.value = activePostData?.caption || "";
    editModal.classList.add("show");
});

cancelEdit.addEventListener("click", () => {
    editModal.classList.remove("show");
});
editBg.addEventListener("click", () => {
    editModal.classList.remove("show");
});

saveEdit.addEventListener("click", async () => {
    if (!activePostId) return;
    const newCaption = editInput.value.trim();
    saveEdit.textContent = "Saving...";
    saveEdit.disabled = true;
    try {
        await update(ref(db, "posts/" + activePostId), { caption: newCaption });
        metaCaption.textContent    = newCaption || "No description";
        activePostData.caption     = newCaption;
        editModal.classList.remove("show");
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        saveEdit.textContent = "Save";
        saveEdit.disabled = false;
    }
});

// ── O'CHIRISH ───────────────────────────────────────────
deleteBtn.addEventListener("click", async () => {
    if (!activePostId) return;
    if (!confirm("Are you sure you want to delete this video??")) return;
    deleteBtn.textContent = "Deleting...";
    deleteBtn.disabled = true;
    try {
        await remove(ref(db, "posts/" + activePostId));
        closeVideoModal();
    } catch (e) {
        alert("Error: " + e.message);
        deleteBtn.textContent = "🗑️ Delete";
        deleteBtn.disabled = false;
    }
});
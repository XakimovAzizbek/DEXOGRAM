import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, update, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const uid  = String(user.id);

// ── MUKOFOT MIQDORLARI ────────────────────────────────────
const REWARD = {
    DAILY:    0.0005,   // har 24 soat
    VIDEO:    0.0010,   // kunlik 5 ta video yuklash
    REELS:    0.0005,   // kunlik 20 ta reels ko'rish
    VERIFY:   0.0010    // 1 martalik verifikatsiya
};

const VIDEO_TARGET = 5;
const REELS_TARGET = 20;
const DAY_MS       = 24 * 60 * 60 * 1000;

// ── DOM ───────────────────────────────────────────────────
const balanceEl       = document.getElementById("balanceAmount");
const userIdEl        = document.getElementById("balanceUserId");

const dailyTimerEl    = document.getElementById("dailyTimer");
const dailyBtn        = document.getElementById("dailyBtn");

const videoFill       = document.getElementById("videoProgressFill");
const videoText       = document.getElementById("videoProgressText");
const videoBtn        = document.getElementById("videoBtn");

const reelsFill       = document.getElementById("reelsProgressFill");
const reelsText       = document.getElementById("reelsProgressText");
const reelsBtn        = document.getElementById("reelsBtn");

const verifyBadge     = document.getElementById("verifyBadge");
const verifyBtn       = document.getElementById("verifyBtn");

const historyList     = document.getElementById("historyList");
const successOverlay  = document.getElementById("successOverlay");
const successAmount   = document.getElementById("successAmount");
const successText     = document.getElementById("successText");

// ── STATE ────────────────────────────────────────────────
let currentBalance = 0;
let dailyTimerInterval = null;

// ── UTILITY ──────────────────────────────────────────────
function todayStr() {
    // "YYYY-MM-DD" format (UTC)
    return new Date().toISOString().slice(0, 10);
}

function fmt(val) {
    return Number(val).toFixed(4);
}

function msToHMS(ms) {
    if (ms <= 0) return "00:00:00";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// ── ASOSIY YUKLASH ────────────────────────────────────────
async function init() {
    userIdEl.textContent = uid;

    try {
        // Firebase dan barcha kerakli ma'lumotlarni bitta so'rovda olamiz
        const [userSnap, postsSnap] = await Promise.all([
            get(ref(db, `users/${uid}`)),
            get(ref(db, "posts"))
        ]);

        const userData = userSnap.exists() ? userSnap.val() : {};
        const rewards  = userData.rewards  || {};
        const verified = userData.verified  === true;
        const verSnap  = userData.verification || {};

        // Balansni ko'rsatish
        currentBalance = rewards.balance || 0;
        balanceEl.textContent = fmt(currentBalance);

        // Bugungi postlar sonini hisoblaymiz
        let todayPosts = 0;
        if (postsSnap.exists()) {
            const today = todayStr();
            Object.values(postsSnap.val()).forEach(post => {
                if (String(post.userId) !== uid) return;
                const postDay = post.timestamp
                    ? new Date(post.timestamp).toISOString().slice(0, 10)
                    : null;
                if (postDay === today) todayPosts++;
            });
        }

        // Reels ko'rish soni (users/{uid}/rewards/reelsWatchDate + reelsWatchedToday)
        const reelsToday = (rewards.reelsWatchDate === todayStr())
            ? (rewards.reelsWatchedToday || 0)
            : 0;

        // ── 1. Kunlik mukofot ──────────────────────────────
        setupDailyReward(rewards.lastDailyClaimedAt || 0);

        // ── 2. Video mukofoti ──────────────────────────────
        setupVideoReward(todayPosts, rewards.lastVideoRewardDate || "");

        // ── 3. Reels mukofoti ──────────────────────────────
        setupReelsReward(reelsToday, rewards.lastReelsRewardDate || "");

        // ── 4. Verifikatsiya mukofoti ──────────────────────
        setupVerifyReward(verified, rewards.verificationRewardClaimed === true);

        // ── Tarix ──────────────────────────────────────────
        loadHistory(rewards.history || {});

    } catch (err) {
        console.error("Rewards init error:", err);
    }
}

// ── 1. KUNLIK MUKOFOT ─────────────────────────────────────
function setupDailyReward(lastClaimedAt) {
    const now    = Date.now();
    const elapsed = now - lastClaimedAt;
    const remaining = DAY_MS - elapsed;

    if (dailyTimerInterval) clearInterval(dailyTimerInterval);

    if (remaining <= 0) {
        // Olish mumkin
        dailyTimerEl.textContent = "Tayyor! Mukofotni oling 🎁";
        dailyBtn.disabled = false;
        dailyBtn.textContent = "Olish";
        document.getElementById("card-daily").classList.add("ready");

        dailyBtn.onclick = () => claimReward("daily");
    } else {
        // Countdown
        dailyBtn.disabled = true;
        dailyBtn.textContent = "Kutilmoqda";

        dailyTimerInterval = setInterval(() => {
            const rem = DAY_MS - (Date.now() - lastClaimedAt);
            if (rem <= 0) {
                clearInterval(dailyTimerInterval);
                setupDailyReward(lastClaimedAt);
                return;
            }
            dailyTimerEl.textContent = `⏱ ${msToHMS(rem)} qoldi`;
        }, 1000);

        dailyTimerEl.textContent = `⏱ ${msToHMS(remaining)} qoldi`;
    }
}

// ── 2. VIDEO MUKOFOTI ─────────────────────────────────────
function setupVideoReward(count, lastRewardDate) {
    const pct     = Math.min(count / VIDEO_TARGET * 100, 100);
    const claimed = lastRewardDate === todayStr();

    videoFill.style.width = pct + "%";
    videoText.textContent = `${Math.min(count, VIDEO_TARGET)} / ${VIDEO_TARGET}`;
    videoBtn.textContent  = `${Math.min(count, VIDEO_TARGET)}/${VIDEO_TARGET}`;

    if (claimed) {
        videoBtn.disabled = true;
        videoBtn.textContent = "✓ Olindi";
        videoBtn.classList.add("claimed-btn");
        document.getElementById("card-video").classList.add("claimed");
    } else if (count >= VIDEO_TARGET) {
        videoBtn.disabled = false;
        videoBtn.textContent = "Olish";
        document.getElementById("card-video").classList.add("ready");
        videoBtn.onclick = () => claimReward("video");
    } else {
        videoBtn.disabled = true;
    }
}

// ── 3. REELS MUKOFOTI ─────────────────────────────────────
function setupReelsReward(count, lastRewardDate) {
    const pct     = Math.min(count / REELS_TARGET * 100, 100);
    const claimed = lastRewardDate === todayStr();

    reelsFill.style.width = pct + "%";
    reelsText.textContent = `${Math.min(count, REELS_TARGET)} / ${REELS_TARGET}`;
    reelsBtn.textContent  = `${Math.min(count, REELS_TARGET)}/${REELS_TARGET}`;

    if (claimed) {
        reelsBtn.disabled = true;
        reelsBtn.textContent = "✓ Olindi";
        reelsBtn.classList.add("claimed-btn");
        document.getElementById("card-reels").classList.add("claimed");
    } else if (count >= REELS_TARGET) {
        reelsBtn.disabled = false;
        reelsBtn.textContent = "Olish";
        document.getElementById("card-reels").classList.add("ready");
        reelsBtn.onclick = () => claimReward("reels");
    } else {
        reelsBtn.disabled = true;
    }
}

// ── 4. VERIFIKATSIYA MUKOFOTI ─────────────────────────────
function setupVerifyReward(isVerified, alreadyClaimed) {
    if (alreadyClaimed) {
        verifyBadge.textContent = "✓ Mukofot olindi";
        verifyBadge.classList.add("verified");
        verifyBtn.disabled = true;
        verifyBtn.textContent = "✓ Olindi";
        verifyBtn.classList.add("claimed-btn");
        document.getElementById("card-verify").classList.add("claimed");

    } else if (isVerified) {
        verifyBadge.textContent = "✅ Hisob tasdiqlangan";
        verifyBadge.classList.add("verified");
        verifyBtn.disabled = false;
        verifyBtn.textContent = "Olish";
        document.getElementById("card-verify").classList.add("ready");
        verifyBtn.onclick = () => claimReward("verify");

    } else {
        verifyBadge.textContent = "Tasdiqlanmagan";
        verifyBtn.disabled = true;
        verifyBtn.textContent = "Kutilmoqda";
    }
}

// ── MUKOFOT OLISH ─────────────────────────────────────────
async function claimReward(type) {
    // Tugmalarni o'chirib qo'yamiz (qayta bosilmasin)
    dailyBtn.disabled  = true;
    videoBtn.disabled  = true;
    reelsBtn.disabled  = true;
    verifyBtn.disabled = true;

    const amount = REWARD[type.toUpperCase()] || REWARD.DAILY;
    const labels = {
        daily:  "Kunlik mukofot",
        video:  "Video yuklash mukofoti",
        reels:  "Reels ko'rish mukofoti",
        verify: "Verifikatsiya mukofoti"
    };
    const icons = {
        daily: "🎁", video: "🎬", reels: "📱", verify: "✅"
    };

    try {
        const now    = Date.now();
        const today  = todayStr();
        const newBal = parseFloat((currentBalance + amount).toFixed(4));

        // Firebase yangilash
        const updates = {
            [`users/${uid}/rewards/balance`]: newBal
        };

        if (type === "daily") {
            updates[`users/${uid}/rewards/lastDailyClaimedAt`] = now;
        } else if (type === "video") {
            updates[`users/${uid}/rewards/lastVideoRewardDate`] = today;
        } else if (type === "reels") {
            updates[`users/${uid}/rewards/lastReelsRewardDate`] = today;
        } else if (type === "verify") {
            updates[`users/${uid}/rewards/verificationRewardClaimed`] = true;
        }

        // Tarix yozuvi
        const histRef = ref(db, `users/${uid}/rewards/history`);
        const newHist = push(histRef);
        updates[`users/${uid}/rewards/history/${newHist.key}`] = {
            type:   type,
            amount: amount,
            label:  labels[type],
            icon:   icons[type],
            time:   now
        };

        await update(ref(db, "/"), updates);

        // Balansni yangilaymiz
        currentBalance = newBal;
        animateBalance(newBal);

        // Tugmani yangilaymiz
        const btn = { daily: dailyBtn, video: videoBtn, reels: reelsBtn, verify: verifyBtn }[type];
        btn.textContent = "✓ Olindi";
        btn.classList.add("claimed-btn");
        document.getElementById(`card-${type}`)?.classList.add("claimed");
        document.getElementById(`card-${type}`)?.classList.remove("ready");

        // Kunlik timer ni qayta ishga tushuramiz
        if (type === "daily") {
            if (dailyTimerInterval) clearInterval(dailyTimerInterval);
            dailyTimerEl.textContent = `⏱ ${msToHMS(DAY_MS)} qoldi`;
            setupDailyReward(now);
        }

        // Muvaffaqiyat animatsiyasi
        showSuccess(`+${fmt(amount)} USDT`, labels[type]);

        // Tariхni qayta yuklash
        const snap = await get(ref(db, `users/${uid}/rewards/history`));
        if (snap.exists()) loadHistory(snap.val());

    } catch (err) {
        console.error("Claim error:", err);
        // Xatolik bo'lsa tugmalarni qaytaramiz
        init();
    }
}

// ── BALANS ANIMATSIYA ─────────────────────────────────────
function animateBalance(target) {
    const start = currentBalance - (REWARD.DAILY); // taxminiy boshlang'ich
    const duration = 800;
    const startTime = performance.now();

    function step(now) {
        const p = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        balanceEl.textContent = fmt(start + (target - start) * eased);
        if (p < 1) requestAnimationFrame(step);
        else balanceEl.textContent = fmt(target);
    }
    requestAnimationFrame(step);
}

// ── MUVAFFAQIYAT OVERLAY ──────────────────────────────────
function showSuccess(amount, text) {
    successAmount.textContent = amount;
    successText.textContent   = text + " muvaffaqiyatli olindi!";
    successOverlay.classList.add("show");

    setTimeout(() => {
        successOverlay.classList.remove("show");
    }, 2200);
}

successOverlay.addEventListener("click", () => {
    successOverlay.classList.remove("show");
});

// ── TARIX ─────────────────────────────────────────────────
function loadHistory(historyObj) {
    historyList.innerHTML = "";
    const entries = Object.values(historyObj);

    if (entries.length === 0) {
        historyList.innerHTML = '<div class="history-empty">Hali mukofot olinmagan</div>';
        return;
    }

    // Eng yangilari birinchi
    entries.sort((a, b) => b.time - a.time);

    entries.slice(0, 10).forEach(entry => {
        const date = new Date(entry.time);
        const dateStr = `${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()} ${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;

        const item = document.createElement("div");
        item.className = "history-item";
        item.innerHTML = `
            <div class="history-icon">${entry.icon || "🎁"}</div>
            <div class="history-info">
                <div class="history-name">${entry.label || "Mukofot"}</div>
                <div class="history-date">${dateStr}</div>
            </div>
            <div class="history-usdt">+${fmt(entry.amount)} USDT</div>
        `;
        historyList.appendChild(item);
    });
}

// ── ISHGA TUSHURISH ───────────────────────────────────────
init();

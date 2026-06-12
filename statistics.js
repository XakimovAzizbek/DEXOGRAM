import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// ── DOM ──────────────────────────────────────────────────
const totalVideosEl   = document.getElementById("totalVideos");
const totalLikesEl    = document.getElementById("totalLikes");
const totalCommentsEl = document.getElementById("totalComments");
const totalViewsEl    = document.getElementById("totalViews");
const videoStatsList  = document.getElementById("videoStatsList");
const chartCanvas     = document.getElementById("statChart");
const chartLoading    = document.getElementById("chartLoading");
const chartDates      = document.getElementById("chartDates");
const tabBtns         = document.querySelectorAll(".tab-btn");

// ── STATE ────────────────────────────────────────────────
let activeMetric = "likes"; // likes | comments | views
let chartData    = null;    // { likes:[], comments:[], views:[], labels:[] }

// ── INIT ─────────────────────────────────────────────────
async function init() {
    try {
        const snap = await get(ref(db, "posts"));
        if (!snap.exists()) {
            showEmpty();
            return;
        }

        const allPosts = snap.val();

        // Faqat shu foydalanuvchining postlari
        const myPosts = Object.entries(allPosts)
            .map(([id, post]) => ({ id, ...post }))
            .filter(p => String(p.userId) === String(user.id));

        if (myPosts.length === 0) {
            showEmpty();
            return;
        }

        // ── 1. Umumiy statistika ──
        let sumLikes    = 0;
        let sumComments = 0;
        let sumViews    = 0;

        myPosts.forEach(p => {
            sumLikes    += p.likes_users   ? Object.keys(p.likes_users).length   : 0;
            sumComments += p.comments      ? Object.keys(p.comments).length      : 0;
            sumViews    += p.post_views    ? Object.keys(p.post_views).length    : 0;
        });

        animateNumber(totalVideosEl,   myPosts.length);
        animateNumber(totalLikesEl,    sumLikes);
        animateNumber(totalCommentsEl, sumComments);
        animateNumber(totalViewsEl,    sumViews);

        // ── 2. 28 kunlik grafik ma'lumoti ──
        chartData = buildChartData(myPosts);
        drawChart(chartData, activeMetric);
        buildDateLabels(chartData.labels);
        chartLoading.style.display = "none";

        // ── 3. Video ro'yxati ──
        renderVideoList(myPosts);

    } catch (err) {
        console.error("Statistics error:", err);
        chartLoading.textContent = "Xatolik yuz berdi";
    }
}

// ── 28 KUNLIK MA'LUMOT QURILISHI ─────────────────────────
function buildChartData(posts) {
    const DAY_MS = 86400000;
    const now    = Date.now();

    // Oxirgi 28 kun uchun bo'sh massivlar
    const likes    = new Array(28).fill(0);
    const comments = new Array(28).fill(0);
    const views    = new Array(28).fill(0);
    const labels   = [];

    // Label: "DD/MM" formatida
    for (let i = 27; i >= 0; i--) {
        const d = new Date(now - i * DAY_MS);
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }

    posts.forEach(post => {
        // Post sanasini timestamp dan olamiz (agar yo'q bo'lsa bugun sanaymiz)
        const postTs = post.timestamp || post.createdAt || now;

        // Bu post necha kun oldin qo'yilgan?
        const daysAgo = Math.floor((now - postTs) / DAY_MS);

        // 28 kunlik oynaga kirsa
        if (daysAgo >= 0 && daysAgo < 28) {
            const idx = 27 - daysAgo; // massivda indeks (0 = 28 kun oldin, 27 = bugun)
            likes[idx]    += post.likes_users ? Object.keys(post.likes_users).length   : 0;
            comments[idx] += post.comments    ? Object.keys(post.comments).length      : 0;
            views[idx]    += post.post_views  ? Object.keys(post.post_views).length    : 0;
        }

        // Sharhlarni alohida timestamp bilan sanash (aniqroq)
        if (post.comments) {
            Object.values(post.comments).forEach(c => {
                if (!c.timestamp) return;
                const cDaysAgo = Math.floor((now - c.timestamp) / DAY_MS);
                if (cDaysAgo >= 0 && cDaysAgo < 28) {
                    const idx = 27 - cDaysAgo;
                    // comments massivini yangilaymiz (post sanasi bilan to'qnashmasin deb eski qiymatni ayiramiz)
                    // Bu yerda faqat comment timestamp ga tayanamiz
                }
            });
        }
    });

    return { likes, comments, views, labels };
}

// ── CANVAS GRAFIK ────────────────────────────────────────
function drawChart(data, metric) {
    const canvas  = chartCanvas;
    const ctx     = canvas.getContext("2d");
    const values  = data[metric];

    // Canvas o'lchamini aniqlashtirish
    const dpr    = window.devicePixelRatio || 1;
    const rect   = canvas.parentElement.getBoundingClientRect();
    const W      = rect.width;
    const H      = rect.height;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Padding
    const PL = 10, PR = 10, PT = 16, PB = 10;
    const cW  = W - PL - PR;
    const cH  = H - PT - PB;

    // Max qiymat (kamida 1)
    const maxVal = Math.max(...values, 1);

    // Nuqtalarni hisoblash
    const pts = values.map((v, i) => ({
        x: PL + (i / (values.length - 1)) * cW,
        y: PT + cH - (v / maxVal) * cH
    }));

    ctx.clearRect(0, 0, W, H);

    // ── Grid chiziqlari ──
    const gridCount = 4;
    ctx.strokeStyle = "rgba(48,54,61,0.7)";
    ctx.lineWidth   = 1;
    for (let g = 0; g <= gridCount; g++) {
        const y = PT + (g / gridCount) * cH;
        ctx.beginPath();
        ctx.moveTo(PL, y);
        ctx.lineTo(PL + cW, y);
        ctx.stroke();

        // Y-axis label
        const labelVal = Math.round(maxVal - (g / gridCount) * maxVal);
        ctx.fillStyle   = "rgba(139,148,158,0.7)";
        ctx.font        = `${8 * dpr / dpr}px sans-serif`;
        ctx.textAlign   = "left";
        if (labelVal > 0) {
            ctx.fillText(labelVal, 0, y + 3);
        }
    }

    // Rang tanlash
    const colors = {
        likes:    { line: "#ff007f", fill: "rgba(255,0,127,0.15)", dot: "#ff007f" },
        comments: { line: "#a78bfa", fill: "rgba(167,139,250,0.15)", dot: "#a78bfa" },
        views:    { line: "#00ffff", fill: "rgba(0,255,255,0.15)", dot: "#00ffff" }
    };
    const c = colors[metric] || colors.views;

    // ── Area fill ──
    const areaGrad = ctx.createLinearGradient(0, PT, 0, PT + cH);
    areaGrad.addColorStop(0,   c.fill.replace("0.15", "0.25"));
    areaGrad.addColorStop(1,   c.fill.replace("0.15", "0.02"));

    ctx.beginPath();
    ctx.moveTo(pts[0].x, PT + cH);
    ctx.lineTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const cpx  = (prev.x + curr.x) / 2;
        ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }

    ctx.lineTo(pts[pts.length - 1].x, PT + cH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // ── Chiziq ──
    const lineGrad = ctx.createLinearGradient(PL, 0, PL + cW, 0);
    lineGrad.addColorStop(0,   c.line + "88");
    lineGrad.addColorStop(0.5, c.line);
    lineGrad.addColorStop(1,   c.line + "88");

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const cpx  = (prev.x + curr.x) / 2;
        ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
    }
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = "round";
    ctx.stroke();

    // ── Nuqtalar (faqat nol bo'lmaganlar) ──
    pts.forEach((pt, i) => {
        if (values[i] === 0) return;
        // Tashqi doira
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = c.dot;
        ctx.fill();
        // Ichki oq
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#161b22";
        ctx.fill();
    });
}

// ── DATE LABELS ──────────────────────────────────────────
function buildDateLabels(labels) {
    chartDates.innerHTML = "";
    // Faqat 7 ta label ko'rsatamiz (haddan tashqari to'lmasligi uchun)
    const step    = Math.ceil(labels.length / 7);
    const visible = labels.filter((_, i) => i % step === 0 || i === labels.length - 1);

    visible.forEach(l => {
        const span = document.createElement("span");
        span.className = "chart-date-label";
        span.textContent = l;
        chartDates.appendChild(span);
    });
}

// ── TAB BUTTONS ──────────────────────────────────────────
tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeMetric = btn.dataset.metric;
        if (chartData) drawChart(chartData, activeMetric);
    });
});

// Oyna o'lchami o'zgarganda grafikni qayta chizish
window.addEventListener("resize", () => {
    if (chartData) drawChart(chartData, activeMetric);
});

// ── VIDEO RO'YXATI ────────────────────────────────────────
function renderVideoList(posts) {
    videoStatsList.innerHTML = "";

    // Eng ko'p layk olganlar birinchi
    const sorted = [...posts].sort((a, b) => {
        const aL = a.likes_users ? Object.keys(a.likes_users).length : 0;
        const bL = b.likes_users ? Object.keys(b.likes_users).length : 0;
        return bL - aL;
    });

    sorted.forEach(post => {
        const likes    = post.likes_users ? Object.keys(post.likes_users).length   : 0;
        const comments = post.comments    ? Object.keys(post.comments).length      : 0;
        const views    = post.post_views  ? Object.keys(post.post_views).length    : 0;
        const caption  = post.caption || "Tavsif yo'q";
        const dateStr  = post.timestamp
            ? new Date(post.timestamp).toLocaleDateString("uz-UZ", { day:"2-digit", month:"2-digit" })
            : "—";

        const card = document.createElement("div");
        card.className = "video-stat-card";
        card.innerHTML = `
            <div class="video-stat-thumb">
                ${post.thumbnail_url
                    ? `<img src="${post.thumbnail_url}" alt="thumb" onerror="this.parentElement.innerHTML='▶'">`
                    : "▶"}
            </div>
            <div class="video-stat-info">
                <div class="video-stat-caption">${caption}</div>
                <div class="video-stat-metrics">
                    <div class="vsm-item">
                        <span class="vsm-icon">❤️</span>
                        <span class="vsm-num">${likes}</span>
                    </div>
                    <div class="vsm-item">
                        <span class="vsm-icon">💬</span>
                        <span class="vsm-num">${comments}</span>
                    </div>
                    <div class="vsm-item">
                        <span class="vsm-icon">👁️</span>
                        <span class="vsm-num">${views}</span>
                    </div>
                </div>
            </div>
            <div class="video-stat-date">${dateStr}</div>
        `;
        videoStatsList.appendChild(card);
    });
}

// ── ANIMATE NUMBERS ───────────────────────────────────────
function animateNumber(el, target) {
    const duration = 900;
    const start    = performance.now();
    el.textContent = "0";

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ── EMPTY STATE ───────────────────────────────────────────
function showEmpty() {
    totalVideosEl.textContent   = "0";
    totalLikesEl.textContent    = "0";
    totalCommentsEl.textContent = "0";
    totalViewsEl.textContent    = "0";
    chartLoading.textContent    = "Ma'lumot yo'q";
    videoStatsList.innerHTML    = `
        <div class="empty-state">
            <span class="empty-icon">🎬</span>
            <span>Hali video yo'q. Video yuklang va statistika ko'ring!</span>
        </div>
    `;
}

init();
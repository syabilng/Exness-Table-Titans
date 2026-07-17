/* ============================================================
   PADDLE ROYALE — app logic
   Firestore data store (shared, live) · render · GSAP animations ·
   tilt/glow · profile overlay · modals · photo upload · audio · canvas bg
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore, connectFirestoreEmulator, collection, doc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, increment,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWVqJ9ifrEiYI1TNdigTcj-hXNQx5L3TI",
  authDomain: "table-tennis-smash-rankings.firebaseapp.com",
  projectId: "table-tennis-smash-rankings",
  storageBucket: "table-tennis-smash-rankings.firebasestorage.app",
  messagingSenderId: "666803172203",
  appId: "1:666803172203:web:25bba0fa2064b12fabd22e",
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
// local development/testing against the Firestore emulator: open with ?emu=1
if (new URLSearchParams(location.search).has("emu")) {
  connectFirestoreEmulator(db, location.hostname, 8090);
}
const playersCol = collection(db, "players");
const metaRef = doc(db, "leaderboard", "meta");

async function guarded(action, msg = "Couldn't save — check your internet connection and try again.") {
  try { await action(); } catch (e) { console.error(e); alert(msg); }
}

/* ---------------- data store (in-memory cache of Firestore) ---------------- */
const SEED_PLAYERS = [
  { name: "Ignatius Aldo",        weekW: 5, weekL: 1, allW: 41, allL: 18 },
  { name: "Syabil Ng",            weekW: 4, weekL: 1, allW: 38, allL: 22 },
  { name: "Hafeez Azlan",         weekW: 4, weekL: 2, allW: 30, allL: 25 },
  { name: "Madina Berkenova",     weekW: 3, weekL: 2, allW: 27, allL: 20 },
  { name: "Matthias Lim",         weekW: 3, weekL: 3, allW: 33, allL: 29 },
  { name: "Ashraf Faiz Azizudin", weekW: 2, weekL: 3, allW: 21, allL: 24 },
  { name: "Syamil Ramli",         weekW: 2, weekL: 4, allW: 19, allL: 27 },
  { name: "Katrina Quiroz",       weekW: 1, weekL: 4, allW: 16, allL: 23 },
  { name: "Alif Ismail",          weekW: 1, weekL: 5, allW: 14, allL: 30 },
];

function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 864e5 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

let players = [];
let currentWeek = isoWeek();

const sorted = () =>
  [...players].sort(
    (a, b) =>
      b.weekW - a.weekW ||
      a.weekL - b.weekL ||
      b.allW - a.allW ||
      a.name.localeCompare(b.name)
  );

const getPlayer = (id) => players.find((p) => p.id === id);

async function resetWeek() {
  const batch = writeBatch(db);
  players.forEach((p) => batch.update(doc(db, "players", p.id), { weekW: 0, weekL: 0 }));
  batch.set(metaRef, { week: isoWeek() }, { merge: true });
  await batch.commit();
}

/* ---------------- placeholder avatars ---------------- */
const AVATAR_SCHEMES = [
  { a: "#BF4332", b: "#280F5A", pop: "#F8712E" },  // brick
  { a: "#66D2D0", b: "#1F0B53", pop: "#BF4332" },  // teal
  { a: "#7C32B5", b: "#2D0D60", pop: "#66D2D0" },  // violet
  { a: "#2D0D60", b: "#1F0B53", pop: "#F8712E" },  // grape
];

function avatarFor(p) {
  if (p.photo) return p.photo;
  const initials = p.name
    .split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
  let h = 0;
  for (let i = 0; i < p.name.length; i++) h = (h * 31 + p.name.charCodeAt(i)) >>> 0;
  const s = AVATAR_SCHEMES[h % AVATAR_SCHEMES.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='300'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${s.a}'/>` +
    `<stop offset='1' stop-color='${s.b}'/>` +
    `</linearGradient></defs>` +
    `<rect width='240' height='300' fill='url(%23g)'/>` +
    `<circle cx='195' cy='55' r='95' fill='${s.pop}' opacity='0.3'/>` +
    `<circle cx='30' cy='265' r='60' fill='#17023a' opacity='0.25'/>` +
    `<text x='122' y='177' font-family='Arial Black,Arial' font-size='84' font-weight='900' ` +
    `fill='rgba(23,2,58,0.35)' text-anchor='middle'>${initials}</text>` +
    `<text x='118' y='173' font-family='Arial Black,Arial' font-size='84' font-weight='900' ` +
    `fill='%23F3EEDC' text-anchor='middle'>${initials}</text>` +
    `<text x='120' y='265' font-family='Arial' font-size='18' letter-spacing='6' ` +
    `fill='rgba(243,238,220,0.85)' text-anchor='middle'>ALL-STAR</text>` +
    `</svg>`;
  return `data:image/svg+xml,${svg.replace(/#/g, "%23").replace(/'/g, "%27")}`;
}

/* ---------------- leaderboard render ---------------- */
const boardEl = document.getElementById("board");
const esc = (s) => s.replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function statMarkup(label, w, l) {
  return (
    `<div class="b-stat"><span class="b-stat-label">${label}</span>` +
    `<span class="b-stat-val"><span class="w">${w}</span><span class="sep">–</span><span class="l">${l}</span></span></div>`
  );
}

const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
  "Eight", "Nine", "Ten", "Eleven", "Twelve"];

function renderBoard({ animate = false } = {}) {
  const list = sorted();
  document.getElementById("heroCount").textContent =
    COUNT_WORDS[list.length] || String(list.length);
  boardEl.innerHTML = "";
  list.forEach((p, i) => {
    const el = document.createElement("article");
    el.className = "banner" + (i === 0 ? " is-first" : "");
    el.dataset.id = p.id;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", `${p.name}, rank ${i + 1}. Open player card.`);
    el.innerHTML =
      `<div class="b-rank">${i + 1}</div>` +
      `<div class="b-photo" style="background-image:url('${avatarFor(p)}')"></div>` +
      `<div class="b-id"><div class="b-name">${esc(p.name)}</div>` +
      `<div class="b-tag">${i === 0 ? "WEEK LEADER" : "CONTENDER"}</div></div>` +
      `<div class="b-stats">` +
      statMarkup("THIS WEEK W–L", p.weekW, p.weekL) +
      statMarkup("ALL-TIME W–L", p.allW, p.allL) +
      `</div>`;
    attachBannerInteractions(el);
    boardEl.appendChild(el);
  });
  if (animate && boardRevealed) animateBannersIn();
  renderTicker();
  refreshSpotlight();
  tryRevealBoard(); // banners may have arrived after the section scrolled into view
}

function animateBannersIn() {
  const banners = boardEl.querySelectorAll(".banner");
  const tl = gsap.timeline();
  tl.fromTo(
    banners,
    { opacity: 0, y: 90, rotateX: -72, transformOrigin: "50% 0%", filter: "blur(6px)" },
    {
      opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)",
      duration: 0.9, ease: "back.out(1.4)", stagger: 0.09,
      clearProps: "filter",
    }
  );
  // rank counters roll up, nested on the same timeline so callers can await full completion
  banners.forEach((b, i) => {
    const rankEl = b.querySelector(".b-rank");
    const obj = { v: 9 + i * 3 };
    tl.to(obj, {
      v: i + 1, duration: 0.9, ease: "power3.out",
      onUpdate: () => { rankEl.textContent = Math.round(obj.v); },
      onComplete: () => { rankEl.textContent = i + 1; },
    }, 0.15 + i * 0.09);
  });
  return tl;
}

/* ---------------- banner tilt + glow ---------------- */
const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

function attachBannerInteractions(el) {
  if (fineHover) {
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.4, ease: "power2.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.4, ease: "power2.out" });
    const lift = gsap.quickTo(el, "z", { duration: 0.4, ease: "power2.out" });
    const scale = gsap.quickTo(el, "scale", { duration: 0.4, ease: "power2.out" });

    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;   // 0..1
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
      ry((px - 0.5) * 7);
      rx((0.5 - py) * 9);
      lift(46);
      scale(1.018);
    });
    el.addEventListener("pointerleave", () => {
      rx(0); ry(0); lift(0); scale(1);
    });
  }
  el.addEventListener("click", () => navigateToProfile(el.dataset.id));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigateToProfile(el.dataset.id); }
  });
}

/* ---------------- touch scroll spotlight ----------------
   No hover on touch screens, so the glow travels with the scroll instead:
   whichever banner sits closest to the middle of the screen is "hot". */
let refreshSpotlight = () => {};
if (!fineHover) {
  let hotEl = null;
  const updateSpotlight = () => {
    if (openOverlayName) return;
    const mid = window.innerHeight / 2;
    let best = null, bestDist = Infinity;
    boardEl.querySelectorAll(".banner").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestDist) { bestDist = d; best = b; }
    });
    if (best !== hotEl) {
      if (hotEl) hotEl.classList.remove("is-hot");
      hotEl = best;
      if (hotEl) {
        hotEl.classList.add("is-hot");
        hotEl.style.setProperty("--mx", "50%");
        hotEl.style.setProperty("--my", "50%");
      }
    }
  };
  refreshSpotlight = () => { hotEl = null; updateSpotlight(); };
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateSpotlight(); ticking = false; });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

/* ---------------- ticker ---------------- */
const tickerTrack = document.getElementById("tickerTrack");
let tickerTween = null;

function renderTicker() {
  const list = sorted();
  const items = list.map(
    (p, i) =>
      `<span class="tick-item">#${i + 1} <b>${esc(p.name)}</b> ${p.weekW}–${p.weekL} THIS WK</span><span class="tick-sep">▮</span>`
  );
  const half = `<div class="tick-half" style="display:inline-flex;gap:42px;">${items.join("")}</div>`;
  tickerTrack.innerHTML = half + half; // duplicated for seamless loop
  if (tickerTween) tickerTween.kill();
  const w = tickerTrack.querySelector(".tick-half").getBoundingClientRect().width + 42;
  gsap.set(tickerTrack, { x: 0 });
  tickerTween = gsap.to(tickerTrack, {
    x: -w, duration: Math.max(18, w / 55), ease: "none", repeat: -1,
  });
}

/* ---------------- page routing (real URLs, so back/swipe-back works) ----------------
   Profiles live at #/p/<playerId>, the rules page at #/rules, and the match
   referee at #/match. Opening any of them pushes a history entry, so the
   browser/trackpad/phone back gesture returns to the board, and every page
   URL can be shared or reloaded directly. */
const profileEl = document.getElementById("profile");
let currentProfileId = null;
let navigatedInternally = false; // true once the user navigated from within the site
let routeReady = false;          // suppress routing until the intro reveal is done

const OVERLAYS = {
  profile: profileEl,
  rules: document.getElementById("rulesPage"),
  match: document.getElementById("matchPage"),
};
let openOverlayName = null;

const overlayWipe = (el) => el.querySelector(".profile-wipe, .page-wipe");
const overlayInner = (el) => el.querySelector(".profile-inner, .page-inner");

function openOverlay(name) {
  if (openOverlayName === name) return null;
  if (openOverlayName) closeOverlayInstant();
  const el = OVERLAYS[name];
  openOverlayName = name;
  el.classList.add("is-open");
  el.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  el.scrollTop = 0;
  const tl = gsap.timeline();
  tl.fromTo(overlayWipe(el), { x: 0, xPercent: -101 }, { xPercent: 0, duration: 0.42, ease: "power3.in" })
    .set(overlayInner(el), { opacity: 1 })
    .to(overlayWipe(el), { xPercent: 101, duration: 0.5, ease: "power3.out" });
  return tl;
}

function closeOverlay() {
  if (!openOverlayName) return;
  const name = openOverlayName;
  const el = OVERLAYS[name];
  openOverlayName = null;
  const tl = gsap.timeline({
    onComplete: () => {
      el.classList.remove("is-open");
      el.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      gsap.set(overlayInner(el), { clearProps: "opacity" });
      if (name === "profile") currentProfileId = null;
    },
  });
  tl.fromTo(overlayWipe(el), { x: 0, xPercent: -101 }, { xPercent: 0, duration: 0.38, ease: "power3.in" })
    .set(overlayInner(el), { opacity: 0 })
    .to(overlayWipe(el), { xPercent: 101, duration: 0.45, ease: "power3.out" });
}

function closeOverlayInstant() {
  if (!openOverlayName) return;
  const el = OVERLAYS[openOverlayName];
  if (openOverlayName === "profile") currentProfileId = null;
  openOverlayName = null;
  el.classList.remove("is-open");
  el.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

const hashPlayerId = () => {
  const m = location.hash.match(/^#\/p\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
};

function navigateTo(hash) {
  navigatedInternally = true;
  location.hash = hash;
}
const navigateToProfile = (id) => navigateTo("#/p/" + encodeURIComponent(id));

function goBackToBoard() {
  if (!openOverlayName) return;
  // if the user arrived from within the site, real back keeps history clean;
  // on a direct/deep link there is nowhere to go back to, so clear the hash
  if (navigatedInternally) history.back();
  else location.hash = "";
}

function route() {
  if (!routeReady) return;
  const id = hashPlayerId();
  if (id) {
    const p = getPlayer(id);
    if (!p) { location.hash = ""; return; } // unknown/removed player
    if (openOverlayName === "profile") {
      if (currentProfileId !== id) { currentProfileId = id; fillProfile(p); }
    } else {
      openProfile(id);
    }
  } else if (location.hash === "#/rules") {
    openOverlay("rules");
  } else if (location.hash === "#/match") {
    if (openOverlayName !== "match") { prepMatchPage(); openOverlay("match"); }
  } else {
    closeOverlay();
  }
}
window.addEventListener("hashchange", route);

/* the four approved text/wash combinations: [main, shade] */
const WASHES = [
  ["#66D2D0", "#1F0B53"],
  ["#D6D3D8", "#2D0D60"],
  ["#BF4332", "#280F5A"],
  ["#7C32B5", "#F8712E"],
];

function fillProfile(p) {
  const rank = sorted().findIndex((x) => x.id === p.id) + 1;
  document.getElementById("profileRank").textContent = "#" + rank;

  // per-player color wash on the portrait (Jordan-30 style duotone)
  let wh = 0;
  for (let i = 0; i < p.name.length; i++) wh = (wh * 31 + p.name.charCodeAt(i)) >>> 0;
  const [wash, washshade] = WASHES[wh % WASHES.length];
  const wrap = document.querySelector(".profile-photo-wrap");
  wrap.style.setProperty("--wash", wash);
  wrap.style.setProperty("--washshade", washshade);
  const nameEl = document.getElementById("profileName");
  nameEl.innerHTML = [...p.name.toUpperCase()]
    .map((c) => `<span class="ch">${c === " " ? " " : esc(c)}</span>`)
    .join("");
  document.getElementById("profilePhoto").style.backgroundImage = `url('${avatarFor(p)}')`;
  document.getElementById("profileBigname").textContent = p.name.split(" ")[0].toUpperCase();

  const stats = { pWeekW: p.weekW, pWeekL: p.weekL, pAllW: p.allW, pAllL: p.allL };
  Object.entries(stats).forEach(([id, val]) => {
    const el = document.getElementById(id);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: val, duration: 1.1, delay: 0.45, ease: "power3.out",
      onUpdate: () => { el.textContent = Math.round(obj.v); },
      onComplete: () => { el.textContent = val; },
    });
  });
  const total = p.allW + p.allL;
  const rate = total ? Math.round((p.allW / total) * 100) : 0;
  gsap.fromTo("#pRateBar", { width: "0%" }, { width: rate + "%", duration: 1.2, delay: 0.5, ease: "power3.inOut" });
  const rateObj = { v: 0 };
  const rateEl = document.getElementById("pRate");
  gsap.to(rateObj, {
    v: rate, duration: 1.2, delay: 0.5, ease: "power3.inOut",
    onUpdate: () => { rateEl.textContent = Math.round(rateObj.v) + "%"; },
  });
}

function openProfile(id) {
  const p = getPlayer(id);
  if (!p) return;
  currentProfileId = id;
  fillProfile(p);
  const tl = openOverlay("profile");
  if (!tl) return;
  tl.from(".profile-back, .profile-rank", { opacity: 0, y: -18, duration: 0.4, stagger: 0.08 }, "-=0.35")
    .from("#profileName .ch", {
      opacity: 0, y: 44, rotateX: -80, duration: 0.55, ease: "back.out(1.6)",
      stagger: { each: 0.022, from: "start" },
    }, "-=0.3")
    .from(".profile-photo-wrap", { opacity: 0, x: -50, duration: 0.6, ease: "power3.out" }, "-=0.45")
    .from(".stat-block, .profile-quickactions", { opacity: 0, y: 34, duration: 0.5, ease: "power3.out", stagger: 0.08 }, "-=0.4")
    .from("#profileBigname", { opacity: 0, y: 60, duration: 0.7, ease: "power3.out" }, "-=0.5");
}

document.getElementById("profileBack").addEventListener("click", goBackToBoard);
document.querySelectorAll("[data-back]").forEach((el) => el.addEventListener("click", goBackToBoard));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { goBackToBoard(); closeModal(); }
});

/* ---------------- photo upload (resized to keep it small) ---------------- */
function fileToDataURL(file, maxDim = 640) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

document.getElementById("photoInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !currentProfileId) return;
  try {
    const dataURL = await fileToDataURL(file);
    const photoEl = document.getElementById("profilePhoto");
    gsap.fromTo(photoEl, { opacity: 0.2, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.6 });
    photoEl.style.backgroundImage = `url('${dataURL}')`;
    await guarded(() => updateDoc(doc(db, "players", currentProfileId), { photo: dataURL }));
  } catch (err) {
    alert("Couldn't read that image — try another file.");
  }
  e.target.value = "";
});

/* ---------------- quick win/loss + remove ---------------- */
document.getElementById("btnQuickWin").addEventListener("click", () => {
  if (!currentProfileId) return;
  guarded(() => updateDoc(doc(db, "players", currentProfileId), { weekW: increment(1), allW: increment(1) }));
});
document.getElementById("btnQuickLoss").addEventListener("click", () => {
  if (!currentProfileId) return;
  guarded(() => updateDoc(doc(db, "players", currentProfileId), { weekL: increment(1), allL: increment(1) }));
});
document.getElementById("btnRemovePlayer").addEventListener("click", () => {
  const p = getPlayer(currentProfileId);
  if (!p) return;
  if (!confirm(`Remove ${p.name} from the league? This deletes their record.`)) return;
  goBackToBoard();
  guarded(() => deleteDoc(doc(db, "players", p.id)));
});

/* ---------------- modals ---------------- */
const modalEl = document.getElementById("modal");
const modalAdd = document.getElementById("modalAdd");

function openModal() {
  modalAdd.hidden = false;
  modalEl.classList.add("is-open");
  modalEl.setAttribute("aria-hidden", "false");
  gsap.fromTo(modalAdd, { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.6)" });
  document.getElementById("addName").focus();
}
function closeModal() {
  modalEl.classList.remove("is-open");
  modalEl.setAttribute("aria-hidden", "true");
}
modalEl.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));

document.getElementById("btnAdd").addEventListener("click", () => openModal());
document.getElementById("btnRecord").addEventListener("click", () => navigateTo("#/match"));
document.getElementById("btnRules").addEventListener("click", () => navigateTo("#/rules"));
document.getElementById("btnRulesHero").addEventListener("click", () => navigateTo("#/rules"));
document.getElementById("btnRulesToMatch").addEventListener("click", () => navigateTo("#/match"));

document.getElementById("btnReset").addEventListener("click", () => {
  if (!confirm("Start a fresh week for everyone? Weekly W–L resets to 0 (all-time records are kept).")) return;
  guarded(resetWeek);
});

/* add player */
document.getElementById("addConfirm").addEventListener("click", async () => {
  const nameInput = document.getElementById("addName");
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }
  let photo = null;
  const file = document.getElementById("addPhoto").files[0];
  if (file) {
    try { photo = await fileToDataURL(file); } catch (e) { /* keep placeholder */ }
  }
  await guarded(() => addDoc(playersCol, { name, photo, weekW: 0, weekL: 0, allW: 0, allL: 0 }));
  nameInput.value = "";
  document.getElementById("addPhoto").value = "";
  closeModal();
});

/* ---------------- match referee (#/match) ----------------
   Live scoreboard with real service rotation and deuce rules:
   - to 11: 2 serves each; from 10-10, 1 serve each
   - to 15: 2 or 3 serves each (chosen); from 14-14, 1 serve each
   - to 21: 5 serves each; from 20-20, 1 serve each
   Win by 2, always. The result records to Firestore automatically. */
const MATCH_BLOCKS = { 11: 2, 21: 5 }; // 15 uses the chosen 2 or 3
const match = {
  target: 11,
  serves15: 2,
  first: 0,            // side serving first: 0 = left, 1 = right
  ids: [null, null],
  score: [0, 0],
  ended: false,
  recorded: false,
};

const matchBlock = () => (match.target === 15 ? match.serves15 : MATCH_BLOCKS[match.target]);
const matchStarted = () => match.score[0] + match.score[1] > 0;
const matchReady = () => match.ids[0] && match.ids[1] && match.ids[0] !== match.ids[1];

/* who serves the NEXT point, and which serve of their block it is */
function serveInfo() {
  const block = matchBlock();
  const total = match.score[0] + match.score[1];
  const deuceStart = 2 * (match.target - 1);
  if (total >= deuceStart) {
    // deuce: serves alternate every point, continuing the rotation sequence
    const rotation = Math.floor((deuceStart - 1) / block) + (total - deuceStart) + 1;
    return { side: (match.first + rotation) % 2, num: 1, of: 1, deuce: true };
  }
  return {
    side: (match.first + Math.floor(total / block)) % 2,
    num: (total % block) + 1,
    of: block,
    deuce: false,
  };
}

function matchWinnerSide() {
  const [a, b] = match.score;
  if (Math.max(a, b) >= match.target && Math.abs(a - b) >= 2) return a > b ? 0 : 1;
  return null;
}

function refreshMatchRoster() {
  const opts = `<option value="">— PICK PLAYER —</option>` + sorted()
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join("");
  [0, 1].forEach((s) => {
    const sel = document.getElementById("courtSel" + s);
    const prev = match.ids[s];
    sel.innerHTML = opts;
    if (prev && getPlayer(prev)) sel.value = prev;
    else if (prev) { match.ids[s] = null; if (matchStarted()) resetGame(); }
  });
}

function renderMatch() {
  const locked = matchStarted() || match.ended;
  const info = serveInfo();
  const ready = matchReady();

  // mode chips reflect state and lock mid-game
  document.getElementById("serveGroup").hidden = match.target !== 15;
  document.querySelectorAll("#targetChips .mode-chip").forEach((c) =>
    c.classList.toggle("is-active", +c.dataset.target === match.target));
  document.querySelectorAll("#serveChips .mode-chip").forEach((c) =>
    c.classList.toggle("is-active", +c.dataset.serves === match.serves15));
  document.querySelectorAll("#firstChips .mode-chip").forEach((c) =>
    c.classList.toggle("is-active", +c.dataset.first === match.first));
  document.getElementById("modeBar").classList.toggle("is-locked", locked);

  [0, 1].forEach((s) => {
    const p = match.ids[s] ? getPlayer(match.ids[s]) : null;
    const photo = document.getElementById("courtPhoto" + s);
    photo.style.backgroundImage = p ? `url('${avatarFor(p)}')` : "none";
    photo.classList.toggle("is-empty", !p);
    document.getElementById("courtScore" + s).textContent = match.score[s];
    document.getElementById("courtSel" + s).disabled = locked;

    const serving = ready && !match.ended && info.side === s;
    document.getElementById("courtPhoto" + s).parentElement.classList.toggle("is-serving", serving);
    const chip = document.getElementById("serveChip" + s);
    chip.hidden = !serving;
    if (serving) chip.querySelector("span").textContent = info.deuce ? "DEUCE" : `${info.num}/${info.of}`;

    document.getElementById("plus" + s).disabled = !ready || match.ended;
    document.getElementById("minus" + s).disabled = !ready || match.ended || match.score[s] === 0;
  });

  document.getElementById("deuceTag").hidden = !(ready && !match.ended && info.deuce);

  const note = document.getElementById("matchNote");
  if (!match.ids[0] || !match.ids[1]) note.textContent = "Pick a player for each side.";
  else if (match.ids[0] === match.ids[1]) note.textContent = "Pick two different players.";
  else if (match.ended) note.textContent = "Game over — result saved.";
  else note.textContent = `RACE TO ${match.target}`;

  document.getElementById("winnerOverlay").hidden = !match.ended;
  if (match.ended) {
    const w = getPlayer(match.ids[matchWinnerSide()]);
    document.getElementById("winnerName").textContent = w ? w.name.toUpperCase() : "—";
  }
}

function resetGame() {
  match.score = [0, 0];
  match.ended = false;
  match.recorded = false;
  renderMatch();
}

function prepMatchPage() {
  refreshMatchRoster();
  if (match.ended) resetGame(); else renderMatch();
}

function recordMatchResult(winnerSide) {
  if (match.recorded) return;
  match.recorded = true;
  const wId = match.ids[winnerSide];
  const lId = match.ids[1 - winnerSide];
  guarded(async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, "players", wId), { weekW: increment(1), allW: increment(1) });
    batch.update(doc(db, "players", lId), { weekL: increment(1), allL: increment(1) });
    await batch.commit();
  });
}

function scorePoint(side, delta) {
  if (!matchReady() || match.ended) return;
  match.score[side] = Math.max(0, match.score[side] + delta);
  const w = matchWinnerSide();
  if (w !== null) {
    match.ended = true;
    recordMatchResult(w);
    const overlay = document.getElementById("winnerOverlay");
    overlay.hidden = false;
    gsap.fromTo(overlay.querySelector(".winner-card"),
      { opacity: 0, y: 60, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.6)" });
  } else if (delta > 0) {
    gsap.fromTo("#courtScore" + side, { scale: 1.35 }, { scale: 1, duration: 0.4, ease: "power3.out" });
  }
  renderMatch();
}

[0, 1].forEach((s) => {
  document.getElementById("plus" + s).addEventListener("click", () => scorePoint(s, 1));
  document.getElementById("minus" + s).addEventListener("click", () => scorePoint(s, -1));
  document.getElementById("courtSel" + s).addEventListener("change", (e) => {
    match.ids[s] = e.target.value || null;
    renderMatch();
  });
});

document.getElementById("targetChips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-target]");
  if (!chip || matchStarted() || match.ended) return;
  match.target = +chip.dataset.target;
  renderMatch();
});
document.getElementById("serveChips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-serves]");
  if (!chip || matchStarted() || match.ended) return;
  match.serves15 = +chip.dataset.serves;
  renderMatch();
});
document.getElementById("firstChips").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-first]");
  if (!chip || matchStarted() || match.ended) return;
  match.first = +chip.dataset.first;
  renderMatch();
});
document.getElementById("btnMatchReset").addEventListener("click", () => {
  if (matchStarted() && !match.ended && !confirm("Reset the current game to 0–0?")) return;
  resetGame();
});
document.getElementById("btnRematch").addEventListener("click", resetGame);

/* ---------------- audio (personal preference — stays local per device) ---------------- */
const bgm = document.getElementById("bgm");
const dock = document.getElementById("audioDock");
const volSlider = document.getElementById("audioVol");
const toggleBtn = document.getElementById("audioToggle");

const audioPrefs = (() => {
  try { return JSON.parse(localStorage.getItem("paddle-royale-audio")) || {}; }
  catch (e) { return {}; }
})();
let volume = typeof audioPrefs.volume === "number" ? audioPrefs.volume : 0.55;
let muted = !!audioPrefs.muted;
let started = false;

bgm.volume = volume;
volSlider.value = Math.round(volume * 100);
dock.classList.toggle("is-muted", muted);
dock.classList.add("needs-tap");

function saveAudioPrefs() {
  try { localStorage.setItem("paddle-royale-audio", JSON.stringify({ volume, muted })); } catch (e) {}
}

function tryStart() {
  if (started || muted) return;
  bgm.play().then(() => {
    started = true;
    dock.classList.remove("needs-tap");
    dock.classList.add("is-playing");
  }).catch(() => { /* autoplay blocked — wait for gesture */ });
}

toggleBtn.addEventListener("click", () => {
  muted = !muted;
  dock.classList.toggle("is-muted", muted);
  if (muted) {
    bgm.pause();
    dock.classList.remove("is-playing");
  } else {
    bgm.play().then(() => {
      started = true;
      dock.classList.remove("needs-tap");
      dock.classList.add("is-playing");
    }).catch(() => {});
  }
  saveAudioPrefs();
});

volSlider.addEventListener("input", () => {
  volume = volSlider.value / 100;
  bgm.volume = volume;
  if (volume === 0) {
    dock.classList.add("is-muted");
  } else if (!muted) {
    dock.classList.remove("is-muted");
  }
  saveAudioPrefs();
});

// start on first user gesture anywhere (autoplay policy)
["pointerdown", "keydown", "touchstart"].forEach((evt) =>
  document.addEventListener(evt, tryStart, { once: false, passive: true })
);
tryStart(); // in case autoplay is allowed

/* ---------------- canvas background (embers + court lines) ---------------- */
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");
let W, H, dpr;
let pointer = { x: 0.5, y: 0.35 };
const EMBERS = [];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function sizeCanvas() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.width = Math.round(innerWidth * dpr);
  H = canvas.height = Math.round(innerHeight * dpr);
}
sizeCanvas();
window.addEventListener("resize", sizeCanvas);
window.addEventListener("pointermove", (e) => {
  pointer.x = e.clientX / innerWidth;
  pointer.y = e.clientY / innerHeight;
}, { passive: true });

const emberCount = Math.min(70, Math.round(innerWidth / 18));
for (let i = 0; i < emberCount; i++) {
  EMBERS.push({
    x: Math.random(), y: Math.random(),
    r: 0.6 + Math.random() * 2.2,
    vy: 0.00025 + Math.random() * 0.0009,
    vx: (Math.random() - 0.5) * 0.0003,
    tw: Math.random() * Math.PI * 2,
    tint: Math.random(),
  });
}

// confetti-dust palette: mostly cream, with teal and orange pops
function speckColor(tint, twinkle) {
  if (tint < 0.55) return `rgba(252, 250, 221, ${0.1 + 0.28 * twinkle})`;
  if (tint < 0.8) return `rgba(102, 210, 208, ${0.14 + 0.34 * twinkle})`;
  return `rgba(248, 113, 46, ${0.12 + 0.3 * twinkle})`;
}

function drawBG(t) {
  ctx.clearRect(0, 0, W, H);
  const px = (pointer.x - 0.5) * 30 * dpr;
  const py = (pointer.y - 0.5) * 20 * dpr;

  for (const e of EMBERS) {
    e.y -= e.vy;
    e.x += e.vx + Math.sin(t * 0.0004 + e.tw) * 0.00012;
    if (e.y < -0.05) { e.y = 1.05; e.x = Math.random(); }
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 + e.tw));
    const ex = (e.x * W) + px * (e.r / 2.8);
    const ey = (e.y * H) + py * (e.r / 2.8);
    ctx.beginPath();
    ctx.arc(ex, ey, e.r * dpr, 0, Math.PI * 2);
    ctx.fillStyle = speckColor(e.tint, twinkle);
    ctx.fill();
  }
  if (!reduceMotion) requestAnimationFrame(drawBG);
}
requestAnimationFrame(drawBG);

/* ---------------- preloader + intro + Firestore boot ---------------- */
function buildPreloaderTimeline() {
  const tl = gsap.timeline();
  tl.to(".pre-kicker", { opacity: 1, duration: 0.5 }, 0.15)
    .to(".pre-title span", {
      opacity: 1, duration: 0.6, stagger: 0.15, ease: "power2.out",
      startAt: { y: 40, rotateX: -60 }, y: 0, rotateX: 0,
    }, 0.3)
    .to(".pre-bar i", { width: "100%", duration: 1.0, ease: "power2.inOut" }, 0.4)
    .to(".pre-sub", { opacity: 1, duration: 0.4 }, 0.6);
  return tl;
}

function playIntroReveal() {
  const tl = gsap.timeline();
  tl.to("#preloader", { yPercent: -100, duration: 0.7, ease: "power3.inOut", delay: 0.2 })
    .set("#preloader", { display: "none" })
    .from(".site-header", { opacity: 0, y: -24, duration: 0.5 }, "-=0.55")
    .from("[data-hero]", { opacity: 0, y: 36, duration: 0.6, ease: "power3.out", stagger: 0.09 }, "-=0.35")
    .from(".hero-deco > *", { opacity: 0, scale: 0.5, duration: 0.7, ease: "back.out(1.7)", stagger: 0.05 }, "-=0.6")
    .from(".ticker", { yPercent: 100, opacity: 0, duration: 0.5, ease: "power3.out" }, "-=0.45");
  return tl;
}

/* ---------------- board section reveal (fires when scrolled into view) ---------------- */
const boardArea = document.getElementById("boardArea");
let boardSeen = false;
let boardRevealed = false;

function tryRevealBoard() {
  if (boardRevealed || !boardSeen || !routeReady) return;
  if (!boardEl.querySelector(".banner")) return;
  boardRevealed = true;
  boardArea.classList.add("is-revealed");
  gsap.from(".board-title .hero-line", { yPercent: 120, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.12 });
  gsap.from(".board-intro .hero-sub", { opacity: 0, y: 18, duration: 0.5, delay: 0.3 });
  animateBannersIn();
  gsap.from(".site-footer", { opacity: 0, duration: 0.6, delay: 0.8 });
}

new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) { boardSeen = true; tryRevealBoard(); }
}, { threshold: 0.12 }).observe(boardArea);

document.getElementById("btnToBoard").addEventListener("click", () => {
  boardArea.scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ---------------- parallax + scroll-spun ping pong balls ---------------- */
const parallaxEls = [...document.querySelectorAll("[data-parallax]")];
const spin3dEls = [...document.querySelectorAll("[data-spin3d]")];
const burstEl = document.querySelector("[data-burst]");
let parallaxActive = false;

function applyScrollMotion() {
  const y = window.scrollY;
  parallaxEls.forEach((el) => {
    el.style.transform = `translateY(${(y * parseFloat(el.dataset.parallax)).toFixed(1)}px)`;
  });
  // ping pong ball decals tumble on a 3D axis with the scroll
  spin3dEls.forEach((el) => {
    el.style.transform = `rotate3d(0.45, 1, 0.12, ${(y * parseFloat(el.dataset.spin3d)).toFixed(1)}deg)`;
  });
  // the hero speed-line burst spins and zooms along its own lines
  if (burstEl) {
    const s = 1 + Math.min(y, 3000) * 0.00025;
    burstEl.style.transform = `rotate(${(y * 0.025).toFixed(2)}deg) scale(${s.toFixed(4)})`;
  }
  // banner photos float against their slabs
  document.querySelectorAll(".board .b-photo").forEach((ph) => {
    const r = ph.parentElement.getBoundingClientRect();
    if (r.bottom < -100 || r.top > innerHeight + 100) return;
    const off = (r.top + r.height / 2 - innerHeight / 2) * -0.05;
    ph.style.transform = `translateY(${off.toFixed(1)}px)`;
  });
}

/* header logo appears only after the hero (with its big logo) scrolls away */
new IntersectionObserver((entries) => {
  entries.forEach((e) =>
    document.querySelector(".site-header").classList.toggle("is-scrolled", !e.isIntersecting));
}, { rootMargin: "-120px 0px 0px 0px", threshold: 0 }).observe(document.getElementById("hero"));

{
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!parallaxActive || ticking) return;
    ticking = true;
    requestAnimationFrame(() => { applyScrollMotion(); ticking = false; });
  }, { passive: true });
}

function onPlayersSnapshot(snap) {
  players = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderBoard();
  if (openOverlayName === "profile" && currentProfileId) {
    const p = getPlayer(currentProfileId);
    if (p) fillProfile(p);
    else if (hashPlayerId()) location.hash = ""; // player was removed remotely
    else closeOverlay();
  }
  refreshMatchRoster();
  if (openOverlayName === "match") renderMatch();
}

async function boot() {
  const preTl = buildPreloaderTimeline();

  let playersSnap = await getDocs(playersCol);
  if (playersSnap.empty) {
    const batch = writeBatch(db);
    SEED_PLAYERS.forEach((p) => batch.set(doc(playersCol), { ...p, photo: null }));
    batch.set(metaRef, { week: isoWeek() });
    await batch.commit();
    playersSnap = await getDocs(playersCol);
  }
  players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const metaSnap = await getDoc(metaRef);
  currentWeek = metaSnap.exists() ? metaSnap.data().week : isoWeek();
  if (currentWeek !== isoWeek()) {
    await resetWeek();
    currentWeek = isoWeek();
    players.forEach((p) => { p.weekW = 0; p.weekL = 0; });
  }

  document.getElementById("weekValue").textContent = currentWeek;
  renderBoard();

  if (preTl.progress() < 1) await new Promise((resolve) => preTl.eventCallback("onComplete", resolve));

  const revealTl = playIntroReveal();
  // attach live listeners only once the entrance animation fully settles, so a
  // remote update mid-animation can't yank the DOM out from under GSAP's tweens
  revealTl.eventCallback("onComplete", () => {
    onSnapshot(playersCol, onPlayersSnapshot);
    onSnapshot(metaRef, (snap) => {
      if (!snap.exists()) return;
      currentWeek = snap.data().week;
      document.getElementById("weekValue").textContent = currentWeek;
    });
    routeReady = true;
    route(); // honor a deep link like #/p/<id> on first load
    parallaxActive = !reduceMotion;
    if (parallaxActive) applyScrollMotion();
    tryRevealBoard(); // in case the board is already in view
  });
}

boot().catch((err) => {
  console.error(err);
  alert("Couldn't connect to the shared leaderboard. Check your internet connection and reload the page.");
});

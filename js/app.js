/* ============================================================
   PADDLE ROYALE — app logic
   data store · render · GSAP animations · tilt/glow ·
   profile overlay · modals · photo upload · audio · canvas bg
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- data store ---------------- */
  const STORE_KEY = "paddle-royale-v1";

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

  function uid() {
    return "p" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const st = JSON.parse(raw);
        if (st && Array.isArray(st.players)) {
          // new ISO week → weekly scores reset automatically
          if (st.week !== isoWeek()) {
            st.week = isoWeek();
            st.players.forEach((p) => { p.weekW = 0; p.weekL = 0; });
            saveState(st);
          }
          return st;
        }
      }
    } catch (e) { /* corrupted storage → reseed */ }
    const st = {
      week: isoWeek(),
      players: SEED_PLAYERS.map((p) => ({ id: uid(), photo: null, ...p })),
    };
    saveState(st);
    return st;
  }

  function saveState(st) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(st));
    } catch (e) {
      alert("Couldn't save — storage is full. Try smaller photos.");
    }
  }

  let state = loadState();

  const sorted = () =>
    [...state.players].sort(
      (a, b) =>
        b.weekW - a.weekW ||
        a.weekL - b.weekL ||
        b.allW - a.allW ||
        a.name.localeCompare(b.name)
    );

  const getPlayer = (id) => state.players.find((p) => p.id === id);

  /* ---------------- placeholder avatars ---------------- */
  function avatarFor(p) {
    if (p.photo) return p.photo;
    const initials = p.name
      .split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
    let h = 0;
    for (let i = 0; i < p.name.length; i++) h = (h * 31 + p.name.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='300'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='hsl(${hue},45%,26%)'/>` +
      `<stop offset='1' stop-color='hsl(${(hue + 40) % 360},60%,14%)'/>` +
      `</linearGradient></defs>` +
      `<rect width='240' height='300' fill='url(%23g)'/>` +
      `<circle cx='190' cy='60' r='90' fill='hsl(${hue},70%,40%)' opacity='0.25'/>` +
      `<text x='120' y='175' font-family='Arial Black,Arial' font-size='84' font-weight='900' ` +
      `fill='rgba(242,237,226,0.85)' text-anchor='middle'>${initials}</text>` +
      `<text x='120' y='265' font-family='Arial' font-size='18' letter-spacing='6' ` +
      `fill='rgba(255,140,60,0.9)' text-anchor='middle'>PADDLER</text>` +
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

  function renderBoard({ animate = false } = {}) {
    const list = sorted();
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
    if (animate) animateBannersIn();
    renderTicker();
  }

  function animateBannersIn() {
    const banners = boardEl.querySelectorAll(".banner");
    gsap.fromTo(
      banners,
      { opacity: 0, y: 90, rotateX: -72, transformOrigin: "50% 0%", filter: "blur(6px)" },
      {
        opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)",
        duration: 0.9, ease: "back.out(1.4)", stagger: 0.09,
        clearProps: "filter",
      }
    );
    // rank counters roll up
    banners.forEach((b, i) => {
      const rankEl = b.querySelector(".b-rank");
      const obj = { v: 9 + i * 3 };
      gsap.to(obj, {
        v: i + 1, duration: 0.9, delay: 0.15 + i * 0.09, ease: "power3.out",
        onUpdate: () => { rankEl.textContent = Math.round(obj.v); },
        onComplete: () => { rankEl.textContent = i + 1; },
      });
    });
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
    el.addEventListener("click", () => openProfile(el.dataset.id));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProfile(el.dataset.id); }
    });
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

  /* ---------------- profile overlay ---------------- */
  const profileEl = document.getElementById("profile");
  const wipeEl = profileEl.querySelector(".profile-wipe");
  let currentProfileId = null;
  let profileOpen = false;

  function fillProfile(p) {
    const rank = sorted().findIndex((x) => x.id === p.id) + 1;
    document.getElementById("profileRank").textContent = "#" + rank;
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
    if (!p || profileOpen) return;
    profileOpen = true;
    currentProfileId = id;
    fillProfile(p);

    profileEl.classList.add("is-open");
    profileEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    profileEl.scrollTop = 0;

    const tl = gsap.timeline();
    tl.fromTo(wipeEl, { x: 0, xPercent: -101 }, { xPercent: 0, duration: 0.42, ease: "power3.in" })
      .set(".profile-inner", { opacity: 1 })
      .to(wipeEl, { xPercent: 101, duration: 0.5, ease: "power3.out" })
      .from(".profile-back, .profile-rank", { opacity: 0, y: -18, duration: 0.4, stagger: 0.08 }, "-=0.35")
      .from("#profileName .ch", {
        opacity: 0, y: 44, rotateX: -80, duration: 0.55, ease: "back.out(1.6)",
        stagger: { each: 0.022, from: "start" },
      }, "-=0.3")
      .from(".profile-photo-wrap", { opacity: 0, x: -50, duration: 0.6, ease: "power3.out" }, "-=0.45")
      .from(".stat-block, .profile-quickactions", { opacity: 0, y: 34, duration: 0.5, ease: "power3.out", stagger: 0.08 }, "-=0.4")
      .from("#profileBigname", { opacity: 0, y: 60, duration: 0.7, ease: "power3.out" }, "-=0.5");
  }

  function closeProfile() {
    if (!profileOpen) return;
    const tl = gsap.timeline({
      onComplete: () => {
        profileEl.classList.remove("is-open");
        profileEl.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        gsap.set(".profile-inner", { clearProps: "opacity" });
        profileOpen = false;
        currentProfileId = null;
      },
    });
    tl.fromTo(wipeEl, { x: 0, xPercent: -101 }, { xPercent: 0, duration: 0.38, ease: "power3.in" })
      .set(".profile-inner", { opacity: 0 })
      .to(wipeEl, { xPercent: 101, duration: 0.45, ease: "power3.out" });
  }

  document.getElementById("profileBack").addEventListener("click", closeProfile);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeProfile(); closeModal(); }
  });

  /* ---------------- photo upload (resized to keep storage small) ---------------- */
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
      const p = getPlayer(currentProfileId);
      p.photo = dataURL;
      saveState(state);
      const photoEl = document.getElementById("profilePhoto");
      gsap.fromTo(photoEl, { opacity: 0.2, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.6 });
      photoEl.style.backgroundImage = `url('${dataURL}')`;
      renderBoard();
    } catch (err) {
      alert("Couldn't read that image — try another file.");
    }
    e.target.value = "";
  });

  /* ---------------- quick win/loss + remove ---------------- */
  document.getElementById("btnQuickWin").addEventListener("click", () => {
    const p = getPlayer(currentProfileId);
    if (!p) return;
    p.weekW++; p.allW++;
    saveState(state); fillProfile(p); renderBoard();
  });
  document.getElementById("btnQuickLoss").addEventListener("click", () => {
    const p = getPlayer(currentProfileId);
    if (!p) return;
    p.weekL++; p.allL++;
    saveState(state); fillProfile(p); renderBoard();
  });
  document.getElementById("btnRemovePlayer").addEventListener("click", () => {
    const p = getPlayer(currentProfileId);
    if (!p) return;
    if (!confirm(`Remove ${p.name} from the league? This deletes their record.`)) return;
    state.players = state.players.filter((x) => x.id !== p.id);
    saveState(state);
    closeProfile();
    setTimeout(() => renderBoard({ animate: true }), 500);
  });

  /* ---------------- modals ---------------- */
  const modalEl = document.getElementById("modal");
  const modalAdd = document.getElementById("modalAdd");
  const modalMatch = document.getElementById("modalMatch");

  function openModal(which) {
    modalAdd.hidden = which !== "add";
    modalMatch.hidden = which !== "match";
    modalEl.classList.add("is-open");
    modalEl.setAttribute("aria-hidden", "false");
    const card = which === "add" ? modalAdd : modalMatch;
    gsap.fromTo(card, { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.6)" });
    if (which === "match") fillMatchSelects();
    if (which === "add") document.getElementById("addName").focus();
  }
  function closeModal() {
    modalEl.classList.remove("is-open");
    modalEl.setAttribute("aria-hidden", "true");
  }
  modalEl.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));

  document.getElementById("btnAdd").addEventListener("click", () => openModal("add"));
  document.getElementById("btnRecord").addEventListener("click", () => openModal("match"));

  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("Start a fresh week? Weekly W–L resets to 0 (all-time records are kept).")) return;
    state.week = isoWeek();
    state.players.forEach((p) => { p.weekW = 0; p.weekL = 0; });
    saveState(state);
    renderBoard({ animate: true });
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
    state.players.push({ id: uid(), name, photo, weekW: 0, weekL: 0, allW: 0, allL: 0 });
    saveState(state);
    nameInput.value = "";
    document.getElementById("addPhoto").value = "";
    closeModal();
    renderBoard({ animate: true });
  });

  /* record match */
  function fillMatchSelects() {
    const opts = sorted()
      .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
      .join("");
    document.getElementById("matchWinner").innerHTML = opts;
    const loserSel = document.getElementById("matchLoser");
    loserSel.innerHTML = opts;
    if (loserSel.options.length > 1) loserSel.selectedIndex = 1;
  }
  document.getElementById("matchConfirm").addEventListener("click", () => {
    const wId = document.getElementById("matchWinner").value;
    const lId = document.getElementById("matchLoser").value;
    if (!wId || !lId) return;
    if (wId === lId) { alert("A player can't beat themselves (philosophically debatable, but no)."); return; }
    const w = getPlayer(wId), l = getPlayer(lId);
    w.weekW++; w.allW++; l.weekL++; l.allL++;
    saveState(state);
    closeModal();
    renderBoard({ animate: true });
  });

  /* ---------------- audio ---------------- */
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
      warm: Math.random() > 0.35,
    });
  }

  function drawBG(t) {
    ctx.clearRect(0, 0, W, H);
    const px = (pointer.x - 0.5) * 30 * dpr;
    const py = (pointer.y - 0.5) * 20 * dpr;

    // faint perspective court lines
    ctx.save();
    ctx.translate(W / 2 + px * 0.4, H * 0.9 + py * 0.4);
    ctx.strokeStyle = "rgba(255, 120, 50, 0.05)";
    ctx.lineWidth = dpr;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 60 * dpr, 0);
      ctx.lineTo(i * 340 * dpr, -H);
      ctx.stroke();
    }
    for (let j = 1; j <= 5; j++) {
      const y = -Math.pow(j / 5, 1.7) * H * 0.8;
      ctx.beginPath();
      ctx.moveTo(-W, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // embers drifting up
    for (const e of EMBERS) {
      e.y -= e.vy;
      e.x += e.vx + Math.sin(t * 0.0004 + e.tw) * 0.00012;
      if (e.y < -0.05) { e.y = 1.05; e.x = Math.random(); }
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 + e.tw));
      const ex = (e.x * W) + px * (e.r / 2.8);
      const ey = (e.y * H) + py * (e.r / 2.8);
      ctx.beginPath();
      ctx.arc(ex, ey, e.r * dpr, 0, Math.PI * 2);
      ctx.fillStyle = e.warm
        ? `rgba(255, ${110 + Math.round(80 * twinkle)}, 45, ${0.18 + 0.4 * twinkle})`
        : `rgba(170, 190, 255, ${0.08 + 0.2 * twinkle})`;
      ctx.fill();
    }
    if (!reduceMotion) requestAnimationFrame(drawBG);
  }
  requestAnimationFrame(drawBG);

  /* ---------------- preloader + intro ---------------- */
  document.getElementById("weekValue").textContent = state.week;
  renderBoard();

  const intro = gsap.timeline();
  intro
    .to(".pre-kicker", { opacity: 1, duration: 0.5 }, 0.15)
    .to(".pre-title span", {
      opacity: 1, duration: 0.6, stagger: 0.15, ease: "power2.out",
      startAt: { y: 40, rotateX: -60 }, y: 0, rotateX: 0,
    }, 0.3)
    .to(".pre-bar i", { width: "100%", duration: 1.0, ease: "power2.inOut" }, 0.4)
    .to(".pre-sub", { opacity: 1, duration: 0.4 }, 0.6)
    .to("#preloader", { yPercent: -100, duration: 0.7, ease: "power3.inOut", delay: 0.2 })
    .set("#preloader", { display: "none" })
    .from(".site-header", { opacity: 0, y: -24, duration: 0.5 }, "-=0.55")
    .from(".ticker", { opacity: 0, duration: 0.5 }, "-=0.4")
    .from(".hero-line", { yPercent: 110, duration: 0.7, ease: "power3.out", stagger: 0.1 }, "-=0.35")
    .from(".hero-sub", { opacity: 0, y: 16, duration: 0.5 }, "-=0.3")
    .add(() => animateBannersIn(), "-=0.2")
    .from(".site-footer", { opacity: 0, duration: 0.6 }, "+=0.4");
})();

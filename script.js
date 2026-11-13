/* ================================================================
   CONTENT
   ================================================================ */
const STORAGE_KEY = "bingo-v2";

const REWARDS = [
  { id: "h",   label: "One horizontal line", hint: "Complete any full row",     n: 5  },
  { id: "v",   label: "One vertical line",   hint: "Complete any full column",  n: 5  },
  { id: "d",   label: "One diagonal line",   hint: "Corner to opposite corner", n: 5  },
  { id: "all", label: "Full card blackout",  hint: "Check every box",           n: 25 },
];

// boxes that are permanently checked and can't be edited/unmarked
const FREE_CELLS = {
  12: "Free daw sabi ni james",
  3:  "bonus wag na to",
  21: "bonus wag na to",
};

// the 22 non-free boxes in reading order (FREE_CELLS slots are skipped).
// Same questions on both cards: each person checks off what they learn.
const SEED_QUESTIONS = [
  "What's something you think I should know about you?",
  "What does a perfect week look like for you?",
  "What green flags do you look for?",
  "What's the biggest dream you wish to achieve?",
  "How do you manage stress?",
  "What is your MUST HAVE in a relationship?",
  "A beach or mountain vacation, why?",
  "What are your plans for the future?",
  "What's something you're passionate about?",
  "When you're upset, do you prefer comfort or space?",
  "Do you like going with the flow or planning everything?",
  "Tell one thing about your childhood",
  "What was your first impression of me?",
  "Give two compliments",
  "Show one of your love languages",
  "Give 2 truths and 1 lie",
  "Ask and be asked a question",
  "What are your allergies",
  "State your full name",
  "Tell your birthday/date",
  "What's your biggest pet peeve?",
  "What's a small thing that makes your day better?",
];

// bump whenever SEED_QUESTIONS changes, so old saves get the new questions
const CONTENT_VERSION = 1;

// popups fired the first time the combined completion (both cards, 50 boxes)
// reaches each threshold
const MILESTONES = [
  { at: 30,  icon: "img/potatocorner.png", wide: true, text: "CONGRATS ON REACHING 30% POTATOCORNER TIME!" },
  { at: 50,  emoji: "📸", text: "HALFWAY THERE! PHOTOBOOTH TIME POOO!" },
  { at: 70,  icon: "img/spotify.svg", text: "70%! MAKE A PLAYLIST THAT REMINDS YOU OF ME AND I'LL DO THE SAME <3 [3-Songs minimum]" },
  { at: 100, icon: "img/bouquet.png", big: true, text: "100%! NEXT DATE IS ON ME, YOU PICK WHEN!" },
];

/* ================================================================
   STATE
   ================================================================ */
const blankRewards = () => ({ h: "", v: "", d: "", all: "" });

function seedCells() {
  const questions = SEED_QUESTIONS[Symbol.iterator]();
  // free slots stay blank here; applyFreeCells fills them in
  return Array.from({ length: 25 }, (_, i) => FREE_CELLS[i] ? "" : (questions.next().value || ""));
}

const defaultCard = isPink => ({
  name: isPink ? "Shai" : "James",
  cells: seedCells(),
  marks: Array(25).fill(false),
  rewards: blankRewards(),
  redeemed: {},
});

let state = {
  mode: "edit",
  active: 0,
  contentVersion: CONTENT_VERSION,
  cards: [defaultCard(false), defaultCard(true)],
};

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && saved.cards && saved.cards.length === 2) state = saved;
} catch (e) { /* ignore corrupt storage */ }

// old saves still carry the placeholder names: swap them for the real ones
const OLD_NAMES = { "Team Blue": "James", "Team Pink": "Shai" };
function renameOld(card) {
  if (!OLD_NAMES[card.name]) return false;
  card.name = OLD_NAMES[card.name];
  return true;
}

function applyFreeCells(card) {
  for (const i in FREE_CELLS) {
    card.cells[i] = FREE_CELLS[i];
    card.marks[i] = true;
  }
}

// patch in anything older saves might be missing
if (!Array.isArray(state.milestones)) state.milestones = [];
state.cards.forEach(card => {
  renameOld(card);
  card.rewards = card.rewards || blankRewards();
  card.redeemed = card.redeemed || {};
  // a save from an older question set: new questions, and clear the marks
  // since they wouldn't line up anymore
  if (state.contentVersion !== CONTENT_VERSION) {
    card.cells = seedCells();
    card.marks = Array(25).fill(false);
  }
  applyFreeCells(card);
});
state.contentVersion = CONTENT_VERSION;

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { /* storage full / unavailable */ }
}

const cardName = i => state.cards[i].name || "Card " + (i + 1);
const checkedCount = card => card.marks.filter(Boolean).length;
const overallPct = () => (checkedCount(state.cards[0]) + checkedCount(state.cards[1])) / 50 * 100;

/* ================================================================
   BINGO LINES
   ================================================================ */
const ROWS = [0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c));
const COLS = [0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c));
const DIAGS = [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]];
const ALL_LINES = ROWS.concat(COLS, DIAGS);

// indexes (into ALL_LINES) of every completed line
const doneLines = marks => ALL_LINES.flatMap((line, li) => line.every(i => marks[i]) ? [li] : []);

// best progress toward each reward (most-checked row / column / diagonal, total checked)
function rewardProgress(marks) {
  const best = lines => Math.max(...lines.map(line => line.filter(i => marks[i]).length));
  return { h: best(ROWS), v: best(COLS), d: best(DIAGS), all: checkedCount({ marks }) };
}

/* ================================================================
   SMALL DOM HELPERS
   ================================================================ */
const appEl = document.getElementById("app");
const mainEl = document.getElementById("main");
const tabsEl = document.getElementById("tabs");
const editBtn = document.getElementById("bEdit");
const playBtn = document.getElementById("bPlay");
const helpBtn = document.getElementById("bHelp");

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

// restart a one-shot CSS animation class
function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

// a modal overlay that closes when its dimmed backdrop is clicked
function makeOverlay(html, onBackdrop) {
  const overlay = el("div", "modal-overlay", html);
  overlay.onclick = e => { if (e.target === overlay) onBackdrop(); };
  appEl.appendChild(overlay);
  return overlay;
}

// force-paste as plain text in any contenteditable element
function pasteAsPlainText(e) {
  e.preventDefault();
  document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
}

/* ================================================================
   CELL TEXT AUTO-FIT
   Cells are fixed-size boxes. When a question doesn't fit at the
   stylesheet size, shrink the font (never below the floor) until it
   does. All cells are measured together, so each pass costs one
   layout instead of one per cell per step, and results are cached by
   width + text so re-renders (tab / mode switches) don't measure again.
   ================================================================ */
const MIN_CELL_FONT_PX = 6.5;
const FONT_STEP_PX = 0.5;
const fitCache = new Map();

const overflows = node =>
  node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1;

function fitCells(cells) {
  // measure as plain blocks so overflow is reported accurately
  // (a vertically centered flex box hides the part sticking out on top)
  cells.forEach(c => { c.style.fontSize = ""; c.classList.add("fitting"); });

  const jobs = cells.map(c => {
    const base = parseFloat(getComputedStyle(c).fontSize);
    return { c, base, key: c.clientWidth + "|" + base + "|" + c.textContent };
  });
  const todo = [];
  jobs.forEach(job => {
    if (fitCache.has(job.key)) job.size = fitCache.get(job.key);
    else if (job.base <= MIN_CELL_FONT_PX || !overflows(job.c)) job.size = job.base;
    else {
      // binary search for the fewest FONT_STEP_PX steps down that fit
      job.lo = 1;
      job.hi = Math.ceil((job.base - MIN_CELL_FONT_PX) / FONT_STEP_PX);
      todo.push(job);
    }
  });

  let open = todo;
  while (open.length) {
    open.forEach(j => { j.mid = (j.lo + j.hi) >> 1; j.c.style.fontSize = (j.base - j.mid * FONT_STEP_PX) + "px"; });
    open.forEach(j => { if (overflows(j.c)) j.lo = j.mid + 1; else j.hi = j.mid; });
    open = open.filter(j => j.lo < j.hi);
  }
  todo.forEach(j => { j.size = j.base - j.lo * FONT_STEP_PX; });

  jobs.forEach(j => {
    fitCache.set(j.key, j.size);
    j.c.style.fontSize = j.size === j.base ? "" : j.size + "px";
    j.c.classList.remove("fitting");
  });
}

// refit whenever the grid's width changes (rotation, resize, layout switch)
let fitGrid = null;
let fitWidth = -1;
const gridObserver = "ResizeObserver" in window
  ? new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width === fitWidth) return;
      fitWidth = width;
      fitCells([...fitGrid.children]);
    })
  : null;

function watchGrid(gridEl) {
  fitGrid = gridEl;
  fitWidth = -1;
  if (gridObserver) { gridObserver.disconnect(); gridObserver.observe(gridEl); }
  else fitCells([...gridEl.children]);
}

// the web fonts change text widths: measure again whenever they finish loading
function refitAfterFonts() {
  fitCache.clear();
  if (fitGrid) fitCells([...fitGrid.children]);
  if (tour) placeTour();
}
if (document.fonts) {
  document.fonts.ready.then(refitAfterFonts);
  document.fonts.addEventListener("loadingdone", refitAfterFonts);
}

/* ================================================================
   SOUNDS
   ================================================================ */
// voice clips for taps on the cards in SFX_CARDS (0 = James, 1 = Shai).
// Drop the files in an "sfx" folder next to index.html; missing files
// stay silent. They're only loaded on the first tap that needs them.
const SFX_FILES = [1, 2, 3, 4, 5, 6, 7].map(n => "sfx/click" + n + ".mp3");
const SFX_CARDS = [1];   // only her card (Shai) gets sounds
const SFX_VOLUME = 1;    // 0 to 1
let sfxClips = null;
let lastSfxIndex = -1;

function playClickSfx(cardIndex) {
  if (!SFX_CARDS.includes(cardIndex) || !SFX_FILES.length) return;
  sfxClips = sfxClips || SFX_FILES.map(src => {
    const audio = new Audio(src);
    audio.volume = SFX_VOLUME;
    return audio;
  });
  // random clip, but never the same one twice in a row
  let i;
  do { i = Math.floor(Math.random() * sfxClips.length); }
  while (sfxClips.length > 1 && i === lastSfxIndex);
  lastSfxIndex = i;
  const clip = sfxClips[i];
  try { clip.currentTime = 0; } catch (e) { /* not loaded yet */ }
  clip.play().catch(() => { /* file missing or playback blocked */ });
}

// 8-bit blips made on the fly (no files). CHIP_VOLUME = 0 turns them off.
const CHIP_VOLUME = 0.06;
const CHIP_TUNES = {
  mark:     [[880, .05], [1320, .07]],
  unmark:   [[660, .05], [440, .07]],
  line:     [[523, .08], [659, .08], [784, .08], [1047, .16]],
  blackout: [[523, .08], [659, .08], [784, .08], [1047, .1], [784, .08], [1047, .1], [1319, .28]],
  redeem:   [[988, .07], [1319, .12], [0, .04], [1568, .06], [2093, .22]], // coin pickup + sparkle
};
let chipCtx = null;

function audio() {
  chipCtx = chipCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (chipCtx.state === "suspended") chipCtx.resume();
  return chipCtx;
}

function chip(name) {
  if (!CHIP_VOLUME) return;
  try {
    audio();
    let t = chipCtx.currentTime;
    CHIP_TUNES[name].forEach(([freq, len]) => {
      if (!freq) { t += len; return; } // 0 = a short rest
      const osc = chipCtx.createOscillator();
      const gain = chipCtx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(CHIP_VOLUME, t);
      gain.gain.setValueAtTime(0, t + len * .9);
      osc.connect(gain).connect(chipCtx.destination);
      osc.start(t);
      osc.stop(t + len);
      t += len;
    });
  } catch (e) { /* no audio support */ }
}

// Clear marks: a falling 8-bit zap, then a crunchy explosion, so it
// sounds like the whole card just got nuked
function chipNuke() {
  if (!CHIP_VOLUME) return;
  try {
    const ctx = audio();
    const t = ctx.currentTime;

    const zap = ctx.createOscillator();
    const zapGain = ctx.createGain();
    zap.type = "square";
    zap.frequency.setValueAtTime(1200, t);
    zap.frequency.exponentialRampToValueAtTime(60, t + .35);
    zapGain.gain.setValueAtTime(CHIP_VOLUME, t);
    zapGain.gain.setValueAtTime(0, t + .35);
    zap.connect(zapGain).connect(ctx.destination);
    zap.start(t);
    zap.stop(t + .36);

    // stepped noise (each value held for a few samples) gives the retro crunch
    const boomAt = t + .3;
    const boomLen = .8;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * boomLen), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let v = 0;
    for (let i = 0; i < data.length; i++) {
      if (i % 24 === 0) v = Math.random() * 2 - 1;
      data[i] = v;
    }
    const boom = ctx.createBufferSource();
    boom.buffer = buffer;
    const muffle = ctx.createBiquadFilter();
    muffle.type = "lowpass";
    muffle.frequency.setValueAtTime(3000, boomAt);
    muffle.frequency.exponentialRampToValueAtTime(120, boomAt + boomLen);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(CHIP_VOLUME * 1.5, boomAt);
    boomGain.gain.exponentialRampToValueAtTime(.001, boomAt + boomLen);
    boom.connect(muffle).connect(boomGain).connect(ctx.destination);
    boom.start(boomAt);
  } catch (e) { /* no audio support */ }
}

/* ================================================================
   TOAST (line complete)
   ================================================================ */
const toastEl = el("div", "toast", '<b class="toast-t"></b><span class="toast-s"></span>');
toastEl.setAttribute("role", "status");
appEl.appendChild(toastEl);
let toastTimer = null;

function showToast(title, sub) {
  toastEl.querySelector(".toast-t").textContent = title;
  const subEl = toastEl.querySelector(".toast-s");
  subEl.textContent = sub;
  subEl.style.display = sub ? "" : "none";
  replay(toastEl, "show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
}

/* ================================================================
   MILESTONE POPUPS
   ================================================================ */
MILESTONES.forEach(m => { if (m.icon) new Image().src = m.icon; });

let milestonesReady = false; // false until the first cloud sync lands, so old progress doesn't replay
const milestoneQueue = [];
let milestoneShowing = false;

const milestoneOverlay = makeOverlay(`
  <div class="modal-box milestone-box" role="dialog" aria-modal="true" aria-labelledby="milestoneTitle">
    <button class="modal-close" aria-label="Close">×</button>
    <div class="modal-emoji"></div>
    <h2 id="milestoneTitle"></h2>
    <div class="date-check-actions"><button class="dc-good" type="button">Yiee kilig yan</button></div>
  </div>
`, hideMilestone);
const milestoneBox = milestoneOverlay.querySelector(".modal-box");
const milestoneIcon = milestoneOverlay.querySelector(".modal-emoji");
milestoneOverlay.querySelector(".modal-close").onclick = hideMilestone;
milestoneOverlay.querySelector(".dc-good").onclick = hideMilestone;

function showNextMilestone() {
  if (milestoneShowing || tour || !milestoneQueue.length) return; // waits for the tour to finish
  const m = milestoneQueue.shift();
  milestoneShowing = true;
  milestoneIcon.textContent = "";
  milestoneIcon.classList.toggle("big", !!m.big);
  milestoneIcon.classList.toggle("wide", !!m.wide);
  if (m.icon) {
    const img = el("img");
    img.src = m.icon;
    img.alt = "";
    milestoneIcon.appendChild(img);
  } else {
    milestoneIcon.textContent = m.emoji || "";
  }
  milestoneOverlay.querySelector("h2").textContent = m.text;
  milestoneOverlay.classList.add("show");
  replay(milestoneBox, "pop");
}

function hideMilestone() {
  milestoneOverlay.classList.remove("show");
  milestoneShowing = false;
  setTimeout(() => {
    showNextMilestone(); // next queued one, if several were crossed at once
    if (milestoneShowing) return;
    showMilestoneHint();
    flushHints();
  }, 250);
}

// called whenever progress changes
function checkMilestones() {
  if (!milestonesReady) return;
  const pct = overallPct();
  const before = state.milestones.length;
  // progress dropped back below a threshold (e.g. Clear marks): it can fire again
  state.milestones = state.milestones.filter(t => t <= pct);
  let changed = state.milestones.length !== before;
  MILESTONES.forEach(m => {
    if (pct >= m.at && !state.milestones.includes(m.at)) {
      state.milestones.push(m.at);
      changed = true;
      if (m.text) milestoneQueue.push(m);
    }
  });
  if (changed) save();
  showNextMilestone();
}

// start watching once the real progress is known; whatever is already
// past counts as seen, so only genuinely new crossings pop up
function armMilestones() {
  if (milestonesReady) return;
  const pct = overallPct();
  MILESTONES.forEach(m => {
    if (pct >= m.at && !state.milestones.includes(m.at)) state.milestones.push(m.at);
  });
  save();
  milestonesReady = true;
}

/* ================================================================
   LONG-PRESS TO ENLARGE
   Hold a box (Play mode) to read its question large. A normal tap
   still marks the box; the press that opened the popup never marks.
   ================================================================ */
const PRESS_MS = 450;
let pressTimer = null;
let pressOrigin = null;
let suppressClick = false;
let peekOpenedAt = 0;

const peekOverlay = makeOverlay(`
  <div class="modal-box peek" role="dialog" aria-modal="true">
    <p class="peek-text"></p>
    <p class="peek-hint">Tap anywhere to close</p>
  </div>
`, () => {});
const peekTextEl = peekOverlay.querySelector(".peek-text");
const hidePeek = () => peekOverlay.classList.remove("show");
peekOverlay.onclick = () => { if (Date.now() - peekOpenedAt > 350) hidePeek(); };

function startPress(cellEl, e) {
  suppressClick = false;
  clearTimeout(pressTimer);
  pressOrigin = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    pressTimer = null;
    suppressClick = true;
    peekOpenedAt = Date.now();
    peekTextEl.textContent = cellEl.textContent;
    peekOverlay.classList.add("show");
    if (navigator.vibrate) navigator.vibrate(15);
  }, PRESS_MS);
}
function movePress(e) {
  if (pressTimer && Math.hypot(e.clientX - pressOrigin.x, e.clientY - pressOrigin.y) > 10) cancelPress();
}
function cancelPress() {
  clearTimeout(pressTimer);
  pressTimer = null;
}

/* ================================================================
   SIDEBAR TABS
   ================================================================ */
const tabs = state.cards.map((card, i) => {
  const tab = el("button", "tab c" + i, '<span class="t"></span><span class="badge">BINGO</span>');
  tab.onclick = () => {
    if (state.active === i) return;
    state.active = i;
    save();
    render();
  };
  tabsEl.appendChild(tab);
  return { label: tab.querySelector(".t"), badge: tab.querySelector(".badge"), tab };
});

function updateTabs() {
  tabs.forEach((t, i) => {
    t.label.textContent = cardName(i);
    t.badge.classList.toggle("show", doneLines(state.cards[i].marks).length > 0);
    t.tab.classList.toggle("on", i === state.active);
  });
}

/* ================================================================
   MAIN RENDER
   Rebuilds the card + hub for the active card and mode.
   ================================================================ */
let hubOpen = false;  // whether the hub is expanded (mobile), kept across re-renders
let hub = null;       // refs into the current hub, used by updateHub()

const SYNC_PROBLEM = /problem|unavailable/i; // the sync note only shows when sync is broken
let syncStatus = "Saving on this device only";

function setSyncStatus(text) {
  syncStatus = text;
  if (hub) { hub.syncNote.textContent = text; hub.syncNote.hidden = !SYNC_PROBLEM.test(text); }
}

// completion bar, milestone markers and the collapsed-hub summary
function updateHub() {
  if (!hub) return;
  const [blue, pink] = state.cards.map(checkedCount);
  const rawPct = overallPct();
  const pct = Math.round(rawPct);

  hub.blueBar.style.width = (blue / 50 * 100) + "%";
  hub.pinkBar.style.width = (pink / 50 * 100) + "%";
  hub.pct.textContent = pct + "%";
  hub.blueLabel.textContent = cardName(0) + ": " + blue + "/25";
  hub.pinkLabel.textContent = cardName(1) + ": " + pink + "/25";

  hub.dots.forEach((dot, i) => {
    const m = MILESTONES[i];
    const reached = rawPct >= m.at;
    // reached + has a message: hover shows it in a bubble, click re-opens the popup
    const clickable = reached && !!m.text;
    dot.classList.toggle("got", reached);
    dot.textContent = reached ? "" : "?"; // reached ones show a pixel icon (style.css)
    if (clickable) dot.dataset.msg = m.text; else delete dot.dataset.msg;
    dot.classList.toggle("clickable", clickable);
    dot.tabIndex = clickable ? 0 : -1;
    dot.setAttribute("role", clickable ? "button" : "img");
    dot.setAttribute("aria-label", m.at + "% milestone " + (reached ? "reached" : "not reached yet"));
  });

  const progress = rewardProgress(state.cards[state.active].marks);
  const got = REWARDS.filter(r => progress[r.id] >= r.n).length;
  hub.summary.textContent = state.mode === "edit"
    ? "Rewards"
    : "Rewards " + got + "/" + REWARDS.length + "  ·  " + pct + "%";

  checkMilestones();
}

function buildHub() {
  const hubEl = el("div", "hub");
  hubEl.classList.toggle("open", hubOpen);

  const toggle = el("button", "hub-toggle", '<span class="hs"></span><span class="chev" aria-hidden="true"></span>');
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(hubOpen));
  toggle.onclick = () => {
    hubOpen = !hubOpen;
    hubEl.classList.toggle("open", hubOpen);
    toggle.setAttribute("aria-expanded", String(hubOpen));
  };

  const rewardsPanel = el("div", "panel", `
    <div class="ph"><h2>Rewards</h2><span class="pill"></span></div>
    <p class="sub">Hidden prizes unlocked by completed lines</p>
  `);

  const completionPanel = el("div", "panel", `
    <div class="ph"><h2>Completion rate</h2><span class="pill"></span></div>
    <div class="bar-wrap"><div class="bar"><div class="sb"></div><div class="sp"></div></div></div>
    <div class="leg"><span class="lb"></span><span class="lp"></span></div>
    <p class="sync-note"></p>
  `);
  const barWrap = completionPanel.querySelector(".bar-wrap");

  // a marker on the bar for each milestone: "?" until it's reached
  const dots = MILESTONES.map(m => {
    const dot = el("span", "ms");
    dot.style.left = m.at + "%";
    dot.dataset.at = m.at;
    // once reached, click (or Enter) brings its popup back
    const reshow = () => {
      if (!dot.classList.contains("got") || !m.text) return;
      milestoneQueue.push(m);
      showNextMilestone();
    };
    dot.onclick = reshow;
    dot.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reshow(); } };
    barWrap.appendChild(dot);
    return dot;
  });

  const body = el("div", "hub-body");
  body.append(rewardsPanel, completionPanel);
  hubEl.append(toggle, body);

  hub = {
    dots,
    toggle,
    summary: toggle.querySelector(".hs"),
    unlockedPill: rewardsPanel.querySelector(".pill"),
    rewardsPanel,
    completionPanel,
    blueBar: completionPanel.querySelector(".sb"),
    pinkBar: completionPanel.querySelector(".sp"),
    pct: completionPanel.querySelector(".pill"),
    blueLabel: completionPanel.querySelector(".lb"),
    pinkLabel: completionPanel.querySelector(".lp"),
    syncNote: completionPanel.querySelector(".sync-note"),
  };
  setSyncStatus(syncStatus);
  return hubEl;
}

function render() {
  const cardIndex = state.active;
  const card = state.cards[cardIndex];
  const editing = state.mode === "edit";

  editBtn.classList.toggle("on", editing);
  playBtn.classList.toggle("on", !editing);
  appEl.dataset.card = cardIndex;
  updateTabs();

  /* ---------- bingo card ---------- */
  const cardEl = el("div", "card " + state.mode);

  const nameInput = el("input", "name");
  nameInput.value = card.name;
  nameInput.setAttribute("aria-label", "Card name");
  nameInput.oninput = () => {
    card.name = nameInput.value;
    updateTabs();
    updateHub();
    save();
    syncCardSoon(cardIndex, ["name"]);
  };

  const statusEl = el("div", "status" + (editing ? " setup" : ""));
  const gridEl = el("div", "grid");

  /* ---------- rewards ---------- */
  const hubEl = buildHub();
  const tiers = REWARDS.map(reward => {
    const tier = el("div", "tier", `
      <div class="body">
        <div class="ico"></div>
        <div class="tx"><div class="lab"></div><div class="t1"></div><div class="t2"></div></div>
        <span class="st"></span>
      </div>
      <div class="pb"><i></i></div>
    `);
    const t = {
      reward,
      tier,
      body: tier.querySelector(".body"),
      status: tier.querySelector(".st"),
      title: tier.querySelector(".t1"),
      bar: tier.querySelector(".pb i"),
      btn: null,
      wasUnlocked: false,
    };
    tier.querySelector(".lab").textContent = reward.label;
    tier.querySelector(".t2").textContent = reward.hint;

    if (editing) {
      tier.querySelector(".pb").style.display = "none";
      t.title.contentEditable = true;
      t.title.dataset.ph = "Type the hidden reward…";
      t.title.textContent = card.rewards[reward.id];
      t.title.oninput = () => {
        card.rewards[reward.id] = t.title.textContent;
        save();
        syncCardSoon(cardIndex, ["rewards"]);
      };
      t.title.onpaste = pasteAsPlainText;
    }
    hub.rewardsPanel.appendChild(tier);
    return t;
  });

  const redeem = reward => {
    const willRedeem = !card.redeemed[reward.id];
    const commit = value => {
      card.redeemed[reward.id] = value;
      save();
      syncCard(cardIndex, ["redeemed"]);
      refresh(false);
      if (value) {
        chip("redeem");
        showRedeemModal(card.rewards[reward.id] || "Unlocked!");
      }
    };
    // the grand prize on Shai's card goes through the date check + proposal first
    if (reward.id === "all" && willRedeem && cardIndex === 1) {
      showDateCheckModal(() => commit(true));
    } else {
      commit(willRedeem);
    }
  };

  /* ---------- refresh: marks, lines and rewards ---------- */
  let lastDone = null; // completed lines after the previous refresh
  const cellEls = [];

  function refresh(animate) {
    const done = doneLines(card.marks);
    const won = new Set(done.flatMap(li => ALL_LINES[li]));
    cellEls.forEach((c, i) => {
      c.classList.toggle("m", card.marks[i]);
      c.classList.toggle("w", won.has(i));
    });
    statusEl.textContent = !editing && done.length
      ? "BINGO!" + (done.length > 1 ? " x" + done.length : "")
      : "";

    // lines that just became complete: flash them cell by cell
    const newLines = animate && lastDone ? done.filter(li => !lastDone.includes(li)) : [];
    lastDone = done;
    newLines.forEach(li => ALL_LINES[li].forEach((ci, pos) => {
      cellEls[ci].style.setProperty("--i", pos);
      replay(cellEls[ci], "sweep");
    }));

    const progress = rewardProgress(card.marks);
    const newlyUnlocked = [];
    let unlockedCount = 0;

    tiers.forEach(t => {
      const { reward } = t;
      const unlocked = progress[reward.id] >= reward.n;
      if (unlocked) unlockedCount++;
      if (editing) return;

      const redeemed = !!card.redeemed[reward.id];
      t.tier.classList.toggle("got", unlocked);
      t.bar.style.width = Math.min(100, progress[reward.id] / reward.n * 100) + "%";
      t.status.textContent = unlocked ? "UNLOCKED" : progress[reward.id] + "/" + reward.n + " boxes";
      t.title.textContent = !unlocked ? "Hidden reward"
        : redeemed ? (card.rewards[reward.id] || "Unlocked!")
        : "Click to redeem";

      if (unlocked) {
        if (!t.btn) {
          t.btn = el("button", "redeem");
          t.btn.onclick = () => redeem(reward);
          t.body.appendChild(t.btn);
        }
        t.btn.classList.toggle("done", redeemed);
        t.btn.textContent = redeemed ? "Redeemed ✓" : "Redeem";
        if (!t.wasUnlocked && animate) {
          newlyUnlocked.push(reward.label);
          replay(t.tier, "pop");
        }
      } else if (t.btn) {
        t.btn.remove();
        t.btn = null;
      }
      t.wasUnlocked = unlocked;
    });

    hub.unlockedPill.textContent = editing ? "" : unlockedCount + " unlocked";
    hub.unlockedPill.hidden = editing;
    updateTabs();
    updateHub();

    if (newLines.length) {
      const everything = card.marks.every(Boolean);
      const title = everything ? "Blackout!"
        : newLines.length > 1 ? newLines.length + " lines complete!"
        : newLines[0] < 5 ? "Row complete!"
        : newLines[0] < 10 ? "Column complete!"
        : "Diagonal complete!";
      showToast(title, newlyUnlocked.length ? "Unlocked: " + newlyUnlocked.join(", ") : "");
      chip(everything ? "blackout" : "line");
      if (newlyUnlocked.length) setTimeout(showRedeemHint, 1000); // after the line sparkle
    }
  }

  /* ---------- 25 grid cells ---------- */
  for (let i = 0; i < 25; i++) {
    const cellEl = el("div", "cell");
    const free = !!FREE_CELLS[i];
    cellEl.dataset.n = i + 1;
    cellEl.textContent = card.cells[i];
    if (free) cellEl.classList.add("free");
    cellEl.contentEditable = editing && !free;

    // colour along the diagonal: James goes blue (top-left) -> pink, Shai the reverse
    const diagonalShare = (Math.floor(i / 5) + i % 5) / 8;
    cellEl.style.setProperty("--p", Math.round((cardIndex === 0 ? diagonalShare : 1 - diagonalShare) * 100) + "%");

    if (editing) {
      cellEl.oninput = () => {
        card.cells[i] = cellEl.textContent;
        save();
        syncCardSoon(cardIndex, ["cells"]);
        fitCells([cellEl]);
      };
      cellEl.onpaste = pasteAsPlainText;
    } else {
      cellEl.onclick = () => {
        if (suppressClick) { suppressClick = false; return; } // that press was a long-press
        if (free) return;
        card.marks[i] = !card.marks[i];
        save();
        refresh(true);
        syncCard(cardIndex, ["marks"]);
        playClickSfx(cardIndex);
        chip(card.marks[i] ? "mark" : "unmark");
        if (card.marks[i]) replay(cellEl, "stamp");
        else cellEl.classList.remove("stamp");
      };
      cellEl.onpointerdown = e => startPress(cellEl, e);
      cellEl.onpointermove = movePress;
      cellEl.onpointerup = cellEl.onpointercancel = cellEl.onpointerleave = cancelPress;
      cellEl.oncontextmenu = e => e.preventDefault();
    }
    cellEl.onanimationend = e => { if (e.target === cellEl) cellEl.classList.remove("stamp", "sweep"); };

    cellEls.push(cellEl);
    gridEl.appendChild(cellEl);
  }

  const resetBtn = el("button", "reset");
  resetBtn.textContent = "Clear marks";
  resetBtn.onclick = () => {
    card.marks.fill(false);
    applyFreeCells(card);
    card.redeemed = {};
    save();
    syncCard(cardIndex, ["marks", "redeemed"]);
    refresh(false);
    chipNuke();
  };

  cardEl.append(nameInput, statusEl, gridEl, resetBtn);
  const stage = el("div", "stage");
  stage.append(cardEl, hubEl);
  mainEl.replaceChildren(stage);

  refresh(false);
  watchGrid(gridEl);
  if (tour) requestAnimationFrame(placeTour); // the page was rebuilt under the tour
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  save();
  render();
}
editBtn.onclick = () => setMode("edit");
playBtn.onclick = () => setMode("play");

/* ================================================================
   LIVE SYNC (Firebase Firestore)
   Each card is stored in the cloud (docs bingo/card0 and bingo/card1)
   so every device sees the same marks, rewards, texts and names live.
   Mode and the open tab stay per-device. If the network is down,
   everything keeps working from localStorage.
   ================================================================ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCuLmwH4wH-D3S5K9RS21w_W3FkCX6m98w",
  authDomain: "bingocard-b95eb.firebaseapp.com",
  projectId: "bingocard-b95eb",
  appId: "1:727397732602:web:ce9ad65da56f5d1eb5b943",
};
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.14.1";
const SYNC_KEYS = ["name", "cells", "marks", "rewards", "redeemed"];

let syncDb = null;   // Firestore instance, once connected
let syncFs = null;   // Firestore functions (doc, setDoc, onSnapshot...)
let pendingRerender = false;
const pendingKeys = [new Set(), new Set()];
const pendingTimers = [null, null];

// the fields of a card stored in the cloud (every reward key always present)
function cardPayload(card, keys) {
  const data = {};
  keys.forEach(k => {
    if (k === "redeemed" || k === "rewards") {
      data[k] = {};
      REWARDS.forEach(r => { data[k][r.id] = k === "redeemed" ? !!card.redeemed[r.id] : card.rewards[r.id] || ""; });
    } else {
      data[k] = card[k];
    }
  });
  return data;
}

// write the given fields of one card to the cloud right away
function syncCard(i, keys) {
  if (!syncDb) return;
  syncFs.setDoc(syncFs.doc(syncDb, "bingo", "card" + i), cardPayload(state.cards[i], keys), { merge: true })
    .then(() => setSyncStatus("Synced across devices"))
    .catch(err => {
      console.warn("Sync write failed:", err);
      setSyncStatus("Sync problem: saved on this device only for now");
    });
}

// same, but batched while typing (waits for a short pause)
function syncCardSoon(i, keys) {
  keys.forEach(k => pendingKeys[i].add(k));
  clearTimeout(pendingTimers[i]);
  pendingTimers[i] = setTimeout(() => {
    const batch = [...pendingKeys[i]];
    pendingKeys[i].clear();
    syncCard(i, batch);
  }, 700);
}

// don't rebuild the screen while someone is typing in it; do it once they stop
function rerenderIfSafe() {
  const focused = document.activeElement;
  pendingRerender = !!focused && mainEl.contains(focused) && (focused.isContentEditable || focused.tagName === "INPUT");
  if (!pendingRerender) render();
}
mainEl.addEventListener("focusout", () => {
  setTimeout(() => { if (pendingRerender) rerenderIfSafe(); }, 0);
});

// a card changed on another device: pull it into local state
function applyRemoteCard(i, data) {
  const card = state.cards[i];
  const signature = () => JSON.stringify([card.name, card.cells, card.marks, cardPayload(card, ["rewards", "redeemed"])]);
  const before = signature();

  if (typeof data.name === "string") card.name = data.name;
  if (renameOld(card)) syncCardSoon(i, ["name"]); // fix the cloud copy too
  if (Array.isArray(data.cells) && data.cells.length === 25) card.cells = data.cells.map(String);
  if (Array.isArray(data.marks) && data.marks.length === 25) card.marks = data.marks.map(Boolean);
  if (data.rewards) card.rewards = Object.assign(blankRewards(), data.rewards);
  if (data.redeemed) card.redeemed = Object.assign({}, data.redeemed);
  applyFreeCells(card);

  if (signature() === before) return; // just our own write coming back

  save();
  updateTabs();
  if (i === state.active) rerenderIfSafe();
  else updateHub();
}

async function initRemoteSync() {
  const firstSnaps = new Set();
  const noteFirstSnap = i => { firstSnaps.add(i); if (firstSnaps.size === 2) armMilestones(); };
  setTimeout(armMilestones, 5000); // don't wait forever if we're offline
  try {
    const [appMod, fs] = await Promise.all([
      import(FIREBASE_SDK + "/firebase-app.js"),
      import(FIREBASE_SDK + "/firebase-firestore.js"),
    ]);
    syncFs = fs;
    syncDb = fs.getFirestore(appMod.initializeApp(FIREBASE_CONFIG));
    setSyncStatus("Connecting...");

    [0, 1].forEach(i => {
      fs.onSnapshot(
        fs.doc(syncDb, "bingo", "card" + i),
        snap => {
          if (snap.metadata.hasPendingWrites) return; // our own write, not yet confirmed
          const firstTime = !firstSnaps.has(i);
          if (snap.exists()) {
            setSyncStatus("Synced across devices");
            applyRemoteCard(i, snap.data());
          } else if (!snap.metadata.fromCache) {
            // first run: put this device's copy in the cloud (never off a
            // cache-only "doesn't exist" while offline)
            syncCard(i, SYNC_KEYS);
          }
          if (firstTime) noteFirstSnap(i);
        },
        err => {
          console.warn("Sync listener failed:", err);
          setSyncStatus("Sync problem: saved on this device only for now");
          armMilestones();
        }
      );
    });
  } catch (err) {
    console.warn("Could not start sync:", err);
    setSyncStatus("Sync unavailable: saved on this device only for now");
    armMilestones();
  }
}

/* ================================================================
   REDEEM CONGRATULATIONS MODAL
   ================================================================ */
const redeemOverlay = makeOverlay(`
  <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <button class="modal-close" aria-label="Close">×</button>
    <div class="modal-emoji">🎉</div>
    <h2 id="modalTitle">Congratulations!</h2>
    <p class="modal-text"></p>
  </div>
`, hideRedeemModal);
const redeemBox = redeemOverlay.querySelector(".modal-box");
redeemOverlay.querySelector(".modal-close").onclick = hideRedeemModal;

function showRedeemModal(text) {
  redeemOverlay.querySelector(".modal-text").textContent = text;
  redeemOverlay.classList.add("show");
  replay(redeemBox, "pop");
}
function hideRedeemModal() { redeemOverlay.classList.remove("show"); }

/* ================================================================
   "HOW WAS TODAY'S DATE?" GATE (before the grand prize)
   "Bad" gets more and more skeptical of itself, then gives up and
   vanishes, leaving only "Good".
   ================================================================ */
const DATE_CHECK_BAD_TEXTS = ["Bad", "Are you sure?", "Are you really sure?", "Maybe you're mistaken?", "Last chance..."];

const dateCheckOverlay = makeOverlay(`
  <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="dateCheckTitle">
    <h2 id="dateCheckTitle">How was today's date?</h2>
    <div class="date-check-actions">
      <button class="dc-good" type="button">Good</button>
      <button class="dc-bad" type="button">Bad</button>
    </div>
  </div>
`, hideDateCheckModal);
const dateCheckBox = dateCheckOverlay.querySelector(".modal-box");
const dcBadBtn = dateCheckOverlay.querySelector(".dc-bad");
let dcBadIndex = 0;
let dcOnGood = null;

function showDateCheckModal(onGood) {
  dcOnGood = onGood;
  dcBadIndex = 0;
  dcBadBtn.textContent = DATE_CHECK_BAD_TEXTS[0];
  dcBadBtn.style.display = "";
  dateCheckOverlay.classList.add("show");
}
function hideDateCheckModal() { dateCheckOverlay.classList.remove("show"); }

dateCheckOverlay.querySelector(".dc-good").onclick = () => {
  hideDateCheckModal();
  const callback = dcOnGood;
  dcOnGood = null;
  showProposalFlow(callback);
};
dcBadBtn.onclick = () => {
  replay(dateCheckBox, "shake");
  dcBadIndex++;
  if (dcBadIndex >= DATE_CHECK_BAD_TEXTS.length) dcBadBtn.style.display = "none"; // out of excuses
  else dcBadBtn.textContent = DATE_CHECK_BAD_TEXTS[dcBadIndex];
};

/* ================================================================
   "ONE LAST QUESTION" FLOW (after "Good")
   Scenes rendered into the same modal; the last one's "Okay" hands
   off to the callback (the actual reward reveal).
   ================================================================ */
const PROPOSAL_SCENES = {
  1: `
    <h2>So, I have one question baby</h2>
    <div class="date-check-actions">
      <button class="dc-bad" data-action="removeAno" type="button">ano</button>
      <button class="dc-good" data-action="scene2" type="button">ano yun baby loves sweetie cake honey bunch?</button>
    </div>`,
  2: `
    <h2>Are you 100% sure you're single, no other kausap?</h2>
    <div class="date-check-actions">
      <button class="dc-good" data-action="scene3" type="button">1000% single baby</button>
      <button class="dc-bad" data-action="coy" type="button">Wala ka naman siguro dito kung hindi diba?</button>
    </div>`,
  3: `
    <h2>Would you allow james to experience the honor of courting You A.K.A ms Shaina Jei?</h2>
    <label class="tnc-row">
      <input type="checkbox" class="tnc-check">
      <span>I agree to the Terms &amp; Conditions</span>
    </label>
    <div class="tnc-box">
      <p>1. By checking this box, Shaina Jei acknowledges james and allows him to be her suitor/mangliligaw.</p>
      <p>2. James agrees to open doors, carry bags, laugh at jokes, and lend his hoodies anytime to Shaina Jei.</p>
      <p>3. Ms Shaina Jei has the right to ask james "saan tayo kakain?" and James will pick.</p>
      <p>4. James agrees to take initiative in making the first moves and asking the cute lady to dates and hanging out.</p>
      <p>5. But of course Shaina Jei can also tell james if she wants to go out on a date😏</p>
      <p>6. Shaina Jei can expect to regularly have company when commuting home</p>
      <p>7. Shaina Jei should expect surprises as james is very random. (Good surprises sya dw)</p>
      <p>8. Finally, James acknowledges that Shaina Jei is pursuing the med field and agrees to volunteer in order to help her (Wag lang stool)</p>
      <p>9. By reaching this far Shaina Jei undeniably shows her interest in james and agrees to be courted by him</p>
    </div>
    <div class="date-check-actions">
      <button class="dc-good tnc-yes" data-action="scene4" type="button" disabled>Yes</button>
    </div>`,
  4: `
    <h2>Looking forward to spending the rest of this year with you baby</h2>
    <div class="date-check-actions">
      <button class="dc-good" data-action="finish" type="button">Okay</button>
    </div>`,
};

const proposalOverlay = makeOverlay(`
  <div class="modal-box propose-box" role="dialog" aria-modal="true"><div></div></div>
`, hideProposalFlow);
const proposeBox = proposalOverlay.querySelector(".modal-box");
const proposeContent = proposeBox.firstElementChild;
let proposalOnFinish = null;

function showProposalFlow(onFinish) {
  proposalOnFinish = onFinish;
  renderProposalScene(1);
  proposalOverlay.classList.add("show");
  replay(proposeBox, "pop");
}
function hideProposalFlow() { proposalOverlay.classList.remove("show"); }

function renderProposalScene(n) {
  proposeBox.classList.toggle("wide", n >= 3);
  proposeContent.innerHTML = PROPOSAL_SCENES[n];
  proposeContent.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => handleProposalAction(btn, btn.dataset.action);
  });
  // scene 3: "Yes" stays disabled until the T&C box is checked, which also opens the terms
  const tncCheck = proposeContent.querySelector(".tnc-check");
  if (tncCheck) {
    tncCheck.onchange = () => {
      proposeContent.querySelector(".tnc-yes").disabled = !tncCheck.checked;
      proposeContent.querySelector(".tnc-box").classList.toggle("show", tncCheck.checked);
    };
  }
}

function handleProposalAction(btn, action) {
  if (action === "removeAno") {
    btn.remove(); // "ano" just quietly disappears
  } else if (action === "coy") {
    btn.textContent = "that's what i thought";
    btn.disabled = true;
    setTimeout(() => renderProposalScene(3), 3000);
  } else if (action === "finish") {
    hideProposalFlow();
    const callback = proposalOnFinish;
    proposalOnFinish = null;
    if (callback) callback();
  } else {
    renderProposalScene(Number(action.slice(-1))); // "scene2" -> 2, etc.
  }
}

/* ================================================================
   GUIDED TOUR + ONE-TIME HINTS
   A spotlight walks through the page the first time a device opens
   it; the ? button replays it. Hints point at something new the
   first time it happens. Both are remembered per device, not synced.
   ================================================================ */
const TOUR_KEY = "bingo-tour-v1";
const HINTS_KEY = "bingo-hints-v1";

function readLocal(key) { try { return localStorage.getItem(key); } catch { return null; } }
function writeLocal(key, value) { try { localStorage.setItem(key, value); } catch {} }
let hintsSeen = {};
try { hintsSeen = JSON.parse(readLocal(HINTS_KEY)) || {}; } catch {}

const milestoneList = () => {
  const pcts = MILESTONES.map(m => m.at + "%");
  return pcts.slice(0, -1).join(", ") + " and " + pcts[pcts.length - 1];
};

// the hub is collapsed on phones/tablets: open it so its panels can be shown
function openHub() { if (!hubOpen && hub) hub.toggle.click(); }

const TOUR_STEPS = [
  { text: () => "Hi! Welcome to Get to Know Me Bingo! Here's a quick tour, it only takes a minute.", next: "Let's go!" },
  { target: () => tabs.map(t => t.tab),
    text: () => "These are our cards! Tap " + cardName(0) + " or " + cardName(1) + " to switch. A BINGO badge shows up when a card has a finished line." },
  { target: () => mainEl.querySelector(".grid"), practice: "tap",
    text: () => "Ask the question in a box, then tap it to mark it! Tap again to undo. Try it on this practice box:" },
  { target: () => mainEl.querySelector(".grid"), practice: "hold",
    text: () => "Long question? Hold a box to read it big. Try holding the practice box:" },
  { target: () => hub.rewardsPanel, before: openHub,
    text: () => "Finish a row, column or diagonal to unlock a hidden prize. Then press Redeem to claim it!" },
  { target: () => hub.completionPanel, before: openHub,
    text: () => "Both cards count together here. Each ? hides a surprise at " + milestoneList() + "!" },
  { target: () => document.querySelector(".modes"),
    text: () => "Edit lets you change the questions and prizes. Play is for marking boxes." },
  { target: () => mainEl.querySelector(".reset"),
    text: () => "Clear marks unmarks this whole card, so be careful!" },
  { target: () => helpBtn,
    text: () => "That's it! Tap ? anytime to see this tour again. Have fun!", next: "Done" },
];

const tourEl = el("div", "tour", `
  <div class="tour-hole"></div>
  <div class="tour-bubble" role="dialog" aria-modal="true" aria-labelledby="tourText">
    <button class="tour-skip" type="button" aria-label="Close">×</button>
    <div class="tour-guide" aria-hidden="true"></div>
    <p class="tour-text" id="tourText"></p>
    <div class="tour-try"></div>
    <div class="tour-foot">
      <span class="tour-dots"></span>
      <button class="tour-back" type="button">Back</button>
      <button class="tour-next" type="button">Next</button>
    </div>
  </div>
`);
appEl.appendChild(tourEl);
const tourHole = tourEl.querySelector(".tour-hole");
const tourBubble = tourEl.querySelector(".tour-bubble");
const tourText = tourEl.querySelector(".tour-text");
const tourTry = tourEl.querySelector(".tour-try");
const tourDots = tourEl.querySelector(".tour-dots");
const tourBack = tourEl.querySelector(".tour-back");
const tourNext = tourEl.querySelector(".tour-next");

let tour = null; // { steps, i, hint } while the tour or a hint is open

tourEl.querySelector(".tour-skip").onclick = () => closeTour();
tourBack.onclick = () => showTourStep(tour.i - 1);
tourNext.onclick = () => tour.i < tour.steps.length - 1 ? showTourStep(tour.i + 1) : closeTour();

function openTour(steps, hint) {
  tour = { steps, i: 0, hint };
  tourEl.classList.toggle("hint", hint);
  tourEl.classList.add("show");
  showTourStep(0);
}

function closeTour() {
  if (!tour) return;
  tour = null;
  tourEl.classList.remove("show");
  showNextMilestone(); // anything that was held back while the tour was open
  if (!milestoneShowing) flushHints();
}

function startTour() {
  writeLocal(TOUR_KEY, "1");
  if (tour) closeTour();
  setMode("play");
  openTour(TOUR_STEPS, false);
}

const stepTargets = step => (step.target ? [].concat(step.target()) : [])
  .filter(node => node && node.getClientRects().length);

function showTourStep(i) {
  tour.i = i;
  const step = tour.steps[i];
  if (step.before) step.before();
  tourText.textContent = step.text();
  const last = i === tour.steps.length - 1;
  tourNext.textContent = step.next || (tour.hint ? "Got it!" : last ? "Done" : "Next");
  tourBack.hidden = tour.hint || i === 0;
  tourDots.replaceChildren(...(tour.hint ? [] : tour.steps.map((_, d) => el("i", d === i ? "on" : ""))));
  buildPractice(step.practice);

  const [first] = stepTargets(step);
  if (first) first.scrollIntoView({ block: "center", behavior: "instant" });
  placeTour();
  replay(tourBubble, "pop");
  tourNext.focus({ preventScroll: true });
}

// spotlight the step's target and park the bubble next to it
function placeTour() {
  if (!tour) return;
  const rects = stepTargets(tour.steps[tour.i]).map(node => node.getBoundingClientRect());
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const gap = 12;
  const bw = tourBubble.offsetWidth;
  const bh = tourBubble.offsetHeight;

  if (!rects.length) {
    tourHole.classList.add("none");
    tourBubble.style.left = (vw - bw) / 2 + "px";
    tourBubble.style.top = Math.max(gap, (vh - bh) / 2) + "px";
    return;
  }
  const pad = 6;
  const left = Math.min(...rects.map(r => r.left)) - pad;
  const top = Math.min(...rects.map(r => r.top)) - pad;
  const right = Math.max(...rects.map(r => r.right)) + pad;
  const bottom = Math.max(...rects.map(r => r.bottom)) + pad;
  tourHole.classList.remove("none");
  Object.assign(tourHole.style, { left: left + "px", top: top + "px", width: right - left + "px", height: bottom - top + "px" });

  // below the target, else above it, else pinned to the bottom of the screen over it
  let y = bottom + gap + bh <= vh ? bottom + gap
    : top - gap - bh >= 0 ? top - gap - bh
    : vh - bh - gap;
  let x = (left + right) / 2 - bw / 2;
  x = Math.max(gap, Math.min(x, vw - bw - gap));
  tourBubble.style.left = x + "px";
  tourBubble.style.top = Math.max(gap, y) + "px";
}
window.addEventListener("resize", placeTour);
window.addEventListener("scroll", placeTour, { passive: true });

// a pretend box inside the bubble, so practising never touches the real cards
function buildPractice(kind) {
  tourTry.replaceChildren();
  tourNext.disabled = false;
  if (!kind) return;

  const box = el("div", "cell tour-cell");
  box.textContent = kind === "tap" ? "Tap me!" : "Hold me!";
  const note = el("span", "tour-ok");
  tourTry.append(box, note);
  tourNext.disabled = true;
  const pass = msg => { note.textContent = msg; tourNext.disabled = false; };

  if (kind === "tap") {
    box.onclick = () => {
      const marked = box.classList.toggle("m");
      chip(marked ? "mark" : "unmark");
      if (marked) replay(box, "stamp");
      pass(marked ? "Nice! Now tap it again to undo." : "Perfect, you got it!");
    };
  } else {
    let timer = null;
    const release = () => { clearTimeout(timer); if (box.classList.contains("big")) { box.classList.remove("big"); placeTour(); } };
    box.onpointerdown = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        box.classList.add("big");
        if (navigator.vibrate) navigator.vibrate(15);
        pass("That's it! Let go to close it.");
        placeTour(); // the bubble grew
      }, PRESS_MS);
    };
    box.onpointerup = box.onpointercancel = box.onpointerleave = release;
    box.oncontextmenu = e => e.preventDefault();
    box.onclick = () => { if (tourNext.disabled) note.textContent = "Keep holding a little longer…"; };
  }
  box.onanimationend = () => box.classList.remove("stamp");
}

/* ---------- one-time hints ---------- */
const hintQueue = [];

function showHint(id, step) {
  if (hintsSeen[id]) return;
  if (tour || milestoneShowing || document.querySelector(".modal-overlay.show")) {
    if (!hintQueue.some(h => h.id === id)) hintQueue.push({ id, step });
    return;
  }
  if (step.target && !stepTargets(step).length) return; // nothing to point at right now
  hintsSeen[id] = true;
  writeLocal(HINTS_KEY, JSON.stringify(hintsSeen));
  openTour([step], true);
}

function flushHints() {
  const waiting = hintQueue.splice(0);
  waiting.forEach(h => showHint(h.id, h.step));
}

// the hub is folded away on smaller screens: point at its toggle instead
const hubFolded = () => hub && !hubOpen && hub.toggle.getClientRects().length > 0
  && getComputedStyle(hub.toggle).display !== "none";

function showRedeemHint() {
  if (state.mode !== "play") return;
  showHint("redeem", hubFolded()
    ? { target: () => hub.toggle, text: () => "You unlocked a prize! Open Rewards here, then tap Redeem to see what it is." }
    : { target: () => hub.rewardsPanel.querySelector(".redeem:not(.done)"), text: () => "You unlocked a prize! Tap Redeem to see what it is." });
}

function showMilestoneHint() {
  if (!hub) return;
  showHint("milestone", hubFolded()
    ? { target: () => hub.toggle, text: () => "Open this to see the surprises you've reached. Tap one to see its message again." }
    : { target: () => hub.dots.filter(d => d.classList.contains("clickable")).pop(), text: () => "You can tap a reached surprise anytime to see its message again." });
}

helpBtn.onclick = startTour;

/* ================================================================
   ESCAPE CLOSES ANY OPEN POPUP
   ================================================================ */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (tour) { closeTour(); return; }
  if (milestoneShowing) hideMilestone();
  hidePeek();
  hideRedeemModal();
  hideDateCheckModal();
  hideProposalFlow();
});

/* ================================================================
   START
   ================================================================ */
render();
initRemoteSync();
if (!readLocal(TOUR_KEY)) setTimeout(startTour, 600); // first visit on this device

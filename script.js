/* ================================================================
   CONTENT
   ================================================================ */
const STORAGE_KEY = "bingo-v2";

const REWARDS = [
  { id: "h",   label: "Row prize",      hint: "Finish any row",    n: 5  },
  { id: "v",   label: "Column prize",   hint: "Finish any column", n: 5  },
  { id: "d",   label: "Diagonal prize", hint: "Corner to corner",  n: 5  },
  { id: "all", label: "Blackout prize", hint: "Mark every box",    n: 25 },
];

// boxes that are permanently checked and can't be edited/unmarked
const FREE_CELLS = {
  12: "Free daw sabi ni james",
  3:  "bonus wag na to",
  21: "bonus wag na to",
};
/* ---------- ROUND 2 ----------
   Hidden until both Round 1 cards are full, then it appears in the
   sidebar. Until that moment the boxes always come from the lists below,
   so edit them here any time before the reveal. After the reveal they
   can also be changed in Edit mode like Round 1. */

// only the centre box is free
const FREE_CELLS_2 = {
  12: "FREE",
};

// the 24 Round 2 questions in reading order (the FREE box is skipped).
// Same questions on both cards. Empty ones show as a numbered box.
const SEED_QUESTIONS_2 = [
  "", "", "", "", "",
  "", "", "", "", "",
  "", "",     "", "",   // (the FREE box sits in the middle of this row)
  "", "", "", "", "",
  "", "", "", "", "",
];

// Round 2's hidden prizes: one set for James's card, one for Shai's
// (h = any row, v = any column, d = a diagonal, all = blackout)
const PRIZES_2 = [
  { h: "", v: "", d: "", all: "" }, // James's Round 2 card
  { h: "", v: "", d: "", all: "" }, // Shai's Round 2 card
];

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
  { at: 50,  emoji: "📸", photo: true, text: "HALFWAY THERE! PHOTOBOOTH TIME POOO!" },
  { at: 70,  icon: "img/spotify.svg", text: "70%! MAKE A PLAYLIST THAT REMINDS YOU OF ME AND I'LL DO THE SAME <3 [3-Songs minimum]" },
  { at: 100, icon: "img/bouquet.png", big: true, pickDate: true, text: "100%! NEXT DATE IS ON ME, YOU PICK WHEN!" },
];
// Round 2's surprises (placeholders until the real ones are written)
const MILESTONES_2 = [
  { at: 30,  round: 2, emoji: "💌", text: "ROUND 2: 30%! YOU'RE GETTING TO KNOW ME EVEN MORE <3" },
  { at: 50,  round: 2, emoji: "🌷", text: "ROUND 2: HALFWAY THERE!" },
  { at: 70,  round: 2, emoji: "✨", text: "ROUND 2: 70%! ALMOST THERE BABY" },
  { at: 100, round: 2, emoji: "💖", text: "ROUND 2: 100%! YOU KNOW ME BY HEART NOW" },
];
const MILESTONES_BY_ROUND = [MILESTONES, MILESTONES_2];

// shown once, when both Round 1 cards are full
const UNLOCK_POPUP = { emoji: "🔓", text: "ROUND 2 UNLOCKED! A WHOLE NEW CARD IS WAITING FOR US", button: "Open Round 2" };

/* ================================================================
   STATE
   ================================================================ */
const blankRewards = () => ({ h: "", v: "", d: "", all: "" });

/* Cards: 0 = Round 1 James, 1 = Round 1 Shai, 2 = Round 2 James, 3 = Round 2 Shai */
const roundOf = k => k >> 1;          // 0 = Round 1, 1 = Round 2
const personOf = k => k & 1;          // 0 = James (blue), 1 = Shai (pink)
const freeOf = k => roundOf(k) ? FREE_CELLS_2 : FREE_CELLS;

function seedCells(k) {
  const questions = (roundOf(k) ? SEED_QUESTIONS_2 : SEED_QUESTIONS)[Symbol.iterator]();
  // free slots stay blank here; applyFreeCells fills them in
  return Array.from({ length: 25 }, (_, i) => freeOf(k)[i] ? "" : (questions.next().value || ""));
}

const defaultCard = k => ({
  name: personOf(k) ? "Shai" : "James",
  cells: seedCells(k),
  marks: Array(25).fill(false),
  rewards: roundOf(k) ? Object.assign(blankRewards(), PRIZES_2[personOf(k)]) : blankRewards(),
  redeemed: {},
});

// while Round 2 is still hidden, its questions and prizes come straight
// from the code (nobody can edit them in the site yet)
function seedHiddenRound2() {
  if (state.unlocked2) return;
  [2, 3].forEach(k => {
    state.cards[k].cells = seedCells(k);
    state.cards[k].rewards = Object.assign(blankRewards(), PRIZES_2[personOf(k)]);
  });
}

let state = {
  mode: "edit",
  active: 0,
  contentVersion: CONTENT_VERSION,
  unlocked2: false,
  cards: [0, 1, 2, 3].map(defaultCard),
};

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && saved.cards && (saved.cards.length === 2 || saved.cards.length === 4)) state = saved;
} catch (e) { /* ignore corrupt storage */ }
// saves from before Round 2 existed
while (state.cards.length < 4) state.cards.push(defaultCard(state.cards.length));

// old saves still carry the placeholder names: swap them for the real ones
const OLD_NAMES = { "Team Blue": "James", "Team Pink": "Shai" };
function renameOld(card) {
  if (!OLD_NAMES[card.name]) return false;
  card.name = OLD_NAMES[card.name];
  return true;
}

function applyFreeCells(card, k) {
  const free = freeOf(k);
  for (const i in free) {
    card.cells[i] = free[i];
    card.marks[i] = true;
  }
}

// patch in anything older saves might be missing
if (!Array.isArray(state.milestones)) state.milestones = [];
if (!Array.isArray(state.milestones2)) state.milestones2 = [];
state.unlocked2 = !!state.unlocked2;
if (typeof state.nextDate !== "string") state.nextDate = ""; // the 100% date pick: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM"
state.relockWait = !!state.relockWait; // re-locked while Round 1 was full: wait for it to drop below 100% first
state.cards.forEach((card, k) => {
  renameOld(card);
  card.rewards = card.rewards || blankRewards();
  card.redeemed = card.redeemed || {};
  // a save from an older Round 1 question set: new questions, and clear
  // the marks since they wouldn't line up anymore
  if (state.contentVersion !== CONTENT_VERSION && roundOf(k) === 0) {
    card.cells = seedCells(k);
    card.marks = Array(25).fill(false);
  }
  applyFreeCells(card, k);
});
seedHiddenRound2();
state.cards.forEach(applyFreeCells);
if (roundOf(state.active) === 1 && !state.unlocked2) state.active = personOf(state.active);
state.contentVersion = CONTENT_VERSION;

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { /* storage full / unavailable */ }
}

const cardName = i => state.cards[i].name || "Card " + (i + 1);
const checkedCount = card => card.marks.filter(Boolean).length;
const activeRound = () => roundOf(state.active);
// combined completion of one round's two cards (50 boxes)
const overallPct = (r = activeRound()) => (checkedCount(state.cards[2 * r]) + checkedCount(state.cards[2 * r + 1])) / 50 * 100;
const roundOneFull = () => state.cards[0].marks.every(Boolean) && state.cards[1].marks.every(Boolean);
const milestoneKey = r => r ? "milestones2" : "milestones";

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
const stripEl = document.getElementById("strip");

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
   stylesheet size, shrink the font until it does, in three steps:
     1. shrink a little, keeping words whole, but not below
        COMFORT_FONT_PX (a hyphen beats much smaller text)
     2. still too long: allow hyphenation (relation-ship) and shrink
        again, down to READABLE_FONT_PX
     3. only if that still doesn't fit (very narrow phones): shrink
        further, down to LAST_RESORT_FONT_PX, so nothing gets cut off
   All cells are measured together, so each pass costs one layout
   instead of one per cell per step, and results are cached by
   width + text so re-renders (tab / mode switches) don't measure again.
   ================================================================ */
const COMFORT_FONT_PX = 12;
const READABLE_FONT_PX = 10.5;
const LAST_RESORT_FONT_PX = 7;
const FONT_STEP_PX = 0.5;
const fitCache = new Map();

// Hyphenation points we add ourselves (soft hyphens: invisible unless the
// line breaks there), since some browsers have no hyphenation dictionary
// and would otherwise break words anywhere ("relationshi-p"). Rough
// English syllable rules: split before a consonant that starts a new
// syllable (vaca-tion, moun-tain), never inside th/sh/ch/ph/ck/ng/qu/wh/gh,
// keep 3+ letters on each side. Only used outside Edit mode, so the
// saved questions never contain them.
const SOFT_HYPHEN = "\u00AD";
const plainText = text => text.replace(/[\u00AD\u200B]/g, "");
const isVowel = ch => /[aeiouy]/i.test(ch);
const DIGRAPH = /^(th|sh|ch|ph|ck|ng|qu|wh|gh)$/i;

function softHyphenate(text) {
  const words = text.replace(/[A-Za-z]{7,}/g, word => {
    let out = "", last = 0;
    for (let k = 3; k <= word.length - 3; k++) {
      const [prev, a, b, c, next] = [word[k - 2], word[k - 1], word[k], word[k + 1], word[k + 2]];
      const pair = b + c;
      const ok =
        (isVowel(a) && !isVowel(b) && isVowel(c)) ||                                       // vaca|tion
        (isVowel(a) && DIGRAPH.test(pair) && isVowel(next || "")) ||                        // some|thing
        (!isVowel(a) && /^(sh|ch|ph)$/i.test(pair) && isVowel(prev)) ||                     // relation|ship
        (!isVowel(a) && !isVowel(b) && isVowel(c) && isVowel(prev) && !DIGRAPH.test(a + b)); // moun|tain
      if (ok && k - last >= 2) { out += word.slice(last, k) + SOFT_HYPHEN; last = k; }
    }
    return out + word.slice(last);
  });
  return words.replace(/\//g, "/\u200B"); // birthday/ date
}

const overflows = node =>
  node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1;

// For each job ({ c, base }) find the largest size, in FONT_STEP_PX steps
// down from base, that fits but isn't below floor. Sets job.size, and
// job.fits = false when even the floor overflows.
function shrinkToFit(jobs, floor) {
  jobs.forEach(j => { j.c.style.fontSize = j.base + "px"; });
  jobs.forEach(j => { j.fits = !overflows(j.c); j.size = j.base; });
  const tooBig = jobs.filter(j => !j.fits && j.base > floor);
  tooBig.forEach(j => { j.c.style.fontSize = floor + "px"; });
  tooBig.forEach(j => { j.fits = !overflows(j.c); j.size = floor; });

  // binary search between base (overflows) and floor (fits)
  let open = tooBig.filter(j => j.fits);
  open.forEach(j => { j.lo = 1; j.hi = Math.ceil((j.base - floor) / FONT_STEP_PX); });
  const searched = open;
  while (open.length) {
    open.forEach(j => { j.mid = (j.lo + j.hi) >> 1; j.c.style.fontSize = Math.max(floor, j.base - j.mid * FONT_STEP_PX) + "px"; });
    open.forEach(j => { if (overflows(j.c)) j.lo = j.mid + 1; else j.hi = j.mid; });
    open = open.filter(j => j.lo < j.hi);
  }
  searched.forEach(j => { j.size = Math.max(floor, j.base - j.lo * FONT_STEP_PX); });
}

function fitCells(cells) {
  // measure as plain blocks so overflow is reported accurately
  // (a vertically centered flex box hides the part sticking out on top)
  cells.forEach(c => {
    c.style.fontSize = "";
    c.classList.remove("hyph");
    if (!c.isContentEditable && c.textContent !== plainText(c.textContent)) c.textContent = plainText(c.textContent);
    c.classList.add("fitting");
  });

  const jobs = cells.map(c => {
    const base = parseFloat(getComputedStyle(c).fontSize);
    return { c, base, key: c.clientWidth + "|" + base + "|" + c.isContentEditable + "|" + c.textContent };
  });
  // hyphenation mode: our own hyphen points (never while editing the text)
  const hyphenate = j => {
    j.hyph = true;
    j.c.classList.add("hyph");
    if (!j.c.isContentEditable) j.c.textContent = softHyphenate(j.c.textContent);
  };
  const todo = jobs.filter(j => {
    const hit = fitCache.get(j.key);
    if (hit) { j.size = hit.size; if (hit.hyph) hyphenate(j); }
    return !hit;
  });

  shrinkToFit(todo, COMFORT_FONT_PX);
  const long = todo.filter(j => !j.fits);
  long.forEach(hyphenate);
  shrinkToFit(long, READABLE_FONT_PX);
  shrinkToFit(long.filter(j => !j.fits), LAST_RESORT_FONT_PX);

  jobs.forEach(j => {
    fitCache.set(j.key, { size: j.size, hyph: !!j.hyph });
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
  if (!SFX_CARDS.includes(personOf(cardIndex)) || !SFX_FILES.length) return;
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
  // milestone popups: a quick rising run, then a held "ta-daa", like a level up
  reveal:   [[1047, .05], [1319, .05], [1568, .05], [2093, .05], [1568, .05], [2093, .05], [2637, .18]], // sparkly "ta-da" as Round 2 appears
  levelup:  [[392, .06], [523, .06], [659, .06], [784, .06], [1047, .06], [0, .05], [784, .07], [1047, .07], [1319, .07], [1568, .32]],
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

// over = also show above an open popup (the photo results); other toasts
// stay under popups so they never cover a popup's buttons
function showToast(title, sub, over) {
  toastEl.classList.toggle("over", !!over);
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
let milestoneCurrent = null; // the popup on screen (its button may have an action)

let milestonesReady = false; // false until the first cloud sync lands, so old progress doesn't replay
const milestoneQueue = [];
let milestoneShowing = false;

const milestoneOverlay = makeOverlay(`
  <div class="modal-box milestone-box" role="dialog" aria-modal="true" aria-labelledby="milestoneTitle">
    <button class="modal-close" aria-label="Close">×</button>
    <div class="modal-emoji"></div>
    <h2 id="milestoneTitle"></h2>
    <div class="ms-photo" hidden>
      <img alt="Our photobooth photo" hidden>
      <button class="photo-btn" type="button"></button>
      <input type="file" accept="image/*" hidden>
    </div>
    <div class="ms-date" hidden>
      <p class="ms-date-saved"></p>
      <div class="ms-date-fields">
        <label>Day<input type="date" required></label>
        <label>Time <small>(optional)</small><input type="time"></label>
      </div>
      <button class="photo-btn" type="button"></button>
    </div>
    <div class="date-check-actions"><button class="dc-good" type="button">Yiee kilig yan</button></div>
  </div>
`, hideMilestone);
const milestoneBox = milestoneOverlay.querySelector(".modal-box");
const milestoneIcon = milestoneOverlay.querySelector(".modal-emoji");
milestoneOverlay.querySelector(".modal-close").onclick = hideMilestone;
const milestoneBtn = milestoneOverlay.querySelector(".dc-good");
milestoneBtn.onclick = () => {
  if (milestoneCurrent) milestoneCurrent.pressed = true; // its main button, not × / Esc
  hideMilestone();
};

function showNextMilestone() {
  if (milestoneShowing || tour || !milestoneQueue.length) return; // waits for the tour to finish
  const m = milestoneQueue.shift();
  milestoneShowing = true;
  milestoneCurrent = m;
  milestoneBtn.textContent = m.button || "Yiee kilig yan";
  milestoneIcon.textContent = "";
  milestoneIcon.hidden = false;
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
  renderMilestonePhoto(m);
  renderMilestoneDate(m);
  milestoneOverlay.classList.add("show");
  setTimeout(() => chip("levelup"), 120); // after the tap's own blip
  replay(milestoneBox, "pop");
}

function hideMilestone() {
  const closing = milestoneCurrent;
  milestoneCurrent = null;
  if (closing && closing.onClose) closing.onClose(closing);
  milestoneOverlay.classList.remove("show");
  photoMilestone = null;
  dateMilestone = null;
  milestoneShowing = false;
  setTimeout(() => {
    showNextMilestone(); // next queued one, if several were crossed at once
    if (milestoneShowing) return;
    showMilestoneHint();
    flushHints();
  }, 250);
}

/* ---------- the photobooth photo (on milestones with photo: true) ----------
   Shrunk to a small JPEG so it fits in the Firestore database (doc
   bingo/photos), which syncs it to both phones without paid storage. */
const PHOTOS_KEY = "bingo-photos";
const PHOTO_MAX_SIDE = 1400;     // px, longest side
const PHOTO_MAX_CHARS = 450000;  // ~330 KB; a Firestore doc holds up to 1 MB
let photos = {};
try { photos = JSON.parse(localStorage.getItem(PHOTOS_KEY)) || {}; } catch {}
let photoMilestone = null; // the photo milestone whose popup is open

const photoBox = milestoneOverlay.querySelector(".ms-photo");
const photoImg = photoBox.querySelector("img");
const photoBtn = photoBox.querySelector(".photo-btn");
const photoInput = photoBox.querySelector("input");
photoBtn.onclick = () => photoInput.click();

function renderMilestonePhoto(m) {
  photoMilestone = m.photo ? m : null;
  photoBox.hidden = !m.photo;
  const src = m.photo && photos[m.at];
  milestoneIcon.hidden = !!src; // the photo takes the emoji's place
  photoImg.hidden = !src;
  if (src) photoImg.src = src;
  if (m.photo) photoBtn.textContent = src ? "Change photo" : "Add our photo 📸";
}

photoInput.onchange = async () => {
  const file = photoInput.files[0];
  photoInput.value = "";
  const m = photoMilestone;
  if (!file || !m) return;
  photoBtn.disabled = true;
  photoBtn.textContent = "Saving...";
  try {
    photos[m.at] = await shrinkPhoto(file);
    try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)); } catch {}
    syncPhoto(m.at);
  } catch (err) {
    showToast("Couldn't use that photo", "Try a different picture", true);
  }
  photoBtn.disabled = false;
  if (photoMilestone === m) renderMilestonePhoto(m);
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// resize + recompress until the JPEG is small enough to sync
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    for (let side = PHOTO_MAX_SIDE; side >= 300; side = Math.round(side * .75)) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [.82, .72, .62]) {
        const data = canvas.toDataURL("image/jpeg", quality);
        if (data.length <= PHOTO_MAX_CHARS) return data;
      }
    }
    throw new Error("photo too large");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// a photo arrived from the other phone
function applyRemotePhotos(data, live) {
  let changed = false;
  for (const key in data) {
    const at = Number(key.slice(1));
    const src = data[key];
    if (!/^p\d+$/.test(key) || typeof src !== "string" || !src.startsWith("data:image/") || photos[at] === src) continue;
    photos[at] = src;
    changed = true;
  }
  if (!changed) return;
  try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)); } catch {}
  if (photoMilestone) renderMilestonePhoto(photoMilestone);
  if (live) showToast("New photo added!", "Tap the 50% surprise to see it");
}

/* ---------- the next date (on milestones with pickDate: true) ----------
   She picks the day (and maybe a time) right in the 100% popup. Saved in
   state.nextDate and in the cloud on bingo/card0 (field nextDate), so both
   phones see it; the 100% marker on the bar re-opens it to change. */
let dateMilestone = null; // the date milestone whose popup is open
const dateBox = milestoneOverlay.querySelector(".ms-date");
const dateSaved = dateBox.querySelector(".ms-date-saved");
const dateDay = dateBox.querySelector('input[type="date"]');
const dateTime = dateBox.querySelector('input[type="time"]');
const dateBtn = dateBox.querySelector(".photo-btn");

const pad2 = n => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };

// "2026-11-21T18:30" -> "Sat, Nov 21, 2026 · 6:30 PM"
function formatNextDate(value) {
  const [day, time] = value.split("T");
  const [y, mo, d] = day.split("-").map(Number);
  let text = new Date(y, mo - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  if (time) {
    const [h, mi] = time.split(":").map(Number);
    text += " · " + ((h % 12) || 12) + ":" + pad2(mi) + (h < 12 ? " AM" : " PM");
  }
  return text;
}

function renderMilestoneDate(m) {
  dateMilestone = m.pickDate ? m : null;
  dateBox.hidden = !m.pickDate;
  if (!m.pickDate) return;
  const [day = "", time = ""] = state.nextDate.split("T");
  dateSaved.textContent = state.nextDate ? "📅 Our next date: " + formatNextDate(state.nextDate) : "When's our next date?";
  dateSaved.classList.toggle("set", !!state.nextDate);
  dateDay.min = todayISO();
  dateDay.value = day;
  dateTime.value = time;
  updateDateBtn();
}

function updateDateBtn() {
  const value = dateDay.value + (dateTime.value ? "T" + dateTime.value : "");
  dateBtn.disabled = !dateDay.value || value === state.nextDate;
  dateBtn.textContent = state.nextDate ? (value === state.nextDate ? "Date saved ✓" : "Change our date 📅") : "Save our date 📅";
}
dateDay.oninput = dateTime.oninput = updateDateBtn;

dateBtn.onclick = () => {
  if (!dateDay.value) return;
  if (dateDay.value < todayISO()) {
    showToast("That day already passed", "Pick today or a day after", true);
    replay(milestoneBox, "shake");
    return;
  }
  state.nextDate = dateDay.value + (dateTime.value ? "T" + dateTime.value : "");
  save();
  syncNextDate();
  chip("levelup");
  if (dateMilestone) renderMilestoneDate(dateMilestone);
};

function syncNextDate(quiet) {
  if (!syncDb) {
    if (!quiet) showToast("Date saved on this phone", "It will not sync while offline", true);
    return;
  }
  syncFs.setDoc(syncFs.doc(syncDb, "bingo", "card0"), { nextDate: state.nextDate }, { merge: true })
    .then(() => { if (!quiet) showToast("It's a date! 💐", formatNextDate(state.nextDate), true); })
    .catch(err => {
      console.warn("Date sync failed:", err);
      if (!quiet) showToast("Date saved on this phone only", "Couldn't send it to the other phone", true);
    });
}

// the date was picked (or changed) on the other phone
function applyRemoteDate(value, live) {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value) || value === state.nextDate) return;
  state.nextDate = value;
  save();
  if (dateMilestone) renderMilestoneDate(dateMilestone);
  if (live) showToast("Next date picked! 📅", formatNextDate(value));
}

// called whenever progress changes (checks both rounds)
function checkMilestones() {
  if (!milestonesReady) return;
  let changed = false;
  MILESTONES_BY_ROUND.forEach((list, r) => {
    const key = milestoneKey(r);
    const pct = overallPct(r);
    const before = state[key].length;
    // progress dropped back below a threshold (e.g. Clear marks): it can fire again
    state[key] = state[key].filter(t => t <= pct);
    if (state[key].length !== before) changed = true;
    list.forEach(m => {
      if (pct >= m.at && !state[key].includes(m.at)) {
        state[key].push(m.at);
        changed = true;
        if (m.text) milestoneQueue.push(m);
      }
    });
  });
  if (state.relockWait && !roundOneFull()) { state.relockWait = false; changed = true; }
  if (changed) save();
  if (!state.unlocked2 && !state.relockWait && roundOneFull()) unlockRound2(true);
  showNextMilestone();
}

// start watching once the real progress is known; whatever is already
// past counts as seen, so only genuinely new crossings pop up
function armMilestones() {
  if (milestonesReady) return;
  MILESTONES_BY_ROUND.forEach((list, r) => {
    const key = milestoneKey(r);
    list.forEach(m => {
      if (overallPct(r) >= m.at && !state[key].includes(m.at)) state[key].push(m.at);
    });
  });
  save();
  milestonesReady = true;
  checkMilestones(); // e.g. Round 1 was already full: unlock Round 2 now
}

/* ---------- Round 2 unlock (permanent once it happens) ---------- */
let revealPending = false; // unlocked, but the tabs wait for the reveal animation

function unlockRound2(celebrate) {
  if (state.unlocked2) return;
  seedHiddenRound2(); // the latest questions from the code, on both phones
  state.unlocked2 = true;
  save();
  syncUnlock();
  if (!celebrate) { updateTabs(); return; } // e.g. a phone joining later: just show it
  revealPending = true;
  milestoneQueue.push(Object.assign({}, UNLOCK_POPUP, {
    onClose: popup => revealRound2(popup.pressed),
  }));
  showNextMilestone();
}

// Edit mode's "Re-lock Round 2": hide it again on both phones so the whole
// unlock + reveal plays again the next time Round 1 reaches 100%.
// Round 2's marks and redeemed prizes are kept.
function relockRound2(fromOtherPhone) {
  if (!state.unlocked2) return;
  state.unlocked2 = false;
  revealPending = false;
  state.relockWait = roundOneFull(); // still full: don't unlock again straight away
  if (roundOf(state.active)) state.active = personOf(state.active);
  seedHiddenRound2(); // hidden again, so its text comes from the code again
  save();
  render();
  if (!fromOtherPhone && syncDb) {
    syncFs.setDoc(syncFs.doc(syncDb, "bingo", "card0"), { round2: false }, { merge: true })
      .catch(err => console.warn("Re-lock sync failed:", err));
  }
}

// the Round 2 tabs drop into the sidebar one by one; "Open Round 2" then opens it
function revealRound2(openIt) {
  if (!revealPending) return;
  revealPending = false;
  updateTabs();
  const parts = [roundOneLabel, round2Label, tabs[2].tab, tabs[3].tab];
  parts.forEach((node, i) => { node.style.setProperty("--i", i); replay(node, "reveal"); });
  setTimeout(() => chip("reveal"), 150);
  if (openIt) setTimeout(() => {
    state.active = 2 + personOf(state.active);
    state.mode = "play";
    save();
    render();
  }, 900);
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
    peekTextEl.textContent = plainText(cellEl.textContent);
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
const roundOneLabel = el("small", "round-label", "Round 1");
const round2Label = el("small", "round-label r2", "Round 2");
const tabs = state.cards.map((card, i) => {
  if (i === 0) tabsEl.appendChild(roundOneLabel);
  if (i === 2) tabsEl.appendChild(round2Label);
  const tab = el("button", "tab c" + personOf(i) + (roundOf(i) ? " r2" : ""), '<span class="t"></span><span class="badge">BINGO</span>');
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
  // Round 2 (and the round labels) stay hidden until it's unlocked and revealed
  const hidden = !state.unlocked2 || revealPending;
  [roundOneLabel, round2Label, tabs[2].tab, tabs[3].tab].forEach(node => { node.hidden = hidden; });
  tabsEl.classList.toggle("two-rounds", !hidden);
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

/* the slim progress strip under the phone header */
const strip = {
  blue: stripEl.querySelector(".sb"),
  pink: stripEl.querySelector(".sp"),
  text: stripEl.querySelector(".strip-t"),
  ticks: MILESTONES.map(m => {
    const tick = el("span", "tick");
    tick.style.left = m.at + "%";
    stripEl.querySelector(".strip-bar").appendChild(tick);
    return tick;
  }),
};
stripEl.onclick = () => {
  openHub();
  if (hub) hub.completionPanel.scrollIntoView({ block: "center", behavior: "smooth" });
};

function updateStrip(blue, pink, rawPct) {
  strip.blue.style.width = (blue / 50 * 100) + "%";
  strip.pink.style.width = (pink / 50 * 100) + "%";
  const list = MILESTONES_BY_ROUND[activeRound()];
  const next = list.find(m => m.at > rawPct);
  strip.text.textContent = (activeRound() ? "Round 2 · " : "") + Math.round(rawPct) + "%"
    + (next ? "  ·  next ? at " + next.at + "%" : "  ·  all surprises found!");
  strip.ticks.forEach((tick, k) => tick.classList.toggle("got", rawPct >= list[k].at));
}

// completion bar, milestone markers and the collapsed-hub summary
function updateHub() {
  const r = activeRound();
  const [blue, pink] = [state.cards[2 * r], state.cards[2 * r + 1]].map(checkedCount);
  const rawPct = overallPct();
  const pct = Math.round(rawPct);
  updateStrip(blue, pink, rawPct);
  if (!hub) return;

  hub.blueBar.style.width = (blue / 50 * 100) + "%";
  hub.pinkBar.style.width = (pink / 50 * 100) + "%";
  hub.pct.textContent = pct + "%";
  hub.blueLabel.textContent = cardName(2 * r) + ": " + blue + "/25";
  hub.pinkLabel.textContent = cardName(2 * r + 1) + ": " + pink + "/25";

  hub.dots.forEach((dot, i) => {
    const m = MILESTONES_BY_ROUND[r][i];
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
  `);

  const completionPanel = el("div", "panel", `
    <div class="ph"><h2>${activeRound() ? "Round 2 completion" : "Completion rate"}</h2><span class="pill"></span></div>
    <div class="bar-wrap"><div class="bar"><div class="sb"></div><div class="sp"></div></div></div>
    <div class="leg"><span class="lb"></span><span class="lp"></span></div>
    <p class="sync-note"></p>
  `);
  const barWrap = completionPanel.querySelector(".bar-wrap");

  // a marker on the bar for each milestone: "?" until it's reached
  const dots = MILESTONES_BY_ROUND[activeRound()].map(m => {
    const dot = el("span", "ms");
    if (m.round) dot.dataset.round = m.round;
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
  appEl.dataset.card = personOf(cardIndex);
  appEl.dataset.round = roundOf(cardIndex) + 1;
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
        <div class="tx"><div class="t1"></div><div class="t2"></div></div>
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
      hint: tier.querySelector(".t2"),
      bar: tier.querySelector(".pb i"),
      btn: null,
      wasUnlocked: false,
    };
    t.hint.textContent = reward.hint;

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
    statusEl.textContent = !editing && done.length ? "BINGO!" + (done.length > 1 ? " x" + done.length : "")
      : roundOf(cardIndex) ? "ROUND 2" : "";

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
      t.status.textContent = progress[reward.id] + "/" + reward.n;
      t.hint.textContent = unlocked ? reward.label : reward.hint;
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
    const free = !!freeOf(cardIndex)[i];
    cellEl.dataset.n = i + 1;
    cellEl.textContent = card.cells[i];
    if (free) cellEl.classList.add("free");
    cellEl.contentEditable = editing && !free;

    // colour along the diagonal: James goes blue (top-left) -> pink, Shai the reverse
    const diagonalShare = (Math.floor(i / 5) + i % 5) / 8;
    cellEl.style.setProperty("--p", Math.round((personOf(cardIndex) === 0 ? diagonalShare : 1 - diagonalShare) * 100) + "%");

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
        syncMark(cardIndex, i);
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
  let armTimer = null;
  const disarm = () => {
    clearTimeout(armTimer);
    resetBtn.classList.remove("armed");
    resetBtn.textContent = "Clear marks";
  };
  resetBtn.onclick = () => {
    // first tap only asks; a second tap within 3 seconds really clears
    if (!resetBtn.classList.contains("armed")) {
      resetBtn.textContent = "Tap again to clear!";
      replay(resetBtn, "armed");
      armTimer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    card.marks.fill(false);
    applyFreeCells(card, cardIndex);
    card.redeemed = {};
    save();
    syncClear(cardIndex);
    refresh(false);
    chipNuke();
  };

  // Edit mode only, once Round 2 is out: hide it again so the reveal can replay
  const relockBtn = el("button", "reset relock");
  relockBtn.textContent = "Re-lock Round 2";
  relockBtn.hidden = !state.unlocked2;
  let relockTimer = null;
  relockBtn.onclick = () => {
    if (!relockBtn.classList.contains("armed")) {
      relockBtn.textContent = "Tap again to re-lock!";
      replay(relockBtn, "armed");
      relockTimer = setTimeout(() => { relockBtn.classList.remove("armed"); relockBtn.textContent = "Re-lock Round 2"; }, 3000);
      return;
    }
    clearTimeout(relockTimer);
    relockRound2(false);
    showToast("Round 2 is hidden again 🔒", roundOneFull()
      ? "It reappears when Round 1 hits 100% again (clear or unmark a box first)"
      : "It reappears when Round 1 hits 100%");
  };

  cardEl.append(nameInput, statusEl, gridEl, resetBtn, relockBtn);
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
  if (mode === "play" && roundOf(state.active) === 1 && !state.unlocked2) state.active = personOf(state.active);
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
const CARD_COUNT = 4;
const pendingKeys = Array.from({ length: CARD_COUNT }, () => new Set());
const pendingTimers = Array(CARD_COUNT).fill(null);

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
  return syncFs.setDoc(syncFs.doc(syncDb, "bingo", "card" + i), cardPayload(state.cards[i], keys), { merge: true })
    .then(() => setSyncStatus("Synced across devices"))
    .catch(err => {
      console.warn("Sync write failed:", err);
      setSyncStatus("Sync problem: saved on this device only for now");
    });
}

function syncPhoto(at) {
  if (!syncDb) { showToast("Photo saved on this phone", "It will not sync while offline", true); return; }
  syncFs.setDoc(syncFs.doc(syncDb, "bingo", "photos"), { ["p" + at]: photos[at] }, { merge: true })
    .then(() => showToast("Photo saved!", "Both phones can see it now", true))
    .catch(err => {
      console.warn("Photo sync failed:", err);
      showToast("Photo saved on this phone only", "Couldn't send it to the other phone", true);
    });
}

// One box was tapped: change just that box on the server, inside a
// transaction (read the latest marks, flip one, write back). Sending the
// whole marks list instead would let two phones tapping at the same
// moment undo each other's tap. Taps on a card are sent in order.
const markChain = Array.from({ length: CARD_COUNT }, () => Promise.resolve());
// taps the server hasn't confirmed yet: box -> { marked, sending }
// (sending counts the taps on that box still on their way)
const pendingMarks = Array.from({ length: CARD_COUNT }, () => new Map());

function syncMark(i, box) {
  if (!syncDb) return;
  const value = state.cards[i].marks[box];
  const pending = pendingMarks[i].get(box) || { sending: 0 };
  pending.marked = value;
  pending.sending++;
  pendingMarks[i].set(box, pending);
  const ref = syncFs.doc(syncDb, "bingo", "card" + i);
  markChain[i] = markChain[i]
    .then(() => syncFs.runTransaction(syncDb, async tx => {
      const snap = await tx.get(ref);
      const remote = snap.exists() ? snap.data().marks : null;
      const marks = Array.isArray(remote) && remote.length === 25 ? remote.map(Boolean) : state.cards[i].marks.slice();
      marks[box] = value;
      tx.set(ref, { marks }, { merge: true });
    }))
    .then(() => setSyncStatus("Synced across devices"))
    // transactions need a connection: offline, fall back to a normal
    // write, which Firestore queues and sends once back online
    .catch(err => { console.warn("Mark sync failed, sending the whole card:", err); return syncCard(i, ["marks"]); })
    .finally(() => {
      // only let go of the box once its last tap has been sent
      if (--pending.sending === 0 && pendingMarks[i].get(box) === pending) pendingMarks[i].delete(box);
    });
}

// Round 2 unlocked here: tell the other phone (kept on the Round 1 James doc)
function syncUnlock() {
  if (!syncDb) return;
  syncFs.setDoc(syncFs.doc(syncDb, "bingo", "card0"), { round2: true }, { merge: true })
    .catch(err => console.warn("Unlock sync failed:", err));
  syncCard(2, ["cells", "rewards"]);
  syncCard(3, ["cells", "rewards"]);
}

// Clear marks: replaces the whole list on purpose, after any taps still on their way
function syncClear(i) {
  pendingMarks[i].clear();
  markChain[i] = markChain[i].then(() => syncCard(i, ["marks", "redeemed"]));
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
function applyRemoteCard(i, data, live) {
  const card = state.cards[i];
  const oldMarks = card.marks.slice();
  const oldRedeemed = Object.assign({}, card.redeemed);
  const signature = () => JSON.stringify([card.name, card.cells, card.marks, cardPayload(card, ["rewards", "redeemed"])]);
  const before = signature();

  // fields typed here but not sent yet (syncCardSoon waits for a pause)
  // keep the local text, or an update from the other phone would wipe it
  const mine = k => pendingKeys[i].has(k);
  if (typeof data.name === "string" && !mine("name")) card.name = data.name;
  if (renameOld(card)) syncCardSoon(i, ["name"]); // fix the cloud copy too
  const hiddenRound = roundOf(i) === 1 && !state.unlocked2; // its text comes from the code until the reveal
  if (Array.isArray(data.cells) && data.cells.length === 25 && !mine("cells") && !hiddenRound) card.cells = data.cells.map(String);
  if (Array.isArray(data.marks) && data.marks.length === 25) {
    card.marks = data.marks.map(Boolean);
    pendingMarks[i].forEach((pending, box) => { card.marks[box] = pending.marked; }); // our taps still on their way
  }
  if (data.rewards && !mine("rewards") && !hiddenRound) card.rewards = Object.assign(blankRewards(), data.rewards);
  if (data.redeemed) card.redeemed = Object.assign({}, data.redeemed);
  applyFreeCells(card, i);
  // the other phone unlocked Round 2. If our copy of Round 1 isn't full yet,
  // its last marks are still on their way: give them a moment so the 100%
  // popup shows before the unlock one (checkMilestones unlocks as they land)
  if (i === 0 && typeof data.nextDate === "string") applyRemoteDate(data.nextDate, live);
  // picked while offline: send it up once the cloud copy is known
  else if (i === 0 && !live && data.nextDate === undefined && state.nextDate) syncNextDate(true);
  if (data.round2 === false && state.unlocked2) relockRound2(true); // re-locked on the other phone
  if (data.round2 === true && !state.unlocked2) {
    if (!live || roundOneFull()) unlockRound2(live);
    else setTimeout(() => unlockRound2(true), 2500);
  }

  if (signature() === before) return; // just our own write coming back

  save();
  updateTabs();
  if (i === state.active) rerenderIfSafe();
  else updateHub();
  if (live) announceRemote(i, oldMarks, oldRedeemed);
}

// a toast saying what changed on the other phone (marks and redeems)
function announceRemote(i, oldMarks, oldRedeemed) {
  const card = state.cards[i];
  const owner = cardName(i) + "'s " + (roundOf(i) ? "Round 2 card" : "card");
  const free = freeOf(i);
  const changed = card.marks.flatMap((m, ci) => m !== oldMarks[ci] && !free[ci] ? [ci] : []);
  const marked = changed.filter(ci => card.marks[ci]);
  const unmarked = changed.filter(ci => !card.marks[ci]);
  const redeemed = REWARDS.filter(r => card.redeemed[r.id] && !oldRedeemed[r.id]);
  const question = ci => card.cells[ci] || "Box " + (ci + 1);

  let title = "", sub = "";
  if (redeemed.length) {
    title = "Prize redeemed!";
    sub = owner + ": " + redeemed.map(r => card.rewards[r.id] || r.label).join(", ");
  } else if (unmarked.length > 1 && !marked.length && card.marks.every((m, ci) => !m || free[ci])) {
    title = owner + " was cleared";
  } else if (marked.length === 1 && !unmarked.length) {
    title = "Marked on " + owner;
    sub = question(marked[0]);
  } else if (unmarked.length === 1 && !marked.length) {
    title = "Unmarked on " + owner;
    sub = question(unmarked[0]);
  } else if (changed.length) {
    title = owner + " updated";
    sub = marked.length + " marked, " + unmarked.length + " unmarked";
  }
  if (!title) return;
  showToast(title, sub);

  // press the newly marked boxes in, if that card is on screen
  if (i === state.active) requestAnimationFrame(() => {
    const cells = mainEl.querySelectorAll(".grid .cell");
    marked.forEach(ci => { if (cells[ci]) replay(cells[ci], "stamp"); });
  });
}

async function initRemoteSync() {
  const firstSnaps = new Set();
  const noteFirstSnap = i => { firstSnaps.add(i); if (firstSnaps.size === CARD_COUNT) armMilestones(); };
  setTimeout(armMilestones, 5000); // don't wait forever if we're offline
  try {
    const [appMod, fs] = await Promise.all([
      import(FIREBASE_SDK + "/firebase-app.js"),
      import(FIREBASE_SDK + "/firebase-firestore.js"),
    ]);
    syncFs = fs;
    syncDb = fs.getFirestore(appMod.initializeApp(FIREBASE_CONFIG));
    setSyncStatus("Connecting...");

    let firstPhotos = true;
    fs.onSnapshot(
      fs.doc(syncDb, "bingo", "photos"),
      snap => {
        if (!snap.metadata.hasPendingWrites && snap.exists()) applyRemotePhotos(snap.data(), !firstPhotos);
        firstPhotos = false;
      },
      err => console.warn("Photo listener failed:", err)
    );

    [0, 1, 2, 3].forEach(i => {
      fs.onSnapshot(
        fs.doc(syncDb, "bingo", "card" + i),
        snap => {
          if (snap.metadata.hasPendingWrites) return; // our own write, not yet confirmed
          const firstTime = !firstSnaps.has(i);
          if (snap.exists()) {
            setSyncStatus("Synced across devices");
            applyRemoteCard(i, snap.data(), !firstTime);
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
    text: () => "These are our cards! Tap " + cardName(0) + " or " + cardName(1) + " to switch. A BINGO badge shows up when a card has a finished line."
 },
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
    text: () => "Clear marks unmarks this whole card. You have to tap it twice, just to be safe!" },
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

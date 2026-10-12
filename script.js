/* ================================================================
   STATE
   ================================================================ */
   const STORAGE_KEY = "bingo-v2";

   const REWARDS = [
     { id: "h",   label: "One horizontal line", hint: "Complete any full row",       n: 5  },
     { id: "v",   label: "One vertical line",   hint: "Complete any full column",    n: 5  },
     { id: "d",   label: "One diagonal line",   hint: "Corner to opposite corner",   n: 5  },
     { id: "all", label: "Full card blackout",  hint: "Check every box",             n: 25 },
   ];
   
   // boxes that are permanently checked and can't be edited/unmarked
   const FREE_CELLS = {
     12: "Free daw sabi ni james",
     3:  "bonus wag na to",
     21: "bonus wag na to",
   };
   
   const blankRewards = () => ({ h: "", v: "", d: "", all: "" });
   
   // the 22 non-free boxes, in reading order (left-to-right, top-to-bottom,
   // skipping the 3 FREE_CELLS slots). Same questions on both cards since
   // it's a mutual icebreaker — each person checks off what they learn.
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
   
   // bump this whenever SEED_QUESTIONS changes, so saved progress from an
   // older question set doesn't hide the new content on next load
   const CONTENT_VERSION = 1;
   
   function seedCells() {
     const cells = Array(25).fill("");
     let qi = 0;
     for (let i = 0; i < 25; i++) {
       if (FREE_CELLS[i]) continue; // left blank here; applyFreeCells fills it in
       cells[i] = SEED_QUESTIONS[qi] || "";
       qi++;
     }
     return cells;
   }
   
   const defaultCard = (isPink) => ({
     name: isPink ? "Team Pink" : "Team Blue",
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
   
   // load saved state, patching in any fields older saves might be missing
   try {
     const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
     if (saved && saved.cards && saved.cards.length === 2) state = saved;
   } catch (e) { /* ignore corrupt storage */ }
   
   state.cards.forEach(c => {
     if (!c.rewards) c.rewards = blankRewards();
     if (!c.redeemed) c.redeemed = {};
   });
   
   // if this save predates the current question set, refill the box text with
   // the new questions (keeping names/rewards/mode) and clear marks, since old
   // checkmarks wouldn't line up with the new questions anyway
   if (state.contentVersion !== CONTENT_VERSION) {
     state.cards.forEach(c => {
       c.cells = seedCells();
       c.marks = Array(25).fill(false);
     });
     state.contentVersion = CONTENT_VERSION;
   }
   
   function applyFreeCells(card) {
     Object.keys(FREE_CELLS).forEach(i => {
       card.cells[i] = FREE_CELLS[i];
       card.marks[i] = true;
     });
   }
   state.cards.forEach(applyFreeCells);
   
   function save() {
     try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
     catch (e) { /* storage full / unavailable */ }
   }
   
   /* ================================================================
      BINGO LINE HELPERS
      ================================================================ */
   const ROWS = [];
   const COLS = [];
   for (let i = 0; i < 5; i++) {
     ROWS.push([0, 1, 2, 3, 4].map(j => i * 5 + j));
     COLS.push([0, 1, 2, 3, 4].map(j => j * 5 + i));
   }
   const DIAGS = [[0, 6, 12, 18, 24], [4, 8, 12, 16, 20]];
   const ALL_LINES = ROWS.concat(COLS, DIAGS);
   
   // which cells are part of a completed line, and how many lines are complete
   function winningCells(marks) {
     const won = new Set();
     let count = 0;
     ALL_LINES.forEach(line => {
       if (line.every(i => marks[i])) {
         count++;
         line.forEach(i => won.add(i));
       }
     });
     return { won, count };
   }
   
   // best progress toward each reward type (most-checked row / column / diagonal, total checked)
   function rewardProgress(marks) {
     const best = lines => Math.max(...lines.map(line => line.filter(i => marks[i]).length));
     return {
       h: best(ROWS),
       v: best(COLS),
       d: best(DIAGS),
       all: marks.filter(Boolean).length,
     };
   }
   
   /* ================================================================
      SIDEBAR TABS
      ================================================================ */
   const tabsEl = document.getElementById("tabs");
   const mainEl = document.getElementById("main");
   const appEl = document.getElementById("app");
   
   let tabEls = [];
   let badgeEls = [];
   let labelEls = [];
   let synergyRefs = null; // set each render(); synced by updateSynergy()
   
   function buildTabs() {
     tabsEl.innerHTML = "";
     tabEls = [];
     badgeEls = [];
     labelEls = [];
   
     state.cards.forEach((card, i) => {
       const tab = document.createElement("button");
       tab.className = "tab c" + i;
   
       const label = document.createElement("span");
       label.className = "t";
       label.textContent = card.name || "Card " + (i + 1);
   
       const badge = document.createElement("span");
       badge.className = "badge";
       badge.textContent = "BINGO";
   
       tab.append(label, badge);
       tab.onclick = () => { state.active = i; save(); render(); };
   
       tabsEl.appendChild(tab);
       tabEls.push(tab);
       badgeEls.push(badge);
       labelEls.push(label);
     });
   }
   
   function updateBingoBadges() {
     state.cards.forEach((card, i) => {
       badgeEls[i].classList.toggle("show", winningCells(card.marks).count > 0);
     });
   }
   
   function updateSynergy() {
     if (!synergyRefs) return;
     const [blueChecked, pinkChecked] = state.cards.map(c => c.marks.filter(Boolean).length);
   
     synergyRefs.blueBar.style.width = (blueChecked / 50 * 100) + "%";
     synergyRefs.pinkBar.style.width = (pinkChecked / 50 * 100) + "%";
     synergyRefs.pct.textContent = Math.round((blueChecked + pinkChecked) / 50 * 100) + "% checked";
     synergyRefs.blueLabel.textContent = (state.cards[0].name || "Card 1") + ": " + blueChecked + "/25";
     synergyRefs.pinkLabel.textContent = (state.cards[1].name || "Card 2") + ": " + pinkChecked + "/25";
   }
   
   // force-paste as plain text in any contenteditable element
   const pasteAsPlainText = e => {
     e.preventDefault();
     document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
   };
   
   /* ================================================================
      MAIN RENDER
      ================================================================ */
   function render() {
     document.getElementById("bEdit").classList.toggle("on", state.mode === "edit");
     document.getElementById("bPlay").classList.toggle("on", state.mode === "play");
     tabEls.forEach((tab, i) => tab.classList.toggle("on", i === state.active));
     appEl.dataset.card = state.active;
   
     const card = state.cards[state.active];
     const cardIndex = state.active;
     const editing = state.mode === "edit";
   
     mainEl.innerHTML = "";
     const stage = document.createElement("div");
     stage.className = "stage";
   
     /* ---------- bingo card ---------- */
     const cardEl = document.createElement("div");
     cardEl.className = "card " + state.mode;
   
     const nameInput = document.createElement("input");
     nameInput.className = "name";
     nameInput.value = card.name;
     nameInput.setAttribute("aria-label", "Card name");
     nameInput.oninput = () => {
       card.name = nameInput.value;
       labelEls[cardIndex].textContent = card.name || "Card " + (cardIndex + 1);
       updateSynergy();
       save();
     };
   
     const statusEl = document.createElement("div");
     statusEl.className = "status";
   
     const gridEl = document.createElement("div");
     gridEl.className = "grid";
   
     const cellEls = [];
   
     /* ---------- rewards hub (right column) ---------- */
     const hubEl = document.createElement("div");
     hubEl.className = "hub";
   
     const rewardsPanel = document.createElement("div");
     rewardsPanel.className = "panel";
     rewardsPanel.innerHTML = `
       <div class="ph">
         <h2>Rewards Hub</h2>
         <span class="pill" id="unlockedCount"></span>
       </div>
       <p class="sub">Hidden prizes unlocked by completed lines</p>
     `;
   
     const tierRefs = {};
     REWARDS.forEach(reward => {
       const tierEl = document.createElement("div");
       tierEl.className = "tier";
       tierEl.innerHTML = `
         <div class="top">
           <span class="lab"></span>
           <span class="st"></span>
         </div>
         <div class="body">
           <div class="ico"></div>
           <div class="tx">
             <div class="t1"></div>
             <div class="t2"></div>
           </div>
         </div>
         <div class="pb"><i></i></div>
       `;
   
       const refs = {
         tier: tierEl,
         statusText: tierEl.querySelector(".st"),
         icon: tierEl.querySelector(".ico"),
         title: tierEl.querySelector(".t1"),
         hint: tierEl.querySelector(".t2"),
         progressBar: tierEl.querySelector(".pb i"),
         redeemBtn: null,
         wasUnlocked: false,
       };
   
       if (editing) tierEl.querySelector(".pb").style.display = "none";
   
       tierEl.querySelector(".lab").textContent = reward.label;
       refs.hint.textContent = reward.hint;
   
       if (editing) {
         refs.title.contentEditable = true;
         refs.title.dataset.ph = "Type the hidden reward…";
         refs.title.textContent = card.rewards[reward.id];
         refs.title.oninput = () => { card.rewards[reward.id] = refs.title.textContent; save(); };
         refs.title.onpaste = pasteAsPlainText;
       }
   
       rewardsPanel.appendChild(tierEl);
       tierRefs[reward.id] = refs;
     });
   
     const synergyPanel = document.createElement("div");
     synergyPanel.className = "panel";
     synergyPanel.innerHTML = `
       <div class="ph">
         <h2>Match Synergy</h2>
         <span class="pill" id="synergyPct"></span>
       </div>
       <div class="bar">
         <div class="sb"></div>
         <div class="sp"></div>
       </div>
       <div class="leg">
         <span class="lb"></span>
         <span class="lp"></span>
       </div>
     `;
   
     synergyRefs = {
       blueBar: synergyPanel.querySelector(".sb"),
       pinkBar: synergyPanel.querySelector(".sp"),
       pct: synergyPanel.querySelector("#synergyPct"),
       blueLabel: synergyPanel.querySelector(".lb"),
       pinkLabel: synergyPanel.querySelector(".lp"),
     };
   
     hubEl.append(rewardsPanel, synergyPanel);
     const unlockedCountEl = rewardsPanel.querySelector("#unlockedCount");
   
     /* ---------- refresh: recompute marks / lines / rewards ---------- */
     const refresh = (animate) => {
       const { won, count } = winningCells(card.marks);
       cellEls.forEach((el, i) => {
         el.classList.toggle("m", card.marks[i]);
         el.classList.toggle("w", won.has(i));
       });
       statusEl.textContent = count ? ("BINGO!" + (count > 1 ? " x" + count : "")) : "";
   
       const progress = rewardProgress(card.marks);
       let unlockedCount = 0;
   
       REWARDS.forEach(reward => {
         const refs = tierRefs[reward.id];
         const unlocked = progress[reward.id] >= reward.n;
         if (unlocked) unlockedCount++;
   
         if (editing) { refs.statusText.textContent = ""; return; }
   
         refs.tier.classList.toggle("got", unlocked);
         refs.progressBar.style.width = Math.min(100, progress[reward.id] / reward.n * 100) + "%";
         refs.statusText.textContent = unlocked
           ? "UNLOCKED"
           : progress[reward.id] + "/" + reward.n + " boxes";
         const redeemed = !!card.redeemed[reward.id];
         refs.title.textContent = !unlocked
           ? "Hidden reward"
           : redeemed
             ? (card.rewards[reward.id] || "Unlocked!")
             : "Click to redeem";
   
         if (refs.redeemBtn) { refs.redeemBtn.remove(); refs.redeemBtn = null; }
   
         if (unlocked) {
           const btn = document.createElement("button");
           btn.className = "redeem" + (card.redeemed[reward.id] ? " done" : "");
           btn.textContent = card.redeemed[reward.id] ? "Redeemed ✓" : "Redeem";
           btn.onclick = () => {
             const willRedeem = !card.redeemed[reward.id];
   
             // the grand-prize reward on the PINK card (index 1) gets the cheeky
             // date-check + proposal gate; the blue card redeems like any other tier
             if (reward.id === "all" && willRedeem && cardIndex === 1) {
               showDateCheckModal(() => {
                 card.redeemed[reward.id] = true;
                 save();
                 refresh(false);
                 showRedeemModal(card.rewards[reward.id] || "Unlocked!");
               });
               return;
             }
   
             card.redeemed[reward.id] = willRedeem;
             save();
             refresh(false);
             if (willRedeem) {
               showRedeemModal(card.rewards[reward.id] || "Unlocked!");
             }
           };
           refs.tier.appendChild(btn);
           refs.redeemBtn = btn;
   
           if (!refs.wasUnlocked && animate) {
             refs.tier.classList.remove("pop");
             void refs.tier.offsetWidth; // restart animation
             refs.tier.classList.add("pop");
           }
         }
         refs.wasUnlocked = unlocked;
       });
   
       unlockedCountEl.textContent = editing ? "editing" : unlockedCount + " unlocked";
       updateBingoBadges();
       updateSynergy();
     };
   
     /* ---------- 25 grid cells ---------- */
     for (let i = 0; i < 25; i++) {
       const cellEl = document.createElement("div");
       cellEl.className = "cell";
       cellEl.dataset.n = i + 1;
   
       // diagonal position: 0 (top-left) .. 8 (bottom-right)
       const diagonalPos = Math.floor(i / 5) + (i % 5);
       // Team Blue (card 0) is reversed: blue top-left -> pink bottom-right
       const pinkShare = cardIndex === 0
         ? Math.round((diagonalPos / 8) * 100)
         : Math.round(100 - (diagonalPos / 8) * 100);
       cellEl.style.setProperty("--p", pinkShare + "%");
   
       // in play mode, wrap non-empty text in a clamped span so a long question
       // truncates cleanly instead of overflowing the square cell; edit mode
       // stays plain text so typing/caret behavior works as expected
       if (!editing && card.cells[i]) {
         cellEl.textContent = "";
         const txtEl = document.createElement("span");
         txtEl.className = "txt";
         txtEl.textContent = card.cells[i];
         cellEl.appendChild(txtEl);
       } else {
         cellEl.textContent = card.cells[i];
       }
       if (FREE_CELLS[i]) cellEl.classList.add("free");
       cellEl.contentEditable = editing && !FREE_CELLS[i];
   
       cellEl.oninput = () => { card.cells[i] = cellEl.textContent; save(); };
   
       cellEl.onclick = () => {
         if (state.mode !== "play" || FREE_CELLS[i]) return;
         card.marks[i] = !card.marks[i];
         save();
         refresh(true);
         cellEl.classList.remove("stamp");
         if (card.marks[i]) {
           void cellEl.offsetWidth; // restart animation
           cellEl.classList.add("stamp");
         }
       };
       cellEl.onanimationend = e => { if (e.target === cellEl) cellEl.classList.remove("stamp"); };
       cellEl.onpaste = pasteAsPlainText;
   
       cellEls.push(cellEl);
       gridEl.appendChild(cellEl);
     }
   
     const resetBtn = document.createElement("button");
     resetBtn.className = "reset";
     resetBtn.textContent = "Clear marks";
     resetBtn.onclick = () => {
       card.marks.fill(false);
       applyFreeCells(card);
       card.redeemed = {};
       save();
       refresh(false);
     };
   
     cardEl.append(nameInput, statusEl, gridEl, resetBtn);
     stage.append(cardEl, hubEl);
     mainEl.appendChild(stage);
   
     refresh(false);
   }
   
   document.getElementById("bEdit").onclick = () => { state.mode = "edit"; save(); render(); };
   document.getElementById("bPlay").onclick = () => { state.mode = "play"; save(); render(); };
   
   buildTabs();
   render();
   
   /* ================================================================
      REDEEM CONGRATULATIONS MODAL
      ================================================================ */
   const modalOverlay = document.createElement("div");
   modalOverlay.className = "modal-overlay";
   modalOverlay.innerHTML = `
     <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
       <button class="modal-close" aria-label="Close">×</button>
       <div class="modal-emoji">🎉</div>
       <h2 id="modalTitle">Congratulations!</h2>
       <p class="modal-text"></p>
     </div>
   `;
   appEl.appendChild(modalOverlay);
   
   const modalTextEl = modalOverlay.querySelector(".modal-text");
   const modalBoxEl = modalOverlay.querySelector(".modal-box");
   
   function showRedeemModal(text) {
     modalTextEl.textContent = text;
     modalOverlay.classList.add("show");
     modalBoxEl.classList.remove("pop");
     void modalBoxEl.offsetWidth; // restart animation
     modalBoxEl.classList.add("pop");
   }
   
   function hideRedeemModal() {
     modalOverlay.classList.remove("show");
   }
   
   modalOverlay.querySelector(".modal-close").onclick = hideRedeemModal;
   modalOverlay.onclick = e => { if (e.target === modalOverlay) hideRedeemModal(); };
   document.addEventListener("keydown", e => { if (e.key === "Escape") hideRedeemModal(); });
   
   /* ================================================================
      "HOW WAS TODAY'S DATE?" GATE — shown before the grand-prize reward.
      Clicking "Bad" just makes the button more and more skeptical of
      itself; after enough tries it gives up and vanishes, leaving only
      "Good" to click.
      ================================================================ */
   const DATE_CHECK_BAD_TEXTS = [
     "Bad",
     "Are you sure?",
     "Are you really sure?",
     "Maybe you're mistaken?",
     "Last chance...",
   ];
   
   const dateCheckOverlay = document.createElement("div");
   dateCheckOverlay.className = "modal-overlay";
   dateCheckOverlay.innerHTML = `
     <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="dateCheckTitle">
       <h2 id="dateCheckTitle">How was today's date?</h2>
       <div class="date-check-actions">
         <button class="dc-good" type="button">Good</button>
         <button class="dc-bad" type="button">Bad</button>
       </div>
     </div>
   `;
   appEl.appendChild(dateCheckOverlay);
   
   const dateCheckBoxEl = dateCheckOverlay.querySelector(".modal-box");
   const dcGoodBtn = dateCheckOverlay.querySelector(".dc-good");
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
   
   function hideDateCheckModal() {
     dateCheckOverlay.classList.remove("show");
   }
   
   dcGoodBtn.onclick = () => {
     hideDateCheckModal();
     const callback = dcOnGood;
     dcOnGood = null;
     showProposalFlow(callback); // leads into the "one last question" sequence below
   };
   
   dcBadBtn.onclick = () => {
     dateCheckBoxEl.classList.remove("shake");
     void dateCheckBoxEl.offsetWidth; // restart animation
     dateCheckBoxEl.classList.add("shake");
   
     dcBadIndex++;
     if (dcBadIndex >= DATE_CHECK_BAD_TEXTS.length) {
       dcBadBtn.style.display = "none"; // out of excuses — only "Good" is left
     } else {
       dcBadBtn.textContent = DATE_CHECK_BAD_TEXTS[dcBadIndex];
     }
   };
   
   dateCheckOverlay.onclick = e => { if (e.target === dateCheckOverlay) hideDateCheckModal(); };
   document.addEventListener("keydown", e => { if (e.key === "Escape") hideDateCheckModal(); });
   
   /* ================================================================
      "ONE LAST QUESTION" PROPOSAL FLOW — runs after "Good" is clicked.
      Three scenes, each rendered into the same modal box. The final
      scene's "Yes" grid hands off to whatever callback was passed into
      showProposalFlow() (the actual reward reveal).
      ================================================================ */
   const proposalOverlay = document.createElement("div");
   proposalOverlay.className = "modal-overlay";
   proposalOverlay.innerHTML = `
     <div class="modal-box propose-box" role="dialog" aria-modal="true">
       <div id="proposeContent"></div>
     </div>
   `;
   appEl.appendChild(proposalOverlay);
   
   const proposeBoxEl = proposalOverlay.querySelector(".modal-box");
   const proposeContentEl = proposalOverlay.querySelector("#proposeContent");
   
   let proposalOnFinish = null;
   
   function showProposalFlow(onFinish) {
     proposalOnFinish = onFinish;
     renderProposalScene(1);
     proposalOverlay.classList.add("show");
     proposeBoxEl.classList.remove("pop");
     void proposeBoxEl.offsetWidth; // restart animation
     proposeBoxEl.classList.add("pop");
   }
   
   function hideProposalFlow() {
     proposalOverlay.classList.remove("show");
   }
   
   function renderProposalScene(n) {
     proposeBoxEl.classList.toggle("wide", n === 3 || n === 4);
   
     if (n === 1) {
       proposeContentEl.innerHTML = `
         <h2>So, I have one last question baby</h2>
         <div class="date-check-actions">
           <button class="dc-bad" data-action="removeAno" type="button">ano</button>
           <button class="dc-good" data-action="scene2" type="button">ano yun baby?</button>
         </div>
       `;
     } else if (n === 2) {
       proposeContentEl.innerHTML = `
         <h2>Are you 100% sure you're single?</h2>
         <div class="date-check-actions">
           <button class="dc-good" data-action="scene3" type="button">1000% single baby</button>
           <button class="dc-bad" data-action="coy" type="button">Wala ka naman siguro dito kung hindi diba?</button>
         </div>
       `;
     } else if (n === 3) {
       proposeContentEl.innerHTML = `
         <h2>Would you allow james to experience the honor of courting You A.K.A ms Shaina Jei?</h2>
         <label class="tnc-row">
           <input type="checkbox" class="tnc-check">
           <span>Placeholder</span>
         </label>
         <div class="tnc-box">
           <p>Terms and Conditions placeholder for now.</p>
         </div>
         <div class="date-check-actions">
           <button class="dc-good tnc-yes" data-action="scene4" type="button" disabled>Yes</button>
         </div>
       `;
     } else if (n === 4) {
       proposeContentEl.innerHTML = `
         <h2>Looking forward to spending the rest of this year with you baby</h2>
         <div class="date-check-actions">
           <button class="dc-good" data-action="finish" type="button">Okay</button>
         </div>
       `;
     }
   
     proposeContentEl.querySelectorAll("button").forEach(btn => {
       btn.onclick = () => handleProposalAction(btn, btn.dataset.action);
     });
   
     // scene 3 only: the "Yes" button stays disabled until the T&C box is
     // checked, and checking it opens a scrollable terms panel
     const tncCheck = proposeContentEl.querySelector(".tnc-check");
     const tncYesBtn = proposeContentEl.querySelector(".tnc-yes");
     const tncBox = proposeContentEl.querySelector(".tnc-box");
     if (tncCheck && tncYesBtn) {
       tncCheck.onchange = () => {
         tncYesBtn.disabled = !tncCheck.checked;
         if (tncBox) tncBox.classList.toggle("show", tncCheck.checked);
       };
     }
   }
   
   function handleProposalAction(btn, action) {
     if (action === "removeAno") {
       btn.remove(); // "ano" just quietly disappears, leaving only "ano yun baby?"
     } else if (action === "scene2") {
       renderProposalScene(2);
     } else if (action === "scene3") {
       renderProposalScene(3);
     } else if (action === "coy") {
       btn.textContent = "that's what i thought";
       btn.disabled = true;
       setTimeout(() => renderProposalScene(3), 3000);
     } else if (action === "scene4") {
       renderProposalScene(4);
     } else if (action === "finish") {
       hideProposalFlow();
       const callback = proposalOnFinish;
       proposalOnFinish = null;
       if (callback) callback();
     }
   }
   
   proposalOverlay.onclick = e => { if (e.target === proposalOverlay) hideProposalFlow(); };
   document.addEventListener("keydown", e => { if (e.key === "Escape") hideProposalFlow(); });
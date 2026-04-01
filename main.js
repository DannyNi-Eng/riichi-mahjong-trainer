// main.js (bilingual)
// 13 tiles -> auto draw 1 on the far right -> hover + left click to discard
// Compare: shanten first, then ukeire
// Tooltip shows English tile code (1m/2p/3s/East...)

import {
  shuffle, buildDeck136, tilesToCounts, sortTiles,
  tileIdToStr, formatHandText, uniqTileIdsFromCounts
} from "./utils.js";

import { shantenNormal, isAgariNormal } from "./shanten.js";

const handTextEl = document.getElementById("handText");
const handButtonsEl = document.getElementById("handButtons");
const resultEl = document.getElementById("result");
const newHandBtn = document.getElementById("newHandBtn");
const drawBtn = document.getElementById("drawBtn");
const phaseTextEl = document.getElementById("phaseText");
const hintTextEl = document.getElementById("hintText");
const ukeireBoxEl = document.getElementById("ukeireBox");

const bi = (zh, en) => `${zh} / ${en}`;

// English tile code for tooltip
function tileIdToEn(id){
  if (id <= 8) return `${id + 1}m`;          // man
  if (id <= 17) return `${id - 9 + 1}p`;     // pin
  if (id <= 26) return `${id - 18 + 1}s`;    // sou
  const honors = ["East","South","West","North","White","Green","Red"];
  return honors[id - 27];
}

// HTML span with tooltip (English)
function tileLabelHtml(id, textHtml){
  const title = tileIdToEn(id);
  return `<span class="tileLabel" title="${title}">${textHtml}</span>`;
}

// ===== state =====
const state = {
  wall: [],
  tiles13: [],
  drawTile: null,
  analysis: null,
};

// ===== caches =====
const shantenCache = new Map();
const bestAfterCache = new Map();
const agariCache = new Map();
const keyCounts = (c) => c.join(",");

function shanten13Cached(counts13){
  const k = keyCounts(counts13);
  if (shantenCache.has(k)) return shantenCache.get(k);
  const v = shantenNormal(counts13);
  shantenCache.set(k, v);
  return v;
}
function isAgariCached(counts14){
  const k = keyCounts(counts14);
  if (agariCache.has(k)) return agariCache.get(k);
  const v = isAgariNormal(counts14);
  agariCache.set(k, v);
  return v;
}
function bestShantenAfterDiscardCached(counts14){
  const k = keyCounts(counts14);
  if (bestAfterCache.has(k)) return bestAfterCache.get(k);

  let best = Infinity;
  const candidates = uniqTileIdsFromCounts(counts14);
  for (const t of candidates){
    counts14[t]--;
    const sh = shanten13Cached(counts14);
    counts14[t]++;
    if (sh < best) best = sh;
  }
  bestAfterCache.set(k, best);
  return best;
}

// ===== ukeire =====
function calcUkeire(counts13, currentShanten){
  const effTiles = [];
  let total = 0;

  for (let drawId=0; drawId<34; drawId++){
    const have = counts13[drawId];
    if (have >= 4) continue;
    const remain = 4 - have;

    counts13[drawId]++; // add draw -> 14

    let effective = false;
    if (currentShanten === 0){
      effective = isAgariCached(counts13);
    } else {
      const bestAfter = bestShantenAfterDiscardCached(counts13);
      effective = bestAfter < currentShanten;
    }

    counts13[drawId]--;
    if (effective){
      effTiles.push({id: drawId, remain});
      total += remain;
    }
  }

  return { ukeire: total, effTiles };
}

function formatEffTilesHtml(effTiles){
  if (!effTiles || effTiles.length === 0) return bi("（无）", "(none)");
  return effTiles
    .slice().sort((a,b)=>a.id-b.id)
    .map(x => tileLabelHtml(x.id, `${tileIdToStr(x.id)}（${x.remain}）`))
    .join("  ");
}

function clearUkeireBox(){
  ukeireBoxEl.innerHTML = `<div class="muted">${bi("还没有弃牌结果。","No discard yet.")}</div>`;
}

// Show: your discard + best reference discard (also show which tile was discarded)
function renderUkeireBox(userDiscardId, userInfo, bestDiscardId, bestInfo){
  ukeireBoxEl.innerHTML = `
    <div class="ukeireRow">
      <div class="ukeireLeft">
        <div><b>${bi("你的选择","Your choice")}</b>：${bi("切","Discard")} <b>${tileIdToStr(userDiscardId)}</b> <span class="muted">(${tileIdToEn(userDiscardId)})</span>（${userInfo.sh} ${bi("向听","shanten")}）</div>
        <div>${formatEffTilesHtml(userInfo.effTiles)}</div>
      </div>
      <div class="ukeireRight">${bi("总计","Total")}: ${userInfo.ukeire}</div>
    </div>

    <div class="ukeireRow">
      <div class="ukeireLeft">
        <div><b>${bi("最优参考","Best reference")}</b>：${bi("切","Discard")} <b>${tileIdToStr(bestDiscardId)}</b> <span class="muted">(${tileIdToEn(bestDiscardId)})</span>（${bestInfo.sh} ${bi("向听","shanten")}）</div>
        <div>${formatEffTilesHtml(bestInfo.effTiles)}</div>
      </div>
      <div class="ukeireRight">${bi("总计","Total")}: ${bestInfo.ukeire}</div>
    </div>
  `;
}

// ===== images =====
function tileImgSrc(tileId){
  return `./assets/tiles/${tileId}.png`;
}
function preloadTileImages(){
  for (let i=0;i<34;i++){
    const im = new Image();
    im.src = tileImgSrc(i);
  }
}

// ===== UI =====
function renderPhase(){
  phaseTextEl.textContent = state.drawTile===null
    ? bi("阶段：发牌中（将自动摸牌）","Phase: dealing (auto draw)")
    : bi("阶段：可弃牌","Phase: ready to discard");

  hintTextEl.textContent = bi(
    "鼠标悬停抬起，左键点击弃牌（悬停可看英文码）。",
    "Hover to lift, left-click to discard (hover for English code)."
  );

  if (drawBtn) drawBtn.style.display = "none"; // auto draw
}

function renderEmptyResult(){
  resultEl.innerHTML = `<div class="muted">
    ${bi("点击任意一张牌弃掉后，系统会显示向听与最优弃牌（并考虑有效进张）。",
         "Click any tile to discard. We'll show shanten + best discards (with ukeire).")}
  </div>`;
}

function renderHand(){
  if (handTextEl) {
    const text13 = formatHandText(state.tiles13);
    handTextEl.textContent = state.drawTile===null
      ? text13
      : `${text13}\n\n${bi("摸牌","Draw")}: ${tileIdToStr(state.drawTile)} (${tileIdToEn(state.drawTile)})`;
  }

  handButtonsEl.innerHTML = "";
  const canDiscard = (state.drawTile !== null);

  const makeTileBtn = (tileId, extraClass="") => {
    const btn = document.createElement("button");
    btn.className = `tileBtn ${extraClass}`.trim();
    btn.dataset.tileId = String(tileId);

    const img = document.createElement("img");
    img.className = "tileImg";
    img.src = tileImgSrc(tileId);
    img.alt = `${tileIdToStr(tileId)} / ${tileIdToEn(tileId)}`;
    img.title = `${tileIdToStr(tileId)} / ${tileIdToEn(tileId)}`;

    btn.appendChild(img);

    btn.addEventListener("click", () => {
      if (!canDiscard) return;
      onDiscardClick(tileId);
      setSelectedStyle(tileId);
    });

    return btn;
  };

  for (const tileId of state.tiles13){
    handButtonsEl.appendChild(makeTileBtn(tileId));
  }
  if (state.drawTile !== null){
    handButtonsEl.appendChild(makeTileBtn(state.drawTile, "drawn"));
  }
}

function setSelectedStyle(tileId){
  [...handButtonsEl.querySelectorAll(".tileBtn")].forEach(b=>{
    b.classList.toggle("selected", Number(b.dataset.tileId)===tileId);
  });
}

// ===== analysis =====
function analyzeAllDiscardsIfNeeded(){
  if (state.analysis) return;
  if (state.drawTile===null) return;

  const tiles14 = state.tiles13.concat([state.drawTile]);
  const counts14 = tilesToCounts(tiles14);
  const perDiscard = new Map();

  const counts = counts14.slice();
  const candidates = uniqTileIdsFromCounts(counts);

  let bestSh = Infinity;

  for (const tileId of candidates){
    counts[tileId]--;
    const sh = shanten13Cached(counts);
    const {ukeire, effTiles} = calcUkeire(counts, sh);
    perDiscard.set(tileId, {sh, ukeire, effTiles});
    counts[tileId]++;

    if (sh < bestSh) bestSh = sh;
  }

  let bestUke = -1;
  for (const info of perDiscard.values()){
    if (info.sh !== bestSh) continue;
    if (info.ukeire > bestUke) bestUke = info.ukeire;
  }

  const bestDiscards = [];
  for (const [tileId, info] of perDiscard.entries()){
    if (info.sh===bestSh && info.ukeire===bestUke) bestDiscards.push(tileId);
  }
  bestDiscards.sort((a,b)=>a-b);

  state.analysis = { perDiscard, bestShanten: bestSh, bestUkeire: bestUke, bestDiscards };
}

function onDiscardClick(tileId){
  analyzeAllDiscardsIfNeeded();
  const { perDiscard, bestShanten, bestUkeire, bestDiscards } = state.analysis;

  const userInfo = perDiscard.get(tileId);
  const userSh = userInfo.sh;
  const userUke = userInfo.ukeire;

  const bestStr = bestDiscards.map(t => `${tileIdToStr(t)} (${tileIdToEn(t)})`).join(" / ");
  const isBest = (userSh===bestShanten && userUke===bestUkeire);

  const verdictClass = isBest ? "good" : (userSh===bestShanten ? "warn" : "bad");
  const verdictText = isBest
    ? bi("因此你的选择是最优 ✅（向听最小 & 有效进张最多）",
         "Your choice is BEST ✅ (lowest shanten & max ukeire).")
    : (userSh===bestShanten
        ? bi("同向听但有效进张更少 → 非最优 ❌",
             "Same shanten but fewer ukeire → NOT best ❌.")
        : bi("向听更差 → 非最优 ❌",
             "Worse shanten → NOT best ❌."));

  // table rows
  const rows = [];
  const all = Array.from(perDiscard.entries()).sort((a,b)=>a[0]-b[0]);
  for (const [t, info] of all){
    const tag = (info.sh===bestShanten && info.ukeire===bestUkeire)
      ? `<span class="badge best">${bi("最优","Best")}</span>`
      : `<span class="badge notbest">${bi("非最优","Not best")}</span>`;

    rows.push(`
      <tr>
        <td>${tileLabelHtml(t, `<b>${tileIdToStr(t)}</b>`)}</td>
        <td>${info.sh}</td>
        <td>${info.ukeire}</td>
        <td>${tag}</td>
      </tr>
    `);
  }

  resultEl.innerHTML = `
    <div>
      <div>
        ${bi("你切","You discarded")} <b>${tileIdToStr(tileId)}</b> <span class="muted">(${tileIdToEn(tileId)})</span>，
        ${bi("切后为","now")} <b>${userSh}</b> ${bi("向听","shanten")}，
        ${bi("有效进张","ukeire")} <b>${userUke}</b>。
      </div>
      <div>
        ${bi("系统最优切牌为","Best discards")} <b>${bestStr}</b>，
        ${bi("最优为","best")} <b>${bestShanten}</b> ${bi("向听","shanten")}，
        ${bi("有效进张","ukeire")} <b>${bestUkeire}</b>。
      </div>
      <div class="${verdictClass}">${verdictText}</div>
    </div>

    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>${bi("弃牌","Discard")}</th>
            <th>${bi("向听","Shanten")}</th>
            <th>${bi("有效进张","Ukeire")}</th>
            <th>${bi("评价","Tag")}</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;

  // bottom ukeire box
  const bestDiscardId = bestDiscards[0];
  const bestInfo = perDiscard.get(bestDiscardId);
  renderUkeireBox(tileId, userInfo, bestDiscardId, bestInfo);
}

// ===== auto draw =====
function autoDrawSoon(){
  setTimeout(() => {
    if (state.drawTile !== null) return;
    if (state.wall.length===0) return;

    state.drawTile = state.wall.shift();
    state.analysis = null;

    const tiles14 = state.tiles13.concat([state.drawTile]);
    const counts14 = tilesToCounts(tiles14);

    if (isAgariNormal(counts14)){
      newRound();
      return;
    }

    renderPhase();
    renderHand();
    renderEmptyResult();
    clearUkeireBox();
  }, 250);
}

function newRound(){
  state.analysis = null;
  state.drawTile = null;

  shantenCache.clear();
  bestAfterCache.clear();
  agariCache.clear();

  const deck = buildDeck136();
  shuffle(deck);

  state.tiles13 = sortTiles(deck.slice(0,13));
  state.wall = deck.slice(13);

  renderPhase();
  renderHand();
  renderEmptyResult();
  clearUkeireBox();
  autoDrawSoon();
}

// ===== start =====
preloadTileImages();
newHandBtn.addEventListener("click", newRound);
newRound();

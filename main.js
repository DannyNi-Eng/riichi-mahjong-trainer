// main.js
// 图片手牌版：13张起手 -> 自动摸1张放最右 -> hover + 左键点击弃牌
// 评价：先比普通手向听；同向听再比有效进张枚数(ukeire)
// 有效进张 UI 仍写到页面底部 #ukeireBox（你之前那套）

import {
  shuffle, buildDeck136, tilesToCounts, sortTiles,
  tileIdToStr, formatHandText, uniqTileIdsFromCounts
} from "./utils.js";

import { shantenNormal, isAgariNormal } from "./shanten.js";

// ===== DOM =====
const handTextEl = document.getElementById("handText");
const handButtonsEl = document.getElementById("handButtons");
const resultEl = document.getElementById("result");
const newHandBtn = document.getElementById("newHandBtn");
const drawBtn = document.getElementById("drawBtn");       // 现在自动摸牌，用不到但为了兼容保留
const phaseTextEl = document.getElementById("phaseText");
const hintTextEl = document.getElementById("hintText");
const ukeireBoxEl = document.getElementById("ukeireBox");

// ===== 状态 =====
const state = {
  wall: [],
  tiles13: [],
  drawTile: null,
  analysis: null,
};

// ===== 小缓存（加速）=====
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

// ===== 有效进张（ukeire）=====
function calcUkeire(counts13, currentShanten){
  const effTiles = [];
  let total = 0;

  for (let drawId=0; drawId<34; drawId++){
    const have = counts13[drawId];
    if (have >= 4) continue;
    const remain = 4 - have;

    counts13[drawId]++; // 摸进来，变14张

    let effective = false;
    if (currentShanten === 0){
      effective = isAgariCached(counts13); // 听牌：摸到就和
    } else {
      const bestAfter = bestShantenAfterDiscardCached(counts13); // 摸后还能弃
      effective = bestAfter < currentShanten;
    }

    counts13[drawId]--; // 复原

    if (effective){
      effTiles.push({id: drawId, remain});
      total += remain;
    }
  }
  return { ukeire: total, effTiles };
}

function formatEffTiles(effTiles){
  if (!effTiles || effTiles.length===0) return "（无）";
  return effTiles
    .slice().sort((a,b)=>a.id-b.id)
    .map(x => `${tileIdToStr(x.id)}（${x.remain}）`)
    .join("  ");
}

function renderUkeireBox(userDiscardId, userInfo, bestDiscardId, bestInfo){
  ukeireBoxEl.innerHTML = `
    <div class="ukeireRow">
      <div class="ukeireLeft">
        <div><b>你的选择</b>：切 <b>${tileIdToStr(userDiscardId)}</b>（${userInfo.sh} 向听）</div>
        <div>${formatEffTiles(userInfo.effTiles)}</div>
      </div>
      <div class="ukeireRight">总计：${userInfo.ukeire}</div>
    </div>

    <div class="ukeireRow">
      <div class="ukeireLeft">
        <div><b>最优参考</b>：切 <b>${tileIdToStr(bestDiscardId)}</b>（${bestInfo.sh} 向听）</div>
        <div>${formatEffTiles(bestInfo.effTiles)}</div>
      </div>
      <div class="ukeireRight">总计：${bestInfo.ukeire}</div>
    </div>
  `;
}

function clearUkeireBox(){
  ukeireBoxEl.innerHTML = `<div class="muted">还没有弃牌结果。</div>`;
}

// ===== 牌图路径 =====
function tileImgSrc(tileId){
  return `./assets/tiles/${tileId}.png`;
}

// 预加载（可选，但体验好）
function preloadTileImages(){
  for (let i=0;i<34;i++){
    const im = new Image();
    im.src = tileImgSrc(i);
  }
}

// ===== 阶段展示 =====
function renderPhase(){
  // 自动摸牌，所以阶段文案只做提示
  phaseTextEl.textContent = state.drawTile===null ? "阶段：发牌中（将自动摸牌）" : "阶段：可弃牌";
  hintTextEl.textContent = "把鼠标放在牌上会抬起，左键点击即可弃牌。";
  if (drawBtn) drawBtn.style.display = "none"; // 隐藏摸牌按钮（自动摸牌）
}

function renderEmptyResult(){
  resultEl.innerHTML = `<div class="muted">点击任意一张牌弃掉后，系统会显示向听与最优弃牌（并考虑有效进张）。</div>`;
}

function renderHand(){
  // 如果你还想保留文本调试，可以不隐藏 #handText
  if (handTextEl) {
    const text13 = formatHandText(state.tiles13);
    handTextEl.textContent = state.drawTile===null
      ? text13
      : `${text13}\n\n摸牌：${tileIdToStr(state.drawTile)}`;
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
    img.alt = tileIdToStr(tileId);

    btn.appendChild(img);

    btn.addEventListener("click", (e) => {
      if (!canDiscard) return;
      onDiscardClick(tileId);
      setSelectedStyle(tileId);
    });

    return btn;
  };

  // 13张（固定顺序）
  for (const tileId of state.tiles13){
    handButtonsEl.appendChild(makeTileBtn(tileId));
  }

  // 摸牌（最右）
  if (state.drawTile !== null){
    handButtonsEl.appendChild(makeTileBtn(state.drawTile, "drawn"));
  }
}

function setSelectedStyle(tileId){
  [...handButtonsEl.querySelectorAll(".tileBtn")].forEach(b=>{
    b.classList.toggle("selected", Number(b.dataset.tileId)===tileId);
  });
}

// ===== 分析弃牌 =====
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
    counts[tileId]--; // -> 13
    const sh = shanten13Cached(counts);
    const {ukeire, effTiles} = calcUkeire(counts, sh);
    perDiscard.set(tileId, {sh, ukeire, effTiles});
    counts[tileId]++; // restore
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

  const bestStr = bestDiscards.map(tileIdToStr).join(" / ");
  const isBest = (userSh===bestShanten && userUke===bestUkeire);

  const verdictClass = isBest ? "good" : (userSh===bestShanten ? "warn" : "bad");
  const verdictText = isBest
    ? "因此你的选择是最优 ✅（向听最小 & 有效进张最多）"
    : (userSh===bestShanten ? "同向听但有效进张更少 → 非最优 ❌" : "向听更差 → 非最优 ❌");

  // 表格
  const rows = [];
  const all = Array.from(perDiscard.entries()).sort((a,b)=>a[0]-b[0]);
  for (const [t, info] of all){
    const tag = (info.sh===bestShanten && info.ukeire===bestUkeire)
      ? `<span class="badge best">最优</span>`
      : `<span class="badge notbest">非最优</span>`;
    rows.push(`
      <tr>
        <td><b>${tileIdToStr(t)}</b></td>
        <td>${info.sh}</td>
        <td>${info.ukeire}</td>
        <td>${tag}</td>
      </tr>
    `);
  }

  resultEl.innerHTML = `
    <div>
      <div>你切 <b>${tileIdToStr(tileId)}</b> 后为 <b>${userSh}</b> 向听，有效进张 <b>${userUke}</b> 枚。</div>
      <div>系统最优切牌为 <b>${bestStr}</b>，切后为 <b>${bestShanten}</b> 向听，有效进张 <b>${bestUkeire}</b> 枚。</div>
      <div class="${verdictClass}">${verdictText}</div>
    </div>

    <div class="tableWrap">
      <table>
        <thead>
          <tr>
            <th>弃牌</th>
            <th>向听</th>
            <th>有效进张</th>
            <th>评价</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;

  // 底部 ukeire：展示“你的选择” + “最优参考（取一个最优弃牌）”
  const bestDiscardId = bestDiscards[0];
  const bestInfo = perDiscard.get(bestDiscardId);
  renderUkeireBox(tileId, userInfo, bestDiscardId, bestInfo);
}

// ===== 自动摸牌：发13后延迟摸1张 =====
function autoDrawSoon(){
  // 先展示 13 张，再稍微延迟摸牌，模拟“摸到最右”
  setTimeout(() => {
    if (state.drawTile !== null) return;
    if (state.wall.length===0) return;
    state.drawTile = state.wall.shift();
    state.analysis = null;

    // 摸完如果已和牌：按你默认假设直接重发
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

// ===== 新一轮 =====
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
  renderHand();        // 先渲染13张
  renderEmptyResult();
  clearUkeireBox();

  autoDrawSoon();      // 自动摸牌到最右
}

// ===== 启动 =====
preloadTileImages();
newHandBtn.addEventListener("click", newRound);
newRound();
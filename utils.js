// utils.js —— 工具函数：洗牌、牌表示、格式化显示等

export function shuffle(arr) {
  // Fisher–Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 0~33 -> "1m" / "9p" / "1s" / "7z"
export function tileIdToStr(id) {
  if (id < 0 || id > 33) throw new Error("tileId out of range");

  // 万子 1-9
  if (id <= 8) return `${id + 1}万`;

  // 筒子 1-9
  if (id <= 17) return `${id - 9 + 1}筒`;

  // 索子 1-9
  if (id <= 26) return `${id - 18 + 1}索`;

  // 字牌：东南西北白发中
  const honors = ["东", "南", "西", "北", "白", "发", "中"];
  return honors[id - 27];
}

export function tileStrToId(str) {
  // 简单解析：如 "1m" "9p" "7z"
  const m = str.match(/^([1-9])([mpsz])$/);
  if (!m) throw new Error(`Bad tile str: ${str}`);
  const num = parseInt(m[1], 10);
  const suit = m[2];
  if (suit === "m") return num - 1;
  if (suit === "p") return 9 + (num - 1);
  if (suit === "s") return 18 + (num - 1);
  if (suit === "z") return 27 + (num - 1);
  throw new Error(`Bad suit: ${suit}`);
}

export function buildDeck136() {
  const deck = [];
  for (let id = 0; id < 34; id++) {
    for (let k = 0; k < 4; k++) deck.push(id);
  }
  return deck;
}

export function tilesToCounts(tiles) {
  const counts = Array(34).fill(0);
  for (const t of tiles) counts[t]++;
  return counts;
}

export function countsToTiles(counts) {
  const tiles = [];
  for (let id = 0; id < 34; id++) {
    for (let k = 0; k < counts[id]; k++) tiles.push(id);
  }
  return tiles;
}

export function sortTiles(tiles) {
  // 直接按 tileId 排序即可：m < p < s < z，且同花色按数字
  return tiles.slice().sort((a, b) => a - b);
}

export function formatHandText(tilesSorted) {
  const groups = { m: [], p: [], s: [], z: [] };

  for (const id of tilesSorted) {
    const str = tileIdToStr(id);
    if (id <= 8) groups.m.push(str);
    else if (id <= 17) groups.p.push(str);
    else if (id <= 26) groups.s.push(str);
    else groups.z.push(str);
  }

  const lines = [];
  if (groups.m.length) lines.push(groups.m.join(" "));
  if (groups.p.length) lines.push(groups.p.join(" "));
  if (groups.s.length) lines.push(groups.s.join(" "));
  if (groups.z.length) lines.push(groups.z.join(" "));
  return lines.join("\n");
}

export function uniqTileIdsFromCounts(counts) {
  const ids = [];
  for (let i = 0; i < 34; i++) if (counts[i] > 0) ids.push(i);
  return ids;
}
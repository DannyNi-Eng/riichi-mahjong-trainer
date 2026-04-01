// shanten.js —— 只实现“普通手”的向听数（不含国士、七对子、副露）

/**
 * 向听数定义（普通手）：
 * 8 - 2*面子 - 搭子(最多4-面子) - 雀头标记(0/1)
 * 其中面子：顺子/刻子；搭子：对子/两连/嵌张
 *
 * 这里我们用“枚举雀头 + 分块DFS生成(面子,搭子)可能性”的做法，便于新手实现。
 */

// ====== 生成某一块（一个花色9种 or 字牌7种）的(mentsu, taatsu)所有可能 ======

function keyOf(arr) { return arr.join(","); }

// 花色（9张类型：1~9）可以顺子
function genOptionsSuit(counts9, memo = new Map()) {
  const key = keyOf(counts9);
  if (memo.has(key)) return memo.get(key);

  // 找到第一个有牌的位置
  let i = 0;
  while (i < 9 && counts9[i] === 0) i++;
  if (i === 9) {
    const base = [[0, 0]];
    memo.set(key, base);
    return base;
  }

  const results = new Map(); // "m,t" -> true

  const addAll = (nextList, addM, addT) => {
    for (const [m, t] of nextList) {
      const nm = m + addM;
      const nt = t + addT;
      results.set(`${nm},${nt}`, true);
    }
  };

  // 1) 尝试刻子（面子）
  if (counts9[i] >= 3) {
    counts9[i] -= 3;
    addAll(genOptionsSuit(counts9, memo), 1, 0);
    counts9[i] += 3;
  }

  // 2) 尝试顺子（面子）
  if (i <= 6 && counts9[i] > 0 && counts9[i + 1] > 0 && counts9[i + 2] > 0) {
    counts9[i]--; counts9[i + 1]--; counts9[i + 2]--;
    addAll(genOptionsSuit(counts9, memo), 1, 0);
    counts9[i]++; counts9[i + 1]++; counts9[i + 2]++;
  }

  // 3) 尝试对子（搭子）
  if (counts9[i] >= 2) {
    counts9[i] -= 2;
    addAll(genOptionsSuit(counts9, memo), 0, 1);
    counts9[i] += 2;
  }

  // 4) 尝试两连（搭子：如 3-4）
  if (i <= 7 && counts9[i] > 0 && counts9[i + 1] > 0) {
    counts9[i]--; counts9[i + 1]--;
    addAll(genOptionsSuit(counts9, memo), 0, 1);
    counts9[i]++; counts9[i + 1]++;
  }

  // 5) 尝试嵌张（搭子：如 3-5）
  if (i <= 6 && counts9[i] > 0 && counts9[i + 2] > 0) {
    counts9[i]--; counts9[i + 2]--;
    addAll(genOptionsSuit(counts9, memo), 0, 1);
    counts9[i]++; counts9[i + 2]++;
  }

  // 6) 跳过这张（当成孤张丢掉在结构搜索里）
  counts9[i]--;
  addAll(genOptionsSuit(counts9, memo), 0, 0);
  counts9[i]++;

  // 输出去重后的列表
  const out = Array.from(results.keys()).map(k => k.split(",").map(Number));
  memo.set(key, out);
  return out;
}

// 字牌（7张类型：东南西北白发中）不能顺子
function genOptionsHonors(counts7, memo = new Map()) {
  const key = keyOf(counts7);
  if (memo.has(key)) return memo.get(key);

  let i = 0;
  while (i < 7 && counts7[i] === 0) i++;
  if (i === 7) {
    const base = [[0, 0]];
    memo.set(key, base);
    return base;
  }

  const results = new Map();
  const addAll = (nextList, addM, addT) => {
    for (const [m, t] of nextList) {
      results.set(`${m + addM},${t + addT}`, true);
    }
  };

  // 刻子（面子）
  if (counts7[i] >= 3) {
    counts7[i] -= 3;
    addAll(genOptionsHonors(counts7, memo), 1, 0);
    counts7[i] += 3;
  }

  // 对子（搭子）
  if (counts7[i] >= 2) {
    counts7[i] -= 2;
    addAll(genOptionsHonors(counts7, memo), 0, 1);
    counts7[i] += 2;
  }

  // 孤张跳过
  counts7[i]--;
  addAll(genOptionsHonors(counts7, memo), 0, 0);
  counts7[i]++;

  const out = Array.from(results.keys()).map(k => k.split(",").map(Number));
  memo.set(key, out);
  return out;
}

// 合并多个块的(mentsu, taatsu)可能性
function combineOptionLists(lists) {
  let combos = [[0, 0]];
  for (const list of lists) {
    const next = [];
    for (const [m1, t1] of combos) {
      for (const [m2, t2] of list) {
        next.push([m1 + m2, t1 + t2]);
      }
    }
    combos = pruneDominated(next);
  }
  return combos;
}

// 去掉“明显不可能更优”的组合（加速，不影响正确性）
function pruneDominated(pairs) {
  // dominated: 存在另一个 (m',t') 使得 m' >= m 且 t' >= t
  const unique = new Map();
  for (const [m, t] of pairs) unique.set(`${m},${t}`, [m, t]);
  const arr = Array.from(unique.values());

  const keep = [];
  for (let i = 0; i < arr.length; i++) {
    const [mi, ti] = arr[i];
    let dominated = false;
    for (let j = 0; j < arr.length; j++) {
      if (i === j) continue;
      const [mj, tj] = arr[j];
      if (mj >= mi && tj >= ti) { dominated = true; break; }
    }
    if (!dominated) keep.push([mi, ti]);
  }
  return keep;
}

/**
 * 计算普通手向听数（counts 总张数建议为 13）
 */
export function shantenNormal(counts34) {
  // 预备：切块
  const man = counts34.slice(0, 9);
  const pin = counts34.slice(9, 18);
  const sou = counts34.slice(18, 27);
  const hon = counts34.slice(27, 34); // 7

  // 每块的 options memo（每次计算向听都新建，够用且直观）
  const memoSuit = new Map();
  const memoHon = new Map();

  // 枚举雀头：可以不选（pairFlag=0），也可以选某个对子当雀头（pairFlag=1）
  let best = Infinity;

  // 0) 不选雀头
  {
    const lists = [
      genOptionsSuit(man.slice(), memoSuit),
      genOptionsSuit(pin.slice(), memoSuit),
      genOptionsSuit(sou.slice(), memoSuit),
      genOptionsHonors(hon.slice(), memoHon),
    ];
    const combos = combineOptionLists(lists);
    for (const [m, t] of combos) {
      const m2 = Math.min(m, 4);
      const t2 = Math.min(t, 4 - m2);
      const sh = 8 - 2 * m2 - t2; // pairFlag=0
      if (sh < best) best = sh;
    }
  }

  // 1) 选某个对子做雀头
  for (let head = 0; head < 34; head++) {
    if (counts34[head] < 2) continue;

    // 构造新 counts（减去雀头那一对）
    const c = counts34.slice();
    c[head] -= 2;

    const man2 = c.slice(0, 9);
    const pin2 = c.slice(9, 18);
    const sou2 = c.slice(18, 27);
    const hon2 = c.slice(27, 34);

    const memoSuit2 = new Map();
    const memoHon2 = new Map();

    const lists = [
      genOptionsSuit(man2, memoSuit2),
      genOptionsSuit(pin2, memoSuit2),
      genOptionsSuit(sou2, memoSuit2),
      genOptionsHonors(hon2, memoHon2),
    ];
    const combos = combineOptionLists(lists);

    for (const [m, t] of combos) {
      const m2 = Math.min(m, 4);
      const t2 = Math.min(t, 4 - m2);
      const sh = 8 - 2 * m2 - t2 - 1; // pairFlag=1
      if (sh < best) best = sh;
    }
  }

  return best;
}

// ====== 起手“已经和牌”判定（只用于：若起手已和牌则重发）======

function canFormMentsuSuit(counts9, memo = new Map()) {
  const key = keyOf(counts9);
  if (memo.has(key)) return memo.get(key);

  let i = 0;
  while (i < 9 && counts9[i] === 0) i++;
  if (i === 9) { memo.set(key, true); return true; }

  // 刻子
  if (counts9[i] >= 3) {
    counts9[i] -= 3;
    if (canFormMentsuSuit(counts9, memo)) { counts9[i] += 3; memo.set(key, true); return true; }
    counts9[i] += 3;
  }

  // 顺子
  if (i <= 6 && counts9[i] > 0 && counts9[i + 1] > 0 && counts9[i + 2] > 0) {
    counts9[i]--; counts9[i + 1]--; counts9[i + 2]--;
    if (canFormMentsuSuit(counts9, memo)) { counts9[i]++; counts9[i + 1]++; counts9[i + 2]++; memo.set(key, true); return true; }
    counts9[i]++; counts9[i + 1]++; counts9[i + 2]++;
  }

  memo.set(key, false);
  return false;
}

export function isAgariNormal(counts34) {
  // 只判断普通手：4面子+1雀头
  const total = counts34.reduce((a, b) => a + b, 0);
  if (total !== 14) return false;

  // 枚举雀头
  for (let head = 0; head < 34; head++) {
    if (counts34[head] < 2) continue;

    const c = counts34.slice();
    c[head] -= 2;

    const man = c.slice(0, 9);
    const pin = c.slice(9, 18);
    const sou = c.slice(18, 27);
    const hon = c.slice(27, 34);

    // 字牌必须都是刻子
    let okHon = true;
    for (let i = 0; i < 7; i++) {
      if (hon[i] % 3 !== 0) { okHon = false; break; }
    }
    if (!okHon) continue;

    const memo = new Map();
    const ok =
      canFormMentsuSuit(man, memo) &&
      canFormMentsuSuit(pin, memo) &&
      canFormMentsuSuit(sou, memo);

    if (ok) return true;
  }
  return false;
}
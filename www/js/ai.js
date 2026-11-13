// Bot zekâsı: kolay → orta → zor → usta
// Zor ve usta botlar: oynanan taşları hafızada tutar, rakibin pas/çekme
// hareketlerinden "elinde şu sayı yok" bilgisini çıkarır, rakiplerin olası
// ellerini olasılığa göre örnekler ve her hamleyi yüzlerce kez simüle eder.

import { TILES, hasNum, isDouble, pips, otherEnd, handValue, shuffle, BONEYARD_KEEP } from './engine.js';

export const LEVELS = ['easy', 'medium', 'hard', 'expert'];
const SAMPLES = { hard: 40, expert: 140 };

function movesFor(hand, L, R, forced) {
  const res = [];
  if (L < 0) {
    if (forced !== null && forced !== undefined) return hand.includes(forced) ? [{ id: forced, side: 'C' }] : [];
    for (const id of hand) res.push({ id, side: 'C' });
    return res;
  }
  for (const id of hand) {
    const okL = hasNum(id, L), okR = hasNum(id, R);
    if (okL) res.push({ id, side: 'L' });
    if (okR && !(okL && L === R)) res.push({ id, side: 'R' });
  }
  return res;
}

function endsAfter(L, R, m) {
  const [a, b] = TILES[m.id];
  if (m.side === 'C') return [a, b];
  if (m.side === 'L') return [otherEnd(m.id, L), R];
  return [L, otherEnd(m.id, R)];
}

/** Bilinmeyen taşlar (bu oyuncunun bakış açısından). */
function unknownTiles(match, p) {
  const known = new Set([...match.hands[p], ...match.boardTiles()]);
  const res = [];
  for (let id = 0; id < 28; id++) if (!known.has(id)) res.push(id);
  return res;
}

/** Sezgisel değerlendirme (orta seviye ve simülasyon politikası için). */
function heuristic(match, p, m, unk) {
  const hand = match.hands[p];
  const e = match.ends || [-1, -1];
  const [nL, nR] = endsAfter(e[0], e[1], m);
  const rest = hand.filter(id => id !== m.id);
  let s = 0;
  s += pips(m.id) * 1.0;
  if (isDouble(m.id)) s += 4.5;
  if (m.id === 0 && rest.length <= 3) s += 4; // 0:0 yalnız kalırsa 10 puan
  // Kendi kontrolüm: elimde yeni uçlara uyan taş kalsın
  const matchCount = rest.filter(id => hasNum(id, nL) || hasNum(id, nR)).length;
  if (rest.length && matchCount === 0) s -= 7;
  s += Math.min(matchCount, 3) * 1.4;
  // Rakipler ve ortak
  for (let o = 0; o < match.n; o++) {
    if (o === p) continue;
    const v = match.voids[o];
    const vb = (v.has(nL) ? 1 : 0) + (v.has(nR) ? 1 : 0);
    const both = v.has(nL) && v.has(nR);
    if (match.side(o) !== match.side(p)) {
      s += both ? 7 : vb * 1.5;
    } else {
      s -= both ? 5 : vb * 1.0;
    }
  }
  // Sayı hakimiyeti: o sayıdan bilinmeyen taş kalmadıysa rakip oynayamaz
  for (const n of nL === nR ? [nL] : [nL, nR]) {
    const unkWith = unk.filter(id => hasNum(id, n)).length;
    const mine = rest.filter(id => hasNum(id, n)).length;
    if (unkWith === 0 && mine > 0) s += 3;
    else if (unkWith <= 1 && mine >= 2) s += 1.5;
  }
  return s;
}

/** Gizli elleri örnekle (oyuncu sayıları ve bilinen "yok" bilgileriyle tutarlı). */
function sampleWorld(match, p, unk, rng, useVoids) {
  const pool = shuffle([...unk], rng);
  const hands = match.hands.map((h, i) => (i === p ? [...h] : null));
  const others = [];
  for (let o = 0; o < match.n; o++) if (o !== p) others.push(o);
  others.sort((a, b) => match.voids[b].size - match.voids[a].size);
  for (const o of others) {
    const need = match.hands[o].length;
    const v = useVoids ? match.voids[o] : null;
    const got = [];
    for (let i = 0; i < pool.length && got.length < need; i++) {
      const id = pool[i];
      if (v && v.size && (v.has(TILES[id][0]) || v.has(TILES[id][1]))) continue;
      got.push(id);
    }
    // Yetmezse kısıtı gevşet
    for (let i = 0; i < pool.length && got.length < need; i++) if (!got.includes(pool[i])) got.push(pool[i]);
    for (const id of got) pool.splice(pool.indexOf(id), 1);
    hands[o] = got;
  }
  return { hands, boneyard: pool };
}

/** Hızlı el simülasyonu. Döner: p'nin tarafı açısından puan farkı. */
export function simulate(match, world, p, first, rng) {
  const n = match.n;
  const hands = world.hands.map(h => [...h]);
  const bone = [...world.boneyard];
  const cnt = new Array(7).fill(0);
  for (const id of match.boardTiles()) { cnt[TILES[id][0]]++; if (!isDouble(id)) cnt[TILES[id][1]]++; }
  let [L, R] = match.ends || [-1, -1];
  const mySide = match.side(p);
  const apply = (pl, m) => {
    const h = hands[pl];
    h.splice(h.indexOf(m.id), 1);
    [L, R] = endsAfter(L, R, m);
    cnt[TILES[m.id][0]]++; if (!isDouble(m.id)) cnt[TILES[m.id][1]]++;
  };
  const sideRem = s => {
    let t = 0;
    for (let q = 0; q < n; q++) if (q % 2 === s) t += handValue(hands[q]);
    return t;
  };
  const result = (winnerSide) => {
    const rem = [sideRem(0), sideRem(1)];
    if (winnerSide < 0) {
      if (rem[0] === rem[1]) return 0;
      winnerSide = rem[0] < rem[1] ? 0 : 1;
    }
    const g = rem[1 - winnerSide] + 4; // +4: eli kazanmanın (başlama hakkı) değeri
    return winnerSide === mySide ? g : -g;
  };

  apply(p, first);
  if (hands[p].length === 0) return result(mySide);
  let turn = (p + 1) % n;
  let stuck = 0;
  for (let guard = 0; guard < 200; guard++) {
    if (L === R && cnt[L] >= 7) return result(-1);
    let ms = movesFor(hands[turn], L, R, null);
    while (!ms.length && n === 2 && bone.length > BONEYARD_KEEP) {
      hands[turn].push(...bone.splice(0, 2));
      ms = movesFor(hands[turn], L, R, null);
    }
    if (!ms.length) {
      stuck++;
      if (stuck >= n) return result(-1);
      turn = (turn + 1) % n;
      continue;
    }
    stuck = 0;
    // Simülasyon politikası: hızlı sezgisel + gürültü
    let best = null, bs = -1e9;
    for (const m of ms) {
      const [a, b] = endsAfter(L, R, m);
      const h = hands[turn];
      let s = pips(m.id) + (isDouble(m.id) ? 4 : 0);
      let keep = 0;
      for (const id of h) if (id !== m.id && (hasNum(id, a) || hasNum(id, b))) keep++;
      if (h.length > 1 && keep === 0) s -= 6;
      s += Math.min(keep, 3) + rng() * 3;
      if (s > bs) { bs = s; best = m; }
    }
    apply(turn, best);
    if (hands[turn].length === 0) return result(turn % 2);
    turn = (turn + 1) % n;
  }
  return result(-1);
}

/** Bot hamlesini seç. Döner: {id, side} */
export function chooseMove(match, p, level = 'medium', rng = Math.random) {
  const moves = match.legalMoves(p);
  if (moves.length <= 1) return moves[0] || null;
  const unk = unknownTiles(match, p);

  if (level === 'easy') {
    if (rng() < 0.55) return moves[Math.floor(rng() * moves.length)];
    // Biraz akıllı: en ağır taşı at
    return moves.reduce((a, b) => (pips(b.id) > pips(a.id) ? b : a));
  }
  if (level === 'medium') {
    let best = moves[0], bs = -1e9;
    for (const m of moves) {
      const s = heuristic(match, p, m, unk) + rng() * 2;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }

  // Zor / Usta: Monte Carlo (olasılık örneklemesi + simülasyon)
  const N = SAMPLES[level] || 40;
  const totals = new Array(moves.length).fill(0);
  for (let k = 0; k < N; k++) {
    const world = sampleWorld(match, p, unk, rng, true);
    for (let i = 0; i < moves.length; i++) totals[i] += simulate(match, world, p, moves[i], rng);
  }
  let best = 0, bs = -1e9;
  for (let i = 0; i < moves.length; i++) {
    // Usta: sezgiseli küçük bir ağırlıkla ekle (eşitlik bozucu)
    const s = totals[i] / N + (level === 'expert' ? heuristic(match, p, moves[i], unk) * 0.15 : 0);
    if (s > bs) { bs = s; best = i; }
  }
  return moves[best];
}

/** Elin gücü (takımda kimin başlayacağına karar vermek için). */
export function handStrength(hand) {
  let s = 0;
  const counts = new Array(7).fill(0);
  for (const id of hand) { counts[TILES[id][0]]++; if (!isDouble(id)) counts[TILES[id][1]]++; }
  for (const c of counts) s += c * c;
  for (const id of hand) if (isDouble(id)) s += 2;
  s += hand.reduce((a, id) => a + pips(id), 0) * 0.15; // ağır el: erken başlamak iyi
  return s;
}

/** Takımda kim başlasın? İki oyuncudan elinin daha güçlü olanı. */
export function chooseStarter(match, side) {
  const ps = match.sidePlayers(side);
  if (ps.length === 1) return ps[0];
  return handStrength(match.hands[ps[0]]) >= handStrength(match.hands[ps[1]]) ? ps[0] : ps[1];
}

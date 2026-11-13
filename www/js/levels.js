// Kariyer haritası: sonsuz aşamalar, her aşamada adil ve çözülebilir bir el.
import { Match } from './engine.js';
import { simulate } from './ai.js';

// Bölüm başına 10 aşama. Bölümdeki konuma göre hedef türü:
const PATTERN = ['win', 'win', 'points', 'win', 'domino', 'points', 'series', 'win', 'points', 'boss'];
export const CHAPTER_COUNT = 6; // isim ve renkler döngüsel

/** i. aşamanın (1'den başlar) ayarları. */
export function stageConfig(i) {
  const ch = Math.floor((i - 1) / 10);
  const pos = (i - 1) % 10;
  let goal = PATTERN[pos];
  // Bot seviyesi yavaş yavaş artar
  const botLv = i <= 6 ? 'easy' : i <= 14 ? (i % 2 ? 'medium' : 'easy') : i <= 24 ? 'medium' : i <= 38 ? (i % 3 === 0 ? 'hard' : 'medium') : i <= 55 ? 'hard' : (i % 2 ? 'expert' : 'hard');
  // Takım aşamaları 11'den itibaren her 3 aşamada bir
  const mode = i >= 11 && i % 3 === 0 ? 4 : 2;
  let bot = botLv;
  if (goal === 'boss') { goal = 'series'; bot = { easy: 'medium', medium: 'hard', hard: 'expert', expert: 'expert' }[botLv]; }
  const target = 10 + Math.min(ch, 8) * 4 + (pos >= 5 ? 4 : 0);
  // Kazanma olasılığı aralığı (en iyi oyunla). Zorlaştıkça düşer ama hep kazanılabilir kalır.
  const band = [[0.62, 0.97], [0.52, 0.9], [0.45, 0.82], [0.4, 0.76], [0.36, 0.72]][Math.min(ch, 4)];
  return {
    i, ch, pos, goal, bot, mode, target,
    star2: goal === 'points' ? target + 10 : 15 + Math.min(ch, 8) * 3,
    star3: goal === 'points' ? target + 22 : 30 + Math.min(ch, 8) * 5,
    boss: pos === 9,
    band,
    reward: { coins: 20 + ch * 6 + (pos === 9 ? 40 : 0), xp: 30 + ch * 6 + (pos === 9 ? 50 : 0) },
  };
}

/**
 * Bir eli değerlendir: insanın her olası ilk hamlesi için kazanma olasılığı.
 * Döner: {best, ways}  — ways: iyi sonuç veren farklı ilk hamle sayısı ("birden çok kazanma yolu")
 */
export function evaluateDeal(match, rng = Math.random, K = 28) {
  const world = { hands: match.hands.map(h => [...h]), boneyard: [...match.boneyard] };
  const probs = [];
  for (const mv of match.legalMoves(0)) {
    let w = 0;
    for (let k = 0; k < K; k++) if (simulate(match, world, 0, mv, rng) > 0) w++;
    probs.push(w / K);
  }
  const best = Math.max(...probs);
  const ways = probs.filter(p => p >= Math.max(0.3, best * 0.6)).length;
  return { best, ways, probs };
}

/** Aşama için adil bir el dağıt (insan başlar). */
export function fairDeal(match, cfg, rng = Math.random) {
  const [lo, hi] = cfg.band;
  let fallback = null;
  for (let tries = 0; tries < 60; tries++) {
    match.deal(false, 0);
    match.turn = 0;
    const ev = evaluateDeal(match, rng);
    if (ev.best >= lo && ev.best <= hi && ev.ways >= 2) return ev;
    if (ev.ways >= 2 && ev.best >= lo * 0.8) fallback = { hands: match.hands.map(h => [...h]), boneyard: [...match.boneyard], ev };
  }
  if (fallback) {
    match.hands = fallback.hands; match.boneyard = fallback.boneyard; match.turn = 0;
    return fallback.ev;
  }
  return evaluateDeal(match, rng);
}

/** Aşama sonucu: hedefe ulaşıldı mı? */
export function handMeetsGoal(cfg, r) {
  const won = r.winnerSide === 0;
  if (cfg.goal === 'points') return won && r.gained >= cfg.target;
  if (cfg.goal === 'domino') return r.kind === 'domino' && r.player === 0;
  return won; // win, series (el bazında)
}

export function starsFor(cfg, points) {
  return points >= cfg.star3 ? 3 : points >= cfg.star2 ? 2 : 1;
}

export function newMatchFor(players) { return new Match(players); }

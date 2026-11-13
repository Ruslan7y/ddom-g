// Profil, ilerleme (XP / seviye / rütbe), coin, mağaza ve başarılar.
// Demo sürüm: veriler telefonda saklanır (localStorage). Online hesap Faz 3'te.

const KEY = 'd101_profile_v1';
const NAMES_KEY = 'd101_names_v1';

export const AVATARS = [
  { id: 'a1', e: '🦁', bg: '#c98b2b', price: 0 },
  { id: 'a2', e: '🐺', bg: '#4b5d73', price: 0 },
  { id: 'a3', e: '🦅', bg: '#7a4b2a', price: 0 },
  { id: 'a4', e: '🐻', bg: '#6b4a3a', price: 0 },
  { id: 'a5', e: '🦊', bg: '#c4612d', price: 0 },
  { id: 'a6', e: '🐯', bg: '#d08a1e', price: 0 },
  { id: 'a7', e: '🦉', bg: '#5b4e7a', price: 0 },
  { id: 'a8', e: '🐼', bg: '#3d4a4f', price: 0 },
  { id: 'a9', e: '🎩', bg: '#20262e', price: 300 },
  { id: 'a10', e: '🐉', bg: '#1f6b4a', price: 500 },
  { id: 'a11', e: '🦈', bg: '#245a86', price: 500 },
  { id: 'a12', e: '🦬', bg: '#5a3d2b', price: 700 },
  { id: 'a13', e: '🕶️', bg: '#2b2b2b', price: 900 },
  { id: 'a14', e: '💎', bg: '#2a5e8c', price: 1500 },
  { id: 'a15', e: '👑', bg: '#8c6a12', price: 2500 },
];
export const BOT_AVATARS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12'];

export const THEMES = [
  { id: 'theme_green', price: 0 },
  { id: 'theme_wood', price: 0 },
  { id: 'theme_navy', price: 0 },
  { id: 'theme_burgundy', price: 0 },
  { id: 'theme_marble', price: 1000 },
  { id: 'theme_gold', price: 2000 },
];
export const TILE_STYLES = [
  { id: 'tiles_ivory', price: 0 },
  { id: 'tiles_black', price: 800 },
  { id: 'tiles_gold', price: 1200 },
];

export const DIFFS = [
  { id: 'easy', unlock: 1, mult: 1 },
  { id: 'medium', unlock: 3, mult: 1.3 },
  { id: 'hard', unlock: 6, mult: 1.7 },
  { id: 'expert', unlock: 10, mult: 2.2 },
];

// Rütbe → gereken seviye (15 rütbe)
export const RANK_LEVELS = [1, 3, 5, 8, 11, 14, 18, 22, 26, 30, 35, 40, 45, 50, 60];
export const rankOf = level => {
  let r = 0;
  RANK_LEVELS.forEach((l, i) => { if (level >= l) r = i; });
  return r;
};
export const xpForLevel = level => 100 + (level - 1) * 45; // bu seviyeden sonrakine geçmek için

const BOT_NAMES = ['Elvin', 'Murad', 'Aysel', 'Orxan', 'Nigar', 'Kamran', 'Leyla', 'Rauf', 'Selin', 'Kerem', 'Emre', 'Zeynep', 'Dmitri', 'Olga', 'Sergey', 'Anna', 'Farid', 'Günay', 'Tural', 'Ramin', 'Lale', 'Mehmet', 'Igor', 'Natasha'];
export function botNames(count, exclude = '') {
  const pool = BOT_NAMES.filter(n => n.toLowerCase() !== exclude.toLowerCase());
  const res = [];
  while (res.length < count) {
    const n = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    res.push(n);
  }
  return res;
}

function defaults() {
  return {
    nick: null, avatar: 'a1', lang: null, loggedIn: false, provider: 'guest',
    sound: true, vibration: true, botSpeed: 'normal', orientation: 'auto',
    theme: 'theme_green', tiles: 'tiles_ivory',
    xp: 0, level: 1, coins: 500,
    owned: { avatars: [], themes: [], tiles: [] },
    stats: { matches: 0, wins: 0, mars: 0, handsWon: 0, streak: 0, bestStreak: 0 },
    ach: {},
    lastMode: 2, lastDiff: 'easy',
    seenTip: false,
  };
}

let P = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = defaults();
      const p = JSON.parse(raw);
      return { ...d, ...p, owned: { ...d.owned, ...(p.owned || {}) }, stats: { ...d.stats, ...(p.stats || {}) } };
    }
  } catch (e) { /* yoksay */ }
  return defaults();
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* yoksay */ } }
export const profile = () => P;
export function update(patch) { Object.assign(P, patch); save(); }
export function resetAll() {
  const keep = { nick: P.nick, avatar: P.avatar, lang: P.lang, loggedIn: P.loggedIn, provider: P.provider };
  P = { ...defaults(), ...keep };
  save();
}
export function logout() {
  releaseName(P.nick);
  P = defaults();
  save();
}

// --- Takma ad (demo: tekillik telefon içinde + bot isimleri; gerçek kontrol sunucuda olacak)
function names() { try { return JSON.parse(localStorage.getItem(NAMES_KEY) || '[]'); } catch (e) { return []; } }
export const NICK_RE = /^[\p{L}\p{N}_]{3,16}$/u;
export function nickAvailable(nick) {
  const n = nick.toLowerCase();
  if (BOT_NAMES.some(b => b.toLowerCase() === n)) return false;
  if (['admin', 'guest', 'misafir', 'qonaq', 'bot', 'domino'].includes(n)) return false;
  return !names().filter(x => x !== (P.nick || '').toLowerCase()).includes(n);
}
export function claimName(nick) {
  const list = names().filter(x => x !== (P.nick || '').toLowerCase());
  list.push(nick.toLowerCase());
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(list)); } catch (e) { /* yoksay */ }
  P.nick = nick; save();
}
function releaseName(nick) {
  if (!nick) return;
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(names().filter(x => x !== nick.toLowerCase()))); } catch (e) { /* yoksay */ }
}

// --- Mağaza
export function owns(kind, id) {
  const cat = kind === 'avatars' ? AVATARS : kind === 'themes' ? THEMES : TILE_STYLES;
  const it = cat.find(x => x.id === id);
  return !!it && (it.price === 0 || P.owned[kind].includes(id));
}
export function buy(kind, id) {
  const cat = kind === 'avatars' ? AVATARS : kind === 'themes' ? THEMES : TILE_STYLES;
  const it = cat.find(x => x.id === id);
  if (!it || owns(kind, id)) return 'owned';
  if (P.coins < it.price) return 'poor';
  P.coins -= it.price;
  P.owned[kind].push(id);
  save();
  return 'ok';
}

// --- Ödüller
/**
 * Maç sonucu: {won, mars, mode, diff, handsWon, gamesWon, events:[...]}
 * Döner: {xp, coins, levelUps, rankUp: idx|-1, newAch:[ids]}
 */
export function applyMatchResult(r) {
  const mult = (DIFFS.find(d => d.id === r.diff) || DIFFS[0]).mult;
  let xp = r.handsWon * 8 + r.gamesWon * 35;
  let coins = r.gamesWon * 10;
  if (r.won) { xp += 100; coins += 60; }
  else xp += 25;
  if (r.mars) { xp += 80; coins += 60; }
  if (r.mode === 4) xp = Math.round(xp * 1.1);
  xp = Math.round(xp * mult); coins = Math.round(coins * mult);

  const oldRank = rankOf(P.level);
  P.xp += xp; P.coins += coins;
  let levelUps = 0;
  while (P.xp >= xpForLevel(P.level)) { P.xp -= xpForLevel(P.level); P.level++; levelUps++; }
  const newRank = rankOf(P.level);

  const s = P.stats;
  s.matches++; s.handsWon += r.handsWon;
  if (r.won) { s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); } else s.streak = 0;
  if (r.mars) s.mars++;

  const newAch = [];
  const unlock = id => { if (!P.ach[id]) { P.ach[id] = Date.now(); newAch.push(id); P.coins += 50; } };
  if (r.won) unlock('first_win');
  if (s.wins >= 10) unlock('wins_10');
  if (s.wins >= 50) unlock('wins_50');
  if (r.mars) unlock('mars');
  if (r.won && r.mode === 4) unlock('team_win');
  if (r.won && r.diff === 'hard') unlock('beat_hard');
  if (r.won && r.diff === 'expert') unlock('beat_expert');
  if (s.streak >= 3) unlock('streak_3');
  if (s.handsWon >= 100) unlock('hands_100');
  if (P.level >= RANK_LEVELS[6]) unlock('rank_master');
  for (const e of r.events || []) unlock(e);
  save();
  return { xp, coins, levelUps, rankUp: newRank > oldRank ? newRank : -1, newAch };
}

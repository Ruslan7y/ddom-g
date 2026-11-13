// Domino 101: Real Table — uygulama ve ekranlar
import { t, setLang, getLang, detectLang, LANGS, rankName, achText, itemName, ACH_IDS } from './i18n.js';
import * as store from './store.js';
import { AVATARS, THEMES, TILE_STYLES, DIFFS, RANK_LEVELS, rankOf, xpForLevel } from './store.js';
import { Match, TILES, hasNum, idOf, isDouble } from './engine.js';
import { chooseMove, chooseStarter, handStrength } from './ai.js';
import { renderBoard, tileSVG, backSVG, ghostFor, boardMetrics } from './render.js';
import { runSplash } from './splash.js';
import { sfx, vibrate } from './sound.js';

const VERSION = '0.1.0';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const view = $('#view');
const P = store.profile;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Ortak yardımcılar
function avatarHTML(id, cls = '') {
  const a = AVATARS.find(x => x.id === id) || AVATARS[0];
  return `<div class="avatar ${cls}" style="--av:${a.bg}"><span>${a.e}</span></div>`;
}
const tileName = id => `${TILES[id][0]}:${TILES[id][1]}`;

function toast(msg, ms = 1800, where = document.body) {
  let host = $('.toasts', where) || $('.toasts');
  if (!host) { host = document.createElement('div'); host.className = 'toasts'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

function modal({ title = '', body = '', buttons = [{ label: t('ok'), value: true, cls: 'primary' }], cls = '', timeout = 0, dismiss = false }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${cls}">${title ? `<h2>${title}</h2>` : ''}<div class="modal-body"></div><div class="modal-btns">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div></div>`;
    const bodyEl = $('.modal-body', wrap);
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    let done = false;
    const close = v => {
      if (done) return; done = true;
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 250);
      resolve(v);
    };
    wrap._close = close;
    $$('.modal-btns .btn', wrap).forEach(b => b.onclick = () => { sfx.tap(); close(buttons[+b.dataset.i].value); });
    if (dismiss) wrap.onclick = e => { if (e.target === wrap) close(null); };
    if (timeout) setTimeout(() => close(null), timeout);
  });
}

function applyLook(el = document.body) {
  [...el.classList].filter(c => c.startsWith('theme_') || c.startsWith('tiles_')).forEach(c => el.classList.remove(c));
  el.classList.add(P().theme, P().tiles);
}

// ---------- Başlangıç
async function boot() {
  setLang(P().lang || detectLang());
  applyLook();
  setupBackButton();
  const sp = $('#splash');
  await runSplash(sp);
  sp.remove();
  if (P().nick) showMain('play'); else showLogin();
}

let backHandler = null;
function setupBackButton() {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  try {
    const App = C.registerPlugin('App');
    App.addListener('backButton', () => {
      const m = $$('.modal-wrap').pop();
      if (m) { m._close && m._close(null); return; }
      if (backHandler) backHandler(); else App.exitApp();
    });
  } catch (e) { /* yoksay */ }
}

// ---------- Giriş
function langChips() {
  return `<div class="lang-chips">${LANGS.map(l => `<button class="chip ${l.code === getLang() ? 'on' : ''}" data-lang="${l.code}">${l.name}</button>`).join('')}</div>`;
}
function bindLangChips(root, rerender) {
  $$('[data-lang]', root).forEach(b => b.onclick = () => { sfx.tap(); setLang(b.dataset.lang); store.update({ lang: b.dataset.lang }); rerender(); });
}

function logoHTML() {
  return `<div class="logo"><div class="logo-tile">${tileSVG(idOf(6, 6))}</div><div class="logo-text">DOMINO <b>101</b></div><div class="logo-sub">REAL TABLE</div></div>`;
}

function showLogin() {
  backHandler = null;
  view.className = 'screen login';
  view.innerHTML = `
    <div class="login-box">
      ${langChips()}
      ${logoHTML()}
      <p class="muted">${t('welcome_sub')}</p>
      <button class="btn social google" data-p="google"><span class="ic">G</span>${t('login_google')}</button>
      <button class="btn social facebook" data-p="facebook"><span class="ic">f</span>${t('login_facebook')}</button>
      <button class="btn primary big" data-p="guest">${t('login_guest')}</button>
    </div>`;
  bindLangChips(view, showLogin);
  $$('[data-p]', view).forEach(b => b.onclick = async () => {
    sfx.tap();
    const prov = b.dataset.p;
    if (prov !== 'guest') await modal({ title: prov === 'google' ? 'Google' : 'Facebook', body: `<p>${t('login_soon')}</p>` });
    store.update({ provider: 'guest' });
    showNick(true);
  });
}

function showNick(first) {
  backHandler = first ? showLogin : () => showMain('settings');
  view.className = 'screen login';
  let avatar = P().avatar || 'a1';
  const avs = AVATARS.filter(a => store.owns('avatars', a.id));
  view.innerHTML = `
    <div class="login-box">
      <h1>${t('nick_title')}</h1>
      <div class="nick-row"><input id="nick" maxlength="16" autocomplete="off" spellcheck="false" placeholder="${t('nick_placeholder')}" value="${esc(P().nick || '')}"><span class="nick-ok"></span></div>
      <p class="hint" id="nickHint">${t('nick_hint')}</p>
      <h3>${t('choose_avatar')}</h3>
      <div class="avatar-grid">${avs.map(a => `<button class="av-pick ${a.id === avatar ? 'on' : ''}" data-av="${a.id}">${avatarHTML(a.id)}</button>`).join('')}</div>
      <button class="btn primary big" id="go" disabled>${t('continue')}</button>
    </div>`;
  const inp = $('#nick'), hint = $('#nickHint'), ok = $('.nick-ok'), go = $('#go');
  const check = () => {
    const v = inp.value.trim();
    let valid = store.NICK_RE.test(v);
    let msg = t('nick_hint');
    if (v && !valid) msg = t('nick_invalid');
    else if (valid && !store.nickAvailable(v)) { valid = false; msg = t('nick_taken'); }
    hint.textContent = msg;
    hint.classList.toggle('bad', !!v && !valid);
    ok.textContent = valid ? '✓' : (v ? '✗' : '');
    ok.className = 'nick-ok ' + (valid ? 'good' : 'bad');
    go.disabled = !valid;
  };
  inp.oninput = check; check();
  $$('[data-av]', view).forEach(b => b.onclick = () => { sfx.tap(); avatar = b.dataset.av; $$('.av-pick', view).forEach(x => x.classList.toggle('on', x === b)); });
  go.onclick = () => {
    sfx.tap();
    store.claimName(inp.value.trim());
    store.update({ avatar, loggedIn: true });
    showMain(first ? 'play' : 'settings');
  };
}

// ---------- Ana ekran
let tab = 'play';
const ICONS = {
  play: '<svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8.5" y1="12" x2="15.5" y2="12" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="7" r="1.6" fill="currentColor"/><circle cx="10" cy="15.5" r="1.3" fill="currentColor"/><circle cx="14" cy="18.5" r="1.3" fill="currentColor"/></svg>',
  online: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 5H3.5c0 3 1.5 5 4 5M17 5h3.5c0 3-1.5 5-4 5M12 13v4M8 21h8M9.5 17h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

function headerHTML() {
  const p = P();
  const r = rankOf(p.level);
  const need = xpForLevel(p.level);
  return `<header class="topbar">
    ${avatarHTML(p.avatar, 'sm')}
    <div class="who"><div class="nick">${esc(p.nick)}</div><div class="rank">${rankName(r)} · ${t('level')} ${p.level}</div>
      <div class="xpbar"><i style="width:${Math.min(100, (p.xp / need) * 100).toFixed(1)}%"></i></div></div>
    <div class="coins"><span class="coin"></span>${p.coins}</div>
  </header>`;
}

function showMain(which = tab) {
  tab = which;
  backHandler = tab === 'play' ? null : () => showMain('play');
  applyLook();
  view.className = 'screen main';
  view.innerHTML = `${headerHTML()}<main class="content"></main>
    <nav class="tabbar">${['play', 'online', 'trophy', 'settings'].map(k => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${ICONS[k]}<span>${t('tab_' + k)}</span></button>`).join('')}</nav>`;
  $$('[data-tab]', view).forEach(b => b.onclick = () => { sfx.tap(); showMain(b.dataset.tab); });
  const c = $('.content', view);
  ({ play: renderPlay, online: renderOnline, trophy: renderTrophy, settings: renderSettings })[tab](c);
}

function renderPlay(c) {
  const p = P();
  const r = rankOf(p.level);
  let mode = p.lastMode || 2;
  let diff = p.lastDiff || 'easy';
  if ((DIFFS.find(d => d.id === diff) || DIFFS[0]).unlock > p.level) diff = 'easy';
  const next = RANK_LEVELS[r + 1];
  c.innerHTML = `
    <section class="card career">
      <div class="rank-badge r${r}"><span>${r + 1}</span></div>
      <div class="career-info"><div class="label">${t('career')}</div><div class="big">${rankName(r)}</div>
        <div class="muted">${t('level')} ${p.level}${next ? ` · ${rankName(r + 1)}: ${t('reach_level', { n: next })}` : ''}</div></div>
    </section>
    <div class="seg modes"><button class="on">${t('mode_classic')}</button><button disabled>${t('mode_telefon')} <em>${t('soon')}</em></button></div>
    <div class="mode-cards">
      <button class="mode-card ${mode === 2 ? 'on' : ''}" data-mode="2"><div class="mc-ic">👤 <small>vs</small> 🤖</div><b>${t('mode_1v1')}</b><span>${t('mode_1v1_desc')}</span></button>
      <button class="mode-card ${mode === 4 ? 'on' : ''}" data-mode="4"><div class="mc-ic">👥 <small>vs</small> 🤖🤖</div><b>${t('mode_2v2')}</b><span>${t('mode_2v2_desc')}</span></button>
    </div>
    <h3 class="sec">${t('difficulty')}</h3>
    <div class="diffs">${DIFFS.map(d => {
      const locked = d.unlock > p.level;
      return `<button class="chip diff ${d.id === diff ? 'on' : ''} ${locked ? 'locked' : ''}" data-diff="${d.id}" ${locked ? 'disabled' : ''}>${locked ? '🔒 ' : ''}${t('diff_' + d.id)}${locked ? `<small>${t('unlock_at', { n: d.unlock })}</small>` : ''}</button>`;
    }).join('')}</div>
    <button class="btn primary play-btn">${t('play')}</button>
    <p class="muted center small">${t('rules_short')} · <a href="#" class="rules-link">${t('rules')}</a></p>`;
  $$('[data-mode]', c).forEach(b => b.onclick = () => { sfx.tap(); mode = +b.dataset.mode; $$('[data-mode]', c).forEach(x => x.classList.toggle('on', x === b)); });
  $$('[data-diff]', c).forEach(b => b.onclick = () => { sfx.tap(); diff = b.dataset.diff; $$('[data-diff]', c).forEach(x => x.classList.toggle('on', x === b)); });
  $('.rules-link', c).onclick = e => { e.preventDefault(); showRules(); };
  $('.play-btn', c).onclick = () => { sfx.tap(); store.update({ lastMode: mode, lastDiff: diff }); new GameCtl(mode, diff).start(); };
}

function showRules() {
  modal({ title: t('rules'), body: `<div class="rules">${t('rules_text').split('\n').map(l => `<p>${esc(l)}</p>`).join('')}</div>`, dismiss: true });
}

function renderOnline(c) {
  c.innerHTML = `
    <h2 class="sec-title">${t('online_title')}</h2>
    <section class="card online-card"><div class="oc-ic">📶</div><div><b>${t('online_lan')}</b><p class="muted">${t('online_lan_desc')}</p>
      <div class="row"><button class="btn" disabled>${t('create_room')}</button><button class="btn" disabled>${t('join_room')}</button></div></div></section>
    <section class="card online-card"><div class="oc-ic">🌍</div><div><b>${t('online_net')}</b><p class="muted">${t('online_net_desc')}</p>
      <div class="row"><button class="btn" disabled>${t('play')}</button></div></div></section>
    <p class="note">⏳ ${t('online_note')}</p>`;
}

let trophyTab = 'achievements';
let shopTab = 'themes';
function renderTrophy(c) {
  c.innerHTML = `<div class="seg">${['achievements', 'titles', 'shop'].map(k => `<button class="${k === trophyTab ? 'on' : ''}" data-tt="${k}">${t('tab_' + k)}</button>`).join('')}</div><div class="tt-body"></div>`;
  $$('[data-tt]', c).forEach(b => b.onclick = () => { sfx.tap(); trophyTab = b.dataset.tt; renderTrophy(c); });
  const body = $('.tt-body', c);
  const p = P();
  if (trophyTab === 'achievements') {
    body.innerHTML = `<div class="ach-list">${ACH_IDS.map(id => {
      const [name, desc] = achText(id);
      const on = !!p.ach[id];
      return `<div class="ach ${on ? 'on' : ''}"><div class="ach-ic">${on ? '🏆' : '🔒'}</div><div><b>${name}</b><span>${desc}</span></div><div class="ach-rw">+50 <span class="coin"></span></div></div>`;
    }).join('')}</div>`;
  } else if (trophyTab === 'titles') {
    const r = rankOf(p.level);
    body.innerHTML = `<h3 class="sec">${t('rank_ladder')}</h3><div class="ladder">${RANK_LEVELS.map((lv, i) => `<div class="rung ${i < r ? 'done' : ''} ${i === r ? 'cur' : ''}"><div class="rank-badge r${i} sm"><span>${i + 1}</span></div><b>${rankName(i)}</b><span>${t('reach_level', { n: lv })}</span>${i === r ? `<em>${t('current')}</em>` : ''}</div>`).reverse().join('')}</div>`;
  } else {
    const kinds = { themes: THEMES, tiles: TILE_STYLES, avatars: AVATARS };
    const label = { themes: 'shop_tables', tiles: 'shop_tiles', avatars: 'shop_avatars' };
    body.innerHTML = `<div class="seg small">${Object.keys(kinds).map(k => `<button class="${k === shopTab ? 'on' : ''}" data-st="${k}">${t(label[k])}</button>`).join('')}</div>
      <div class="shop-grid">${kinds[shopTab].map(it => {
        const owned = store.owns(shopTab, it.id);
        const cur = shopTab === 'themes' ? p.theme === it.id : shopTab === 'tiles' ? p.tiles === it.id : p.avatar === it.id;
        const prev = shopTab === 'themes' ? `<div class="swatch ${it.id}"><div class="sw-tile ${p.tiles}">${tileSVG(idOf(5, 3))}</div></div>`
          : shopTab === 'tiles' ? `<div class="swatch ${p.theme}"><div class="sw-tile ${it.id}">${tileSVG(idOf(6, 4))}</div></div>`
          : `<div class="swatch av">${avatarHTML(it.id)}</div>`;
        const name = shopTab === 'avatars' ? '' : `<b>${itemName(it.id)}</b>`;
        const btn = cur ? `<button class="btn tiny" disabled>${t('equipped')}</button>`
          : owned ? `<button class="btn tiny" data-equip="${it.id}">${t('equip')}</button>`
          : `<button class="btn tiny gold" data-buy="${it.id}">${it.price} <span class="coin"></span></button>`;
        return `<div class="shop-item ${cur ? 'cur' : ''}">${prev}${name}${btn}</div>`;
      }).join('')}</div>`;
    $$('[data-st]', body).forEach(b => b.onclick = () => { sfx.tap(); shopTab = b.dataset.st; renderTrophy(c); });
    $$('[data-equip]', body).forEach(b => b.onclick = () => { sfx.tap(); equip(shopTab, b.dataset.equip); showMain('trophy'); });
    $$('[data-buy]', body).forEach(b => b.onclick = () => {
      const r = store.buy(shopTab, b.dataset.buy);
      if (r === 'poor') { toast(t('not_enough')); return; }
      sfx.win(); toast(t('bought')); equip(shopTab, b.dataset.buy); showMain('trophy');
    });
  }
}
function equip(kind, id) {
  if (kind === 'themes') store.update({ theme: id });
  else if (kind === 'tiles') store.update({ tiles: id });
  else store.update({ avatar: id });
}

function renderSettings(c) {
  const p = P();
  const s = p.stats;
  const tog = (k, v) => `<button class="toggle ${v ? 'on' : ''}" data-tog="${k}"><i></i></button>`;
  c.innerHTML = `
    <section class="card set">
      <div class="set-row col"><span>${t('language')}</span>${langChips()}</div>
      <div class="set-row"><span>${t('sound')}</span>${tog('sound', p.sound)}</div>
      <div class="set-row"><span>${t('vibration')}</span>${tog('vibration', p.vibration)}</div>
      <div class="set-row"><span>${t('bot_speed')}</span><div class="seg small inline">${['normal', 'fast'].map(k => `<button class="${p.botSpeed === k ? 'on' : ''}" data-speed="${k}">${t('speed_' + k)}</button>`).join('')}</div></div>
    </section>
    <h3 class="sec">${t('table')}</h3>
    <div class="pick-row">${THEMES.filter(x => store.owns('themes', x.id)).map(x => `<button class="mini-swatch ${x.id} ${p.theme === x.id ? 'on' : ''}" data-theme="${x.id}"><span>${itemName(x.id)}</span></button>`).join('')}</div>
    <h3 class="sec">${t('tile_style')}</h3>
    <div class="pick-row">${TILE_STYLES.filter(x => store.owns('tiles', x.id)).map(x => `<button class="mini-tile ${x.id} ${p.tiles === x.id ? 'on' : ''}" data-tiles="${x.id}">${tileSVG(idOf(6, 2))}<span>${itemName(x.id)}</span></button>`).join('')}</div>
    <h3 class="sec">${t('profile')}</h3>
    <section class="card set">
      <div class="set-row">${avatarHTML(p.avatar, 'sm')}<b class="grow">${esc(p.nick)}</b><button class="btn tiny" id="editProfile">${t('change_nick')}</button></div>
      <div class="stats">
        <div><b>${s.matches}</b><span>${t('st_matches')}</span></div><div><b>${s.wins}</b><span>${t('st_wins')}</span></div>
        <div><b>${s.mars}</b><span>${t('st_mars')}</span></div><div><b>${s.handsWon}</b><span>${t('st_hands')}</span></div>
      </div>
    </section>
    <div class="row wrap">
      <button class="btn" id="rules">${t('rules')}</button>
      <button class="btn danger" id="reset">${t('reset_progress')}</button>
      <button class="btn" id="logout">${t('logout')}</button>
    </div>
    <p class="muted center small">Domino 101: Real Table · ${t('version')} ${VERSION}</p>`;
  bindLangChips(c, () => showMain('settings'));
  $$('[data-tog]', c).forEach(b => b.onclick = () => { const k = b.dataset.tog; store.update({ [k]: !P()[k] }); sfx.tap(); showMain('settings'); });
  $$('[data-speed]', c).forEach(b => b.onclick = () => { sfx.tap(); store.update({ botSpeed: b.dataset.speed }); showMain('settings'); });
  $$('[data-theme]', c).forEach(b => b.onclick = () => { sfx.tap(); store.update({ theme: b.dataset.theme }); showMain('settings'); });
  $$('[data-tiles]', c).forEach(b => b.onclick = () => { sfx.tap(); store.update({ tiles: b.dataset.tiles }); showMain('settings'); });
  $('#editProfile', c).onclick = () => { sfx.tap(); showNick(false); };
  $('#rules', c).onclick = () => showRules();
  $('#reset', c).onclick = async () => {
    if (await modal({ title: t('reset_progress'), body: `<p>${t('reset_confirm')}</p>`, buttons: [{ label: t('cancel'), value: false }, { label: t('yes'), value: true, cls: 'danger' }] })) { store.resetAll(); showMain('settings'); }
  };
  $('#logout', c).onclick = async () => {
    if (await modal({ title: t('logout'), body: `<p>${t('reset_confirm')}</p>`, buttons: [{ label: t('cancel'), value: false }, { label: t('yes'), value: true, cls: 'danger' }] })) { store.logout(); setLang(detectLang()); showLogin(); }
  };
}

// ---------- Oyun
class GameCtl {
  constructor(mode, diff) {
    this.mode = mode; this.diff = diff;
    const p = P();
    const names = store.botNames(mode - 1, p.nick);
    const avs = [...store.BOT_AVATARS].sort(() => Math.random() - 0.5).filter(a => a !== p.avatar);
    this.players = [{ name: p.nick, avatar: p.avatar, bot: false }];
    for (let i = 1; i < mode; i++) this.players.push({ name: names[i - 1], avatar: avs[i - 1], bot: true });
    this.match = new Match(this.players);
    this.alive = true;
    this.handsWon = 0; this.gamesWon = 0; this.events = new Set();
    this.selected = null;
    this.newId = null;
    this.waiting = null; // insan hamlesi bekleniyor
  }

  seatOf(p) {
    if (this.mode === 2) return p === 0 ? 'bottom' : 'top';
    return ['bottom', 'left', 'top', 'right'][p];
  }
  sideName(s) {
    if (this.mode === 2) return s === 0 ? t('you') : this.players[1].name;
    return s === 0 ? t('us') : t('them');
  }
  pname(p) { return p === 0 ? t('you') : this.players[p].name; }

  start() {
    backHandler = () => this.confirmLeave();
    view.className = 'screen game';
    applyLook();
    const seats = this.players.map((pl, i) => i === 0 ? '' : `
      <div class="seat seat-${this.seatOf(i)} ${this.mode === 4 && i === 2 ? 'partner' : ''}" data-p="${i}">
        ${avatarHTML(pl.avatar, 'seat-av')}
        <div class="seat-info"><b>${esc(pl.name)}</b><span class="cnt"></span></div>
        <div class="backs"></div><div class="bubble"></div>
      </div>`).join('');
    view.innerHTML = `
      <div class="game-root mode${this.mode}">
        <div class="g-top">
          <button class="icon-btn" id="gMenu" aria-label="menu">✕</button>
          <div class="scoreboard"></div>
          <button class="icon-btn" id="gRules" aria-label="rules">?</button>
        </div>
        <div class="table-area">
          <div class="felt"><div class="felt-inner">
            <svg class="board" xmlns="http://www.w3.org/2000/svg"></svg>
          </div></div>
          ${seats}
          <div class="bone"></div>
          <div class="toasts"></div>
        </div>
        <div class="g-bottom">
          <div class="me-bar">
            ${avatarHTML(this.players[0].avatar, 'me-av')}
            <div class="me-status"></div>
            <div class="me-actions"></div>
          </div>
          <div class="hand"></div>
        </div>
      </div>`;
    this.root = $('.game-root', view);
    window.__game = this; // test/hata ayıklama için
    $('#gMenu').onclick = () => this.confirmLeave();
    $('#gRules').onclick = () => showRules();
    $('.board', view).addEventListener('click', e => this.onBoardClick(e));
    this.onResize = () => { clearTimeout(this._rt); this._rt = setTimeout(() => this.render(), 120); };
    window.addEventListener('resize', this.onResize);
    this.render();
    this.run();
  }

  destroy() {
    this.alive = false;
    window.removeEventListener('resize', this.onResize);
    if (this.waiting) this.waiting(null);
  }

  async confirmLeave() {
    const v = await modal({ title: t('leave_title'), body: `<p>${t('leave_confirm')}</p>`, buttons: [{ label: t('stay'), value: false, cls: 'primary' }, { label: t('leave'), value: true, cls: 'danger' }] });
    if (!v) return;
    this.destroy();
    const s = P().stats; s.matches++; s.streak = 0; store.save();
    showMain('play');
  }

  gtoast(msg, ms = 1700) { if (this.alive) toast(msg, ms, this.root); }

  delay(kind = 'bot') {
    const fast = P().botSpeed === 'fast';
    const base = kind === 'bot' ? (fast ? 380 : 850) : (fast ? 300 : 600);
    return sleep(base + Math.random() * base * 0.6);
  }

  // ---- Akış
  async run() {
    let opening = true, starterSide = 0;
    while (this.alive) {
      const d = this.match.deal(opening, 0);
      this.selected = null; this.newId = null;
      this.render();
      await this.showRedeals(d.redeals);
      if (!this.alive) return;
      if (opening) {
        const tn = tileName(d.forced);
        this.gtoast(d.starter === 0 ? t('opening_you', { tile: tn }) : t('opening', { tile: tn, name: esc(this.players[d.starter].name) }), 2200);
        await sleep(900);
      } else {
        const sp = await this.pickStarter(starterSide);
        if (!this.alive) return;
        this.match.turn = sp;
        this.gtoast(sp === 0 ? t('you_start') : t('starts', { name: esc(this.players[sp].name) }));
        await sleep(500);
      }
      // El
      let res = null;
      while (this.alive && !res) {
        this.render();
        const p = this.match.turn;
        res = p === 0 ? await this.humanTurn() : await this.botTurn(p);
      }
      if (!this.alive) return;
      this.render();
      await sleep(700);
      await this.showHandResult(res);
      if (!this.alive) return;
      if (this.match.over) { await this.showMatchEnd(res); return; }
      const nx = this.match.prepareNext();
      opening = nx.opening; starterSide = nx.starterSide;
    }
  }

  async showRedeals(list) {
    for (const r of list.slice(-2)) {
      if (!this.alive) return;
      const name = r.player >= 0 ? (r.player === 0 ? t('you') : this.players[r.player].name) : '';
      const msg = t('redeal_' + r.type, { name: esc(name), num: r.number, c: r.count });
      const tiles = r.tiles && r.tiles.length ? `<div class="mini-hand">${r.tiles.map(id => tileSVG(id, hasNum(id, r.number) ? 'hl' : '')).join('')}</div>` : '';
      await modal({ title: '🔄 ' + t('redeal'), body: `<p>${msg}</p>${tiles}`, buttons: [], timeout: 2300, cls: 'compact' });
    }
  }

  async pickStarter(side) {
    const m = this.match;
    if (this.mode === 2) return side === 0 ? 0 : 1;
    if (side === 1) return chooseStarter(m, 1);
    // Bizim takım: oylama
    const partner = 2;
    const strong = handStrength(m.hands[partner]) >= 38;
    const body = `<div class="vote">
        <div class="vote-p">${avatarHTML(this.players[partner].avatar, 'sm')}<div class="speech">“${strong ? t('sug_me') : t('sug_you')}”</div></div>
      </div>`;
    const v = await modal({ title: t('who_starts'), body, buttons: [{ label: t('me'), value: 0, cls: strong ? '' : 'primary' }, { label: esc(this.players[partner].name), value: partner, cls: strong ? 'primary' : '' }] });
    return v === null ? 0 : v;
  }

  humanTurn() {
    const m = this.match;
    return new Promise(async resolve => {
      this.waiting = resolve;
      const legal = m.legalMoves(0);
      if (!legal.length) {
        if (m.canDraw(0)) {
          this.render();
          this.setActions(`<button class="btn gold pulse" id="drawBtn">${t('draw_btn')}</button>`);
          $('#drawBtn').onclick = async () => {
            this.setActions('');
            const got = m.draw(0);
            sfx.draw(); vibrate(10);
            this.fresh = new Set(got);
            this.gtoast(t('you_drew', { n: got.length }), 1100);
            this.waiting = null;
            resolve(null); // aynı oyuncu tekrar değerlendirilir
          };
        } else {
          this.setStatus(t('no_move'));
          await sleep(900);
          if (!this.alive) return;
          sfx.pass(); this.bubble(0, t('pass'));
          const r = m.pass(0);
          this.waiting = null;
          resolve(r);
        }
        return;
      }
      this.setStatus(t('your_turn'), true);
      this.render();
    });
  }

  async humanPlay(id, side) {
    const r = this.match.play(0, id, side);
    this.selected = null;
    this.newId = id;
    this.fresh = null;
    sfx.place(); vibrate(18);
    const w = this.waiting; this.waiting = null;
    this.setStatus('');
    w && w(r);
  }

  onHandClick(id) {
    if (!this.waiting || this.match.turn !== 0) return;
    const opts = this.match.legalMoves(0).filter(mv => mv.id === id);
    if (!opts.length) { sfx.tap(); return; }
    const ends = this.match.ends;
    // İki uç da uyuyor ve uçlar farklıysa: masada seçtir
    if (ends && opts.length === 1 && ends[0] === ends[1]) {
      // Aynı sayı iki uçta: iki yere de konabilir
      this.selected = id; sfx.tap(); this.render(); return;
    }
    if (opts.length === 1) { this.humanPlay(id, opts[0].side); return; }
    this.selected = this.selected === id ? null : id;
    sfx.tap();
    this.render();
    if (this.selected !== null) this.setStatus(t('pick_end'), true);
  }

  onBoardClick(e) {
    const g = e.target.closest('.ghost');
    if (!g || this.selected === null || !this.waiting) return;
    this.humanPlay(this.selected, g.dataset.side);
  }

  async botTurn(p) {
    const m = this.match;
    this.setStatus(t('thinking', { name: esc(this.players[p].name) }));
    this.render();
    await this.delay('bot');
    if (!this.alive) return null;
    if (m.legalMoves(p).length) {
      const mv = chooseMove(m, p, this.diff);
      const r = m.play(p, mv.id, mv.side);
      this.newId = mv.id;
      sfx.place();
      return r;
    }
    if (m.canDraw(p)) {
      const got = m.draw(p);
      sfx.draw();
      this.gtoast(t('drew', { name: esc(this.players[p].name), n: got.length }), 1100);
      this.render();
      await this.delay('draw');
      return null;
    }
    sfx.pass();
    this.bubble(p, t('pass'));
    return m.pass(p);
  }

  bubble(p, txt) {
    const el = p === 0 ? $('.me-status', this.root) : $(`.seat[data-p="${p}"] .bubble`, this.root);
    if (!el) return;
    if (p === 0) { this.setStatus(txt); return; }
    el.textContent = txt;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1300);
  }

  setStatus(txt, me = false) {
    const el = $('.me-status', this.root);
    if (el) { el.innerHTML = txt; el.classList.toggle('mine', me); }
  }
  setActions(html) { const el = $('.me-actions', this.root); if (el) el.innerHTML = html; }

  // ---- Çizim
  render() {
    if (!this.alive || !this.root) return;
    const m = this.match;
    if (!m.hands) return;
    // Skor
    const gen = s => [0, 1, 2].map(i => `<i class="${i < m.general[s] ? 'on' : ''}"></i>`).join('');
    $('.scoreboard', this.root).innerHTML = `
      <div class="sb-side ${m.turn !== undefined && m.side(m.turn) === 0 ? 'act' : ''}"><span class="sb-name">${esc(this.sideName(0))}</span><b>${m.scores[0]}</b><div class="gen">${gen(0)}</div></div>
      <div class="sb-mid"><span>${t('game_n', { n: m.gameNo })}</span><small>/101</small>${m.pending ? `<em>${t('pending')}: ${m.pending}</em>` : ''}</div>
      <div class="sb-side ${m.turn !== undefined && m.side(m.turn) === 1 ? 'act' : ''}"><span class="sb-name">${esc(this.sideName(1))}</span><b>${m.scores[1]}</b><div class="gen">${gen(1)}</div></div>`;
    // Koltuklar
    for (let p = 1; p < this.mode; p++) {
      const s = $(`.seat[data-p="${p}"]`, this.root);
      if (!s) continue;
      const n = m.hands[p].length;
      s.classList.toggle('turn', m.turn === p && !m.handOver);
      $('.cnt', s).textContent = n;
      $('.backs', s).innerHTML = Array.from({ length: Math.min(n, 12) }, () => backSVG()).join('');
    }
    $('.me-bar', this.root).classList.toggle('turn', m.turn === 0 && !m.handOver);
    // Pazar
    const bone = $('.bone', this.root);
    if (this.mode === 2) { bone.style.display = ''; bone.innerHTML = `<div class="bone-stack">${backSVG()}${backSVG()}</div><span>${t('boneyard')}: <b>${m.boneyard.length}</b></span>`; }
    else bone.style.display = 'none';
    // Masa
    const svg = $('.board', this.root);
    const box = svg.parentElement.getBoundingClientRect();
    const W = Math.max(200, box.width), H = Math.max(150, box.height);
    const ghosts = [];
    if (this.selected !== null && m.board.center) {
      const ends = m.ends;
      const { limit } = boardMetrics(W, H);
      const opts = m.legalMoves(0).filter(mv => mv.id === this.selected);
      const sides = ends[0] === ends[1] ? ['L', 'R'] : opts.map(o => o.side);
      for (const sd of sides) ghosts.push({ side: sd, item: ghostFor(m.board, limit, this.selected, sd, sd === 'L' ? ends[0] : ends[1]), label: '⬇', cls: 'g' + sd });
    }
    renderBoard(svg, m.board, W, H, { ghosts, newId: this.newId });
    this.newId = null;
    // El
    this.renderHand();
  }

  renderHand() {
    const m = this.match;
    const hand = $('.hand', this.root);
    const tiles = [...m.hands[0]].sort((a, b) => TILES[a][0] - TILES[b][0] || TILES[a][1] - TILES[b][1]);
    const legalIds = new Set(m.turn === 0 && this.waiting && !m.handOver ? m.legalMoves(0).map(x => x.id) : []);
    const W = hand.clientWidth || window.innerWidth;
    const landscape = window.innerWidth > window.innerHeight;
    const maxH = landscape ? window.innerHeight * 0.2 : window.innerHeight * 0.13;
    let rows = 1;
    let tw = Math.min(maxH / 2, (W - 12) / tiles.length - 6, 50);
    if (tw < 30 && tiles.length > 8) { rows = 2; tw = Math.min(maxH / 2 / 1.6, (W - 12) / Math.ceil(tiles.length / 2) - 6, 46); }
    tw = Math.max(22, tw);
    hand.style.setProperty('--tw', tw + 'px');
    hand.classList.toggle('two-rows', rows === 2);
    hand.innerHTML = tiles.map(id => {
      const cls = [legalIds.has(id) ? 'playable' : (legalIds.size ? 'dim' : ''), this.selected === id ? 'sel' : '', this.fresh && this.fresh.has(id) ? 'fresh' : ''].join(' ');
      return `<button class="htile ${cls}" data-id="${id}">${tileSVG(id)}</button>`;
    }).join('');
    $$('.htile', hand).forEach(b => b.onclick = () => this.onHandClick(+b.dataset.id));
  }

  // ---- Sonuçlar
  async showHandResult(r) {
    const m = this.match;
    const mySide = 0;
    if (r.winnerSide === mySide) {
      this.handsWon++;
      if (r.kind === 'blocked') this.events.add('blocked_win');
      if (r.gained >= 50) this.events.add('big_hand');
    }
    let title;
    if (r.kind === 'domino') title = r.player === 0 ? t('hand_domino_you') : t('hand_domino', { name: esc(this.players[r.player].name) });
    else title = t('hand_blocked');
    const rows = this.players.map((pl, p) => `
      <div class="res-row ${m.side(p) === 0 ? 'mine' : ''}">
        ${avatarHTML(pl.avatar, 'xs')}<b>${esc(p === 0 ? t('you') : pl.name)}</b>
        <div class="mini-hand">${r.hands[p].map(id => tileSVG(id)).join('') || '<span class="muted">—</span>'}</div>
        <span class="val">${r.handValues[p]}</span>
      </div>`).join('');
    let summary = '';
    if (r.tie) summary = `<p class="res-big">${t('hand_tie', { n: r.remaining[0] })}</p>`;
    else {
      const pend = r.pendingBefore ? ` <small>(${t('pending_added', { n: r.pendingBefore })})</small>` : '';
      summary = `<p class="res-big ${r.winnerSide === 0 ? 'good' : 'bad'}">${esc(this.sideName(r.winnerSide))}: +${r.gained} ${t('points')}${pend}</p>`;
    }
    const bar = s => `<div class="pbar"><span>${esc(this.sideName(s))}</span><div class="track"><i style="width:${Math.min(100, (r.scores[s] / 101) * 100)}%"></i></div><b>${r.scores[s]}</b></div>`;
    let gameBanner = '';
    if (r.gameWon >= 0) {
      const ours = r.gameWon === 0;
      if (ours && r.generalGained === 2) this.events.add('zero_game');
      if (ours) { this.gamesWon++; sfx.win(); } else sfx.lose();
      gameBanner = `<div class="banner ${ours ? 'good' : 'bad'}">${ours ? (this.mode === 2 ? t('game_won_you') : t('game_won_us')) : t('game_won_them')}${r.generalGained === 2 ? `<small>${t('double_point')}</small>` : ''}</div>`;
    }
    const gen = `<div class="gen-score">${t('general')}: <b>${r.general[0]} : ${r.general[1]}</b></div>`;
    await modal({
      title, cls: 'result',
      body: `${gameBanner}${summary}<div class="res-rows">${rows}</div>${r.kind === 'blocked' ? `<p class="muted small">${t('total')}: ${esc(this.sideName(0))} ${r.remaining[0]} · ${esc(this.sideName(1))} ${r.remaining[1]}</p>` : ''}<div class="pbars">${bar(0)}${bar(1)}</div>${gen}`,
      buttons: [{ label: this.match.over ? t('continue') : t('next_hand'), value: true, cls: 'primary' }],
    });
  }

  async showMatchEnd(r) {
    const won = r.matchWon === 0;
    const res = store.applyMatchResult({ won, mars: won && r.mars, mode: this.mode, diff: this.diff, handsWon: this.handsWon, gamesWon: this.gamesWon, events: [...this.events] });
    won ? sfx.win() : sfx.lose();
    const p = P();
    const achHTML = res.newAch.map(id => `<div class="ach on small"><div class="ach-ic">🏆</div><div><b>${achText(id)[0]}</b><span>${t('ach_unlocked')}</span></div></div>`).join('');
    const body = `
      <div class="end-hero ${won ? 'good' : 'bad'}">${won ? '🏆' : '🎲'}</div>
      ${won && r.mars ? `<div class="mars">${t('mars')}</div>` : ''}
      <div class="gen-score big">${r.general[0]} : ${r.general[1]}</div>
      <h3>${t('rewards')}</h3>
      <div class="rewards"><div>+${res.xp} <small>XP</small></div><div>+${res.coins} <span class="coin"></span></div></div>
      ${res.levelUps ? `<div class="banner good">⬆ ${t('level_up')} — ${t('level')} ${p.level}</div>` : ''}
      ${res.rankUp >= 0 ? `<div class="banner gold">${t('new_rank')}: <b>${rankName(res.rankUp)}</b></div>` : ''}
      ${achHTML}`;
    const v = await modal({ title: won ? t('match_win') : t('match_lose'), body, cls: 'result end', buttons: [{ label: t('main_menu'), value: 'menu' }, { label: t('play_again'), value: 'again', cls: 'primary' }] });
    this.destroy();
    if (v === 'again') new GameCtl(this.mode, this.diff).start();
    else showMain('play');
  }
}

boot();

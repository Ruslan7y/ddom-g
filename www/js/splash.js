// 5 saniyelik açılış: domino taşlarından "DOMINO" yazısı, 6:6 düşer ve hepsini devirir.
import { tileSVG } from './render.js';
import { idOf } from './engine.js';
import { sfx } from './sound.js';

const FONT = {
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
};

export function runSplash(root) {
  return new Promise(resolve => {
    const word = 'DOMINO';
    const cols = word.length * 5 + (word.length - 1);
    const W = root.clientWidth, H = root.clientHeight;
    const cell = Math.max(6, Math.min((W * 0.88) / cols, (H * 0.5) / 7 / 1.25, 22));
    const tw = cell * 0.62, th = cell * 1.15;
    const wordW = cols * cell, wordH = 7 * th;

    root.innerHTML = `
      <div class="sp-glow"></div>
      <div class="sp-word" style="width:${wordW}px;height:${wordH}px"></div>
      <div class="sp-big">${tileSVG(idOf(6, 6))}</div>
      <div class="sp-ring"></div>
      <div class="sp-title"><div class="sp-logo">DOMINO <b>101</b></div><div class="sp-sub">REAL TABLE</div></div>`;
    const wordEl = root.querySelector('.sp-word');
    const center = (cols - 1) / 2;
    const tiles = [];
    let col0 = 0;
    for (const ch of word) {
      const g = FONT[ch];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '1') continue;
        const col = col0 + c;
        const el = document.createElement('div');
        el.className = 'sp-tile';
        el.style.cssText = `left:${col * cell + (cell - tw) / 2}px;top:${r * th + (th - th * 0.9) / 2}px;width:${tw}px;height:${th * 0.9}px`;
        wordEl.appendChild(el);
        tiles.push({ el, col, row: r });
      }
      col0 += 6;
    }

    // 1) Taşlar sırayla dizilir
    tiles.forEach(t => {
      t.el.animate(
        [{ transform: 'translateY(-40px) scale(0.2)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }],
        { duration: 380, delay: 250 + t.col * 42 + t.row * 12, fill: 'both', easing: 'cubic-bezier(.2,1.4,.4,1)' }
      );
    });

    // 2) 6:6 yukarıdan düşer
    const big = root.querySelector('.sp-big');
    const bigH = Math.min(H * 0.26, wordH * 1.5);
    big.style.height = bigH + 'px';
    big.style.width = bigH / 2 + 'px';
    big.animate(
      [
        { transform: `translate(-50%, ${-H}px) rotate(-25deg)`, opacity: 1 },
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1, offset: 0.85 },
        { transform: 'translate(-50%, -54%) rotate(3deg)', opacity: 1, offset: 0.92 },
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
      ],
      { duration: 520, delay: 2050, fill: 'both', easing: 'cubic-bezier(.55,0,.9,.4)' }
    );
    const ring = root.querySelector('.sp-ring');
    ring.animate([{ transform: 'translate(-50%,-50%) scale(0.1)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(4)', opacity: 0 }], { duration: 700, delay: 2500, fill: 'both', easing: 'ease-out' });
    setTimeout(() => { sfx.place(); root.classList.add('shake'); }, 2500);

    // 3) Bütün taşlar merkezden dışarı doğru devrilir
    const lastCol = {};
    tiles.forEach(t => {
      const dist = Math.abs(t.col - center);
      const left = t.col < center;
      t.el.style.transformOrigin = left ? 'bottom left' : 'bottom right';
      const delay = 2600 + dist * 48 + (6 - t.row) * 6;
      t.el.animate(
        [{ transform: 'rotate(0deg)' }, { transform: `rotate(${left ? -84 : 84}deg)` }],
        { duration: 260, delay, fill: 'forwards', easing: 'cubic-bezier(.5,0,1,.6)' }
      );
      if (!lastCol[t.col]) { lastCol[t.col] = 1; if (t.col % 3 === 0) setTimeout(() => sfx.topple(t.col), delay + 200); }
    });

    // 4) Başlık
    wordEl.animate([{ opacity: 1 }, { opacity: 0.18 }], { duration: 500, delay: 3700, fill: 'forwards' });
    big.animate([{ transform: 'translate(-50%, -50%) scale(1)' }, { transform: `translate(-50%, ${-H * 0.2 - bigH / 2}px) scale(0.55)` }], { duration: 600, delay: 3650, fill: 'forwards', easing: 'cubic-bezier(.3,1.3,.5,1)', composite: 'replace' });
    root.querySelector('.sp-title').animate([{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 500, delay: 3800, fill: 'both' });

    // 5) Çıkış
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 4600, fill: 'forwards' });
    setTimeout(() => { root.classList.remove('shake'); resolve(); }, 5000);
  });
}

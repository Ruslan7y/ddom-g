// Taş çizimi (SVG) ve masa yerleşimi (yılan şeklinde dönen zincir)
import { TILES } from './engine.js';

const D = 0.25;
const PIP_POS = {
  0: [],
  1: [[0, 0]],
  2: [[-D, -D], [D, D]],
  3: [[-D, -D], [0, 0], [D, D]],
  4: [[-D, -D], [D, -D], [-D, D], [D, D]],
  5: [[-D, -D], [D, -D], [0, 0], [-D, D], [D, D]],
  6: [[-D, -D], [-D, 0], [-D, D], [D, -D], [D, 0], [D, D]],
};

function pipsSVG(v, cy) {
  return PIP_POS[v].map(([x, y]) => `<circle class="pip p${v}" cx="${x.toFixed(3)}" cy="${(cy + y).toFixed(3)}" r="0.088"/>`).join('');
}

/** Dik duran taş (üst = v1, alt = v2), merkez (0,0), 1x2 birim. */
export function tileInner(v1, v2) {
  return `<rect class="t-shadow" x="-0.44" y="-0.92" width="0.94" height="1.94" rx="0.13"/>` +
    `<rect class="t-body" x="-0.47" y="-0.97" width="0.94" height="1.94" rx="0.13"/>` +
    `<rect class="t-shine" x="-0.40" y="-0.90" width="0.80" height="0.5" rx="0.1"/>` +
    `<line class="t-div" x1="-0.32" y1="0" x2="0.32" y2="0"/>` +
    `<circle class="t-rivet" cx="0" cy="0" r="0.05"/>` +
    pipsSVG(v1, -0.5) + pipsSVG(v2, 0.5);
}

export function tileGroup(it, extraClass = '') {
  const rot = it.vertical ? 0 : -90;
  return `<g class="tile ${extraClass}" data-key="${it.key ?? ''}" transform="translate(${it.cx.toFixed(3)} ${it.cy.toFixed(3)}) rotate(${rot})"><g class="tile-in">${tileInner(it.v1, it.v2)}</g></g>`;
}

/** Eldeki taş için tek başına SVG. */
export function tileSVG(id, cls = '') {
  const [a, b] = TILES[id];
  return `<svg class="tile-svg ${cls}" viewBox="-0.5 -1 1 2" preserveAspectRatio="xMidYMid meet">${tileInner(a, b)}</svg>`;
}

export function backSVG() {
  return `<svg class="tile-svg back" viewBox="-0.5 -1 1 2"><rect class="b-body" x="-0.47" y="-0.97" width="0.94" height="1.94" rx="0.13"/><rect class="b-inner" x="-0.34" y="-0.84" width="0.68" height="1.68" rx="0.08"/></svg>`;
}

// ---- Yerleşim
function placeBranch(entries, startX, dir, vdir, limit, centerIsDouble, items, tag) {
  let x = startX, y = 0, prevD = centerIsDouble;
  entries.forEach((e, i) => {
    const d = e.inner === e.outer;
    const w = d ? 1 : 2;
    const fits = dir > 0 ? x + w <= limit : x - w >= -limit;
    const key = tag + i;
    if (!fits) {
      const colX = dir > 0 ? x - 0.5 : x + 0.5;
      const start = y + vdir * (prevD ? 1 : 0.5);
      items.push({ key, id: e.id, cx: colX, cy: start + vdir, vertical: true, v1: vdir > 0 ? e.inner : e.outer, v2: vdir > 0 ? e.outer : e.inner, end: [colX, start + vdir * 1.5] });
      y = start + vdir * 1.5;
      x = dir > 0 ? x - 1 : x + 1;
      dir = -dir;
      prevD = false;
      return;
    }
    if (d) {
      items.push({ key, id: e.id, cx: x + dir * 0.5, cy: y, vertical: true, v1: e.inner, v2: e.inner, end: [x + dir * 0.5, y] });
    } else {
      items.push({ key, id: e.id, cx: x + dir, cy: y, vertical: false, v1: dir > 0 ? e.inner : e.outer, v2: dir > 0 ? e.outer : e.inner, end: [x + dir * 1.5, y] });
    }
    x += dir * w;
    prevD = d;
  });
}

export function layoutBoard(board, limit) {
  const items = [];
  if (!board.center) return items;
  const c = board.center;
  const cd = c.l === c.r;
  if (cd) items.push({ key: 'c', id: c.id, cx: 0, cy: 0, vertical: true, v1: c.l, v2: c.r });
  else items.push({ key: 'c', id: c.id, cx: 0, cy: 0, vertical: false, v1: c.l, v2: c.r });
  const half = cd ? 0.5 : 1;
  placeBranch(board.right, half, 1, 1, limit, cd, items, 'r');
  placeBranch(board.left, -half, -1, -1, limit, cd, items, 'l');
  return items;
}

/** Hayalet konum: taşı verilen uca koyarsak nereye düşer? */
export function ghostFor(board, limit, id, side, endVal) {
  const [a, b] = TILES[id];
  if (!board.center) return { key: 'gC', cx: 0, cy: 0, vertical: a === b, v1: a, v2: b };
  const inner = endVal, outer = a === inner ? b : a;
  const nb = { center: board.center, left: [...board.left], right: [...board.right] };
  (side === 'L' ? nb.left : nb.right).push({ id, inner, outer });
  const items = layoutBoard(nb, limit);
  const tag = side === 'L' ? 'l' : 'r';
  const idx = (side === 'L' ? nb.left : nb.right).length - 1;
  return items.find(it => it.key === tag + idx);
}

function bbox(items) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const it of items) {
    const hw = it.vertical ? 0.5 : 1, hh = it.vertical ? 1 : 0.5;
    x0 = Math.min(x0, it.cx - hw); x1 = Math.max(x1, it.cx + hw);
    y0 = Math.min(y0, it.cy - hh); y1 = Math.max(y1, it.cy + hh);
  }
  return { x0, y0, x1, y1 };
}

/** Konteyner boyutuna göre birim ve sınır hesapla. */
export function boardMetrics(W, H) {
  let u = Math.max(15, Math.min(50, W / 10.5, H / 8));
  let limit = W / (2 * u) - 0.3;
  if (limit < 4.6) { limit = 4.6; u = W / (2 * (limit + 0.3)); }
  return { u, limit };
}

/**
 * Masayı SVG olarak çiz.
 * ghosts: [{side, item, cls}] — tıklanabilir hedefler
 */
export function renderBoard(svgEl, board, W, H, opts = {}) {
  const { u, limit } = boardMetrics(W, H);
  const items = layoutBoard(board, limit);
  const ghosts = (opts.ghosts || []).filter(g => g.item);
  const all = [...items, ...ghosts.map(g => g.item)];
  const halfW = W / (2 * u);
  let halfH = H / (2 * u);
  if (all.length) {
    const bb = bbox(all);
    const need = Math.max(Math.abs(bb.y0), Math.abs(bb.y1)) + 0.4;
    const needW = Math.max(Math.abs(bb.x0), Math.abs(bb.x1)) + 0.3;
    const scale = Math.max(need / halfH, needW / halfW, 1);
    halfH *= scale;
    const hw = halfW * scale;
    svgEl.setAttribute('viewBox', `${(-hw).toFixed(3)} ${(-halfH).toFixed(3)} ${(2 * hw).toFixed(3)} ${(2 * halfH).toFixed(3)}`);
  } else {
    svgEl.setAttribute('viewBox', `${-halfW} ${-halfH} ${2 * halfW} ${2 * halfH}`);
  }
  let html = '';
  for (const it of items) {
    const cls = (it.id === opts.newId ? 'new ' : '') + (it.id === opts.lastId ? 'last' : '');
    html += tileGroup(it, cls);
  }
  for (const g of ghosts) {
    const it = g.item;
    const w = it.vertical ? 1 : 2, h = it.vertical ? 2 : 1;
    html += `<g class="ghost ${g.cls || ''}" data-side="${g.side}"><rect x="${(it.cx - w / 2 + 0.04).toFixed(3)}" y="${(it.cy - h / 2 + 0.04).toFixed(3)}" width="${w - 0.08}" height="${h - 0.08}" rx="0.14"/><text x="${it.cx}" y="${it.cy + 0.18}" text-anchor="middle">${g.label ?? ''}</text></g>`;
  }
  svgEl.innerHTML = html;
  return { items, u, limit };
}

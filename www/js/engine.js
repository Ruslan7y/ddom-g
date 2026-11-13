// Domino 101 — kural motoru (Klassik 101)
// Taşlar 0..27 arası id ile tutulur. TILES[id] = [a, b] (a <= b)

export const TILES = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) TILES.push([a, b]);
export const TILE_ID = {};
TILES.forEach((t, i) => { TILE_ID[t[0] + '-' + t[1]] = i; });
export const idOf = (a, b) => TILE_ID[Math.min(a, b) + '-' + Math.max(a, b)];

export const isDouble = id => TILES[id][0] === TILES[id][1];
export const hasNum = (id, n) => TILES[id][0] === n || TILES[id][1] === n;
export const pips = id => TILES[id][0] + TILES[id][1];
export const otherEnd = (id, n) => (TILES[id][0] === n ? TILES[id][1] : TILES[id][0]);
export const ZERO_DOUBLE = 0; // [0,0]

/** Eldeki ceza/puan değeri. Elde yalnız 0:0 kaldıysa 10 sayılır. */
export function handValue(hand) {
  if (hand.length === 1 && hand[0] === ZERO_DOUBLE) return 10;
  let s = 0;
  for (const id of hand) s += pips(id);
  return s;
}

export const TARGET = 101;
export const MATCH_TARGET = 3;
export const HAND_SIZE = 7;
export const BONEYARD_KEEP = 2; // 2 kişilikte pazarda son 2 taş kalır

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Bir elin yeniden dağıtım gerektirip gerektirmediği. null = sorun yok */
export function badHandReason(hand) {
  for (let n = 0; n <= 6; n++) {
    const cnt = hand.filter(id => hasNum(id, n)).length;
    if (cnt > 5) return { type: 'tooMany', number: n, count: cnt };
    if (cnt === 5 && !hand.includes(idOf(n, n))) return { type: 'fiveNoDouble', number: n, count: cnt };
  }
  return null;
}

/**
 * Maç durumu. players: [{name, avatar, bot: bool, level}]
 * Oturma: 0 = alt (insan), sıra her zaman soldakine geçer: 0 → 1 → 2 → 3.
 * 4 kişilikte 0&2 ve 1&3 takımdır. Taraf (side) = oyuncu % 2.
 */
export class Match {
  constructor(players, rng = Math.random) {
    this.players = players;
    this.n = players.length;
    this.rng = rng;
    this.general = [0, 0];
    this.gameNo = 1;
    this.scores = [0, 0];
    this.pending = 0; // nöbet
    this.handNo = 0;
    this.over = false;
    this.log = [];
  }

  side(p) { return p % 2; }
  partner(p) { return this.n === 4 ? (p + 2) % 4 : -1; }
  next(p) { return (p + 1) % this.n; }
  sidePlayers(s) { return this.n === 4 ? [s, s + 2] : [s]; }
  get openingDouble() { return ((this.gameNo - 1) % 6) + 1; } // 1:1, 2:2, ... 6:6

  /**
   * Yeni el dağıtır.
   * opening = true ise oyunun ilk eli: çifte ile açılır.
   * starter = opening değilse eli başlatacak oyuncu.
   * Döner: { redeals: [...] }
   */
  deal(opening, starter = 0) {
    const redeals = [];
    let guard = 0;
    for (;;) {
      if (++guard > 5000) throw new Error('deal loop');
      const deck = shuffle([...Array(28).keys()], this.rng);
      const hands = [];
      for (let p = 0; p < this.n; p++) hands.push(deck.slice(p * HAND_SIZE, (p + 1) * HAND_SIZE));
      const boneyard = deck.slice(this.n * HAND_SIZE);

      let bad = null;
      for (let p = 0; p < this.n && !bad; p++) {
        const r = badHandReason(hands[p]);
        if (r) bad = { ...r, player: p, tiles: [...hands[p]] };
      }
      if (bad) { redeals.push(bad); continue; }

      let forced = null;
      let first = starter;
      if (opening) {
        // Açılış çiftesini bul (2 kişilikte sırayla sonraki çiftelere bakılır)
        const d0 = this.openingDouble;
        const order = [];
        for (let k = 0; k < 7; k++) order.push((d0 + k) % 7);
        if (this.n === 4) order.length = 1; // 4 kişilikte bütün taşlar dağıtılır, çifte mutlaka vardır
        for (const d of order) {
          const id = idOf(d, d);
          const holder = hands.findIndex(h => h.includes(id));
          if (holder >= 0) { forced = id; first = holder; break; }
        }
        if (forced === null) { redeals.push({ type: 'noDouble', number: d0, player: -1, tiles: [] }); continue; }

        // Takım oyununda adalet: rakip takımda açılış sayısından en az bir taş olmalı
        if (this.n === 4) {
          const num = TILES[forced][0];
          const opp = this.sidePlayers(1 - this.side(first));
          const ok = opp.some(p => hands[p].some(id => hasNum(id, num)));
          if (!ok) { redeals.push({ type: 'teamNoNumber', number: num, player: opp[0], tiles: [] }); continue; }
        }
      }

      this.hands = hands;
      this.boneyard = boneyard;
      this.board = { center: null, left: [], right: [] };
      this.history = [];
      this.turn = first;
      this.forced = forced;
      this.passes = 0;
      this.voids = Array.from({ length: this.n }, () => new Set());
      this.handOver = null;
      this.handNo++;
      this.redealsThisHand = redeals;
      return { redeals, starter: first, forced };
    }
  }

  get ends() {
    const b = this.board;
    if (b.center === null) return null;
    const L = b.left.length ? b.left[b.left.length - 1].outer : b.center.l;
    const R = b.right.length ? b.right[b.right.length - 1].outer : b.center.r;
    return [L, R];
  }

  boardTiles() {
    const b = this.board;
    if (b.center === null) return [];
    return [b.center.id, ...b.left.map(x => x.id), ...b.right.map(x => x.id)];
  }

  /** p oyuncusunun yasal hamleleri: [{id, side: 'C'|'L'|'R'}] */
  legalMoves(p) {
    const hand = this.hands[p];
    if (this.board.center === null) {
      if (this.forced !== null) return hand.includes(this.forced) ? [{ id: this.forced, side: 'C' }] : [];
      return hand.map(id => ({ id, side: 'C' }));
    }
    const [L, R] = this.ends;
    const res = [];
    for (const id of hand) {
      const okL = hasNum(id, L), okR = hasNum(id, R);
      if (okL) res.push({ id, side: 'L' });
      if (okR && !(okL && L === R)) res.push({ id, side: 'R' });
    }
    return res;
  }

  canDraw(p) {
    return this.n === 2 && this.boneyard.length > BONEYARD_KEEP && this.legalMoves(p).length === 0;
  }

  /** 2 kişilik: pazardan iki taş çek. Çekilen taşları döner. */
  draw(p) {
    if (!this.canDraw(p)) return [];
    const [L, R] = this.ends || [-1, -1];
    const got = this.boneyard.splice(0, 2);
    this.hands[p].push(...got);
    this.voids[p].add(L); this.voids[p].add(R);
    this.history.push({ type: 'draw', p, count: got.length });
    if (this.legalMoves(p).length > 0) { this.voids[p].delete(L); this.voids[p].delete(R); }
    return got;
  }

  /** Pas: sadece hamle ve çekme yoksa. */
  pass(p) {
    if (this.legalMoves(p).length || this.canDraw(p)) throw new Error('illegal pass');
    const [L, R] = this.ends;
    this.voids[p].add(L); this.voids[p].add(R);
    this.history.push({ type: 'pass', p });
    this.passes++;
    return this.afterAction(p);
  }

  play(p, id, side) {
    if (p !== this.turn) throw new Error('not your turn');
    const hand = this.hands[p];
    if (!hand.includes(id)) throw new Error('tile not in hand');
    if (this.board.center === null) {
      if (this.forced !== null && id !== this.forced) throw new Error('must open with forced double');
      side = 'C';
    } else {
      const [L, R] = this.ends;
      if (side !== 'L' && side !== 'R') side = hasNum(id, R) ? 'R' : 'L';
      if (!hasNum(id, side === 'L' ? L : R)) throw new Error('illegal move');
    }
    const legal = { side };
    hand.splice(hand.indexOf(id), 1);
    const [a, b] = TILES[id];
    if (this.board.center === null) {
      this.board.center = { id, l: a, r: b };
      this.forced = null;
    } else {
      const [L, R] = this.ends;
      const s = legal.side;
      const inner = s === 'L' ? L : R;
      const entry = { id, inner, outer: otherEnd(id, inner) };
      (s === 'L' ? this.board.left : this.board.right).push(entry);
    }
    this.history.push({ type: 'play', p, id, side: legal.side });
    this.passes = 0;
    if (hand.length === 0) return this.finishHand({ kind: 'domino', player: p });
    return this.afterAction(p);
  }

  isBlocked() {
    const e = this.ends;
    if (!e) return false;
    const [L, R] = e;
    if (L === R) {
      const onBoard = this.boardTiles().filter(id => hasNum(id, L)).length;
      if (onBoard === 7) return true;
    }
    for (let p = 0; p < this.n; p++) if (this.legalMoves(p).length) return false;
    if (this.n === 2 && this.boneyard.length > BONEYARD_KEEP) return false;
    return true;
  }

  afterAction(p) {
    if (this.isBlocked()) return this.finishHand({ kind: 'blocked' });
    this.turn = this.next(p);
    return null;
  }

  /** Bağlı oyunda yeni eli başlatacak taraf: son taşı koyan (son taş çifteyse ondan öncekini koyan). */
  lastPlacerSide() {
    const plays = this.history.filter(h => h.type === 'play');
    for (let i = plays.length - 1; i >= 0; i--) {
      if (!isDouble(plays[i].id)) return this.side(plays[i].p);
    }
    return plays.length ? this.side(plays[plays.length - 1].p) : 0;
  }

  sideRemaining(s) {
    return this.sidePlayers(s).reduce((acc, p) => acc + handValue(this.hands[p]), 0);
  }

  finishHand(info) {
    const rem = [this.sideRemaining(0), this.sideRemaining(1)];
    const res = {
      kind: info.kind,
      player: info.player ?? -1,
      remaining: rem,
      hands: this.hands.map(h => [...h]),
      handValues: this.hands.map(h => handValue(h)),
      pendingBefore: this.pending,
      winnerSide: -1,
      gained: 0,
      tie: false,
      nextStarterSide: 0,
      gameWon: -1,
      generalGained: 0,
      matchWon: -1,
      mars: false,
    };
    if (info.kind === 'domino') {
      const s = this.side(info.player);
      res.winnerSide = s;
      res.gained = rem[1 - s] + this.pending;
      this.pending = 0;
      res.nextStarterSide = s;
    } else {
      if (rem[0] === rem[1]) {
        res.tie = true;
        this.pending += rem[0];
      } else {
        const s = rem[0] < rem[1] ? 0 : 1;
        res.winnerSide = s;
        res.gained = rem[1 - s] + this.pending;
        this.pending = 0;
      }
      res.nextStarterSide = this.lastPlacerSide();
    }
    if (res.winnerSide >= 0) this.scores[res.winnerSide] += res.gained;
    res.scores = [...this.scores];
    res.pendingAfter = this.pending;

    // Oyun (101) bitti mi?
    const ws = res.winnerSide;
    if (ws >= 0 && this.scores[ws] >= TARGET) {
      res.gameWon = ws;
      res.generalGained = this.scores[1 - ws] === 0 ? 2 : 1;
      this.general[ws] += res.generalGained;
      res.general = [...this.general];
      if (this.general[ws] >= MATCH_TARGET) {
        res.matchWon = ws;
        res.mars = this.general[1 - ws] === 0;
        this.over = true;
      }
    }
    res.general = [...this.general];
    res.gameNo = this.gameNo;
    this.handOver = res;
    this.log.push(res);
    return res;
  }

  /** Bir el bittikten sonra bir sonrakini hazırlar. Döner: {opening, starterSide} */
  prepareNext() {
    const r = this.handOver;
    if (!r || this.over) return null;
    if (r.gameWon >= 0) {
      this.gameNo++;
      this.scores = [0, 0];
      this.pending = 0;
      return { opening: true };
    }
    return { opening: false, starterSide: r.nextStarterSide };
  }
}

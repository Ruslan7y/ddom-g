// Motor testleri: node tests/engine.test.mjs
import { Match, TILES, idOf, handValue, badHandReason, hasNum } from '../www/js/engine.js';
import { chooseMove, chooseStarter } from '../www/js/ai.js';
import assert from 'node:assert/strict';

let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// Birim testleri
assert.equal(TILES.length, 28);
assert.equal(handValue([idOf(0, 0)]), 10);
assert.equal(handValue([idOf(0, 0), idOf(1, 2)]), 3);
assert.equal(handValue([idOf(6, 6), idOf(5, 4)]), 21);
assert.equal(badHandReason([idOf(1,0),idOf(1,2),idOf(1,3),idOf(1,4),idOf(1,5),idOf(1,6),idOf(2,3)]).type, 'tooMany');
assert.equal(badHandReason([idOf(1,0),idOf(1,2),idOf(1,3),idOf(1,4),idOf(1,5),idOf(2,6),idOf(2,3)]).type, 'fiveNoDouble');
assert.equal(badHandReason([idOf(1,1),idOf(1,2),idOf(1,3),idOf(1,4),idOf(1,5),idOf(2,6),idOf(2,3)]), null);

function playMatch(n, levels) {
  const players = Array.from({ length: n }, (_, i) => ({ name: 'P' + i, bot: true }));
  const m = new Match(players, rng);
  let opening = true, starter = 0, hands = 0;
  const stats = { hands: 0, blocked: 0, ties: 0, redeals: 0, games: 0 };
  while (!m.over) {
    const d = m.deal(opening, starter);
    stats.redeals += d.redeals.length;
    // Dağıtım kuralları
    for (const h of m.hands) assert.equal(badHandReason(h), null);
    assert.equal(new Set(m.hands.flat().concat(m.boneyard)).size, 28);
    if (opening) {
      assert.ok(m.hands[m.turn].includes(m.forced));
      if (n === 4) {
        assert.equal(m.forced, idOf(m.openingDouble, m.openingDouble));
        const num = TILES[m.forced][0];
        const opp = m.sidePlayers(1 - m.side(m.turn));
        assert.ok(opp.some(p => m.hands[p].some(id => hasNum(id, num))));
      }
    } else if (n === 4) {
      m.turn = chooseStarter(m, m.side(starter));
    }
    let res = null, guard = 0;
    while (!res) {
      assert.ok(++guard < 500);
      const p = m.turn;
      const lv = levels[p % levels.length];
      const legal = m.legalMoves(p);
      if (legal.length) {
        const mv = chooseMove(m, p, lv, rng);
        res = m.play(p, mv.id, mv.side);
      } else if (m.canDraw(p)) {
        m.draw(p);
        assert.ok(m.boneyard.length >= 2);
      } else {
        res = m.pass(p);
      }
    }
    stats.hands++;
    if (res.kind === 'blocked') stats.blocked++;
    if (res.tie) stats.ties++;
    if (res.gameWon >= 0) stats.games++;
    // Puan tutarlılığı
    if (res.kind === 'domino') assert.equal(res.gained, res.remaining[1 - res.winnerSide] + res.pendingBefore);
    if (res.kind === 'blocked' && !res.tie) {
      assert.ok(res.remaining[res.winnerSide] < res.remaining[1 - res.winnerSide]);
      assert.equal(res.gained, res.remaining[1 - res.winnerSide] + res.pendingBefore);
    }
    const nx = m.prepareNext();
    if (!nx) break;
    opening = nx.opening;
    starter = nx.opening ? 0 : (n === 2 ? nx.starterSide : nx.starterSide);
  }
  assert.ok(m.general[0] >= 3 || m.general[1] >= 3);
  const w = m.general[0] >= 3 ? 0 : 1;
  return { winner: w, stats, general: m.general, mars: m.general[1 - w] === 0 };
}

let t0 = Date.now();
const agg = { hands: 0, blocked: 0, ties: 0, redeals: 0, games: 0 };
for (let i = 0; i < 40; i++) {
  const r = playMatch(i % 2 ? 4 : 2, ['medium']);
  for (const k in agg) agg[k] += r.stats[k];
}
console.log('40 maç (orta botlar) OK', agg, (Date.now() - t0) + 'ms');

// Seviye karşılaştırması: zor vs kolay, usta vs orta (2 kişilik)
function duel(a, b, N, n = 2) {
  let wa = 0; const t = Date.now();
  for (let i = 0; i < N; i++) { const r = playMatch(n, [a, b]); if (r.winner === 0) wa++; }
  console.log(`${n}p ${a} vs ${b}: ${wa}/${N}  (${Date.now() - t}ms)`);
}
duel('medium', 'easy', 30);
duel('hard', 'medium', 16);
duel('expert', 'medium', 10);
duel('hard', 'medium', 10, 4);
console.log('Tüm testler geçti ✓');

import { stageConfig, fairDeal } from '../www/js/levels.js';
import { Match } from '../www/js/engine.js';
import assert from 'node:assert/strict';
for (const i of [1, 5, 11, 12, 25, 40, 60, 75]) {
  const c = stageConfig(i);
  const players = Array.from({ length: c.mode }, (_, k) => ({ name: 'P' + k }));
  const t = Date.now(); let ok = 0, ways = 0, best = 0;
  for (let k = 0; k < 10; k++) {
    const m = new Match(players);
    const ev = fairDeal(m, c);
    assert.equal(m.turn, 0);
    assert.equal(new Set(m.hands.flat().concat(m.boneyard)).size, 28);
    if (ev.best >= c.band[0] && ev.best <= c.band[1] && ev.ways >= 2) ok++;
    ways += ev.ways; best += ev.best;
  }
  console.log(`aşama ${i} ${c.goal} ${c.bot} ${c.mode}p hedef=${c.target} | uygun ${ok}/10, ort. yol ${(ways/10).toFixed(1)}, ort. kazanma ${(best/10).toFixed(2)} | ${((Date.now()-t)/10).toFixed(0)}ms/el`);
}
console.log('Aşama testleri geçti ✓');

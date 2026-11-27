import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createFarmCrops } from '../src/farm-crops.js';

const config = JSON.parse(readFileSync(new URL('../assets/farm/seeds.json', import.meta.url), 'utf8'));
const { plots } = JSON.parse(readFileSync(new URL('../assets/farm/scene.json', import.meta.url), 'utf8'));
const plotIds = plots.map(plot => plot.id);
const hour = 3_600_000;
const seed = (id, count, days = 1) => ({ id, name: id, count, days });

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('the whale tries unplanted configured varieties first without charging for a plan or a retry', () => {
  const farm = createFarmCrops(config, plotIds);
  const eligible = config.filter(seed => seed.count > 0);
  const seen = new Set();
  for (let i = 0; i < Math.min(plotIds.length, eligible.length); i++) {
    const plan = farm.choosePlanting();
    assert.ok(plan);
    assert.ok(!seen.has(plan.seedId), plan.seedId);
    seen.add(plan.seedId);
    assert.equal(farm.getCrops().length, i);
    const before = farm.getSeeds().find(s => s.id === plan.seedId).count;
    const crop = farm.plant(plan.plotId, plan.seedId);
    assert.equal(crop.count, Math.min(before, 3));
    assert.equal(farm.plant(plan.plotId, plan.seedId), null);
    assert.equal(farm.getSeeds().find(s => s.id === plan.seedId).count, before - crop.count);
  }
  if (eligible.length <= plotIds.length) assert.deepEqual(seen, new Set(eligible.map(s => s.id)));
  if (farm.getCrops().length === plotIds.length) assert.equal(farm.choosePlanting(), null);
});

test('partial stock, zero stock and new configured varieties use the same planting rules', () => {
  const farm = createFarmCrops([seed('empty', 0), { ...seed('new-variety', 4), icon: 'tomato' }], plotIds);
  assert.equal(farm.plant('nonexistent', 'new-variety'), null);
  assert.equal(farm.plant(plotIds[0], 'empty'), null);
  assert.equal(farm.plant(plotIds[0], 'unknown'), null);
  assert.equal(farm.plant(plotIds[0], 'new-variety').count, 3);
  const plan = farm.choosePlanting();
  const last = farm.plant(plan.plotId, plan.seedId);
  assert.equal(last.count, 1);
  assert.equal(last.icon, 'tomato');
  assert.equal(farm.choosePlanting(), null);
  assert.equal(farm.plant(plotIds[3], 'new-variety'), null);
});

test('elapsed wall time advances both growth boundaries, including time spent away', () => {
  const storage = memoryStorage();
  let time = 1_000_000;
  const options = { storage, now: () => time };
  const seeds = [seed('pea', 6), seed('instant', 2, 0)];
  const farm = createFarmCrops(seeds, plotIds, options);
  const { plantedAt } = farm.plant(plotIds[0], 'pea');
  assert.equal(farm.plant(plotIds[1], 'instant').stage, 3);
  for (const [elapsed, stage] of [[-1, 1], [12 * hour - 1, 1], [12 * hour, 2], [24 * hour - 1, 2], [24 * hour, 3], [72 * hour, 3]]) {
    time = plantedAt + elapsed;
    assert.equal(farm.getCrops()[0].stage, stage);
    const reopened = createFarmCrops(seeds, plotIds, options);
    assert.equal(reopened.getCrops()[0].stage, stage);
    assert.equal(reopened.getSeeds()[0].count, 3);
  }
});

test('planting rechecks the saved plot and available stock when another page has used them', () => {
  const storage = memoryStorage();
  const seeds = [seed('pea', 5)];
  const a = createFarmCrops(seeds, plotIds, { storage });
  const b = createFarmCrops(seeds, plotIds, { storage });
  a.plant(plotIds[0], 'pea');
  assert.equal(b.plant(plotIds[0], 'pea'), null);
  assert.equal(b.plant(plotIds[1], 'pea').count, 2);
  a.reload();
  assert.equal(a.getSeeds()[0].count, 0);
  assert.equal(a.getCrops().length, 2);
});

test('updated file stock reflects prior debits and runtime replacement starts from the supplied stock', () => {
  const storage = memoryStorage();
  const original = createFarmCrops([seed('pea', 5)], plotIds, { storage });
  original.plant(plotIds[0], 'pea');
  const revised = createFarmCrops([seed('pea', 12)], plotIds, { storage });
  assert.equal(revised.getSeeds()[0].count, 9);
  let updates = 0;
  const unsubscribe = revised.subscribe(() => updates++);
  revised.setSeeds([seed('pea', 2, 4)]);
  assert.equal(revised.getSeeds()[0].count, 2);
  assert.equal(revised.getCrops()[0].days, 1);
  assert.equal(revised.plant(plotIds[1], 'pea').count, 2);
  assert.equal(revised.getCrops()[1].days, 4);
  assert.equal(revised.getSeeds()[0].count, 0);
  assert.equal(updates, 2);
  unsubscribe();
  revised.setSeeds([]);
  assert.equal(updates, 2);
  assert.equal(createFarmCrops([seed('pea', 12)], plotIds, { storage }).getSeeds()[0].count, 7);
});

test('denied storage still allows planting and tracks inventory for this session', () => {
  const denied = () => { throw new Error('storage denied'); };
  const farm = createFarmCrops([seed('pea', 4)], plotIds, { storage: { getItem: denied, setItem: denied } });
  farm.plant(plotIds[0], 'pea');
  assert.equal(farm.plant(plotIds[0], 'pea'), null);
  assert.equal(farm.getSeeds()[0].count, 1);
});

test('a failed save keeps the crop and its inventory debit together on later reload events', () => {
  const storage = memoryStorage();
  const seeds = [seed('pea', 5)];
  const saved = createFarmCrops(seeds, plotIds, { storage });
  const local = createFarmCrops(seeds, plotIds, { storage: {
    getItem: storage.getItem,
    setItem() { throw new Error('quota'); },
  } });
  local.plant(plotIds[0], 'pea');
  saved.plant(plotIds[1], 'pea');
  local.reload();
  assert.deepEqual(local.getCrops().map(crop => crop.plotId), [plotIds[0]]);
  assert.equal(local.getSeeds()[0].count, 2);
});

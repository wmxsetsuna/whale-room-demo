import { readSeedInventory } from './seed-library.js';

export const FARM_CROPS_STORAGE_KEY = 'whale-room.farm-crops.v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const PLANTS_PER_PLOT = 3;

function growthStage(crop, time) {
  const age = Math.max(0, time - crop.plantedAt);
  const duration = crop.days * DAY_MS;
  if (age >= duration) return 3;
  return age >= duration / 2 ? 2 : 1;
}

function validCrop(crop) {
  return crop && typeof crop.plotId === 'string' && typeof crop.seedId === 'string' &&
    typeof crop.name === 'string' && typeof crop.icon === 'string' &&
    Number.isSafeInteger(crop.count) && crop.count > 0 && crop.count <= PLANTS_PER_PLOT &&
    Number.isSafeInteger(crop.days) && crop.days >= 0 &&
    Number.isSafeInteger(crop.plantedAt) && crop.plantedAt >= 0;
}

export function createFarmCrops(initialSeeds, plotIds, { storage, now = Date.now, random = Math.random } = {}) {
  const plots = new Set(plotIds);
  const listeners = new Set();
  let seeds = readSeedInventory(initialSeeds);
  let crops = new Map();
  let lastStored = null;
  let spentAtReplacement = new Map();

  // Inventory and occupancy come from the same planting records. A rebuild can
  // change the configured supply without overwriting the seeds already sown.
  function spentSeeds() {
    const totals = new Map();
    for (const crop of crops.values()) {
      totals.set(crop.seedId, (totals.get(crop.seedId) ?? 0) + crop.count);
    }
    return totals;
  }

  function getSeeds() {
    const spent = spentSeeds();
    return seeds.map(seed => {
      const used = Math.max(0, (spent.get(seed.id) ?? 0) - (spentAtReplacement.get(seed.id) ?? 0));
      return { ...seed, seasons: [...seed.seasons], count: Math.max(0, seed.count - used) };
    });
  }

  function getCrops() {
    const time = now();
    return [...crops.values()].filter(crop => plots.has(crop.plotId))
      .map(crop => ({ ...crop, stage: growthStage(crop, time) }));
  }

  function readStored() {
    if (!storage) return false;
    try {
      const raw = storage.getItem(FARM_CROPS_STORAGE_KEY);
      if (raw === lastStored) return false;
      const saved = raw === null ? [] : JSON.parse(raw);
      if (!Array.isArray(saved)) return false;
      crops = new Map(saved.filter(validCrop).map(crop => [crop.plotId, crop]));
      lastStored = raw;
      return true;
    } catch {
      return false;
    }
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function reload() {
    if (readStored()) notify();
  }

  function setSeeds(list) {
    const replacement = readSeedInventory(list);
    readStored();
    // setSeeds supplies the currently available stock on this page, including
    // any prior debits. Only subsequent planting should reduce it.
    spentAtReplacement = spentSeeds();
    seeds = replacement;
    notify();
  }

  function choosePlanting() {
    const empty = [...plots].filter(plot => !crops.has(plot));
    const available = getSeeds().filter(seed => seed.count > 0);
    if (!empty.length || !available.length) return null;
    const growing = new Set(getCrops().map(crop => crop.seedId));
    const missing = available.filter(seed => !growing.has(seed.id));
    const pick = list => list[Math.floor(random() * list.length)];
    const seed = pick(missing.length ? missing : available);
    return { plotId: pick(empty), seedId: seed.id, name: seed.name };
  }

  function plant(plotId, seedId) {
    const changed = readStored();
    const seed = getSeeds().find(item => item.id === seedId);
    if (!plots.has(plotId) || crops.has(plotId) || !seed?.count) {
      if (changed) notify();
      return null;
    }
    const plantedAt = now();
    const crop = {
      plotId, seedId, name: seed.name, icon: seed.icon, days: seed.days,
      count: Math.min(PLANTS_PER_PLOT, seed.count), plantedAt,
    };
    crops.set(plotId, crop);
    if (storage) {
      try {
        const raw = JSON.stringify([...crops.values()]);
        storage.setItem(FARM_CROPS_STORAGE_KEY, raw);
        lastStored = raw;
      } catch {
        // Keep this page's crops and their debits together, even if another
        // tab updates a save that this page can no longer write.
        storage = null;
      }
    }
    notify();
    return { ...crop, stage: growthStage(crop, plantedAt) };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  readStored();
  return { getSeeds, getCrops, choosePlanting, plant, setSeeds, subscribe, reload };
}

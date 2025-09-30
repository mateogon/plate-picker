import { fmt } from "./utils.js";

const EPS = 1e-6;

export function generateCombos(meta, prefs, options = {}){
  if (!meta || !Array.isArray(meta.plates) || meta.plates.length === 0) return [];

  const bar = typeof meta.bar_kg === "number" ? meta.bar_kg : 20;
  const limits = meta.limits || {};
  const defaultLimit = typeof limits.default === "number" ? limits.default : 2;
  const overrides = limits.overrides || {};
  const range = meta.range || {};
  const allowedMin = typeof range.min === "number" ? range.min : -Infinity;
  const allowedMax = typeof range.max === "number" ? range.max : Infinity;

  let minTotal = Number.isFinite(options.minTotal) ? options.minTotal : allowedMin;
  let maxTotal = Number.isFinite(options.maxTotal) ? options.maxTotal : allowedMax;
  if (minTotal > maxTotal) [minTotal, maxTotal] = [maxTotal, minTotal];

  const clampMin = Math.max(minTotal, allowedMin);
  const clampMax = Math.min(maxTotal, allowedMax);
  if (clampMin > clampMax + EPS) return [];

  const extraMargin = Math.max(0, Number(options.extraMargin) || 0);
  const searchMax = Math.min(clampMax + extraMargin, allowedMax);
  const sideMax = Math.max(0, (searchMax - bar) / 2);

  const plates = meta.plates.map((p, idx) => ({
    label: p.label,
    kg: p.kg,
    fam: p.fam,
    color: p.color,
    idx,
    limit: overrides[p.label] ?? defaultLimit
  }));

  const plateIndexByLabel = new Map(plates.map(p => [p.label, p.idx]));

  const sortedIndices = plates
    .map(p => p.idx)
    .sort((a, b) => {
      const diff = plates[b].kg - plates[a].kg;
      return Math.abs(diff) > EPS ? diff : a - b;
    });

  const maxPlatesPerSide = prefs?.maxPlatesPerSide ?? 12;
  const maxCombosPerTotal = Math.max(1, prefs?.maxCombosPerTotal ?? 10);
  const capInput = Math.max(1, Math.floor(Number(options.capPerWeight) || 1));
  const capKeep = Math.max(1, Math.min(capInput, maxCombosPerTotal));

  const heavyPrefIdx = (prefs?.heavyPrefOrder || [])
    .map(label => plateIndexByLabel.get(label))
    .filter(idx => idx !== undefined);
  const microIdx = (prefs?.microLabels || [])
    .map(label => plateIndexByLabel.get(label))
    .filter(idx => idx !== undefined);

  const unitFilter = options.unitFilter;
  const allowedFam = unitFilter === "kg" || unitFilter === "lb" ? unitFilter : null;

  const mergePatterns = buildMergePatterns(plates);
  const maxLimits = plates.map(p => p.limit);

  const combosByTotal = new Map();
  const seen = new Set();
  const counts = new Array(plates.length).fill(0);

  function dfs(pos, currentWeight, platesUsed){
    if (currentWeight > sideMax + EPS) return;
    if (platesUsed > maxPlatesPerSide) return;

    if (pos === sortedIndices.length){
      const totalKg = fmt(bar + currentWeight * 2);
      if (totalKg < clampMin - EPS || totalKg > clampMax + EPS) return;
      const signature = counts.join(",");
      if (seen.has(signature)) return;
      if (isDominated(counts, mergePatterns, maxLimits)) return;
      seen.add(signature);

      const combo = buildComboInfo(counts, sortedIndices, plates, heavyPrefIdx, microIdx);
      const bucket = combosByTotal.get(totalKg) || [];
      bucket.push(combo);
      combosByTotal.set(totalKg, bucket);
      return;
    }

    const plateIdx = sortedIndices[pos];
    const plate = plates[plateIdx];

    const remainingSlots = maxPlatesPerSide - platesUsed;
    let limitCount = Math.min(plate.limit, remainingSlots);
    if (limitCount <= 0){
      counts[plateIdx] = 0;
      dfs(pos + 1, currentWeight, platesUsed);
      return;
    }

    if (allowedFam && plate.fam !== allowedFam){
      counts[plateIdx] = 0;
      dfs(pos + 1, currentWeight, platesUsed);
      return;
    }

    const remainingWeight = sideMax - currentWeight;
    const weightLimit = plate.kg > EPS ? Math.floor((remainingWeight + EPS) / plate.kg) : 0;
    if (weightLimit < limitCount) limitCount = weightLimit;
    if (limitCount < 0) limitCount = 0;

    for (let count = limitCount; count >= 0; count--){
      counts[plateIdx] = count;
      dfs(pos + 1, currentWeight + count * plate.kg, platesUsed + count);
    }
    counts[plateIdx] = 0;
  }

  dfs(0, 0, 0);

  const results = [];
  for (const [kg, combos] of combosByTotal){
    if (!combos || combos.length === 0) continue;

    const minMicro = Math.min(...combos.map(c => c.micro));
    let filtered = combos.filter(c => c.micro === minMicro);
    const minPlates = Math.min(...filtered.map(c => c.plates));
    filtered = filtered.filter(c => c.plates === minPlates);

    filtered.sort((a, b) => compareCombos(a, b, heavyPrefIdx));
    const kept = filtered.slice(0, capKeep);
    if (kept.length === 0) continue;

    results.push({
      kg: kg,
      combos: kept.map(c => c.indexes),
      minPlates: kept[0].plates
    });
  }

  results.sort((a, b) => a.kg - b.kg);
  return results;
}

function buildComboInfo(counts, sortedIndices, plates, heavyPrefIdx, microIdx){
  const indexes = [];
  for (const idx of sortedIndices){
    const count = counts[idx];
    for (let i = 0; i < count; i++) indexes.push(idx);
  }

  let micro = 0;
  for (const idx of microIdx) micro += counts[idx] || 0;

  const heavyVec = heavyPrefIdx.map(idx => -(counts[idx] || 0));

  return {
    indexes,
    micro,
    plates: indexes.length,
    heavyVec
  };
}

function compareCombos(a, b, heavyPrefIdx){
  const len = Math.min(a.heavyVec.length, b.heavyVec.length);
  for (let i = 0; i < len; i++){
    const diff = a.heavyVec[i] - b.heavyVec[i];
    if (diff !== 0) return diff;
  }
  const minLen = Math.min(a.indexes.length, b.indexes.length);
  for (let i = 0; i < minLen; i++){
    if (a.indexes[i] !== b.indexes[i]) return a.indexes[i] - b.indexes[i];
  }
  return a.indexes.length - b.indexes.length;
}

function isDominated(counts, patterns, limits){
  for (const pattern of patterns){
    const targetIdx = pattern.targetIdx;
    if (counts[targetIdx] >= limits[targetIdx]) continue;
    let times = Infinity;
    for (const part of pattern.parts){
      const have = counts[part.idx] || 0;
      if (have < part.count){
        times = 0;
        break;
      }
      const possible = Math.floor(have / part.count);
      if (possible < times) times = possible;
    }
    if (times >= 1) return true;
  }
  return false;
}

function buildMergePatterns(plates){
  const weightToIdx = new Map();
  for (const plate of plates){
    const key = plate.kg.toFixed(3);
    const arr = weightToIdx.get(key);
    if (arr) arr.push(plate.idx);
    else weightToIdx.set(key, [plate.idx]);
  }

  const patterns = [];
  const indices = plates.map(p => p.idx);
  const combo = [];

  function cwr(start, depth){
    if (combo.length === depth){
      let sum = 0;
      for (const idx of combo) sum += plates[idx].kg;
      const key = sum.toFixed(3);
      const targets = weightToIdx.get(key);
      if (!targets) return;
      const counts = new Map();
      for (const idx of combo){
        counts.set(idx, (counts.get(idx) || 0) + 1);
      }
      const entries = Array.from(counts.entries());
      if (entries.length === 1){
        const [singleIdx, cnt] = entries[0];
        if (cnt === 1 && targets.includes(singleIdx)) return;
      }
      const parts = entries.map(([idx, count]) => ({ idx, count }));
      for (const targetIdx of targets){
        patterns.push({ targetIdx, parts });
      }
      return;
    }
    for (let i = start; i < indices.length; i++){
      combo.push(indices[i]);
      cwr(i, depth);
      combo.pop();
    }
  }

  for (let r = 2; r <= 4; r++) cwr(0, r);
  return patterns;
}

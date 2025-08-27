import { loadData, DATA, INDEX } from "./data.js";
import { nearestKeys, rangeKeys, sortResultsArray } from "./search.js";
import { render } from "./render.js";
import { loadState, bindStateAutosave, saveState } from "./state.js";

const $ = (id) => document.getElementById(id);
const modeSel = $("mode");
const exactBox = $("exactBox");
const rangeBox = $("rangeBox");
const exactKg = $("exactKg");
const minKg = $("minKg");
const maxKg = $("maxKg");
const stepKg = $("stepKg"); // (por ahora no se usa en el filtrado, solo vista)
const tolInp = $("tol");
const capPerWeight = $("capPerWeight");
const sortResults = $("sortResults");
const results = $("results");
const minPlates = $("minPlates");
const maxPlates = $("maxPlates");
const unitFilterSel = $("unitFilter");

modeSel.addEventListener("change", ()=>{
  const isRange = modeSel.value === "range";
  exactBox.style.display = isRange ? "none" : "";
  rangeBox.style.display = isRange ? "" : "none";
});

function runSearch(resetRange = true){
  if (!DATA){ alert("Cargando datos…"); return; }
  const cap = parseInt(capPerWeight?.value || "6", 10);
  const sortResMode = sortResults?.value || "closest_plates";
  const unitFilter = unitFilterSel?.value || "any";

  let keys = [];
  let target = null;

  if (modeSel.value === "exact"){
    target = parseFloat(exactKg.value);
    const tol = parseFloat(tolInp.value || "0.05");
    keys = nearestKeys(INDEX.keys, target, tol);
  } else {
    const a = parseFloat(minKg.value), b = parseFloat(maxKg.value);
    if (isNaN(a)||isNaN(b)||b<a){ alert("Rango inválido"); return; }
    keys = rangeKeys(INDEX.keys, a, b);
  }

  // Arma items
  const itemsRaw = [];
  for (const k of keys){
    const entry = INDEX.byKey.get(k.toFixed(2));
    if (!entry) continue;
    // filtra combos por unidades permitidas
    const allowedFams = unitFilter === "any" ? null : new Set([unitFilter]);
    const combos = (entry.combos || [])
      .filter((combo)=>{
        if (!allowedFams) return true;
        for (const idx of combo){
          const fam = DATA.meta.plates[idx]?.fam;
          if (!allowedFams.has(fam)) return false;
        }
        return true;
      })
      .slice() // copia para no mutar el dataset original
      .sort((a,b)=> a.length - b.length)
      .slice(0, cap);
    itemsRaw.push({
      kg: entry.kg,
      combos,
      minPlates: combos.length ? combos[0].length : Infinity
    });
  }

  let minGlobal = Infinity, maxGlobal = -Infinity;
  for (const it of itemsRaw){
    if (it.minPlates < minGlobal) minGlobal = it.minPlates;
    if (it.minPlates > maxGlobal) maxGlobal = it.minPlates;
  }
  if (!isFinite(minGlobal) || !isFinite(maxGlobal)){
    minGlobal = 0; maxGlobal = 0;
  }
  minPlates.min = minGlobal; minPlates.max = maxGlobal;
  maxPlates.min = minGlobal; maxPlates.max = maxGlobal;
  let minVal, maxVal;
  if (resetRange){
    minVal = minGlobal;
    maxVal = maxGlobal;
  } else {
    minVal = parseInt(minPlates.value || minGlobal, 10);
    maxVal = parseInt(maxPlates.value || maxGlobal, 10);
    if (minVal < minGlobal) minVal = minGlobal;
    if (maxVal > maxGlobal) maxVal = maxGlobal;
    if (minVal > maxVal) maxVal = minVal;
  }
  minPlates.value = String(minVal);
  maxPlates.value = String(maxVal);

  const itemsFiltered = itemsRaw.filter(it => it.minPlates >= minVal && it.minPlates <= maxVal);

  // Ordena resultados (tarjetas)
  const items = sortResultsArray(itemsFiltered, sortResMode, target);
  render(results, items, { target });
  saveState();
}

$("go").addEventListener("click", () => runSearch(true));

minPlates?.addEventListener("change", () => runSearch(false));
maxPlates?.addEventListener("change", () => runSearch(false));
unitFilterSel?.addEventListener("change", () => runSearch(true));

// Inicialización
(async function init(){
  loadState();
  bindStateAutosave();
  await loadData();

  // Registrar SW (HTTPS/localhost)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.warn);
    });
  }
})();

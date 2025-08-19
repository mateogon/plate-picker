import { loadData, DATA, INDEX } from "./data.js";
import { nearestKeys, rangeKeys, sortResultsArray } from "./search.js";
import { render } from "./render.js";
import { loadState, bindStateAutosave } from "./state.js";
import { fmt } from "./utils.js";

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
const emptyPolicy = $("emptyPolicy");
const sortResults = $("sortResults");
const sortCombos = $("sortCombos");
const results = $("results");

modeSel.addEventListener("change", ()=>{
  const isRange = modeSel.value === "range";
  exactBox.style.display = isRange ? "none" : "";
  rangeBox.style.display = isRange ? "" : "none";
});

$("go").addEventListener("click", ()=>{
  if (!DATA){ alert("Cargando datos…"); return; }
  const cap = parseInt(capPerWeight.value || "6", 10);
  const emptyPol = emptyPolicy.value;
  const sortResMode = sortResults.value;
  const sortCombosMode = sortCombos.value;

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
    itemsRaw.push({
      kg: entry.kg,
      combos: (entry.combos || []).slice(0, cap)
    });
  }

  // Ordena resultados (tarjetas)
  const items = sortResultsArray(itemsRaw, sortResMode, target);
  render(results, items, { target, comboSort: sortCombosMode, emptyPolicy: emptyPol });
});

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

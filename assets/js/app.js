import { loadData, DATA, resetData } from "./data.js";
import { generateCombos } from "./generator.js";
import { sortResultsArray } from "./search.js";
import { render } from "./render.js";
import { loadState, bindStateAutosave, saveState } from "./state.js";

const $ = (id) => document.getElementById(id);
const modeSel = $("mode");
const exactBox = $("exactBox");
const percentBox = $("percentBox");
const exactKg = $("exactKg");
const rmKg = $("rmKg");
const rmPct = $("rmPct");
const calcPreview = $("calcPreview");
const tolInp = $("tol");
const capPerWeight = $("capPerWeight");
const sortResults = $("sortResults");
const results = $("results");
const minPlates = $("minPlates");
const maxPlates = $("maxPlates");
const unitFilterSel = $("unitFilter");
const configEditor = $("configEditor");
const configResetBtn = $("configReset");
const configModal = $("configModal");
const openConfigBtn = $("openConfig");
const closeConfigBtn = $("closeConfig");

const CONFIG_STORAGE_KEY = "platePickerConfig";
const plateInputs = new Map();
let heavyOrderListEl = null;

function ensureOverrides(){
  if (!DATA || !DATA.meta || !DATA.meta.limits) return {};
  if (!DATA.meta.limits.overrides || typeof DATA.meta.limits.overrides !== "object"){
    DATA.meta.limits.overrides = {};
  }
  return DATA.meta.limits.overrides;
}

function loadStoredConfig(){
  try{
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(err){
    console.warn("No se pudo cargar la configuración:", err);
    return null;
  }
}

function applyStoredConfig(){
  if (!DATA) return;
  const stored = loadStoredConfig();
  if (!stored) return;

  if (stored.limits){
    const lim = stored.limits;
    if (Number.isFinite(lim.default)) DATA.meta.limits.default = lim.default;
    if (lim.overrides && typeof lim.overrides === "object"){
      const overrides = {};
      for (const [label, val] of Object.entries(lim.overrides)){
        const num = Number(val);
        if (Number.isFinite(num)) overrides[label] = num;
      }
      DATA.meta.limits.overrides = overrides;
    }
  }

  if (stored.prefs){
    const prefs = stored.prefs;
    if (Number.isFinite(prefs.maxPlatesPerSide)) DATA.prefs.maxPlatesPerSide = prefs.maxPlatesPerSide;
    if (Number.isFinite(prefs.maxCombosPerTotal)) DATA.prefs.maxCombosPerTotal = prefs.maxCombosPerTotal;
    if (Array.isArray(prefs.microLabels)) DATA.prefs.microLabels = prefs.microLabels.slice();
    if (Array.isArray(prefs.heavyPrefOrder)) DATA.prefs.heavyPrefOrder = prefs.heavyPrefOrder.slice();
  }
}

function saveConfigState(){
  if (!DATA) return;
  try{
    const payload = {
      limits: {
        default: DATA.meta.limits.default,
        overrides: { ...ensureOverrides() }
      },
      prefs: {
        maxPlatesPerSide: DATA.prefs.maxPlatesPerSide,
        maxCombosPerTotal: DATA.prefs.maxCombosPerTotal,
        microLabels: DATA.prefs.microLabels,
        heavyPrefOrder: DATA.prefs.heavyPrefOrder
      }
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(payload));
  } catch(err){
    console.warn("No se pudo guardar la configuración:", err);
  }
}

function renderConfigPanel(){
  if (!configEditor || !DATA) return;

  const { meta, prefs } = DATA;
  const defaultLimit = meta.limits?.default ?? 0;
  const overrides = ensureOverrides();
  const plates = meta.plates || [];

  const rowsHtml = plates.map((plate) => {
    const override = overrides.hasOwnProperty(plate.label) ? overrides[plate.label] : null;
    const usesDefault = override === null;
    const effective = usesDefault ? defaultLimit : override;
    const fam = plate.fam ? plate.fam.toUpperCase() : "";
    return `
      <tr data-label="${plate.label}">
        <td>
          <div class="plate-cell">
            <span class="swatch" style="background:${plate.color};"></span>
            <div>
              <div class="plate-name">${plate.label}</div>
              <div class="plate-meta">${plate.kg.toFixed(2)} kg • ${fam}</div>
            </div>
          </div>
        </td>
        <td class="limit-cell">
          <input type="number" class="limit-input" data-label="${plate.label}" data-uses-default="${usesDefault ? "true" : "false"}" min="0" max="20" step="1" value="${effective}" />
        </td>
      </tr>`;
  }).join("");

  const microLabels = prefs.microLabels || [];
  const microHtml = plates.map((plate) => {
    const checked = microLabels.includes(plate.label) ? "checked" : "";
    return `
      <label class="micro-option">
        <input type="checkbox" data-label="${plate.label}" ${checked} />
        <span>${plate.label}</span>
      </label>`;
  }).join("");

  const seen = new Set();
  const order = [];
  (prefs.heavyPrefOrder || []).forEach((label) => {
    if (!seen.has(label) && plates.some((p) => p.label === label)){
      seen.add(label);
      order.push(label);
    }
  });
  plates.forEach((plate) => {
    if (!seen.has(plate.label)){
      seen.add(plate.label);
      order.push(plate.label);
    }
  });

  const heavyHtml = order.map((label, idx) => `
    <li data-label="${label}">
      <div class="order-chip">
        <span class="order-index">${idx + 1}</span>
        <span class="order-text">${label}</span>
      </div>
      <div class="order-actions">
        <button type="button" class="order-btn" data-dir="up" aria-label="Subir ${label}">↑</button>
        <button type="button" class="order-btn" data-dir="down" aria-label="Bajar ${label}">↓</button>
      </div>
    </li>`).join("");

  configEditor.innerHTML = `
    <div class="settings-grid">
      <div class="settings-block">
        <h3>Disponibilidad de discos</h3>
        <p class="muted small">Valores por lado; 0 los deshabilita.</p>
        <label class="field-label" for="limitDefault">Máx por lado (default)</label>
        <input id="limitDefault" type="number" min="0" max="20" step="1" value="${defaultLimit}" />
        <table class="plate-table">
          <thead>
            <tr><th>Disco</th><th>Máx / lado</th></tr>
          </thead>
          <tbody id="plateLimitBody">${rowsHtml}</tbody>
        </table>
      </div>
      <div class="settings-block">
        <h3>Reglas y preferencias</h3>
        <label class="field-label" for="prefMaxPerSide">Máx discos por lado</label>
        <input id="prefMaxPerSide" type="number" min="1" max="30" step="1" value="${prefs.maxPlatesPerSide}" />
        <label class="field-label" for="prefMaxCombos">Máx combinaciones por peso</label>
        <input id="prefMaxCombos" type="number" min="1" max="50" step="1" value="${prefs.maxCombosPerTotal}" />
        <div class="pref-group">
          <span class="field-label">Platos micro</span>
          <div id="microOptions" class="micro-options">${microHtml}</div>
        </div>
        <div class="pref-group">
          <span class="field-label">Preferencia pesada → liviana</span>
          <ul id="heavyOrderList" class="heavy-order">${heavyHtml}</ul>
        </div>
      </div>
    </div>`;

  const defaultInput = configEditor.querySelector("#limitDefault");
  defaultInput?.addEventListener("change", handleDefaultLimitChange);

  plateInputs.clear();
  configEditor.querySelectorAll(".limit-input").forEach((input) => {
    const label = input.dataset.label;
    if (!label) return;
    plateInputs.set(label, input);
    input.addEventListener("change", handlePlateLimitChange);
  });

  const maxPerSideInput = configEditor.querySelector("#prefMaxPerSide");
  maxPerSideInput?.addEventListener("change", handlePrefChange);

  const maxCombosInput = configEditor.querySelector("#prefMaxCombos");
  maxCombosInput?.addEventListener("change", handlePrefChange);

  configEditor.querySelectorAll("#microOptions input[type='checkbox']").forEach((chk) => {
    chk.addEventListener("change", handleMicroToggle);
  });

  heavyOrderListEl = configEditor.querySelector("#heavyOrderList");
  if (heavyOrderListEl){
    heavyOrderListEl.addEventListener("click", handleHeavyOrderClick);
    syncHeavyOrderFromDOM({ trigger: false });
  }
}

function handleDefaultLimitChange(e){
  if (!DATA) return;
  const input = e.target;
  let val = parseInt(input.value, 10);
  if (!Number.isFinite(val) || val < 0){
    input.value = DATA.meta.limits.default;
    return;
  }
  val = Math.min(20, val);
  DATA.meta.limits.default = val;

  const overrides = ensureOverrides();
  for (const [label, overrideVal] of Object.entries({ ...overrides })){
    if (overrideVal === val) delete overrides[label];
  }

  plateInputs.forEach((field, label) => {
    const hasOverride = overrides[label] !== undefined;
    field.dataset.usesDefault = hasOverride ? "false" : "true";
    field.value = hasOverride ? overrides[label] : val;
  });

  saveConfigState();
  runSearch(true);
}

function handlePlateLimitChange(e){
  if (!DATA) return;
  const input = e.target;
  const label = input.dataset.label;
  if (!label) return;
  const overrides = ensureOverrides();
  const defaultLimit = DATA.meta.limits.default;

  if (input.value === "" || input.value === null){
    delete overrides[label];
    input.dataset.usesDefault = "true";
    input.value = defaultLimit;
  } else {
    let val = parseInt(input.value, 10);
    if (!Number.isFinite(val) || val < 0){
      const fallback = overrides[label] ?? defaultLimit;
      input.value = fallback;
      return;
    }
    val = Math.min(20, val);
    input.value = val;
    if (val === defaultLimit){
      delete overrides[label];
      input.dataset.usesDefault = "true";
    } else {
      overrides[label] = val;
      input.dataset.usesDefault = "false";
    }
  }

  saveConfigState();
  runSearch(true);
}

function handlePrefChange(e){
  if (!DATA) return;
  const input = e.target;
  let val = parseInt(input.value, 10);
  if (!Number.isFinite(val) || val < 1){
    const fallback = input.id === "prefMaxPerSide" ? DATA.prefs.maxPlatesPerSide : DATA.prefs.maxCombosPerTotal;
    input.value = fallback;
    return;
  }
  if (input.id === "prefMaxPerSide"){
    val = Math.min(30, val);
    DATA.prefs.maxPlatesPerSide = val;
  } else {
    val = Math.min(50, val);
    DATA.prefs.maxCombosPerTotal = val;
  }
  input.value = val;
  saveConfigState();
  runSearch(true);
}

function handleMicroToggle(e){
  if (!DATA) return;
  const chk = e.target;
  const label = chk.dataset.label;
  if (!label) return;
  const current = new Set(DATA.prefs.microLabels || []);
  if (chk.checked) current.add(label);
  else current.delete(label);
  DATA.prefs.microLabels = Array.from(current);
  saveConfigState();
  runSearch(true);
}

function handleHeavyOrderClick(e){
  if (!heavyOrderListEl) return;
  const btn = e.target.closest("button[data-dir]");
  if (!btn) return;
  e.preventDefault();
  const item = btn.closest("li");
  if (!item) return;
  if (btn.dataset.dir === "up"){
    const prev = item.previousElementSibling;
    if (prev) heavyOrderListEl.insertBefore(item, prev);
  } else {
    const next = item.nextElementSibling;
    if (next) heavyOrderListEl.insertBefore(next, item);
  }
  syncHeavyOrderFromDOM({ trigger: true });
}

function updateOrderIndices(){
  if (!heavyOrderListEl) return;
  const items = heavyOrderListEl.querySelectorAll("li");
  items.forEach((li, idx) => {
    const idxSpan = li.querySelector(".order-index");
    if (idxSpan) idxSpan.textContent = String(idx + 1);
    const upBtn = li.querySelector("button[data-dir='up']");
    const downBtn = li.querySelector("button[data-dir='down']");
    if (upBtn) upBtn.disabled = idx === 0;
    if (downBtn) downBtn.disabled = idx === items.length - 1;
  });
}

function syncHeavyOrderFromDOM({ trigger } = { trigger: false }){
  if (!heavyOrderListEl || !DATA) return;
  const labels = Array.from(heavyOrderListEl.querySelectorAll("li")).map((li) => li.dataset.label).filter(Boolean);
  DATA.prefs.heavyPrefOrder = labels;
  updateOrderIndices();
  if (trigger){
    saveConfigState();
    runSearch(true);
  }
}

function resetToDefaults(){
  resetData();
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  renderConfigPanel();
  runSearch(true);
}

function openConfigModalView(){
  if (!configModal) return;
  configModal.classList.add("is-open");
  configModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeConfigModalView(){
  if (!configModal) return;
  configModal.classList.remove("is-open");
  configModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

modeSel.addEventListener("change", ()=>{
  const isPercent = modeSel.value === "percent";
  exactBox.style.display = isPercent ? "none" : "";
  percentBox.style.display = isPercent ? "" : "none";
  updateCalcPreview();
});

function computeTarget(){
  if (modeSel.value === "percent"){
    const rm = parseFloat(rmKg?.value ?? "");
    const pct = parseFloat(rmPct?.value ?? "");
    if (!Number.isFinite(rm) || !Number.isFinite(pct)) return null;
    return rm * (pct / 100);
  }
  const target = parseFloat(exactKg?.value ?? "");
  if (!Number.isFinite(target)) return null;
  return target;
}

function updateCalcPreview(){
  if (modeSel.value !== "percent") return;
  const t = computeTarget();
  calcPreview.textContent = Number.isFinite(t) ? `${t.toFixed(2)} kg` : "—";
}

rmKg?.addEventListener("input", updateCalcPreview);
rmPct?.addEventListener("input", updateCalcPreview);

configResetBtn?.addEventListener("click", resetToDefaults);
openConfigBtn?.addEventListener("click", () => {
  renderConfigPanel();
  openConfigModalView();
});
closeConfigBtn?.addEventListener("click", closeConfigModalView);
configModal?.addEventListener("click", (e) => {
  if (e.target?.dataset?.close === "true") closeConfigModalView();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && configModal?.classList.contains("is-open")){
    closeConfigModalView();
  }
});

function runSearch(resetRange = true){
  if (!DATA){ alert("Cargando datos…"); return; }
  const cap = parseInt(capPerWeight?.value || "6", 10);
  const sortResMode = sortResults?.value || "closest_plates";
  const unitFilter = unitFilterSel?.value || "any";

  const target = computeTarget();
  if (!Number.isFinite(target)){ alert("Peso objetivo inválido"); return; }

  let tolerance = parseFloat(tolInp.value || "0.05");
  if (!Number.isFinite(tolerance) || tolerance < 0) tolerance = 0;
  const minTotal = target - tolerance;
  const maxTotal = target + tolerance;
  const extraMargin = Math.max(0.1, tolerance * 1.5);

  const itemsRaw = generateCombos(DATA.meta, DATA.prefs, {
    minTotal,
    maxTotal,
    unitFilter,
    capPerWeight: cap,
    extraMargin,
    tolerance
  });

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
  applyStoredConfig();
  renderConfigPanel();
  updateCalcPreview();

  // Registrar SW (HTTPS/localhost)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.warn);
    });
  }
})();

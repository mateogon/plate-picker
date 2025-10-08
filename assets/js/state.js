// Persistencia simple de opciones en localStorage
const STATE_KEYS = [
  "mode", "exactKg", "rmKg", "rmPct",
  "tol", "capPerWeight", "sortResults", "unitFilter", "minPlates", "maxPlates"
];

export function loadState(){
  try{
    const raw = localStorage.getItem("platePickerState");
    if (!raw) return;
    const state = JSON.parse(raw);
    for (const k of STATE_KEYS){
      const el = document.getElementById(k);
      if (!el || state[k] === undefined) continue;
      el.value = state[k];
    }
    const modeSel = document.getElementById("mode");
    if (modeSel.value === "range") modeSel.value = "weight";

    const isPercent = modeSel.value === "percent";
    document.getElementById("exactBox").style.display = isPercent ? "none" : "";
    document.getElementById("percentBox").style.display = isPercent ? "" : "none";
  } catch(e){ console.warn("No se pudo cargar estado:", e); }
}

export function saveState(){
  const state = {};
  for (const k of STATE_KEYS){
    const el = document.getElementById(k);
    if (!el) continue;
    state[k] = (el.type === "number") ? Number(el.value) : el.value;
  }
  localStorage.setItem("platePickerState", JSON.stringify(state));
}

export function bindStateAutosave(){
  window.addEventListener("change", (e)=>{
    if (STATE_KEYS.includes(e.target?.id)) saveState();
  });
  window.addEventListener("input", (e)=>{
    if (STATE_KEYS.includes(e.target?.id)) saveState();
  });
}


// Carga combos.json y construye un índice por total (redondeado a 2 decimales)
export let DATA = null;
export let INDEX = null;

export async function loadData(){
  const res = await fetch("./combos.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No pude cargar combos.json");
  DATA = await res.json();

  const byKey = new Map();
  const keys = [];
  for (const t of DATA.totals){
    const k = t.kg.toFixed(2);
    byKey.set(k, t);
    keys.push(Number(k));
  }
  keys.sort((a,b)=>a-b);
  INDEX = { byKey, keys };
}

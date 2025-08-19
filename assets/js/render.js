import { fontContrast, fmt } from "./utils.js";
import { DATA } from "./data.js";
import { sortCombosInCard } from "./search.js";

// Renderiza tarjetas en #results
export function render(resultsRoot, items, opts = {}){
  const plates = DATA.meta.plates;
  const target = (opts && typeof opts.target === "number") ? opts.target : null;
  const comboSort = (opts && opts.comboSort) ? opts.comboSort : "default";
  const emptyPolicy = (opts && opts.emptyPolicy) || "hide";

  resultsRoot.innerHTML = "";

  for (const row of items){
    const card = document.createElement("div");
    card.className = "result";

    const wdiv = document.createElement("div");
    wdiv.className = "weight";
    wdiv.textContent = fmt(row.kg) + " kg";

    if (target !== null){
      const diff = Number((row.kg - target).toFixed(2));
      const badge = document.createElement("span");
      const absd = Math.abs(diff);
      badge.className = "badge " + (absd < 0.01 ? "ok" : absd <= 0.25 ? "warn" : "miss");
      badge.textContent = (diff >= 0 ? "+" : "") + diff.toFixed(2) + " kg";
      wdiv.appendChild(badge);
    }
    card.appendChild(wdiv);

    const pdiv = document.createElement("div");
    pdiv.className = "plates";

    if (!row.combos || row.combos.length === 0){
      if (emptyPolicy === "show"){
        const span = document.createElement("span");
        span.className = "muted";
        span.textContent = "Sin combinaciones (no hay en el dataset para este valor).";
        pdiv.appendChild(span);
        card.appendChild(pdiv);
        resultsRoot.appendChild(card);
      }
      continue;
    }

    const combosSorted = sortCombosInCard(row.combos, comboSort);

    for (const combo of combosSorted){
      const line = document.createElement("div");
      line.className = "line";
      for (const idx of combo){
        const pl = plates[idx];
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.style.background = pl.color;
        chip.style.color = fontContrast(pl.color);
        chip.textContent = pl.label;
        line.appendChild(chip);
      }
      pdiv.appendChild(line);
    }

    card.appendChild(pdiv);
    resultsRoot.appendChild(card);
  }
}

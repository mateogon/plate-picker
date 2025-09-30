import { fontContrast, fmt } from "./utils.js";
import { DATA } from "./data.js";

// Renderiza tarjetas en #results
export function render(resultsRoot, items, opts = {}){
  const plates = DATA.meta.plates;
  const target = (opts && typeof opts.target === "number") ? opts.target : null;

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

    if (!row.combos || row.combos.length === 0) continue;

    for (const combo of row.combos){
      const line = document.createElement("div");
      line.className = "line";

      const chipsWrap = document.createElement("div");
      chipsWrap.className = "line-chips";
      const labels = [];
      for (const idx of combo){
        const pl = plates[idx];
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.style.background = pl.color;
        chip.style.color = fontContrast(pl.color);
        chip.textContent = pl.label;
        chipsWrap.appendChild(chip);
        labels.push(pl.label);
      }

      line.appendChild(chipsWrap);

      const copyText = labels.join(" ");
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "copy-btn";
      copyBtn.textContent = "Copiar";

      let resetTimer = null;
      copyBtn.addEventListener("click", async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText){
            await navigator.clipboard.writeText(copyText);
          } else {
            const ta = document.createElement("textarea");
            ta.value = copyText;
            ta.setAttribute("readonly", "");
            ta.style.position = "absolute";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          }
          copyBtn.textContent = "Copiado";
        } catch (err) {
          copyBtn.textContent = "Error";
        }

        if (resetTimer){
          clearTimeout(resetTimer);
        }
        resetTimer = setTimeout(() => {
          copyBtn.textContent = "Copiar";
        }, 1600);
      });

      line.appendChild(copyBtn);
      pdiv.appendChild(line);
    }

    card.appendChild(pdiv);
    resultsRoot.appendChild(card);
  }
}

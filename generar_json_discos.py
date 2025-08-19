import json
import math
import pandas as pd
from itertools import combinations_with_replacement

# ========== Config ==========
BAR_KG = 20.0
LB_TO_KG = 0.453592

PLATES = [
    # label, kg, family
    ("45lb", 45 * LB_TO_KG, "lb"),
    ("35lb", 35 * LB_TO_KG, "lb"),
    ("25lb", 25 * LB_TO_KG, "lb"),
    ("15lb", 15 * LB_TO_KG, "lb"),
    ("10lb", 10 * LB_TO_KG, "lb"),
    ("25kg", 25.0,         "kg"),
    ("20kg", 20.0,         "kg"),
    ("15kg", 15.0,         "kg"),
    ("10kg", 10.0,         "kg"),
    ("5kg",   5.0,         "kg"),
    ("2.5kg", 2.5,         "kg"),
    ("1.25kg",1.25,        "kg"),
    ("1.14kg",1.14,        "kg"),
]

# Límite por tipo (max por lado). Por defecto 2; override para casos especiales.
DEFAULT_MAX_PER_SIDE = 2
MAX_PER_SIDE = {
    "45lb": 8,   # >2 permitido
    "25kg": 8,   # >2 permitido
    "20kg": 8,   # >2 permitido
    "1.25kg": 1, # micro
    "1.14kg": 1, # micro
}

# Rango de totales
MIN_TOTAL = 40.0
MAX_TOTAL = 220.0

# Enumeración tope (luego se poda fuertemente)
MAX_PLATES_PER_SIDE = 12

# Poda: máximo de combos prácticos por total exacto
MAX_COMBOS_PER_TOTAL = 10

# Prioridades para desempate (más negativo = mejor)
HEAVY_PREF_ORDER = ["45lb","25kg","20kg","35lb","25lb","15kg","10kg","5kg"]

# Colores aproximados (LB “reales” y KG en grises; 15lb negro puro para distinguir KG)
LB_COLORS = {"45lb":"#C62828","35lb":"#1565C0","25lb":"#F9A825","15lb":"#000000","10lb":"#2E7D32"}
KG_COLORS = {"25kg":"#212121","20kg":"#2E2E2E","15kg":"#424242","10kg":"#616161","5kg":"#757575","2.5kg":"#9E9E9E","1.25kg":"#BDBDBD","1.14kg":"#C7C7C7"}

# ========== Derivados ==========
LABELS = [p[0] for p in PLATES]
WEIGHT = {p[0]: p[1] for p in PLATES}
FAMILY = {p[0]: p[2] for p in PLATES}
PLATE_INDEX = {lab:i for i,lab in enumerate(LABELS)}

def max_for(label: str) -> int:
    return MAX_PER_SIDE.get(label, DEFAULT_MAX_PER_SIDE)

# ========== Utilidades ==========
def sort_heaviest_first(labels):
    # kg desc; si empata, KG antes que LB
    return sorted(labels, key=lambda s: (-WEIGHT[s], FAMILY[s] == "lb"))

def counts_from_labels(labels):
    d = {lab: 0 for lab in LABELS}
    for lab in labels:
        d[lab] += 1
    return d

def labels_from_counts(counts):
    out = []
    for lab in LABELS:
        out.extend([lab] * counts.get(lab, 0))
    return out

def total_from_counts(counts):
    side_kg = sum(WEIGHT[lab] * cnt for lab, cnt in counts.items())
    return round(BAR_KG + 2.0 * side_kg, 2)

# ========== Fusiones equivalentes (dominance) ==========
from itertools import combinations_with_replacement as cwr
EPS = 1e-2

def build_merge_patterns():
    weight_to_labels = {}
    for lab, w in WEIGHT.items():
        weight_to_labels.setdefault(round(w, 3), []).append(lab)

    patterns = []  # (pattern_counts_dict, target_label)
    def add_pattern(combo_labels, target):
        pc = {}
        for x in combo_labels:
            pc[x] = pc.get(x, 0) + 1
        # evita patrón trivial (el mismo target)
        if len(pc) == 1 and target in pc and pc[target] == 1:
            return
        patterns.append((pc, target))

    for r in (2, 3, 4):
        for idxes in cwr(range(len(LABELS)), r):
            combo = tuple(LABELS[i] for i in idxes)
            s = sum(WEIGHT[x] for x in combo)
            key = round(s, 3)
            if key in weight_to_labels:
                for tgt in weight_to_labels[key]:
                    add_pattern(combo, tgt)
    return patterns

MERGE_PATTERNS = build_merge_patterns()

def is_dominated(counts):
    # Si una combinación puede reemplazar subgrupos por un plato “target”
    # y aún cabe según el límite de ese target, la descartamos.
    for pc, target in MERGE_PATTERNS:
        m = min(counts.get(lab, 0) // need for lab, need in pc.items())
        if m >= 1 and counts.get(target, 0) < max_for(target):
            return True
    return False

def violates_caps(counts):
    return any(cnt > max_for(lab) for lab, cnt in counts.items())

# ========== Generación (podada) ==========
def generate_canonical_combos():
    results = set()
    for r in range(0, MAX_PLATES_PER_SIDE + 1):
        for idx_combo in combinations_with_replacement(range(len(LABELS)), r):
            labs = [LABELS[i] for i in idx_combo]
            counts = counts_from_labels(labs)

            if violates_caps(counts):
                continue

            total = total_from_counts(counts)
            if total < MIN_TOTAL - 1e-9 or total > MAX_TOTAL + 1e-9:
                continue

            if is_dominated(counts):
                continue

            labs_sorted = tuple(labels_from_counts(counts))
            results.add((round(total,2), tuple(sort_heaviest_first(list(labs_sorted)))))
    return list(results)

# ========== Ranking / Poda ==========
def tie_break_key(labels_tuple):
    c = counts_from_labels(labels_tuple)
    heavy_vec = tuple(-c.get(h, 0) for h in HEAVY_PREF_ORDER)
    micro = c.get("1.25kg", 0) + c.get("1.14kg", 0) + c.get("2.5kg", 0)
    total_plates = sum(c.values())
    return (heavy_vec, micro, total_plates)

def group_prune(results):
    by_total = {}
    for total, labels in results:
        by_total.setdefault(total, []).append(labels)

    final = {}
    for total, lst in by_total.items():
        uniq = list(set(lst))

        # Minimiza micro-KG
        def micro_count(lbls):
            c = counts_from_labels(lbls)
            return c.get("1.25kg",0)+c.get("1.14kg",0)+c.get("2.5kg",0)
        if uniq:
            mmin = min(micro_count(x) for x in uniq)
            uniq = [x for x in uniq if micro_count(x) == mmin]

        # Minimiza # de platos
        if uniq:
            pmin = min(sum(counts_from_labels(x).values()) for x in uniq)
            uniq = [x for x in uniq if sum(counts_from_labels(x).values()) == pmin]

        # Orden práctico
        uniq.sort(key=tie_break_key)

        if MAX_COMBOS_PER_TOTAL is not None:
            uniq = uniq[:MAX_COMBOS_PER_TOTAL]

        final[total] = uniq
    return final

# ========== JSON compacto ==========
def write_json(grouped, path, pretty=False):
    # meta compacta con mapping de placas (índice → label/kg/fam/color)
    plates_meta = []
    for lab in LABELS:
        color = LB_COLORS.get(lab) if lab.endswith("lb") else KG_COLORS.get(lab)
        plates_meta.append({
            "label": lab,
            "kg": round(WEIGHT[lab], 5),
            "fam": FAMILY[lab],
            "color": color
        })

    # totales → combos como índices (por lado)
    totals_arr = []
    for total in sorted(grouped.keys()):
        combos_idx = []
        for combo in grouped[total]:
            combos_idx.append([PLATE_INDEX[x] for x in combo])  # un lado, ya ordenado pesado→liviano
        totals_arr.append({"kg": float(total), "combos": combos_idx})

    payload = {
        "meta": {
            "bar_kg": BAR_KG,
            "limits": {"default": DEFAULT_MAX_PER_SIDE, "overrides": MAX_PER_SIDE},
            "range": {"min": MIN_TOTAL, "max": MAX_TOTAL},
            "plates": plates_meta
        },
        "totals": totals_arr
    }

    with open(path, "w", encoding="utf-8") as f:
        if pretty:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        else:
            json.dump(payload, f, ensure_ascii=False, separators=(",",":"))

    return path

# ========== Main ==========
if __name__ == "__main__":
    raw = generate_canonical_combos()
    grouped = group_prune(raw)
    out = write_json(grouped, "combos.json", pretty=False)
    print("Saved:", out)

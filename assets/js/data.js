const BASE_META = Object.freeze({
  bar_kg: 20.0,
  limits: {
    default: 2,
    overrides: {
      "45lb": 8,
      "25kg": 8,
      "20kg": 8,
      "1.25kg": 1,
      "1.14kg": 1
    }
  },
  range: { min: 40.0, max: 220.0 },
  plates: [
    { label: "45lb", kg: 20.41164, fam: "lb", color: "#C62828" },
    { label: "35lb", kg: 15.87572, fam: "lb", color: "#1565C0" },
    { label: "25lb", kg: 11.3398, fam: "lb", color: "#F9A825" },
    { label: "15lb", kg: 6.80388, fam: "lb", color: "#000000" },
    { label: "10lb", kg: 4.53592, fam: "lb", color: "#2E7D32" },
    { label: "25kg", kg: 25.0, fam: "kg", color: "#212121" },
    { label: "20kg", kg: 20.0, fam: "kg", color: "#2E2E2E" },
    { label: "15kg", kg: 15.0, fam: "kg", color: "#424242" },
    { label: "10kg", kg: 10.0, fam: "kg", color: "#616161" },
    { label: "5kg", kg: 5.0, fam: "kg", color: "#757575" },
    { label: "2.5kg", kg: 2.5, fam: "kg", color: "#9E9E9E" },
    { label: "1.25kg", kg: 1.25, fam: "kg", color: "#BDBDBD" },
    { label: "1.14kg", kg: 1.14, fam: "kg", color: "#C7C7C7" }
  ]
});

const BASE_PREFS = Object.freeze({
  maxPlatesPerSide: 12,
  maxCombosPerTotal: 10,
  heavyPrefOrder: [
    "45lb",
    "25kg",
    "20kg",
    "35lb",
    "25lb",
    "15kg",
    "10kg",
    "5kg"
  ],
  microLabels: ["1.25kg", "1.14kg", "2.5kg"]
});

const BASE_DATA = Object.freeze({ meta: BASE_META, prefs: BASE_PREFS });

const clone = (obj) => JSON.parse(JSON.stringify(obj));

export let DATA = null;

export function createDefaultData(){
  return clone(BASE_DATA);
}

export async function loadData(){
  DATA = createDefaultData();
  return DATA;
}

export function resetData(){
  DATA = createDefaultData();
  return DATA;
}

export const BASE_CONFIG = BASE_DATA;

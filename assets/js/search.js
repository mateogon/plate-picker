// Búsquedas y ordenamientos
export function nearestKeys(keys, target, tol){
    const arr = [];
    for (const k of keys){
      if (Math.abs(k - target) <= tol + 1e-9) arr.push(k);
    }
    // el orden final lo decide sortResultsArray (closest/farthest)
    return arr;
  }
  
  export function rangeKeys(keys, a, b){
    const arr = [];
    for (const k of keys){
      if (k >= a - 1e-9 && k <= b + 1e-9) arr.push(k);
    }
    return arr;
  }
  
export function sortResultsArray(items, mode, target){
  const arr = items.slice();
  if (mode === "asc") arr.sort((a,b)=> a.kg - b.kg);
  else if (mode === "desc") arr.sort((a,b)=> b.kg - a.kg);
  else if (mode === "closest" && typeof target === "number")
    arr.sort((a,b)=> Math.abs(a.kg - target) - Math.abs(b.kg - target));
  else if (mode === "farthest" && typeof target === "number")
    arr.sort((a,b)=> Math.abs(b.kg - target) - Math.abs(a.kg - target));
  else if (mode === "closest_plates")
    arr.sort((a,b)=>{
      const d = (typeof target === "number") ? Math.abs(a.kg - target) - Math.abs(b.kg - target) : 0;
      if (d !== 0) return d;
      const p = a.minPlates - b.minPlates;
      if (p !== 0) return p;
      return a.kg - b.kg;
    });
  else if (mode === "plates_closest")
    arr.sort((a,b)=>{
      const p = a.minPlates - b.minPlates;
      if (p !== 0) return p;
      if (typeof target === "number"){
        const d = Math.abs(a.kg - target) - Math.abs(b.kg - target);
        if (d !== 0) return d;
      }
      return a.kg - b.kg;
    });
  else if (mode === "plates")
    arr.sort((a,b)=> {
      const diff = a.minPlates - b.minPlates;
      if (diff !== 0) return diff;
      if (typeof target === "number")
        return Math.abs(a.kg - target) - Math.abs(b.kg - target);
      return a.kg - b.kg;
    });
  else arr.sort((a,b)=> a.kg - b.kg);
  return arr;
}
  

// Utils: contraste de texto y formateo
export function fontContrast(hex){
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    const lum = 0.299*r + 0.587*g + 0.114*b;
    return lum < 140 ? "#FFFFFF" : "#000000";
  }
  export const fmt = (x) => Number(x.toFixed(2));
  export const $ = (sel, root=document) => root.querySelector(sel);
  export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  
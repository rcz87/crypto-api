// ======================================================================
// Position Sizing — helpers to quantize qty/price to exchange constraints
// Author: GPT-5 Thinking (RICOZ)
// ======================================================================

export function quantizeQty(qty:number, minQty:number, step:number) {
  const rounded = Math.round(qty/step)*step;
  return Math.max(minQty, rounded);
}

export function quantizePrice(price:number, tick:number) {
  return Math.round(price/tick)*tick;
}

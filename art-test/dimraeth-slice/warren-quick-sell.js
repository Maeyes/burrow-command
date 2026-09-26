// Fixed-price LOCAL NPC surplus sale. No player-to-player marketplace or rare-item liquidation.
// Only six common construction materials are permitted in the first release.
export const NPC_COMMON_PRICES=Object.freeze({livingMoss:1,brutalSpore:2,copperOre:2,duneRunnerClaw:2,cactusSpine:1,moonstoneShard:3});
export const SELL_RESERVES=Object.freeze([0,50,100,300,500,1000]);
export function quoteQuickSell(inventory,reserve=300,selection=Object.keys(NPC_COMMON_PRICES)){
 const keep=SELL_RESERVES.includes(Number(reserve))?Number(reserve):300;
 const allowed=new Set(Array.isArray(selection)?selection:[]),rows=[];
 for(const [id,price] of Object.entries(NPC_COMMON_PRICES)){
  if(!allowed.has(id))continue;
  const inStock=Math.max(0,Math.floor(Number(inventory?.[id])||0));
  const qty=Math.max(0,inStock-keep);
  if(qty)rows.push({id,inStock,keep,qty,price,gold:qty*price});
 }
 return {reserve:keep,rows,quantity:rows.reduce((n,r)=>n+r.qty,0),gold:rows.reduce((n,r)=>n+r.gold,0)};
}
export function commitQuickSell(state,reserve=300,selection=Object.keys(NPC_COMMON_PRICES)){
 if(state.night)return null;
 const quote=quoteQuickSell(state.inventory,reserve,selection);
 if(!quote.quantity)return null;
 // Requote from the LIVE inventory immediately before each sale. A stale UI never overdrafts.
 for(const row of quote.rows)state.inventory[row.id]-=row.qty;
 state.gold+=quote.gold;
 return quote;
}

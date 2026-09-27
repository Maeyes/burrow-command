export const MAGIC_CART_GATES=Object.freeze([{level:15,slots:2},{level:20,slots:4},{level:25,slots:6}]);
export const MAGIC_CART_MAX=6;
export const magicCartCap=warren=>MAGIC_CART_GATES.reduce((cap,gate)=>warren>=gate.level?gate.slots:cap,0);
export const MAGIC_CART_COST=Object.freeze({gold:240,materials:24,mageHire:180,hp:240,range:340,cooldown:2.3,splash:82});
export const MAGIC_CART_UPGRADE=Object.freeze([0,160,420,900,1800]);
export const MAGIC_CART_HP=Object.freeze([240,380,560,800,1100]);
export const MAGIC_CART_RANGE=Object.freeze([340,370,405,445,490]);
export function normalizeMagicCart(raw){
 if(!raw||!Number.isFinite(raw.x)||!Number.isFinite(raw.y))return null;
 const level=Math.max(1,Math.min(5,Math.floor(Number(raw.level)||1))),maxHp=MAGIC_CART_HP[level-1];
 const hp=Math.max(0,Math.min(maxHp,Number.isFinite(raw.hp)?Math.round(raw.hp):maxHp));
 const mage=raw.garrison?.cls==='mage'?{cls:'mage',isGarrison:true,name:String(raw.garrison.name||'Mage').slice(0,22),level:Math.max(1,Math.floor(raw.garrison.level||1)),exp:Math.max(0,Math.floor(raw.garrison.exp||0))}:null;
 return {x:raw.x,y:raw.y,level,hp,garrison:mage};
}

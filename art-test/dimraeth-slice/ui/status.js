// Character Status window: allocate stat points with a live preview of derived stats.
import { sim, saveCharacter } from './runtime.js';
import { blockChanceForPlayer, MASTERY_COMBAT_V2 } from '../../../src/simulation/engine.ts';
import { WEAPON_INNATE_DESCRIPTIONS, weaponInnateBonuses } from '../../../src/simulation/weaponInnatePassives.ts';
import { equipmentCombatTotals } from '../../../src/simulation/equipmentCombat.ts';

export const gameUi={pendingStats:{}};
export const gameWindow=document.getElementById('game-window'),gameWindowTitle=document.getElementById('game-window-title'),gameWindowBody=document.getElementById('game-window-body');

const STATS=[['str','STR','Melee ATK'],['agi','AGI','ASPD · FLEE'],['vit','VIT','HP · DEF'],['int','INT','MATK · SP'],['dex','DEX','HIT · ranged ATK'],['luk','LUK','CRIT']];

export function openCharacterWindow(){
  const c=sim.character;let editGuardUntil=0;
  gameWindow.hidden=false;gameWindowTitle.textContent='Character';gameUi.pendingStats={};
  const render=()=>{
    const pending=gameUi.pendingStats,used=Object.values(pending).reduce((a,v)=>a+v,0),remaining=c.unspentStatPoints-used,s={...c.stats};
    for(const [k] of STATS)s[k]+=pending[k]||0;
    const p=sim.simulation.world.players.get(sim.playerId);
    const innate=weaponInnateBonuses(c),gear=equipmentCombatTotals(c);
    // Same formulas as the arena prototype's status screen.
    const derived=[['ATK',Math.round((p.weaponAtk+s.str+s.str*s.str/100+s.dex/5+s.luk/3)*(p.innatePhysicalAttackMultiplier??1))],['MATK',Math.round(p.weaponMatk+s.int+s.int*s.int/100+s.dex/5+s.luk/3)],['DEF',Math.round(p.equipmentDef+s.vit/2)],['MDEF',Math.round(p.equipmentMdef+s.int/2+s.vit/4)],['HIT',175+c.level+s.dex+p.hitBonus],['FLEE',100+c.level+s.agi+p.fleeBonus],['CRIT',(1+s.luk*.3+p.critBonusPercent).toFixed(1)+'%'],['ASPD',Math.floor(150+s.agi*.25+s.dex*.1+p.equipmentAspd)],['HP',Math.round((100+s.level*12+s.vit*10+gear.equipmentMaxHp)*gear.maxHpMultiplier*innate.hpMultiplier)],['SP',Math.round(p.maxSp??0)],['DEF PEN',Math.round((p.innatePhysicalArmorPenetration??0)*100)+'%'],['LIFESTEAL',Math.round((p.innatePhysicalLifeSteal??0)*100)+'%'],['BLOCK',(blockChanceForPlayer(p)*100).toFixed(0)+'%'],['BLOCK REDUCTION',blockChanceForPlayer(p)>0?Math.round((MASTERY_COMBAT_V2.guard.baseMitigation+(p.masteryPassives?.includes('swordShield:firmGuard')?MASTERY_COMBAT_V2.guard.firmGuardBonus:0))*(p.hasShieldEquipped?1:MASTERY_COMBAT_V2.guard.noShieldScale)*100)+'%':'—']];
    gameWindowBody.innerHTML=`<div class="bw-status">
      <header class="bw-status-head"><div><strong>${c.name}</strong><span>Lv. ${c.level}</span></div><span class="bw-chip ${remaining>0?'gold':''}">${remaining} point${remaining===1?'':'s'} left</span></header>
      <section class="bw-block"><h4>Status</h4><div class="bw-stat-rows">${STATS.map(([k,label,hint])=>{const add=pending[k]||0;return `<div class="bw-stat-row"><span class="bw-stat-name"><b>${label}</b><small>${hint}</small></span><span class="bw-stat-val">${s[k]}${add?`<em>+${add}</em>`:''}</span><span class="bw-stat-btns"><button type="button" class="bw-step" data-stat-minus="${k}" ${add?'':'disabled'} aria-label="Remove ${label} point">−</button><button type="button" class="bw-step" data-stat-plus="${k}" ${remaining>0?'':'disabled'} aria-label="Add ${label} point">+</button></span></div>`}).join('')}</div></section>
      ${innate.family?`<section class="bw-block"><h4>Weapon Innate</h4><p class="bw-note"><strong>${innate.family==='swordShield'?'ONE-HANDED SWORD':innate.family.toUpperCase()}</strong> · ${WEAPON_INNATE_DESCRIPTIONS[innate.family]}${innate.dualDagger?' (Dual Dagger ACTIVE)':''}</p></section>`:''}
      ${innate.hasShieldEquipped?`<section class="bw-block"><h4>Shield Innate</h4><p class="bw-note">Block Chance +5% from the equipped shield (stacks with refinement and Guard, up to the 35% cap).</p></section>`:''}
      <section class="bw-block"><h4>Details</h4><dl class="bw-stat-grid two">${derived.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
      <footer class="bw-actions end"><button type="button" class="bw-btn" id="stats-reset" ${used?'':'disabled'}>Reset</button><button type="button" class="bw-btn primary" id="stats-confirm" ${used?'':'disabled'}>Confirm</button></footer>
    </div>`;
    gameWindowBody.querySelectorAll('[data-stat-plus]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();if(remaining<=0)return;editGuardUntil=performance.now()+350;const k=b.dataset.statPlus;pending[k]=(pending[k]||0)+1;render();});
    gameWindowBody.querySelectorAll('[data-stat-minus]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const k=b.dataset.statMinus;if(!pending[k])return;pending[k]--;render();});
    gameWindowBody.querySelector('#stats-confirm').onclick=e=>{e.preventDefault();e.stopPropagation();if(performance.now()<editGuardUntil)return;const allocation={...pending};if(!Object.values(allocation).some(v=>v>0))return;if(sim.allocateStats(allocation)){saveCharacter(sim.character);gameUi.pendingStats={};openCharacterWindow();}};
    gameWindowBody.querySelector('#stats-reset').onclick=()=>{gameUi.pendingStats={};render();};
  };
  render();
}

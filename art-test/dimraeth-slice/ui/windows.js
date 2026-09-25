// Split from game.js (UI). Code moved as-is; see ui/runtime.js for game-state bindings.
import { renderMonsterIndex } from '../combat/monsterIndex.js';
import { iconHtml } from '../../iso-arena-draft/iconFor.js';
import { sim, gameplayMapId } from './runtime.js';
import { closeDetailModal, itemInfo, prettyItem } from './shared.js';
import { renderCraftWindow } from './craft.js';
import { renderSkillsHub } from './skills.js';
import { equipmentPanel, equipmentUi, renderEquipmentUi } from './gear.js';
import { openCharacterWindow } from './status.js';
import { renderGmEventPanel, renderSettings } from './system.js';

export function openBasicWindow(name){
  const win=document.getElementById('game-window'),title=document.getElementById('game-window-title'),body=document.getElementById('game-window-body');
  if(!win||!title||!body)return;win.hidden=false;title.textContent=name;equipmentPanel.hidden=true;
  const c=sim.character,p=sim.simulation.world.players.get(sim.playerId);
  if(name==='Inventory'){equipmentUi.tab='Gear';equipmentUi.selectedId=null;renderEquipmentUi();win.hidden=true;equipmentPanel.hidden=false;return;}
  if(name==='Skills'){renderSkillsHub();return;}
  if(name==='Craft'){renderCraftWindow();return;}
  if(name==='Settings'){renderSettings(body);return;}
  if(name==='GM Event'){renderGmEventPanel(title,body);return;}
  if(name==='Monster Index'){renderMonsterIndex({win,title,body,character:c,currentMapId:gameplayMapId,itemInfo,prettyItem});return;}
}
export function bindProductionUi(){
  document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',()=>openBasicWindow(b.dataset.window)));
  document.getElementById('character-hud')?.addEventListener('click',openCharacterWindow);
  document.getElementById('game-window-close')?.addEventListener('click',()=>{document.getElementById('game-window').hidden=true;});
  window.addEventListener('keydown',e=>{if(e.code==='KeyI')openBasicWindow('Inventory');if(e.code==='KeyK')openBasicWindow('Skills');if(e.code==='KeyY')openBasicWindow('Craft');if(e.code==='KeyM')openBasicWindow('Monster Index');if(e.key==='Escape'){const detail=document.getElementById('equipment-detail-modal');if(detail&&!detail.hidden){closeDetailModal();return;}if(!equipmentPanel.hidden){equipmentPanel.hidden=true;return;}const w=document.getElementById('game-window');if(w)w.hidden=true;}});
}
// Same as the arena prototype: static [data-ui-icon] glyphs are swapped for the pixel UI icons.
document.querySelectorAll('[data-ui-icon]').forEach(el=>{el.innerHTML=iconHtml(el.dataset.uiIcon,'ui',el.innerHTML,'pixel-icon ui-icon');});

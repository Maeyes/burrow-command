/**
 * Event Time presentation only. Rewards remain authoritative in ArenaV2Adapter.
 * The large intro animates once on OFF → ON; multiplier edits update only the live ribbon.
 */
const BONUS_LABELS=[
  ['exp','CHAR EXP'],['weaponExp','WEAPON EXP'],['drop','DROP'],
  ['gold','GOLD'],['upgradeItem','UPGRADE ITEMS'],['blueprint','BLUEPRINTS'],
];

export function eventBonusLabels(multipliers){
  return BONUS_LABELS.filter(([key])=>Number.isFinite(multipliers?.[key])&&multipliers[key]>1)
    .map(([key,label])=>`${label} ×${multipliers[key]}`);
}

export function shouldPlayEventEntrance(previousEnabled,nextEnabled){
  return !previousEnabled&&Boolean(nextEnabled);
}

let previouslyEnabled=false;
let entranceTimer=null;

function ensureEventRibbon(){
  let ribbon=document.getElementById('bw-event-time-ribbon');
  if(!ribbon){
    ribbon=document.createElement('aside');
    ribbon.id='bw-event-time-ribbon';
    ribbon.className='bw-event-ribbon';
    ribbon.setAttribute('aria-label','Active Event Time bonuses');
    ribbon.innerHTML='<span class="bw-event-ribbon-kicker">✦ EVENT TIME</span><span class="bw-event-ribbon-rates"></span>';
    document.body.appendChild(ribbon);
  }
  return ribbon;
}

function showEntrance(bonuses){
  document.getElementById('bw-event-time-entrance')?.remove();
  if(entranceTimer!==null)clearTimeout(entranceTimer);
  const host=document.createElement('div');
  host.id='bw-event-time-entrance';
  host.className='bw-event-entrance';
  host.setAttribute('role','status');
  host.setAttribute('aria-live','polite');
  host.innerHTML=`<div class="bw-event-entrance-backdrop"></div>
    <div class="bw-event-entrance-burst" aria-hidden="true"></div>
    <div class="bw-event-entrance-panel">
      <span class="bw-event-entrance-kicker">✦ WORLD EVENT ACTIVATED ✦</span>
      <div class="bw-event-entrance-heading"><i aria-hidden="true"></i><strong>EVENT TIME!</strong><i aria-hidden="true"></i></div>
      <div class="bw-event-entrance-bonuses"></div>
      <span class="bw-event-entrance-footer">BONUS REWARDS ARE NOW ACTIVE</span>
    </div>`;
  const list=host.querySelector('.bw-event-entrance-bonuses');
  for(const label of bonuses){
    const chip=document.createElement('span');
    chip.textContent=label;list.appendChild(chip);
  }
  document.body.appendChild(host);
  entranceTimer=setTimeout(()=>{host.remove();entranceTimer=null;},4200);
}

export function presentEventTime(enabled,multipliers){
  if(typeof document==='undefined')return;
  const active=Boolean(enabled);
  const bonuses=eventBonusLabels(multipliers);
  const ribbon=document.getElementById('bw-event-time-ribbon');
  if(!active){
    ribbon?.remove();
    document.getElementById('bw-event-time-entrance')?.remove();
    if(entranceTimer!==null){clearTimeout(entranceTimer);entranceTimer=null;}
    previouslyEnabled=false;
    return;
  }
  const liveRibbon=ensureEventRibbon();
  const liveRates=liveRibbon.querySelector('.bw-event-ribbon-rates');
  liveRates.textContent=bonuses.join('  ·  ')||'BONUS REWARDS';
  liveRibbon.title=bonuses.join(' · ')||'Event Time active';
  if(shouldPlayEventEntrance(previouslyEnabled,active))showEntrance(bonuses);
  previouslyEnabled=active;
}

// Presentation only: preserves button elements, listeners, disabled states and labels.
const hudIcons={homeOpen:8,fortify:2,upgrade:2,build:9,buildMagicCart:10,repair:8,repairAll:8,skip:11};
export function decorateHud(root=document){
 for(const [id,index] of Object.entries(hudIcons)){
  const button=root.getElementById(id);if(!button)continue;
  button.classList.add('bc-hud-action');
  button.style.setProperty('--hud-position',`${(index%4)*100/3}% ${Math.floor(index/4)*50}%`);
  for(const node of button.childNodes)if(node.nodeType===3)node.textContent=node.textContent.replace(/^[🔨🧱🏠🏹🔮🔧🌙]\s*/u,'');
 }
}

export function hudIcon(index,className='bc-header-icon'){
 return `<span class="bc-hud-icon ${className}" aria-hidden="true" style="--hud-position:${(index%4)*100/3}% ${Math.floor(index/4)*50}%"></span>`;
}

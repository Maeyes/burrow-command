// Live bindings from the running game into the UI modules. game.js calls bindUiRuntime() once
// the simulation exists; UI code only reads these at click/render time, never at import time.
export let sim=null,saveCharacter=null,SAVE_KEY='',gameplayMapId='',pushRewardLine=()=>{};
export function bindUiRuntime(o){({sim,saveCharacter,SAVE_KEY,gameplayMapId,pushRewardLine}=o);}

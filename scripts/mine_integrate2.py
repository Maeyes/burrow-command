from pathlib import Path
p=Path("art-test/iso-arena-draft/poc.js")
s=p.read_text(encoding="utf8")
s=s.replace("if (biomeTitle) biomeTitle.textContent = (biome === 'forest1' || biome === 'forest2' || biome.startsWith('desert')) ?", "if (biomeTitle) biomeTitle.textContent = (biome === 'mine' || biome === 'forest1' || biome === 'forest2' || biome.startsWith('desert')) ?")
needle="  if (prop.type === 'shrine') prop.collider = { rx: 34 * prop.size, ry: 16 * prop.size };"
rep=needle+"\n  if (prop.type === 'mineWall') prop.collider = { rx: 42 * prop.size, ry: 18 * prop.size };\n  if (prop.type === 'mineRock') prop.collider = { rx: 27 * prop.size, ry: 14 * prop.size };\n  if (prop.type === 'mineCart') prop.collider = { rx: 30 * prop.size, ry: 11 * prop.size };\n  if (prop.type === 'timber' || prop.type === 'brokenTimber') prop.collider = { rx: 25 * prop.size, ry: 9 * prop.size };"
s=s.replace(needle,rep)
insert=r'''
function drawMineProp(prop, p) {
  const z=prop.size||1;
  if(prop.type==='mineWall'||prop.type==='mineRock'){
    ctx.fillStyle='rgba(0,0,0,.38)';ctx.fillRect(p.x-38*z,p.y-3,76*z,8);
    ctx.fillStyle='#17191b';ctx.fillRect(p.x-34*z,p.y-38*z,68*z,38*z);
    ctx.fillStyle='#303338';ctx.fillRect(p.x-27*z,p.y-45*z,48*z,13*z);
    ctx.fillStyle='#4a4c4d';ctx.fillRect(p.x-20*z,p.y-41*z,18*z,5*z);
  } else if(prop.type==='timber'||prop.type==='brokenTimber'){
    ctx.fillStyle='#3b2719';ctx.fillRect(p.x-30*z,p.y-9*z,60*z,9*z);
    ctx.fillStyle='#69452a';ctx.fillRect(p.x-25*z,p.y-12*z,45*z,4*z);
    ctx.fillRect(p.x-24*z,p.y-48*z,8*z,42*z);ctx.fillRect(p.x+17*z,p.y-48*z,8*z,42*z);
  } else if(prop.type==='rail'){
    ctx.fillStyle='#17191a';ctx.fillRect(p.x-42*z,p.y-5,84*z,4);ctx.fillRect(p.x-42*z,p.y+5,84*z,4);
    ctx.fillStyle='#4b4d4d';for(let i=-36;i<=36;i+=18)ctx.fillRect(p.x+i*z,p.y-8,4,20);
  } else if(prop.type==='mineCart'){
    ctx.fillStyle='#202326';ctx.fillRect(p.x-30*z,p.y-24*z,60*z,22*z);
    ctx.fillStyle='#55595a';ctx.fillRect(p.x-25*z,p.y-20*z,50*z,6*z);
    ctx.fillStyle='#111';ctx.fillRect(p.x-22*z,p.y,12*z,7*z);ctx.fillRect(p.x+12*z,p.y,12*z,7*z);
  } else if(prop.type==='torch'){
    ctx.fillStyle='#4a3020';ctx.fillRect(p.x-3*z,p.y-34*z,6*z,34*z);
    const flicker=Math.sin(state.time*11+prop.seed)*2;
    ctx.globalAlpha=prop.dim?.65:1;
    ctx.fillStyle='#b84f24';ctx.fillRect(p.x-6*z,p.y-45*z+flicker,12*z,13*z);
    ctx.fillStyle='#ff9d32';ctx.fillRect(p.x-4*z,p.y-49*z+flicker,8*z,12*z);
    ctx.fillStyle='#ffe08a';ctx.fillRect(p.x-2*z,p.y-45*z+flicker,4*z,7*z);
    ctx.globalAlpha=1;
  }
}
'''
s=s.replace("function drawProp(prop) {",insert+"\nfunction drawProp(prop) {")
s=s.replace("  if (prop.type === 'shrine') drawShrine(prop, p);","  if (prop.type === 'shrine') drawShrine(prop, p);\n  if (['mineWall','mineRock','mineCart','timber','brokenTimber','rail','torch'].includes(prop.type)) drawMineProp(prop,p);")
# Mine gets deterministic authored spawns; retain existing combat object shape and current systems.
old="const monsters = Array.from({ length: normalSpawnCount }, (_, i) => {"
new="const monsters = biome === 'mine' ? MINE_SPAWNS.map((spawn,i)=>{\n  const asset=MINE_MONSTERS[spawn.monster] || MINE_BOSSES[spawn.monster];\n  return {kind:spawn.boss?'boss':'small',monsterType:spawn.monster,name:asset.name,isBoss:!!spawn.boss,elite:asset.tier==='elite',x:spawn.x,y:spawn.y,size:spawn.boss?92:asset.tier==='elite'?64:52,spriteScale:spawn.boss?1.65:asset.tier==='elite'?2.68:2.15,speed:spawn.boss?52:68,targetX:state.player.x,targetY:state.player.y,phase:i*1.7,radiusX:spawn.boss?20:11,radiusY:spawn.boss?12:7,hp:spawn.boss?8:1,maxHp:spawn.boss?8:1,spawnX:spawn.x,spawnY:spawn.y,dead:false,aggressive:true,facing:'right',anim:'walk',animTimer:0,hurtTimer:0,flashTimer:0,attackTimer:0,deathTimer:0,respawn:spawn.boss?9999:undefined};\n}) : Array.from({ length: normalSpawnCount }, (_, i) => {"
s=s.replace(old,new)
s=s.replace("if (bossWave) {","if (bossWave && biome !== 'mine') {")
# Prevent undefined forest/desert asset in non-mine branch only remains there.
p.write_text(s,encoding="utf8")
print("mine visuals/spawns integration applied")

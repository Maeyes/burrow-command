import {describe,it,expect} from 'vitest';
import {existsSync} from 'node:fs';
import {ARCHIVE_COLLECTIONS,ALL_ARCHIVE_BOSSES,ARCHIVE_ICON_PATHS,FIRST_ARCHIVE_BOSSES,FIRST_ARCHIVE_BOSS_IDS,LIVE_ARCHIVE_BOSS_IDS,archiveProgress,relicIconPath} from './warren-relic-archive.js';
import {defaultMythic,normalizeMythic,recordMythicVictory,settleMythic,mythicHpMultiplier} from './warren-mythic.js';
import {renderRelicArchiveHtml} from './warren-relic-ui.js';

describe('Mythic Archive',()=>{
 it('defines seven independent mythology collections and the nine-item first collection',()=>{
  expect(ARCHIVE_COLLECTIONS).toHaveLength(7);
  expect(ALL_ARCHIVE_BOSSES).toHaveLength(44);
  expect(new Set(ALL_ARCHIVE_BOSSES.map(x=>x.id)).size).toBe(44);
  expect(new Set(ALL_ARCHIVE_BOSSES.map(x=>x.relicId)).size).toBe(44);
  expect(FIRST_ARCHIVE_BOSS_IDS).toEqual(['ancientDragon','sunWukong','kingArthur','medusa','fenrir','anubis','yamataNoOrochi','dracula','kraken']);
  expect(FIRST_ARCHIVE_BOSSES).toHaveLength(9);
  expect(LIVE_ARCHIVE_BOSS_IDS).toEqual(['ancientDragon']);
 });
 it('ships nine distinct original icon assets for the first collection',()=>{
  expect(Object.keys(ARCHIVE_ICON_PATHS)).toHaveLength(9);
  for(const boss of FIRST_ARCHIVE_BOSSES){
   const icon=relicIconPath(boss.relicId);expect(icon).toMatch(/^\.\/assets\/relics\//);
   expect(existsSync(new URL(icon,import.meta.url))).toBe(true);
  }
 });
 it('starts empty and migrates older Ancient Dragon saves without losing ownership',()=>{
  expect(archiveProgress(defaultMythic())).toMatchObject({first:0,total:9,complete:false});
  const migrated=normalizeMythic({relics:{dragonHeart:1},essence:3,selected:[2,3]});
  expect(archiveProgress(migrated).first).toBe(1);
  expect(migrated.defeats).toEqual({});expect(migrated.essence).toBe(3);expect(migrated.selected).toEqual([2,3]);
 });
 it('rejects non-existent and unreleased boss rewards unless a future encounter explicitly enables them',()=>{
  const state=defaultMythic();
  expect(recordMythicVictory(state,{bossId:'madeUp',relicDropped:true}).accepted).toBe(false);
  const blocked=recordMythicVictory(state,{bossId:'fenrir',relicDropped:true});
  expect(blocked.accepted).toBe(false);expect(blocked.state).toEqual(state);
 });
 it('records every Ancient Dragon victory, not only successful relic drops',()=>{
  const won=settleMythic(defaultMythic(),{won:true,relicEnabled:true,rng:()=>.9});
  expect(won.reward.relic).toBeNull();expect(won.state.defeats.ancientDragon).toBe(1);
  expect(archiveProgress(won.state).first).toBe(0);
 });
 it('records first discovery, duplicate conversion to essence and does not stack HP passives',()=>{
  const first=settleMythic(defaultMythic(),{won:true,relicEnabled:true,rng:()=>0});
  expect(first.reward).toMatchObject({relic:'dragonHeart',duplicate:false});
  expect(first.state.relics.dragonHeart).toBe(1);
  expect(first.state.essence).toBe(0);expect(mythicHpMultiplier(first.state)).toBe(1.01);
  const again=settleMythic(first.state,{won:true,relicEnabled:true,rng:()=>0});
  expect(again.reward).toMatchObject({relic:'dragonHeart',duplicate:true});
  expect(again.state.essence).toBe(1);expect(again.state.relics.dragonHeart).toBe(1);
  expect(again.state.defeats.ancientDragon).toBe(2);expect(mythicHpMultiplier(again.state)).toBe(1.01);
 });
 it('grants the first-collection cosmetic reward once, only after all nine unique relics',()=>{
  let state=defaultMythic();
  for(const boss of FIRST_ARCHIVE_BOSSES.slice(0,8)){
   const result=recordMythicVictory(state,{bossId:boss.id,relicDropped:true,allowUnreleased:true});
   expect(result.accepted).toBe(true);expect(result.collectionUnlocked).toBe(false);state=result.state;
  }
  expect(archiveProgress(state).first).toBe(8);expect(state.collectionRewardClaimed).toBe(false);
  const last=recordMythicVictory(state,{bossId:'kraken',relicDropped:true,allowUnreleased:true});
  expect(last.collectionUnlocked).toBe(true);expect(last.state.collectionRewardClaimed).toBe(true);
  expect(archiveProgress(last.state).complete).toBe(true);
  const html=renderRelicArchiveHtml(last.state);
  expect(html).toContain('✦ UNLOCKED');expect(html).toContain('bc-archive-portrait-frame');
  const repeat=recordMythicVictory(last.state,{bossId:'kraken',relicDropped:true,allowUnreleased:true});
  expect(repeat.collectionUnlocked).toBe(false);expect(repeat.state.essence).toBe(1);
 });
 it('renders nine focusable first-release cards and seven source tabs with a boss detail view',()=>{
  const html=renderRelicArchiveHtml(defaultMythic());
  expect((html.match(/data-archive-boss=/g)||[])).toHaveLength(9);
  expect((html.match(/data-archive-tab=/g)||[])).toHaveLength(8);
  expect(html).toContain('Dragon Heart');expect(html).toContain('Mythic Collector');
  expect(html).toContain('PLANNED');expect(html).toContain('LEGENDARY RELIC');
  expect(renderRelicArchiveHtml(defaultMythic(),'first','sunWukong')).toContain('ENCOUNTER PLANNED');
  const owned=renderRelicArchiveHtml(settleMythic(defaultMythic(),{won:true,relicEnabled:true,rng:()=>0}).state,'greek','medusa');
  expect(owned).toContain('Greek Mythology');expect(owned).toContain("Gorgon's Eye");
  expect((owned.match(/data-archive-boss=/g)||[])).toHaveLength(6);
 });
});

import {describe,it,expect} from 'vitest';
import {renderWaterfallGuideHtml,shouldShowWaterfallIntro,markWaterfallIntroSeen,WATERFALL_GUIDE_SEEN_KEY} from './warren-waterfall-guide.js';
import {renderGuideHtml,renderPatchNotesHtml,BURROW_VERSION} from './warren-guide.js';

const storage=()=>{
 const m=new Map();
 return {getItem:key=>m.get(key)??null,setItem:(key,value)=>m.set(key,value)};
};
describe('Waterfall update modal and in-game Guide',()=>{
 it('opens just once per published infographic revision without touching the gameplay save',()=>{
  const store=storage();
  expect(shouldShowWaterfallIntro(store)).toBe(true);
  expect(markWaterfallIntroSeen(store)).toBe(true);
  expect(store.getItem(WATERFALL_GUIDE_SEEN_KEY)).toBe('seen');
  expect(shouldShowWaterfallIntro(store)).toBe(false);
  expect(store.getItem('burrow-command-save-v3')).toBeNull();
 });
 it('renders the same real infographic in the startup and reopened Guide modal',()=>{
  const intro=renderWaterfallGuideHtml({intro:true}),reopened=renderWaterfallGuideHtml({intro:false});
  const src=html=>html.match(/<img src="([^"]+)"/)?.[1];
  expect(src(intro)).toBeTruthy();
  expect(src(intro)).toBe(src(reopened));
  expect(src(intro)).toMatch(/bunny_world_waterfall_update_guide\.png/);
  expect(intro).toContain('อัปเดตใหม่!');
  expect(reopened).toContain('กลับไปคู่มือ');
  expect(intro).toContain('data-waterfall-guide-close');
  expect(intro).toContain('id="waterfallGuideTitle"');
 });
 it('explains the mandatory water source on self-built hills and the natural cliff exception',()=>{
  const html=renderWaterfallGuideHtml();
  expect(html).toContain('ช่องกลางของเนิน');
  expect(html).toContain('บ่อรับน้ำบนพื้นปกติใต้ช่องที่เลือกทุกช่อง');
  expect(html).toContain('60 วัตถุดิบ + 35 Gold');
  expect(html).toContain('ม่านน้ำตก');
  expect(html).toContain('สันหน้าผาเหนือ');
  expect(html).toContain('alt="ผังการสร้างน้ำตก');
 });
 it('exposes a permanently available Guide button plus matching patch notes',()=>{
  expect(renderGuideHtml()).toContain('data-open-waterfall-guide');
  expect(renderPatchNotesHtml()).toContain('Patch Notes v'+BURROW_VERSION);
  expect(renderGuideHtml()).toContain('Version '+BURROW_VERSION);
 });
 it('handles disabled browser storage gracefully',()=>{
  const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
  expect(shouldShowWaterfallIntro(blocked)).toBe(true);
  expect(markWaterfallIntroSeen(blocked)).toBe(false);
 });
});
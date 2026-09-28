import {describe,it,expect} from 'vitest';
import {zoomViewportIntersects} from './runtime-viewport.js';
describe('zoom-aware Canvas culling',()=>{
 it('keeps sprites visible at 0.45 zoom despite negative pre-transform x',()=>{
  expect(zoomViewportIntersects(-240,290,-165,380,0,1)).toBe(false);
  expect(zoomViewportIntersects(-240,290,-165,380,0,.45)).toBe(true);
 });
 it('keeps zoomed-out walls even when entirely beyond unzoomed right/bottom edge',()=>{
  expect(zoomViewportIntersects(1420,740,1530,835,0,.45)).toBe(true);
  expect(zoomViewportIntersects(1420,740,1530,835,0,1)).toBe(false);
 });
 it('excludes genuinely off-camera sprites even at 0.26 zoom',()=>{
  expect(zoomViewportIntersects(5000,300,5200,400,0,.26)).toBe(false);
 });
 it('accepts long gate/fence runs when their starting point is outside but end is visible',()=>{
  expect(zoomViewportIntersects(-600,300,100,350,0,1)).toBe(true);
  expect(zoomViewportIntersects(1250,780,1550,680,0,.62)).toBe(true);
 });
 it('does not modify 1:1 behavior and respects margin padding',()=>{
  expect(zoomViewportIntersects(-12,100,-5,120,0,1)).toBe(false);
  expect(zoomViewportIntersects(-12,100,-5,120,14,1)).toBe(true);
 });
});
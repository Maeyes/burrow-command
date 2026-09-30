import {describe,it,expect} from 'vitest';
import {ARTHUR_INTRO_DURATION,arthurIntroPhase} from './warren-arthur-cinematic.js';

describe('King Arthur cinematic timeline',()=>{
 it('reveals and plants the sword before Arthur speaks, then shows the boss',()=>{expect([0,.7,3.1,5.1,7.3,10.3,13,ARTHUR_INTRO_DURATION].map(arthurIntroPhase)).toEqual(['ground','rise','burst','proclamation','king','banner','challenge','done']);expect(arthurIntroPhase(.64)).toBe('ground');expect(arthurIntroPhase(.65)).toBe('rise');expect(arthurIntroPhase(2.99)).toBe('rise');expect(arthurIntroPhase(3)).toBe('burst');expect(arthurIntroPhase(4.99)).toBe('burst');expect(arthurIntroPhase(5)).toBe('proclamation')});
});

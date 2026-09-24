import { describe, expect, it } from 'vitest';
import { InMemoryCharacterRepository } from './persistence';

describe('Character persistence boundary',()=>{
  it('uses optimistic revisions and reset preserves account identity',async()=>{
    const repo=new InMemoryCharacterRepository<{gold:number}>();
    const first=await repo.save({id:'c1',accountId:'a1',revision:0,state:{gold:99},updatedAt:''},0);
    expect(first.revision).toBe(1);
    await expect(repo.save({...first,state:{gold:1000}},0)).rejects.toThrow('revision-conflict');
    const reset=await repo.reset('a1',()=>({gold:0}));
    expect(reset.id).toBe('c1');
    expect(reset.accountId).toBe('a1');
    expect(reset.state.gold).toBe(0);
    expect(reset.revision).toBe(2);
  });
});

import type { CharacterStateV2 } from './character';
import type { CharacterRepository } from './persistence';
import { normalizeCharacterStateV2 } from './equipmentMigration';

export interface CharacterSessionV2 {
 accountId:string;
 characterId:string;
 state:CharacterStateV2;
 revision:number;
}

export class CharacterSessionServiceV2 {
 constructor(private readonly repo:CharacterRepository<CharacterStateV2>,private readonly initialState:(characterId:string)=>CharacterStateV2){}

 async load(accountId:string):Promise<CharacterSessionV2>{
  const record=await this.repo.loadByAccount(accountId);if(!record)throw new Error('character-not-found');
  return{accountId,characterId:record.id,state:normalizeCharacterStateV2(record.state),revision:record.revision};
 }

 async commit(session:CharacterSessionV2,next:CharacterStateV2):Promise<CharacterSessionV2>{
  if(next.characterId!==session.characterId)throw new Error('character-id-mismatch');
  const saved=await this.repo.save({id:session.characterId,accountId:session.accountId,state:next,revision:session.revision,updatedAt:new Date().toISOString()},session.revision);
  return{accountId:saved.accountId,characterId:saved.id,state:saved.state,revision:saved.revision};
 }

 async reset(session:CharacterSessionV2):Promise<CharacterSessionV2>{
  const id=session.characterId;
  const reset=await this.repo.reset(session.accountId,()=>this.initialState(id));
  return{accountId:reset.accountId,characterId:reset.id,state:reset.state,revision:reset.revision};
 }
}

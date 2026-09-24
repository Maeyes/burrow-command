export interface AccountRecord {
  id: string;
  createdAt: string;
  settings: Record<string, unknown>;
}

export interface CharacterRecord<TState = unknown> {
  id: string;
  accountId: string;
  revision: number;
  state: TState;
  updatedAt: string;
}

export interface CharacterRepository<TState> {
  loadByAccount(accountId: string): Promise<CharacterRecord<TState> | null>;
  save(record: CharacterRecord<TState>, expectedRevision: number): Promise<CharacterRecord<TState>>;
  reset(accountId: string, initialState: () => TState): Promise<CharacterRecord<TState>>;
}

export class InMemoryCharacterRepository<TState> implements CharacterRepository<TState> {
  private records = new Map<string, CharacterRecord<TState>>();

  async loadByAccount(accountId: string): Promise<CharacterRecord<TState> | null> {
    return this.records.get(accountId) ?? null;
  }

  async save(record: CharacterRecord<TState>, expectedRevision: number): Promise<CharacterRecord<TState>> {
    const current = this.records.get(record.accountId);
    if (current && current.revision !== expectedRevision) throw new Error('revision-conflict');
    if (!current && expectedRevision !== 0) throw new Error('revision-conflict');
    const saved = { ...record, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    this.records.set(record.accountId, saved);
    return saved;
  }

  async reset(accountId: string, initialState: () => TState): Promise<CharacterRecord<TState>> {
    const current = this.records.get(accountId);
    const reset: CharacterRecord<TState> = {
      id: current?.id ?? `character:${accountId}`,
      accountId,
      revision: (current?.revision ?? 0) + 1,
      state: initialState(),
      updatedAt: new Date().toISOString(),
    };
    this.records.set(accountId, reset);
    return reset;
  }
}

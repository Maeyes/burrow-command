# Burrow Command — Mythic Archive / Relic Collection

## Scope (September 28, 2026)

Relic Collection is a persistent museum/achievement system. The in-game launcher is anchored to the **bottom of the existing engine minimap** on desktop. On mobile it lives in the Village drawer. This does not create a second minimap or modify the existing WASD camera controls.

- Seven mythology/source tabs: Greek (6), Norse (6), Chinese (6), Egyptian (6), Japanese (6), European Legends & Literature (7), Primordial Beasts (6). The original Ancient Dragon appears in First Collection, outside these seven source tabs.
- First Collection: Ancient Dragon, Sun Wukong, King Arthur, Medusa, Fenrir, Anubis, Yamata no Orochi, Dracula, Kraken. Nine original pixel-styled crisp SVG icon assets are stored under `art-test/dimraeth-slice/assets/relics/` and explicitly copied into the standalone deployment by `vite.warren.config.ts`.
- Only **Ancient Dragon** is currently live. The other 43 archive entries (including eight other First Collection bosses) are clearly marked *Coming soon / Encounter planned*. Merely appearing in the catalog does not enable an encounter or grant a drop.
- Ancient Dragon: winning the Mythic Invasion records one boss defeat, pays existing Option/Re-option Stones, and has an independent 20% chance of dropping Dragon Heart. First drop permanently unlocks the relic. A duplicate converts into one Essence; it cannot stack extra HP. A lost fight never awards a kill or relic.
- Dragon Heart remains the only live relic combat passive: **Max HP +1%** for the army via the pre-existing `mythicHpMultiplier`. Future relic effects are *not* enabled without explicit balance and encounter implementation. No speculative bonuses are applied from the Archive UI.
- Once all nine unique First Collection relics are owned, the game unlocks the cosmetic **Mythic Collector** title and **Portrait frame**. The completion reward is separate from all individual relic passives and does not grant hidden combat stats. Unlock is persisted as `mythic.collectionRewardClaimed`.
- Each boss has persistent `mythic.defeats[bossId]` as a win counter. This works even on a run without a relic drop. The collection, duplicate currency and counters travel with the existing Warren save. Older saves with only `mythic.relics.dragonHeart` are normalized without losing that relic.

## Source of truth / adding future bosses

The pure catalog is `art-test/dimraeth-slice/warren-relic-archive.js`; collection UI lives in `warren-relic-ui.js`, state/award logic in `warren-mythic.js`, and wiring in `warren.js`. Do not introduce another relic wallet, collection progress counter, or boss-defeat inventory item.

To ship a future boss: (1) implement its actual battle and victory verification; (2) add its ID to `LIVE_ARCHIVE_BOSS_IDS`; (3) have the *trusted victory callback* call `recordMythicVictory(state,{bossId,relicDropped})`; (4) save and refresh army if a new combat passive is implemented; (5) balance its actual drop rate and passive independently. `allowUnreleased` in the pure award function exists for catalog-completion unit tests only; do not expose it in the player UI. Add a unique icon asset if the boss joins a featured collection.

All current art is new geometric pixel-style SVG, rather than a trace of modern adaptations. Cross-cultural mythology names in the catalog are reference themes only; narrative, creature design and religious sensitivity should be reviewed per encounter before shipping.

## Verification

Run `npx vitest run art-test/dimraeth-slice/warren-mythic.test.js art-test/dimraeth-slice/warren-relic-archive.test.js`, then `npx vite build --config vite.warren.config.ts` and verify nine relic SVG files exist in `dist-warren/art-test/dimraeth-slice/assets/relics/`. The existing northern-cliff/waterfall tests belong to the separate Home Builder workstream.

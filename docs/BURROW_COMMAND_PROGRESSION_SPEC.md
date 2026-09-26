# Burrow Command — Progression Spec (v1, agreed 2026-09-26)

Goal: turn the 5-night prototype into a game you keep playing. The warren persists, losing a night
is a setback, never a game over, and the squad keeps getting stronger.
Read with `docs/HANDOFF_BURROW_COMMAND_2026-09-26.md` (how the prototype works today).

## 1. Core loop
Farm by day → craft / enhance / level bunnies → beat the night wave → upgrade the warren →
tougher waves + new items → every 10 warren levels a new land (theme).

## 2. Persistence and soft failure
- **Autosave** every dawn (and on warren upgrade) to `localStorage` (`burrow-command-save-v1`),
  versioned so later migrations are possible. Load on start. A "เริ่มหมู่บ้านใหม่" button wipes it
  (with confirm).
- **Losing a night is not game over.** When the hall hits 0 HP:
  - the night ends at once; towers that fell stay destroyed; all bunnies are downed;
  - the hall is left at a low HP (e.g. 20%); 20% of banked gold is lost;
  - next dawn is a normal day: repair, farm, recruit, craft.
- **The wave counter only advances on a win.** Next night the *same* wave comes back (same
  composition and strength). You face it better prepared.
- Show both: **"วันที่ N"** (calendar, always advances) and **"เวฟ W"** (progress, only on wins).
  E.g. "วันที่ 12 · เวฟ 8" means four lost nights.
- No final night. Waves continue forever, scaling with the warren level (§3).

## 3. Warren level (the master axis)
The warren level caps everything, and wave difficulty is tied to it, so power and challenge stay
in step.

| Warren level gates | Rule (starting values, tune later) |
|---|---|
| Bunny level cap | bunny level ≤ warren level |
| Craftable tier | main game `TIER_LEVEL_RANGES` by warren level |
| Squad size / towers | grows in steps (e.g. +1 bunny slot per level, +1 tower every 3 levels) |
| Build slots per class | 2nd build at Lv 10, 3rd at Lv 25 |
| Land | a new land every 10 levels |

**Waves:** each warren level has **5 waves**; wave 5 is a **boss**.
- Wave strength = f(warren level, wave index 1..5). Monsters come from the land matching the
  warren level, at their **real `MONSTERS_V2` levels** (so loot and stats line up with the main game).
- **Beating wave 5 lets you upgrade the warren** (still costs gold + materials).
- The player chooses *when* to upgrade: once wave 5 is beaten, the nights replay that level's
  waves (farmable), so you can gear up first. Upgrading early = new items sooner but harder nights.

| Warren Lv | Land | Wave monsters | Item tier |
|---|---|---|---|
| 1–9 | Forest | forest roster | T1 |
| 10–19 | Desert | desert roster | T2 |
| 20–29 | Snow | snow roster | T3 |
| 30–39 | Magma | magma roster | T4–T5 |
| 40+ | Asgard | asgard roster | T6 |
Later: new themes (steampunk / techno / robots, per friend feedback) need new PixelLab art.

## 4. Bunnies (individual)
- Each bunny has a **name** (random from a Thai/English bunny-name list, renamable) and **level + EXP**.
  EXP from kills and from surviving nights; level ≤ warren level.
- Level adds base stats (hp/atk) and gates the class build's gear and core slots.
- Recruit price still rises per extra bunny of a class.

## 5. Classes, builds, gear, mastery, cores (shared per class)
Classes: ผู้พิทักษ์ (swordShield), นักธนู (bow), หน่วยเร็ว (dagger), นักทุบ (hammer),
**นักบวช (staff, new: heals and supports)**.

- **Gear is per class build, not per bunny.** Equip once and every bunny on that build uses it.
  Slots: **weapon** (the class's family), **armor**, **accessory**.
- **Builds:** each class starts with one build. "สร้างบิลด์ใหม่" opens another (warren-level gated +
  gold). Each build has its own gear and skill cores. Each bunny picks a build; new recruits get
  the class's main build. Example: Guard "Tank" vs Guard "Support".
- **Mastery is per class**, shared by all its builds. Every bunny of the class feeds its mastery XP.
  Milestones unlock passives and weapon skills from the main game's `WEAPON_MASTERY_MILESTONES`.
- **Skill cores are per build.** Slots unlock with the bunny's level (e.g. Lv 10 / Lv 25 / Lv 40).
  Bunnies cast them through the main game's auto-cast (`nextAutoSkillCommand`).
- **Team support:** in the main game Healing Pulse / Barrier / Valkyrie's Call affect the caster only.
  Here they must affect **allies in a radius**, and the AI heals the lowest-HP ally first.
- The ★ class upgrade from the prototype is **replaced** by this system.

## 6. Items and crafting (reuse the main game's data)
- Import from `src/simulation`: `EQUIPMENT_MASTER_V2` / `CRAFT_RECIPES_V2` (templates, recipes),
  `rollRarity` + `EQUIPMENT_RARITY_STAT_MULTIPLIER` (7 rarities), `enhancementRequirement`
  (aetherstones), `dismantleFragments`, `MONSTERS_V2` loot + `rollLoot`.
- Drops are **real items** (ores, materials, aetherstones, blueprints, cores), replacing the
  prototype's generic wood/hide/ore. Gold still comes only from kills.
- **Forge (โรงตีเหล็ก)**, a new building: craft (recipe → rarity roll), enhance, dismantle.
- Warren storage holds everything. An "จัดให้อัตโนมัติ" button equips the best gear per build.
- Later layers (no redesign needed): refine, affixes, set bonuses, skill mods.
- **Balance note:** main game numbers are tuned for one hero. One item here powers a whole class,
  so drop rates / multipliers need an army-scale pass (use the balance bot).

## 7. Phases (each one playable and deployable)
1. **Core:** save/load, soft failure + repeat wave, endless waves, warren level + upgrade gated by
   wave-5 boss, waves scaled by warren level. HUD: day / wave / warren level.
2. **Bunnies & items:** names + EXP/levels (cap = warren level), real item drops, forge (craft with
   rarity, enhance, dismantle), class builds with 3 gear slots, remove ★.
3. **Mastery & cores:** class mastery + milestones, core slots per build, team-radius heals and
   shields, the new staff class (นักบวช).
4. **Lands:** desert / snow / magma / asgard waves and rosters by warren level; then new themes.

## 8. Rules for whoever implements this
- Gameplay timers use `later()` (game clock), never `setTimeout`.
- Hero art is **Blessed Bunny only**. Never ship `public/` in the Burrow Command build.
- Keep the balance bot passing: a reasonable bot must survive, a do-nothing bot must lose.
- Deploy only when asked: `powershell -File tools/deploy-warren.ps1`.

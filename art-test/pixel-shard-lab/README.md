# Supplied pixel VFX assets

Source images supplied by the user on 2026-09-30. Green backgrounds are keyed out without changing violet/gold artwork. Images already containing alpha retain it.

- `image-gen-5.png`: 76 disconnected components retained above 80 pixels, sorted by area. Touching streaks stay together; this is segmentation, not a reconstructed layered illustration. Demo offers outward movement, rotation, orbit and original arrangement.
- `image-gen-2.png`: gold crescent used by Arthur's Excalibur. Original faces left; the battle renderer rotates its left-facing axis into projected travel direction. Travels 1100 world units over 1.65 seconds. Existing target damage and balance are unchanged; visual path is longer than the damage area.
- `image-gen-9(1).png`: purple vortex retained as a preview option.
- `image-gen-10(1).png`: chosen gold/violet summoning circle in Arthur intro. Sword is revealed from its center and rises toward screen center.
- `ChatGPT Image Sep 25, 2026, 09_02_54 PM.png`: 8-frame blue burst with common 360px frame canvas; plays once during intro burst instead of the CSS diamond and square particles.

Preparation: `python art-test/arthur-review/extract-vfx.py`. Asset extraction is reproducible from the original Downloads files. The one-off `integrate-vfx.py` is not an idempotent migration and must not be rerun.

Preview: `/art-test/pixel-shard-lab/`. Cinematic: `/art-test/dimraeth-slice/warren.html`, select King Arthur and summon.

## Latest accepted direction

Order: circle → sword descent/planting → blue flecks → Arthur proclamation → actor entrance → blue/gold banner → challenge → battle.

- Circle: 0–0.65s.
- Sword: 0.65–3s, point-first descent over 2.35s, with twelve violet fragments orbiting the moving sword. Two brief blue flashes during descent, plus a landing flash.
- Landing aftermath: 3–5s. Forty-eight tiny blue sprites fall across the screen, continuing into the proclamation. No giant blue explosion.
- Proclamation: 5–7.2s, navy background with gold lettering: “ข้าคืออาเธอร์ ราชาแห่งคาเมล็อต” / “ด้วยคมดาบเอ็กซ์คาลิเบอร์ จงพิสูจน์เกียรติของเจ้า”. Sword remains planted behind the text.
- Actor entrance: 7.2–10.2s; banner: 10.2–12.9s; challenge ends at 15.3s.

Arthur's rotation: Excalibur → Excalibur → Bowling Bash → Knights of the Round. Excalibur cooldown 1.8s; Bowling Bash deals two area hits 0.18s apart, radius 170, gold crescent size 300. All mythic boss base attacks use `(20 + warren * 5) * 2`; HP stays at the previous values.

Arthur's battle entry reuses Wukong's left-side world position (`CENTER.x - 220`, `CENTER.y + 220`). The former offset (-92,+72) placed him inside/behind the hall footprint and is no longer used.

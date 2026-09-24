# Isometric Map — Audit (2026-09-24)

## สถานะจริงตอนนี้
- Runtime: `art-test/iso-arena-draft/poc.js` (2571 บรรทัด, canvas 2D ล้วน, ไม่มี engine) — `index.html` redirect มาที่นี่
- Projection **เป็น 2:1 isometric แล้วในทางคณิตศาสตร์** — `worldToScreen` / `screenToWorld` (`ISO_X=.5, ISO_Y=.25`), depth sort ด้วย world Y, collision เป็นวงรี, movement ต่อเนื่อง (ไม่ใช่ grid)
- Simulation (`src/simulation/`) แยกออกจาก presentation แล้ว → เปลี่ยนการวาดแมพได้โดยไม่แตะ game logic

## ทำไมภาพถึง "ไม่เป็น iso" ทั้งที่ math เป็น iso
1. **พื้นไม่มีทิศทาง iso** — `drawGround()` เติมสีทึบใน diamond ใหญ่อันเดียว แล้วโปรย `fillRect` ที่ตั้งตรงกับจอ (moss, grass bits, trail, clearing) → ตาอ่านเป็น top-down
2. **Props วาดแบบหน้าตรง** — ต้นไม้/หิน/อาคารวาด procedural แบบ front-view (`drawTree` ฯลฯ) ไม่มีสองด้านข้างแบบกล่อง iso
3. **ไม่มีระดับความสูง** — ไม่มี cliff / ขั้นบันได / ด้านข้างของพื้น ซึ่งเป็นสัญญาณหลักที่ทำให้ตาอ่านว่า iso
4. **ขอบแมพแทบไม่เห็น** — diamond ใหญ่ถูกกล้องซูมจนเห็นแค่พื้นเขียวเรียบ
5. **ไม่มี iso terrain asset จริงสักชิ้น** — `isometric-terrain-lab` ล้ม: PixelLab คืน transition tile 64×28 แต่ contract บังคับ 64×64 ห้าม pad → manifest ว่าง
6. **โค้ดแมพ hard-code ต่อ biome** — `if(biome==='town')…` กระจายใน `poc.js`; ทุกครั้งที่ลองเปลี่ยนต้องแก้ทุก biome พร้อมกัน

## Assets ที่มี
- ตัวละคร/มอนสเตอร์ 8 ทิศ 64×64 (PixelLab) — ใช้ต่อได้
- ชุด top-down Sunnyside จำนวนมากใน `public/assets` — ใช้กับ iso ไม่ได้
- `art-test/isometric-terrain-lab/pixellab-raw/` — base 64×64 (16 candidates) + transitions 64×28 (ยังไม่ผ่าน)

## เป้าหมายภาพ: Dimraeth (ยืนยันกับผู้ใช้ 2026-09-24)
จาก screenshot บน Steam (app 2402680) สิ่งที่ทำให้ Dimraeth "อ่านเป็น iso" **ไม่ใช่ diamond tile grid** (มองไม่เห็น grid เลย) แต่คือ:
1. **ของที่มนุษย์สร้างวางตามแนวทแยง iso** — รั้ว กำแพง แปลงผัก ทางปูหิน บ้าน ทุกเส้นเอียง 2:1
2. **ความสูงมีหน้าด้านข้าง** — กำแพงหิน ขอบหน้าผา ฐานอาคาร เห็นหน้าบน + หน้าข้าง
3. **พื้นเป็นภาพวาดต่อเนื่อง** — หญ้า/ดิน/ทรายเป็นก้อน organic ขอบ dither แบบ pixel ไม่มีรอยต่อ tile
4. **พืชหนาแน่นมาก** — กอหญ้า พุ่มไม้ ดอกไม้ ทุกที่ ต้นไม้ใหญ่บังตัวละครได้
5. **แสง** — แสงอุ่นเป็นจุด glow, เงา, มุมมืด, vignette
6. สีสดอิ่ม, ตัวละครเล็กเมื่อเทียบกับโลก, ไม่มี label/ป้ายรกจอ

ข้อสรุป: รอบก่อนไปไล่ทำ diamond terrain tile (terrain-lab) ซึ่งไม่ใช่สิ่งที่ทำให้ภาพเหมือน Dimraeth

## Step 1 — ฉากทดลอง (ทำแล้ว 2026-09-24)
`art-test/dimraeth-slice/` (เปิดที่ `/art-test/dimraeth-slice/`) — ภาพทั้งหมดเป็น procedural pixel art ใน `slice.js`, ใช้ projection เดียวกับเกม
- พื้นวาดครั้งเดียวเป็นภาพใหญ่ (~3.7s): หญ้า/ดิน/ทางปูหิน/แปลงผัก + เงาต้นไม้แบบเย็น + กอหญ้า/ดอกไม้
- หน้าผาหิน 2 แนว + บันไดหิน, บ้านไม้ (หลังคา slate, ปล่องควัน), รั้วรอบแปลงผัก, ลังไม้, กองไฟ, ตะเกียง
- ต้นไม้ 3 แบบ (ใบกว้าง/สน/ใบส้ม-ชมพู), พุ่มไม้, หิน; ต้นไม้จางลงเมื่อบังตัวละคร
- แสง golden hour + โหมดพลบค่ำ (`L`) ที่มีแสงไฟ/หิ่งห้อย
- depth sort ใช้ box separating-axis (รองรับบ้าน/รั้วยาว)

## เมือง Bunny Haven (ทำแล้ว 2026-09-24)
`?map=town` — ใช้ renderer เดียวกับป่า (`slice.js` แยกเป็น scene config: `forestScene()` / `townScene()`)
- ลานกลางปูหินแผ่นใหญ่ + วงหินรอบน้ำพุ, น้ำพุ 2 ชั้น (cylinder raster) มีละอองน้ำ
- ศาลากลาง (หิน 2 ชั้น, หอนาฬิกา, ธงโบก, ธงแขวน), ร้าน ITEM/GEAR มีกันสาด+ป้ายไอคอน, บ้าน 5 หลังหลังคาหลายสี, ปล่องควัน
- แผงตลาด 3 ร้าน, ม้านั่ง, กระบะดอกไม้+ต้นซากุระ, ถังไม้, ลังไม้, แปลงผัก
- กำแพงเมืองมีใบเสมา + หอคอยมุม/ประตู 3 ทิศ, ถนนออกนอกเมืองไป warp portal (ตะวันออก/ใต้)
- ต้นไม้นอกกำแพงถูกกันไม่ให้พุ่มบังถนน/portal/หน้าบ้าน (canopy check)
- bake ~10s (ช้ากว่าป่า) — ต้อง optimize ก่อนเข้าเกมจริง

## ระบบพื้นฐาน v3 — terrain หลายระดับ (ทำแล้ว 2026-09-24)
แยกโค้ดเป็น engine (`engine/*.js`) + ผังแมพ (`scenes/*.js`) — **คู่มือสำหรับ AI/คนที่ทำต่อ: `art-test/dimraeth-slice/ENGINE.md`**
- พื้นเป็น height grid (cell 16 หน่วย) → หน้าผา/บันได/ตลิ่ง/น้ำตก เกิดเองจากความต่างความสูง
- bake ด้วย ray ต่อ pixel (DDA) + เก็บ zbuf → sprite หลังพื้นที่สูงถูกบังถูกต้อง
- บันไดเดินขึ้นลงได้จริง (player มีค่า z), แม่น้ำเดินข้ามไม่ได้ ยกเว้นบนสะพาน
- แมพใหม่ `?map=valley` หุบเขาน้ำตก: 3 ระดับ, แม่น้ำตก 2 ชั้น, สะพานไม้, บันได 2 จุด, ศาลเจ้าร้างบนยอด
- ไฟล์เก่าเก็บใน `_backup/`

## เอกสารที่เกี่ยวข้อง
- `art-test/iso-arena-draft/ASSET_BIBLE.md` — กติกา grid 64×32, anchor, layer
- `art-test/isometric-terrain-lab/PIXELLAB_FAILURE_REPORT.md`
- `art-test/isometric-poc/whispering-forest-qa.md` — QA ผ่านเฉพาะ projection/movement ไม่ใช่ความ "ดูเป็น iso"

# Bunny Rig Studio — in-project animation editor

**Local developer tool.** This is a self-contained copy of the original Bunny Rig Studio prototype, isolated from the game simulation and production Warren build.

## Open

- From `C:\bunny-world`, run `npm run dev` and visit `http://localhost:5173/art-test/bunny-rig-studio/`.
- You may also open `art-test/bunny-rig-studio/index.html` directly in Chrome/Edge. The editor's demo and basic tools work offline.
- This page is a development/art-production tool; it is **not** linked into the public game or deployed to GitHub Pages yet.

## Simple 2D Cutout Lab V1 — one Master → 11 layers → animation

Open `http://localhost:5173/art-test/bunny-rig-studio/cutout-lab.html`. This is the beginner-facing experiment for our newly agreed **fixed-view 2D cutout** workflow. It uses a deliberately simple, code-drawn Blessed Bunny, **not a final art asset** and not yet a painting editor. Clothing, belt and tunic are painted on **one Torso image**; the two arms and two legs are whole cutouts for this first version. The remaining movable parts are Head, Front/Back Ears, Scarf, Cape and Tail, **11 parts total**. They are grouped from the same original 256×256 coordinate system used by the more detailed 19-piece geometry proof.

The lab presents four progressive steps in one UI: (1) **Master**: compare the single coherent character against the reassembled 11 transparent cropped PNGs — exact, zero-pixel mismatch; (2) **Layers**: select a limb directly on Canvas or via a clearly labeled thumbnail, drag to move, switch to Rotate and drag around its visible pivot (or use the ±15° buttons), edit X/Y/Rotation in the Inspector, use Reset Selected and Ctrl+Z / Ctrl+Y; (3) **Animate**: play Idle/Walk/Attack clips (8 frames), click individual frames and add a cutout movement by dragging or rotating — each change creates an editable keyframe on that frame; (4) **Export**: save the fully editable Bone Rig JSON (embedded PNG data, pivots, parent relationships and keys), export 256px transparent sprite-sheet PNG, or download the Master PNG.

From the Lab, **Open in full Rig Studio** opens the **unedited starter project** using `index.html?cutout=1`. To continue an **edited** animation in the full studio, download Bone Rig JSON first and open that JSON manually; the full studio also has a separate **✂️ Cutout 11 Layers** starter button. The 19-layer QC page remains available and unchanged for checking whether an artist-produced, multi-segment rig is aligned. These are local art-production experiments only; no production game/combat files are changed.

**Limitations:** No mesh deformation, cloth bending, auto-rig from one raster image, drawing tool for master art, or automatic weapon rigging yet; they are not required to test this cutout-first pipeline. If the simplified whole-arm or whole-leg silhouette creases too obviously during big rotations, we can optionally split that limb into upper/lower parts later, without moving clothing off the torso.

**Automated checks:** `node tools/bunny-cutout-lab-smoke.mjs` covers the pixel-exact reconstruction of 11 transparent parts from a single master; grouping and valid pivots, arm rotation/move, undo/redo, Walk/Attack keys, native Rig Studio compatibility, editable JSON/PNG export and mobile/offline use. Also run `node tools/bunny-rig-proof-smoke.mjs` to keep the previous 19-part QC baseline.

## Blessed Bunny Rig Geometry Proof V1 — verify parts before drawing final art

Open `http://localhost:5173/art-test/bunny-rig-studio/rig-proof.html` (also works as a local offline HTML file). This is a **deliberately simple geometry test**, not production-quality Blessed Bunny artwork and not an AI-generated asset sheet. The whole bunny is drawn on a shared 256×256 master coordinate system. The script separates each of its **19 actual drawn layers** into an independent tightly cropped PNG with a transparent background, explicit parent bone, exact local pivot, and offset derived from that same coordinate system.

The QC page displays the original Master next to the result reconstructed **from those cropped PNGs using their hierarchical bone matrices**. Its automated browser test verifies **zero mismatched RGBA pixels**, correct transparency, valid pivots and no missing parent bones. The Rig Studio's own DOMMatrix renderer separately reconstructs the downloaded geometry proof project with zero channel mismatches. This guards against the failure mode where independently generated arms/legs have the wrong scale, angle or connecting joints.

**Try it:** From the QC page click **เปิด Rig-ready Bunny ใน Rig Studio**; alternatively open `index.html` and click **🧪 Rig QC** in the top bar (it asks permission before replacing an existing unsaved project). The Rig Studio initially shows **Proof Assembly**, which must match the Master exactly; then select **Proof Idle**, **Proof Raise Arm**, or **Proof Walk** to inspect animation and joint attachment. The QC page also lets you download a 256×256 transparent Master PNG, the editable Bone Rig JSON (which embeds every cropped PNG), and each of the 19 individual transparent PNG files.

**Scope:** One unarmed test bunny first. **Do not commission seven weapon sets or paint production FX until the character silhouette, arm/leg proportions, and pivots have been approved**. Additional shaded professional art should be authored from one pose-locked master with layered files, not independent generative renders of every limb. Do not replace the production hero or touch Bunny World's combat engine.

**Regression:** `node tools/bunny-rig-proof-smoke.mjs` checks alpha, precise reconstruction, downloaded image/JSON, single-click loading into existing Rig Studio, leg/arm animation and exports, plus offline use. Existing Rig/Frame Animator/FX Lab workflows are unchanged.

## First animation

1. Start with the included **Blessed Bunny** demo. The editor includes Idle, Walk and Slash clips.
2. To use your own art, click **＋ เพิ่ม PNG** and import one transparent PNG per body part (body, head, ears, upper/lower limbs, equipment and cape). Keep all source parts the same pixel density.
3. Select each layer, set its **Pivot** and **Parent Bone**, then use Move/Rotate/Pivot on the Canvas.
4. Pick a clip in the left panel, scrub the Timeline, pose the parts and add **◆ Keyframe**; Play previews tweened motion. Onion Skin helps compare adjacent frames.
5. **บันทึก JSON** exports an editable project including embedded images. **Export Sprite Sheet** renders the current clip to a transparent PNG with 256×256 cells, ready for a slicing/animation pipeline. Set clip frames/FPS and sprite sheet columns in the Inspector. Keep original JSON to change the animation later.

Imported art stays in your browser/JSON; it is **not** automatically moved into game assets. Sprite sheet export does not yet attach the resulting animations to Bunny World's existing hero or monster runtime. Inspect and validate extracted frames before replacing production sprites.

## Frame Animation: PNG 4 หรือ 8 เฟรมในไฟล์เดียว

เปิด `http://localhost:5173/art-test/bunny-rig-studio/frame-animation.html` (หรือคลิก **🎞 Frame Animation** ใน Editor) แล้วกด **Sprite Sheet** เพื่อเลือกภาพ PNG พื้นหลังโปร่งใส รองรับปุ่มตัดภาพสำเร็จรูป **4×1, 2×2, 1×4, 8×1, 4×2, 2×4 และ 1×8** หรือกำหนดจำนวนแถว/คอลัมน์เองได้สูงสุด 64 เฟรม รวมถึงภาพแยกเฟรมหลายไฟล์

กรณีภาพ 8 เฟรมเรียงเป็นแถบเดียว ให้เลือก **8 แนวนอน**; ถ้า 4 ภาพด้านบนและอีก 4 ภาพด้านล่าง ให้เลือก **8 (4×2)** ก่อนกด **✂️ ตัดและเพิ่มเฟรม** ตรวจรูปแต่ละเฟรมและลำดับใน Timeline แล้วกด **Play** และตั้ง FPS (เช่น 8 FPS = 1 วินาทีต่อรอบสำหรับ 8 เฟรม) ปรับ X/Y รายเฟรมเมื่อจำเป็น จากนั้น Export ได้ทั้ง Sprite Sheet PNG พื้นหลังโปร่งใส, Animated GIF และ JSON ที่เก็บภาพต้นฉบับทุกเฟรมไว้แก้ต่อภายหลัง

**แก้ปัญหา Grid หารไม่ลงตัว:** หากภาพที่เจนมีขนาดเช่น 65×33 หรือ 1537×1024 ซึ่งหาร 4/8 ช่องไม่ลงตัว ตัวตัดภาพจะกระจายพิกเซลส่วนเกินให้แต่ละช่องต่างกันไม่เกิน 1px โดยไม่ยืดภาพ ไม่ตัดพิกเซลริมภาพทิ้ง และคง Alpha เดิม หากงานเจนมีช่องไฟหรือขอบจริง ให้ปรับ Margin / Spacing ตามภาพนั้นก่อนตัด

ทดสอบทั้งตัว Editor เดิมและ Frame Animation ด้วย `node tools/bunny-rig-studio-smoke.mjs` และ `node tools/bunny-frame-animator-smoke.mjs` ตามลำดับ

## Auto Extract Main Sprite — Review Workshop

เมื่อ Import Sprite Sheet แล้ว ตั้ง Grid 4 / 8 เฟรมคร่าว ๆ เหมือนเดิม จากนั้นกด Auto Extract เพื่อเปิด Workshop แบบ non-destructive ก่อนเพิ่มเข้า Timeline:

1. เลือกเฟรม F01–F08 แยกจากกัน แล้วลากกรอบ Crop หรือกรอก X/Y/Width/Height เพื่อเก็บส่วนของตัวละครที่กินพื้นที่ข้ามช่องโดยไม่ยืดพิกเซล หากภาพมีพื้นที่โปร่งใส กด Trim Transparent ได้ทุกเฟรม
2. กด Detect เพื่อเสนอ Connected Components และเน้นกลุ่มหลักสีเขียว ทุกกลุ่มยังถูกเก็บไว้จนกว่าจะเอาเครื่องหมายหน้าแต่ละกลุ่มออกด้วยตัวเอง ปุ่ม เลือกเฉพาะ Main ต้องยืนยันก่อนเสมอ และ Undo ได้ ตรวจหาง กระบอง ผ้าคลุม และ VFX ที่แยกเป็นอีกกลุ่มก่อนใช้ปุ่มนี้
3. ใช้ Eraser ระบายซ่อนเศษภาพจากเฟรมข้างเคียง และใช้ Restore ระบายคืนพิกเซลจากต้นฉบับ ปรับขนาดแปรงได้ 0–32px พื้นที่ที่เปิดเพิ่มจากการขยายกรอบจะเก็บพิกเซลเดิมไว้ทุกครั้ง
4. ปุ่มรูปตาใช้สลับภาพ ต้นฉบับ / เฟรมก่อนหน้า / เฟรมถัดไป และปรับ Overlay Opacity ได้ 5–90% แกนกากบาทสีเขียวเป็น Pivot X / Foot Y สำหรับใช้ร่วมกันเป็นฐาน Alignment ปรับ Offset X/Y แยกทุกเฟรมได้
5. กด PNG เฟรมนี้ เพื่อ Export เฟรมที่เลือกเป็น PNG พื้นหลังโปร่งใส หรือ เพิ่มทุกเฟรมเข้า Timeline เพื่อใช้ FPS, Loop, GIF, Sprite Sheet, JSON และ PNG เฟรมเดี่ยวของ Frame Animator เดิม

Workshop เก็บต้นฉบับ PNG ระหว่างที่หน้าเว็บยังเปิดอยู่ แต่ JSON ของ Frame Animator เก็บเฉพาะเฟรมที่ผ่านการ Review แล้ว หากต้องแก้ Extraction จาก Sheet อีกครั้งหลังปิดหน้า ให้เปิด PNG ต้นฉบับใหม่ การแยกชิ้นส่วนที่ซ้อนทับจริง ๆ ไม่สามารถกู้ส่วนที่ถูกวาดทับจากข้อมูลพิกเซลเดียวได้ ต้องซ่อมภาพด้วยตนเอง

ทดสอบด้วยคำสั่ง npx vitest run art-test/bunny-rig-studio/auto-extract-core.test.js art-test/bunny-rig-studio/frame-animation-core.test.js, node tools/bunny-auto-extract-smoke.mjs, node tools/bunny-frame-animator-smoke.mjs และ node tools/bunny-rig-studio-smoke.mjs ข้อทดสอบ Auto Extract ใช้แถบ 8 เฟรมจำลองที่มีกระบองยื่นข้ามช่อง หาง/ผ้าคลุมแยกชิ้น และการลบเศษเฟรมข้างเคียง รวมถึง Grid 4×2 และ Offline ไม่ใช่การรับรองว่า Asset Wukong ที่ยังสร้างไม่เสร็จผ่านการทดสอบแล้วจนกว่าจะมี Sprite Sheet จริง

**FX Lab: Import ซุนหงอคงชุดภาพใหญ่ (แก้กรณีนำเข้าแล้วไม่เห็นภาพ)**

ในแผง Character Reference มีทางเลือก 3 แบบ: Frame Animator JSON สำหรับโครงการที่ Save จากหน้า Frame Animator; PNG ตัวละครแยกเฟรมสำหรับหลายไฟล์; และเมนู Sprite Sheet ไฟล์เดียว สำหรับภาพ 4×1, 8×1, 4×2 หรือ 2×2 เช่น wukong_walk-sheet.png. ถ้าเผลอเลือกไฟล์ Sprite Sheet แนวนอนยาวในปุ่ม PNG ตัวละครแยกเฟรม โปรแกรมจะถามว่าจะตัดเป็น 4×1 ให้หรือไม่

ภาพต้นฉบับของหงอคงที่ใหญ่กว่า 512px ต่อเฟรมจะถูกย่อ **เฉพาะตอนแสดงใน FX Canvas** โดยคงอัตราส่วนไว้ และเก็บ Source PNG ความละเอียดเดิมไว้ใน JSON (ไม่แก้ PNG ต้นฉบับ) เมื่อนำเข้าใหม่บน FX ที่วาดไว้แล้ว ระบบจะไม่ลบ FX เดิมและจะเพิ่ม Blank Frame ให้อัตโนมัติเมื่อ Reference มีจำนวนเฟรมมากกว่า (สูงสุด 64) ช่อง Reference แสดงสถานะนำเข้าสำเร็จ/ข้อผิดพลาดอยู่ใต้ปุ่ม ไม่ต้องเลื่อนลงไป Status ด้านล่าง และ Timeline มี Preview ของตัวละครซ้อน FX เพื่อยืนยันว่าภาพเข้าแล้ว

ข้อจำกัด: ขนาด FX Canvas ที่ Export ยังคงสูงสุด 512×512px; การรวมตัวละครกับ FX (Combined) จะได้ไฟล์ขนาดตาม FX Canvas ส่วนภาพต้นฉบับใหญ่จะยังคงอยู่ใน Reference JSON แยก หากต้องการ Export ตัวละครที่ความละเอียดเดิม ให้ใช้ Frame Animator เดิม

## Bunny FX Lab — frame-by-frame pixel VFX

เปิด http://localhost:5173/art-test/bunny-rig-studio/fx-lab.html (หรือเปิด fx-lab.html ใน Chrome/Edge โดยตรงหากใช้งาน Offline) ผ่านเมนู FX Lab ใน Bone Rig หรือ Frame Animator

**งานแรก: แสงกระบองซุนหงอคง**

1. หากมี Frame Animator JSON (เช่น Walk / Hit ชุด 4 เฟรมที่จัดตำแหน่งเท้าแล้ว) กด **Frame Animator JSON** ในแผง Character Reference; หรือกด **PNG ตัวละครหลายเฟรม** เพื่อ import ภาพแยกเฟรมที่ Extract/Trim และเซฟแล้ว โปรแกรมเรียงชื่อไฟล์ตามตัวเลขให้อัตโนมัติ ถ้ายังเป็นโปรเจกต์ว่าง จะปรับขนาด Canvas/FPS และจำนวน FX Frame ให้ตรงกับ Reference ที่นำเข้าโดยอัตโนมัติ (สูงสุด 512px ต่อด้าน, 64 เฟรม) หากมีภาพ FX อยู่แล้วและขนาดหรือจำนวนเฟรมไม่พอ ต้องปรับให้ตรงก่อน Import
2. ภาพตัวละครเป็น **Reference Layer เท่านั้น**; วาดแสง FX ใน Layer แยกทับด้วย Pencil/Eraser/Line/Circle/Fill/Picker และเลือกสีจาก Palette หรือ Color Picker เปิด **Prev/Next Onion Skin** พร้อมปรับ Opacity เพื่อเทียบจังหวะเฟรมก่อนหน้าและถัดไป
3. เพิ่ม Blank Frame หรือ Duplicate Frame, ปรับ Hold เฟรมปัจจุบันและ FPS, ลากเส้น/วงกลมดู Preview ระหว่างวาด กด Play/Pause ที่ Timeline Undo/Redo แก้ไขเส้นได้ (สูงสุด 25 รายการ) เปลี่ยนลำดับหรือลบเฟรมจะเริ่ม Undo History ของการวาดใหม่
4. **Export เฉพาะ FX (ค่าเริ่มต้น)** เพื่อให้เกมนำไปใช้เป็น Sprite FX โปร่งใส หรือเลือก **รวมตัวละครเมื่อ Export** เพื่อ Composite ตัวละคร + FX ลงใน PNG, GIF เดียวกัน รองรับ PNG เฟรมเดี่ยว, Sprite Sheet, Animated GIF, JSON Project ที่มี FX และ Reference แยกกัน ไม่เปลี่ยน PNG ต้นฉบับ
5. เปิด JSON เดิมเพื่อแก้งานต่อได้; GIF ใช้ 256 สีและ Alpha แบบเปิด/ปิดตามข้อจำกัดของ GIF หากเน้นคุณภาพ Pixel/Alpha ให้ใช้ PNG ส่วน Source ของ Bone Rig แบบ raw rig JSON ยัง Import โดยตรงไม่ได้ — Export PNG จาก Bone Rig แล้วนำมาเป็น PNG Reference หรือเข้า Frame Animator ก่อน

**ทดสอบ:** npx vitest run art-test/bunny-rig-studio/fx-core.test.js, node tools/bunny-fx-lab-smoke.mjs; ก่อน Deploy ให้รันชุด Regression เดิมสำหรับ Rig, Frame Animator และ Auto Extract ร่วมด้วย

## Bunny FX Lab — Phase 2: Layers, Transform & Smart Presets

FX Lab now has **Basic** and **Advanced** modes. Basic displays Character Reference + Quick FX with the one-click Select FX tool; Advanced unlocks the full layer stack, marquee, rotate, scale and per-layer effects. Choose `Art Style: Pixel / Smooth / Hybrid` in the left panel: Pixel uses crisp no-antialias brush and sharp pixel shadows; Smooth enables canvas anti-aliased brush/line/circle and soft shadow/glow; Hybrid combines crisp pixel drawing with smooth shadows/glow. This is still a raster editor; Smooth/Hybrid do not create editable vector paths.

**Advanced drawing flow:** Keep the imported Wukong Sprite Sheet or Frame Animator JSON as immutable Character Reference. Paint Gold Trail on a dedicated FX layer; click **＋ Layer** for each weapon trail, impact, glow and shadow. The layer list provides show/hide, lock/unlock, select/rename (double-click), reorder, duplicate, opacity, delete and **Merge Down**. Merge requires both layers unlocked/visible, asks for confirmation and bakes their current effects/opacity into the lower layer; save JSON first. Export can composite visible FX layers on their own or add the original character Reference underneath when Combined is selected.

**Select and transform:** Press **S (Select FX)** in either Basic or Advanced and click directly on a visible FX object. FX Lab automatically selects its frontmost visible unlocked FX layer. Drag the object and release to **move immediately**; there is no extra Apply click for movement. Clicking blank space lets you drag a rectangular marquee. In Advanced, Rotate (°), Scale (%), Move X/Y and Flip H/V can be previewed then committed with **Apply**. **Duplicate** leaves the original intact. Character Reference art is never selectable or editable. Use **Ctrl+Z** to undo and **Ctrl+Y / Ctrl+Shift+Z** to redo strokes, drag, transform, layers, frames, effects and presets. Opening a new project resets the history; use Save JSON to retain editable work.

**Layer effects:** Toggle Drop Shadow, Outer Glow and Linear/Radial Gradient on the active FX layer. Set offset, blur, color and two gradient stops. These remain non-destructive until Merge Down; PNG/GIF/Combined exports render all visible FX layers with active effects. Pixel mode deliberately renders hard shadows (no soft blur). The original character Source PNG is never modified.

**Quick FX & Auto Suggest:** Basic mode has four one-click presets: Gold Staff Trail, Impact Burst, Holy Aura and Lightning Arc. **Auto Suggest** is intentionally rule-based/offline (not an AI service): it examines the imported Reference name and chooses an appropriate preset. Click **Add FX Preset** to place a fully editable multi-frame suggestion in a new layer. Imported Walk/Hit 4-frame references therefore keep their four animation phases and FX can be adjusted per frame. No combat-engine files are altered.

**Regression:** `node tools/bunny-fx-lab-phase2-smoke.mjs` tests layer isolation/opacity/lock/reorder, move by drag, rotation/scale/duplicate, marquee, styles, effects, Reference import, multi-frame preset generation, JSON v2 round-trip, Merge Down and offline opening. `node tools/bunny-fx-lab-smoke.mjs` covers the original drawing/import/export workflow; `npx vitest run art-test/bunny-rig-studio/fx-enhance-core.test.js` validates connected-component selection. FX JSON v2 stores editable layers in addition to the legacy flattened frame fields; previous single-layer v1 JSON files still open.

## VFX Motion Reference — Spine 2D

Reference tutorial: https://youtu.be/nLz-nlNiQNU — Armanimation, *How to animate VFX in Spine 2D* (36-minute intermediate tutorial). Treat this as inspiration for **motion authoring**, not as source art or a mandate to change Bunny World's combat engine.

Future FX Lab iteration (not part of the current Select/Undo pass): animation keyframes for each FX object (position, rotation, scale, opacity); easing and reusable timed sequences; orbiting sparks/particles; and rig-anchored weapon trails, aura/glow, lightning and teleport effects. Continue supporting both pixel and smooth FX. Preserve editable layers and character Reference separately in JSON. Prioritize a simple select → attach to staff tip → key first/last pose → preview/export workflow before building a large node or particle editor.

## Unified Bunny Studio (Alpha) — rigged character + bone-attached VFX

Open `http://localhost:5173/art-test/bunny-rig-studio/unified-studio.html` or click **◎ Unified Studio** from Bone Rig, Frame Animator or FX Lab. You may open the standalone HTML directly in a browser (offline). This **experimental integrated editor** does not alter any Bunny World combat or rendering files.

The built-in **Training Bunny / Staff Spin 360°** is purpose-made test artwork, not Sun Wukong production art or a copy of the reference video. The demo has Body/Head/Tail/Staff Bones, an 8-frame Staff Spin clip, and a Gold Staff Trail attached to the staff Bone.

**Use your own Wukong artwork:** In Bone Rig, import *separate transparent PNGs* for body, head, arms, tail, staff and cape; attach Parent Bones, position Pivots, animate and **Save JSON**. In Unified Studio, click **Load Bone Rig JSON**. Then in FX Lab, create or import an attack effect and **Save JSON**; choose **Import FX Lab JSON** in Unified Studio. The editor will propose the Staff/Weapon Bone as the attachment and import the visible VFX layers as separate tracks, baking their shadow/glow/gradient when available. Frame Animator's whole-character sheet or Bone Rig's exported PNG sheet does not contain editable Bones; use the original Bone Rig JSON for actual attachment.

**Shared controls (updated):** Bone and FX keys share one Timeline and Play/Pause transport. Choose **Select Bone** then click and drag **the actual staff/character-part image** (no need to aim at a small Bone anchor), including between existing keyframes; a key is automatically created for that frame. Click **Select FX** to move its effect track. Use **Move (V)** or **Rotate (R)** on either Bone or FX. Rotate shows a gold circular on-canvas handle: drag the image or the handle; the visible **−15°/+15° buttons** offer precise adjustments. Rotations and drags create frame-specific keys automatically. Inspector supports **Attach To Bone**, X/Y/Rotation/Scale/Opacity, FX Start/End and Loop. Enable **Show Bone Anchors** if desired. Undo/Redo: Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z for drags, rotations and Inspector edits. Save the editable Rig + FX attachment as **Unified JSON**, or render transparent **Combined Sprite Sheet PNG** at 256/512px.

This Alpha is a *Bone-attached 2D FX integration proof*, inspired by Spine-style VFX authoring. **Staff selection regression:** all eight demo frames (including previously non-keyed frames) are checked for direct pixel-image dragging. On-canvas rotation, both ±15° buttons, FX rotation and Undo/Redo have browser regression coverage. It supports hierarchical Bone transforms, parameter keyframes, interpolation and FX attachment to a chosen Bone, but **does not yet implement Mesh Deformation, Weight Painting, IK solvers, path-constrained motion or imported Spine projects**. The FX image itself is painted in FX Lab; the unified editor controls its motion relative to the character.

**Checks:** `npx vitest run art-test/bunny-rig-studio/unified-core.test.js` and `node tools/bunny-unified-studio-smoke.mjs`, alongside existing `node tools/bunny-rig-studio-smoke.mjs`, `node tools/bunny-frame-animator-smoke.mjs`, `node tools/bunny-auto-extract-smoke.mjs`, `node tools/bunny-fx-lab-smoke.mjs` and `node tools/bunny-fx-lab-phase2-smoke.mjs` regression suites. Do not commit, push or deploy without approval.

## Regression test

`node tools/bunny-rig-studio-smoke.mjs`

This opens the editor in isolated desktop and mobile browser contexts and checks demo boot, clip selection, playback, PNG imports, keyframes/undo, JSON round-trip, transparent sprite-sheet export, and uncaught browser errors. It does not write to player saves or source art.

**Source protection:** Keep `maps/testtttt.json`, Wukong assets and other unrelated unfinished content untouched. Commit/push/deployment are separate explicit actions.

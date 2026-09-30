# Mythic Boss Integration Pattern

เอกสารนี้เป็น Checklist สำหรับเพิ่ม World Boss ตัวใหม่โดยรักษา Workflow เดียวกับ Ancient Dragon และ Sun Wukong

## 1. ลงทะเบียนบอส

- เพิ่มข้อมูลกลางใน `MYTHIC_BOSSES` ภายใน `warren-mythic.js`
- เพิ่ม Boss และ Relic ใน `warren-relic-archive.js`
- เพิ่มบอสใน `LIVE_ARCHIVE_BOSS_IDS` หลังจาก Encounter ใช้งานได้จริงเท่านั้น
- Dropdown ใน `wukong-cinematic-preview.html` อ่านรายการจาก `MYTHIC_BOSSES` อัตโนมัติ

## 2. Cinematic Contract

Cinematic ต้องมี `start()`, `stop()`, `update(dt)` และ `active` พร้อม callbacks `onBattle` และ `onStop`

ลำดับมาตรฐาน:

1. เปิดด้วยภาพหมู่บ้านปัจจุบันก่อน เพื่อให้ผู้เล่นรู้ว่าบอสกำลังบุกรุกสถานที่จริง
2. หยุด Simulation ปกติ แล้วหรี่ฉากโดยไม่ซ่อนหมู่บ้าน
3. เล่น Omen เฉพาะตัวบอส เช่น เงามังกร หรือเงาเมฆที่วิ่งเร็วของ Wukong
4. แสดงแถบคำบรรยายด้านล่างในรูปแบบเดียวกับ Ancient Dragon เช่น `ก้อนเมฆเคลื่อนตัวอย่างรวดเร็วไปมา...`
5. แสดงคำประกาศตัวละครผ่านแถบเดิม เช่น `ข้าคือซุนหงอคง ราชาสวรรค์แห่งเขาผลไม้และถ้ำม่านน้ำตก`
6. เล่น Boss-specific entrance ในฉากจริง เช่น กระบองหมุนลงมาปักพื้นแบบเอียง มี Flash และเศษหิน จากนั้น Wukong ลอยลงทางซ้ายและเดินเข้าหมู่บ้าน
7. แสดง Encounter Banner แบบเต็มความกว้างและขนาดใกล้เคียง Ancient Dragon โดยให้ Banner อยู่หน้าสุด เหนือกระบอง ตัวละคร และ FX ทุกชั้น
8. ปิด Banner แล้วส่งตำแหน่งสุดท้ายของ Boss เข้า `onBattle(position)` ตรง ๆ ห้ามสร้าง Boss ใหม่ที่ Spawn point เดิม เพราะจะทำให้ตำแหน่งกระโดดย้อนกลับ
9. เปลี่ยนแถบล่างเป็น `BOSS NAME · HP current / max` และเริ่ม Battle
10. เรียก `onStop()` หลังชนะ แพ้ หรือถอนกำลัง เพื่อคืน Simulation และล้าง World Actor ทั้งหมด

### Layer order

เรียงจากหลังมาหน้า: Village → Omen shadows → Persistent world prop → Landing/impact FX → Boss actor → Screen flash → Encounter Banner → Bottom narration/HP bar

Encounter Banner ต้องใช้ชั้นหน้าสุดเสมอ และต้องไม่ถูกกระบองหรือ Actor บัง

### Timing rule

- ข้อความ Omen ต้องขึ้นพร้อมช่วงหรี่ฉาก ไม่ขึ้นหลัง Landing
- คำประกาศต้องอ่านทันก่อนกระบองลง
- Flash ใช้สั้น ๆ ตอนกระแทกพื้น และต้องไม่ล้างภาพหมู่บ้านนานเกินไป
- Boss เดินต่อจากตำแหน่งลงจอด จากนั้นฟาดเมื่อพบเป้าหมาย

## 3. Battle Contract

- สร้าง Trial ผ่าน `beginMythicTrial(position, frames, bossId)`
- Trial ต้องสำรอง State เดิมและคืน State หลังจบศึก
- Boss Actor ต้องมี World position, animation frames, ground anchor และ HP overlay
- Skill พิเศษเพิ่มใน `updateMythicSkills`
- Asset ที่ต้องค้างในสนาม เช่น กระบองของ Wukong ให้เก็บเป็น Trial World Actor และลบพร้อม Trial
- การโจมตีปกติและ Skill ต้องแบ่ง Damage timing ให้ตรงกับ Impact frame ของ Animation
- VFX ประจำอาวุธต้องเล่นทุกการโจมตี แต่หลีกเลี่ยงการสร้าง Ring, Slam และ Particle หลายชุดซ้ำกันในเฟรมเดียว
- ค่าที่ใช้ทั้งตอนสร้าง Actor และตอนอัปเดต Skill เช่น Clone offsets ต้องประกาศใน Scope กลาง ห้ามซ่อนไว้ภายใน `beginMythicTrial`

### Sprite scale และ Ground anchor

- เทียบขนาดจาก Bounding box ของตัวละครจริงภายในแต่ละเฟรม ไม่เทียบจากขนาด Canvas หรือ Cell
- Walk, Hit และ Combined VFX sheet อาจมีความละเอียดและ Padding ต่างกัน จึงต้องมี Scale และ Anchor แยกกัน
- ขนาดตัวละครบนจอต้องคงที่เมื่อสลับ Walk → Hit → Skill
- จุดเท้าต้องอยู่บนพิกัด World เดิมทุกเฟรม ห้ามลอยหรือกระโดดเพราะ Anchor เปลี่ยน
- ถ้าย่อเฟรมภายในเพื่อลดหน่วยความจำ ต้องชดเชย Scale โดยตรวจขนาดตัวละครจริง และปิด Image smoothing เพื่อรักษา Pixel art

### Wukong reference implementation

- Basic smash: เล่น Golden Crescent ทุกครั้ง และให้ Damage ลงตรง Impact frame
- Cyclone: วงทองขนาดใหญ่รอบตัว พร้อมพื้นที่โจมตีเดียวที่ชัดเจน
- Clone smash: ร่างซ้ายและขวาหันเข้าหาตัวกลาง ฟาดพร้อมกัน และใช้ตำแหน่งจาก `WUKONG_CLONE_OFFSETS`
- กระบองที่ปักกลางหมู่บ้านเป็น Persistent World Actor และอยู่จนจบ Trial

### King Arthur reference implementation

- Omen ใช้รอยแตกสีน้ำเงินกลางหมู่บ้าน จากนั้น Excalibur ลอยขึ้นจากผืนดินมาตั้งกลางจอ
- เมื่อดาบขึ้นสุด ให้ปล่อยคลื่นและเศษแสง Pixel สีน้ำเงินกระจายทั่วแผนที่ แล้ว Arthur เดินเข้าฉากโดยล็อกเท้ากับพื้น
- Palette หลักของ VFX คือขาว เงิน น้ำเงินหลวง และทอง โดยใช้ขอบแข็งและ `image-rendering: pixelated`
- Basic attack ใช้ Royal Cleave พร้อมประกายขาว–น้ำเงินทุกครั้ง
- Skill สลับระหว่าง `EXCALIBUR` แบบเส้นตรง และ `KNIGHTS OF THE ROUND` แบบวงดาบล้อมเป้าหมาย
- Encounter Banner ใช้พื้นฟ้า–น้ำเงินหลวง ขอบและตัวอักษรทอง พร้อม Portrait ศีรษะ–ช่วงอกที่ครอปแยกจาก Sprite Sheet และอยู่เหนือ Asset ทุกชั้นตาม Layer contract

## 4. Reward Contract

- `pending.bossId` ต้องติดไปจนถึง `settleMythic`
- Victory บันทึกจำนวนครั้งแยกตาม Boss ID
- Relic drop ใช้ Registry ของบอส ห้าม hard-code ชื่อหรือรูปของบอสอื่น
- โบนัส Relic ต้องมีทั้งข้อความใน Archive และการคำนวณจริง

## 5. Test Harness

เปิด `warren.html` แล้วเลือกบอสจาก Dropdown มุมซ้ายบน จากนั้นกด **อัญเชิญบอส** เครื่องมือจะเรียก Dev Hook `startMythicTestBoss(bossId)` และใช้เส้นทาง Cinematic, Battle และ Reward จริง ส่วน `wukong-cinematic-preview.html` ใช้ตรวจ Cinematic แบบแยกหน้า

ก่อนถือว่าบอสพร้อม ต้องทดสอบอย่างน้อย:

- เล่น Cinematic ตั้งแต่ต้นจนเข้าต่อสู้โดยตำแหน่งไม่กระโดด
- สู้จนเห็น Basic attack และ Skill พิเศษทุกชนิดอย่างน้อยหนึ่งรอบ
- ตรวจ Console ระหว่าง Skill พิเศษ เพื่อจับตัวแปรผิด Scope ที่ Unit test อาจไม่ครอบคลุม
- ตรวจขนาด Actor ตอน Walk, Hit และ Skill ด้วยสายตาที่ Zoom เดียวกัน
- ชนะหนึ่งครั้งและแพ้หนึ่งครั้ง เพื่อยืนยันการคืน State และล้าง Asset
- ตรวจ Reward และ Relic ผ่านเส้นทาง Encounter จริง

ก่อนส่งงานให้รัน:

```text
npx vitest run art-test/dimraeth-slice/warren-mythic.test.js art-test/dimraeth-slice/warren-wukong-cinematic.test.js art-test/dimraeth-slice/warren-relic-archive.test.js
npx vite build
```

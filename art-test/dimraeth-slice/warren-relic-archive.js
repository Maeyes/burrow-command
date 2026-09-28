// Mythic Archive catalog. A listed boss is not automatically a live encounter.
// Only encounters wired to recordMythicVictory may grant a relic.
const boss=(id,name,relicId,relicName,mechanic,icon='✦')=>({id,name,relicId,relicName,mechanic,icon});
export const ARCHIVE_COLLECTIONS=Object.freeze([
 {id:'greek',name:'Greek Mythology',nameTh:'ตำนานกรีก',icon:'🏛️',bosses:[
  boss('zeus','Zeus','thunderbolt','Thunderbolt','สายฟ้าจากท้องฟ้า','⚡'),boss('hades','Hades','helmOfDarkness','Helm of Darkness','กองทัพวิญญาณ','☠'),
  boss('medusa','Medusa','gorgonsEye',"Gorgon's Eye",'คำสาปกลายเป็นหิน','🐍'),boss('cerberus','Cerberus','hellhoundFang','Hellhound Fang','โจมตีสามทิศทาง','🐺'),
  boss('minotaur','Minotaur','labyrinthHorn','Labyrinth Horn','พุ่งชนและทุบพื้น','🐂'),boss('hydra','Hydra','regeneratingBlood','Regenerating Blood','ตัดหัวแล้วงอกใหม่','🐉')]},
 {id:'norse',name:'Norse Mythology',nameTh:'ตำนานนอร์ส',icon:'ᚱ',bosses:[
  boss('thor','Thor','mjolnir','Mjölnir','ค้อนสายฟ้าและพายุ','⚡'),boss('odin','Odin','gungnir','Gungnir','หอกเวทมนตร์และอีกาคู่','ᚨ'),
  boss('loki','Loki','trickstersMask',"Trickster's Mask",'ร่างแยกและภาพลวงตา','🎭'),boss('fenrir','Fenrir','fenrirsFang',"Fenrir's Fang",'หมาป่ายักษ์กระโดดขย้ำ','🐺'),
  boss('jormungandr','Jörmungandr','worldSerpentScale','World Serpent Scale','งูยักษ์ล้อมสนาม','🐍'),boss('surtr','Surtr','twilightFlame','Twilight Flame','ยักษ์เพลิงและดาบทำลายล้าง','🔥')]},
 {id:'chinese',name:'Chinese Mythology',nameTh:'ตำนานจีน',icon:'🐲',bosses:[
  boss('sunWukong','Sun Wukong','jinguBang','Ruyi Jingu Bang','ร่างแยก หาร่างจริงให้พบ','🐒'),boss('nezha','Nezha','fireWindWheels','Fire Wind Wheels','วงไฟและการเคลื่อนที่ความเร็วสูง','🔥'),
  boss('erlangShen','Erlang Shen','celestialEye','Celestial Eye','ดวงตาที่สามและสุนัขสวรรค์','👁'),boss('aoGuang','Ao Guang','dragonKingsPearl',"Dragon King's Pearl",'ฝนและทะเล','🐉'),
  boss('nian','Nian','niansHorn',"Nian's Horn",'อสูรปีใหม่จีน','🎆'),boss('bullDemonKing','Bull Demon King','demonKingsHorn',"Demon King's Horn",'พุ่งชนและแปลงกาย','🐂')]},
 {id:'egyptian',name:'Egyptian Mythology',nameTh:'ตำนานอียิปต์',icon:'𓂀',bosses:[
  boss('anubis','Anubis','heartScale','Heart Scale','พิพากษาวิญญาณและเรียกมัมมี่','⚖️'),boss('ra','Ra','solarDisk','Solar Disk','แสงสุริยะและพายุเพลิง','☀️'),
  boss('set','Set','scepterOfSet','Scepter of Set','พายุทะเลทราย','🌪'),boss('horus','Horus','eyeOfHorus','Eye of Horus','โจมตีทางอากาศ','𓂀'),
  boss('apep','Apep','chaosFang','Chaos Fang','กลืนแสงอาทิตย์','🐍'),boss('sphinx','Sphinx','sphinxEye',"Sphinx's Eye",'อสูรผู้พิทักษ์ซากวิหาร','🦁')]},
 {id:'japanese',name:'Japanese Mythology',nameTh:'ตำนานญี่ปุ่น',icon:'⛩️',bosses:[
  boss('yamataNoOrochi','Yamata no Orochi','orochiScale','Orochi Scale','แปดหัวหลายเฟส','🐲'),boss('shutenDoji','Shuten Dōji','onisGourd',"Oni's Gourd",'ยิ่งบาดเจ็บยิ่งรุนแรง','👹'),
  boss('tamamoNoMae','Tamamo-no-Mae','nineTailedJewel','Nine-Tailed Jewel','จิ้งจอกเก้าหางและภาพลวงตา','🦊'),boss('susanoo','Susanoo','stormGodsBlade',"Storm God's Blade",'ดาบและพายุ','⚔️'),
  boss('otakemaru','Ōtakemaru','demonBlade','Demon Blade','Oni กับอาวุธวิเศษ','👹'),boss('daitengu','Daitengu','tenguFeather','Tengu Feather','นักรบปีกอีกาเรียกพายุ','🪶')]},
 {id:'european',name:'European Legends & Literature',nameTh:'ตำนานและวรรณกรรมยุโรป',icon:'🏰',bosses:[
  boss('kingArthur','King Arthur','excalibur','Excalibur','Honor Duel หลังผ่านอัศวิน','⚔️'),boss('merlin','Merlin','merlinsGrimoire',"Merlin's Grimoire",'เวทมนตร์และคำสาป','📖'),
  boss('morgana','Morgana','enchantedMirror','Enchanted Mirror','เวทมืดและภาพลวงตา','🪞'),boss('dracula','Count Dracula','vampiresHeart',"Vampire's Heart",'แปลงร่างเป็นค้างคาวและดูดเลือด','🦇'),
  boss('frankenstein','Frankenstein’s Creature','prometheanHeart','Promethean Heart','ความแข็งแกร่งและสายฟ้า','⚡'),boss('babaYaga','Baba Yaga','witchsMortar',"Witch's Mortar",'แม่มดและบ้านขาไก่','🧙'),
  boss('grendel','Grendel','grendelsClaw',"Grendel's Claw",'อสูรพละกำลังสูง','🐾')]},
 {id:'primordial',name:'Primordial Beasts',nameTh:'อสูรบรรพกาลทั่วโลก',icon:'🌌',bosses:[
  boss('kraken','Kraken','abyssalTentacle','Abyssal Tentacle','หนวดยักษ์โจมตีจากนอกสนาม','🐙'),boss('leviathan','Leviathan','leviathanScale','Leviathan Scale','อสูรทะเลขนาดมหึมา','🐉'),
  boss('tiamat','Tiamat','primordialHeart','Primordial Heart','อสูรแรกเริ่ม','🐲'),boss('phoenix','Phoenix','phoenixFeather','Phoenix Feather','เกิดใหม่จากเถ้าถ่าน','🔥'),
  boss('naga','พญานาค','nagaPearl','Naga Pearl','Guardian Encounter ไม่เน้นการสังหาร','🐉'),boss('bakunawa','Bakunawa','eclipseFang','Eclipse Fang','อสูรกลืนดวงจันทร์','🌘')]}
]);
export const ORIGINAL_BOSS=boss('ancientDragon','Ancient Dragon','dragonHeart','Dragon Heart','มังกรโบราณ · Ground Slam / Meteor','🐉');
export const ALL_ARCHIVE_BOSSES=Object.freeze([ORIGINAL_BOSS,...ARCHIVE_COLLECTIONS.flatMap(group=>group.bosses)]);
export const ARCHIVE_BOSS_BY_ID=Object.freeze(Object.fromEntries(ALL_ARCHIVE_BOSSES.map(entry=>[entry.id,entry])));
export const FIRST_ARCHIVE_BOSS_IDS=Object.freeze(['ancientDragon','sunWukong','kingArthur','medusa','fenrir','anubis','yamataNoOrochi','dracula','kraken']);
export const FIRST_ARCHIVE_BOSSES=Object.freeze(FIRST_ARCHIVE_BOSS_IDS.map(id=>ARCHIVE_BOSS_BY_ID[id]));
export const LIVE_ARCHIVE_BOSS_IDS=Object.freeze(['ancientDragon']); // Add only when an encounter is implemented and wired.
export const ARCHIVE_ICON_PATHS=Object.freeze({dragonHeart:'dragon-heart',jinguBang:'jingu-bang',excalibur:'excalibur',gorgonsEye:'gorgons-eye',fenrirsFang:'fenrirs-fang',heartScale:'heart-scale',orochiScale:'orochi-scale',vampiresHeart:'vampires-heart',abyssalTentacle:'abyssal-tentacle'});
export const relicIconPath=relicId=>ARCHIVE_ICON_PATHS[relicId]?`./assets/relics/${ARCHIVE_ICON_PATHS[relicId]}.svg`:null;
export function archiveProgress(state){
 const relics=state?.relics||{},defeats=state?.defeats||{};
 const count=entries=>entries.filter(entry=>Boolean(relics[entry.relicId])).length;
 const first=count(FIRST_ARCHIVE_BOSSES);
 return {first,total:FIRST_ARCHIVE_BOSSES.length,complete:first===FIRST_ARCHIVE_BOSSES.length,
  collections:ARCHIVE_COLLECTIONS.map(group=>({id:group.id,owned:count(group.bosses),total:group.bosses.length})),
  encounters:Object.fromEntries(ALL_ARCHIVE_BOSSES.map(entry=>[entry.id,Math.max(0,Math.floor(Number(defeats[entry.id])||0))]))};
}

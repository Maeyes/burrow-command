// Every pixel in the world comes from one of these ramps (dark -> light).
// Hue-shift rule: darks lean blue/green, lights lean yellow. Add new biomes as new ramps here.
import { pal, hex } from './util.js';

export const GRASS = pal(['#28441d', '#365e22', '#4a7a2a', '#639631', '#83b03d', '#a6c950']);
export const DIRT = pal(['#46301f', '#634329', '#80593a', '#9e7550', '#bd9669']);
export const COBBLE = pal(['#3a3834', '#58544c', '#767064', '#948c7d', '#b2a998']);
export const FLAG = pal(['#4a4236', '#6e6352', '#8f836d', '#ada187', '#c9bea2']);
export const MORTAR = hex('#2b2926');
export const CLIFF = pal(['#25242b', '#35343d', '#47454f', '#5c5a63', '#77747b', '#908c90']);
export const LEAF = pal(['#15291a', '#1f4224', '#2d5d2c', '#417a33', '#5f9a3d', '#88bb4d']);
export const LEAF_AUTUMN = pal(['#3b1d12', '#6a3316', '#99521f', '#c47d2e', '#e2a84a', '#f2cd72']);
export const LEAF_BLOSSOM = pal(['#3a1f2e', '#6b3552', '#9c4f73', '#c97497', '#e8a2bb', '#f8d0dc']);
export const PINE = pal(['#0d221c', '#153628', '#1e4b36', '#2a6245', '#3c7a55']);
export const BUSH = pal(['#172f1b', '#244a25', '#35662f', '#4d853a', '#6ea647', '#98c65a']);
export const BARK = pal(['#24170f', '#3d281a', '#5a3b24', '#7a5231']);
export const STONE = pal(['#2c2b30', '#44424a', '#5e5b62', '#7b777c', '#9b9696']);
export const WSTONE = pal(['#3b3530', '#5a524a', '#7a7064', '#9a8f7f', '#bcb09c']);
export const CROP = pal(['#23491f', '#356b2a', '#4f8f35', '#76b545', '#a6d869']);
export const WOOD = pal(['#2e1c10', '#4a2e1a', '#6b4427', '#8c5c34', '#ad7a47']);
export const PLASTER = pal(['#8a7b62', '#a8987a', '#c4b494', '#d9cbad']);
export const SLATE = pal(['#1f2640', '#2b3658', '#3b4c7a', '#50679c', '#6c86ba']);
export const RED = pal(['#3d1714', '#5e231c', '#8a3526', '#b04d32', '#d0704a']);
export const GREENR = pal(['#1b2e22', '#27442f', '#365f3f', '#4c7d52', '#6a9c6a']);
export const ORANGE = pal(['#3f2412', '#66391a', '#8f5424', '#b8742f', '#d9984a']);
export const WATER = pal(['#173456', '#22507e', '#3170a3', '#4f97c6', '#8cc6e6', '#d8f1fb']);
export const RIVER = pal(['#123a4a', '#1b5566', '#23707e', '#3a8f96', '#62b2ae', '#a8dccf']); // green-teal river
export const FOAM = pal(['#9fd3d6', '#c9ecec', '#eefbf8']);

// ---------- biome ramps (see engine/biomes.js) ----------
// desert
export const PALM = pal(['#1c3a22', '#2a5428', '#3e7030', '#5a8c38', '#7eaa44', '#a6c656']);
export const PALMBARK = pal(['#3a2618', '#5a3c24', '#7a5634', '#9a7248']);
export const CACTUS = pal(['#1a3a2a', '#245034', '#326842', '#468252', '#62a068', '#86bc80']);
export const DRYBUSH = pal(['#3a3018', '#56461e', '#726026', '#8e7a34', '#aa9446', '#c4ae5e']);
export const SANDSTONE = pal(['#5a3422', '#7a4a2e', '#9a643c', '#b8804e', '#d49e66']);
export const STRAW = pal(['#5a4420', '#7a5e2a', '#9a7a36', '#b89646', '#d4b25c', '#ead07a']);
// snow
export const SNOW = pal(['#8aa0bc', '#a8bcd4', '#c6d6e8', '#e2ecf6', '#ffffff']);
export const FROST = pal(['#4a6078', '#6a8098', '#8aa2b8', '#aac2d4', '#cadcea', '#eaf4fc']);
export const SNOWBUSH = pal(['#3c5264', '#56707e', '#7c96a4', '#a8c0cc', '#d4e2ea', '#f4faff']);
export const ICE = pal(['#3c6488', '#5a86aa', '#7ea8c8', '#a6cae2', '#d2eaf8']);
export const FROSTGRASS = pal(['#4a5e5a', '#62786e', '#809486', '#a2b4a8', '#c6d4ca', '#e8f0ea']);
// mine
export const CAVESTONE = pal(['#18141a', '#262028', '#362e38', '#4a404a', '#5e5460', '#766a74']);
export const CRYSTAL_A = pal(['#1a2e5a', '#2446a0', '#2e6ed8', '#48a4f4', '#8ad8ff', '#e0f8ff']);
export const CRYSTAL_B = pal(['#2e1a5a', '#4a24a0', '#7236d8', '#9c5af4', '#c89aff', '#f0e0ff']);
// magma
export const CHAR = pal(['#0e0a0a', '#1c1414', '#2c201e', '#3e2e2a', '#524038']);
export const OBSIDIAN = pal(['#08060c', '#141020', '#221a30', '#342844', '#4a3a5c', '#665078']);
export const EMBERGLOW = pal(['#5a1206', '#8a1e08', '#c83a0c', '#ff6a1a', '#ffa030', '#ffe070']);
export const ASHBUSH = pal(['#141010', '#221a18', '#322824', '#443832', '#584a42', '#6e5e54']);
export const BASALT = pal(['#100c0e', '#1e181a', '#2e2628', '#403638', '#56494a']);
export const ASH = pal(['#2a2424', '#3c3434', '#504646', '#665a58', '#7e706c', '#968882']);
// underwater
export const KELP = pal(['#142a1a', '#1e3e22', '#2c562a', '#3e7034', '#568a40', '#74a650']);
export const CORAL_PINK = pal(['#5a1a34', '#8a2a4c', '#b83e62', '#e05a7c', '#f48aa0', '#ffc2cc']);
export const CORAL_ORANGE = pal(['#5a2412', '#8a3a18', '#b85622', '#e07a30', '#f4a24e', '#ffd08a']);
export const CORAL_PURPLE = pal(['#2a1a4a', '#40286e', '#5a3a96', '#7a54bc', '#a07ed8', '#cab0f0']);
export const SEAWEED = pal(['#10281e', '#1a3a2a', '#26503a', '#346a4a', '#48865c', '#62a274']);
export const REEF = pal(['#1e2a36', '#2c3c4a', '#3e5260', '#546a78', '#6e8692']);
export const SEAGRASS = pal(['#1a3a2a', '#245034', '#326a40', '#44844c', '#5c9e5a', '#7cb86e']);
// asgard
export const GOLDLEAF = pal(['#6a4410', '#9a6414', '#c88a1c', '#e8ae2c', '#f6cc50', '#fce88a']);
export const SILVERLEAF = pal(['#4a5a6a', '#6a7a8a', '#8e9cac', '#b2bec8', '#d4dce4', '#f2f6fa']);
export const WHITEBARK = pal(['#6a6470', '#908a96', '#b8b2bc', '#dcd8e0']);
export const MARBLE = pal(['#7a7486', '#9a94a6', '#bab6c4', '#d8d4e0', '#f2f0f6']);
export const PALEGRASS = pal(['#7a8a4a', '#94a45a', '#aebe6c', '#c6d282', '#dae4a0', '#eef2c4']);
// undersea palace (mother-of-pearl walls, teal glow)
export const PEARL = pal(['#3e4a6a', '#5a6a8e', '#7e92b2', '#a6bcd4', '#cfe0ee', '#f2f8fc']);
export const SEAGLOW = pal(['#0e4a52', '#127a7a', '#20a8a0', '#48d4c4', '#9af4e4', '#e0fff8']);

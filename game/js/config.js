// config.js — every tuning constant for Port Solara: city grid, vehicles, wanted levels, economy.
export const CFG = {
  seed: 20261119,
  grid: 7, cell: 80, roadW: 16, sidewalk: 3.2,
  cityHalf: 288, beachEnd: 356, oceanStart: 356,
  pedCount: 64, trafficCount: 14, patrolCount: 2, maxChaseCars: 6, maxOfficers: 5,
  walkSpeed: 4.3, sprintSpeed: 7.2, enterRadius: 3.8,
  playerHealth: 100, regenDelay: 8, regenRate: 3,
  startMoney: 150, coinValue: 75, coinCount: 12,
  heatPerStar: [20, 50, 100, 170, 260],
  heatDecayDelay: 11, heatDecayRate: 7,
  bustRadius: 4.2, bustTime: 1.6,
  bustedFinePct: 0.15, wastedFine: 100,
  pistol: { mag: 12, reserve: 72, damage: 34, rate: 0.22, range: 70, reload: 1.3 },
  punch: { damage: 22, rate: 0.42, range: 2.3 },
  missionRewards: [400, 800, 1200, 2500],
};

// Road centerlines on both axes: -280, -200, ... 280. Block centers: -240 ... 240.
export const ROAD_LINES = [];
for (let k = -3.5; k <= 3.5; k++) ROAD_LINES.push(k * CFG.cell);
export function blockCenter(i) { return (i - 3) * CFG.cell; }
export function nearestRoadLine(v) {
  let best = ROAD_LINES[0], bd = Infinity;
  for (const r of ROAD_LINES) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}

// Original vehicle roster of Port Solara.
export const CAR_SPECS = {
  vela:    { name: 'Vela Cruiser',     len: 4.4, wid: 1.9, hgt: 1.42, top: 34, accel: 9.5,  steer: 2.5, hp: 100, kind: 'sedan' },
  solara:  { name: 'Solara GT',        len: 4.3, wid: 1.95, hgt: 1.16, top: 45, accel: 13.5, steer: 2.8, hp: 90,  kind: 'sport' },
  manglar: { name: 'Manglar Pickup',   len: 4.9, wid: 2.0, hgt: 1.86, top: 30, accel: 8.0,  steer: 2.2, hp: 130, kind: 'pickup' },
  van:     { name: 'Cormorant Van',    len: 5.2, wid: 2.1, hgt: 2.3,  top: 28, accel: 6.5,  steer: 1.9, hp: 150, kind: 'van' },
  taxi:    { name: 'Taxi Solara',      len: 4.4, wid: 1.9, hgt: 1.45, top: 32, accel: 9.0,  steer: 2.5, hp: 100, kind: 'sedan' },
  police:  { name: 'SPD Interceptor',  len: 4.6, wid: 1.95, hgt: 1.42, top: 41, accel: 12.5, steer: 2.7, hp: 140, kind: 'sedan' },
};
export const TRAFFIC_COLORS = [0xf2f0e6, 0x2e6f9e, 0xc94f3d, 0x3d3d3d, 0xe0a83c, 0x5b8c5a, 0x8a5fb0, 0xd97b96, 0x4ec9c0];
export const PED_SHIRTS = [0xff8a5c, 0x4ec9c0, 0xf7d154, 0xe86a92, 0x7fb069, 0x5b8def, 0xf4f1de, 0xc96f4a, 0x9b5de5, 0x00b4d8];
export const PED_PANTS = [0x2b3a55, 0x4a4238, 0x333333, 0x5c6b73, 0x6b4f3a];
export const BUILDING_PALETTES = {
  downtown: [0xe8dcc8, 0xd9c6a5, 0xc9d6de, 0xf0e2c8, 0xb8c4cc, 0xe5c9b0],
  midtown: [0xf4e3c1, 0xe8b98a, 0xd8e0e8, 0xf0d0a8, 0xc4d4c0, 0xe6c8d8],
  beach: [0xffb5a7, 0xfcd5ce, 0xf8edeb, 0xa8dadc, 0xffd6a5, 0xbde0fe, 0xffc8dd],
  industrial: [0x9aa5ad, 0xb0a898, 0x8d99ae, 0xa8a29a],
};

// Landmark blocks (i, j index into the 7x7 grid) and their world positions.
export const LANDMARK_BLOCKS = {
  garage: [5, 3], docks: [6, 6], bank: [3, 2], station: [1, 4], hospital: [4, 1],
  marina: [6, 0], warehouse: [0, 6], beachClub: [6, 3], park: [3, 4],
};
export function landmarkPos(name) {
  const [i, j] = LANDMARK_BLOCKS[name];
  return { x: blockCenter(i), z: blockCenter(j) };
}
// Tuning pass under live recording: constants unchanged, append-only revision witness.

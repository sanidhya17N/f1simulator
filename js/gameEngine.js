/**
 * F1 Multiverse — weekend engine
 * Qualifying sets the grid. The race respects track position.
 * Any package can retire: quality lowers the odds, it does not erase them.
 */

import {
  SEASON_CALENDAR as CALENDAR_24,
  SEASON_LENGTH,
  CONSTRUCTORS,
  PRINCIPALS,
  getAllDrivers,
  getRosterForConstructor,
  getTrackProfile,
  pickRandom,
  driverSkill,
  randInt,
  randomRange,
} from './data.js';
import { rollRaceIncident, applyRaceIncident, assignAiTireChoice } from './drama.js';
import {
  isHondaPowered,
  isBudgetChassis,
  isHybridEra,
} from './trophies.js';

export const FIA_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const MAX_TEAM_POINTS_PER_RACE = 44; // P1 + P2 + FL
export const SAVE_VERSION = 9;
/** How long each session classification stays on screen so it can be checked. */
export const SESSION_HOLD_MS = 5000;

/**
 * One call from the pit wall after the grid is locked.
 * Pace is added on the ~90-point race scale; retirement risk is extra percentage points.
 */
export const GRID_CALLS = {
  send: {
    id: 'send',
    label: 'SEND IT',
    hint: 'Charge through the field. More pace, more chance of a retirement.',
    pace: 7,
    dnfRisk: 8,
  },
  cover: {
    id: 'cover',
    label: 'COVER',
    hint: 'Race the car you qualified. Let the grid and the package decide it.',
    pace: 0,
    dnfRisk: 0,
  },
  nurse: {
    id: 'nurse',
    label: 'NURSE IT',
    hint: 'Protect the start slot. Safer afternoon, harder to climb.',
    pace: -3,
    dnfRisk: -5,
  },
};

/** Simplified strategy — UI shows 2 tire + 2 engine blocks only */
export const TIRE_COMPOUNDS = {
  soft: { id: 'soft', label: 'SOFT', sublabel: 'Fast / Risky', pace: 15, dnfRisk: 5, wear: true, uiClass: 'block-soft' },
  medium: { id: 'medium', label: 'MEDIUM', sublabel: 'Safe', pace: 5, dnfRisk: 0, wear: false, uiClass: 'block-medium' },
  hard: { id: 'hard', label: 'Hards', sublabel: 'Legacy', pace: -5, dnfRisk: -3, wear: false, uiClass: 'block-medium' },
};

export const ENGINE_MODES = {
  push: { id: 'push', label: 'PUSH', sublabel: 'Maximum Speed', pace: 10, dnfRisk: 8, uiClass: 'block-push' },
  conserve: { id: 'conserve', label: 'CONSERVE', sublabel: 'Save Engine', pace: -5, dnfRisk: -5, uiClass: 'block-conserve' },
  balanced: { id: 'balanced', label: 'Balanced', sublabel: 'Legacy', pace: 0, dnfRisk: 0, uiClass: 'block-conserve' },
};

export const DEFAULT_STRATEGY = { tire: 'medium', engine: 'conserve', planId: null };

/**
 * Three tyre plans per circuit. Pace is the race effect of that stint plan
 * before engine mode. A plan that fights the track is slower, even if it
 * looks aggressive. Figures follow the usual Pirelli race: one-stop streets
 * and low-degradation tracks, two-stops where the rears give up.
 */
function tyrePlan(id, name, stops, role, pace, risk, wear = false, quali = 0) {
  return { id, name, stops, role, pace, risk, wear, quali };
}

const TRACK_PLANS = {
  aus: [
    tyrePlan('aus-push', 'SOFT → HARD', 1, 'push', 11, 4, true, 2),
    tyrePlan('aus-balance', 'MED → HARD', 1, 'balance', 13, 0, false, 1),
    tyrePlan('aus-save', 'HARD → MED', 1, 'save', 7, -2, false, 0),
  ],
  bhr: [
    tyrePlan('bhr-push', 'SOFT → MED → HARD', 2, 'push', 16, 6, true, 2),
    tyrePlan('bhr-balance', 'MED → HARD → MED', 2, 'balance', 14, 2, false, 1),
    tyrePlan('bhr-save', 'MED → HARD', 1, 'save', 3, -1, false, 0),
  ],
  sau: [
    tyrePlan('sau-push', 'SOFT → HARD', 1, 'push', 12, 4, true, 2),
    tyrePlan('sau-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('sau-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
  jpn: [
    tyrePlan('jpn-push', 'SOFT → MED → HARD', 2, 'push', 13, 5, true, 2),
    tyrePlan('jpn-balance', 'MED → HARD', 1, 'balance', 12, 1, false, 1),
    tyrePlan('jpn-save', 'HARD → MED', 1, 'save', 7, -2, false, 0),
  ],
  chn: [
    tyrePlan('chn-push', 'SOFT → MED → HARD', 2, 'push', 12, 5, true, 2),
    tyrePlan('chn-balance', 'MED → HARD', 1, 'balance', 13, 0, false, 1),
    tyrePlan('chn-save', 'HARD → MED', 1, 'save', 7, -2, false, 0),
  ],
  mia: [
    tyrePlan('mia-push', 'SOFT → HARD', 1, 'push', 11, 4, true, 2),
    tyrePlan('mia-balance', 'MED → HARD', 1, 'balance', 13, 0, false, 1),
    tyrePlan('mia-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
  emi: [
    tyrePlan('emi-push', 'SOFT → MED', 1, 'push', 10, 4, true, 2),
    tyrePlan('emi-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('emi-save', 'HARD → MED', 1, 'save', 9, -3, false, 0),
  ],
  mon: [
    tyrePlan('mon-push', 'SOFT → HARD', 1, 'push', 8, 5, true, 2),
    tyrePlan('mon-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('mon-save', 'HARD → MED', 1, 'save', 11, -3, false, 0),
  ],
  can: [
    tyrePlan('can-push', 'SOFT → MED → HARD', 2, 'push', 11, 5, true, 2),
    tyrePlan('can-balance', 'MED → HARD', 1, 'balance', 13, 1, false, 1),
    tyrePlan('can-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
  esp: [
    tyrePlan('esp-push', 'SOFT → MED → HARD', 2, 'push', 16, 5, true, 2),
    tyrePlan('esp-balance', 'MED → HARD → SOFT', 2, 'balance', 14, 2, false, 1),
    tyrePlan('esp-save', 'MED → HARD', 1, 'save', 2, -1, false, 0),
  ],
  aut: [
    tyrePlan('aut-push', 'SOFT → MED → HARD', 2, 'push', 12, 5, true, 2),
    tyrePlan('aut-balance', 'MED → HARD', 1, 'balance', 13, 0, false, 1),
    tyrePlan('aut-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
  gbr: [
    tyrePlan('gbr-push', 'SOFT → MED → HARD', 2, 'push', 15, 5, true, 2),
    tyrePlan('gbr-balance', 'MED → HARD → SOFT', 2, 'balance', 14, 2, false, 1),
    tyrePlan('gbr-save', 'MED → HARD', 1, 'save', 6, -1, false, 0),
  ],
  hun: [
    tyrePlan('hun-push', 'SOFT → HARD', 1, 'push', 9, 4, true, 2),
    tyrePlan('hun-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('hun-save', 'HARD → MED', 1, 'save', 10, -3, false, 0),
  ],
  bel: [
    tyrePlan('bel-push', 'SOFT → MED → HARD', 2, 'push', 13, 5, true, 2),
    tyrePlan('bel-balance', 'MED → HARD', 1, 'balance', 12, 1, false, 1),
    tyrePlan('bel-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
  ned: [
    tyrePlan('ned-push', 'SOFT → MED → HARD', 2, 'push', 12, 4, true, 2),
    tyrePlan('ned-balance', 'MED → HARD', 1, 'balance', 13, 0, false, 1),
    tyrePlan('ned-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
  ita: [
    tyrePlan('ita-push', 'SOFT → HARD', 1, 'push', 12, 4, true, 2),
    tyrePlan('ita-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('ita-save', 'HARD → MED', 1, 'save', 9, -2, false, 0),
  ],
  aze: [
    tyrePlan('aze-push', 'SOFT → HARD', 1, 'push', 11, 4, true, 2),
    tyrePlan('aze-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('aze-save', 'HARD → MED', 1, 'save', 9, -2, false, 0),
  ],
  sin: [
    tyrePlan('sin-push', 'SOFT → HARD', 1, 'push', 9, 5, true, 2),
    tyrePlan('sin-balance', 'MED → HARD', 1, 'balance', 13, 1, false, 1),
    tyrePlan('sin-save', 'HARD → MED', 1, 'save', 10, -3, false, 0),
  ],
  usa: [
    tyrePlan('usa-push', 'SOFT → MED → HARD', 2, 'push', 12, 4, true, 2),
    tyrePlan('usa-balance', 'MED → HARD', 1, 'balance', 13, 0, false, 1),
    tyrePlan('usa-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
  mex: [
    tyrePlan('mex-push', 'SOFT → HARD', 1, 'push', 11, 4, true, 2),
    tyrePlan('mex-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('mex-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
  bra: [
    tyrePlan('bra-push', 'SOFT → MED → HARD', 2, 'push', 14, 5, true, 2),
    tyrePlan('bra-balance', 'MED → HARD → SOFT', 2, 'balance', 13, 2, false, 1),
    tyrePlan('bra-save', 'MED → HARD', 1, 'save', 6, -1, false, 0),
  ],
  lv: [
    tyrePlan('lv-push', 'SOFT → HARD', 1, 'push', 11, 4, true, 2),
    tyrePlan('lv-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('lv-save', 'HARD → MED', 1, 'save', 9, -2, false, 0),
  ],
  qat: [
    tyrePlan('qat-push', 'SOFT → MED → HARD', 2, 'push', 15, 5, true, 2),
    tyrePlan('qat-balance', 'MED → HARD → MED', 2, 'balance', 14, 2, false, 1),
    tyrePlan('qat-save', 'MED → HARD', 1, 'save', 4, -1, false, 0),
  ],
  abu: [
    tyrePlan('abu-push', 'SOFT → HARD', 1, 'push', 11, 4, true, 2),
    tyrePlan('abu-balance', 'MED → HARD', 1, 'balance', 14, 0, false, 1),
    tyrePlan('abu-save', 'HARD → MED', 1, 'save', 8, -2, false, 0),
  ],
};

const FALLBACK_PLANS = [
  tyrePlan('fb-push', 'SOFT → MED → HARD', 2, 'push', 12, 5, true, 2),
  tyrePlan('fb-balance', 'MED → HARD', 1, 'balance', 12, 0, false, 1),
  tyrePlan('fb-save', 'HARD → MED', 1, 'save', 7, -2, false, 0),
];

export function strategiesForTrack(track) {
  return TRACK_PLANS[track?.id] || FALLBACK_PLANS;
}

function findPlan(planId) {
  if (!planId) return null;
  for (const list of Object.values(TRACK_PLANS)) {
    const hit = list.find((plan) => plan.id === planId);
    if (hit) return hit;
  }
  return null;
}

export function planForRole(track, role) {
  const list = strategiesForTrack(track);
  return list.find((plan) => plan.role === role) || list[1] || list[0];
}

/** Strategy choices exposed in the simplified UI */
export const UI_TIRE_OPTIONS = ['soft', 'medium'];
export const UI_ENGINE_OPTIONS = ['push', 'conserve'];

/** Global career state — mutated by engine, persisted via storage.js */
export let gameState = null;

const CORNERS = {
  mon: ['Casino', 'Mirabeau', 'Rascasse'],
  gbr: ['Copse', 'Maggotts', 'Stowe'],
  bel: ['Eau Rouge', 'Raidillon', 'Bus Stop'],
  ita: ['Ascari', 'Parabolica', 'Lesmo'],
  jpn: ['130R', 'Degner', 'Spoon'],
  bra: ['Senna S', 'Mergulho', 'Juncao'],
  default: ['Turn 1', 'the hairpin', 'the final chicane'],
};

const RADIO_LINES = [
  (d) => `📻 "No power, no power!" cries ${d} over the team radio.`,
  (d) => `📻 "${d} to pit wall — something's broken at the rear!"`,
  (d) => `📻 "Box this lap! Box, box!" — ${d} is limping home.`,
  (d) => `📻 "I've lost the engine!" ${d} shouts through static.`,
];

function baseState(mode, playMode, tournamentRound) {
  return {
    version: SAVE_VERSION,
    playMode, // 'solo' | 'tournament'
    phase: playMode === 'solo' ? 'solo-draft' : 'tournament-draft',
    mode, // classic | gaffer — stat visibility
    teamName: 'Multiverse Racing',
    playerChassis: null,
    playerDrivers: [null, null],
    playerPrincipal: null,
    draftStep: 'chassis',
    fullGrid: [],
    championshipStandings: [],
    constructorStandings: [],
    currentRaceIndex: 0,
    reSpinTokens: tournamentRound === 2 ? 1 : tournamentRound === 3 ? 0 : 2,
    aggression: 50,
    recordCode: { wins: 0, podiums: 0, losses: 0, dnfs: 0 },
    raceLog: [],
    squadStats: null,
    upgradeUsed: false,
    upgradeChoice: null,
    midSeasonTriggered: false,
    midSeasonChassisChanged: false,
    midSeasonDriverSwapped: false,
    flawlessBroken: false,
    seasonComplete: false,
    pendingCrisis: null,
    upgradeOptions: null,
    tournamentRound,
    lastRaceTelemetry: null,
    trophyFlags: {},
    radioPopup: null,
    rdTokenUsed: false,
    raceWeekendUI: 'strategy', // strategy | running | awaiting_continue
    pendingStrategy: { ...DEFAULT_STRATEGY },
    lastComputedRace: null,
  };
}

/** SOLO CAREER — local season loop, no leaderboard cut */
export function createSoloState(mode = 'classic') {
  const s = baseState(mode, 'solo', 1);
  s.reSpinTokens = 2;
  gameState = s;
  return s;
}

/** TOURNAMENT CLASH — async field; score submitted at season end */
export function createTournamentState(mode = 'classic', tournamentRound = 1) {
  const s = baseState(mode, 'tournament', tournamentRound);
  s.reSpinTokens = tournamentRound === 2 ? 1 : tournamentRound === 3 ? 0 : 2;
  gameState = s;
  return s;
}

/** @deprecated use createSoloState / createTournamentState */
export function createEmptyState(mode = 'classic', tournamentRound = 1) {
  return tournamentRound > 1 || mode === 'tournament'
    ? createTournamentState(mode, tournamentRound)
    : createSoloState(mode);
}

export function syncGameState(state) {
  gameState = state;
  return gameState;
}

function initSquadStats(state) {
  state.squadStats = {
    totalTeamPoints: 0,
    drivers: [0, 1].map((i) => {
      const d = state.playerDrivers[i];
      return {
        name: `${d.name} (${d.year})`,
        year: d.year,
        pac: d.pac,
        pointsScore: 0,
        wins: 0,
        podiums: 0,
        fastLaps: 0,
        dnfs: 0,
        lapsLed: 0,
        raceWinsVsTeammate: 0,
      };
    }),
  };
}

/**
 * Weighted constructor spin - top-tier cars are rarer
 * Uses power curve to make elite cars (95+ avg) less frequent
 */
export function spinConstructor() {
  const weighted = CONSTRUCTORS.map(c => {
    const avg = (c.aero + c.eng + c.rel) / 3;
    // Lower weight for elite cars, higher for midfield/backmarker
    let weight = 1;
    if (avg >= 95) weight = 0.25; // Elite cars - 25% normal chance (was 0.4)
    else if (avg >= 90) weight = 0.5; // Top cars - 50% normal chance (was 0.7)
    else if (avg >= 85) weight = 0.8; // Good cars - 80% normal chance (was 1.0)
    else if (avg >= 80) weight = 1.2; // Midfield - slightly more common (was 1.3)
    else weight = 1.8; // Backmarkers - more common (was 1.6)
    return { car: c, weight };
  });
  
  // Weighted random selection
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of weighted) {
    random -= item.weight;
    if (random <= 0) return item.car;
  }
  return weighted[0].car;
}

export function spinPrincipal() {
  return pickRandom(PRINCIPALS);
}

/**
 * Weighted driver pool spin - better correlation between car quality and driver quality
 * Makes it harder to get elite drivers with average cars and vice versa
 */
export function spinDriverPool() {
  const ctor = pickRandom(CONSTRUCTORS); // Use regular random for constructor in driver pool
  const roster = getRosterForConstructor(ctor.id);
  
  // Adjust driver quality based on car quality
  const carAvg = (ctor.aero + ctor.eng + ctor.rel) / 3;
  const filteredRoster = roster.map(d => {
    const driverAvg = (d.pac + d.rac + d.wet + d.con) / 4;
    // Penalize extreme mismatches - make elite drivers even rarer
    let weight = 1;
    if (carAvg >= 92 && driverAvg < 82) weight = 0.2; // Elite car with poor driver - very rare (was 0.3)
    if (carAvg < 78 && driverAvg >= 90) weight = 0.25; // Poor car with elite driver - very rare (was 0.4)
    if (carAvg >= 88 && driverAvg >= 88) weight = 0.4; // Both elite - much less common (was 0.6)
    if (carAvg >= 85 && driverAvg >= 85) weight = 0.6; // Both good - less common
    if (carAvg < 82 && driverAvg < 82) weight = 2.0; // Both poor - more common (was 1.5)
    return { driver: d, weight };
  });
  
  // Weighted selection for the entire roster - shuffle based on weights
  const weightedRoster = [];
  
  // Create weighted pool for random selection
  for (const item of filteredRoster) {
    const count = Math.max(1, Math.round(item.weight * 10)); // More weight = more entries
    for (let i = 0; i < count; i++) {
      weightedRoster.push(item.driver);
    }
  }
  
  // Shuffle the weighted pool
  for (let i = weightedRoster.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weightedRoster[i], weightedRoster[j]] = [weightedRoster[j], weightedRoster[i]];
  }
  
  // Return first unique drivers (remove duplicates while preserving order)
  const uniqueRoster = [];
  const seen = new Set();
  for (const driver of weightedRoster) {
    const key = `${driver.name}_${driver.year}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRoster.push(driver);
      if (uniqueRoster.length >= roster.length) break;
    }
  }
  
  return { constructor: ctor, roster: uniqueRoster, weighted: true };
}

export function formatRecord(rc) {
  return `${rc.wins}-${rc.podiums}-${rc.losses + rc.dnfs}`;
}

export function formatRecordLong(rc) {
  return `${rc.wins} Wins, ${rc.podiums} Podiums, ${rc.dnfs} DNFs`;
}

function principalTac(state, car) {
  if (car.isPlayer && state.playerPrincipal) return state.playerPrincipal.tac;
  // AI principals: scale lightly from car reliability band
  return 80 + Math.floor((car.rel - 70) * 0.4);
}

/**
 * Build 20-car multiverse grid
 */
export function generateMultiverseGrid(state) {
  const historicalDrivers = getAllDrivers();
  const grid = [];
  const chassis = state.playerChassis;
  const tac = state.playerPrincipal?.tac ?? 85;

  for (let i = 0; i < 2; i++) {
    const d = state.playerDrivers[i];
    grid.push({
      id: `player_car_${i + 1}`,
      isPlayer: true,
      driverName: d.name,
      driverYear: d.year,
      driverId: d.id,
      pac: d.pac,
      rac: d.rac,
      wet: d.wet,
      con: d.con,
      driverSkill: driverSkill(d),
      teamName: chassis.name,
      teamYear: chassis.year,
      aero: chassis.aero,
      eng: chassis.eng,
      rel: chassis.rel,
      color: chassis.color,
      tac,
      points: 0,
    });
  }

  const used = new Set(state.playerDrivers.map((d) => d.id || `${d.name}_${d.year}`));

  for (let i = 0; i < 18; i++) {
    let randomDriver;
    let attempts = 0;
    do {
      randomDriver = pickRandom(historicalDrivers);
      attempts++;
    } while (used.has(randomDriver.id || `${randomDriver.name}_${randomDriver.year}`) && attempts < 40);
    const randomTeam = pickRandom(CONSTRUCTORS);
    used.add(randomDriver.id || `${randomDriver.name}_${randomDriver.year}`);

    grid.push({
      id: `ai_car_${i}`,
      isPlayer: false,
      driverName: randomDriver.name,
      driverYear: randomDriver.year,
      driverId: randomDriver.id,
      pac: randomDriver.pac,
      rac: randomDriver.rac,
      wet: randomDriver.wet,
      con: randomDriver.con,
      driverSkill: randomDriver.driver_skill ?? driverSkill(randomDriver),
      teamName: randomTeam.name,
      teamYear: randomTeam.year,
      aero: randomTeam.aero,
      eng: randomTeam.eng,
      rel: randomTeam.rel,
      color: randomTeam.color,
      tac: 80 + Math.floor((randomTeam.rel - 70) * 0.4),
      points: 0,
    });
  }

  state.fullGrid = grid;
  state.championshipStandings = grid.map((c) => ({
    id: c.id,
    name: c.driverName,
    year: c.driverYear,
    team: `${c.teamName} '${String(c.teamYear).slice(2)}`,
    points: 0,
    isPlayer: c.isPlayer,
  }));
  initSquadStats(state);
  rebuildConstructorStandings(state);
  return state;
}

function cornerName(track) {
  const list = CORNERS[track.id] || CORNERS.default;
  return list[randInt(0, list.length - 1)];
}

function shortDriver(name, year) {
  const last = (name || '').split(' ').pop();
  return `${last} '${String(year).slice(2)}`;
}

function baselineGridRank(car, track) {
  const dry = car.pac * 0.7 + car.rac * 0.3;
  return car.aero * track.aeroWeight + car.eng * track.engineWeight + dry * track.driverWeight;
}

function buildNarrative(track, performances, flId, raining, dnfEvents, radioLine) {
  const narrative = [];
  const corner = cornerName(track);
  const finishers = performances.filter((p) => !p.dnf);

  if (raining) narrative.push(`🌧️ Rain hits ${track.name}. Wet specialists gain the edge.`);

  // Micro-sector flash
  if (finishers.length && Math.random() > 0.3) {
    const flyer = finishers[randInt(0, Math.min(4, finishers.length - 1))];
    const sector = randInt(1, 3);
    narrative.push(
      `🟢 Sector ${sector}: ${shortDriver(flyer.driverName, flyer.driverYear)} sets a purple micro-sector at ${track.name.replace(' GP', '')}!`
    );
  }

  for (const ev of dnfEvents.slice(0, 3)) {
    narrative.push(`⚙️ Lap ${ev.lap}: ${ev.team} — ${ev.reason}. ${ev.driver} DNF.`);
  }

  if (radioLine) narrative.push(radioLine);

  // Wheel-to-wheel divebomb
  if (finishers.length >= 2 && Math.random() > 0.2) {
    const attackers = finishers.filter((p) => (p.racecraft || 80) >= 90);
    const a = attackers.length ? attackers[randInt(0, attackers.length - 1)] : finishers[randInt(0, Math.min(5, finishers.length - 1))];
    let b = finishers[randInt(0, Math.min(8, finishers.length - 1))];
    if (a.id === b.id) b = finishers[(finishers.indexOf(a) + 1) % finishers.length];
    narrative.push(
      `⚔️ Lap ${randInt(12, 48)}: ${shortDriver(a.driverName, a.driverYear)} pulls off a high-risk divebomb on ${shortDriver(b.driverName, b.driverYear)} at ${corner}!`
    );
  } else if (finishers.length >= 2) {
    const a = finishers[randInt(0, Math.min(5, finishers.length - 1))];
    const b = finishers[randInt(0, Math.min(8, finishers.length - 1))];
    if (a.id !== b.id) {
      narrative.push(
        `Lap ${randInt(8, 28)}: ${shortDriver(a.driverName, a.driverYear)} pulls off a brilliant overtake on ${shortDriver(b.driverName, b.driverYear)} at ${corner}!`
      );
    }
  }

  // Gap call radio flavor
  if (finishers.length >= 2 && Math.random() > 0.5) {
    const lead = finishers[0];
    const chase = finishers[1];
    const gap = (Math.random() * 2.4 + 0.3).toFixed(1);
    narrative.push(
      `📻 "Copy that. Pushing hard. Gap to ${shortDriver(chase.driverName, chase.driverYear)} is ${gap}s…"`
    );
  }

  const podium = performances.filter((p) => !p.dnf && p.finishPos <= 3);
  podium.forEach((p) => {
    const i = p.finishPos - 1;
    narrative.push(
      `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} P${p.finishPos}: ${shortDriver(p.driverName, p.driverYear)} (+${p.points} pts)${p.fastLapBonus ? ' · FL' : ''}`
    );
  });

  performances
    .filter((p) => p.isPlayer)
    .forEach((p) => {
      if (p.dnf) {
        narrative.push(`❌ YOUR CAR: ${shortDriver(p.driverName, p.driverYear)} retired — 0 pts.`);
      } else if (p.finishPos > 3 && p.finishPos <= 10) {
        narrative.push(
          `🏁 ${shortDriver(p.driverName, p.driverYear)} scored P${p.finishPos} (+${p.points} pts).`
        );
      }
    });

  if (flId) {
    const fl = performances.find((p) => p.id === flId && p.fastLapBonus);
    if (fl) {
      narrative.push(`💜 FASTEST LAP: ${shortDriver(fl.driverName, fl.driverYear)} took the extra point!`);
    }
  }

  let hero = null;
  let bestGain = 0;
  finishers.forEach((p) => {
    const gain = (p.gridRank || 20) - p.finishPos;
    if (gain > bestGain) {
      bestGain = gain;
      hero = p;
    }
  });
  if (hero && bestGain >= 3) {
    narrative.push(
      `📈 Driver of the Day: ${shortDriver(hero.driverName, hero.driverYear)} climbed from P${hero.gridRank} to P${hero.finishPos}!`
    );
  }

  return { narrative, hero, bestGain };
}

function rebuildConstructorStandings(state) {
  const map = new Map();
  for (const car of state.fullGrid) {
    const wccKey = car.isPlayer ? 'PLAYER_TEAM' : car.id;
    if (!map.has(wccKey)) {
      map.set(wccKey, {
        id: wccKey,
        name: car.isPlayer
          ? `${car.teamName} '${String(car.teamYear).slice(2)} (You)`
          : `${car.teamName} '${String(car.teamYear).slice(2)}`,
        points: 0,
        isPlayer: car.isPlayer,
      });
    }
  }
  for (const car of state.fullGrid) {
    const wccKey = car.isPlayer ? 'PLAYER_TEAM' : car.id;
    map.get(wccKey).points += car.points;
  }
  state.constructorStandings = [...map.values()].sort((a, b) => b.points - a.points);
}

export function aggressionMods(aggression) {
  const t = aggression / 100;
  return {
    paceBonus: t * 0.12, // additive % on raw pace for player
    relPenalty: t * 8, // pushes reliability filter harder
  };
}

/**
 * Phase 1 — Reliability filter
 * DNF if roll(1..100) > REL + TAC×0.05 (− aggression penalty for player)
 */
export function reliabilityCheck(car, tac, aggressionPenalty = 0) {
  const threshold = car.rel + tac * 0.05 - aggressionPenalty;
  const roll = randInt(1, 100);
  return roll > threshold;
}

/**
 * Driver race pace factor: dry blends PAC+RAC; rain uses WET
 */
/** Pull 50–99 ratings closer together so a great package is favoured, not guaranteed. */
function fieldStat(stat) {
  return 64 + ((stat || 70) - 50) * 0.55;
}

function sessionNoise(con) {
  // Increased variance for less predictable results
  const baseNoise = randomRange(-6.0, 6.0); // Increased from -4.4 to 6.0
  const luckVariance = luckFactor(con) * 0.75; // Increased luck factor impact
  const randomFluctuation = randomRange(-2.0, 2.0); // Additional random fluctuation
  return baseNoise + luckVariance + randomFluctuation;
}

function driverPaceStat(car, raining) {
  if (raining) return car.wet;
  // Racecraft feeds wheel-to-wheel race pace (not pure quali PAC)
  return car.pac * 0.7 + car.rac * 0.3;
}

/**
 * Phase 2 — Core performance equation
 */
export function rawPaceScore(car, track, tac, raining, wetChoice, isPlayer, paceBonus) {
  let driverPace = driverPaceStat(car, raining);

  if (raining) {
    // TAC buffer: better principals soften crisis mistakes
    const tacBuffer = tac / 100; // 0.78–0.99
    if (isPlayer && wetChoice === 'stay') {
      driverPace *= 0.78 + tacBuffer * 0.12; // slicks gamble
    } else if (isPlayer && wetChoice === 'pit') {
      driverPace *= 1.02 + tacBuffer * 0.05;
    } else if (!isPlayer) {
      driverPace *= Math.random() > 0.4 ? 1.03 : 0.82 + tacBuffer * 0.1;
    }
  }

  let raw =
    fieldStat(car.aero) * track.aeroWeight +
    fieldStat(car.eng) * track.engineWeight +
    fieldStat(driverPace) * track.driverWeight +
    tac * 0.04;

  if (isPlayer) raw *= 1 + paceBonus;
  return raw;
}

/**
 * Phase 3 — Consistency luck variance
 * MaxVariance = (100 − CON) / 2
 */
export function luckFactor(con) {
  const maxWindow = (100 - con) / 2;
  return randomRange(-maxWindow, maxWindow);
}

export function getStrategyMods(strategy = DEFAULT_STRATEGY) {
  const engine = ENGINE_MODES[strategy.engine] || ENGINE_MODES.balanced;
  const plan = findPlan(strategy.planId);
  if (plan) {
    return {
      tire: { id: plan.id, label: plan.name, wear: !!plan.wear },
      engine,
      plan,
      paceBonus: plan.pace + engine.pace,
      qualiBonus: plan.quali + engine.pace * 0.08,
      dnfRiskDelta: plan.risk + engine.dnfRisk,
    };
  }
  const tire = TIRE_COMPOUNDS[strategy.tire] || TIRE_COMPOUNDS.medium;
  return {
    tire,
    engine,
    plan: null,
    paceBonus: tire.pace + engine.pace,
    dnfRiskDelta: tire.dnfRisk + engine.dnfRisk,
  };
}

/**
 * Assign FIA points by finisher rank (DNFs excluded from classification).
 * Fastest lap bonus (+1) only if holder finishes P1–P10.
 */
export function assignRacePoints(performances, flId) {
  let finisherRank = 0;
  for (const p of performances) {
    if (p.dnf) {
      p.finishPos = null;
      p.points = 0;
      p.fastLapBonus = false;
      continue;
    }
    finisherRank += 1;
    p.finishPos = finisherRank;
    p.points = finisherRank <= 10 ? FIA_POINTS[finisherRank - 1] : 0;
    p.fastLapBonus = finisherRank <= 10 && p.id === flId;
    if (p.fastLapBonus) p.points += 1;
  }
  return performances;
}

function buildMidRaceLines(track, strategy, performances, dnfEvents, raining, incident = null) {
  const mods = getStrategyMods(strategy);
  const lines = [];
  const playerFinishers = performances.filter((p) => p.isPlayer && !p.dnf);
  const corner = cornerName(track);

  if (incident) {
    lines.push(`${incident.icon} ${incident.title} — the race is flipped on its head!`);
  }

  if (mods.plan) {
    lines.push(`${mods.plan.name} · ${mods.plan.stops} stop${mods.plan.stops > 1 ? 's' : ''}.`);
  } else if (mods.tire.id === 'soft') {
    lines.push('🔥 Your driver is burning through Soft tires — grip falling off lap by lap!');
  } else if (mods.tire.id === 'hard') {
    lines.push('🛞 Hards holding strong — you are managing tire life while rivals pit.');
  }

  if (mods.engine.id === 'push') {
    lines.push('🌡️ Engine temps rising in Push Mode — pit wall watching the data nervously.');
  } else if (mods.engine.id === 'conserve') {
    lines.push('🔋 Conserve mode engaged — protecting the power unit for a late attack.');
  }

  if (raining) lines.push(`🌧️ Rain intensifies at ${track.name.replace(' GP', '')} — everyone on inters.`);

  for (const ev of dnfEvents.slice(0, 2)) {
    lines.push(`⚙️ Lap ${ev.lap}: ${ev.driver} — ${ev.reason}. DNF.`);
  }

  const finishers = performances.filter((p) => !p.dnf);
  if (finishers.length >= 2) {
    const a = finishers[randInt(0, Math.min(4, finishers.length - 1))];
    let b = finishers[randInt(0, Math.min(8, finishers.length - 1))];
    if (a.id === b.id) b = finishers[(finishers.indexOf(a) + 1) % finishers.length];
    lines.push(
      `⚔️ Lap ${randInt(14, 42)}: ${shortDriver(a.driverName, a.driverYear)} attacks ${shortDriver(b.driverName, b.driverYear)} at ${corner}!`
    );
  }

  if (playerFinishers.length) {
    const p = playerFinishers[0];
    const pos = p.finishPos || performances.filter((x) => !x.dnf).indexOf(p) + 1;
    lines.push(`📻 Pit wall to ${shortDriver(p.driverName, p.driverYear)}: "Stay on plan — P${pos} target."`);
  }

  while (lines.length < 6) {
    const f = finishers[randInt(0, Math.min(9, finishers.length - 1))];
    if (f) {
      lines.push(
        `Lap ${randInt(20, 50)}: ${shortDriver(f.driverName, f.driverYear)} posts a ${(Math.random() * 0.8 + 1.1).toFixed(3)}s sector.`
      );
    }
  }

  return lines.slice(0, 8);
}

function buildScorerLines(performances, flId) {
  const finishers = performances.filter((p) => !p.dnf).slice(0, 10);
  return finishers.map((p, i) => {
    const fl = p.fastLapBonus ? ' · FL +1' : '';
    return `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏁'} P${p.finishPos}: ${shortDriver(p.driverName, p.driverYear)} (+${p.points}${fl})`;
  });
}

const MECH_REASONS = ['Gearbox failure', 'Engine smoke', 'Hydraulics', 'Electrical', 'Power unit'];
const CHAOS_REASONS = ['Collision', 'Puncture', 'Spun into the gravel', 'Front wing damage'];
const QUALI_NOTES = ['Lock-up', 'Track limits', 'Lost the tow', 'Snap on entry'];

/** Street and high-downforce tracks make the qualifying slot harder to overturn. */
function overtakeWeight(track) {
  return 0.72 + (track.aeroWeight || 0.35) * 1.05;
}

/**
 * Retirement roll for every car, including a great driver in a great car.
 * Quality lowers the odds. It never removes them.
 * extraRisk is strategy / aggression / grid-call pressure (can be negative).
 */
function raceRetirement(car, tac, extraRisk = 0) {
  const skill = ((car.rac || 80) + (car.con || 80)) / 2;
  // Increased base retirement probabilities for more unpredictability
  let mechP = Math.max(0.04, (100 - car.rel) / 120 - tac / 2800); // Increased base rate
  let chaosP = Math.max(0.03, 0.07 - (skill - 75) / 800); // Increased chaos probability
  mechP += extraRisk / 200; // Extra risk has more impact
  chaosP += extraRisk / 350;
  mechP = Math.min(0.50, Math.max(0.025, mechP)); // Slightly higher max
  chaosP = Math.min(0.30, Math.max(0.02, chaosP)); // Slightly higher max
  
  // Random "bad luck" factor for even more unpredictability
  const badLuck = Math.random() < 0.05; // 5% chance of unexpected failure
  if (badLuck && !car.isPlayer) {
    mechP += 0.03; // Small boost for AI cars
  }
  
  if (Math.random() < mechP) return MECH_REASONS[randInt(0, MECH_REASONS.length - 1)];
  if (Math.random() < chaosP) return CHAOS_REASONS[randInt(0, CHAOS_REASONS.length - 1)];
  return null;
}

function classRow(p) {
  return {
    pos: p.dnf ? 'DNF' : p.finishPos,
    grid: p.gridRank,
    id: p.id,
    name: shortDriver(p.driverName, p.driverYear),
    driverName: p.driverName,
    year: p.driverYear,
    team: `${p.teamName} '${String(p.teamYear).slice(2)}`,
    isPlayer: !!p.isPlayer,
    points: p.points || 0,
    dnf: !!p.dnf,
    fl: !!p.fastLapBonus,
    color: p.color || '#66FCF1',
    note: p.qualiNote || '',
  };
}

/**
 * One-lap qualifying. Sets the race grid. A fast package is favoured,
 * but a lock-up or a garage issue can bury it.
 * Does not mutate season points.
 */
export function computeQualifying(state, strategy = DEFAULT_STRATEGY) {
  const track = CALENDAR_24[state.currentRaceIndex];
  if (!track || !state.fullGrid?.length) return null;

  const stratMods = getStrategyMods(strategy);
  const raining = state.pendingCrisis?.type === 'rain' || Math.random() < track.baseRainChance;

  const rows = state.fullGrid.map((car) => {
    const carTac = principalTac(state, car);
    const oneLap = raining ? car.wet : car.pac;
    let raw =
      fieldStat(car.aero) * track.aeroWeight +
      fieldStat(car.eng) * track.engineWeight +
      fieldStat(oneLap) * track.driverWeight +
      carTac * 0.04 +
      sessionNoise(car.con);

    let note = '';
    const mechP = Math.max(0.012, (100 - car.rel) / 480);
    const mishapP = Math.max(0.02, 0.08 - ((car.con || 80) - 70) / 650);
    if (Math.random() < mechP) {
      raw -= 26;
      note = 'No time — garage';
    } else if (Math.random() < mishapP) {
      raw -= randInt(7, 15);
      note = QUALI_NOTES[randInt(0, QUALI_NOTES.length - 1)];
    }

    if (car.isPlayer) raw += stratMods.plan ? stratMods.qualiBonus : stratMods.paceBonus * 0.12;

    return { car, raw, note };
  });

  rows.sort((a, b) => b.raw - a.raw);
  const order = rows.map((r, i) => ({
    id: r.car.id,
    gridRank: i + 1,
    note: r.note,
    driverName: r.car.driverName,
    driverYear: r.car.driverYear,
    teamName: r.car.teamName,
    teamYear: r.car.teamYear,
    isPlayer: !!r.car.isPlayer,
    color: r.car.color,
    name: shortDriver(r.car.driverName, r.car.driverYear),
    team: `${r.car.teamName} '${String(r.car.teamYear).slice(2)}`,
  }));

  return { track, strategy, raining, order, pole: order[0] };
}

/**
 * Race classification from a locked qualifying grid.
 * Track position is real: passing costs pace, and any car can retire.
 */
export function computeRaceFromGrid(state, strategy = DEFAULT_STRATEGY, quali, gridCall = 'cover') {
  if (!quali?.order?.length) return null;
  const call = GRID_CALLS[gridCall] || GRID_CALLS.cover;
  const track = quali.track || CALENDAR_24[state.currentRaceIndex];
  const stratMods = getStrategyMods(strategy);
  const raining = !!quali.raining;
  const wetChoice = raining ? 'pit' : null;
  const aggMods = aggressionMods(state.aggression);
  const gridMap = new Map(quali.order.map((r) => [r.id, r.gridRank]));
  const noteMap = new Map(quali.order.map((r) => [r.id, r.note || '']));
  const slotWeight = overtakeWeight(track);

  const performances = [];
  const dnfEvents = [];
  let radioPopup = null;
  const multi21 = Math.random() < 0.02;

  for (const car of state.fullGrid) {
    const carTac = principalTac(state, car);
    const extraRisk = car.isPlayer ? aggMods.relPenalty + stratMods.dnfRiskDelta + call.dnfRisk : 0;
    let reason = raceRetirement(car, carTac, extraRisk);
    if (multi21 && car.isPlayer && !reason && Math.random() < 0.5) {
      reason = 'Teammate collision (Multi-21)';
    }

    const dnf = !!reason;
    let score = -999;
    if (dnf) {
      dnfEvents.push({
        lap: randInt(5, 52),
        driver: shortDriver(car.driverName, car.driverYear),
        team: `${car.teamName} '${String(car.teamYear).slice(2)}`,
        reason,
        isPlayer: car.isPlayer,
      });
      if (car.isPlayer && reason !== 'Teammate collision (Multi-21)') {
        radioPopup = RADIO_LINES[randInt(0, RADIO_LINES.length - 1)](
          shortDriver(car.driverName, car.driverYear)
        );
      }
    } else {
      const raw = rawPaceScore(car, track, carTac, raining, wetChoice, car.isPlayer, car.isPlayer ? aggMods.paceBonus : 0);
      const gridRank = gridMap.get(car.id) || 20;
      const trackPosition = (21 - gridRank) * slotWeight;
      score = raw + sessionNoise(car.con) * 0.65 + trackPosition;
      if (car.isPlayer) {
        score += stratMods.paceBonus * 0.42 + call.pace;
        if (stratMods.tire.wear && Math.random() > 0.55) score -= randInt(3, 9);
      }
    }

    performances.push({
      id: car.id,
      driverName: car.driverName,
      driverYear: car.driverYear,
      teamName: car.teamName,
      teamYear: car.teamYear,
      isPlayer: car.isPlayer,
      color: car.color,
      wet: car.wet,
      tireChoice: car.isPlayer ? strategy.tire : assignAiTireChoice(),
      racecraft: car.rac,
      score,
      dnf,
      gridRank: gridMap.get(car.id) || 20,
      qualiNote: noteMap.get(car.id) || '',
    });
  }

  if (multi21) {
    radioPopup = '📻 "What are you doing?! That\'s your teammate!" — Multi-21 chaos on the pit wall.';
  }

  performances.sort((a, b) => b.score - a.score);

  const incident = rollRaceIncident();
  let incidentDetails = null;
  if (incident) {
    const applied = applyRaceIncident(performances, incident, strategy);
    incidentDetails = applied.details;
  }

  const eligibleFl = performances.filter((p) => !p.dnf).slice(0, 10);
  let flId = null;
  if (eligibleFl.length) {
    const weights = eligibleFl.map((_, i) => (i === 0 ? 3 : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < eligibleFl.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        flId = eligibleFl[i].id;
        break;
      }
    }
    if (!flId) flId = eligibleFl[0].id;
  }

  assignRacePoints(performances, flId);

  const playerResults = [null, null];
  for (const finished of performances) {
    if (finished.id !== 'player_car_1' && finished.id !== 'player_car_2') continue;
    const si = finished.id === 'player_car_1' ? 0 : 1;
    playerResults[si] = {
      pos: finished.dnf ? 'DNF' : finished.finishPos,
      dnf: finished.dnf,
      points: finished.points,
      fl: finished.fastLapBonus,
      grid: finished.gridRank,
    };
  }

  const teamRacePts = playerResults.reduce((s, row) => s + (row?.points || 0), 0);
  const finishers = performances.filter((p) => !p.dnf);
  const classification = performances.map(classRow);
  const midRaceLines = buildMidRaceLines(track, strategy, performances, dnfEvents, raining, incident);
  const scorerLines = buildScorerLines(performances, flId);
  const { narrative, hero, bestGain } = buildNarrative(track, performances, flId, raining, dnfEvents, radioPopup);
  const playerResult = performances.find((p) => p.id === 'player_car_1');
  const p2 = performances.find((p) => p.id === 'player_car_2');
  const winner = finishers[0] || performances[0];

  const telemetry = {
    track,
    profile: getTrackProfile(track),
    strategy,
    gridCall: call.id,
    incident,
    incidentDetails,
    narrative,
    radioPopup,
    qualifying: quali.order,
    classification,
    pole: quali.pole,
    midRaceLines,
    scorerLines,
    hero: hero
      ? { name: hero.driverName, year: hero.driverYear, from: hero.gridRank, to: hero.finishPos, gain: bestGain }
      : null,
    bars: [
      {
        id: 'player_car_1',
        name: state.playerDrivers[0]?.name,
        year: state.playerDrivers[0]?.year,
        pos: playerResult?.dnf ? 'DNF' : playerResult?.finishPos,
        dnf: !!playerResult?.dnf,
        points: playerResults[0]?.points || 0,
        fl: playerResults[0]?.fl,
        grid: playerResults[0]?.grid,
      },
      {
        id: 'player_car_2',
        name: state.playerDrivers[1]?.name,
        year: state.playerDrivers[1]?.year,
        pos: p2?.dnf ? 'DNF' : p2?.finishPos,
        dnf: !!p2?.dnf,
        points: playerResults[1]?.points || 0,
        fl: playerResults[1]?.fl,
        grid: playerResults[1]?.grid,
      },
    ],
    failures: dnfEvents.filter((e) => e.isPlayer),
    teamRacePts,
    raining,
  };

  const logEntry = {
    raceIndex: state.currentRaceIndex,
    track,
    raining,
    strategy,
    gridCall: call.id,
    winnerName: winner?.dnf ? '—' : winner?.driverName,
    winnerYear: winner?.driverYear,
    playerPos: playerResult?.dnf ? 'DNF' : playerResult?.finishPos,
    playerDnf: !!playerResult?.dnf,
    narrative,
    playerResults,
    telemetry,
    teamRacePts,
    multi21,
    classification: performances.map((p) => ({
      pos: p.dnf ? 'DNF' : p.finishPos,
      id: p.id,
      driverName: p.driverName,
      driverYear: p.driverYear,
      isPlayer: p.isPlayer,
      points: p.points,
      fastLapBonus: p.fastLapBonus,
      grid: p.gridRank,
    })),
  };

  return {
    track,
    strategy,
    gridCall: call.id,
    performances,
    flId,
    playerResults,
    telemetry,
    logEntry,
    multi21,
    raining,
    radioPopup,
    incident,
    incidentDetails,
    qualifying: quali,
  };
}

/**
 * Full weekend in one pass (qualifying, then a Cover grid call).
 * Does not mutate season state.
 */
export function computeRaceWeekend(state, strategy = DEFAULT_STRATEGY, gridCall = 'cover') {
  const quali = computeQualifying(state, strategy);
  if (!quali) return null;
  return computeRaceFromGrid(state, strategy, quali, gridCall);
}

/** Commit computed race result to season state */
export function applyRaceResult(state, raceResult) {
  if (!raceResult) return state;
  if (!state.squadStats) initSquadStats(state);

  const { performances, flId, playerResults, telemetry, logEntry, multi21 } = raceResult;
  state.pendingCrisis = null;
  state.radioPopup = raceResult.radioPopup;

  if (multi21) {
    state.trophyFlags = state.trophyFlags || {};
    state.trophyFlags.multi21 = true;
  }

  for (const finished of performances) {
    const gridCar = state.fullGrid.find((c) => c.id === finished.id);
    if (gridCar) gridCar.points += finished.points;

    if (finished.id === 'player_car_1' || finished.id === 'player_car_2') {
      const si = finished.id === 'player_car_1' ? 0 : 1;
      const sd = state.squadStats.drivers[si];
      sd.pointsScore += finished.points;
      state.squadStats.totalTeamPoints += finished.points;

      if (finished.dnf) sd.dnfs++;
      else {
        if (finished.finishPos === 1) {
          sd.wins++;
          sd.podiums++;
          sd.lapsLed += randInt(12, 40);
        } else if (finished.finishPos <= 3) {
          sd.podiums++;
        }
        if (finished.fastLapBonus) sd.fastLaps++;
      }

      state.trophyFlags = state.trophyFlags || {};
      if (!finished.dnf && finished.finishPos >= 11 && isHondaPowered(state.playerChassis)) {
        state.trophyFlags.gp2Engine = true;
      }
      if (!finished.dnf && finished.finishPos === 1 && isBudgetChassis(state.playerChassis)) {
        state.trophyFlags.budgetWin = true;
      }
      if (!finished.dnf && finished.finishPos <= 3) {
        const drv = state.playerDrivers[si];
        if (drv && drv.year < 1980 && isHybridEra(state.playerChassis)) {
          state.trophyFlags.oldSchoolPodium = true;
        }
      }
    }

    if (finished.id === 'player_car_1') {
      if (finished.dnf) {
        state.recordCode.dnfs++;
        state.flawlessBroken = true;
      } else if (finished.finishPos === 1) {
        state.recordCode.wins++;
      } else if (finished.finishPos <= 3) {
        state.recordCode.podiums++;
        state.flawlessBroken = true;
      } else {
        state.recordCode.losses++;
        state.flawlessBroken = true;
      }
    }
  }

  if (playerResults[0] && playerResults[1]) {
    const a = playerResults[0];
    const b = playerResults[1];
    if (!a.dnf && (b.dnf || a.pos < b.pos)) state.squadStats.drivers[0].raceWinsVsTeammate++;
    else if (!b.dnf && (a.dnf || b.pos < a.pos)) state.squadStats.drivers[1].raceWinsVsTeammate++;
    if (
      !a.dnf &&
      !b.dnf &&
      ((a.pos === 1 && b.pos === 2) || (a.pos === 2 && b.pos === 1))
    ) {
      state.trophyFlags = state.trophyFlags || {};
      state.trophyFlags.doubleStack = true;
    }
  }

  state.championshipStandings = state.fullGrid
    .map((c) => ({
      id: c.id,
      name: c.driverName,
      year: c.driverYear,
      team: `${c.teamName} '${String(c.teamYear).slice(2)}`,
      points: c.points,
      isPlayer: c.isPlayer,
    }))
    .sort((a, b) => b.points - a.points);

  rebuildConstructorStandings(state);
  state.lastRaceTelemetry = telemetry;
  state.raceLog.push(logEntry);
  state.currentRaceIndex++;
  state.lastComputedRace = null;
  state.raceWeekendUI = 'strategy';

  const halfway = Math.floor(CALENDAR_24.length / 2);
  if (
    state.currentRaceIndex === halfway &&
    !state.upgradeUsed &&
    !state.midSeasonTriggered
  ) {
    state.midSeasonTriggered = true;
    state.rdTokenUsed = false;
    state.phase = state.playMode === 'solo' ? 'solo-upgrade' : 'tournament-upgrade';
    state.upgradeOptions = generateUpgradeOptions(state);
  }

  if (state.currentRaceIndex >= CALENDAR_24.length) {
    state.seasonComplete = true;
    state.phase = state.playMode === 'solo' ? 'solo-finale' : 'tournament-finale';
  }

  return state;
}

/** @deprecated — use computeRaceWeekend + applyRaceResult */
export function simulateGrandPrix(state, strategy = DEFAULT_STRATEGY) {
  const result = computeRaceWeekend(state, strategy);
  if (!result) return null;
  applyRaceResult(state, result);
  return { paused: false, logEntry: result.logEntry, performances: result.performances, telemetry: result.telemetry };
}

/**
 * Mid-season cards — quality scales with principal RND
 */
export function generateUpgradeOptions(state = null) {
  const rnd = state?.playerPrincipal?.rnd ?? 88;
  const quality = rnd / 100; // 0.78–0.99
  const engBoost = Math.round(6 + quality * 6); // 6–12
  const aeroBoost = Math.round(8 + quality * 6); // 8–14
  const relBoost = Math.round(4 + quality * 5); // 4–9

  const pool = [
    {
      id: 'engine',
      title: 'Engine Supplier Swap',
      desc: `Modern power unit. +${engBoost} ENG.`,
      apply: (s) => {
        s.playerChassis = {
          ...s.playerChassis,
          eng: Math.min(99, s.playerChassis.eng + engBoost),
        };
        for (const car of s.fullGrid) {
          if (car.isPlayer) car.eng = Math.min(99, car.eng + engBoost);
        }
      },
    },
    {
      id: 'aero',
      title: 'Aerodynamic Overhaul',
      desc: `+${aeroBoost} AERO downforce.`,
      apply: (s) => {
        s.playerChassis = {
          ...s.playerChassis,
          aero: Math.min(99, s.playerChassis.aero + aeroBoost),
        };
        for (const car of s.fullGrid) {
          if (car.isPlayer) car.aero = Math.min(99, car.aero + aeroBoost);
        }
      },
    },
    {
      id: 'reliability',
      title: 'Reliability Package',
      desc: `+${relBoost} REL. Fewer DNFs.`,
      apply: (s) => {
        s.playerChassis = {
          ...s.playerChassis,
          rel: Math.min(99, s.playerChassis.rel + relBoost),
        };
        for (const car of s.fullGrid) {
          if (car.isPlayer) car.rel = Math.min(99, car.rel + relBoost);
        }
      },
    },
    {
      id: 'driver',
      title: 'Driver Mid-Season Swap',
      desc: 'Spin once to replace Driver 2.',
      apply: null,
      needsSpin: true,
    },
  ];

  // Higher RND → more likely to draw the stronger cards first (shuffle weighted)
  const shuffled = pool.sort(() => Math.random() - 0.5);
  // Always show 3; elite RND excludes the weakest reliability-only sometimes replaced — keep 3 of 4
  return shuffled.slice(0, 3);
}

export function applyUpgrade(state, optionId, newDriver = null) {
  const opt = state.upgradeOptions?.find((o) => o.id === optionId);
  if (!opt) return state;

  if (opt.needsSpin && newDriver) {
    state.playerDrivers[1] = newDriver;
    const car = state.fullGrid.find((c) => c.id === 'player_car_2');
    if (car) {
      car.driverName = newDriver.name;
      car.driverYear = newDriver.year;
      car.driverId = newDriver.id;
      car.pac = newDriver.pac;
      car.rac = newDriver.rac;
      car.wet = newDriver.wet;
      car.con = newDriver.con;
      car.driverSkill = driverSkill(newDriver);
    }
    const stand = state.championshipStandings.find((s) => s.id === 'player_car_2');
    if (stand) {
      stand.name = newDriver.name;
      stand.year = newDriver.year;
    }
    if (state.squadStats?.drivers[1]) {
      state.squadStats.drivers[1].name = `${newDriver.name} (${newDriver.year})`;
      state.squadStats.drivers[1].year = newDriver.year;
      state.squadStats.drivers[1].pac = newDriver.pac;
    }
    state.midSeasonDriverSwapped = true;
  } else if (opt.apply) {
    opt.apply(state);
    if (optionId === 'engine' || optionId === 'aero' || optionId === 'reliability') {
      state.midSeasonChassisChanged = true;
    }
  }

  if (state.midSeasonChassisChanged && state.midSeasonDriverSwapped) {
    state.trophyFlags = state.trophyFlags || {};
    state.trophyFlags.tinkerman = true;
  }

  // If chassis changed but driver not swapped, stay on upgrade for optional second action
  if (state.midSeasonChassisChanged && !state.midSeasonDriverSwapped && optionId !== 'driver') {
    state.upgradeUsed = false;
    state.awaitingOptionalDriver = true;
    state.phase = state.playMode === 'solo' ? 'solo-upgrade' : 'tournament-upgrade';
    return state;
  }

  state.upgradeUsed = true;
  state.rdTokenUsed = true;
  state.awaitingOptionalDriver = false;
  state.upgradeChoice = optionId;
  state.phase = state.playMode === 'solo' ? 'solo-racing' : 'tournament-racing';
  return state;
}

export function skipOptionalDriverSwap(state) {
  state.upgradeUsed = true;
  state.rdTokenUsed = true;
  state.awaitingOptionalDriver = false;
  state.phase = state.playMode === 'solo' ? 'solo-racing' : 'tournament-racing';
  return state;
}

export function buildShareText(state, url = '') {
  // Prefer rich squad card when stats exist — filled by app via analytics
  const rc = state.recordCode;
  const d1 = state.playerDrivers[0];
  const d2 = state.playerDrivers[1];
  const chassis = state.playerChassis;
  const squad = state.squadStats;
  const pts = squad?.totalTeamPoints ?? 0;

  if (squad) {
    const s1 = squad.drivers[0];
    const s2 = squad.drivers[1];
    return `🏎️ F1 MULTIVERSE: SQUAD REVIEW 🏁
Team: ${state.teamName || 'Multiverse Racing'}
Total Points: ${pts} · Record: ${formatRecord(rc)}

👑 Car: ${chassis.year} ${chassis.name}
👨‍✈️ ${s1.name}
   → W${s1.wins} · Pod ${s1.podiums} · FL ${s1.fastLaps} · DNF ${s1.dnfs} · ${s1.pointsScore} pts
👨‍✈️ ${s2.name}
   → W${s2.wins} · Pod ${s2.podiums} · FL ${s2.fastLaps} · DNF ${s2.dnfs} · ${s2.pointsScore} pts

Can you survive the Daily Clash cut? Play at: ${url || (typeof window !== 'undefined' ? window.location.href : '')}`;
  }

  return `🏎️ F1 MULTIVERSE SIMULATOR 🏁
Record: ${formatRecord(rc)}
[Car]: ${chassis.year} ${chassis.name}
[Driver 1]: ${d1.year} ${d1.name}
[Driver 2]: ${d2.year} ${d2.name}
Play at: ${url || (typeof window !== 'undefined' ? window.location.href : '')}`;
}

export function getWdcPosition(state, carId = 'player_car_1') {
  return state.championshipStandings.findIndex((s) => s.id === carId) + 1;
}

export { CALENDAR_24, SEASON_LENGTH };

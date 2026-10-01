/**
 * 12 Secret Multiverse Trophies — permanent localStorage badges
 */

import { SEASON_LENGTH } from './data.js';

export const TROPHY_DEFS = [
  // 🔴 Blunders & Drama
  {
    id: 'gp2_engine',
    cat: 'blunder',
    name: 'GP2 Engine!',
    desc: 'Finish below P18 in a Honda-powered chassis.',
    icon: '🔴',
  },
  {
    id: 'multi21',
    cat: 'blunder',
    name: 'Multi-21 Heartbreak',
    desc: 'Both drivers collide — double DNF in one race.',
    icon: '🔴',
  },
  {
    id: 'tinkerman',
    cat: 'blunder',
    name: 'The Tinkerman',
    desc: 'Change chassis package AND swap a driver in the same transfer window.',
    icon: '🔴',
  },
  // 🟡 Carry jobs
  {
    id: 'heavy_lifter',
    cat: 'carry',
    name: 'The Heavy Lifter',
    desc: 'One driver scores over 85% of constructor points.',
    icon: '🟡',
  },
  {
    id: 'cult_hero',
    cat: 'carry',
    name: 'Cult Hero Resurrection',
    desc: 'Clear the Round 1 cut with a driver under 75 PAC.',
    icon: '🟡',
  },
  {
    id: 'budget_maestro',
    cat: 'carry',
    name: 'The Budget Maestro',
    desc: 'Win a GP in a lower-midfield historic chassis.',
    icon: '🟡',
  },
  // 🟢 Era synthesizers
  {
    id: 'old_school',
    cat: 'era',
    name: 'Old School Cool',
    desc: 'Podium with a pre-1980 driver in a Turbo-Hybrid chassis.',
    icon: '🟢',
  },
  {
    id: 'silver_arrow',
    cat: 'era',
    name: 'Silver Arrow Supremacy',
    desc: 'Win the WCC with two rookies in a Mercedes.',
    icon: '🟢',
  },
  {
    id: 'perfect_harm',
    cat: 'era',
    name: 'Perfect Harmonization',
    desc: `Zero mechanical DNFs across all ${SEASON_LENGTH} races.`,
    icon: '🟢',
  },
  // Extras to complete the 12
  {
    id: 'invincible',
    cat: 'era',
    name: 'Invincible',
    desc: `Go a flawless ${SEASON_LENGTH}-0 with Driver 1.`,
    icon: '🟢',
  },
  {
    id: 'double_stack',
    cat: 'carry',
    name: '1-2 Formation',
    desc: 'Lock out P1 and P2 with both of your drivers.',
    icon: '🟡',
  },
  {
    id: 'gaffer_crown',
    cat: 'blunder',
    name: 'Gaffer Crown',
    desc: 'Advance a tournament round while Gaffer Mode is active.',
    icon: '🔴',
  },
];

const BUDGET_IDS = new Set([
  'arr_97', 'min_85', 'tyr_90', 'sau_82', 'wil_21', 'has_18', 'sai_09', 'atr_23', 'alf_20',
]);

export function isHondaPowered(chassis) {
  if (!chassis) return false;
  const n = (chassis.name || '').toLowerCase();
  return n.includes('honda') || chassis.id === 'hon_88' || chassis.id === 'mcl_88' || chassis.id === 'mcl_89';
}

export function isBudgetChassis(chassis) {
  if (!chassis) return false;
  if (BUDGET_IDS.has(chassis.id)) return true;
  const avg = ((chassis.aero || 80) + (chassis.eng || 80) + (chassis.rel || 80)) / 3;
  return avg < 76;
}

export function isHybridEra(chassis) {
  return (chassis?.year || 0) >= 2014;
}

export function isRookieDriver(d) {
  // Low pace band OR known rookie seasons
  if (!d) return false;
  if ((d.pac || 99) <= 84) return true;
  const rookies = new Set([
    'lh_2008', 'sv_2008', 'mv_2015', 'ln_2019', 'op_2023', 'gr_2019', 'cl_2018', 'yt_2021',
  ]);
  return rookies.has(d.id);
}

/**
 * Evaluate season + race flags → newly unlocked trophy ids
 */
export function evaluateTrophies(state, ctx = {}) {
  const unlocked = [];
  const flags = state.trophyFlags || {};
  const squad = state.squadStats;
  const d1 = state.playerDrivers?.[0];
  const d2 = state.playerDrivers?.[1];
  const chassis = state.playerChassis;

  if (flags.gp2Engine) unlocked.push('gp2_engine');
  if (flags.multi21) unlocked.push('multi21');
  if (flags.tinkerman) unlocked.push('tinkerman');
  if (flags.budgetWin) unlocked.push('budget_maestro');
  if (flags.oldSchoolPodium) unlocked.push('old_school');
  if (flags.doubleStack) unlocked.push('double_stack');

  if (squad) {
    const total = Math.max(1, squad.totalTeamPoints);
    const share = Math.max(
      squad.drivers[0].pointsScore / total,
      squad.drivers[1].pointsScore / total
    );
    if (share >= 0.85) unlocked.push('heavy_lifter');

    const teamDnfs = squad.drivers[0].dnfs + squad.drivers[1].dnfs;
    if (state.seasonComplete && teamDnfs === 0) unlocked.push('perfect_harm');
  }

  const rc = state.recordCode || {};
  if (rc.wins === SEASON_LENGTH && !rc.podiums && !rc.losses && !rc.dnfs) unlocked.push('invincible');

  // Silver Arrow: Mercedes WCC + two rookies
  if (state.seasonComplete && chassis) {
    const isMerc = (chassis.name || '').toLowerCase().includes('mercedes');
    const wcc = state.constructorStandings?.[0];
    if (isMerc && wcc?.isPlayer && isRookieDriver(d1) && isRookieDriver(d2)) {
      unlocked.push('silver_arrow');
    }
  }

  // Cult hero + gaffer crown need tournament context
  if (ctx.advanced && ctx.round === 1) {
    if ((d1?.pac || 99) < 75 || (d2?.pac || 99) < 75) unlocked.push('cult_hero');
  }
  if (ctx.advanced && state.mode === 'gaffer') unlocked.push('gaffer_crown');

  return [...new Set(unlocked)];
}

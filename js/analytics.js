/**
 * End-of-season analytics — carry index, H2H, efficiency
 */

import { driverSkill } from './data.js';

export function compileSeasonAnalytics(state) {
  const squad = state.squadStats || emptySquad(state);
  const d1 = squad.drivers[0];
  const d2 = squad.drivers[1];
  const totalPoints = Math.max(1, squad.totalTeamPoints || 1);

  const d1Share = Math.round((d1.pointsScore / totalPoints) * 100);
  const d2Share = Math.round((d2.pointsScore / totalPoints) * 100);

  const chassisPower =
    ((state.playerChassis?.aero || 80) +
      (state.playerChassis?.eng || 80) +
      (state.playerChassis?.rel || 80)) /
    3;
  const d1Skill = driverSkill(state.playerDrivers[0] || { pac: 80, rac: 80, wet: 80, con: 80 });
  const d2Skill = driverSkill(state.playerDrivers[1] || { pac: 80, rac: 80, wet: 80, con: 80 });
  const draftBaseline = (chassisPower + d1Skill + d2Skill) / 3;

  // Expected constructor points band from draft strength (rough)
  const expectedPts = Math.round(180 + (draftBaseline - 80) * 12);
  const actualPts = squad.totalTeamPoints;
  const efficiencyPct = Math.round(((actualPts - expectedPts) / Math.max(expectedPts, 1)) * 100);

  let carryBadge = null;
  if (d1Share >= 75) {
    carryBadge = {
      type: 'driver',
      label: 'ABSOLUTE CARRY',
      text: `${shortName(d1)} contributed ${d1Share}% of your constructor points.`,
    };
  } else if (d2Share >= 75) {
    carryBadge = {
      type: 'driver',
      label: 'ABSOLUTE CARRY',
      text: `${shortName(d2)} contributed ${d2Share}% of your constructor points.`,
    };
  } else if (chassisPower >= 93 && Math.min(d1Skill, d2Skill) < 86) {
    carryBadge = {
      type: 'car',
      label: 'CAR CARRIED',
      text: `The ${state.playerChassis?.name || 'chassis'} masked a weaker teammate.`,
    };
  }

  let summaryVerdict = 'Balanced Campaign';
  if (d1Share >= 75) {
    summaryVerdict = `🎒 Masterclass Carry: ${d1.name} shouldered ${d1Share}% of championship capital.`;
  } else if (d2Share >= 75) {
    summaryVerdict = `🎒 Masterclass Carry: ${d2.name} shouldered ${d2Share}% of championship capital.`;
  } else if ((state.recordCode?.dnfs || 0) > 5) {
    summaryVerdict =
      '⚠️ Reliability Crisis: Speed was there, but hardware DNFs burned points.';
  } else if ((state.recordCode?.wins || 0) >= 20) {
    summaryVerdict =
      '👑 Absolute Dominance: Elite historical synthesis out-paced the multiverse grid.';
  } else if (efficiencyPct >= 25) {
    summaryVerdict = `🧠 Master Strategist: You outperformed draft baseline by +${efficiencyPct}%.`;
  }

  const h2hWinner =
    d1.pointsScore === d2.pointsScore
      ? 'Dead heat'
      : d1.pointsScore > d2.pointsScore
        ? d1.name
        : d2.name;
  const h2hScore = `${d1.raceWinsVsTeammate || countBeats(state, 0)}-${d2.raceWinsVsTeammate || countBeats(state, 1)}`;

  return {
    driver1Share: d1Share,
    driver2Share: d2Share,
    headToHeadWinner: h2hWinner,
    headToHeadScore: h2hScore,
    totalLapsLed: (d1.lapsLed || 0) + (d2.lapsLed || 0),
    summaryVerdict,
    carryBadge,
    efficiencyPct,
    expectedPts,
    actualPts,
    draftBaseline: Math.round(draftBaseline),
    drivers: [d1, d2],
    masterStrategist: efficiencyPct >= 25,
  };
}

function shortName(d) {
  const year = d.year || d.name?.match(/\d{4}/)?.[0] || '';
  const name = (d.name || '').replace(/\s*\(\d{4}\)/, '').split(' ').pop();
  return `${name} '${String(year).slice(2)}`;
}

function countBeats(state, idx) {
  let n = 0;
  for (const race of state.raceLog || []) {
    const a = race.playerResults?.[idx];
    const b = race.playerResults?.[1 - idx];
    if (!a || !b) continue;
    if (a.dnf && b.dnf) continue;
    if (!a.dnf && (b.dnf || a.pos < b.pos)) n++;
  }
  return n;
}

export function emptySquad(state) {
  const mk = (d) => ({
    name: d ? `${d.name} (${d.year})` : '—',
    year: d?.year,
    pac: d?.pac || 80,
    pointsScore: 0,
    wins: 0,
    podiums: 0,
    fastLaps: 0,
    dnfs: 0,
    lapsLed: 0,
    raceWinsVsTeammate: 0,
  });
  return {
    drivers: [mk(state.playerDrivers?.[0]), mk(state.playerDrivers?.[1])],
    totalTeamPoints: 0,
  };
}

export function generateSquadSummaryCard(state, analytics, tournament = null) {
  const squad = state.squadStats;
  const d1 = squad.drivers[0];
  const d2 = squad.drivers[1];
  const tLine = tournament
    ? `\n🏟️ ${tournament.id} · Round ${tournament.round} · Rank #${tournament.playerRank}/${tournament.fieldSize} · ${tournament.playerPts} pts${tournament.gaffer ? ' (🧠 1.5×)' : ''}${tournament.advanced ? ' · ADVANCED ✓' : ' · CUT ✗'}`
    : '';

  return `🏎️ F1 MULTIVERSE: TOURNAMENT REVIEW 🏁
Team: ${state.teamName || 'Multiverse Racing'}
Constructor Points: ${squad.totalTeamPoints}
Tournament Score: ${tournament?.playerPts ?? squad.totalTeamPoints}
Record: ${state.recordCode.wins}-${state.recordCode.podiums}-${state.recordCode.losses + state.recordCode.dnfs}${tLine}

📊 SQUAD BREAKDOWN:
👑 Car: ${state.playerChassis.year} ${state.playerChassis.name}
👨‍✈️ Driver 1: ${d1.name}
   → Wins: ${d1.wins} | Podiums: ${d1.podiums} | FL: ${d1.fastLaps} | DNFs: ${d1.dnfs} | Pts: ${d1.pointsScore}
👨‍✈️ Driver 2: ${d2.name}
   → Wins: ${d2.wins} | Podiums: ${d2.podiums} | FL: ${d2.fastLaps} | DNFs: ${d2.dnfs} | Pts: ${d2.pointsScore}

${analytics.summaryVerdict}
H2H: ${analytics.headToHeadWinner} (${analytics.headToHeadScore})

Can you survive the Round 1 Cut? Play now!
${typeof window !== 'undefined' ? window.location.href : ''}`;
}

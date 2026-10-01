/**
 * Race Incident / Drama Engine — 30% chance per GP to disrupt 1-2 lockouts
 */

import { randInt, pickRandom, randomRange } from './data.js';

export const RACE_INCIDENTS = {
  safety_car: {
    id: 'safety_car',
    title: 'SAFETY CAR DEPLOYED',
    icon: '🚨',
    desc: 'The field bunches up! Massive leads wiped out — final-lap chaos incoming.',
    color: '#FFD700',
  },
  downpour: {
    id: 'downpour',
    title: 'SUDDEN DOWNPOUR',
    icon: '🌧️',
    desc: 'Rain hammers the circuit! Soft tires disintegrate. Wet specialists rise.',
    color: '#4FC3F7',
  },
  gremlin: {
    id: 'gremlin',
    title: 'MECHANICAL GREMLIN',
    icon: '⚙️',
    desc: 'Disaster for the leader! Reliability demons strike at the front.',
    color: '#E10600',
  },
};

/** 30% chance to trigger a global race incident */
export function rollRaceIncident() {
  if (Math.random() > 0.3) return null;
  const keys = Object.keys(RACE_INCIDENTS);
  return RACE_INCIDENTS[pickRandom(keys)];
}

/**
 * Apply incident effects to in-memory performance rows (pre-classification).
 * @param {Array} performances — sorted or unsorted race rows with score, dnf, wet, tireChoice
 * @param {object} incident
 * @param {object} playerStrategy — { tire, engine }
 */
export function applyRaceIncident(performances, incident, playerStrategy = {}) {
  if (!incident) return { performances, details: null };

  const finishers = performances.filter((p) => !p.dnf);
  const details = { incident, affected: [] };

  if (incident.id === 'safety_car') {
    const scores = finishers.map((p) => p.score);
    const mean = scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1);
    for (const p of finishers) {
      const before = p.score;
      p.score = mean + (p.score - mean) * 0.3;
      if (Math.abs(before - p.score) > 2) {
        details.affected.push({
          name: p.driverName,
          year: p.driverYear,
          note: 'Grid compressed',
        });
      }
    }
    details.headline = 'All gaps slashed — pack racing for the win!';
  }

  if (incident.id === 'downpour') {
    for (const p of finishers) {
      const onSoft = p.tireChoice === 'soft';
      const wetSkill = p.wet ?? 80;
      let mult = 1;
      if (onSoft) mult *= 0.6;
      if (wetSkill >= 95) mult *= 1.12;
      else if (wetSkill >= 90) mult *= 1.06;
      if (p.isPlayer && playerStrategy.engine === 'conserve') mult *= 1.05;
      const before = p.score;
      p.score *= mult;
      if (onSoft || wetSkill >= 90) {
        details.affected.push({
          name: p.driverName,
          year: p.driverYear,
          note: onSoft ? 'Soft tires destroyed' : 'Wet masterclass',
        });
      }
    }
    details.headline = 'Rain roulette — strategy pays or punishes instantly.';
  }

  if (incident.id === 'gremlin') {
    const leader = [...finishers].sort((a, b) => b.score - a.score)[0];
    if (leader) {
      const roll = randInt(1, 100);
      if (roll <= 35) {
        leader.dnf = true;
        leader.score = -999;
        leader.gremlinDnf = true;
        details.headline = `${leader.driverName} suffers catastrophic failure!`;
        details.affected.push({
          name: leader.driverName,
          year: leader.driverYear,
          note: 'DNF — mechanical failure',
        });
      } else {
        const drop = randomRange(18, 35);
        leader.score -= drop;
        details.headline = `${leader.driverName} loses ${Math.round(drop)} pace units!`;
        details.affected.push({
          name: leader.driverName,
          year: leader.driverYear,
          note: `Dropped ${Math.round(drop)} pts of pace`,
        });
      }
    }
  }

  performances.sort((a, b) => b.score - a.score);
  return { performances, details };
}

/** Random AI tire assignment for incident math */
export function assignAiTireChoice() {
  return Math.random() < 0.45 ? 'soft' : 'medium';
}

/**
 * localStorage persistence + trophy room + Multiverse badges
 */

import { TROPHY_DEFS } from './trophies.js';
import { SEASON_LENGTH } from './data.js';

const ACTIVE_KEY = 'f1mv_activeRunState';
const TROPHY_KEY = 'f1mv_trophyRoom';
const PROFILE_KEY = 'f1mv_profile';
const LEAGUE_KEY = 'f1mv_leagues';

export function saveState(state) {
  try {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(state));
  } catch (_) {}
}

export function loadState() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function clearActiveRun() {
  localStorage.removeItem(ACTIVE_KEY);
}

const TAB_KEY = 'f1mv_tab';

/** True when this browser tab was already open. A new visit after a close is false. */
export function tabStillOpen() {
  try {
    return sessionStorage.getItem(TAB_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function markTabOpen() {
  try {
    sessionStorage.setItem(TAB_KEY, '1');
  } catch (_) {}
}

export function namesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

const BEAT_KEY = 'f1mv_beat';

export function beatTab() {
  try {
    localStorage.setItem(BEAT_KEY, String(Date.now()));
  } catch (_) {}
}

export function markTabClosed() {
  try {
    localStorage.setItem(BEAT_KEY, '0');
  } catch (_) {}
}

/** A tab that was closed stops beating. A live tab refreshes the stamp every couple of seconds. */
export function tabLooksClosed(maxAgeMs = 2500) {
  try {
    const raw = Number(localStorage.getItem(BEAT_KEY) || 0);
    return !raw || Date.now() - raw > maxAgeMs;
  } catch (_) {
    return false;
  }
}

function defaultTrophyRoom() {
  return {
    bestRecord: null,
    bestWins: 0,
    flawlessCount: 0,
    seasonsPlayed: 0,
    mostDrafted: {},
    bestStreakLabel: '—',
    badges: {}, // id -> { unlockedAt, count }
  };
}

export function loadTrophyRoom() {
  try {
    const raw = localStorage.getItem(TROPHY_KEY);
    if (!raw) return defaultTrophyRoom();
    const data = JSON.parse(raw);
    if (!data.badges) data.badges = {};
    return data;
  } catch (_) {
    return defaultTrophyRoom();
  }
}

export function saveTrophyRoom(trophy) {
  try {
    localStorage.setItem(TROPHY_KEY, JSON.stringify(trophy));
  } catch (_) {}
}

export function unlockBadges(ids) {
  if (!ids?.length) return [];
  const trophy = loadTrophyRoom();
  const fresh = [];
  const now = Date.now();
  for (const id of ids) {
    if (!trophy.badges[id]) {
      trophy.badges[id] = { unlockedAt: now, count: 1 };
      fresh.push(id);
    } else {
      trophy.badges[id].count = (trophy.badges[id].count || 1) + 1;
    }
  }
  saveTrophyRoom(trophy);
  return fresh;
}

export function recordSeasonFinish(state) {
  const trophy = loadTrophyRoom();
  const rc = state.recordCode;
  trophy.seasonsPlayed = (trophy.seasonsPlayed || 0) + 1;

  if (rc.wins > (trophy.bestWins || 0)) {
    trophy.bestWins = rc.wins;
    trophy.bestRecord = { ...rc };
    trophy.bestStreakLabel = `${rc.wins}-${rc.podiums}-${rc.losses + rc.dnfs}`;
  }

  if (rc.wins === SEASON_LENGTH && rc.dnfs === 0 && rc.podiums === 0 && rc.losses === 0) {
    trophy.flawlessCount = (trophy.flawlessCount || 0) + 1;
  }

  const bump = (key) => {
    trophy.mostDrafted[key] = (trophy.mostDrafted[key] || 0) + 1;
  };
  if (state.playerChassis) bump(`${state.playerChassis.year} ${state.playerChassis.name}`);
  if (state.playerDrivers[0]) bump(`${state.playerDrivers[0].year} ${state.playerDrivers[0].name}`);
  if (state.playerDrivers[1]) bump(`${state.playerDrivers[1].year} ${state.playerDrivers[1].name}`);

  saveTrophyRoom(trophy);
  return trophy;
}

export function topDrafted(trophy, n = 3) {
  return Object.entries(trophy.mostDrafted || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (_) {}
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

export function loadLeagueScores(code) {
  try {
    const all = JSON.parse(localStorage.getItem(LEAGUE_KEY) || '{}');
    return all[String(code || '').toUpperCase()] || [];
  } catch (_) {
    return [];
  }
}

export function submitLeagueScore(code, entry) {
  const key = String(code || '').trim().toUpperCase();
  if (!key) return [];
  let all = {};
  try {
    all = JSON.parse(localStorage.getItem(LEAGUE_KEY) || '{}');
  } catch (_) {
    all = {};
  }
  const list = all[key] || [];
  list.push({ ...entry, submittedAt: Date.now() });
  all[key] = list.slice(-40);
  try {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(all));
  } catch (_) {}
  return all[key];
}

export function badgeProgress(trophy) {
  const unlocked = Object.keys(trophy.badges || {}).length;
  return { unlocked, total: TROPHY_DEFS.length, defs: TROPHY_DEFS, badges: trophy.badges || {} };
}

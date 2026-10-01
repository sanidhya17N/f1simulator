/**
 * TOURNAMENT CLASH MODE — static leaderboard + cut-line (no backend)
 * Separate from Solo Career loop. Scores stored in localStorage.
 */

const ROUND_META = {
  1: { name: 'THE ACCELERATION', field: 512, reSpins: 2, label: 'Round 1' },
  2: { name: 'THE PRESSURE', field: 256, reSpins: 1, label: 'Round 2' },
  3: { name: 'THE FINALS', field: 128, reSpins: 0, label: 'Round 3 · Finals' },
};

export const GAFFER_MULTIPLIER = 1.5;

/** Static demo field — replaced by localStorage entries when user submits */
export const STATIC_LEADERBOARD = [
  { name: 'VettelFan_9', squad: "Hamilton '18 / RB '23", points: 382, gaffer: false },
  { name: 'SimRacerX', squad: "Senna '93 / Merc '16", points: 379, gaffer: true },
  { name: 'BoxBoxBox', squad: "Prost '89 / Ferr '04", points: 371, gaffer: false },
  { name: 'Apex Predators', squad: "Verstappen '23 / McLaren '24", points: 368, gaffer: false },
  { name: 'Grid Ghosts', squad: "Alonso '12 / Will '19", points: 365, gaffer: true },
  { name: 'Pit Wall Mafia', squad: "Schumacher '02 / Ferrari '04", points: 358, gaffer: false },
  { name: 'DRS Train', squad: "Norris '24 / Red Bull '22", points: 352, gaffer: false },
  { name: 'Soft Compound', squad: "Hamilton '20 / Mercedes '20", points: 348, gaffer: true },
  { name: 'Kerbstone Kings', squad: "Vettel '11 / RB '13", points: 341, gaffer: false },
  { name: 'Parity Breakers', squad: "Räikkönen '07 / Lotus '85", points: 335, gaffer: false },
  { name: 'Undercut FC', squad: "Button '09 / Brawn '09", points: 328, gaffer: false },
  { name: 'Safety Car FC', squad: "Rosberg '16 / Mercedes '16", points: 322, gaffer: false },
];

const TOURNAMENT_SCORES_KEY = 'f1mv_tournamentScores';

export function loadTournamentScores() {
  try {
    const raw = localStorage.getItem(TOURNAMENT_SCORES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function submitTournamentScore(entry) {
  const list = loadTournamentScores();
  list.push({ ...entry, submittedAt: Date.now() });
  localStorage.setItem(TOURNAMENT_SCORES_KEY, JSON.stringify(list.slice(-20)));
  return list;
}

function daySeed(date = new Date()) {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTournamentId(date = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Daily_Clash_${months[date.getUTCMonth()]}${date.getUTCDate()}${date.getUTCFullYear()}`;
}

export function getRoundMeta(round = 1) {
  return ROUND_META[round] || ROUND_META[1];
}

export function tournamentPoints(rawPoints, gaffer = false) {
  return Math.round(rawPoints * (gaffer ? GAFFER_MULTIPLIER : 1));
}

/**
 * Merge static demo field with player submission for leaderboard render
 */
export function buildLeaderboardField(playerEntry = null, round = 1) {
  const meta = getRoundMeta(round);
  const seed = daySeed() + round * 997;
  const rng = mulberry32(seed);
  const mean = 320 - (round - 1) * 25;
  const spread = 90;

  let entries = [...STATIC_LEADERBOARD];
  while (entries.length < Math.min(24, meta.field - 1)) {
    const u = rng();
    const v = rng();
    const n = Math.sqrt(-2 * Math.log(Math.max(u, 1e-9))) * Math.cos(2 * Math.PI * v);
    entries.push({
      name: `Ghost_${entries.length}`,
      squad: 'Multiverse AI',
      points: Math.max(40, Math.round(mean + n * spread)),
      gaffer: rng() > 0.85,
    });
  }

  if (playerEntry) {
    entries.push({
      name: playerEntry.name || 'YOU',
      squad: playerEntry.squad || '—',
      points: playerEntry.points,
      isPlayer: true,
      gaffer: playerEntry.gaffer,
    });
  }

  entries.sort((a, b) => b.points - a.points);
  const cutIndex = Math.floor(meta.field / 2);

  let playerRank = playerEntry
    ? entries.findIndex((e) => e.isPlayer) + 1
    : null;
  let safetyDelta = 0;
  let safetyLabel = 'Enter Daily Clash to post a score and see your cut-line position.';

  if (playerEntry && playerRank) {
    const cutSeat = entries[cutIndex - 1];
    const firstOut = entries[cutIndex];
    const advanced = playerRank <= cutIndex;
    if (advanced) {
      safetyDelta = playerEntry.points - (firstOut?.points ?? 0);
      safetyLabel = `Safe by +${safetyDelta} pts above THE ELIMINATION ZONE`;
    } else {
      safetyDelta = (cutSeat?.points ?? 0) - playerEntry.points;
      safetyLabel = `Position: P${playerRank}. You need exactly +${Math.max(0, safetyDelta)} points to cross the cut-line!`;
    }
  }

  return {
    id: getTournamentId(),
    round,
    roundName: meta.name,
    fieldSize: meta.field,
    cutIndex,
    cutBanner: 'THE ELIMINATION ZONE (BOTTOM 50% CUT)',
    entries: entries.slice(0, 30),
    playerRank,
    advanced: playerRank ? playerRank <= cutIndex : null,
    safetyDelta,
    safetyLabel,
    playerPts: playerEntry?.points ?? null,
  };
}

/** @deprecated use buildLeaderboardField */
export function buildEliminationBoard(playerRawPoints, round = 1, teamName = 'You', gaffer = false) {
  return buildLeaderboardField(
    { name: teamName, points: tournamentPoints(playerRawPoints, gaffer), gaffer },
    round
  );
}

/**
 * HTML for tournament leaderboard component (static array render)
 */
function hashCode(str) {
  let h = 2166136261;
  for (const c of String(str || '')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

/** Private room: seeded ghost field plus scores saved on this device, including imported slips. */
export function buildPrivateLeague(code, localEntries = [], highlightName = '') {
  const room = String(code || 'PADDOCK').toUpperCase();
  const rng = mulberry32(hashCode(room));
  const ghosts = STATIC_LEADERBOARD.slice(0, 8).map((g, i) => ({
    name: g.name,
    squad: g.squad,
    points: 260 + Math.floor(rng() * 160) - i * 3,
    ghost: true,
  }));
  const players = localEntries.map((e) => ({
    name: e.name,
    squad: e.squad || '—',
    points: e.points,
    ghost: false,
    isPlayer: !!highlightName && e.name === highlightName,
  }));
  const entries = [...ghosts, ...players].sort((a, b) => b.points - a.points);
  const yourRank = highlightName
    ? entries.findIndex((e) => e.name === highlightName && !e.ghost) + 1
    : 0;
  return { code: room, entries: entries.slice(0, 24), yourRank: yourRank || null };
}

export function renderLeagueHTML(board) {
  if (!board?.entries?.length) {
    return '<p class="text-slate text-sm">Create a room code and run a season. Friends paste a result slip to appear here.</p>';
  }
  return board.entries
    .map(
      (e, i) => `
    <div class="stand-row ${e.isPlayer ? 'you' : ''}">
      <span class="mono">${i + 1}</span>
      <span class="stand-name">${e.name}<small>${e.squad || ''}</small></span>
      <span class="mono">${e.points}</span>
    </div>`
    )
    .join('');
}

export function formatResultSlip(code, name, points, squad) {
  return `F1MV|${String(code).toUpperCase()}|${name}|${points}|${squad}`;
}

export function parseResultSlip(text) {
  const parts = String(text || '').trim().split('|');
  if (parts.length < 5 || parts[0] !== 'F1MV') return null;
  const points = Number(parts[3]);
  if (!parts[1] || !parts[2] || Number.isNaN(points)) return null;
  return {
    code: parts[1].toUpperCase(),
    name: parts[2].slice(0, 18),
    points,
    squad: parts.slice(4).join('|').slice(0, 80),
  };
}

export function renderLeaderboardHTML(board) {
  const rows = [];
  const start = Math.max(0, (board.cutIndex || 12) - 4);
  const slice = board.entries.slice(start, start + 12);

  slice.forEach((e, i) => {
    const rank = board.entries.indexOf(e) + 1;
    if (rank === (board.cutIndex || 0) + 1) {
      rows.push(`<div class="cut-line-banner pulse">${board.cutBanner}</div>`);
    }
    rows.push(`
      <div class="lb-row ${e.isPlayer ? 'you' : ''} ${rank > board.cutIndex ? 'eliminated' : ''}">
        <span class="mono w-10">${rank}</span>
        <span class="flex-1 truncate">${e.isPlayer ? 'YOU' : e.name}${e.gaffer ? ' 🧠' : ''}</span>
        <span class="hidden sm:inline text-slate text-xs truncate max-w-[8rem]">${e.squad || ''}</span>
        <span class="mono w-14 text-right">${e.points}</span>
      </div>`);
  });

  return `
    <div class="tournament-board">
      <div class="lb-head">
        <span>POS</span><span>PLAYER</span><span class="hidden sm:block">SQUAD</span><span>PTS</span>
      </div>
      <div class="bubble-delta ${board.advanced ? 'safe' : board.advanced === false ? 'danger' : ''}">
        ⚠️ ${board.safetyLabel}
      </div>
      <div class="lb-body">${rows.join('')}</div>
      ${board.playerRank ? `<p class="lb-footer ${board.advanced ? 'text-cyan' : 'text-f1red'}">Rank #${board.playerRank} / ${board.fieldSize}</p>` : ''}
    </div>`;
}

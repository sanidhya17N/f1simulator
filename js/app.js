/**
 * F1 Multiverse — UI controller
 */

import {
  createSoloState,
  createTournamentState,
  syncGameState,
  spinConstructor,
  spinPrincipal,
  spinDriverPool,
  generateMultiverseGrid,
  computeQualifying,
  computeRaceFromGrid,
  applyRaceResult,
  GRID_CALLS,
  SESSION_HOLD_MS,
  applyUpgrade,
  skipOptionalDriverSwap,
  CALENDAR_24,
  SEASON_LENGTH,
  generateUpgradeOptions,
  SAVE_VERSION,
  DEFAULT_STRATEGY,
  MAX_TEAM_POINTS_PER_RACE,
  UI_ENGINE_OPTIONS,
  strategiesForTrack,
  planForRole,
} from './gameEngine.js';
import {
  saveState,
  loadState,
  clearActiveRun,
  loadTrophyRoom,
  recordSeasonFinish,
  topDrafted,
  unlockBadges,
  badgeProgress,
  loadProfile,
  saveProfile,
  clearProfile,
  loadLeagueScores,
  submitLeagueScore,
  namesMatch,
  tabStillOpen,
  markTabOpen,
  beatTab,
  markTabClosed,
  tabLooksClosed,
} from './storage.js';
import { driverSkill } from './data.js';
import {
  compileSeasonAnalytics,
  generateSquadSummaryCard,
} from './analytics.js';
import {
  buildLeaderboardField,
  renderLeaderboardHTML,
  submitTournamentScore,
  tournamentPoints,
  getTournamentId,
  getRoundMeta,
  makeRoomCode,
  buildPrivateLeague,
  renderLeagueHTML,
  formatResultSlip,
  parseResultSlip,
} from './tournament.js';
import { TROPHY_DEFS, evaluateTrophies } from './trophies.js';

let state = null;
let profile = null;
let spinBusy = false;
let racePlaying = false;
let weekendToken = 0;
/** landing | login | hub | multi | profile | tournament-board | game */
let uiView = 'landing';
let pendingCallsign = null;
let fastWeekend = false;
let upgradeHold = null;
let pitFeed = [];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function isGaffer() {
  return state?.mode === 'gaffer' || state?.mode === 'knowledge';
}
function isSolo() {
  return state?.playMode === 'solo';
}
function isTournament() {
  return state?.playMode === 'tournament';
}
function isRacingPhase() {
  return state?.phase?.endsWith('-racing');
}
function isDraftPhase() {
  return state?.phase?.endsWith('-draft');
}
function isFinalePhase() {
  return state?.phase?.endsWith('-finale');
}

function migratePhase(s) {
  if (!s.playMode) {
    s.playMode = s.tournamentRound > 1 ? 'tournament' : 'solo';
  }
  const map = {
    draft: `${s.playMode}-draft`,
    preview: `${s.playMode}-preview`,
    racing: `${s.playMode}-racing`,
    upgrade: `${s.playMode}-upgrade`,
    finale: `${s.playMode}-finale`,
  };
  if (map[s.phase]) s.phase = map[s.phase];
  if (!s.raceWeekendUI) s.raceWeekendUI = 'strategy';
  if (s.raceWeekendUI === 'running' || s.raceWeekendUI === 'qualifying' || s.raceWeekendUI === 'grid-call') {
    s.raceWeekendUI = 'strategy';
  }
  if (!s.pendingStrategy) s.pendingStrategy = { ...DEFAULT_STRATEGY };
  s.version = SAVE_VERSION;
  if (Array.isArray(s.fullGrid)) {
    for (const car of s.fullGrid) delete car.isBoss;
  }
  return s;
}

function stampTeam(s) {
  if (profile?.callsign) s.teamName = `${profile.callsign} Racing`;
  return s;
}

function init() {
  profile = loadProfile();
  const refresh = tabStillOpen();
  markTabOpen();
  if (refresh) beatTab();

  const saved = loadState();
  const savedMode = localStorage.getItem('f1mv_mode') || 'classic';
  if (savedMode === 'knowledge') localStorage.setItem('f1mv_mode', 'gaffer');

  const abandoned = !refresh && saved && tabLooksClosed();
  if (abandoned) clearActiveRun();

  const holdingFinale = saved?.raceWeekendUI === 'awaiting_season_end';
  const usable =
    !abandoned &&
    saved &&
    saved.version === SAVE_VERSION &&
    saved.phase &&
    (holdingFinale || (!saved.phase.endsWith('-finale') && !saved.seasonComplete));

  if (usable) {
    state = migratePhase(saved);
    syncGameState(state);
    if (state.phase.endsWith('-upgrade')) {
      state.upgradeOptions = generateUpgradeOptions(state);
    }
  } else {
    if (saved && !abandoned) clearActiveRun();
    state = null;
  }

  beatTab();
  uiView = 'landing';
  bindGlobal();
  setInterval(beatTab, 1500);
  window.addEventListener('pagehide', () => markTabClosed());
  render();
}

function commitCallsign(callsign, wipeSeason) {
  if (wipeSeason) {
    clearActiveRun();
    weekendToken++;
    racePlaying = false;
    state = null;
  }
  profile = { callsign, createdAt: profile?.createdAt || Date.now() };
  saveProfile(profile);
  if (state) stampTeam(state);
  pendingCallsign = null;
  uiView = state && !state.seasonComplete ? 'game' : 'hub';
  render();
}

function openLogin() {
  pendingCallsign = null;
  $('#callsign-warning')?.classList.add('hidden');
  $('#login-form')?.classList.remove('hidden');
  const input = $('#callsign-input');
  if (input) input.value = '';
  uiView = 'login';
  render();
}

function startPlaying() {
  if (!profile) {
    openLogin();
    return;
  }
  if (state && (!state.seasonComplete || state.raceWeekendUI === 'awaiting_season_end')) {
    uiView = 'game';
    render();
    return;
  }
  uiView = 'hub';
  render();
}

function persist() {
  if (state) syncGameState(state);
  saveState(state);
}

function bindGlobal() {
  console.log('Binding global event listeners...');
  
  $('#login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const callsign = $('#callsign-input')?.value.trim().slice(0, 16);
    if (!callsign || callsign.length < 2) return;
    if (profile && !namesMatch(profile.callsign, callsign) && state && !state.seasonComplete) {
      pendingCallsign = callsign;
      const copy = $('#callsign-warning-copy');
      if (copy) {
        copy.textContent = `${profile.callsign} has a season on this browser. Switching to ${callsign} deletes that season. Trophies on this device stay.`;
      }
      $('#login-form')?.classList.add('hidden');
      $('#callsign-warning')?.classList.remove('hidden');
      return;
    }
    commitCallsign(callsign, false);
  });

  $('#btn-confirm-switch')?.addEventListener('click', () => {
    if (!pendingCallsign) return;
    commitCallsign(pendingCallsign, true);
  });
  $('#btn-cancel-switch')?.addEventListener('click', () => openLogin());
  $('#btn-start-playing')?.addEventListener('click', () => startPlaying());
  $('#btn-switch-callsign')?.addEventListener('click', () => openLogin());
  $('#btn-quick-result')?.addEventListener('click', () => {
    if (racePlaying) return;
    $('#quick-sim')?.classList.toggle('hidden');
  });
  $$('#quick-sim [data-sim]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('#quick-sim')?.classList.add('hidden');
      simulateRest(btn.dataset.sim);
    });
  });

  $('#nav-home')?.addEventListener('click', () => openLanding());
  $('#nav-multi')?.addEventListener('click', () => openMulti());
  $('#nav-profile')?.addEventListener('click', () => openProfile());
  $('#btn-open-multi')?.addEventListener('click', () => openMulti());
  $('#btn-multi-home')?.addEventListener('click', () => openLanding());
  $('#btn-profile-home')?.addEventListener('click', () => openLanding());

  $('#btn-continue')?.addEventListener('click', () => {
    if (!state) return;
    uiView = 'game';
    render();
  });

  $('#btn-solo-career')?.addEventListener('click', () => {
    const mode = localStorage.getItem('f1mv_mode') || 'classic';
    state = stampTeam(createSoloState(mode === 'gaffer' ? 'gaffer' : mode));
    uiView = 'game';
    render();
  });

  $('#btn-tournament-clash')?.addEventListener('click', () => {
    uiView = 'tournament-board';
    renderTournamentBoard();
    render();
  });

  $('#btn-make-room')?.addEventListener('click', () => {
    const code = makeRoomCode();
    $('#room-code').value = code;
    localStorage.setItem('f1mv_lastRoom', code);
    paintRoom(code);
  });
  $('#btn-view-room')?.addEventListener('click', () => {
    const code = ($('#room-code').value || '').trim().toUpperCase();
    if (code.length < 3) return;
    localStorage.setItem('f1mv_lastRoom', code);
    paintRoom(code);
  });
  $('#btn-join-room')?.addEventListener('click', () => {
    const code = ($('#room-code').value || localStorage.getItem('f1mv_lastRoom') || '').trim().toUpperCase();
    if (code.length < 3) {
      showToast('Enter a room code, or tap New.');
      return;
    }
    const mode = localStorage.getItem('f1mv_mode') || 'classic';
    state = stampTeam(createSoloState(mode === 'gaffer' ? 'gaffer' : mode));
    state.leagueCode = code;
    localStorage.setItem('f1mv_lastRoom', code);
    uiView = 'game';
    render();
  });
  $('#btn-import-slip')?.addEventListener('click', () => {
    const parsed = parseResultSlip($('#slip-input')?.value || '');
    if (!parsed) {
      showToast('That slip needs the form F1MV|CODE|NAME|POINTS|SQUAD.');
      return;
    }
    submitLeagueScore(parsed.code, parsed);
    $('#room-code').value = parsed.code;
    localStorage.setItem('f1mv_lastRoom', parsed.code);
    $('#slip-input').value = '';
    paintRoom(parsed.code);
    showToast(`${parsed.name} added to room ${parsed.code}.`);
  });
  $('#btn-sign-out')?.addEventListener('click', () => {
    clearProfile();
    profile = null;
    weekendToken++;
    racePlaying = false;
    uiView = 'landing';
    render();
  });

  $('#btn-back-hub')?.addEventListener('click', () => openMulti());
  $('#btn-start-clash')?.addEventListener('click', () => {
    const mode = localStorage.getItem('f1mv_mode') || 'classic';
    state = stampTeam(createTournamentState(mode === 'gaffer' ? 'gaffer' : mode, 1));
    uiView = 'game';
    render();
  });

  $('#btn-restart')?.addEventListener('click', () => askRestart());
  $('#btn-side-restart')?.addEventListener('click', () => askRestart());
  $('#btn-restart-no')?.addEventListener('click', () => {
    $('#restart-confirm')?.classList.add('hidden');
  });
  $('#btn-restart-yes')?.addEventListener('click', () => {
    if (!state) return;
    $('#restart-confirm')?.classList.add('hidden');
    clearUpgradeHold();
    weekendToken++;
    racePlaying = false;
    clearActiveRun();
    const mode = state?.mode || localStorage.getItem('f1mv_mode') || 'classic';
    if (isTournament()) {
      state = stampTeam(createTournamentState(mode, state.tournamentRound || 1));
    } else {
      const league = state?.leagueCode;
      state = stampTeam(createSoloState(mode));
      if (league) state.leagueCode = league;
    }
    uiView = 'game';
    persist();
    render();
  });

  $('#mode-classic')?.addEventListener('click', () => setMode('classic'));
  $('#mode-gaffer')?.addEventListener('click', () => setMode('gaffer'));

  $('#btn-trophies')?.addEventListener('click', openTrophyRoom);
  $('#btn-close-trophies')?.addEventListener('click', () => {
    $('#trophy-modal').classList.add('hidden');
  });
  $('#trophy-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'trophy-modal') $('#trophy-modal').classList.add('hidden');
  });

  $('#btn-feedback')?.addEventListener('click', () => {
    $('#feedback-modal')?.classList.remove('hidden');
  });
  $('#btn-cancel-feedback')?.addEventListener('click', () => {
    $('#feedback-modal')?.classList.add('hidden');
  });
  $('#feedback-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'feedback-modal') $('#feedback-modal').classList.add('hidden');
  });
  $('#btn-submit-feedback')?.addEventListener('click', submitFeedback);
}

function clearUpgradeHold() {
  if (upgradeHold) clearInterval(upgradeHold);
  upgradeHold = null;
}

function askRestart() {
  if (spinBusy || !state || uiView !== 'game') return;
  $('#restart-confirm')?.classList.remove('hidden');
}

function goHub() {
  clearActiveRun();
  state = null;
  uiView = profile ? 'hub' : 'login';
  render();
}

function openLanding() {
  clearUpgradeHold();
  weekendToken++;
  racePlaying = false;
  if (state && (state.raceWeekendUI === 'qualifying' || state.raceWeekendUI === 'running')) {
    state.raceWeekendUI = 'strategy';
  }
  uiView = 'landing';
  render();
}

function openHub() {
  if (!profile) {
    uiView = 'login';
    render();
    return;
  }
  weekendToken++;
  racePlaying = false;
  uiView = 'hub';
  render();
}

function openMulti() {
  if (!profile) {
    uiView = 'login';
    render();
    return;
  }
  weekendToken++;
  racePlaying = false;
  uiView = 'multi';
  const last = localStorage.getItem('f1mv_lastRoom') || '';
  const input = $('#room-code');
  if (input && !input.value) input.value = last;
  render();
  if (input?.value) paintRoom(input.value);
}

function openProfile() {
  if (!profile) {
    uiView = 'login';
    render();
    return;
  }
  weekendToken++;
  racePlaying = false;
  uiView = 'profile';
  render();
}

function paintRoom(code) {
  const board = buildPrivateLeague(code, loadLeagueScores(code), profile?.callsign || '');
  const el = $('#room-board');
  if (!el) return;
  el.innerHTML = `<p class="text-xs text-slate mb-2">Room ${board.code}${board.yourRank ? ` · you are P${board.yourRank}` : ''}</p>${renderLeagueHTML(board)}`;
}

function setMode(mode) {
  if (!isDraftPhase()) return;
  state.mode = mode;
  localStorage.setItem('f1mv_mode', mode);
  render();
}

function submitFeedback() {
  const feedback = $('#feedback-text')?.value.trim();
  if (!feedback) {
    showToast('Please enter your feedback.');
    return;
  }

  const mailtoLink = `mailto:sanidhyawork17@gmail.com?subject=F1 Multiverse Feedback&body=${encodeURIComponent(feedback)}`;
  window.location.href = mailtoLink;

  $('#feedback-modal')?.classList.add('hidden');
  $('#feedback-text').value = '';
  showToast('Opening email client...');
}

function renderTournamentBoard(playerEntry = null) {
  const board = buildLeaderboardField(playerEntry, 1);
  $('#tournament-id-label').textContent = `${board.id} · ${board.roundName}`;
  $('#tournament-leaderboard').innerHTML = renderLeaderboardHTML(board);
}

function showToast(msg) {
  const stack = $('#toast-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function openTrophyRoom() {
  const trophy = loadTrophyRoom();
  const prog = badgeProgress(trophy);
  $('#trophy-progress').textContent = `${prog.unlocked} / ${prog.total} unlocked`;
  $('#trophy-grid').innerHTML = TROPHY_DEFS.map((t) => {
    const got = !!prog.badges[t.id];
    return `<div class="trophy-card ${got ? 'unlocked' : 'locked'}">
      <span class="t-icon">${t.icon}</span>
      <strong>${got ? t.name : '???'}</strong>
      <p>${got ? t.desc : 'Keep drafting to unlock…'}</p>
    </div>`;
  }).join('');
  $('#trophy-modal').classList.remove('hidden');
}

function render() {
  const trophy = loadTrophyRoom();
  const best = trophy.bestStreakLabel || '—';
  const bestEl = $('#best-streak');
  if (bestEl) bestEl.textContent = best === '—' ? '—' : best;

  const modeBar = $('#mode-bar');
  const inGame = uiView === 'game' && state;
  if (modeBar) modeBar.classList.toggle('hidden', !inGame || !isDraftPhase());
  $('#mode-classic')?.classList.toggle('active', !isGaffer());
  $('#mode-gaffer')?.classList.toggle('active', isGaffer());

  const gafferBanner = $('#gaffer-banner');
  if (gafferBanner) gafferBanner.classList.toggle('hidden', !inGame || !isGaffer());

  const onRaceBoard = inGame && (isRacingPhase() || holdingResult());
  document.body.classList.toggle('play-wide', onRaceBoard);
  const restart = $('#btn-restart');
  if (restart) restart.classList.toggle('hidden', !inGame || onRaceBoard);
  if (!inGame) $('#restart-confirm')?.classList.add('hidden');

  const note = $('#landing-note');
  const switchBtn = $('#btn-switch-callsign');
  if (note) {
    if (!profile) note.textContent = 'Start playing asks for a callsign. It stays on this browser.';
    else if (state && state.raceWeekendUI === 'awaiting_season_end') {
      note.textContent = `Signed in as ${profile.callsign}. The final table is ready.`;
    } else if (state && !state.seasonComplete) {
      note.textContent = `Signed in as ${profile.callsign}. Start playing returns to the season.`;
    } else note.textContent = `Signed in as ${profile.callsign}.`;
  }
  switchBtn?.classList.toggle('hidden', !profile);

  const hr = $('#header-round');
  if (hr) {
    if (uiView === 'login') hr.textContent = 'Sign in';
    else if (uiView === 'landing') hr.textContent = profile ? profile.callsign : 'Paddock';
    else if (!inGame) hr.textContent = profile ? profile.callsign : 'Paddock';
    else if (state.leagueCode) hr.textContent = `Room ${state.leagueCode}`;
    else if (isSolo()) hr.textContent = 'Solo Career';
    else hr.textContent = `${getRoundMeta(state.tournamentRound || 1).label} OF 3`;
  }

  const greet = $('#hub-greeting');
  if (greet && profile) greet.textContent = profile.callsign;
  const cont = $('#btn-continue');
  if (cont) {
    const midSeason = !!(state && !state.seasonComplete && uiView !== 'game');
    cont.classList.toggle('hidden', !state || state.seasonComplete);
    const blurb = $('#continue-blurb');
    if (blurb && state) {
      blurb.textContent = state.playerChassis
        ? `${state.teamName} · race ${Math.min((state.currentRaceIndex || 0) + 1, SEASON_LENGTH)} of ${SEASON_LENGTH}`
        : `${state.teamName} · still in the draft`;
    }
    if (!midSeason && uiView === 'game') cont.classList.add('hidden');
  }

  const draftHint = $('#screen-draft p');
  if (draftHint && inGame && isDraftPhase()) {
    draftHint.textContent = isSolo()
      ? isGaffer()
        ? 'Solo Career · Gaffer Mode (stats hidden). Draft your garage.'
        : `Solo Career · Draft chassis, drivers, principal. Chase ${SEASON_LENGTH}-0.`
      : isGaffer()
        ? `Tournament Clash · Gaffer (1.5× pts). Re-spins: ${state.reSpinTokens}.`
        : `Tournament Clash · ${getRoundMeta(state.tournamentRound).name}. Re-spins: ${state.reSpinTokens}.`;
  }

  if (inGame) $('#tokens-display').textContent = state.reSpinTokens;
  showScreen();

  if (uiView === 'finale' && state) {
    renderFinale();
    return;
  }
  

  if (!inGame) return;
  if (holdingResult()) renderRacing();
  else if (isDraftPhase()) renderDraft();
  else if (state.phase.endsWith('-preview')) renderPreview();
  else if (isRacingPhase()) renderRacing();
  else if (state.phase.endsWith('-upgrade')) renderUpgrade();
  else if (isFinalePhase()) renderFinale();
}

function showScreen() {
  $$('.screen').forEach((el) => el.classList.add('hidden'));
  if (uiView === 'landing') {
    $('#screen-landing')?.classList.remove('hidden');
    return;
  }
  if (uiView === 'login') {
    $('#screen-login')?.classList.remove('hidden');
    const lead = $('#screen-login .login-lead');
    if (lead) {
      lead.textContent = profile
        ? `This browser is signed in as ${profile.callsign}. The same callsign continues the season. A new one replaces it.`
        : 'A callsign is your name on the timing tower and in multiplayer rooms. It stays on this device.';
    }
    return;
  }
  if (uiView === 'hub') {
    $('#screen-hub')?.classList.remove('hidden');
    return;
  }
  if (uiView === 'multi') {
    $('#screen-multi')?.classList.remove('hidden');
    return;
  }
  if (uiView === 'profile') {
    $('#screen-profile')?.classList.remove('hidden');
    renderProfile();
    return;
  }
  if (uiView === 'tournament-board') {
    $('#screen-tournament-board')?.classList.remove('hidden');
    return;
  }

  if (uiView === 'finale') {
    $('#screen-finale')?.classList.remove('hidden');
    return;
  }
  if (holdingResult()) {
    $('#screen-racing')?.classList.remove('hidden');
    return;
  }
  const suffix = state?.phase?.split('-').slice(1).join('-') || 'draft';
  const map = {
    draft: '#screen-draft',
    preview: '#screen-preview',
    racing: '#screen-racing',
    upgrade: '#screen-upgrade',
    finale: '#screen-finale',
  };
  $(map[suffix] || '#screen-draft')?.classList.remove('hidden');
}

/* ───────── DRAFT ───────── */

function renderProfile() {
  const trophy = loadTrophyRoom();
  const prog = badgeProgress(trophy);
  const card = $('#profile-card');
  if (!card || !profile) return;
  card.innerHTML = `
    <p class="kicker">Callsign</p>
    <h3 class="text-3xl font-extrabold mb-3">${profile.callsign}</h3>
    <div class="profile-stat"><span>Seasons</span><strong>${trophy.seasonsPlayed || 0}</strong></div>
    <div class="profile-stat"><span>Best record</span><strong>${trophy.bestStreakLabel || '—'}</strong></div>
    <div class="profile-stat"><span>Flawless ${SEASON_LENGTH}-0</span><strong>${trophy.flawlessCount || 0}</strong></div>
    <div class="profile-stat"><span>Trophies</span><strong>${prog.unlocked} / ${prog.total}</strong></div>
    <p class="mt-3 text-sm text-slate">Open the medal in the header for the full cabinet. Daily lobby and private rooms post under this callsign.</p>
  `;
}

function renderDraft() {
  const slots = [
    { key: 'chassis', label: '+ CHASSIS', filled: state.playerChassis, render: (c) => `${c.year} ${c.name}` },
    { key: 'driver1', label: '+ DRIVER 1', filled: state.playerDrivers[0], render: (d) => `${d.year} ${d.name}` },
    { key: 'driver2', label: '+ DRIVER 2', filled: state.playerDrivers[1], render: (d) => `${d.year} ${d.name}` },
    { key: 'principal', label: '+ PRINCIPAL', filled: state.playerPrincipal, render: (p) => `${p.year} ${p.name}` },
  ];

  const grid = $('#draft-slots');
  grid.innerHTML = slots
    .map((s) => {
      const locked = !!s.filled;
      const active =
        (!state.playerChassis && s.key === 'chassis') ||
        (state.playerChassis && !state.playerDrivers[0] && s.key === 'driver1') ||
        (state.playerDrivers[0] && !state.playerDrivers[1] && s.key === 'driver2') ||
        (state.playerDrivers[1] && !state.playerPrincipal && s.key === 'principal');

      return `
      <button type="button" class="slot-card ${locked ? 'filled' : ''} ${active ? 'active' : ''}" data-slot="${s.key}" ${!active && !locked ? 'disabled' : ''}>
        <span class="slot-label">${s.label}</span>
        ${
          locked
            ? `<span class="slot-value">${s.render(s.filled)}</span>
               ${!isGaffer() && s.key === 'chassis' ? statsRowChassis(s.filled) : ''}
               ${!isGaffer() && (s.key === 'driver1' || s.key === 'driver2') ? statsRowDriver(s.filled) : ''}
               ${!isGaffer() && s.key === 'principal' ? `<span class="slot-meta">TAC ${s.filled.tac} · RND ${s.filled.rnd}</span>` : ''}`
            : `<span class="slot-hint">${active ? 'TAP TO SPIN' : 'LOCKED'}</span>`
        }
      </button>`;
    })
    .join('');

  $$('.slot-card', grid).forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled || spinBusy) return;
      const slot = btn.dataset.slot;
      if (btn.classList.contains('filled')) return;
      openSpinModal(slot);
    });
  });
}

function statsRowChassis(c) {
  return `<span class="slot-stats"><i>AERO ${c.aero}</i><i>ENG ${c.eng}</i><i>REL ${c.rel}</i></span>`;
}
function statsRowDriver(d) {
  return `<span class="slot-stats"><i>PAC ${d.pac}</i><i>RAC ${d.rac}</i><i>WET ${d.wet}</i><i>CON ${d.con}</i></span>`;
}

function openSpinModal(slot) {
  const modal = $('#spin-modal');
  modal.classList.remove('hidden');
  $('#spin-result').classList.add('hidden');
  $('#spin-cycling').classList.remove('hidden');
  $('#spin-actions').classList.add('hidden');

  const cycling = $('#spin-cycling');
  let ticks = 0;
  const maxTicks = 18;
  spinBusy = true;

  const interval = setInterval(() => {
    ticks++;
    if (slot === 'chassis') {
      const c = spinConstructor();
      cycling.innerHTML = `<div class="cycle-line">${c.year}</div><div class="cycle-name" style="color:${c.color}">${c.name}</div>`;
    } else if (slot === 'principal') {
      const p = spinPrincipal();
      cycling.innerHTML = `<div class="cycle-line">${p.year}</div><div class="cycle-name">${p.name}</div><div class="cycle-sub">${p.team}</div>`;
    } else {
      const { constructor: c } = spinDriverPool();
      cycling.innerHTML = `<div class="cycle-line">${c.year} ${c.name}</div><div class="cycle-name">Unlocking roster…</div>`;
    }
    if (ticks >= maxTicks) {
      clearInterval(interval);
      settleSpin(slot);
    }
  }, 70);
}

function settleSpin(slot) {
  const cycling = $('#spin-cycling');
  const result = $('#spin-result');
  const actions = $('#spin-actions');
  cycling.classList.add('hidden');
  result.classList.remove('hidden');
  actions.classList.remove('hidden');

  let payload;

  if (slot === 'chassis') {
    const c = spinConstructor();
    payload = { type: 'chassis', data: c };
    result.innerHTML = cardChassis(c);
  } else if (slot === 'principal') {
    const p = spinPrincipal();
    payload = { type: 'principal', data: p };
    result.innerHTML = cardPrincipal(p);
  } else {
    const spun = spinDriverPool();
    payload = { type: slot, data: spun };
    const carAvg = Math.round((spun.constructor.aero + spun.constructor.eng + spun.constructor.rel) / 3);
    const carQuality = carAvg >= 92 ? 'elite' : carAvg >= 85 ? 'good' : carAvg >= 78 ? 'average' : 'struggler';
    
    result.innerHTML = `
      <div class="trade-card">
        <div class="trade-header">
          <span class="dot" style="background:${spun.constructor.color}"></span> 
          ${spun.constructor.name.toUpperCase()}
          <span class="quality-badge ${carQuality}">${carQuality.toUpperCase()}</span>
        </div>
        <div class="trade-season">SEASON: ${spun.constructor.year} — pick one</div>
        <div class="roster-pick" id="roster-pick">
          ${spun.roster
            .map(
              (d, i) => {
                const driverAvg = Math.round((d.pac + d.rac + d.wet + d.con) / 4);
                const synergy = Math.abs(carAvg - driverAvg);
                const synergyClass = synergy <= 5 ? 'perfect' : synergy <= 10 ? 'good' : synergy <= 15 ? 'okay' : 'poor';
                const driverQuality = driverAvg >= 92 ? 'elite' : driverAvg >= 85 ? 'good' : driverAvg >= 78 ? 'average' : 'struggler';
                return `
            <button type="button" class="roster-btn rarity-glow ${driverQuality}" data-idx="${i}">
              <span>${d.year} ${d.name}</span>
              ${
                !isGaffer()
                  ? `<span class="mono">
                      <span data-tooltip="Pace - Raw speed and qualifying performance">PAC${d.pac}</span> 
                      <span data-tooltip="Racecraft - Overtaking and race management">RAC${d.rac}</span> 
                      <span data-tooltip="Wet Weather - Rain performance and adaptability">WET${d.wet}</span> 
                      <span data-tooltip="Consistency - Reliability and mistake avoidance">CON${d.con}</span> · 
                      <span data-tooltip="Overall driver rating">${driverSkill(d)}</span>
                     </span>
                     <span class="synergy-indicator ${synergyClass}" data-tooltip="Car-Driver Synergy: ${synergy <= 5 ? 'Perfect Match' : synergy <= 10 ? 'Good Fit' : synergy <= 15 ? 'Okay' : 'Poor Match'}">${synergy <= 5 ? '🎯' : synergy <= 10 ? '✓' : synergy <= 15 ? '~' : '⚠'}</span>`
                  : `<span class="mono">???</span>`
              }
            </button>`;
              }
            )
            .join('')}
        </div>
      </div>`;
    let selectedIdx = null;
    $$('.roster-btn', result).forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.roster-btn', result).forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedIdx = +btn.dataset.idx;
        payload.selected = spun.roster[selectedIdx];
        $('#btn-choose').disabled = false;
      });
    });
  }

  const chooseBtn = $('#btn-choose');
  const respinBtn = $('#btn-respin');
  chooseBtn.disabled = slot === 'driver1' || slot === 'driver2';
  chooseBtn.textContent = 'CHOOSE';
  respinBtn.textContent = `RE-SPIN (${state.reSpinTokens})`;
  respinBtn.disabled = state.reSpinTokens <= 0;

  chooseBtn.onclick = () => {
    if (slot === 'chassis') {
      state.playerChassis = payload.data;
      state.draftStep = 'driver1';
    } else if (slot === 'principal') {
      state.playerPrincipal = payload.data;
      finishDraft();
      closeModal();
      spinBusy = false;
      persist();
      render();
      return;
    } else {
      if (!payload.selected) return;
      if (slot === 'driver1') {
        state.playerDrivers[0] = payload.selected;
        state.draftStep = 'driver2';
      } else {
        state.playerDrivers[1] = payload.selected;
        state.draftStep = 'principal';
      }
    }
    closeModal();
    spinBusy = false;
    persist();
    render();
  };

  respinBtn.onclick = () => {
    if (state.reSpinTokens <= 0 || spinBusy) return;
    state.reSpinTokens--;
    persist();
    $('#tokens-display').textContent = state.reSpinTokens;
    result.classList.add('hidden');
    actions.classList.add('hidden');
    cycling.classList.remove('hidden');
    openSpinModal(slot);
  };

  spinBusy = false;
}

function finishDraft() {
  generateMultiverseGrid(state);
  state.phase = isSolo() ? 'solo-preview' : 'tournament-preview';
  syncGameState(state);
  persist();
}

function closeModal() {
  $('#spin-modal').classList.add('hidden');
}

function cardChassis(c) {
  const carAvg = Math.round((c.aero + c.eng + c.rel) / 3);
  const carQuality = carAvg >= 92 ? 'elite' : carAvg >= 85 ? 'good' : carAvg >= 78 ? 'average' : 'struggler';
  
  return `
    <div class="trade-card rarity-glow ${carQuality}">
      <div class="trade-header">
        <span class="dot" style="background:${c.color}"></span> 
        ${c.name.toUpperCase()}
        <span class="quality-badge ${carQuality}">${carQuality.toUpperCase()}</span>
      </div>
      <div class="trade-season">SEASON: ${c.year}</div>
      ${
        !isGaffer()
          ? `<div class="stat-pills">
              <span data-tooltip="Aerodynamics - Downforce and cornering speed">AERO: ${c.aero}</span>
              <span data-tooltip="Engine Power - Straight-line speed and acceleration">ENG: ${c.eng}</span>
              <span data-tooltip="Reliability - DNF resistance and mechanical durability">REL: ${c.rel}</span>
            </div>`
          : `<div class="stat-pills muted"><span>Stats hidden</span></div>`
      }
    </div>`;
}

function cardPrincipal(p) {
  const avgRating = Math.round((p.tac + p.rnd) / 2);
  const quality = avgRating >= 90 ? 'elite' : avgRating >= 85 ? 'good' : avgRating >= 80 ? 'average' : 'struggler';
  
  return `
    <div class="trade-card rarity-glow ${quality}">
      <div class="trade-header">
        <span class="dot"></span> 
        ${p.name.toUpperCase()}
        <span class="quality-badge ${quality}">${quality.toUpperCase()}</span>
      </div>
      <div class="trade-season">SEASON: ${p.year} · ${p.era || p.team}</div>
      ${
        !isGaffer()
          ? `<div class="stat-pills">
              <span data-tooltip="Tactics - Race strategy and grid call effectiveness">TAC: ${p.tac}</span>
              <span data-tooltip="R&D - Upgrade power and development speed">RND: ${p.rnd}</span>
            </div>`
          : `<div class="stat-pills muted"><span>Stats hidden</span></div>`
      }
    </div>`;
}

/* ───────── PREVIEW ───────── */

function renderPreview() {
  const list = $('#grid-preview');
  const sorted = [...state.fullGrid].sort(
    (a, b) => b.aero + b.eng + b.driverSkill - (a.aero + a.eng + a.driverSkill)
  );
  list.innerHTML = `
    <div class="grid-head"><span>POS</span><span>DRIVER</span><span>TEAM</span></div>
    ${sorted
      .map((c, i) => {
        const weird = Math.abs(c.driverYear - c.teamYear) > 15;
        return `<div class="grid-row ${c.isPlayer ? 'you' : ''} ${weird ? 'weird' : ''}">
          <span class="mono">${i + 1}</span>
          <span>${c.driverName} '${String(c.driverYear).slice(2)}${c.isPlayer ? ' ★' : ''}</span>
          <span>${c.teamName} '${String(c.teamYear).slice(2)}</span>
        </div>`;
      })
      .join('')}`;

  const nameInput = $('#team-name-input');
  if (nameInput) {
    nameInput.value = state.teamName || '';
    nameInput.oninput = () => {
      state.teamName = nameInput.value.slice(0, 28) || 'Multiverse Racing';
      persist();
    };
  }

  const aggBox = $('#agg-options');
  if (aggBox) {
    const pads = [
      { id: 'safe', value: 18, label: 'SAFE', pip: 'pip-safe' },
      { id: 'race', value: 50, label: 'RACE', pip: 'pip-race' },
      { id: 'limit', value: 88, label: 'LIMIT', pip: 'pip-limit' },
    ];
    const current = pads.reduce((best, p) =>
      Math.abs(p.value - state.aggression) < Math.abs(best.value - state.aggression) ? p : best
    );
    aggBox.innerHTML = pads
      .map(
        (p) => `
      <button type="button" class="pad-btn ${current.id === p.id ? 'active' : ''}" data-agg="${p.value}">
        <i class="pip ${p.pip}"></i>
        <strong>${p.label}</strong>
      </button>`
      )
      .join('');
    $$('.pad-btn', aggBox).forEach((btn) => {
      btn.onclick = () => {
        state.aggression = +btn.dataset.agg;
        $$('.pad-btn', aggBox).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        persist();
      };
    });
  }

  $('#btn-simulate').onclick = () => {
    state.phase = isSolo() ? 'solo-racing' : 'tournament-racing';
    state.raceWeekendUI = 'strategy';
    state.pendingStrategy = { ...DEFAULT_STRATEGY };
    syncGameState(state);
    persist();
    render();
  };
}

function titleDeciderCopy() {
  const round = (state?.currentRaceIndex || 0) + 1;
  if (round < 8) return '';
  const rows = state?.championshipStandings || [];
  const yours = rows.filter((r) => r.isPlayer);
  if (!rows.length || !yours.length) return '';
  const best = yours.reduce((a, b) => (a.points >= b.points ? a : b));
  const leader = rows[0];
  const short = (name) => String(name || '').split(' ').pop();
  if (best.id === leader.id) {
    const second = rows.find((r) => r.id !== best.id);
    const lead = best.points - (second?.points || 0);
    if (lead >= 25) return '';
    return `Title decider · ${short(best.name)} leads by ${lead}`;
  }
  const gap = leader.points - best.points;
  if (gap >= 25) return '';
  return `Title decider · ${gap} behind ${short(leader.name)}`;
}

function swingCopy(result) {
  const yours = (result?.telemetry?.classification || []).filter((r) => r.isPlayer);
  const moves = yours.map((r) => {
    if (r.dnf || r.pos === 'DNF') return `${r.name} retired`;
    const finish = Number(r.pos);
    const grid = Number(r.grid) || finish;
    const gained = grid - finish;
    const places = gained > 0 ? `+${gained}` : gained < 0 ? `${gained}` : 'held';
    return `${r.name} ${places} · +${r.points || 0}`;
  });
  const rows = state?.championshipStandings || [];
  const leader = rows[0];
  const mine = rows.filter((r) => r.isPlayer).sort((a, b) => b.points - a.points)[0];
  let gap = '';
  if (leader && mine) {
    if (mine.id === leader.id) {
      const second = rows.find((r) => r.id !== mine.id);
      gap = `lead ${mine.points - (second?.points || 0)}`;
    } else gap = `${leader.points - mine.points} behind`;
  }
  if (!moves.length && !gap) return '';
  return `Your swing · ${moves.join(' · ')}${gap ? ` · ${gap}` : ''}`;
}

function paintSwing(text) {
  const el = $('#session-swing');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
}

/* ───────── RACING — STRATEGY + LIVE TIMING ───────── */

function renderStrategyPanel() {
  const track = CALENDAR_24[state.currentRaceIndex];
  if (!track) return;

  $('#strategy-round').textContent = `ROUND ${state.currentRaceIndex + 1} / ${SEASON_LENGTH}`;
  $('#strategy-track-flag').textContent = track.flag;
  $('#strategy-track-name').textContent = track.name;
  const rain = Math.round((track.baseRainChance || 0) * 100);
  $('#strategy-profile').textContent = rain >= 30 ? `${track.flag}  Rain ${rain}%` : `${track.flag}  Dry`;
  const decider = $('#title-decider');
  const deciderCopy = titleDeciderCopy();
  if (decider) {
    decider.textContent = deciderCopy;
    decider.classList.toggle('hidden', !deciderCopy);
  }

  const strat = state.pendingStrategy || { ...DEFAULT_STRATEGY };
  const plans = strategiesForTrack(track);
  if (!plans.some((plan) => plan.id === strat.planId)) {
    strat.planId = plans.find((plan) => plan.role === 'balance')?.id || plans[0].id;
    state.pendingStrategy = { ...strat };
  }
  const enginePads = { push: ['PUSH', 'pip-push'], conserve: ['SAVE', 'pip-save'] };

  $('#tire-options').innerHTML = plans
    .map(
      (plan) => `
    <button type="button" class="strat-btn ${strat.planId === plan.id ? 'active' : ''}" data-group="planId" data-value="${plan.id}">
      <strong>${plan.name}</strong>
      <span>${plan.stops} stop${plan.stops > 1 ? 's' : ''}</span>
    </button>`
    )
    .join('');

  $('#engine-options').innerHTML = UI_ENGINE_OPTIONS
    .map((id) => {
      const [label, pip] = enginePads[id];
      return `
    <button type="button" class="pad-btn ${strat.engine === id ? 'active' : ''}" data-group="engine" data-value="${id}">
      <i class="pip ${pip}"></i>
      <strong>${label}</strong>
    </button>`;
    })
    .join('');

  $$('#strategy-panel [data-group]').forEach((btn) => {
    if (!btn.dataset.group) return;
    btn.onclick = () => {
      const group = btn.dataset.group;
      const value = btn.dataset.value;
      state.pendingStrategy = state.pendingStrategy || { ...DEFAULT_STRATEGY };
      state.pendingStrategy[group] = value;
      // Only one option can be active within its group
$$(`#${group === 'planId' ? 'tire-options' : 'engine-options'} [data-group="${group}"]`)
.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      persist();
    };
  });

  $('#btn-launch-gp').onclick = () => {
    if (racePlaying) return;
    launchGrandPrix();
  };
}

function renderSessionTower(rows, mode) {
  const el = $('#session-tower');
  if (!el) return;
  el.className = mode === 'quali' ? 'timing-tower quali' : 'timing-tower';
  const head =
    mode === 'race'
      ? '<div class="tower-head"><span>Pos</span><span>Grid</span><span>Driver</span><span>Pts</span></div>'
      : '<div class="tower-head"><span>Pos</span><span>Driver</span><span>Team</span></div>';
  el.innerHTML =
    head +
    rows
      .map((r, i) => {
        const delay = Math.min(i, 19) * 36;
        const you = r.isPlayer ? 'you' : '';
        if (mode === 'race') {
          const pos = r.dnf ? 'DNF' : `P${r.pos}`;
          return `<div class="tower-row ${you}" style="animation-delay:${delay}ms">
            <span class="mono pos">${pos}</span>
            <span class="mono dim">${r.grid ? `P${r.grid}` : '—'}</span>
            <span class="who"><b style="border-color:${r.color || '#66fcf1'}">${r.name}</b><small>${r.team || ''}</small></span>
            <span class="mono">${r.dnf ? '0' : `+${r.points}`}</span>
          </div>`;
        }
        return `<div class="tower-row ${you}" style="animation-delay:${delay}ms">
          <span class="mono pos">P${r.gridRank}</span>
          <span class="who"><b style="border-color:${r.color || '#66fcf1'}">${r.name}</b><small>${r.note || 'Clean lap'}</small></span>
          <span class="team-cell">${r.team}</span>
        </div>`;
      })
      .join('');
  const yours = el.querySelector('.tower-row.you');
  if (yours) yours.scrollIntoView({ block: 'nearest' });
}

function shuffleRows(rows) {
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function provisionalOrder(startRows, finalRows, t) {
  const mix = Math.min(0.74, t * 0.8);
  const startIndex = new Map(startRows.map((r, i) => [r.id, i]));
  const finalIndex = new Map(finalRows.map((r, i) => [r.id, i]));
  const wave = t * 14;
  const ranked = finalRows.map((row, i) => {
    const s = startIndex.get(row.id) ?? i;
    const f = finalIndex.get(row.id) ?? i;
    const wobble = Math.sin(wave + i * 1.7) * (1 - mix) * 2.2;
    return { row, key: s * (1 - mix) + f * mix + wobble };
  });
  ranked.sort((a, b) => a.key - b.key);
  return ranked.map((x) => x.row);
}

function mountLiveTower(mode) {
  const el = $('#session-tower');
  if (!el) return null;
  el.className = `timing-tower live ${mode === 'quali' ? 'quali' : 'race'}`;
  el.innerHTML = `
    <div class="tower-head"><span>Pos</span><span></span><span>Driver</span><span>Gap</span></div>
    <div class="tower-body"></div>`;
  return el.querySelector('.tower-body');
}

function liveNodes(rows) {
  const nodes = new Map();
  for (const row of rows) {
    const div = document.createElement('div');
    div.className = `tower-row${row.isPlayer ? ' you' : ''}`;
    div.dataset.id = row.id;
    div.innerHTML = `<span class="mono pos"></span><span class="delta"></span><span class="who"><b style="border-color:${row.color || '#66fcf1'}">${row.name}</b><small></small></span><span class="mono gap"></span>`;
    nodes.set(row.id, div);
  }
  return nodes;
}

function paintLive(body, nodes, order, prevIds, mode, locked) {
  const prev = new Map(prevIds.map((id, i) => [id, i]));
  const tops = new Map();
  for (const id of prevIds) {
    const el = nodes.get(id);
    if (el?.isConnected) tops.set(id, el.getBoundingClientRect().top);
  }
  order.forEach((row, i) => {
    const el = nodes.get(row.id);
    const was = prev.get(row.id);
    el.classList.remove('climbed', 'fell');
    const posEl = el.querySelector('.pos');
    const deltaEl = el.querySelector('.delta');
    const gapEl = el.querySelector('.gap');
    const small = el.querySelector('small');
    if (locked && mode === 'race') {
      posEl.textContent = row.dnf ? 'DNF' : `P${row.pos}`;
      deltaEl.textContent = '';
      gapEl.textContent = row.dnf ? 'OUT' : `+${row.points}`;
      if (small) small.textContent = row.grid ? `grid P${row.grid}` : '';
    } else if (locked && mode === 'quali') {
      posEl.textContent = `P${row.gridRank}`;
      deltaEl.textContent = '';
      gapEl.textContent = i === 0 ? 'POLE' : row.note || '';
      if (small) small.textContent = row.team || '';
    } else {
      posEl.textContent = `P${i + 1}`;
      if (was == null || was === i) deltaEl.textContent = '';
      else if (was > i) {
        deltaEl.textContent = `▲${was - i}`;
        el.classList.add('climbed');
      } else {
        deltaEl.textContent = `▼${i - was}`;
        el.classList.add('fell');
      }
      gapEl.textContent = i === 0 ? 'LEAD' : `+${(i * 0.214).toFixed(3)}`;
      if (small) small.textContent = row.team || '';
    }
    body.appendChild(el);
  });
  for (const row of order) {
    const el = nodes.get(row.id);
    const prevTop = tops.get(row.id);
    if (prevTop == null) continue;
    const dy = prevTop - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    el.style.transition = 'none';
    el.style.transform = `translateY(${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = 'transform 240ms cubic-bezier(.2,.7,.2,1)';
      el.style.transform = 'translateY(0)';
    });
  }
}

function commentary(order, prevIds, mode, t) {
  let best = null;
  let bestScore = 0;
  order.forEach((row, i) => {
    const was = prevIds.indexOf(row.id);
    if (was < 0 || was === i) return;
    const gain = was - i;
    const score = Math.abs(gain) + (row.isPlayer ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { row, gain, i };
    }
  });
  if (mode === 'race') {
    const lap = Math.max(1, Math.min(58, Math.round(1 + t * 56)));
    if (!best) return `Lap ${lap}`;
    return best.gain > 0
      ? `Lap ${lap}  ·  ${best.row.name}  P${best.i + 1}`
      : `Lap ${lap}  ·  ${best.row.name} drops`;
  }
  if (!best) return 'Flying lap';
  return best.gain > 0 ? `${best.row.name}  →  P${best.i + 1}` : `${best.row.name}  loses time`;
}

function runShufflingTower({ mode, finalRows, token, ms, startRows }) {
  const body = mountLiveTower(mode);
  if (!body) return Promise.resolve('cancelled');
  const nodes = liveNodes(finalRows);
  let prevIds = [];
  const start = performance.now();
  let lastTick = -999;
  const bar = document.querySelector('#session-checkbar i');
  const label = $('#session-timer');
  if (bar) bar.style.transform = 'scaleX(0)';

  const draw = (order, locked, t) => {
    paintLive(body, nodes, order, prevIds, mode, locked);
    if (!locked && prevIds.length) {
      const note = $('#session-note');
      if (note) note.textContent = commentary(order, prevIds, mode, t);
      notePitMove(order, prevIds, mode, t);
    }
    if (locked) notePitLock(order, mode);
    prevIds = order.map((r) => r.id);
  };

  draw(startRows, false, 0);
  const opener = $('#session-note');
  if (opener) opener.textContent = mode === 'quali' ? 'Out lap' : 'Lights out';

  return new Promise((resolve) => {
    let skipped = false;
    const skipBtn = $('#btn-skip-session');
    const onSkip = () => {
      skipped = true;
    };
    skipBtn?.classList.remove('hidden');
    skipBtn?.addEventListener('click', onSkip);

    const finish = (status) => {
      skipBtn?.classList.add('hidden');
      skipBtn?.removeEventListener('click', onSkip);
      resolve(status);
    };

    const frame = (now) => {
      if (token !== weekendToken) {
        finish('cancelled');
        return;
      }
      const t = skipped ? 1 : Math.min(1, (now - start) / ms);
      if (bar) bar.style.transform = `scaleX(${t})`;
      if (label) label.textContent = skipped ? '0.0' : Math.max(0, (ms - (now - start)) / 1000).toFixed(1);
      if (t >= 1) {
        draw(finalRows, true, 1);
        if (label) label.textContent = '0.0';
        const note = $('#session-note');
        if (note) note.textContent = mode === 'quali' ? 'Grid locked' : 'Chequered flag';
        finish('done');
        return;
      }
      if (now - lastTick >= 340) {
        lastTick = now;
        draw(provisionalOrder(startRows, finalRows, t), false, t);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

function askGridCall(quali) {
  const yours = quali.order.filter((r) => r.isPlayer);
  $('#grid-call-summary').innerHTML = yours
    .map(
      (r) => `
      <div class="you-slot">
        <span class="mono">P${r.gridRank}</span>
        <span>${r.name}</span>
      </div>`
    )
    .join('');
  const pads = { send: 'pip-send', cover: 'pip-cover', nurse: 'pip-nurse' };
  $('#grid-call-options').innerHTML = Object.values(GRID_CALLS)
    .map(
      (c) => `
      <button type="button" class="pad-btn" data-call="${c.id}">
        <i class="pip ${pads[c.id]}"></i>
        <strong>${c.id === 'send' ? 'SEND' : c.id === 'cover' ? 'COVER' : 'NURSE'}</strong>
      </button>`
    )
    .join('');
  $('#grid-call')?.classList.remove('hidden');
  $('#btn-skip-session')?.classList.add('hidden');
  return new Promise((resolve) => {
    $$('#grid-call-options .pad-btn').forEach((btn) => {
      btn.onclick = () => {
        $$('#grid-call-options .pad-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        resolve(btn.dataset.call);
      };
    });
  });
}

function showIncidentModal(incident, details) {
  if (!incident) return;
  $('#incident-icon').textContent = incident.icon;
  $('#incident-title').textContent = incident.title;
  $('#incident-desc').textContent = incident.desc;
  $('#incident-headline').textContent = details?.headline || '';
  const modal = $('#incident-modal');
  modal?.classList.remove('hidden');
  if (incident.color) {
    modal?.querySelector('.incident-flash')?.style.setProperty('border-color', incident.color);
  }
}

function hideIncidentModal() {
  $('#incident-modal')?.classList.add('hidden');
}

function showRacePanels(mode) {
  const strategy = $('#strategy-panel');
  const live = $('#race-live-panel');
  const telemetry = $('#telemetry-panel');
  const dock = $('#race-dock');

  if (mode === 'strategy') {
    strategy?.classList.remove('hidden');
    live?.classList.add('hidden');
    telemetry?.classList.add('hidden');
    dock?.classList.add('hidden');
    $('#btn-skip-session')?.classList.add('hidden');
    return;
  }
  if (mode === 'running') {
    strategy?.classList.add('hidden');
    live?.classList.remove('hidden');
    telemetry?.classList.add('hidden');
    dock?.classList.add('hidden');
    return;
  }
  if (mode === 'results') {
    strategy?.classList.add('hidden');
    live?.classList.remove('hidden');
    telemetry?.classList.remove('hidden');
    dock?.classList.remove('hidden');
    $('#btn-skip-session')?.classList.add('hidden');
  }
}

async function launchGrandPrix() {
  if (racePlaying || !isRacingPhase() || state.seasonComplete) return;

  const strategy = { ...(state.pendingStrategy || DEFAULT_STRATEGY) };
  const skipHold = fastWeekend;
  fastWeekend = false;
  const quali = computeQualifying(state, strategy);
  if (!quali) return;
  pitFeed = [];
  state.pitFeed = [];
  pushFeed(quali.raining ? 'Wet qualifying. Cars leave the garage.' : 'Qualifying. Cars leave the garage.');

  // Weather overlay effect
  let weatherOverlay = $('#weather-overlay');
  if (weatherOverlay) {
    weatherOverlay.classList.toggle('rain', quali.raining);
    weatherOverlay.classList.toggle('active', quali.raining);
  }

  const token = ++weekendToken;
  racePlaying = true;
  state.raceWeekendUI = 'qualifying';
  showRacePanels('running');
  $('#grid-call')?.classList.add('hidden');
  $('#session-awards')?.classList.add('hidden');
  paintSwing('');
  $('#session-kicker').textContent = quali.raining ? 'Qualifying · wet' : 'Qualifying';
  $('#session-title').textContent = quali.track.name;
  $('#session-note').textContent = 'Out lap';

  const qualiHold = await runShufflingTower({
    mode: 'quali',
    finalRows: quali.order,
    startRows: shuffleRows(quali.order),
    token,
    ms: skipHold ? 0 : SESSION_HOLD_MS,
  });
  if (qualiHold === 'cancelled' || token !== weekendToken) {
    racePlaying = false;
    if (state && !state.seasonComplete) state.raceWeekendUI = 'strategy';
    return;
  }

  $('#session-kicker').textContent = 'Grid locked';
  $('#session-timer').textContent = '—';
  const call = await askGridCall(quali);
  if (token !== weekendToken) {
    racePlaying = false;
    if (state && !state.seasonComplete) state.raceWeekendUI = 'strategy';
    return;
  }

  const result = computeRaceFromGrid(state, strategy, quali, call);
  if (!result) {
    racePlaying = false;
    return;
  }

  $('#grid-call')?.classList.add('hidden');
  $('#session-awards')?.classList.add('hidden');
  $('#session-kicker').textContent = result.raining ? 'Race · wet' : 'Race';
  $('#session-title').textContent = `${quali.track.flag} ${quali.track.name}`;
  $('#session-note').textContent = 'Lights out';

  // Update weather overlay for race
  if (weatherOverlay) {
    weatherOverlay.classList.toggle('rain', result.raining);
    weatherOverlay.classList.toggle('active', result.raining);
  }

  const raceStart = [...result.telemetry.classification].sort((a, b) => (a.grid || 20) - (b.grid || 20));
  const raceHold = await runShufflingTower({
    mode: 'race',
    finalRows: result.telemetry.classification,
    startRows: raceStart,
    token,
    ms: skipHold ? 0 : SESSION_HOLD_MS,
  });
  if (raceHold === 'cancelled' || token !== weekendToken) {
    racePlaying = false;
    if (state && !state.seasonComplete) state.raceWeekendUI = 'strategy';
    return;
  }

  const pole = quali.pole;
  const fl = result.telemetry.classification.find((r) => r.fl);
  const hero = result.telemetry.hero;
  const awards = $('#session-awards');
  awards?.classList.remove('hidden');
  if (awards) {
    const heroLabel = hero ? `${hero.name.split(' ').pop()} P${hero.from}→P${hero.to}` : '—';
    awards.innerHTML = `
      <span>Pole ${pole?.name || '—'}</span>
      <span>Fastest lap ${fl ? fl.name : '—'}</span>
      <span>Driver of the day ${heroLabel}</span>
      ${result.incident ? `<span class="incident-note">${result.incident.icon} ${result.incident.title}</span>` : ''}
    `;
  }

  applyRaceResult(state, result);
  const swing = swingCopy(result);
  state.lastSwing = swing;
  paintSwing(swing);
  renderTelemetry(result.telemetry);
  renderStandingsTable($('#live-standings'));
  $('#live-record').textContent = teamWins();
  $('#live-team-pts').textContent = state.squadStats?.totalTeamPoints ?? 0;
  $('#race-progress').textContent = `${state.currentRaceIndex} / ${SEASON_LENGTH}`;

  // Remove weather overlay after race
  if (weatherOverlay) {
    weatherOverlay.classList.remove('rain', 'active');
  }

  racePlaying = false;
  presentLockedResult();
}

function holdingResult() {
  const ui = state?.raceWeekendUI;
  return ui === 'awaiting_continue' || ui === 'awaiting_season_end';
}

function setDock(label, onClick) {
  const dock = $('#race-dock');
  const btn = $('#btn-continue-weekend');
  dock?.classList.remove('hidden');
  if (!btn) return;
  btn.textContent = label;
  // Remove any existing event listeners
  const newBtn = btn.cloneNode(true);
  btn.parentNode?.replaceChild(newBtn, btn);
  // Add new event listener
  newBtn.addEventListener('click', onClick);
}

function paintResultNext(text) {
  const el = $('#result-next');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
}

function continueWeekend() {
  if (!state) return;
  clearUpgradeHold();
  state.currentRaceIndex += 1;

  if (state.currentRaceIndex >= SEASON_LENGTH) {
    state.seasonComplete = true;
    state.raceWeekendUI = 'awaiting_season_end';
  } else {
    state.raceWeekendUI = 'strategy';
    state.lastRaceTelemetry = null;
    state.lastSwing = '';
  }

  persist();
  render();
}

// function endSeason() {
//   if (!state) return;
//   clearUpgradeHold();
//   if (!state.seasonRecorded) {
//     recordSeasonFinish(state);
//     handleSeasonEnd();
//     state.seasonRecorded = true;
//   }
//   state.raceWeekendUI = 'done';
//   uiView = 'finale';
//   persist();
//   render();
// }

function endSeason() {
  if (!state) return;

  clearUpgradeHold();

  if (!state.seasonRecorded) {
    recordSeasonFinish(state);
    handleSeasonEnd();
    state.seasonRecorded = true;
  }

  state.raceWeekendUI = 'done';

  // Hide the old race controls
  $('#race-dock')?.classList.add('hidden');

  // Show the season finale
  uiView = 'finale';

  persist();
  render();
}

function armUpgradeHold() {
  if (upgradeHold) return;
  let left = 5;
  paintResultNext('Mid-season window in 5s');
  const token = weekendToken;
  upgradeHold = setInterval(() => {
    if (token !== weekendToken || !state?.phase?.endsWith('-upgrade')) {
      clearUpgradeHold();
      return;
    }
    left -= 1;
    if (left <= 0) {
      clearUpgradeHold();
      state.raceWeekendUI = 'strategy';
      persist();
      render();
      return;
    }
    paintResultNext(`Mid-season window in ${left}s`);
  }, 1000);
}

function clearUpgradeForSim() {
  if (!state.phase?.endsWith('-upgrade')) return;
  if (!state.upgradeOptions) state.upgradeOptions = generateUpgradeOptions(state);
  if (!state.awaitingOptionalDriver) {
    const choice = state.upgradeOptions.find((opt) => opt.id === 'aero') || state.upgradeOptions[0];
    if (choice) applyUpgrade(state, choice.id);
  }
  if (state.awaitingOptionalDriver || state.phase?.endsWith('-upgrade')) skipOptionalDriverSwap(state);
}

function simulateRest(style) {
  if (racePlaying || state?.seasonComplete) return;
  if (!state?.fullGrid?.length) {
    showToast('Lock a garage before simulating the season.');
    return;
  }
  const styles = {
    push: { engine: 'push', call: 'send', role: 'push', label: 'Pushing' },
    balance: { engine: 'conserve', call: 'cover', role: 'balance', label: 'Balanced' },
    save: { engine: 'conserve', call: 'nurse', role: 'save', label: 'Conservative' },
  };
  const pick = styles[style] || styles.balance;
  racePlaying = true;
  weekendToken++;
  let raced = 0;
  for (let guard = 0; guard < 16 && !state.seasonComplete; guard += 1) {
    if (state.phase?.endsWith('-upgrade')) {
      clearUpgradeForSim();
      continue;
    }
    if (!state.phase?.endsWith('-racing')) break;
    const track = CALENDAR_24[state.currentRaceIndex];
    if (!track) break;
    const plan = planForRole(track, pick.role);
    const strategy = { tire: 'medium', engine: pick.engine, planId: plan.id };
    const quali = computeQualifying(state, strategy);
    const result = computeRaceFromGrid(state, strategy, quali, pick.call);
    if (!result) break;
    applyRaceResult(state, result);
    raced += 1;
    const swing = swingCopy(result);
    state.lastSwing = swing;
  }
  racePlaying = false;
  pitFeed = [];
  seedFeed();
  state.raceWeekendUI = state.seasonComplete ? 'awaiting_season_end' : 'strategy';
  persist();
  render();
  showToast(raced ? `${pick.label} · ${raced} race${raced === 1 ? '' : 's'} simulated.` : 'Nothing left to simulate.');
}

function presentLockedResult() {
  showRacePanels('results');
  if (state.seasonComplete) {
    state.raceWeekendUI = 'awaiting_season_end';
    paintResultNext('The table is final. End the season when you have read it.');
    setDock('END SEASON', endSeason);
  } else if (state.phase?.endsWith('-upgrade')) {
    state.raceWeekendUI = 'awaiting_continue';
    $('#race-dock')?.classList.add('hidden');
    armUpgradeHold();
  } else {
    state.raceWeekendUI = 'awaiting_continue';
    paintResultNext('');
    setDock('CONTINUE TO NEXT RACE →', continueWeekend);
  }
  const quick = $('#btn-quick-result');
  if (quick) quick.disabled = true;
  renderPitWall();
  persist();
}

function renderTelemetry(telemetry) {
  if (!telemetry?.bars) return;
  $('#telemetry-panel')?.classList.remove('hidden');
  const bars = $('#driver-bars');
  bars.innerHTML = telemetry.bars
    .map(
      (b) => {
        const positionChange = b.grid && b.pos && !b.dnf ? b.grid - b.pos : 0;
        const positionClass = positionChange > 0 ? 'pos-up' : positionChange < 0 ? 'pos-down' : 'pos-same';
        const positionArrow = positionChange > 0 ? `↑${positionChange}` : positionChange < 0 ? `↓${Math.abs(positionChange)}` : '−';
        const positionIndicator = positionChange !== 0 ? 
          `<span class="position-indicator ${positionClass}">${positionArrow}</span>` : '';
        
        return `
    <div class="result-bar ${b.dnf ? 'dnf' : ''} ${b.dnf ? 'dnf-flash' : ''}">
      <div class="result-bar-main">
        ${positionIndicator}
        <span>${b.name} '${String(b.year).slice(2)}</span>
      </div>
      <span class="mono">${b.dnf ? 'DNF' : `P${b.pos}`} · +${b.points}${b.fl ? ' · FL' : ''}</span>
    </div>`;
      }
    )
    .join('');
}

function recentForm(id) {
  const marks = [];
  for (const log of (state.raceLog || []).slice(-5)) {
    const row = log.classification?.find((c) => c.id === id);
    if (!row) continue;
    marks.push(row.pos === 'DNF' || row.pos == null ? 'R' : String(row.pos));
  }
  return marks.join(' ') || '—';
}

function renderStandingsTable(el) {
  if (!el || !state?.championshipStandings) return;
  const rows = state.championshipStandings;
  const leader = rows[0]?.points || 0;
  el.innerHTML = `
    <div class="tower-head"><span>#</span><span>Driver</span><span>Form</span><span>Pts</span></div>
    ${rows
      .map((s, i) => {
        const gap = i === 0 ? 'LEAD' : `-${leader - s.points}`;
        return `
      <div class="stand-row ${s.isPlayer ? 'you' : ''}">
        <span class="mono">${i + 1}</span>
        <span class="stand-name">${s.name} '${String(s.year).slice(2)}<small>${s.team}</small></span>
        <span class="form">${recentForm(s.id)}</span>
        <span class="mono">${s.points}<small>${gap}</small></span>
      </div>`;
      })
      .join('')}`;
}

function handleSeasonEnd() {
  let board = null;
  if (isTournament()) {
    const pts = tournamentPoints(state.squadStats?.totalTeamPoints || 0, isGaffer());
    const squad = `${state.playerDrivers[0]?.year} ${state.playerDrivers[0]?.name?.split(' ').pop()} / ${state.playerChassis?.name}`;
    const boardName = profile?.callsign || state.teamName;
    submitTournamentScore({ name: boardName, squad, points: pts, gaffer: isGaffer() });
    board = buildLeaderboardField({ name: boardName, squad, points: pts, gaffer: isGaffer() }, state.tournamentRound || 1);
    state.tournamentBoard = board;
  }
  if (state.leagueCode && profile) {
    const pts = state.squadStats?.totalTeamPoints || 0;
    const squad = `${state.playerDrivers[0]?.year} ${state.playerDrivers[0]?.name?.split(' ').pop()} / ${state.playerChassis?.name}`;
    submitLeagueScore(state.leagueCode, {
      name: profile.callsign,
      squad,
      points: pts,
    });
    state.leagueSlip = formatResultSlip(state.leagueCode, profile.callsign, pts, squad);
  }
  const ids = evaluateTrophies(state, {
    advanced: board?.advanced ?? false,
    round: state.tournamentRound || 1,
  });
  const fresh = unlockBadges(ids);
  for (const id of fresh) {
    const def = TROPHY_DEFS.find((t) => t.id === id);
    if (def) showToast(`${def.icon} Trophy unlocked: ${def.name}`);
  }
  return board;
}

function driverShort(index) {
  const driver = state?.playerDrivers?.[index];
  return driver?.name?.split(' ').pop() || `Driver ${index + 1}`;
}

function driverPlace(index) {
  const id = index === 0 ? 'player_car_1' : 'player_car_2';
  const rows = state?.championshipStandings || [];
  const place = rows.findIndex((row) => row.id === id);
  const points = place >= 0 ? rows[place].points : state?.squadStats?.drivers?.[index]?.pointsScore || 0;
  return { place, points };
}

function teamWins() {
  return (state?.squadStats?.drivers || []).reduce((sum, driver) => sum + (driver.wins || 0), 0);
}

function pushFeed(text) {
  if (!text || pitFeed[0] === text) return;
  pitFeed.unshift(text);
  pitFeed = pitFeed.slice(0, 6);
  if (state) state.pitFeed = pitFeed;
  const list = $('#pit-feed');
  if (list) list.innerHTML = pitFeed.map((line) => `<li>${line}</li>`).join('');
}

function notePitMove(order, prevIds, mode, t) {
  for (const row of order) {
    if (!row.isPlayer) continue;
    const now = order.indexOf(row);
    const was = prevIds.indexOf(row.id);
    if (was < 0 || was === now) continue;
    const name = row.name;
    if (mode === 'race') {
      const lap = Math.max(1, Math.min(58, Math.round(1 + t * 56)));
      pushFeed(now < was ? `Lap ${lap} · ${name} up to P${now + 1}` : `Lap ${lap} · ${name} back to P${now + 1}`);
    } else {
      pushFeed(now < was ? `${name} improves to P${now + 1}` : `${name} drops to P${now + 1}`);
    }
  }
}

function notePitLock(order, mode) {
  const yours = order.filter((row) => row.isPlayer);
  const bits = yours.map((row) => {
    if (mode === 'quali') return `${row.name} P${row.gridRank || order.indexOf(row) + 1}`;
    if (row.dnf || row.pos === 'DNF') return `${row.name} retired`;
    return `${row.name} P${row.pos} +${row.points || 0}`;
  });
  if (!bits.length) return;
  pushFeed(mode === 'quali' ? `Grid set · ${bits.join(' · ')}` : `Chequered flag · ${bits.join(' · ')}`);
}

function seedFeed() {
  const last = (state.lastRaceTelemetry?.classification || []).filter((row) => row.isPlayer);
  if (last.length) {
    pitFeed = last.map((row) => (
      row.dnf || row.pos === 'DNF'
        ? `${row.name} retired last time out`
        : `${row.name} last race P${row.pos}, +${row.points || 0}`
    ));
  } else {
    const track = CALENDAR_24[state.currentRaceIndex];
    pitFeed = [track ? `${track.name} is next.` : 'Garage is quiet.'];
  }
  state.pitFeed = pitFeed;
}

function renderPitWall() {
  const el = $('#driver-rail');
  if (!el || !state?.playerDrivers) return;
  if (!pitFeed.length && Array.isArray(state.pitFeed) && state.pitFeed.length) pitFeed = state.pitFeed.slice(0, 6);
  if (!pitFeed.length && !racePlaying) seedFeed();
  const team = state.squadStats?.totalTeamPoints ?? 0;
  const cards = [0, 1].map((index) => {
    const { place, points } = driverPlace(index);
    const pos = place >= 0 ? `P${place + 1}` : '—';
    return `<li><span>${driverShort(index)}</span><span>${pos} · ${points}</span></li>`;
  }).join('');
  el.innerHTML = `
    <div class="feed-score"><strong>${team}</strong><span>Constructor points</span></div>
    <ul class="feed-drivers">${cards}</ul>
    <p class="rail-kicker">Pit wall</p>
    <ol class="pit-feed" id="pit-feed">${pitFeed.map((line) => `<li>${line}</li>`).join('')}</ol>
  `;
}

function renderRacing() {
  $('#live-record').textContent = teamWins();
  $('#live-team-pts').textContent = state.squadStats?.totalTeamPoints ?? 0;
  $('#race-progress').textContent = `${Math.min(state.currentRaceIndex, SEASON_LENGTH)} / ${SEASON_LENGTH}`;
  renderStandingsTable($('#live-standings'));
  renderPitWall();

  const quick = $('#btn-quick-result');
  const ui = state.raceWeekendUI || 'strategy';
  if (quick) quick.disabled = racePlaying || state.seasonComplete;

  if ((ui === 'awaiting_continue' || ui === 'awaiting_season_end') && !racePlaying) {
    showRacePanels('results');
    if (ui === 'awaiting_season_end') {
      paintResultNext('The table is final. End the season when you have read it.');
      setDock('END SEASON', endSeason);
    } else if (state.phase?.endsWith('-upgrade')) {
      $('#race-dock')?.classList.add('hidden');
      armUpgradeHold();
    } else {
      paintResultNext('');
      setDock('CONTINUE TO NEXT RACE →', continueWeekend);
    }
    const tel = state.lastRaceTelemetry;
    if (tel?.classification) {
      $('#session-kicker').textContent = 'Race';
      $('#session-timer').textContent = '—';
      $('#session-title').textContent = tel.track?.name || 'Classification';
      $('#session-note').textContent = 'Classification locked';
      $('#grid-call')?.classList.add('hidden');
      renderSessionTower(tel.classification, 'race');
      paintSwing(state.lastSwing || '');
    }
    if (tel) renderTelemetry(tel);
    return;
  }

  if (ui === 'strategy' && !racePlaying) {
    clearUpgradeHold();
    paintResultNext('');
    showRacePanels('strategy');
    renderStrategyPanel();
    return;
  }
  if (racePlaying) {
    showRacePanels('running');
    return;
  }
  state.raceWeekendUI = 'strategy';
  showRacePanels('strategy');
  renderStrategyPanel();
}

/* ───────── UPGRADE / DILEMMA ───────── */

function renderUpgrade() {
  if (state.awaitingOptionalDriver) {
    $('#dilemma-panel').innerHTML = `
      <div class="tinkerman-prompt">
        <strong>🔧 Chassis package installed.</strong>
        <p>Spin a Driver 2 replacement to complete <em>The Tinkerman</em> trophy — or skip and resume the season.</p>
      </div>`;
    $('#upgrade-cards').innerHTML = `
      <button type="button" id="btn-tinkerman-swap" class="upgrade-card">
        <strong>Driver Mid-Season Swap</strong>
        <p>Replace Driver 2 now (Tinkerman path)</p>
      </button>
      <button type="button" id="btn-skip-swap" class="tap-btn w-full rounded border border-white/20 py-4 text-sm font-bold uppercase tracking-widest text-slate hover:border-cyan">
        Skip — Resume Season
      </button>`;
    $('#btn-tinkerman-swap').onclick = () => openDriverSwap();
    $('#btn-skip-swap').onclick = () => {
      skipOptionalDriverSwap(state);
      state.raceWeekendUI = 'strategy';
      persist();
      render();
    };
    return;
  }

  if (!state.upgradeOptions) state.upgradeOptions = generateUpgradeOptions(state);

  const sq = state.squadStats?.drivers || [];
  const d1 = sq[0];
  const d2 = sq[1];
  const total = Math.max(1, state.squadStats?.totalTeamPoints || 1);
  const share1 = d1 ? Math.round((d1.pointsScore / total) * 100) : 50;
  const share2 = d2 ? Math.round((d2.pointsScore / total) * 100) : 50;
  const carrier = share1 >= share2 ? d1 : d2;
  const drag = share1 < share2 ? d1 : d2;

  $('#dilemma-panel').innerHTML = `
    <div class="dilemma-grid">
      <div class="dilemma-card carry">
        <span class="label">Carrying</span>
        <strong>${carrier?.name || '—'}</strong>
        <span class="mono">${carrier?.pointsScore || 0} pts · ${Math.max(share1, share2)}%</span>
        <span class="meta">W${carrier?.wins || 0} · Pod ${carrier?.podiums || 0} · DNF ${carrier?.dnfs || 0}</span>
      </div>
      <div class="dilemma-card drag">
        <span class="label">Dragging</span>
        <strong>${drag?.name || '—'}</strong>
        <span class="mono">${drag?.pointsScore || 0} pts · ${Math.min(share1, share2)}%</span>
        <span class="meta">W${drag?.wins || 0} · Pod ${drag?.podiums || 0} · DNF ${drag?.dnfs || 0}</span>
      </div>
    </div>
    <p class="mt-3 text-xs text-slate">Chassis REL ${state.playerChassis?.rel} · Team pts ${state.squadStats?.totalTeamPoints || 0} after ${Math.floor(SEASON_LENGTH / 2)} races.</p>
  `;

  const box = $('#upgrade-cards');
  box.innerHTML = state.upgradeOptions
    .map(
      (o) => `
    <button type="button" class="upgrade-card" data-id="${o.id}">
      <strong>${o.title}</strong>
      <p>${o.desc}</p>
    </button>`
    )
    .join('');

  $$('.upgrade-card', box).forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (id === 'driver') {
        openDriverSwap();
      } else {
        applyUpgrade(state, id);
        state.raceWeekendUI = 'strategy';
        persist();
        render();
      }
    });
  });
}

function openDriverSwap() {
  const spun = spinDriverPool();
  const modal = $('#spin-modal');
  modal.classList.remove('hidden');
  $('#spin-cycling').classList.add('hidden');
  const result = $('#spin-result');
  result.classList.remove('hidden');
  $('#spin-actions').classList.remove('hidden');

  const carAvg = Math.round((spun.constructor.aero + spun.constructor.eng + spun.constructor.rel) / 3);
  const carQuality = carAvg >= 92 ? 'elite' : carAvg >= 85 ? 'good' : carAvg >= 78 ? 'average' : 'struggler';

  result.innerHTML = `
    <div class="trade-card">
      <div class="trade-header">
        MID-SEASON DRIVER SWAP
        <span class="quality-badge ${carQuality}">${carQuality.toUpperCase()}</span>
      </div>
      <div class="trade-season">${spun.constructor.year} ${spun.constructor.name}</div>
      <div class="roster-pick" id="roster-pick">
        ${spun.roster
          .map(
            (d, i) => {
              const driverAvg = Math.round((d.pac + d.rac + d.wet + d.con) / 4);
              const synergy = Math.abs(carAvg - driverAvg);
              const synergyClass = synergy <= 5 ? 'perfect' : synergy <= 10 ? 'good' : synergy <= 15 ? 'okay' : 'poor';
              const driverQuality = driverAvg >= 92 ? 'elite' : driverAvg >= 85 ? 'good' : driverAvg >= 78 ? 'average' : 'struggler';
              return `
            <button type="button" class="roster-btn rarity-glow ${driverQuality}" data-idx="${i}">
              <span>${d.year} ${d.name}</span>
              ${!isGaffer() ? `<span class="mono">
                      <span data-tooltip="Pace - Raw speed and qualifying performance">PAC${d.pac}</span> 
                      <span data-tooltip="Racecraft - Overtaking and race management">RAC${d.rac}</span> 
                      <span data-tooltip="Wet Weather - Rain performance and adaptability">WET${d.wet}</span> 
                      <span data-tooltip="Consistency - Reliability and mistake avoidance">CON${d.con}</span> · 
                      <span data-tooltip="Overall driver rating">${driverSkill(d)}</span>
                     </span>
                     <span class="synergy-indicator ${synergyClass}" data-tooltip="Car-Driver Synergy: ${synergy <= 5 ? 'Perfect Match' : synergy <= 10 ? 'Good Fit' : synergy <= 15 ? 'Okay' : 'Poor Match'}">${synergy <= 5 ? '🎯' : synergy <= 10 ? '✓' : synergy <= 15 ? '~' : '⚠'}</span>` : `<span class="mono">???</span>`}
            </button>`;
            }
          )
          .join('')}
      </div>
    </div>`;

  let selected = null;
  $$('.roster-btn', result).forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.roster-btn', result).forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selected = spun.roster[+btn.dataset.idx];
      $('#btn-choose').disabled = false;
    });
  });

  const chooseBtn = $('#btn-choose');
  chooseBtn.disabled = true;
  chooseBtn.textContent = 'CONFIRM SWAP';
  $('#btn-respin').disabled = true;

  chooseBtn.onclick = () => {
    if (!selected) return;
    applyUpgrade(state, 'driver', selected);
    state.raceWeekendUI = 'strategy';
    closeModal();
    persist();
    render();
  };
}

/* ───────── FINALE + ANALYTICS ───────── */

function finaleTable() {
  const drivers = state.squadStats?.drivers || [];
  const sum = (key) => (drivers[0]?.[key] || 0) + (drivers[1]?.[key] || 0);
  const place = (index) => {
    const found = driverPlace(index);
    return found.place >= 0 ? `P${found.place + 1}` : '—';
  };
  const rows = [
    ['Points', drivers[0]?.pointsScore ?? 0, drivers[1]?.pointsScore ?? 0, state.squadStats?.totalTeamPoints ?? 0],
    ['Wins', drivers[0]?.wins ?? 0, drivers[1]?.wins ?? 0, sum('wins')],
    ['Podiums', drivers[0]?.podiums ?? 0, drivers[1]?.podiums ?? 0, sum('podiums')],
    ['Fastest laps', drivers[0]?.fastLaps ?? 0, drivers[1]?.fastLaps ?? 0, sum('fastLaps')],
    ['Retirements', drivers[0]?.dnfs ?? 0, drivers[1]?.dnfs ?? 0, sum('dnfs')],
    ['Championship', place(0), place(1), '—'],
  ];
  const head = `<tr><th></th><th>${driverShort(0)}</th><th>${driverShort(1)}</th><th>Team</th></tr>`;
  return head + rows.map(([label, a, b, team]) => `<tr><td>${label}</td><td>${a}</td><td>${b}</td><td>${team}</td></tr>`).join('');
}

function renderFinale() {
  const rc = state.recordCode;
  const flawless = rc.wins === SEASON_LENGTH && !rc.podiums && !rc.losses && !rc.dnfs;
  const analytics = compileSeasonAnalytics(state);
  const board = state.tournamentBoard || buildLeaderboardField(
    isTournament()
      ? {
          name: state.teamName,
          squad: `${state.playerDrivers[0]?.year} ${state.playerDrivers[0]?.name?.split(' ').pop()} / ${state.playerChassis?.name}`,
          points: tournamentPoints(state.squadStats?.totalTeamPoints || 0, isGaffer()),
          gaffer: isGaffer(),
        }
      : null,
    state.tournamentRound || 1
  );
  const trophy = loadTrophyRoom();
  const badgeProg = badgeProgress(trophy);

  const points = state.squadStats?.totalTeamPoints || 0;
  const gafferTag = isGaffer() ? ' · 1.5× in the lobby' : '';
  $('#finale-points').textContent = isSolo() ? points : (board.playerPts ?? points);
  $('#finale-pts').textContent = isSolo()
    ? `${state.teamName || 'Your team'} · ${SEASON_LENGTH} races`
    : `${board.playerPts ?? 0} lobby points${gafferTag}`;
  $('#finale-table').innerHTML = finaleTable();
  $('#invincible').classList.toggle('hidden', !flawless);

  const banner = $('#verdict-banner');
  banner.textContent = analytics.summaryVerdict;
  banner.classList.toggle('glow', analytics.masterStrategist || (rc.wins || 0) >= 20);

  // Tabs
  $('#tab-cut-btn')?.classList.toggle('hidden', isSolo());
  renderAnalyticsTabs(analytics, board);

  $$('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      $$('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.analytics-panel').forEach((p) => p.classList.add('hidden'));
      $(`#tab-${btn.dataset.tab}`)?.classList.remove('hidden');
    };
  });

  const squad = $('#finale-squad');
  squad.innerHTML = `
    <div><label>Car</label><span>${state.playerChassis.year} ${state.playerChassis.name}</span></div>
    <div><label>Driver 1</label><span>${state.playerDrivers[0].year} ${state.playerDrivers[0].name}</span></div>
    <div><label>Driver 2</label><span>${state.playerDrivers[1].year} ${state.playerDrivers[1].name}</span></div>
    <div><label>Principal</label><span>${state.playerPrincipal?.year || ''} ${state.playerPrincipal?.name || '—'}</span></div>
  `;

  const legends = topDrafted(trophy);
  const unlockedThisRun = evaluateTrophies(state, { advanced: board.advanced, round: board.round });
  $('#trophy-stats').innerHTML = `
    <div>Seasons: <strong>${trophy.seasonsPlayed || 0}</strong></div>
    <div>Best wins: <strong>${trophy.bestWins || 0}</strong></div>
    <div>Flawless ${SEASON_LENGTH}-0: <strong>${trophy.flawlessCount || 0}</strong></div>
    <div>Trophies: <strong>${badgeProg.unlocked} / ${badgeProg.total}</strong></div>
    ${state.leagueSlip ? `<div class="mt-2">Share this slip in room ${state.leagueCode}<br><strong class="text-cyan">${state.leagueSlip}</strong></div>` : ''}
    ${unlockedThisRun.length ? `<div class="mt-2 text-cyan text-sm">This run: ${unlockedThisRun.map((id) => TROPHY_DEFS.find((t) => t.id === id)?.name).filter(Boolean).join(', ')}</div>` : ''}
    <div class="mt-1">Top drafts: ${legends.map((l) => l.name).join(', ') || '—'}</div>
  `;

  const viewBoard = $('#btn-view-board');
  const nextBtn = $('#btn-next-round');
  viewBoard.classList.toggle('hidden', isSolo());
  nextBtn.classList.add('hidden');

  if (isTournament()) {
    viewBoard.onclick = () => {
      uiView = 'tournament-board';
      renderTournamentBoard({
        name: state.teamName,
        squad: `${state.playerDrivers[0]?.year} ${state.playerDrivers[0]?.name?.split(' ').pop()} / ${state.playerChassis?.name}`,
        points: board.playerPts,
        gaffer: isGaffer(),
      });
      render();
    };
    if (board.advanced && (state.tournamentRound || 1) < 3) {
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = `Advance to Round ${(state.tournamentRound || 1) + 1} →`;
      nextBtn.onclick = () => {
        const next = (state.tournamentRound || 1) + 1;
        clearActiveRun();
        state = createTournamentState(state.mode, next);
        uiView = 'game';
        render();
      };
    }
  }

  $('#btn-share').onclick = async () => {
    const text = generateSquadSummaryCard(state, analytics, board);
    try {
      await navigator.clipboard.writeText(text);
      $('#btn-share').textContent = 'COPIED ✓';
      setTimeout(() => {
        $('#btn-share').textContent = 'COPY SQUAD & STATS';
      }, 2000);
    } catch {
      prompt('Copy your results:', text);
    }
  };

  $('#btn-play-again').onclick = () => {
    clearActiveRun();
    const league = state.leagueCode;
    if (isTournament()) {
      state = stampTeam(createTournamentState(state.mode, state.tournamentRound || 1));
      uiView = 'game';
    } else {
      state = stampTeam(createSoloState(state.mode));
      if (league) state.leagueCode = league;
      uiView = 'game';
    }
    render();
  };
}

function renderAnalyticsTabs(analytics, board) {
  const [d1, d2] = analytics.drivers;

  $('#tab-carry').innerHTML = `
    ${
      analytics.carryBadge
        ? `<div class="carry-badge ${analytics.carryBadge.type}">🚨 ${analytics.carryBadge.label}<p>${analytics.carryBadge.text}</p></div>`
        : `<div class="carry-badge balanced">⚖️ BALANCED PAIRING<p>Neither driver dominated the points share.</p></div>`
    }
    <div class="share-bars mt-4">
      <div class="share-row">
        <span>${d1.name}</span>
        <div class="share-track-container">
          <div class="share-track" style="width:${analytics.driver1Share}%"></div>
          <span class="share-percentage mono">${analytics.driver1Share}%</span>
        </div>
      </div>
      <div class="share-row">
        <span>${d2.name}</span>
        <div class="share-track-container">
          <div class="share-track" style="width:${analytics.driver2Share}%"></div>
          <span class="share-percentage mono">${analytics.driver2Share}%</span>
        </div>
      </div>
    </div>
    <div class="performance-chart mt-4">
      <div class="chart-title">Points Distribution</div>
      <div class="chart-bars">
        <div class="chart-bar-group">
          <div class="chart-bar" style="height:${analytics.driver1Share}%; background: var(--cyan);">
            <span class="chart-label">${d1.name.split(' ').pop()}</span>
            <span class="chart-value">${d1.pointsScore}pts</span>
          </div>
        </div>
        <div class="chart-bar-group">
          <div class="chart-bar" style="height:${analytics.driver2Share}%; background: var(--f1red);">
            <span class="chart-label">${d2.name.split(' ').pop()}</span>
            <span class="chart-value">${d2.pointsScore}pts</span>
          </div>
        </div>
      </div>
    </div>
  `;

  $('#tab-h2h').innerHTML = `
    <div class="h2h-grid">
      <div class="h2h-col">
        <strong>${d1.name}</strong>
        <div class="h2h-stats">
          <div class="h2h-stat">
            <span class="stat-value mono big">${d1.wins}</span>
            <span class="stat-label">Wins</span>
          </div>
          <div class="h2h-stat">
            <span class="stat-value mono big">${d1.podiums}</span>
            <span class="stat-label">Podiums</span>
          </div>
          <div class="h2h-stat">
            <span class="stat-value mono big">${d1.dnfs}</span>
            <span class="stat-label">DNFs</span>
          </div>
          <div class="h2h-stat">
            <span class="stat-value mono big">${d1.lapsLed}</span>
            <span class="stat-label">Laps Led</span>
          </div>
          <div class="h2h-stat">
            <span class="stat-value mono big">${d1.fastLaps}</span>
            <span class="stat-label">Fast Laps</span>
          </div>
        </div>
      </div>
      <div class="h2h-vs">
        <div class="vs-badge">VS</div>
        <div class="vs-result">${analytics.headToHeadWinner === 'Dead heat' ? '🤝' : analytics.headToHeadWinner === d1.name ? '🏆' : '🏆'}</div>
      </div>
      <div class="h2h-col">
        <strong>${d2.name}</strong>
        <div class="h2h-stats">
          <div class="h2h-stat">
            <span class="stat-value mono big">${d2.wins}</span>
            <span class="stat-label">Wins</span>
          </div>
          <div class="h2h-stat">
            <span class="stat-value mono big">${d2.podiums}</span>
            <span class="stat-label">Podiums</span>
          </div>
          <div class="h2h-stat">
            <span class="stat-value mono big">${d2.dnfs}</span>
            <span class="stat-label">DNFs</span>
          </div>
          <div class="h2h-stat">
            <span class="stat-value mono big">${d2.lapsLed}</span>
            <span class="stat-label">Laps Led</span>
          </div>
          <div class="h2h-stat">
            <span class="stat-value mono big">${d2.fastLaps}</span>
            <span class="stat-label">Fast Laps</span>
          </div>
        </div>
      </div>
    </div>
    <div class="h2h-summary mt-4">
      <div class="h2h-result-card">
        <span class="result-label">HEAD-TO-HEAD WINNER</span>
        <span class="result-value text-cyan font-bold">${analytics.headToHeadWinner}</span>
        <span class="result-score mono">${analytics.headToHeadScore}</span>
      </div>
    </div>
  `;

  $('#tab-efficiency').innerHTML = `
    <div class="eff-card ${analytics.masterStrategist ? 'glow' : ''}">
      ${analytics.masterStrategist ? '<div class="eff-banner">🧠 MASTER STRATEGIST</div>' : ''}
      <div class="eff-grid">
        <div class="eff-metric">
          <span class="eff-label">Draft Baseline</span>
          <span class="eff-value mono">${analytics.draftBaseline}</span>
        </div>
        <div class="eff-metric">
          <span class="eff-label">Projected Points</span>
          <span class="eff-value mono">${analytics.expectedPts}</span>
        </div>
        <div class="eff-metric">
          <span class="eff-label">Actual Points</span>
          <span class="eff-value mono">${analytics.actualPts}</span>
        </div>
      </div>
      <div class="efficiency-meter mt-4">
        <div class="meter-label">Efficiency Rating</div>
        <div class="meter-bar">
          <div class="meter-fill ${analytics.efficiencyPct >= 0 ? 'positive' : 'negative'}" style="width:${Math.min(100, Math.max(0, 50 + analytics.efficiencyPct))}%"></div>
        </div>
        <div class="meter-value ${analytics.efficiencyPct >= 0 ? 'text-cyan' : 'text-f1red'}">${analytics.efficiencyPct >= 0 ? '+' : ''}${analytics.efficiencyPct}%</div>
      </div>
      <p class="text-sm text-slate mt-2">vs squad baseline projection</p>
    </div>
  `;

  if (isSolo()) {
    $('#tab-cut').innerHTML = '<p class="text-slate text-center">Cut line analysis only available in tournament mode.</p>';
    return;
  }

  const cutRows = [];
  const start = Math.max(0, (board.cutIndex || 12) - 3);
  const end = Math.min(board.entries.length, (board.cutIndex || 12) + 4);
  for (let i = start; i < end; i++) {
    const e = board.entries[i];
    const rank = i + 1;
    if (rank === board.cutIndex + 1) {
      cutRows.push(`<div class="cut-line-banner pulse">${board.cutBanner}</div>`);
    }
    cutRows.push(`
      <div class="cut-row ${e.isPlayer ? 'you' : ''} ${rank > board.cutIndex ? 'eliminated' : ''}">
        <span class="mono">${rank}</span>
        <span>${e.isPlayer ? 'YOU' : e.name}${e.gaffer ? ' 🧠' : ''}</span>
        <span class="mono">${e.points}${e.isPlayer && !board.advanced ? ` (${board.safetyDelta > 0 ? '-' : ''}${Math.abs(board.safetyDelta)})` : ''}</span>
      </div>`);
  }
  if (board.playerRank > end || board.playerRank < start + 1) {
    cutRows.push(`<div class="cut-line-label text-center text-slate text-xs py-1">…</div>`);
    const e = board.entries[board.playerRank - 1];
    cutRows.push(`
      <div class="cut-row you">
        <span class="mono">${board.playerRank}</span>
        <span>YOU${e.gaffer ? ' 🧠' : ''}</span>
        <span class="mono">${e.points}</span>
      </div>`);
  }

  const survivors = board.entries.slice(0, board.cutIndex);
  const eliminated = board.entries.slice(board.cutIndex);
  const survivorNames = survivors.slice(0, 5).map((e) => e.isPlayer ? 'You' : e.name.split(' ')[0]).join(', ');
  const eliminatedNames = eliminated.slice(0, 5).map((e) => e.name.split(' ')[0]).join(', ');

  $('#tab-cut').innerHTML = `
    <div class="cut-header">
      <span>${board.roundName || 'Tournament Clash'}</span>
      <span class="mono">#${board.playerRank || '—'} / ${board.fieldSize || '—'}${isGaffer() ? ' 🧠' : ''}</span>
    </div>
    <div class="bubble-delta ${board.advanced ? 'safe' : 'danger'} mb-3">⚠️ ${board.safetyLabel || ''}</div>
    ${board.playerRank ? `<div class="cut-board">${cutRows.join('')}</div>` : renderLeaderboardHTML(board)}
    <div class="obituary mt-4">
      <div class="obit-col survivors">
        <h4>Survivors</h4>
        <p>${survivorNames}${board.cutIndex > 5 ? `… +${board.cutIndex - 5} more` : ''}</p>
      </div>
      <div class="obit-col eliminated">
        <h4>Eliminated</h4>
        <p>${eliminatedNames}${board.eliminated.length > 5 ? `… +${board.eliminated.length - 5} more` : ''}</p>
      </div>
    </div>
    <p class="mt-3 text-center text-sm ${board.advanced ? 'text-cyan' : 'text-f1red'}">
      ${board.advanced ? '✓ You cleared the cut — Round advance unlocked' : '✗ Below the elimination zone — Quick Restart to climb'}
    </p>
  `;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sleepUntil(startMs, targetMs) {
  const wait = Math.max(0, targetMs - (Date.now() - startMs));
  return sleep(wait);
}

document.addEventListener('click', (e) => {
  if (e.target?.id === 'spin-modal') {
    /* don't dismiss mid-draft */
  }
});

init();

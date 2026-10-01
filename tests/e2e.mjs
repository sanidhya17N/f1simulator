/**
 * End-to-end checks for identity, saved seasons, and multiplayer.
 * Multiplayer is on-device: a second browser does not see a score until a slip is imported.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    snapshot() {
      return new Map(data);
    },
    restore(snap) {
      data.clear();
      for (const [k, v] of snap) data.set(k, v);
    },
  };
}

const store = memoryStorage();
globalThis.localStorage = store;

const storage = await import('../js/storage.js');
const tournament = await import('../js/tournament.js');
const engine = await import('../js/gameEngine.js');
const data = await import('../js/data.js');

function check(id, name, ok, detail = '') {
  results.push({ id, name, ok: !!ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${id}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fresh() {
  store.clear();
}

function garage() {
  const chassis = data.CONSTRUCTORS.find((c) => c.id === 'fer_04');
  const roster = data.getRosterForConstructor(chassis.id);
  const state = engine.createSoloState('classic');
  state.playerChassis = chassis;
  state.playerDrivers = roster.slice(0, 2);
  state.playerPrincipal = data.PRINCIPALS[0];
  state.teamName = 'Apex Racing';
  engine.generateMultiverseGrid(state);
  return state;
}

console.log('\n— Identity (this browser only) —');

fresh();
check('ID-01', 'No saved callsign means no profile', storage.loadProfile() === null);

storage.saveProfile({ callsign: 'Apex', createdAt: 1 });
check('ID-02', 'Callsign is readable after save', storage.loadProfile()?.callsign === 'Apex');

const seasonSnap = store.snapshot();
storage.clearProfile();
check('ID-03', 'Sign-out removes the callsign', storage.loadProfile() === null);
store.restore(seasonSnap);
storage.saveProfile({ callsign: 'Apex', createdAt: 1 });
check('ID-04', 'Sign-out does not wipe the callsign of a different storage copy', storage.loadProfile()?.callsign === 'Apex');

fresh();
storage.saveProfile({ callsign: 'Apex', createdAt: 1 });
const deviceA = store.snapshot();
fresh();
storage.saveProfile({ callsign: 'Bolt', createdAt: 2 });
check('ID-05', 'A second browser profile does not contain Apex', storage.loadProfile()?.callsign === 'Bolt');
store.restore(deviceA);
check('ID-06', 'Returning to the first browser still shows Apex', storage.loadProfile()?.callsign === 'Apex');
check('ID-07', 'The same callsign matches ignoring case', storage.namesMatch(' Apex ', 'apex'));
check('ID-08', 'A different callsign does not match', storage.namesMatch('Apex', 'Bolt') === false);

console.log('\n— Season data tied to the browser, not the callsign —');

fresh();
const run = garage();
run.phase = 'solo-racing';
run.squadStats.totalTeamPoints = 44;
storage.saveState(run);
const loaded = storage.loadState();
check('SE-01', 'An unfinished season reloads', loaded?.phase === 'solo-racing' && loaded.squadStats.totalTeamPoints === 44);
check('SE-02', 'Reloaded grid still has 20 cars', loaded.fullGrid.length === 20);
check('SE-03', 'Saved season has no boss cars', loaded.fullGrid.every((c) => !c.isBoss));

storage.saveProfile({ callsign: 'Apex', createdAt: 1 });
storage.clearProfile();
const afterSignOut = storage.loadState();
check('SE-04', 'Sign-out keeps the season in this browser', afterSignOut?.teamName === 'Apex Racing');

storage.saveProfile({ callsign: 'Bolt', createdAt: 2 });
check(
  'SE-05',
  'A new callsign on the same browser still sees the previous season',
  storage.loadState()?.teamName === 'Apex Racing' && storage.loadProfile()?.callsign === 'Bolt'
);

storage.recordSeasonFinish(loaded);
check('SE-06', 'Finishing a season increments the trophy room', storage.loadTrophyRoom().seasonsPlayed === 1);
storage.clearProfile();
check('SE-07', 'Sign-out keeps trophy history', storage.loadTrophyRoom().seasonsPlayed === 1);

console.log('\n— Multiplayer (local room + slip, not a live server) —');

fresh();
const code = tournament.makeRoomCode();
check('MP-01', 'Room codes are 5 characters', /^[A-Z0-9]{5}$/.test(code));

storage.submitLeagueScore('ab12c', { name: 'Apex', squad: 'F2004', points: 310 });
check('MP-02', 'Room codes are stored in uppercase', storage.loadLeagueScores('AB12C').length === 1);
check('MP-03', 'A different room does not contain that score', storage.loadLeagueScores('OTHER').length === 0);
check('MP-04', 'An empty room code saves nothing', storage.submitLeagueScore('   ', { name: 'X', points: 1 }).length === 0);

const deviceWithScore = store.snapshot();
fresh();
check(
  'MP-05',
  'Another browser with the same room code does not see the score',
  storage.loadLeagueScores('AB12C').length === 0
);

const slip = tournament.formatResultSlip('ab12c', 'Apex', 310, '2004 Schumacher / Ferrari');
const parsed = tournament.parseResultSlip(slip);
check('MP-06', 'A result slip round-trips the room, name, and points', parsed?.code === 'AB12C' && parsed.name === 'Apex' && parsed.points === 310);
check('MP-07', 'A broken slip is rejected', tournament.parseResultSlip('not a slip') === null);
check('MP-08', 'A slip with a missing score is rejected', tournament.parseResultSlip('F1MV|AB12C|Apex|nope|car') === null);

storage.submitLeagueScore(parsed.code, parsed);
const board = tournament.buildPrivateLeague('ab12c', storage.loadLeagueScores('ab12c'), 'Apex');
check('MP-09', 'Importing a slip puts that player on the room board', board.entries.some((e) => e.name === 'Apex' && e.points === 310));
check('MP-10', 'The room still has ghost entries so it is not empty', board.entries.some((e) => e.ghost));
check('MP-11', 'The imported player is marked on the board', board.yourRank > 0);

store.restore(deviceWithScore);
const sameDevice = tournament.buildPrivateLeague('AB12C', storage.loadLeagueScores('AB12C'), 'Apex');
check('MP-12', 'The original browser still has its own copy of the score', sameDevice.entries.some((e) => e.name === 'Apex' && !e.ghost));

const daily = tournament.buildLeaderboardField({ name: 'Apex', squad: 'F2004', points: 400, gaffer: false }, 1);
check('MP-13', 'Daily lobby places the local player in the field', daily.entries.some((e) => e.isPlayer && e.points === 400));
check('MP-14', 'Daily lobby field is ghosts plus the player, not a remote feed', daily.entries.length > 1 && daily.entries.filter((e) => e.isPlayer).length === 1);
check('MP-15', 'Gaffer scoring multiplies constructor points by 1.5', tournament.tournamentPoints(100, true) === 150);
check('MP-16', 'Classic scoring leaves constructor points unchanged', tournament.tournamentPoints(100, false) === 100);

console.log('\n— Race weekend —');

fresh();
const weekend = garage();
weekend.currentRaceIndex = 0;
const quali = engine.computeQualifying(weekend, { tire: 'medium', engine: 'conserve' });
const qualiPos = new Set(quali.order.map((r) => r.gridRank));
check('RC-01', 'Qualifying returns 20 cars', quali.order.length === 20);
check('RC-02', 'Qualifying positions are 1 through 20', qualiPos.size === 20 && Math.min(...qualiPos) === 1 && Math.max(...qualiPos) === 20);

const race = engine.computeRaceFromGrid(weekend, { tire: 'medium', engine: 'conserve' }, quali, 'cover');
check('RC-03', 'The race classification has 20 rows', race.telemetry.classification.length === 20);
check('RC-04', 'Every finisher keeps the qualifying slot they started from', race.performances.every((p) => quali.order.find((q) => q.id === p.id).gridRank === p.gridRank));

const finishers = race.telemetry.classification.filter((r) => !r.dnf);
const legal = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const top = finishers.slice(0, 10).map((r) => r.points);
const rest = finishers.slice(10).map((r) => r.points);
check(
  'RC-05',
  'Points follow the top-ten scale, plus at most one fastest-lap point',
  top.every((p, i) => p === legal[i] || p === legal[i] + 1) &&
    top.filter((p, i) => p === legal[i] + 1).length <= 1 &&
    rest.every((p) => p === 0)
);

engine.applyRaceResult(weekend, race);
check('RC-06', 'Applying the race advances the calendar by one', weekend.currentRaceIndex === 1);
check('RC-07', 'The championship lists all 20 drivers', weekend.championshipStandings.length === 20);
check('RC-08', 'The session display hold is five seconds', engine.SESSION_HOLD_MS === 5000);

let dnfs = 0;
const riskState = garage();
riskState.aggression = 90;
for (let i = 0; i < 80; i++) {
  riskState.currentRaceIndex = i % 10;
  const q = engine.computeQualifying(riskState, { tire: 'soft', engine: 'push' });
  const r = engine.computeRaceFromGrid(riskState, { tire: 'soft', engine: 'push' }, q, 'send');
  if (r.performances.some((p) => p.isPlayer && p.dnf)) dnfs++;
}
check('RC-09', 'A pushed great package can still retire', dnfs > 0, `${dnfs}/80 player-car retirements`);
const rounds = data.SEASON_CALENDAR;
check('RC-10', 'Each season round offers three tyre strategies', rounds.every((t) => engine.strategiesForTrack(t).length === 3));
const spain = engine.strategiesForTrack(rounds.find((t) => t.id === 'esp'));
const monaco = engine.strategiesForTrack(rounds.find((t) => t.id === 'mon'));
check('RC-11', 'Spain includes a two-stop and Monaco stays on one stop', spain.some((p) => p.stops === 2) && monaco.every((p) => p.stops === 1));
check('RC-12', 'The three Spain plans do not share one pace', new Set(spain.map((p) => p.pace)).size === 3);

console.log('\n— Website —');

const port = 8099;
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('server did not start')), 4000);
  child.stdout.on('data', () => {
    clearTimeout(timer);
    resolve();
  });
  child.on('error', reject);
});

async function status(pathname) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`);
  return res.status;
}

check('WEB-01', 'Homepage is served', (await status('/')) === 200);
const health = await fetch(`http://127.0.0.1:${port}/health`);
check('WEB-02', 'Health check answers ok', (await health.json()).ok === true);
check('WEB-03', 'The app script is served', (await status('/js/app.js')) === 200);
check('WEB-04', 'Styles are served', (await status('/css/styles.css')) === 200);
check('WEB-05', 'A missing file is a 404', (await status('/no-such-file')) === 404);
const homeHtml = await (await fetch(`http://127.0.0.1:${port}/`)).text();
check('WEB-06', 'The homepage contains the landing page and paddock login', homeHtml.includes('id="screen-landing"') && homeHtml.includes('id="btn-start-playing"') && homeHtml.includes('id="login-form"'));
check('WEB-07', 'The homepage contains the multiplayer room', homeHtml.includes('id="room-code"') && homeHtml.includes('id="slip-input"'));

child.kill();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log(failed.map((f) => f.id).join(', '));
  process.exit(1);
}

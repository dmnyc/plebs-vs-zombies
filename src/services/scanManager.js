// One zombie scan at a time, owned here instead of by whichever view started
// it. A Hunt scan (your own follows) and a Scout scan (someone else's) are
// either/or: starting one while the other runs asks first, then stops the old
// run. Views read `scanState` reactively, so a scan keeps going (and stays
// stoppable) while the user moves around the app; App.vue shows the collapsed
// progress bar whenever the scan's own view isn't on screen.

import { reactive } from 'vue';
import zombieService from './zombieService';
import scoutService from './scoutService';

export const SCAN_CANCELLED = 'Scan cancelled by user';

const blankProgress = (stage = 'Initializing scan...') => ({
  total: 0,
  processed: 0,
  currentNpub: '',
  stage
});

export const scanState = reactive({
  kind: null, // 'hunt' | 'scout' | null
  status: 'idle', // 'idle' | 'running' | 'done' | 'failed'
  progress: blankProgress(),
  target: null, // scout target profile ({ pubkey, npub, name, ... })
  result: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  seen: true, // false until the user has looked at a finished scan
  prompt: null // { message, resolve } while a replace-confirm is open
});

// Each run gets an id; a run that was stopped or replaced can still resolve
// later (the services stop cooperatively), and its id no longer matching
// keeps it from touching the current state.
let runId = 0;

const isRunning = () => scanState.status === 'running';

function begin(kind, target, stage) {
  runId += 1;
  Object.assign(scanState, {
    kind,
    status: 'running',
    progress: blankProgress(stage),
    target,
    result: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
    seen: false
  });
  return runId;
}

function finish(id, patch) {
  if (id !== runId) return;
  Object.assign(scanState, { finishedAt: Date.now(), ...patch });
}

function reportProgress(id, progress) {
  if (id !== runId) throw new Error(SCAN_CANCELLED);
  scanState.progress = { ...scanState.progress, ...progress };
}

function readBool(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function isScoutJobFor(pubkey) {
  return scanState.kind === 'scout' && !!pubkey && scanState.target?.pubkey === pubkey;
}

export function describeScan() {
  if (scanState.kind === 'scout') {
    const t = scanState.target || {};
    return `scouting ${t.display_name || t.name || 'another user'}`;
  }
  return 'scanning your follows';
}

/**
 * Ask before a new scan replaces a running one.
 * Resolves 'attach' when the running scan already is the requested scout,
 * true when the caller may start (any running scan has been stopped),
 * false when the user chose to keep the current scan.
 */
export function requestStart(kind, target = null) {
  if (!isRunning()) return Promise.resolve(true);
  if (kind === 'scout' && isScoutJobFor(target?.pubkey)) return Promise.resolve('attach');

  const next = kind === 'scout'
    ? `scout ${target?.display_name || target?.name || 'this user'}`
    : 'scan your follows';
  return new Promise((resolve) => {
    scanState.prompt = {
      message: `A scan is already running (${describeScan()}). Only one scan can run at a time — stop it to ${next} instead?`,
      resolve: async (ok) => {
        scanState.prompt = null;
        if (ok) await cancel();
        resolve(ok);
      }
    };
  });
}

/** Scan the signed-in user's follows. Fire-and-forget; watch scanState. */
export function startHunt() {
  const id = begin('hunt', null);
  const createBackup = readBool('autoBackupOnScan', true);
  const enhanced = readBool('useEnhancedScanning', false);
  const method = enhanced ? 'scanForZombiesEnhanced' : 'scanForZombies';
  console.log(`🔍 Using ${enhanced ? 'Enhanced' : 'Standard'} zombie scanning method`);

  return (async () => {
    try {
      const result = await zombieService[method](true, (p) => reportProgress(id, p), createBackup);
      if (result?.success) finish(id, { status: 'done', result });
      else finish(id, { status: 'failed', error: result?.message || 'Unknown error' });
    } catch (error) {
      if (error?.message === SCAN_CANCELLED) return;
      console.error('Zombie scan failed:', error);
      finish(id, { status: 'failed', error: error?.message || 'Unknown error' });
    }
  })();
}

/** Scout someone else's follows. Fire-and-forget; watch scanState. */
export function startScout(target) {
  const id = begin('scout', target, 'Starting scout analysis...');

  return (async () => {
    try {
      const result = await scoutService.scoutUser(target.pubkey, (p) => {
        if (id === runId) scanState.progress = { ...scanState.progress, ...p };
      });
      if (id !== runId || scoutService.cancelled) return;
      if (result?.success) finish(id, { status: 'done', result });
      else finish(id, { status: 'failed', error: result?.message || 'Scout failed' });
    } catch (error) {
      if (id !== runId || scoutService.cancelled) return;
      console.error('Scout scan failed:', error);
      finish(id, { status: 'failed', error: error?.message || 'Scout failed' });
    }
  })();
}

/** Stop the running scan (if any) and clear it. */
export async function cancel() {
  const wasScout = scanState.kind === 'scout' && isRunning();
  runId += 1; // orphan the in-flight run
  clear();
  if (wasScout) await scoutService.forceShutdown();
  console.log('🛑 Scan stopped by user');
}

/** The user has seen the finished scan. */
export function markSeen() {
  scanState.seen = true;
}

/** Forget the current scan entirely (finished or not — call cancel() to stop). */
export function clear() {
  Object.assign(scanState, {
    kind: null,
    status: 'idle',
    progress: blankProgress(),
    target: null,
    result: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    seen: true
  });
}

export default {
  state: scanState,
  requestStart,
  startHunt,
  startScout,
  cancel,
  clear,
  markSeen,
  isScoutJobFor,
  describeScan
};

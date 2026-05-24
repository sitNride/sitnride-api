import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Constants ───────────────────────────────────────────────────────
const MAX_DRIVING_MS = 12 * 60 * 60 * 1000;   // 12 hours
const WARNING_MS    = 10 * 60 * 60 * 1000;     // 10 hours
const REST_REQUIRED_MS = 6 * 60 * 60 * 1000;   // 6 hours rest

const STORAGE_KEY = 'sitnride_driving_timer';

// ─── Persisted state shape ───────────────────────────────────────────
interface TimerState {
  /** Total milliseconds accumulated in previous online sessions (before current) */
  accumulatedMs: number;
  /** ISO timestamp when the current online session started (null = offline) */
  sessionStartTime: string | null;
  /** ISO timestamp when the driver last went offline (null = never) */
  lastOfflineTime: string | null;
}

// ─── Hook return type ────────────────────────────────────────────────
export interface DrivingTimerResult {
  /** Total active driving milliseconds (accumulated + current session) */
  totalActiveMs: number;
  /** Total active driving minutes */
  activeMinutes: number;
  /** Total active driving hours (decimal) */
  activeHours: number;
  /** True when driver has been active 10+ hours */
  isWarning: boolean;
  /** True when driver has reached the 12-hour limit */
  isLimitReached: boolean;
  /** Minutes remaining before the 12-hour limit */
  remainingMinutes: number;
  /** If driver needs rest, how many minutes of rest remain. null if no rest needed. */
  restMinutesRemaining: number | null;
  /** True if the driver is currently in a mandatory rest period */
  isResting: boolean;
  /** Formatted string like "10h 23m" */
  formattedActiveTime: string;
  /** Formatted string like "1h 37m" */
  formattedRemainingTime: string;
  /** Call when driver goes online */
  startSession: () => void;
  /** Call when driver goes offline */
  stopSession: () => void;
  /** Force-reset the timer (e.g. admin override or after rest completes) */
  resetTimer: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────
function loadState(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { accumulatedMs: 0, sessionStartTime: null, lastOfflineTime: null };
}

function saveState(state: TimerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function formatTime(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ─── Hook ────────────────────────────────────────────────────────────
export function useDrivingTimer(isOnline: boolean): DrivingTimerResult {
  const [timerState, setTimerState] = useState<TimerState>(loadState);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check if rest period has elapsed and auto-reset ──
  useEffect(() => {
    const state = loadState();
    if (state.lastOfflineTime && state.accumulatedMs >= MAX_DRIVING_MS) {
      const offlineSince = new Date(state.lastOfflineTime).getTime();
      const restElapsed = Date.now() - offlineSince;
      if (restElapsed >= REST_REQUIRED_MS) {
        // Rest complete — reset timer
        const resetState: TimerState = { accumulatedMs: 0, sessionStartTime: null, lastOfflineTime: null };
        saveState(resetState);
        setTimerState(resetState);
      }
    }
  }, []);

  // ── Tick every second while online ──
  useEffect(() => {
    if (timerState.sessionStartTime) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState.sessionStartTime]);

  // ── Compute total active ms ──
  const currentSessionMs = timerState.sessionStartTime
    ? Math.max(0, now - new Date(timerState.sessionStartTime).getTime())
    : 0;
  const totalActiveMs = Math.min(timerState.accumulatedMs + currentSessionMs, MAX_DRIVING_MS);

  const activeMinutes = Math.floor(totalActiveMs / 60000);
  const activeHours = totalActiveMs / (60 * 60 * 1000);
  const isWarning = totalActiveMs >= WARNING_MS && totalActiveMs < MAX_DRIVING_MS;
  const isLimitReached = totalActiveMs >= MAX_DRIVING_MS;
  const remainingMs = Math.max(0, MAX_DRIVING_MS - totalActiveMs);
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  // ── Rest calculation ──
  let restMinutesRemaining: number | null = null;
  let isResting = false;

  if (isLimitReached && timerState.lastOfflineTime) {
    const offlineSince = new Date(timerState.lastOfflineTime).getTime();
    const restElapsed = now - offlineSince;
    if (restElapsed < REST_REQUIRED_MS) {
      isResting = true;
      restMinutesRemaining = Math.ceil((REST_REQUIRED_MS - restElapsed) / 60000);
    }
  } else if (isLimitReached && !timerState.lastOfflineTime) {
    // Limit reached but hasn't gone offline yet — needs to go offline first
    isResting = false;
    restMinutesRemaining = Math.ceil(REST_REQUIRED_MS / 60000); // full 6 hours
  }

  // ── Start session ──
  const startSession = useCallback(() => {
    setTimerState(prev => {
      // Check if rest period completed (auto-reset)
      if (prev.lastOfflineTime && prev.accumulatedMs >= MAX_DRIVING_MS) {
        const offlineSince = new Date(prev.lastOfflineTime).getTime();
        const restElapsed = Date.now() - offlineSince;
        if (restElapsed >= REST_REQUIRED_MS) {
          const newState: TimerState = {
            accumulatedMs: 0,
            sessionStartTime: new Date().toISOString(),
            lastOfflineTime: null,
          };
          saveState(newState);
          return newState;
        }
        // Still resting — don't start
        return prev;
      }

      // If already in a session, do nothing
      if (prev.sessionStartTime) return prev;

      // Check if previous offline rest was long enough to reset
      if (prev.lastOfflineTime) {
        const offlineSince = new Date(prev.lastOfflineTime).getTime();
        const restElapsed = Date.now() - offlineSince;
        if (restElapsed >= REST_REQUIRED_MS) {
          const newState: TimerState = {
            accumulatedMs: 0,
            sessionStartTime: new Date().toISOString(),
            lastOfflineTime: null,
          };
          saveState(newState);
          return newState;
        }
      }

      const newState: TimerState = {
        ...prev,
        sessionStartTime: new Date().toISOString(),
        lastOfflineTime: null,
      };
      saveState(newState);
      return newState;
    });
    setNow(Date.now());
  }, []);

  // ── Stop session ──
  const stopSession = useCallback(() => {
    setTimerState(prev => {
      const sessionMs = prev.sessionStartTime
        ? Math.max(0, Date.now() - new Date(prev.sessionStartTime).getTime())
        : 0;
      const newState: TimerState = {
        accumulatedMs: Math.min(prev.accumulatedMs + sessionMs, MAX_DRIVING_MS),
        sessionStartTime: null,
        lastOfflineTime: new Date().toISOString(),
      };
      saveState(newState);
      return newState;
    });
    setNow(Date.now());
  }, []);

  // ── Reset timer ──
  const resetTimer = useCallback(() => {
    const newState: TimerState = { accumulatedMs: 0, sessionStartTime: null, lastOfflineTime: null };
    saveState(newState);
    setTimerState(newState);
    setNow(Date.now());
  }, []);

  // ── Auto-stop when limit reached while online ──
  useEffect(() => {
    if (isLimitReached && timerState.sessionStartTime) {
      stopSession();
    }
  }, [isLimitReached, timerState.sessionStartTime, stopSession]);

  // ── Auto-reset when rest period completes ──
  useEffect(() => {
    if (isResting && restMinutesRemaining !== null && restMinutesRemaining <= 0) {
      resetTimer();
    }
  }, [isResting, restMinutesRemaining, resetTimer]);

  // ── Sync with isOnline prop ──
  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      startSession();
    } else if (!isOnline && prevOnlineRef.current) {
      stopSession();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, startSession, stopSession]);

  return {
    totalActiveMs,
    activeMinutes,
    activeHours,
    isWarning,
    isLimitReached,
    remainingMinutes,
    restMinutesRemaining,
    isResting,
    formattedActiveTime: formatTime(totalActiveMs),
    formattedRemainingTime: formatTime(remainingMs),
    startSession,
    stopSession,
    resetTimer,
  };
}

let wakeLock = null;
let audioCtx = null;

function getAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ignore */ }
  }
  return audioCtx;
}

/** 짧은 비프음 */
export function beep(freq = 880, ms = 120, vol = 0.15) {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.value = vol;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

export function vibratePattern() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([180, 80, 180, 80, 240]);
  }
}

export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return null;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    return wakeLock;
  } catch {
    return null;
  }
}

export async function releaseWakeLock() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch { /* ignore */ }
    wakeLock = null;
  }
}

export function alarm(label = '휴식 종료', settings = {}) {
  if (settings.sound !== false) {
    beep(880, 100);
    setTimeout(() => beep(660, 100), 140);
    setTimeout(() => beep(880, 160), 280);
  }
  if (settings.vibrate !== false) vibratePattern();
  if (settings.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(label, { body: '다음 세트 준비!' }); } catch { /* ignore */ }
  }
}

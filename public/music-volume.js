// Music only: YouTube IFrame Player API, never microphone or vehicle gain.
window.createMusicVolume = function ({ storage, notify = () => {}, schedule = setTimeout, cancel = clearTimeout }) {
  const key = 'kc.musicVolume'; // Deliberately outside library and room sync.
  const valid = v => typeof v === 'number' && Number.isFinite(v);
  const normalize = v => Math.round(Math.max(0, Math.min(100, v)));
  let value = 100, chosen = false, player, timer, unmuteRequested = false;
  let status = 'pending';
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (valid(saved)) { value = normalize(saved); chosen = true; }
  } catch { /* denied, malformed or unavailable storage */ }
  const render = () => notify({ value, status });
  function check() {
    try {
      const actual = player.getVolume();
      status = !valid(actual) || Math.abs(actual - value) > 1 ? 'unsupported'
        : player.isMuted() ? 'muted' : 'readback';
    } catch { status = 'unsupported'; }
    render();
  }
  function apply() {
    cancel(timer);
    status = 'pending';
    if (player) {
      try {
        player.setVolume(value);
        // Only an explicit positive slider gesture may clear an existing mute.
        if (unmuteRequested) { player.unMute(); unmuteRequested = false; }
        timer = schedule(check, 350);
      } catch { status = 'unsupported'; }
    }
    render();
  }
  return {
    render,
    choose(v) {
      if (!valid(v)) return;
      value = normalize(v); chosen = true; unmuteRequested = value > 0;
      try { storage.setItem(key, JSON.stringify(value)); } catch { /* memory fallback */ }
      apply();
    },
    ready(p) {
      player = p;
      if (!chosen) {
        try { const actual = p.getVolume(); if (valid(actual) && actual >= 0 && actual <= 100) value = normalize(actual); } catch { /* default 100 */ }
      }
      apply();
    },
    apply
  };
};

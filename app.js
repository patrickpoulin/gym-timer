(() => {
  'use strict';

  const STORAGE_KEY = 'gymTimer.intervals';
  const SEEDED_KEY = 'gymTimer.seeded';

  // Scroller options: 5s steps up to 1 minute. Warm Up / Cool Down can also be off.
  const WORK_TIMES = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);
  const EDGE_TIMES = [0, ...WORK_TIMES];
  const WHEEL_OPTIONS = { high: WORK_TIMES, low: WORK_TIMES, warmup: EDGE_TIMES, cooldown: EDGE_TIMES };
  const MIN_SETS = 1;
  const MAX_SETS = 50;

  const PHASE_LABEL = { warmup: 'Warm Up', high: 'High', low: 'Low', cooldown: 'Cool Down', done: 'Done' };

  const $ = (sel) => document.querySelector(sel);

  // ---------- Storage ----------

  function loadIntervals() {
    try {
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(list)) return list;
    } catch (_) { /* fall through */ }
    return [];
  }

  function saveIntervals(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (_) { /* storage unavailable */ }
  }

  function seedIfFirstRun() {
    try {
      if (localStorage.getItem(SEEDED_KEY)) return;
      localStorage.setItem(SEEDED_KEY, '1');
      if (loadIntervals().length === 0) {
        saveIntervals([{ id: newId(), sets: 3, high: 30, low: 15, warmup: 30, cooldown: 30 }]);
      }
    } catch (_) { /* storage unavailable */ }
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- Formatting ----------

  function shortTime(sec) {
    if (sec === 0) return 'Off';
    if (sec % 60 === 0) return `${sec / 60}m`;
    return `${sec}s`;
  }

  function clockTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function intervalName(iv) {
    return `${shortTime(iv.high)} x ${shortTime(iv.low)} x ${iv.sets}`;
  }

  function totalSeconds(iv) {
    return iv.warmup + iv.sets * (iv.high + iv.low) + iv.cooldown;
  }

  // ---------- Views ----------

  function show(viewId) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === viewId));
    window.scrollTo(0, 0);
  }

  // ---------- List ----------

  function renderList() {
    const list = loadIntervals();
    const ul = $('#interval-list');
    ul.innerHTML = '';
    $('#empty').hidden = list.length > 0;

    for (const iv of list) {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="info">
          <div class="name"><span class="high">${shortTime(iv.high)}</span><span class="x">x</span><span class="low">${shortTime(iv.low)}</span><span class="x">x</span>${iv.sets}</div>
          <div class="meta">${clockTime(totalSeconds(iv))} Total · Warm Up ${shortTime(iv.warmup)} · Cool Down ${shortTime(iv.cooldown)}</div>
        </div>
        <button class="edit">Edit</button>
        <button class="go" aria-label="Start">&#9654;</button>`;
      li.querySelector('.edit').addEventListener('click', (e) => { e.stopPropagation(); openEditor(iv.id); });
      li.querySelector('.go').addEventListener('click', (e) => { e.stopPropagation(); openRunner(iv.id); });
      li.querySelector('.info').addEventListener('click', () => openRunner(iv.id));
      ul.appendChild(li);
    }
  }

  // ---------- Scroll wheel picker ----------

  class Wheel {
    constructor(el, options, onChange) {
      this.el = el;
      this.options = options;
      this.onChange = onChange;
      this.index = 0;
      el.innerHTML = '<div class="pad"></div>' +
        options.map((v) => `<div class="opt">${shortTime(v)}</div>`).join('') +
        '<div class="pad"></div>';
      this.opts = Array.from(el.querySelectorAll('.opt'));
      this.opts.forEach((opt, i) => opt.addEventListener('click', () => this.set(options[i], true)));
      let raf = 0;
      el.addEventListener('scroll', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => this.sync());
      }, { passive: true });
    }

    itemHeight() {
      return this.opts[0].offsetHeight || 44;
    }

    sync() {
      const i = Math.min(this.options.length - 1, Math.max(0, Math.round(this.el.scrollTop / this.itemHeight())));
      if (i !== this.index) {
        this.index = i;
        this.highlight();
        this.onChange();
      }
    }

    highlight() {
      this.opts.forEach((o, i) => o.classList.toggle('sel', i === this.index));
    }

    set(value, smooth) {
      let i = this.options.indexOf(value);
      if (i < 0) i = 0;
      this.index = i;
      this.highlight();
      this.el.scrollTo({ top: i * this.itemHeight(), behavior: smooth ? 'smooth' : 'auto' });
      if (smooth) this.onChange();
    }

    get value() {
      return this.options[this.index];
    }
  }

  // ---------- Editor ----------

  const editor = { id: null, sets: 3, wheels: {} };

  function initEditor() {
    document.querySelectorAll('.wheel').forEach((el) => {
      const key = el.dataset.key;
      editor.wheels[key] = new Wheel(el, WHEEL_OPTIONS[key], updateEditorPreview);
    });
    $('#sets-minus').addEventListener('click', () => changeSets(-1));
    $('#sets-plus').addEventListener('click', () => changeSets(1));
    $('#btn-edit-cancel').addEventListener('click', () => { renderList(); show('view-list'); });
    $('#btn-edit-save').addEventListener('click', saveEditor);
    $('#btn-delete').addEventListener('click', deleteFromEditor);
  }

  function changeSets(delta) {
    editor.sets = Math.min(MAX_SETS, Math.max(MIN_SETS, editor.sets + delta));
    updateEditorPreview();
  }

  function editorValues() {
    const w = editor.wheels;
    return {
      sets: editor.sets,
      high: w.high.value,
      low: w.low.value,
      warmup: w.warmup.value,
      cooldown: w.cooldown.value,
    };
  }

  function updateEditorPreview() {
    const iv = editorValues();
    $('#sets-value').textContent = iv.sets;
    $('#edit-preview').textContent = intervalName(iv);
    $('#edit-total').textContent = clockTime(totalSeconds(iv));
  }

  function openEditor(id) {
    const existing = id ? loadIntervals().find((iv) => iv.id === id) : null;
    const iv = existing || { sets: 3, high: 30, low: 15, warmup: 30, cooldown: 30 };
    editor.id = existing ? existing.id : null;
    editor.sets = iv.sets;
    $('#edit-title').textContent = existing ? 'Edit Interval' : 'New Interval';
    $('#btn-delete').hidden = !existing;
    show('view-edit');
    // Wheels need to be visible before they can scroll to a position.
    for (const key of Object.keys(editor.wheels)) editor.wheels[key].set(iv[key], false);
    updateEditorPreview();
  }

  function saveEditor() {
    const values = editorValues();
    const list = loadIntervals();
    if (editor.id) {
      const i = list.findIndex((iv) => iv.id === editor.id);
      if (i >= 0) list[i] = { ...list[i], ...values };
    } else {
      list.push({ id: newId(), ...values });
    }
    saveIntervals(list);
    renderList();
    show('view-list');
  }

  function deleteFromEditor() {
    if (!editor.id) return;
    if (!confirm(`Delete ${intervalName(editorValues())}?`)) return;
    saveIntervals(loadIntervals().filter((iv) => iv.id !== editor.id));
    renderList();
    show('view-list');
  }

  // ---------- Audio (Web Audio dings, no files needed) ----------

  let audioCtx = null;

  function unlockAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // A silent buffer played inside the tap unlocks audio on iOS.
    const src = audioCtx.createBufferSource();
    src.buffer = audioCtx.createBuffer(1, 1, 22050);
    src.connect(audioCtx.destination);
    src.start(0);
  }

  function ding(at, freq = 1318.5, length = 0.9) {
    const ctx = audioCtx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(0.6, at + 0.005);
    out.gain.exponentialRampToValueAtTime(0.0001, at + length);
    out.connect(ctx.destination);
    // A bell-like tone: fundamental plus a quieter overtone.
    [[freq, 1], [freq * 2.76, 0.25]].forEach(([f, g]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.value = g;
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + length);
    });
  }

  function dings(count, freq) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime + 0.02;
    for (let i = 0; i < count; i++) ding(t + i * 0.28, freq);
  }

  function soundForPhase(type) {
    if (type === 'high') dings(2);           // high intensity: two dings
    else if (type === 'low') dings(1);       // low intensity: one ding
    else if (type === 'cooldown') dings(1, 880);
    else if (type === 'done') dings(3, 988);
  }

  // ---------- Keep the screen awake while running ----------

  let wakeLock = null;

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (_) { /* not supported or denied */ }
  }

  function releaseWakeLock() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  // ---------- Runner ----------

  const run = {
    interval: null,
    phases: [],
    index: 0,
    phaseEnd: 0,        // performance.now() timestamp when the current phase ends
    pausedLeft: null,   // ms left in the phase while paused, null while running
    started: false,
    timer: 0,
  };

  function buildPhases(iv) {
    const phases = [];
    if (iv.warmup > 0) phases.push({ type: 'warmup', dur: iv.warmup });
    for (let s = 1; s <= iv.sets; s++) {
      phases.push({ type: 'high', dur: iv.high, set: s });
      phases.push({ type: 'low', dur: iv.low, set: s });
    }
    if (iv.cooldown > 0) phases.push({ type: 'cooldown', dur: iv.cooldown });
    return phases;
  }

  function openRunner(id) {
    const iv = loadIntervals().find((x) => x.id === id);
    if (!iv) return;
    stopTimer();
    run.interval = iv;
    run.phases = buildPhases(iv);
    resetRun();
    $('#run-name').textContent = intervalName(iv);
    show('view-run');
  }

  function resetRun() {
    stopTimer();
    run.index = 0;
    run.started = false;
    run.pausedLeft = run.phases[0].dur * 1000;
    render();
  }

  function currentPhase() {
    return run.phases[run.index] || { type: 'done', dur: 0 };
  }

  function msLeftInPhase(now = performance.now()) {
    if (run.index >= run.phases.length) return 0;
    return run.pausedLeft != null ? run.pausedLeft : Math.max(0, run.phaseEnd - now);
  }

  function togglePlay() {
    unlockAudio();
    if (run.index >= run.phases.length) {
      resetRun();
      return;
    }
    if (run.pausedLeft != null) {
      // Start or resume.
      if (!run.started) {
        run.started = true;
        soundForPhase(currentPhase().type);
      }
      run.phaseEnd = performance.now() + run.pausedLeft;
      run.pausedLeft = null;
      startTimer();
      requestWakeLock();
    } else {
      run.pausedLeft = Math.max(0, run.phaseEnd - performance.now());
      stopTimer();
      releaseWakeLock();
    }
    render();
  }

  function skipPhase() {
    if (run.index >= run.phases.length) return;
    unlockAudio();
    if (run.pausedLeft != null) {
      // While paused, move to the next phase silently and stay paused.
      run.index++;
      if (run.index >= run.phases.length) finish(false);
      else run.pausedLeft = currentPhase().dur * 1000;
    } else {
      enterPhase(run.index + 1, performance.now(), true);
    }
    render();
  }

  function enterPhase(index, startAt, withSound) {
    run.index = index;
    if (index >= run.phases.length) {
      finish(withSound);
      return;
    }
    run.phaseEnd = startAt + currentPhase().dur * 1000;
    if (withSound) soundForPhase(currentPhase().type);
  }

  function finish(withSound) {
    stopTimer();
    releaseWakeLock();
    run.pausedLeft = null;
    if (withSound) soundForPhase('done');
  }

  function tick() {
    const now = performance.now();
    // Catch up if the page was throttled in the background.
    let advanced = false;
    while (run.index < run.phases.length && now >= run.phaseEnd) {
      const end = run.phaseEnd;
      run.index++;
      advanced = true;
      if (run.index < run.phases.length) run.phaseEnd = end + currentPhase().dur * 1000;
    }
    if (advanced) {
      if (run.index >= run.phases.length) finish(true);
      else soundForPhase(currentPhase().type);
    }
    render();
  }

  function startTimer() {
    stopTimer();
    run.timer = setInterval(tick, 100);
  }

  function stopTimer() {
    clearInterval(run.timer);
    run.timer = 0;
  }

  function render() {
    const phase = currentPhase();
    const done = run.index >= run.phases.length;
    const left = msLeftInPhase() / 1000;
    const iv = run.interval;

    const view = $('#view-run');
    view.className = `view run active phase-${run.started || done ? phase.type : 'ready'}`;

    $('#run-phase').textContent = !run.started && !done ? 'Ready' : PHASE_LABEL[phase.type];
    $('#run-clock').textContent = done ? '0:00' : clockTime(left);
    $('#run-sets').textContent = phase.set ? `Set ${phase.set} of ${iv.sets}` : (done ? 'Great Work' : '');

    let remaining = left;
    for (let i = run.index + 1; i < run.phases.length; i++) remaining += run.phases[i].dur;
    const total = totalSeconds(iv);
    $('#run-remaining').textContent = clockTime(remaining);
    $('#run-progress').style.width = `${total ? (1 - remaining / total) * 100 : 0}%`;

    const running = run.pausedLeft == null && !done;
    $('#btn-play').textContent = done ? 'Again' : running ? 'Pause' : run.started ? 'Resume' : 'Start';
  }

  function closeRunner() {
    stopTimer();
    releaseWakeLock();
    renderList();
    show('view-list');
  }

  // ---------- Wire up ----------

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && run.timer) {
      requestWakeLock();
      tick();
    }
  });

  $('#btn-add').addEventListener('click', () => openEditor(null));
  $('#btn-play').addEventListener('click', togglePlay);
  $('#btn-skip').addEventListener('click', skipPhase);
  $('#btn-reset').addEventListener('click', () => { releaseWakeLock(); resetRun(); });
  $('#btn-run-close').addEventListener('click', closeRunner);
  $('#btn-run-edit').addEventListener('click', () => {
    const id = run.interval && run.interval.id;
    stopTimer();
    releaseWakeLock();
    openEditor(id);
  });

  seedIfFirstRun();
  initEditor();
  renderList();
})();

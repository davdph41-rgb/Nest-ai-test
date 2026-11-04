// Asisten Suara: satu file, membuat tampilannya sendiri.
// Di index.html cukup: <script src="voice.js"></script>
(() => {
  'use strict';

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const simpanLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const bacaLS = (k, d) => {
    try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
    catch (e) { return d; }
  };

  const S = {
    state: 'idle',            // idle | listening | thinking | speaking
    aktif: false,             // percakapan sedang berjalan
    diam: 0,                  // hitungan hening berturut-turut
    percakapan: bacaLS('vx_percakapan', true),
    rate: bacaLS('vx_rate', 1),
    voiceName: bacaLS('vx_voice', ''),
    riwayat: bacaLS('vx_riwayat', []),   // [{role:'user'|'model', text}]
  };
  let token = 0;              // naik tiap berhenti, untuk membatalkan proses yang tertunda
  let dapatHasil = false;
  let voices = [];

  /* ---------- Tampilan ---------- */
  const css = `
  :root{--vx-bg:#ffffff;--vx-fg:#111827;--vx-card:#f3f4f6;--vx-line:#e5e7eb;--vx-acc:#4f46e5}
  @media (prefers-color-scheme:dark){:root{--vx-bg:#0f172a;--vx-fg:#e5e7eb;--vx-card:#1e293b;--vx-line:#334155}}
  .vx-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:56px;height:56px;border-radius:50%;border:0;font-size:26px;cursor:grab;background:var(--vx-acc);color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.4);z-index:99998;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;animation:vx-float 3s ease-in-out infinite}
  .vx-fab.vx-drag{animation:none;cursor:grabbing;transform:scale(1.15);box-shadow:0 10px 26px rgba(0,0,0,.5)}
  @keyframes vx-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
  .vx-panel{position:fixed;inset:0;z-index:99999;display:none;flex-direction:column;background:var(--vx-bg);color:var(--vx-fg);font-family:system-ui,-apple-system,sans-serif;padding:env(safe-area-inset-top,0px) 14px calc(10px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
  .vx-panel.open{display:flex}
  .vx-panel *{box-sizing:border-box}
  .vx-head{display:flex;justify-content:space-between;align-items:center;padding:12px 0}
  .vx-x{border:0;background:var(--vx-card);color:var(--vx-fg);width:36px;height:36px;border-radius:50%;font-size:16px;cursor:pointer}
  #vx-wave{width:100%;height:84px;display:block}
  .vx-status{text-align:center;font-size:14px;min-height:22px;padding:4px 0 8px;opacity:.85}
  .vx-log{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:6px 2px}
  .vx-log:empty::before{content:"Tekan 🎤 lalu mulai bicara";margin:auto;opacity:.5;font-size:14px}
  .vx-b{max-width:82%;padding:9px 13px;border-radius:16px;font-size:15px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
  .vx-u{align-self:flex-end;background:var(--vx-acc);color:#fff;border-bottom-right-radius:4px}
  .vx-a{align-self:flex-start;background:var(--vx-card);border-bottom-left-radius:4px}
  .vx-e{align-self:center;background:#fee2e2;color:#991b1b;font-size:13px}
  .vx-ctrl{display:flex;justify-content:center;padding:12px 0 6px}
  .vx-mic{width:68px;height:68px;border-radius:50%;border:0;font-size:30px;cursor:pointer;background:var(--vx-acc);color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.3)}
  .vx-mic.on{background:#dc2626}
  .vx-row{display:flex;align-items:center;gap:8px;justify-content:center;font-size:14px;padding:4px 0}
  .vx-set{font-size:14px;padding:6px 0}
  .vx-set summary{cursor:pointer;text-align:center;opacity:.8}
  .vx-set label{display:block;margin-top:10px}
  .vx-set select,.vx-set input[type=range]{width:100%;margin-top:4px}
  .vx-set select{padding:8px;border-radius:8px;border:1px solid var(--vx-line);background:var(--vx-card);color:var(--vx-fg)}
  .vx-btns{display:flex;gap:8px;margin-top:12px}
  .vx-btns button{flex:1;padding:9px;border-radius:10px;border:1px solid var(--vx-line);background:var(--vx-card);color:var(--vx-fg);cursor:pointer;font-size:13px}
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const fab = document.createElement('button');
  fab.className = 'vx-fab';
  fab.setAttribute('aria-label', 'Buka asisten suara');
  fab.textContent = '🎙️';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'vx-panel';
  panel.innerHTML =
    '<div class="vx-head"><b>🎙️ Asisten Suara</b><button class="vx-x" id="vx-tutup" aria-label="Tutup">✕</button></div>' +
    '<canvas id="vx-wave"></canvas>' +
    '<div class="vx-status" id="vx-status"></div>' +
    '<div class="vx-log" id="vx-log"></div>' +
    '<div class="vx-ctrl"><button class="vx-mic" id="vx-mic" aria-label="Mic">🎤</button></div>' +
    '<label class="vx-row"><input type="checkbox" id="vx-perc"> Mode percakapan otomatis</label>' +
    '<details class="vx-set"><summary>⚙️ Pengaturan suara</summary>' +
    '<label>Suara<select id="vx-suara"></select></label>' +
    '<label>Kecepatan bicara: <span id="vx-rv"></span><input type="range" id="vx-rate" min="0.7" max="1.4" step="0.1"></label>' +
    '<div class="vx-btns"><button id="vx-tes">🔈 Tes suara</button><button id="vx-hapus">🗑️ Hapus riwayat</button></div>' +
    '</details>';
  document.body.appendChild(panel);

  const $ = (id) => panel.querySelector('#' + id);
  const canvas = $('vx-wave');
  const statusEl = $('vx-status');
  const logEl = $('vx-log');
  const micBtn = $('vx-mic');
  const percEl = $('vx-perc');
  const suaraEl = $('vx-suara');
  const rateEl = $('vx-rate');
  const rateVal = $('vx-rv');

  percEl.checked = !!S.percakapan;
  rateEl.value = S.rate;
  rateVal.textContent = Number(S.rate).toFixed(1) + 'x';

  /* ---------- Bubble & riwayat ---------- */
  function tambahBubble(role, teks) {
    const b = document.createElement('div');
    b.className = 'vx-b ' + (role === 'user' ? 'vx-u' : role === 'error' ? 'vx-e' : 'vx-a');
    b.textContent = teks;
    logEl.appendChild(b);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function simpanRiwayat(role, text) {
    S.riwayat.push({ role, text });
    if (S.riwayat.length > 40) S.riwayat = S.riwayat.slice(-40);
    simpanLS('vx_riwayat', S.riwayat);
    // Kabar untuk script lain (mis. chat utama): document.addEventListener('voice-message', ...)
    document.dispatchEvent(new CustomEvent('voice-message', { detail: { role, text } }));
  }

  S.riwayat.forEach((m) => tambahBubble(m.role === 'user' ? 'user' : 'ai', m.text));

  /* ---------- Status & animasi gelombang ---------- */
  const LABEL = {
    idle: 'Tekan 🎤 untuk mulai',
    listening: '🎧 Mendengarkan...',
    thinking: '🤔 Berpikir...',
    speaking: '🔊 Berbicara...',
  };
  const WARNA = { idle: '#94a3b8', listening: '#22c55e', thinking: '#f59e0b', speaking: '#6366f1' };
  const AMP = { idle: 0.05, listening: 0.5, thinking: 0.25, speaking: 0.85 };

  function setState(s, teks) {
    S.state = s;
    statusEl.textContent = teks || LABEL[s];
    micBtn.textContent = S.aktif ? '⏹' : '🎤';
    micBtn.classList.toggle('on', S.aktif);
  }

  const ctx = canvas.getContext('2d');
  let t = 0;
  let rafId = 0;
  function gambar() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    t += 0.05;
    const n = 36, gap = w / n, amp = AMP[S.state];
    ctx.fillStyle = WARNA[S.state];
    for (let i = 0; i < n; i++) {
      const v = S.state === 'thinking'
        ? 0.5 + 0.5 * Math.sin(t * 3 - i * 0.45)
        : Math.abs(Math.sin(t * 2 + i * 0.6) * Math.cos(t * 1.1 + i * 0.3));
      const bar = 3 + (h - 6) * amp * v;
      ctx.fillRect(i * gap + gap * 0.2, (h - bar) / 2, gap * 0.6, bar);
    }
  }
  function loop() { gambar(); rafId = requestAnimationFrame(loop); }

  /* ---------- Suara (text to speech) ---------- */
  function muatSuara() {
    voices = speechSynthesis.getVoices();
    const id = voices.filter((v) => v.lang.toLowerCase().startsWith('id'));
    const lain = voices.filter((v) => !v.lang.toLowerCase().startsWith('id'));
    const daftar = [...id, ...lain];
    suaraEl.innerHTML = '';
    if (!daftar.length) {
      const o = document.createElement('option');
      o.textContent = 'Suara bawaan perangkat';
      suaraEl.appendChild(o);
      return;
    }
    daftar.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.name;
      o.textContent = v.name + ' (' + v.lang + ')';
      suaraEl.appendChild(o);
    });
    const pilih = daftar.find((v) => v.name === S.voiceName) || id[0] || daftar[0];
    suaraEl.value = pilih.name;
  }
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = muatSuara;
    muatSuara();
  }

  function bersihkan(teks) {
    return String(teks)
      .replace(/https?:\/\/\S+/g, '')
      .replace(/^\s*[-•]\s+/gm, '')
      .replace(/[*#`_>~|]/g, '');
  }

  function bicara(teks) {
    return new Promise((selesai) => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(bersihkan(teks));
      const v = voices.find((x) => x.name === suaraEl.value);
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'id-ID'; }
      u.rate = Number(S.rate) || 1;
      u.onend = () => selesai();
      u.onerror = () => selesai();
      speechSynthesis.speak(u);
    });
  }

  /* ---------- Kirim ke api/chat.js ---------- */
  async function tanyaAI(teks) {
    let password = localStorage.getItem('app_password');
    if (!password) {
      password = prompt('Masukkan password:');
      if (!password) throw new Error('Password dibatalkan');
      localStorage.setItem('app_password', password);
    }

    const petunjuk = '[Jawab dalam 1-3 kalimat, bahasa Indonesia santai, tanpa format markdown.] ';
    const konteks = S.riwayat.slice(-20).map((m) => ({ role: m.role, text: m.text }));
    while (konteks.length && konteks[0].role !== 'user') konteks.shift();

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: password,
        messages: [...konteks, { role: 'user', text: petunjuk + teks }],
      }),
    });

    let data = {};
    try { data = await res.json(); } catch (e) {}

    if (res.status === 401) {
      localStorage.removeItem('app_password');
      throw new Error('Password salah. Tekan 🎤 dan coba lagi untuk memasukkan ulang.');
    }
    const jawaban = String(data.text || '');
    if (!res.ok || !jawaban) throw new Error(jawaban || 'Server error ' + res.status);

    simpanRiwayat('user', teks);
    simpanRiwayat('model', jawaban);
    return jawaban;
  }

  /* ---------- Alur percakapan ---------- */
  const rec = SR ? new SR() : null;

  function mulaiDengar() {
    if (!S.aktif || !rec) return;
    try { rec.start(); } catch (e) { /* sudah berjalan */ }
  }

  function berhenti(pesan) {
    token++;
    S.aktif = false;
    S.diam = 0;
    if (rec) { try { rec.abort(); } catch (e) {} }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setState('idle', pesan);
  }

  async function proses(teks) {
    if (!teks) { if (S.aktif && S.percakapan) setTimeout(mulaiDengar, 300); return; }
    const saya = token;
    tambahBubble('user', teks);
    setState('thinking');

    let jawaban;
    try {
      jawaban = await tanyaAI(teks);
    } catch (err) {
      if (saya !== token) return;
      tambahBubble('error', err.message);
      S.aktif = false;
      setState('idle', 'Gagal: ' + err.message);
      return;
    }
    if (saya !== token) return;

    tambahBubble('ai', jawaban);
    setState('speaking');
    await bicara(jawaban);
    if (saya !== token) return;

    if (S.aktif && S.percakapan) {
      setTimeout(mulaiDengar, 400);   // dengarkan lagi setelah AI selesai bicara
    } else {
      S.aktif = false;
      setState('idle');
    }
  }

  if (rec) {
    rec.lang = 'id-ID';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => { dapatHasil = false; setState('listening'); };

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
      }
      if (interim) statusEl.textContent = '🎧 ' + interim;
      if (final) { dapatHasil = true; S.diam = 0; proses(final.trim()); }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // ditangani onend
      S.aktif = false;
      const info = e.error === 'not-allowed' ? ' (izinkan mikrofon di pengaturan browser)' : '';
      setState('idle', 'Error mic: ' + e.error + info);
    };

    rec.onend = () => {
      if (dapatHasil) return;                 // proses() yang melanjutkan
      if (S.aktif && S.percakapan && S.state === 'listening') {
        S.diam++;
        if (S.diam >= 3) {
          berhenti('Tidak terdengar suara, percakapan dihentikan. Tekan 🎤 untuk mulai lagi.');
          return;
        }
        setTimeout(mulaiDengar, 300);
      } else if (S.state === 'listening') {
        S.aktif = false;
        setState('idle');
      }
    };
  } else {
    micBtn.disabled = true;
    statusEl.textContent = 'Browser tidak mendukung suara. Pakai Chrome.';
  }

  /* ---------- Kontrol ---------- */
  micBtn.addEventListener('click', () => {
    if (!rec) return;
    if (S.aktif) { berhenti(); return; }
    S.aktif = true;
    S.diam = 0;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setState('listening', 'Menyiapkan mic...');
    mulaiDengar();
  });

  percEl.addEventListener('change', () => {
    S.percakapan = percEl.checked;
    simpanLS('vx_percakapan', S.percakapan);
  });

  suaraEl.addEventListener('change', () => {
    S.voiceName = suaraEl.value;
    simpanLS('vx_voice', S.voiceName);
  });

  rateEl.addEventListener('input', () => {
    S.rate = Number(rateEl.value);
    rateVal.textContent = S.rate.toFixed(1) + 'x';
    simpanLS('vx_rate', S.rate);
  });

  $('vx-tes').addEventListener('click', async () => {
    if (S.aktif) berhenti();
    setState('speaking');
    await bicara('Halo, ini suara asisten kamu. Bagaimana, sudah enak didengar?');
    if (!S.aktif) setState('idle');
  });

  $('vx-hapus').addEventListener('click', () => {
    S.riwayat = [];
    simpanLS('vx_riwayat', S.riwayat);
    logEl.innerHTML = '';
  });

  /* ---------- Tombol mengambang yang bisa digeser ---------- */
  const MARGIN = 8;
  const ukuran = () => fab.offsetWidth || 56;

  function taruhFab(x, y) {
    const maxX = window.innerWidth - ukuran() - MARGIN;
    const maxY = window.innerHeight - ukuran() - MARGIN;
    const px = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, maxX));
    const py = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, maxY));
    fab.style.left = px + 'px';
    fab.style.top = py + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    return { x: px, y: py };
  }

  const posisiSimpan = bacaLS('vx_fab', null);
  if (posisiSimpan) taruhFab(posisiSimpan.x, posisiSimpan.y);

  window.addEventListener('resize', () => {
    if (fab.style.left) taruhFab(parseFloat(fab.style.left), parseFloat(fab.style.top));
  });

  let drag = null;
  let geser = false;

  fab.addEventListener('pointerdown', (e) => {
    const r = fab.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY };
    geser = false;
    try { fab.setPointerCapture(e.pointerId); } catch (err) {}
  });

  fab.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!geser && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return; // anggap klik biasa
    geser = true;
    fab.classList.add('vx-drag');
    taruhFab(e.clientX - drag.dx, e.clientY - drag.dy);
  });

  const lepas = () => {
    if (!drag) return;
    drag = null;
    fab.classList.remove('vx-drag');
    if (geser) {
      const r = fab.getBoundingClientRect();
      simpanLS('vx_fab', { x: r.left, y: r.top });
    }
  };
  fab.addEventListener('pointerup', lepas);
  fab.addEventListener('pointercancel', lepas);

  fab.addEventListener('click', () => {
    if (geser) { geser = false; return; }   // habis digeser, jangan buka panel
    panel.classList.add('open');
    setState('idle');
    if (!rafId) loop();
  });

  $('vx-tutup').addEventListener('click', () => {
    berhenti();
    panel.classList.remove('open');
    cancelAnimationFrame(rafId);
    rafId = 0;
  });

  setState('idle');
})();

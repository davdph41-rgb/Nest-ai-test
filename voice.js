const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const mic = document.getElementById('mic');
const statusEl = document.getElementById('status');
const kamuEl = document.getElementById('kamu');
const aiEl = document.getElementById('ai');

if (!mic) {
  console.error('Tombol dengan id="mic" tidak ditemukan di index.html');
} else if (!SR) {
  statusEl.textContent = 'Browser tidak mendukung suara. Pakai Chrome.';
  mic.disabled = true;
} else {
  const rec = new SR();
  rec.lang = 'id-ID';
  rec.interimResults = false;
  let mendengar = false;

  mic.addEventListener('click', () => {
    speechSynthesis.cancel(); // hentikan suara AI kalau masih bicara
    if (mendengar) {
      rec.stop();
      return;
    }
    try {
      rec.start();
      mendengar = true;
      statusEl.textContent = '🎧 Mendengarkan... (tekan lagi untuk berhenti)';
    } catch (err) {
      statusEl.textContent = 'Gagal mulai: ' + err.message;
    }
  });

  rec.onend = () => {
    mendengar = false;
  };

  rec.onresult = async (e) => {
    const teks = e.results[0][0].transcript;
    kamuEl.textContent = 'Kamu: ' + teks;
    statusEl.textContent = '🤔 Berpikir...';
    try {
      const jawaban = await tanyaAI(teks);
      aiEl.textContent = 'AI: ' + jawaban;
      statusEl.textContent = '🔊 Berbicara...';
      bicara(jawaban);
    } catch (err) {
      statusEl.textContent = 'Gagal: ' + err.message;
    }
  };

  rec.onerror = (e) => {
    mendengar = false;
    statusEl.textContent = 'Error mic: ' + e.error;
  };
}

async function tanyaAI(teks) {
  let password = localStorage.getItem('app_password');
  if (!password) {
    password = prompt('Masukkan password:');
    if (!password) throw new Error('Password dibatalkan');
    localStorage.setItem('app_password', password);
  }

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-password': password,
    },
    body: JSON.stringify({ message: teks, password: password }),
  });

  const data = await res.json();
  console.log('Balasan server:', res.status, data);

  const jawaban =
    data.reply || data.text || data.response || data.answer ||
    data.message || data.error || JSON.stringify(data);

  if (String(jawaban).toLowerCase().includes('password salah')) {
    localStorage.removeItem('app_password'); // supaya ditanya ulang
  }

  return String(jawaban);
}

function bicara(teks) {
  const bersih = String(teks).replace(/[*#`_>-]/g, ''); // buang simbol markdown
  const u = new SpeechSynthesisUtterance(bersih);
  u.lang = 'id-ID';
  u.rate = 1;
  u.onend = () => (statusEl.textContent = 'Tekan 🎤 untuk bicara lagi');
  speechSynthesis.speak(u);
}

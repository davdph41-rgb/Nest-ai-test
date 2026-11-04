const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const mic = document.getElementById('mic');
const statusEl = document.getElementById('status');
const kamuEl = document.getElementById('kamu');
const aiEl = document.getElementById('ai');

if (!SR) {
  statusEl.textContent = 'Browser tidak mendukung suara. Pakai Chrome.';
  mic.disabled = true;
} else {
  const rec = new SR();
  rec.lang = 'id-ID';
  rec.interimResults = false;

  mic.onclick = () => {
    speechSynthesis.cancel();      // hentikan suara AI kalau masih bicara
    rec.start();
    statusEl.textContent = '🎧 Mendengarkan...';
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

  rec.onerror = (e) => (statusEl.textContent = 'Error mic: ' + e.error);
}

async function tanyaAI(teks) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: teks,
      // tambahkan juga password/header kalau chat.js-mu memintanya
    }),
  });
  const data = await res.json();
  return data.reply;
}

function bicara(teks) {
  const bersih = teks.replace(/[*#`_>-]/g, ''); // buang simbol markdown
  const u = new SpeechSynthesisUtterance(bersih);
  u.lang = 'id-ID';
  u.rate = 1;
  u.onend = () => (statusEl.textContent = 'Tekan 🎤 untuk bicara lagi');
  speechSynthesis.speak(u);
}

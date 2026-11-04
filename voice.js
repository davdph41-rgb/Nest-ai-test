async function tanyaAI(teks) {
  let password = localStorage.getItem('app_password');
  if (!password) {
    password = prompt('Masukkan password:');
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

  if (data.error === 'Password salah' || data.reply === 'Password salah') {
    localStorage.removeItem('app_password'); // supaya ditanya ulang
  }

  return String(
    data.reply || data.text || data.response || data.answer || data.message ||
    data.error || JSON.stringify(data)
  );
}

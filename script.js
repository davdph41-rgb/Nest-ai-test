const chat = document.getElementById("chat");
const input = document.getElementById("input");
const password = document.getElementById("password");
const sendBtn = document.getElementById("send");

const KEY_MSG = "chat_messages";
const KEY_PASS = "chat_password";
const KEY_THEME = "chat_theme";
const MAX_CONTEXT = 30; // jumlah pesan terakhir yang dikirim ke AI

let messages = [];

function store(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
function read(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

// Tema
const savedTheme = read(KEY_THEME);
const startTheme =
  savedTheme ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
document.documentElement.dataset.theme = startTheme;

document.getElementById("theme").onclick = () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store(KEY_THEME, next);
};

// Password tersimpan
password.value = read(KEY_PASS) || "";
password.oninput = () => store(KEY_PASS, password.value);

// Riwayat
function saveMessages() {
  store(KEY_MSG, JSON.stringify(messages.slice(-100)));
}

function add(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

try {
  messages = JSON.parse(read(KEY_MSG)) || [];
} catch (e) {
  messages = [];
}
messages.forEach((m) => add(m.role, m.text));

document.getElementById("clear").onclick = () => {
  if (!confirm("Hapus semua riwayat chat?")) return;
  messages = [];
  chat.innerHTML = "";
  saveMessages();
};

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  messages.push({ role: "user", text });
  add("user", text);

  // Ambil pesan terakhir; pastikan diawali pesan user
  let context = messages.slice(-MAX_CONTEXT);
  while (context.length && context[0].role !== "user") context.shift();

  const typing = add("ai", "...");
  sendBtn.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: context, password: password.value }),
    });
    const data = await res.json();
    typing.textContent = data.text;

    if (res.ok) {
      messages.push({ role: "ai", text: data.text });
    } else {
      messages.pop(); // gagal: jangan simpan pesan ini ke riwayat
    }
  } catch (e) {
    typing.textContent = "Gagal terhubung.";
    messages.pop();
  }

  saveMessages();
  sendBtn.disabled = false;
}

sendBtn.onclick = send;
input.onkeydown = (e) => e.key === "Enter" && send();

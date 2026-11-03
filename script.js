const chat = document.getElementById("chat");
const input = document.getElementById("input");
const password = document.getElementById("password");
const sendBtn = document.getElementById("send");
let messages = [];

function add(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  chat.appendChild(div);
  div.scrollIntoView();
  return div;
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  messages.push({ role: "user", text });
  add("user", text);

  const typing = add("ai", "...");
  sendBtn.disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, password: password.value }),
    });
    const data = await res.json();
    typing.textContent = data.text;
    messages.push({ role: "ai", text: data.text });
  } catch (e) {
    typing.textContent = "Gagal terhubung.";
  }
  sendBtn.disabled = false;
}

sendBtn.onclick = send;
input.onkeydown = (e) => e.key === "Enter" && send();

const chat = document.getElementById("chat");
const input = document.getElementById("input");
const password = document.getElementById("password");
const sendBtn = document.getElementById("send");
const attachBtn = document.getElementById("attach");
const fileInput = document.getElementById("file");
const preview = document.getElementById("preview");

const KEY_MSG = "chat_messages";
const KEY_PASS = "chat_password";
const KEY_THEME = "chat_theme";
const MAX_CONTEXT = 30; // jumlah pesan terakhir yang dikirim ke AI

let messages = [];
let pendingImage = null; // { mimeType, data, url }
let busy = false;

function store(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
function read(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

// ---------- Gaya tambahan (format teks, gambar, tombol salin) ----------
const extraCss = `
.msg.ai.md{white-space:normal}
.msg p{margin:0 0 .6em}
.msg p:last-child{margin-bottom:0}
.msg ul,.msg ol{margin:.3em 0 .6em;padding-left:1.4em}
.msg h3,.msg h4,.msg h5,.msg h6{margin:.6em 0 .3em;font-size:1em}
.msg code{background:rgba(127,127,127,.2);padding:1px 5px;border-radius:5px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em}
.msg .codewrap{position:relative;margin:.5em 0}
.msg pre{margin:0;padding:12px;border-radius:10px;background:rgba(127,127,127,.18);overflow-x:auto;white-space:pre}
.msg pre code{background:none;padding:0}
.msg .copy{position:absolute;top:6px;right:6px;font-size:11px;padding:3px 8px;border-radius:6px;border:0;cursor:pointer;opacity:.85}
.msg a{color:inherit;text-decoration:underline}
.msg .md-img{display:block;max-width:220px;max-height:220px;border-radius:10px;margin-bottom:6px}
.msg .img-note{opacity:.75;font-size:.9em;margin-bottom:4px}
.preview{display:flex;align-items:center;gap:10px;padding:6px 10px}
.preview[hidden]{display:none!important}
.preview img{height:56px;width:56px;object-fit:cover;border-radius:8px}
.preview button{border:0;border-radius:50%;width:26px;height:26px;cursor:pointer}
#attach{flex:0 0 auto}
`;
const styleEl = document.createElement("style");
styleEl.textContent = extraCss;
document.head.appendChild(styleEl);

// ---------- Format teks (markdown sederhana, aman dari HTML liar) ----------
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(p) {
  return p
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*\n]*)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

function inline(s) {
  // s sudah di-escape; bagian `kode` tidak diformat lagi
  return s
    .split(/(`[^`\n]+`)/g)
    .map((p, i) => (i % 2 ? "<code>" + p.slice(1, -1) + "</code>" : fmt(p)))
    .join("");
}

function blocks(text) {
  const lines = text.split("\n");
  let out = "";
  let list = null;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      out += "<p>" + para.map((l) => inline(esc(l))).join("<br>") + "</p>";
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out +=
        "<" + list.tag + ">" +
        list.items.map((x) => "<li>" + inline(esc(x)) + "</li>").join("") +
        "</" + list.tag + ">";
      list = null;
    }
  };

  for (const line of lines) {
    let m;
    if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
      flushPara();
      if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      flushPara();
      if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
      flushPara();
      flushList();
      const n = Math.min(m[1].length + 2, 6);
      out += "<h" + n + ">" + inline(esc(m[2])) + "</h" + n + ">";
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out;
}

function renderMarkdown(src) {
  const parts = String(src).split("```");
  let html = "";
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // blok kode (yang belum ditutup saat streaming juga ditampilkan sebagai kode)
      const nl = part.indexOf("\n");
      let code = part;
      if (nl >= 0 && /^[\w+#.-]*$/.test(part.slice(0, nl).trim())) code = part.slice(nl + 1);
      html +=
        '<div class="codewrap"><button class="copy" type="button">Salin</button><pre><code>' +
        esc(code.replace(/\n$/, "")) +
        "</code></pre></div>";
    } else {
      html += blocks(part);
    }
  });
  return html;
}

// Tombol "Salin" pada blok kode
chat.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest(".copy");
  if (!btn) return;
  const code = btn.parentElement.querySelector("pre");
  const teks = code ? code.innerText : "";
  const ok = () => { btn.textContent = "Tersalin ✓"; setTimeout(() => (btn.textContent = "Salin"), 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(teks).then(ok, () => {});
  }
});

// ---------- Tema ----------
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

// ---------- Password tersimpan ----------
password.value = read(KEY_PASS) || "";
password.oninput = () => store(KEY_PASS, password.value);

// ---------- Riwayat ----------
function saveMessages() {
  store(KEY_MSG, JSON.stringify(messages.slice(-100)));
}

function add(role, text, opts) {
  opts = opts || {};
  const div = document.createElement("div");
  div.className = "msg " + role + (role === "ai" ? " md" : "");

  if (role === "ai") {
    div.innerHTML = renderMarkdown(text);
  } else {
    if (opts.imgUrl) {
      const im = new Image();
      im.src = opts.imgUrl;
      im.className = "md-img";
      div.appendChild(im);
    } else if (opts.hasImage) {
      const note = document.createElement("div");
      note.className = "img-note";
      note.textContent = "🖼️ gambar";
      div.appendChild(note);
    }
    if (text) div.appendChild(document.createTextNode(text));
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

try {
  messages = JSON.parse(read(KEY_MSG)) || [];
} catch (e) {
  messages = [];
}
messages.forEach((m) => add(m.role, m.text, { hasImage: m.hasImage }));

document.getElementById("clear").onclick = () => {
  if (!confirm("Hapus semua riwayat chat?")) return;
  messages = [];
  chat.innerHTML = "";
  saveMessages();
};

// ---------- Lampiran gambar ----------
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak bisa dibaca")); };
    im.src = url;
  });
}

// Perkecil gambar supaya cepat terkirim dan muat di batas server
async function prepareImage(file) {
  const im = await fileToImage(file);
  const tries = [[1280, 0.85], [1024, 0.7], [800, 0.6]];
  for (const [maxSide, q] of tries) {
    const scale = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.max(1, Math.round(im.naturalWidth * scale));
    const h = Math.max(1, Math.round(im.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(im, 0, 0, w, h);
    const url = c.toDataURL("image/jpeg", q);
    const data = url.split(",")[1];
    if (data.length < 3000000) return { mimeType: "image/jpeg", data, url };
  }
  throw new Error("Gambar terlalu besar");
}

function showPreview() {
  if (!preview) return;
  preview.innerHTML = "";
  if (!pendingImage) { preview.hidden = true; return; }
  const im = new Image();
  im.src = pendingImage.url;
  const x = document.createElement("button");
  x.type = "button";
  x.textContent = "✕";
  x.title = "Hapus gambar";
  x.onclick = clearImage;
  preview.appendChild(im);
  preview.appendChild(x);
  preview.hidden = false;
}

function clearImage() {
  pendingImage = null;
  if (fileInput) fileInput.value = "";
  showPreview();
}

if (attachBtn && fileInput) {
  attachBtn.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      pendingImage = await prepareImage(file);
      showPreview();
    } catch (e) {
      pendingImage = null;
      showPreview();
      alert(e.message || "Gagal memproses gambar");
    }
  };
}

// ---------- Kirim pesan (jawaban muncul bertahap) ----------
function setBusy(v) {
  busy = v;
  sendBtn.disabled = v;
  if (attachBtn) attachBtn.disabled = v;
}

async function send() {
  if (busy) return;
  const img = pendingImage;
  let text = input.value.trim();
  if (!text && !img) return;
  if (!text && img) text = "Jelaskan gambar ini.";

  input.value = "";
  clearImage();

  messages.push({ role: "user", text, hasImage: !!img });
  add("user", text, { imgUrl: img && img.url });

  // Ambil pesan terakhir; pastikan diawali pesan user
  let context = messages.slice(-MAX_CONTEXT).map((m, i, arr) => ({
    role: m.role,
    text: m.hasImage && i !== arr.length - 1 ? "[Pengguna mengirim gambar] " + m.text : m.text,
  }));
  while (context.length && context[0].role !== "user") context.shift();

  const typing = add("ai", "...");
  setBusy(true);

  let acc = "";
  let raf = 0;
  const paint = () => {
    raf = 0;
    typing.innerHTML = renderMarkdown(acc);
    chat.scrollTop = chat.scrollHeight;
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: context,
        password: password.value,
        stream: true,
        image: img ? { mimeType: img.mimeType, data: img.data } : undefined,
      }),
    });

    if (!res.ok) {
      let pesan = "Terjadi kesalahan.";
      try { const d = await res.json(); pesan = d.text || pesan; } catch (e) {}
      typing.textContent = pesan;
      messages.pop(); // gagal: jangan simpan pesan ini ke riwayat
    } else {
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          if (!raf) raf = requestAnimationFrame(paint);
        }
        acc += dec.decode();
      } else {
        acc = await res.text();
      }
      if (raf) cancelAnimationFrame(raf);

      if (acc.trim()) {
        paint();
        messages.push({ role: "ai", text: acc });
      } else {
        typing.textContent = "Tidak ada jawaban.";
        messages.pop();
      }
    }
  } catch (e) {
    if (raf) cancelAnimationFrame(raf);
    if (acc.trim()) {
      // koneksi putus di tengah jawaban: simpan bagian yang sudah diterima
      paint();
      messages.push({ role: "ai", text: acc });
    } else {
      typing.textContent = "Gagal terhubung.";
      messages.pop();
    }
  }

  saveMessages();
  setBusy(false);
}

sendBtn.onclick = send;
input.onkeydown = (e) => {
  if (e.key === "Enter") send();
};

// Jembatan untuk voice.js: percakapan suara masuk ke riwayat chat yang sama
window.chatBridge = {
  getMessages: () => messages,
  addMessage(role, text) {
    messages.push({ role, text });
    add(role, text);
    saveMessages();
  },
  clear() {
    messages = [];
    chat.innerHTML = "";
    saveMessages();
  },
};

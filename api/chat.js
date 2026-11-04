const PRIMARY_MODEL   = "gemini-3.5-flash";
const FALLBACK_MODEL  = "gemini-3.5-flash-lite";
const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]); // layak dicoba ulang
const MAX_IMAGE_BASE64 = 4000000;

function buildUrl(model, stream, key) {
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;
  return stream
    ? `${base}:streamGenerateContent?alt=sse&key=${key}`
    : `${base}:generateContent?key=${key}`;
}

async function callModel(model, payload, stream, key) {
  return fetch(buildUrl(model, stream, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, password, stream, image } = req.body || {};
  if (password !== process.env.APP_PASSWORD) {
    return res.status(401).json({ text: "Password salah" });
  }

  const contents = (messages || []).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  // Gambar (opsional) ditempelkan ke pesan user yang terakhir
  if (image) {
    const okTipe = typeof image.mimeType === "string" && image.mimeType.startsWith("image/");
    const okData = typeof image.data === "string" && image.data.length > 0;
    if (!okTipe || !okData) {
      return res.status(400).json({ text: "Format gambar tidak valid" });
    }
    if (image.data.length > MAX_IMAGE_BASE64) {
      return res.status(413).json({ text: "Gambar terlalu besar" });
    }
    const last = contents[contents.length - 1];
    if (last && last.role === "user") {
      last.parts.unshift({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }
  }

  const key = process.env.GEMINI_API_KEY;
  const payload = { contents };
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];

  // =================== MODE BIASA (JSON utuh) ===================
  if (!stream) {
    let lastErrMsg = "Tidak ada jawaban";

    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      let upstream;
      try {
        upstream = await callModel(m, payload, false, key);
      } catch (e) {
        lastErrMsg = "Server error: " + e.message;
        continue; // error jaringan → coba model berikutnya
      }

      try {
        const data = await upstream.json();
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("");

        if (upstream.ok && text) {
          if (m === FALLBACK_MODEL) console.warn(`[fallback] ${PRIMARY_MODEL} gagal, dipakai ${FALLBACK_MODEL}`);
          res.setHeader("X-Model-Used", m);
          return res.json({ text });
        }

        lastErrMsg = data?.error?.message || "Tidak ada jawaban";

        // Kalau error tidak bisa diulang (misal 400) → jangan lanjut ke fallback
        if (!RETRIABLE_STATUS.has(upstream.status)) break;
      } catch (e) {
        lastErrMsg = "Server error: " + e.message;
      }
    }

    return res.status(502).json({ text: lastErrMsg });
  }

  // =================== MODE STREAMING ===================
  // Cari upstream yang sehat dulu SEBELUM mulai mengirim ke klien.
  // Kalau primary gagal di fase ini, masih aman untuk coba fallback.
  let upstream = null;
  let usedModel = null;
  let lastErrMsg = "Terjadi kesalahan pada AI";

  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    let up;
    try {
      up = await callModel(m, payload, true, key);
    } catch (e) {
      lastErrMsg = "Server error: " + e.message;
      if (i === models.length - 1) return res.status(500).json({ text: lastErrMsg });
      continue;
    }

    if (!up.ok) {
      let pesan = "Terjadi kesalahan pada AI";
      try {
        const d = await up.json();
        pesan = d?.error?.message || pesan;
      } catch (e) {}
      lastErrMsg = pesan;

      // Hanya coba fallback kalau statusnya retriable
      if (RETRIABLE_STATUS.has(up.status) && i < models.length - 1) {
        console.warn(`[fallback] ${m} gagal (${up.status}), coba model berikutnya…`);
        continue;
      }
      return res.status(502).json({ text: pesan });
    }

    upstream = up;
    usedModel = m;
    break;
  }

  if (!upstream) return res.status(502).json({ text: lastErrMsg });

  let mulai = false;
  const kirim = (teks) => {
    if (!mulai) {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Model-Used": usedModel,
      });
      mulai = true;
    }
    res.write(teks);
  };

  try {
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const json = line.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const d = JSON.parse(json);
          const t = (d?.candidates?.[0]?.content?.parts || [])
            .map((p) => p.text || "")
            .join("");
          if (t) kirim(t);
        } catch (e) { /* abaikan potongan yang bukan JSON utuh */ }
      }
    }
  } catch (e) {
    if (!mulai) return res.status(500).json({ text: "Server error: " + e.message });
    res.write("\n\n[Koneksi terputus]");
    return res.end();
  }

  if (!mulai) return res.status(502).json({ text: "Tidak ada jawaban" });
  res.end();
};

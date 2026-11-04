const MODEL = "gemini-3.5-flash-lite";
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;
const MAX_IMAGE_BASE64 = 4000000; // batas aman (body Vercel maks ~4,5 MB)

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
  const url = stream
    ? `${BASE}:streamGenerateContent?alt=sse&key=${key}`
    : `${BASE}:generateContent?key=${key}`;

  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });
  } catch (e) {
    return res.status(500).json({ text: "Server error: " + e.message });
  }

  // ---------- Mode biasa (dipakai asisten suara): balasan JSON utuh ----------
  if (!stream) {
    try {
      const data = await upstream.json();
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("");
      if (!upstream.ok || !text) {
        return res.status(502).json({ text: data?.error?.message || "Tidak ada jawaban" });
      }
      return res.json({ text });
    } catch (e) {
      return res.status(500).json({ text: "Server error: " + e.message });
    }
  }

  // ---------- Mode streaming: teruskan potongan teks begitu datang ----------
  if (!upstream.ok) {
    let pesan = "Terjadi kesalahan pada AI";
    try {
      const d = await upstream.json();
      pesan = d?.error?.message || pesan;
    } catch (e) {}
    return res.status(502).json({ text: pesan });
  }

  let mulai = false;
  const kirim = (teks) => {
    if (!mulai) {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
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
        } catch (e) {
          /* abaikan potongan yang bukan JSON utuh */
        }
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

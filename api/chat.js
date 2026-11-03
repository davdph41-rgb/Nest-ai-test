const MODEL = "gemini-3.5-flash-lite";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, password } = req.body || {};
  if (password !== process.env.APP_PASSWORD) {
    return res.status(401).json({ text: "Password salah" });
  }

  const contents = (messages || []).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      }
    );
    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.error?.message ||
      "Tidak ada jawaban";
    res.json({ text });
  } catch (e) {
    res.status(500).json({ text: "Server error: " + e.message });
  }
};

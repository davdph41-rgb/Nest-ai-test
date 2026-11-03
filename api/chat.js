export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'API Key belum diset di server Vercel.' });
    }

    try {
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: message }] }]
            })
        });

        const data = await apiResponse.json();

        if (data.error) {
            return res.status(500).json({ error: `Gemini Error: ${data.error.message}` });
        }

        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            const aiReply = data.candidates[0].content.parts[0].text;
            return res.status(200).json({ reply: aiReply });
        } else {
            return res.status(500).json({ error: 'Struktur respons API tidak dikenali.' });
        }
    } catch (error) {
        return res.status(500).json({ error: `Server Error: ${error.message}` });
    }
}

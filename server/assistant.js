// server/assistant.js
const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildProfileContext(user) {
  if (!user) return "No user profile available.";

  // Keep it short + non-sensitive. Expand if you store onboarding answers.
  // Example fields you might store: age_range, employment, insurance, goals, interests
  const parts = [
    user.name ? `Name: ${user.name}` : null,
    user.persona ? `Learning profile: ${user.persona}` : null,
    user.age_range ? `Age range: ${user.age_range}` : null,
    user.employment ? `Employment: ${user.employment}` : null,
    user.insurance ? `Current insurance: ${user.insurance}` : null,
    user.goals ? `Goals: ${user.goals}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join("\n") : "User has not completed onboarding yet.";
}

router.post("/chat", async (req, res) => {
  try {
    // Require login (session-based)
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Not signed in." });
    }

    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message." });
    }

    const user = req.session.user; // <-- assumes you store user object in session at login
    const profile = buildProfileContext(user);

    const safeHistory = Array.isArray(history)
      ? history.slice(-12).map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: String(m.content || "").slice(0, 2000),
        }))
      : [];

    const system = `
You are Smart Health Finance AI Assistant for young adults (18–34).
You explain HSAs, insurance terms, preventive care, and budgeting in plain language.
Use the user's profile context below to personalize examples and recommendations.

Important:
- Educational guidance only. Not medical or financial advice.
- Encourage checking plan documents and contacting insurer/provider billing when needed.
- Avoid collecting sensitive identifiers (SSN, full address, etc).
- If asked for medical diagnosis or urgent safety issues, advise appropriate professional help.

User profile:
${profile}
`.trim();

    // Responses API (recommended by OpenAI SDK)
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        ...safeHistory,
        { role: "user", content: message }
      ]
    });

    // Extract text output (SDK returns structured output)
    const text =
      response.output_text ||
      (response.output?.[0]?.content?.[0]?.text ?? "Sorry — I couldn't generate a response.");

    res.json({ reply: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Assistant error." });
  }
});

module.exports = router;
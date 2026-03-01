const express = require("express");
const db = require("./db");
const { createUser, verifyUser, getUserById } = require("./auth");
const { requireAuth } = require("./middleware");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY});

const router = express.Router();

/* ===== AUTH ===== */
router.post("/auth/signup", async (req, res) => {
  try {
    const { email, name, password } = req.body || {};
    if (!email || !name || !password) return res.status(400).json({ error: "Missing fields" });
    if (String(password).length < 8) return res.status(400).json({ error: "Password must be 8+ characters" });

    const user = await createUser({ email, name, password });
    req.session.userId = user.id;
    res.json({ user });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  const user = await verifyUser({ email, password });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  req.session.userId = user.id;
  res.json({ user });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  if (!req.session?.userId) return res.json({ user: null });
  const user = getUserById(req.session.userId);
  res.json({ user: user || null });
});

/* ===== ONBOARDING (store form) ===== */
router.post("/onboarding", requireAuth, (req, res) => {
  const { ageRange, employment, insurance, incomeComfort, topics } = req.body || {};
  const topicsJson = JSON.stringify(Array.isArray(topics) ? topics : []);

  db.prepare(`
    INSERT INTO onboarding (user_id, age_range, employment, insurance, income_comfort, topics)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      age_range=excluded.age_range,
      employment=excluded.employment,
      insurance=excluded.insurance,
      income_comfort=excluded.income_comfort,
      topics=excluded.topics,
      updated_at=datetime('now')
  `).run(req.session.userId, ageRange || null, employment || null, insurance || null, incomeComfort || null, topicsJson);

  res.json({ ok: true });
});

router.get("/onboarding", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM onboarding WHERE user_id = ?").get(req.session.userId);
  res.json({ onboarding: row || null });
});

/* ===== BUDGET (save + compute simple estimate) ===== */
router.post("/budget", requireAuth, (req, res) => {
  const b = req.body || {};
  const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const i = (x) => (Number.isFinite(parseInt(x, 10)) ? parseInt(x, 10) : 0);
  const round2 = (x) => Math.round(x * 100) / 100;

  const monthlyPremium = n(b.monthlyPremium);
  const meds = n(b.meds);
  const primaryVisitsPerYear = i(b.primaryVisitsPerYear);
  const specialistVisitsPerYear = i(b.specialistVisitsPerYear);
  const copayPrimary = n(b.copayPrimary);
  const copaySpecialist = n(b.copaySpecialist);
  const emergencyBufferTarget = n(b.emergencyBufferTarget);

  const expectedCopaysYear =
    (primaryVisitsPerYear * copayPrimary) +
    (specialistVisitsPerYear * copaySpecialist);

  const computedMonthlyEstimate = round2(monthlyPremium + meds + (expectedCopaysYear / 12));

  db.prepare(`
    INSERT INTO budget (
      user_id, monthly_premium, meds, primary_visits_per_year, specialist_visits_per_year,
      copay_primary, copay_specialist, emergency_buffer_target, computed_monthly_estimate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      monthly_premium=excluded.monthly_premium,
      meds=excluded.meds,
      primary_visits_per_year=excluded.primary_visits_per_year,
      specialist_visits_per_year=excluded.specialist_visits_per_year,
      copay_primary=excluded.copay_primary,
      copay_specialist=excluded.copay_specialist,
      emergency_buffer_target=excluded.emergency_buffer_target,
      computed_monthly_estimate=excluded.computed_monthly_estimate,
      updated_at=datetime('now')
  `).run(
    req.session.userId,
    monthlyPremium, meds, primaryVisitsPerYear, specialistVisitsPerYear,
    copayPrimary, copaySpecialist, emergencyBufferTarget, computedMonthlyEstimate
  );

  res.json({ ok: true, computedMonthlyEstimate });
});

router.get("/budget", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM budget WHERE user_id = ?").get(req.session.userId);
  res.json({ budget: row || null });
});

/* ===== HSA (save + compute) ===== */
router.post("/hsa", requireAuth, (req, res) => {
  const h = req.body || {};
  const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, parseInt(x, 10) || 0));
  const round2 = (x) => Math.round(x * 100) / 100;

  const coverageType = String(h.coverageType || "unknown");
  const annualLimit = n(h.annualLimit);
  const currentBalance = n(h.currentBalance);
  const monthlySelf = n(h.monthlyContribSelf);
  const monthlyEmployer = n(h.monthlyContribEmployer);
  const investPercent = clampInt(h.investPercent, 0, 100);
  const expectedAnnualExpenses = n(h.expectedAnnualExpenses);
  const strategyNotes = String(h.strategyNotes || "");

  // Simple derived numbers
  const plannedAnnualContrib = (monthlySelf + monthlyEmployer) * 12;
  const remainingRoom = Math.max(0, annualLimit - plannedAnnualContrib);

  db.prepare(`
    INSERT INTO hsa (
      user_id, coverage_type, annual_limit, current_balance,
      monthly_contrib_self, monthly_contrib_employer,
      invest_percent, expected_annual_expenses, strategy_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      coverage_type=excluded.coverage_type,
      annual_limit=excluded.annual_limit,
      current_balance=excluded.current_balance,
      monthly_contrib_self=excluded.monthly_contrib_self,
      monthly_contrib_employer=excluded.monthly_contrib_employer,
      invest_percent=excluded.invest_percent,
      expected_annual_expenses=excluded.expected_annual_expenses,
      strategy_notes=excluded.strategy_notes,
      updated_at=datetime('now')
  `).run(
    req.session.userId,
    coverageType, annualLimit, currentBalance,
    monthlySelf, monthlyEmployer,
    investPercent, expectedAnnualExpenses, strategyNotes
  );

  res.json({
    ok: true,
    computed: {
      plannedAnnualContrib: round2(plannedAnnualContrib),
      remainingRoom: round2(remainingRoom)
    }
  });
});

router.get("/hsa", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM hsa WHERE user_id = ?").get(req.session.userId);
  res.json({ hsa: row || null });
});

/* ===== AI ASSISTANT (OpenAI) ===== */
router.post("/assistant/chat", requireAuth, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set on the server." });
    }

    const { message, history } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message." });
    }

    // Pull user + onboarding so responses can be personalized
    const user = getUserById(req.session.userId);
    const onboarding = db.prepare("SELECT * FROM onboarding WHERE user_id = ?").get(req.session.userId) || null;
    const budget = db.prepare("SELECT * FROM budget WHERE user_id = ?").get(req.session.userId) || null;

    const profileLines = [];
    if (user?.name) profileLines.push(`Name: ${user.name}`);
    if (onboarding?.age_range) profileLines.push(`Age range: ${onboarding.age_range}`);
    if (onboarding?.employment) profileLines.push(`Employment: ${onboarding.employment}`);
    if (onboarding?.insurance) profileLines.push(`Current insurance: ${onboarding.insurance}`);
    if (onboarding?.income_comfort) profileLines.push(`Income comfort: ${onboarding.income_comfort}`);

    // topics is stored as JSON string
    let topics = [];
    try { topics = onboarding?.topics ? JSON.parse(onboarding.topics) : []; } catch { topics = []; }
    if (Array.isArray(topics) && topics.length) profileLines.push(`Topics they want help with: ${topics.join(", ")}`);

    if (budget?.computed_monthly_estimate != null) {
      profileLines.push(`Budget: estimated monthly healthcare cost ~$${budget.computed_monthly_estimate}`);
    }

    const profile = profileLines.length ? profileLines.join("\n") : "No onboarding/budget info saved yet.";

    // Sanitize history
    const safeHistory = Array.isArray(history)
      ? history.slice(-12).map(m => ({
          role: m?.role === "user" ? "user" : "assistant",
          content: String(m?.content || "").slice(0, 2000),
        }))
      : [];

    const system = `
You are Smart Health Finance AI Assistant for young adults (18–34).
You explain HSAs, insurance terms, preventive care, and budgeting in plain language.
Personalize examples using the user's saved profile below.

Rules:
- Educational guidance only — not medical or financial advice.
- If asked for urgent medical help or emergencies, advise contacting appropriate professionals/services.
- Do NOT ask for or store sensitive identifiers (SSN, full address, etc).
- Be specific: give 1–3 concrete steps, plus a short example using their profile when possible.
- If the user hasn’t provided info needed, ask 1 short follow-up question.

User profile:
${profile}
`.trim();

    const resp = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        ...safeHistory,
        { role: "user", content: message }
      ]
    });

    const reply =
      resp.output_text ||
      resp.output?.[0]?.content?.[0]?.text ||
      "Sorry — I couldn’t generate a response.";

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Assistant error." });
  }
});

/* ===== COMPARE (save + compute) ===== */

function computeYearly({ expected, plan }) {
  const allowedSpend = Number(expected.allowedSpend || 0);
  const primaryVisits = parseInt(expected.primaryVisits || 0, 10);
  const specialistVisits = parseInt(expected.specialistVisits || 0, 10);

  const premiumYear = Number(plan.premiumMonthly || 0) * 12;
  const copaysYear =
    (primaryVisits * Number(plan.copayPrimary || 0)) +
    (specialistVisits * Number(plan.copaySpecialist || 0));

  const deductible = Number(plan.deductible || 0);
  const coinsuranceRate = Math.max(0, Math.min(1, Number(plan.coinsurancePct || 0) / 100));
  const oopMax = Number(plan.oopMax || 0);

  // Member cost for "allowed spend":
  // pay deductible first, then coinsurance on remaining.
  const afterDeductible = Math.max(0, allowedSpend - deductible);
  const memberMedical = deductible + (coinsuranceRate * afterDeductible);

  // Cap medical spend at OOP max (copays often count toward OOP, we approximate by capping combined)
  const memberMedicalCapped = oopMax > 0 ? Math.min(oopMax, memberMedical + copaysYear) : (memberMedical + copaysYear);

  const totalYearly = premiumYear + memberMedicalCapped;

  const breakdown =
    `Premiums ${Math.round(premiumYear).toLocaleString()} + care ${Math.round(memberMedicalCapped).toLocaleString()} (incl. copays)`;

  return { totalYearly: Math.round(totalYearly), breakdown };
}

function comparePlans(payload) {
  const expected = payload.expected || {};
  const planA = payload.planA || {};
  const planB = payload.planB || {};

  const a = computeYearly({ expected, plan: planA });
  const b = computeYearly({ expected, plan: planB });

  const diff = Math.abs(a.totalYearly - b.totalYearly);
  let winner = "Tie";
  if (a.totalYearly < b.totalYearly) winner = "Plan A looks cheaper";
  if (b.totalYearly < a.totalYearly) winner = "Plan B looks cheaper";

  const why =
    winner === "Tie"
      ? `Both plans estimate about the same yearly cost (difference ≈ $${diff}). Consider network and benefits next.`
      : `${winner} by about $${diff}. This estimate uses your expected spend + visits and each plan’s premium/deductible/coinsurance/OOP max.`;

  return { planA: a, planB: b, winner, why };
}

router.post("/compare/calc", requireAuth, (req, res) => {
  const payload = req.body || {};
  const result = comparePlans(payload);
  res.json({ ok: true, result });
});

router.post("/compare", requireAuth, (req, res) => {
  const payload = req.body || {};
  const result = comparePlans(payload);

  db.prepare(`
    INSERT INTO compare (user_id, data_json, last_result_json)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      data_json=excluded.data_json,
      last_result_json=excluded.last_result_json,
      updated_at=datetime('now')
  `).run(
    req.session.userId,
    JSON.stringify(payload),
    JSON.stringify(result)
  );

  res.json({ ok: true, result });
});

router.get("/compare", requireAuth, (req, res) => {
  const row = db.prepare("SELECT data_json, last_result_json FROM compare WHERE user_id = ?")
    .get(req.session.userId);

  if (!row) return res.json({ compare: null });

  let compare = null;
  try {
    compare = JSON.parse(row.data_json || "{}");
    compare.lastResult = row.last_result_json ? JSON.parse(row.last_result_json) : null;
  } catch {
    compare = null;
  }

  res.json({ compare });
});

module.exports = router;
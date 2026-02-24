const express = require("express");
const db = require("./db");
const { createUser, verifyUser, getUserById } = require("./auth");
const { requireAuth } = require("./middleware");

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

module.exports = router;
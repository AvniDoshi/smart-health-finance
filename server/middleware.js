function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: "Not signed in" });
  next();
}

module.exports = { requireAuth };
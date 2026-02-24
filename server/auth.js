const bcrypt = require("bcrypt");
const db = require("./db");

async function createUser({ email, name, password }) {
  const password_hash = await bcrypt.hash(password, 12);
  const stmt = db.prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)");
  const info = stmt.run(email.toLowerCase().trim(), name.trim(), password_hash);
  return { id: info.lastInsertRowid, email, name };
}

async function verifyUser({ email, password }) {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, email: row.email, name: row.name };
}

function getUserById(id) {
  return db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(id);
}

module.exports = { createUser, verifyUser, getUserById };
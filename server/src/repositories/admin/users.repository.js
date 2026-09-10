/* ==========================================================================
   NEXUS TECH — Repositório de usuários (Admin)
   SQL 100% parametrizado (padrão do projeto). Nenhuma senha em texto puro.
   ========================================================================== */

const { pool } = require("../../config/db");

const SAFE_COLUMNS = "id, name, email, role, is_active, created_at";

/* Busca por email (INCLUI password_hash — uso interno de autenticação). */
async function findByEmail(email) {
  const [rows] = await pool.query(
    "SELECT id, name, email, password_hash, role, is_active, created_at FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

/* Busca por id SEM password_hash (nunca expor hash em respostas). */
async function findSafeById(id) {
  const [rows] = await pool.query(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/* Cria ou atualiza (upsert) o administrador inicial. role/is_active fixos. */
async function upsertAdmin({ email, name, passwordHash }) {
  const existing = await findByEmail(email);
  if (existing) {
    await pool.query(
      `UPDATE users
         SET name = ?, password_hash = ?, role = 'admin', is_active = 1,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, passwordHash, existing.id]
    );
    return { id: existing.id, created: false };
  }

  const [result] = await pool.query(
    "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)",
    [name, email, passwordHash]
  );
  return { id: result.insertId, created: true };
}

module.exports = { findByEmail, findSafeById, upsertAdmin };
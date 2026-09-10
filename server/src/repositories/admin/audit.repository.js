/* ==========================================================================
   NEXUS TECH — Repositório de auditoria (admin_actions)
   Registra quem, o quê, quando e os estados antes/depois de cada ação.
   NUNCA registra senha, hash, token ou refresh token (o chamador controla).
   ========================================================================== */

const { pool } = require("../../config/db");

const MAX_PAYLOAD = 12000; // proteção contra JSON gigante na coluna

function toJson(value) {
  if (value === null || value === undefined) return null;
  let str = null;
  try {
    str = JSON.stringify(value);
  } catch (err) {
    str = null;
  }
  if (str && str.length > MAX_PAYLOAD) str = str.slice(0, MAX_PAYLOAD);
  return str;
}

async function insert({ adminId, action, entity, entityId = null, before = null, after = null, ip = null }) {
  const [result] = await pool.query(
    `INSERT INTO admin_actions
       (admin_id, action, entity, entity_id, before_data, after_data, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      adminId,
      action,
      entity,
      entityId || null,
      toJson(before),
      toJson(after),
      ip || null,
    ]
  );
  return result.insertId;
}

module.exports = { insert };
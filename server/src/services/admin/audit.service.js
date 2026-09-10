/* ==========================================================================
   NEXUS TECH — Serviço de auditoria (Admin)
   Wrapper best-effort: falhas de auditoria NUNCA derrubam a operação
   principal (autenticação/mutação).
   ========================================================================== */

const auditRepository = require("../../repositories/admin/audit.repository");

/* eslint-disable no-console */
async function log({ adminId, action, entity = "auth", entityId = null, before = null, after = null, ip = null }) {
  try {
    await auditRepository.insert({ adminId, action, entity, entityId, before, after, ip });
  } catch (err) {
    console.error(`[auditoria] falha ao registrar '${action}': ${err.message}`);
  }
}

module.exports = { log };
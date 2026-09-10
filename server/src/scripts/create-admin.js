/* ==========================================================================
   NEXUS TECH — Seed do administrador inicial (Admin)
   Uso: npm run seed:admin   (na pasta server/)
   - Refusa execução sem ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD e os
     secrets JWT configurados (nada de valores padrão no código).
   - Gera o hash bcrypt em runtime; insere/atualiza o admin (role=admin,
     is_active=1). NUNCA imprime senha ou hash; nenhum valor sai no seed.sql.
   ========================================================================== */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const usersRepository = require("../repositories/admin/users.repository");

const { pool } = require("../config/db");

const REQUIRED_VARS = [
  "ADMIN_EMAIL",
  "ADMIN_NAME",
  "ADMIN_PASSWORD",
  "ADMIN_JWT_SECRET",
  "ADMIN_REFRESH_SECRET",
];

function fail(message) {
  console.error(`[seed:admin] ${message}`);
  process.exit(1);
}

async function main() {
  for (const key of REQUIRED_VARS) {
    const value = process.env[key];
    if (!value || String(value).trim() === "") {
      fail(`Variável obrigatória ausente ou vazia: ${key}. Configure o .env e repita.`);
    }
  }

  const email = String(process.env.ADMIN_EMAIL).trim().toLowerCase();
  const name = String(process.env.ADMIN_NAME).trim();
  const password = String(process.env.ADMIN_PASSWORD);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("ADMIN_EMAIL não parece um e-mail válido.");
  if (name.length === 0) fail("ADMIN_NAME não pode ser vazio.");
  if (password.length < 8) {
    console.warn("[seed:admin] Aviso: senha curta (recomendado >= 8 caracteres).");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { id, created } = await usersRepository.upsertAdmin({
    email,
    name,
    passwordHash,
  });

  console.log(
    `[seed:admin] ${created ? "Criado" : "Atualizado"} usuário admin id=${id} (${email}) — role=admin, is_active=1.`
  );
  console.log("[seed:admin] Senha e hash nunca são impressos. Nenhum valor sensível foi persistido fora do password_hash criptografado.");

  await pool.end();
}

main().catch((err) => {
  console.error("[seed:admin] Falha:", err.message);
  process.exit(1);
});
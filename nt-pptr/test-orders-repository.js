/* ==========================================================================
   NEXUS TECH — FASE 9-B · Suite de REPOSITÓRIO/banco de pedidos
   (sem endpoint, sem servidor, sem navegador — fala direto com o banco).

   Valida o checkpoint 9-B:
    1  schema (orders/order_items existem, FKs, UNIQUE, índices, CHECK)
    2  insert de order válido (todos os campos + snapshot de endereço)
    3  insert de order_items
    4  lookup por user_id (ownership)
    5  lookup por id + user_id (isolamento: B não vê pedido de A)
    6  consulta de produtos para montar pedido (preço/ativo/estoque do banco)
    7  decremento atômico/condicional (suficiente / insuficiente / sem negativar)
    8  CHECK quantity >= 0 impendido pelo banco (teste de constraint)
    9  duplicate code rejeitado (uq_orders_code)
   10  duplicate (user_id, client_idempotency_key) rejeitado
   11  FK inválida rejeitada (users / products / orders)
   12  cleanup total + baseline restaurado (12 produtos, estoques, 1 admin)
   ========================================================================== */

const path = require("path");

const ROOT = "C:\\Users\\joao.felippe\\Desktop\\Ciência da Computação\\Desenv. Web em Html5, Css, Javascript e Php\\Projeto\\NEXUS TECH";
const SERVER_DIR = path.join(ROOT, "server");
const DB_NAME = "nexus_tech_db";

require(path.join(SERVER_DIR, "node_modules", "dotenv")).config({
  path: path.join(SERVER_DIR, ".env"),
});

const mysql = require(path.join(SERVER_DIR, "node_modules", "mysql2", "promise"));
const serverDb = require(path.join(SERVER_DIR, "src", "config", "db.js"));
const ordersRepository = require(path.join(SERVER_DIR, "src", "repositories", "orders.repository.js"));
const inventoryRepository = require(path.join(SERVER_DIR, "src", "repositories", "inventory.repository.js"));

const ts = Date.now();
const mkEmail = (p) => `${p}-${ts}@fase9b.test`;

/* Código de pedido enxuto (<= 16) baseado no timestamp da execução. */
const CODE = `NT-9B${String(ts).slice(-8)}`;

const ORDER_FIELDS = {
  status: "processing",
  subtotalCents: 399990,        // produto 1 (Notebook A15) — price_cents do banco
  shippingCents: 2990,
  totalCents: 402980,
  itemCount: 1,
  deliveryMethod: "standard",
  deliveryLabel: "Entrega padrão",
  paymentMethod: "credit",
  paymentLabel: "Cartão de crédito",
  deliveryName: "Ana Souza",
  deliveryEmail: "ana@fase9b.test",
  cep: "01001-000",
  street: "Rua das Flores",
  number: "100",
  complement: null,
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
};

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; failures.push(`${name} :: ${detail}`); console.log(`  FAIL ${name} :: ${detail}`); }
}

async function main() {
  const pool = await mysql.createPool({
    host: "127.0.0.1",
    user: process.env.DB_USER || "nexus_app",
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
    connectionLimit: 5,
  });

  const testUsers = [];
  const testOrderIds = [];

  try {
    /* ----------------------------- [1] schema ----------------------------- */
    console.log("\n[1] Schema (orders / order_items / constraints)");
    const [tabs] = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?, ?)",
      [DB_NAME, "orders", "order_items"]
    );
    const tables = new Set(tabs.map((t) => t.TABLE_NAME));
    check("tabela orders existe", tables.has("orders"), [...tables].join(","));
    check("tabela order_items existe", tables.has("order_items"), [...tables].join(","));

    const [fks] = await pool.query(
      `SELECT constraint_name, table_name, referenced_table_name, delete_rule
         FROM information_schema.referential_constraints
        WHERE constraint_schema = ? AND table_name IN (?, ?)`,
      [DB_NAME, "orders", "order_items"]
    );
    const fk = Object.fromEntries(fks.map((f) => [`${f.TABLE_NAME}:${f.CONSTRAINT_NAME}`, f]));
    check("FK orders.user_id -> users", Boolean(fk["orders:fk_orders_user"] && fk["orders:fk_orders_user"].REFERENCED_TABLE_NAME === "users"), JSON.stringify(fks));
    check("FK order_items.order_id -> orders ON DELETE CASCADE", Boolean(fk["order_items:fk_order_items_order"] && fk["order_items:fk_order_items_order"].DELETE_RULE === "CASCADE"), JSON.stringify(fks));
    check("FK order_items.product_id -> products", Boolean(fk["order_items:fk_order_items_product"] && fk["order_items:fk_order_items_product"].REFERENCED_TABLE_NAME === "products"), JSON.stringify(fks));

    const [cons] = await pool.query(
      `SELECT constraint_name, constraint_type FROM information_schema.table_constraints
        WHERE table_schema = ? AND (table_name = ? OR table_name = ?)`,
      [DB_NAME, "orders", "order_items"]
    );
    const types = Object.fromEntries(cons.map((c) => [c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE]));
    check("UNIQUE uq_orders_code existe", types["uq_orders_code"] === "UNIQUE", JSON.stringify(types));
    check("UNIQUE (user_id, client_idempotency_key) existe", types["uq_orders_user_idempotency"] === "UNIQUE", JSON.stringify(types));

    const [idx] = await pool.query(
      `SELECT DISTINCT index_name FROM information_schema.statistics
        WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
      [DB_NAME, "orders", "idx_orders_user_created"]
    );
    check("índice (user_id, created_at) existe", idx.length > 0, JSON.stringify(idx));

    const [checkRow] = await pool.query(
      `SELECT check_clause FROM information_schema.check_constraints
        WHERE constraint_schema = ? AND check_clause LIKE ?`,
      [DB_NAME, "%quantity%"]
    );
    check("CHECK (quantity >= 0) em inventory existe", checkRow.length > 0 && checkRow[0].CHECK_CLAUSE.includes("0"), JSON.stringify(checkRow.map((c) => c.CHECK_CLAUSE)));

    /* --------------------------- setup: usuários --------------------------- */
    console.log("\nsetup: criando usuários de teste");
    const userA = mkEmail("ana");
    const userB = mkEmail("bruno");
    const [ua] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'customer', 1)",
      ["Ana Teste", userA, "php-hash-teste-não-usado"]
    );
    const [ub] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'customer', 1)",
      ["Bruno Teste", userB, "php-hash-teste-não-usado"]
    );
    const idA = ua.insertId;
    const idB = ub.insertId;
    testUsers.push(userA, userB);
    check("setup: usuários inseridos", Number(idA) > 0 && Number(idB) > 0, `A=${idA} B=${idB}`);

    /* ------------------- [2]+[3] insert de order + items ------------------- */
    console.log("\n[2/3] Insert de order e order_items");
    const conn = await pool.getConnection();
    try {
      const orderId = await ordersRepository.createOrder(conn, {
        ...ORDER_FIELDS,
        code: CODE,
        userId: idA,
        clientIdempotencyKey: `idem-${ts}-a`,
      });
      testOrderIds.push(orderId);
      check("createOrder retorna insertId", Number(orderId) > 0, `id=${orderId}`);

      const itemId = await ordersRepository.createOrderItem(conn, {
        orderId,
        productId: 1,
        productName: "Notebook Nexus A15",
        unitPriceCents: 399990,
        quantity: 1,
        totalCents: 399990,
      });
      check("createOrderItem retorna insertId", Number(itemId) > 0, `id=${itemId}`);

      const [row] = await conn.query("SELECT * FROM orders WHERE id = ?", [orderId]);
      const o = row[0];
      check("order persistido com campos calculados", o &&
        o.code === CODE &&
        o.user_id === idA &&
        o.status === "processing" &&
        o.subtotal_cents === 399990 &&
        o.shipping_cents === 2990 &&
        o.total_cents === 402980 &&
        o.item_count === 1 &&
        o.delivery_method === "standard" &&
        o.payment_method === "credit", JSON.stringify(o));
      check("snapshot de endereço persistido", o &&
        o.cep === "01001-000" &&
        o.street === "Rua das Flores" &&
        o.number === "100" &&
        o.neighborhood === "Centro" &&
        o.city === "São Paulo" &&
        o.state === "SP", JSON.stringify(o && { cep: o.cep, street: o.street, city: o.city, state: o.state }));
      check("snapshot de entrega/nome/email persistidos", o &&
        o.delivery_name === "Ana Souza" &&
        o.delivery_email === "ana@fase9b.test" &&
        o.delivery_label === "Entrega padrão" &&
        o.payment_label === "Cartão de crédito", JSON.stringify(o));

      const [items] = await conn.query("SELECT COUNT(*) c FROM order_items WHERE order_id = ?", [orderId]);
      check("1 order_item persistido", Number(items[0].c) === 1, `c=${items[0].c}`);
    } finally {
      conn.release();
    }

    /* -------------------------- [4] lookup por user ------------------------ */
    console.log("\n[4] Lookup por user_id");
    const [rowsA] = await pool.query("SELECT id, user_id FROM orders WHERE user_id = ?", [idA]);
    const fromRepo = await ordersRepository.findOrdersByUser(idA);
    check("findOrdersByUser retorna o pedido de A", fromRepo.length >= 1 && fromRepo.some((r) => r.user_id === idA), JSON.stringify(fromRepo));
    check("findOrdersByUser não retorna nada para usuário sem pedidos", (await ordersRepository.findOrdersByUser(idB)).length === 0, "esperado []");

    /* --------------------- [5] lookup por id + user_id --------------------- */
    console.log("\n[5] Lookup por id + user_id (isolamento A/B)");
    const own = await ordersRepository.findOrderByIdAndUser(testOrderIds[0], idA);
    const other = await ordersRepository.findOrderByIdAndUser(testOrderIds[0], idB);
    check("findOrderByIdAndUser devolve o pedido para o DONO", Boolean(own && own.id === testOrderIds[0]), JSON.stringify(own));
    check("findOrderByIdAndUser devolve null para OUTRO usuário (ownership)", other === null, JSON.stringify(other));
    check("findOrderByIdAndUser com id inexistente devolve null", (await ordersRepository.findOrderByIdAndUser(99999999, idA)) === null, "esperado null");

    /* --------------------- [6] consulta de produtos ------------------------ */
    console.log("\n[6] findProductsForOrder (preço/ativo/estoque do banco)");
    const prods = await ordersRepository.findProductsForOrder([1, 3, 99999999]);
    const p1 = prods.find((p) => p.id === 1);
    const p3 = prods.find((p) => p.id === 3);
    check("produto 1 tem price_cents/is_active/stock do banco", Boolean(p1 && p1.price_cents === 399990 && p1.is_active === 1 && typeof p1.stock === "number" && p1.stock > 0), JSON.stringify(p1));
    check("produto 3 (Monitor) stock 0 retornado do banco", Boolean(p3 && p3.price_cents === 104990 && p3.is_active === 1 && p3.stock === 0), JSON.stringify(p3));
    check("id inexistente é ignorado", prods.every((p) => p.id === 1 || p.id === 3), JSON.stringify(prods));

    /* --------------------------- [7] decremento ---------------------------- */
    console.log("\n[7] Decremento atômico/condicional de estoque");
    const originalStock = (await inventoryRepository.findQuantityByProductId(1)).quantity;
    const base = await pool.getConnection();
    try {
      await base.beginTransaction();
      const ok = await inventoryRepository.decrementStock(base, 1, 1);
      check("decremento com estoque suficiente -> affectedRows 1", ok === 1, `affectedRows=${ok}`);
      const afterOne = await inventoryRepository.findQuantityByProductId(1, base);
      check("estoque diminuiu em 1", afterOne.quantity === originalStock - 1, `stock=${afterOne.quantity}`);

      const fail = await inventoryRepository.decrementStock(base, 1, 99999999);
      check("decremento com estoque insuficiente -> affectedRows 0", fail === 0, `affectedRows=${fail}`);
      const still = await inventoryRepository.findQuantityByProductId(1, base);
      check("estoque NUNCA fica negativo após recusa", still.quantity === originalStock - 1, `quantity=${still.quantity}`);

      const out = await inventoryRepository.decrementStock(base, 3, 1); // Monitor: stock 0
      check("produto esgotado (stock 0) -> decremento recusado", out === 0, `affectedRows=${out}`);

      const ghost = await inventoryRepository.decrementStock(base, 99999999, 1);
      check("produto inexistente -> decremento recusado (affectedRows 0)", ghost === 0, `affectedRows=${ghost}`);
      await base.rollback();
    } catch (e) {
      await base.rollback().catch(() => {});
      throw e;
    } finally {
      base.release();
    }
    const afterRollback = await inventoryRepository.findQuantityByProductId(1);
    check("rollback preserva o estoque original", afterRollback.quantity === originalStock, `stock=${afterRollback.quantity}`);

    /* --------------------- [8] CHECK quantity >= 0 ------------------------- */
    console.log("\n[8] CHECK (quantity >= 0) impede estoque negativo");
    const ck = await pool.getConnection();
    try {
      await ck.beginTransaction();
      let err = null;
      try { await ck.query("UPDATE inventory SET quantity = -1 WHERE product_id = 1"); }
      catch (e) { err = e; }
      check("banco rejeita quantity < 0 (ER_CHECK_CONSTRAINT_VIOLATED)", Boolean(err && err.code === "ER_CHECK_CONSTRAINT_VIOLATED"), err ? `${err.code}: ${err.message}` : "sem erro");
      await ck.rollback();
    } catch (e) {
      await ck.rollback().catch(() => {});
      throw e;
    } finally {
      ck.release();
    }
    const finalStock = await inventoryRepository.findQuantityByProductId(1);
    check("estoque do produto 1 continua original", finalStock.quantity === originalStock, `stock=${finalStock.quantity}`);

    /* ------------------------ [9] duplicate code --------------------------- */
    console.log("\n[9] Duplicate code rejeitado");
    const conn2 = await pool.getConnection();
    try {
      let err = null;
      try {
        await ordersRepository.createOrder(conn2, { ...ORDER_FIELDS, code: CODE, userId: idA, clientIdempotencyKey: `idem-${ts}-dup-code` });
      } catch (e) { err = e; }
      check("code duplicado -> ER_DUP_ENTRY", Boolean(err && err.code === "ER_DUP_ENTRY"), err ? `${err.code}: ${err.message}` : "sem erro");
    } finally {
      conn2.release();
    }

    /* -------------- [10] duplicate (user_id, client_idempotency_key) -------- */
    console.log("\n[10] Duplicate (user_id, client_idempotency_key) rejeitado");
    const conn3 = await pool.getConnection();
    try {
      let err = null;
      try {
        await ordersRepository.createOrder(conn3, { ...ORDER_FIELDS, code: `${CODE}X`, userId: idA, clientIdempotencyKey: `idem-${ts}-a` });
      } catch (e) { err = e; }
      check("chave de idempotência duplicada -> ER_DUP_ENTRY", Boolean(err && err.code === "ER_DUP_ENTRY"), err ? `${err.code}: ${err.message}` : "sem erro");
    } finally {
      conn3.release();
    }

    /* ------------------------- [11] FK inválida ---------------------------- */
    console.log("\n[11] FK inválida rejeitada");
    const conn4 = await pool.getConnection();
    try {
      let errUser = null;
      try {
        await ordersRepository.createOrder(conn4, { ...ORDER_FIELDS, code: `${CODE}F`, userId: 99999999, clientIdempotencyKey: `idem-${ts}-fkuser` });
      } catch (e) { errUser = e; }
      check("user_id inexistente -> ER_NO_REFERENCED_ROW_2", Boolean(errUser && errUser.code === "ER_NO_REFERENCED_ROW_2"), errUser ? `${errUser.code}: ${errUser.message}` : "sem erro");

      let errItem = null;
      try {
        await ordersRepository.createOrderItem(conn4, { orderId: 99999999, productId: 1, productName: "X", unitPriceCents: 1, quantity: 1, totalCents: 1 });
      } catch (e) { errItem = e; }
      check("order_id inexistente -> ER_NO_REFERENCED_ROW_2", Boolean(errItem && errItem.code === "ER_NO_REFERENCED_ROW_2"), errItem ? `${errItem.code}: ${errItem.message}` : "sem erro");

      let errProd = null;
      try {
        await ordersRepository.createOrderItem(conn4, { orderId: testOrderIds[0], productId: 99999999, productName: "X", unitPriceCents: 1, quantity: 1, totalCents: 1 });
      } catch (e) { errProd = e; }
      check("product_id inexistente -> ER_NO_REFERENCED_ROW_2", Boolean(errProd && errProd.code === "ER_NO_REFERENCED_ROW_2"), errProd ? `${errProd.code}: ${errProd.message}` : "sem erro");
    } finally {
      conn4.release();
    }

    /* --------------------------- [12] baseline ----------------------------- */
    console.log("\n[12] Cleanup + baseline");
    const [stockRows] = await pool.query("SELECT product_id, quantity FROM inventory ORDER BY product_id");
    check("baseline: 12 produtos com estoque", stockRows.length === 12, `n=${stockRows.length}`);
    const expected = { 1: 24, 2: 12, 3: 0, 4: 57, 5: 33, 6: 41, 7: 88, 8: 19, 9: 9, 10: 62, 11: 0, 12: 28 };
    const stockOk = stockRows.every((s) => expected[s.product_id] !== undefined && Number(s.quantity) === expected[s.product_id]);
    check("baseline: estoques iniciais intactos", stockOk, JSON.stringify(stockRows));

  } finally {
    /* ---- cleanup: remove TODOS os dados criados por este teste ---- */
    try {
      if (testOrderIds.length) {
        await pool.query("DELETE FROM order_items WHERE order_id IN (?)", [testOrderIds]);
        await pool.query("DELETE FROM orders WHERE id IN (?)", [testOrderIds]);
      }
      const [ghosts] = await pool.query("SELECT id FROM users WHERE email LIKE '%@fase9b.test'");
      const ghostIds = ghosts.map((u) => u.id);
      if (ghostIds.length) {
        const ghostOrders = await pool.query("SELECT id FROM orders WHERE user_id IN (?)", [ghostIds]);
        const ghostOrderIds = ghostOrders[0].map((o) => o.id);
        if (ghostOrderIds.length) {
          await pool.query("DELETE FROM order_items WHERE order_id IN (?)", [ghostOrderIds]);
          await pool.query("DELETE FROM orders WHERE id IN (?)", [ghostOrderIds]);
        }
        await pool.query("DELETE FROM users WHERE id IN (?)", [ghostIds]);
      }
      const [leftOrders] = await pool.query("SELECT COUNT(*) c FROM orders");
      const [leftItems] = await pool.query("SELECT COUNT(*) c FROM order_items");
      const [leftUsers] = await pool.query("SELECT COUNT(*) c FROM users WHERE email LIKE '%@fase9b.test'");
      const [totUsers] = await pool.query("SELECT COUNT(*) c FROM users");
      console.log("\n[cleanup] orders restantes:", leftOrders[0].c, "| order_items:", leftItems[0].c, "| usuários de teste:", leftUsers[0].c, "| total de usuários:", totUsers[0].c);
      check("baseline: 0 orders de teste restantes", Number(leftOrders[0].c) === 0, `c=${leftOrders[0].c}`);
      check("baseline: 0 order_items de teste restantes", Number(leftItems[0].c) === 0, `c=${leftItems[0].c}`);
      check("baseline: 0 usuários de teste restantes", Number(leftUsers[0].c) === 0, `c=${leftUsers[0].c}`);
      check("baseline: apenas o admin permanece (1 usuário)", Number(totUsers[0].c) === 1, `c=${totUsers[0].c}`);
    } catch (e) { console.error("[cleanup] falhou:", e.message); }
    await pool.end().catch(() => {});
    await serverDb.pool.end().catch(() => {});
  }

  console.log(`\n=== Resultado: ${passed} passaram, ${failed} falharam ===`);
  if (failures.length) {
    console.log("Falhas:");
    failures.forEach((f) => console.log(" - " + f));
    process.exitCode = 1;
  }
}

process.on("uncaughtException", (e) => {
  if (!/Target closed|Protocol error/i.test(String(e && e.message))) console.error("UNCAUGHT:", e && e.stack);
});
process.on("unhandledRejection", (e) => {
  if (!/Target closed|Protocol error/i.test(String(e && e.message))) console.error("UNHANDLED:", e);
});

main().catch((err) => { console.error("FALHA FATAL:", err); process.exitCode = 1; });
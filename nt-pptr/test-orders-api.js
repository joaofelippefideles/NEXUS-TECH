/* ==========================================================================
   NEXUS TECH — FASE 9-C · Suíte da API real de pedidos (POST/GET /api/orders)
   (sem navegador: sobe o backend real em :4000 e fala via fetch).

   Cobre os cenários obrigatórios do checkpoint:
    1  POST sem token -> 401
    2  POST payload inválido -> 400
    3  POST produto inexistente -> 400
    4  POST produto inativo -> 400
    5  POST estoque insuficiente -> 409 (e estoque não muda)
    6  falha nunca muda estoque
    7  falha nunca deixa pedido parcial
    8  preço adulterado pelo cliente -> backend ignora (400/sem preço do cliente)
    9  pedido válido -> 201
   10-15 subtotal / frete standard / frete express / frete grátis / total /
         itemCount corretos
   16 order_items corretos (snapshots de nome/preço)
   17 estoque reduzido corretamente
   18 replay com MESMA idempotencyKey -> não duplica pedido
   19 replay não reduz estoque novamente
   20-22 isolamento entre usuários (list + GET /:id 404 p/ pedido alheio)
   23 usuário inativo -> 403
   24 rollback completo em falha intermediária
   25 concorrência no último estoque disponível

   Ao final: cleanup total + baseline restaurado (12 produtos, estoques
   originais, 1 admin, 0 pedidos/itens de teste, migration 006 registrada).
   ========================================================================== */

const { spawn } = require("child_process");
const path = require("path");

const ROOT = "C:\\Users\\joao.felippe\\Desktop\\Ciência da Computação\\Desenv. Web em Html5, Css, Javascript e Php\\Projeto\\NEXUS TECH";
const SERVER_DIR = path.join(ROOT, "server");
const API_PORT = 4000;
const DB_NAME = "nexus_tech_db";

require(path.join(SERVER_DIR, "node_modules", "dotenv")).config({
  path: path.join(SERVER_DIR, ".env"),
});

const mysql = require(path.join(SERVER_DIR, "node_modules", "mysql2", "promise"));

const ts = Date.now();
const mkEmail = (p) => `${p}-${ts}@fase9c.test`;
const PWD = "Nexus123";

/* Preços do banco (seed.sql) — usados como fonte de verdade nos asserts. */
const PRICES = { 1: 399990, 2: 719990, 3: 104990, 4: 39990, 5: 29990, 6: 249990, 7: 14990, 8: 19990, 9: 349990, 10: 12990, 11: 15990, 12: 139990 };
const STOCK = { 1: 24, 2: 12, 3: 0, 4: 57, 5: 33, 6: 41, 7: 88, 8: 19, 9: 9, 10: 62, 11: 0, 12: 28 };
const PRODUCT_NAMES = { 1: "Notebook Nexus A15", 2: "Notebook Nexus Ultra Pro", 3: "Monitor Nexus 27\" QHD", 4: "Teclado Mecânico Nexus RGB", 5: "Headset Gamer Nexus Pro", 6: "Celular Nexus X20", 7: "Mouse Gamer Nexus M1", 8: "Webcam Nexus HD 1080p", 9: "Console Nexus Game S", 10: "Caixa de Som Nexus BT Go", 11: "Carregador Rápido Nexus 65W", 12: "Tablet Nexus Tab 10" };

const FREE_SHIPPING_MIN_CENTS = 50000;
const SHIPPING_CENTS = 2990;
const EXPRESS_CENTS = 4990;

const ADDR = {
  name: "Ana Souza",
  email: null, // preenchido por usuário no setup
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitApi(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${API_PORT}/api/health`, { signal: AbortSignal.timeout(800) });
      if (res.ok) return;
    } catch (err) { /* ainda subindo */ }
    await sleep(250);
  }
  throw new Error("timeout: API real não subiu em /api/health");
}

/* ------------------------------------------------------------- API helpers --- */

async function api(method, urlPath, body = null, token = null) {
  const headers = {};
  if (body !== null) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:${API_PORT}${urlPath}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function registerUser(name, prefix) {
  const email = mkEmail(prefix);
  const reg = await api("POST", "/api/auth/register", { name, email, password: PWD, passwordConfirm: PWD });
  const id = reg.body && reg.body.data && reg.body.data.user ? reg.body.data.user.id : null;
  return { email, id, registered: reg.status };
}

async function loginUser(email) {
  const res = await api("POST", "/api/auth/login", { email, password: PWD });
  const token = res.body && res.body.data && res.body.data.accessToken;
  return { status: res.status, token };
}

function payload(over = {}) {
  const base = {
    items: [{ productId: 10, quantity: 1 }],
    deliveryMethod: "standard",
    paymentMethod: "credit",
    address: { ...ADDR },
    idempotencyKey: `k-${ts}-${Math.random().toString(36).slice(2, 8)}`,
  };
  if (over.address) base.address = { ...ADDR, ...over.address };
  return { ...base, ...over };
}

async function orderCount(userId) {
  const [rows] = await D.pool.query("SELECT COUNT(*) c FROM orders WHERE user_id = ?", [userId]);
  return Number(rows[0].c);
}

async function stockOf(productId) {
  const [rows] = await D.pool.query("SELECT quantity FROM inventory WHERE product_id = ?", [productId]);
  return rows[0] ? Number(rows[0].quantity) : null;
}

const D = { emails: [], tokens: {}, ids: {} };

/* --------------------------------------------------------------- cenários --- */

/* [1] sem token ------------------------------------------------------------- */
async function s01_semToken() {
  console.log("\n[1] Rotas sem token -> 401");
  const a = await api("POST", "/api/orders", payload());
  const b = await api("GET", "/api/orders");
  const c = await api("GET", "/api/orders/1");
  check("POST /api/orders sem token -> 401", a.status === 401, `status=${a.status}`);
  check("GET /api/orders sem token -> 401", b.status === 401, `status=${b.status}`);
  check("GET /api/orders/:id sem token -> 401", c.status === 401, `status=${c.status}`);
}

/* [2] validação ------------------------------------------------------------- */
async function s02_validacao() {
  const A = D.tokens.A;
  const cases = [];
  const push = async (label, body) => cases.push([label, body]);

  await push("corpo vazio", {});
  await push("sem items", payload({ items: undefined }));
  await push("items []", payload({ items: [] }));
  await push("quantidade 0", payload({ items: [{ productId: 1, quantity: 0 }] }));
  await push("quantidade negativa", payload({ items: [{ productId: 1, quantity: -2 }] }));
  await push("quantidade decimal", payload({ items: [{ productId: 1, quantity: 2.5 }] }));
  await push("quantidade string inválida", payload({ items: [{ productId: 1, quantity: "abc" }] }));
  await push("productId 0", payload({ items: [{ productId: 0, quantity: 1 }] }));
  await push("itens duplicados", payload({ items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }] }));
  await push("deliveryMethod inválido", payload({ deliveryMethod: "carrier" }));
  await push("paymentMethod inválido", payload({ paymentMethod: "crypto" }));
  await push("sem address", payload({ address: undefined }));
  await push("address sem street", payload({ address: { ...ADDR, street: "" } }));
  await push("idempotencyKey vazia", payload({ idempotencyKey: "" }));
  await push("idempotencyKey >64", payload({ idempotencyKey: "x".repeat(65) }));
  await push("campo top-level price", payload({ price: 1 }));
  await push("item com unitPriceCents", payload({ items: [{ productId: 1, quantity: 1, unitPriceCents: 1 }] }));

  for (const [label, body] of cases) {
    const r = await api("POST", "/api/orders", body, A);
    check(`400: ${label}`, r.status === 400, `status=${r.status} body=${JSON.stringify(r.body).slice(0, 160)}`);
    const serr = JSON.stringify(r.body);
    check(`400 ${label}: sem vazamento de SQL/stack`, !/SELECT|node_modules|at \w|sqlMessage/i.test(serr), serr.slice(0, 120));
  }
  check("validação: nenhum pedido criado por A ainda", (await orderCount(D.ids.A)) === 0, `n=${await orderCount(D.ids.A)}`);
}

/* [3] produto inexistente ---------------------------------------------------- */
async function s03_produtoInexistente() {
  const r = await api("POST", "/api/orders", payload({ items: [{ productId: 99999999, quantity: 1 }] }), D.tokens.A);
  check("produto inexistente -> 400", r.status === 400, `status=${r.status}`);
  check("inexistente: nenhum pedido criado", (await orderCount(D.ids.A)) === 0, `n=${await orderCount(D.ids.A)}`);
}

/* [4] produto inativo -------------------------------------------------------- */
async function s04_produtoInativo() {
  await D.pool.query("UPDATE products SET is_active = 0 WHERE id = 7");
  const r = await api("POST", "/api/orders", payload({ items: [{ productId: 7, quantity: 1 }] }), D.tokens.A);
  check("produto inativo -> 400", r.status === 400, `status=${r.status}`);
  check("inativo: estoque do produto 7 NÃO mudou", (await stockOf(7)) === 88, `stock=${await stockOf(7)}`);
  check("inativo: nenhum pedido criado", (await orderCount(D.ids.A)) === 0, `n=${await orderCount(D.ids.A)}`);
  await D.pool.query("UPDATE products SET is_active = 1 WHERE id = 7");
}

/* [5] estoque insuficiente --------------------------------------------------- */
async function s05_estoqueInsuficiente() {
  const ie = await api("POST", "/api/orders", payload({ items: [{ productId: 9, quantity: 10 }] }), D.tokens.A);
  check("estoque insuficiente (9 qty 10) -> 409", ie.status === 409, `status=${ie.status}`);
  check("409: mensagem de estoque", /estoque/i.test(JSON.stringify(ie.body)), JSON.stringify(ie.body).slice(0, 120));

  const ze = await api("POST", "/api/orders", payload({ items: [{ productId: 3, quantity: 1 }] }), D.tokens.A);
  check("produto esgotado (stock 0) -> 409", ze.status === 409, `status=${ze.status}`);
  check("409: estoque de 9 permanece 9", (await stockOf(9)) === 9, `stock=${await stockOf(9)}`);
  check("409: estoque de 3 permanece 0", (await stockOf(3)) === 0, `stock=${await stockOf(3)}`);
  check("409: nenhum pedido criado", (await orderCount(D.ids.A)) === 0, `n=${await orderCount(D.ids.A)}`);
}

/* [6] rollback em falha intermediária (item 1 OK, item 2 esgotado) ---------- */
async function s06_rollbackIntermediario() {
  const r = await api("POST", "/api/orders", payload({ items: [{ productId: 1, quantity: 1 }, { productId: 3, quantity: 1 }] }), D.tokens.A);
  check("falha intermediária -> 409", r.status === 409, `status=${r.status}`);
  check("rollback: estoque do produto 1 NÃO foi reduzido", (await stockOf(1)) === 24, `stock=${await stockOf(1)}`);
  check("rollback: nenhum pedido parcial para A", (await orderCount(D.ids.A)) === 0, `n=${await orderCount(D.ids.A)}`);
  const [items] = await D.pool.query("SELECT COUNT(*) c FROM order_items");
  check("rollback: nenhum order_item órfão", Number(items[0].c) === 0, `c=${items[0].c}`);
}

/* [7] preço adulterado -------------------------------------------------------- */
async function s07_precoAdulterado() {
  const itemPrice = await api("POST", "/api/orders", payload({ items: [{ productId: 1, quantity: 1, unitPriceCents: 1 }] }), D.tokens.A);
  check("preço no item -> 400 (backend não aceita preço do cliente)", itemPrice.status === 400, `status=${itemPrice.status}`);

  const topTotal = await api("POST", "/api/orders", payload({ totalCents: 1 }), D.tokens.A);
  check("totalCents no corpo -> 400", topTotal.status === 400, `status=${topTotal.status}`);

  const topUnit = await api("POST", "/api/orders", payload({ price: 1 }), D.tokens.A);
  check("price no corpo -> 400", topUnit.status === 400, `status=${topUnit.status}`);
  check("preço adulterado: nenhum pedido criado", (await orderCount(D.ids.A)) === 0, `n=${await orderCount(D.ids.A)}`);

  /* Prova de que o preço usado é o do BANCO: o pedido O1 abaixo (cenário 8)
     terá subtotal = 399990*2 + 39990 (valores de products.price_cents). */
  const [p1] = await D.pool.query("SELECT price_cents FROM products WHERE id = 1");
  check("setup: price_cents do produto 1 no banco = 399990", Number(p1[0].price_cents) === 399990, `price=${p1[0].price_cents}`);
}

/* [8] pedido válido + figuras corretas --------------------------------------- */
async function s08_pedidoValido() {
  console.log("\n[8-17] Pedido válido + cálculos (O1: 2x prod 1 + 1x prod 4)");
  const body = payload({
    items: [{ productId: 1, quantity: 2 }, { productId: 4, quantity: 1 }],
    deliveryMethod: "standard",
    paymentMethod: "credit",
    idempotencyKey: `k-${ts}-o1`,
  });
  body.address.email = D.emails.A;
  const r = await api("POST", "/api/orders", body, D.tokens.A);
  check("pedido válido -> 201", r.status === 201, `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);
  const order = r.body.data.order;
  const items = r.body.data.items;
  check("response traz order", Boolean(order && order.id > 0), JSON.stringify(order));
  check("response traz items (2)", Array.isArray(items) && items.length === 2, JSON.stringify(items));
  check("created: true", r.body.data.created === true);

  const subtotal = 399990 * 2 + 39990; // 839970
  check(`subtotal_cents ${subtotal} (preços do banco)`, order.subtotalCents === subtotal, `got=${order.subtotalCents}`);
  check("frete grátis p/ subtotal >= 50000 (standard)", order.shippingCents === 0, `got=${order.shippingCents}`);
  check("total = subtotal + frete", order.totalCents === subtotal, `got=${order.totalCents}`);
  check("itemCount = 3", order.itemCount === 3, `got=${order.itemCount}`);
  check("status 'processing'", order.status === "processing", order.status);
  check("deliveryMethod/label", order.deliveryMethod === "standard" && order.deliveryLabel === "Entrega padrão", JSON.stringify(order));
  check("paymentMethod/label", order.paymentMethod === "credit" && order.paymentLabel === "Cartão de crédito", JSON.stringify(order));
  check("code no formato NT-XXXXXXXXXX", /^NT-[0-9A-F]{10}$/.test(order.code), order.code);
  check("code <= 16 chars", order.code.length <= 16, `len=${order.code.length}`);
  check("snapshot de endereço", order.address.cep === "01001-000" && order.address.state === "SP" && order.address.street === "Rua das Flores", JSON.stringify(order.address));
  check("snapshot de nome/e-mail de entrega", order.deliveryName === "Ana Souza" && order.deliveryEmail === D.emails.A, `${order.deliveryName}/${order.deliveryEmail}`);

  check("item1: produto 1 notebook (snapshot nome/preço)", items[0].productName === PRODUCT_NAMES[1] && items[0].unitPriceCents === 399990 && items[0].quantity === 2 && items[0].totalCents === 799980, JSON.stringify(items[0]));
  check("item2: produto 4 teclado (snapshot nome/preço)", items[1].productName === PRODUCT_NAMES[4] && items[1].unitPriceCents === 39990 && items[1].quantity === 1 && items[1].totalCents === 39990, JSON.stringify(items[1]));

  check("estoque p1 24 -> 22", (await stockOf(1)) === 22, `stock=${await stockOf(1)}`);
  check("estoque p4 57 -> 56", (await stockOf(4)) === 56, `stock=${await stockOf(4)}`);
  D.orders = { o1: order.id };
}

/* [9-12] frete standard e express -------------------------------------------- */
async function s09_fretes() {
  const std = payload({ items: [{ productId: 10, quantity: 1 }], deliveryMethod: "standard", paymentMethod: "pix", idempotencyKey: `k-${ts}-o2` });
  std.address.email = D.emails.A;
  const rStd = await api("POST", "/api/orders", std, D.tokens.A);
  check("pedido standard pequeno -> 201", rStd.status === 201, `status=${rStd.status}`);
  check("frete standard cobrado (2990) abaixo de 50000", rStd.body.data.order.shippingCents === SHIPPING_CENTS, `got=${rStd.body.data.order.shippingCents}`);
  check("total standard (12990+2990=15980)", rStd.body.data.order.totalCents === 15980, `got=${rStd.body.data.order.totalCents}`);
  check("payment pix label", rStd.body.data.order.paymentMethod === "pix" && rStd.body.data.order.paymentLabel === "PIX", JSON.stringify(rStd.body.data.order));

  const ex = payload({ items: [{ productId: 10, quantity: 1 }], deliveryMethod: "express", paymentMethod: "boleto", idempotencyKey: `k-${ts}-o3` });
  ex.address.email = D.emails.A;
  const rEx = await api("POST", "/api/orders", ex, D.tokens.A);
  check("pedido express -> 201", rEx.status === 201, `status=${rEx.status}`);
  check("frete express fixo (4990)", rEx.body.data.order.shippingCents === EXPRESS_CENTS, `got=${rEx.body.data.order.shippingCents}`);
  check("total express (12990+4990=17980)", rEx.body.data.order.totalCents === 17980, `got=${rEx.body.data.order.totalCents}`);
  check("payment boleto label", rEx.body.data.order.paymentMethod === "boleto" && rEx.body.data.order.paymentLabel === "Boleto bancário", JSON.stringify(rEx.body.data.order));
  check("estoque p10 62 -> 60 (dois pedidos)", (await stockOf(10)) === 60, `stock=${await stockOf(10)}`);

  D.orders.o2 = rStd.body.data.order.id;
  D.orders.o3 = rEx.body.data.order.id;
}

/* [13] lista + detalhe ------------------------------------------------------- */
async function s10_lista() {
  const list = await api("GET", "/api/orders", null, D.tokens.A);
  check("GET /api/orders -> 200", list.status === 200, `status=${list.status}`);
  check("A tem 3 pedidos", Array.isArray(list.body.data.orders) && list.body.data.orders.length === 3, `n=${list.body.data.orders && list.body.data.orders.length}`);
  check("todos os pedidos listados são de A", list.body.data.orders.every((o) => Number(o.id) === D.orders.o1 || Number(o.id) === D.orders.o2 || Number(o.id) === D.orders.o3), JSON.stringify(list.body.data.orders.map((o) => o.id)));

  const d = await api("GET", `/api/orders/${D.orders.o1}`, null, D.tokens.A);
  check("GET /api/orders/:id próprio -> 200 com items", d.status === 200 && Array.isArray(d.body.data.items) && d.body.data.items.length === 2, `status=${d.status}`);
  check("detalhe: items apontam para o pedido", d.body.data.items.every((i) => Number(i.orderId) === D.orders.o1), JSON.stringify(d.body.data.items));

  const bad = await api("GET", "/api/orders/abc", null, D.tokens.A);
  check("GET /api/orders/abc (não-numérico) -> 404", bad.status === 404, `status=${bad.status}`);
}

/* [14] idempotência (replay) ------------------------------------------------ */
async function s11_idempotencia() {
  const body = payload({ items: [{ productId: 2, quantity: 1 }], idempotencyKey: `k-${ts}-replay` });
  body.address.email = D.emails.A;
  const first = await api("POST", "/api/orders", body, D.tokens.A);
  check("primeiro POST -> 201", first.status === 201, `status=${first.status}`);
  const idA = first.body.data.order.id;
  check("estoque p2 12 -> 11", (await stockOf(2)) === 11, `stock=${await stockOf(2)}`);

  const before = await stockOf(2);
  const second = await api("POST", "/api/orders", body, D.tokens.A);
  check("replay (mesma key) -> 200", second.status === 200, `status=${second.status}`);
  check("replay NÃO cria novo pedido (mesmo id)", second.body.data.order.id === idA, `first=${idA} second=${second.body.data.order.id}`);
  check("replay: created: false", second.body.data.created === false, JSON.stringify(second.body.data.created));
  check("replay NÃO reduz estoque novamente", (await stockOf(2)) === before, `stock=${await stockOf(2)}`);
  check("A continua com 4 pedidos", (await orderCount(D.ids.A)) === 4, `n=${await orderCount(D.ids.A)}`);
  D.orders.o4 = idA;
}

/* [15] isolamento entre usuários --------------------------------------------- */
async function s12_isolamento() {
  const bBody = payload({ items: [{ productId: 12, quantity: 1 }], idempotencyKey: `k-${ts}-b1` });
  bBody.address.email = D.emails.B;
  const bOrder = await api("POST", "/api/orders", bBody, D.tokens.B);
  check("B cria pedido próprio -> 201", bOrder.status === 201, `status=${bOrder.status}`);
  const idB = bOrder.body.data.order.id;

  const bList = await api("GET", "/api/orders", null, D.tokens.B);
  check("lista de B tem SÓ o pedido de B", Array.isArray(bList.body.data.orders) && bList.body.data.orders.length === 1 && Number(bList.body.data.orders[0].id) === idB, JSON.stringify(bList.body.data.orders && bList.body.data.orders.map((o) => o.id)));
  const aList = await api("GET", "/api/orders", null, D.tokens.A);
  check("lista de A NÃO contém pedido de B", !aList.body.data.orders.some((o) => Number(o.id) === idB), JSON.stringify(aList.body.data.orders.map((o) => o.id)));

  const cross = await api("GET", `/api/orders/${D.orders.o1}`, null, D.tokens.B);
  check("B consulta pedido de A -> 404", cross.status === 404, `status=${cross.status}`);
  const cross2 = await api("GET", `/api/orders/${idB}`, null, D.tokens.A);
  check("A consulta pedido de B -> 404", cross2.status === 404, `status=${cross2.status}`);
  const ownB = await api("GET", `/api/orders/${idB}`, null, D.tokens.B);
  check("B consulta pedido PRÓPRIO -> 200", ownB.status === 200, `status=${ownB.status}`);
  check("estoque p12 28 -> 27", (await stockOf(12)) === 27, `stock=${await stockOf(12)}`);
}

/* [16] usuário inativo ------------------------------------------------------- */
async function s13_inativo() {
  const C = await registerUser("Carlos Teste", "carlos");
  check("setup: usuário C criado", C.registered === 201 && C.id, `status=${C.registered}`);
  const login = await loginUser(C.email);
  check("setup: C autenticado", login.status === 200 && Boolean(login.token), `status=${login.status}`);

  await D.pool.query("UPDATE users SET is_active = 0 WHERE id = ?", [C.id]);
  const r = await api("POST", "/api/orders", payload({ idempotencyKey: `k-${ts}-inativo` }), login.token);
  check("usuário inativo -> 403 no POST", r.status === 403, `status=${r.status}`);
  const g = await api("GET", "/api/orders", null, login.token);
  check("usuário inativo -> 403 no GET", g.status === 403, `status=${g.status}`);
  check("inativo: nenhum pedido criado", (await orderCount(C.id)) === 0, `n=${await orderCount(C.id)}`);
  await D.pool.query("UPDATE users SET is_active = 1 WHERE id = ?", [C.id]);
  D.emails.push(C.email);
  D.ids.C = C.id;
}

/* [17] concorrência no último item ------------------------------------------- */
async function s14_concorrencia() {
  const countA = await orderCount(D.ids.A);
  const countB = await orderCount(D.ids.B);
  await D.pool.query("UPDATE inventory SET quantity = 1 WHERE product_id = 9");

  const mkBody = (key) => payload({ items: [{ productId: 9, quantity: 1 }], idempotencyKey: `k-${ts}-cc-${key}` });
  const [rA, rB] = await Promise.all([
    api("POST", "/api/orders", mkBody("a"), D.tokens.A),
    api("POST", "/api/orders", mkBody("b"), D.tokens.B),
  ]);

  const okCount = [rA, rB].filter((r) => r.status === 201).length;
  const conflictCount = [rA, rB].filter((r) => r.status === 409).length;
  check("concorrência: uma das duas obteve 201", okCount === 1, `rA=${rA.status} rB=${rB.status}`);
  check("concorrência: a outra obteve 409", conflictCount === 1, `rA=${rA.status} rB=${rB.status}`);
  check("concorrência: estoque final 0 (nunca negativo)", (await stockOf(9)) === 0, `stock=${await stockOf(9)}`);

  const newA = await orderCount(D.ids.A) - countA;
  const newB = await orderCount(D.ids.B) - countB;
  check("concorrência: exatamente UM novo pedido no total", newA + newB === 1, `+A=${newA} +B=${newB}`);
  check("concorrência: quem perdeu NÃO criou pedido", (newA === 1 && newB === 0) || (newA === 0 && newB === 1), `+A=${newA} +B=${newB}`);
}

/* [18] baseline --------------------------------------------------------------- */
async function s15_baseline() {
  const [prods] = await D.pool.query("SELECT COUNT(*) c FROM products");
  check("baseline: 12 produtos", Number(prods[0].c) === 12, `c=${prods[0].c}`);

  for (const id of Object.keys(STOCK)) {
    const s = await stockOf(Number(id));
    check(`baseline: estoque do produto ${id} restaurado (${STOCK[id]})`, s === STOCK[id], `stock=${s}`);
  }

  const [users] = await D.pool.query("SELECT COUNT(*) c FROM users");
  const [testUsers] = await D.pool.query("SELECT COUNT(*) c FROM users WHERE email LIKE '%@fase9c.test'");
  const [orders] = await D.pool.query("SELECT COUNT(*) c FROM orders");
  const [items] = await D.pool.query("SELECT COUNT(*) c FROM order_items");
  check("baseline: apenas o admin (1 usuário)", Number(users[0].c) === 1, `c=${users[0].c}`);
  check("baseline: 0 usuários de teste", Number(testUsers[0].c) === 0, `c=${testUsers[0].c}`);
  check("baseline: 0 pedidos", Number(orders[0].c) === 0, `c=${orders[0].c}`);
  check("baseline: 0 order_items", Number(items[0].c) === 0, `c=${items[0].c}`);

  const [mig] = await D.pool.query("SELECT filename FROM schema_migrations WHERE filename LIKE '006%'");
  check("baseline: migration 006 registrada", mig.length > 0, JSON.stringify(mig));
}

/* ------------------------------------------------------------------- main --- */

async function cleanup() {
  const emails = D.emails;
  if (!emails.length) return;
  const [users] = await D.pool.query("SELECT id FROM users WHERE email IN (?)", [emails]);
  const ids = users.map((u) => u.id);
  if (!ids.length) return;
  const [orders] = await D.pool.query("SELECT id FROM orders WHERE user_id IN (?)", [ids]);
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length) {
    await D.pool.query("DELETE FROM order_items WHERE order_id IN (?)", [orderIds]);
    await D.pool.query("DELETE FROM orders WHERE id IN (?)", [orderIds]);
  }
  await D.pool.query("DELETE FROM refresh_tokens WHERE user_id IN (?)", [ids]);
  await D.pool.query("DELETE FROM user_profile WHERE user_id IN (?)", [ids]);
  await D.pool.query("DELETE FROM admin_actions WHERE admin_id IN (?)", [ids]);
  await D.pool.query("DELETE FROM users WHERE id IN (?)", [ids]);
}

async function restoreInventory() {
  for (const id of Object.keys(STOCK)) {
    await D.pool.query("UPDATE inventory SET quantity = ? WHERE product_id = ?", [STOCK[id], Number(id)]);
  }
  await D.pool.query("UPDATE products SET is_active = 1 WHERE id = 7");
}

async function main() {
  const api = spawn(process.execPath, ["src/index.js"], { cwd: SERVER_DIR, stdio: "ignore" });
  D.pool = await mysql.createPool({
    host: "127.0.0.1",
    user: process.env.DB_USER || "nexus_app",
    password: process.env.DB_PASSWORD,
    database: DB_NAME,
    connectionLimit: 5,
  });

  try {
    await waitApi();

    console.log("\n=== FASE 9-C — suíte da API de pedidos ===\n");

    /* setup: usuários A, B, C + login */
    const A = await registerUser("Ana Souza", "ana");
    const B = await registerUser("Bruno Lima", "bruno");
    check("setup: usuário A criado", A.registered === 201 && A.id, `status=${A.registered}`);
    check("setup: usuário B criado", B.registered === 201 && B.id, `status=${B.registered}`);
    D.emails.push(A.email, B.email);
    D.ids.A = A.id;
    D.ids.B = B.id;
    D.emails.A = A.email;
    D.emails.B = B.email;

    const loginA = await loginUser(A.email);
    const loginB = await loginUser(B.email);
    check("setup: login A ok", loginA.status === 200 && Boolean(loginA.token), `status=${loginA.status}`);
    check("setup: login B ok", loginB.status === 200 && Boolean(loginB.token), `status=${loginB.status}`);
    D.tokens.A = loginA.token;
    D.tokens.B = loginB.token;

    ADDR.email = A.email;

    const [baseOrders] = await D.pool.query("SELECT COUNT(*) c FROM orders");
    check("setup: baseline 0 pedidos", Number(baseOrders[0].c) === 0, `c=${baseOrders[0].c}`);

    await s01_semToken();
    await s02_validacao();
    await s03_produtoInexistente();
    await s04_produtoInativo();
    await s05_estoqueInsuficiente();
    await s06_rollbackIntermediario();
    await s07_precoAdulterado();
    await s08_pedidoValido();
    await s09_fretes();
    await s10_lista();
    await s11_idempotencia();
    await s12_isolamento();
    await s13_inativo();
    await s14_concorrencia();
  } finally {
    try { api.kill("SIGKILL"); } catch (e) { /* já encerrado */ }
    try {
      await cleanup();
      await restoreInventory();
      await s15_baseline();
    } catch (e) { console.error("[cleanup] falhou:", e.message); }
    await D.pool.end().catch(() => {});
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
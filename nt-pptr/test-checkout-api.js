/* ==========================================================================
   NEXUS TECH — FASE 9-D · Suíte E2E do checkout REAL (integração com a API)
   (modo NEXUS_STOREFRONT_AUTH="api" via evaluateOnNewDocument).

   Sobe o backend real (server/src/index.js -> :4000) e proxies estáticos que
   servem o frontend e repassam /api/* na MESMA origem. Valida os 22 itens
   obrigatórios da fase 9-D:
     1  mock mode continua funcionando (pedido simulado, 0 chamadas API)
     2  API mode envia POST /api/orders
     3  payload com SOMENTE productId+quantity nos itens
     4  payload NÃO usa preço/subtotal/total do cliente
     5  payload contém endereço
     6  deliveryMethod correto
     7  paymentMethod correto
     8  idempotencyKey presente (<=64, sem dados sensíveis)
     9  sucesso 201
     10 replay 200 (mesma chave não duplica pedido)
     11 carrinho SÓ limpa após sucesso
     12 carrinho NÃO limpa em 400
     13 carrinho NÃO limpa em 401
     14 carrinho NÃO limpa em 403
     15 carrinho NÃO limpa em 409 estoque
     16 carrinho NÃO limpa em 500
     17 código real do pedido é exibido
     18 total retornado pelo backend é usado
     19 nenhum pedido mock é criado junto com a API
     20 nenhuma redução de estoque feita pelo frontend
     21 sessão API aguardada com authReady() (Authorization presente)
     22 logout/sessão expirada NÃO cria pedido
   ========================================================================== */

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const puppeteer = require("puppeteer-core");
const mysql = require("C:/Users/joao.felippe/Desktop/Ciência da Computação/Desenv. Web em Html5, Css, Javascript e Php/Projeto/NEXUS TECH/server/node_modules/mysql2/promise");

const ROOT = "C:\\Users\\joao.felippe\\Desktop\\Ciência da Computação\\Desenv. Web em Html5, Css, Javascript e Php\\Projeto\\NEXUS TECH";
const SERVER_DIR = path.join(ROOT, "server");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const API_PORT = 4000;
const PORT = 8811;         // principal: estático + proxy -> API (API de pedidos real)
const STUB_PORT = 8821;    // estático + proxy, PORÉM POST /api/orders com status configurável

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const ts = Date.now();
const mkEmail = (p) => `${p}-${ts}@fase9d.test`;
const PWD = "Nexus123";
const D = { emails: [], password: PWD };

const CART_A = { 1: 2, 4: 1 }; // Notebook 2x + Teclado 1x -> subtotal 839970, frete grátis
const CART_ERR = { 7: 1 };     // Mouse (estoque 88) p/ cenários de erro
const CART_B = { 10: 1 };      // Caixa de Som p/ replay idempotente
const CART_D = { 7: 1 };

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; failures.push(`${name} :: ${detail}`); console.log(`  FAIL ${name} :: ${detail}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------------- servidores --- */

function startServer(port, opts = {}) {
  const { proxyTo = null } = opts;
  const cfg = { orderPost: null, orderPostFn: null, orderAttempts: 0 };

  const proxy = (req, res) => {
    const upstream = http.request(
      { hostname: "127.0.0.1", port: proxyTo, path: req.url, method: req.method, headers: { ...req.headers } },
      (ures) => { res.writeHead(ures.statusCode, ures.headers); ures.pipe(res); }
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  };

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url.startsWith("/api/orders")) {
      cfg.orderAttempts++;
      let status = cfg.orderPost;
      if (status === null && typeof cfg.orderPostFn === "function") {
        status = cfg.orderPostFn(cfg.orderAttempts);
      }
      if (status != null) {
        let body = { error: "Erro interno de teste." };
        if (status === 409) body = { error: "Estoque insuficiente para 'Mouse Gamer Nexus M1'." };
        if (status === 400) body = { error: "Não foi possível validar o pedido." };
        if (status === 403) body = { error: "Sua conta está inativa." };
        if (status === 401) body = { error: "Sessão inválida ou expirada." };
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
        return;
      }
      // status null -> proxy (API real)
    }
    if (req.url.startsWith("/api/")) {
      if (!proxyTo) { res.writeHead(502); res.end(); return; }
      proxy(req, res);
      return;
    }

    let urlPath = decodeURIComponent(req.url.split("#")[0].split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fsRead(file, res);
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, cfg })));
}

const fs = require("fs");
function fsRead(file, res) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("404"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}

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

/* ------------------------------------------------------------------ helpers --- */

const setField = (page, sel, value) => page.$eval(sel, (el, v) => { el.value = v; }, value);
const has = (page, sel) => page.$(sel).then((el) => Boolean(el));
const txt = (page, sel) => page.$eval(sel, (el) => el.textContent).catch(() => "");
const hidden = (page, sel) => page.$eval(sel, (el) => el.hidden).catch(() => true);

async function waitForUrl(page, needle, timeoutMs = 15000) {
  await page.waitForFunction((n) => window.location.href.includes(n), { timeout: timeoutMs }, needle);
}

async function waitAuthState(page, state, timeoutMs = 15000) {
  await page.waitForFunction((s) => document.documentElement.dataset.authState === s, { timeout: timeoutMs }, state);
}

async function clearCookies(page) {
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.clearBrowserCookies");
}

async function fillLogin(page, email, password) {
  await setField(page, "#login-email", email);
  await setField(page, "#login-password", password);
  await page.click("#login-submit");
}

const CHECKOUT_FIELDS = {
  "#co-name": "Ana Souza",
  "#co-email": "ana.checkout@example.com",
  "#co-phone": "(91) 98765-4321",
  "#co-cep": "66010-000",
  "#co-street": "Av. Nazaré",
  "#co-number": "123",
  "#co-neighborhood": "Nazaré",
  "#co-city": "Belém",
  "#co-state": "PA",
};

async function fillCheckout(page, email) {
  for (const [sel, v] of Object.entries(CHECKOUT_FIELDS)) {
    await setField(page, sel, sel === "#co-email" && email ? email : v);
  }
  await page.click("#co-payment-pix"); // cartão fica oculto -> form mais simples
  await sleep(80);
}

const benignNet = /Failed to load resource: the server responded with a status of (401|404|409|500)/;
function hardErrors(p) {
  return p._pageErrs.concat(p._errs.filter((m) => !benignNet.test(m)));
}

const hasTokenLike = (str) => /accessToken|"token"|Bearer|eyJ[A-Za-z0-9_-]{8,}\./.test(str || "");
const hasPasswordLike = (str) => /\bpassword(_hash)?\b/.test(str || "");

async function open(browser, opts = {}) {
  const {
    mode = "mock",
    serverPort = PORT,
    urlPath = "/pages/checkout.html",
    cart = null,
    mockUser = null,
  } = opts;
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 800 });
  await clearCookies(page);
  await page.evaluateOnNewDocument(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* ignora */ }
  });
  await page.evaluateOnNewDocument(() => {
    window.__authStates = [];
    const attach = () => {
      const el = document.documentElement;
      if (!el) { setTimeout(attach, 0); return; }
      const record = () => window.__authStates.push(el.dataset.authState);
      new MutationObserver(record).observe(el, { attributes: true, attributeFilter: ["data-auth-state"] });
      record();
    };
    attach();
  });
  if (mode === "api") {
    await page.evaluateOnNewDocument(() => { window.NEXUS_STOREFRONT_AUTH = "api"; });
  }
  if (cart) {
    await page.evaluateOnNewDocument((c) => {
      try { localStorage.setItem("nexus:cart", JSON.stringify(c)); } catch (e) { /* ignora */ }
    }, cart);
  }
  if (mockUser) {
    await page.evaluateOnNewDocument((u) => {
      try {
        localStorage.setItem("nexus:user", JSON.stringify(u));
        sessionStorage.setItem("nexus:auth", JSON.stringify({ userId: String(u.id), authenticatedAt: new Date().toISOString() }));
      } catch (e) { /* ignora */ }
    }, mockUser);
  }
  const errs = [], pageErrs = [], apiReqs = [], dialogs = [], orderBodies = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => pageErrs.push(String(e)));
  page.on("request", (r) => {
    if (r.url().includes("/api/")) apiReqs.push(r.url());
    if (r.url().includes("/api/orders") && r.method() === "POST") {
      orderBodies.push({ url: r.url(), headers: r.headers(), body: r.postData() });
    }
  });
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  page._pageErrs = pageErrs;
  page._errs = errs; page._api = apiReqs; page._dialogs = dialogs; page._orderBodies = orderBodies;
  await page.goto(`http://127.0.0.1:${serverPort}${urlPath}`, { waitUntil: "networkidle0" });
  return page;
}

async function loginToCheckout(email, { serverPort = PORT, cart = null } = {}) {
  const p = await open(D.browser, { mode: "api", serverPort, urlPath: "/pages/login.html?next=checkout.html", cart });
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, email, PWD);
  await waitForUrl(p, "pages/checkout.html");
  await p.waitForSelector(".account-session", { timeout: 10000 });
  await waitAuthState(p, "authenticated");
  return p;
}

function dumpStorage(p) {
  return p.evaluate(() => {
    const scan = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
    return { ls: scan(localStorage), ss: scan(sessionStorage) };
  });
}

async function localStorageGet(p, key) {
  return p.evaluate((k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, key);
}

/* ------------------------------------------------------------- API helpers --- */

async function apiRegister(email, password, name) {
  const res = await fetch(`http://127.0.0.1:${API_PORT}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, passwordConfirm: password }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function apiLogin(email, password) {
  const res = await fetch(`http://127.0.0.1:${API_PORT}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function apiGetOrders(token) {
  const res = await fetch(`http://127.0.0.1:${API_PORT}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function apiGetOrder(token, id) {
  const res = await fetch(`http://127.0.0.1:${API_PORT}/api/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function dbInventory(id) {
  const [rows] = await D.pool.query("SELECT quantity FROM inventory WHERE product_id = ?", [id]);
  return rows[0] ? Number(rows[0].quantity) : null;
}

/* --------------------------------------------------------------- cenários --- */

/* [1] MOCK preservado — pedido simulado, sem nenhuma chamada à API */
async function s01_mockPreservado() {
  console.log("\n[1] MOCK preservado");
  const mockUser = { id: 777, name: "Ana Souza", email: `${ts}-mock@fase9d.test`, createdAt: new Date().toISOString() };
  const p = await open(D.browser, { mode: "mock", cart: CART_A, mockUser });

  check("mock: nenhuma chamada de API", p._api.length === 0, p._api.join(","));
  check("mock: resumo com 2 itens renderizado", (await p.$$eval("#summary-items li", (els) => els.length)) === 2);
  check("mock: subtotal apresentado", (await txt(p, "#summary-subtotal")).trim() !== "—", await txt(p, "#summary-subtotal"));
  check("mock: chip do usuário presente", await has(p, ".account-session"));

  await fillCheckout(p, mockUser.email);
  await p.click("#co-submit");
  await p.waitForSelector("#checkout-success:not([hidden])", { timeout: 10000 });

  check("mock: código simulado NT-000001", (await txt(p, "#success-order")).trim() === "NT-000001", await txt(p, "#success-order"));
  check("mock: meta indica simulação", (await txt(p, "#success-meta")).includes("Simulação"), await txt(p, "#success-meta"));
  check("mock: carrinho limpo após sucesso", (await localStorageGet(p, "nexus:cart")) === "{}");
  const orders = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem("nexus:orders") || "[]"); } catch (e) { return []; } });
  check("mock: pedido persistido em nexus:orders", Array.isArray(orders) && orders.length === 1 && orders[0].id === "NT-000001", JSON.stringify(orders));
  check("mock: compra vinculada ao userId da sessão", orders[0] && String(orders[0].userId) === "777");
  check("mock: nenhuma chamada de API após finalizar", p._api.length === 0, p._api.join(","));
  check("mock: zero dialogs", p._dialogs.length === 0);
  check("mock: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  check("mock: storage sem token", !hasTokenLike(JSON.stringify(await dumpStorage(p))));
  await p.close();

  // mock SEM sessão: exige login, preserva carrinho e NÃO cria pedido
  const p2 = await open(D.browser, { mode: "mock", cart: CART_A });
  await fillCheckout(p2, "nao.sessao@example.com");
  await p2.click("#co-submit");
  await p2.waitForSelector("#checkout-auth-required:not([hidden])", { timeout: 6000 });
  check("mock sem sessão: bloqueio de autenticação visível", !(await hidden(p2, "#checkout-auth-required")));
  check("mock sem sessão: carrinho preservado", (await localStorageGet(p2, "nexus:cart")) === JSON.stringify(CART_A));
  check("mock sem sessão: nenhuma chamada de API", p2._api.length === 0, p2._api.join(","));
  await p2.close();
}

/* [2] API REAL — payload limpo, 201, valores do backend, carrinho limpo */
async function s02_pedidoReal() {
  console.log("\n[2] API mode: pedido real (201) + payload e valores do backend");
  const p = await loginToCheckout(D.A.email, { serverPort: PORT, cart: CART_A });

  const states = await p.evaluate(() => window.__authStates || []);
  check("api: boot api aguardado (passou por loading/authenticated)", states.includes("loading") && states.includes("authenticated"), states.join(">"));
  check("api: NENHUM POST de pedido durante o boot", !p._orderBodies.length, p._orderBodies.length + "");

  await fillCheckout(p, D.A.email);
  await p.click("#co-submit");
  await p.waitForSelector("#checkout-success:not([hidden])", { timeout: 15000 });

  const successOrder = (await txt(p, "#success-order")).trim();
  check("api: pedido exibido com código real NT-xxxxxxxxxx", /^NT-[0-9A-F]{10}$/.test(successOrder), successOrder);
  check("api: total do BACKEND usado na confirmação", (await txt(p, "#success-meta")).includes("Total R$") && (await txt(p, "#success-meta")).includes("8.399,70"), await txt(p, "#success-meta"));
  check("api: meta confirma pedido real (não simulação)", (await txt(p, "#success-meta")).includes("Pedido real confirmado"), await txt(p, "#success-meta"));
  check("api: carrinho limpo APÓS sucesso", (await localStorageGet(p, "nexus:cart")) === "{}");
  check("api: contador zerado", (await txt(p, "#cart-count")).trim() === "0", await txt(p, "#cart-count"));
  check("api: NENHUM pedido mock criado", (await localStorageGet(p, "nexus:orders")) === null || (await localStorageGet(p, "nexus:orders")) === "[]");

  check("api: 1 POST /api/orders (nenhum chamada mock paralela)", p._orderBodies.length === 1, p._orderBodies.length + "");
  const post = p._orderBodies[0];
  check("api: POST autenticado (Authorization Bearer)", Boolean(post.headers && post.headers.authorization && post.headers.authorization.includes("Bearer")), JSON.stringify(post.headers));
  const body = post.body ? JSON.parse(post.body) : null;
  check("api: payload JSON recebido", Boolean(body), post.body);

  const itemKeys = body.items.map((it) => Object.keys(it).sort().join(","));
  check("api: itens contêm SOMENTE productId+quantity", itemKeys.every((k) => k === "productId,quantity"), itemKeys.join(" | "));
  check("api: quantidade correta (2x produto 1, 1x produto 4)", JSON.stringify(body.items) === JSON.stringify([{ productId: 1, quantity: 2 }, { productId: 4, quantity: 1 }]), JSON.stringify(body.items));

  const topKeys = Object.keys(body).sort().join(",");
  check("api: body NÃO carrega preço/subtotal/total/estoque/cartão",
    topKeys === "address,deliveryMethod,idempotencyKey,items,paymentMethod",
    topKeys + " :: " + JSON.stringify(body));
  const flat = JSON.stringify(body).toLowerCase();
  check("api: nenhum campo price/stock/card/cvv em lugar algum",
    !/price|total|subtotal|shipping|stock|card|cvv|installment/i.test(flat), flat.slice(0, 300));
  check("api: address completo enviado", body.address && body.address.cep === "66010-000" && body.address.state === "PA" && body.address.street === "Av. Nazaré" && body.address.number === "123" && body.address.email === D.A.email, JSON.stringify(body.address));
  check("api: deliveryMethod standard", body.deliveryMethod === "standard", body.deliveryMethod);
  check("api: paymentMethod pix", body.paymentMethod === "pix", body.paymentMethod);
  check("api: idempotencyKey presente (chk-..., <=64)", typeof body.idempotencyKey === "string" && body.idempotencyKey.startsWith("chk-") && body.idempotencyKey.length <= 64, body.idempotencyKey);

  const dump = await dumpStorage(p);
  check("api: storage sem token/senha", !hasTokenLike(JSON.stringify(dump.ls) + JSON.stringify(dump.ss)) && !(JSON.stringify(dump.ls) + JSON.stringify(dump.ss)).includes(PWD));
  check("api: zero dialogs", p._dialogs.length === 0);
  check("api: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();

  // Backend: o pedido existe, com os valores calculados no servidor
  const loginRes = await apiLogin(D.A.email, PWD);
  const token = loginRes.body && loginRes.body.data && loginRes.body.data.accessToken;
  check("api backend: login ok", Boolean(token), loginRes.status + "");

  const list = await apiGetOrders(token);
  const orders = list.body && list.body.data && list.body.data.orders ? list.body.data.orders : [];
  check("api backend: GET /api/orders lista 1 pedido de A", orders.length === 1, JSON.stringify(orders).slice(0, 200));
  const order = orders[0] || {};
  check("api backend: pedido com o mesmo código exibido", order.code === successOrder, `${order.code}/${successOrder}`);
  check("api backend: status processing", order.status === "processing", order.status);
  check("api backend: subtotal/subtotal do servidor (839970)", order.subtotalCents === 839970 && order.totalCents === 839970, JSON.stringify(order));
  check("api backend: frete padrão grátis (>=50000)", order.shippingCents === 0, order.shippingCents + "");
  check("api backend: itemCount 3", order.itemCount === 3, order.itemCount + "");
  check("api backend: labels de entrega/pagamento", order.deliveryLabel === "Entrega padrão" && order.paymentLabel === "PIX");

  const detail = await apiGetOrder(token, order.id);
  const items = detail.body && detail.body.data && detail.body.data.items ? detail.body.data.items : [];
  check("api backend: GET /api/orders/:id traz detalhe", detail.status === 200 && items.length === 2, items.length + "");
  check("api backend: item 1 = produto 1 x2 (snapshot)", items[0] && items[0].productId === 1 && items[0].quantity === 2 && items[0].unitPriceCents === 399990, JSON.stringify(items[0]));
  check("api backend: item 2 = produto 4 x1", items[1] && items[1].productId === 4 && items[1].quantity === 1 && items[1].unitPriceCents === 39990, JSON.stringify(items[1]));

  // Estoques: SÓ o backend decrementa (o frontend nunca envia decremento)
  check("api estoque: produto 1 passou de 24 -> 22", (await dbInventory(1)) === 22, (await dbInventory(1)) + "");
  check("api estoque: produto 4 passou de 57 -> 56", (await dbInventory(4)) === 56, (await dbInventory(4)) + "");
}

/* [3] REPLAY idempotente (200) — mesma chave não duplica pedido */
async function s03_replay() {
  console.log("\n[3] Idempotência: mesma chave -> replay 200 (sem duplicar)");
  const p = await loginToCheckout(D.B.email, { serverPort: PORT, cart: CART_B });

  const key = `chk-replay-${ts}`;
  const result = await p.evaluate(async (payload) => {
    const m = await import("/assets/js/utils/user-api.js");
    const first = await m.default.createOrder(payload);
    const second = await m.default.createOrder(payload);
    return { first, second };
  }, {
    items: [{ productId: 10, quantity: 1 }],
    deliveryMethod: "standard",
    paymentMethod: "boleto",
    address: { name: "Bruno Lima", email: D.emailB, cep: "66010-000", street: "Av. Nazaré", number: "1", complement: null, neighborhood: "Nazaré", city: "Belém", state: "PA" },
    idempotencyKey: key,
  });

  check("replay: 1ª chamada criou pedido", result.first && result.first.created === true && result.first.order && result.first.order.code, JSON.stringify(result.first).slice(0, 160));
  check("replay: 2ª chamada devolveu replay (200)", result.second && result.second.created === false, JSON.stringify(result.second).slice(0, 160));
  check("replay: MESMO código nos dois retornos", result.first && result.second && result.first.order.code === result.second.order.code, "");
  check("replay: itens presentes no replay", result.second && Array.isArray(result.second.items) && result.second.items.length === 1);

  const loginRes = await apiLogin(D.B.email, PWD);
  const token = loginRes.body && loginRes.body.data && loginRes.body.data.accessToken;
  const list = await apiGetOrders(token);
  const orders = list.body && list.body.data && list.body.data.orders ? list.body.data.orders : [];
  check("replay backend: somente 1 pedido de B (nada duplicado)", orders.length === 1, orders.length + " :: " + JSON.stringify(orders).slice(0, 200));
  check("replay backend: estoque do produto 10 62 -> 61 (decremento único)", (await dbInventory(10)) === 61, (await dbInventory(10)) + "");
  await p.close();
}

/* [4] ERROS — nenhum caminho limpa o carrinho nem cria pedido mock */
async function s04_erros() {
  console.log("\n[4] Erros 400/401/403/409/500: carrinho preservado, sem sucesso falso");
  const cases = [
    { status: 400, msg: "Não foi possível validar o pedido. Revise os dados informados." },
    { status: 401, msg: "Sua sessão expirou. Entre novamente para concluir o pedido. Seu carrinho foi preservado." },
    { status: 403, msg: "Não foi possível concluir o pedido: sua conta está inativa." },
    { status: 409, msg: "Um ou mais produtos ficaram sem estoque. Seu carrinho foi preservado para revisão." },
    { status: 500, msg: "Ocorreu um erro inesperado ao finalizar o pedido. Tente novamente em instantes." },
  ];

  for (const c of cases) {
    D.stubCfg.orderPost = c.status;
    D.stubCfg.orderPostFn = null;
    const p = await loginToCheckout(D.C.email, { serverPort: STUB_PORT, cart: CART_ERR });
    await fillCheckout(p, D.C.email);
    await p.click("#co-submit");

    await p.waitForFunction((m) => {
      const el = document.getElementById("checkout-status");
      return el && el.textContent && el.textContent.includes(m);
    }, { timeout: 10000 }, c.msg);

    check(`${c.status}: mensagem amigável exibida`, (await txt(p, "#checkout-status")).includes(c.msg), await txt(p, "#checkout-status"));
    check(`${c.status}: carrinho NÃO limpo`, (await localStorageGet(p, "nexus:cart")) === JSON.stringify(CART_ERR), await localStorageGet(p, "nexus:cart"));
    check(`${c.status}: formulário continua visível (pode tentar de novo)`, !(await hidden(p, "#checkout-layout")));
    check(`${c.status}: tela de sucesso NÃO aparece`, await hidden(p, "#checkout-success"));
    check(`${c.status}: NENHUM pedido mock criado`, (await localStorageGet(p, "nexus:orders")) === null || (await localStorageGet(p, "nexus:orders")) === "[]");
    check(`${c.status}: botão reabilitado para nova tentativa`, await p.$eval("#co-submit", (el) => !el.disabled).catch(() => true));
    if (c.status === 401) {
      check("401: bloqueio de autenticação visível", !(await hidden(p, "#checkout-auth-required")));
    }
    check(`${c.status}: zero dialogs`, p._dialogs.length === 0);
    await p.close();
  }
}

/* [5] MESMA tentativa repetida usa a MESMA chave (500 -> sucesso) */
async function s05_chaveEstavel() {
  console.log("\n[5] Idempotência: retry da MESMA tentativa mantém a MESMA chave");
  D.stubCfg.orderPost = null;
  D.stubCfg.orderPostFn = (n) => (n === 1 ? 500 : null); // 1º falha, 2º segue p/ API real
  D.stubCfg.orderAttempts = 0; // contador dedicado a esta tentativa

  const p = await loginToCheckout(D.D.email, { serverPort: STUB_PORT, cart: CART_D });
  await fillCheckout(p, D.D.email);

  // 1ª tentativa -> 500
  await p.click("#co-submit");
  await p.waitForFunction(() => {
    const el = document.getElementById("checkout-status");
    return el && el.textContent && el.textContent.includes("inesperado");
  }, { timeout: 10000 });
  check("estável: erro 500 na 1ª tentativa (carrinho preservado)", (await localStorageGet(p, "nexus:cart")) === JSON.stringify(CART_D));
  const key1 = p._orderBodies.length ? (JSON.parse(p._orderBodies[0].body).idempotencyKey) : null;
  check("estável: chave capturada na 1ª tentativa", typeof key1 === "string" && key1.startsWith("chk-"), key1);

  // 2ª tentativa (mesma página/form) -> sucesso real
  await p.click("#co-submit");
  await p.waitForSelector("#checkout-success:not([hidden])", { timeout: 15000 });
  const key2 = p._orderBodies.length >= 2 ? (JSON.parse(p._orderBodies[1].body).idempotencyKey) : null;
  check("estável: 2ª tentativa usou a MESMA chave", key2 === key1, `${key1} vs ${key2}`);
  check("estável: sucesso com código real", /^NT-[0-9A-F]{10}$/.test((await txt(p, "#success-order")).trim()));
  check("estável: carrinho limpo APÓS o sucesso", (await localStorageGet(p, "nexus:cart")) === "{}");
  check("estável: zero dialogs", p._dialogs.length === 0);
  check("estável: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();
}

/* [6] Sessão expirada/ausente — NÃO envia POST e preserva o carrinho */
async function s06_semSessao() {
  console.log("\n[6] Sem sessão API: nenhum POST /api/orders");
  const p = await open(D.browser, { mode: "api", serverPort: PORT, cart: CART_ERR });
  await waitAuthState(p, "unauthenticated");
  await fillCheckout(p, "nao.sessao@example.com");
  await p.click("#co-submit");
  await p.waitForSelector("#checkout-auth-required:not([hidden])", { timeout: 8000 });

  check("sem sessão: bloqueio de autenticação visível", !(await hidden(p, "#checkout-auth-required")));
  check("sem sessão: NENHUM POST /api/orders enviado", p._orderBodies.length === 0, p._orderBodies.length + "");
  check("sem sessão: mensagem de entrada preserva o carrinho", (await txt(p, "#checkout-status")).includes("carrinho foi preservado"), await txt(p, "#checkout-status"));
  check("sem sessão: carrinho preservado", (await localStorageGet(p, "nexus:cart")) === JSON.stringify(CART_ERR));
  check("sem sessão: NENHUM pedido mock criado", (await localStorageGet(p, "nexus:orders")) === null || (await localStorageGet(p, "nexus:orders")) === "[]");
  check("sem sessão: zero dialogs", p._dialogs.length === 0);
  await p.close();
}

/* ------------------------------------------------------------------- main --- */

async function cleanup(pool) {
  const emails = D.emails;
  if (!emails.length) return;
  const [users] = await pool.query("SELECT id FROM users WHERE email IN (?)", [emails]);
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const [orders] = await pool.query("SELECT id FROM orders WHERE user_id IN (?)", [ids]);
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length) {
      await pool.query("DELETE FROM order_items WHERE order_id IN (?)", [orderIds]);
      await pool.query("DELETE FROM orders WHERE id IN (?)", [orderIds]);
    }
    await pool.query("DELETE FROM admin_actions WHERE admin_id IN (?)", [ids]);
    await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (?)", [ids]);
    await pool.query("DELETE FROM user_profile WHERE user_id IN (?)", [ids]);
    await pool.query("DELETE FROM users WHERE email IN (?)", [emails]);
  }

  // Restaura o inventário ao snapshot feito antes da suíte
  for (const [productId, quantity] of D.inventorySnapshot) {
    const [res] = await pool.query("UPDATE inventory SET quantity = ? WHERE product_id = ?", [quantity, productId]);
    if (res.affectedRows === 0) {
      await pool.query("INSERT INTO inventory (product_id, quantity) VALUES (?, ?)", [productId, quantity]);
    }
  }
}

async function assertBaseline(pool) {
  const [orders] = await pool.query("SELECT COUNT(*) c FROM orders");
  const [items] = await pool.query("SELECT COUNT(*) c FROM order_items");
  const [testUsers] = await pool.query("SELECT COUNT(*) c FROM users WHERE email LIKE '%@fase9d.test'");
  check("baseline: 0 pedidos", Number(orders[0].c) === 0, `c=${orders[0].c}`);
  check("baseline: 0 order_items", Number(items[0].c) === 0, `c=${items[0].c}`);
  check("baseline: 0 usuários de teste", Number(testUsers[0].c) === 0, `c=${testUsers[0].c}`);
  const [inv] = await pool.query("SELECT product_id, quantity FROM inventory");
  const now = new Map(inv.map((r) => [Number(r.product_id), Number(r.quantity)]));
  const okInv = D.inventorySnapshot.every(([id, qty]) => now.get(id) === qty);
  check("baseline: estoque restaurado (snapshot)", okInv, JSON.stringify([...now.entries()]));
}

async function main() {
  const api = spawn(process.execPath, ["src/index.js"], { cwd: SERVER_DIR, stdio: "ignore" });
  const main = await startServer(PORT, { proxyTo: API_PORT });
  const stub = await startServer(STUB_PORT, { proxyTo: API_PORT });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
    waitForInitialPage: false,
  });
  D.browser = browser;
  D.pool = await mysql.createPool({ host: "127.0.0.1", user: "nexus_app", password: "nexusapp", database: "nexus_tech_db", connectionLimit: 5 });
  D.stubCfg = stub.cfg;
  D.stubCfg.orderPost = null;
  D.stubCfg.orderPostFn = null;

  try {
    await waitApi();

    const [inv] = await D.pool.query("SELECT product_id, quantity FROM inventory");
    D.inventorySnapshot = inv.map((r) => [Number(r.product_id), Number(r.quantity)]);

    const reg = async (prefix, name) => {
      const res = await apiRegister(mkEmail(prefix), PWD, name);
      check(`setup: usuário ${name} criado`, res.status === 201, `status=${res.status}`);
      const data = res.body && res.body.data || {};
      return (data.user && data.user.email) || null;
    };

    const emailA = await reg("ana", "Ana Souza");
    const emailB = await reg("bruno", "Bruno Lima");
    const emailC = await reg("carla", "Carla Dias");
    const emailD = await reg("diego", "Diego Alves");
    if (!emailA || !emailB || !emailC || !emailD) throw new Error("register não retornou e-mails de teste");
    D.A = { email: emailA }; D.B = { email: emailB }; D.C = { email: emailC }; D.D = { email: emailD };
    D.emailB = emailB;
    D.emails.push(emailA, emailB, emailC, emailD);
    console.log("setup: usuários de teste criados");

    console.log("\n=== FASE 9-D — suíte do checkout real (modo api + mock) ===\n");

    await s01_mockPreservado();
    await s02_pedidoReal();
    await s03_replay();
    await s04_erros();
    await s05_chaveEstavel();
    await s06_semSessao();

  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => main.server.close(r));
    await new Promise((r) => stub.server.close(r));
    try { api.kill("SIGKILL"); } catch (e) { /* já encerrado */ }
    try {
      await cleanup(D.pool);
      await assertBaseline(D.pool);
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
  if (!/Target closed|TargetCreateError|Protocol error/i.test(String(e && e.message))) console.error("UNCAUGHT:", e && e.stack);
});
process.on("unhandledRejection", (e) => {
  if (!/Target closed|TargetCreateError|Protocol error/i.test(String(e && e.message))) console.error("UNHANDLED:", e);
});

main().catch((err) => { console.error("FALHA FATAL:", err); process.exitCode = 1; });
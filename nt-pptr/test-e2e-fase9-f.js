/* ==========================================================================
   NEXUS TECH — FASE 9-F · E2E integrado do fluxo feliz (UI → API → banco)

   Uma única jornada contínua de navegador cobrindo os 22 passos da fase 9:
      registrar -> login -> produtos -> produto -> carrinho -> checkout ->
      POST /api/orders -> estoque reduzido (DB) -> Minha Conta (pedidos) ->
      GET /api/orders -> detalhe -> GET /api/orders/:id.

   Pontos verificados APENAS neste arquivo (complementam as suítes 9-D/9-E):
     A. A jornada inteira acontece em UMA página (mesmo origin), com o
        carrinho local (nexus:cart) atravessando páginas sem perda.
     B. O pedido REAL criado é conferido no banco (orders + order_items +
        inventory) e via API, não apenas na tela.
     C. Preço HISTÓRICO no detalhe sobrevive a mudança de preço do produto.
     D. Alterações no usuário (nome) NÃO alteram o snapshot do pedido.
     E. Sessão nova (fresh tab + re-login) continua mostrando o MESMO pedido,
        sem duplicação nem contaminação entre sessões.
     F. Ownership: usuário B NÃO enxerga o pedido de A (404 no GET /:id).

   Itens 1-22 da fase que já são cobertos por outras suítes (referência no
   relatório final): test-login-api, test-perfil-api, test-orders-api,
   test-checkout-api, test-orders-repository, test-profile-orders.

   Sobe o backend real (server/src/index.js -> :4000) e um proxy estático
   (porta 8851) que serve o frontend e repassa /api/* na MESMA origem.
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
const PORT = 8851;          // estático + proxy -> API (jornada completa 9-F)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const ts = Date.now();
const mkEmail = (p) => `${p}-${ts}@fase9f.test`;
const PWD = "Nexus123";
const D = { emails: [] };

/* Preços/quantidades da jornada (mock products.js == banco, fase 9/9-E). */
const P1 = { id: 1, slug: "notebook-nexus-a15", name: "Notebook Nexus A15", price: 399990, qty: 2 };
const P4 = { id: 4, slug: "teclado-mecanico-nexus-rgb", name: "Teclado Mecânico Nexus RGB", price: 39990, qty: 1 };
const SUBTOTAL = P1.price * P1.qty + P4.price * P4.qty; // 839970
const SHIPPING = 0;                                     // subtotal >= 50000 -> grátis
const TOTAL = SUBTOTAL + SHIPPING;                      // 839970

const fmt = (c) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((c || 0) / 100);

const CHECKOUT_FIELDS = {
  "#co-name": "Comprador Nexus",
  "#co-email": "", // preenchido com o e-mail da jornada
  "#co-phone": "(91) 98765-4321",
  "#co-cep": "66010-000",
  "#co-street": "Av. Nazaré",
  "#co-number": "123",
  "#co-neighborhood": "Nazaré",
  "#co-city": "Belém",
  "#co-state": "PA",
};

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; failures.push(`${name} :: ${detail}`); console.log(`  FAIL ${name} :: ${detail}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------------------------------------------- servidores --- */

function startServer(port) {
  const proxy = (req, res) => {
    const upstream = http.request(
      { hostname: "127.0.0.1", port: API_PORT, path: req.url, method: req.method, headers: { ...req.headers } },
      (ures) => { res.writeHead(ures.statusCode, ures.headers); ures.pipe(res); }
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  };

  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) { proxy(req, res); return; }
    let urlPath = decodeURIComponent(req.url.split("#")[0].split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fsRead(file, res);
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server })));
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

const benignNet = /Failed to load resource: the server responded with a status of (401|404|409|500)/;
function hardErrors(p) {
  return p._pageErrs.concat(p._errs.filter((m) => !benignNet.test(m)));
}

const hasTokenLike = (str) => /accessToken|"token"|Bearer|eyJ[A-Za-z0-9_-]{8,}\./.test(str || "");
const hasPasswordLike = (str) => /\bpassword(_hash)?\b/.test(str || "");

/* Página de jornada: SEM limpar storage em cada navegação (o carrinho precisa
   atravessar páginas no mesmo tab). Storage é limpo UMA vez antes do início. */
async function openJourney(browser, urlPath, mode = "api") {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 800 });
  await clearCookies(page);
  if (mode === "api") {
    await page.evaluateOnNewDocument(() => { window.NEXUS_STOREFRONT_AUTH = "api"; });
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

  const url = `http://127.0.0.1:${PORT}${urlPath}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* ignora */ } });
  await page.reload({ waitUntil: "networkidle0" });
  return page;
}

function dumpStorage(p) {
  return p.evaluate(() => {
    const scan = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
    return { ls: scan(localStorage), ss: scan(sessionStorage) };
  });
}

const localStorageGet = (p, key) =>
  p.evaluate((k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, key);

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

const dbInventory = async (id) => {
  const [rows] = await D.pool.query("SELECT quantity FROM inventory WHERE product_id = ?", [id]);
  return rows[0] ? Number(rows[0].quantity) : null;
};

/* ---------------------------------------------------------------- navegação --- */

async function goPedidos(p) {
  const anchor = '#profile-nav .profile-nav__link[data-section="pedidos"]';
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await p.click(anchor).catch(() => {});
    try {
      await p.waitForSelector("#meus-pedidos:not([hidden])", { timeout: 1500 });
      await sleep(120);
      return;
    } catch (err) { /* ainda não vinculado — nova tentativa */ }
  }
  await p.waitForSelector("#meus-pedidos:not([hidden])", { timeout: 3000 });
  await sleep(120);
}

async function cardSummaries(p) {
  return p.$$eval(".pedido", (els) =>
    els.map((e) => ({
      head: (e.querySelector(".pedido__head") && e.querySelector(".pedido__head").textContent) || "",
      number: (e.querySelector(".pedido__number") && e.querySelector(".pedido__number").textContent) || "",
      meta: (e.querySelector(".pedido__meta") && e.querySelector(".pedido__meta").textContent) || "",
    })),
  ).catch(() => []);
}

async function fillCheckout(p, email) {
  for (const [sel, v] of Object.entries(CHECKOUT_FIELDS)) {
    await setField(p, sel, sel === "#co-email" ? email : v);
  }
  await p.click("#co-payment-pix");
  await sleep(80);
}

/* ------------------------------------------------------------------ cenários --- */

/* [1] JORNADA COMPLETA — registrar (UI) -> login -> produtos -> carrinho ->
      checkout real -> banco -> Minha Conta -> detalhe (API) */
async function s01_jornadaCompleta() {
  console.log("\n[1] Jornada completa (UI -> API -> banco)");

  /* -- (a) CADASTRO via UI (modo api) -------------------------------------- */
  const email = D.A.email;
  const p = await openJourney(D.browser, "/pages/cadastro.html", "api");
  await p.waitForSelector("#register-form", { timeout: 10000 });
  await setField(p, "#register-name", "Fase 9F Usuário");
  await setField(p, "#register-email", email);
  await setField(p, "#register-phone", "(91) 98765-4321");
  await setField(p, "#register-cpf", "529.982.247-25");
  await setField(p, "#register-password", PWD);
  await setField(p, "#register-password-confirm", PWD);
  await p.click("#register-terms");
  await p.click("#register-privacy");
  await p.click("#register-submit");
  await p.waitForSelector("#register-success:not([hidden])", { timeout: 12000 });

  check("cadastro: sucesso visível", !(await hidden(p, "#register-success")));
  const stored = await localStorageGet(p, "nexus:user");
  const storedUser = stored ? JSON.parse(stored) : null;
  check("cadastro: nexus:user contém o e-mail", storedUser && storedUser.email === email, String(stored));
  check("cadastro: nexus:user tem id do servidor", storedUser && /^\d+$/.test(String(storedUser.id)), String(stored));
  if (storedUser && /^\d+$/.test(String(storedUser.id))) {
    D.A.id = Number(storedUser.id);
    D.A.name = storedUser.name || D.A.name;
  }
  const dumpReg = await dumpStorage(p);
  check("cadastro: storage sem token/senha", !hasTokenLike(JSON.stringify(dumpReg.ls)) && !hasPasswordLike(JSON.stringify(dumpReg.ls) + JSON.stringify(dumpReg.ss)) && !JSON.stringify(dumpReg).includes(PWD), JSON.stringify(dumpReg).slice(0, 300));
  check("cadastro: zero dialogs", p._dialogs.length === 0);
  check("cadastro: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));

  /* -- (b) LOGIN via UI ----------------------------------------------------- */
  await p.goto(`http://127.0.0.1:${PORT}/pages/login.html?next=produtos.html`, { waitUntil: "networkidle0" });
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, email, PWD);
  await waitForUrl(p, "pages/produtos.html");
  await waitAuthState(p, "authenticated");
  check("login: autenticado após submit", true);

  /* -- (c) PRODUTOS (catálogo) + produto ----------------------------------- */
  await p.waitForSelector('#product-grid a[href*="produto.html?slug="]', { timeout: 10000 });
  await p.evaluate((slug) => {
    const a = [...document.querySelectorAll('a[href*="produto.html?slug="]')].find((x) => x.getAttribute("href").includes(slug));
    if (a) a.click();
  }, P1.slug);
  await waitForUrl(p, `produto.html?slug=${P1.slug}`);
  await p.waitForSelector("#product-title", { timeout: 8000 });
  check("produto 1: página aberta pelo catálogo", (await txt(p, "#product-title")).trim() === P1.name, await txt(p, "#product-title"));
  check("produto 1: preço renderizado", (await txt(p, ".product-info__price")).includes(fmt(P1.price)), await txt(p, ".product-info__price"));
  check("produto 1: em estoque", (await txt(p, ".product-info__stock")).includes("Em estoque"), await txt(p, ".product-info__stock"));

  await p.click('.qty-stepper__btn[aria-label="Aumentar quantidade"]');
  check("produto 1: quantidade 2 via stepper", (await p.$eval("#qty-input", (el) => el.value)) === "2", await p.$eval("#qty-input", (el) => el.value));
  await p.click(".product-buy__cart-btn");
  await p.waitForFunction((n) => {
    const el = document.querySelector(".product-buy__feedback");
    return el && !el.hidden && el.textContent.includes(n);
  }, { timeout: 6000 }, "2 ×");
  check("produto 1: feedback 'Adicionado! 2 × '", (await txt(p, ".product-buy__feedback")).includes(`2 × ${P1.name}`), await txt(p, ".product-buy__feedback"));
  check("produto 1: contador do header = 2", (await txt(p, "#cart-count")).trim() === "2", await txt(p, "#cart-count"));

  /* -- (d) PRODUTO 2 (teclado) --------------------------------------------- */
  await p.goto(`http://127.0.0.1:${PORT}/pages/produto.html?slug=${P4.slug}`, { waitUntil: "networkidle0" });
  await p.waitForSelector("#product-title", { timeout: 8000 });
  check("produto 2: página aberta", (await txt(p, "#product-title")).trim() === P4.name, await txt(p, "#product-title"));
  await p.click(".product-buy__cart-btn");
  await p.waitForFunction((n) => {
    const el = document.querySelector(".product-buy__feedback");
    return el && !el.hidden && el.textContent.includes(n);
  }, { timeout: 6000 }, "1 ×");
  check("produto 2: feedback '1 × '", (await txt(p, ".product-buy__feedback")).includes(`1 × ${P4.name}`), await txt(p, ".product-buy__feedback"));
  check("produto 2: contador do header = 3", (await txt(p, "#cart-count")).trim() === "3", await txt(p, "#cart-count"));

  /* -- (e) CARRINHO --------------------------------------------------------- */
  await p.goto(`http://127.0.0.1:${PORT}/pages/carrinho.html`, { waitUntil: "networkidle0" });
  await p.waitForSelector(".cart-item", { timeout: 8000 });
  check("carrinho: 2 itens listados", (await p.$$eval(".cart-item", (els) => els.length)) === 2, (await p.$$eval(".cart-item", (els) => els.length)) + "");
  check("carrinho: nota '2 produtos no carrinho'", (await txt(p, "#cart-note")).includes("2 produtos no carrinho"), await txt(p, "#cart-note"));
  const sub1 = await p.$eval('.cart-item[aria-label*="Notebook"] .cart-item__subtotal', (el) => el.textContent).catch(() => "");
  const sub2 = await p.$eval('.cart-item[aria-label*="Teclado"] .cart-item__subtotal', (el) => el.textContent).catch(() => "");
  check("carrinho: subtotal do notebook", sub1.includes(fmt(P1.price * P1.qty)), sub1);
  check("carrinho: subtotal do teclado", sub2.includes(fmt(P4.price)), sub2);
  const sumText = await txt(p, ".cart-summary");
  check("carrinho: subtotal resumo", sumText.includes(fmt(SUBTOTAL)), sumText);
  check("carrinho: frete grátis", sumText.includes("Grátis"), sumText);
  check("carrinho: total resumo", sumText.includes(fmt(TOTAL)), sumText);
  await p.click('.cart-summary__actions a[href="checkout.html"]');
  await waitForUrl(p, "pages/checkout.html");

  /* -- (f) CHECKOUT real ---------------------------------------------------- */
  await p.waitForSelector("#co-name", { timeout: 8000 });
  await fillCheckout(p, email);
  await p.click("#co-submit");
  await p.waitForSelector("#checkout-success:not([hidden])", { timeout: 15000 });

  const successOrder = (await txt(p, "#success-order")).trim();
  check("checkout: código real NT-xxxxxxxxxx", /^NT-[0-9A-F]{10}$/.test(successOrder), successOrder);
  const meta = await txt(p, "#success-meta");
  check("checkout: total do BACKEND na confirmação", meta.includes("Total R$") && meta.includes(fmt(TOTAL)), meta);
  check("checkout: meta 'Pedido real confirmado'", meta.includes("Pedido real confirmado"), meta);
  check("checkout: carrinho limpo após sucesso", (await localStorageGet(p, "nexus:cart")) === "{}", await localStorageGet(p, "nexus:cart"));
  check("checkout: contador zerado", (await txt(p, "#cart-count")).trim() === "0", await txt(p, "#cart-count"));
  check("checkout: NENHUM pedido mock", (await localStorageGet(p, "nexus:orders")) === null || (await localStorageGet(p, "nexus:orders")) === "[]");

  check("checkout: exatamente 1 POST /api/orders", p._orderBodies.length === 1, p._orderBodies.length + "");
  const post = p._orderBodies[0];
  check("checkout: POST autenticado (Bearer)", Boolean(post.headers && post.headers.authorization && post.headers.authorization.includes("Bearer")), JSON.stringify(post.headers));
  const body = post.body ? JSON.parse(post.body) : null;
  const itemKeys = (body && body.items || []).map((it) => Object.keys(it).sort().join(","));
  check("checkout: payload itens = apenas productId+quantity", itemKeys.length === 2 && itemKeys.every((k) => k === "productId,quantity"), itemKeys.join(" | "));
  check("checkout: quantidades corretas (2x p1, 1x p4)", body && JSON.stringify(body.items) === JSON.stringify([{ productId: 1, quantity: 2 }, { productId: 4, quantity: 1 }]), post.body);
  const topKeys = body ? Object.keys(body).sort().join(",") : "";
  check("checkout: body NÃO carrega preço/estoque/cartão", topKeys === "address,deliveryMethod,idempotencyKey,items,paymentMethod", topKeys);
  const flat = JSON.stringify(body || {}).toLowerCase();
  check("checkout: nenhum price/stock/card/cvv", !/price|stock|card|cvv|installment/i.test(flat), flat.slice(0, 300));
  check("checkout: endereço completo no payload", body && body.address.cep === "66010-000" && body.address.state === "PA" && body.address.street === "Av. Nazaré" && body.address.number === "123" && body.address.email === email, JSON.stringify(body && body.address));
  check("checkout: delivery standard / payment pix", body && body.deliveryMethod === "standard" && body.paymentMethod === "pix", JSON.stringify(body));
  check("checkout: idempotencyKey chk- <=64", typeof body.idempotencyKey === "string" && body.idempotencyKey.startsWith("chk-") && body.idempotencyKey.length <= 64, body.idempotencyKey);

  const postDump = await dumpStorage(p);
  check("checkout: storage sem token/senha", !hasTokenLike(JSON.stringify(postDump.ls) + JSON.stringify(postDump.ss)) && !JSON.stringify(postDump).includes(PWD), JSON.stringify(postDump).slice(0, 300));
  check("checkout: zero dialogs", p._dialogs.length === 0);
  check("checkout: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));

  /* -- (g) BACKEND + BANCO --------------------------------------------------- */
  const loginRes = await apiLogin(email, PWD);
  const token = loginRes.body && loginRes.body.data && loginRes.body.data.accessToken;
  check("backend: token obtido", Boolean(token), loginRes.status + "");

  const list = await apiGetOrders(token);
  const orders = (list.body && list.body.data && list.body.data.orders) || [];
  check("backend: lista com 1 pedido", orders.length === 1, JSON.stringify(orders).slice(0, 200));
  const order = orders[0] || {};
  D.journeyOrder = order;
  check("backend: mesmo código da confirmação", order.code === successOrder, `${order.code}/${successOrder}`);
  check("backend: status processing", order.status === "processing", order.status);
  check("backend: subtotal do servidor (839970)", order.subtotalCents === 839970, JSON.stringify(order));
  check("backend: frete grátis (0)", order.shippingCents === 0, order.shippingCents + "");
  check("backend: total do servidor (839970)", order.totalCents === 839970, order.totalCents + "");
  check("backend: itemCount 3", order.itemCount === 3, order.itemCount + "");
  check("backend: labels entrega/pagamento", order.deliveryLabel === "Entrega padrão" && order.paymentLabel === "PIX", JSON.stringify(order));

  const detail = await apiGetOrder(token, order.id);
  const items = detail.body && detail.body.data && detail.body.data.items ? detail.body.data.items : [];
  check("backend: GET /:id com detalhe", detail.status === 200 && items.length === 2, `${detail.status}/${items.length}`);
  const itP1 = items.find((i) => i.productId === 1) || {};
  const itP4 = items.find((i) => i.productId === 4) || {};
  check("backend: item p1 snapshot (2x R$ 3.999,90)", itP1.quantity === 2 && itP1.unitPriceCents === 399990, JSON.stringify(itP1));
  check("backend: item p4 snapshot (1x R$ 399,90)", itP4.quantity === 1 && itP4.unitPriceCents === 39990, JSON.stringify(itP4));
  check("backend: nomes históricos dos itens", itP1.productName === P1.name && itP4.productName === P4.name, `${itP1.productName}/${itP4.productName}`);

  check("estoque DB: produto 1 reduzido em 2", (await dbInventory(1)) === D.invMap.get(1) - 2, String(await dbInventory(1)));
  check("estoque DB: produto 4 reduzido em 1", (await dbInventory(4)) === D.invMap.get(4) - 1, String(await dbInventory(4)));

  /* -- (h) OWNERSHIP: usuário B não vê o pedido de A ------------------------ */
  const bLogin = await apiLogin(D.B.email, PWD);
  const bToken = bLogin.body && bLogin.body.data && bLogin.body.data.accessToken;
  const foreign = await apiGetOrder(bToken, order.id);
  check("ownership: GET /:id com token de B -> 404", foreign.status === 404, foreign.status + "");

  /* -- (i) MINHA CONTA: lista + detalhe na UI ------------------------------- */
  await p.goto(`http://127.0.0.1:${PORT}/pages/perfil.html`, { waitUntil: "networkidle0" });
  await waitAuthState(p, "authenticated");
  await goPedidos(p);
  await p.waitForSelector("#pedidos-list:not([hidden])", { timeout: 10000 });
  const cards = await cardSummaries(p);
  check("perfil: 1 card de pedido", cards.length === 1 && cards[0].number.includes(successOrder), JSON.stringify(cards));
  check("perfil: meta do card (total/entrega/pagamento)", cards.length === 1 && cards[0].meta.includes(fmt(TOTAL)) && cards[0].meta.includes("Entrega padrão") && cards[0].meta.includes("PIX"), cards[0] && cards[0].meta);

  await p.click(`[data-order-toggle="${order.id}"]`);
  await p.waitForSelector(`#pedido-${order.id}-details:not([hidden])`, { timeout: 8000 });
  await p.waitForFunction((id) => {
    const el = document.getElementById(`pedido-${id}-details`);
    return el && el.textContent.includes("Itens do pedido");
  }, { timeout: 10000 }, order.id);

  const d = await txt(p, `#pedido-${order.id}-details`);
  check("detalhe: itens listados", d.includes(P1.name) && d.includes(P4.name), d.slice(0, 400));
  check("detalhe: preço histórico p1 (2x)", d.includes(`2 × ${fmt(P1.price)}`) || (d.includes("2 ×") && d.includes(fmt(P1.price))), d.slice(0, 400));
  check("detalhe: preço histórico p4 (1x)", d.includes(fmt(P4.price)), d.slice(0, 400));
  check("detalhe: subtotal do pedido", d.includes(fmt(SUBTOTAL)), d.slice(0, 400));
  check("detalhe: entrega padrão + PIX", d.includes("Entrega padrão") && d.includes("PIX"), d.slice(0, 400));
  check("detalhe: snapshot endereço (rua/número)", d.includes("Av. Nazaré, 123"), d.slice(0, 400));
  check("detalhe: snapshot endereço (CEP)", d.includes("66010-000"), d.slice(0, 400));
  check("detalhe: snapshot endereço (bairro)", d.includes("Nazaré"), d.slice(0, 400));
  check("detalhe: snapshot endereço (cidade/UF)", d.includes("Belém/PA"), d.slice(0, 400));
  check("detalhe: zero dialogs", p._dialogs.length === 0);
  check("detalhe: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));

  /* -- (j) SNAPSHOT IMUTÁVEL ------------------------------------------------- */
  const oldP1 = P1.price, oldP4 = P4.price;
  await D.pool.query("UPDATE products SET price_cents = ? WHERE id = ?", [oldP1 + 1000, P1.id]);
  await D.pool.query("UPDATE products SET price_cents = ? WHERE id = ?", [oldP4 + 1000, P4.id]);
  await sleep(150);
  const again = await apiGetOrder(token, order.id);
  const itemsAgain = (again.body && again.body.data && again.body.data.items) || [];
  const a1 = itemsAgain.find((i) => i.productId === 1) || {};
  const a4 = itemsAgain.find((i) => i.productId === 4) || {};
  check("snapshot: preço do item NÃO muda com produto", a1.unitPriceCents === oldP1 && a4.unitPriceCents === oldP4, JSON.stringify(itemsAgain));

  await D.pool.query("UPDATE users SET name = ? WHERE id = ?", ["Nome Alterado Depois", D.A.id]);
  const dv2 = await apiGetOrder(token, order.id);
  const detailOrder = (dv2.body && dv2.body.data && dv2.body.data.order) || {};
  check("snapshot: nome de entrega do pedido imutável", detailOrder.deliveryName === "Comprador Nexus", detailOrder.deliveryName + "");

  await p.click(`[data-order-toggle="${order.id}"]`);
  await sleep(150);
  await p.click(`[data-order-toggle="${order.id}"]`);
  await p.waitForFunction(
    (id) => {
      const el = document.getElementById(`pedido-${id}-details`);
      return el && !el.hidden && el.textContent.includes("Itens do pedido");
    },
    { timeout: 10000 }, order.id);
  const d2 = await txt(p, `#pedido-${order.id}-details`);
  check("snapshot: detalhe reaberto ainda mostra preço histórico", d2.includes(fmt(oldP1)) && !d2.includes(fmt(oldP1 + 1000)), d2.slice(0, 400));
  check("snapshot: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));

  /* -- restaura estado mutado ----------------------------------------------- */
  await D.pool.query("UPDATE products SET price_cents = ? WHERE id = ?", [oldP1], P1.id).catch(() => {});
  await D.pool.query("UPDATE products SET price_cents = ? WHERE id = ?", [oldP4], P4.id).catch(() => {});
  await D.pool.query("UPDATE users SET name = ? WHERE id = ?", [D.A.name], D.A.id).catch(() => {});

  await p.close();
}

/* [2] SESSÃO NOVA — re-login em tab limpo mostra o MESMO pedido sem duplicar */
async function s02_sessaoNova() {
  console.log("\n[2] Sessão nova (tab limpo + re-login) preserva o pedido");
  const order = D.journeyOrder;
  const p = await openJourney(D.browser, "/pages/login.html?next=perfil.html", "api");
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, D.A.email, PWD);
  await waitForUrl(p, "pages/perfil.html");
  await waitAuthState(p, "authenticated");

  await goPedidos(p);
  await p.waitForSelector("#pedidos-list:not([hidden])", { timeout: 10000 });
  const cards = await cardSummaries(p);
  check("nova sessão: exatamente 1 pedido", cards.length === 1, JSON.stringify(cards));
  check("nova sessão: mesmo código", cards.length === 1 && cards[0].number.includes(order.code), JSON.stringify(cards));
  check("nova sessão: mesmo total", cards.length === 1 && cards[0].meta.includes(fmt(TOTAL)), cards[0] && cards[0].meta);
  check("nova sessão: NENHUM POST /api/orders", p._orderBodies.length === 0, p._orderBodies.length + "");

  const again = await apiGetOrders((await apiLogin(D.A.email, PWD)).body.data.accessToken);
  const orders = (again.body && again.body.data && again.body.data.orders) || [];
  check("nova sessão: backend segue com 1 pedido (nada duplicado)", orders.length === 1 && orders[0].code === order.code, orders.length + "");
  check("nova sessão: zero dialogs", p._dialogs.length === 0);
  check("nova sessão: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();
}

/* ------------------------------------------------------------------- main --- */

async function cleanup(pool) {
  if (D.emails.length) {
    try { await pool.query("DELETE FROM users WHERE email IN (?)", [D.emails]); } catch (e) { console.error("[cleanup] users:", e.message); }
  }
  for (const [id, qty] of D.inventorySnapshot) {
    try { await pool.query("UPDATE inventory SET quantity = ? WHERE product_id = ?", [qty, id]); } catch (e) { console.error("[cleanup] inventory:", e.message); }
  }
  for (const [id, price] of D.priceSnapshot) {
    try { await pool.query("UPDATE products SET price_cents = ? WHERE id = ?", [price, id]); } catch (e) { console.error("[cleanup] products:", e.message); }
  }
}

async function assertBaseline(pool) {
  const [orders] = await pool.query("SELECT COUNT(*) c FROM orders");
  const [items] = await pool.query("SELECT COUNT(*) c FROM order_items");
  const [testUsers] = await pool.query("SELECT COUNT(*) c FROM users WHERE email LIKE '%@fase9f.test'");
  check("baseline: 0 pedidos", Number(orders[0].c) === 0, `c=${orders[0].c}`);
  check("baseline: 0 order_items", Number(items[0].c) === 0, `c=${items[0].c}`);
  check("baseline: 0 usuários de teste", Number(testUsers[0].c) === 0, `c=${testUsers[0].c}`);
  const [inv] = await pool.query("SELECT product_id, quantity FROM inventory ORDER BY product_id");
  const now = new Map(inv.map((r) => [Number(r.product_id), Number(r.quantity)]));
  const okInv = D.inventorySnapshot.every(([id, qty]) => now.get(id) === qty);
  check("baseline: estoque restaurado (snapshot)", okInv, JSON.stringify([...now.entries()]));
  const [pr] = await pool.query("SELECT id, price_cents FROM products ORDER BY id");
  const prNow = new Map(pr.map((r) => [Number(r.id), Number(r.price_cents)]));
  const okPr = D.priceSnapshot.every(([id, p]) => prNow.get(id) === p);
  check("baseline: preços restaurados (snapshot)", okPr, JSON.stringify([...prNow.entries()]));
}

async function main() {
  const api = spawn(process.execPath, ["src/index.js"], { cwd: SERVER_DIR, stdio: "ignore" });
  const srv = await startServer(PORT);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
    waitForInitialPage: false,
  });
  D.browser = browser;
  D.pool = await mysql.createPool({ host: "127.0.0.1", user: "nexus_app", password: "nexusapp", database: "nexus_tech_db", connectionLimit: 5 });

  try {
    await waitApi();

    const [inv] = await D.pool.query("SELECT product_id, quantity FROM inventory");
    D.inventorySnapshot = inv.map((r) => [Number(r.product_id), Number(r.quantity)]);
    D.invMap = new Map(D.inventorySnapshot);
    const [prices] = await D.pool.query("SELECT id, price_cents FROM products");
    D.priceSnapshot = prices.map((r) => [Number(r.id), Number(r.price_cents)]);

    // Usuário A NÃO é pré-cadastrado via API: ele é criado pela JOURNEY (UI
    // no cadastro.html). O e-mail é gerado aqui p/ permitir cleanup e login.
    D.A = { email: mkEmail("e2e"), name: "Fase 9F Usuário" };

    const regB = await apiRegister(mkEmail("e2eb"), PWD, "Fase 9F Segundo");
    check("setup: usuário B criado", regB.status === 201, regB.status + "");
    const dataB = regB.body && regB.body.data || {};
    D.B = { email: (dataB.user && dataB.user.email) || null };
    if (!D.B.email) throw new Error("register B não retornou e-mail");
    D.emails.push(D.A.email, D.B.email);

    console.log("\n=== FASE 9-F — E2E integrado do fluxo feliz ===");
    console.log(`jornada: [${P1.name} x2 + ${P4.name} x1] -> total ${fmt(TOTAL)}`);

    await s01_jornadaCompleta();
    await s02_sessaoNova();

  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => srv.server.close(r));
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
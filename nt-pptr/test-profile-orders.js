/* ==========================================================================
   NEXUS TECH — FASE 9-E · Suíte E2E de "Meus pedidos" REAL no perfil
   (modo NEXUS_STOREFRONT_AUTH="api"/"mock" via evaluateOnNewDocument).

   Sobe o backend real (server/src/index.js -> :4000) e proxies estáticos que
   servem o frontend e repassam /api/* na MESMA origem. Valida os 25 itens
   obrigatórios da fase 9-E:
     1  mock mode preservado (pedidos de nexus:orders, 0 chamadas API)
     2  API mode chama GET /api/orders
     3  API mode NÃO usa nexus:orders
     4  estado "carregando" aparece durante a busca
     5  estado "lista vazia" (usuário sem pedidos)
     6  estado "lista carregada" (cards renderizados)
     7  código real (NT-xxxxxxxxxx) exibido
     8  data do pedido exibida
     9  status exibido
    10 quantidade de itens exibida
    11 subtotal exibido
    12 frete exibido
    13 total exibido
    14 método de entrega exibido
    15 método de pagamento exibido
    16 GET /api/orders/:id chamado no detalhe (Authorization presente)
    17 preço HISTÓRICO do order_item exibido (não o preço atual do produto)
    18 snapshot do endereço de entrega exibido
    19 404 no detalhe => "Pedido não encontrado" (API é autoridade; sem
       fallback local)
    20 401 na listagem => sessão inválida/expirada (convite)
    21 403 na listagem => erro com mensagem de conta inativa
    22 500 na listagem => erro genérico
    23 retry recarrega a lista após erro
    24 isolamento entre usuários (B não vê pedidos de A)
    25 mock e API não se misturam (mesma sessão/usuário)
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
const PORT = 8841;         // principal: estático + proxy -> API (fluxos felizes)
const STUB_PORT = 8842;    // estático + proxy, GET /api/orders configurável

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const ts = Date.now();
const mkEmail = (p) => `${p}-${ts}@fase9e.test`;
const PWD = "Nexus123";
const D = { emails: [], password: PWD };

/* Formatação idêntica à do navegador (format.js pt-BR). */
const fmt = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(cents) / 100,
  );
const fmtDate = (iso) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));

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
  const cfg = {
    ordersGetStatus: null,   // status fixo p/ GET /api/orders (null => proxy)
    ordersGetFn: null,       // fn(attempt) => status|null
    ordersGetAttempts: 0,
    ordersGetDelayMs: 0,     // atrasa o proxy de GET /api/orders (testa loading)
    ordersDetailStatus: null, // status fixo p/ GET /api/orders/:id
  };

  const writeJson = (res, status, obj) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  const proxy = (req, res) => {
    const upstream = http.request(
      { hostname: "127.0.0.1", port: proxyTo, path: req.url, method: req.method, headers: { ...req.headers } },
      (ures) => { res.writeHead(ures.statusCode, ures.headers); ures.pipe(res); }
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  };

  const errorBody = (status) => {
    if (status === 401) return { error: "Sua sessão é inválida ou expirou." };
    if (status === 403) return { error: "Sua conta está inativa." };
    return { error: "Erro interno de teste." };
  };

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url.startsWith("/api/orders")) {
      const isDetail = /^\/api\/orders\/\d+$/.test(req.url);
      if (!isDetail) {
        cfg.ordersGetAttempts++;
        let st = cfg.ordersGetStatus;
        if (st === null && typeof cfg.ordersGetFn === "function") {
          st = cfg.ordersGetFn(cfg.ordersGetAttempts);
        }
        const delay = cfg.ordersGetDelayMs;
        if (st != null || delay > 0) {
          const respond = () => {
            if (st != null) { writeJson(res, st, errorBody(st)); return; }
            proxy(req, res);
          };
          setTimeout(respond, delay);
          return;
        }
      } else if (cfg.ordersDetailStatus != null) {
        writeJson(res, cfg.ordersDetailStatus, errorBody(cfg.ordersDetailStatus));
        return;
      }
    }

    if (req.url.startsWith("/api/")) {
      if (!proxyTo) { writeJson(res, 502, { error: "Sem proxy." }); return; }
      proxy(req, res);
      return;
    }

    let urlPath = decodeURIComponent(req.url.split("#")[0].split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fsRead(file, res);
  });

  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve({ server, cfg }))
  );
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
const attr = (page, sel, name) => page.$eval(sel, (el, n) => el.getAttribute(n), name).catch(() => null);
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

const benignNet = /Failed to load resource: the server responded with a status of (401|403|404|409|500)/;
function hardErrors(p) {
  return p._pageErrs.concat(p._errs.filter((m) => !benignNet.test(m)));
}

async function open(browser, opts = {}) {
  const {
    mode = "mock",
    serverPort = PORT,
    urlPath = "/pages/perfil.html",
    mockUser = null,
    seedOrders = null,
  } = opts;
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 800 });
  await clearCookies(page);
  await page.evaluateOnNewDocument(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* ignora */ }
  });
  if (mode === "api") {
    await page.evaluateOnNewDocument(() => { window.NEXUS_STOREFRONT_AUTH = "api"; });
  }
  if (mockUser) {
    await page.evaluateOnNewDocument((u) => {
      try {
        localStorage.setItem("nexus:user", JSON.stringify(u));
        sessionStorage.setItem("nexus:auth", JSON.stringify({ userId: String(u.id), authenticatedAt: new Date().toISOString() }));
      } catch (e) { /* ignora */ }
    }, mockUser);
  }
  if (seedOrders) {
    await page.evaluateOnNewDocument((orders) => {
      try { localStorage.setItem("nexus:orders", JSON.stringify(orders)); } catch (e) { /* ignora */ }
    }, seedOrders);
  }
  const errs = [], pageErrs = [], apiReqs = [], dialogs = [], getOrders = [], getOrder = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => pageErrs.push(String(e)));
  page.on("request", (r) => {
    const url = r.url();
    if (url.includes("/api/")) apiReqs.push(url);
    if (/\/api\/orders$/.test(url) && r.method() === "GET") {
      getOrders.push(r.headers()["authorization"] || null);
    }
    if (/\/api\/orders\/\d+$/.test(url) && r.method() === "GET") {
      getOrder.push(r.headers()["authorization"] || null);
    }
  });
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  page._pageErrs = pageErrs;
  page._errs = errs; page._api = apiReqs; page._dialogs = dialogs;
  page._getOrders = getOrders; page._getOrder = getOrder;
  await page.goto(`http://127.0.0.1:${serverPort}${urlPath}`, { waitUntil: "networkidle0" });
  return page;
}

async function loginToPerfil(email, opts = {}) {
  const p = await open(D.browser, { mode: "api", urlPath: "/pages/login.html", ...opts });
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, email, PWD);
  await waitForUrl(p, "pages/perfil.html");
  await p.waitForSelector(".account-session", { timeout: 10000 });
  await waitAuthState(p, "authenticated");
  return p;
}

/* Navega até o painel Meus pedidos re-clicando o link do nav. Race de boot:
   o chip do header (.account-session) aparece quando auth.js termina o boot,
   mas profile.js ainda pode estar finalizando init() (bindEvents é a última
   etapa) — e reatribuir o MESMO hash não dispara hashchange. Repetimos o
   CLIQUE (mesmo padrão do goDados das suítes anteriores). */
async function goPedidos(p) {
  const anchor = '#profile-nav .profile-nav__link[data-section="pedidos"]';
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await p.click(anchor).catch(() => {});
    try {
      await p.waitForSelector("#meus-pedidos:not([hidden])", { timeout: 1500 });
      await sleep(120);
      return;
    } catch (err) {
      /* ainda não vinculado — nova tentativa */
    }
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

async function createOrder(email, body) {
  const login = await apiLogin(email, PWD);
  const token = login.body && login.body.data && login.body.data.accessToken;
  const res = await fetch(`http://127.0.0.1:${API_PORT}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function dbProductPrice(id) {
  const [rows] = await D.pool.query("SELECT price_cents FROM products WHERE id = ?", [id]);
  return rows[0] ? Number(rows[0].price_cents) : null;
}

/* --------------------------------------------------------------- cenários --- */

/* [1] MOCK preservado — pedidos de nexus:orders, sem chamadas de API */
async function s01_mockPreservado() {
  console.log("\n[1] MOCK preservado (v2.4)");
  const mockUser = { id: 777, name: "Ana Souza", email: `${ts}-mock@fase9e.test`, createdAt: new Date().toISOString() };
  const m1 = new Date("2026-05-01T10:00:00").toISOString();
  const m2 = new Date("2026-05-02T11:00:00").toISOString();
  const m3 = new Date("2026-05-03T12:00:00").toISOString();
  const seedOrders = [
    {
      id: "NT-000001", userId: "777", createdAt: m1, status: "processing",
      items: [{ productId: 4, name: "Teclado Gamer", quantity: 1, unitPriceCents: 28990, totalCents: 28990 }],
      subtotalCents: 28990, shippingCents: 2990, totalCents: 31980, itemCount: 1,
      delivery: { method: "standard", label: "Entrega padrão" },
      payment: { method: "pix", label: "PIX" },
      customer: { name: "Ana Souza", email: "ana@mock.test" },
    },
    {
      id: "NT-000002", userId: "777", createdAt: m2, status: "processing",
      items: [{ productId: 1, name: "Notebook Gamer", quantity: 1, unitPriceCents: 399000, totalCents: 399000 }],
      subtotalCents: 399000, shippingCents: 0, totalCents: 399000, itemCount: 1,
      delivery: { method: "standard", label: "Entrega padrão" },
      payment: { method: "credit", label: "Cartão de crédito" },
      customer: { name: "Ana Souza", email: "ana@mock.test" },
    },
    {
      id: "NT-000003", userId: "999", createdAt: m3, status: "processing",
      items: [{ productId: 2, name: "Mouse", quantity: 1, unitPriceCents: 9999, totalCents: 9999 }],
      subtotalCents: 9999, shippingCents: 2990, totalCents: 12989, itemCount: 1,
      delivery: { method: "standard", label: "Entrega padrão" },
      payment: { method: "pix", label: "PIX" },
      customer: { name: "Outro Usuário", email: "outro@mock.test" },
    },
  ];

  const p = await open(D.browser, {
    mode: "mock",
    urlPath: "/pages/perfil.html#meus-pedidos",
    mockUser,
    seedOrders,
  });

  check("mock: nenhuma chamada de API (p._api vazio)", p._api.length === 0, p._api.join(","));
  await p.waitForSelector("#pedidos-list:not([hidden])", { timeout: 8000 });
  const cards = await cardSummaries(p);
  check("mock: 2 pedidos do usuário 777 renderizados", cards.length === 2, cards.length + "");
  check("mock: pedido de OUTRO usuário (999) oculto", !cards.some((c) => c.head.includes("NT-000003")), cards.map((c) => c.head).join(" | "));

  const c1 = cards.find((c) => c.head.includes("NT-000001")) || { head: "", meta: "" };
  check("mock: título com id mock preservado", c1.head.includes("Pedido NT-000001"), c1.head);
  check("mock: status 'Em processamento'", c1.head.includes("Em processamento"), c1.head);
  check("mock: meta com data", c1.meta.includes(fmtDate(m1)), c1.meta);
  check("mock: meta com quantidade", c1.meta.includes("1 item"), c1.meta);
  check("mock: meta com total mock", c1.meta.includes(fmt(31980)), c1.meta);
  check("mock: meta com entrega (v2.4)", c1.meta.includes("Entrega padrão"), c1.meta);

  const c2 = cards.find((c) => c.head.includes("NT-000002")) || { head: "", meta: "" };
  check("mock: segundo pedido presente", c2.head.includes("Pedido NT-000002"), c2.head);

  await p.click('[data-order-toggle="NT-000001"]');
  await p.waitForSelector("#pedido-NT-000001-details:not([hidden])", { timeout: 8000 });
  check("mock: detalhe expande na hora (aria-expanded)", (await attr(p, "#pedido-NT-000001-btn", "aria-expanded")) === "true");
  check("mock: detalhe lista os itens", (await txt(p, "#pedido-NT-000001-details")).includes("Teclado Gamer"), await txt(p, "#pedido-NT-000001-details"));
  check("mock: detalhe mostra subtotal/frete/total", (await txt(p, "#pedido-NT-000001-details")).includes(fmt(28990)) && (await txt(p, "#pedido-NT-000001-details")).includes(fmt(2990)) && (await txt(p, "#pedido-NT-000001-details")).includes(fmt(31980)), await txt(p, "#pedido-NT-000001-details"));
  check("mock: detalhe mostra entrega/pagamento", (await txt(p, "#pedido-NT-000001-details")).includes("Entrega padrão") && (await txt(p, "#pedido-NT-000001-details")).includes("PIX"), await txt(p, "#pedido-NT-000001-details"));
  check("mock: nexus:orders não foi alterado (via API)", (await localStorageGet(p, "nexus:orders")) !== null);
  check("mock: zero dialogs", p._dialogs.length === 0);
  check("mock: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();
}

/* [2] API listagem — GET /api/orders, loading, dados do backend, sem mock */
async function s02_listagemApi() {
  console.log("\n[2] API mode: GET /api/orders + estados + dados do backend");
  D.stubCfg.ordersGetStatus = null;
  D.stubCfg.ordersGetFn = null;
  D.stubCfg.ordersGetDelayMs = 2500;
  D.stubCfg.ordersDetailStatus = null;

  const p = await loginToPerfil(D.A.email, { serverPort: STUB_PORT, seedOrders: D.seedNoMix });
  await goPedidos(p);

  await p.waitForSelector("#pedidos-loading:not([hidden])", { timeout: 6000 });
  check("api: estado CARREGANDO visível durante a busca", true);

  await p.waitForSelector("#pedidos-list:not([hidden])", { timeout: 12000 });
  await sleep(150);

  check("api: GET /api/orders chamado", p._api.some((u) => /\/api\/orders$/.test(u)), p._api.join(","));
  check("api: Authorization presente no GET /api/orders", p._getOrders.length > 0 && p._getOrders.every((h) => h && h.includes("Bearer")), JSON.stringify(p._getOrders));

  const cards = await cardSummaries(p);
  check("api: 2 pedidos reais de A renderizados", cards.length === 2, cards.length + "");
  check("api: NENHUM pedido de nexus:orders (seed) renderizado", !cards.some((c) => c.head.includes("NT-MOCKA") || c.head.includes("NT-MOCKB")), cards.map((c) => c.head).join(" | "));
  check("api: nexus:orders continua com o seed (não usado)", (await localStorageGet(p, "nexus:orders")) !== null);

  const o1 = D.oA1.order;
  const o2 = D.oA2.order;
  const c1 = cards.find((c) => c.head.includes(o1.code)) || { head: "", meta: "" };
  const c2 = cards.find((c) => c.head.includes(o2.code)) || { head: "", meta: "" };

  check("api: código real exibido (card 1)", /^Pedido NT-[0-9A-F]{10}$/.test(c1.number), c1.number);
  check("api: status 'Em processamento'", c1.head.includes("Em processamento"), c1.head);
  check("api: data do backend exibida", c1.meta.includes(fmtDate(o1.createdAt)), c1.meta);
  check("api: quantidade (itemCount) exibida", c1.meta.includes(`2 itens`), c1.meta);
  check("api: subtotal do backend", c1.meta.includes(`Subtotal ${fmt(o1.subtotalCents)}`), c1.meta);
  check("api: frete do backend", c1.meta.includes(`Frete ${fmt(o1.shippingCents)}`), c1.meta);
  check("api: total do backend", c1.meta.includes(`Total ${fmt(o1.totalCents)}`), c1.meta);
  check("api: método de entrega (deliveryLabel)", c1.meta.includes(o1.deliveryLabel), c1.meta);
  check("api: método de pagamento (paymentLabel)", c1.meta.includes(o1.paymentLabel), c1.meta);

  check("api: card 2 (express) tem dados próprios", c2.meta.includes(o2.deliveryLabel) && c2.meta.includes(o2.paymentLabel) && c2.meta.includes(`Subtotal ${fmt(o2.subtotalCents)}`), c2.meta);
  check("api: zero dialogs", p._dialogs.length === 0);
  check("api: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();
  D.stubCfg.ordersGetDelayMs = 0;
}

/* [3] API lista vazia — usuário sem pedidos */
async function s03_listaVazia() {
  console.log("\n[3] API mode: lista vazia");
  const p = await loginToPerfil(D.C.email);
  await goPedidos(p);
  await p.waitForSelector("#pedidos-empty:not([hidden])", { timeout: 10000 });
  check("vazia: estado vazio visível", true);
  check("vazia: lista oculta", await hidden(p, "#pedidos-list"));
  check("vazia: loading oculto", await hidden(p, "#pedidos-loading"));
  check("vazia: zero dialogs", p._dialogs.length === 0);
  check("vazia: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();
}

/* [4] Detalhe — GET /api/orders/:id, preço histórico, snapshot de endereço */
async function s04_detalhe() {
  console.log("\n[4] API mode: detalhe (GET /:id + histórico + endereço)");
  const o2 = D.oA2.order;
  const oldPrice = await dbProductPrice(10);
  const newPrice = oldPrice + 12345;
  check("detalhe setup: preço do produto 10 lido", oldPrice !== null, String(oldPrice));

  const p = await loginToPerfil(D.A.email);
  await goPedidos(p);
  await p.waitForSelector("#pedidos-list:not([hidden])", { timeout: 10000 });

  try {
    // Simula ALTERAÇÃO de preço APÓS o pedido: o detalhe deve mostrar o valor
    // histórico do order_item, não o preço atual do produto.
    await D.pool.query("UPDATE products SET price_cents = ? WHERE id = 10", [newPrice]);
    await sleep(120);
    D.changedPrices.set(10, oldPrice);

    await p.click(`[data-order-toggle="${o2.id}"]`);
    await p.waitForSelector(`#pedido-${o2.id}-details:not([hidden])`, { timeout: 8000 });
    await p.waitForFunction(
      (id) => {
        const el = document.getElementById(`pedido-${id}-details`);
        return el && el.textContent.includes("Itens do pedido");
      },
      { timeout: 10000 },
      o2.id,
    );

    check("detalhe: GET /api/orders/:id chamado", p._api.some((u) => u.includes(`/api/orders/${o2.id}`)), p._api.join(","));
    check("detalhe: Authorization no GET /api/orders/:id", p._getOrder.length > 0 && p._getOrder.every((h) => h && h.includes("Bearer")), JSON.stringify(p._getOrder));
    check("detalhe: aria-expanded do toggle", (await attr(p, `#pedido-${o2.id}-btn`, "aria-expanded")) === "true");

    const d = await txt(p, `#pedido-${o2.id}-details`);
    check("detalhe: preço HISTÓRICO (antigo) exibido no item", d.includes(fmt(oldPrice)), d.slice(0, 400));
    check("detalhe: preço atual do produto NÃO usado", !d.includes(fmt(newPrice)), d.slice(0, 400));
    check("detalhe: nome histórico do produto", d.includes(D.oA2.items[0].productName), d.slice(0, 400));
    check("detalhe: quantidade no item", d.includes(`2 × ${fmt(oldPrice)}`), d.slice(0, 400));
    check("detalhe: subtotal do pedido", d.includes(fmt(o2.subtotalCents)), d.slice(0, 400));
    check("detalhe: frete do pedido", d.includes(fmt(o2.shippingCents)), d.slice(0, 400));
    check("detalhe: total do pedido", d.includes(fmt(o2.totalCents)), d.slice(0, 400));
    check("detalhe: entrega/pagamento", d.includes(o2.deliveryLabel) && d.includes(o2.paymentLabel), d.slice(0, 400));
    check("detalhe: snapshot do endereço (rua/número)", d.includes(`${o2.address.street}, ${o2.address.number}`), d.slice(0, 400));
    check("detalhe: snapshot do endereço (CEP)", d.includes(o2.address.cep), d.slice(0, 400));
    check("detalhe: snapshot do endereço (bairro)", d.includes(o2.address.neighborhood), d.slice(0, 400));
    check("detalhe: snapshot do endereço (cidade/UF)", d.includes(`${o2.address.city}/${o2.address.state}`), d.slice(0, 400));
    if (o2.address.complement) {
      check("detalhe: snapshot do endereço (complemento)", d.includes(o2.address.complement), d.slice(0, 400));
    }
    check("detalhe: zero dialogs", p._dialogs.length === 0);
    check("detalhe: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  } finally {
    if (oldPrice !== null) {
      await D.pool.query("UPDATE products SET price_cents = ? WHERE id = 10", [oldPrice]).catch(() => {});
      D.changedPrices.delete(10);
    }
  }
  await p.close();
}

/* [5] 404 no detalhe — API é a autoridade, sem fallback local */
async function s05_detalhe404() {
  console.log("\n[5] API mode: 404 no detalhe");
  D.stubCfg.ordersGetStatus = null;
  D.stubCfg.ordersGetFn = null;
  D.stubCfg.ordersGetDelayMs = 0;
  D.stubCfg.ordersDetailStatus = 404;

  const o1 = D.oA1.order;
  const p = await loginToPerfil(D.A.email, { serverPort: STUB_PORT, seedOrders: D.seedNoMix });
  await goPedidos(p);
  await p.waitForSelector("#pedidos-list:not([hidden])", { timeout: 10000 });

  const cards = await cardSummaries(p);
  check("404: lista real ainda chega (proxy)", cards.length === 2 && cards.some((c) => c.head.includes(o1.code)), cards.length + "");

  await p.click(`[data-order-toggle="${o1.id}"]`);
  await p.waitForSelector(`#pedido-${o1.id}-details:not([hidden])`, { timeout: 8000 });
  await p.waitForFunction(
    (id) => {
      const el = document.getElementById(`pedido-${id}-details`);
      return el && el.textContent.includes("Pedido não encontrado.");
    },
    { timeout: 10000 },
    o1.id,
  );

  const d = await txt(p, `#pedido-${o1.id}-details`);
  check("404: mensagem 'Pedido não encontrado.'", d.includes("Pedido não encontrado."), d);
  check("404: NENHUM fallback local (sem itens)", !d.includes("Itens do pedido") && !d.includes(D.oA1.items[0].productName), d);
  check("404: GET /api/orders/:id chamado", p._api.some((u) => u.includes(`/api/orders/${o1.id}`)), p._api.join(","));
  check("404: zero exceções JS", p._pageErrs.length === 0, p._pageErrs.join(" | "));
  check("404: zero dialogs", p._dialogs.length === 0);
  await p.close();
  D.stubCfg.ordersDetailStatus = null;
}

/* [6] 401 na listagem — sessão inválida/expirada => convite */
async function s06_lista401() {
  console.log("\n[6] API mode: 401 na listagem");
  D.stubCfg.ordersGetStatus = 401;
  D.stubCfg.ordersGetFn = null;
  D.stubCfg.ordersGetDelayMs = 0;
  D.stubCfg.ordersDetailStatus = null;

  const p = await loginToPerfil(D.A.email, { serverPort: STUB_PORT });
  await goPedidos(p);
  await p.waitForSelector("#pedidos-auth-required:not([hidden])", { timeout: 10000 });
  check("401: bloco de autenticação visível", true);
  check("401: lista oculta", await hidden(p, "#pedidos-list"));
  check("401: loading oculto", await hidden(p, "#pedidos-loading"));
  check("401: erro oculto", await hidden(p, "#pedidos-error"));
  check("401: saudação volta a 'visitante'", (await txt(p, "#profile-greeting")).trim() === "visitante", await txt(p, "#profile-greeting"));
  check("401: convite com texto da conta real (não 'simulados')", (await txt(p, "#pedidos-auth-required")).includes("vinculados à sua conta"), await txt(p, "#pedidos-auth-required"));
  check("401: zero dialogs", p._dialogs.length === 0);
  check("401: zero exceções JS", p._pageErrs.length === 0, p._pageErrs.join(" | "));
  await p.close();
  D.stubCfg.ordersGetStatus = null;
}

/* [7] 403 na listagem — conta inativa */
async function s07_lista403() {
  console.log("\n[7] API mode: 403 na listagem");
  D.stubCfg.ordersGetStatus = 403;
  D.stubCfg.ordersGetFn = null;
  D.stubCfg.ordersGetDelayMs = 0;
  D.stubCfg.ordersDetailStatus = null;

  const p = await loginToPerfil(D.A.email, { serverPort: STUB_PORT });
  await goPedidos(p);
  await p.waitForSelector("#pedidos-error:not([hidden])", { timeout: 10000 });
  check("403: bloco de erro visível", true);
  check("403: mensagem de conta inativa", (await txt(p, "#pedidos-error-text")).includes("inativa"), await txt(p, "#pedidos-error-text"));
  check("403: botão de retry presente", await has(p, "#pedidos-retry"));
  check("403: lista oculta", await hidden(p, "#pedidos-list"));
  check("403: zero dialogs", p._dialogs.length === 0);
  check("403: zero exceções JS", p._pageErrs.length === 0, p._pageErrs.join(" | "));
  await p.close();
  D.stubCfg.ordersGetStatus = null;
}

/* [8] 500 na listagem + retry recupera */
async function s08_erro500Retry() {
  console.log("\n[8] API mode: 500 na listagem + retry");
  D.stubCfg.ordersGetStatus = null;
  D.stubCfg.ordersGetFn = (n) => (n === 1 ? 500 : null); // 1ª tentativa falha, retry passa
  D.stubCfg.ordersGetDelayMs = 0;
  D.stubCfg.ordersDetailStatus = null;
  D.stubCfg.ordersGetAttempts = 0; // resetar: o contador acumula entre cenários

  const p = await loginToPerfil(D.A.email, { serverPort: STUB_PORT });
  await goPedidos(p);
  await p.waitForSelector("#pedidos-error:not([hidden])", { timeout: 10000 });
  check("500: bloco de erro visível", true);
  check("500: mensagem genérica (não 'inativa')", (await txt(p, "#pedidos-error-text")).includes("Não foi possível"), await txt(p, "#pedidos-error-text"));
  check("500: lista oculta", await hidden(p, "#pedidos-list"));

  await p.click("#pedidos-retry");
  await p.waitForSelector("#pedidos-list:not([hidden])", { timeout: 10000 });
  const cards = await cardSummaries(p);
  check("retry: lista carregada após novo GET", cards.length === 2, cards.length + "");
  check("retry: GET /api/orders ocorreu mais de uma vez", D.stubCfg.ordersGetAttempts >= 2, String(D.stubCfg.ordersGetAttempts));
  check("retry: bloquear. loading oculto após sucesso", await hidden(p, "#pedidos-loading"));
  check("retry: zero dialogs", p._dialogs.length === 0);
  check("retry: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();
  D.stubCfg.ordersGetFn = null;
}

/* [9] Isolamento — B só vê os pedidos de B */
async function s09_isolamento() {
  console.log("\n[9] Isolamento entre usuários");
  const pA = await loginToPerfil(D.A.email);
  await goPedidos(pA);
  await pA.waitForSelector("#pedidos-list:not([hidden])", { timeout: 10000 });
  const cardsA = await cardSummaries(pA);
  const codesA = cardsA.map((c) => c.head);

  const pB = await loginToPerfil(D.B.email);
  await goPedidos(pB);
  await pB.waitForSelector("#pedidos-list:not([hidden])", { timeout: 10000 });
  const cardsB = await cardSummaries(pB);

  check("isolamento: A vê 2 pedidos", codesA.length === 2, codesA.join(" | "));
  check("isolamento: A vê os códigos de A", codesA.every((h) => h.includes(D.oA1.order.code) || h.includes(D.oA2.order.code)), codesA.join(" | "));
  check("isolamento: B vê 1 pedido", cardsB.length === 1, cardsB.length + "");
  check("isolamento: B vê o código de B", cardsB.some((c) => c.head.includes(D.oB.order.code)), cardsB.map((c) => c.head).join(" | "));
  check("isolamento: B NÃO vê pedidos de A", !cardsB.some((c) => c.head.includes(D.oA1.order.code) || c.head.includes(D.oA2.order.code)), cardsB.map((c) => c.head).join(" | "));
  check("isolamento: card de B com status", cardsB[0].head.includes("Em processamento"), cardsB[0].head);
  check("isolamento: A NÃO vê pedido de B", codesA.every((h) => !h.includes(D.oB.order.code)), codesA.join(" | "));
  check("isolamento: zero dialogs (A)", pA._dialogs.length === 0);
  check("isolamento: zero dialogs (B)", pB._dialogs.length === 0);
  await pA.close();
  await pB.close();
}

/* ------------------------------------------------------------------- main --- */

async function cleanup(pool) {
  for (const [id, price] of D.changedPrices) {
    await pool.query("UPDATE products SET price_cents = ? WHERE id = ?", [price, id]).catch(() => {});
  }
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
  const [testUsers] = await pool.query("SELECT COUNT(*) c FROM users WHERE email LIKE '%@fase9e.test'");
  check("baseline: 0 pedidos", Number(orders[0].c) === 0, `c=${orders[0].c}`);
  check("baseline: 0 order_items", Number(items[0].c) === 0, `c=${items[0].c}`);
  check("baseline: 0 usuários de teste", Number(testUsers[0].c) === 0, `c=${testUsers[0].c}`);
  const [inv] = await pool.query("SELECT product_id, quantity FROM inventory");
  const now = new Map(inv.map((r) => [Number(r.product_id), Number(r.quantity)]));
  const okInv = D.inventorySnapshot.every(([id, qty]) => now.get(id) === qty);
  check("baseline: estoque restaurado (snapshot)", okInv, JSON.stringify([...now.entries()]));
  const [prices] = await pool.query("SELECT id, price_cents FROM products");
  const priceMap = new Map(prices.map((r) => [Number(r.id), Number(r.price_cents)]));
  const okPrice = [...D.priceSnapshot.entries()].every(([id, p]) => priceMap.get(id) === p);
  check("baseline: preços de produtos restaurados", okPrice, JSON.stringify([...priceMap.entries()]));
}

async function main() {
  const api = spawn(process.execPath, ["src/index.js"], { cwd: SERVER_DIR, stdio: "ignore" });
  const mainSrv = await startServer(PORT, { proxyTo: API_PORT });
  const stubSrv = await startServer(STUB_PORT, { proxyTo: API_PORT });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
    waitForInitialPage: false,
  });
  D.browser = browser;
  D.pool = await mysql.createPool({ host: "127.0.0.1", user: "nexus_app", password: "nexusapp", database: "nexus_tech_db", connectionLimit: 5 });
  D.stubCfg = stubSrv.cfg;
  D.changedPrices = new Map();

  try {
    await waitApi();

    const [inv] = await D.pool.query("SELECT product_id, quantity FROM inventory");
    D.inventorySnapshot = inv.map((r) => [Number(r.product_id), Number(r.quantity)]);
    const [prices] = await D.pool.query("SELECT id, price_cents FROM products");
    D.priceSnapshot = new Map(prices.map((r) => [Number(r.id), Number(r.price_cents)]));

    const reg = async (prefix, name) => {
      const res = await apiRegister(mkEmail(prefix), PWD, name);
      check(`setup: usuário ${name} criado`, res.status === 201, `status=${res.status}`);
      const data = res.body && res.body.data || {};
      const email = (data.user && data.user.email) || null;
      const id = (data.user && data.user.id) != null ? Number(data.user.id) : null;
      return { email, id };
    };

    const A = await reg("ana", "Ana Souza");
    const B = await reg("bruno", "Bruno Lima");
    const C = await reg("carla", "Carla Dias");
    if (!A.email || !B.email || !C.email) throw new Error("register não retornou e-mails de teste");
    D.A = A; D.B = B; D.C = C;
    D.emails.push(A.email, B.email, C.email);
    console.log("setup: usuários de teste criados");

    // Pedidos reais: A = 2 (standard/boleto e express/pix), B = 1, C = 0.
    const body = (items, deliveryMethod, paymentMethod, key, e = A.email, compl) => ({
      items, deliveryMethod, paymentMethod,
      address: {
        name: "Comprador Nexus", email: e, cep: "66010-000", street: "Av. Nazaré", number: "123",
        complement: compl || null, neighborhood: "Nazaré", city: "Belém", state: "PA",
      },
      idempotencyKey: `fase9e-${key}-${ts}`,
    });

    const rA1 = await createOrder(A.email, body([{ productId: 4, quantity: 2 }], "standard", "boleto", "a1"));
    const rA2 = await createOrder(A.email, body([{ productId: 10, quantity: 2 }], "express", "pix", "a2", A.email, "Apto 5"));
    const rB = await createOrder(B.email, body([{ productId: 1, quantity: 1 }], "standard", "pix", "b1", B.email, null));

    check("setup: pedido A1 criado (201)", rA1.status === 201, `status=${rA1.status}`);
    check("setup: pedido A2 criado (201)", rA2.status === 201, `status=${rA2.status}`);
    check("setup: pedido B criado (201)", rB.status === 201, `status=${rB.status}`);
    D.oA1 = { order: rA1.body.data.order, items: rA1.body.data.items };
    D.oA2 = { order: rA2.body.data.order, items: rA2.body.data.items };
    D.oB = { order: rB.body.data.order, items: rB.body.data.items };

    // Seed de nexus:orders que NUNCA deve aparecer no modo api (até com o id
    // real de A e um id estrangeiro — prova que o API mode ignora o mock).
    const fakeA = {
      id: "NT-MOCKA", userId: String(A.id), createdAt: new Date().toISOString(), status: "processing",
      items: [{ productId: 4, name: "Pedido MOCK de A", quantity: 1, unitPriceCents: 1, totalCents: 1 }],
      subtotalCents: 1, shippingCents: 0, totalCents: 1, itemCount: 1,
      delivery: { method: "standard", label: "Entrega padrão" },
      payment: { method: "pix", label: "PIX" }, customer: { name: "Fake", email: "fake@mock.test" },
    };
    const fakeB = {
      id: "NT-MOCKB", userId: "777777", createdAt: new Date().toISOString(), status: "processing",
      items: [{ productId: 1, name: "Pedido MOCK de outro", quantity: 1, unitPriceCents: 1, totalCents: 1 }],
      subtotalCents: 1, shippingCents: 0, totalCents: 1, itemCount: 1,
      delivery: { method: "standard", label: "Entrega padrão" },
      payment: { method: "pix", label: "PIX" }, customer: { name: "Fake", email: "fake@mock.test" },
    };
    D.seedNoMix = [fakeA, fakeB];

    console.log("\n=== FASE 9-E — suíte dos pedidos reais no perfil (modo api + mock) ===\n");

    await s01_mockPreservado();
    await s02_listagemApi();
    await s03_listaVazia();
    await s04_detalhe();
    await s05_detalhe404();
    await s06_lista401();
    await s07_lista403();
    await s08_erro500Retry();
    await s09_isolamento();

  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => mainSrv.server.close(r));
    await new Promise((r) => stubSrv.server.close(r));
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
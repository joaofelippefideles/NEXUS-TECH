/* ==========================================================================
   NEXUS TECH — FASE 7 · Suíte E2E do login REAL do storefront
   (modo NEXUS_STOREFRONT_AUTH="api" via evaluateOnNewDocument).

   Sobe o backend real (server/src/index.js -> :4000) e 4 proxies estáticos
   que servem o frontend e repassam /api/* para o backend na MESMA origem
   (sem CORS). Valida:
   1  login válido (UI)                     2  senha errada (401)
   3  usuário inexistente (401)             4  contrato de /me
   5  reload mantém sessão                  6  refresh (rotação, rede)
   7  refresh revogado -> unauthenticated   8  logout real
   9  header autenticado                   10  header desautenticado
  11  estado loading + aria-busy           12  erro de rede
  13  429 (excesso de tentativas)          14  5xx (stub)
  15  senha nunca em storage/URL           16  access token só em memória
  17  cookie httpOnly inacessível ao DOM   18  ?next seguro / inválido
  19  modo MOCK preservado (0 chamadas API) 20  API ignora storage mock
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
const PORT = 8801;        // principal: estático + proxy -> API
const NET_PORT = 8802;    // proxy -> porta morta (erro de rede)
const STUB_PORT = 8803;   // stub 500 p/ todos os /api/*
const SLOW_PORT = 8804;   // atraso no /api/auth/refresh (estado loading)
const DEAD_PORT = 41998;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const ts = Date.now();
const mkEmail = (p) => `${p}-${ts}@fase7.test`;
const PWD = "Nexus123";
const D = { emails: [], password: PWD };

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
  const { proxyTo = null, stubStatus = null, delayPath = null, delayMs = 0 } = opts;

  const proxy = (req, res) => {
    const upstream = http.request(
      { hostname: "127.0.0.1", port: proxyTo, path: req.url, method: req.method, headers: { ...req.headers } },
      (ures) => { res.writeHead(ures.statusCode, ures.headers); ures.pipe(res); }
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  };

  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
      if (stubStatus) { res.writeHead(stubStatus, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Erro interno de teste." })); return; }
      if (!proxyTo) { res.writeHead(502); res.end(); return; }
      if (delayPath && req.url.startsWith(delayPath) && delayMs) setTimeout(() => proxy(req, res), delayMs);
      else proxy(req, res);
      return;
    }

    let urlPath = decodeURIComponent(req.url.split("#")[0].split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fsRead(file, res);
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
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

async function waitForUrl(page, needle, timeoutMs = 12000) {
  await page.waitForFunction((n) => window.location.href.includes(n), { timeout: timeoutMs }, needle);
}

async function waitAuthState(page, state, timeoutMs = 12000) {
  await page.waitForFunction((s) => document.documentElement.dataset.authState === s, { timeout: timeoutMs }, state);
}

async function clearCookies(page) {
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.clearBrowserCookies");
}

async function getRefreshCookie(page, url) {
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  const { cookies } = await client.send("Network.getCookies", { urls: [url] });
  return cookies.find((c) => c.name === "nt_user_refresh") || null;
}

async function fillLogin(page, email, password) {
  await setField(page, "#login-email", email);
  await setField(page, "#login-password", password);
  await page.click("#login-submit");
}

/* Erros "duros": exceções JS (pageerror) + console.error que não sejam o
   aviso benigno de recurso 401/404 (resposta esperada do refresh sem cookie
   durante o boot não autenticado). */
const benignNet = /Failed to load resource: the server responded with a status of (401|404)/;
function hardErrors(p) {
  return p._pageErrs.concat(p._errs.filter((m) => !benignNet.test(m)));
}

const hasTokenLike = (str) => /accessToken|"token"|Bearer|eyJ[A-Za-z0-9_-]{8,}\./.test(str || "");

async function open(browser, { mode = "api", vp = 1024, serverPort = PORT, urlPath = "/pages/login.html", query = "", waitUntil = "networkidle0", seedUser = null, seedUserSession = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp, height: 800 });
  await clearCookies(page);
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
  if (seedUser) {
    await page.evaluateOnNewDocument((u) => {
      try { localStorage.setItem("nexus:user", JSON.stringify(u)); } catch (e) { /* ignora */ }
    }, seedUser);
  }
  if (seedUserSession) {
    // sessão da aba falsa — só prova que o modo api NÃO a usa p/ autenticar
    await page.evaluateOnNewDocument(() => {
      try { sessionStorage.setItem("nexus:auth", JSON.stringify({ userId: "999", authenticatedAt: new Date().toISOString() })); } catch (e) { /* ignora */ }
    });
  }
  const errs = [], pageErrs = [], apiReqs = [], dialogs = [], urls = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => pageErrs.push(String(e)));
  page.on("request", (r) => { urls.push(r.url()); if (r.url().includes("/api/")) apiReqs.push(r.url()); });
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  page._pageErrs = pageErrs;
  page._errs = errs; page._api = apiReqs; page._dialogs = dialogs; page._urls = urls;
  await page.goto(`http://127.0.0.1:${serverPort}${urlPath}${query}`, { waitUntil });
  return page;
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

/* --------------------------------------------------------------- cenários --- */

async function s01_loginValido() {
  console.log("[1/9] Login válido (UI) + /me + header autenticado");
  const p = await open(D.browser, {});
  await waitAuthState(p, "unauthenticated"); // boot sem cookie
  await fillLogin(p, D.anaEmail, PWD);
  await waitForUrl(p, "pages/perfil.html");
  await p.waitForSelector(".account-session", { timeout: 10000 });

  check("redirecionou para pages/perfil.html", p.url().includes("pages/perfil.html"), p.url());
  check("chip do usuário visível", await has(p, ".account-session"));
  check("nome no chip: 'Olá, Ana'", (await txt(p, ".account-session__name")).trim() === "Olá, Ana", await txt(p, ".account-session__name"));
  check("botão Sair presente", (await txt(p, ".account-session__logout")).trim() === "Sair");
  check("conta → perfil.html (logado)", (await attr(p, ".icon-btn__label--account", "href")).endsWith("perfil.html"));
  check("conta com aria-current na página perfil", (await attr(p, ".icon-btn__label--account", "aria-current")) === "page");

  const states = await p.evaluate(() => window.__authStates || []);
  check("estado passou por 'loading'", states.includes("loading"), states.join(">"));
  check("estado final 'authenticated'", states[states.length - 1] === "authenticated", states.join(">"));
  check("POST /api/auth/login foi chamado", p._api.some((u) => u.includes("/api/auth/login")), p._api.join(","));
  check("GET /api/auth/me foi chamado (boot da nova página)", p._api.some((u) => u.includes("/api/auth/me")), p._api.join(","));
  check("POST /api/auth/refresh foi chamado (login + boot)", p._api.filter((u) => u.includes("/api/auth/refresh")).length >= 2, p._api.join(","));

  const dump = await p.evaluate(() => {
    const scan = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
    return { ls: scan(localStorage), ss: scan(sessionStorage), cookie: document.cookie, url: window.location.href };
  });
  const ls = JSON.stringify(dump.ls), ss = JSON.stringify(dump.ss);
  check("access token AUSENTE do localStorage", !hasTokenLike(ls), ls.slice(0, 140));
  check("access token AUSENTE do sessionStorage", !hasTokenLike(ss), ss.slice(0, 140));
  check("senha AUSENTE de any storage/cookie", !(ls + ss + dump.cookie).includes(PWD));
  check("senha AUSENTE de todas as URLs", !p._urls.some((u) => u.includes(PWD)));
  check("document.cookie NÃO expõe nt_user_refresh", !dump.cookie.includes("nt_user_refresh"), dump.cookie);
  check("zero dialogs/alert", p._dialogs.length === 0, p._dialogs.join(","));
  check("zero erros duros (JS/exceções)", hardErrors(p).length === 0, hardErrors(p).join(" | "));

  const ck = await getRefreshCookie(p, `http://127.0.0.1:${PORT}/api/auth/refresh`);
  check("cookie nt_user_refresh existe no navegador", Boolean(ck));
  check("cookie nt_user_refresh é httpOnly", Boolean(ck && ck.httpOnly === true));
  check("cookie nt_user_refresh Path=/api/auth", Boolean(ck && ck.path === "/api/auth"), ck && JSON.stringify({ path: ck.path, sameSite: ck.sameSite, httpOnly: ck.httpOnly }));
  D.page = p;
}

async function s02_reloadRefresh() {
  console.log("[5/6] Reload mantém sessão via refresh → /me (rotação)");
  const p = D.page;
  p._api.length = 0;
  p._errs.length = 0;
  await p.reload({ waitUntil: "networkidle0" });
  await p.waitForSelector(".account-session", { timeout: 10000 });

  check("reload: chip continua presente", await has(p, ".account-session"));
  check("reload: nome preservado", (await txt(p, ".account-session__name")).trim() === "Olá, Ana");
  check("reload: refresh chamado", p._api.some((u) => u.includes("/api/auth/refresh")), p._api.join(","));
  check("reload: /me chamado", p._api.some((u) => u.includes("/api/auth/me")), p._api.join(","));
  check("reload: token NÃO veio do storage (sessão via cookie+rotacao)", !(await p.evaluate(() => { const s = sessionStorage.getItem("nexus:auth"); return Boolean(s); })));
  const states = await p.evaluate(() => window.__authStates || []);
  check("reload: passou por loading", states.includes("loading"), states.join(">"));
  check("reload: final authenticated", states[states.length - 1] === "authenticated", states.join(">"));
  check("reload: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
}

async function s03_meContrato() {
  console.log("[4] Contrato de /me (backend)");
  const noAuth = await fetch(`http://127.0.0.1:${API_PORT}/api/auth/me`);
  check("/me sem token → 401", noAuth.status === 401, `status=${noAuth.status}`);

  const login = await apiLogin(D.anaEmail, PWD);
  check("login via API → 200 com {data:{user,accessToken}}", login.status === 200 && Boolean(login.body && login.body.data && login.body.data.accessToken && login.body.data.user), JSON.stringify(login.body).slice(0, 160));
  const token = login.body && login.body.data && login.body.data.accessToken;
  const me = await fetch(`http://127.0.0.1:${API_PORT}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const meBody = await me.json().catch(() => ({}));
  check("/me com token → 200 e usuário correto", me.status === 200 && meBody.data && meBody.data.user && meBody.data.user.email === D.anaEmail, `status=${me.status}`);
  check("/me nunca expõe o hash de senha", !JSON.stringify(meBody).includes("password_hash"));
}

async function s04_loginErrado() {
  console.log("[2] Senha errada → 401 mensagem genérica");
  const p = await open(D.browser, {});
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, D.anaEmail, "SenhaErrada1");
  await p.waitForSelector("#login-feedback:not([hidden])", { timeout: 8000 });
  const fb = (await txt(p, "#login-feedback")).trim();
  check("mensagem: 'E-mail ou senha inválidos.'", fb === "E-mail ou senha inválidos.", fb);
  check("permanece na página de login", p.url().includes("pages/login.html"));
  check("sem chip no header", !(await has(p, ".account-session")));
  check("sem dialog", p._dialogs.length === 0);
  await p.close();
}

async function s05_inexistente() {
  console.log("[3] Usuário inexistente → 401");
  const p = await open(D.browser, {});
  await waitAuthState(p, "unauthenticated");
  const ghost = mkEmail("ghost");
  await fillLogin(p, ghost, PWD);
  await p.waitForSelector("#login-feedback:not([hidden])", { timeout: 8000 });
  const fb = (await txt(p, "#login-feedback")).trim();
  check("mensagem genérica (não revela existência)", fb === "E-mail ou senha inválidos.", fb);
  check("sem chip", !(await has(p, ".account-session")));
  await p.close();
}

async function s06_refreshRevogado() {
  console.log("[7] Refresh revogado → unauthenticated");
  const p = await open(D.browser, {});
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, D.anaEmail, PWD);
  await waitForUrl(p, "pages/perfil.html");
  await p.waitForSelector(".account-session", { timeout: 10000 });

  await D.pool.query(
    "UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = (SELECT id FROM users WHERE email = ?)",
    [D.anaEmail]
  );
  p._api.length = 0;
  await p.reload({ waitUntil: "domcontentloaded" });
  await waitAuthState(p, "unauthenticated");

  check("refresh revogado: chip AUSENTE", !(await has(p, ".account-session")));
  check("refresh revogado: conta → login.html", (await attr(p, ".icon-btn__label--account", "href")).endsWith("login.html"));
  check("refresh revogado: refresh foi tentado", p._api.some((u) => u.includes("/api/auth/refresh")), p._api.join(","));
  check("refresh revogado: /me NÃO foi chamado", !p._api.some((u) => u.includes("/api/auth/me")), p._api.join(","));
  check("refresh revogado: estado final unauthenticated", (await p.evaluate(() => document.documentElement.dataset.authState)) === "unauthenticated");
  await p.close();
}

async function s07_logout() {
  console.log("[8] Logout real");
  const p = await open(D.browser, {});
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, D.anaEmail, PWD);
  await waitForUrl(p, "pages/perfil.html");
  await p.waitForSelector(".account-session", { timeout: 10000 });
  await p.click(".account-session__logout");
  await waitForUrl(p, "pages/login.html");

  check("logout: navegou para login.html", p.url().includes("pages/login.html"), p.url());
  await waitAuthState(p, "unauthenticated").catch(() => {});
  check("logout: header deslogado (sem chip)", !(await has(p, ".account-session")));
  check("logout: conta → login.html", (await attr(p, ".icon-btn__label--account", "href")).endsWith("login.html"));
  const ck = await getRefreshCookie(p, `http://127.0.0.1:${PORT}/api/auth/refresh`);
  check("logout: cookie nt_user_refresh removido pelo servidor", ck === null, ck ? "cookie ainda presente" : "");

  // sessão real terminada: ir a perfil não volta a logar
  await p.goto(`http://127.0.0.1:${PORT}/pages/perfil.html`, { waitUntil: "domcontentloaded" });
  await waitAuthState(p, "unauthenticated");
  check("logout: perfil recarregado NÃO autentica de novo", !(await has(p, ".account-session")));
  await p.close();
}

async function s08_headerDeslogado() {
  console.log("[10] Header desautenticado");
  const p = await open(D.browser, { urlPath: "/index.html" });
  await waitAuthState(p, "unauthenticated");
  check("deslogado: sem chip", !(await has(p, ".account-session")));
  check("deslogado: conta → pages/login.html", (await attr(p, ".icon-btn__label--account", "href")).endsWith("pages/login.html"));
  await p.close();
}

async function s09_loading() {
  console.log("[11] Estado 'loading' + aria-busy (refresh lento)");
  const p = await open(D.browser, { serverPort: SLOW_PORT, waitUntil: "domcontentloaded" });
  let sawLoading = false;
  let sawBusy = false;
  for (let i = 0; i < 80; i++) {
    const st = await p.evaluate(() => {
      const actions = document.querySelector(".site-header__actions");
      return { s: document.documentElement.dataset.authState, busy: actions ? actions.getAttribute("aria-busy") : null };
    });
    if (st.s === "loading") sawLoading = true;
    if (st.s === "loading" && st.busy === "true") sawBusy = true;
    if (sawBusy) break;
    await sleep(20);
  }
  check("data-auth-state='loading' observado", sawLoading);
  check("aria-busy=true aplicado no .site-header__actions", sawBusy);
  await waitAuthState(p, "unauthenticated").catch(() => {});
  await p.close();
}

async function s10_rede() {
  console.log("[12] Erro de rede (proxy → porta morta)");
  const p = await open(D.browser, { serverPort: NET_PORT });
  await waitAuthState(p, "unauthenticated");
  check("rede: boot não autentica (estado seguro)", !(await has(p, ".account-session")));
  await fillLogin(p, D.anaEmail, PWD);
  await p.waitForSelector("#login-feedback:not([hidden])", { timeout: 10000 });
  const fb = (await txt(p, "#login-feedback")).trim();
  check("rede: mensagem amigável de conexão", /não foi possível conectar ao servidor/i.test(fb), fb);
  check("rede: sem chip", !(await has(p, ".account-session")));
  check("rede: sem dialog", p._dialogs.length === 0);
  await p.close();
}

async function s11_quota429() {
  console.log("[13] 429 (excesso de tentativas — loginLimiter)");
  const email = mkEmail("rate");
  D.emails.push(email);
  const reg = await apiRegister(email, PWD, "Rate Limit");
  check("setup rate: usuário criado", reg.status === 201, `status=${reg.status}`);
  for (let i = 0; i < 10; i++) {
    await apiLogin(email, "SenhaErrada1");
  }
  await sleep(120);

  const p = await open(D.browser, {});
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, email, PWD);
  await p.waitForSelector("#login-feedback:not([hidden])", { timeout: 10000 });
  const fb = (await txt(p, "#login-feedback")).trim();
  check("429: mensagem de excesso de tentativas", /muitas tentativas de login/i.test(fb), fb);
  check("429: sem chip", !(await has(p, ".account-session")));
  await p.close();
}

async function s12_5xx() {
  console.log("[14] 5xx (stub) → mensagem genérica e estado seguro");
  const p = await open(D.browser, { serverPort: STUB_PORT });
  await waitAuthState(p, "unauthenticated");
  check("5xx: boot não autentica", !(await has(p, ".account-session")));
  await fillLogin(p, D.anaEmail, PWD);
  await p.waitForSelector("#login-feedback:not([hidden])", { timeout: 10000 });
  const fb = (await txt(p, "#login-feedback")).trim();
  check("5xx: mensagem de erro inesperado", /ocorreu um erro inesperado no servidor/i.test(fb), fb);
  check("5xx: sem chip", !(await has(p, ".account-session")));
  await p.close();
}

async function s13_nextSeguro() {
  console.log("[18a] ?next seguro → checkout.html");
  const p = await open(D.browser, { query: "?next=checkout.html" });
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, D.anaEmail, PWD);
  await waitForUrl(p, "pages/checkout.html");
  check("redirecionou para pages/checkout.html", p.url().includes("pages/checkout.html"), p.url());
  await p.close();
}

async function s14_nextInvalido() {
  console.log("[18b] ?next inválido → perfil.html (ignora externo)");
  const p = await open(D.browser, { query: "?next=" + encodeURIComponent("https://evil.example.com/x.html") });
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, D.anaEmail, PWD);
  await waitForUrl(p, "pages/perfil.html");
  check("caiu em pages/perfil.html", p.url().includes("pages/perfil.html"), p.url());
  check("nunca saiu da origem local", p.url().startsWith(`http://127.0.0.1:${PORT}/`), p.url());
  check("não foi para evil.example.com", !p.url().includes("evil.example.com"), p.url());
  await p.close();
}

async function s15_mockPreservado() {
  console.log("[19] Modo MOCK preservado (sem API, síncrono)");
  const mockUser = { id: 999, name: "Ana Souza", email: D.anaEmail, createdAt: new Date().toISOString() };
  const p = await open(D.browser, { mode: "mock", seedUser: mockUser });

  // MOCK: nenhuma chamada de API deve ocorrer
  check("mock: nenhuma chamada de API", p._api.length === 0, p._api.join(","));
  check("mock: boot não passa por 'loading'", !(await p.evaluate(() => (window.__authStates || []).includes("loading"))));
  check("mock: estado inicial unauthenticated (síncrono)", (await p.evaluate(() => document.documentElement.dataset.authState)) === "unauthenticated");

  await fillLogin(p, D.anaEmail, "qualquer-coisa");
  await waitForUrl(p, "pages/perfil.html");
  await p.waitForSelector(".account-session", { timeout: 5000 });
  check("mock: chip aparece (sessão da aba)", await has(p, ".account-session"));
  check("mock: nome 'Olá, Ana'", (await txt(p, ".account-session__name")).trim() === "Olá, Ana", await txt(p, ".account-session__name"));
  check("mock: sessão gravada em sessionStorage nexus:auth", await p.evaluate(() => Boolean(sessionStorage.getItem("nexus:auth"))));
  check("mock: nenhuma chamada de API após login", p._api.length === 0, p._api.join(","));

  // Logout mock síncrono
  await p.click(".account-session__logout");
  await waitForUrl(p, "pages/login.html");
  check("mock logout: navegou para login.html", p.url().includes("pages/login.html"));
  check("mock logout: nexus:auth removido do sessionStorage", !(await p.evaluate(() => Boolean(sessionStorage.getItem("nexus:auth")))));
  check("mock logout: header sem chip", !(await has(p, ".account-session")));
  await p.close();
}

async function s16_apiIgnoraStorageMock() {
  console.log("[20] API IGNORA nexus:user/nexus:auth (decide por cookie/token)");
  const fake = { id: 999, name: "Fantasma", email: mkEmail("fantasma"), createdAt: new Date().toISOString() };
  const p = await open(D.browser, { mode: "api", seedUser: fake, seedUserSession: true });
  await waitAuthState(p, "unauthenticated");
  check("api com storage mock falso → unauthenticated", (await p.evaluate(() => document.documentElement.dataset.authState)) === "unauthenticated");
  check("api com storage mock falso → sem chip", !(await has(p, ".account-session")));
  check("api não usou o usuário falso no header", !(await txt(p, ".account-session__name")).includes("Fantasma"));
  const st = await p.evaluate(() => ({ hasSession: Boolean(sessionStorage.getItem("nexus:auth")), hasUser: Boolean(localStorage.getItem("nexus:user")) }));
  check("storage mock falso permanece, mas não autentica", st.hasUser && st.hasSession, JSON.stringify(st));
  await p.close();
}

/* ------------------------------------------------------------------- main --- */

async function cleanup(pool) {
  const emails = D.emails;
  if (!emails.length) return;
  const [users] = await pool.query("SELECT id FROM users WHERE email IN (?)", [emails]);
  const ids = users.map((u) => u.id);
  if (!ids.length) return;
  await pool.query("DELETE FROM admin_actions WHERE admin_id IN (?)", [ids]);
  await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (?)", [ids]);
  await pool.query("DELETE FROM users WHERE email IN (?)", [emails]);
}

async function main() {
  const api = spawn(process.execPath, ["src/index.js"], { cwd: SERVER_DIR, stdio: "ignore" });
  const servers = await Promise.all([
    startServer(PORT, { proxyTo: API_PORT }),
    startServer(NET_PORT, { proxyTo: DEAD_PORT }),
    startServer(STUB_PORT, { stubStatus: 500 }),
    startServer(SLOW_PORT, { proxyTo: API_PORT, delayPath: "/api/auth/refresh", delayMs: 600 }),
  ]);
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

    D.anaEmail = mkEmail("ana");
    D.emails.push(D.anaEmail);
    const reg = await apiRegister(D.anaEmail, PWD, "Ana Souza");
    check("setup: usuário de login criado (201)", reg.status === 201, `status=${reg.status}`);
    console.log("\n=== FASE 7 — suíte de login real (modo api) ===\n");

    await s01_loginValido();
    await s02_reloadRefresh();
    await s03_meContrato();
    await s04_loginErrado();
    await s05_inexistente();
    await s06_refreshRevogado();
    await s07_logout();
    await s08_headerDeslogado();
    await s09_loading();
    await s10_rede();
    await s11_quota429();
    await s12_5xx();
    await s13_nextSeguro();
    await s14_nextInvalido();
    await s15_mockPreservado();
    await s16_apiIgnoraStorageMock();
  } finally {
    await browser.close().catch(() => {});
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r)))).catch(() => {});
    try { api.kill("SIGKILL"); } catch (e) { /* já encerrado */ }
    try {
      await cleanup(D.pool);
      const [left] = await D.pool.query("SELECT COUNT(*) c FROM users WHERE email LIKE '%@fase7.test'");
      console.log(`\n[cleanup] usuários restantes '@fase7.test': ${left[0].c}`);
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
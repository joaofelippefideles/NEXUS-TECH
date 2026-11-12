/* ==========================================================================
   NEXUS TECH — FASE 8-B · Suíte E2E do perfil REAL ("Minha Conta")
   (modo NEXUS_STOREFRONT_AUTH="api" via evaluateOnNewDocument).

   Sobe o backend real (server/src/index.js -> :4000) e proxies estáticos que
   servem o frontend e repassam /api/* na MESMA origem. Valida:
   1  mock preservado (convite + formulário legado, 0 chamadas à API)
   2  sessão API (login real -> saudação, identidade, privacy do storage)
   3  GET /profile (sem e com user_profile; name/email de /me)
   4  PATCH telefone (formato cru -> normalizado, sem campos extras)
   5  PATCH CPF (normalização + 409 de CPF duplicado, sem corrupção)
   6  validações (400 telefone/servidor, CPF inválido client-side, payloads)
   7  erros simulados (401/429/5xx/rede -> mensagens seguras, sem alert)
   8  sessão expirada (logout real -> convite, sem sessão mock artificial)
   9  segurança (token só em memória, Authorization, httpOnly)
   10 isolamento entre usuários (dados de A não vazam para B)
   11 banco (persistência de user_profile + baseline restaurado)
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
const PORT = 8801;         // principal: estático + proxy -> API
const NET_PORT = 8802;     // proxy -> porta morta (erro de rede)
const STUB_PORT = 8803;    // stub 500 p/ todos os /api/*
const STUB401_PORT = 8805; // stub 401
const STUB429_PORT = 8806; // stub 429
const DEAD_PORT = 41998;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const ts = Date.now();
const mkEmail = (p) => `${p}-${ts}@fase8.test`;
const PWD = "Nexus123";
const D = { emails: [], password: PWD };

const CPF_A = "529.982.247-25"; // válido por DV
const CPF_B = "111.444.777-35"; // válido por DV
const PHONE_A = "(91) 98765-4321";

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
  const { proxyTo = null, stubStatus = null } = opts;

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
      proxy(req, res);
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
const value = (page, sel) => page.$eval(sel, (el) => el.value).catch(() => null);
const hidden = (page, sel) => page.$eval(sel, (el) => el.hidden).catch(() => true);
const fieldError = (page, sel) => txt(page, sel).then((t) => t.trim());

async function waitForUrl(page, needle, timeoutMs = 12000) {
  await page.waitForFunction((n) => window.location.href.includes(n), { timeout: timeoutMs }, needle);
}

async function waitAuthState(page, state, timeoutMs = 12000) {
  await page.waitForFunction((s) => document.documentElement.dataset.authState === s, { timeout: timeoutMs }, state);
}

async function waitFeedback(page, needle, timeoutMs = 12000) {
  await page.waitForFunction(
    (m) => {
      const el = document.getElementById("profile-feedback");
      return el && !el.hidden && el.textContent.includes(m);
    },
    { timeout: timeoutMs },
    needle
  );
}

async function waitApiCall(page, needle, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (page._api.some((u) => u.includes(needle))) return true;
    await sleep(60);
  }
  return false;
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

async function goDados(page) {
  // O chip do header (.account-session) renderiza assim que auth.js termina o
  // boot, MAS profile.js ainda pode estar finalizando init() (bindEvents é a
  // última etapa) — clicar antes disso não muda de seção. Repete o clique até
  // o painel abrir (race de boot, não é defeito funcional).
  const anchor = '#profile-nav .profile-nav__link[data-section="dados"]';
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await page.click(anchor).catch(() => {});
    try {
      await page.waitForSelector("#meus-dados:not([hidden])", { timeout: 1500 });
      await sleep(120);
      return;
    } catch (err) {
      /* ainda não vinculado — nova tentativa */
    }
  }
  await page.waitForSelector("#meus-dados:not([hidden])", { timeout: 3000 });
  await sleep(120);
}

/* Erros "duros": exceção JS + console.error que não seja o aviso benigno de
   recurso 401/404 (refresh sem cookie durante o boot não autenticado). */
const benignNet = /Failed to load resource: the server responded with a status of (401|404|409)/;
function hardErrors(p) {
  return p._pageErrs.concat(p._errs.filter((m) => !benignNet.test(m)));
}

const hasTokenLike = (str) => /accessToken|"token"|Bearer|eyJ[A-Za-z0-9_-]{8,}\./.test(str || "");
const hasPasswordLike = (str) => /\bpassword(_hash)?\b/.test(str || "");

async function open(browser, { mode = "api", vp = 1024, serverPort = PORT, urlPath = "/pages/perfil.html", seedUser = null, seedUserSession = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp, height: 800 });
  await clearCookies(page);
  // Simula um navegador limpo por página: localStorage é compartilhado entre
  // abas da MESMA origem (mas cada cenário deve começar zerado; os seeds abaixo
  // reescrevem o que for intencional). sessionStorage é por aba, mas limpamos
  // por segurança.
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
  if (seedUser) {
    await page.evaluateOnNewDocument((u) => {
      try { localStorage.setItem("nexus:user", JSON.stringify(u)); } catch (e) { /* ignora */ }
    }, seedUser);
  }
  if (seedUserSession) {
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
  await page.goto(`http://127.0.0.1:${serverPort}${urlPath}`, { waitUntil: "networkidle0" });
  return page;
}

/* Login real pela UI e aterrissagem em perfil.html (mesma página/origin). */
async function loginToPerfil(email, opts = {}) {
  const p = await open(D.browser, { urlPath: "/pages/login.html", ...opts });
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, email, PWD);
  await waitForUrl(p, "pages/perfil.html");
  await p.waitForSelector(".account-session", { timeout: 10000 });
  await p.waitForSelector("#profile-greeting", { timeout: 8000 });
  return p;
}

function dumpStorage(p) {
  return p.evaluate(() => {
    const scan = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
    return { ls: scan(localStorage), ss: scan(sessionStorage), cookie: document.cookie, url: window.location.href };
  });
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

async function apiPatchProfile(email, payload) {
  const login = await apiLogin(email, PWD);
  const token = login.body && login.body.data && login.body.data.accessToken;
  const res = await fetch(`http://127.0.0.1:${API_PORT}/api/auth/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function dbProfileByEmail(email) {
  const [rows] = await D.pool.query(
    "SELECT p.user_id, p.phone, p.cpf FROM user_profile p JOIN users u ON u.id = p.user_id WHERE u.email = ?",
    [email]
  );
  return rows[0] || null;
}

/* --------------------------------------------------------------- cenários --- */

/* [1] MOCK — convite, formulário legado, 0 chamadas à API */
async function s01_mockPreservado() {
  console.log("\n[1] MOCK preservado");
  const p = await open(D.browser, { mode: "mock", urlPath: "/pages/perfil.html" });

  check("mock: nenhuma chamada de API", p._api.length === 0, p._api.join(","));
  check("mock sem sessão: convite visível (#profile-auth)", !(await hidden(p, "#profile-auth")));
  check("mock sem sessão: saudação 'visitante'", (await txt(p, "#profile-greeting")).trim() === "visitante", await txt(p, "#profile-greeting"));

  await goDados(p);
  await setField(p, "#pf-name", "Carla Legado");
  await setField(p, "#pf-email", "carla@legado.test");
  await setField(p, "#pf-phone", "91987654321");
  await setField(p, "#pf-cpf", "52998224725");
  await p.click("#pf-submit");
  await waitFeedback(p, "Dados salvos com sucesso!");

  const legacy = await p.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("nexus:profile") || "null"); } catch (e) { return null; }
  });
  check("mock legado: perfil local salvo com nome", legacy && legacy.name === "Carla Legado", JSON.stringify(legacy));
  check("mock legado: cpf persistido no perfil local", legacy && legacy.cpf === "52998224725", legacy && legacy.cpf);
  check("mock legado: nenhuma chamada de API após salvar", p._api.length === 0, p._api.join(","));
  check("mock legado: zero dialogs", p._dialogs.length === 0);

  const dump1 = await dumpStorage(p);
  check("mock: nenhum token/senha em storage", !hasTokenLike(JSON.stringify(dump1.ls) + JSON.stringify(dump1.ss)) && !hasPasswordLike(JSON.stringify(dump1.ls)));
  check("mock: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();

  // Mock COM sessão de aba (sem nenhum usuário de API)
  const mockUser = { id: 999, name: "Ana Souza", email: `${ts}-mock@fase8.test`, phone: "(11) 99999-9999", cpf: "111.444.777-35", createdAt: new Date().toISOString() };
  const p2 = await open(D.browser, { mode: "mock", urlPath: "/pages/perfil.html", seedUser: mockUser, seedUserSession: true });

  check("mock c/ sessão: convite oculto", await hidden(p2, "#profile-auth"));
  check("mock c/ sessão: saudação com nome", (await txt(p2, "#profile-greeting")).trim() === "Ana", await txt(p2, "#profile-greeting"));
  await goDados(p2);
  check("mock c/ sessão: campos pré-preenchidos", (await value(p2, "#pf-name")) === "Ana Souza" && (await value(p2, "#pf-phone")) === "(11) 99999-9999", `${await value(p2, "#pf-name")}/${await value(p2, "#pf-phone")}`);

  await setField(p2, "#pf-phone", "91987654321");
  await setField(p2, "#pf-cpf", "52998224725");
  await p2.click("#pf-submit");
  await waitFeedback(p2, "Dados salvos com sucesso!");

  const stored = await p2.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("nexus:user") || "null"); } catch (e) { return null; }
  });
  check("mock c/ sessão: phone atualizado no nexus:user", stored && stored.phone === "91987654321", stored && stored.phone);
  check("mock c/ sessão: cpf atualizado no nexus:user", stored && stored.cpf === "52998224725", stored && stored.cpf);
  check("mock c/ sessão: 0 chamadas de API", p2._api.length === 0, p2._api.join(","));
  check("mock c/ sessão: zero dialogs", p2._dialogs.length === 0);
  await p2.close();
}

/* [2] SESSÃO API — login real, identidade e privacy */
async function s02_sessaoApi() {
  console.log("\n[2] Sessão API (login real) + identidade + security");
  const p = await open(D.browser, { urlPath: "/pages/login.html" });
  const hdr = {};
  p.on("request", (r) => {
    const url = r.url();
    if (url.includes("/api/auth/profile") || url.includes("/api/auth/refresh") || url.includes("/api/auth/me")) {
      hdr[`${r.method()} ${url}`] = r.headers()["authorization"] || null;
    }
  });
  await waitAuthState(p, "unauthenticated");
  await fillLogin(p, D.A.email, PWD);
  await waitForUrl(p, "pages/perfil.html");
  await p.waitForSelector(".account-session", { timeout: 10000 });
  await p.waitForSelector("#profile-greeting", { timeout: 8000 });

  check("perfil: saudação com primeiro nome da API", (await txt(p, "#profile-greeting")).trim() === "Ana", await txt(p, "#profile-greeting"));
  check("perfil: convite #profile-auth oculto", await hidden(p, "#profile-auth"));
  check("perfil: chip do usuário presente", await has(p, ".account-session"));
  check("perfil: nav com as 6 seções habilitadas", (await p.$$eval(".profile-nav__link", (els) => els.length)) === 6);
  check("perfil: painel de visão geral visível", !(await hidden(p, "#visao-geral")));
  check("perfil: estado final authenticated", (await p.evaluate(() => document.documentElement.dataset.authState)) === "authenticated");

  const states = await p.evaluate(() => window.__authStates || []);
  check("perfil: boot passou por 'loading'", states.includes("loading"), states.join(">"));
  check("perfil: POST /login chamado", p._api.some((u) => u.includes("/api/auth/login")), p._api.join(","));
  check("perfil: GET /me chamado (boot)", await waitApiCall(p, "/api/auth/me"), p._api.join(","));
  check("perfil: POST /refresh chamado (boot)", p._api.some((u) => u.includes("/api/auth/refresh")), p._api.join(","));
  check("perfil: GET /profile chamado (boot)", await waitApiCall(p, "/api/auth/profile"), p._api.join(","));

  const dump = await dumpStorage(p);
  const ls = JSON.stringify(dump.ls), ss = JSON.stringify(dump.ss);
  check("security: access token AUSENTE do localStorage", !hasTokenLike(ls), ls.slice(0, 140));
  check("security: access token AUSENTE do sessionStorage", !hasTokenLike(ss), ss.slice(0, 140));
  check("security: senha AUSENTE de storage", !hasPasswordLike(ls + ss) && !(ls + ss).includes(PWD), (ls + ss).slice(0, 140));
  check("security: nenhuma sessão mock criada (nexus:auth nulo)", !(await p.evaluate(() => Boolean(sessionStorage.getItem("nexus:auth")))));
  check("security: nenhum nexus:user criado pelo login API", !(await p.evaluate(() => Boolean(localStorage.getItem("nexus:user")))));
  check("security: document.cookie não expõe nt_user_refresh", !dump.cookie.includes("nt_user_refresh"), dump.cookie);
  check("security: Authorization presente em GET /me", Object.keys(hdr).some((k) => k.includes("/me") && hdr[k] && hdr[k].includes("Bearer")));
  check("security: Authorization presente em GET /profile", Object.keys(hdr).some((k) => k.includes("/profile") && hdr[k] && hdr[k].includes("Bearer")));
  const refreshHdr = Object.keys(hdr).filter((k) => k.includes("/refresh"));
  check("security: /refresh NÃO recebe Authorization", refreshHdr.length > 0 && refreshHdr.every((k) => hdr[k] === null), refreshHdr.map((k) => hdr[k]).join(","));

  const ck = await getRefreshCookie(p, `http://127.0.0.1:${PORT}/api/auth/refresh`);
  check("security: cookie nt_user_refresh existe", Boolean(ck));
  check("security: cookie nt_user_refresh é httpOnly", Boolean(ck && ck.httpOnly === true));
  check("security: cookie Path=/api/auth", Boolean(ck && ck.path === "/api/auth"), ck && JSON.stringify({ path: ck.path, sameSite: ck.sameSite, httpOnly: ck.httpOnly }));
  check("security: zero dialogs", p._dialogs.length === 0);
  check("security: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();
}

/* [3] GET /profile — usuário SEM user_profile (vazio) */
async function s03_profileVazio() {
  console.log("\n[3] GET /profile — usuário sem user_profile");
  const p = await loginToPerfil(D.A.email);
  await goDados(p);

  check("vazio: telefone vazio no form", (await value(p, "#pf-phone")) === "", await value(p, "#pf-phone"));
  check("vazio: CPF vazio no form", (await value(p, "#pf-cpf")) === "", await value(p, "#pf-cpf"));
  check("vazio: nome vem do /me", (await value(p, "#pf-name")) === "Ana Souza", await value(p, "#pf-name"));
  check("vazio: e-mail vem do /me", (await value(p, "#pf-email")) === D.A.email, await value(p, "#pf-email"));
  check("vazio: nome/e-mail readonly no modo api", (await attr(p, "#pf-name", "disabled")) !== null && (await attr(p, "#pf-email", "disabled")) !== null);
  check("vazio: comprovante de busca GET /profile", await waitApiCall(p, "/api/auth/profile", 4000), p._api.join(","));
  check("vazio: zero dialogs", p._dialogs.length === 0);
  check("vazio: zero erros duros", hardErrors(p).length === 0, hardErrors(p).join(" | "));
  await p.close();
}

/* [4] PATCH telefonE — formato cru -> normalizado + body limpo */
async function s04_patchTelefone() {
  console.log("\n[4] PATCH /profile — telefone");
  const p = await loginToPerfil(D.A.email);
  await p.waitForSelector("#meus-dados", { timeout: 8000 });
  const bodies = [];
  const onReq = (r) => {
    if (r.url().includes("/api/auth/profile") && r.method() === "PATCH") bodies.push(r.postData());
  };
  p.on("request", onReq);
  await goDados(p);
  await setField(p, "#pf-phone", "91987654321");
  await p.click("#pf-submit");
  await waitFeedback(p, "Dados salvos com sucesso!");

  check("telefone: campo exibe valor normalizado do servidor", (await value(p, "#pf-phone")) === PHONE_A, await value(p, "#pf-phone"));
  check("telefone: body realmente enviado (uma chamada PATCH)", bodies.length === 1, bodies.join(" | "));
  const body = bodies[0] ? JSON.parse(bodies[0]) : null;
  const keys = body ? Object.keys(body).sort() : [];
  check("telefone: PATCH envia SOMENTE phone", JSON.stringify(keys) === JSON.stringify(["phone"]), JSON.stringify(keys));
  check("telefone: sem id/userId/name/email no body", Boolean(body) && !("id" in body) && !("userId" in body) && !("name" in body) && !("email" in body), JSON.stringify(body));

  const row = await dbProfileByEmail(D.A.email);
  check("telefone: persistido normalizado no banco", Boolean(row) && row.phone === PHONE_A, row && JSON.stringify(row));
  check("telefone: cpf ainda nulo após PATCH de phone", Boolean(row) && row.cpf === null, row && JSON.stringify(row));
  check("telefone: zero dialogs", p._dialogs.length === 0);
  await p.close();
}

/* [5] PATCH CPF + 409 de CPF duplicado (sem corrupção) */
async function s05_patchCpf_409() {
  console.log("\n[5] PATCH /profile — CPF + 409 duplicado");
  const p = await loginToPerfil(D.A.email);
  await p.waitForSelector("#meus-dados", { timeout: 8000 });
  const bodies = [];
  const onReq = (r) => {
    if (r.url().includes("/api/auth/profile") && r.method() === "PATCH") bodies.push(r.postData());
  };
  p.on("request", onReq);
  await goDados(p);
  await setField(p, "#pf-cpf", "52998224725");
  await p.click("#pf-submit");
  await waitFeedback(p, "Dados salvos com sucesso!");

  check("cpf: campo exibe cpf normalizado", (await value(p, "#pf-cpf")) === CPF_A, await value(p, "#pf-cpf"));
  const rowA = await dbProfileByEmail(D.A.email);
  check("cpf: persistido normalizado no banco", Boolean(rowA) && rowA.cpf === CPF_A, rowA && JSON.stringify(rowA));

  // A já tem phone salvo (cenário 4): o PATCH envia SOMENTE campos permitidos
  // (phone/cpf presentes no form), nunca id/userId/name/email. O CPF vai cru e
  // o servidor normaliza (validado pelo check de exibição/banco acima).
  const cpfBodies = bodies.filter((b) => b && JSON.parse(b).cpf !== undefined);
  const cpfKeys = cpfBodies.length === 1 ? Object.keys(JSON.parse(cpfBodies[0])).sort() : [];
  check("cpf: PATCH envia apenas phone/cpf (sem id/userId/name/email)", cpfBodies.length === 1 && cpfKeys.includes("cpf") && cpfKeys.every((k) => k === "phone" || k === "cpf"), cpfBodies.join(" | "));
  await p.close();

  // Cenário 409: usuário B tenta usar o CPF de A
  const q = await open(D.browser, { urlPath: "/pages/login.html" });
  await waitAuthState(q, "unauthenticated");
  await fillLogin(q, D.B.email, PWD);
  await waitForUrl(q, "pages/perfil.html");
  await q.waitForSelector(".account-session", { timeout: 10000 });
  await goDados(q);
  await setField(q, "#pf-phone", "(21) 98888-7777");
  await setField(q, "#pf-cpf", CPF_A);
  await q.click("#pf-submit");
  await waitFeedback(q, "CPF já cadastrado para outro usuário.");

  check("409: feedback com mensagem de CPF duplicado", true);
  check("409: mensagem associada ao campo CPF", (await fieldError(q, "#pf-cpf-error")) === "CPF já cadastrado para outro usuário.", await fieldError(q, "#pf-cpf-error"));
  check("409: foco no campo CPF", (await q.evaluate(() => document.activeElement && document.activeElement.id)) === "pf-cpf", await q.evaluate(() => document.activeElement && document.activeElement.id));

  const rowB = await dbProfileByEmail(D.B.email);
  check("409: cpf de B NÃO foi gravado", rowB === null || rowB.cpf === null, rowB && JSON.stringify(rowB));
  const rowA2 = await dbProfileByEmail(D.A.email);
  check("409: perfil de A intacto (cpf preservado)", rowA2 && rowA2.cpf === CPF_A, rowA2 && JSON.stringify(rowA2));
  check("409: zero dialogs", q._dialogs.length === 0);
  check("409: zero erros duros", hardErrors(q).length === 0, hardErrors(q).join(" | "));
  await q.close();
}

/* [3b] GET /profile — usuário COM user_profile (normalizado na exibição) */
async function s06_profilePreenchido() {
  console.log("\n[6] GET /profile — usuário COM user_profile");
  const p = await loginToPerfil(D.A.email);
  await goDados(p);

  check("preenchido: telefone normalizado exibido", (await value(p, "#pf-phone")) === PHONE_A, await value(p, "#pf-phone"));
  check("preenchido: CPF normalizado exibido", (await value(p, "#pf-cpf")) === CPF_A, await value(p, "#pf-cpf"));
  check("preenchido: nome/e-mail vêm do /me", (await value(p, "#pf-name")) === "Ana Souza" && (await value(p, "#pf-email")) === D.A.email, `${await value(p, "#pf-name")}/${await value(p, "#pf-email")}`);
  check("preenchido: telefone/CPF editáveis (não disabled)", (await attr(p, "#pf-phone", "disabled")) === null && (await attr(p, "#pf-cpf", "disabled")) === null);
  check("preenchido: zero dialogs", p._dialogs.length === 0);
  await p.close();
}

/* [6] Validações — 400 do servidor, CPF inválido no cliente, payloads */
async function s07_validacoes() {
  console.log("\n[7] Validações");
  const p = await loginToPerfil(D.A.email);
  await goDados(p);

  // Telefone com 8 dígitos passa no cliente (>=8) mas 400 no servidor (DDD).
  await setField(p, "#pf-phone", "12345678");
  await setField(p, "#pf-cpf", "");
  await p.click("#pf-submit");
  await waitFeedback(p, "Telefone inválido");
  check("400: feedback com mensagem do servidor", (await txt(p, "#profile-feedback")).includes("Telefone inválido"), await txt(p, "#profile-feedback"));
  check("400: mensagem associada ao campo telefone", (await fieldError(p, "#pf-phone-error")).includes("Telefone inválido"), await fieldError(p, "#pf-phone-error"));
  check("400: foco no campo telefone", (await p.evaluate(() => document.activeElement && document.activeElement.id)) === "pf-phone", await p.evaluate(() => document.activeElement && document.activeElement.id));
  check("400: zero dialogs", p._dialogs.length === 0);

  // CPF inválido detectado pelo validador do cliente (sem envio).
  await setField(p, "#pf-phone", PHONE_A);
  await setField(p, "#pf-cpf", "123.456.789-00");
  await p.click("#pf-submit");
  await p.waitForFunction(
    () => {
      const el = document.getElementById("pf-cpf-error");
      return el && el.textContent.indexOf("CPF válido") !== -1 && !document.getElementById("profile-feedback").hidden === false;
    },
    { timeout: 8000 }
  );
  check("cpf inválido: mensagem no campo", (await fieldError(p, "#pf-cpf-error")) === "Informe um CPF válido (formato 000.000.000-00).", await fieldError(p, "#pf-cpf-error"));
  check("cpf inválido: foco no campo CPF", (await p.evaluate(() => document.activeElement && document.activeElement.id)) === "pf-cpf", await p.evaluate(() => document.activeElement && document.activeElement.id));
  check("cpf inválido: zero dialogs", p._dialogs.length === 0);

  // Validações via API real (payloads que a UI não envia).
  const apiCpfVazio = await apiPatchProfile(D.A.email, { cpf: "" });
  check("api cpf vazio → 400", apiCpfVazio.status === 400 && /não pode ser vazio/.test(JSON.stringify(apiCpfVazio.body)));
  const apiPhoneVazio = await apiPatchProfile(D.A.email, { phone: "" });
  check("api phone vazio → 400", apiPhoneVazio.status === 400 && /não pode ser vazio/.test(JSON.stringify(apiPhoneVazio.body)));
  const apiVazio = await apiPatchProfile(D.A.email, {});
  check("api payload sem campos → 400", apiVazio.status === 400 && /Envie ao menos/.test(JSON.stringify(apiVazio.body)), JSON.stringify(apiVazio.body).slice(0, 160));

  const row = await dbProfileByEmail(D.A.email);
  check("validações: perfil de A não foi corrompido", row && row.phone === PHONE_A && row.cpf === CPF_A, row && JSON.stringify(row));
  await p.close();
}

/* [7] Erros simulados: 401 / 429 / 5xx / rede (stubs) */
async function s08_erros() {
  const run = async (serverPort, expected, label) => {
    const p = await open(D.browser, { serverPort, urlPath: "/pages/perfil.html" });
    await waitAuthState(p, "unauthenticated").catch(() => {});
    await goDados(p);
    // No modo api sem usuário, nome/e-mail ficam desabilitados e vazios;
    // preenchemos via JS apenas para passar na validação client sem alert.
    await setField(p, "#pf-name", "Ana Souza");
    await setField(p, "#pf-email", D.A.email);
    await setField(p, "#pf-phone", PHONE_A);
    await p.click("#pf-submit");
    await waitFeedback(p, expected, 12000);
    check(`${label}: mensagem correta`, (await txt(p, "#profile-feedback")).includes(expected), await txt(p, "#profile-feedback"));
    check(`${label}: zero dialogs`, p._dialogs.length === 0);
    // Erros HTTP/rede aqui SÃO o objeto do teste (o console loga o resource
    // falho por padrão); o que importa é nenhuma exceção JS não tratada.
    check(`${label}: zero exceções JS`, p._pageErrs.length === 0, p._pageErrs.join(" | "));
    await p.close();
  };

  console.log("\n[8] Erros simulados");
  await run(STUB401_PORT, "Sua sessão expirou. Entre novamente para continuar.", "401");
  await run(STUB429_PORT, "Muitas tentativas. Tente novamente mais tarde.", "429");
  await run(STUB_PORT, "Ocorreu um erro inesperado no servidor. Tente novamente em instantes.", "5xx");
  await run(NET_PORT, "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.", "rede");

  const p401 = await open(D.browser, { serverPort: STUB401_PORT, urlPath: "/pages/perfil.html" });
  await waitAuthState(p401, "unauthenticated").catch(() => {});
  await goDados(p401);
  await setField(p401, "#pf-name", "Ana Souza");
  await setField(p401, "#pf-email", D.A.email);
  await setField(p401, "#pf-phone", PHONE_A);
  await p401.click("#pf-submit");
  await waitFeedback(p401, "Sua sessão expirou. Entre novamente para continuar.");
  check("401: convite passa a ser exibido", !(await hidden(p401, "#profile-auth")));
  check("401: saudação volta a 'visitante'", (await txt(p401, "#profile-greeting")).trim() === "visitante", await txt(p401, "#profile-greeting"));
  check("401: nenhuma sessão mock criada", !(await p401.evaluate(() => Boolean(sessionStorage.getItem("nexus:auth")))));
  check("401: zero exceções JS", p401._pageErrs.length === 0, p401._pageErrs.join(" | "));
  await p401.close();
}

/* [8] SESSÃO EXPIRADA — logout real, reabrir perfil => convite */
async function s09_sessaoExpirada() {
  console.log("\n[9] Sessão expirada (logout real)");
  const p = await loginToPerfil(D.A.email);

  // Logout real no header
  const before = await p.evaluate(() => Boolean(sessionStorage.getItem("nexus:auth")));
  check("expirada: nenhuma sessão mock antes do logout", !before);
  await p.click(".account-session__logout");
  await waitForUrl(p, "pages/login.html");
  check("expirada: logout navegou para login.html", p.url().includes("pages/login.html"), p.url());
  const ck = await getRefreshCookie(p, `http://127.0.0.1:${PORT}/api/auth/refresh`);
  check("expirada: cookie httpOnly removido pelo servidor", ck === null, ck ? "cookie presente" : "");

  await p.goto(`http://127.0.0.1:${PORT}/pages/perfil.html`, { waitUntil: "networkidle0" });
  await waitAuthState(p, "unauthenticated");
  check("expirada: convite exibido no perfil", !(await hidden(p, "#profile-auth")));
  check("expirada: saudação 'visitante'", (await txt(p, "#profile-greeting")).trim() === "visitante", await txt(p, "#profile-greeting"));
  check("expirada: sem chip no header", !(await has(p, ".account-session")));
  check("expirada: nenhuma sessão mock artificial (nexus:auth nulo)", !(await p.evaluate(() => Boolean(sessionStorage.getItem("nexus:auth")))));
  check("expirada: zero dialogs", p._dialogs.length === 0);
  await p.close();
}

/* [10] ISOLAMENTO — dados de A não aparecem para B */
async function s10_isolamento() {
  console.log("\n[10] Isolamento entre usuários");
  const pre = await apiPatchProfile(D.B.email, { phone: "(85) 99999-8888" });
  check("isolamento setup: B ganhou phone via API", pre.status === 200, `status=${pre.status}`);

  const p = await loginToPerfil(D.B.email);
  check("isolamento: saudação de B", (await txt(p, "#profile-greeting")).trim() === "Bruno", await txt(p, "#profile-greeting"));
  await goDados(p);

  check("isolamento: nome de B (não A)", (await value(p, "#pf-name")) === "Bruno Lima", await value(p, "#pf-name"));
  check("isolamento: telefone de B (não A)", (await value(p, "#pf-phone")) === "(85) 99999-8888", await value(p, "#pf-phone"));
  check("isolamento: phone de A NÃO vaza para B", (await value(p, "#pf-phone")) !== PHONE_A);
  check("isolamento: cpf de A NÃO vaza para B", (await value(p, "#pf-cpf")) !== CPF_A && (await value(p, "#pf-cpf")) === "", await value(p, "#pf-cpf"));
  check("isolamento: identidade via API (sem nexus:auth)", !(await p.evaluate(() => Boolean(sessionStorage.getItem("nexus:auth")))) && (await p.evaluate(() => document.documentElement.dataset.authState)) === "authenticated");

  const rowB = await dbProfileByEmail(D.B.email);
  check("isolamento: GET /profile devolveu o user_id de B", Boolean(rowB) && rowB.user_id === D.B.id, rowB && JSON.stringify(rowB));
  check("isolamento: zero dialogs", p._dialogs.length === 0);
  await p.close();
}

/* [11] Banco — persistência direta + baseline */
async function s11_banco() {
  console.log("\n[11] Banco + baseline");
  const rowA = await dbProfileByEmail(D.A.email);
  const rowB = await dbProfileByEmail(D.B.email);
  check("banco: A com phone/cpf normalizados", rowA && rowA.phone === PHONE_A && rowA.cpf === CPF_A, rowA && JSON.stringify(rowA));
  check("banco: B com phone próprio e cpf nulo", rowB && rowB.phone === "(85) 99999-8888" && rowB.cpf === null, rowB && JSON.stringify(rowB));
}

/* ------------------------------------------------------------------- main --- */

async function cleanup(pool) {
  const emails = D.emails;
  if (!emails.length) return;
  const [users] = await pool.query("SELECT id FROM users WHERE email IN (?)", [emails]);
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await pool.query("DELETE FROM admin_actions WHERE admin_id IN (?)", [ids]);
    await pool.query("DELETE FROM refresh_tokens WHERE user_id IN (?)", [ids]);
    await pool.query("DELETE FROM user_profile WHERE user_id IN (?)", [ids]);
    await pool.query("DELETE FROM users WHERE email IN (?)", [emails]);
  }
}

async function assertBaseline(pool) {
  const [testUsers] = await pool.query("SELECT COUNT(*) c FROM users WHERE email LIKE '%@fase8.test'");
  check("baseline: 0 usuários de teste restantes", Number(testUsers[0].c) === 0, `c=${testUsers[0].c}`);
  const [profiles] = await pool.query("SELECT COUNT(*) c FROM user_profile");
  check("baseline: 0 user_profile de teste restantes", Number(profiles[0].c) === 0, `c=${profiles[0].c}`);
  const [totUsers] = await pool.query("SELECT COUNT(*) c FROM users");
  check("baseline: apenas o admin permanece (1 usuário)", Number(totUsers[0].c) === 1, `c=${totUsers[0].c}`);
  const [refresh] = await pool.query("SELECT COUNT(*) c FROM refresh_tokens rt LEFT JOIN users u ON u.id = rt.user_id WHERE u.email LIKE '%@fase8.test'");
  check("baseline: 0 refresh_tokens de teste restantes", Number(refresh[0].c) === 0, `c=${refresh[0].c}`);
}

async function main() {
  const api = spawn(process.execPath, ["src/index.js"], { cwd: SERVER_DIR, stdio: "ignore" });
  const servers = await Promise.all([
    startServer(PORT, { proxyTo: API_PORT }),
    startServer(NET_PORT, { proxyTo: DEAD_PORT }),
    startServer(STUB_PORT, { stubStatus: 500 }),
    startServer(STUB401_PORT, { stubStatus: 401 }),
    startServer(STUB429_PORT, { stubStatus: 429 }),
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

    const regA = await apiRegister(mkEmail("ana"), PWD, "Ana Souza");
    check("setup: usuário A criado (201)", regA.status === 201, `status=${regA.status}`);
    const idA = regA.body && regA.body.data && regA.body.data.user ? regA.body.data.user.id : null;
    D.A = { email: (regA.body && regA.body.data && regA.body.data.user && regA.body.data.user.email) || regA.body.data.user && null, id: idA };

    const regB = await apiRegister(mkEmail("bruno"), PWD, "Bruno Lima");
    check("setup: usuário B criado (201)", regB.status === 201, `status=${regB.status}`);
    const idB = regB.body && regB.body.data && regB.body.data.user ? regB.body.data.user.id : null;
    D.B = { email: (regB.body && regB.body.data && regB.body.data.user && regB.body.data.user.email) || regB.body.data.user && null, id: idB };

    // Resolve ids garantidamente (fallback por e-mail no banco)
    if (D.A.email && D.A.id == null) {
      const [rows] = await D.pool.query("SELECT id FROM users WHERE email = ?", [D.A.email]);
      D.A.id = rows[0] ? rows[0].id : null;
    }
    if (D.B.email && D.B.id == null) {
      const [rows] = await D.pool.query("SELECT id FROM users WHERE email = ?", [D.B.email]);
      D.B.id = rows[0] ? rows[0].id : null;
    }
    if (!D.A.email || !D.B.email) throw new Error("register não retornou os e-mails de teste");
    D.emails.push(D.A.email, D.B.email);
    console.log("setup: usuários de teste criados");

    console.log("\n=== FASE 8-B — suíte do perfil real (modo api + mock) ===\n");

    await s01_mockPreservado();
    await s02_sessaoApi();
    await s03_profileVazio();
    await s04_patchTelefone();
    await s05_patchCpf_409();
    await s06_profilePreenchido();
    await s07_validacoes();
    await s08_erros();
    await s09_sessaoExpirada();
    await s10_isolamento();
    await s11_banco();

  } finally {
    await browser.close().catch(() => {});
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r)))).catch(() => {});
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
/* ==========================================================================
   NEXUS TECH — Cliente da API do Admin (v3.0-X1)
   - SEGURANÇA: o access token vive APENAS em memória (variável da página) —
     nunca em localStorage/sessionStorage/cookie/URL (decisão nº 13).
   - O refresh token fica em cookie httpOnly (impossível de ler via JS) e é
     enviado com credentials: "include" nas rotas /api/admin/auth.
   - Ao receber 401, tenta uma rotação de sessão (/auth/refresh) e reexecuta
     a requisição original. Falhou também? Redireciona para o login.
   ========================================================================== */

const ADMIN_API_BASE = "http://127.0.0.1:4000/api/admin";

let accessToken = null; // apenas em memória

function buildHeaders(hasBody) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

/* Roda uma rotação de sessão. Retorna true se um novo access token foi obtido. */
async function tryRefresh() {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      accessToken = null;
      return false;
    }
    const data = await res.json();
    accessToken = data && data.data && data.data.accessToken ? data.data.accessToken : null;
    return Boolean(accessToken);
  } catch (err) {
    accessToken = null;
    return false;
  }
}

/* Requisição autenticada às rotas administrativas. */
async function request(path, options = {}) {
  const method = options.method || "GET";
  const hasBody = options.body !== undefined;
  const isLoginPage = window.location.pathname.endsWith("login.html");

  const doFetch = () =>
    fetch(ADMIN_API_BASE + path, {
      method,
      headers: buildHeaders(hasBody),
      credentials: "include",
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });

  let response = await doFetch();

  // 401: tenta uma rotação (evitando loop na página de login — lá, sem token
  // em memória, bastaríamos recarregar e queimar o rate limit do admin).
  if (response.status === 401 && (accessToken || !isLoginPage)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await doFetch();
    } else if (!isLoginPage) {
      window.location.replace("login.html"); // sessão realmente encerrada
    }
  }

  return response;
}

/* Login real (BCrypt no servidor). NUNCA armazena o token fora de memória. */
async function login({ email, password }) {
  const res = await fetch(`${ADMIN_API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && data.error) || "Não foi possível entrar.");
  }

  accessToken = data && data.data && data.data.accessToken ? data.data.accessToken : null;
  return data.data ? data.data.user : null;
}

/* Logout: revoga o refresh no servidor e limpa o cookie httpOnly. */
async function logout() {
  try {
    await fetch(`${ADMIN_API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    accessToken = null;
  }
}

/* Sessão atual (GET /auth/me). Retorna o admin seguro ou null. */
async function getSession() {
  const res = await request("/auth/me");
  if (!res.ok) return null;
  const data = await res.json();
  return data.data || null;
}

export { login, logout, getSession, request };
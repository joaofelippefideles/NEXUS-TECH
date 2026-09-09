/* ==========================================================================
   NEXUS TECH — Autenticação mock compartilhada (v2.1)
   Sessão de usuário comum com dados NÃO sensíveis.

   LIMITAÇÃO DOCUMENTADA (mock):
   - o cadastro (v2.0) NÃO persiste senha alguma por segurança;
   - este login NÃO compara a senha contra um valor salvo;
   - a senha digitada é mantida SOMENTE em memória durante a tentativa e é
     descartada em seguida; nunca é gravada em localStorage, sessionStorage,
     cookies, URL, HTML ou logs de console;
   - a sessão apenas vincula um usuário já cadastrado (chave "nexus:user")
     à aba atual (sessionStorage "nexus:auth") — é a preparação para a
     autenticação real (backend/API) nas fases futuras.
   ========================================================================== */

const SESSION_KEY = "nexus:auth";
const USER_KEY = "nexus:user";

function load(key, store) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function save(key, value, store) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

/* Sessão da aba: { userId, authenticatedAt } — vinculada ao usuário. */
export function getSession() {
  const data = load(SESSION_KEY, window.sessionStorage);
  return data && typeof data === "object" && data.userId ? data : null;
}

export function getStoredUser() {
  const data = load(USER_KEY, window.localStorage);
  return data && typeof data === "object" ? data : null;
}

/* Usuário autenticado: a sessão precisa apontar para um usuário existente. */
export function getAuthUser() {
  const session = getSession();
  const user = getStoredUser();
  if (!session || !user) return null;
  return String(user.id) === String(session.userId) ? user : null;
}

export function createSession(userId) {
  return save(
    SESSION_KEY,
    { userId: String(userId), authenticatedAt: new Date().toISOString() },
    window.sessionStorage,
  );
}

export function logout() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/* Prefixo relativo para alcançar outra página a partir da página atual:
   - página dentro de pages/  → "X.html"  resolve para pages/X.html;
   - página na raiz (index)/  → "pages/X.html".
   Os links de conta/logout e o redirect pós-login usam este prefixo. */
export function authBasePath() {
  return /\/pages\//.test(window.location.pathname) ||
    /pages\/[^/]+\.html/.test(window.location.pathname)
    ? ""
    : "pages/";
}

/* Atualiza apenas campos NÃO sensíveis do usuário cadastrado (mock). */
export function updateStoredUser(fields) {
  const user = getStoredUser();
  if (!user) return false;
  return save(
    USER_KEY,
    {
      id: user.id,
      name: fields.name !== undefined ? fields.name : user.name,
      email: fields.email !== undefined ? fields.email : user.email,
      phone: fields.phone !== undefined ? fields.phone : user.phone,
      cpf: user.cpf || "",
      createdAt: user.createdAt || new Date().toISOString(),
    },
    window.localStorage,
  );
}

/* --------------------------------------------------------------------------
   HEADER — estado de sessão
   - deslogado: "Minha conta" → login.html;
   - logado:    "Minha conta" → perfil.html + chip "Olá, {nome}" + "Sair".
   Modifica somente o DOM, sem recarregar a página.
-------------------------------------------------------------------------- */

function firstNameOf(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts.length ? parts[0] : "";
}

export function syncAuthHeader() {
  const actions = document.querySelector(".site-header__actions");
  const account = document.querySelector(".icon-btn__label--account");
  if (!actions) return;

  const user = getAuthUser();
  const isAccountPage = document.body && document.body.dataset.page === "perfil";
  const base = authBasePath();

  if (account) {
    account.href = base + (user ? "perfil.html" : "login.html");
    if (user && isAccountPage) {
      account.setAttribute("aria-current", "page");
    } else {
      account.removeAttribute("aria-current");
    }
  }

  const existing = actions.querySelector(".account-session");
  if (existing) existing.remove();

  if (!user) return;

  const chip = document.createElement("div");
  chip.className = "account-session";

  const name = document.createElement("span");
  name.className = "account-session__name";
  name.textContent = "Olá, " + firstNameOf(user.name);

  const sair = document.createElement("button");
  sair.type = "button";
  sair.className = "account-session__logout";
  sair.textContent = "Sair";
  sair.setAttribute("aria-label", "Sair da conta");
  sair.addEventListener("click", () => {
    logout();
    syncAuthHeader();
    window.location.href = base + "login.html";
  });

  chip.appendChild(name);
  chip.appendChild(sair);
  actions.appendChild(chip);
}

function init() {
  syncAuthHeader();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
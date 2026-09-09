/* ==========================================================================
   NEXUS TECH — Login de usuário comum (v2.1)
   Validação + sessão MOCK vinculada ao usuário cadastrado ("nexus:user").

   SEGURANÇA / LIMITAÇÃO DOCUMENTADA:
   - não existe senha persistida (v2.0); a senha digitada é validada apenas
     em memória nesta página e descartada em seguida;
   - a senha NUNCA é gravada em localStorage, sessionStorage, cookies, URL,
     HTML ou logs de console;
   - a sessão criada (sessionStorage "nexus:auth") contém apenas
     { userId, authenticatedAt } — dados não sensíveis;
   - o acesso é simulado: se o e-mail cadastrado bater e a senha for
     informada, a sessão da aba é criada (preparação para o backend).
   ========================================================================== */

import {
  getStoredUser,
  getAuthUser,
  createSession,
  syncAuthHeader,
  authBasePath,
} from "./auth.js";

const VALIDATORS = {
  email: (value) => {
    const v = value.trim();
    if (v === "") return "Informe seu e-mail.";
    return /^\S+@\S+\.\S+$/.test(v) || "Informe um e-mail válido.";
  },
  password: (value) => value !== "" || "Informe sua senha.",
};

/* --------------------------------------------------------------------------
   VALIDAÇÃO (padrão do projeto — sem alert(); mensagens associadas)
-------------------------------------------------------------------------- */

function setFieldError(field, message) {
  const wrap = field.closest(".contact-form__field");
  if (!wrap) return;
  const describedBy = (field.getAttribute("aria-describedby") || "")
    .trim()
    .split(/\s+/);
  const describedEl = describedBy
    .map((id) => document.getElementById(id))
    .find((el) => el && el.classList.contains("contact-form__error"));

  wrap.classList.toggle("has-error", Boolean(message));
  if (message) {
    field.setAttribute("aria-invalid", "true");
    if (describedEl) describedEl.textContent = message;
  } else {
    field.removeAttribute("aria-invalid");
    if (describedEl) describedEl.textContent = "";
  }
}

function validateField(field) {
  const rule = VALIDATORS[field.getAttribute("data-validate")];
  if (!rule) return "";
  const result = rule(field.value);
  return result === true ? "" : result;
}

function validateGroup(container) {
  const fields = container.querySelectorAll("[data-validate]");
  let firstError = null;

  for (const field of fields) {
    const message = validateField(field);
    setFieldError(field, message);
    if (message && !firstError) firstError = field;
  }

  return firstError;
}

/* --------------------------------------------------------------------------
   MENSAGENS ACESSÍVEIS
-------------------------------------------------------------------------- */

function announce(message) {
  const status = document.getElementById("login-status");
  if (status) status.textContent = message;
}

function hideFeedback() {
  const feedback = document.getElementById("login-feedback");
  if (!feedback) return;
  feedback.hidden = true;
  feedback.textContent = "";
  feedback.classList.remove("alert--success", "alert--warning");
}

function showFeedback(message, type) {
  const feedback = document.getElementById("login-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = false;
  feedback.classList.toggle("alert--success", type === "success");
  feedback.classList.toggle("alert--warning", type === "warning");
  announce(message);
}

/* --------------------------------------------------------------------------
   SUBMIT
-------------------------------------------------------------------------- */

/* Página de retorno após o login (parâmetro "?next=checkout.html", usado no
   fluxo de compra v2.3). Aceita somente um nome de página simples (ex.: um
   "checkout.html") — sem esquema, caminho ou query arbitrários; caso
   contrário retorna null e o login segue para perfil.html. */
function nextPage() {
  try {
    const next = new URL(window.location.href).searchParams.get("next") || "";
    return /^[A-Za-z0-9_\-]+\.html$/.test(next) ? next : null;
  } catch (err) {
    return null;
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("login-form");
  const firstError = validateGroup(form);

  if (firstError) {
    firstError.focus();
    hideFeedback();
    announce("Revise os campos destacados para entrar.");
    return;
  }

  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const user = getStoredUser();

  if (!user || String(user.email || "").trim().toLowerCase() !== email) {
    showFeedback("Não encontramos uma conta cadastrada com este e-mail.", "warning");
    document.getElementById("login-email").focus();
    return;
  }

  createSession(user.id);
  syncAuthHeader();

  const firstName = String(user.name || "").trim().split(/\s+/)[0] || "";
  showFeedback(`Bem-vindo(a)${firstName ? ", " + firstName : ""}! Entrando na sua conta...`, "success");
  announce("Login realizado com sucesso!");

  const target = authBasePath() + (nextPage() || "perfil.html");
  window.setTimeout(() => {
    window.location.href = target;
  }, 600);
}

/* --------------------------------------------------------------------------
   INICIALIZAÇÃO
-------------------------------------------------------------------------- */

function bindEvents() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", handleSubmit);

  form.addEventListener("input", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });
  form.addEventListener("change", (event) => {
    const field = event.target.closest("[data-validate]");
    if (field) setFieldError(field, "");
  });
}

function init() {
  // Já autenticado? Vai direto para o destino (ou Minha conta), sem recarregar.
  if (getAuthUser()) {
    window.location.replace(authBasePath() + (nextPage() || "perfil.html"));
    return;
  }
  hideFeedback();
  bindEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
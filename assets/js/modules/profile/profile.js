/* ==========================================================================
   NEXUS TECH — Perfil / Minha conta
   Navegação entre seções (hash-based), dados pessoais, endereços, favoritos
   e preferências. Persistência em localStorage (chaves com prefixo "nexus:").
   Sem autenticação e sem requisições ao servidor: tudo é simulado aqui.
   ========================================================================== */

import { products } from "../../data/products.js";
import { formatBRL } from "../../utils/format.js";
import { getFavorites, toggleFavorite, syncHeaderCounts } from "../store/store.js";
import { getAuthUser, updateStoredUser } from "../auth/auth.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const PROFILE_KEY = "nexus:profile";
const ADDRESSES_KEY = "nexus:addresses";
const PREFS_KEY = "nexus:prefs";

const SECTIONS = [
  { id: "overview", hash: "visao-geral", label: "Visão geral" },
  { id: "dados", hash: "meus-dados", label: "Meus dados" },
  { id: "pedidos", hash: "meus-pedidos", label: "Meus pedidos" },
  { id: "enderecos", hash: "enderecos", label: "Endereços" },
  { id: "favoritos", hash: "favoritos", label: "Favoritos" },
  { id: "config", hash: "configuracoes", label: "Configurações" },
];

const VALIDATORS = {
  text: (value) =>
    value.trim().length >= 2 || "Informe seu nome (mínimo 2 letras).",
  email: (value) =>
    /^\S+@\S+\.\S+$/.test(value.trim()) || "Informe um e-mail válido.",
  phone: (value) =>
    normalizeDigits(value).length >= 8 ||
    "Informe um telefone com DDD (mínimo 8 dígitos).",
  label: () => "",
  cep: (value) =>
    normalizeDigits(value).length === 8 || "Informe um CEP válido com 8 dígitos.",
  street: (value) => value.trim().length >= 3 || "Informe a rua.",
  number: (value) => value.trim() !== "" || "Informe o número.",
  complement: () => "",
  neighborhood: (value) => value.trim().length >= 2 || "Informe o bairro.",
  city: (value) => value.trim().length >= 2 || "Informe a cidade.",
  state: (value) => value !== "" || "Selecione o estado (UF).",
};

const state = {
  section: "overview",
  editingAddressId: null,
};

/* Leitura/escrita segura no localStorage (mesmo padrão do store). */
function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function getProfile() {
  const data = read(PROFILE_KEY);
  return data && typeof data === "object" ? data : {};
}

/* Dados exibidos: vêm do usuário da sessão quando autenticado; caso
   contrário, mantém o perfil local (v1.9). */
function getDisplayProfile() {
  const user = getAuthUser();
  if (user) {
    return {
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
    };
  }
  return getProfile();
}

function saveProfile(data) {
  return write(PROFILE_KEY, { name: data.name || "", email: data.email || "", phone: data.phone || "" });
}

function getAddresses() {
  const data = read(ADDRESSES_KEY);
  return Array.isArray(data) ? data : [];
}

function saveAddresses(list) {
  return write(ADDRESSES_KEY, list);
}

function getPrefs() {
  const data = read(PREFS_KEY);
  return data && typeof data === "object"
    ? data
    : { news: false, offers: false, contact: false };
}

function savePrefs(prefs) {
  return write(PREFS_KEY, {
    news: Boolean(prefs.news),
    offers: Boolean(prefs.offers),
    contact: Boolean(prefs.contact),
  });
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function announce(message) {
  const status = document.getElementById("profile-status");
  if (status) status.textContent = message;
}

function showFeedback(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.classList.add("alert--success");
  announce(message);
}

/* --------------------------------------------------------------------------
   NAVEGAÇÃO ENTRE SEÇÕES
-------------------------------------------------------------------------- */

function sectionById(id) {
  return SECTIONS.find((s) => s.id === id);
}

function sectionFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  const match = SECTIONS.find((s) => s.hash === hash);
  return match ? match.id : "overview";
}

function switchSection(section, updateHash = true) {
  const target = sectionById(section);
  if (!target) return;
  state.section = target.id;

  for (const item of SECTIONS) {
    const panel = document.querySelector(`[data-panel="${item.id}"]`);
    if (panel) panel.hidden = item.id !== target.id;
  }

  const links = document.querySelectorAll(".profile-nav__link");
  for (const link of links) {
    const active = link.dataset.section === target.id;
    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  const panel = document.querySelector(`[data-panel="${target.id}"]`);
  const title = panel ? panel.querySelector("[tabindex='-1']") : null;
  if (title) title.focus({ preventScroll: true });

  if (updateHash && window.location.hash !== "#" + target.hash) {
    try {
      history.replaceState(null, "", "#" + target.hash);
    } catch (err) {
      // hash apenas cosmético — segue mesmo se indisponível
    }
  }

  renderSection(target.id);
}

function renderSection(section) {
  const renderers = {
    overview: renderOverview,
    dados: renderDados,
    enderecos: renderAddresses,
    favoritos: renderFavorites,
    config: renderConfig,
  };
  const render = renderers[section];
  if (render) render();
}

function handleNavClick(event) {
  const link = event.target.closest("a[data-section]");
  if (!link) return;
  event.preventDefault();
  switchSection(link.dataset.section);
}

function handleHashChange() {
  const section = sectionFromHash();
  if (section !== state.section) {
    switchSection(section, false);
  }
}

/* --------------------------------------------------------------------------
   VISÃO GERAL
-------------------------------------------------------------------------- */

function renderOverview() {
  const pedidos = document.getElementById("ov-pedidos");
  if (pedidos) pedidos.textContent = "0";

  const favorites = getFavorites();
  const addresses = getAddresses();
  const profile = getDisplayProfile();

  const fav = document.getElementById("ov-favoritos");
  if (fav) fav.textContent = String(favorites.length);

  const end = document.getElementById("ov-enderecos");
  if (end) end.textContent = String(addresses.length);

  const conta = document.getElementById("ov-conta");
  const contaText = document.getElementById("ov-conta-text");
  if (conta && contaText) {
    if (profile.name || profile.email) {
      conta.textContent = profile.name || profile.email;
      contaText.textContent = profile.email
        ? `${profile.email}${profile.phone ? " · " + profile.phone : ""}`
        : "E-mail ainda não informado.";
    } else {
      conta.textContent = "Não preenchidos";
      contaText.textContent = "Preencha seus dados para personalizar a experiência.";
    }
  }
}

/* --------------------------------------------------------------------------
   DADOS PESSOAIS
-------------------------------------------------------------------------- */

function renderDados() {
  const profile = getDisplayProfile();
  const field = (id) => document.getElementById(id);
  const name = field("pf-name");
  const email = field("pf-email");
  const phone = field("pf-phone");

  if (name) name.value = profile.name || "";
  if (email) email.value = profile.email || "";
  if (phone) phone.value = profile.phone || "";

  document.querySelectorAll("#profile-form [data-validate]").forEach((el) => {
    clearFieldError(el);
  });
  const feedback = document.getElementById("profile-feedback");
  if (feedback) {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("alert--success");
  }
}

/* --------------------------------------------------------------------------
   VALIDAÇÃO (padrão do checkout — sem alert(); mensagens associadas)
-------------------------------------------------------------------------- */

function setFieldError(field, message) {
  const wrap = field.closest(".contact-form__field");
  if (!wrap) return;
  const described = field.getAttribute("aria-describedby")
    ? document.getElementById(field.getAttribute("aria-describedby"))
    : null;

  wrap.classList.toggle("has-error", Boolean(message));
  if (message) {
    field.setAttribute("aria-invalid", "true");
    if (described) described.textContent = message;
  } else {
    field.removeAttribute("aria-invalid");
    if (described) described.textContent = "";
  }
}

function clearFieldError(field) {
  setFieldError(field, "");
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
   DADOS PESSOAIS — salvar
-------------------------------------------------------------------------- */

function handleProfileSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("profile-form");
  const firstError = validateGroup(form);
  const feedback = document.getElementById("profile-feedback");

  if (firstError) {
    firstError.focus();
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.classList.remove("alert--success");
    }
    announce("Revise os campos destacados antes de salvar.");
    return;
  }

  saveProfile({
    name: document.getElementById("pf-name").value.trim(),
    email: document.getElementById("pf-email").value.trim(),
    phone: document.getElementById("pf-phone").value.trim(),
  });
  if (getAuthUser()) {
    updateStoredUser({
      name: document.getElementById("pf-name").value.trim(),
      email: document.getElementById("pf-email").value.trim(),
      phone: document.getElementById("pf-phone").value.trim(),
    });
  }
  showFeedback("profile-feedback", "Dados salvos com sucesso!");
}

/* --------------------------------------------------------------------------
   ENDEREÇOS
-------------------------------------------------------------------------- */

function buildAddressFromForm() {
  const val = (id) => document.getElementById(id).value.trim();
  return {
    id: state.editingAddressId || "addr-" + Date.now().toString(36),
    label: val("addr-label"),
    cep: val("addr-cep"),
    street: val("addr-street"),
    number: val("addr-number"),
    complement: val("addr-complement"),
    neighborhood: val("addr-neighborhood"),
    city: val("addr-city"),
    state: val("addr-state"),
  };
}

function addressSummary(address) {
  const street = `${address.street}, ${address.number}${address.complement ? " — " + address.complement : ""}`;
  const region = `${address.neighborhood} · ${address.city}/${address.state}`;
  return { street, region };
}

function renderAddresses() {
  const addresses = getAddresses();
  const list = document.getElementById("addresses-list");
  const empty = document.getElementById("addresses-empty");
  if (!list || !empty) return;

  const emptyVisible = addresses.length === 0;
  empty.hidden = !emptyVisible;
  list.hidden = emptyVisible;

  list.replaceChildren();

  for (const address of addresses) {
    const li = document.createElement("li");
    li.className = "profile-address";

    const head = document.createElement("div");
    head.className = "profile-address__head";
    const title = document.createElement("strong");
    title.textContent = address.label || "Endereço";
    head.appendChild(title);
    li.appendChild(head);

    const text = document.createElement("p");
    text.className = "profile-address__text";
    const summary = addressSummary(address);
    text.appendChild(document.createTextNode(summary.street));
    text.appendChild(document.createElement("br"));
    text.appendChild(document.createTextNode(summary.region));
    text.appendChild(document.createElement("br"));
    text.appendChild(document.createTextNode(`CEP ${address.cep}`));
    li.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "profile-address__actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn--outline";
    edit.textContent = "Editar";
    edit.setAttribute("data-address-action", "edit");
    edit.setAttribute("data-address-id", address.id);
    actions.appendChild(edit);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn--ghost";
    remove.textContent = "Remover";
    remove.setAttribute("data-address-action", "remove");
    remove.setAttribute("data-address-id", address.id);
    actions.appendChild(remove);

    li.appendChild(actions);
    list.appendChild(li);
  }
}

function showAddressForm(editingId = null) {
  state.editingAddressId = editingId ? String(editingId) : null;
  const form = document.getElementById("address-form");
  const title = document.getElementById("address-form-title");
  if (!form || !title) return;

  const editing = getAddresses().find((a) => String(a.id) === state.editingAddressId);
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  };

  setVal("addr-label", editing ? editing.label : "");
  setVal("addr-cep", editing ? editing.cep : "");
  setVal("addr-street", editing ? editing.street : "");
  setVal("addr-number", editing ? editing.number : "");
  setVal("addr-complement", editing ? editing.complement : "");
  setVal("addr-neighborhood", editing ? editing.neighborhood : "");
  setVal("addr-city", editing ? editing.city : "");
  setVal("addr-state", editing ? editing.state : "");

  form.querySelectorAll("[data-validate]").forEach(clearFieldError);
  const feedback = document.getElementById("address-feedback");
  if (feedback) {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("alert--success");
  }

  title.textContent = editingId ? "Editar endereço" : "Novo endereço";
  form.hidden = false;
  document.getElementById("addr-label").focus();
}

function hideAddressForm() {
  state.editingAddressId = null;
  const form = document.getElementById("address-form");
  if (form) {
    form.hidden = true;
    form.reset();
  }
}

function handleAddressSubmit(event) {
  event.preventDefault();

  const form = document.getElementById("address-form");
  const firstError = validateGroup(form);
  const feedback = document.getElementById("address-feedback");

  if (firstError) {
    firstError.focus();
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.classList.remove("alert--success");
    }
    announce("Revise os campos destacados antes de salvar o endereço.");
    return;
  }

  const address = buildAddressFromForm();
  const addresses = getAddresses();
  const index = addresses.findIndex((a) => String(a.id) === String(address.id));
  const isEditing = index >= 0;

  if (isEditing) {
    addresses[index] = address;
  } else {
    addresses.push(address);
  }

  saveAddresses(addresses);
  hideAddressForm();
  renderAddresses();
  showFeedback("address-feedback", isEditing ? "Endereço atualizado com sucesso!" : "Endereço salvo com sucesso!");
}

function handleAddressListClick(event) {
  const button = event.target.closest("[data-address-id]");
  if (!button) return;

  const id = button.getAttribute("data-address-id");
  const action = button.getAttribute("data-address-action");

  if (action === "edit") {
    showAddressForm(id);
    return;
  }

  if (action === "remove") {
    const addresses = getAddresses().filter((a) => String(a.id) !== String(id));
    saveAddresses(addresses);
    if (state.editingAddressId === String(id)) hideAddressForm();
    renderAddresses();
    showFeedback("address-feedback", "Endereço removido com sucesso.");
  }
}

/* --------------------------------------------------------------------------
   FAVORITOS
-------------------------------------------------------------------------- */

function svg(attrs) {
  const el = document.createElementNS(SVG_NS, "svg");
  for (const key of Object.keys(attrs)) {
    el.setAttribute(key, attrs[key]);
  }
  return el;
}

function favoriteImage(product) {
  const palette = [
    ["#0e7490", "#6d28d9"],
    ["#155e75", "#0891b2"],
    ["#6d28d9", "#f59e0b"],
  ];
  const colors = palette[product.id % palette.length];

  const s = svg({
    viewBox: "0 0 240 240",
    role: "img",
    "aria-label": `Imagem ilustrativa de ${product.name}`,
  });

  const caption = document.createElementNS(SVG_NS, "title");
  caption.textContent = `Imagem ilustrativa de ${product.name}`;
  s.appendChild(caption);

  const defs = document.createElementNS(SVG_NS, "defs");
  const grad = document.createElementNS(SVG_NS, "linearGradient");
  grad.id = "pfav" + product.id;
  grad.setAttribute("x1", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "1");
  grad.setAttribute("y2", "1");
  const stopA = document.createElementNS(SVG_NS, "stop");
  stopA.setAttribute("offset", "0%");
  stopA.setAttribute("stop-color", colors[0]);
  const stopB = document.createElementNS(SVG_NS, "stop");
  stopB.setAttribute("offset", "100%");
  stopB.setAttribute("stop-color", colors[1]);
  grad.appendChild(stopA);
  grad.appendChild(stopB);
  defs.appendChild(grad);
  s.appendChild(defs);

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("width", "240");
  bg.setAttribute("height", "240");
  bg.setAttribute("fill", "url(#pfav" + product.id + ")");
  s.appendChild(bg);

  const letter = document.createElementNS(SVG_NS, "text");
  letter.setAttribute("x", "50%");
  letter.setAttribute("y", "55%");
  letter.setAttribute("text-anchor", "middle");
  letter.setAttribute("dominant-baseline", "middle");
  letter.setAttribute("font-size", "88");
  letter.setAttribute("font-weight", "900");
  letter.setAttribute("font-family", "Rajdhani, sans-serif");
  letter.setAttribute("fill", "rgba(255,255,255,0.95)");
  letter.textContent = product.category.charAt(0).toUpperCase();
  s.appendChild(letter);

  return s;
}

function renderFavorites() {
  const favorites = getFavorites();
  const list = document.getElementById("favorites-list");
  const empty = document.getElementById("favorites-empty");
  if (!list || !empty) return;

  const items = favorites
    .map((id) => products.find((p) => String(p.id) === String(id)))
    .filter(Boolean);

  const emptyVisible = items.length === 0;
  empty.hidden = !emptyVisible;
  list.hidden = emptyVisible;
  list.replaceChildren();

  for (const product of items) {
    const li = document.createElement("li");
    li.className = "profile-fav__item";

    const media = document.createElement("span");
    media.className = "profile-fav__media";
    const img = favoriteImage(product);
    img.setAttribute("class", "profile-fav__img");
    media.appendChild(img);
    li.appendChild(media);

    const info = document.createElement("span");
    info.className = "profile-fav__info";

    const link = document.createElement("a");
    link.className = "profile-fav__name";
    link.href = `produto.html?slug=${product.slug}`;
    link.textContent = product.name;
    info.appendChild(link);

    const meta = document.createElement("span");
    meta.className = "profile-fav__meta";
    meta.textContent = product.brand;
    info.appendChild(meta);

    const price = document.createElement("span");
    price.className = "profile-fav__price";
    price.textContent = formatBRL(product.priceCents);
    info.appendChild(price);

    li.appendChild(info);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn--ghost";
    remove.textContent = "Remover";
    remove.setAttribute("aria-label", `Remover ${product.name} dos favoritos`);
    remove.setAttribute("data-remove-favorite", String(product.id));
    li.appendChild(remove);

    list.appendChild(li);
  }
}

function handleFavoriteClick(event) {
  const button = event.target.closest("[data-remove-favorite]");
  if (!button) return;

  const product = products.find((p) => String(p.id) === button.getAttribute("data-remove-favorite"));
  toggleFavorite(product.id);
  renderFavorites();
  syncHeaderCounts();
  announce(`Produto removido dos favoritos.${product ? ` ${product.name}.` : ""}`);
}

/* --------------------------------------------------------------------------
   CONFIGURAÇÕES — preferências
-------------------------------------------------------------------------- */

function renderConfig() {
  const prefs = getPrefs();
  const setChecked = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(value);
  };

  setChecked("pref-news", prefs.news);
  setChecked("pref-offers", prefs.offers);
  setChecked("pref-contact", prefs.contact);

  const feedback = document.getElementById("prefs-feedback");
  if (feedback) {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("alert--success");
  }
}

function handlePrefChange(event) {
  const form = event.target.closest("#prefs-form");
  if (!form) return;
  savePrefs({
    news: document.getElementById("pref-news").checked,
    offers: document.getElementById("pref-offers").checked,
    contact: document.getElementById("pref-contact").checked,
  });
  showFeedback("prefs-feedback", "Preferências salvas com sucesso!");
}

/* --------------------------------------------------------------------------
   INICIALIZAÇÃO
-------------------------------------------------------------------------- */

function bindEvents() {
  document.addEventListener("click", handleNavClick);

  const profileForm = document.getElementById("profile-form");
  if (profileForm) profileForm.addEventListener("submit", handleProfileSubmit);

  const btnAdd = document.getElementById("btn-add-address");
  const btnAddEmpty = document.getElementById("btn-add-address-empty");
  const btnCancel = document.getElementById("addr-cancel");
  const addressForm = document.getElementById("address-form");

  if (btnAdd) {
    btnAdd.addEventListener("click", () => {
      if (addressForm && addressForm.hidden) {
        showAddressForm(null);
      } else {
        hideAddressForm();
      }
    });
  }
  if (btnAddEmpty) {
    btnAddEmpty.addEventListener("click", () => showAddressForm(null));
  }
  if (btnCancel) {
    btnCancel.addEventListener("click", hideAddressForm);
  }
  if (addressForm) {
    addressForm.addEventListener("submit", handleAddressSubmit);
  }

  const addressList = document.getElementById("addresses-list");
  if (addressList) addressList.addEventListener("click", handleAddressListClick);

  const favoritesList = document.getElementById("favorites-list");
  if (favoritesList) favoritesList.addEventListener("click", handleFavoriteClick);

  const prefsForm = document.getElementById("prefs-form");
  if (prefsForm) prefsForm.addEventListener("change", handlePrefChange);

  window.addEventListener("hashchange", handleHashChange);
}

function init() {
  const section = sectionFromHash();
  state.section = section;

  const authUser = getAuthUser();
  const greeting = document.getElementById("profile-greeting");
  const authBox = document.getElementById("profile-auth");

  if (authUser) {
    const firstName = String(authUser.name || "").trim().split(/\s+/)[0] || "";
    if (greeting) greeting.textContent = firstName;
    if (authBox) authBox.hidden = true;
  } else {
    if (greeting) greeting.textContent = "visitante";
    if (authBox) authBox.hidden = false;
  }

  for (const item of SECTIONS) {
    const panel = document.querySelector(`[data-panel="${item.id}"]`);
    if (panel) panel.hidden = item.id !== section;
  }

  const links = document.querySelectorAll(".profile-nav__link");
  for (const link of links) {
    const active = link.dataset.section === section;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "true");
  }

  syncHeaderCounts();
  renderSection(section);
  bindEvents();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
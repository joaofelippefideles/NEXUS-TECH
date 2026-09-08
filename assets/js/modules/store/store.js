/* ==========================================================================
   NEXUS TECH — Store (carrinho e favoritos)
   Persistência em localStorage, compartilhada entre páginas (catálogo e
   página do produto). Atualiza os contadores do header quando presentes.
   API idempotente e sem dependência de UI; cada módulo decide como reagir.
   ========================================================================== */

const CART_KEY = "nexus:cart";
const FAV_KEY = "nexus:favorites";

/* Leitura segura do localStorage (evita quebrar em browsers restritos). */
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

/* Carrinho: mapa produtoId -> quantidade. */
export function getCart() {
  const cart = read(CART_KEY);
  return cart && typeof cart === "object" ? cart : {};
}

export function getCartCount() {
  const cart = getCart();
  return Object.values(cart).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

/* Adiciona quantidade ao carrinho. `max` limita por estoque quando fornecido.
   Retorna a nova quantidade total do item (ou null se exceder `max`). */
export function addToCart(productId, qty = 1, max = null) {
  const id = String(productId);
  const cart = getCart();
  const current = Number(cart[id] || 0);
  const next = current + Number(qty || 0);

  if (max !== null && next > Number(max)) {
    return null;
  }

  cart[id] = next;
  write(CART_KEY, cart);
  return next;
}

export function removeFromCart(productId) {
  const cart = getCart();
  delete cart[String(productId)];
  write(CART_KEY, cart);
}

export function clearCart() {
  write(CART_KEY, {});
}

/* Favoritos: array de ids. */
export function getFavorites() {
  const fav = read(FAV_KEY);
  return Array.isArray(fav) ? fav : [];
}

export function isFavorite(productId) {
  return getFavorites().includes(String(productId));
}

/* Retorna true se o produto passou a ser favorito, false se foi removido. */
export function toggleFavorite(productId) {
  const id = String(productId);
  const fav = getFavorites();
  const index = fav.indexOf(id);

  if (index >= 0) {
    fav.splice(index, 1);
    write(FAV_KEY, fav);
    return false;
  }

  fav.push(id);
  write(FAV_KEY, fav);
  return true;
}

/* Atualiza os contadores do header (elementos opcionais). */
export function syncHeaderCounts() {
  const cartEl = document.getElementById("cart-count");
  if (cartEl) {
    cartEl.textContent = String(getCartCount());
  }
  const favEl = document.getElementById("favorites-count");
  if (favEl) {
    favEl.textContent = String(getFavorites().length);
  }
}

export const store = {
  getCart,
  getCartCount,
  addToCart,
  removeFromCart,
  clearCart,
  getFavorites,
  isFavorite,
  toggleFavorite,
  syncHeaderCounts,
};

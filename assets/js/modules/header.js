/* ==========================================================================
   NEXUS TECH — Header
   Interação visual mínima (Sprint 2):
   - Menu hamburguer (abrir/fechar no mobile);
   - Ano do rodapé.
   Nenhuma lógica de negócio (carrinho, favoritos, busca) entra aqui.
   ========================================================================== */

(function initHeader() {
  "use strict";

  const header = document.getElementById("site-header");
  const toggle = document.getElementById("nav-toggle");

  if (header && toggle) {
    toggle.addEventListener("click", function () {
      const isOpen = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Fechar o menu ao pressionar Esc (acessibilidade)
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // Ano do rodapé
  const yearEl = document.getElementById("footer-year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();

/* ==========================================================================
   NEXUS TECH — Header
   Interação visual mínima (Sprint 2):
   - Menu hamburguer (abrir/fechar no mobile);
   - Ano do rodapé.
   V2.1 — estado de sessão: carrega o módulo compartilhado de autenticação
   que re-aponta "Minha conta" (login/perfil), injeta o chip do usuário e
   disponibiliza "Sair" sem recarregar a página. Nenhuma lógica de negócio
   (carrinho, favoritos, busca) entra aqui.
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

  // Sessão mock no header — o auth.js se auto-inicializa ao ser importado.
  // Usa um comportamento dinâmico de import() com fallback silencioso:
  // o caminho absoluto ("/assets/...") resolve contra a origem do site de
  // forma determinística na raiz, em pages/ e em qualquer contexto.
  try {
    import("/assets/js/modules/auth/auth.js").catch(function () {
      // header segue funcional mesmo sem o estado de sessão
    });
  } catch (err) {
    // sem estado de sessão neste navegador
  }
})();

/* ==========================================================================
   NEXUS TECH (versão PHP) — Interações essenciais (JavaScript mínimo)
   ========================================================================== */
(function () {
  'use strict';

  /* Menu mobile ---------------------------------------------------------- */
  var toggle = document.getElementById('nav-toggle');
  var header = document.getElementById('site-header');

  if (toggle && header) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    });
  }

  /* Mostrar/ocultar senha ------------------------------------------------- */
  document.querySelectorAll('[data-toggle-password]').forEach(function (button) {
    button.addEventListener('click', function () {
      var input = document.getElementById(button.getAttribute('data-toggle-password'));
      if (!input) { return; }

      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Ocultar' : 'Mostrar';
      button.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  });

  /* Stepper de quantidade ------------------------------------------------- */
  document.querySelectorAll('.qty-stepper').forEach(function (stepper) {
    var input = stepper.querySelector('.qty-stepper__input');
    var buttons = stepper.querySelectorAll('[data-step]');
    if (!input || buttons.length === 0) { return; }

    function clamp(value) {
      var min = parseInt(input.min, 10) || 1;
      var max = parseInt(input.max, 10) || min;
      var parsed = parseInt(value, 10);
      if (isNaN(parsed)) { parsed = min; }
      return Math.min(max, Math.max(min, parsed));
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var step = parseInt(button.getAttribute('data-step'), 10) || 0;
        input.value = String(clamp((parseInt(input.value, 10) || 1) + step));
        if (input.hasAttribute('data-autosubmit') && input.form) {
          input.form.submit();
        }
      });
    });

    input.addEventListener('change', function () {
      input.value = String(clamp(input.value));
    });
  });

  /* Confirmação de ações destrutivas ------------------------------------- */
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!window.confirm(form.getAttribute('data-confirm') || 'Confirma esta ação?')) {
        event.preventDefault();
      }
    });
  });

  /* Newsletter ----------------------------------------------------------- */
  var newsletter = document.getElementById('newsletter-form');
  if (newsletter) {
    newsletter.addEventListener('submit', function (event) {
      event.preventDefault();
      var feedback = document.getElementById('newsletter-feedback');
      if (feedback) {
        feedback.textContent = 'Cadastro recebido! Em breve você receberá nossas novidades.';
        feedback.classList.add('alert--success');
        feedback.hidden = false;
      }
      newsletter.reset();
    });
  }

  /* Envio automático ao mudar a ordenação -------------------------------- */
  document.querySelectorAll('[data-autosubmit]').forEach(function (field) {
    field.addEventListener('change', function () {
      if (field.form) { field.form.submit(); }
    });
  });

  /* Confirmação antes de remover item do carrinho ------------------------ */
  document.querySelectorAll('[data-cart-remove]').forEach(function (button) {
    button.addEventListener('click', function (event) {
      if (!window.confirm('Remover este item do carrinho?')) {
        event.preventDefault();
      }
    });
  });
})();

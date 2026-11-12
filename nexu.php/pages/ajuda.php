<?php
declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Central de Ajuda — Nexus Tech';
$pageDesc = 'Central de ajuda Nexus Tech: tire dúvidas sobre compras, produtos, pagamento, entrega, trocas e devoluções e sua conta.';
$bodyPage = 'help';
$extraScripts = '<script src="../assets/js/modules/institutional/help.js"></script>';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/components.php';
require __DIR__ . '/../includes/header.php';
?>

<main>
    <section class="institutional" aria-labelledby="help-title">
      <div class="container">

        <div class="institutional__header">

          <nav class="breadcrumb" aria-label="Trilha de navegação">
            <ol class="breadcrumb__list">
              <li class="breadcrumb__item">
                <a href="../index.php" class="breadcrumb__link">Home</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <a href="ajuda.php" class="breadcrumb__link">Ajuda</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <span class="breadcrumb__current" aria-current="page">Central de Ajuda</span>
              </li>
            </ol>
          </nav>

          <h1 id="help-title" class="institutional__title">
            Central de <span class="institutional__title-accent">ajuda</span>
          </h1>

          <p class="institutional__lead">
            Como podemos ajudar? Escolha um assunto abaixo ou use a busca para
            encontrar respostas sobre compras, pagamento, entrega e muito mais.
          </p>

          <div class="help-search" role="search" aria-label="Buscar tópicos de ajuda">
            <label class="sr-only" for="help-search-input">Buscar tópicos de ajuda</label>
            <input
              type="search"
              id="help-search-input"
              class="help-search__input"
              placeholder="Por exemplo: entrega, troca, boleto..."
              autocomplete="off"
            >
            <button type="button" class="btn btn--primary" id="help-search-btn">Buscar</button>
          </div>

          <p class="sr-only" role="status" aria-live="polite" id="help-search-status"></p>

        </div>

        <section class="help-section" aria-labelledby="help-categories-title">
          <h2 id="help-categories-title" class="help-section__title">Assuntos mais procurados</h2>

          <div class="alert alert--info">
            <p>Se preferir, fale diretamente com nosso time pela página de <a href="contato.php">contato</a>.</p>
          </div>

          <div class="help-grid">

            <a href="faq.php#pedidos" class="help-card help-card--link" data-help-card>
              <span class="help-card__icon" aria-hidden="true">🛒</span>
              <span class="help-card__title">Compras</span>
              <span class="help-card__desc">
                Como fazer um pedido, meios de pagamento e como acompanhar a compra.
              </span>
              <span class="help-card__go">Ver tópicos →</span>
            </a>

            <a href="faq.php#produtos" class="help-card help-card--link" data-help-card>
              <span class="help-card__icon" aria-hidden="true">💻</span>
              <span class="help-card__title">Produtos</span>
              <span class="help-card__desc">
                Garantia, especificações, disponibilidade e como escolher o produto ideal.
              </span>
              <span class="help-card__go">Ver tópicos →</span>
            </a>

            <a href="faq.php#pagamentos" class="help-card help-card--link" data-help-card>
              <span class="help-card__icon" aria-hidden="true">💳</span>
              <span class="help-card__title">Pagamento</span>
              <span class="help-card__desc">
                Cartão de crédito, Pix, boleto e como receber a nota fiscal.
              </span>
              <span class="help-card__go">Ver tópicos →</span>
            </a>

            <a href="faq.php#entrega" class="help-card help-card--link" data-help-card>
              <span class="help-card__icon" aria-hidden="true">🚚</span>
              <span class="help-card__title">Entrega</span>
              <span class="help-card__desc">
                Prazos, rastreamento, endereço de entrega e recebimento do pedido.
              </span>
              <span class="help-card__go">Ver tópicos →</span>
            </a>

            <a href="faq.php#trocas-devolucoes" class="help-card help-card--link" data-help-card>
              <span class="help-card__icon" aria-hidden="true">🔄</span>
              <span class="help-card__title">Trocas e devoluções</span>
              <span class="help-card__desc">
                Prazo para desistência, produtos com defeito e como solicitar a troca.
              </span>
              <span class="help-card__go">Ver tópicos →</span>
            </a>

            <a href="faq.php#conta" class="help-card help-card--link" data-help-card>
              <span class="help-card__icon" aria-hidden="true">👤</span>
              <span class="help-card__title">Conta</span>
              <span class="help-card__desc">
                Criar conta, alterar dados cadastrais e recuperar o acesso.
              </span>
              <span class="help-card__go">Ver tópicos →</span>
            </a>

          </div>
        </section>

        <section class="help-section" aria-labelledby="help-links-title">
          <h2 id="help-links-title" class="help-section__title">Links úteis</h2>

          <ul class="help-list">
            <li class="help-list__item">
              <a href="faq.php" class="help-list__link">
                Perguntas frequentes <span aria-hidden="true">→</span>
              </a>
            </li>
            <li class="help-list__item">
              <a href="faq.php#pagamentos" class="help-list__link">
                Formas de pagamento aceitas <span aria-hidden="true">→</span>
              </a>
            </li>
            <li class="help-list__item">
              <a href="faq.php#entrega" class="help-list__link">
                Prazos e formas de entrega <span aria-hidden="true">→</span>
              </a>
            </li>
            <li class="help-list__item">
              <a href="faq.php#trocas-devolucoes" class="help-list__link">
                Política de trocas e devoluções <span aria-hidden="true">→</span>
              </a>
            </li>
            <li class="help-list__item">
              <a href="contato.php" class="help-list__link">
                Falar com a Nexus Tech <span aria-hidden="true">→</span>
              </a>
            </li>
          </ul>
        </section>

      </div>
    </section>
  </main>

<?php require __DIR__ . '/../includes/footer.php'; ?>
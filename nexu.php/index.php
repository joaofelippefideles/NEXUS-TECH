<?php
/**
 * NEXUS TECH (versão PHP) — Página inicial
 */

declare(strict_types=1);

$root = '';
$active = 'home';
$pageTitle = 'Nexus Tech — Tecnologia que conecta você ao futuro';
$pageDesc = 'Nexus Tech: loja online de tecnologia e informática. Notebooks, monitores, teclados, mouses, headsets, celulares, games e acessórios com os melhores preços.';
$bodyPage = 'home';

require_once __DIR__ . '/includes/functions.php';
require_once __DIR__ . '/includes/repository.php';
require_once __DIR__ . '/includes/components.php';

$categories = nx_categories();
$featured = nx_products_featured(4);
$bestsellers = nx_products_bestsellers(4);

$icons = [
    'notebooks' => '💻',
    'monitores' => '🖥️',
    'teclados' => '⌨️',
    'mouses' => '🖱️',
    'headsets' => '🎧',
    'celulares' => '📱',
    'games' => '🎮',
    'acessorios' => '🔌',
    'audio' => '🔊',
    'tablets' => '📟',
];

require __DIR__ . '/includes/header.php';
?>
<main>

  <?= nx_render_flash() ?>

  <section class="hero" aria-labelledby="hero-title">
    <div class="container hero__grid">
      <div class="hero__content">
        <p class="hero__eyebrow">Nexus Tech</p>
        <h1 id="hero-title" class="hero__title">
          Tecnologia que conecta
          <span class="hero__title-highlight">você ao futuro</span>
        </h1>
        <p class="hero__subtitle">
          Os melhores produtos para o seu setup, trabalho e entretenimento — com os melhores preços do mercado.
        </p>
        <a href="pages/produtos.php" class="btn btn--primary btn--lg hero__cta">Ver produtos</a>
      </div>
      <div class="hero__media" aria-hidden="true">
        <div class="hero__device"></div>
      </div>
    </div>
  </section>

  <section class="categories" aria-labelledby="categories-title">
    <div class="container">
      <h2 id="categories-title" class="section-title">Encontre o que você precisa</h2>
      <ul class="categories__list">
        <?php foreach ($categories as $category): ?>
          <li>
            <a href="pages/produtos.php?category=<?= e(urlencode($category['slug'])) ?>" class="categories__card">
              <span class="categories__icon" aria-hidden="true"><?= $icons[$category['slug']] ?? '📦' ?></span>
              <?= e($category['name']) ?>
            </a>
          </li>
        <?php endforeach; ?>
      </ul>
    </div>
  </section>

  <section class="products-section" aria-labelledby="featured-title">
    <div class="container">
      <h2 id="featured-title" class="section-title">Produtos em destaque</h2>
      <div class="products-grid">
        <?= nx_product_grid($featured, '') ?>
      </div>
    </div>
  </section>

  <section class="container offers" id="ofertas" aria-labelledby="offers-title">
    <div>
      <p class="offers__eyebrow">Ofertas da semana</p>
      <h2 id="offers-title" class="offers__title">Até 30% OFF em produtos selecionados</h2>
      <p class="offers__text">Aproveite descontos exclusivos em itens escolhidos a dedo.</p>
    </div>
    <a href="pages/produtos.php?sort=price-asc" class="btn btn--lg offers__cta">Conferir ofertas</a>
  </section>

  <section class="products-section products-section--alt" aria-labelledby="bestsellers-title">
    <div class="container">
      <h2 id="bestsellers-title" class="section-title">Mais vendidos</h2>
      <div class="products-grid">
        <?= nx_product_grid($bestsellers, '') ?>
      </div>
    </div>
  </section>

  <section class="newsletter" aria-labelledby="newsletter-title">
    <div class="container newsletter__inner">
      <h2 id="newsletter-title" class="newsletter__title">Fique por dentro das novidades</h2>
      <p class="newsletter__text">
        Cadastre-se e receba em primeira mão ofertas, lançamentos e conteúdos exclusivos da Nexus Tech.
      </p>
      <form class="newsletter__form" id="newsletter-form">
        <label class="sr-only" for="newsletter-email">Seu melhor e-mail</label>
        <input
          type="email"
          id="newsletter-email"
          class="newsletter__input"
          placeholder="Seu melhor e-mail"
          autocomplete="email"
          required
        >
        <button type="submit" class="btn btn--primary">Assinar</button>
      </form>
      <p class="alert" id="newsletter-feedback" role="status" aria-live="polite" hidden></p>
    </div>
  </section>

</main>
<?php require __DIR__ . '/includes/footer.php'; ?>

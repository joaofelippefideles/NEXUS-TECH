<?php
/**
 * NEXUS TECH (versão PHP) — Detalhe do produto
 */

declare(strict_types=1);

$root = '../';
$active = 'produtos';
$bodyPage = 'product';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

$slug = trim(nx_get('slug'));
$product = $slug !== '' ? nx_product_by_slug($slug) : null;

if ($product === null) {
    http_response_code(404);
    $pageTitle = 'Produto não encontrado — Nexus Tech';
    $pageDesc = 'O produto que você procura não existe ou não está mais disponível.';

    require __DIR__ . '/../includes/header.php';
    ?>
    <main>
      <section class="product" aria-label="Produto não encontrado">
        <div class="container">
          <div class="product-empty" role="status">
            <p class="product-empty__title">Produto não encontrado</p>
            <p class="product-empty__text">O produto que você procura não existe ou não está mais disponível.</p>
            <a href="produtos.php" class="btn btn--primary">Voltar ao catálogo</a>
          </div>
        </div>
      </section>
    </main>
    <?php
    require __DIR__ . '/../includes/footer.php';
    exit;
}

$pageTitle = $product['name'] . ' — Nexus Tech';
$pageDesc = mb_substr((string) $product['description'], 0, 155);

$stock = (int) $product['stock'];
$related = nx_products_related((int) $product['category_id'], (int) $product['id'], 4);
$discount = nx_discount_percent($product);

require __DIR__ . '/../includes/header.php';
?>
<main>
  <section class="product" aria-label="Detalhes do produto">
    <div class="container">

      <?= nx_render_flash() ?>

      <nav class="breadcrumb" aria-label="Trilha de navegação">
        <ol class="breadcrumb__list">
          <li class="breadcrumb__item">
            <a href="../index.php" class="breadcrumb__link">Home</a>
            <span class="breadcrumb__separator" aria-hidden="true">/</span>
          </li>
          <li class="breadcrumb__item">
            <a href="produtos.php" class="breadcrumb__link">Produtos</a>
            <span class="breadcrumb__separator" aria-hidden="true">/</span>
          </li>
          <li class="breadcrumb__item">
            <a href="produtos.php?category=<?= e(urlencode((string) $product['category_slug'])) ?>" class="breadcrumb__link"><?= e((string) $product['category']) ?></a>
            <span class="breadcrumb__separator" aria-hidden="true">/</span>
          </li>
          <li class="breadcrumb__item">
            <span class="breadcrumb__current" aria-current="page"><?= e((string) $product['name']) ?></span>
          </li>
        </ol>
      </nav>

      <h1 class="product__title" id="product-title" tabindex="-1"><?= e((string) $product['name']) ?></h1>

      <div class="product__layout">

        <div class="product-gallery">
          <div class="product-gallery__thumbs" aria-label="Miniaturas do produto">
            <?php for ($i = 0; $i < 3; $i++): ?>
              <button type="button" class="product-gallery__thumb<?= $i === 0 ? ' is-active' : '' ?>" aria-pressed="<?= $i === 0 ? 'true' : 'false' ?>" aria-label="Vista <?= $i + 1 ?>">
                <?= nx_placeholder_svg((int) $product['id'], nx_product_initial($product), $i) ?>
              </button>
            <?php endfor; ?>
          </div>
          <div class="product-gallery__main" role="group" aria-label="Imagem principal de <?= e((string) $product['name']) ?>" tabindex="0">
            <?= nx_placeholder_svg((int) $product['id'], nx_product_initial($product), 0) ?>
            <span class="product-gallery__status" aria-live="polite">Frente — 1 de 3</span>
          </div>
        </div>

        <div class="product-info" aria-labelledby="product-title">
          <span class="product-info__brand"><?= e((string) $product['brand']) ?></span>

          <?php if (nx_product_badges($product) !== []): ?>
            <div class="product-info__badges">
              <?php foreach (nx_product_badges($product) as $badge): ?>
                <span class="badge badge--<?= e($badge['kind']) ?>"><?= e($badge['text']) ?></span>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>

          <div class="product-info__rating">
            <span class="rating__stars" aria-hidden="true"><?= nx_stars((float) $product['rating']) ?></span>
            <span class="product-info__rating-value"><?= e(number_format((float) $product['rating'], 1, ',', '')) ?></span>
            <span class="product-info__rating-count">(<?= (int) $product['rating_count'] ?> avaliações)</span>
          </div>

          <div class="product-info__price">
            <?php if (!empty($product['old_price_cents'])): ?>
              <span class="product-info__price-old"><?= e(nx_money((int) $product['old_price_cents'])) ?></span>
            <?php endif; ?>
            <span class="product-info__price-current"><?= e(nx_money((int) $product['price_cents'])) ?></span>
            <?php if ($discount > 0): ?>
              <span class="product-info__savings">Economize <?= $discount ?>%</span>
            <?php endif; ?>
          </div>

          <p class="product-info__stock <?= $stock > 0 ? 'product-info__stock--ok' : 'product-info__stock--out' ?>">
            <?= $stock > 0 ? 'Em estoque' : 'Esgotado' ?>
          </p>

          <p class="product-info__description"><?= e((string) $product['description']) ?></p>

          <div class="product-buy">
            <form action="carrinho.php" method="post" class="product-buy__form">
              <?= nx_csrf_field() ?>
              <input type="hidden" name="action" value="add">
              <input type="hidden" name="product_id" value="<?= (int) $product['id'] ?>">

              <div class="product-buy__qty">
                <label class="product-buy__qty-label" for="qty-input">Quantidade</label>
                <div class="qty-stepper">
                  <button type="button" class="qty-stepper__btn" data-step="-1" aria-label="Diminuir quantidade">−</button>
                  <input
                    type="number"
                    id="qty-input"
                    name="quantity"
                    class="qty-stepper__input"
                    min="1"
                    max="<?= max(1, $stock) ?>"
                    value="1"
                    <?= $stock <= 0 ? 'disabled' : '' ?>
                  >
                  <button type="button" class="qty-stepper__btn" data-step="1" aria-label="Aumentar quantidade">+</button>
                </div>
                <p class="product-buy__hint">
                  <?= $stock > 0 ? 'Máximo ' . $stock . ' unidade' . ($stock === 1 ? '' : 's') . ' por pedido' : 'Produto esgotado' ?>
                </p>
              </div>

              <div class="product-buy__actions">
                <button type="submit" class="btn btn--primary product-buy__cart-btn" <?= $stock <= 0 ? 'disabled' : '' ?>>
                  Adicionar ao carrinho
                </button>
                <a href="carrinho.php" class="product-buy__fav">Ver carrinho</a>
              </div>
            </form>
          </div>
        </div>
      </div>

      <section class="product-specs" aria-labelledby="specs-title">
        <h2 class="product-specs__title" id="specs-title">Especificações</h2>
        <dl class="product-specs__table">
          <?php foreach ($product['specs'] as $spec): ?>
            <div class="product-specs__row">
              <dt class="product-specs__label"><?= e((string) $spec['label']) ?></dt>
              <dd class="product-specs__value"><?= e((string) $spec['value']) ?></dd>
            </div>
          <?php endforeach; ?>
        </dl>
      </section>

      <?php if ($related !== []): ?>
        <section class="product-related" aria-labelledby="related-title">
          <h2 class="product-related__title" id="related-title">Produtos relacionados</h2>
          <div class="product-related__grid">
            <?= nx_product_grid($related, '../') ?>
          </div>
        </section>
      <?php endif; ?>

    </div>
  </section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>

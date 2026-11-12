<?php
/**
 * NEXUS TECH (versão PHP) — Carrinho de compras
 */

declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Carrinho — Nexus Tech';
$pageDesc = 'Revise os itens do seu carrinho antes de finalizar a compra na Nexus Tech.';
$bodyPage = 'cart';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/cart.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();
    $action = (string) ($_POST['action'] ?? '');
    $productId = (int) ($_POST['product_id'] ?? 0);

    if ($action === 'add' && $productId > 0) {
        $product = nx_product_find($productId);
        if ($product === null) {
            nx_flash_set('error', 'Produto indisponível.');
        } else {
            $requested = max(1, (int) ($_POST['quantity'] ?? 1));
            $stock = (int) $product['stock'];
            $current = nx_cart()[$productId] ?? 0;
            $newQty = min($stock, $current + $requested);

            if ($stock <= 0) {
                nx_flash_set('warning', 'Este produto está esgotado.');
            } elseif ($newQty < $current + $requested) {
                nx_cart_set($productId, $newQty);
                nx_flash_set('warning', 'Quantidade ajustada ao estoque disponível (' . $stock . ').');
            } else {
                nx_cart_set($productId, $newQty);
                nx_flash_set('success', 'Produto adicionado ao carrinho.');
            }
        }
        nx_redirect('carrinho.php');
    }

    if ($action === 'set' && $productId > 0) {
        nx_cart_set($productId, (int) ($_POST['quantity'] ?? 0));
        nx_redirect('carrinho.php');
    }

    if ($action === 'remove' && $productId > 0) {
        nx_cart_remove($productId);
        nx_flash_set('info', 'Item removido do carrinho.');
        nx_redirect('carrinho.php');
    }

    if ($action === 'clear') {
        nx_cart_clear();
        nx_flash_set('info', 'Carrinho esvaziado.');
        nx_redirect('carrinho.php');
    }

    nx_redirect('carrinho.php');
}

$items = nx_cart_items();
$subtotal = nx_cart_subtotal($items);
$shipping = nx_shipping_cents('standard', $subtotal);
$total = $subtotal + $shipping;
$count = nx_cart_count();
$freeShippingMin = (int) nx_config()['service']['free_shipping_min_cents'];
$missingForFree = max(0, $freeShippingMin - $subtotal);

require __DIR__ . '/../includes/header.php';
?>
<main>
  <section class="cart" aria-labelledby="cart-title">
    <div class="container">

      <div class="cart__header">
        <nav class="breadcrumb" aria-label="Trilha de navegação">
          <ol class="breadcrumb__list">
            <li class="breadcrumb__item">
              <a href="../index.php" class="breadcrumb__link">Home</a>
              <span class="breadcrumb__separator" aria-hidden="true">/</span>
            </li>
            <li class="breadcrumb__item">
              <span class="breadcrumb__current" aria-current="page">Carrinho</span>
            </li>
          </ol>
        </nav>

        <h1 id="cart-title" class="cart__title" tabindex="-1">
          Seu <span class="cart__title-accent">carrinho</span>
        </h1>

        <p class="cart__note" aria-live="polite">
          <?= $count ?> item<?= $count === 1 ? '' : 's' ?> no carrinho
        </p>
      </div>

      <?= nx_render_flash() ?>

      <?php if ($items === []): ?>
        <div class="cart-empty">
          <p class="cart-empty__title">Seu carrinho está vazio</p>
          <p class="cart-empty__text">Adicione produtos ao carrinho para continuar.</p>
          <div class="cart-empty__actions">
            <a href="produtos.php" class="btn btn--primary">Continuar comprando</a>
            <a href="../index.php" class="btn btn--ghost">Página inicial</a>
          </div>
        </div>
      <?php else: ?>
        <div class="cart__layout">

          <div class="cart-items">
            <?php foreach ($items as $item): ?>
              <article class="cart-item" aria-label="<?= e($item['name']) ?>">
                <a href="produto.php?slug=<?= e(urlencode($item['slug'])) ?>" class="cart-item__media" aria-label="Ver <?= e($item['name']) ?>">
                  <?= nx_placeholder_svg((int) $item['id'], mb_substr($item['name'], 0, 1), 0, 'cart-item__img') ?>
                </a>

                <div class="cart-item__info">
                  <span class="cart-item__brand"><?= e($item['brand']) ?></span>
                  <a href="produto.php?slug=<?= e(urlencode($item['slug'])) ?>" class="cart-item__name"><?= e($item['name']) ?></a>
                  <p class="cart-item__unit">Unidade: <?= e(nx_money((int) $item['price_cents'])) ?></p>
                  <p class="cart-item__hint">
                    <?php if (!$item['available']): ?>
                      Produto indisponível no momento
                    <?php elseif ((int) $item['quantity'] >= (int) $item['stock']): ?>
                      Máximo em estoque: <?= (int) $item['stock'] ?> unidade<?= (int) $item['stock'] === 1 ? '' : 's' ?>
                    <?php else: ?>
                      Restam <?= (int) $item['stock'] ?> unidade<?= (int) $item['stock'] === 1 ? '' : 's' ?> em estoque
                    <?php endif; ?>
                  </p>
                </div>

                <div class="cart-item__controls">
                  <?php if ($item['available']): ?>
                    <form action="carrinho.php" method="post" class="qty-stepper">
                      <?= nx_csrf_field() ?>
                      <input type="hidden" name="action" value="set">
                      <input type="hidden" name="product_id" value="<?= (int) $item['id'] ?>">
                      <button type="button" class="qty-stepper__btn" data-step="-1" aria-label="Diminuir quantidade de <?= e($item['name']) ?>" <?= (int) $item['quantity'] <= 1 ? 'disabled' : '' ?>>−</button>
                      <input
                        type="number"
                        name="quantity"
                        class="qty-stepper__input"
                        min="1"
                        max="<?= (int) $item['stock'] ?>"
                        value="<?= (int) $item['quantity'] ?>"
                        aria-label="Quantidade de <?= e($item['name']) ?>"
                        data-autosubmit
                      >
                      <button type="button" class="qty-stepper__btn" data-step="1" aria-label="Aumentar quantidade de <?= e($item['name']) ?>" <?= (int) $item['quantity'] >= (int) $item['stock'] ? 'disabled' : '' ?>>+</button>
                      <noscript><button type="submit" class="btn btn--outline btn--sm">Atualizar</button></noscript>
                    </form>
                  <?php endif; ?>

                  <div class="cart-item__subtotal" aria-label="Subtotal de <?= e($item['name']) ?>">
                    <span><?= e(nx_money((int) $item['subtotal_cents'])) ?></span>
                  </div>

                  <form action="carrinho.php" method="post">
                    <?= nx_csrf_field() ?>
                    <input type="hidden" name="action" value="remove">
                    <input type="hidden" name="product_id" value="<?= (int) $item['id'] ?>">
                    <button type="submit" class="cart-item__remove" aria-label="Remover <?= e($item['name']) ?> do carrinho">Remover</button>
                  </form>
                </div>
              </article>
            <?php endforeach; ?>

            <div class="cart-summary__actions">
              <a href="produtos.php" class="btn btn--outline btn--block">Continuar comprando</a>
              <form action="carrinho.php" method="post">
                <?= nx_csrf_field() ?>
                <input type="hidden" name="action" value="clear">
                <button type="submit" class="btn btn--ghost btn--block" data-confirm="Esvaziar todo o carrinho?">Esvaziar carrinho</button>
              </form>
            </div>
          </div>

          <aside class="cart-summary" aria-label="Resumo do pedido">
            <h2 class="cart-summary__title">Resumo do pedido</h2>

            <div class="cart-summary__row">
              <span class="cart-summary__label">Subtotal</span>
              <span class="cart-summary__value"><?= e(nx_money($subtotal)) ?></span>
            </div>

            <div class="cart-summary__row">
              <span class="cart-summary__label">Frete (padrão)</span>
              <span class="cart-summary__value<?= $shipping === 0 ? ' cart-summary__value--free' : '' ?>">
                <?= $shipping === 0 ? 'Grátis' : e(nx_money($shipping)) ?>
              </span>
            </div>

            <?php if ($missingForFree > 0): ?>
              <p class="cart-summary__tip">Faltam <?= e(nx_money($missingForFree)) ?> para ganhar frete grátis.</p>
            <?php else: ?>
              <p class="cart-summary__tip">Você ganhou frete grátis nesta compra!</p>
            <?php endif; ?>

            <div class="cart-summary__row cart-summary__row--total">
              <span class="cart-summary__label">Total</span>
              <span class="cart-summary__value cart-summary__value--total"><?= e(nx_money($total)) ?></span>
            </div>

            <div class="cart-summary__actions">
              <a href="checkout.php" class="btn btn--primary btn--block">Ir para checkout</a>
              <a href="produtos.php" class="btn btn--outline btn--block">Continuar comprando</a>
            </div>
          </aside>

        </div>
      <?php endif; ?>
    </div>
  </section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>

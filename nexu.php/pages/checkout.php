<?php
/**
 * NEXUS TECH (versão PHP) — Checkout
 */

declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Checkout — Nexus Tech';
$pageDesc = 'Finalize seu pedido na Nexus Tech com entrega e pagamento simulados.';
$bodyPage = 'checkout';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/cart.php';
require_once __DIR__ . '/../includes/validation.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

$user = nx_current_user();
$items = nx_cart_items();
$subtotal = nx_cart_subtotal($items);

$standardShipping = nx_shipping_cents('standard', $subtotal);
$expressShipping = nx_shipping_cents('express', $subtotal);

$missingForFree = max(0, (int) nx_config()['service']['free_shipping_min_cents'] - $subtotal);

$states = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

$errors = [];
$old = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $user !== null) {
    nx_require_csrf();
    $validation = nx_validate_checkout($_POST);
    $errors = $validation['errors'];
    $old = $validation['data'];

    if ($validation['ok']) {
        try {
            $order = nx_create_order($user, $validation['data'], $items);
            nx_cart_clear();
            nx_flash_set('success', 'Pedido ' . $order['code'] . ' realizado com sucesso! Acompanhe em "Meus pedidos".');
            nx_redirect('perfil.php#meus-pedidos');
        } catch (RuntimeException $exception) {
            $errors['general'] = $exception->getMessage();
        } catch (Throwable $exception) {
            nx_log('Erro ao criar pedido: ' . $exception->getMessage());
            $errors['general'] = 'Não foi possível finalizar o pedido. Tente novamente.';
        }
    }
}

$value = static function (string $key, string $default = '') use ($old, $user): string {
    if (array_key_exists($key, $old)) {
        return (string) ($old[$key] ?? '');
    }
    if ($user !== null && $key === 'name') {
        return (string) $user['name'];
    }
    if ($user !== null && $key === 'email') {
        return (string) $user['email'];
    }

    return $default;
};

require __DIR__ . '/../includes/header.php';
?>
<main>
  <section class="checkout" aria-labelledby="checkout-title">
    <div class="container">

      <div class="checkout__header">
        <nav class="breadcrumb" aria-label="Trilha de navegação">
          <ol class="breadcrumb__list">
            <li class="breadcrumb__item">
              <a href="../index.php" class="breadcrumb__link">Home</a>
              <span class="breadcrumb__separator" aria-hidden="true">/</span>
            </li>
            <li class="breadcrumb__item">
              <a href="carrinho.php" class="breadcrumb__link">Carrinho</a>
              <span class="breadcrumb__separator" aria-hidden="true">/</span>
            </li>
            <li class="breadcrumb__item">
              <span class="breadcrumb__current" aria-current="page">Checkout</span>
            </li>
          </ol>
        </nav>

        <h1 id="checkout-title" class="checkout__title" tabindex="-1">Finalizar compra</h1>
        <p class="checkout__note">Revise os itens e preencha seus dados para concluir o pedido.</p>
      </div>

      <?= nx_render_flash() ?>
      <?= nx_render_errors($errors) ?>

      <?php if ($user === null): ?>
        <div class="alert alert--warning checkout-auth" role="status">
          <strong>Para finalizar o pedido, entre na sua conta.</strong>
          <p>Seu carrinho foi preservado. Após entrar, você poderá voltar e concluir a compra.</p>
          <div class="checkout-auth__actions">
            <a class="btn btn--primary" href="login.php?next=checkout.php">Entrar na minha conta</a>
            <a class="btn btn--ghost" href="carrinho.php">Voltar ao carrinho</a>
          </div>
        </div>
      <?php elseif ($items === []): ?>
        <div class="cart-empty">
          <p class="cart-empty__title">Seu carrinho está vazio.</p>
          <p class="cart-empty__text">Adicione produtos ao carrinho antes de finalizar seu pedido.</p>
          <div class="cart-empty__actions">
            <a href="produtos.php" class="btn btn--primary">Voltar para produtos</a>
            <a href="carrinho.php" class="btn btn--ghost">Voltar ao carrinho</a>
          </div>
        </div>
      <?php else: ?>
        <div class="checkout-layout">

          <form class="checkout-form" action="checkout.php" method="post" novalidate>
            <?= nx_csrf_field() ?>

            <fieldset class="checkout-form__fieldset">
              <legend class="checkout-form__legend">Seus dados</legend>
              <div class="checkout-form__grid">
                <div class="checkout-form__field checkout-form__field--full">
                  <label class="checkout-form__label" for="co-name">Nome completo</label>
                  <input class="checkout-form__input" type="text" id="co-name" name="name" autocomplete="name" required placeholder="Seu nome completo" value="<?= e($value('name')) ?>">
                  <?php if (isset($errors['name'])): ?><p class="checkout-form__error"><?= e($errors['name']) ?></p><?php endif; ?>
                </div>
                <div class="checkout-form__field">
                  <label class="checkout-form__label" for="co-email">E-mail</label>
                  <input class="checkout-form__input" type="email" id="co-email" name="email" autocomplete="email" required placeholder="voce@exemplo.com" value="<?= e($value('email')) ?>">
                  <?php if (isset($errors['email'])): ?><p class="checkout-form__error"><?= e($errors['email']) ?></p><?php endif; ?>
                </div>
              </div>
            </fieldset>

            <fieldset class="checkout-form__fieldset">
              <legend class="checkout-form__legend">Endereço de entrega</legend>
              <div class="checkout-form__grid">
                <div class="checkout-form__field">
                  <label class="checkout-form__label" for="co-cep">CEP</label>
                  <input class="checkout-form__input" type="text" id="co-cep" name="cep" autocomplete="postal-code" inputmode="numeric" required placeholder="00000-000" value="<?= e($value('cep')) ?>">
                  <?php if (isset($errors['cep'])): ?><p class="checkout-form__error"><?= e($errors['cep']) ?></p><?php endif; ?>
                </div>
                <div class="checkout-form__field">
                  <label class="checkout-form__label" for="co-complement">Complemento <span class="checkout-form__optional">(opcional)</span></label>
                  <input class="checkout-form__input" type="text" id="co-complement" name="complement" placeholder="Apto, bloco..." value="<?= e($value('complement')) ?>">
                </div>
                <div class="checkout-form__field checkout-form__field--full">
                  <label class="checkout-form__label" for="co-street">Rua</label>
                  <input class="checkout-form__input" type="text" id="co-street" name="street" autocomplete="address-line1" required placeholder="Rua, avenida ou logradouro" value="<?= e($value('street')) ?>">
                  <?php if (isset($errors['street'])): ?><p class="checkout-form__error"><?= e($errors['street']) ?></p><?php endif; ?>
                </div>
                <div class="checkout-form__field">
                  <label class="checkout-form__label" for="co-number">Número</label>
                  <input class="checkout-form__input" type="text" id="co-number" name="number" required placeholder="Número" value="<?= e($value('number')) ?>">
                  <?php if (isset($errors['number'])): ?><p class="checkout-form__error"><?= e($errors['number']) ?></p><?php endif; ?>
                </div>
                <div class="checkout-form__field">
                  <label class="checkout-form__label" for="co-neighborhood">Bairro</label>
                  <input class="checkout-form__input" type="text" id="co-neighborhood" name="neighborhood" required placeholder="Bairro" value="<?= e($value('neighborhood')) ?>">
                  <?php if (isset($errors['neighborhood'])): ?><p class="checkout-form__error"><?= e($errors['neighborhood']) ?></p><?php endif; ?>
                </div>
                <div class="checkout-form__field">
                  <label class="checkout-form__label" for="co-city">Cidade</label>
                  <input class="checkout-form__input" type="text" id="co-city" name="city" required placeholder="Cidade" value="<?= e($value('city')) ?>">
                  <?php if (isset($errors['city'])): ?><p class="checkout-form__error"><?= e($errors['city']) ?></p><?php endif; ?>
                </div>
                <div class="checkout-form__field">
                  <label class="checkout-form__label" for="co-state">Estado</label>
                  <select class="checkout-form__select" id="co-state" name="state" required>
                    <option value="">Selecione a UF</option>
                    <?php foreach ($states as $uf): ?>
                      <option value="<?= e($uf) ?>" <?= $value('state') === $uf ? 'selected' : '' ?>><?= e($uf) ?></option>
                    <?php endforeach; ?>
                  </select>
                  <?php if (isset($errors['state'])): ?><p class="checkout-form__error"><?= e($errors['state']) ?></p><?php endif; ?>
                </div>
              </div>
            </fieldset>

            <fieldset class="checkout-form__fieldset">
              <legend class="checkout-form__legend">Entrega</legend>
              <div class="checkout-form__radio-grid">
                <label class="checkout-opt">
                  <input class="checkout-opt__input" type="radio" name="delivery" value="standard" <?= $value('delivery', 'standard') === 'standard' ? 'checked' : '' ?>>
                  <span class="checkout-opt__body">
                    <span class="checkout-opt__name">Entrega padrão</span>
                    <span class="checkout-opt__meta">5–8 dias úteis</span>
                    <span class="checkout-opt__price"><?= $standardShipping === 0 ? 'Grátis' : e(nx_money($standardShipping)) ?></span>
                  </span>
                </label>
                <label class="checkout-opt">
                  <input class="checkout-opt__input" type="radio" name="delivery" value="express" <?= $value('delivery') === 'express' ? 'checked' : '' ?>>
                  <span class="checkout-opt__body">
                    <span class="checkout-opt__name">Entrega expressa</span>
                    <span class="checkout-opt__meta">2–4 dias úteis</span>
                    <span class="checkout-opt__price"><?= e(nx_money($expressShipping)) ?></span>
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset class="checkout-form__fieldset">
              <legend class="checkout-form__legend">Forma de pagamento</legend>
              <div class="checkout-form__radio-grid">
                <label class="checkout-opt">
                  <input class="checkout-opt__input" type="radio" name="payment" value="credit" <?= $value('payment', 'credit') === 'credit' ? 'checked' : '' ?>>
                  <span class="checkout-opt__body">
                    <span class="checkout-opt__name">Cartão de crédito</span>
                    <span class="checkout-opt__meta">À vista ou parcelado</span>
                  </span>
                </label>
                <label class="checkout-opt">
                  <input class="checkout-opt__input" type="radio" name="payment" value="pix" <?= $value('payment') === 'pix' ? 'checked' : '' ?>>
                  <span class="checkout-opt__body">
                    <span class="checkout-opt__name">PIX</span>
                    <span class="checkout-opt__meta">Pagamento instantâneo</span>
                  </span>
                </label>
                <label class="checkout-opt">
                  <input class="checkout-opt__input" type="radio" name="payment" value="boleto" <?= $value('payment') === 'boleto' ? 'checked' : '' ?>>
                  <span class="checkout-opt__body">
                    <span class="checkout-opt__name">Boleto bancário</span>
                    <span class="checkout-opt__meta">Vencimento em até 3 dias úteis</span>
                  </span>
                </label>
              </div>
              <div class="checkout-payment__note">
                <strong>Pagamento simulado</strong>
                <p>Nenhum pagamento real é processado. Os dados são usados apenas para registrar o pedido de demonstração.</p>
              </div>
            </fieldset>

            <div class="checkout-form__actions">
              <button type="submit" class="btn btn--primary btn--lg">Finalizar pedido</button>
              <p class="checkout-form__note">Pedido de demonstração — os dados são gravados no banco MySQL local.</p>
            </div>
          </form>

          <aside class="checkout-summary" aria-label="Resumo do pedido">
            <h2 class="checkout-summary__title">Resumo do pedido</h2>
            <ul class="checkout-summary__items">
              <?php foreach ($items as $item): ?>
                <li class="checkout-summary__item">
                  <span class="checkout-summary__item-name"><?= (int) $item['quantity'] ?> × <?= e($item['name']) ?></span>
                  <span class="checkout-summary__item-price"><?= e(nx_money((int) $item['subtotal_cents'])) ?></span>
                </li>
              <?php endforeach; ?>
            </ul>
            <dl class="checkout-summary__rows">
              <div class="checkout-summary__row">
                <dt>Subtotal</dt>
                <dd><?= e(nx_money($subtotal)) ?></dd>
              </div>
              <div class="checkout-summary__row">
                <dt>Frete</dt>
                <dd class="checkout-summary__freight">
                  <?= $standardShipping === 0 ? 'Grátis' : 'A partir de ' . e(nx_money($standardShipping)) ?>
                </dd>
              </div>
              <div class="checkout-summary__row checkout-summary__row--total">
                <dt>Total</dt>
                <dd class="checkout-summary__total-value"><?= e(nx_money($subtotal + $standardShipping)) ?></dd>
              </div>
            </dl>
            <?php if ($missingForFree > 0): ?>
              <p class="cart-summary__tip">Faltam <?= e(nx_money($missingForFree)) ?> para frete grátis na entrega padrão.</p>
            <?php endif; ?>
          </aside>

        </div>
      <?php endif; ?>

    </div>
  </section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>

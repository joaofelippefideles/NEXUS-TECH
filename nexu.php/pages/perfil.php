<?php
/**
 * NEXUS TECH (versão PHP) — Minha conta
 */

declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Minha conta — Nexus Tech';
$pageDesc = 'Gerencie seus dados, pedidos e preferências na Nexus Tech.';
$bodyPage = 'perfil';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/validation.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

$user = nx_require_login('perfil.php');
$userId = (int) $user['id'];

$profileErrors = [];
$passwordErrors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'logout') {
        nx_logout_user();
        nx_flash_set('info', 'Você saiu da sua conta.');
        nx_redirect('login.php');
    }

    if ($action === 'update_profile') {
        $validation = nx_validate_profile($_POST);
        $profileErrors = $validation['errors'];

        if ($validation['ok']) {
            try {
                nx_update_user_profile($userId, $validation['data']);
                nx_flash_set('success', 'Dados atualizados com sucesso.');
                nx_redirect('perfil.php#meus-dados');
            } catch (Throwable $exception) {
                $profileErrors['general'] = nx_is_duplicate($exception)
                    ? 'Este e-mail ou CPF já está em uso por outra conta.'
                    : 'Não foi possível salvar seus dados.';
            }
        }
    }

    if ($action === 'change_password') {
        $validation = nx_validate_password_change($_POST);
        $passwordErrors = $validation['errors'];

        if ($validation['ok']) {
            $hash = nx_user_password_hash($userId);
            if ($hash === null || !password_verify($validation['data']['currentPassword'], $hash)) {
                $passwordErrors['currentPassword'] = 'A senha atual está incorreta.';
            } else {
                nx_update_user_password($userId, $validation['data']['newPassword']);
                nx_flash_set('success', 'Senha alterada com sucesso.');
                nx_redirect('perfil.php#configuracoes');
            }
        }
    }
}

$user = nx_user_profile($userId) ?? $user;
$orders = nx_orders_for_user($userId);
$orderCount = count($orders);
$totalSpent = 0;
foreach ($orders as $order) {
    if ($order['status'] !== 'cancelled') {
        $totalSpent += (int) $order['total_cents'];
    }
}
$lastOrder = $orders[0] ?? null;

$fullName = trim((string) $user['name']);
$firstName = $fullName !== '' ? explode(' ', $fullName)[0] : 'cliente';

require __DIR__ . '/../includes/header.php';
?>
<main>
  <section class="profile" aria-labelledby="profile-title">
    <div class="container">

      <div class="profile__header">
        <nav class="breadcrumb" aria-label="Trilha de navegação">
          <ol class="breadcrumb__list">
            <li class="breadcrumb__item">
              <a href="../index.php" class="breadcrumb__link">Home</a>
              <span class="breadcrumb__separator" aria-hidden="true">/</span>
            </li>
            <li class="breadcrumb__item">
              <span class="breadcrumb__current" aria-current="page">Minha conta</span>
            </li>
          </ol>
        </nav>

        <h1 id="profile-title" class="profile__title">
          Minha <span class="profile__title-accent">conta</span>
        </h1>

        <p class="profile__lead">
          Olá, <strong><?= e($firstName) ?></strong>! Gerencie seus dados, pedidos e preferências.
        </p>
      </div>

      <?= nx_render_flash() ?>

      <div class="profile-layout">

        <nav class="profile-nav" aria-label="Menu da conta">
          <h2 class="profile-nav__title">Sua conta</h2>
          <ul class="profile-nav__list">
            <li><a class="profile-nav__link is-active" href="#visao-geral">Visão geral</a></li>
            <li><a class="profile-nav__link" href="#meus-dados">Meus dados</a></li>
            <li><a class="profile-nav__link" href="#meus-pedidos">Meus pedidos</a></li>
            <li><a class="profile-nav__link" href="#enderecos">Endereços</a></li>
            <li><a class="profile-nav__link" href="#configuracoes">Configurações</a></li>
          </ul>
        </nav>

        <div class="profile-content">

          <section class="profile-panel" id="visao-geral" aria-labelledby="overview-title">
            <h2 class="profile-panel__title" id="overview-title">Visão geral</h2>

            <div class="profile-cards">
              <article class="profile-card">
                <h3 class="profile-card__title">Pedidos</h3>
                <p class="profile-card__value"><?= $orderCount ?></p>
                <p class="profile-card__text">
                  <?= $orderCount === 0 ? 'Nenhum pedido registrado ainda.' : 'Pedidos realizados na sua conta.' ?>
                </p>
              </article>

              <article class="profile-card">
                <h3 class="profile-card__title">Total em compras</h3>
                <p class="profile-card__value"><?= e(nx_money($totalSpent)) ?></p>
                <p class="profile-card__text">Considerando pedidos não cancelados.</p>
              </article>

              <article class="profile-card">
                <h3 class="profile-card__title">Dados da conta</h3>
                <p class="profile-card__value"><?= e($user['cpf'] ?? '') !== '' ? 'Completos' : 'Pendentes' ?></p>
                <p class="profile-card__text">Mantenha seus dados atualizados.</p>
              </article>
            </div>
          </section>

          <section class="profile-panel" id="meus-dados" aria-labelledby="dados-title">
            <h2 class="profile-panel__title" id="dados-title">Meus dados</h2>

            <?= nx_render_errors($profileErrors) ?>

            <form class="contact-form" action="perfil.php" method="post" novalidate>
              <?= nx_csrf_field() ?>
              <input type="hidden" name="action" value="update_profile">

              <fieldset class="filters__group">
                <legend class="filters__legend">Dados pessoais</legend>

                <div class="contact-form__field">
                  <label class="contact-form__label" for="pf-name">Nome completo</label>
                  <input class="contact-form__input" type="text" id="pf-name" name="name" autocomplete="name" required value="<?= e((string) $user['name']) ?>">
                  <?php if (isset($profileErrors['name'])): ?><p class="contact-form__error"><?= e($profileErrors['name']) ?></p><?php endif; ?>
                </div>

                <div class="contact-form__field">
                  <label class="contact-form__label" for="pf-email">E-mail</label>
                  <input class="contact-form__input" type="email" id="pf-email" name="email" autocomplete="email" required value="<?= e((string) $user['email']) ?>">
                  <?php if (isset($profileErrors['email'])): ?><p class="contact-form__error"><?= e($profileErrors['email']) ?></p><?php endif; ?>
                </div>

                <div class="contact-form__field">
                  <label class="contact-form__label" for="pf-phone">Telefone (WhatsApp)</label>
                  <input class="contact-form__input" type="tel" id="pf-phone" name="phone" autocomplete="tel" required value="<?= e((string) ($user['phone'] ?? '')) ?>">
                  <?php if (isset($profileErrors['phone'])): ?><p class="contact-form__error"><?= e($profileErrors['phone']) ?></p><?php endif; ?>
                </div>

                <div class="contact-form__field">
                  <label class="contact-form__label" for="pf-cpf">CPF</label>
                  <input class="contact-form__input" type="text" id="pf-cpf" name="cpf" inputmode="numeric" maxlength="14" value="<?= e((string) ($user['cpf'] ?? '')) ?>">
                  <?php if (isset($profileErrors['cpf'])): ?><p class="contact-form__error"><?= e($profileErrors['cpf']) ?></p><?php endif; ?>
                </div>

                <div class="contact-form__actions">
                  <button type="submit" class="btn btn--primary">Salvar alterações</button>
                </div>
              </fieldset>
            </form>
          </section>

          <section class="profile-panel" id="meus-pedidos" aria-labelledby="pedidos-title">
            <h2 class="profile-panel__title" id="pedidos-title">Meus pedidos</h2>

            <?php if ($orders === []): ?>
              <div class="cart-empty">
                <h3 class="cart-empty__title">Você ainda não possui pedidos.</h3>
                <p class="cart-empty__text">Quando você finalizar uma compra, os detalhes aparecerão aqui.</p>
                <div class="cart-empty__actions">
                  <a href="produtos.php" class="btn btn--primary">Continuar comprando</a>
                </div>
              </div>
            <?php else: ?>
              <ul class="profile-orders">
                <?php foreach ($orders as $order): ?>
                  <li>
                    <article class="pedido">
                      <div class="pedido__head">
                        <p class="pedido__number"><strong>Pedido <?= e((string) $order['code']) ?></strong></p>
                        <span class="pedido__status"><?= e(nx_order_status_label((string) $order['status'])) ?></span>
                      </div>

                      <p class="pedido__meta">
                        <?= e(nx_datetime((string) $order['created_at'])) ?> ·
                        <?= (int) $order['item_count'] ?> item<?= (int) $order['item_count'] === 1 ? '' : 's' ?> ·
                        Total: <strong><?= e(nx_money((int) $order['total_cents'])) ?></strong>
                      </p>

                      <details class="pedido__toggle">
                        <summary class="btn btn--outline btn--sm">Ver detalhes</summary>

                        <div class="pedido-details">
                          <h4>Itens</h4>
                          <ul class="pedido-items">
                            <?php foreach ($order['items'] as $item): ?>
                              <li class="pedido-item">
                                <div class="pedido-item__main">
                                  <strong><?= e((string) $item['product_name']) ?></strong>
                                  <span class="pedido-item__meta"><?= (int) $item['quantity'] ?> × <?= e(nx_money((int) $item['unit_price_cents'])) ?></span>
                                </div>
                                <span class="pedido-item__total"><?= e(nx_money((int) $item['total_cents'])) ?></span>
                              </li>
                            <?php endforeach; ?>
                          </ul>

                          <h4>Entrega</h4>
                          <p class="pedido__meta">
                            <?= e((string) $order['delivery_label']) ?> —
                            <?= e((string) $order['delivery_name']) ?><br>
                            <?= e((string) $order['street']) ?>, <?= e((string) $order['number']) ?>
                            <?= $order['complement'] ? ' — ' . e((string) $order['complement']) : '' ?><br>
                            <?= e((string) $order['neighborhood']) ?> — <?= e((string) $order['city']) ?>/<?= e((string) $order['state']) ?> · CEP <?= e((string) $order['cep']) ?>
                          </p>

                          <h4>Pagamento</h4>
                          <p class="pedido__meta"><?= e((string) $order['payment_label']) ?></p>

                          <h4>Valores</h4>
                          <p class="pedido__meta">
                            Subtotal: <?= e(nx_money((int) $order['subtotal_cents'])) ?><br>
                            Frete: <?= (int) $order['shipping_cents'] === 0 ? 'Grátis' : e(nx_money((int) $order['shipping_cents'])) ?><br>
                            Total: <strong><?= e(nx_money((int) $order['total_cents'])) ?></strong>
                          </p>
                        </div>
                      </details>
                    </article>
                  </li>
                <?php endforeach; ?>
              </ul>
            <?php endif; ?>
          </section>

          <section class="profile-panel" id="enderecos" aria-labelledby="enderecos-title">
            <h2 class="profile-panel__title" id="enderecos-title">Endereços</h2>

            <?php if ($lastOrder === null): ?>
              <p class="profile-panel__text">Nenhum endereço salvo. O endereço do seu primeiro pedido aparecerá aqui.</p>
            <?php else: ?>
              <ul class="profile-addresses">
                <li class="profile-address">
                  <div class="profile-address__head">
                    <strong>Último endereço de entrega</strong>
                  </div>
                  <p class="profile-address__text">
                    <?= e((string) $lastOrder['street']) ?>, <?= e((string) $lastOrder['number']) ?>
                    <?= $lastOrder['complement'] ? ' — ' . e((string) $lastOrder['complement']) : '' ?><br>
                    <?= e((string) $lastOrder['neighborhood']) ?> — <?= e((string) $lastOrder['city']) ?>/<?= e((string) $lastOrder['state']) ?><br>
                    CEP <?= e((string) $lastOrder['cep']) ?>
                  </p>
                </li>
              </ul>
            <?php endif; ?>
          </section>

          <section class="profile-panel" id="configuracoes" aria-labelledby="config-title">
            <h2 class="profile-panel__title" id="config-title">Configurações</h2>

            <?= nx_render_errors($passwordErrors) ?>

            <form class="contact-form" action="perfil.php" method="post" novalidate>
              <?= nx_csrf_field() ?>
              <input type="hidden" name="action" value="change_password">

              <fieldset class="filters__group">
                <legend class="filters__legend">Alterar senha</legend>

                <div class="contact-form__field">
                  <label class="contact-form__label" for="pf-current-password">Senha atual</label>
                  <input class="contact-form__input" type="password" id="pf-current-password" name="currentPassword" autocomplete="current-password" required>
                  <?php if (isset($passwordErrors['currentPassword'])): ?><p class="contact-form__error"><?= e($passwordErrors['currentPassword']) ?></p><?php endif; ?>
                </div>

                <div class="contact-form__field">
                  <label class="contact-form__label" for="pf-new-password">Nova senha</label>
                  <input class="contact-form__input" type="password" id="pf-new-password" name="newPassword" autocomplete="new-password" required>
                  <?php if (isset($passwordErrors['newPassword'])): ?><p class="contact-form__error"><?= e($passwordErrors['newPassword']) ?></p><?php endif; ?>
                </div>

                <div class="contact-form__field">
                  <label class="contact-form__label" for="pf-new-password-confirm">Confirmar nova senha</label>
                  <input class="contact-form__input" type="password" id="pf-new-password-confirm" name="newPasswordConfirm" autocomplete="new-password" required>
                  <?php if (isset($passwordErrors['newPasswordConfirm'])): ?><p class="contact-form__error"><?= e($passwordErrors['newPasswordConfirm']) ?></p><?php endif; ?>
                </div>

                <div class="contact-form__actions">
                  <button type="submit" class="btn btn--primary">Alterar senha</button>
                </div>
              </fieldset>
            </form>

            <form action="perfil.php" method="post" class="profile-logout">
              <?= nx_csrf_field() ?>
              <input type="hidden" name="action" value="logout">
              <button type="submit" class="btn btn--ghost">Sair da conta</button>
            </form>
          </section>

        </div>
      </div>
    </div>
  </section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>

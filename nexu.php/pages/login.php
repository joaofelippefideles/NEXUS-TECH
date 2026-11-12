<?php
/**
 * NEXUS TECH (versão PHP) — Login do cliente
 */

declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Entrar — Nexus Tech';
$pageDesc = 'Acesse sua conta Nexus Tech para acompanhar pedidos, dados e preferências.';
$bodyPage = 'login';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/validation.php';
require_once __DIR__ . '/../includes/components.php';

$next = nx_get('next', 'perfil.php');
$allowedNext = ['perfil.php', 'checkout.php', 'carrinho.php', 'produtos.php'];
if (!in_array($next, $allowedNext, true)) {
    $next = 'perfil.php';
}

if (nx_current_user() !== null) {
    nx_redirect($next);
}

$errors = [];
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();

    if (nx_rate_limit_exceeded('login:' . ($_SERVER['REMOTE_ADDR'] ?? 'cli'), 10, 300)) {
        $errors['general'] = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    } else {
        $validation = nx_validate_login($_POST);
        $email = $validation['data']['email'];
        $errors = $validation['errors'];

        if ($validation['ok']) {
            $user = nx_authenticate_user($validation['data']['email'], $validation['data']['password']);

            if ($user === null) {
                $errors['general'] = 'E-mail ou senha incorretos.';
            } else {
                nx_login_user($user);
                nx_flash_set('success', 'Bem-vindo(a), ' . $user['name'] . '!');
                nx_redirect($next);
            }
        }
    }
}

require __DIR__ . '/../includes/header.php';
?>
<main>
  <section class="auth" aria-labelledby="auth-title">
    <div class="container">

      <div class="auth__header">
        <nav class="breadcrumb" aria-label="Trilha de navegação">
          <ol class="breadcrumb__list">
            <li class="breadcrumb__item">
              <a href="../index.php" class="breadcrumb__link">Home</a>
              <span class="breadcrumb__separator" aria-hidden="true">/</span>
            </li>
            <li class="breadcrumb__item">
              <span class="breadcrumb__current" aria-current="page">Entrar</span>
            </li>
          </ol>
        </nav>

        <h1 id="auth-title" class="auth__title">
          Entre na sua <span class="auth__title-accent">conta</span>
        </h1>

        <p class="auth__lead">
          Acesse sua conta Nexus Tech para gerenciar seus dados, favoritos e preferências em um só lugar.
        </p>

        <p class="auth-demo" role="note">
          Conta de teste: cliente@nexustech.com / Cliente@123
        </p>
      </div>

      <div class="auth__layout">
        <form class="auth__card contact-form" action="login.php<?= $next !== 'perfil.php' ? '?next=' . e(urlencode($next)) : '' ?>" method="post" novalidate>
          <?= nx_csrf_field() ?>

          <?= nx_render_flash() ?>
          <?= nx_render_errors($errors) ?>

          <fieldset class="auth__fieldset">
            <legend class="auth__legend">Acesso</legend>
            <div class="auth__grid">

              <div class="contact-form__field">
                <label class="contact-form__label" for="login-email">E-mail</label>
                <input
                  class="contact-form__input"
                  type="email"
                  id="login-email"
                  name="email"
                  autocomplete="email"
                  required
                  placeholder="voce@exemplo.com"
                  value="<?= e($email) ?>"
                >
                <?php if (isset($errors['email'])): ?><p class="contact-form__error"><?= e($errors['email']) ?></p><?php endif; ?>
              </div>

              <div class="contact-form__field">
                <label class="contact-form__label" for="login-password">Senha</label>
                <div class="auth__password-wrap">
                  <input
                    class="contact-form__input auth__password-input"
                    type="password"
                    id="login-password"
                    name="password"
                    autocomplete="current-password"
                    required
                    placeholder="Sua senha"
                  >
                  <button type="button" class="auth__password-toggle" data-toggle-password="login-password" aria-pressed="false">Mostrar</button>
                </div>
                <?php if (isset($errors['password'])): ?><p class="contact-form__error"><?= e($errors['password']) ?></p><?php endif; ?>
              </div>

            </div>
          </fieldset>

          <p class="auth__security-note">
            A senha é verificada no servidor com hash bcrypt e a sessão fica em cookie httpOnly.
          </p>

          <div class="contact-form__actions">
            <button type="submit" class="btn btn--primary btn--lg">Entrar</button>
            <a href="../index.php" class="btn btn--ghost">Voltar para a loja</a>
          </div>

          <p class="contact-form__note auth__login-note">
            Ainda não tem uma conta?
            <a href="cadastro.php">Criar uma conta</a>
          </p>
        </form>
      </div>

    </div>
  </section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>

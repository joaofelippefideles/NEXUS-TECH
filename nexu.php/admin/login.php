<?php
/**
 * NEXUS TECH (versão PHP) — Login do administrador
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/validation.php';

$root = '../';
$pageTitle = 'Login do Admin — Nexus Tech';

if (nx_current_admin() !== null) {
    nx_redirect('index.php');
}

$errors = [];
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();

    if (nx_rate_limit_exceeded('admin-login:' . ($_SERVER['REMOTE_ADDR'] ?? 'cli'), 8, 300)) {
        $errors['general'] = 'Muitas tentativas. Aguarde alguns minutos.';
    } else {
        $validation = nx_validate_login($_POST);
        $email = $validation['data']['email'];
        $errors = $validation['errors'];

        if ($validation['ok']) {
            $admin = nx_authenticate_admin($validation['data']['email'], $validation['data']['password']);
            if ($admin === null) {
                $errors['general'] = 'Credenciais de administrador inválidas.';
            } else {
                nx_login_admin($admin);
                nx_redirect('index.php');
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">

  <title><?= e($pageTitle) ?></title>

  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%2306b6d4'>N</text></svg>">
  <link rel="stylesheet" href="<?= e($root) ?>assets/css/admin.css">
</head>
<body data-page="admin-login">

  <main class="admin-auth" id="admin-auth">
    <div class="admin-auth__card">

      <p class="admin-auth__brand">NEXUS<span class="admin-auth__brand-accent">TECH</span></p>
      <h1 class="admin-auth__title">Painel administrativo</h1>
      <p class="admin-auth__lead">Acesse com suas credenciais de administrador para gerenciar a loja.</p>

      <form class="admin-auth__form" action="login.php" method="post" novalidate>
        <?= nx_csrf_field() ?>

        <?php if ($errors !== []): ?>
          <p class="admin-auth__alert" role="alert" data-show="true">
            <?= e(implode(' ', $errors)) ?>
          </p>
        <?php endif; ?>

        <div class="admin-auth__field">
          <label class="admin-auth__label" for="admin-login-email">E-mail</label>
          <input class="admin-auth__input" type="email" id="admin-login-email" name="email" autocomplete="email" placeholder="admin@nexustech.com" required value="<?= e($email) ?>">
        </div>

        <div class="admin-auth__field">
          <label class="admin-auth__label" for="admin-login-password">Senha</label>
          <input class="admin-auth__input" type="password" id="admin-login-password" name="password" autocomplete="current-password" placeholder="Sua senha" required>
        </div>

        <button type="submit" class="admin-auth__btn">Entrar</button>
      </form>

      <p class="admin-auth__note">
        <a class="admin-auth__link" href="../index.php">Voltar para a loja</a>
      </p>
      <p class="admin-auth__note">Conta de teste: admin@nexustech.com / Admin@123</p>

    </div>
  </main>

</body>
</html>

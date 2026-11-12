<?php
/**
 * NEXUS TECH (versão PHP) — Cadastro de cliente
 */

declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Criar conta — Nexus Tech';
$pageDesc = 'Crie sua conta Nexus Tech para finalizar compras e acompanhar seus pedidos.';
$bodyType = 'auth';
$bodyPage = 'cadastro';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/validation.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

if (nx_current_user() !== null) {
    nx_redirect('perfil.php');
}

$errors = [];
$values = [
    'name' => '',
    'email' => '',
    'phone' => '',
    'cpf' => '',
    'terms' => false,
    'privacy' => false,
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();

    $values = [
        'name' => nx_input('name', ''),
        'email' => nx_input('email', ''),
        'phone' => nx_input('phone', ''),
        'cpf' => nx_input('cpf', ''),
        'terms' => isset($_POST['terms']),
        'privacy' => isset($_POST['privacy']),
    ];

    if (trim((string) ($_POST['website'] ?? '')) !== '') {
        nx_redirect('cadastro.php');
    }

    if (nx_rate_limit_exceeded('register:' . ($_SERVER['REMOTE_ADDR'] ?? 'cli'), 5, 900)) {
        $errors['general'] = 'Muitas tentativas de cadastro. Aguarde alguns minutos.';
    } else {
        $validation = nx_validate_registration($_POST);
        $errors = $validation['errors'];

        if ($validation['ok']) {
            try {
                $userId = nx_create_customer($validation['data']);
                $user = nx_one('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [$userId]);
                if ($user !== null) {
                    nx_login_user($user);
                    nx_flash_set('success', 'Conta criada com sucesso. Bem-vindo(a), ' . $user['name'] . '!');
                    nx_redirect('perfil.php');
                }
                $errors['general'] = 'Conta criada, mas não foi possível iniciar a sessão. Faça login.';
            } catch (Throwable $exception) {
                if (nx_is_duplicate($exception)) {
                    $errors['email'] = 'Este e-mail já está cadastrado.';
                } else {
                    nx_log('Erro no cadastro: ' . $exception->getMessage());
                    $errors['general'] = 'Não foi possível concluir o cadastro. Tente novamente.';
                }
            }
        }
    }
}

$fieldClass = static function (string $key) use ($errors): string {
    return isset($errors[$key]) ? ' contact-form__field--invalid' : '';
};

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
              <span class="breadcrumb__current" aria-current="page">Criar conta</span>
            </li>
          </ol>
        </nav>

        <h1 id="auth-title" class="auth__title">
          Crie sua <span class="auth__title-accent">conta</span>
        </h1>

        <p class="auth__lead">
          Cadastre-se para finalizar compras com mais agilidade e acompanhar seus pedidos.
        </p>
      </div>

      <div class="auth__layout">
        <form class="auth__card contact-form" action="cadastro.php" method="post" novalidate>
          <?= nx_csrf_field() ?>
          <?= nx_render_errors($errors) ?>

          <div class="auth__hp" aria-hidden="true">
            <label for="register-website">Website</label>
            <input type="text" id="register-website" name="website" tabindex="-1" autocomplete="off">
          </div>

          <fieldset class="auth__fieldset">
            <legend class="auth__legend">Seus dados</legend>
            <div class="auth__grid">

              <div class="contact-form__field auth__field--full<?= $fieldClass('name') ?>">
                <label class="contact-form__label" for="register-name">Nome completo</label>
                <input class="contact-form__input" type="text" id="register-name" name="name" autocomplete="name" required placeholder="Seu nome completo" value="<?= e($values['name']) ?>">
                <?php if (isset($errors['name'])): ?><p class="contact-form__error"><?= e($errors['name']) ?></p><?php endif; ?>
              </div>

              <div class="contact-form__field<?= $fieldClass('email') ?>">
                <label class="contact-form__label" for="register-email">E-mail</label>
                <input class="contact-form__input" type="email" id="register-email" name="email" autocomplete="email" required placeholder="voce@exemplo.com" value="<?= e($values['email']) ?>">
                <?php if (isset($errors['email'])): ?><p class="contact-form__error"><?= e($errors['email']) ?></p><?php endif; ?>
              </div>

              <div class="contact-form__field<?= $fieldClass('phone') ?>">
                <label class="contact-form__label" for="register-phone">Telefone</label>
                <input class="contact-form__input" type="tel" id="register-phone" name="phone" autocomplete="tel" required placeholder="(11) 99999-9999" value="<?= e($values['phone']) ?>">
                <?php if (isset($errors['phone'])): ?><p class="contact-form__error"><?= e($errors['phone']) ?></p><?php endif; ?>
              </div>

              <div class="contact-form__field<?= $fieldClass('cpf') ?>">
                <label class="contact-form__label" for="register-cpf">CPF</label>
                <input class="contact-form__input" type="text" id="register-cpf" name="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" value="<?= e($values['cpf']) ?>">
                <?php if (isset($errors['cpf'])): ?><p class="contact-form__error"><?= e($errors['cpf']) ?></p><?php endif; ?>
              </div>

              <div class="contact-form__field<?= $fieldClass('password') ?>">
                <label class="contact-form__label" for="register-password">Senha</label>
                <div class="auth__password-wrap">
                  <input class="contact-form__input auth__password-input" type="password" id="register-password" name="password" autocomplete="new-password" required placeholder="Mínimo 8 caracteres">
                  <button type="button" class="auth__password-toggle" data-toggle-password="register-password" aria-pressed="false">Mostrar</button>
                </div>
                <?php if (isset($errors['password'])): ?><p class="contact-form__error"><?= e($errors['password']) ?></p><?php endif; ?>
              </div>

              <div class="contact-form__field<?= $fieldClass('passwordConfirm') ?>">
                <label class="contact-form__label" for="register-password-confirm">Confirmar senha</label>
                <div class="auth__password-wrap">
                  <input class="contact-form__input auth__password-input" type="password" id="register-password-confirm" name="passwordConfirm" autocomplete="new-password" required placeholder="Repita a senha">
                  <button type="button" class="auth__password-toggle" data-toggle-password="register-password-confirm" aria-pressed="false">Mostrar</button>
                </div>
                <?php if (isset($errors['passwordConfirm'])): ?><p class="contact-form__error"><?= e($errors['passwordConfirm']) ?></p><?php endif; ?>
              </div>

              <div class="auth__field--full">
                <div class="contact-form__field auth__consent-field<?= $fieldClass('terms') ?>">
                  <label class="auth__consent">
                    <input class="auth__consent-input" type="checkbox" id="register-terms" name="terms" <?= $values['terms'] ? 'checked' : '' ?>>
                    <span class="auth__consent-text">Li e aceito os <a href="termos.php">Termos de Uso</a> da Nexus Tech.</span>
                  </label>
                  <?php if (isset($errors['terms'])): ?><p class="contact-form__error"><?= e($errors['terms']) ?></p><?php endif; ?>
                </div>

                <div class="contact-form__field auth__consent-field<?= $fieldClass('privacy') ?>">
                  <label class="auth__consent">
                    <input class="auth__consent-input" type="checkbox" id="register-privacy" name="privacy" <?= $values['privacy'] ? 'checked' : '' ?>>
                    <span class="auth__consent-text">Estou de acordo com a <a href="privacidade.php">Política de Privacidade</a>.</span>
                  </label>
                  <?php if (isset($errors['privacy'])): ?><p class="contact-form__error"><?= e($errors['privacy']) ?></p><?php endif; ?>
                </div>
              </div>

            </div>
          </fieldset>

          <div class="contact-form__actions">
            <button type="submit" class="btn btn--primary btn--lg">Criar conta</button>
            <a href="login.php" class="btn btn--ghost">Já tenho conta</a>
          </div>
        </form>
      </div>

    </div>
  </section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>

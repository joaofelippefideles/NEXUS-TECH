<?php
/**
 * NEXUS TECH (versão PHP) — Contato
 */

declare(strict_types=1);

$root = '../';
$active = 'contato';
$pageTitle = 'Contato — Nexus Tech';
$pageDesc = 'Fale com a equipe Nexus Tech: dúvidas sobre pedidos, pagamentos, entregas, trocas e produtos.';
$bodyPage = 'contact';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/components.php';

$subjects = [
    'pedido' => 'Dúvida sobre pedido',
    'pagamento' => 'Pagamento / nota fiscal',
    'entrega' => 'Entrega / rastreamento',
    'troca' => 'Troca / devolução',
    'produto' => 'Produto / garantia',
    'outros' => 'Outros assuntos',
];

$errors = [];
$values = ['name' => '', 'email' => '', 'subject' => '', 'message' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();

    $values = [
        'name' => nx_input('name', ''),
        'email' => nx_input('email', ''),
        'subject' => nx_input('subject', ''),
        'message' => nx_input('message', ''),
    ];

    if ($values['name'] === '' || mb_strlen($values['name']) < 2) {
        $errors['name'] = 'Informe seu nome (mínimo 2 letras).';
    }
    if (filter_var($values['email'], FILTER_VALIDATE_EMAIL) === false) {
        $errors['email'] = 'Informe um e-mail válido.';
    }
    if (!isset($subjects[$values['subject']])) {
        $errors['subject'] = 'Selecione um assunto.';
    }
    if (mb_strlen($values['message']) < 10) {
        $errors['message'] = 'Escreva uma mensagem com ao menos 10 caracteres.';
    }

    if ($errors === []) {
        if (nx_rate_limit_exceeded('contact:' . ($_SERVER['REMOTE_ADDR'] ?? 'cli'), 5, 600)) {
            $errors['general'] = 'Muitas mensagens enviadas. Aguarde alguns minutos.';
        } else {
            nx_log('Contato recebido de ' . $values['email'] . ' assunto=' . $values['subject']);
            nx_flash_set('success', 'Mensagem enviada! Nossa equipe responderá em até 1 dia útil.');
            nx_redirect('contato.php');
        }
    }
}

require __DIR__ . '/../includes/header.php';
?>
<main>
  <section class="institutional" aria-labelledby="contact-title">
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
              <span class="breadcrumb__current" aria-current="page">Contato</span>
            </li>
          </ol>
        </nav>

        <h1 id="contact-title" class="institutional__title">
          Entre em <span class="institutional__title-accent">contato</span>
        </h1>

        <p class="institutional__lead">
          Preencha o formulário abaixo e nossa equipe retornará em até 1 dia útil. Você também pode falar conosco pelos canais ao lado.
        </p>
      </div>

      <?= nx_render_flash() ?>
      <?= nx_render_errors($errors) ?>

      <div class="contact-layout">

        <form class="contact-form" action="contato.php" method="post" novalidate>
          <?= nx_csrf_field() ?>

          <fieldset class="filters__group">
            <legend class="filters__legend">Envie sua mensagem</legend>

            <div class="contact-form__field">
              <label class="contact-form__label" for="contact-name">Nome completo</label>
              <input class="contact-form__input" type="text" id="contact-name" name="name" autocomplete="name" required placeholder="Seu nome" value="<?= e($values['name']) ?>">
              <?php if (isset($errors['name'])): ?><p class="contact-form__error"><?= e($errors['name']) ?></p><?php endif; ?>
            </div>

            <div class="contact-form__field">
              <label class="contact-form__label" for="contact-email">E-mail</label>
              <input class="contact-form__input" type="email" id="contact-email" name="email" autocomplete="email" required placeholder="voce@exemplo.com" value="<?= e($values['email']) ?>">
              <?php if (isset($errors['email'])): ?><p class="contact-form__error"><?= e($errors['email']) ?></p><?php endif; ?>
            </div>

            <div class="contact-form__field">
              <label class="contact-form__label" for="contact-subject">Assunto</label>
              <select class="contact-form__select" id="contact-subject" name="subject" required>
                <option value="">Selecione um assunto</option>
                <?php foreach ($subjects as $key => $label): ?>
                  <option value="<?= e($key) ?>" <?= $values['subject'] === $key ? 'selected' : '' ?>><?= e($label) ?></option>
                <?php endforeach; ?>
              </select>
              <?php if (isset($errors['subject'])): ?><p class="contact-form__error"><?= e($errors['subject']) ?></p><?php endif; ?>
            </div>

            <div class="contact-form__field">
              <label class="contact-form__label" for="contact-message">Mensagem</label>
              <textarea class="contact-form__textarea" id="contact-message" name="message" required placeholder="Escreva sua mensagem (mínimo 10 caracteres)..."><?= e($values['message']) ?></textarea>
              <?php if (isset($errors['message'])): ?><p class="contact-form__error"><?= e($errors['message']) ?></p><?php endif; ?>
            </div>

            <div class="contact-form__actions">
              <button type="submit" class="btn btn--primary">Enviar mensagem</button>
              <p class="contact-form__note">Os dados são usados apenas para responder ao seu contato.</p>
            </div>
          </fieldset>
        </form>

        <aside class="contact-info" aria-label="Informações de contato da Nexus Tech">
          <div class="contact-info__card">
            <h2 class="contact-info__title">Canais de atendimento</h2>
            <ul class="contact-info__list">
              <li><strong>E-mail:</strong> <a href="mailto:contato@nexustech.com.br">contato@nexustech.com.br</a></li>
              <li><strong>WhatsApp:</strong> <a href="tel:+551140009900">(11) 4000-9900</a></li>
              <li><strong>Telefone:</strong> <a href="tel:+551140009900">(11) 4000-9900</a></li>
            </ul>
          </div>

          <div class="contact-info__card">
            <h2 class="contact-info__title">Horário de atendimento</h2>
            <p class="contact-info__text">Atendimento humano nos seguintes horários:</p>
            <div class="contact-info__hours"><span class="contact-info__hours-day">Segunda a sexta</span><span>8h às 18h</span></div>
            <div class="contact-info__hours"><span class="contact-info__hours-day">Sábado</span><span>9h às 13h</span></div>
            <div class="contact-info__hours"><span class="contact-info__hours-day">Domingo e feriados</span><span>Fechado</span></div>
          </div>

          <div class="contact-info__card">
            <h2 class="contact-info__title">Endereço</h2>
            <p class="contact-info__text">
              Avenida Tecnológica, 1000 — Torre Norte, Sala 1201<br>
              Jardim Digital — São Paulo/SP — CEP 04555-000
            </p>
          </div>
        </aside>

      </div>
    </div>
  </section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>

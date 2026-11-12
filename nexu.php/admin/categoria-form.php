<?php
/**
 * NEXUS TECH (versão PHP) — Admin: criar/editar categoria
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/validation.php';
require_once __DIR__ . '/../includes/components.php';

$admin = nx_require_admin();

$entityId = (int) nx_get('id', '0');
$category = $entityId > 0 ? nx_admin_entity_find('categories', $entityId) : null;

if ($entityId > 0 && $category === null) {
    nx_flash_set('error', 'Categoria não encontrada.');
    nx_redirect('categorias.php');
}

$isEdit = $category !== null;
$errors = [];
$values = ['name' => '', 'slug' => ''];

if ($isEdit) {
    $values = ['name' => (string) $category['name'], 'slug' => (string) $category['slug']];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();
    $validation = nx_validate_named_entity($_POST);
    $errors = $validation['errors'];
    $values = [
        'name' => nx_input('name', ''),
        'slug' => nx_input('slug', ''),
    ];

    if ($validation['ok']) {
        try {
            nx_admin_save_entity('categories', $entityId > 0 ? $entityId : null, $validation['data'], $admin);
            nx_flash_set('success', $isEdit ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.');
            nx_redirect('categorias.php');
        } catch (Throwable $exception) {
            if (nx_is_duplicate($exception)) {
                $errors['slug'] = 'Este slug já está em uso por outra categoria.';
            } else {
                nx_log('Erro ao salvar categoria: ' . $exception->getMessage());
                $errors['general'] = 'Não foi possível salvar a categoria. Tente novamente.';
            }
        }
    }
}

$adminActive = 'categories';
$pageTitle = $isEdit ? 'Editar categoria' : 'Nova categoria';
$bodyPage = 'admin-category-form';

require __DIR__ . '/../includes/admin-header.php';
?>
      <div class="admin-pagehead">
        <div>
          <h1 class="admin-main__title"><?= $isEdit ? 'Editar categoria' : 'Nova categoria' ?></h1>
          <p class="admin-main__lead"><?= $isEdit ? 'Atualize os dados da categoria.' : 'Adicione uma nova categoria ao catálogo.' ?></p>
        </div>
        <a href="categorias.php" class="admin-btn admin-btn--secondary">Voltar</a>
      </div>

      <?php if ($errors !== []): ?>
        <div class="admin-alert admin-alert--danger" role="alert"><?= e(implode(' ', $errors)) ?></div>
      <?php endif; ?>

      <form action="categoria-form.php<?= $isEdit ? '?id=' . (int) $entityId : '' ?>" method="post" novalidate>
        <?= nx_csrf_field() ?>

        <section class="admin-card">
          <div class="admin-form__grid">
            <label class="admin-form__field">
              <span class="admin-form__label">Nome *</span>
              <input class="admin-input" type="text" name="name" required value="<?= e($values['name']) ?>">
            </label>

            <label class="admin-form__field">
              <span class="admin-form__label">Slug</span>
              <input class="admin-input" type="text" name="slug" value="<?= e($values['slug']) ?>" placeholder="gerado a partir do nome">
            </label>
          </div>
        </section>

        <div class="admin-form__actions">
          <a href="categorias.php" class="admin-btn admin-btn--secondary">Cancelar</a>
          <button type="submit" class="admin-btn admin-btn--primary"><?= $isEdit ? 'Salvar alterações' : 'Criar categoria' ?></button>
        </div>
      </form>
<?php require __DIR__ . '/../includes/admin-footer.php'; ?>

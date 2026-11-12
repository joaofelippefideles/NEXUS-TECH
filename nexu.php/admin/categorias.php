<?php
/**
 * NEXUS TECH (versão PHP) — Admin: categorias
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

$admin = nx_require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();

    if ((string) ($_POST['action'] ?? '') === 'delete') {
        $error = nx_admin_delete_entity('categories', (int) ($_POST['id'] ?? 0), $admin);
        nx_flash_set($error === null ? 'success' : 'error', $error ?? 'Categoria excluída com sucesso.');
    }

    nx_redirect('categorias.php');
}

$categories = nx_admin_entities('categories');

$adminActive = 'categories';
$pageTitle = 'Categorias';
$bodyPage = 'admin-categories';

require __DIR__ . '/../includes/admin-header.php';
?>
      <div class="admin-pagehead">
        <div>
          <h1 class="admin-main__title">Categorias</h1>
          <p class="admin-main__lead">Organize os produtos por categoria.</p>
        </div>
        <a href="categoria-form.php" class="admin-btn admin-btn--primary">Nova categoria</a>
      </div>

      <?= nx_render_admin_flash() ?>

      <section class="admin-card">
        <?php if ($categories === []): ?>
          <div class="admin-state admin-state--empty">Nenhuma categoria cadastrada.</div>
        <?php else: ?>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <caption class="visually-hidden">Categorias cadastradas</caption>
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col">Slug</th>
                  <th scope="col" class="cell-num">Produtos</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($categories as $category): ?>
                  <tr>
                    <td><strong><?= e((string) $category['name']) ?></strong></td>
                    <td class="admin-muted"><?= e((string) $category['slug']) ?></td>
                    <td class="cell-num"><?= (int) $category['total'] ?></td>
                    <td>
                      <div class="admin-rowactions">
                        <a href="categoria-form.php?id=<?= (int) $category['id'] ?>" class="admin-btn admin-btn--small">Editar</a>
                        <form action="categorias.php" method="post" data-confirm="Excluir a categoria &quot;<?= e((string) $category['name']) ?>&quot;?">
                          <?= nx_csrf_field() ?>
                          <input type="hidden" name="id" value="<?= (int) $category['id'] ?>">
                          <input type="hidden" name="action" value="delete">
                          <button type="submit" class="admin-btn admin-btn--small admin-btn--danger">Excluir</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
      </section>
<?php require __DIR__ . '/../includes/admin-footer.php'; ?>

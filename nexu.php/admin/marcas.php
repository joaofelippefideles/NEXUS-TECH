<?php
/**
 * NEXUS TECH (versão PHP) — Admin: marcas
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
        $error = nx_admin_delete_entity('brands', (int) ($_POST['id'] ?? 0), $admin);
        nx_flash_set($error === null ? 'success' : 'error', $error ?? 'Marca excluída com sucesso.');
    }

    nx_redirect('marcas.php');
}

$brands = nx_admin_entities('brands');

$adminActive = 'brands';
$pageTitle = 'Marcas';
$bodyPage = 'admin-brands';

require __DIR__ . '/../includes/admin-header.php';
?>
      <div class="admin-pagehead">
        <div>
          <h1 class="admin-main__title">Marcas</h1>
          <p class="admin-main__lead">Cadastre e organize as marcas do catálogo.</p>
        </div>
        <a href="marca-form.php" class="admin-btn admin-btn--primary">Nova marca</a>
      </div>

      <?= nx_render_admin_flash() ?>

      <section class="admin-card">
        <?php if ($brands === []): ?>
          <div class="admin-state admin-state--empty">Nenhuma marca cadastrada.</div>
        <?php else: ?>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <caption class="visually-hidden">Marcas cadastradas</caption>
              <thead>
                <tr>
                  <th scope="col">Marca</th>
                  <th scope="col">Slug</th>
                  <th scope="col" class="cell-num">Produtos</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($brands as $brand): ?>
                  <tr>
                    <td><strong><?= e((string) $brand['name']) ?></strong></td>
                    <td class="admin-muted"><?= e((string) $brand['slug']) ?></td>
                    <td class="cell-num"><?= (int) $brand['total'] ?></td>
                    <td>
                      <div class="admin-rowactions">
                        <a href="marca-form.php?id=<?= (int) $brand['id'] ?>" class="admin-btn admin-btn--small">Editar</a>
                        <form action="marcas.php" method="post" data-confirm="Excluir a marca &quot;<?= e((string) $brand['name']) ?>&quot;?">
                          <?= nx_csrf_field() ?>
                          <input type="hidden" name="id" value="<?= (int) $brand['id'] ?>">
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

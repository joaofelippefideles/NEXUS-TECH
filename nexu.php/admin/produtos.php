<?php
/**
 * NEXUS TECH (versão PHP) — Admin: produtos
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

$admin = nx_require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();
    $action = (string) ($_POST['action'] ?? '');
    $productId = (int) ($_POST['id'] ?? 0);

    if ($productId > 0) {
        if ($action === 'toggle') {
            $product = nx_admin_product_find($productId);
            if ($product !== null) {
                nx_admin_set_product_active($productId, (int) $product['is_active'] !== 1, $admin);
                nx_flash_set('success', 'Status do produto atualizado.');
            }
        } elseif ($action === 'delete') {
            nx_admin_delete_product($productId, $admin);
            nx_flash_set('success', 'Produto desativado (os pedidos existentes foram preservados).');
        }
    }

    nx_redirect('produtos.php');
}

$q = trim(nx_get('q'));
$categoryId = (int) nx_get('category_id', '0');
$brandId = (int) nx_get('brand_id', '0');
$status = nx_get('status', 'all');
$status = in_array($status, ['all', 'active', 'inactive'], true) ? $status : 'all';

$products = nx_admin_products([
    'q' => $q,
    'category_id' => $categoryId,
    'brand_id' => $brandId,
    'status' => $status,
]);
$categories = nx_admin_entities('categories');
$brands = nx_admin_entities('brands');

$adminActive = 'products';
$pageTitle = 'Produtos';
$bodyPage = 'admin-products';

require __DIR__ . '/../includes/admin-header.php';
?>
      <div class="admin-pagehead">
        <div>
          <h1 class="admin-main__title">Produtos</h1>
          <p class="admin-main__lead">Gerencie o catálogo da Nexus Tech — dados do banco MySQL.</p>
        </div>
        <a href="produto-form.php" class="admin-btn admin-btn--primary">Novo produto</a>
      </div>

      <?= nx_render_admin_flash() ?>

      <section class="admin-card">

        <form class="admin-toolbar" action="produtos.php" method="get">
          <label class="admin-toolbar__field admin-toolbar__field--grow">
            <span class="admin-toolbar__label">Buscar</span>
            <input type="search" name="q" class="admin-input" placeholder="Nome, slug, marca ou categoria" autocomplete="off" value="<?= e($q) ?>">
          </label>
          <label class="admin-toolbar__field">
            <span class="admin-toolbar__label">Categoria</span>
            <select name="category_id" class="admin-input">
              <option value="0">Todas</option>
              <?php foreach ($categories as $category): ?>
                <option value="<?= (int) $category['id'] ?>" <?= $categoryId === (int) $category['id'] ? 'selected' : '' ?>><?= e((string) $category['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </label>
          <label class="admin-toolbar__field">
            <span class="admin-toolbar__label">Marca</span>
            <select name="brand_id" class="admin-input">
              <option value="0">Todas</option>
              <?php foreach ($brands as $brand): ?>
                <option value="<?= (int) $brand['id'] ?>" <?= $brandId === (int) $brand['id'] ? 'selected' : '' ?>><?= e((string) $brand['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </label>
          <label class="admin-toolbar__field">
            <span class="admin-toolbar__label">Status</span>
            <select name="status" class="admin-input">
              <option value="all" <?= $status === 'all' ? 'selected' : '' ?>>Todos</option>
              <option value="active" <?= $status === 'active' ? 'selected' : '' ?>>Ativos</option>
              <option value="inactive" <?= $status === 'inactive' ? 'selected' : '' ?>>Inativos</option>
            </select>
          </label>
          <button type="submit" class="admin-btn admin-btn--secondary">Buscar</button>
        </form>

        <?php if ($products === []): ?>
          <div class="admin-state admin-state--empty">Nenhum produto encontrado.</div>
        <?php else: ?>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <caption class="visually-hidden">Produtos do catálogo</caption>
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Marca</th>
                  <th scope="col" class="cell-num">Preço</th>
                  <th scope="col" class="cell-num">Estoque</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($products as $product): ?>
                  <tr>
                    <td>
                      <div class="admin-cellstack">
                        <span class="admin-cellstack__thumb" aria-hidden="true"><?= e(nx_product_initial($product)) ?></span>
                        <div>
                          <strong><?= e((string) $product['name']) ?></strong><br>
                          <span class="admin-muted"><?= e((string) $product['slug']) ?></span>
                        </div>
                      </div>
                    </td>
                    <td><?= e((string) $product['category']) ?></td>
                    <td><?= e((string) $product['brand']) ?></td>
                    <td class="cell-num"><?= e(nx_money((int) $product['price_cents'])) ?></td>
                    <td class="cell-num"><?= (int) $product['stock'] ?></td>
                    <td>
                      <span class="admin-badge <?= (int) $product['is_active'] === 1 ? 'admin-badge--active' : 'admin-badge--inactive' ?>">
                        <?= (int) $product['is_active'] === 1 ? 'Ativo' : 'Inativo' ?>
                      </span>
                    </td>
                    <td>
                      <div class="admin-rowactions">
                        <a href="produto-form.php?id=<?= (int) $product['id'] ?>" class="admin-btn admin-btn--small">Editar</a>

                        <form action="produtos.php" method="post">
                          <?= nx_csrf_field() ?>
                          <input type="hidden" name="id" value="<?= (int) $product['id'] ?>">
                          <input type="hidden" name="action" value="toggle">
                          <button type="submit" class="admin-btn admin-btn--small">
                            <?= (int) $product['is_active'] === 1 ? 'Desativar' : 'Ativar' ?>
                          </button>
                        </form>

                        <?php if ((int) $product['is_active'] === 1): ?>
                          <form action="produtos.php" method="post" data-confirm="Desativar &quot;<?= e((string) $product['name']) ?>&quot;?">
                            <?= nx_csrf_field() ?>
                            <input type="hidden" name="id" value="<?= (int) $product['id'] ?>">
                            <input type="hidden" name="action" value="delete">
                            <button type="submit" class="admin-btn admin-btn--small admin-btn--danger">Excluir</button>
                          </form>
                        <?php endif; ?>
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

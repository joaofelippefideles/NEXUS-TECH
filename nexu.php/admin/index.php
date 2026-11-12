<?php
/**
 * NEXUS TECH (versão PHP) — Dashboard administrativo
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

$admin = nx_require_admin();

$adminActive = 'dashboard';
$pageTitle = 'Dashboard';
$bodyPage = 'admin-dashboard';

$stats = nx_admin_stats();
$actions = nx_admin_recent_actions(10);

require __DIR__ . '/../includes/admin-header.php';
?>
      <h1 class="admin-main__title">Olá, <?= e(explode(' ', (string) $admin['name'])[0]) ?>!</h1>
      <p class="admin-main__lead">
        Bem-vindo(a) ao painel administrativo da Nexus Tech. Os indicadores abaixo vêm do banco MySQL.
      </p>

      <?= nx_render_admin_flash() ?>

      <section class="admin-panel" aria-label="Painel administrativo">

        <div class="admin-stats" aria-label="Indicadores do catálogo">
          <div class="admin-stat">
            <span class="admin-stat__value"><?= $stats['active_products'] ?></span>
            <span class="admin-stat__label">Produtos ativos</span>
          </div>
          <div class="admin-stat">
            <span class="admin-stat__value"><?= $stats['inactive_products'] ?></span>
            <span class="admin-stat__label">Produtos inativos</span>
          </div>
          <div class="admin-stat">
            <span class="admin-stat__value"><?= $stats['brands'] ?></span>
            <span class="admin-stat__label">Marcas</span>
          </div>
          <div class="admin-stat">
            <span class="admin-stat__value"><?= $stats['categories'] ?></span>
            <span class="admin-stat__label">Categorias</span>
          </div>
          <div class="admin-stat admin-stat--warn">
            <span class="admin-stat__value"><?= $stats['out_of_stock'] ?></span>
            <span class="admin-stat__label">Produtos sem estoque</span>
          </div>
          <div class="admin-stat">
            <span class="admin-stat__value"><?= $stats['orders'] ?></span>
            <span class="admin-stat__label">Pedidos</span>
          </div>
          <div class="admin-stat">
            <span class="admin-stat__value"><?= e(nx_money($stats['revenue_cents'])) ?></span>
            <span class="admin-stat__label">Receita (não cancelados)</span>
          </div>
          <div class="admin-stat">
            <span class="admin-stat__value"><?= $stats['customers'] ?></span>
            <span class="admin-stat__label">Clientes</span>
          </div>
        </div>

        <div class="admin-dashactions">
          <a href="produtos.php" class="admin-btn admin-btn--primary">Gerenciar produtos</a>
          <a href="marcas.php" class="admin-btn admin-btn--secondary">Gerenciar marcas</a>
          <a href="categorias.php" class="admin-btn admin-btn--secondary">Gerenciar categorias</a>
        </div>

        <div class="admin-card admin-card--flat">
          <div class="admin-card__head">
            <h2 class="admin-repeater__title">Últimas ações (auditoria)</h2>
          </div>

          <?php if ($actions === []): ?>
            <div class="admin-state admin-state--empty">Nenhuma ação registrada até o momento.</div>
          <?php else: ?>
            <div class="admin-table-wrap">
              <table class="admin-table">
                <caption class="visually-hidden">Últimas ações administrativas</caption>
                <thead>
                  <tr>
                    <th scope="col">Ação</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($actions as $action): ?>
                    <tr>
                      <td><?= e(nx_action_label((string) $action['action'], (string) $action['entity'])) ?><?= $action['entity_id'] !== null ? ' #' . (int) $action['entity_id'] : '' ?></td>
                      <td><?= e((string) $action['admin_name']) ?></td>
                      <td><?= e(nx_datetime((string) $action['created_at'])) ?></td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          <?php endif; ?>
        </div>

      </section>
<?php require __DIR__ . '/../includes/admin-footer.php'; ?>

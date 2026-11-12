<?php
/**
 * NEXUS TECH (versão PHP) — Admin: criar/editar produto
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/validation.php';
require_once __DIR__ . '/../includes/components.php';

$admin = nx_require_admin();

$productId = (int) nx_get('id', '0');
$product = $productId > 0 ? nx_admin_product_find($productId) : null;

if ($productId > 0 && $product === null) {
    nx_flash_set('error', 'Produto não encontrado.');
    nx_redirect('produtos.php');
}

$errors = [];
$isEdit = $product !== null;

$values = [
    'name' => '',
    'slug' => '',
    'description' => '',
    'brand_id' => 0,
    'category_id' => 0,
    'price' => '',
    'old_price' => '',
    'stock' => '0',
    'is_active' => 1,
    'is_featured' => 0,
    'is_new' => 0,
    'is_bestseller' => 0,
    'specs' => [],
    'images' => [],
];

if ($isEdit) {
    $values = [
        'name' => (string) $product['name'],
        'slug' => (string) $product['slug'],
        'description' => (string) ($product['description'] ?? ''),
        'brand_id' => (int) $product['brand_id'],
        'category_id' => (int) $product['category_id'],
        'price' => number_format((int) $product['price_cents'] / 100, 2, ',', ''),
        'old_price' => $product['old_price_cents'] !== null ? number_format((int) $product['old_price_cents'] / 100, 2, ',', '') : '',
        'stock' => (string) (int) $product['stock'],
        'is_active' => (int) $product['is_active'],
        'is_featured' => (int) $product['is_featured'],
        'is_new' => (int) $product['is_new'],
        'is_bestseller' => (int) $product['is_bestseller'],
        'specs' => $product['specs'],
        'images' => $product['images'],
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    nx_require_csrf();
    $validation = nx_validate_product($_POST);
    $errors = $validation['errors'];

    $specLabels = is_array($_POST['spec_label'] ?? null) ? $_POST['spec_label'] : [];
    $specValues = is_array($_POST['spec_value'] ?? null) ? $_POST['spec_value'] : [];
    $imageUrls = is_array($_POST['image_url'] ?? null) ? $_POST['image_url'] : [];
    $imageAlts = is_array($_POST['image_alt'] ?? null) ? $_POST['image_alt'] : [];

    $values = [
        'name' => nx_input('name', ''),
        'slug' => nx_input('slug', ''),
        'description' => nx_input('description', ''),
        'brand_id' => (int) nx_input('brand_id', '0'),
        'category_id' => (int) nx_input('category_id', '0'),
        'price' => nx_input('price', ''),
        'old_price' => nx_input('old_price', ''),
        'stock' => nx_input('stock', '0'),
        'is_active' => isset($_POST['is_active']) ? 1 : 0,
        'is_featured' => isset($_POST['is_featured']) ? 1 : 0,
        'is_new' => isset($_POST['is_new']) ? 1 : 0,
        'is_bestseller' => isset($_POST['is_bestseller']) ? 1 : 0,
        'specs' => [],
        'images' => [],
    ];

    foreach ($specLabels as $index => $label) {
        $values['specs'][] = [
            'label' => is_string($label) ? trim($label) : '',
            'value' => is_string($specValues[$index] ?? null) ? trim((string) $specValues[$index]) : '',
        ];
    }
    foreach ($imageUrls as $index => $url) {
        $values['images'][] = [
            'url' => is_string($url) ? trim($url) : '',
            'alt' => is_string($imageAlts[$index] ?? null) ? trim((string) $imageAlts[$index]) : '',
        ];
    }

    if ($validation['ok']) {
        try {
            nx_admin_save_product($productId > 0 ? $productId : null, $validation['data'], $admin);
            nx_flash_set('success', $isEdit ? 'Produto atualizado com sucesso.' : 'Produto criado com sucesso.');
            nx_redirect('produtos.php');
        } catch (Throwable $exception) {
            if (nx_is_duplicate($exception)) {
                $errors['slug'] = 'Este slug já está em uso por outro produto.';
            } else {
                nx_log('Erro ao salvar produto: ' . $exception->getMessage());
                $errors['general'] = 'Não foi possível salvar o produto. Tente novamente.';
            }
        }
    }
}

while (count($values['specs']) < 4) {
    $values['specs'][] = ['label' => '', 'value' => ''];
}
while (count($values['images']) < 2) {
    $values['images'][] = ['url' => '', 'alt' => ''];
}

$brands = nx_admin_entities('brands');
$categories = nx_admin_entities('categories');

$adminActive = 'products';
$pageTitle = $isEdit ? 'Editar produto' : 'Novo produto';
$bodyPage = 'admin-product-form';

require __DIR__ . '/../includes/admin-header.php';
?>
      <div class="admin-pagehead">
        <div>
          <h1 class="admin-main__title"><?= $isEdit ? 'Editar produto' : 'Novo produto' ?></h1>
          <p class="admin-main__lead"><?= $isEdit ? 'Alterações são gravadas no MySQL.' : 'Cadastre um novo item no catálogo.' ?></p>
        </div>
        <a href="produtos.php" class="admin-btn admin-btn--secondary">Voltar</a>
      </div>

      <?php if ($errors !== []): ?>
        <div class="admin-alert admin-alert--danger" role="alert">
          <?= e(implode(' ', $errors)) ?>
        </div>
      <?php endif; ?>

      <form action="produto-form.php<?= $isEdit ? '?id=' . (int) $productId : '' ?>" method="post" novalidate>
        <?= nx_csrf_field() ?>

        <section class="admin-card">
          <h2 class="admin-repeater__title">Informações principais</h2>

          <div class="admin-form__grid">
            <label class="admin-form__field admin-form__field--wide">
              <span class="admin-form__label">Nome *</span>
              <input class="admin-input" type="text" name="name" required value="<?= e($values['name']) ?>">
            </label>

            <label class="admin-form__field">
              <span class="admin-form__label">Slug</span>
              <input class="admin-input" type="text" name="slug" value="<?= e($values['slug']) ?>" placeholder="gerado a partir do nome">
            </label>

            <label class="admin-form__field">
              <span class="admin-form__label">Marca *</span>
              <select class="admin-input" name="brand_id" required>
                <option value="0">Selecione</option>
                <?php foreach ($brands as $brand): ?>
                  <option value="<?= (int) $brand['id'] ?>" <?= (int) $values['brand_id'] === (int) $brand['id'] ? 'selected' : '' ?>><?= e((string) $brand['name']) ?></option>
                <?php endforeach; ?>
              </select>
            </label>

            <label class="admin-form__field">
              <span class="admin-form__label">Categoria *</span>
              <select class="admin-input" name="category_id" required>
                <option value="0">Selecione</option>
                <?php foreach ($categories as $category): ?>
                  <option value="<?= (int) $category['id'] ?>" <?= (int) $values['category_id'] === (int) $category['id'] ? 'selected' : '' ?>><?= e((string) $category['name']) ?></option>
                <?php endforeach; ?>
              </select>
            </label>

            <label class="admin-form__field">
              <span class="admin-form__label">Preço (R$) *</span>
              <input class="admin-input" type="text" name="price" inputmode="decimal" required placeholder="0,00" value="<?= e($values['price']) ?>">
            </label>

            <label class="admin-form__field">
              <span class="admin-form__label">Preço anterior (R$)</span>
              <input class="admin-input" type="text" name="old_price" inputmode="decimal" placeholder="opcional" value="<?= e($values['old_price']) ?>">
            </label>

            <label class="admin-form__field">
              <span class="admin-form__label">Estoque *</span>
              <input class="admin-input" type="number" name="stock" min="0" step="1" required value="<?= e($values['stock']) ?>">
            </label>

            <label class="admin-form__field admin-form__field--wide">
              <span class="admin-form__label">Descrição</span>
              <textarea class="admin-input admin-input--textarea" name="description" rows="5"><?= e($values['description']) ?></textarea>
            </label>
          </div>

          <div class="admin-checks">
            <label class="admin-check">
              <input type="checkbox" name="is_active" value="1" <?= (int) $values['is_active'] === 1 ? 'checked' : '' ?>>
              <span>Ativo na loja</span>
            </label>
            <label class="admin-check">
              <input type="checkbox" name="is_featured" value="1" <?= (int) $values['is_featured'] === 1 ? 'checked' : '' ?>>
              <span>Destaque</span>
            </label>
            <label class="admin-check">
              <input type="checkbox" name="is_new" value="1" <?= (int) $values['is_new'] === 1 ? 'checked' : '' ?>>
              <span>Novidade</span>
            </label>
            <label class="admin-check">
              <input type="checkbox" name="is_bestseller" value="1" <?= (int) $values['is_bestseller'] === 1 ? 'checked' : '' ?>>
              <span>Mais vendido</span>
            </label>
          </div>
        </section>

        <section class="admin-card">
          <div class="admin-repeater">
            <div class="admin-repeater__head">
              <h2 class="admin-repeater__title">Especificações</h2>
            </div>
            <div class="admin-repeater__rows">
              <?php foreach ($values['specs'] as $index => $spec): ?>
                <div class="admin-repeater__row">
                  <input class="admin-input" type="text" name="spec_label[]" placeholder="Ex.: Tela" value="<?= e((string) $spec['label']) ?>">
                  <input class="admin-input" type="text" name="spec_value[]" placeholder="Ex.: 6,7&quot; OLED" value="<?= e((string) $spec['value']) ?>">
                  <span class="admin-muted">linha <?= $index + 1 ?></span>
                </div>
              <?php endforeach; ?>
            </div>
          </div>

          <div class="admin-repeater">
            <div class="admin-repeater__head">
              <h2 class="admin-repeater__title">Imagens</h2>
            </div>
            <div class="admin-repeater__rows">
              <?php foreach ($values['images'] as $index => $image): ?>
                <div class="admin-repeater__row">
                  <input class="admin-input" type="text" name="image_url[]" placeholder="caminho ou URL da imagem" value="<?= e((string) $image['url']) ?>">
                  <input class="admin-input" type="text" name="image_alt[]" placeholder="texto alternativo" value="<?= e((string) $image['alt']) ?>">
                  <span class="admin-muted">imagem <?= $index + 1 ?></span>
                </div>
              <?php endforeach; ?>
            </div>
          </div>
        </section>

        <div class="admin-form__actions">
          <a href="produtos.php" class="admin-btn admin-btn--secondary">Cancelar</a>
          <button type="submit" class="admin-btn admin-btn--primary"><?= $isEdit ? 'Salvar alterações' : 'Criar produto' ?></button>
        </div>
      </form>
<?php require __DIR__ . '/../includes/admin-footer.php'; ?>

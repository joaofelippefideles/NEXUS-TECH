<?php
/**
 * NEXUS TECH (versão PHP) — Catálogo de produtos
 */

declare(strict_types=1);

$root = '../';
$active = 'produtos';
$pageTitle = 'Catálogo de Produtos — Nexus Tech';
$pageDesc = 'Confira o catálogo de produtos Nexus Tech: notebooks, monitores, teclados, mouses, headsets, celulares, games e acessórios.';
$bodyPage = 'catalog';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/repository.php';
require_once __DIR__ . '/../includes/components.php';

$priceRanges = [
    'all' => ['label' => 'Todos os preços', 'min' => null, 'max' => null],
    '0-100' => ['label' => 'Até R$ 100', 'min' => 0, 'max' => 10000],
    '100-300' => ['label' => 'R$ 100 – R$ 300', 'min' => 10000, 'max' => 30001],
    '300-1000' => ['label' => 'R$ 300 – R$ 1.000', 'min' => 30000, 'max' => 100001],
    '1000-5000' => ['label' => 'R$ 1.000 – R$ 5.000', 'min' => 100000, 'max' => 500001],
    '5000+' => ['label' => 'Acima de R$ 5.000', 'min' => 500000, 'max' => null],
];

$sortOptions = [
    'relevance' => 'Relevância',
    'price-asc' => 'Menor preço',
    'price-desc' => 'Maior preço',
    'rating-desc' => 'Melhor avaliação',
    'newest' => 'Novidades',
];

$q = trim(nx_get('q'));
$category = trim(nx_get('category'));
$priceKey = nx_get('preco', 'all');
$priceKey = isset($priceRanges[$priceKey]) ? $priceKey : 'all';
$availability = nx_get('availability', 'all');
$availability = in_array($availability, ['all', 'in', 'out'], true) ? $availability : 'all';
$sort = nx_get('sort', 'relevance');
$sort = isset($sortOptions[$sort]) ? $sort : 'relevance';
$page = max(1, (int) nx_get('page', '1'));

$range = $priceRanges[$priceKey];
$catalog = nx_catalog([
    'q' => $q,
    'category' => $category,
    'min_price' => $range['min'],
    'max_price' => $range['max'],
    'availability' => $availability,
    'sort' => $sort,
    'page' => $page,
    'per_page' => 8,
]);

$categories = nx_categories();

$buildUrl = static function (array $changes = []) use ($q, $category, $priceKey, $availability, $sort, $catalog): string {
    $params = array_filter([
        'q' => $q,
        'category' => $category,
        'preco' => $priceKey !== 'all' ? $priceKey : '',
        'availability' => $availability !== 'all' ? $availability : '',
        'sort' => $sort !== 'relevance' ? $sort : '',
        'page' => (int) $catalog['page'],
    ], static fn ($value): bool => $value !== '' && $value !== null);

    $params = array_merge($params, $changes);
    $params = array_filter($params, static fn ($value): bool => $value !== '' && $value !== null);

    return 'produtos.php' . ($params !== [] ? '?' . http_build_query($params) : '');
};

$hasFilters = $q !== '' || $category !== '' || $priceKey !== 'all' || $availability !== 'all';

require __DIR__ . '/../includes/header.php';
?>
<main>
  <section class="catalog" aria-labelledby="catalog-title">
    <div class="container">

      <div class="catalog__header">
        <nav class="breadcrumb" aria-label="Trilha de navegação">
          <ol class="breadcrumb__list">
            <li class="breadcrumb__item">
              <a href="../index.php" class="breadcrumb__link">Home</a>
              <span class="breadcrumb__separator" aria-hidden="true">/</span>
            </li>
            <li class="breadcrumb__item">
              <span class="breadcrumb__current" aria-current="page">Produtos</span>
            </li>
          </ol>
        </nav>

        <h1 id="catalog-title" class="catalog__title">
          Catálogo de <span class="catalog__title-accent">produtos</span>
        </h1>

        <p class="catalog__note">
          <span class="catalog__count" aria-live="polite"><?= (int) $catalog['total'] ?> produto<?= $catalog['total'] === 1 ? '' : 's' ?></span>
          <span>disponíveis para você</span>
        </p>
      </div>

      <?= nx_render_flash() ?>

      <div class="catalog__layout">

        <aside class="catalog__filters" aria-label="Filtros do catálogo">
          <div class="filters__head">
            <h2 class="filters__title">Filtros</h2>
            <?php if ($hasFilters): ?>
              <a href="produtos.php" class="filters__clear">Limpar filtros</a>
            <?php endif; ?>
          </div>

          <form action="produtos.php" method="get" class="filters__form">

            <div class="filters__search">
              <label class="sr-only" for="catalog-search">Buscar por nome, marca ou categoria</label>
              <input
                type="search"
                id="catalog-search"
                name="q"
                class="filters__search-input"
                placeholder="Buscar por nome, marca ou categoria..."
                value="<?= e($q) ?>"
              >
            </div>

            <fieldset class="filters__group">
              <legend class="filters__legend">Categoria</legend>
              <label class="filter-option">
                <input type="radio" name="category" value="" <?= $category === '' ? 'checked' : '' ?>>
                <span>Todas</span>
              </label>
              <?php foreach ($categories as $item): ?>
                <label class="filter-option">
                  <input type="radio" name="category" value="<?= e($item['slug']) ?>" <?= $category === $item['slug'] ? 'checked' : '' ?>>
                  <span><?= e($item['name']) ?> (<?= (int) $item['total'] ?>)</span>
                </label>
              <?php endforeach; ?>
            </fieldset>

            <fieldset class="filters__group">
              <legend class="filters__legend">Faixa de preço</legend>
              <?php foreach ($priceRanges as $key => $item): ?>
                <label class="filter-option">
                  <input type="radio" name="preco" value="<?= e($key) ?>" <?= $priceKey === $key ? 'checked' : '' ?>>
                  <span><?= e($item['label']) ?></span>
                </label>
              <?php endforeach; ?>
            </fieldset>

            <fieldset class="filters__group">
              <legend class="filters__legend">Disponibilidade</legend>
              <?php
              $availabilityOptions = ['all' => 'Todos', 'in' => 'Em estoque', 'out' => 'Esgotados'];
              foreach ($availabilityOptions as $key => $label):
              ?>
                <label class="filter-option">
                  <input type="radio" name="availability" value="<?= e($key) ?>" <?= $availability === $key ? 'checked' : '' ?>>
                  <span><?= e($label) ?></span>
                </label>
              <?php endforeach; ?>
            </fieldset>

            <input type="hidden" name="sort" value="<?= e($sort) ?>">

            <button type="submit" class="btn btn--primary btn--block">Aplicar filtros</button>
          </form>
        </aside>

        <div class="catalog__main">

          <div class="catalog__toolbar">
            <form action="produtos.php" method="get" class="catalog__sort">
              <?php foreach (['q' => $q, 'category' => $category, 'preco' => $priceKey !== 'all' ? $priceKey : '', 'availability' => $availability !== 'all' ? $availability : ''] as $name => $value): ?>
                <?php if ($value !== ''): ?>
                  <input type="hidden" name="<?= e($name) ?>" value="<?= e($value) ?>">
                <?php endif; ?>
              <?php endforeach; ?>
              <label class="catalog__sort-label" for="catalog-sort">Ordenar por</label>
              <select id="catalog-sort" name="sort" class="catalog__sort-select" data-autosubmit>
                <?php foreach ($sortOptions as $key => $label): ?>
                  <option value="<?= e($key) ?>" <?= $sort === $key ? 'selected' : '' ?>><?= e($label) ?></option>
                <?php endforeach; ?>
              </select>
              <noscript><button type="submit" class="btn btn--outline btn--sm">Ordenar</button></noscript>
            </form>
          </div>

          <?php if ($catalog['items'] === []): ?>
            <div class="catalog__empty" role="status">
              <p class="catalog__empty-title">
                <?= $q !== '' ? 'Nenhum produto encontrado para sua busca' : 'Nenhum produto encontrado' ?>
              </p>
              <p class="catalog__empty-text">Tente ajustar a pesquisa ou limpar os filtros para ver mais resultados.</p>
              <a href="produtos.php" class="btn btn--primary">Limpar filtros</a>
            </div>
          <?php else: ?>
            <div class="catalog__grid">
              <?= nx_product_grid($catalog['items'], '../') ?>
            </div>
          <?php endif; ?>

          <?php if ($catalog['pages'] > 1): ?>
            <nav class="pagination" aria-label="Paginação do catálogo">
              <ul class="pagination__list">
                <li>
                  <?php if ($catalog['page'] > 1): ?>
                    <a class="pagination__btn pagination__btn--nav" href="<?= e($buildUrl(['page' => $catalog['page'] - 1])) ?>" aria-label="Página anterior">Anterior</a>
                  <?php else: ?>
                    <span class="pagination__btn pagination__btn--nav is-disabled" aria-disabled="true">Anterior</span>
                  <?php endif; ?>
                </li>
                <?php for ($p = 1; $p <= $catalog['pages']; $p++): ?>
                  <li>
                    <?php if ($p === $catalog['page']): ?>
                      <span class="pagination__btn pagination__btn--page is-current" aria-current="page"><?= $p ?></span>
                    <?php else: ?>
                      <a class="pagination__btn pagination__btn--page" href="<?= e($buildUrl(['page' => $p])) ?>" aria-label="Página <?= $p ?>"><?= $p ?></a>
                    <?php endif; ?>
                  </li>
                <?php endfor; ?>
                <li>
                  <?php if ($catalog['page'] < $catalog['pages']): ?>
                    <a class="pagination__btn pagination__btn--nav" href="<?= e($buildUrl(['page' => $catalog['page'] + 1])) ?>" aria-label="Próxima página">Próxima</a>
                  <?php else: ?>
                    <span class="pagination__btn pagination__btn--nav is-disabled" aria-disabled="true">Próxima</span>
                  <?php endif; ?>
                </li>
              </ul>
            </nav>
          <?php endif; ?>

        </div>
      </div>
    </div>
  </section>
</main>
<?php require __DIR__ . '/../includes/footer.php'; ?>

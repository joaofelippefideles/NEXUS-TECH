/* ==========================================================================
   NEXUS TECH — Catálogo (Sprint 4)
   Orquestrador: mantém o estado da visão, monta os controles (busca, filtros,
   ordenação, paginação) e renderiza os resultados no grid.

   Arquitetura modular:
   - filter.js   → lógica pura (busca, filtros, ordenação, paginação)
   - render.js   → construção dos cards e estado vazio
   - controls.js → construção e sincronização dos controles de interface
   - catalog.js  → composição e ciclo de vida (este arquivo)

   Os controles são construídos UMA vez e apenas sincronizados nos renders,
   preservando o foco do usuário durante a digitação e a navegação por teclado.
   ========================================================================== */

import { products } from "../../data/products.js";
import { defaultState, queryCatalog, buildFacets } from "./filter.js";
import { renderCards, renderEmptyState, renderMeta } from "./render.js";
import {
  buildFilters,
  syncFilters,
  buildSort,
  syncSort,
  buildPagination,
} from "./controls.js";

function CatalogController(container) {
  const state = defaultState();
  const facets = buildFacets(products);

  const gridEl = container.querySelector("#product-grid");
  const countEl = container.querySelector("#product-count");
  const filtersRoot = container.querySelector("#catalog-filters");
  const sortRoot = container.querySelector("#catalog-sort-root");
  const paginationRoot = container.querySelector("#catalog-pagination");

  if (!gridEl) return null;

  /* --- Construção única dos controles --- */
  let filterHandles = null;
  let sortHandle = null;

  if (filtersRoot) {
    filterHandles = buildFilters(facets, state, {
      onApply: (patch, opts) => {
        Object.assign(state, patch);
        if (opts && opts.resetPage) {
          state.page = 1;
        }
        render();
      },
      onClear: clearFilters,
    });
    filtersRoot.appendChild(filterHandles.root);
  }

  if (sortRoot) {
    sortHandle = buildSort(state, {
      onSort: (value) => {
        state.sort = value;
        state.page = 1;
        render();
      },
    });
    sortRoot.appendChild(sortHandle.root);
  }

  /* --- Renderização cíclica --- */
  function render() {
    const result = queryCatalog(products, state);
    state.page = result.page;

    if (countEl) {
      renderMeta(countEl, result.from, result.to, result.total);
    }

    if (result.items.length > 0) {
      renderCards(gridEl, result.items);
    } else {
      renderEmptyState(gridEl, state.query.trim().length > 0);
    }

    if (paginationRoot) {
      buildPagination(paginationRoot, result, state, {
        onGoPage: (page) => {
          state.page = page;
          render();
        },
      });
    }

    if (filterHandles) syncFilters(filterHandles, state);
    if (sortHandle) syncSort(sortHandle, state);
  }

  function clearFilters() {
    state.query = "";
    state.categories = [];
    state.priceRange = "all";
    state.availability = "all";
    state.sort = "relevance";
    state.page = 1;
    render();
  }

  /* Inicialização */
  render();
  return { render, clearFilters };
}

const root = document.getElementById("catalog-app");
if (root) {
  CatalogController(root);
}

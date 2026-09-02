# NEXUS TECH

**Tecnologia que conecta você ao futuro.**

E-commerce de produtos de tecnologia e informática, construído com HTML5, CSS3 e JavaScript puro.

---

## Sumário

- [Objetivo](#objetivo)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Roadmap](#roadmap)
- [Sprints](#sprints)
- [Execução local](#execução-local)
- [Planejamento preservado](#planejamento-preservado)

---

## Objetivo

Desenvolver uma loja virtual moderna, profissional e responsiva voltada para produtos de tecnologia, utilizando somente HTML, CSS e JavaScript. O projeto simula a experiência de uma loja real — catálogo, busca, filtros, página de produto, carrinho e checkout — com dados mockados no frontend e arquitetura preparada para evoluir para backend/API futuramente.

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura semântica das páginas |
| CSS3 | Layout, responsividade, animações e identidade visual |
| JavaScript (ES6+) | Módulos, carrinho, filtros, busca e interações |
| LocalStorage | Persistência de carrinho e favoritos |

Nenhuma dependência externa. Projeto 100% vanilla.

---

## Arquitetura

Separação de responsabilidades em três camadas no frontend:

- **Apresentação (HTML)** — estrutura semântica, sem lógica de negócio.
- **Estilo (CSS)** — design system via variáveis CSS (tokens), modularizado por página.
- **Comportamento (JS)** — módulos ES6 responsáveis por domínio (produtos, carrinho, checkout, usuário) + utilitários (storage, busca, filtros).

Princípio-chave: os módulos JS conversam via um **ponto de entrada (`app.js`)** e leem dados através de **uma única camada de dados (`data/products.js`)**. Isso permite trocar a fonte de dados (mock → API real) sem refazer as páginas.

---

## Estrutura de pastas

```
NEXUS TECH/
│
├── index.html                  → Home
├── README.md                   → Documentação
│
├── pages/                      → Páginas internas (criadas nas próximas Sprints)
│
├── assets/
│   ├── css/
│   │   ├── tokens.css          → Design tokens (cores, tipografia, espaços, raio, sombras, breakpoints)
│   │   ├── base.css            → Reset, estilos globais, tipografia e acessibilidade base
│   │   └── style.css           → Cascata de entrada (importa tokens + base)
│   │
│   ├── js/
│   │   ├── data/               → Camada de dados (mock → API futura)
│   │   ├── modules/            → Módulos de domínio (cart, checkout, auth, etc.)
│   │   └── utils/              → Helpers reutilizáveis (format, ui)
│   │
│   └── img/
│       ├── logo/
│       ├── banners/
│       └── products/
│
└── (futuro) server/            → Backend + banco + API (fora do escopo inicial)
```

---

## Roadmap

1. **Sprint 1** — Arquitetura + design system (tokens.css, base.css) + estrutura base + README.
2. **Sprint 2** — Header, menu, busca, footer, banner e Home (categorias/destaques/ofertas/mais vendidos).
3. **Sprint 3** — Dados mock dos produtos + render de cards + catálogo.
4. **Sprint 4** — Busca + filtros + ordenação + paginação.
5. **Sprint 5** — Página de produto + galeria + favoritos.
6. **Sprint 6** — Carrinho completo + LocalStorage.
7. **Sprint 7** — Checkout + usuário (login/cadastro/perfil).
8. **Sprint 8** — Responsividade fina + acessibilidade + validações + SEO + performance.
9. **Sprint 9** — Revisão final + otimização + documentação.

---

## Sprints

| Sprint | Escopo |
|---|---|
| 1 | Arquitetura, design system, estrutura base + README |
| 2 | Header, menu, busca, footer, banner, Home |
| 3 | Dados mock + cards + catálogo |
| 4 | Busca + filtros + ordenação + paginação |
| 5 | Página de produto + galeria + favoritos |
| 6 | Carrinho + LocalStorage |
| 7 | Checkout + usuário |
| 8 | Responsividade + acessibilidade + SEO + performance |
| 9 | Revisão final + otimização + documentação |

---

## Execução local

Como o projeto usa **módulos JavaScript ES6** (`type="module"`), recomenda-se servir os arquivos por um servidor estático local.

**Opção 1 — Python (se instalado):**
```bash
cd "NEXUS TECH"
python -m http.server 8080
```
Acesse `http://localhost:8080`.

**Opção 2 — Extensão Live Server (VS Code):**
Clique com o botão direito em `index.html` → **Open with Live Server**.

**Opção 3 — Qualquer servidor estático** de sua preferência.

---

## Planejamento preservado

O conteúdo do documento de planejamento original está preservado abaixo para referência.

---

## 1. Objetivo do Projeto

Desenvolver um e-commerce moderno e responsivo voltado para produtos de tecnologia, utilizando HTML, CSS e JavaScript. O projeto simula a experiência de uma loja virtual real, contendo catálogo, busca, carrinho, página de produto e checkout.

## 2. Tecnologias

- **HTML5** — Estrutura das páginas e conteúdo.
- **CSS3** — Layout, responsividade, animações e identidade visual.
- **JavaScript** — Carrinho, filtros, busca, produtos e interações.
- **LocalStorage** — Armazenamento temporário do carrinho e favoritos.

## 3. Estrutura de Páginas

- **Home** — Banner, categorias, ofertas e produtos em destaque.
- **Produtos** — Catálogo completo com filtros e ordenação.
- **Produto** — Detalhes, imagens, preço e especificações.
- **Carrinho** — Produtos selecionados, quantidades e valores.
- **Checkout** — Endereço, entrega, pagamento e resumo do pedido.
- **Login** — Acesso e cadastro do cliente.

## 4. Funcionalidades

- Menu de navegação responsivo
- Busca de produtos
- Filtro por categoria
- Filtro por faixa de preço
- Ordenação de produtos
- Página individual do produto
- Adicionar produto ao carrinho
- Alterar quantidade
- Remover produto do carrinho
- Calcular subtotal
- Favoritar produtos
- Salvar carrinho usando LocalStorage
- Layout responsivo
- Tema claro e escuro

## 5. Categorias

Notebooks · Monitores · Teclados · Mouses · Headsets · Celulares · Games · Acessórios

## 6. Estrutura de Pastas (referência original)

```
nexus-tech/
│
├── index.html
│
├── pages/
│   ├── produtos.html
│   ├── produto.html
│   ├── carrinho.html
│   ├── checkout.html
│   └── login.html
│
├── assets/
│   ├── css/
│   ├── js/
│   └── img/
│
└── README.md
```

## 7. Etapas do Projeto

1. Estrutura inicial, header, menu, banner e identidade visual.
2. Cards de produtos, categorias e catálogo.
3. Página do produto, filtros e sistema de busca.
4. Carrinho usando JavaScript e LocalStorage.
5. Checkout, login e finalização da interface.
6. Responsividade, testes e correções finais.

---

## Licença

Projeto acadêmico — uso livre para fins educacionais.

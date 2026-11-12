-- ==========================================================================
-- NEXUS TECH — Instalação completa do banco (MySQL / MariaDB / XAMPP)
-- --------------------------------------------------------------------------
-- Cria o banco nexus_tech_db e TODAS as tabelas usadas pela aplicação:
--   loja + admin + autenticação + perfil + pedidos + auditoria.
--
-- COMO IMPORTAR (XAMPP):
--   1) Inicie o Apache e o MySQL no painel do XAMPP;
--   2) Abra http://localhost/phpmyadmin;
--   3) aba "Importar" -> selecione este arquivo -> Executar;
--   (ou) mysql -u root < database/script.sql
--
-- CREDENCIAIS DE DEMONSTRAÇÃO (senha com bcrypt no banco):
--   Admin    -> admin@nexustech.com    / Admin@123
--   Cliente  -> cliente@nexustech.com  / Cliente@123
--   TROQUE ESSAS SENHAS antes de publicar o site.
--
-- O script é repetível: usa CREATE ... IF NOT EXISTS e INSERT IGNORE no
-- catálogo. Os usuários de demonstração são atualizados pelo e-mail (para
-- garantir que as credenciais acima funcionem após uma reinstalação).
--
-- Charset: utf8mb4 / utf8mb4_unicode_ci (compatível com MariaDB do XAMPP).
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS nexus_tech_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nexus_tech_db;

/* -------------------------------------------------------------------------- */
/* brands                                                                     */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS brands (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_brands_name (name),
  UNIQUE KEY uq_brands_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* categories                                                                 */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS categories (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* products                                                                   */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS products (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug            VARCHAR(140) NOT NULL,
  name            VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  brand_id        INT UNSIGNED NOT NULL,
  category_id     INT UNSIGNED NOT NULL,
  price_cents     INT NOT NULL COMMENT 'Preço em centavos (nunca float/double)',
  old_price_cents INT NULL COMMENT 'Preço antigo em centavos (promoção)',
  rating          DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  rating_count    INT UNSIGNED NOT NULL DEFAULT 0,
  is_featured     TINYINT(1) NOT NULL DEFAULT 0,
  is_new          TINYINT(1) NOT NULL DEFAULT 0,
  is_bestseller   TINYINT(1) NOT NULL DEFAULT 0,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_brand_id (brand_id),
  KEY idx_products_category_id (category_id),
  KEY idx_products_price_cents (price_cents),
  KEY idx_products_rating (rating),
  KEY idx_products_is_active (is_active),
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id)
    REFERENCES brands (id) ON UPDATE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* product_images                                                             */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS product_images (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  url        VARCHAR(255) NOT NULL,
  alt        VARCHAR(200) NULL,
  position   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_product_id (product_id),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* product_specs (EAV: label/value por produto)                               */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS product_specs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  label      VARCHAR(120) NOT NULL,
  value      VARCHAR(255) NOT NULL,
  position   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_specs_product_id (product_id),
  CONSTRAINT fk_product_specs_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* inventory                                                                  */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS inventory (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  quantity   INT NOT NULL DEFAULT 0 COMMENT 'Estoque em unidades',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_product_id (product_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_inventory_quantity_non_negative CHECK (quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* users (cliente + admin)                                                    */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* user_profile                                                               */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS user_profile (
  user_id    INT UNSIGNED NOT NULL,
  phone      VARCHAR(20) NULL,
  cpf        VARCHAR(14) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_profile_cpf (cpf),
  CONSTRAINT fk_user_profile_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* refresh_tokens (somente hash SHA-256; cookie httpOnly no navegador)        */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* admin_actions (auditoria; nunca guarda senha/token)                        */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS admin_actions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id    INT UNSIGNED NOT NULL,
  action      VARCHAR(40) NOT NULL,
  entity      VARCHAR(40) NOT NULL,
  entity_id   INT UNSIGNED NULL,
  before_data JSON NULL,
  after_data  JSON NULL,
  ip          VARCHAR(45) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_actions_admin (admin_id),
  KEY idx_admin_actions_entity (entity, entity_id),
  CONSTRAINT fk_admin_actions_admin FOREIGN KEY (admin_id)
    REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* orders                                                                     */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS orders (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code                   VARCHAR(16) NOT NULL,
  user_id                INT UNSIGNED NOT NULL,
  status                 ENUM('processing','paid','shipped','cancelled') NOT NULL DEFAULT 'processing',
  subtotal_cents         INT NOT NULL,
  shipping_cents         INT NOT NULL DEFAULT 0,
  total_cents            INT NOT NULL,
  item_count             INT UNSIGNED NOT NULL,
  delivery_method        ENUM('standard','express') NOT NULL,
  delivery_label         VARCHAR(40) NOT NULL,
  payment_method         ENUM('credit','pix','boleto') NOT NULL,
  payment_label          VARCHAR(40) NOT NULL,
  delivery_name          VARCHAR(120) NOT NULL,
  delivery_email         VARCHAR(190) NOT NULL,
  cep                    VARCHAR(9) NOT NULL,
  street                 VARCHAR(120) NOT NULL,
  number                 VARCHAR(20) NOT NULL,
  complement             VARCHAR(120) NULL,
  neighborhood           VARCHAR(120) NOT NULL,
  city                   VARCHAR(120) NOT NULL,
  state                  VARCHAR(2) NOT NULL,
  client_idempotency_key VARCHAR(64) NOT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (code),
  UNIQUE KEY uq_orders_user_idempotency (user_id, client_idempotency_key),
  KEY idx_orders_user_created (user_id, created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* -------------------------------------------------------------------------- */
/* order_items (snapshot do nome/preço no momento da compra)                  */
/* -------------------------------------------------------------------------- */
CREATE TABLE IF NOT EXISTS order_items (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id         INT UNSIGNED NOT NULL,
  product_id       INT UNSIGNED NOT NULL,
  product_name     VARCHAR(200) NOT NULL,
  unit_price_cents INT NOT NULL,
  quantity         INT UNSIGNED NOT NULL,
  total_cents      INT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_product_id (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================================
-- DADOS DE DEMONSTRAÇÃO
-- ==========================================================================

/* Marca */
INSERT IGNORE INTO brands (id, name, slug) VALUES
  (1, 'Nexus', 'nexus');

/* Categorias */
INSERT IGNORE INTO categories (id, name, slug) VALUES
  (1,  'Notebooks',  'notebooks'),
  (2,  'Monitores',  'monitores'),
  (3,  'Teclados',   'teclados'),
  (4,  'Headsets',   'headsets'),
  (5,  'Celulares',  'celulares'),
  (6,  'Mouses',     'mouses'),
  (7,  'Acessórios', 'acessorios'),
  (8,  'Games',      'games'),
  (9,  'Áudio',      'audio'),
  (10, 'Tablets',    'tablets');

/* Produtos (preços em centavos) */
INSERT IGNORE INTO products
  (id, slug, name, description, brand_id, category_id, price_cents, old_price_cents,
   rating, rating_count, is_featured, is_new, is_bestseller, is_active) VALUES
  (1, 'notebook-nexus-a15', 'Notebook Nexus A15',
   'Notebook com processador de última geração, ideal para estudos, trabalho e tarefas do dia a dia.',
   1, 1, 399990, 459990, 4.6, 128, 1, 0, 0, 1),
  (2, 'notebook-nexus-ultra-pro', 'Notebook Nexus Ultra Pro',
   'Performance máxima para criação de conteúdo, games e programação pesada.',
   1, 1, 719990, 799990, 4.9, 421, 1, 1, 0, 1),
  (3, 'monitor-nexus-27-qhd', 'Monitor Nexus 27" QHD',
   'Imagem nítida em 2K com alta taxa de atualização, perfeito para trabalho e games.',
   1, 2, 104990, 129990, 4.4, 86, 1, 0, 0, 1),
  (4, 'teclado-mecanico-nexus-rgb', 'Teclado Mecânico Nexus RGB',
   'Switches mecânicos com iluminação RGB personalizável e teclas em português.',
   1, 3, 39990, 49990, 4.8, 312, 1, 0, 0, 1),
  (5, 'headset-gamer-nexus-pro', 'Headset Gamer Nexus Pro',
   'Som surround imersivo, microfone removível e conforto para longas sessões de jogo.',
   1, 4, 29990, NULL, 4.9, 540, 1, 0, 1, 1),
  (6, 'celular-nexus-x20', 'Celular Nexus X20',
   'Câmera versátil, tela imersiva e bateria de longa duração para o dia inteiro.',
   1, 5, 249990, 299990, 4.5, 920, 1, 0, 1, 1),
  (7, 'mouse-gamer-nexus-m1', 'Mouse Gamer Nexus M1',
   'Sensor de alta precisão, leve e com botões programáveis para domínio total no game.',
   1, 6, 14990, NULL, 4.7, 780, 0, 1, 1, 1),
  (8, 'webcam-nexus-hd', 'Webcam Nexus HD 1080p',
   'Vídeo em Full HD com foco automático e microfone integrado para chamadas e lives.',
   1, 7, 19990, 25990, 4.3, 154, 0, 0, 0, 1),
  (9, 'console-nexus-game-s', 'Console Nexus Game S',
   'Console de nova geração com carregamento rápido e catálogo exclusivo de jogos.',
   1, 8, 349990, 399990, 4.8, 266, 0, 1, 0, 1),
  (10, 'som-nexus-bt-go', 'Caixa de Som Nexus BT Go',
   'Compacta, resistente à água e com som potente para levar onde quiser.',
   1, 9, 12990, 16990, 4.2, 138, 0, 0, 0, 1),
  (11, 'carregador-rapido-nexus-65w', 'Carregador Rápido Nexus 65W',
   'Carregue notebook, celular e tablet rapidamente com tecnologia GaN de alta eficiência.',
   1, 7, 15990, NULL, 4.6, 209, 0, 0, 0, 1),
  (12, 'tablet-nexus-tab10', 'Tablet Nexus Tab 10',
   'Tela de 10 polegadas, ideal para leitura, estudos e entretenimento no sofá.',
   1, 10, 139990, 169990, 4.4, 97, 0, 0, 0, 1);

/* Imagens (nomes de arquivo usados pelo catálogo) */
INSERT IGNORE INTO product_images (id, product_id, url, alt, position) VALUES
  (1,  1,  'notebook-a15.svg',   'Notebook Nexus A15',          0),
  (2,  2,  'notebook-ultra.svg', 'Notebook Nexus Ultra Pro',    0),
  (3,  3,  'monitor-27.svg',     'Monitor Nexus 27" QHD',       0),
  (4,  4,  'teclado-rgb.svg',    'Teclado Mecânico Nexus RGB',  0),
  (5,  5,  'headset-pro.svg',    'Headset Gamer Nexus Pro',     0),
  (6,  6,  'celular-x20.svg',    'Celular Nexus X20',           0),
  (7,  7,  'mouse-m1.svg',       'Mouse Gamer Nexus M1',        0),
  (8,  8,  'webcam-hd.svg',      'Webcam Nexus HD 1080p',       0),
  (9,  9,  'console-s.svg',      'Console Nexus Game S',        0),
  (10, 10, 'som-bt.svg',         'Caixa de Som Nexus BT Go',    0),
  (11, 11, 'carregador-65w.svg', 'Carregador Rápido Nexus 65W', 0),
  (12, 12, 'tablet-tab10.svg',   'Tablet Nexus Tab 10',         0);

/* Especificações (EAV) */
INSERT IGNORE INTO product_specs (id, product_id, label, value, position) VALUES
  (1, 1, 'Processador', 'Ryzen 7', 0),
  (2, 1, 'Memória RAM', '16 GB', 1),
  (3, 1, 'Armazenamento', 'SSD 512 GB', 2),
  (4, 1, 'Tela', '15.6" Full HD', 3),
  (5, 2, 'Processador', 'Core i9', 0),
  (6, 2, 'Memória RAM', '32 GB', 1),
  (7, 2, 'Armazenamento', 'SSD 1 TB', 2),
  (8, 2, 'Tela', '16" 2K', 3),
  (9, 3, 'Tamanho', '27 polegadas', 0),
  (10, 3, 'Resolução', 'QHD 2K', 1),
  (11, 3, 'Taxa', '165 Hz', 2),
  (12, 3, 'Painel', 'IPS', 3),
  (13, 4, 'Tipo', 'Mecânico', 0),
  (14, 4, 'Layout', 'ABNT2', 1),
  (15, 4, 'Iluminação', 'RGB', 2),
  (16, 4, 'Conectividade', 'USB-C', 3),
  (17, 5, 'Tipo', 'Headset gamer', 0),
  (18, 5, 'Microfone', 'Removível', 1),
  (19, 5, 'Conectividade', 'USB/P3', 2),
  (20, 5, 'Som', 'Surround 7.1', 3),
  (21, 6, 'Tela', '6.5" OLED', 0),
  (22, 6, 'Câmera', '108 MP', 1),
  (23, 6, 'Bateria', '5.000 mAh', 2),
  (24, 6, 'Memória', '256 GB', 3),
  (25, 7, 'Sensor', '16.000 DPI', 0),
  (26, 7, 'Peso', '69 g', 1),
  (27, 7, 'Botões', '6 programáveis', 2),
  (28, 7, 'Iluminação', 'RGB', 3),
  (29, 8, 'Resolução', '1080p', 0),
  (30, 8, 'Microfone', 'Integrado', 1),
  (31, 8, 'Foco', 'Automático', 2),
  (32, 8, 'Conectividade', 'USB', 3),
  (33, 9, 'Armazenamento', 'SSD 1 TB', 0),
  (34, 9, 'Resolução', '4K', 1),
  (35, 9, 'Controle', 'Sem fio', 2),
  (36, 9, 'Gráficos', 'Ray tracing', 3),
  (37, 10, 'Potência', '20 W', 0),
  (38, 10, 'Bluetooth', '5.3', 1),
  (39, 10, 'Proteção', 'IPX7', 2),
  (40, 10, 'Bateria', '12 h', 3),
  (41, 11, 'Potência', '65 W', 0),
  (42, 11, 'Tecnologia', 'GaN', 1),
  (43, 11, 'Portas', '2x USB-C', 2),
  (44, 11, 'Compatível', 'Notebook/Celular', 3),
  (45, 12, 'Tela', '10.4"', 0),
  (46, 12, 'Memória', '128 GB', 1),
  (47, 12, 'Sistema', 'Android', 2),
  (48, 12, 'Bateria', '8.000 mAh', 3);

/* Estoque (0 = esgotado) */
INSERT IGNORE INTO inventory (product_id, quantity) VALUES
  (1, 24),
  (2, 12),
  (3, 0),
  (4, 57),
  (5, 33),
  (6, 41),
  (7, 88),
  (8, 19),
  (9, 9),
  (10, 62),
  (11, 0),
  (12, 28);

-- --------------------------------------------------------------------------
-- Usuários de demonstração.
-- Hashes bcrypt (custo 12) gerados e verificados com PHP:
--   Admin@123   -> $2b$12$1R33EDY4ahSWAQfmWgbz2O6ykPnmiQ4unAqRAJeElTMZRyfPGXg7S
--   Cliente@123 -> $2b$12$NdNubmx4BEC14uX9YrdzUOH4iaTGTtFDP/ANK.4rQKJZca00676je
-- O ON DUPLICATE KEY UPDATE garante que as credenciais funcionem mesmo se
-- o e-mail já existir de uma execução anterior.
-- --------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role, is_active) VALUES
  ('Administrador Nexus', 'admin@nexustech.com',
   '$2b$12$1R33EDY4ahSWAQfmWgbz2O6ykPnmiQ4unAqRAJeElTMZRyfPGXg7S', 'admin', 1),
  ('Cliente Demonstração', 'cliente@nexustech.com',
   '$2b$12$NdNubmx4BEC14uX9YrdzUOH4iaTGTtFDP/ANK.4rQKJZca00676je', 'customer', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  is_active = VALUES(is_active);

-- ==========================================================================
-- FIM DA INSTALAÇÃO
-- ==========================================================================

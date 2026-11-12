<?php
declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Sobre a Nexus Tech — Quem Somos';
$pageDesc = 'Conheça a Nexus Tech: nossa história, missão, visão e valores. Tecnologia que conecta você ao futuro.';
$bodyPage = 'about';
$extraScripts = '';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/components.php';
require __DIR__ . '/../includes/header.php';
?>

<main>
    <section class="institutional" aria-labelledby="about-title">
      <div class="container">

        <div class="institutional__header">

          <nav class="breadcrumb" aria-label="Trilha de navegação">
            <ol class="breadcrumb__list">
              <li class="breadcrumb__item">
                <a href="../index.php" class="breadcrumb__link">Home</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <a href="sobre.php" class="breadcrumb__link">Institucional</a>
                <span class="breadcrumb__separator" aria-hidden="true">/</span>
              </li>
              <li class="breadcrumb__item">
                <span class="breadcrumb__current" aria-current="page">Sobre nós</span>
              </li>
            </ol>
          </nav>

          <h1 id="about-title" class="institutional__title">
            Sobre a <span class="institutional__title-accent">Nexus Tech</span>
          </h1>

          <p class="institutional__lead">
            Tecnologia que conecta você ao futuro.
          </p>

        </div>

        
        <section class="about-section" aria-labelledby="about-history">
          <div class="about-story">

            <div class="about-story__text">
              <h2 id="about-history" class="about-section__title">Quem somos</h2>
              <p>
                A Nexus Tech nasceu com um propósito claro: facilitar o acesso à
                tecnologia de qualidade no Brasil. O que começou como uma pequena
                vitrine de informática cresceu e se tornou uma referência em
                notebooks, componentes, periféricos e acessórios para quem vive
                conectado.
              </p>
              <p>
                Combinamos curadoria de produtos, preços justos e atendimento próximo
                para construir uma experiência de compra simples e confiável. Cada
                item do nosso catálogo passa por uma seleção criteriosa para garantir
                que você encontre exatamente o que precisa — do estudante ao gamer,
                do escritório ao home office.
              </p>
              <p>
                Estamos em constante evolução: novas categorias, parcerias e
                funcionalidades chegando a cada etapa do projeto.
              </p>
            </div>

            <aside class="about-statement" aria-label="Conceito da Nexus Tech">
              <p class="about-statement__concept">
                Tecnologia que conecta
                <span class="about-statement__concept-accent">você ao futuro.</span>
              </p>
              <p>
                Esse é o nosso conceito: entregar inovação de forma acessível, para
                que a tecnologia do amanhã esteja ao seu alcance hoje.
              </p>
            </aside>

          </div>
        </section>

        
        <section class="about-section" aria-labelledby="about-mvv">
          <h2 id="about-mvv" class="about-section__title">Missão, visão e valores</h2>

          <div class="about-mvv">

            <div class="about-mvv__card">
              <h3 class="about-mvv__title">Missão</h3>
              <p class="about-mvv__text">
                Conectar pessoas às melhores tecnologias, oferecendo produtos de
                qualidade, preço justo e uma experiência de compra simples, segura
                e transparente.
              </p>
            </div>

            <div class="about-mvv__card">
              <h3 class="about-mvv__title">Visão</h3>
              <p class="about-mvv__text">
                Ser referência em tecnologia no Brasil, conhecida pela curadoria
                confiável e por antecipar as necessidades de quem vive conectado.
              </p>
            </div>

            <div class="about-mvv__card">
              <h3 class="about-mvv__title">Valores</h3>
              <p class="about-mvv__text">
                Transparência, inovação, respeito ao cliente, compromisso com a
                qualidade e responsabilidade social e ambiental.
              </p>
            </div>

          </div>
        </section>

        
        <section class="about-section" aria-labelledby="about-values">
          <h2 id="about-values" class="about-section__title">O que valorizamos</h2>

          <div class="about-values">

            <div class="about-value">
              <h3 class="about-value__title">Transparência</h3>
              <p class="about-value__desc">
                Preço claro, prazos informados e políticas simples de entender em cada etapa da compra.
              </p>
            </div>

            <div class="about-value">
              <h3 class="about-value__title">Inovação</h3>
              <p class="about-value__desc">
                Acompanhamos as tendências do mercado para trazer os lançamentos e as melhores tecnologias.
              </p>
            </div>

            <div class="about-value">
              <h3 class="about-value__title">Qualidade</h3>
              <p class="about-value__desc">
                Curadoria criteriosa e controle de estoque para oferecer somente produtos selecionados.
              </p>
            </div>

          </div>
        </section>

        
        <section class="about-section" aria-labelledby="about-cta">
          <div class="alert alert--info">
            <p>
              Explore o catálogo e encontre o produto ideal para você:
              <a href="produtos.php">ver produtos</a>.
            </p>
          </div>
        </section>

      </div>
    </section>
  </main>

<?php require __DIR__ . '/../includes/footer.php'; ?>
<?php
declare(strict_types=1);

$root = '../';
$active = '';
$pageTitle = 'Política de Privacidade — Nexus Tech';
$pageDesc = 'Política de privacidade da Nexus Tech: coleta e uso de dados, cookies e localStorage, segurança, compartilhamento e direitos do usuário.';
$bodyPage = 'privacy';
$extraScripts = '';

require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/components.php';
require __DIR__ . '/../includes/header.php';
?>

<main>
    <section class="institutional" aria-labelledby="privacy-title">
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
                <span class="breadcrumb__current" aria-current="page">Política de Privacidade</span>
              </li>
            </ol>
          </nav>

          <h1 id="privacy-title" class="institutional__title">
            Política de <span class="institutional__title-accent">Privacidade</span>
          </h1>

        </div>

        <div class="legal-document">

          <p class="legal-document__date">
            Última atualização: 08 de setembro de 2026.
          </p>

          <section aria-labelledby="priv-intro">
            <h2 id="priv-intro">1. Introdução</h2>
            <p>
              A Nexus Tech valoriza a privacidade de seus visitantes e clientes.
              Esta política descreve, de forma transparente, como tratamos as
              informações coletadas no nosso site, quais dados usamos e quais são
              os seus direitos.
            </p>
            <p>
              Esta é a <strong>estrutura da nossa política de privacidade</strong>.
              Como o projeto ainda está em desenvolvimento e a integração com o
              banco de dados e a área da conta ainda não foram liberadas, alguns
              itens descrevem como o tratamento será conduzido
              <strong>quando essas funcionalidades forem ativadas</strong>.
            </p>
          </section>

          <section aria-labelledby="priv-coleta">
            <h2 id="priv-coleta">2. Coleta de dados</h2>
            <p>
              Atualmente, o site funciona com dados de demonstração (catálogo e
              produtos fictícios) e com armazenamento local no seu navegador.
            </p>
            <h3>Dados que você fornece</h3>
            <ul>
              <li>
                <strong>Carrinho e favoritos:</strong> produtos escolhidos são
                salvos localmente no seu navegador (localStorage) para que sua
                seleção seja mantida entre visitas.
              </li>
              <li>
                <strong>Formulário de contato:</strong> o formulário atual é apenas
                uma simulação — nenhum dado é enviado ou armazenado em nossos
                servidores.
              </li>
            </ul>
            <h3>Dados que poderemos coletar no futuro</h3>
            <ul>
              <li>Nome, e-mail, CPF e dados de entrega na criação da conta e no checkout;</li>
              <li>Histórico de pedidos, preferências e interações com o catálogo;</li>
              <li>Informações técnicas de navegação (como navegador e endereço IP).</li>
            </ul>
          </section>

          <section aria-labelledby="priv-uso">
            <h2 id="priv-uso">3. Uso das informações</h2>
            <p>As informações coletadas serão utilizadas para:</p>
            <ul>
              <li>Processar, entregar e acompanhar pedidos;</li>
              <li>Melhorar a experiência de navegação e a curadoria do catálogo;</li>
              <li>Personalizar ofertas e recomendações de produtos;</li>
              <li>Enviar comunicações sobre pedidos e novidades (com seu consentimento);</li>
              <li>Garantir segurança e prevenir fraudes.</li>
            </ul>
            <p>
              Não utilizamos seus dados para finalidades incompatíveis com as
              descritas nesta política.
            </p>
          </section>

          <section aria-labelledby="priv-cookies">
            <h2 id="priv-cookies">4. Cookies e localStorage</h2>
            <p>
              Utilizamos o <strong>localStorage</strong> do navegador para guardar
              o conteúdo do carrinho e os favoritos. Esses dados ficam apenas no
              seu dispositivo e podem ser apagados por você a qualquer momento,
              limpando os dados de navegação do navegador.
            </p>
            <p>
              Quando a integração com o backend for ativada, poderemos utilizar
              cookies de sessão e autenticação para manter você conectado e
              lembrar suas preferências. Você pode configurar seu navegador para
              recusar cookies, o que pode limitar algumas funcionalidades.
            </p>
          </section>

          <section aria-labelledby="priv-seguranca">
            <h2 id="priv-seguranca">5. Segurança</h2>
            <p>
              Adotamos boas práticas de segurança para proteger as informações:
            </p>
            <ul>
              <li>Conexão segura (HTTPS) em toda a navegação;</li>
              <li>Privilégios de acesso restritos aos responsáveis pelo tratamento;</li>
              <li>Armazenamento de senhas com técnicas modernas de criptografia (quando houver contas);</li>
              <li>Revisão periódica das medidas de proteção.</li>
            </ul>
            <p>
              Nenhum método de transmissão ou armazenamento é 100% seguro, mas nos
              empenhamos em proteger suas informações.
            </p>
          </section>

          <section aria-labelledby="priv-compartilhamento">
            <h2 id="priv-compartilhamento">6. Compartilhamento de dados</h2>
            <p>
              Não vendemos nem alugamos dados pessoais. As informações poderão ser
              compartilhadas somente quando necessário para:
            </p>
            <ul>
              <li>Execução do pedido (transportadoras, meios de pagamento e emissão de nota fiscal);</li>
              <li>Cumprimento de obrigação legal ou regulatória;</li>
              <li>Prevenção de fraudes e segurança, com parceiros autorizados.</li>
            </ul>
            <p>
              Tais terceiros estão igualmente comprometidos com a proteção dos
              dados conforme a legislação aplicável.
            </p>
          </section>

          <section aria-labelledby="priv-direitos">
            <h2 id="priv-direitos">7. Direitos do usuário</h2>
            <p>
              Nos termos da Lei Geral de Proteção de Dados (LGPD — Lei nº
              13.709/2018), você pode solicitar, a qualquer momento:
            </p>
            <ul>
              <li>Confirmação da existência de tratamento de seus dados;</li>
              <li>Acesso, correção ou atualização dos dados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Revogação de consentimento;</li>
              <li>Portabilidade dos dados, nos termos da lei.</li>
            </ul>
            <p>
              Você também pode apagar os dados armazenados localmente no seu
              navegador a qualquer momento.
            </p>
          </section>

          <section aria-labelledby="priv-contato-sec">
            <h2 id="priv-contato-sec">8. Contato</h2>
            <p>
              Para exercer seus direitos ou tirar dúvidas sobre esta política,
              entre em contato pelo e-mail
              <a href="mailto:privacidade@nexustech.com.br">privacidade@nexustech.com.br</a>
              ou pela página de <a href="contato.php">contato</a>.
            </p>
            <p>
              Podemos atualizar esta política periodicamente. Sempre que houver
              mudanças relevantes, a data de atualização no topo desta página será
              revisada.
            </p>
          </section>

        </div>

      </div>
    </section>
  </main>

<?php require __DIR__ . '/../includes/footer.php'; ?>
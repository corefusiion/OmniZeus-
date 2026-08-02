import {
  LegalLayout,
  LegalSection,
  LegalSubSection,
  LegalP,
  LegalUl,
  LegalNote,
} from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Política de Privacidade — OmniZeus",
  description:
    "Como a plataforma OmniZeus coleta, utiliza, armazena e protege os dados pessoais e empresariais.",
};

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalLayout current="Política de Privacidade">
      <LegalSection id="introducao" title="1. Introdução">
        <LegalP>
          Esta Política de Privacidade descreve como a plataforma OmniZeus coleta, utiliza,
          armazena e protege os dados pessoais e empresariais tratados durante a operação do
          serviço, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)
          e demais normas aplicáveis.
        </LegalP>
        <LegalP>
          A plataforma é contratada por empresas para uso profissional. Os dados tratados incluem
          informações de usuários (Gestores e Funcionários) e dados operacionais e financeiros
          cadastrados pela empresa, além de dados recebidos por meio de integrações autorizadas.
        </LegalP>
      </LegalSection>

      <LegalSection id="dados-coletados" title="2. Dados que Podemos Coletar">
        <LegalSubSection title="Dados cadastrais">
          <LegalUl
            items={[
              "Nome, e-mail, cargo e função de usuários cadastrados pelo Gestor.",
              "Dados de identificação da empresa contratante: razão social, nome fantasia, CNPJ, cidade e estado.",
              "Plano contratado e status da assinatura.",
            ]}
          />
        </LegalSubSection>

        <LegalSubSection title="Dados de autenticação">
          <LegalUl
            items={[
              "Identificador interno do usuário e credenciais de acesso (senha armazenada exclusivamente em formato protegido por função de derivação de chave).",
              "Informações da sessão autenticada e registros de acesso (incluindo data e hora do login).",
            ]}
          />
        </LegalSubSection>

        <LegalSubSection title="Dados de utilização">
          <LegalUl
            items={[
              "Funcionalidades utilizadas e histórico de atividades registrado em logs de auditoria.",
              "Histórico de conversas e consultas realizadas nos módulos de IA.",
              "Consumo de IA: modelo utilizado, agente, quantidade de tokens, custo estimado e data.",
              "Consumo de OmniCoins e saldo da franquia da empresa.",
              "Registros técnicos, incluindo endereço IP e identificadores de sessão utilizados em controles de segurança (ex.: limite de tentativas de login).",
            ]}
          />
        </LegalSubSection>

        <LegalSubSection title="Dados empresariais">
          <LegalUl
            items={[
              "Informações cadastradas pela empresa na plataforma: tarefas, solicitações, contratos, documentos, contas a pagar e configurações.",
              "Dados financeiros inseridos pela empresa para uso nos módulos de gestão.",
              "Dados recebidos de integrações autorizadas pela empresa (ex.: Conta Azul), como clientes, fornecedores e lançamentos.",
            ]}
          />
        </LegalSubSection>

        <LegalSubSection title="Dados de integração">
          <LegalUl
            items={[
              "Credenciais e tokens de acesso necessários para conectar a plataforma a serviços externos autorizados pela empresa (ex.: Conta Azul, OpenRouter e provedores de IA).",
              "Identificadores técnicos necessários para a operação das integrações.",
            ]}
          />
        </LegalSubSection>

        <LegalSubSection title="Dados de cobrança e assinatura">
          <LegalUl
            items={[
              "Informações do pedido de compra e do plano contratado, gerenciadas por meio de provedor externo de pagamentos.",
              "Dados completos de cartão de crédito não são coletados nem armazenados pela plataforma: o pagamento é processado integralmente no ambiente do provedor (Stripe).",
            ]}
          />
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="finalidade" title="3. Finalidade do Tratamento">
        <LegalP>Os dados tratados na plataforma são utilizados para:</LegalP>
        <LegalUl
          items={[
            "Autenticar usuários e controlar o acesso às funcionalidades da plataforma.",
            "Operar e manter a plataforma funcionando (módulos, tarefas, documentos, relatórios e automações).",
            "Gerenciar usuários, perfis e permissões conforme definido pelo Gestor.",
            "Executar funcionalidades de inteligência artificial contratadas pela empresa.",
            "Executar integrações com serviços externos autorizados (Conta Azul, Stripe, provedores de IA).",
            "Processar assinaturas e cobranças por meio de provedor externo de pagamentos.",
            "Garantir segurança, incluindo controle de tentativas de acesso e validação de autenticidade de eventos recebidos de terceiros.",
            "Registrar auditoria e histórico de atividades para segurança e transparência.",
            "Gerar métricas de consumo de IA e controlar o uso de Coins.",
            "Prestar suporte e responder a solicitações dos usuários e da empresa.",
            "Melhorar a plataforma com base na operação do serviço.",
          ]}
        />
        <LegalP>
          O tratamento é realizado com base em hipóteses legítimas, como a execução do contrato de
          prestação de serviços, o cumprimento de obrigações legais, o legítimo interesse da
          plataforma e, quando aplicável, o consentimento do titular.
        </LegalP>
      </LegalSection>

      <LegalSection id="compartilhamento" title="4. Compartilhamento de Dados">
        <LegalP>
          A OmniZeus não vende dados. O tratamento por terceiros ocorre exclusivamente quando
          necessário para a execução do serviço contratado:
        </LegalP>
        <LegalUl
          items={[
            <>
              <strong className="text-slate-800">Stripe:</strong> processamento de pagamentos e
              assinaturas. A plataforma envia ao provedor as informações necessárias para o
              checkout e o gerenciamento da assinatura; dados completos de cartão não passam pela
              plataforma.
            </>,
            <>
              <strong className="text-slate-800">Conta Azul:</strong> integração necessária para a
              sincronização de dados contábeis e financeiros, acessados conforme as permissões
              concedidas pela empresa na autorização OAuth.
            </>,
            <>
              <strong className="text-slate-800">OpenRouter e provedores de IA:</strong>
              processamento de consultas de inteligência artificial. O conteúdo das consultas é
              enviado ao provedor configurado (chave da plataforma ou chave da empresa) para geração
              das respostas.
            </>,
            <>
              <strong className="text-slate-800">Provedores de infraestrutura:</strong> hospedagem,
              armazenamento e operação técnica da plataforma, dentro dos padrões de segurança do
              setor.
            </>,
          ]}
        />
        <LegalP>
          O compartilhamento acima caracteriza <em>integração necessária para a execução do
          serviço</em>. A OmniZeus não comercializa dados pessoais ou empresariais, e não os
          compartilha para publicidade de terceiros.
        </LegalP>
      </LegalSection>

      <LegalSection id="direitos-titular" title="5. Direitos do Titular (LGPD)">
        <LegalP>
          Nos termos da LGPD, o titular pode solicitar, em relação aos seus dados pessoais:
        </LegalP>
        <LegalUl
          items={[
            "Confirmação da existência de tratamento.",
            "Acesso aos dados tratados.",
            "Correção de dados incompletos, inexatos ou desatualizados.",
            "Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei.",
            "Portabilidade dos dados a outro fornecedor, quando aplicável e tecnicamente viável.",
            "Informação sobre entidades públicas ou privadas com as quais a plataforma compartilha dados.",
            "Revogação do consentimento, quando o tratamento estiver baseado nessa hipótese.",
          ]}
        />
        <LegalP>
          Solicitações podem ser encaminhadas pelo canal de suporte da plataforma. A OmniZeus
          responderá no prazo legal, podendo solicitar confirmação de identidade para evitar
          divulgação indevida de informações.
        </LegalP>
        <LegalNote>
          A eliminação de dados pode não ser imediatamente possível quando houver obrigação legal
          de retenção (ex.: dados fiscais e de cobrança) ou quando os dados forem necessários para
          a operação do serviço contratado pela empresa.
        </LegalNote>
      </LegalSection>

      <LegalSection id="seguranca-dados" title="6. Segurança dos Dados">
        <LegalP>
          A plataforma adota medidas técnicas e organizacionais para proteger os dados, incluindo:
        </LegalP>
        <LegalUl
          items={[
            "Senhas armazenadas por função de derivação de chave criptográfica (PBKDF2-SHA256) com salt aleatório.",
            "Sessões autenticadas por meio de cookie assinado e protegido contra acesso por scripts, com expiração automática.",
            "Controle de permissões por perfil (Super Admin, Gestor e Funcionário) e por módulos liberados.",
            "Isolamento de dados entre empresas (arquitetura multi-tenant).",
            "Registros de auditoria de operações relevantes e logs de consumo de IA.",
            "Validação de autenticidade de eventos recebidos de serviços externos (ex.: webhook de pagamentos).",
            "Controle de tentativas de login para mitigar acessos não autorizados.",
          ]}
        />
        <LegalP>
          Detalhes adicionais sobre os mecanismos de proteção estão disponíveis na página{" "}
          <a href="/legal/seguranca-criptografia" className="text-primary font-semibold hover:underline">
            Segurança & Criptografia
          </a>
          .
        </LegalP>
      </LegalSection>

      <LegalSection id="retencao" title="7. Retenção dos Dados">
        <LegalP>
          Os dados são mantidos enquanto a conta da empresa estiver ativa e pelo período necessário
          para cumprimento de obrigações legais, cobrança, segurança e resolução de disputas. Ao
          término do contrato, os dados permanecem armazenados conforme exigência legal aplicável e
          as práticas operacionais da plataforma.
        </LegalP>
      </LegalSection>

      <LegalSection id="alteracoes-privacidade" title="8. Alterações desta Política">
        <LegalP>
          Esta Política pode ser atualizada conforme a evolução da plataforma, de integrações ou da
          legislação. A versão vigente é sempre a publicada nesta página, com indicação de versão e
          data de atualização.
        </LegalP>
      </LegalSection>

      <LegalSection id="contato-privacidade" title="9. Contato">
        <LegalP>
          Dúvidas ou solicitações relacionadas à privacidade podem ser encaminhadas pelo suporte da
          plataforma, disponível para as empresas contratantes por meio do Super Admin responsável
          pela operação.
        </LegalP>
      </LegalSection>
    </LegalLayout>
  );
}

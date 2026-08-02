import {
  LegalLayout,
  LegalSection,
  LegalP,
  LegalUl,
  LegalNote,
} from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Conformidade LGPD — OmniZeus",
  description:
    "Práticas da plataforma OmniZeus em relação à proteção de dados pessoais e à Lei Geral de Proteção de Dados (LGPD).",
};

export default function ConformidadeLgpdPage() {
  return (
    <LegalLayout current="Conformidade LGPD">
      <LegalP>
        Esta página descreve, de forma objetiva, como a plataforma OmniZeus aborda a proteção de
        dados pessoais, em alinhamento com os princípios da Lei Geral de Proteção de Dados (Lei nº
        13.709/2018). Não substitui o parecer jurídico especializado, mas reflete as práticas
        efetivamente implementadas na plataforma.
      </LegalP>

      <LegalSection id="governanca" title="Governança de Dados">
        <LegalP>
          A plataforma trata dados pessoais e empresariais com base em hipóteses legítimas: execução
          do contrato de serviço, cumprimento de obrigações legais, legítimo interesse e, quando
          aplicável, consentimento. As finalidades do tratamento estão descritas na Política de
          Privacidade.
        </LegalP>
        <LegalP>
          A empresa contratante é a controladora dos dados operacionais que insere na plataforma
          (dados de usuários, tarefas, documentos e informações financeiras). A OmniZeus atua como
          operadora, tratando esses dados para a execução do serviço contratado.
        </LegalP>
      </LegalSection>

      <LegalSection id="controle-acesso" title="Controle de Acesso">
        <LegalP>
          O acesso à plataforma é autenticado por usuário e senha, com controle de tentativas de
          login. Cada usuário possui um perfil com permissões específicas:
        </LegalP>
        <LegalUl
          items={[
            <>
              <strong className="text-slate-800">Funcionário:</strong> acesso restrito aos módulos
              liberados pelo Gestor. As permissões são aplicadas tanto no menu quanto nas rotas e
              nas regras de servidor.
            </>,
            <>
              <strong className="text-slate-800">Gestor:</strong> administra os usuários e as
              permissões da própria empresa.
            </>,
            <>
              <strong className="text-slate-800">Super Admin:</strong> opera a plataforma em nível
              técnico, com visão consolidada para suporte e operação do serviço.
            </>,
          ]}
        />
      </LegalSection>
      <LegalSection id="isolamento" title="Isolamento entre Empresas">
        <LegalP>
          A plataforma possui arquitetura destinada ao isolamento das informações entre empresas.
          Cada empresa opera em seu próprio ambiente lógico:
        </LegalP>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-800 mb-2">Empresa A</p>
            <LegalUl
              items={[
                "Seus usuários",
                "Seus dados",
                "Seus agentes de IA",
                "Suas configurações",
                "Sua franquia de Coins",
              ]}
            />
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-800 mb-2">Empresa B</p>
            <LegalUl
              items={[
                "Seus usuários",
                "Seus dados",
                "Seus agentes de IA",
                "Suas configurações",
                "Sua franquia de Coins",
              ]}
            />
          </div>
        </div>
        <LegalP>
          Uma empresa não acessa informações de outra: as operações de leitura, criação e alteração
          de dados validam a empresa de cada usuário no servidor, e tentativas de acesso cruzado
          entre empresas são rejeitadas.
        </LegalP>
      </LegalSection>

      <LegalSection id="minimizacao" title="Minimização de Dados">
        <LegalP>
          A plataforma coleta apenas os dados necessários para a operação do serviço: identificação
          e contato dos usuários, dados cadastrais da empresa e informações exigidas pelas
          funcionalidades contratadas. Não há coleta de dados para finalidades não relacionadas ao
          serviço.
        </LegalP>
      </LegalSection>

      <LegalSection id="seguranca-lgpd" title="Segurança">
        <LegalP>
          As medidas de segurança implementadas incluem senhas protegidas por função de derivação
          de chave criptográfica (PBKDF2-SHA256), sessões com cookie assinado e protegido contra
          scripts, controle de permissões por perfil e módulo, isolamento de dados por empresa e
          registros de auditoria. Detalhes na página{" "}
          <a href="/legal/seguranca-criptografia" className="text-primary font-semibold hover:underline">
            Segurança & Criptografia
          </a>
          .
        </LegalP>
      </LegalSection>

      <LegalSection id="auditoria" title="Auditoria e Logs">
        <LegalP>
          A plataforma registra logs de atividades relevantes para segurança e transparência:
        </LegalP>
        <LegalUl
          items={[
            "Logs de auditoria de operações administrativas (gestão de usuários, alterações de senha, configurações e pedidos de compra).",
            "Logs de consumo de IA (modelo, agente, tokens, custo estimado, empresa, usuário e data).",
            "Registros de eventos recebidos de provedores externos (ex.: webhook de pagamentos).",
            "Registros de tentativas de login para controle de acesso.",
          ]}
        />
      </LegalSection>

      <LegalSection id="gestao-usuarios" title="Gestão de Usuários">
        <LegalP>
          O Gestor controla integralmente os usuários da empresa: cadastro, perfil, módulos
          liberados, bloqueio e desativação. Ao desativar um usuário, o acesso à plataforma é
          imediatamente interrompido. As contas utilizam senha temporária no primeiro acesso, com
          obrigação de troca.
        </LegalP>
      </LegalSection>

      <LegalSection id="terceiros-lgpd" title="Integrações com Terceiros">
        <LegalP>
          As integrações da plataforma (Conta Azul, Stripe e provedores de IA) são ativadas
          mediante autorização da empresa e processam dados exclusivamente para a execução das
          funcionalidades contratadas. Cada provedor possui suas próprias políticas de privacidade
          e tratamento de dados, que devem ser consultadas pela empresa quando aplicável.
        </LegalP>
      </LegalSection>

      <LegalSection id="direitos-titulares-lgpd" title="Direitos dos Titulares">
        <LegalP>
          A plataforma viabiliza, quando aplicável e tecnicamente possível, o exercício dos direitos
          previstos na LGPD: confirmação de tratamento, acesso, correção, anonimização, bloqueio e
          eliminação de dados, portabilidade, informação sobre compartilhamento e revogação de
          consentimento. Solicitações devem ser encaminhadas pelo canal de suporte.
        </LegalP>
      </LegalSection>

      <LegalSection id="solicitacoes" title="Solicitações relacionadas à Privacidade">
        <LegalP>
          Solicitações de titulares podem ser encaminhadas pelo suporte da plataforma, disponível
          para as empresas contratantes por meio do Super Admin responsável pela operação. A
          plataforma responderá no prazo previsto em lei, com validação de identidade quando
          necessário.
        </LegalP>
        <LegalNote>
          Este documento descreve as práticas atuais da plataforma e pode ser atualizado conforme a
          evolução do serviço e da legislação. Recomenda-se que a empresa mantenha suas próprias
          avaliações de conformidade com o assessoramento jurídico adequado.
        </LegalNote>
      </LegalSection>
    </LegalLayout>
  );
}

import {
  LegalLayout,
  LegalSection,
  LegalSubSection,
  LegalP,
  LegalUl,
  LegalNote,
} from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Termos de Uso — OmniZeus",
  description:
    "Regras, responsabilidades e condições de utilização da plataforma OmniZeus.",
};

export default function TermosDeUsoPage() {
  return (
    <LegalLayout current="Termos de Uso">
      <LegalP>
        Estes Termos de Uso regulam o acesso e a utilização da plataforma OmniZeus por empresas e
        usuários. Ao criar uma conta, acessar ou utilizar a plataforma, a empresa e seus usuários
        aceitam as condições descritas neste documento. Recomendamos a leitura completa antes do uso.
      </LegalP>

      <LegalSection id="aceitacao" title="1. Aceitação dos Termos">
        <LegalP>
          A utilização da plataforma implica a aceitação integral destes Termos. Se a empresa ou o
          usuário não concordar com qualquer condição aqui descrita, deve interromper o uso e não
          criar conta na plataforma. O contrato formal entre a empresa e a OmniZeus é firmado no
          momento da contratação de um plano e confirmado no fluxo de pagamento.
        </LegalP>
      </LegalSection>

      <LegalSection id="definicoes" title="2. Definições">
        <LegalP>Para os fins destes Termos, considera-se:</LegalP>
        <LegalUl
          items={[
            <>
              <strong className="text-slate-800">Plataforma:</strong> o ambiente SaaS OmniZeus,
              acessível via navegador, que reúne módulos de inteligência artificial, gestão
              financeira, tarefas, documentos, integrações e automações.
            </>,
            <>
              <strong className="text-slate-800">Empresa (ou Tenant):</strong> organização que
              contrata a plataforma e opera em um ambiente próprio e isolado, com seus usuários,
              dados, agentes e configurações.
            </>,
            <>
              <strong className="text-slate-800">Gestor:</strong> usuário responsável pela
              administração da conta da empresa, incluindo gestão de usuários, permissões e
              configurações.
            </>,
            <>
              <strong className="text-slate-800">Funcionário:</strong> usuário operacional vinculado
              à empresa, com acesso restrito aos módulos liberados pelo Gestor.
            </>,
            <>
              <strong className="text-slate-800">Super Admin:</strong> administrador da plataforma,
              responsável pela operação técnica e pelo suporte, sem acesso operacional aos dados das
              empresas.
            </>,
            <>
              <strong className="text-slate-800">Usuário:</strong> qualquer pessoa autenticada na
              plataforma com um perfil de Gestor ou Funcionário.
            </>,
            <>
              <strong className="text-slate-800">Serviços:</strong> as funcionalidades oferecidas
              pela plataforma, incluindo módulos de IA, integrações, relatórios e automações.
            </>,
            <>
              <strong className="text-slate-800">Coins (OmniCoins):</strong> crédito interno de
              consumo para utilização dos recursos de inteligência artificial da plataforma.
            </>,
            <>
              <strong className="text-slate-800">Inteligência Artificial (IA):</strong> recursos que
              utilizam modelos de IA, processados por provedores externos, para responder perguntas,
              analisar dados e apoiar tarefas.
            </>,
            <>
              <strong className="text-slate-800">Integrações:</strong> conexões com serviços
              externos, como Conta Azul, Stripe e provedores de IA, autorizadas pela empresa.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="utilizacao" title="3. Utilização da Plataforma">
        <LegalP>
          A plataforma destina-se ao uso profissional por empresas — especialmente escritórios
          contábeis e prestadores de serviços de BPO financeiro — para apoiar operações como gestão
          de tarefas, organização financeira, geração de documentos, consultas com IA e integração
          com sistemas externos.
        </LegalP>
        <LegalP>
          A empresa é responsável por utilizar a plataforma em conformidade com a legislação
          aplicável e por garantir que seus usuários atuem dentro do escopo dos módulos liberados.
        </LegalP>
      </LegalSection>

      <LegalSection id="cadastro" title="4. Cadastro e Conta de Usuário">
        <LegalUl
          items={[
            "Usuários são cadastrados pelo Gestor da empresa com dados de identificação (nome, e-mail, cargo e função).",
            "O Gestor define o perfil (Gestor ou Funcionário) e os módulos de acesso liberados para cada usuário.",
            "O primeiro acesso utiliza uma senha temporária gerada pela plataforma, que deve ser alterada pelo usuário.",
            "A conta é pessoal e intransferível. O usuário é responsável por manter a confidencialidade de sua senha.",
            "A plataforma mantém controle de tentativas de login para proteger contas contra acesso não autorizado.",
          ]}
        />
      </LegalSection>

      <LegalSection id="responsabilidades-gestor" title="5. Responsabilidades do Gestor">
        <LegalUl
          items={[
            "Manter os dados cadastrais da empresa (razão social, nome fantasia, CNPJ, endereço e plano) atualizados.",
            "Cadastrar, atualizar e desativar usuários, e definir as permissões de acesso de cada um.",
            "Configurar integrações com serviços externos e autorizar o uso dos dados empresariais nessas integrações.",
            "Gerenciar a franquia de Coins e monitorar o consumo de IA da empresa.",
            "Garantir que os usuários da empresa utilizem a plataforma de acordo com estes Termos e com a legislação.",
          ]}
        />
      </LegalSection>

      <LegalSection id="responsabilidades-usuarios" title="6. Responsabilidades dos Usuários">
        <LegalUl
          items={[
            "Não compartilhar credenciais de acesso com terceiros.",
            "Utilizar a plataforma apenas para atividades profissionais legítimas da empresa.",
            "Não tentar acessar dados, funcionalidades ou ambientes de outras empresas.",
            "Não enviar pela plataforma conteúdo ilegal, ofensivo ou que viole direitos de terceiros.",
            "Comunicar ao Gestor qualquer suspeita de uso indevido da conta.",
          ]}
        />
      </LegalSection>

      <LegalSection id="ia" title="7. Inteligência Artificial">
        <LegalP>
          A plataforma oferece recursos de IA que respondem perguntas, analisam dados e apoiam a
          execução de tarefas, como consultas sobre dados financeiros, geração de documentos e
          análise de arquivos.
        </LegalP>
        <LegalUl
          items={[
            "As respostas geradas por IA devem ser utilizadas como suporte e apoio à decisão, e não como fonte única de verdade.",
            "Informações críticas — especialmente fiscais, contábeis, trabalhistas e jurídicas — devem ser verificadas por profissional habilitado antes de qualquer decisão ou comunicação oficial.",
            "Modelos de IA podem cometer erros, gerar informações imprecisas ou incompletas, e estão sujeitos às limitações do próprio modelo e do provedor.",
            "O conteúdo enviado em consultas de IA é processado por provedores externos de modelos, conforme a configuração de chaves da plataforma ou da empresa.",
            "A plataforma registra métricas de consumo de IA (modelo, agente, tokens e custo) para controle e auditoria do uso.",
          ]}
        />
        <LegalNote>
          A empresa é responsável por decidir quais informações confidenciais são enviadas em
          consultas de IA e por verificar as políticas dos provedores de modelos utilizados.
        </LegalNote>
      </LegalSection>

      <LegalSection id="integracoes" title="8. Integrações com Serviços de Terceiros">
        <LegalP>
          A plataforma integra-se com serviços externos para executar funcionalidades específicas,
          sempre mediante autorização da empresa:
        </LegalP>
        <LegalUl
          items={[
            <>
              <strong className="text-slate-800">Conta Azul:</strong> sincronização de dados
              contábeis e financeiros, mediante autorização OAuth concedida pela própria empresa na
              tela de autorização da Conta Azul.
            </>,
            <>
              <strong className="text-slate-800">Stripe:</strong> processamento de assinaturas e
              pagamentos da plataforma. Dados de cartão não são armazenados pela plataforma.
            </>,
            <>
              <strong className="text-slate-800">Provedores de IA:</strong> processamento de
              consultas de inteligência artificial por modelos de terceiros, como os acessíveis via
              OpenRouter.
            </>,
          ]}
        />
        <LegalP>
          Cada integração segue os termos, políticas e limites de segurança do respectivo provedor.
          A OmniZeus não se responsabiliza pela disponibilidade, precisão ou conformidade de
          serviços de terceiros, mas emprega mecanismos de proteção na comunicação, como validação
          de autenticidade de eventos recebidos de provedores.
        </LegalP>
      </LegalSection>

      <LegalSection id="pagamentos" title="9. Assinaturas e Pagamentos">
        <LegalUl
          items={[
            "As assinaturas dos planos são processadas por provedor externo de pagamentos (Stripe), com checkout seguro no ambiente do provedor.",
            "O pagamento é recorrente (mensal) conforme o plano contratado, salvo disposição diversa do pedido de compra.",
            "Dados completos de cartão não são coletados, armazenados ou processados pela plataforma.",
            "A empresa pode gerenciar a assinatura e atualizar o método de pagamento pelo portal do provedor, acessível a partir da plataforma.",
            "A suspensão por inadimplência segue as regras do plano contratado, incluindo período de tolerância quando aplicável.",
          ]}
        />
      </LegalSection>

      <LegalSection id="coins" title="10. Coins e Consumo de IA">
        <LegalP>
          Os recursos de IA da plataforma consomem OmniCoins da franquia da empresa. O saldo de
          Coins é controlado pela empresa e debitado de forma automática a cada utilização,
          conforme as regras de cada funcionalidade.
        </LegalP>
        <LegalUl
          items={[
            "O consumo é debitado do saldo da própria empresa, nunca de outra empresa da plataforma.",
            "A franquia mensal é definida pelo plano contratado; recargas podem ser adquiridas quando disponíveis.",
            "Quando o saldo é insuficiente, o recurso de IA pode ficar indisponível até nova franquia ou recarga.",
            "A plataforma registra o histórico de consumo (modelo, agente, tokens, custo e data) para acompanhamento pelo Gestor.",
          ]}
        />
      </LegalSection>

      <LegalSection id="suspensao" title="11. Suspensão e Cancelamento">
        <LegalUl
          items={[
            "A plataforma pode suspender o acesso de uma empresa em caso de inadimplência, após o período de tolerância previsto no plano.",
            "A OmniZeus pode suspender ou encerrar o acesso de usuários que violem estes Termos ou a legislação aplicável.",
            "O cancelamento da assinatura encerra o acesso da empresa; os dados permanecem armazenados pela plataforma enquanto exigido para fins de cobrança, segurança e legislação aplicável, observada a Política de Privacidade.",
          ]}
        />
      </LegalSection>

      <LegalSection id="propriedade" title="12. Propriedade Intelectual">
        <LegalP>
          A plataforma, seu código, design, marcas e conteúdos institucionais pertencem à OmniZeus
          ou aos seus licenciantes. A empresa adquire apenas o direito de uso do serviço, nos termos
          destes Termos, não sendo transferida qualquer titularidade sobre a tecnologia da
          plataforma.
        </LegalP>
        <LegalP>
          As informações e documentos gerados pela empresa dentro da plataforma pertencem à
          empresa, que permanece responsável pelo seu conteúdo e uso.
        </LegalP>
      </LegalSection>

      <LegalSection id="disponibilidade" title="13. Disponibilidade do Serviço">
        <LegalP>
          A plataforma busca manter alta disponibilidade, mas não garante disponibilidade
          ininterrupta. Manutenções programadas, falhas de infraestrutura, dependência de serviços
          externos (como provedores de IA e sistemas integrados) e fatores fora do controle da
          OmniZeus podem interromper temporariamente o serviço.
        </LegalP>
      </LegalSection>

      <LegalSection id="responsabilidade" title="14. Limitação de Responsabilidade">
        <LegalP>
          A OmniZeus atua como provedora de tecnologia e não exerce atividades contábeis, fiscais,
          trabalhistas ou jurídicas. A plataforma não substitui a análise profissional de um
          contador, auditor, advogado ou especialista.
        </LegalP>
        <LegalP>
          Na extensão máxima permitida pela legislação aplicável, a OmniZeus não será responsável
          por danos indiretos, lucros cessantes ou perdas decorrentes de: (i) decisões tomadas com
          base em informações geradas por IA; (ii) indisponibilidade de serviços de terceiros; ou
          (iii) uso indevido da plataforma por usuários da empresa. Nada nestes Termos exclui
          direitos que não possam ser legalmente excluídos.
        </LegalP>
      </LegalSection>

      <LegalSection id="alteracoes" title="15. Alterações dos Termos">
        <LegalP>
          Estes Termos podem ser atualizados para refletir mudanças na plataforma, na legislação ou
          em práticas operacionais. A versão vigente será sempre a publicada nesta página, com
          indicação de versão e data de atualização. Quando a alteração for relevante, a plataforma
          buscará informar os usuários pelos canais disponíveis.
        </LegalP>
      </LegalSection>

      <LegalSection id="contato" title="16. Contato">
        <LegalP>
          Dúvidas sobre estes Termos podem ser encaminhadas pelo suporte da plataforma, disponível
          para as empresas contratantes por meio do Super Admin responsável pela operação.
        </LegalP>
      </LegalSection>
    </LegalLayout>
  );
}

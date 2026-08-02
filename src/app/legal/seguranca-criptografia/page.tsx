import {
  LegalLayout,
  LegalSection,
  LegalSubSection,
  LegalP,
  LegalUl,
  LegalNote,
} from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Segurança & Criptografia — OmniZeus",
  description:
    "Mecanismos de proteção implementados na plataforma OmniZeus: acesso, permissões, isolamento, integrações, comunicação e auditoria.",
};

export default function SegurancaCriptografiaPage() {
  return (
    <LegalLayout current="Segurança & Criptografia">
      <LegalP>
        Esta página descreve, em linguagem acessível a gestores, os mecanismos de proteção
        efetivamente implementados na plataforma OmniZeus. Apenas controles existentes no sistema
        são descritos — não há certificações ou tecnologias não aplicadas na operação.
      </LegalP>

      <LegalSection id="protecao-acesso" title="Proteção de Acesso">
        <LegalSubSection title="Autenticação">
          <LegalUl
            items={[
              "Acesso por e-mail e senha, com senha armazenada exclusivamente em formato protegido (PBKDF2-SHA256 com salt aleatório, 210.000 iterações).",
              "Senha temporária gerada com criptografia forte no primeiro acesso, com obrigação de troca.",
              "Política de senha: mínimo de 8 caracteres, com letras maiúsculas, minúsculas, números e caracteres especiais.",
              "Controle de tentativas de login: após o limite de tentativas para o mesmo e-mail e IP, novas tentativas são bloqueadas temporariamente.",
              "Sessão com expiração automática (24 horas), removida no encerramento da sessão.",
            ]}
          />
        </LegalSubSection>

        <LegalSubSection title="Sessão autenticada">
          <LegalUl
            items={[
              "A sessão é transmitida por cookie protegido contra acesso por scripts (HttpOnly), com escopo de envio restrito (SameSite) e flag de conexão segura em produção.",
              "O conteúdo da sessão é assinado por HMAC-SHA256 com segredo exclusivo do servidor, impedindo adulteração por terceiros.",
              "A identidade da empresa e do usuário é definida pelo servidor a partir da sessão — dados enviados pelo navegador não são confiados para autorização.",
            ]}
          />
        </LegalSubSection>
      </LegalSection>

      <LegalSection id="permissoes" title="Controle de Permissões">
        <LegalP>A plataforma diferencia três perfis de acesso:</LegalP>
        <LegalUl
          items={[
            <>
              <strong className="text-slate-800">Super Admin:</strong> administra a plataforma em
              nível técnico (planos, integrações da plataforma, suporte e operação). Não atua nos
              dados operacionais das empresas.
            </>,
            <>
              <strong className="text-slate-800">Gestor:</strong> administra a conta da empresa,
              incluindo usuários, permissões, configurações e integrações da empresa.
            </>,
            <>
              <strong className="text-slate-800">Funcionário:</strong> acesso operacional restrito
              aos módulos liberados pelo Gestor. As restrições são aplicadas no menu, nas rotas e
              nas validações de servidor.
            </>,
          ]}
        />
        <LegalP>
          Cada empresa define os módulos que seus funcionários podem acessar, o que limita a
          superfície de exposição a dados sensíveis.
        </LegalP>
      </LegalSection>

      <LegalSection id="isolamento-empresas" title="Isolamento de Empresas">
        <LegalP>
          A plataforma opera com arquitetura multi-tenant: cada empresa contratante possui um
          ambiente lógico isolado, com seus próprios usuários, dados, agentes de IA,
          configurações e franquia de Coins.
        </LegalP>
        <LegalUl
          items={[
            "Toda operação de leitura, criação, alteração ou exclusão de dados é validada no servidor contra a empresa do usuário autenticado.",
            "Tentativas de acesso a dados de outra empresa são rejeitadas com erro de permissão.",
            "A troca de contexto do Super Admin entre empresas é controlada e registrada no fluxo da plataforma.",
          ]}
        />
      </LegalSection>

      <LegalSection id="integracoes-seguranca" title="Proteção das Integrações">
        <LegalP>
          As credenciais e tokens de integração com serviços externos são tratados como informações
          protegidas:
        </LegalP>
        <LegalUl
          items={[
            <>
              <strong className="text-slate-800">Conta Azul:</strong> a conexão usa o fluxo OAuth,
              com tokens de acesso e de renovação vinculados à empresa autorizadora. A renovação é
              automática e não exige nova autorização enquanto válida. Os tokens são isolados por
              empresa.
            </>,
            <>
              <strong className="text-slate-800">Provedores de IA:</strong> as chaves de API são
              utilizadas exclusivamente no servidor, nunca são expostas ao navegador, e são
              resolvidas por empresa quando configuradas (com fallback para a chave da plataforma).
            </>,
            <>
              <strong className="text-slate-800">Pagamentos (Stripe):</strong> o checkout ocorre no
              ambiente do provedor; a plataforma não processa dados de cartão. Eventos recebidos do
              provedor são validados por assinatura criptográfica com comparação segura de
              conteúdo.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="comunicacao" title="Comunicação Segura">
        <LegalP>
          Em ambientes de produção, a plataforma opera com o cookie de sessão marcado para conexão
          segura, e o acesso deve ocorrer por navegador via protocolo HTTPS/TLS, que protege a
          comunicação entre o usuário e a plataforma contra interceptação.
        </LegalP>
        <LegalNote>
          A ativação e manutenção do certificado TLS é parte da infraestrutura de hospedagem em
          produção da plataforma.
        </LegalNote>
      </LegalSection>

      <LegalSection id="webhooks" title="Webhooks">
        <LegalP>
          Integrações que enviam eventos à plataforma (como o provedor de pagamentos) são
          validadas quanto à autenticidade: cada evento inclui uma assinatura criptográfica
          derivada do conteúdo e de um segredo exclusivo, conferida pela plataforma com comparação
          em tempo constante. Eventos sem assinatura válida são rejeitados.
        </LegalP>
      </LegalSection>

      <LegalSection id="logs-auditoria" title="Logs e Auditoria">
        <LegalP>A plataforma mantém registros técnicos para segurança e transparência:</LegalP>
        <LegalUl
          items={[
            "Auditoria de operações administrativas: gestão de usuários, alterações de senha, configurações, chaves de integração e pedidos de compra.",
            "Logs de consumo de IA: modelo, agente, usuário, empresa, tokens e custo estimado de cada consulta.",
            "Registro de eventos de pagamento recebidos do provedor.",
            "Controle de tentativas de login com data e origem.",
            "Histórico de conversas e operações dos módulos, necessários ao funcionamento do serviço.",
          ]}
        />
      </LegalSection>

      <LegalSection id="segredos" title="Credenciais e Segredos">
        <LegalP>
          Chaves de API, tokens de integração e segredos de autenticação são tratados como
          informações protegidas: são utilizados exclusivamente no ambiente servidor, não são
          exibidos integralmente na interface e nunca são divulgados em documentos públicos da
          plataforma.
        </LegalP>
        <LegalNote>
          A plataforma não afirma possuir certificações externas (ISO, SOC 2, PCI DSS) ou
          criptografia em repouso dos arquivos locais de dados, pois essas práticas não estão
          implementadas na versão atual.
        </LegalNote>
      </LegalSection>
    </LegalLayout>
  );
}

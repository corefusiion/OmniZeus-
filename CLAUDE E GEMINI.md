# Histórico de Correções - OmniZeus (Resumo Claude & Gemini)

Este documento registra as principais refatorações e correções de bugs feitas no sistema para garantir a estabilidade e o funcionamento correto tanto no ambiente de desenvolvimento local quanto na produção.

## 1. Migração e Correção do Layout (Modo Page / App Router)
* **Problema:** A estrutura do projeto apresentava conflitos entre os layouts globais e o `(dashboard)/layout.tsx`, causando erros de hidratação e quebra na renderização de páginas (especialmente na tela de login e de dashboard simultaneamente).
* **Solução Implementada:**
  - Foi feita uma reestruturação do layout do Next.js (App Router). 
  - Centralização do layout global em `app/layout.tsx`.
  - Separação adequada do escopo de páginas públicas (Login) e páginas autenticadas `(dashboard)`, evitando que os componentes de navegação interna (Sidebars) quebrassem as telas de entrada.

## 2. Correção do Webhook do Stripe (Provisionamento de SaaS)
* **Problema:** O webhook que recebia eventos de assinatura (`checkout.session.completed`) e provisionava o novo cliente SaaS (criando a empresa e o gestor master) não estava salvando os dados corretamente no banco Supabase. O backend estava enviando chaves em formato `camelCase` (ex: `companyId`, `passwordHash`) enquanto a tabela do PostgREST exigia `snake_case` (`company_id`, `password_hash`). Além disso, não enviava a `temporary_password` explicitamente para exibição, e falhava ao lidar com a resposta de erro.
* **Solução Implementada:**
  - O script em `src/app/api/super-adm/orders/provision/route.ts` foi totalmente refatorado.
  - Ajustamos os payloads para garantirem chaves no padrão PostgREST `snake_case`.
  - Tratamento de erro detalhado (`err.message`) para visibilidade do log no servidor.
  - A geração e o armazenamento do `password_hash` bem como da senha temporária (`temporary_password`) agora ficam persistidos de forma segura no banco da nova empresa provisionada, permitindo ao usuário logar pela primeira vez com ela.

## 3. Correção de Inserção Silenciosa de Colaboradores (Bug de Login Não Reconhecido)
* **Problema:** Quando o administrador ou gestor logava na plataforma e tentava criar um novo funcionário ou gestor via aba "Usuários & Equipe", o frontend exibia que a conta fora criada com sucesso e exibia o pop-up com a "Senha Temporária". Porém, ao tentar logar com esse e-mail e senha, o sistema retornava "E-mail ou senha incorretos".
* **Causa do Problema:**
  - O arquivo responsável pelo envio local (`src/lib/company/store.ts` via função `saveEmployee`) estava definindo atributos de data nulos como **strings vazias** (`''`). Ex: `password_changed_at: ''`, `last_login_at: ''`, `birth_date: ''`.
  - Ao bater na API do banco (Supabase / Postgres), o banco negava a inserção retornando o código HTTP 400 (Bad Request), pois `''` não é um tipo válido de `Timestamp` ou `Date`.
  - O request no frontend estava com `.catch(() => {})`, suprimindo silenciosamente o erro 500 do `/api/db`. Consequentemente, o usuário aparecia na UI da empresa de forma reativa, mas **nunca foi salvo no banco de dados**, resultando na falha crítica do momento do login.
* **Solução Implementada:**
  - Substituímos a atribuição de `''` (string vazia) por `undefined` no arquivo `src/lib/company/store.ts`.
  - Isso faz com que a API de serialização (`JSON.stringify`) omita essas chaves do payload enviado.
  - Assim, o Supabase recebe a instrução sem as colunas que estão nulas, aplicando o `NULL` do banco e finalmente efetivando o cadastro.
  - Agora o sistema de login via `/api/auth/login/route.ts` conseguirá encontrar o email na tabela `employees` e cruzar a verificação usando a hash PBKDF2 gerada no momento do cadastro.

---

### Onde Paramos / Próximos Passos
O bug da autenticação do novo colaborador está consertado localmente.
O próximo passo para continuar em casa é:
1. Puxar (git pull) as alterações deste commit no seu PC local.
2. Certificar que as alterações do `src/lib/company/store.ts` (substituição de `''` por `undefined`) estão aplicadas.
3. Subir o deploy para a nuvem da Cloudflare (se tiver build manual configurada, rodar `npm run build` e dar o deploy).
4. Assim que a versão atualizada for para o ar (Production), as novas criações de funcionários voltarão a aparecer no banco de dados do Supabase e o login passará com sucesso!

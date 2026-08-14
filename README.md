<p align="center">
  <img src="public/logo.png" alt="Comer-Tchê!" width="180">
</p>

# Comer-Tchê!

Sistema de delivery usado como estudo de caso da disciplina de **Engenharia de Software Seguro** (UNIPAMPA).

A análise de segurança que originou este código está em **[software-seguro](https://github.com/comer-tche/software-seguro)**: modelagem de ameaças com STRIDE, registro de riscos, requisitos de segurança, decisões de arquitetura e pipeline DevSecOps. Aqui está a implementação dessas decisões.

## Como este repositório é construído

A ordem dos commits é proposital e reproduz a ordem da disciplina, em que a segurança vem antes do código:

1. **O primeiro commit é a base do sistema, deliberadamente sem os controles de segurança.** Cada falha presente nele corresponde a um risco que já havia sido identificado na análise: R01, R03, R04, R07 e R10.
2. **Cada commit seguinte aplica um controle**, citando no título a seção do trabalho que o originou.

O histórico do git é, portanto, a evidência de que a análise guiou a implementação, e não o contrário.

> [!WARNING]
> **A versão inicial deste repositório é insegura de propósito**, para servir de ponto de partida. Os trechos vulneráveis estão marcados com comentários que apontam o risco correspondente. Este é um artefato de estudo: não deve ser publicado na internet nem usado com dados reais de pessoas.

## Declaração de uso de inteligência artificial

A estrutura inicial da aplicação (esqueleto do projeto, modelo de dados e rotas da API) foi gerada com auxílio de inteligência artificial, assim como parte da redação da documentação. A modelagem de ameaças, a análise de riscos, as decisões de arquitetura e a revisão de todo o código são de responsabilidade dos integrantes do grupo, que respondem pelo conteúdo entregue.

O uso de IA nesta disciplina foi explicitamente autorizado pelo professor, desde que o grupo compreenda o que está fazendo.

## O que o sistema faz

O núcleo necessário para exercitar os controles de segurança do trabalho:

- cadastro e autenticação de usuários, com quatro perfis (cliente, entregador, restaurante e administrador);
- consulta ao cardápio;
- fechamento de pedido (checkout);
- consulta de pedidos;
- recebimento da confirmação de pagamento enviada pelo gateway;
- rotas administrativas.

Fora de escopo, pelos mesmos motivos descritos na seção 2 do trabalho: processamento real de pagamento, cálculo de rotas, gestão de estoque do restaurante, emissão de documentos fiscais e troca de mensagens entre usuários.

## Tecnologias

| Camada | Escolha | Por quê |
| ------ | ------- | ------- |
| Aplicação | Next.js 16 com TypeScript, usando route handlers | Um único projeto para interface e API, com tipagem estática ajudando a evitar erros de contrato entre as camadas |
| Banco de dados | SQLite através do Prisma 6 | Roda com `npm install` e um comando de migração, sem instalar servidor de banco nem compilar dependência nativa. O Prisma 7 exigiria um adaptador com compilação nativa, o que dificultaria a execução por qualquer integrante do grupo e no ambiente de integração contínua |
| Senhas | bcrypt com custo 12 | Algoritmo de hash com sal aleatório, recomendado pelo OWASP Password Storage Cheat Sheet |
| Sessão | JWT assinado com HS256 (biblioteca `jose`) | Sem dependência nativa e com verificação de expiração embutida |

## Como executar

```bash
npm install
cp .env.example .env      # e preencha o JWT_SECRET
npx prisma migrate dev    # cria o banco local
npx tsx prisma/seed.ts    # popula cardápio e contas de teste
npm run dev
```

A aplicação sobe em `http://localhost:3000`. As contas criadas pelo seed usam a senha `comer-tche-dev`, que vale apenas no banco local de desenvolvimento.

## Rotas da API

| Método | Rota | Descrição |
| ------ | ---- | --------- |
| `POST` | `/api/v1/auth/register` | Cria uma conta |
| `POST` | `/api/v1/auth/login` | Autentica e devolve o token de sessão |
| `GET` | `/api/v1/menu` | Lista o cardápio (público) |
| `POST` | `/api/v1/orders` | Fecha um pedido |
| `GET` | `/api/v1/orders` | Lista os pedidos do próprio cliente |
| `GET` | `/api/v1/orders/{id}` | Consulta um pedido |
| `POST` | `/api/v1/payments/webhook` | Recebe a confirmação de pagamento do gateway |
| `GET` | `/api/v1/admin/users` | Lista os usuários (rota administrativa) |

## Os controles de segurança e de onde eles vieram

Nenhum controle aqui foi escolhido durante a programação. Cada um tem origem em um risco identificado antes de existir código, e o commit que o aplica cita a seção correspondente.

| Controle no código | Requisito | Risco tratado | Onde está |
| ------------------ | --------- | ------------- | --------- |
| Trilha de auditoria, só de inserção | — | R06 | `lib/auditoria.ts` |
| Perfil verificado no servidor, com negação por padrão | RS01 | R10 | `lib/autorizacao.ts` |
| Verificação de propriedade do recurso | RS02 | R07 | `lib/autorizacao.ts` |
| Segundo fator em aparelho não reconhecido | RS03 | R01 | `lib/segundo-fator.ts` |
| Bloqueio após cinco tentativas em 15 minutos | RS03 | R01 | `app/api/v1/auth/login/route.ts` |
| Valor do pedido recalculado a partir do banco | RS04 | R03 | `app/api/v1/orders/route.ts` |
| Assinatura HMAC-SHA256 na confirmação de pagamento | RS04 | R04 | `app/api/v1/payments/webhook/route.ts` |
| Identificador do pedido em UUID | Decisão 3 | R07 | `prisma/schema.prisma` |
| Telefone e endereço ocultos após a entrega | Decisão 3 | R08 | `lib/minimizacao.ts` |
| Limite de requisições por conta e por origem | Decisão 4 | R09 | `lib/limite-de-requisicoes.ts` |

### Onde a autorização é decidida

A Decisão 1 da arquitetura pede "validação centralizada de autorização". Em Next.js, o arquivo de borda do framework parece o lugar natural para isso. Ele se chamava `middleware.ts` até a versão 15 e `proxy.ts` a partir da 16.

A borda serve para verificação rápida e redirecionamento, mas não deve ser a única linha de defesa. A maior parte das verificações precisa ficar o mais perto possível da fonte de dados, e cada rota de API é tratada como um endpoint público que confere por conta própria quem está chamando. É o que recomenda a documentação do framework. Duas razões sustentam essa recomendação:

- **A borda decide por padrão de caminho.** Uma rota nova que não case com o padrão nasce desprotegida.
- **Uma falha na borda vale para todas as rotas ao mesmo tempo.** A **CVE-2025-29927**, de severidade 9.1, é o exemplo. Um cabeçalho pulava o middleware inteiro, e quem verificava autorização apenas ali ficava exposto por completo. A falha foi corrigida na versão 15.2.3, e este projeto roda a 16.3.1.

A centralização exigida pela Decisão 1 vem, então, de um módulo único chamado dentro de cada rota. É o padrão que a documentação chama de **Data Access Layer**. O CWE atribuído à CVE é o **CWE-285**, o mesmo que a análise já havia mapeado para o risco R10. O raciocínio completo está comentado em `lib/autorizacao.ts`.

## Testes de segurança

```bash
npm run build && npm run start &   # a aplicação precisa estar no ar
npm test
```

São os oito testes definidos na Etapa 4 do trabalho, com os mesmos identificadores (TS01 a TS08) e os mesmos resultados esperados, mais três acrescentados durante a implementação: o TS09 verifica a exigência do segundo fator, o TS10 que o reenvio da mesma confirmação de pagamento não processa duas vezes, e o TS11 que uma rajada de requisições é barrada. Eles rodam contra a API, e não contra as funções internas, porque o que precisa ser verificado é o comportamento visto por quem chama de fora.

## Pipeline

O arquivo [`.github/workflows/pipeline-devsecops.yml`](.github/workflows/pipeline-devsecops.yml) implementa as quatro condições de bloqueio definidas na análise. Cada job leva o identificador da condição, para que a falha aponte qual regra barrou a entrega:

| Job | Barra quando |
| --- | ------------ |
| `C1` | algum teste de autorização ou de integridade falha |
| `C2` | o gitleaks encontra segredo versionado no histórico |
| `C3` | o `npm audit` encontra dependência com vulnerabilidade alta ou crítica |
| `C4` | a varredura dinâmica com o ZAP registra achado sem análise |

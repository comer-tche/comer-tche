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

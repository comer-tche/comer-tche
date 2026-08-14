import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Popula o banco com o minimo para dar para usar e testar a aplicacao:
// alguns itens de cardapio e quatro contas, uma de cada perfil.
//
// As senhas daqui sao publicas de proposito, porque este e um banco de
// desenvolvimento. Nenhuma delas vale em qualquer outro lugar.

const banco = new PrismaClient();

const SENHA_DE_DESENVOLVIMENTO = "comer-tche-dev";

async function main() {
  const senhaHash = await bcrypt.hash(SENHA_DE_DESENVOLVIMENTO, 12);

  // Cada conta de teste ja nasce com um aparelho reconhecido. Sem isso, todo
  // login dispararia o segundo fator (RS03) e os testes automatizados nao
  // teriam como concluir, ja que o codigo sai por e-mail e nunca aparece na
  // resposta da API em producao. A exigencia do segundo fator continua sendo
  // verificada: o teste TS09 confirma que um aparelho desconhecido nao recebe
  // token nenhum.
  const contas = [
    { email: "cliente@exemplo.test", nome: "Cliente de Teste", perfil: "CLIENTE", aparelho: "aparelho-do-cliente-a" },
    { email: "outro.cliente@exemplo.test", nome: "Outro Cliente", perfil: "CLIENTE", aparelho: "aparelho-do-cliente-b" },
    { email: "entregador@exemplo.test", nome: "Entregador de Teste", perfil: "ENTREGADOR", aparelho: "aparelho-do-entregador" },
    { email: "admin@exemplo.test", nome: "Administrador", perfil: "ADMIN", aparelho: "aparelho-do-admin" },
  ];

  for (const conta of contas) {
    const usuario = await banco.user.upsert({
      where: { email: conta.email },
      update: {},
      create: {
        email: conta.email,
        passwordHash: senhaHash,
        nome: conta.nome,
        telefone: "55999990000",
        endereco: "Rua de Teste, 100",
        perfil: conta.perfil,
      },
    });

    // A impressao e o sha256 do valor enviado no cabecalho x-dispositivo,
    // o mesmo calculo de lib/segundo-fator.ts.
    const impressao = createHash("sha256").update(conta.aparelho).digest("hex");

    await banco.knownDevice.upsert({
      where: { usuarioId_impressao: { usuarioId: usuario.id, impressao } },
      update: {},
      create: { usuarioId: usuario.id, impressao },
    });
  }

  const cardapio = [
    { name: "Xis Salada", descricao: "Pao, hamburguer, queijo, alface e tomate", precoEmCentavos: 2800 },
    { name: "Xis Coracao", descricao: "Pao, coracao de galinha, queijo e maionese", precoEmCentavos: 3200 },
    { name: "Porcao de Batata", descricao: "Batata frita com cheddar", precoEmCentavos: 2500 },
    { name: "Refrigerante Lata", descricao: "350 ml", precoEmCentavos: 700 },
  ];

  for (const item of cardapio) {
    const existente = await banco.menuItem.findFirst({ where: { name: item.name } });
    if (!existente) {
      await banco.menuItem.create({ data: item });
    }
  }

  console.log(`Banco populado: ${contas.length} contas e ${cardapio.length} itens de cardapio.`);
  console.log(`Senha de todas as contas de desenvolvimento: ${SENHA_DE_DESENVOLVIMENTO}`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => banco.$disconnect());

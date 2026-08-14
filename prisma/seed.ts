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

  const contas = [
    { email: "cliente@exemplo.test", nome: "Cliente de Teste", perfil: "CLIENTE" },
    { email: "outro.cliente@exemplo.test", nome: "Outro Cliente", perfil: "CLIENTE" },
    { email: "entregador@exemplo.test", nome: "Entregador de Teste", perfil: "ENTREGADOR" },
    { email: "admin@exemplo.test", nome: "Administrador", perfil: "ADMIN" },
  ];

  for (const conta of contas) {
    await banco.user.upsert({
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

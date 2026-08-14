import bcrypt from "bcryptjs";
import { banco } from "@/lib/banco";

// POST /api/v1/auth/register
// Cria uma conta de cliente.
//
// A senha nunca e guardada em texto. O bcrypt gera um hash com sal aleatorio,
// de modo que duas pessoas com a mesma senha tenham hashes diferentes, e o
// custo 12 torna a verificacao lenta o bastante para atrapalhar quem tentar
// quebrar os hashes em massa caso o banco vaze.
const CUSTO_DO_BCRYPT = 12;

export async function POST(requisicao: Request) {
  const corpo = await requisicao.json();

  const jaExiste = await banco.user.findUnique({ where: { email: corpo.email } });
  if (jaExiste) {
    return Response.json({ erro: "E-mail ja cadastrado" }, { status: 409 });
  }

  const usuario = await banco.user.create({
    data: {
      email: corpo.email,
      passwordHash: await bcrypt.hash(corpo.senha, CUSTO_DO_BCRYPT),
      nome: corpo.nome,
      telefone: corpo.telefone,
      endereco: corpo.endereco,
      // O perfil nunca vem do corpo da requisicao. Toda conta criada por
      // esta rota publica nasce como CLIENTE. Aceitar o perfil enviado pelo
      // cliente permitiria a qualquer pessoa se cadastrar como ADMIN, que e
      // o risco R10. Perfis privilegiados sao concedidos por um
      // administrador, em rota propria e com registro de auditoria.
      perfil: "CLIENTE",
    },
  });

  return Response.json(
    { id: usuario.id, email: usuario.email, perfil: usuario.perfil },
    { status: 201 },
  );
}

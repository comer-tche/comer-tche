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
      // O perfil vem do corpo da requisicao nesta versao inicial.
      // Isso permite que qualquer pessoa se cadastre como ADMIN, e e o
      // risco R10 do trabalho. O controle que fecha essa porta entra no
      // commit que aplica o requisito RS01.
      perfil: corpo.perfil ?? "CLIENTE",
    },
  });

  return Response.json(
    { id: usuario.id, email: usuario.email, perfil: usuario.perfil },
    { status: 201 },
  );
}

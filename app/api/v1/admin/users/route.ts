import { banco } from "@/lib/banco";
import { sessaoDaRequisicao } from "@/lib/sessao";

// GET /api/v1/admin/users
// Lista todos os usuarios da plataforma. Rota administrativa.
//
// ATENCAO, VULNERABILIDADE PROPOSITAL NESTA VERSAO.
// A rota exige apenas que exista alguem autenticado. Nao verifica o perfil.
// Qualquer conta de cliente que chame este endereco direto, sem passar pela
// interface, recebe a lista completa de usuarios. Esconder o botao na tela
// nao e protecao, e e exatamente o que a Decisao 1 da Etapa 3 diz. E o risco
// R10 do trabalho. A verificacao de perfil entra no commit que aplica o
// requisito RS01.

export async function GET(requisicao: Request) {
  const sessao = await sessaoDaRequisicao(requisicao);
  if (!sessao) {
    return Response.json({ erro: "Nao autenticado" }, { status: 401 });
  }

  const usuarios = await banco.user.findMany({
    select: {
      id: true,
      email: true,
      nome: true,
      telefone: true,
      endereco: true,
      perfil: true,
      criadoEm: true,
    },
    orderBy: { id: "asc" },
  });

  return Response.json(usuarios);
}

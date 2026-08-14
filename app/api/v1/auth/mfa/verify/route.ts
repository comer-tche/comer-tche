import { banco } from "@/lib/banco";
import { assinarToken } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import { marcarDispositivoComoConhecido, verificarDesafio } from "@/lib/segundo-fator";

// POST /api/v1/auth/mfa/verify
// Conclui o login iniciado em /api/v1/auth/login quando o aparelho nao era
// reconhecido. Requisito RS03, tratando o risco R01.

export async function POST(requisicao: Request) {
  const corpo = await requisicao.json().catch(() => null);

  if (!corpo?.desafioId || !corpo?.codigo) {
    return Response.json({ erro: "Informe o desafio e o codigo" }, { status: 400 });
  }

  const resultado = await verificarDesafio(String(corpo.desafioId), String(corpo.codigo));

  if (!resultado.ok) {
    await registrar({
      acao: "MFA_NEGADO",
      requisicao,
      detalhe: resultado.motivo,
    });
    // O motivo exato nao volta para quem chamou: dizer se o codigo estava
    // errado ou se o desafio ja tinha expirado ajudaria a calibrar um ataque.
    return Response.json({ erro: "Codigo invalido ou expirado" }, { status: 401 });
  }

  const usuario = await banco.user.findUnique({ where: { id: resultado.usuarioId } });
  if (!usuario) {
    return Response.json({ erro: "Codigo invalido ou expirado" }, { status: 401 });
  }

  // O aparelho passa a ser reconhecido, e os proximos logins nele dispensam
  // o segundo fator.
  await marcarDispositivoComoConhecido(usuario.id, resultado.impressao);

  const sessao = { usuarioId: usuario.id, perfil: usuario.perfil };
  const token = await assinarToken(sessao);

  await registrar({ acao: "LOGIN_ACEITO", requisicao, sessao, detalhe: "apos segundo fator" });

  return Response.json({ token, perfil: usuario.perfil });
}

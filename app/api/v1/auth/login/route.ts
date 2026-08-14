import bcrypt from "bcryptjs";
import { banco } from "@/lib/banco";
import { assinarToken } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";
import {
  criarDesafio,
  dispositivoConhecido,
  impressaoDoDispositivo,
  marcarDispositivoComoConhecido,
} from "@/lib/segundo-fator";

// POST /api/v1/auth/login
// Autentica com e-mail e senha.
//
// Requisito RS03: quando o login vem de um aparelho que a conta nunca usou, a
// resposta nao traz token. Traz um desafio de segundo fator, e a sessao so e
// aberta depois que o codigo e confirmado em /api/v1/auth/mfa/verify.
//
// Trata o risco R01 (uso indevido de conta com senhas vazadas).

// Bloqueio por tentativas. A contagem sai da propria trilha de auditoria, que
// e a mesma fonte de dados da Regra 1 de deteccao (secao 19.4).
const JANELA_DE_BLOQUEIO_EM_MINUTOS = 15;
const TENTATIVAS_ATE_BLOQUEAR = 5;

async function excedeuTentativas(email: string): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_DE_BLOQUEIO_EM_MINUTOS * 60_000);

  const recusas = await banco.auditLog.count({
    where: { acao: "LOGIN_NEGADO", alvo: `email:${email}`, criadoEm: { gte: desde } },
  });

  return recusas >= TENTATIVAS_ATE_BLOQUEAR;
}

export async function POST(requisicao: Request) {
  const corpo = await requisicao.json().catch(() => null);

  if (!corpo?.email || !corpo?.senha) {
    return Response.json({ erro: "Informe e-mail e senha" }, { status: 400 });
  }

  if (await excedeuTentativas(corpo.email)) {
    await registrar({
      acao: "LOGIN_NEGADO",
      requisicao,
      alvo: `email:${corpo.email}`,
      detalhe: "bloqueado por excesso de tentativas",
    });
    return Response.json(
      { erro: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  const usuario = await banco.user.findUnique({ where: { email: corpo.email } });

  // A mesma mensagem e devolvida para e-mail inexistente e para senha errada.
  // Distinguir os dois casos entregaria a um atacante a lista de e-mails
  // cadastrados na plataforma.
  const senhaConfere = usuario && (await bcrypt.compare(corpo.senha, usuario.passwordHash));
  if (!usuario || !senhaConfere) {
    await registrar({ acao: "LOGIN_NEGADO", requisicao, alvo: `email:${corpo.email}` });
    return Response.json({ erro: "Credenciais invalidas" }, { status: 401 });
  }

  const impressao = impressaoDoDispositivo(requisicao);
  const sessao = { usuarioId: usuario.id, perfil: usuario.perfil };

  if (!(await dispositivoConhecido(usuario.id, impressao))) {
    const desafio = await criarDesafio(usuario.id, impressao);

    await registrar({
      acao: "MFA_EXIGIDO",
      requisicao,
      sessao,
      detalhe: "login a partir de aparelho nao reconhecido",
    });

    // A senha estava certa, mas nenhuma sessao e aberta aqui. Sem token, a
    // credencial vazada sozinha nao leva a lugar nenhum.
    return Response.json(
      {
        situacao: "MFA_PENDING",
        desafioId: desafio.desafioId,
        codigoParaDesenvolvimento: desafio.codigoParaDesenvolvimento,
      },
      { status: 200 },
    );
  }

  await marcarDispositivoComoConhecido(usuario.id, impressao);
  const token = await assinarToken(sessao);

  await registrar({ acao: "LOGIN_ACEITO", requisicao, sessao });

  return Response.json({ token, perfil: usuario.perfil });
}

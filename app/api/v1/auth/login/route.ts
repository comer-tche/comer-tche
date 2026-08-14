import bcrypt from "bcryptjs";
import { banco } from "@/lib/banco";
import { assinarToken } from "@/lib/sessao";
import { registrar } from "@/lib/auditoria";

// POST /api/v1/auth/login
// Autentica com e-mail e senha e devolve um token de sessao.
//
// Nesta versao inicial a senha e o unico fator. O risco R01 do trabalho
// descreve exatamente o problema: listas de senhas vazadas circulam
// publicamente, e sem uma verificacao adicional nada interrompe quem testa
// essas listas em massa. O segundo fator entra no commit que aplica o
// requisito RS03.

export async function POST(requisicao: Request) {
  const corpo = await requisicao.json();

  const usuario = await banco.user.findUnique({ where: { email: corpo.email } });

  // A mesma mensagem e devolvida para e-mail inexistente e para senha errada.
  // Distinguir os dois casos entregaria a um atacante a lista de e-mails
  // cadastrados na plataforma.
  const senhaConfere = usuario && (await bcrypt.compare(corpo.senha, usuario.passwordHash));
  if (!usuario || !senhaConfere) {
    // A tentativa recusada e registrada com a origem, porque e dela que a
    // Regra 1 de deteccao (secao 19.4) deriva o alerta de teste de senhas
    // vazadas em massa.
    await registrar({
      acao: "LOGIN_NEGADO",
      requisicao,
      alvo: `email:${corpo.email}`,
    });
    return Response.json({ erro: "Credenciais invalidas" }, { status: 401 });
  }

  const sessao = { usuarioId: usuario.id, perfil: usuario.perfil };
  const token = await assinarToken(sessao);

  await registrar({ acao: "LOGIN_ACEITO", requisicao, sessao });

  return Response.json({ token, perfil: usuario.perfil });
}

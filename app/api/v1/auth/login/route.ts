import bcrypt from "bcryptjs";
import { banco } from "@/lib/banco";
import { assinarToken } from "@/lib/sessao";

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
    return Response.json({ erro: "Credenciais invalidas" }, { status: 401 });
  }

  const token = await assinarToken({ usuarioId: usuario.id, perfil: usuario.perfil });

  return Response.json({ token, perfil: usuario.perfil });
}

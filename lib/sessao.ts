import { SignJWT, jwtVerify } from "jose";

// O que fica guardado dentro do token de sessao. Apenas o identificador e o
// perfil: nada de dado pessoal, para o token nao virar um vazamento caso seja
// interceptado.
export type DadosDaSessao = {
  usuarioId: number;
  perfil: string;
};

const SEGREDO = process.env.JWT_SECRET;

if (!SEGREDO) {
  throw new Error(
    "JWT_SECRET nao definido. Copie o .env.example para .env e preencha antes de subir a aplicacao.",
  );
}

const chave = new TextEncoder().encode(SEGREDO);

export async function assinarToken(dados: DadosDaSessao): Promise<string> {
  return new SignJWT({ perfil: dados.perfil })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(dados.usuarioId))
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(chave);
}

// Devolve os dados da sessao quando o token e valido, e null quando nao e.
// Nunca lanca excecao: quem chama decide o que fazer com a ausencia de sessao.
export async function lerToken(token: string | null): Promise<DadosDaSessao | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, chave);
    return {
      usuarioId: Number(payload.sub),
      perfil: String(payload.perfil),
    };
  } catch {
    return null;
  }
}

// Extrai o token do cabecalho "Authorization: Bearer <token>".
export function tokenDaRequisicao(requisicao: Request): string | null {
  const cabecalho = requisicao.headers.get("authorization");
  if (!cabecalho?.startsWith("Bearer ")) return null;
  return cabecalho.slice("Bearer ".length);
}

export async function sessaoDaRequisicao(requisicao: Request): Promise<DadosDaSessao | null> {
  return lerToken(tokenDaRequisicao(requisicao));
}

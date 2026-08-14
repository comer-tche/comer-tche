import { PrismaClient } from "@prisma/client";

// Em desenvolvimento o Next recarrega os modulos a cada alteracao. Sem este
// cache global, cada recarga abriria uma nova conexao com o banco ate estourar
// o limite. Guardar a instancia no objeto global evita isso.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const banco = globalParaPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = banco;
}

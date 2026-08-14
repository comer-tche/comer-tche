-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "autorId" INTEGER,
    "autorPerfil" TEXT,
    "acao" TEXT NOT NULL,
    "alvo" TEXT,
    "rota" TEXT NOT NULL,
    "origemIp" TEXT,
    "agente" TEXT,
    "detalhe" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AuditLog_autorId_idx" ON "AuditLog"("autorId");

-- CreateIndex
CREATE INDEX "AuditLog_acao_idx" ON "AuditLog"("acao");

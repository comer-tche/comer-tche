-- CreateTable
CREATE TABLE "KnownDevice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "impressao" TEXT NOT NULL,
    "primeiroUso" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUso" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" INTEGER NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "impressao" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "expiraEm" DATETIME NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "KnownDevice_usuarioId_impressao_key" ON "KnownDevice"("usuarioId", "impressao");

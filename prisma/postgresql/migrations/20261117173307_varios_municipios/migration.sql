-- CreateTable
CREATE TABLE "Municipality" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "networkName" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'provisionando',
    "provisionError" TEXT,
    "logo" BYTEA,
    "logoType" TEXT,
    "primaryColor" TEXT NOT NULL,
    "menuColor" TEXT NOT NULL,
    "colorSource" TEXT NOT NULL DEFAULT 'regras',
    "firstAdminName" TEXT,
    "firstAdminEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Municipality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MunicipalityEvent" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MunicipalityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Municipality_slug_key" ON "Municipality"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Municipality_dbName_key" ON "Municipality"("dbName");

-- CreateIndex
CREATE INDEX "MunicipalityEvent_municipalityId_createdAt_idx" ON "MunicipalityEvent"("municipalityId", "createdAt");

-- AddForeignKey
ALTER TABLE "MunicipalityEvent" ADD CONSTRAINT "MunicipalityEvent_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "Municipality"("id") ON DELETE CASCADE ON UPDATE CASCADE;


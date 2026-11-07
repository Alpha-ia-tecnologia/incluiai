-- AlterTable
ALTER TABLE "Consent" ADD COLUMN     "card" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StudentCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "photo" BYTEA,
    "photoMime" TEXT,
    "photoUpdatedAt" TIMESTAMP(3),
    "showHelp" BOOLEAN NOT NULL DEFAULT false,
    "emergencyName" TEXT,
    "emergencyRelation" TEXT,
    "emergencyPhone" TEXT,
    "showEmergency" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentCard_studentId_key" ON "StudentCard"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCard_token_key" ON "StudentCard"("token");

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;


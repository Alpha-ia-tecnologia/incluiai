-- CreateTable
CREATE TABLE "HealthReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'lendo',
    "reading" TEXT,
    "privacyNote" TEXT,
    "failure" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedRole" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "accepted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthReport_studentId_createdAt_idx" ON "HealthReport"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "HealthReport" ADD CONSTRAINT "HealthReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "inepCode" TEXT,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeYear" TEXT,
    "shift" TEXT NOT NULL DEFAULT 'manha',
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "stage" TEXT NOT NULL,
    "gradeYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "hasAEE" BOOLEAN NOT NULL DEFAULT false,
    "aeeFrequency" TEXT,
    "supportProfessional" BOOLEAN NOT NULL DEFAULT false,
    "guardianName" TEXT NOT NULL,
    "guardianPhone" TEXT,
    "accessibilityNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "avatarHue" INTEGER NOT NULL DEFAULT 200,
    "inepId" TEXT,
    "cpf" TEXT,
    "census" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDraft" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "analysis" TEXT,
    "trace" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStudy" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "content" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "concludedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "schoolId" TEXT,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totpSecret" TEXT,
    "totpPendingSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "totpLastStep" INTEGER,
    "recoveryCodes" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT false,
    "weeklyCheckIn" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "mfaPending" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "aiUse" BOOLEAN NOT NULL DEFAULT false,
    "therapistLink" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "history" TEXT NOT NULL DEFAULT '[]',
    "pseudonyms" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "steps" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "args" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AssistantAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyMark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntersectorReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "communication" TEXT NOT NULL,
    "accessResources" TEXT NOT NULL,
    "positioning" TEXT,
    "facilitators" TEXT NOT NULL,
    "schoolGuidance" TEXT NOT NULL,
    "strategiesToTry" TEXT NOT NULL,
    "sharedGoals" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntersectorReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'regras',
    "topic" TEXT,
    "context" TEXT,
    "objectiveId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sugerido',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "trace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialImage" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "cardIndex" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunctionalProfile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "expressiveChannel" TEXT NOT NULL,
    "receptiveChannel" TEXT NOT NULL,
    "commandSteps" INTEGER NOT NULL,
    "readingSupport" INTEGER NOT NULL,
    "writingSupport" INTEGER NOT NULL,
    "mathSupport" INTEGER NOT NULL,
    "attentionMinutes" INTEGER NOT NULL,
    "peerInteraction" INTEGER NOT NULL,
    "adultInteraction" INTEGER NOT NULL,
    "groupWork" INTEGER NOT NULL,
    "feeding" INTEGER NOT NULL,
    "hygiene" INTEGER NOT NULL,
    "mobility" INTEGER NOT NULL,
    "organization" INTEGER NOT NULL,
    "sensoryProfile" TEXT NOT NULL,
    "fineMotor" INTEGER NOT NULL,
    "grossMotor" INTEGER NOT NULL,
    "usesWheelchairOrOrthosis" BOOLEAN NOT NULL DEFAULT false,
    "triggers" TEXT NOT NULL,
    "earlySigns" TEXT NOT NULL,
    "calmingStrategies" TEXT NOT NULL,
    "bestShift" TEXT NOT NULL,
    "taskToleranceMinutes" INTEGER NOT NULL,
    "interests" TEXT NOT NULL,
    "barriers" TEXT NOT NULL,
    "strengths" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunctionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "initialSituation" TEXT NOT NULL,
    "commonRoomStrategies" TEXT,
    "aeeStrategies" TEXT,
    "accessibilityResources" TEXT,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanReview" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "onTime" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,
    "nextReviewDate" TIMESTAMP(3) NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "reviewerRole" TEXT NOT NULL,

    CONSTRAINT "PlanReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "deadlineWeeks" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "bnccCode" TEXT,
    "dimension" TEXT NOT NULL,
    "currentSupport" INTEGER NOT NULL,
    "targetSupport" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "materials" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "responseForm" TEXT NOT NULL,
    "adaptations" TEXT NOT NULL,
    "supportBelow" TEXT NOT NULL,
    "supportTarget" TEXT NOT NULL,
    "supportAbove" TEXT NOT NULL,
    "successCriterion" TEXT NOT NULL,
    "planB" TEXT NOT NULL,
    "classParticipation" TEXT,
    "reviewNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sugerida',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'regras',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityImage" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "model" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "activityId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participation" TEXT NOT NULL,
    "supportLevel" INTEGER NOT NULL,
    "criterionMet" TEXT NOT NULL,
    "note" TEXT,
    "whatWorked" TEXT,
    "recommendation" TEXT,
    "authorRole" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "skillArea" TEXT NOT NULL,
    "accessibilityNeed" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "complexity" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "positiveOutcomes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceActivity" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "materials" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "adaptations" TEXT NOT NULL,
    "evidenceCriterion" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "positiveOutcomes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResourceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL,
    "author" TEXT NOT NULL,

    CONSTRAINT "FamilyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "actorId" TEXT,
    "actor" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuaPlanning" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "schoolId" TEXT,
    "className" TEXT,
    "sharing" TEXT NOT NULL DEFAULT 'privado',
    "sharedAt" TIMESTAMP(3),
    "sharedBy" TEXT,
    "collaborators" TEXT NOT NULL DEFAULT '[]',
    "reusedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuaPlanning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuaPlanningVersion" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'rascunho',
    "content" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedByName" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "validatedByName" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuaPlanningVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuaApplication" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "context" TEXT NOT NULL,
    "schoolId" TEXT,
    "className" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "responsibles" TEXT NOT NULL DEFAULT '[]',
    "resources" TEXT,
    "organization" TEXT,
    "participantIds" TEXT NOT NULL DEFAULT '[]',
    "state" TEXT NOT NULL DEFAULT 'planejada',
    "notes" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuaSupport" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'rascunho',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "responsibleId" TEXT NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "validatedById" TEXT,
    "validatedByName" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuaSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuaEvidence" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "supportId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "context" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "criteria" TEXT NOT NULL,
    "optionsOffered" TEXT NOT NULL DEFAULT '[]',
    "participationForm" TEXT NOT NULL DEFAULT '',
    "studentChoice" TEXT NOT NULL DEFAULT '',
    "supportProvided" TEXT NOT NULL DEFAULT '',
    "observedResponse" TEXT NOT NULL DEFAULT '',
    "remainingBarriers" TEXT NOT NULL DEFAULT '',
    "nextStep" TEXT NOT NULL DEFAULT '',
    "observation" TEXT NOT NULL,
    "result" TEXT,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuaEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuaMaterial" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "studentId" TEXT,
    "supportId" TEXT,
    "resourceId" TEXT,
    "content" TEXT NOT NULL,
    "accessibility" TEXT NOT NULL DEFAULT '[]',
    "aiParticipation" TEXT NOT NULL DEFAULT 'nenhuma',
    "state" TEXT NOT NULL DEFAULT 'rascunho',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "validatedById" TEXT,
    "validatedByName" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuaMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuaSuggestion" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "supportId" TEXT,
    "studentId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "basisHash" TEXT NOT NULL,
    "profileFields" TEXT NOT NULL DEFAULT '[]',
    "promptVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "state" TEXT NOT NULL,
    "checks" TEXT NOT NULL DEFAULT '[]',
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuaSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuaAuditEvent" (
    "id" TEXT NOT NULL,
    "planningId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT,
    "versionNumber" INTEGER,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuaAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AeeSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AeeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "data" TEXT NOT NULL,
    "opinion" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "updatedByName" TEXT NOT NULL,
    "validatedById" TEXT,
    "validatedByName" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptedTask" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "planningId" TEXT,
    "level" TEXT,
    "batchId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "options" TEXT NOT NULL DEFAULT '[]',
    "content" TEXT NOT NULL,
    "bnccCode" TEXT,
    "objectiveId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instrumentVersion" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "notes" TEXT,
    "appliedById" TEXT NOT NULL,
    "appliedByName" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyCheckIn" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CensusSnapshot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "inepCode" TEXT NOT NULL,
    "fileSchoolName" TEXT NOT NULL,
    "persons" TEXT NOT NULL,
    "regularOnly" TEXT NOT NULL DEFAULT '[]',
    "schoolInfo" TEXT NOT NULL DEFAULT '{}',
    "counts" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "importedByName" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CensusSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CensusImport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fileSchoolCode" TEXT NOT NULL,
    "fileSchoolName" TEXT NOT NULL,
    "persons" TEXT NOT NULL,
    "regularOnly" TEXT NOT NULL DEFAULT '[]',
    "schoolInfo" TEXT NOT NULL DEFAULT '{}',
    "stats" TEXT NOT NULL,
    "decisions" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'previa',
    "result" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "CensusImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CensusCheck" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "confirmed" INTEGER NOT NULL,
    "pending" INTEGER NOT NULL,
    "schools" TEXT NOT NULL,

    CONSTRAINT "CensusCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CensusMonitor" (
    "id" TEXT NOT NULL DEFAULT 'rede',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "times" TEXT NOT NULL,
    "fndeAee" INTEGER,
    "fndeYear" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CensusMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_inepCode_key" ON "School"("inepCode");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_schoolId_name_key" ON "SchoolClass"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDraft_studentId_key" ON "PlanDraft"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudy_studentId_key" ON "CaseStudy"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AccountEvent_userId_createdAt_idx" ON "AccountEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentLink_studentId_idx" ON "StudentLink"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentLink_userId_studentId_key" ON "StudentLink"("userId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_studentId_key" ON "Consent"("studentId");

-- CreateIndex
CREATE INDEX "AccessGrant_userId_studentId_expiresAt_idx" ON "AccessGrant"("userId", "studentId", "expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyMark_userId_key_key" ON "JourneyMark"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialImage_materialId_cardIndex_key" ON "MaterialImage"("materialId", "cardIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionalProfile_studentId_key" ON "FunctionalProfile"("studentId");

-- CreateIndex
CREATE INDEX "PlanReview_planId_reviewedAt_idx" ON "PlanReview"("planId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityImage_activityId_key" ON "ActivityImage"("activityId");

-- CreateIndex
CREATE INDEX "ResourceActivity_resourceId_position_idx" ON "ResourceActivity"("resourceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceActivity_resourceId_title_key" ON "ResourceActivity"("resourceId", "title");

-- CreateIndex
CREATE INDEX "AccessLog_studentId_createdAt_idx" ON "AccessLog"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "DuaPlanning_schoolId_idx" ON "DuaPlanning"("schoolId");

-- CreateIndex
CREATE INDEX "DuaPlanning_ownerId_idx" ON "DuaPlanning"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "DuaPlanningVersion_planningId_version_key" ON "DuaPlanningVersion"("planningId", "version");

-- CreateIndex
CREATE INDEX "DuaApplication_planningId_idx" ON "DuaApplication"("planningId");

-- CreateIndex
CREATE INDEX "DuaSupport_planningId_idx" ON "DuaSupport"("planningId");

-- CreateIndex
CREATE INDEX "DuaSupport_studentId_idx" ON "DuaSupport"("studentId");

-- CreateIndex
CREATE INDEX "DuaEvidence_studentId_idx" ON "DuaEvidence"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DuaEvidence_applicationId_studentId_key" ON "DuaEvidence"("applicationId", "studentId");

-- CreateIndex
CREATE INDEX "DuaMaterial_planningId_idx" ON "DuaMaterial"("planningId");

-- CreateIndex
CREATE UNIQUE INDEX "DuaSuggestion_requestId_key" ON "DuaSuggestion"("requestId");

-- CreateIndex
CREATE INDEX "DuaSuggestion_planningId_idx" ON "DuaSuggestion"("planningId");

-- CreateIndex
CREATE INDEX "DuaAuditEvent_planningId_idx" ON "DuaAuditEvent"("planningId");

-- CreateIndex
CREATE INDEX "DuaAuditEvent_actorId_createdAt_idx" ON "DuaAuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AeeSession_studentId_date_idx" ON "AeeSession"("studentId", "date");

-- CreateIndex
CREATE INDEX "StudentReport_studentId_periodEnd_idx" ON "StudentReport"("studentId", "periodEnd");

-- CreateIndex
CREATE INDEX "AdaptedTask_studentId_createdAt_idx" ON "AdaptedTask"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "AdaptedTask_planningId_batchId_idx" ON "AdaptedTask"("planningId", "batchId");

-- CreateIndex
CREATE INDEX "Assessment_studentId_appliedAt_idx" ON "Assessment"("studentId", "appliedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCheckIn_studentId_weekStart_key" ON "FamilyCheckIn"("studentId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "CensusSnapshot_schoolId_key" ON "CensusSnapshot"("schoolId");

-- CreateIndex
CREATE INDEX "CensusImport_schoolId_createdAt_idx" ON "CensusImport"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDraft" ADD CONSTRAINT "PlanDraft_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudy" ADD CONSTRAINT "CaseStudy_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEvent" ADD CONSTRAINT "AccountEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLink" ADD CONSTRAINT "StudentLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLink" ADD CONSTRAINT "StudentLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantAction" ADD CONSTRAINT "AssistantAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyMark" ADD CONSTRAINT "JourneyMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntersectorReport" ADD CONSTRAINT "IntersectorReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialImage" ADD CONSTRAINT "MaterialImage_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionalProfile" ADD CONSTRAINT "FunctionalProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanReview" ADD CONSTRAINT "PlanReview_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityImage" ADD CONSTRAINT "ActivityImage_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceActivity" ADD CONSTRAINT "ResourceActivity_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyNote" ADD CONSTRAINT "FamilyNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaPlanningVersion" ADD CONSTRAINT "DuaPlanningVersion_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "DuaPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaApplication" ADD CONSTRAINT "DuaApplication_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "DuaPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaApplication" ADD CONSTRAINT "DuaApplication_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DuaPlanningVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaSupport" ADD CONSTRAINT "DuaSupport_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "DuaPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaSupport" ADD CONSTRAINT "DuaSupport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaEvidence" ADD CONSTRAINT "DuaEvidence_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "DuaApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaEvidence" ADD CONSTRAINT "DuaEvidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaMaterial" ADD CONSTRAINT "DuaMaterial_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "DuaPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaMaterial" ADD CONSTRAINT "DuaMaterial_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaSuggestion" ADD CONSTRAINT "DuaSuggestion_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "DuaPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaSuggestion" ADD CONSTRAINT "DuaSuggestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuaAuditEvent" ADD CONSTRAINT "DuaAuditEvent_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "DuaPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeeSession" ADD CONSTRAINT "AeeSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReport" ADD CONSTRAINT "StudentReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptedTask" ADD CONSTRAINT "AdaptedTask_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptedTask" ADD CONSTRAINT "AdaptedTask_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "DuaPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCheckIn" ADD CONSTRAINT "FamilyCheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CensusSnapshot" ADD CONSTRAINT "CensusSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CensusImport" ADD CONSTRAINT "CensusImport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;


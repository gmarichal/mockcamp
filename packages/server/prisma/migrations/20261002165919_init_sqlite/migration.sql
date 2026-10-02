-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Path" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Path_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Path_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Path" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "customPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "delay" INTEGER,
    "delayMin" INTEGER,
    "delayMax" INTEGER,
    "errorRate" REAL NOT NULL DEFAULT 0,
    "strategy" TEXT NOT NULL DEFAULT 'FIXED',
    "seqIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Resource_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "name" TEXT,
    "statusCode" INTEGER NOT NULL DEFAULT 200,
    "bodyType" TEXT NOT NULL DEFAULT 'JSON',
    "body" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Response_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResponseHeader" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "ResponseHeader_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Condition_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Condition_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Variable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT,
    "expression" TEXT,
    "projectId" TEXT,
    "resourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Variable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Variable_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "resourceId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "requestHeaders" JSONB,
    "requestBody" TEXT,
    "statusCode" INTEGER NOT NULL,
    "responseHeaders" JSONB,
    "responseBody" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequestLog_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRole_userId_projectId_key" ON "ProjectRole"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

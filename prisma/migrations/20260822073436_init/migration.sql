-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "group" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'SELF',
    "ticker" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "description" TEXT,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "colorHex" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Brand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Executive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Executive_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TRACK',
    "companyId" TEXT,
    "weight" REAL NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Keyword_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "colorHex" TEXT NOT NULL DEFAULT '#6b7280',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homepage" TEXT,
    "endpoint" TEXT,
    "adapter" TEXT NOT NULL DEFAULT 'rss',
    "sourceType" TEXT NOT NULL DEFAULT 'NEWS',
    "group" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "language" TEXT NOT NULL DEFAULT 'en',
    "credibility" INTEGER NOT NULL DEFAULT 70,
    "mode" TEXT NOT NULL DEFAULT 'LIVE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresCredential" BOOLEAN NOT NULL DEFAULT false,
    "credentialEnvVar" TEXT,
    "queryTemplate" TEXT,
    "rateLimitMs" INTEGER NOT NULL DEFAULT 1000,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "maxItems" INTEGER NOT NULL DEFAULT 40,
    "isRegulatory" BOOLEAN NOT NULL DEFAULT false,
    "authority" TEXT,
    "termsUrl" TEXT,
    "complianceNote" TEXT,
    "lastCheckedAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastErrorAt" DATETIME,
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "simhash" TEXT NOT NULL,
    "imageUrl" TEXT,
    "author" TEXT,
    "publisher" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT NOT NULL DEFAULT 'en',
    "country" TEXT NOT NULL DEFAULT 'IN',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "duplicateOfId" TEXT,
    "clusterId" TEXT,
    "refreshJobId" TEXT,
    CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Article_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "StoryCluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL DEFAULT 'corporate',
    "contentType" TEXT NOT NULL DEFAULT 'REPORTING',
    "relevance" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "corroboration" INTEGER NOT NULL DEFAULT 1,
    "importanceScore" INTEGER NOT NULL DEFAULT 0,
    "primaryCompanyKey" TEXT,
    "companyKeys" TEXT NOT NULL DEFAULT '[]',
    "topics" TEXT NOT NULL DEFAULT '[]',
    "engine" TEXT NOT NULL DEFAULT 'heuristic-v1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Analysis_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SentimentResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "score" REAL NOT NULL DEFAULT 0,
    "magnitude" REAL NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "rationale" TEXT,
    "engine" TEXT NOT NULL DEFAULT 'heuristic-v1',
    CONSTRAINT "SentimentResult_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'LOW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "drivers" TEXT NOT NULL DEFAULT '[]',
    "dimensions" TEXT NOT NULL DEFAULT '{}',
    "engine" TEXT NOT NULL DEFAULT 'heuristic-v1',
    CONSTRAINT "RiskAssessment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArticleEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "refKey" TEXT,
    "mentions" INTEGER NOT NULL DEFAULT 1,
    "confidence" INTEGER NOT NULL DEFAULT 60,
    CONSTRAINT "ArticleEntity_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryCluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "simhash" TEXT NOT NULL,
    "articleCount" INTEGER NOT NULL DEFAULT 1,
    "publisherCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topCompanyKey" TEXT,
    "categoryKey" TEXT,
    "sentimentLabel" TEXT NOT NULL DEFAULT 'NEUTRAL',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "importanceScore" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "RegulatoryDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT,
    "sourceId" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "companyKeys" TEXT NOT NULL DEFAULT '[]',
    "docType" TEXT NOT NULL DEFAULT 'NOTICE',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "whyItMatters" TEXT,
    "issueDate" DATETIME NOT NULL,
    "effectiveDate" DATETIME,
    "responseDeadline" DATETIME,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "documentUrl" TEXT NOT NULL,
    "isPrimaryDocument" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegulatoryDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegulatoryDocument_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "criteria" TEXT NOT NULL DEFAULT '{}',
    "channels" TEXT NOT NULL DEFAULT '["inapp"]',
    "throttleMins" INTEGER NOT NULL DEFAULT 30,
    "lastTriggeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "articleId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlertEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportantStory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportantStory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DAILY',
    "template" TEXT NOT NULL DEFAULT 'standard',
    "theme" TEXT NOT NULL DEFAULT 'ola-light',
    "articleIds" TEXT NOT NULL DEFAULT '[]',
    "options" TEXT NOT NULL DEFAULT '{}',
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "preset" TEXT,
    "articleId" TEXT,
    "briefingId" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "params" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportRecord_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExportRecord_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "Briefing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "sourcesTotal" INTEGER NOT NULL DEFAULT 0,
    "sourcesCompleted" INTEGER NOT NULL DEFAULT 0,
    "sourcesOk" INTEGER NOT NULL DEFAULT 0,
    "sourcesFailed" INTEGER NOT NULL DEFAULT 0,
    "itemsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsNew" INTEGER NOT NULL DEFAULT 0,
    "duplicatesRemoved" INTEGER NOT NULL DEFAULT 0,
    "alertsRaised" INTEGER NOT NULL DEFAULT 0,
    "progress" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT
);

-- CreateTable
CREATE TABLE "SourceFailure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "refreshJobId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'fetch',
    "message" TEXT NOT NULL,
    "statusCode" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceFailure_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SourceFailure_refreshJobId_fkey" FOREIGN KEY ("refreshJobId") REFERENCES "RefreshJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_key_key" ON "Company"("key");

-- CreateIndex
CREATE INDEX "Company_group_idx" ON "Company"("group");

-- CreateIndex
CREATE INDEX "Company_relation_idx" ON "Company"("relation");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_companyId_name_key" ON "Brand"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Executive_companyId_name_key" ON "Executive"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_name_key" ON "Product"("companyId", "name");

-- CreateIndex
CREATE INDEX "Keyword_type_idx" ON "Keyword"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_term_type_key" ON "Keyword"("term", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Category_key_key" ON "Category"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "Source_mode_idx" ON "Source"("mode");

-- CreateIndex
CREATE INDEX "Source_enabled_idx" ON "Source"("enabled");

-- CreateIndex
CREATE INDEX "Source_isRegulatory_idx" ON "Source"("isRegulatory");

-- CreateIndex
CREATE UNIQUE INDEX "Article_urlHash_key" ON "Article"("urlHash");

-- CreateIndex
CREATE INDEX "Article_publishedAt_idx" ON "Article"("publishedAt");

-- CreateIndex
CREATE INDEX "Article_sourceId_idx" ON "Article"("sourceId");

-- CreateIndex
CREATE INDEX "Article_clusterId_idx" ON "Article"("clusterId");

-- CreateIndex
CREATE INDEX "Article_isDemo_idx" ON "Article"("isDemo");

-- CreateIndex
CREATE INDEX "Article_contentHash_idx" ON "Article"("contentHash");

-- CreateIndex
CREATE INDEX "Article_processingStatus_idx" ON "Article"("processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Analysis_articleId_key" ON "Analysis"("articleId");

-- CreateIndex
CREATE INDEX "Analysis_categoryKey_idx" ON "Analysis"("categoryKey");

-- CreateIndex
CREATE INDEX "Analysis_relevance_idx" ON "Analysis"("relevance");

-- CreateIndex
CREATE INDEX "Analysis_importanceScore_idx" ON "Analysis"("importanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "SentimentResult_articleId_key" ON "SentimentResult"("articleId");

-- CreateIndex
CREATE INDEX "SentimentResult_label_idx" ON "SentimentResult"("label");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_articleId_key" ON "RiskAssessment"("articleId");

-- CreateIndex
CREATE INDEX "RiskAssessment_level_idx" ON "RiskAssessment"("level");

-- CreateIndex
CREATE INDEX "ArticleEntity_type_value_idx" ON "ArticleEntity"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleEntity_articleId_type_value_key" ON "ArticleEntity"("articleId", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "StoryCluster_slug_key" ON "StoryCluster"("slug");

-- CreateIndex
CREATE INDEX "StoryCluster_lastSeenAt_idx" ON "StoryCluster"("lastSeenAt");

-- CreateIndex
CREATE INDEX "StoryCluster_importanceScore_idx" ON "StoryCluster"("importanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryDocument_articleId_key" ON "RegulatoryDocument"("articleId");

-- CreateIndex
CREATE INDEX "RegulatoryDocument_authority_idx" ON "RegulatoryDocument"("authority");

-- CreateIndex
CREATE INDEX "RegulatoryDocument_issueDate_idx" ON "RegulatoryDocument"("issueDate");

-- CreateIndex
CREATE INDEX "RegulatoryDocument_severity_idx" ON "RegulatoryDocument"("severity");

-- CreateIndex
CREATE INDEX "AlertEvent_createdAt_idx" ON "AlertEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_readAt_idx" ON "AlertEvent"("readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_articleId_key" ON "Bookmark"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportantStory_articleId_key" ON "ImportantStory"("articleId");

-- CreateIndex
CREATE INDEX "ImportantStory_position_idx" ON "ImportantStory"("position");

-- CreateIndex
CREATE UNIQUE INDEX "SavedView_name_key" ON "SavedView"("name");

-- CreateIndex
CREATE INDEX "ExportRecord_createdAt_idx" ON "ExportRecord"("createdAt");

-- CreateIndex
CREATE INDEX "RefreshJob_startedAt_idx" ON "RefreshJob"("startedAt");

-- CreateIndex
CREATE INDEX "RefreshJob_status_idx" ON "RefreshJob"("status");

-- CreateIndex
CREATE INDEX "SourceFailure_occurredAt_idx" ON "SourceFailure"("occurredAt");

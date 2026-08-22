-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Executive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'EXECUTIVE',
    "since" TEXT,
    "bio" TEXT,
    "profileUrl" TEXT,
    "sourceUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "aliases" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Executive_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Executive" ("active", "aliases", "companyId", "id", "name", "role") SELECT "active", "aliases", "companyId", "id", "name", "role" FROM "Executive";
DROP TABLE "Executive";
ALTER TABLE "new_Executive" RENAME TO "Executive";
CREATE UNIQUE INDEX "Executive_companyId_name_key" ON "Executive"("companyId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

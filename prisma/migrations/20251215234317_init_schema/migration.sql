-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "text" TEXT,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "reposts" INTEGER NOT NULL,
    "replies" INTEGER NOT NULL,
    "postId" TEXT NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" SERIAL NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snapshot_postId_idx" ON "Snapshot"("postId");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

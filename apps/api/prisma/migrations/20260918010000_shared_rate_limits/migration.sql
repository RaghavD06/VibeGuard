CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "totalHits" INTEGER NOT NULL,
  "resetTime" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimitBucket_resetTime_idx" ON "RateLimitBucket"("resetTime");

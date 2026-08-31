-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('queued', 'planning', 'running', 'verifying', 'done', 'failed');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('free', 'pro', 'team');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('llm_cost', 'task_run', 'storage');

-- CreateEnum
CREATE TYPE "OrgMemberRole" AS ENUM ('owner', 'admin', 'member');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "github_id" BIGINT NOT NULL,
    "login" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "stripe_price_id" TEXT,
    "monthly_price_usd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "included_tasks" INTEGER NOT NULL DEFAULT 0,
    "included_spend_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "issue_url" TEXT NOT NULL,
    "issue_title" TEXT NOT NULL,
    "issue_number" INTEGER NOT NULL,
    "repo_owner" TEXT,
    "repo_name" TEXT,
    "branch_name" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'queued',
    "pr_url" TEXT,
    "failure_reason" TEXT,
    "github_login" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_steps" (
    "id" BIGSERIAL NOT NULL,
    "task_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "output_summary" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_metrics" (
    "task_id" UUID NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(12,6) NOT NULL,
    "shadow_cost_usd" DECIMAL(12,6) NOT NULL,
    "llm_calls" INTEGER NOT NULL,
    "tool_calls" INTEGER NOT NULL,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "router_retries" INTEGER,
    "provider_failovers" INTEGER,
    "phases" JSONB NOT NULL DEFAULT '{}',
    "budget_used_usd" DECIMAL(12,6),
    "budget_limit_usd" DECIMAL(12,6),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_metrics_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "task_events" (
    "id" BIGSERIAL NOT NULL,
    "task_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "usage_type" "UsageType" NOT NULL,
    "quantity" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "unit_amount_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "total_usd" DECIMAL(12,6) NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_github_id_key" ON "users"("github_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE UNIQUE INDEX "plans_tier_key" ON "plans"("tier");

-- CreateIndex
CREATE INDEX "tasks_user_id_created_at_idx" ON "tasks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tasks_user_id_status_idx" ON "tasks"("user_id", "status");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "task_steps_task_id_step_number_key" ON "task_steps"("task_id", "step_number");

-- CreateIndex
CREATE UNIQUE INDEX "task_events_task_id_sequence_key" ON "task_events"("task_id", "sequence");

-- CreateIndex
CREATE INDEX "task_events_task_id_created_at_idx" ON "task_events"("task_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "usage_ledger_user_id_created_at_idx" ON "usage_ledger"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_stripe_event_id_key" ON "payment_events"("stripe_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_org_id_user_id_key" ON "organization_members"("org_id", "user_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_metrics" ADD CONSTRAINT "task_metrics_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed free plan
INSERT INTO "plans" ("id", "tier", "name", "monthly_price_usd", "included_tasks", "included_spend_usd", "limits", "is_active")
VALUES (
  gen_random_uuid(),
  'free',
  'Free',
  0,
  50,
  5.00,
  '{"taskBudgetUsd": 0.10, "orgBudgetUsd": 5.00}'::jsonb,
  true
);

CREATE TYPE "app"."account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "app"."job_kind" AS ENUM('match_rewards');--> statement-breakpoint
CREATE TYPE "app"."job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "app"."match_end_reason" AS ENUM('completed', 'surrender', 'abandonment', 'expired', 'technical');--> statement-breakpoint
CREATE TYPE "app"."match_format" AS ENUM('1v1', '2v2');--> statement-breakpoint
CREATE TYPE "app"."match_preset" AS ENUM('casual', 'competitive');--> statement-breakpoint
CREATE TYPE "app"."match_winner" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TABLE "app"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" "app"."account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_login_name_unique" UNIQUE("login_name"),
	CONSTRAINT "accounts_login_name" CHECK ("app"."accounts"."login_name" ~ '^[a-z0-9_]{3,32}$'),
	CONSTRAINT "accounts_password_hash" CHECK ("app"."accounts"."password_hash" ~ '^[$]argon2id[$]v=19[$]m=[0-9]+,t=[0-9]+,p=[0-9]+[$][A-Za-z0-9+/]+[$][A-Za-z0-9+/]+$' AND octet_length("app"."accounts"."password_hash") <= 512)
);
--> statement-breakpoint
CREATE TABLE "app"."avatars" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text NOT NULL,
	"required_level" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "avatars_id" CHECK ("app"."avatars"."id" ~ '^[a-z][a-z0-9-]{0,63}$'),
	CONSTRAINT "avatars_name" CHECK (char_length(btrim("app"."avatars"."name")) BETWEEN 1 AND 64),
	CONSTRAINT "avatars_level" CHECK ("app"."avatars"."required_level" >= 1),
	CONSTRAINT "avatars_order" CHECK ("app"."avatars"."sort_order" >= 0),
	CONSTRAINT "avatars_asset" CHECK ("app"."avatars"."avatar_url" ~ '^/art/([A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+[.](png|webp|svg)$')
);
--> statement-breakpoint
CREATE TABLE "app"."deck_themes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"asset_key" text NOT NULL,
	"required_level" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "deck_themes_id" CHECK ("app"."deck_themes"."id" ~ '^[a-z][a-z0-9-]{0,63}$'),
	CONSTRAINT "deck_themes_name" CHECK (char_length(btrim("app"."deck_themes"."name")) BETWEEN 1 AND 64),
	CONSTRAINT "deck_themes_asset" CHECK ("app"."deck_themes"."asset_key" ~ '^[a-z][a-z0-9-]{0,63}$'),
	CONSTRAINT "deck_themes_level" CHECK ("app"."deck_themes"."required_level" >= 1),
	CONSTRAINT "deck_themes_order" CHECK ("app"."deck_themes"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "app"."job_kind" NOT NULL,
	"match_id" text NOT NULL,
	"status" "app"."job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"lock_token" uuid,
	"finished_at" timestamp with time zone,
	"last_error_code" text,
	CONSTRAINT "jobs_match_kind_unique" UNIQUE("match_id","kind"),
	CONSTRAINT "jobs_attempts" CHECK ("app"."jobs"."attempts" >= 0 AND "app"."jobs"."max_attempts" BETWEEN 1 AND 100 AND "app"."jobs"."attempts" <= "app"."jobs"."max_attempts"),
	CONSTRAINT "jobs_pending_attempts" CHECK ("app"."jobs"."status" <> 'pending' OR "app"."jobs"."attempts" < "app"."jobs"."max_attempts"),
	CONSTRAINT "jobs_lease" CHECK (("app"."jobs"."status" = 'running' AND "app"."jobs"."lock_token" IS NOT NULL AND "app"."jobs"."lease_expires_at" IS NOT NULL AND "app"."jobs"."lease_expires_at" > "app"."jobs"."created_at" AND "app"."jobs"."attempts" > 0) OR ("app"."jobs"."status" <> 'running' AND "app"."jobs"."lock_token" IS NULL AND "app"."jobs"."lease_expires_at" IS NULL)),
	CONSTRAINT "jobs_finished" CHECK (("app"."jobs"."status" IN ('completed', 'failed') AND "app"."jobs"."finished_at" IS NOT NULL AND "app"."jobs"."finished_at" >= "app"."jobs"."created_at") OR ("app"."jobs"."status" IN ('pending', 'running') AND "app"."jobs"."finished_at" IS NULL)),
	CONSTRAINT "jobs_error_code" CHECK ("app"."jobs"."last_error_code" IS NULL OR "app"."jobs"."last_error_code" ~ '^[A-Z][A-Z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE "app"."match_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" text NOT NULL,
	"account_id" uuid,
	"seat" integer NOT NULL,
	"preset" "app"."match_preset" NOT NULL,
	"format" "app"."match_format" NOT NULL,
	"solo" boolean NOT NULL,
	CONSTRAINT "match_participants_seat_unique" UNIQUE("match_id","seat"),
	CONSTRAINT "match_participants_account_unique" UNIQUE("match_id","account_id"),
	CONSTRAINT "match_participants_reward_context_unique" UNIQUE("id","preset","solo"),
	CONSTRAINT "match_participants_seat" CHECK ("app"."match_participants"."seat" >= 0 AND "app"."match_participants"."seat" < CASE WHEN "app"."match_participants"."format" = '1v1' THEN 2 ELSE 4 END)
);
--> statement-breakpoint
CREATE TABLE "app"."match_results" (
	"id" text PRIMARY KEY NOT NULL,
	"preset" "app"."match_preset" NOT NULL,
	"format" "app"."match_format" NOT NULL,
	"solo" boolean DEFAULT false NOT NULL,
	"reason" "app"."match_end_reason" NOT NULL,
	"winner" "app"."match_winner",
	"score_a" integer NOT NULL,
	"score_b" integer NOT NULL,
	"hands_played" integer NOT NULL,
	"powers_used" integer NOT NULL,
	"reward_policy_version" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	CONSTRAINT "match_results_context_unique" UNIQUE("id","preset","format","solo"),
	CONSTRAINT "match_results_id" CHECK (char_length("app"."match_results"."id") BETWEEN 1 AND 128),
	CONSTRAINT "match_results_scores" CHECK ("app"."match_results"."score_a" BETWEEN 0 AND 12 AND "app"."match_results"."score_b" BETWEEN 0 AND 12),
	CONSTRAINT "match_results_counts" CHECK ("app"."match_results"."hands_played" >= 0 AND "app"."match_results"."powers_used" >= 0),
	CONSTRAINT "match_results_time" CHECK ("app"."match_results"."finished_at" >= "app"."match_results"."started_at"),
	CONSTRAINT "match_results_policy" CHECK ("app"."match_results"."reward_policy_version" ~ '^[a-zA-Z0-9._-]{1,64}$'),
	CONSTRAINT "match_results_solo" CHECK (NOT "app"."match_results"."solo" OR "app"."match_results"."format" = '1v1'),
	CONSTRAINT "match_results_winner" CHECK (("app"."match_results"."reason" IN ('expired', 'technical') AND "app"."match_results"."winner" IS NULL) OR ("app"."match_results"."reason" IN ('completed', 'surrender', 'abandonment') AND "app"."match_results"."winner" IS NOT NULL)),
	CONSTRAINT "match_results_completed" CHECK ("app"."match_results"."reason" <> 'completed' OR ("app"."match_results"."winner" = 'A' AND "app"."match_results"."score_a" = 12 AND "app"."match_results"."score_b" < 12) OR ("app"."match_results"."winner" = 'B' AND "app"."match_results"."score_b" = 12 AND "app"."match_results"."score_a" < 12))
);
--> statement-breakpoint
CREATE TABLE "app"."match_rewards" (
	"participant_id" uuid PRIMARY KEY NOT NULL,
	"preset" "app"."match_preset" NOT NULL,
	"solo" boolean NOT NULL,
	"xp" bigint NOT NULL,
	"competitive_points" bigint NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_rewards_xp" CHECK ("app"."match_rewards"."xp" >= 0),
	CONSTRAINT "match_rewards_points" CHECK ("app"."match_rewards"."competitive_points" >= 0 AND ("app"."match_rewards"."competitive_points" = 0 OR ("app"."match_rewards"."preset" = 'competitive' AND NOT "app"."match_rewards"."solo")))
);
--> statement-breakpoint
CREATE TABLE "app"."player_progress" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"xp" bigint DEFAULT 0 NOT NULL,
	"competitive_points" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "player_progress_xp" CHECK ("app"."player_progress"."xp" >= 0),
	CONSTRAINT "player_progress_points" CHECK ("app"."player_progress"."competitive_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"nickname" text NOT NULL,
	"avatar_id" text,
	"deck_theme_id" text,
	"table_theme_id" text,
	CONSTRAINT "profiles_nickname" CHECK (char_length("app"."profiles"."nickname") BETWEEN 1 AND 24 AND "app"."profiles"."nickname" = btrim("app"."profiles"."nickname") AND "app"."profiles"."nickname" !~ '[[:cntrl:]]')
);
--> statement-breakpoint
CREATE TABLE "app"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "sessions_token_hash" CHECK ("app"."sessions"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sessions_expiration" CHECK ("app"."sessions"."expires_at" > "app"."sessions"."created_at"),
	CONSTRAINT "sessions_revocation" CHECK ("app"."sessions"."revoked_at" IS NULL OR "app"."sessions"."revoked_at" >= "app"."sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "app"."table_themes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"asset_key" text NOT NULL,
	"required_level" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "table_themes_id" CHECK ("app"."table_themes"."id" ~ '^[a-z][a-z0-9-]{0,63}$'),
	CONSTRAINT "table_themes_name" CHECK (char_length(btrim("app"."table_themes"."name")) BETWEEN 1 AND 64),
	CONSTRAINT "table_themes_asset" CHECK ("app"."table_themes"."asset_key" ~ '^[a-z][a-z0-9-]{0,63}$'),
	CONSTRAINT "table_themes_level" CHECK ("app"."table_themes"."required_level" >= 1),
	CONSTRAINT "table_themes_order" CHECK ("app"."table_themes"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app"."jobs" ADD CONSTRAINT "jobs_match_id_match_results_id_fk" FOREIGN KEY ("match_id") REFERENCES "app"."match_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_participants" ADD CONSTRAINT "match_participants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_participants" ADD CONSTRAINT "match_participants_context_fk" FOREIGN KEY ("match_id","preset","format","solo") REFERENCES "app"."match_results"("id","preset","format","solo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."match_rewards" ADD CONSTRAINT "match_rewards_context_fk" FOREIGN KEY ("participant_id","preset","solo") REFERENCES "app"."match_participants"("id","preset","solo") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."player_progress" ADD CONSTRAINT "player_progress_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."profiles" ADD CONSTRAINT "profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."profiles" ADD CONSTRAINT "profiles_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "app"."avatars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."profiles" ADD CONSTRAINT "profiles_deck_theme_id_deck_themes_id_fk" FOREIGN KEY ("deck_theme_id") REFERENCES "app"."deck_themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."profiles" ADD CONSTRAINT "profiles_table_theme_id_table_themes_id_fk" FOREIGN KEY ("table_theme_id") REFERENCES "app"."table_themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_pending_idx" ON "app"."jobs" USING btree ("run_at","id") WHERE "app"."jobs"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "jobs_running_lease_idx" ON "app"."jobs" USING btree ("lease_expires_at") WHERE "app"."jobs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "jobs_terminal_idx" ON "app"."jobs" USING btree ("finished_at") WHERE "app"."jobs"."status" IN ('completed', 'failed');--> statement-breakpoint
CREATE INDEX "match_participants_account_idx" ON "app"."match_participants" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "match_results_finished_idx" ON "app"."match_results" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "player_progress_ranking_idx" ON "app"."player_progress" USING btree ("competitive_points" DESC NULLS LAST,"account_id");--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "app"."sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_expiration_idx" ON "app"."sessions" USING btree ("expires_at");
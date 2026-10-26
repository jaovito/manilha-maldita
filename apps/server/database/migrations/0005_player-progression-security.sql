CREATE TABLE "app"."account_security" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"recovery_hash" text,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_security_recovery_hash" CHECK ("app"."account_security"."recovery_hash" IS NULL OR "app"."account_security"."recovery_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "app"."auth_audit" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app"."auth_audit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"account_id" uuid,
	"event" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_audit_event" CHECK ("app"."auth_audit"."event" IN ('register_success', 'register_failure', 'login_success', 'login_failure', 'logout', 'recovery_code_issued', 'password_recovered', 'password_changed', 'account_deleted'))
);
--> statement-breakpoint
CREATE TABLE "app"."match_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	CONSTRAINT "match_receipts_id" CHECK (char_length("app"."match_receipts"."id") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "app"."reward_policies" (
	"version" text PRIMARY KEY NOT NULL,
	"completion_xp" bigint NOT NULL,
	"victory_xp" bigint NOT NULL,
	"competitive_victory_points" bigint NOT NULL,
	"xp_per_level" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reward_policies_version" CHECK ("app"."reward_policies"."version" ~ '^[A-Za-z0-9._-]{1,64}$'),
	CONSTRAINT "reward_policies_values" CHECK ("app"."reward_policies"."completion_xp" BETWEEN 0 AND 1000000 AND "app"."reward_policies"."victory_xp" BETWEEN 0 AND 1000000 AND "app"."reward_policies"."competitive_victory_points" BETWEEN 0 AND 1000000 AND "app"."reward_policies"."xp_per_level" BETWEEN 1 AND 1000000)
);
--> statement-breakpoint
ALTER TABLE "app"."avatars" ADD COLUMN "sprite_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."account_security" ADD CONSTRAINT "account_security_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."auth_audit" ADD CONSTRAINT "auth_audit_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_audit_time_idx" ON "app"."auth_audit" USING btree ("occurred_at");--> statement-breakpoint
ALTER TABLE "app"."avatars" ADD CONSTRAINT "avatars_sprite" CHECK ("app"."avatars"."sprite_index" BETWEEN 0 AND 3);
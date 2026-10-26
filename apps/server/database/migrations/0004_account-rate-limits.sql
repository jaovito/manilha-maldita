CREATE TABLE "app"."auth_rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_rate_limits_key" CHECK ("app"."auth_rate_limits"."key_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "auth_rate_limits_attempts" CHECK ("app"."auth_rate_limits"."attempts" BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE INDEX "auth_rate_limits_expiry_idx" ON "app"."auth_rate_limits" USING btree ("expires_at");
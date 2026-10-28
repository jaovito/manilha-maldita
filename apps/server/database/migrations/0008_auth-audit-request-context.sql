ALTER TABLE "app"."auth_audit" ADD COLUMN "client_ip" "inet";--> statement-breakpoint
ALTER TABLE "app"."auth_audit" ADD COLUMN "client_context" jsonb;--> statement-breakpoint
CREATE INDEX "auth_audit_account_idx" ON "app"."auth_audit" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "app"."auth_audit" ADD CONSTRAINT "auth_audit_context_shape" CHECK ("app"."auth_audit"."client_context" IS NULL OR (jsonb_typeof("app"."auth_audit"."client_context") = 'object' AND pg_column_size("app"."auth_audit"."client_context") <= 2048 AND ("app"."auth_audit"."client_context" - ARRAY['userAgent', 'clientVersion']::text[]) = '{}'::jsonb AND (NOT ("app"."auth_audit"."client_context" ? 'userAgent') OR (jsonb_typeof("app"."auth_audit"."client_context"->'userAgent') = 'string' AND octet_length("app"."auth_audit"."client_context"->>'userAgent') BETWEEN 1 AND 512 AND ("app"."auth_audit"."client_context"->>'userAgent') !~ '[[:cntrl:]]')) AND (NOT ("app"."auth_audit"."client_context" ? 'clientVersion') OR (jsonb_typeof("app"."auth_audit"."client_context"->'clientVersion') = 'string' AND ("app"."auth_audit"."client_context"->>'clientVersion') ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'))));
--> statement-breakpoint
CREATE FUNCTION app.clear_detached_audit_context() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  NEW.client_ip := NULL;
  NEW.client_context := NULL;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER auth_audit_clear_detached_context
BEFORE UPDATE OF account_id ON app.auth_audit
FOR EACH ROW WHEN (OLD.account_id IS NOT NULL AND NEW.account_id IS NULL)
EXECUTE FUNCTION app.clear_detached_audit_context();

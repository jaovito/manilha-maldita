-- Notifications only wake consumers; app.jobs remains the durable source of work.
-- PostgreSQL delivers pg_notify only after commit. Never put identifiers or secrets here.
CREATE FUNCTION "app"."notify_jobs_ready"() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM pg_notify('truco_jobs_ready', '');
  RETURN NULL;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "app"."notify_jobs_ready"() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER jobs_notify_ready
AFTER INSERT OR UPDATE OF status, run_at ON "app"."jobs"
FOR EACH ROW WHEN (NEW.status = 'pending')
EXECUTE FUNCTION "app"."notify_jobs_ready"();

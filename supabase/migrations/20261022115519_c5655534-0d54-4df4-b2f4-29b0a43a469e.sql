ALTER FUNCTION public.document_usage_totals(uuid[]) SET SCHEMA private;
CREATE FUNCTION public.document_usage_totals(docs uuid[]) RETURNS TABLE(content_id uuid, views bigint, download_requests bigint, format_downloads jsonb) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT * FROM private.document_usage_totals(docs) $$;
REVOKE ALL ON FUNCTION public.document_usage_totals(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.document_usage_totals(uuid[]) TO anon, authenticated, service_role;

CREATE FUNCTION public.document_format_kinds(doc uuid) RETURNS text[] LANGUAGE sql STABLE SET search_path = public AS $$ SELECT private.readable_formats(doc) $$;
GRANT EXECUTE ON FUNCTION public.document_format_kinds(uuid) TO anon, authenticated, service_role;

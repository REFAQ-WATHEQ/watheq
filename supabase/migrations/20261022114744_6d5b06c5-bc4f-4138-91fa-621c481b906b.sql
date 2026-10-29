ALTER TABLE public.document_events ADD COLUMN request_key text;
CREATE UNIQUE INDEX document_events_request_key ON public.document_events(request_key) WHERE request_key IS NOT NULL;
CREATE FUNCTION public.record_document_usage(doc uuid, fmt uuid, actor uuid, action text, key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous public.document_events;
BEGIN
 IF action NOT IN ('view','download_request') OR key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid usage request'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.content_items WHERE id=doc AND kind='documents' AND status='published' AND published) THEN RAISE EXCEPTION 'Document unavailable'; END IF;
 IF (action='view' AND fmt IS NOT NULL) OR (action='download_request' AND NOT EXISTS (SELECT 1 FROM public.document_formats WHERE id=fmt AND content_id=doc)) THEN RAISE EXCEPTION 'Format unavailable'; END IF;
 INSERT INTO public.document_events(content_id,format_id,user_id,event,request_key) VALUES(doc,fmt,actor,action,key) ON CONFLICT (request_key) WHERE request_key IS NOT NULL DO NOTHING;
 IF FOUND THEN RETURN true; END IF;
 SELECT * INTO previous FROM public.document_events WHERE request_key=key;
 IF previous.content_id IS DISTINCT FROM doc OR previous.format_id IS DISTINCT FROM fmt OR previous.user_id IS DISTINCT FROM actor OR previous.event IS DISTINCT FROM action THEN RAISE EXCEPTION 'Retry does not match original request'; END IF;
 RETURN false;
END; $$;
REVOKE ALL ON FUNCTION public.record_document_usage(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_document_usage(uuid,uuid,uuid,text,text) TO service_role;
CREATE FUNCTION public.document_usage_totals(docs uuid[]) RETURNS TABLE(content_id uuid, views bigint, download_requests bigint, format_downloads jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT c.id,
 (SELECT count(*) FROM public.document_events e WHERE e.content_id=c.id AND e.event='view'),
 (SELECT count(*) FROM public.document_events e WHERE e.content_id=c.id AND e.event='download_request'),
 coalesce((SELECT jsonb_object_agg(s.format,s.n) FROM (SELECT f.format,count(e.id) n FROM public.document_formats f LEFT JOIN public.document_events e ON e.format_id=f.id AND e.event='download_request' WHERE f.content_id=c.id GROUP BY f.format) s),'{}'::jsonb)
 FROM public.content_items c WHERE c.id=ANY(docs[1:100]) AND c.kind='documents' AND c.status='published' AND c.published AND private.can_read_content(c.id);
$$;
REVOKE ALL ON FUNCTION public.document_usage_totals(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.document_usage_totals(uuid[]) TO anon, authenticated, service_role;

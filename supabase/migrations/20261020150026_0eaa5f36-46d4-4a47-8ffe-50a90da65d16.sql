CREATE FUNCTION public.related_documents(doc uuid, lim int DEFAULT 4)
RETURNS TABLE(id uuid, title text, summary text, document_type_id uuid, updated_at timestamptz, formats text[])
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH me AS (SELECT c.id, c.document_type_id FROM public.content_items c WHERE c.id = doc AND c.kind = 'documents' AND c.status = 'published'),
  scored AS (
    SELECT c.id, c.title, c.summary, c.document_type_id, c.updated_at,
      2 * (SELECT count(*) FROM public.content_topics a JOIN public.content_topics b ON a.topic_id = b.topic_id WHERE a.content_id = me.id AND b.content_id = c.id)
      + (SELECT count(*) FROM public.content_tags a JOIN public.content_tags b ON a.tag_id = b.tag_id WHERE a.content_id = me.id AND b.content_id = c.id)
      + CASE WHEN c.document_type_id IS NOT NULL AND c.document_type_id = me.document_type_id THEN 1 ELSE 0 END AS score
    FROM public.content_items c, me
    WHERE c.kind = 'documents' AND c.status = 'published' AND c.id <> me.id
  )
  SELECT s.id, s.title, s.summary, s.document_type_id, s.updated_at, private.readable_formats(s.id)
  FROM scored s WHERE s.score > 0
  ORDER BY s.score DESC, s.updated_at DESC, s.id
  LIMIT least(greatest(lim, 1), 8)
$$;
GRANT EXECUTE ON FUNCTION public.related_documents(uuid, int) TO anon, authenticated, service_role;

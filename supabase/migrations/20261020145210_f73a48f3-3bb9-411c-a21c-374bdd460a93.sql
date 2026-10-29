-- Exposes only format kinds (never Drive ids) for content the caller may read.
CREATE FUNCTION private.readable_formats(doc uuid) RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN private.can_read_content(doc) THEN coalesce((SELECT array_agg(format ORDER BY array_position(ARRAY['pdf','word','excel','powerpoint'], format)) FROM public.document_formats WHERE content_id = doc), '{}') ELSE '{}' END
$$;
REVOKE ALL ON FUNCTION private.readable_formats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.readable_formats(uuid) TO anon, authenticated, service_role;

CREATE FUNCTION public.search_library(q text DEFAULT '', topic uuid DEFAULT NULL, type_id uuid DEFAULT NULL, fmt text DEFAULT NULL, tag_ids uuid[] DEFAULT '{}', sort text DEFAULT 'newest', page int DEFAULT 1, page_size int DEFAULT 12)
RETURNS TABLE(id uuid, title text, summary text, document_type_id uuid, updated_at timestamptz, topic_ids uuid[], formats text[], total bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH RECURSIVE scope AS (
    SELECT t.id FROM public.knowledge_topics t WHERE t.id = topic
    UNION SELECT k.id FROM public.knowledge_topics k JOIN scope s ON k.parent_id = s.id
  ), term AS (SELECT '%' || replace(replace(replace(left(trim(coalesce(q,'')), 200), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS p),
  hits AS (
    SELECT c.id, c.title, c.summary, c.document_type_id, c.updated_at, private.readable_formats(c.id) AS formats
    FROM public.content_items c, term
    WHERE c.kind = 'documents' AND c.status = 'published'
      AND (coalesce(trim(q),'') = '' OR c.title ILIKE term.p OR c.summary ILIKE term.p)
      AND (topic IS NULL OR EXISTS (SELECT 1 FROM public.content_topics ct WHERE ct.content_id = c.id AND ct.topic_id IN (SELECT id FROM scope)))
      AND (type_id IS NULL OR c.document_type_id = type_id)
      AND (coalesce(cardinality(tag_ids),0) = 0 OR EXISTS (SELECT 1 FROM public.content_tags g WHERE g.content_id = c.id AND g.tag_id = ANY(tag_ids)))
  ), filtered AS (SELECT * FROM hits WHERE fmt IS NULL OR fmt = ANY(hits.formats))
  SELECT f.id, f.title, f.summary, f.document_type_id, f.updated_at,
    coalesce((SELECT array_agg(ct.topic_id) FROM public.content_topics ct JOIN public.knowledge_topics kt ON kt.id = ct.topic_id WHERE ct.content_id = f.id), '{}'),
    f.formats, count(*) OVER ()
  FROM filtered f
  ORDER BY CASE WHEN sort = 'title' THEN f.title END ASC,
           CASE WHEN sort = 'oldest' THEN f.updated_at END ASC,
           f.updated_at DESC, f.id
  LIMIT least(greatest(page_size,1),50) OFFSET (greatest(page,1) - 1) * least(greatest(page_size,1),50)
$$;
GRANT EXECUTE ON FUNCTION public.search_library(text,uuid,uuid,text,uuid[],text,int,int) TO anon, authenticated, service_role;

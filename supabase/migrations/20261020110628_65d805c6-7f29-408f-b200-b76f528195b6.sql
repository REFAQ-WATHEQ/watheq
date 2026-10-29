CREATE UNIQUE INDEX knowledge_topics_unique_name ON public.knowledge_topics (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))));

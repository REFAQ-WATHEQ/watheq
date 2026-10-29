DROP POLICY topics_public ON public.knowledge_topics;
CREATE POLICY topics_public ON public.knowledge_topics FOR SELECT TO anon, authenticated USING (NOT hidden);
DROP POLICY document_types_public ON public.document_types;
CREATE POLICY document_types_public ON public.document_types FOR SELECT TO anon, authenticated USING (NOT hidden);

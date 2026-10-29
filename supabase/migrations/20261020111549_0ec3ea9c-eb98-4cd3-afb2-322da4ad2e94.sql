ALTER TABLE public.knowledge_topics ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE public.document_types ADD COLUMN description text NOT NULL DEFAULT '';

ALTER TABLE public.knowledge_topics DROP CONSTRAINT knowledge_topics_parent_id_fkey, ADD CONSTRAINT knowledge_topics_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.knowledge_topics(id) ON DELETE RESTRICT;
ALTER TABLE public.content_topics DROP CONSTRAINT content_topics_topic_id_fkey, ADD CONSTRAINT content_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.knowledge_topics(id) ON DELETE RESTRICT;
ALTER TABLE public.content_tags DROP CONSTRAINT content_tags_tag_id_fkey, ADD CONSTRAINT content_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE RESTRICT;
ALTER TABLE public.content_items DROP CONSTRAINT content_items_document_type_id_fkey, ADD CONSTRAINT content_items_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_taxonomy_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'knowledge_topics' AND (EXISTS (SELECT 1 FROM public.knowledge_topics WHERE parent_id = OLD.id) OR EXISTS (SELECT 1 FROM public.content_topics WHERE topic_id = OLD.id)) THEN
    RAISE EXCEPTION 'لا يمكن حذف موضوع له موضوعات فرعية أو وثائق مرتبطة؛ أخفِه بدلًا من حذفه';
  ELSIF TG_TABLE_NAME = 'document_types' AND EXISTS (SELECT 1 FROM public.content_items WHERE document_type_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف نوع مستخدم في وثائق؛ أخفِه بدلًا من حذفه';
  ELSIF TG_TABLE_NAME = 'tags' AND EXISTS (SELECT 1 FROM public.content_tags WHERE tag_id = OLD.id) THEN
    RAISE EXCEPTION 'لا يمكن حذف وسم مرتبط بوثائق';
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER topics_guard_delete BEFORE DELETE ON public.knowledge_topics FOR EACH ROW EXECUTE FUNCTION public.guard_taxonomy_delete();
CREATE TRIGGER types_guard_delete BEFORE DELETE ON public.document_types FOR EACH ROW EXECUTE FUNCTION public.guard_taxonomy_delete();
CREATE TRIGGER tags_guard_delete BEFORE DELETE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.guard_taxonomy_delete();

CREATE OR REPLACE FUNCTION public.guard_topic_cycle() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE cur uuid; steps int := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('wathiq_topic_tree'));
  IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'لا يمكن جعل الموضوع أبًا لنفسه'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.knowledge_topics WHERE id = NEW.parent_id) THEN RAISE EXCEPTION 'الموضوع الأب غير موجود'; END IF;
  cur := NEW.parent_id;
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN RAISE EXCEPTION 'لا يمكن جعل الموضوع فرعًا من أحد فروعه'; END IF;
    steps := steps + 1; IF steps > 100 THEN RAISE EXCEPTION 'تسلسل الموضوعات أعمق من المسموح'; END IF;
    SELECT parent_id INTO cur FROM public.knowledge_topics WHERE id = cur;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER topics_guard_cycle BEFORE INSERT OR UPDATE OF parent_id ON public.knowledge_topics FOR EACH ROW EXECUTE FUNCTION public.guard_topic_cycle();

CREATE UNIQUE INDEX document_types_unique_name ON public.document_types (lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))));
CREATE UNIQUE INDEX tags_unique_name ON public.tags (lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))));

CREATE OR REPLACE FUNCTION public.topic_document_counts() RETURNS TABLE(topic_id uuid, documents bigint) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ct.topic_id, count(DISTINCT c.id)
  FROM public.content_topics ct JOIN public.content_items c ON c.id = ct.content_id JOIN public.knowledge_topics t ON t.id = ct.topic_id
  WHERE c.status = 'published' AND c.kind = 'documents' AND NOT t.hidden AND private.can_read_content(c.id)
  GROUP BY ct.topic_id;
$$;
REVOKE ALL ON FUNCTION public.topic_document_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.topic_document_counts() TO anon, authenticated;

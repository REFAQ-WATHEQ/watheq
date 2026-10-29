CREATE UNIQUE INDEX document_formats_one_per_kind ON public.document_formats(content_id, format);

-- Restricted file delivery is not built yet; changing this requires a new reviewed migration.
CREATE FUNCTION private.secure_delivery_ready() RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT false $$;

CREATE FUNCTION private.document_publish_problem(doc uuid) RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.content_items WHERE id = doc;
  IF r.document_type_id IS NULL THEN RETURN 'اختر نوع الوثيقة قبل النشر'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.content_topics WHERE content_id = doc) THEN RETURN 'اختر موضوعًا معرفيًا واحدًا على الأقل قبل النشر'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.document_formats WHERE content_id = doc) THEN RETURN 'أضف صيغة ملف واحدة على الأقل قبل النشر'; END IF;
  IF r.audience <> 'everyone' AND NOT private.secure_delivery_ready() THEN RETURN 'لا يمكن نشر وثيقة مقيدة قبل اكتمال مسار الوصول الآمن للملفات'; END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION private.document_publish_problem(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.secure_delivery_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.document_publish_problem(uuid), private.secure_delivery_ready() TO authenticated, service_role;

CREATE FUNCTION public.guard_document_publish() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE problem text;
BEGIN
  IF NEW.kind = 'documents' AND NEW.status = 'published' THEN
    IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'احفظ الوثيقة كمسودة أولًا ثم انشرها'; END IF;
    problem := private.document_publish_problem(NEW.id);
    -- audience may be changing in this same update
    IF problem IS NULL AND NEW.audience <> 'everyone' AND NOT private.secure_delivery_ready() THEN problem := 'لا يمكن نشر وثيقة مقيدة قبل اكتمال مسار الوصول الآمن للملفات'; END IF;
    IF problem IS NOT NULL THEN RAISE EXCEPTION '%', problem; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER document_publish_guard BEFORE INSERT OR UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.guard_document_publish();

CREATE FUNCTION public.save_document(doc_id uuid, doc_title text, doc_summary text, type_id uuid, topic_ids uuid[], tag_ids uuid[], new_audience public.content_audience, category_ids uuid[], group_ids uuid[], formats jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE id_out uuid := doc_id; f jsonb; problem text; st public.document_status;
BEGIN
  IF NOT private.is_staff() THEN RAISE EXCEPTION 'ليس لديك صلاحية إدارة الوثائق'; END IF;
  IF length(trim(coalesce(doc_title,''))) < 3 THEN RAISE EXCEPTION 'العنوان لا يقل عن 3 أحرف'; END IF;
  IF coalesce(cardinality(topic_ids),0) = 0 THEN RAISE EXCEPTION 'اختر موضوعًا معرفيًا واحدًا على الأقل'; END IF;
  IF id_out IS NULL THEN
    INSERT INTO public.content_items(title, summary, kind, document_type_id, status) VALUES (trim(doc_title), coalesce(doc_summary,''), 'documents', type_id, 'draft') RETURNING id INTO id_out;
  ELSE
    UPDATE public.content_items SET title = trim(doc_title), summary = coalesce(doc_summary,''), document_type_id = type_id WHERE id = id_out AND kind = 'documents';
    IF NOT FOUND THEN RAISE EXCEPTION 'الوثيقة غير موجودة'; END IF;
  END IF;
  DELETE FROM public.content_topics WHERE content_id = id_out;
  INSERT INTO public.content_topics(content_id, topic_id) SELECT id_out, unnest(topic_ids);
  DELETE FROM public.content_tags WHERE content_id = id_out;
  INSERT INTO public.content_tags(content_id, tag_id) SELECT id_out, unnest(coalesce(tag_ids, '{}'));
  DELETE FROM public.document_formats WHERE content_id = id_out AND format NOT IN (SELECT x->>'format' FROM jsonb_array_elements(coalesce(formats,'[]')) x);
  FOR f IN SELECT * FROM jsonb_array_elements(coalesce(formats,'[]')) LOOP
    IF f->>'format' NOT IN ('pdf','word','excel','powerpoint') THEN RAISE EXCEPTION 'صيغة غير مدعومة'; END IF;
    INSERT INTO public.document_formats(content_id, format, drive_file_id, label) VALUES (id_out, f->>'format', f->>'drive_file_id', coalesce(f->>'label',''))
    ON CONFLICT (content_id, format) DO UPDATE SET drive_file_id = EXCLUDED.drive_file_id, label = EXCLUDED.label;
  END LOOP;
  PERFORM public.set_content_audience(id_out, new_audience, coalesce(category_ids,'{}'), coalesce(group_ids,'{}'));
  SELECT status INTO st FROM public.content_items WHERE id = id_out;
  IF st = 'published' THEN problem := private.document_publish_problem(id_out); IF problem IS NOT NULL THEN RAISE EXCEPTION '%', problem; END IF; END IF;
  RETURN id_out;
END; $$;

CREATE FUNCTION public.set_document_status(doc_id uuid, new_status public.document_status) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT private.is_staff() THEN RAISE EXCEPTION 'ليس لديك صلاحية إدارة الوثائق'; END IF;
  UPDATE public.content_items SET status = new_status WHERE id = doc_id AND kind = 'documents';
  IF NOT FOUND THEN RAISE EXCEPTION 'الوثيقة غير موجودة'; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.save_document(uuid,text,text,uuid,uuid[],uuid[],public.content_audience,uuid[],uuid[],jsonb), public.set_document_status(uuid,public.document_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document(uuid,text,text,uuid,uuid[],uuid[],public.content_audience,uuid[],uuid[],jsonb), public.set_document_status(uuid,public.document_status) TO authenticated, service_role;

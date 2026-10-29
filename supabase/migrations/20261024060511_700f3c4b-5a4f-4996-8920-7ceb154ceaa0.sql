CREATE TABLE private.document_access_trial (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 started_at timestamptz, ends_at timestamptz, stopped_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((started_at IS NULL AND ends_at IS NULL AND stopped_at IS NULL) OR (started_at IS NOT NULL AND ends_at=started_at+interval '2 hours'))
);
REVOKE ALL ON private.document_access_trial FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO private.document_access_trial(id) VALUES(true);
CREATE TABLE private.document_trial_documents (
 content_id uuid PRIMARY KEY, format_id uuid NOT NULL UNIQUE, drive_file_id text NOT NULL,
 audience public.content_audience NOT NULL CHECK(audience IN ('registered','employees','targeted')),
 group_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((audience='targeted')=(group_id IS NOT NULL))
);
REVOKE ALL ON private.document_trial_documents FROM PUBLIC, anon, authenticated, service_role;
INSERT INTO private.document_trial_documents(content_id,format_id,drive_file_id,audience,group_id)
SELECT v.doc,v.fmt,f.drive_file_id,v.aud,v.grp FROM (VALUES
 ('50afa961-b024-4ab7-bbdd-ebcd11f2b49a'::uuid,'d47c691f-dc89-42cc-9844-879c1c017b63'::uuid,'registered'::public.content_audience,NULL::uuid),
 ('4b34d420-8099-4972-a2b4-1174dab6e361'::uuid,'e39d0c09-a9c0-43c7-9342-9de03848d674'::uuid,'employees'::public.content_audience,NULL::uuid),
 ('cfd899dd-005e-4887-86f3-32e7376623e8'::uuid,'e0fa9bbf-0311-4fd1-87c0-377d5cfbe005'::uuid,'targeted'::public.content_audience,'f1d50e06-4224-4014-8b85-a72d64189379'::uuid)
) v(doc,fmt,aud,grp) JOIN public.document_formats f ON f.id=v.fmt AND f.content_id=v.doc;
CREATE TABLE private.document_trial_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action text NOT NULL, actor text NOT NULL,
 started_at timestamptz, ends_at timestamptz, stopped_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.document_trial_audit FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION private.audit_document_trial_window() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.started_at IS NOT NULL AND (NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR (OLD.stopped_at IS NOT NULL AND NEW.stopped_at IS DISTINCT FROM OLD.stopped_at)) THEN RAISE EXCEPTION 'Trial window cannot be extended or restarted'; END IF;
 NEW.updated_at:=clock_timestamp();
 INSERT INTO private.document_trial_audit(action,actor,started_at,ends_at,stopped_at) VALUES(CASE WHEN NEW.stopped_at IS NOT NULL THEN 'stop' WHEN NEW.started_at IS NOT NULL THEN 'start' ELSE 'prepare' END,session_user,NEW.started_at,NEW.ends_at,NEW.stopped_at);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.audit_document_trial_window() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER document_trial_window_audit BEFORE UPDATE ON private.document_access_trial FOR EACH ROW EXECUTE FUNCTION private.audit_document_trial_window();
CREATE FUNCTION private.document_trial_active(doc uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.document_access_trial w JOIN private.document_trial_documents t ON t.content_id=doc
 JOIN public.content_items c ON c.id=t.content_id
 JOIN public.document_formats f ON f.id=t.format_id AND f.content_id=t.content_id
 WHERE w.started_at<=statement_timestamp() AND statement_timestamp()<w.ends_at AND w.stopped_at IS NULL
 AND c.kind='documents' AND c.audience=t.audience AND f.format='pdf' AND f.drive_file_id=t.drive_file_id AND f.verify_status='ok' AND f.verified_mime='application/pdf' AND f.verified_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.document_formats x WHERE x.content_id=doc AND x.id<>t.format_id)
 AND NOT EXISTS(SELECT 1 FROM public.content_files x WHERE x.content_id=doc)
 AND NOT EXISTS(SELECT 1 FROM public.content_categories x WHERE x.content_id=doc)
 AND (CASE WHEN t.group_id IS NULL THEN NOT EXISTS(SELECT 1 FROM public.content_groups x WHERE x.content_id=doc)
 ELSE EXISTS(SELECT 1 FROM public.content_groups x WHERE x.content_id=doc AND x.group_id=t.group_id) AND NOT EXISTS(SELECT 1 FROM public.content_groups x WHERE x.content_id=doc AND x.group_id<>t.group_id) END));
$$;
REVOKE ALL ON FUNCTION private.document_trial_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.document_trial_active(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION private.can_read_content(content_uuid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.content_items c WHERE c.id=content_uuid AND
 (private.is_staff() OR (c.published AND
 (NOT EXISTS(SELECT 1 FROM private.document_trial_documents t WHERE t.content_id=c.id) OR
 (auth.uid() IN ('3fb9c14e-521a-4acc-979a-a87ae62457cd'::uuid,'85801bbd-ec21-460b-979d-169c2e9fbc07'::uuid) AND private.document_trial_active(c.id)))
 AND CASE c.audience WHEN 'everyone' THEN true WHEN 'registered' THEN auth.uid() IS NOT NULL
 WHEN 'employees' THEN auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.employee_access e WHERE e.user_id=auth.uid())
 WHEN 'targeted' THEN auth.uid() IS NOT NULL AND (EXISTS(SELECT 1 FROM public.content_categories cc JOIN public.category_memberships cm ON cm.category_id=cc.category_id WHERE cc.content_id=c.id AND cm.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.content_groups cg JOIN public.group_memberships gm ON gm.group_id=cg.group_id WHERE cg.content_id=c.id AND gm.user_id=auth.uid())) ELSE false END)));
$$;
CREATE OR REPLACE FUNCTION private.document_publish_problem(doc uuid) RETURNS text LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE r record;
BEGIN
 SELECT * INTO r FROM public.content_items WHERE id=doc;
 IF r.document_type_id IS NULL THEN RETURN 'اختر نوع الوثيقة قبل النشر'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.content_topics WHERE content_id=doc) THEN RETURN 'اختر موضوعًا معرفيًا واحدًا على الأقل قبل النشر'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.document_formats WHERE content_id=doc) THEN RETURN 'أضف صيغة ملف واحدة على الأقل قبل النشر'; END IF;
 IF r.audience<>'everyone' AND NOT private.secure_delivery_ready() AND NOT private.document_trial_active(doc) THEN RETURN 'لا يمكن نشر وثيقة مقيدة قبل اكتمال مسار الوصول الآمن للملفات'; END IF;
 RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.guard_document_publish() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE problem text;
BEGIN
 IF NEW.kind='documents' AND NEW.status='published' THEN
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'احفظ الوثيقة كمسودة أولًا ثم انشرها'; END IF;
  problem:=private.document_publish_problem(NEW.id);
  IF problem IS NULL AND NEW.audience<>'everyone' AND NOT private.secure_delivery_ready() AND NOT (NEW.audience=OLD.audience AND private.document_trial_active(NEW.id)) THEN problem:='لا يمكن نشر وثيقة مقيدة قبل اكتمال مسار الوصول الآمن للملفات'; END IF;
  IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem; END IF;
 END IF;
 RETURN NEW;
END; $$;
-- No activation, publication, role, employee or membership mutation in this migration.

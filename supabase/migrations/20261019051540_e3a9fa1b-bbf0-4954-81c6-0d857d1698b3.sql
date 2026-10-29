CREATE TABLE public.employee_access (user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.employee_access TO authenticated; GRANT ALL ON public.employee_access TO service_role;
ALTER TABLE public.employee_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_read ON public.employee_access FOR SELECT TO authenticated USING (user_id=auth.uid() OR private.is_staff());
CREATE TRIGGER employee_updated BEFORE UPDATE ON public.employee_access FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE FUNCTION public.set_employee_access(target_user uuid, enabled boolean) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=target_user) THEN RAISE EXCEPTION 'الحساب غير موجود'; END IF; IF enabled THEN INSERT INTO public.employee_access(user_id) VALUES(target_user) ON CONFLICT(user_id) DO NOTHING; ELSE DELETE FROM public.employee_access WHERE user_id=target_user; END IF; END; $$;
REVOKE ALL ON FUNCTION public.set_employee_access(uuid,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.set_employee_access(uuid,boolean) TO service_role;
CREATE TABLE public.category_memberships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(category_id,user_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.category_memberships TO authenticated; GRANT ALL ON public.category_memberships TO service_role;
ALTER TABLE public.category_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_memberships_read ON public.category_memberships FOR SELECT TO authenticated USING(user_id=auth.uid() OR private.is_staff());
CREATE POLICY category_memberships_staff ON public.category_memberships FOR ALL TO authenticated USING(private.is_staff()) WITH CHECK(private.is_staff());
CREATE TRIGGER category_memberships_updated BEFORE UPDATE ON public.category_memberships FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TYPE public.content_audience AS ENUM ('everyone','registered','employees','targeted');
CREATE TABLE public.content_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, summary text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '', kind text NOT NULL, audience public.content_audience NOT NULL DEFAULT 'registered', published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.content_items TO anon; GRANT SELECT,INSERT,UPDATE,DELETE ON public.content_items TO authenticated; GRANT ALL ON public.content_items TO service_role;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.content_categories (content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE, category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(content_id,category_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.content_categories TO authenticated; GRANT ALL ON public.content_categories TO service_role;
ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_categories_staff ON public.content_categories FOR ALL TO authenticated USING(private.is_staff()) WITH CHECK(private.is_staff());
CREATE TABLE public.content_groups (content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE, group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(content_id,group_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.content_groups TO authenticated; GRANT ALL ON public.content_groups TO service_role;
ALTER TABLE public.content_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_groups_staff ON public.content_groups FOR ALL TO authenticated USING(private.is_staff()) WITH CHECK(private.is_staff());
CREATE FUNCTION private.can_read_content(content_uuid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.content_items c WHERE c.id=content_uuid AND
 (private.is_staff() OR (c.published AND CASE c.audience
 WHEN 'everyone' THEN true
 WHEN 'registered' THEN auth.uid() IS NOT NULL
 WHEN 'employees' THEN auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.employee_access e WHERE e.user_id=auth.uid())
 WHEN 'targeted' THEN auth.uid() IS NOT NULL AND (
 EXISTS(SELECT 1 FROM public.content_categories cc JOIN public.category_memberships cm ON cm.category_id=cc.category_id WHERE cc.content_id=c.id AND cm.user_id=auth.uid()) OR
 EXISTS(SELECT 1 FROM public.content_groups cg JOIN public.group_memberships gm ON gm.group_id=cg.group_id WHERE cg.content_id=c.id AND gm.user_id=auth.uid()))
 ELSE false END)));
 $$;
REVOKE ALL ON FUNCTION private.can_read_content(uuid) FROM PUBLIC; GRANT USAGE ON SCHEMA private TO anon,authenticated; GRANT EXECUTE ON FUNCTION private.can_read_content(uuid) TO anon,authenticated,service_role;
CREATE POLICY content_read ON public.content_items FOR SELECT TO anon,authenticated USING(private.can_read_content(id));
CREATE POLICY content_staff ON public.content_items FOR ALL TO authenticated USING(private.is_staff()) WITH CHECK(private.is_staff());
CREATE TABLE public.content_files (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE, object_path text NOT NULL UNIQUE, file_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.content_files TO anon; GRANT SELECT,INSERT,UPDATE,DELETE ON public.content_files TO authenticated; GRANT ALL ON public.content_files TO service_role;
ALTER TABLE public.content_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_files_read ON public.content_files FOR SELECT TO anon,authenticated USING(private.can_read_content(content_id));
CREATE POLICY content_files_staff ON public.content_files FOR ALL TO authenticated USING(private.is_staff()) WITH CHECK(private.is_staff());
CREATE FUNCTION private.can_read_content_file(path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.content_files f WHERE f.object_path=path AND private.can_read_content(f.content_id)); $$;
REVOKE ALL ON FUNCTION private.can_read_content_file(text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION private.can_read_content_file(text) TO anon,authenticated,service_role;
CREATE POLICY content_storage_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='content-files' AND private.can_read_content_file(name));
CREATE POLICY content_storage_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='content-files' AND private.is_staff());
CREATE POLICY content_storage_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='content-files' AND private.is_staff()) WITH CHECK(bucket_id='content-files' AND private.is_staff());
CREATE POLICY content_storage_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='content-files' AND private.is_staff());
CREATE TRIGGER content_updated BEFORE UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER content_categories_updated BEFORE UPDATE ON public.content_categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER content_groups_updated BEFORE UPDATE ON public.content_groups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER content_files_updated BEFORE UPDATE ON public.content_files FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE FUNCTION public.set_content_audience(content_uuid uuid, new_audience public.content_audience, category_ids uuid[], group_ids uuid[]) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NOT private.is_staff() THEN RAISE EXCEPTION 'ليس لديك صلاحية تعديل المحتوى'; END IF; IF new_audience='targeted' AND coalesce(cardinality(category_ids),0)+coalesce(cardinality(group_ids),0)=0 THEN RAISE EXCEPTION 'اختر فئة أو مجموعة'; END IF; UPDATE public.content_items SET audience=new_audience WHERE id=content_uuid; IF NOT FOUND THEN RAISE EXCEPTION 'المحتوى غير موجود'; END IF; DELETE FROM public.content_categories WHERE content_id=content_uuid; DELETE FROM public.content_groups WHERE content_id=content_uuid; IF new_audience='targeted' THEN INSERT INTO public.content_categories(content_id,category_id) SELECT content_uuid,x FROM (SELECT DISTINCT unnest(category_ids) x) s; INSERT INTO public.content_groups(content_id,group_id) SELECT content_uuid,x FROM (SELECT DISTINCT unnest(group_ids) x) s; END IF; END; $$;
REVOKE ALL ON FUNCTION public.set_content_audience(uuid,public.content_audience,uuid[],uuid[]) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.set_content_audience(uuid,public.content_audience,uuid[],uuid[]) TO authenticated,service_role;

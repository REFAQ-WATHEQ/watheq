CREATE TABLE public.role_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid,
 target_user uuid NOT NULL,
 old_role public.app_role,
 new_role public.app_role,
 actor_source text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.role_audit_log TO authenticated;
GRANT SELECT ON public.role_audit_log TO service_role;
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_audit_admin_read ON public.role_audit_log FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE FUNCTION private.admin_account_eligible(account_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=account_id AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()));
$$;
REVOKE ALL ON FUNCTION private.admin_account_eligible(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.guard_admin_roles() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(184910,1);
 IF TG_OP='INSERT' THEN
  IF NEW.role='admin' AND NOT private.admin_account_eligible(NEW.user_id) THEN RAISE EXCEPTION 'يجب أن يكون حساب المدير مؤكد البريد وغير محظور'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND NEW.role='admin' AND (OLD.role<>'admin' OR NEW.user_id<>OLD.user_id) AND NOT private.admin_account_eligible(NEW.user_id) THEN RAISE EXCEPTION 'يجب أن يكون حساب المدير مؤكد البريد وغير محظور'; END IF;
 IF OLD.role='admin' AND (TG_OP='DELETE' OR NEW.role<>'admin' OR NEW.user_id<>OLD.user_id) THEN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.role='admin' AND r.id<>OLD.id AND private.admin_account_eligible(r.user_id)) THEN
   RAISE EXCEPTION 'لا يمكن إلغاء صلاحية آخر مدير نشط؛ عيّن مديرًا بديلًا أولًا';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_admin_roles() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER admin_roles_guard BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION private.guard_admin_roles();

CREATE FUNCTION private.audit_admin_roles() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous_role public.app_role; next_role public.app_role; target uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN previous_role:=OLD.role; target:=OLD.user_id; END IF;
 IF TG_OP<>'DELETE' THEN next_role:=NEW.role; target:=NEW.user_id; END IF;
 IF (previous_role='admin' OR next_role='admin') AND previous_role IS DISTINCT FROM next_role THEN
  INSERT INTO public.role_audit_log(actor_id,target_user,old_role,new_role,actor_source) VALUES(auth.uid(),target,previous_role,next_role,CASE WHEN auth.uid() IS NULL THEN 'database_maintenance' ELSE 'authenticated_admin' END);
 END IF;
 RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION private.audit_admin_roles() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER admin_roles_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION private.audit_admin_roles();

CREATE OR REPLACE FUNCTION public.set_account_role(target_user uuid,new_role public.app_role) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=auth.uid(); existing_id uuid; previous_role public.app_role;
BEGIN
 PERFORM pg_advisory_xact_lock(184910,1);
 IF actor IS NULL OR NOT private.admin_account_eligible(actor) OR NOT private.has_role(actor,'admin') THEN RAISE EXCEPTION 'منح الأدوار متاح لمدير منصة نشط فقط'; END IF;
 IF actor=target_user THEN RAISE EXCEPTION 'لا يمكنك تغيير دورك من هذه الصفحة'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target_user) THEN RAISE EXCEPTION 'الحساب غير موجود'; END IF;
 IF new_role='admin' AND NOT private.admin_account_eligible(target_user) THEN RAISE EXCEPTION 'يجب تأكيد بريد الحساب وعدم حظره قبل تعيينه مديرًا'; END IF;
 SELECT r.id,r.role INTO existing_id,previous_role FROM public.user_roles r WHERE r.user_id=target_user ORDER BY CASE r.role WHEN 'admin' THEN 0 WHEN 'supervisor' THEN 1 ELSE 2 END LIMIT 1;
 IF previous_role=new_role THEN RETURN; END IF;
 DELETE FROM public.user_roles WHERE user_id=target_user AND id IS DISTINCT FROM existing_id;
 IF existing_id IS NULL THEN INSERT INTO public.user_roles(user_id,role) VALUES(target_user,new_role);
 ELSE UPDATE public.user_roles SET role=new_role WHERE id=existing_id; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_account_role(uuid,public.app_role) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_account_role(uuid,public.app_role) TO authenticated;
DROP POLICY IF EXISTS roles_admin ON public.user_roles;
REVOKE INSERT,UPDATE,DELETE ON public.user_roles FROM authenticated;

CREATE FUNCTION public.get_admin_directory() RETURNS TABLE(user_id uuid,full_name text,email text,eligible boolean,is_admin boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT private.admin_account_eligible(auth.uid()) OR NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'عرض المديرين متاح لمدير منصة نشط فقط'; END IF;
 RETURN QUERY SELECT p.id,p.full_name,p.email,private.admin_account_eligible(p.id),EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='admin') FROM public.profiles p ORDER BY p.full_name;
END; $$;
REVOKE ALL ON FUNCTION public.get_admin_directory() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_directory() TO authenticated;

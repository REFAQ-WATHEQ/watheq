CREATE TABLE private.platform_admin_bootstrap (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 consumed boolean NOT NULL DEFAULT false,
 target_user uuid,
 initialized_by text,
 bootstrap_xid bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.platform_admin_bootstrap FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.platform_admin_bootstrap ENABLE ROW LEVEL SECURITY;
INSERT INTO private.platform_admin_bootstrap(singleton,consumed) VALUES (true,EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin'));

REVOKE ALL ON public.user_roles FROM anon, authenticated, service_role;
GRANT SELECT ON public.user_roles TO authenticated, service_role;
REVOKE ALL ON public.role_audit_log FROM anon, authenticated, service_role;
GRANT SELECT ON public.role_audit_log TO authenticated, service_role;
ALTER TABLE public.role_audit_log ADD COLUMN database_executor text;

CREATE OR REPLACE FUNCTION private.guard_admin_roles() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(184910,1);
 IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
  RAISE EXCEPTION 'لا يمكن نقل صف الدور إلى حساب آخر';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.role='admin' AND NOT private.admin_account_eligible(NEW.user_id) THEN RAISE EXCEPTION 'يجب أن يكون حساب المدير مؤكد البريد وغير محظور'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND NEW.role='admin' AND OLD.role<>'admin' AND NOT private.admin_account_eligible(NEW.user_id) THEN RAISE EXCEPTION 'يجب أن يكون حساب المدير مؤكد البريد وغير محظور'; END IF;
 IF OLD.role='admin' AND (TG_OP='DELETE' OR NEW.role<>'admin') THEN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.role='admin' AND r.id<>OLD.id AND private.admin_account_eligible(r.user_id)) THEN
   RAISE EXCEPTION 'لا يمكن إلغاء صلاحية آخر مدير نشط؛ عيّن مديرًا بديلًا أولًا';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_admin_roles() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_admin_roles() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous_role public.app_role; next_role public.app_role; target uuid; bootstrap_actor text;
BEGIN
 IF TG_OP<>'INSERT' THEN previous_role:=OLD.role; target:=OLD.user_id; END IF;
 IF TG_OP<>'DELETE' THEN next_role:=NEW.role; target:=NEW.user_id; END IF;
 IF (previous_role='admin' OR next_role='admin') AND previous_role IS DISTINCT FROM next_role THEN
  SELECT initialized_by INTO bootstrap_actor FROM private.platform_admin_bootstrap
   WHERE singleton AND consumed AND target_user=target AND bootstrap_xid=txid_current();
  INSERT INTO public.role_audit_log(actor_id,target_user,old_role,new_role,actor_source,database_executor)
  VALUES(CASE WHEN bootstrap_actor IS NULL THEN auth.uid() ELSE NULL END,target,previous_role,next_role,
   CASE WHEN bootstrap_actor IS NOT NULL THEN 'first_admin_bootstrap' WHEN auth.uid() IS NULL THEN 'database_maintenance' ELSE 'authenticated_admin' END,
   CASE WHEN bootstrap_actor IS NOT NULL THEN bootstrap_actor WHEN auth.uid() IS NULL THEN session_user::text ELSE NULL END);
 END IF;
 RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION private.audit_admin_roles() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.bootstrap_first_platform_admin(target_account uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE state_consumed boolean; existing_role_id uuid;
BEGIN
 IF current_user<>'postgres' OR auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION 'التهيئة متاحة لمالك قاعدة البيانات الموثوق فقط';
 END IF;
 PERFORM pg_advisory_xact_lock(184910,1);
 SELECT consumed INTO state_consumed FROM private.platform_admin_bootstrap WHERE singleton FOR UPDATE;
 IF state_consumed IS NULL OR state_consumed THEN RAISE EXCEPTION 'مسار تهيئة المدير مغلق'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') THEN RAISE EXCEPTION 'يوجد مدير بالفعل؛ استخدم إدارة المنصة'; END IF;
 IF target_account IS NULL THEN RAISE EXCEPTION 'معرف الحساب إلزامي'; END IF;
 PERFORM 1 FROM auth.users WHERE id=target_account FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'الحساب غير موجود'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=target_account FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'الملف الشخصي غير موجود'; END IF;
 IF NOT private.admin_account_eligible(target_account) THEN RAISE EXCEPTION 'يجب أن يكون الحساب مؤكد البريد وغير محظور وغير محذوف'; END IF;
 SELECT id INTO existing_role_id FROM public.user_roles WHERE user_id=target_account ORDER BY CASE role WHEN 'supervisor' THEN 0 ELSE 1 END LIMIT 1;
 UPDATE private.platform_admin_bootstrap SET consumed=true,target_user=target_account,initialized_by=current_user,bootstrap_xid=txid_current(),updated_at=now() WHERE singleton;
 DELETE FROM public.user_roles WHERE user_id=target_account AND id IS DISTINCT FROM existing_role_id;
 IF existing_role_id IS NULL THEN INSERT INTO public.user_roles(user_id,role) VALUES(target_account,'admin');
 ELSE UPDATE public.user_roles SET role='admin' WHERE id=existing_role_id; END IF;
END; $$;
REVOKE ALL ON FUNCTION private.bootstrap_first_platform_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.bootstrap_first_platform_admin(uuid) TO postgres;
COMMENT ON FUNCTION private.bootstrap_first_platform_admin(uuid) IS 'Owner-only one-use initialization; requires separately approved existing verified account UUID. No public or service-role bootstrap. Never resets after success.';

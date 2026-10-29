ALTER FUNCTION public.set_account_role(uuid,public.app_role) SET SCHEMA private;
CREATE FUNCTION public.set_account_role(target_user uuid,new_role public.app_role) RETURNS void LANGUAGE sql SET search_path = '' AS $$ SELECT private.set_account_role(target_user,new_role); $$;
REVOKE ALL ON FUNCTION public.set_account_role(uuid,public.app_role) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.set_account_role(uuid,public.app_role) TO authenticated;
ALTER FUNCTION public.get_admin_directory() SET SCHEMA private;
CREATE FUNCTION public.get_admin_directory() RETURNS TABLE(user_id uuid,full_name text,email text,eligible boolean,is_admin boolean) LANGUAGE sql SET search_path = '' AS $$ SELECT * FROM private.get_admin_directory(); $$;
REVOKE ALL ON FUNCTION public.get_admin_directory() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_directory() TO authenticated;

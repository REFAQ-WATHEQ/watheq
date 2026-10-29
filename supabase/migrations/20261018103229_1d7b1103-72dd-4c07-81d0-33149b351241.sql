CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated,service_role;
ALTER FUNCTION public.has_role(uuid,public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_staff() SET SCHEMA private;
CREATE FUNCTION public.has_role(_user_id uuid,_role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT private.has_role(_user_id,_role); $$;
REVOKE ALL ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated,service_role;
CREATE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT private.is_staff(); $$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated,service_role;

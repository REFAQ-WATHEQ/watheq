CREATE POLICY bootstrap_no_application_access ON private.platform_admin_bootstrap AS RESTRICTIVE FOR ALL TO anon, authenticated, service_role USING (false) WITH CHECK (false);

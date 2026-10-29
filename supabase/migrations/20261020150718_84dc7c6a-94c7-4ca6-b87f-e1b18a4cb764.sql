ALTER TABLE public.document_formats
  ADD COLUMN verify_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN verified_mime text,
  ADD COLUMN verified_size bigint,
  ADD COLUMN verify_details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.validate_document_format() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.format NOT IN ('pdf','word','excel','powerpoint','other') THEN RAISE EXCEPTION 'صيغة غير مدعومة'; END IF;
  IF NEW.drive_file_id !~ '^[A-Za-z0-9_-]{10,200}$' THEN RAISE EXCEPTION 'معرّف ملف Drive غير صالح'; END IF;
  IF NEW.verify_status NOT IN ('unverified','ok','failed') THEN RAISE EXCEPTION 'حالة تحقق غير صالحة'; END IF;
  -- Only the trusted server check may record results.
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
    IF TG_OP = 'INSERT' OR NEW.drive_file_id IS DISTINCT FROM OLD.drive_file_id OR NEW.format IS DISTINCT FROM OLD.format THEN
      NEW.verify_status := 'unverified'; NEW.verified_at := NULL; NEW.verified_mime := NULL; NEW.verified_size := NULL; NEW.verify_details := '{}'::jsonb;
    ELSE
      NEW.verify_status := OLD.verify_status; NEW.verified_at := OLD.verified_at; NEW.verified_mime := OLD.verified_mime; NEW.verified_size := OLD.verified_size; NEW.verify_details := OLD.verify_details;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND (NEW.drive_file_id IS DISTINCT FROM OLD.drive_file_id OR NEW.format IS DISTINCT FROM OLD.format) AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at THEN
    NEW.verify_status := 'unverified'; NEW.verified_at := NULL; NEW.verified_mime := NULL; NEW.verified_size := NULL; NEW.verify_details := '{}'::jsonb;
  END IF;
  RETURN NEW;
END; $$;

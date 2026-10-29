CREATE TYPE public.document_status AS ENUM ('draft','published','archived');

CREATE TABLE public.document_types (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, sort_order int NOT NULL DEFAULT 0, hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.document_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_types TO service_role;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_types_public ON public.document_types FOR SELECT TO anon, authenticated USING (NOT hidden OR private.is_staff());
CREATE POLICY document_types_staff ON public.document_types FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());
CREATE TRIGGER document_types_updated BEFORE UPDATE ON public.document_types FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.content_items
  ADD COLUMN status public.document_status NOT NULL DEFAULT 'draft',
  ADD COLUMN document_type_id uuid REFERENCES public.document_types(id) ON DELETE SET NULL,
  ADD COLUMN issuer text NOT NULL DEFAULT '',
  ADD COLUMN document_date date;
UPDATE public.content_items SET status = CASE WHEN published THEN 'published'::public.document_status ELSE 'draft'::public.document_status END;

CREATE OR REPLACE FUNCTION public.sync_content_status() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.published IS DISTINCT FROM OLD.published THEN
    NEW.status := CASE WHEN NEW.published THEN 'published'::public.document_status ELSE 'draft'::public.document_status END;
  END IF;
  NEW.published := (NEW.status = 'published');
  RETURN NEW;
END; $$;
CREATE TRIGGER content_status_sync BEFORE INSERT OR UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.sync_content_status();

CREATE TABLE public.knowledge_topics (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid REFERENCES public.knowledge_topics(id) ON DELETE CASCADE, name text NOT NULL, icon text NOT NULL DEFAULT 'BookOpen', sort_order int NOT NULL DEFAULT 0, hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (parent_id, name));
GRANT SELECT ON public.knowledge_topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_topics TO service_role;
ALTER TABLE public.knowledge_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY topics_public ON public.knowledge_topics FOR SELECT TO anon, authenticated USING (NOT hidden OR private.is_staff());
CREATE POLICY topics_staff ON public.knowledge_topics FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());
CREATE TRIGGER topics_updated BEFORE UPDATE ON public.knowledge_topics FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.content_topics (content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE, topic_id uuid NOT NULL REFERENCES public.knowledge_topics(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (content_id, topic_id));
GRANT SELECT ON public.content_topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_topics TO service_role;
ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_topics_read ON public.content_topics FOR SELECT TO anon, authenticated USING (private.can_read_content(content_id));
CREATE POLICY content_topics_staff ON public.content_topics FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

CREATE TABLE public.tags (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_public ON public.tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tags_staff ON public.tags FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());
CREATE TRIGGER tags_updated BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.content_tags (content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE, tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (content_id, tag_id));
GRANT SELECT ON public.content_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_tags TO service_role;
ALTER TABLE public.content_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_tags_read ON public.content_tags FOR SELECT TO anon, authenticated USING (private.can_read_content(content_id));
CREATE POLICY content_tags_staff ON public.content_tags FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

CREATE TABLE public.document_formats (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE, format text NOT NULL, drive_file_id text NOT NULL, label text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (content_id, format));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_formats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_formats TO service_role;
ALTER TABLE public.document_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY formats_staff ON public.document_formats FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());
CREATE TRIGGER formats_updated BEFORE UPDATE ON public.document_formats FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.validate_document_format() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.format NOT IN ('pdf','word','excel','powerpoint','other') THEN RAISE EXCEPTION 'صيغة غير مدعومة'; END IF;
  IF NEW.drive_file_id !~ '^[A-Za-z0-9_-]{10,200}$' THEN RAISE EXCEPTION 'معرّف ملف Drive غير صالح'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER formats_validate BEFORE INSERT OR UPDATE ON public.document_formats FOR EACH ROW EXECUTE FUNCTION public.validate_document_format();

CREATE TABLE public.document_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE, format_id uuid REFERENCES public.document_formats(id) ON DELETE SET NULL, user_id uuid, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.document_events TO authenticated;
GRANT SELECT, INSERT ON public.document_events TO service_role;
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_staff_read ON public.document_events FOR SELECT TO authenticated USING (private.is_staff());
CREATE INDEX document_events_content_idx ON public.document_events(content_id, event);

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.content_items, public.content_files, public.content_categories, public.content_groups, public.categories, public.groups, public.group_memberships, public.category_memberships, public.employee_access, public.profiles, public.brand_settings, public.document_types, public.knowledge_topics, public.content_topics, public.tags, public.content_tags, public.document_formats, public.document_events FROM anon, authenticated, service_role;

INSERT INTO public.knowledge_topics(name, icon, sort_order) VALUES
('وثائق المستفيدين','Users',1),('التسويق والاتصال','Megaphone',2),('أدلة الحوكمة','Landmark',3),('اللوائح والأدلة المالية','Wallet',4),('الموارد البشرية','UserRound',5),('التخطيط الاستراتيجي','Target',6),('إدارة المشاريع','KanbanSquare',7),('الجودة والتطوير المؤسسي','BadgeCheck',8),('الشراكات وتنمية الموارد','Handshake',9),('التطوع والمشاركة المجتمعية','HeartHandshake',10),('التقنية والتحول الرقمي','Cpu',11),('الدراسات والبحوث','FlaskConical',12);
INSERT INTO public.document_types(name, sort_order) VALUES ('دليل',1),('لائحة',2),('سياسة',3),('نموذج',4),('تقرير',5),('دراسة',6),('خطة',7),('إجراء',8),('ميثاق',9),('مرجع معرفي',10);

CREATE OR REPLACE FUNCTION private.document_trial_active(doc uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.document_access_trial w JOIN private.document_trial_documents t ON t.content_id=doc
 JOIN public.content_items c ON c.id=t.content_id JOIN public.document_formats f ON f.id=t.format_id AND f.content_id=t.content_id
 WHERE w.started_at<=clock_timestamp() AND clock_timestamp()<w.ends_at AND w.stopped_at IS NULL
 AND c.kind='documents' AND c.audience=t.audience AND f.format='pdf' AND f.drive_file_id=t.drive_file_id AND f.verify_status='ok' AND f.verified_mime='application/pdf' AND f.verified_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.document_formats x WHERE x.content_id=doc AND x.id<>t.format_id)
 AND NOT EXISTS(SELECT 1 FROM public.content_files x WHERE x.content_id=doc)
 AND NOT EXISTS(SELECT 1 FROM public.content_categories x WHERE x.content_id=doc)
 AND (CASE WHEN t.group_id IS NULL THEN NOT EXISTS(SELECT 1 FROM public.content_groups x WHERE x.content_id=doc)
 ELSE EXISTS(SELECT 1 FROM public.content_groups x WHERE x.content_id=doc AND x.group_id=t.group_id) AND NOT EXISTS(SELECT 1 FROM public.content_groups x WHERE x.content_id=doc AND x.group_id<>t.group_id) END));
$$;
ALTER FUNCTION private.can_read_content(uuid) VOLATILE;

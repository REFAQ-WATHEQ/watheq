import {beforeAll, beforeEach, describe, expect, it} from 'vitest'
import {execFileSync, spawn} from 'node:child_process'
import {readFileSync, readdirSync} from 'node:fs'

// Disposable loopback PostgreSQL only (scripts/test-library.sh). Never touches production.
const enabled = process.env['WATHIQ_LOCAL_DB_TESTS'] === '1'
const suite = enabled ? describe : describe.skip
const db = 'wathiq_library_tests'
const port = '55439'
const admin='20000000-0000-4000-8000-000000000001', sup='20000000-0000-4000-8000-000000000002', user='20000000-0000-4000-8000-000000000003', emp='20000000-0000-4000-8000-000000000004'
const doc='30000000-0000-4000-8000-000000000001'
function sql(q:string){return execFileSync('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-At','-c',q],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
function as(role:string,id:string|null,q:string){return sql(`BEGIN; SET LOCAL ROLE ${role}; ${id?`SELECT set_config('request.jwt.claim.sub','${id}',true);`:''} ${q}; COMMIT;`).split('\n').filter(l=>!['BEGIN','SET','COMMIT','set_config',id??''].includes(l)&&!/^(INSERT|UPDATE|DELETE) /.test(l)).pop()??''}
function parallel(q:string){return new Promise<boolean>(r=>{const c=spawn('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-c',q],{stdio:'ignore'});c.on('exit',x=>r(x===0))})}
const visible=(role:string,id:string|null)=>as(role,id,`SELECT count(*) FROM public.content_items WHERE id='${doc}'`)

suite('Document library stage 1: schema, status and permissions',()=>{
 beforeAll(()=>{
  execFileSync('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-c',`DROP DATABASE IF EXISTS ${db}`])
  execFileSync('createdb',['-h','127.0.0.1','-p',port,'-U','postgres',db])
  sql(readFileSync('src/test/fixtures/supabase-role-environment.sql','utf8'))
  for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())sql(readFileSync(`supabase/migrations/${f}`,'utf8'))
  sql(`INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) SELECT x::uuid,'fixture@invalid.test',now(),'{"full_name":"Test User","organization":"Test Org","job_title":"Test Job","mobile":"0501234567"}'::jsonb FROM unnest(ARRAY['${admin}','${sup}','${user}','${emp}']) x;
   SELECT private.bootstrap_first_platform_admin('${admin}');
   UPDATE public.user_roles SET role='supervisor' WHERE user_id='${sup}';
   INSERT INTO public.employee_access(user_id) VALUES('${emp}');`)
 },30000)
 beforeEach(()=>{sql(`DELETE FROM public.content_items; DELETE FROM public.content_categories; DELETE FROM public.content_topics; DELETE FROM public.content_tags; SET session_replication_role=replica; DELETE FROM public.knowledge_topics WHERE sort_order>=100; DELETE FROM public.tags; SET session_replication_role=origin; INSERT INTO public.content_items(id,title,kind,audience,status) VALUES('${doc}','Fixture','articles','everyone','draft')`)})

 it('seeds 12 root topics and 10 document types',()=>{expect(sql('SELECT count(*) FROM public.knowledge_topics WHERE parent_id IS NULL AND sort_order<100')).toBe('12');expect(sql('SELECT count(*) FROM public.document_types')).toBe('10')})
 it('keeps topics independent of access categories and groups',()=>{expect(sql("SELECT count(*) FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage u USING(constraint_name) WHERE tc.table_name IN ('knowledge_topics','content_topics') AND u.table_name IN ('categories','groups')")).toBe('0')})
 it('rejects duplicate subtopic names under the same parent',()=>{const p=sql("INSERT INTO public.knowledge_topics(name,sort_order) VALUES('Parent',100) RETURNING id").split('\n')[0];sql(`INSERT INTO public.knowledge_topics(parent_id,name,sort_order) VALUES('${p}','Child',100)`);expect(()=>sql(`INSERT INTO public.knowledge_topics(parent_id,name,sort_order) VALUES('${p}','Child',100)`)).toThrow()})
 it('rejects duplicate root topic names',()=>{sql("INSERT INTO public.knowledge_topics(name,sort_order) VALUES('Root dup',100)");expect(()=>sql("INSERT INTO public.knowledge_topics(name,sort_order) VALUES('Root dup',100)")).toThrow()})
 it('treats spacing and letter case as the same root name',()=>{sql("INSERT INTO public.knowledge_topics(name,sort_order) VALUES('Quality  Topic',100)");expect(()=>sql("INSERT INTO public.knowledge_topics(name,sort_order) VALUES('  quality topic ',100)")).toThrow();expect(()=>sql("INSERT INTO public.knowledge_topics(name,sort_order) VALUES(' أدلة   الحوكمة ',100)")).toThrow()})
 it('allows the same subtopic name under different parents',()=>{const ids=sql("INSERT INTO public.knowledge_topics(name,sort_order) VALUES('P1',100),('P2',100) RETURNING id").split('\n').slice(0,2);for(const id of ids)sql(`INSERT INTO public.knowledge_topics(parent_id,name,sort_order) VALUES('${id}','Shared',100)`);expect(sql("SELECT count(*) FROM public.knowledge_topics WHERE name='Shared'")).toBe('2')})
 it('allows exactly one of two concurrent identical root inserts by staff',async()=>{const q=`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${admin}',true); INSERT INTO public.knowledge_topics(name,sort_order) VALUES('Concurrent',100); SELECT pg_sleep(0.5); COMMIT;`;const r=await Promise.all([parallel(q),parallel(q)]);expect(r.filter(Boolean)).toHaveLength(1);expect(sql("SELECT count(*) FROM public.knowledge_topics WHERE name='Concurrent'")).toBe('1')})

 const topic=(name:string,parent?:string):string=>sql(`INSERT INTO public.knowledge_topics(name,sort_order${parent?',parent_id':''}) VALUES('${name}',100${parent?`,'${parent}'`:''}) RETURNING id`).split('\n')[0]!
 it('stores and edits descriptions',()=>{const t=topic('Desc');sql(`UPDATE public.knowledge_topics SET description='d1' WHERE id='${t}'`);expect(sql(`SELECT description FROM public.knowledge_topics WHERE id='${t}'`)).toBe('d1')})
 it('refuses deleting a parent topic and keeps the child',()=>{const p=topic('DelP');topic('DelC',p);expect(()=>sql(`DELETE FROM public.knowledge_topics WHERE id='${p}'`)).toThrow();expect(sql("SELECT count(*) FROM public.knowledge_topics WHERE name='DelC'")).toBe('1')})
 it('refuses deleting a linked topic, type or tag and keeps links',()=>{const t=topic('Linked');const ty=sql("SELECT id FROM public.document_types LIMIT 1");const tg=sql("INSERT INTO public.tags(name) VALUES('linkedtag') RETURNING id").split('\n')[0];sql(`INSERT INTO public.content_topics VALUES('${doc}','${t}'); INSERT INTO public.content_tags VALUES('${doc}','${tg}'); UPDATE public.content_items SET document_type_id='${ty}' WHERE id='${doc}'`);expect(()=>sql(`DELETE FROM public.knowledge_topics WHERE id='${t}'`)).toThrow();expect(()=>sql(`DELETE FROM public.document_types WHERE id='${ty}'`)).toThrow();expect(()=>sql(`DELETE FROM public.tags WHERE id='${tg}'`)).toThrow();expect(sql(`SELECT count(*) FROM public.content_topics WHERE topic_id='${t}'`)).toBe('1');sql("DELETE FROM public.content_items; DELETE FROM public.tags")})
 it('deletes unused topic, type and tag',()=>{const t=topic('Unused');sql(`DELETE FROM public.knowledge_topics WHERE id='${t}'`);sql("INSERT INTO public.document_types(name) VALUES('tmp type'); DELETE FROM public.document_types WHERE name='tmp type'; INSERT INTO public.tags(name) VALUES('tmp'); DELETE FROM public.tags WHERE name='tmp'");expect(sql("SELECT count(*) FROM public.document_types")).toBe('10')})
 it('refuses self-parent and descendant-parent edits',()=>{const a=topic('CA');const b=topic('CB',a);const c=topic('CC',b);expect(()=>sql(`UPDATE public.knowledge_topics SET parent_id='${a}' WHERE id='${a}'`)).toThrow();expect(()=>sql(`UPDATE public.knowledge_topics SET parent_id='${c}' WHERE id='${a}'`)).toThrow()})
 it('serializes concurrent edits that together would form a cycle',async()=>{const a=topic('XA');const b=topic('XB');const q=(x:string,y:string)=>`BEGIN; UPDATE public.knowledge_topics SET parent_id='${y}' WHERE id='${x}'; SELECT pg_sleep(0.5); COMMIT;`;const r=await Promise.all([parallel(q(a!,b!)),parallel(q(b!,a!))]);expect(r.filter(Boolean)).toHaveLength(1)})
 it('rejects normalized duplicate type and tag names',()=>{expect(()=>sql("INSERT INTO public.document_types(name) VALUES('  دليل ')")).toThrow();sql("INSERT INTO public.tags(name) VALUES('Data Tag')");expect(()=>sql("INSERT INTO public.tags(name) VALUES(' data   tag')")).toThrow();sql('DELETE FROM public.tags')})
 it('counts only documents each visitor may read',()=>{
  const t=topic('Counts');const ids:Record<string,string>={}
  sql("INSERT INTO public.categories(id,name) VALUES('40000000-0000-4000-8000-000000000001','Cat') ON CONFLICT DO NOTHING")
  sql(`INSERT INTO public.category_memberships(category_id,user_id) VALUES('40000000-0000-4000-8000-000000000001','${user}') ON CONFLICT DO NOTHING`)
  for(const [k,aud,st] of ( [['e','everyone','published'],['r','registered','published'],['m','employees','published'],['t','targeted','published'],['d','everyone','draft'],['a','everyone','archived']] as const)){ids[k]=sql(`INSERT INTO public.content_items(title,kind,audience,status,document_type_id) VALUES('${k}','documents','${aud}','draft',(SELECT id FROM public.document_types LIMIT 1)) RETURNING id`).split('\n')[0]!;sql(`INSERT INTO public.content_topics VALUES('${ids[k]}','${t}'); INSERT INTO public.document_formats(content_id,format,drive_file_id) VALUES('${ids[k]}','pdf','abcdefghijklmnop')`);if(st!=='draft')sql(`ALTER TABLE public.content_items DISABLE TRIGGER document_publish_guard; UPDATE public.content_items SET status='${st}' WHERE id='${ids[k]}'; ALTER TABLE public.content_items ENABLE TRIGGER document_publish_guard`)}
  sql(`INSERT INTO public.content_categories(content_id,category_id) VALUES('${ids['t']}','40000000-0000-4000-8000-000000000001')`)
  const c=(role:string,id:string|null)=>as(role,id,`SELECT coalesce((SELECT documents FROM public.topic_document_counts() WHERE topic_id='${t}'),0)`)
  expect(c('anon',null)).toBe('1');expect(c('authenticated',emp)).toBe('3');expect(c('authenticated',user)).toBe('3');expect(c('authenticated',admin)).toBe('4')
  sql(`UPDATE public.knowledge_topics SET hidden=true WHERE id='${t}'`);expect(c('anon',null)).toBe('0')
 })
 it.each([['anon',null],['authenticated',user],['authenticated',emp]] as const)('blocks %s from editing descriptions or parents',(role,id)=>{const t=topic('Prot');try{as(role,id,`UPDATE public.knowledge_topics SET description='x' WHERE id='${t}'`)}catch{};expect(sql(`SELECT description FROM public.knowledge_topics WHERE id='${t}'`)).toBe('')})
 it('lets visitors read visible topics and types but not hidden ones',()=>{const t=topic('HiddenT');sql(`UPDATE public.knowledge_topics SET hidden=true WHERE id='${t}'`);expect(as('anon',null,'SELECT count(*) FROM public.knowledge_topics')).toBe('12');expect(as('anon',null,'SELECT count(*) FROM public.document_types')).toBe('10');expect(as('authenticated',sup,`SELECT count(*) FROM public.knowledge_topics WHERE id='${t}'`)).toBe('1')})
 it('syncs status with legacy published in both directions',()=>{
  sql(`UPDATE public.content_items SET status='published' WHERE id='${doc}'`);expect(sql(`SELECT published FROM public.content_items WHERE id='${doc}'`)).toBe('t')
  sql(`UPDATE public.content_items SET status='archived' WHERE id='${doc}'`);expect(sql(`SELECT published FROM public.content_items WHERE id='${doc}'`)).toBe('f')
  sql(`UPDATE public.content_items SET published=true WHERE id='${doc}'`);expect(sql(`SELECT status FROM public.content_items WHERE id='${doc}'`)).toBe('published')
 })
 it.each(['draft','archived'])('hides %s documents from visitors, users and employees but not staff',(s)=>{
  sql(`UPDATE public.content_items SET status='${s}' WHERE id='${doc}'`)
  expect(visible('anon',null)).toBe('0');expect(visible('authenticated',user)).toBe('0');expect(visible('authenticated',emp)).toBe('0')
  expect(visible('authenticated',admin)).toBe('1');expect(visible('authenticated',sup)).toBe('1')
 })
 it('shows published everyone-document to a visitor',()=>{sql(`UPDATE public.content_items SET status='published' WHERE id='${doc}'`);expect(visible('anon',null)).toBe('1')})
 it.each([['anon',null],['authenticated',user],['authenticated',emp]] as const)('denies content and taxonomy writes for %s %s',(role,id)=>{
  for(const q of [`INSERT INTO public.content_items(title,kind) VALUES('x','documents')`,`INSERT INTO public.knowledge_topics(name) VALUES('x')`,`INSERT INTO public.document_types(name) VALUES('x')`,`INSERT INTO public.tags(name) VALUES('x')`,`INSERT INTO public.document_formats(content_id,format,drive_file_id) VALUES('${doc}','pdf','abcdefghijklmnop')`])expect(()=>as(role,id,q)).toThrow()
  try{as(role,id,`UPDATE public.knowledge_topics SET name='hacked'; DELETE FROM public.document_types`)}catch{/* denied outright is also acceptable */}
  expect(sql("SELECT count(*) FROM public.knowledge_topics WHERE name='hacked'")).toBe('0');expect(sql('SELECT count(*) FROM public.document_types')).toBe('10')
 })
 it.each([admin,sup])('lets staff %s manage taxonomy and formats',(id)=>{
  as('authenticated',id,`INSERT INTO public.knowledge_topics(name,sort_order) VALUES('Staff ${id}',100); INSERT INTO public.document_formats(content_id,format,drive_file_id) VALUES('${doc}','pdf','abcdefghijklmnop')`)
  expect(sql(`SELECT count(*) FROM public.document_formats WHERE content_id='${doc}'`)).toBe('1')
 })
 it('rejects invalid format and malformed Drive identifiers',()=>{expect(()=>sql(`INSERT INTO public.document_formats(content_id,format,drive_file_id) VALUES('${doc}','exe','abcdefghijklmnop')`)).toThrow();expect(()=>sql(`INSERT INTO public.document_formats(content_id,format,drive_file_id) VALUES('${doc}','pdf','https://evil/x')`)).toThrow()})
 it('never exposes stored Drive file IDs to visitors, users or employees, even for published content',()=>{
  sql(`UPDATE public.content_items SET status='published' WHERE id='${doc}'; INSERT INTO public.document_formats(content_id,format,drive_file_id) VALUES('${doc}','pdf','abcdefghijklmnop')`)
  expect(()=>as('anon',null,'SELECT drive_file_id FROM public.document_formats')).toThrow()
  expect(as('authenticated',user,'SELECT count(*) FROM public.document_formats')).toBe('0');expect(as('authenticated',emp,'SELECT count(*) FROM public.document_formats')).toBe('0')
 })
 it('keeps usage events unreadable and unwritable by users; readable by staff only',()=>{
  sql(`INSERT INTO public.document_events(content_id,event) VALUES('${doc}','view')`)
  expect(()=>as('authenticated',user,`INSERT INTO public.document_events(content_id,event) VALUES('${doc}','download_completed')`)).toThrow()
  expect(as('authenticated',user,'SELECT count(*) FROM public.document_events')).toBe('0');expect(as('authenticated',sup,'SELECT count(*) FROM public.document_events')).toBe('1')
 })
 it('hides topic links of restricted documents',()=>{sql(`INSERT INTO public.content_topics(content_id,topic_id) SELECT '${doc}',id FROM public.knowledge_topics LIMIT 1`);expect(as('anon',null,'SELECT count(*) FROM public.content_topics')).toBe('0')})
 it.each(['anon','authenticated','service_role'])('has no TRUNCATE or TRIGGER privilege for %s on public tables',(r)=>{expect(sql(`SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee='${r}' AND privilege_type IN ('TRUNCATE','TRIGGER')`)).toBe('0')})
 it('leaves roles and admin protections intact',()=>{expect(sql("SELECT count(*) FROM public.user_roles WHERE role='admin'")).toBe('1');expect(()=>as('authenticated',sup,`SELECT public.set_account_role('${user}','admin')`)).toThrow()})

 // Stage 3: document management
 const F='abcdefghijklmnop', G='qrstuvwxyz123456'
 const save=(who:string,args:string)=>as('authenticated',who,`SELECT public.save_document(${args})`)
 const newDoc=(who:string,aud='everyone',fmts=`'[{"format":"pdf","drive_file_id":"${F}"},{"format":"word","drive_file_id":"${G}"}]'`)=>{const t=sql('SELECT id FROM public.knowledge_topics WHERE parent_id IS NULL ORDER BY sort_order LIMIT 1');const ty=sql('SELECT id FROM public.document_types LIMIT 1');return save(who,`NULL,'Stage3 doc','desc','${ty}',ARRAY['${t}']::uuid[],'{}','${aud}','{}','{}',${fmts}::jsonb`)}
 it.each([admin,sup])('staff %s creates a draft with multiple formats, edits it, archives and restores it',(who)=>{
  const id=newDoc(who);expect(sql(`SELECT status FROM public.content_items WHERE id='${id}'`)).toBe('draft');expect(sql(`SELECT count(*) FROM public.document_formats WHERE content_id='${id}'`)).toBe('2')
  const t=sql('SELECT id FROM public.knowledge_topics WHERE parent_id IS NULL ORDER BY sort_order LIMIT 1')
  save(who,`'${id}','Edited','d2',NULL,ARRAY['${t}']::uuid[],'{}','everyone','{}','{}','[{"format":"pdf","drive_file_id":"${G}"}]'::jsonb`)
  expect(sql(`SELECT title FROM public.content_items WHERE id='${id}'`)).toBe('Edited');expect(sql(`SELECT drive_file_id FROM public.document_formats WHERE content_id='${id}'`)).toBe(G)
  as('authenticated',who,`SELECT public.set_document_status('${id}','archived')`);expect(sql(`SELECT status||published::text FROM public.content_items WHERE id='${id}'`)).toBe('archivedfalse')
  as('authenticated',who,`SELECT public.set_document_status('${id}','draft')`);expect(sql(`SELECT status FROM public.content_items WHERE id='${id}'`)).toBe('draft')
 })
 it('publishes a complete everyone-document and keeps legacy published in sync',()=>{const id=newDoc(admin);as('authenticated',admin,`SELECT public.set_document_status('${id}','published')`);expect(sql(`SELECT published FROM public.content_items WHERE id='${id}'`)).toBe('t')})
 it('refuses publishing without type or formats',()=>{const id=newDoc(admin,'everyone',`'[]'`);expect(()=>as('authenticated',admin,`SELECT public.set_document_status('${id}','published')`)).toThrow();sql(`UPDATE public.content_items SET document_type_id=NULL WHERE id='${id}'`);expect(()=>as('authenticated',admin,`SELECT public.set_document_status('${id}','published')`)).toThrow()})
 it.each(['registered','employees'])('refuses publishing a %s document before secure delivery exists',(aud)=>{const id=newDoc(admin,aud);expect(()=>as('authenticated',admin,`SELECT public.set_document_status('${id}','published')`)).toThrow();expect(()=>sql(`UPDATE public.content_items SET published=true WHERE id='${id}'`)).toThrow()})
 it('refuses restricting the audience of a published document',()=>{const id=newDoc(admin);as('authenticated',admin,`SELECT public.set_document_status('${id}','published')`);expect(()=>as('authenticated',admin,`SELECT public.set_content_audience('${id}','employees','{}','{}')`)).toThrow()})
 it('rejects unsupported formats and malformed Drive ids through save_document',()=>{expect(()=>newDoc(admin,'everyone',`'[{"format":"exe","drive_file_id":"${F}"}]'`)).toThrow();expect(()=>newDoc(admin,'everyone',`'[{"format":"pdf","drive_file_id":"https://x"}]'`)).toThrow()})
 it.each([['anon',null],['authenticated',user],['authenticated',emp]] as const)('denies document management for %s %s',(role,id)=>{
  const doc2=newDoc(admin);const t=sql('SELECT id FROM public.knowledge_topics LIMIT 1')
  expect(()=>as(role,id,`SELECT public.save_document(NULL,'x','',NULL,ARRAY['${t}']::uuid[],'{}','everyone','{}','{}','[]')`)).toThrow()
  expect(()=>as(role,id,`SELECT public.set_document_status('${doc2}','archived')`)).toThrow()
  try{as(role,id,`UPDATE public.content_items SET title='hacked' WHERE id='${doc2}'`)}catch{/* denied */}
  expect(sql(`SELECT title FROM public.content_items WHERE id='${doc2}'`)).toBe('Stage3 doc')
 })
 it.each([user,emp])('blocks %s from granting themselves roles or employee access',(id)=>{expect(()=>as('authenticated',id,`SELECT public.set_account_role('${id}','admin')`)).toThrow();expect(()=>as('authenticated',id,`SELECT public.set_employee_access('${id}',true)`)).toThrow();expect(()=>as('authenticated',id,`INSERT INTO public.employee_access(user_id) VALUES('${id}') ON CONFLICT DO NOTHING`)).toThrow()})
 it('hides Drive ids of a published document from visitors, users and employees',()=>{const id=newDoc(admin);as('authenticated',admin,`SELECT public.set_document_status('${id}','published')`);expect(()=>as('anon',null,'SELECT drive_file_id FROM public.document_formats')).toThrow();expect(as('authenticated',user,'SELECT count(*) FROM public.document_formats')).toBe('0');expect(as('authenticated',emp,'SELECT count(*) FROM public.document_formats')).toBe('0');expect(as('anon',null,`SELECT count(*) FROM public.content_items WHERE id='${id}'`)).toBe('1')})
 it('keeps restricted drafts invisible to users and employees',()=>{const id=newDoc(admin,'employees');expect(as('authenticated',emp,`SELECT count(*) FROM public.content_items WHERE id='${id}'`)).toBe('0');expect(as('authenticated',user,`SELECT count(*) FROM public.content_items WHERE id='${id}'`)).toBe('0')})
 // Stage 4: browsing and search
 const pub=(title:string,aud:string,summary='',fmt='pdf')=>{const id=newDoc(admin,'everyone',`'[{"format":"${fmt}","drive_file_id":"${F}"}]'`);sql(`UPDATE public.content_items SET title='${title}',summary='${summary}' WHERE id='${id}'`);as('authenticated',admin,`SELECT public.set_document_status('${id}','published')`);if(aud!=='everyone')sql(`ALTER TABLE public.content_items DISABLE TRIGGER document_publish_guard; UPDATE public.content_items SET audience='${aud}' WHERE id='${id}'; ALTER TABLE public.content_items ENABLE TRIGGER document_publish_guard`);return id}
 const search=(role:string,id:string|null,args='')=>as(role,id,`SELECT coalesce(string_agg(title||':'||total,',' ORDER BY title),'') FROM public.search_library(${args})`)
 it('lists only published documents the visitor may read, counted after permissions',()=>{pub('A-public','everyone');pub('B-reg','registered');pub('C-emp','employees');newDoc(admin);const ar=newDoc(admin);as('authenticated',admin,`SELECT public.set_document_status('${ar}','archived')`)
  expect(search('anon',null)).toBe('A-public:1');expect(search('authenticated',user)).toBe('A-public:2,B-reg:2');expect(search('authenticated',emp)).toBe('A-public:3,B-reg:3,C-emp:3');expect(search('authenticated',admin)).toBe('A-public:3,B-reg:3,C-emp:3')})
 it('searches title and description without leaking restricted matches',()=>{pub('Alpha','everyone','water policy');pub('Beta','employees','water secret');expect(search('anon',null,"q=>'water'")).toBe('Alpha:1');expect(search('anon',null,"q=>'secret'")).toBe('');expect(search('authenticated',emp,"q=>'secret'")).toBe('Beta:1')})
 it('filters by format, type, tag and subtopic, and paginates',()=>{const a=pub('P1','everyone','','pdf');pub('W1','everyone','','word');pub('P2','everyone','','pdf')
  expect(search('anon',null,"fmt=>'word'")).toBe('W1:1')
  const tg=sql("INSERT INTO public.tags(name) VALUES('stage4tag') RETURNING id").split('\n')[0];sql(`INSERT INTO public.content_tags VALUES('${a}','${tg}')`);expect(search('anon',null,`tag_ids=>ARRAY['${tg}']::uuid[]`)).toBe('P1:1')
  const root=sql('SELECT id FROM public.knowledge_topics WHERE parent_id IS NULL ORDER BY sort_order LIMIT 1');const child=topic('Sub4',root);sql(`DELETE FROM public.content_topics WHERE content_id='${a}'; INSERT INTO public.content_topics VALUES('${a}','${child}')`);expect(search('anon',null,`topic=>'${child}'`)).toBe('P1:1');expect(search('anon',null,`topic=>'${root}'`)).toBe('P1:3,P2:3,W1:3')
  expect(as('anon',null,"SELECT string_agg(title,',') FROM public.search_library(sort=>'title',page=>2,page_size=>2)")).toBe('W1')
  sql(`DELETE FROM public.content_tags; DELETE FROM public.tags`)})
 it('exposes format kinds but never Drive ids, and nothing for restricted documents',()=>{const a=pub('Fa','everyone');const b=pub('Fb','employees');expect(as('anon',null,`SELECT public.document_format_kinds('${a}')::text`)).toBe('{pdf}');expect(as('anon',null,`SELECT public.document_format_kinds('${b}')::text`)).toBe('{}');expect(as('anon',null,`SELECT count(*) FROM public.search_library() s WHERE s::text LIKE '%${F}%'`)).toBe('0')})
 it('suggests related documents the viewer may read, excluding itself, drafts and duplicates',()=>{
  const cur=pub('Cur','everyone');const same=pub('SameTopic','everyone');const emp2=pub('EmpOnly','employees');const draft=newDoc(admin)
  const rel=(role:string,id:string|null,d:string)=>as(role,id,`SELECT coalesce(string_agg(title,',' ORDER BY title),'') FROM public.related_documents('${d}')`)
  expect(rel('anon',null,cur)).toBe('SameTopic');expect(rel('authenticated',emp,cur)).toBe('EmpOnly,SameTopic')
  expect(rel('anon',null,emp2)).toBe('');expect(rel('anon',null,draft)).toBe('')
  expect(as('anon',null,`SELECT count(*)-count(DISTINCT id) FROM public.related_documents('${cur}')`)).toBe('0')
 })
 it('lets only the trusted server record check results and resets them when the file reference changes',()=>{
  const id=newDoc(admin);const fid=sql(`SELECT id FROM public.document_formats WHERE content_id='${id}' AND format='pdf'`)
  as('authenticated',admin,`UPDATE public.document_formats SET verify_status='ok',verified_at=now() WHERE id='${fid}'`);expect(sql(`SELECT verify_status FROM public.document_formats WHERE id='${fid}'`)).toBe('unverified')
  sql(`BEGIN; SET LOCAL ROLE service_role; UPDATE public.document_formats SET verify_status='ok',verified_at=now(),verified_mime='application/pdf' WHERE id='${fid}'; COMMIT;`);expect(sql(`SELECT verify_status FROM public.document_formats WHERE id='${fid}'`)).toBe('ok')
  const t=sql('SELECT id FROM public.knowledge_topics WHERE parent_id IS NULL ORDER BY sort_order LIMIT 1')
  save(admin,`'${id}','Stage3 doc','d',NULL,ARRAY['${t}']::uuid[],'{}','everyone','{}','{}','[{"format":"pdf","drive_file_id":"zzzzzzzzzzzzzzzz"}]'::jsonb`)
  expect(sql(`SELECT verify_status||coalesce(verified_mime,'-') FROM public.document_formats WHERE id='${fid}'`)).toBe('unverified-')
  expect(as('authenticated',user,`SELECT count(*) FROM public.document_formats WHERE verify_status<>''`)).toBe('0')
 })
 // Stage 5: fresh caller-scoped gates and service-only idempotent usage.
 it.each(['registered','employees'])('permits %s publishing only after the delivery readiness gate is enabled',(aud)=>{
  const d=newDoc(admin,aud)
  expect(()=>as('authenticated',admin,`SELECT public.set_document_status('${d}','published')`)).toThrow()
  const result=sql(`BEGIN; CREATE OR REPLACE FUNCTION private.secure_delivery_ready() RETURNS boolean LANGUAGE sql IMMUTABLE AS 'SELECT true'; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${admin}',true); SELECT public.set_document_status('${d}','published'); RESET ROLE; SELECT status FROM public.content_items WHERE id='${d}'; ROLLBACK`)
  expect(result.split('\n')).toContain('published')
  expect(sql(`SELECT status FROM public.content_items WHERE id='${d}'`)).toBe('draft')
 })
 it.each(['everyone','registered','employees','targeted'])('applies the %s audience to delivery reads and usage totals',(aud)=>{
  const d=pub('Usage audience',aud); const f=sql(`SELECT id FROM public.document_formats WHERE content_id='${d}' LIMIT 1`)
  if(aud==='targeted')sql(`INSERT INTO public.categories(id,name) VALUES('40000000-0000-4000-8000-000000000002','DeliveryCat') ON CONFLICT DO NOTHING; INSERT INTO public.category_memberships(category_id,user_id) VALUES('40000000-0000-4000-8000-000000000002','${user}') ON CONFLICT DO NOTHING; INSERT INTO public.content_categories VALUES('${d}','40000000-0000-4000-8000-000000000002')`)
  sql(`SET ROLE service_role; SELECT public.record_document_usage('${d}','${f}',NULL,'download_request',repeat('a',64)); RESET ROLE`)
  const count=(role:string,u:string|null)=>as(role,u,`SELECT count(*) FROM public.document_usage_totals(ARRAY['${d}']::uuid[])`)
  expect(count('anon',null)).toBe(aud==='everyone'?'1':'0')
  expect(count('authenticated',user)).toBe(['everyone','registered','targeted'].includes(aud)?'1':'0')
  expect(count('authenticated',emp)).toBe(aud==='targeted'?'0':'1')
  expect(count('authenticated',sup)).toBe('1')
 })
 it('matches targeted groups independently and denies after membership revocation',()=>{
  const d=pub('Group delivery','targeted');const g=sql(`INSERT INTO public.groups(name) VALUES('DeliveryGroup') RETURNING id`).split('\n')[0]
  sql(`INSERT INTO public.group_memberships(group_id,user_id) VALUES('${g}','${emp}'); INSERT INTO public.content_groups VALUES('${d}','${g}')`)
  expect(as('authenticated',emp,`SELECT count(*) FROM public.document_usage_totals(ARRAY['${d}']::uuid[])`)).toBe('1')
  sql(`DELETE FROM public.group_memberships WHERE group_id='${g}'`)
  expect(as('authenticated',emp,`SELECT count(*) FROM public.document_usage_totals(ARRAY['${d}']::uuid[])`)).toBe('0')
 })
 it('counts one request per retry and separates detail views from downloads',()=>{
  const d=pub('Idempotent','everyone');const f=sql(`SELECT id FROM public.document_formats WHERE content_id='${d}' LIMIT 1`)
  const q=`SELECT public.record_document_usage('${d}','${f}',NULL,'download_request',repeat('b',64))`
  expect(as('service_role',null,q)).toBe('t');expect(as('service_role',null,q)).toBe('f')
  as('service_role',null,`SELECT public.record_document_usage('${d}',NULL,NULL,'view',repeat('c',64))`)
  expect(as('anon',null,`SELECT views||':'||download_requests||':'||(format_downloads->>'pdf') FROM public.document_usage_totals(ARRAY['${d}']::uuid[])`)).toBe('1:1:1')
 })
 it('deduplicates concurrent accepted usage requests at the database',async()=>{
  const d=pub('Concurrent usage','everyone');const f=sql(`SELECT id FROM public.document_formats WHERE content_id='${d}' LIMIT 1`)
  const q=`BEGIN; SET LOCAL ROLE service_role; SELECT public.record_document_usage('${d}','${f}',NULL,'download_request',repeat('d',64)); SELECT pg_sleep(0.3); COMMIT`
  expect((await Promise.all([parallel(q),parallel(q)])).every(Boolean)).toBe(true)
  expect(sql(`SELECT count(*) FROM public.document_events WHERE content_id='${d}'`)).toBe('1')
 })
 it('rejects mismatched format associations, draft events, and browser event writes',()=>{
  const a=pub('AssocA','everyone'), b=pub('AssocB','everyone');const f=sql(`SELECT id FROM public.document_formats WHERE content_id='${b}' LIMIT 1`)
  expect(()=>as('service_role',null,`SELECT public.record_document_usage('${a}','${f}',NULL,'download_request',repeat('e',64))`)).toThrow()
  const draft=newDoc(admin)
  expect(()=>as('service_role',null,`SELECT public.record_document_usage('${draft}',NULL,NULL,'view',repeat('e',64))`)).toThrow()
  for(const role of ['anon','authenticated'])expect(()=>as(role,role==='authenticated'?admin:null,`SELECT public.record_document_usage('${a}',NULL,NULL,'view',repeat('e',64))`)).toThrow()
 })
 it('hides usage totals of drafts and archives even from staff',()=>{
  const d=pub('Hidden usage','everyone');as('authenticated',admin,`SELECT public.set_document_status('${d}','archived')`)
  expect(as('authenticated',admin,`SELECT count(*) FROM public.document_usage_totals(ARRAY['${d}']::uuid[])`)).toBe('0')
 })
 // Restricted trial: isolated fixtures; never starts the production window.
 const trialA='3fb9c14e-521a-4acc-979a-a87ae62457cd', trialB='85801bbd-ec21-460b-979d-169c2e9fbc07'
 const trialDocs=['50afa961-b024-4ab7-bbdd-ebcd11f2b49a','4b34d420-8099-4972-a2b4-1174dab6e361','cfd899dd-005e-4887-86f3-32e7376623e8']
 const trialFormats=['d47c691f-dc89-42cc-9844-879c1c017b63','e39d0c09-a9c0-43c7-9342-9de03848d674','e0fa9bbf-0311-4fd1-87c0-377d5cfbe005']
 const trialGroup='f1d50e06-4224-4014-8b85-a72d64189379'
 function trialFixture(active=true){
  sql(`INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) SELECT x::uuid,'trial@invalid.test',now(),'{"full_name":"Test User","organization":"Test Org","job_title":"Test Job","mobile":"0501234567"}' FROM unnest(ARRAY['${trialA}','${trialB}']) x ON CONFLICT DO NOTHING;
   DELETE FROM public.employee_access WHERE user_id IN ('${trialA}','${trialB}'); DELETE FROM public.group_memberships WHERE user_id IN ('${trialA}','${trialB}');
   INSERT INTO public.groups(id,name) VALUES('${trialGroup}','Trial group') ON CONFLICT DO NOTHING;
   ALTER TABLE private.document_access_trial DISABLE TRIGGER document_trial_window_audit;
   UPDATE private.document_access_trial SET started_at=NULL,ends_at=NULL,stopped_at=NULL;
   ALTER TABLE private.document_access_trial ENABLE TRIGGER document_trial_window_audit; DELETE FROM private.document_trial_documents;`)
  for(let i=0;i<3;i++){
   const d=trialDocs[i],f=trialFormats[i],aud=['registered','employees','targeted'][i]
   if(!d||!f||!aud)throw new Error('Missing trial fixture')
   sql(`INSERT INTO public.content_items(id,title,kind,audience,document_type_id) VALUES('${d}','Trial ${i}','documents','${aud}',(SELECT id FROM public.document_types LIMIT 1));
    INSERT INTO public.content_topics(content_id,topic_id) SELECT '${d}',id FROM public.knowledge_topics ORDER BY sort_order LIMIT 1;
    INSERT INTO public.document_formats(id,content_id,format,drive_file_id,verify_status,verified_at,verified_mime) VALUES('${f}','${d}','pdf','abcdefghijklmnop','ok',now(),'application/pdf');
    INSERT INTO private.document_trial_documents(content_id,format_id,drive_file_id,audience,group_id) VALUES('${d}','${f}','abcdefghijklmnop','${aud}',${i===2?`'${trialGroup}'`:'NULL'});`)
  }
  sql(`INSERT INTO public.content_groups VALUES('${trialDocs[2]}','${trialGroup}',now(),now())`)
  if(active){sql("UPDATE private.document_access_trial SET started_at=statement_timestamp(),ends_at=statement_timestamp()+interval '2 hours'");for(const d of trialDocs)as('authenticated',admin,`SELECT public.set_document_status('${d}','published')`)}
 }
 const trialVisible=(id:string|null)=>as(id?'authenticated':'anon',id,`SELECT count(*) FROM public.content_items WHERE id IN (${trialDocs.map(d=>`'${d}'`).join(',')})`)
 it('trial defaults to inactive and cannot publish before explicit start',()=>{trialFixture(false);expect(sql('SELECT started_at IS NULL AND ends_at IS NULL FROM private.document_access_trial')).toBe('t');expect(trialVisible(trialA)).toBe('0');for(const d of trialDocs)expect(()=>as('authenticated',admin,`SELECT public.set_document_status('${d}','published')`)).toThrow()})
 it.each(['anon','authenticated','service_role'])('trial state is unwritable by %s',(role)=>{expect(()=>as(role,role==='authenticated'?admin:null,'UPDATE private.document_access_trial SET started_at=now(),ends_at=now()+interval \'2 hours\'')).toThrow()})
 it('trial window is exactly two hours and cannot extend or restart',()=>{trialFixture();expect(sql('SELECT extract(epoch FROM ends_at-started_at) FROM private.document_access_trial')).toBe('7200.000000');expect(()=>sql("UPDATE private.document_access_trial SET ends_at=ends_at+interval '1 second'")).toThrow();expect(()=>sql("UPDATE private.document_access_trial SET started_at=NULL,ends_at=NULL")).toThrow()})
 it('trial starts with one result for each ordinary tester and none for visitor or unrelated user',()=>{trialFixture();expect(trialVisible(trialA)).toBe('1');expect(trialVisible(trialB)).toBe('1');expect(trialVisible(null)).toBe('0');expect(trialVisible(user)).toBe('0')})
 it('trial employee and group grants preserve mutual denials then fresh revocation',()=>{trialFixture();sql(`INSERT INTO public.employee_access VALUES('${trialA}',now(),now()); INSERT INTO public.group_memberships(group_id,user_id) VALUES('${trialGroup}','${trialB}')`);expect(trialVisible(trialA)).toBe('2');expect(trialVisible(trialB)).toBe('2');expect(as('authenticated',trialA,`SELECT count(*) FROM public.content_items WHERE id='${trialDocs[2]}'`)).toBe('0');expect(as('authenticated',trialB,`SELECT count(*) FROM public.content_items WHERE id='${trialDocs[1]}'`)).toBe('0');sql(`DELETE FROM public.employee_access WHERE user_id='${trialA}'; DELETE FROM public.group_memberships WHERE group_id='${trialGroup}' AND user_id='${trialB}'`);expect(trialVisible(trialA)).toBe('1');expect(trialVisible(trialB)).toBe('1')})
 it('trial search, related, counts and format summaries hide denied documents',()=>{trialFixture();expect(as('authenticated',trialA,"SELECT total FROM public.search_library(q=>'Trial')")).toBe('1');expect(as('anon',null,"SELECT count(*) FROM public.search_library(q=>'Trial')")).toBe('0');expect(as('authenticated',trialA,`SELECT count(*) FROM public.related_documents('${trialDocs[0]}')`)).toBe('0');expect(as('authenticated',trialA,`SELECT public.document_format_kinds('${trialDocs[1]}')::text`)).toBe('{}');expect(as('authenticated',trialA,'SELECT sum(documents) FROM public.topic_document_counts()')).toBe('1');expect(as('authenticated',trialA,`SELECT count(*) FROM public.document_usage_totals(ARRAY['${trialDocs[1]}']::uuid[])`)).toBe('0')})
 it('trial does not allow other restricted documents even sharing the same file',()=>{trialFixture();const d=newDoc(admin,'registered');expect(()=>as('authenticated',admin,`SELECT public.set_document_status('${d}','published')`)).toThrow();expect(sql('SELECT private.secure_delivery_ready()')).toBe('f')})
 it('trial denies changed Drive mappings even with a new successful verification',()=>{trialFixture();sql(`UPDATE public.document_formats SET drive_file_id='qrstuvwxyz123456',verify_status='ok',verified_at=clock_timestamp() WHERE id='${trialFormats[0]}'`);expect(trialVisible(trialA)).toBe('0')})
 it('trial denies extra formats or legacy file associations',()=>{trialFixture();sql(`INSERT INTO public.document_formats(content_id,format,drive_file_id) VALUES('${trialDocs[0]}','word','qrstuvwxyz123456')`);expect(trialVisible(trialA)).toBe('0');sql(`DELETE FROM public.document_formats WHERE content_id='${trialDocs[0]}' AND format='word'; INSERT INTO public.content_files(content_id,object_path,file_name) VALUES('${trialDocs[0]}','trial-extra','extra')`);expect(trialVisible(trialA)).toBe('0')})
 it('trial denies broadened audience and unexpected category or group links',()=>{trialFixture();sql(`INSERT INTO public.categories(id,name) VALUES('40000000-0000-4000-8000-000000000003','Trial-extra') ON CONFLICT DO NOTHING; INSERT INTO public.content_categories VALUES('${trialDocs[0]}','40000000-0000-4000-8000-000000000003',now(),now())`);expect(trialVisible(trialA)).toBe('0');sql(`DELETE FROM public.content_categories WHERE content_id='${trialDocs[0]}'; UPDATE public.content_items SET audience='everyone' WHERE id='${trialDocs[0]}'`);expect(trialVisible(null)).toBe('0');expect(trialVisible(trialA)).toBe('0')})
 it('trial stops immediately and cannot be reopened',()=>{trialFixture();sql('UPDATE private.document_access_trial SET stopped_at=clock_timestamp()');expect(trialVisible(trialA)).toBe('0');expect(()=>sql('UPDATE private.document_access_trial SET stopped_at=NULL')).toThrow();expect(sql("SELECT action FROM private.document_trial_audit ORDER BY id DESC LIMIT 1")).toBe('stop')})
 it('trial expiry denies fresh reads even inside a previously opened transaction',()=>{trialFixture();sql(`ALTER TABLE private.document_access_trial DISABLE TRIGGER document_trial_window_audit; UPDATE private.document_access_trial SET started_at=statement_timestamp()-interval '2 hours'+interval '0.3 seconds',ends_at=statement_timestamp()+interval '0.3 seconds'; ALTER TABLE private.document_access_trial ENABLE TRIGGER document_trial_window_audit`);const result=sql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${trialA}',true); SELECT pg_sleep(0.4); SELECT count(*) FROM public.content_items WHERE id='${trialDocs[0]}'; COMMIT`);expect(result.split('\n')).toContain('0')})
})

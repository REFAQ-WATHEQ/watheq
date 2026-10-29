import {beforeAll, beforeEach, afterAll, describe, expect, it} from 'vitest'
import {execFileSync, spawn} from 'node:child_process'
import {readFileSync, readdirSync} from 'node:fs'
import {createHmac} from 'node:crypto'

// Never reads production environment variables. Requires the disposable local PostgreSQL runner.
const enabled = process.env['WATHIQ_LOCAL_DB_TESTS'] === '1'
const suite = enabled ? describe : describe.skip
const db = 'wathiq_bootstrap_tests'
const port = '55439'
const a='10000000-0000-4000-8000-000000000001'
const b='10000000-0000-4000-8000-000000000002'
const u='10000000-0000-4000-8000-000000000003'
const m='10000000-0000-4000-8000-000000000004'
const key='local-disposable-test-only-signing-key-not-production'
function sql(query:string){return execFileSync('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-At','-c',query],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
function as(role:string,id:string,query:string){return sql(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('request.jwt.claim.sub','${id}',true); ${query}; COMMIT;`)}
function boot(id=a){return sql(`SELECT private.bootstrap_first_platform_admin('${id}')`)}
function change(actor:string,target:string,role='admin'){return as('authenticated',actor,`SELECT public.set_account_role('${target}','${role}')`)}
function count(){return Number(sql("SELECT count(*) FROM public.user_roles WHERE role='admin'"))}
function token(id:string,role='authenticated'){
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')
 const body=Buffer.from(JSON.stringify({role,sub:id,exp:Math.floor(Date.now()/1000)+600})).toString('base64url')
 return `${header}.${body}.${createHmac('sha256',key).update(`${header}.${body}`).digest('base64url')}`
}
function parallel(query:string){return new Promise<boolean>(resolve=>{const child=spawn('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-c',query],{stdio:'ignore'});child.on('exit',code=>resolve(code===0))})}

suite('First administrator: actual PostgreSQL grants, triggers and RPC',()=>{
 let api:ReturnType<typeof spawn>|undefined
 beforeAll(async()=>{
  execFileSync('psql',['-X','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`DROP DATABASE IF EXISTS ${db}`])
  execFileSync('createdb',['-h','127.0.0.1','-p',port,'-U','postgres',db])
  sql(readFileSync('src/test/fixtures/supabase-role-environment.sql','utf8'))
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())sql(readFileSync(`supabase/migrations/${file}`,'utf8'))
  api=spawn('nix',['run','nixpkgs#postgrest','--'],{env:{...process.env,PGRST_DB_URI:`postgresql://authenticator@127.0.0.1:${port}/${db}`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_SERVER_PORT:'55440',PGRST_JWT_SECRET:key},stdio:'ignore'})
  let ready=false
  for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:55440/');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  expect(ready).toBe(true)
 },30000)
 beforeEach(()=>{
  // Owner resets disposable fixtures only; no production rows or roles are touched.
  sql(`TRUNCATE public.user_roles,public.role_audit_log,public.profiles,auth.users CASCADE;
   UPDATE private.platform_admin_bootstrap SET consumed=false,target_user=NULL,bootstrap_xid=NULL,initialized_by=NULL;
   INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) SELECT x::uuid,'fixture@invalid.test',now(),'{"full_name":"Test User","organization":"Test Org","job_title":"Test Job","mobile":"0501234567","role":"admin"}'::jsonb FROM unnest(ARRAY['${a}','${b}','${u}','${m}']) x;
   UPDATE public.user_roles SET role='supervisor' WHERE user_id='${m}';`)
 })
 afterAll(()=>api?.kill())
 it('creates ordinary signup roles, then bootstraps only the approved UUID',()=>{expect(count()).toBe(0);boot();expect(sql(`SELECT role FROM public.user_roles WHERE user_id='${a}'`)).toBe('admin');expect(count()).toBe(1);expect(sql('SELECT consumed FROM private.platform_admin_bootstrap')).toBe('t')})
 it.each(['anon','authenticated','service_role'])('rejects bootstrap and state changes by %s',(role)=>{expect(()=>as(role,u,`SELECT private.bootstrap_first_platform_admin('${u}')`)).toThrow();expect(()=>as(role,u,'UPDATE private.platform_admin_bootstrap SET consumed=false')).toThrow();expect(count()).toBe(0)})
 it.each(['missing','unconfirmed','banned','deleted','no_profile'])('rejects %s target and preserves atomic state',(kind)=>{const target=kind==='missing'?'10000000-0000-4000-8000-000000000099':a;if(kind==='unconfirmed')sql(`UPDATE auth.users SET email_confirmed_at=NULL WHERE id='${a}'`);if(kind==='banned')sql(`UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='${a}'`);if(kind==='deleted')sql(`UPDATE auth.users SET deleted_at=now() WHERE id='${a}'`);if(kind==='no_profile')sql(`DELETE FROM public.profiles WHERE id='${a}'`);expect(()=>boot(target)).toThrow();expect(count()).toBe(0);expect(sql('SELECT consumed FROM private.platform_admin_bootstrap')).toBe('f');expect(sql('SELECT count(*) FROM public.role_audit_log')).toBe('0')})
 it('cannot replay after success, even if an owner later clears roles',()=>{boot();expect(()=>boot(b)).toThrow();sql('TRUNCATE public.user_roles');expect(()=>boot(b)).toThrow();expect(count()).toBe(0)})
 it('rolls back role, consumed state and audit if initialization cannot finish',()=>{sql("CREATE FUNCTION private.test_fail_bootstrap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$; CREATE TRIGGER test_fail_bootstrap AFTER UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION private.test_fail_bootstrap()");try{expect(()=>boot()).toThrow();expect(count()).toBe(0);expect(sql('SELECT consumed FROM private.platform_admin_bootstrap')).toBe('f');expect(sql('SELECT count(*) FROM public.role_audit_log')).toBe('0')}finally{sql('DROP TRIGGER test_fail_bootstrap ON public.user_roles; DROP FUNCTION private.test_fail_bootstrap()')}})
 it('rejects initialization when any administrator already exists',()=>{sql(`UPDATE public.user_roles SET role='admin' WHERE user_id='${a}'`);expect(()=>boot(b)).toThrow();expect(count()).toBe(1)})
 it('serializes concurrent bootstrap attempts to exactly one success',async()=>{const results=await Promise.all([parallel(`SELECT private.bootstrap_first_platform_admin('${a}')`),parallel(`SELECT private.bootstrap_first_platform_admin('${b}')`)]);expect(results.filter(Boolean)).toHaveLength(1);expect(count()).toBe(1);expect(sql("SELECT count(*) FROM public.role_audit_log WHERE actor_source='first_admin_bootstrap'")).toBe('1')})
 it('lets initialized admin add and revoke a second administrator',()=>{boot();change(a,b);expect(count()).toBe(2);change(a,b,'user');expect(count()).toBe(1);expect(sql(`SELECT role FROM public.user_roles WHERE user_id='${b}'`)).toBe('user')})
 it.each([u,m])('rejects direct role RPC promotion by a nonadmin %s',(actor)=>{boot();expect(()=>change(actor,actor)).toThrow();expect(()=>change(actor,b)).toThrow();expect(count()).toBe(1)})
 it('rejects self-demotion and owner deletion of the last active role/account',()=>{boot();expect(()=>change(a,a,'user')).toThrow();expect(()=>sql(`DELETE FROM public.user_roles WHERE user_id='${a}'`)).toThrow();expect(()=>sql(`DELETE FROM auth.users WHERE id='${a}'`)).toThrow();expect(count()).toBe(1)})
 it('serializes concurrent cross-revocation without losing all admins',async()=>{boot();change(a,b);const results=await Promise.all([parallel(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',true); SELECT public.set_account_role('${b}','user'); COMMIT;`),parallel(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${b}',true); SELECT public.set_account_role('${a}','user'); COMMIT;`)]);expect(results.filter(Boolean)).toHaveLength(1);expect(count()).toBe(1)})
 it.each(['anon','authenticated','service_role'])('denies direct writes, truncate and audit edits for %s',(role)=>{boot();for(const query of [`UPDATE public.user_roles SET role='admin' WHERE user_id='${u}'`,'TRUNCATE public.user_roles','TRUNCATE public.role_audit_log','DELETE FROM public.role_audit_log'])expect(()=>as(role,u,query)).toThrow();expect(count()).toBe(1);expect(sql(`SELECT has_table_privilege('${role}','public.user_roles','TRIGGER')`)).toBe('f')})
 it('prevents transferring ownership of an existing admin role row',()=>{boot();expect(()=>sql(`UPDATE public.user_roles SET user_id='${b}' WHERE user_id='${a}'`)).toThrow();expect(count()).toBe(1)})
 it('records correct bootstrap and subsequent actors with no failed-event audit',()=>{boot();change(a,b);change(a,b,'supervisor');expect(()=>change(u,u)).toThrow();const records=JSON.parse(sql('SELECT json_agg(x) FROM (SELECT actor_id,target_user,old_role,new_role,actor_source,database_executor FROM public.role_audit_log ORDER BY created_at) x'));expect(records).toEqual([{actor_id:null,target_user:a,old_role:'user',new_role:'admin',actor_source:'first_admin_bootstrap',database_executor:'postgres'},{actor_id:a,target_user:b,old_role:'user',new_role:'admin',actor_source:'authenticated_admin',database_executor:null},{actor_id:a,target_user:b,old_role:'admin',new_role:'supervisor',actor_source:'authenticated_admin',database_executor:null}]);expect(as('authenticated',u,'SELECT count(*) FROM public.role_audit_log')).toContain('\n0\n');expect(as('authenticated',a,'SELECT count(*) FROM public.role_audit_log')).toContain('\n3\n')})
 it('enforces actual HTTP RPC permissions and reads the resulting roles back',async()=>{boot();async function rpc(actor?:string,role='authenticated'){return fetch('http://127.0.0.1:55440/rpc/set_account_role',{method:'POST',headers:{'Content-Type':'application/json',...(actor?{Authorization:`Bearer ${token(actor,role)}`}:{})},body:JSON.stringify({target_user:b,new_role:'admin'})})}for(const actor of [undefined,u,m])expect((await rpc(actor)).ok).toBe(false);expect((await rpc(u,'service_role')).ok).toBe(false);expect(count()).toBe(1);expect((await rpc(a)).ok).toBe(true);const response=await fetch(`http://127.0.0.1:55440/user_roles?user_id=eq.${b}&select=role`,{headers:{Authorization:`Bearer ${token(a)}`}});expect(await response.json()).toEqual([{role:'admin'}]);const bootstrap=await fetch('http://127.0.0.1:55440/rpc/bootstrap_first_platform_admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token(u)}`},body:JSON.stringify({target_account:u})});expect(bootstrap.ok).toBe(false);expect(count()).toBe(2)})
})

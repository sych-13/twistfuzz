import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, decodeJwt } from 'jose';
import { createClient } from '@supabase/supabase-js';
import { defaultDesign, flowerPalette, wrappers, ribbons } from '../src/features/studio/design.ts';
import { parseDesignCommand, parseDesignResult } from '../src/features/studio/savedDesigns.ts';
import { createSavedDesignHandler } from '../supabase/functions/saved-designs/handler.ts';
import { executeDesignCommand } from '../supabase/functions/saved-designs/store.ts';
import { createSavedDesignDependencies } from '../supabase/functions/saved-designs/runtime.ts';
import { asRole, fixtureClaims, fixtureProject, localDatabase } from './helpers/database.mjs';

const pair = await generateKeyPair('RS256', { extractable: true });
const getKey = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'design-fixture', alg: 'RS256' }] });
const columns = 'id,name,configuration,revision,created_at,updated_at';
let database;
before(async () => {
  database = (await localDatabase()).database;
  await database.query('update app_private.auth_configuration set firebase_project_id=$1,integration_enabled=true', [fixtureProject]);
  for (const [uid, role, active] of [['customer-a','customer',true],['customer-b','customer',true],['staff','staff',true],['inactive','customer',false]]) {
    await database.query('insert into profiles(firebase_uid,email,role,is_active) values($1,$2,$3,$4)', [uid, `${uid}@example.invalid`, role, active]);
  }
});
after(async () => database?.close());
async function token(uid='customer-a', changes={}) {
  return new SignJWT({ ...fixtureClaims(uid), email: `${uid}@example.invalid`, ...changes }).setProtectedHeader({alg:'RS256',kid:'design-fixture'}).sign(pair.privateKey);
}
function dependencies(overrides={}) {
  return { auth: { projectId:fixtureProject, getKey,
    consumeRateLimit: async () => ({ allowed: true, retry_after_seconds: 0 }),
    getAccount:async uid=>({uid,email:`${uid}@example.invalid`,emailVerified:true,disabled:false,validAfter:0}),
    getTrustedRole:async uid=>(await database.query('select role from profiles where firebase_uid=$1 and is_active',[uid])).rows[0]?.role,
    auditPrivilegedAccess:async()=>{}, ...overrides },
    execute:async(uid, bearer, command)=>asRole(database,'authenticated',decodeJwt(bearer),async db=>{
      // Test-only gateway/SQL transport. The HTTP SDK adapter is checked separately.
      if(command.action==='list') {
        const rows=(await db.query(`select ${columns} from custom_designs where owner_uid=$1 order by created_at desc,id desc limit 26 offset $2`,[uid,command.offset])).rows;
        return {designs:JSON.parse(JSON.stringify(rows.slice(0,25))),hasMore:rows.length>25};
      }
      let rows;
      if(command.action==='create') rows=(await db.query(`insert into custom_designs(owner_uid,name,configuration) values($1,$2,$3) returning ${columns}`,[uid,command.name,command.configuration])).rows;
      if(command.action==='get') rows=(await db.query(`select ${columns} from custom_designs where owner_uid=$1 and id=$2`,[uid,command.id])).rows;
      if(command.action==='update') rows=(await db.query(`update custom_designs set name=$4,configuration=$5 where owner_uid=$1 and id=$2 and revision=$3 returning ${columns}`,[uid,command.id,command.revision,command.name,command.configuration])).rows;
      if(command.action==='delete') rows=(await db.query('delete from custom_designs where owner_uid=$1 and id=$2 and revision=$3 returning id',[uid,command.id,command.revision])).rows;
      // Reuse the production adapter's status mapping via a real SDK + local response.
      const client=createClient('https://fixture.supabase.co','sb_publishable_fixture',{global:{fetch:async()=>new Response(JSON.stringify(rows),{headers:{'Content-Type':'application/json'}})}});
      if(command.action==='create') return {design:JSON.parse(JSON.stringify(rows[0]))};
      return executeDesignCommand(client,uid,command);
    }) };
}
test('rate-limited saved-design requests cannot execute data operations', async () => {
  let calls = 0;
  const deps = dependencies({ consumeRateLimit: async scope => ({ allowed: scope === 'global', retry_after_seconds: scope === 'global' ? 0 : 20 }) });
  deps.execute = async () => { calls++; throw Error(); };
  const handler = createSavedDesignHandler({ allowedOrigins: [], dependencies: () => deps });
  const response = await handler(new Request('https://edge.example.invalid/saved-designs', { method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }, body: '{"action":"list"}' }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '20');
  assert.equal(calls, 0);
});

async function request(body, uid='customer-a', options={}) {
  const handler=createSavedDesignHandler({allowedOrigins:['http://127.0.0.1:5173'],dependencies:()=>options.dependencies??dependencies()});
  return handler(new Request('https://edge.example.invalid/saved-designs',{method:options.method??'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${options.bearer??await token(uid)}`,Origin:options.origin??'http://127.0.0.1:5173'},body:options.method==='OPTIONS'?undefined:JSON.stringify(body)}));
}
const create=()=>({action:'create',name:'My bouquet',configuration:defaultDesign()});

test('saved command canonicalization accepts all 390 approved combinations and normalizes duplicates',()=>{
  let count=0;
  for(const [kind,colors] of Object.entries(flowerPalette))for(const color of Object.values(colors))for(const wrapper of wrappers)for(const ribbon of ribbons){
    const command=parseDesignCommand({action:'create',name:'  Garden  ',configuration:{flowers:[{kind,color,count:1},{kind,color,count:2}],wrapper,ribbon,messageCard:false}});
    assert.equal(command.name,'Garden');assert.equal(command.configuration.flowers[0].count,3);count++;
  }
  assert.equal(count,390);
});
test('request contract rejects ownership, roles, prices and forged metadata at every level',()=>{
  for(const field of ['owner_uid','uid','role','price','created_at','id','revision'])assert.throws(()=>parseDesignCommand({...create(),[field]:'forged'}));
  assert.throws(()=>parseDesignCommand({...create(),configuration:{...defaultDesign(),price:1}}));
  assert.throws(()=>parseDesignCommand({...create(),configuration:{...defaultDesign(),flowers:[{kind:'Rose',color:'#467cc4',count:1,role:'admin'}]}}));
});
test('names, identifiers, pagination and expected revisions are bounded and typed',()=>{
  for(const name of ['', ' ', 'x'.repeat(81),'name\nsecret',null])assert.throws(()=>parseDesignCommand({...create(),name}));
  for(const offset of [-1,10001,0.5,'25',null])assert.throws(()=>parseDesignCommand({action:'list',offset}));
  for(const revision of [0,-1,1.5,2147483648,'1',undefined])assert.throws(()=>parseDesignCommand({action:'delete',id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',revision}));
  assert.throws(()=>parseDesignCommand({action:'get',id:'or(owner_uid.eq.other)'}));
  assert.deepEqual(parseDesignCommand({action:'list'}),{action:'list',offset:0});
});
test('unsupported and over-limit bouquets cannot reach a write',async()=>{
  for(const configuration of [{...defaultDesign(),flowers:[{kind:'Rose',color:'#467cc4',count:31}]},{...defaultDesign(),ribbon:'unknown'}])assert.equal((await request({...create(),configuration})).status,400);
});
test('verified Customer creates and reopens a real SQL record without exposing owner metadata',async()=>{
  const created=await request(create());assert.equal(created.status,200);const {design}=await created.json();
  assert.equal(design.revision,1);assert.equal(design.owner_uid,undefined);
  const opened=await request({action:'get',id:design.id});assert.equal(opened.status,200);assert.equal((await opened.json()).design.id,design.id);
});
test('two Customers cannot read, update or delete each other’s designs',async()=>{
  const {design}=await (await request(create())).json();
  assert.equal((await request({action:'get',id:design.id},'customer-b')).status,404);
  for(const action of ['update','delete']){
    const command=action==='update'?{...create(),action,id:design.id,revision:1}:{action,id:design.id,revision:1};
    assert.equal((await request(command,'customer-b')).status,409);
  }
  const list=await(await request({action:'list'},'customer-b')).json();assert.equal(list.designs.length,0);
});
test('updates increment revisions; stale update/delete preserve the newer record',async()=>{
  const {design}=await(await request(create())).json();
  const updated=await request({...create(),action:'update',id:design.id,revision:1,name:'New name'});
  assert.equal(updated.status,200);assert.equal((await updated.json()).design.revision,2);
  assert.equal((await request({...create(),action:'update',id:design.id,revision:1})).status,409);
  assert.equal((await request({action:'delete',id:design.id,revision:1})).status,409);
  assert.equal((await request({action:'delete',id:design.id,revision:2})).status,200);
  assert.equal((await request({action:'get',id:design.id})).status,404);
});
test('current inactive, Staff and unprovisioned accounts cannot use Customer design endpoints',async()=>{
  for(const uid of ['inactive','staff','missing'])assert.equal((await request(create(),uid)).status,403);
});
test('expired/wrong-project tokens and disabled/revoked current accounts cannot access records',async()=>{
  for(const claims of [{aud:'another-project'},{exp:1}])assert.equal((await request({action:'list'},'customer-a',{bearer:await token('customer-a',claims)})).status,401);
  assert.equal((await request({action:'list'},'customer-a',{dependencies:dependencies({getAccount:async()=>null})})).status,401);
  assert.equal((await request({action:'list'},'customer-a',{dependencies:dependencies({getAccount:async uid=>({uid,email:`${uid}@example.invalid`,disabled:false,emailVerified:true,validAfter:Math.floor(Date.now()/1000)})})})).status,401);
});
test('bounds, exact CORS, error redaction and disabled runtime remain enforced',async()=>{
  assert.equal((await request({...create(),name:'x'.repeat(16001)})).status,413);
  assert.equal((await request({action:'list'},'customer-a',{origin:'https://untrusted.example.invalid'})).status,403);
  const deps=dependencies();deps.execute=async()=>{throw Error('PRIVATE database details');};
  const response=await request({action:'list'},'customer-a',{dependencies:deps});assert.equal(response.status,503);assert.ok(!(await response.text()).includes('PRIVATE'));
  assert.throws(()=>createSavedDesignDependencies({get:()=>undefined})(),/pending/);
});
test('production SDK adapter filters every lookup/mutation by owner and mutations by revision',async()=>{
  const seen=[];const uuid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const row={id:uuid,name:'Garden',configuration:defaultDesign(),revision:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const client=createClient('https://fixture.supabase.co','sb_publishable_fixture',{accessToken:async()=> 'fixture-user-token',global:{fetch:async(url,init)=>{
    seen.push({url:new URL(url),init,body:init.body?JSON.parse(init.body):null});
    return new Response(JSON.stringify(init.method==='POST'?row:[row]),{headers:{'Content-Type':'application/json'}});
  }}});
  for(const command of [{action:'list',offset:25},{action:'get',id:uuid},{...create()},{...create(),action:'update',id:uuid,revision:3},{action:'delete',id:uuid,revision:3}])await executeDesignCommand(client,'customer-a',command);
  for(const [i,req] of seen.entries()){
    assert.equal(new Headers(req.init.headers).get('Authorization'),'Bearer fixture-user-token');
    if(i!==2)assert.equal(req.url.searchParams.get('owner_uid'),'eq.customer-a');
    if(i>2)assert.equal(req.url.searchParams.get('revision'),'eq.3');
  }
  assert.equal(seen[0].url.searchParams.get('offset'),'25');assert.equal(seen[0].url.searchParams.get('limit'),'26');
  assert.equal(seen[2].body.owner_uid,'customer-a');assert.deepEqual(Object.keys(seen[3].body).sort(),['configuration','name']);
});
test('response validation rejects wrong IDs, malformed bouquets and oversized pages',()=>{
  assert.throws(()=>parseDesignResult({designs:Array(26).fill({}),hasMore:true},{action:'list',offset:0}));
  assert.throws(()=>parseDesignResult({deleted:false},{action:'delete'}));
  assert.throws(()=>parseDesignResult({design:{id:'wrong'}},{action:'get',id:'expected'}));
});

test('bounded pagination returns only the current Customer with deterministic pages',async()=>{
  await asRole(database,'authenticated',fixtureClaims('customer-b'),async db=>{
    for(let index=0;index<27;index++)await db.query('insert into custom_designs(owner_uid,name,configuration) values($1,$2,$3)',['customer-b',`Page ${index}`,defaultDesign()]);
  });
  const first=await(await request({action:'list',offset:0},'customer-b')).json();
  const second=await(await request({action:'list',offset:25},'customer-b')).json();
  assert.equal(first.designs.length,25);assert.equal(first.hasMore,true);
  assert.equal(second.designs.length,2);assert.equal(second.hasMore,false);
  assert.equal(new Set([...first.designs,...second.designs].map(row=>row.id)).size,27);
});
test('SDK database errors never become successful writes or disclose server details',async()=>{
  const failed=createClient('https://fixture.supabase.co','sb_publishable_fixture',{global:{fetch:async()=>new Response(JSON.stringify({message:'PRIVATE database error'}),{status:500,headers:{'Content-Type':'application/json'}})}});
  await assert.rejects(executeDesignCommand(failed,'customer-a',create()),error=>error.status===503&&!error.message.includes('PRIVATE'));
  const empty=createClient('https://fixture.supabase.co','sb_publishable_fixture',{global:{fetch:async()=>new Response('[]',{headers:{'Content-Type':'application/json'}})}});
  await assert.rejects(executeDesignCommand(empty,'customer-a',{action:'delete',id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',revision:1}),error=>error.status===409);
});

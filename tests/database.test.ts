import { readFileSync, readdirSync } from 'node:fs';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const member = '11111111-1111-4111-8111-111111111111';
const admin = '22222222-2222-4222-8222-222222222222';
let db: PGlite;
async function asMember(sql: string, id = member) {
  return db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}'; ${sql}`);
}
async function owner(sql: string) { return db.exec(`reset role; ${sql}`); }

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  // Minimal Supabase platform scaffolding; all application schema/RLS/functions come from real migrations.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant all on storage.objects to authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(`supabase/migrations/${f}`, 'utf8');
    await db.exec(sql);
  }
  await db.exec(`insert into private.admin_emails values ('admin@test.invalid');
    insert into auth.users(id,email) values ('${member}','member@test.invalid'), ('${admin}','admin@test.invalid');`);
}, 30_000);
afterAll(async () => { await db?.close(); });

describe('review security migration', () => {
  it('denies browser access to both old and privileged Strava token functions', async () => {
    for (const query of [
      "select * from connection_tokens('strava')",
      `select * from connection_tokens_for_user('${member}', 'strava')`,
      "select connection_save('strava','1',null,'a','r',now(),null)",
    ]) await expect(asMember(query)).rejects.toThrow(/permission denied/);
    await owner(`set role service_role; select connection_save_for_user('${member}','strava','1',null,'test-access','test-refresh',now() + interval '1 hour',null)`);
    const result = await owner(`set role service_role; select access_token from connection_tokens_for_user('${member}','strava')`);
    expect(result.at(-1)?.rows).toEqual([{ access_token: 'test-access' }]);
  });
  it('counts reservations before completion and refuses requests beyond the quota', async () => {
    await owner("update app_settings set value = value || '{\"daily_quota\": 2}' where key = 'ai'");
    await asMember('select 1');
    const results = await Promise.all(Array.from({ length: 8 }, () => db.query<{ id: number | null }>("select reserve_ai_call('ask') as id")));
    const ids = results.map(r => r.rows[0].id).filter(id => id !== null);
    expect(ids).toHaveLength(2);
    await asMember(`select finish_ai_call(${ids[0]}, true)`);
    expect((await asMember("select ai_calls_today() as used")).at(-1)?.rows).toEqual([{ used: 2 }]);
    await expect(asMember("insert into ai_usage(feature) values ('ask')")).rejects.toThrow(/permission denied/);
    await expect(asMember('delete from ai_usage')).rejects.toThrow(/permission denied/);
  });
  it('blocks new signups and old unfinished profiles while signups are closed', async () => {
    await owner("update app_settings set value = '{\"signups_open\":false}' where key = 'features'");
    await expect(owner("insert into auth.users(id,email) values ('33333333-3333-4333-8333-333333333333','new@test.invalid')")).rejects.toThrow(/sign-ups are paused/);
    await owner(`update profiles set created_at = now() - interval '1 day' where id = '${member}'`);
    await expect(asMember(`update profiles set onboarded_at = now() where id = '${member}'`)).rejects.toThrow(/sign-ups are paused/);
    await owner("update app_settings set value = '{\"signups_open\":true}' where key = 'features'");
    await asMember(`update profiles set onboarded_at = now() where id = '${member}'`);
  });
  it('blocks existing sessions at the database while preserving admin restoration', async () => {
    await asMember("insert into days(user_id,day,water_ml) values (auth.uid(),current_date,250)");
    await asMember(`select admin_set_disabled('${member}', true)`, admin);
    expect((await asMember('select * from days')).at(-1)?.rows).toEqual([]);
    await expect(asMember("insert into days(user_id,day) values (auth.uid(),current_date + 1)")).rejects.toThrow(/row-level security/);
    await expect(asMember("select reserve_ai_call('ask')")).rejects.toThrow(/not active/);
    await asMember(`select admin_set_disabled('${member}', false)`, admin);
    expect((await asMember('select water_ml from days')).at(-1)?.rows).toEqual([{ water_ml: 250 }]);
  });
  it('rolls back the entire restore on a failed insert and permits deletion with the feature off', async () => {
    await asMember(`insert into week_plans(user_id,weekday,plan) values (auth.uid(),1,'{}')`);
    await expect(asMember(`select restore_week_plans('[{"weekday":1,"plan":{}},{"weekday":8,"plan":{}}]')`)).rejects.toThrow();
    expect((await asMember('select weekday from week_plans')).at(-1)?.rows).toEqual([{ weekday: 1 }]);
    await owner(`insert into app_settings(key,value) values ('flags','{"week":{"on":false}}') on conflict(key) do update set value = excluded.value`);
    await expect(asMember(`select restore_week_plans('[{"weekday":2,"plan":{}}]')`)).rejects.toThrow(/disabled/);
    expect((await asMember('select weekday from week_plans')).at(-1)?.rows).toEqual([{ weekday: 1 }]);
    await asMember("select restore_week_plans('[]')");
    expect((await asMember('select weekday from week_plans')).at(-1)?.rows).toEqual([]);
  });
});

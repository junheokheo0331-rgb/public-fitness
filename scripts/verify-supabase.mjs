import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(import.meta.dirname, '..');

function parseEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]));
}

function readAccounts(file) {
  const text = fs.readFileSync(file, 'utf8');
  const tableRows = text.split(/\r?\n/).filter((line) => /@gymlink\.test/i.test(line));
  const fromTable = {};
  for (const line of tableRows) {
    const cells = line.split('|').map((cell) => cell.trim().replace(/^`|`$/g, '')).filter(Boolean);
    const emailIndex = cells.findIndex((cell) => /[\w.+-]+@gymlink\.test/i.test(cell));
    if (emailIndex < 0 || !cells[emailIndex + 1]) continue;
    const email = cells[emailIndex].match(/[\w.+-]+@gymlink\.test/i)?.[0];
    const role = email?.split('.')[0].toLowerCase();
    if (['owner', 'trainer', 'member'].includes(role)) fromTable[role] = { email, password: cells[emailIndex + 1] };
  }
  if (Object.keys(fromTable).length === 3) return fromTable;

  const emails = [...text.matchAll(/[\w.+-]+@gymlink\.test/gi)].map((match) => ({ value: match[0], index: match.index }));
  const passwords = [...text.matchAll(/(?:password|비밀번호)\s*(?:\||:|：)\s*`?([^`|\s]+)`?/gi)].map((match) => ({ value: match[1], index: match.index }));
  const result = {};
  for (const email of emails) {
    const role = email.value.split('.')[0].toLowerCase();
    const password = passwords.find((item) => item.index > email.index && item.index - email.index < 500)
      || passwords.reduce((best, item) => Math.abs(item.index - email.index) < Math.abs((best?.index ?? Infinity) - email.index) ? item : best, null);
    if (['owner', 'trainer', 'member'].includes(role) && password) result[role] = { email: email.value, password: password.value };
  }
  if (Object.keys(result).length !== 3) throw new Error('TEST_ACCOUNTS.local.md에서 테스트 계정 3개를 읽지 못했습니다.');
  return result;
}

const env = parseEnv(path.join(root, '.env.local'));
const accounts = readAccounts(path.join(root, 'TEST_ACCOUNTS.local.md'));
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('.env.local의 Supabase 공개 설정을 확인해주세요.');

const tables = [
  'profiles', 'gyms', 'gym_staff', 'machine_catalog', 'gym_machines', 'gym_photos',
  'trainers', 'trainer_credentials', 'price_plans', 'memberships', 'pt_ledger',
  'routines', 'assignments', 'workout_sessions', 'trainer_availability', 'trainer_time_off',
  'bookings', 'pt_requests', 'pt_applications', 'threads', 'messages', 'notifications',
  'payment_orders', 'access_credentials', 'body_composition', 'consents',
];

const clients = {};
const profiles = {};
let failed = false;

for (const role of ['owner', 'trainer', 'member']) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword(accounts[role]);
  if (signInError) throw new Error(`${role} 로그인 실패: ${signInError.message}`);
  clients[role] = client;
  const { data: profile, error: profileError } = await client.from('profiles').select('id,role,active_gym_id').eq('id', signedIn.user.id).single();
  if (profileError || profile?.role !== role) throw new Error(`${role} 프로필 역할 확인 실패`);
  profiles[role] = profile;

  const errors = [];
  for (const table of tables) {
    const { error } = await client.from(table).select('*', { count: 'exact', head: true });
    if (error) errors.push(`${table}:${error.code || 'error'}`);
  }
  if (errors.length) failed = true;
  console.log(`${role.padEnd(7)} ${errors.length ? `FAIL ${errors.join(', ')}` : `OK ${tables.length} tables`}`);
}

const owner = clients.owner;
const trainer = clients.trainer;
const member = clients.member;
const { data: demoGym, error: gymError } = await owner.from('gyms').select('id').eq('owner_id', profiles.owner.id).single();
if (gymError) throw gymError;

const personaChecks = [
  ['gym-profile', owner.from('gyms').select('name,intro,amenities,rating_count').eq('id', demoGym.id).single(),
    (row) => row.name === '모두의짐 서면점' && row.intro?.length > 80 && row.amenities?.length >= 8 && row.rating_count >= 100],
  ['machines', owner.from('gym_machines').select('*', { count: 'exact', head: true }).eq('gym_id', demoGym.id),
    (_row, count) => count >= 40],
  ['price-plans', member.from('price_plans').select('*', { count: 'exact', head: true }).eq('gym_id', demoGym.id).eq('is_active', true),
    (_row, count) => count >= 7],
  ['trainer-career', member.from('trainer_credentials').select('*', { count: 'exact', head: true }).eq('trainer_id', profiles.trainer.id),
    (_row, count) => count >= 5],
  ['trainer-hours', trainer.from('trainer_availability').select('*', { count: 'exact', head: true }).eq('trainer_id', profiles.trainer.id),
    (_row, count) => count >= 8],
  ['workout-history', member.from('workout_logs').select('*', { count: 'exact', head: true }).eq('member_id', profiles.member.id),
    (_row, count) => count >= 2],
  ['body-history', member.from('body_composition').select('*', { count: 'exact', head: true }).eq('member_id', profiles.member.id),
    (_row, count) => count >= 3],
];
for (const [label, query, validate] of personaChecks) {
  const { data, count, error } = await query;
  const ok = !error && validate(data, count ?? 0);
  console.log(`${label.padEnd(15)} ${ok ? 'OK' : `FAIL ${error?.code || `count=${count ?? 0}`}`}`);
  failed ||= !ok;
}

const { error: activeGymError } = await member.rpc('set_active_gym', { p_gym_id: demoGym.id });
console.log(`active-gym ${activeGymError ? `FAIL ${activeGymError.code}` : 'OK'}`);
failed ||= Boolean(activeGymError);

const { data: booking, error: bookingReadError } = await member.from('bookings').select('id').eq('member_id', profiles.member.id).limit(1).maybeSingle();
let bookingFlowError = bookingReadError;
if (booking && !bookingFlowError) {
  ({ error: bookingFlowError } = await member.from('bookings').update({ status: 'requested', cancelled_by: null }).eq('id', booking.id));
  if (!bookingFlowError) ({ error: bookingFlowError } = await trainer.from('bookings').update({ status: 'confirmed', cancelled_by: null }).eq('id', booking.id));
}
console.log(`booking    ${bookingFlowError || !booking ? `FAIL ${bookingFlowError?.code || 'missing-demo'} ${bookingFlowError?.message || ''}`.trim() : 'OK requested→confirmed'}`);
failed ||= Boolean(bookingFlowError || !booking);

const { data: thread, error: threadError } = await member.from('threads').select('id').eq('member_id', profiles.member.id).limit(1).maybeSingle();
let chatError = threadError;
if (thread && !chatError) {
  const qaId = '44444444-4444-4444-4444-444444444499';
  const inserted = await member.from('messages').insert({ id: qaId, thread_id: thread.id, sender_id: profiles.member.id, body: 'QA: 회원·트레이너 대화 연결 확인' });
  if (inserted.error?.code !== '23505') chatError = inserted.error;
  if (!chatError) {
    const read = await trainer.from('messages').select('id').eq('id', qaId).maybeSingle();
    chatError = read.error || (!read.data ? new Error('trainer cannot read member message') : null);
  }
}
console.log(`chat       ${chatError || !thread ? `FAIL ${chatError?.code || 'missing-demo'}` : 'OK member→trainer'}`);
failed ||= Boolean(chatError || !thread);

let { data: dayPlan, error: dayPlanError } = await member.from('price_plans').select('*').eq('gym_id', demoGym.id).eq('kind', 'daily').eq('is_active', true).limit(1).maybeSingle();
if (!dayPlan && !dayPlanError) {
  const createdPlan = await owner.from('price_plans').insert({
    id: '44444444-4444-4444-4444-444444444403', gym_id: demoGym.id, kind: 'daily',
    name: '일일 이용권', valid_days: 1, metadata: { valid_hours: 24, reentry_allowed: false },
    price: 15000, list_price: 15000, terms: '결제일 당일 1회 입장. 운동복·수건 포함.', is_active: true,
  }).select().single();
  dayPlan = createdPlan.data; dayPlanError = createdPlan.error;
}
let dayPassError = dayPlanError;
if (dayPlan && !dayPassError) {
  let { data: order, error } = await member.from('payment_orders').select('*').eq('member_id', profiles.member.id).eq('plan_id', dayPlan.id).limit(1).maybeSingle();
  dayPassError = error;
  if (!order && !dayPassError) {
    const created = await member.from('payment_orders').insert({ member_id: profiles.member.id, gym_id: demoGym.id, plan_id: dayPlan.id, order_name: dayPlan.name, amount: dayPlan.price, provider: 'demo', status: 'pending' }).select().single();
    order = created.data; dayPassError = created.error;
  }
  if (order?.status === 'pending' && !dayPassError) {
    const completed = await member.rpc('complete_demo_payment', { p_order_id: order.id });
    dayPassError = completed.error;
  }
  if (!dayPassError) {
    const access = await member.from('access_credentials').select('id').eq('gym_id', demoGym.id).eq('member_id', profiles.member.id).maybeSingle();
    dayPassError = access.error || (!access.data ? new Error('access credential missing') : null);
  }
}
console.log(`day-pass   ${dayPassError || !dayPlan ? `FAIL ${dayPassError?.code || 'missing-plan'} ${dayPassError?.message || ''}`.trim() : 'OK paid→membership→access'}`);
failed ||= Boolean(dayPassError || !dayPlan);

for (const client of Object.values(clients)) await client.auth.signOut();
if (failed) process.exitCode = 1;

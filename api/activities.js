// POST /api/activities  { staff_id, title, requested_by? } → 업무 지시를 기록하고 직원 상태를 '근무 중'으로 바꾼다
import { sql, json } from './_lib.js';

const DAILY_LIMIT = 300; // 누구나 쓸 수 있는 공개 페이지라 하루 지시 건수에 상한을 둔다

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '요청 형식이 올바르지 않아요.' }, 400);
  }
  const staffId = String(body?.staff_id ?? '');
  const title = String(body?.title ?? '').trim();
  const by = String(body?.requested_by ?? '').trim();
  if (!title || title.length > 80) return json({ error: '업무 내용은 1~80자로 적어 주세요.' }, 400);
  if (by.length > 20) return json({ error: '이름은 20자까지 적을 수 있어요.' }, 400);

  try {
    const [staff] = await sql`select id from staff where id = ${staffId}`;
    if (!staff) return json({ error: '없는 직원이에요.' }, 400);
    const [{ n }] = await sql`select count(*)::int as n from activities where kind = '요청' and at > now() - interval '1 day'`;
    if (n >= DAILY_LIMIT) return json({ error: '오늘 받을 수 있는 업무 지시가 다 찼어요. 내일 다시 시도해 주세요.' }, 429);

    const [activity] = await sql`
      insert into activities (staff_id, kind, title, requested_by) values (${staffId}, '요청', ${title}, ${by || null})
      returning id, at, staff_id, to_staff_id, kind, title, participants, requested_by, is_sample`;
    await sql`update staff set status = 'work', current_task = ${title}, updated_at = now() where id = ${staffId}`;
    return json({ activity }, 201);
  } catch (e) {
    console.error(e);
    return json({ error: 'DB 저장에 실패했어요.' }, 500);
  }
}

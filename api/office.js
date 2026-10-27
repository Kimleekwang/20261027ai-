// GET /api/office?date=YYYY-MM-DD → 직원 상태, 그날 기록, 날짜별 건수, 최근 기록, 보고함
import { sql, json, todayKST } from './_lib.js';

export async function GET(request) {
  const date = new URL(request.url).searchParams.get('date') || todayKST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: '날짜 형식이 올바르지 않아요.' }, 400);

  try {
    const [staff, activities, dates, latest, reports] = await Promise.all([
      sql`select id, status, current_task, updated_at from staff`,
      sql`select id, at, staff_id, to_staff_id, kind, title, participants, requested_by, is_sample
          from activities where (at at time zone 'Asia/Seoul')::date = ${date}::date order by at, id`,
      sql`select to_char((at at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD') as date, count(*)::int as count
          from activities group by 1 order by 1 desc limit 14`,
      sql`select id, at, staff_id, to_staff_id, kind, title, requested_by from activities order by at desc, id desc limit 1`,
      sql`select id, created_at, staff_id, title, format, summary, is_sample from reports order by created_at desc limit 50`
    ]);
    return json({ date, today: todayKST(), staff, activities, dates, latest: latest[0] ?? null, reports });
  } catch (e) {
    console.error(e);
    return json({ error: 'DB 조회에 실패했어요.' }, 500);
  }
}

// Neon Postgres 테이블 생성 + 예시 데이터 입력
// 사용법: npm run db:setup   (이미 있으면 건너뜀)
//        npm run db:reset   (테이블을 지우고 처음부터 다시 만듦)
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const reset = process.argv.includes('--reset');

const STAFF = [
  ['quality', '품질분석가', '품질팀', 3, 'work', '10월 불량 집계 마무리'],
  ['cause', '원인분석가', '품질팀', 3, 'work', 'TOP5 불량 4M 원인분석'],
  ['reporter', '보고서작성자', '품질팀', 3, 'idle', '원인분석 결과 기다리는 중'],
  ['production', '생산관리 담당', '원가팀', 2, 'work', '10월 설비 가동률 정리'],
  ['cost', '원가분석가', '원가팀', 2, 'work', '불량 손실비용 환산'],
  ['quote', '견적담당', '원가팀', 2, 'work', '원가표 반영 견적 갱신']
];

// [날짜 시각(KST), 담당, 받는 사람, 종류, 내용, 참석자]
const ACTIVITIES = [
  ['2026-10-22 09:00', 'production', null, '작업', '9월 월간 생산관리 보고서 작성'],
  ['2026-10-22 11:30', 'production', null, '완료', '9월 월간 생산관리 보고서 완료'],
  ['2026-10-22 13:00', 'quality', null, '작업', '라인별·금형별 교차분석'],
  ['2026-10-22 15:00', 'quality', 'cause', '전달', '이상치(금형 M-12) 전달'],
  ['2026-10-22 16:20', 'cause', null, '작업', '금형 M-12 캐비티 편차 원인 검토'],

  ['2026-10-23 09:10', 'quality', null, '작업', '9월 불량 데이터 재집계 (누락 LOT 반영)'],
  ['2026-10-23 10:20', 'quality', 'cause', '전달', '수정된 TOP5 · 이상치 전달'],
  ['2026-10-23 11:00', 'cause', null, '작업', '싱크마크 불량 5Why 분석'],
  ['2026-10-23 13:40', 'cause', 'reporter', '전달', '4M 원인 · 개선안 전달'],
  ['2026-10-23 15:30', 'reporter', null, '완료', '9월 품질이슈분석보고서 작성 완료'],
  ['2026-10-23 16:10', 'reporter', null, '회의', '9월 품질이슈 보고서 검토 회의', ['quality', 'cause', 'reporter', 'cost']],

  ['2026-10-21 09:30', 'production', null, '작업', '주간 생산실적 집계'],
  ['2026-10-21 10:00', 'production', 'cost', '전달', '실적 · 가동시간 전달'],
  ['2026-10-21 11:20', 'cost', null, '작업', '9월 원가차이 분석'],
  ['2026-10-21 14:00', 'cost', 'quote', '전달', '제품별 원가표 전달'],
  ['2026-10-21 15:10', 'quote', null, '작업', '신규 커버 부품 견적 산출'],
  ['2026-10-21 16:30', 'quote', null, '완료', '신규 커버 부품 견적서 완료'],

  ['2026-10-26 09:00', 'quality', null, '회의', '주간 업무 계획 회의 (전원)', ['quality', 'cause', 'reporter', 'production', 'cost', 'quote']],
  ['2026-10-26 10:10', 'production', null, '작업', '10월 3주차 설비 가동률 정리'],
  ['2026-10-26 11:00', 'cost', null, '작업', '수지 단가 변동 반영 원가 재계산'],
  ['2026-10-26 13:30', 'cost', 'quote', '전달', '수지 단가 변동 원가표 전달'],
  ['2026-10-26 14:20', 'quote', null, '작업', '기존 견적 3건 단가 갱신'],
  ['2026-10-26 16:00', 'reporter', null, '작업', '보고서 양식 점검'],

  ['2026-10-27 08:50', 'production', null, '작업', '10월 4주차 생산실적 집계'],
  ['2026-10-27 09:20', 'production', 'cost', '전달', '실적 · 가동시간 데이터 전달'],
  ['2026-10-27 09:40', 'quality', null, '작업', '10월 불량발생대장 집계 시작'],
  ['2026-10-27 10:30', 'quality', null, '작업', '파레토 분석: 핵심불량 3종(★) 도출'],
  ['2026-10-27 10:45', 'quality', 'cause', '전달', 'TOP5 · 이상치 목록 전달'],
  ['2026-10-27 11:10', 'cost', null, '작업', '제품별 실제원가 계산'],
  ['2026-10-27 13:30', 'cause', null, '작업', 'TOP5 불량 4M 매핑 · 5Why 정리'],
  ['2026-10-27 14:00', 'cost', null, '회의', '10월 불량 손실비용 검토 회의', ['quality', 'cause', 'cost']],
  ['2026-10-27 14:40', 'quality', 'cost', '전달', '불량 수량 전달 (손실비용 환산용)'],
  ['2026-10-27 15:20', 'cost', 'quote', '전달', '제품별 원가표 전달']
];

const REPORTS = [
  ['2026-10-20 17:00', 'cost', '9월 원가차이 분석 보고', 'pptx', '표준원가 대비 실제원가 차이 상위 5개 제품과 원인 정리'],
  ['2026-10-22 11:30', 'production', '9월 월간 생산관리 보고서', 'docx', '계획 대비 실적, 공정별 가동률, 납기 준수율'],
  ['2026-10-23 15:30', 'reporter', '9월 품질이슈분석보고서', 'docx', '파레토 핵심불량, 4M 근본원인, 단기·중장기 개선방안'],
  ['2026-10-21 16:30', 'quote', '신규 커버 부품 견적서', 'xlsx', '사이클타임·수지 사용량 기준 개당 단가와 금형비']
];

if (reset) {
  for (const t of ['reports', 'activities', 'staff']) await sql.query(`drop table if exists ${t}`);
  console.log('기존 테이블 삭제');
}

await sql`create table if not exists staff (
  id text primary key,
  name text not null,
  team text not null,
  floor int not null,
  status text not null default 'idle' check (status in ('work', 'idle')),
  current_task text not null default '',
  updated_at timestamptz not null default now()
)`;
await sql`create table if not exists activities (
  id bigserial primary key,
  at timestamptz not null default now(),
  staff_id text not null references staff(id),
  to_staff_id text references staff(id),
  kind text not null check (kind in ('작업', '전달', '회의', '완료', '요청')),
  title text not null,
  participants text[] not null default '{}',
  requested_by text,
  is_sample boolean not null default false
)`;
await sql`create index if not exists activities_at_idx on activities (at)`;
await sql`create table if not exists reports (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  staff_id text not null references staff(id),
  title text not null,
  format text not null,
  summary text not null default '',
  is_sample boolean not null default false
)`;
console.log('테이블 준비 완료');

const [{ n }] = await sql`select count(*)::int as n from activities where is_sample`;
if (n > 0) {
  console.log(`예시 데이터가 이미 있어요 (${n}건). 건너뜀`);
  process.exit(0);
}

await sql.transaction([
  ...STAFF.map(([id, name, team, floor, status, task]) => sql`
    insert into staff (id, name, team, floor, status, current_task) values (${id}, ${name}, ${team}, ${floor}, ${status}, ${task})
    on conflict (id) do update set name = excluded.name, team = excluded.team, floor = excluded.floor,
      status = excluded.status, current_task = excluded.current_task, updated_at = now()`),
  ...ACTIVITIES.map(([at, staff, to, kind, title, participants = []]) => sql`
    insert into activities (at, staff_id, to_staff_id, kind, title, participants, is_sample)
    values (${at}::timestamp at time zone 'Asia/Seoul', ${staff}, ${to}, ${kind}, ${title}, ${participants}, true)`),
  ...REPORTS.map(([at, staff, title, format, summary]) => sql`
    insert into reports (created_at, staff_id, title, format, summary, is_sample)
    values (${at}::timestamp at time zone 'Asia/Seoul', ${staff}, ${title}, ${format}, ${summary}, true)`)
]);
console.log(`예시 데이터 입력: 직원 ${STAFF.length}명, 기록 ${ACTIVITIES.length}건, 보고서 ${REPORTS.length}건`);

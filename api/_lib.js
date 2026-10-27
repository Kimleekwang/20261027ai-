// api 공통: Neon 연결과 응답 도우미 (밑줄로 시작하는 파일은 Vercel이 주소로 만들지 않는다)
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

export const json = (data, status = 200) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store' } });

export const todayKST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

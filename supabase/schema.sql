-- =====================================================
-- 勁丰羽球館 零打報名系統：資料庫結構
-- 使用方式：整份複製，貼到 Supabase 的 SQL Editor，按 Run
-- 重複執行也沒關係，不會刪除已經存在的資料
-- =====================================================

-- 1. 場次（每星期固定的零打時段）
create table if not exists sessions (
  id          bigint generated always as identity primary key,
  name        text not null unique,          -- 場次名稱，例如「週一 18:30-22:30」
  weekday     smallint check (weekday between 0 and 6), -- 星期幾：0=日 1=一 … 6=六
  start_time  time not null,                 -- 開始時間
  end_time    time not null,                 -- 結束時間
  level       text,                          -- 程度，例如「中高階」
  price       int,                           -- 價格（元）
  min_people  int,                           -- 最少開團人數（沒有限制則留空）
  note        text,                          -- 備註，例如「新手友善／8–9 成新球」
  active      boolean not null default true, -- 是否開放報名
  sort_order  int not null default 0,        -- 排列順序
  created_at  timestamptz not null default now()
);

-- 如果之前已經執行過舊版，補上新欄位
alter table sessions add column if not exists weekday    smallint check (weekday between 0 and 6);
alter table sessions add column if not exists level      text;
alter table sessions add column if not exists price      int;
alter table sessions add column if not exists min_people int;
alter table sessions add column if not exists note       text;

-- 2. 報名紀錄
create table if not exists registrations (
  id            bigint generated always as identity primary key,
  play_date     date not null,                                  -- 報名日期（打球的日期）
  session_id    bigint not null references sessions(id),        -- 場次
  name          text not null check (length(trim(name)) > 0),   -- 報名者姓名
  people        int not null default 1 check (people between 1 and 20), -- 報名人數
  status        text not null default 'registered'
                check (status in ('registered', 'cancelled')),  -- 狀態：已報名 / 已取消
  line_user_id  text,                                           -- LINE 使用者代號（從後台新增則為空）
  source        text not null default 'line'
                check (source in ('line', 'admin')),            -- 來源：LINE 或 管理後台
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  cancelled_at  timestamptz
);

-- 同一天、同一場次、同一個名字，只能有一筆「已報名」→ 防止重複計算
create unique index if not exists registrations_no_duplicate
  on registrations (play_date, session_id, lower(trim(name)))
  where status = 'registered';

create index if not exists registrations_by_date
  on registrations (play_date, session_id);

-- 3. 每一場的報名人數（自動計算，不用手動維護）
create or replace view session_counts as
select
  r.play_date,
  s.id         as session_id,
  s.name       as session_name,
  s.start_time,
  s.end_time,
  count(*)     as registration_count, -- 幾筆報名
  sum(r.people) as total_people        -- 總人數
from registrations r
join sessions s on s.id = r.session_id
where r.status = 'registered'
group by r.play_date, s.id, s.name, s.start_time, s.end_time;

-- 4. 對話暫存：機器人問使用者問題時（例如「請問是哪一場？」），
--    先把還沒問完的報名內容記在這裡，等使用者回答再接著處理
create table if not exists conversation_state (
  line_user_id  text primary key,
  pending       jsonb not null,
  updated_at    timestamptz not null default now()
);

-- 5. 安全設定：開啟資料列保護，只有我們自己的伺服器程式（用秘密金鑰）可以讀寫
alter table sessions           enable row level security;
alter table registrations      enable row level security;
alter table conversation_state enable row level security;
alter view  session_counts     set (security_invoker = true);

-- 6. 勁丰羽球館固定零打時段
--    之後要改價格或時段，改這裡再按一次 Run 即可（會更新同名場次）
insert into sessions (name, weekday, start_time, end_time, level, price, min_people, note, sort_order) values
  ('週一 18:30-22:30', 1, '18:30', '22:30', '中高階',     380, null, null, 11),
  ('週一 18:30-20:30', 1, '18:30', '20:30', '中高階',     280, null, null, 12),
  ('週一 20:30-22:30', 1, '20:30', '22:30', '中高階',     280, null, null, 13),
  ('週二 18:30-22:30', 2, '18:30', '22:30', '初中階',     380, null, null, 21),
  ('週二 18:30-20:30', 2, '18:30', '20:30', '初中階',     280, null, null, 22),
  ('週二 20:30-22:30', 2, '20:30', '22:30', '初中階',     280, null, null, 23),
  ('週三 09:00-12:00', 3, '09:00', '12:00', '新手友善',   250, 5,    '五人開團／8–9 成新球', 31),
  ('週三 14:00-17:00', 3, '14:00', '17:00', '新手友善',   250, 5,    '五人開團／8–9 成新球', 32),
  ('週三 18:30-22:30', 3, '18:30', '22:30', '新手友善',   300, null, '8–9 成新球', 33),
  ('週四 18:30-22:30', 4, '18:30', '22:30', '中高階',     380, null, null, 41),
  ('週四 18:30-20:30', 4, '18:30', '20:30', '中高階',     280, null, null, 42),
  ('週四 20:30-22:30', 4, '20:30', '22:30', '中高階',     280, null, null, 43),
  ('週五 18:30-22:30', 5, '18:30', '22:30', '初中～高階', 380, null, null, 51),
  ('週五 18:30-20:30', 5, '18:30', '20:30', '初中～高階', 280, null, null, 52),
  ('週五 20:30-22:30', 5, '20:30', '22:30', '初中～高階', 280, null, null, 53),
  ('週六 18:00-22:00', 6, '18:00', '22:00', null,         null, null, null, 61),
  ('週日 09:00-12:00', 0, '09:00', '12:00', '新手友善',   250, null, '8–9 成新球', 71),
  ('週日 15:00-18:00', 0, '15:00', '18:00', '中高階',     300, null, null, 72)
on conflict (name) do update set
  weekday    = excluded.weekday,
  start_time = excluded.start_time,
  end_time   = excluded.end_time,
  level      = excluded.level,
  price      = excluded.price,
  min_people = excluded.min_people,
  note       = excluded.note,
  sort_order = excluded.sort_order;

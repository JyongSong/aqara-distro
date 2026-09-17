/**
 * Supabase Storage 버킷을 로컬 디렉터리로 미러링한다. 읽기 전용이다.
 *
 *   node scripts/backup-storage.mjs <대상 디렉터리> [직전 백업의 storage 디렉터리]
 *
 * 두 번째 인자를 주면, 직전 백업에 같은 크기로 이미 있는 파일은 다시 내려받지 않고
 * hard link 로 잇는다. 그래서 백업 디렉터리 하나하나는 전부 완전한 스냅샷으로 보이지만
 * 디스크에는 파일 실체가 한 번만 저장된다. 오래된 스냅샷을 지워도 안전하다 —
 * 남은 스냅샷이 여전히 링크를 쥐고 있어서 파일은 사라지지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["product-images"];
const dest = process.argv[2];
const linkFrom = process.argv[3] ?? null;
if (!dest) {
  console.error("사용법: node scripts/backup-storage.mjs <대상 디렉터리> [직전 storage 디렉터리]");
  process.exit(1);
}

const envFile = process.env.ENV_FILE ?? ".env.local";
const env = fs.readFileSync(envFile, "utf8");
const read = (key) => (env.match(new RegExp(`^${key}="?([^"\n]*)"?$`, "m")) ?? [])[1];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? read("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? read("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) {
  console.error(`${envFile} 에서 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 찾을 수 없다`);
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/** 버킷 안의 모든 객체를 재귀적으로 나열한다. list() 는 한 번에 최대 1000개라 페이징이 필요하다. */
async function listAll(bucket, prefix = "") {
  const files = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list('${bucket}/${prefix}') 실패: ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // id 가 null 인 항목은 '폴더'이지 실제 객체가 아니다.
      if (entry.id === null) files.push(...(await listAll(bucket, full)));
      else files.push({ key: full, size: entry.metadata?.size ?? null });
    }
    if (data.length < pageSize) break;
  }
  return files;
}

let downloaded = 0;
let linked = 0;
let downloadedBytes = 0;
const failures = [];

for (const bucket of BUCKETS) {
  const files = await listAll(bucket);
  console.log(`  버킷 '${bucket}': 객체 ${files.length}개`);

  for (const file of files) {
    // 버킷이 여러 개일 때 같은 경로가 서로 덮어쓰지 않도록 버킷명으로 나눈다.
    const relative = BUCKETS.length > 1 ? path.join(bucket, file.key) : file.key;
    const target = path.join(dest, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });

    // 1. 직전 백업에 같은 크기로 있으면 → hard link, 네트워크를 타지 않는다.
    //    주의: 비교 대상은 반드시 '직전 백업 디렉터리'여야 한다. target 존재 여부로
    //    쓰면 매번 새 타임스탬프 디렉터리라 조건이 영원히 성립하지 않아 매일 전량 재다운로드가 된다.
    if (linkFrom && file.size !== null) {
      const previous = path.join(linkFrom, relative);
      try {
        if (fs.statSync(previous).size === file.size) {
          fs.linkSync(previous, target);
          linked += 1;
          continue;
        }
      } catch {
        // 직전에 없던 파일 — 아래로 내려가 다운로드한다.
      }
    }

    // 2. 같은 디렉터리로 재실행할 때 건너뛰기.
    if (file.size !== null) {
      try {
        if (fs.statSync(target).size === file.size) {
          linked += 1;
          continue;
        }
      } catch { /* 없음 — 다운로드 */ }
    }

    const { data, error } = await supabase.storage.from(bucket).download(file.key);
    if (error || !data) {
      failures.push(`${bucket}/${file.key}: ${error?.message ?? "빈 응답"}`);
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(target, buffer);
    downloaded += 1;
    downloadedBytes += buffer.byteLength;
  }
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
console.log(`  새로 받음 ${downloaded}개 (${mb(downloadedBytes)}), 기존 링크 ${linked}개`);
if (failures.length) {
  console.error(`  실패 ${failures.length}개:`);
  for (const f of failures) console.error(`    ${f}`);
  process.exit(1);   // 실패 시 non-zero 로 끝내야 예약 작업이 '조용히 성공'하지 않는다
}

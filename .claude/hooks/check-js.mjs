// PostToolUse 훅: Edit/Write로 수정된 .js 파일의 문법을 node --check로 검사한다.
// 문법 오류면 stderr에 내용을 남기고 exit 2 → Claude에게 차단 피드백으로 전달된다.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let input = {};
try { input = JSON.parse(raw); } catch { process.exit(0); }

const file = input.tool_input?.file_path ?? input.tool_response?.filePath;
if (!file || !file.endsWith('.js') || !existsSync(file)) process.exit(0);

const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
if (r.status !== 0) {
  process.stderr.write(`문법 오류: ${file}\n${r.stderr}`);
  process.exit(2);
}

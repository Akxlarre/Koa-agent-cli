# Lessons Learned (Auto-generated)

> Max 20 entries. Oldest are rotated out. Duplicates increment count.

| Date | Tool | Error | Count | Signature | Context |
|------|------|-------|-------|-----------|---------|
| 2026-04-10 | `Bash` | Exit code 1 warning: in the working copy of 'bin/index.js', LF will be replaced | 1 | `Bash:Exit code 1 warning: in the working copy of 'bin/index.js', LF will be replaced` | git add CLAUDE.md bin/index.js .claude/CLAUDE.md .claude/hooks/ .claude/rules/ .claude/settings.json |
| 2026-04-13 | `Read` | EISDIR: illegal operation on a directory, read 'C:\Users\Akxlarre\claude-agent-c | 1 | `Read:EISDIR: illegal operation on a directory, read 'C:\Users\Akxlarre\claude-agent-c` | C:\Users\Akxlarre\claude-agent-cli\docs |
| 2026-04-13 | `Read` | File content (11497 tokens) exceeds maximum allowed tokens (10000). Use offset a | 1 | `Read:File content (11497 tokens) exceeds maximum allowed tokens (10000). Use offset a` | C:\Users\Akxlarre\claude-agent-cli\docs\ESTUDIO.md |
| 2026-04-13 | `Bash` | Exit code 1 warning: in the working copy of '.claude/CLAUDE.md', LF will be repl | 1 | `Bash:Exit code 1 warning: in the working copy of '.claude/CLAUDE.md', LF will be repl` | cd "C:/Users/Akxlarre/claude-agent-cli" && git add .claude/CLAUDE.md .gitignore indices/TEMPLATES-RE |
| 2026-04-13 | `Bash` | Exit code 1 file:///C:/Users/Akxlarre/claude-agent-cli/patch-guard.js:2 const fs | 1 | `Bash:Exit code 1 file:///C:/Users/Akxlarre/claude-agent-cli/patch-guard.js:2 const fs` | cd C:/Users/Akxlarre/claude-agent-cli && node patch-guard.js && rm patch-guard.js |
| 2026-04-13 | `Edit` | File content has changed since it was last read. This commonly happens when a li | 1 | `Edit:File content has changed since it was last read. This commonly happens when a li` | C:\Users\Akxlarre\claude-agent-cli\templates\.claude\hooks\pre-write-guard.js |
| 2026-04-14 | `Bash` | Exit code 2 ls: cannot access 'C:UsersAkxlarreclaude-agent-clitemplates\': No su | 1 | `Bash:Exit code 2 ls: cannot access 'C:UsersAkxlarreclaude-agent-clitemplates\': No su` | ls C:\Users\Akxlarre\claude-agent-cli\templates\ |
| 2026-04-14 | `Read` | File does not exist. Note: your current working directory is C:\Users\Akxlarre\c | 1 | `Read:File does not exist. Note: your current working directory is C:\Users\Akxlarre\c` | C:\Users\Akxlarre\claude-agent-cli\templates\.claude\skills\supabase-data-model.md |
| 2026-08-11 | `mcp__github__create_repository` | failed to create repository: POST https://api.github.com/user/repos: 403 Resourc | 1 | `mcp__github__create_repository:failed to create repository: POST https://api.github.com/user/repos: 403 Resourc` |  |
| 2026-08-11 | `Bash` | Exit code 1 Client: Docker Engine - Community Version: 29.3.1 Context: default D | 1 | `Bash:Exit code 1 Client: Docker Engine - Community Version: 29.3.1 Context: default D` | docker info 2>&1 |
| 2026-08-11 | `Bash` | Exit code 127 OCI runtime exec failed: exec failed: unable to start container pr | 1 | `Bash:Exit code 127 OCI runtime exec failed: exec failed: unable to start container pr` | docker exec pgv2 psql -U postgres -tAc "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authe |
| 2026-08-11 | `Bash` | Exit code 2 ls: cannot access '/opt/pw-browsers/chromium/': Not a directory | 1 | `Bash:Exit code 2 ls: cannot access '/opt/pw-browsers/chromium/': Not a directory` | cd /workspace/app-familiar-v2 && sed -i "s#chromium.launch()#chromium.launch({ executablePath: '/opt |
| 2026-08-12 | `Bash` | Exit code 144 | 6 | `Bash:Exit code 144` | pkill -f "ng serve" 2>/dev/null; cd /workspace/app-familiar-v2 && git diff --stat .claude/temp/LESSO |
| 2026-08-11 | `Bash` | Exit code 1 angular-component angular-forms angular-primeng angular-signals desi | 1 | `Bash:Exit code 1 angular-component angular-forms angular-primeng angular-signals desi` | cd /workspace/app-familiar-v2 && ls .claude/skills/ && ls .claude/skills/sdd/ 2>/dev/null && wc -l . |
| 2026-08-11 | `Bash` | Exit code 2 000 ls: cannot access '/tmp/claude-0/-home-user-Koa-agent-cli/7f1968 | 1 | `Bash:Exit code 2 000 ls: cannot access '/tmp/claude-0/-home-user-Koa-agent-cli/7f1968` | curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://localhost:4263/ 2>&1; ls -la /tmp/clau |
| 2026-08-12 | `Bash` | Exit code 1 0005-la-pantalla-de-la-plata === ¿hay categorías sembradas? === fail | 1 | `Bash:Exit code 1 0005-la-pantalla-de-la-plata === ¿hay categorías sembradas? === fail` | cd /workspace/app-familiar-v2 && python3 - <<'PY'
import pathlib
p = pathlib.Path('specs/ROADMAP.md' |

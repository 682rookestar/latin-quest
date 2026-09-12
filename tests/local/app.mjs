import { execFileSync, spawn } from 'node:child_process';
const supabaseCli = process.env.SUPABASE_CLI;
const status = JSON.parse(execFileSync(
  supabaseCli || 'npx',
  supabaseCli
    ? ['status','--workdir','tests/local','-o','json']
    : ['--yes','supabase@2.117.0','status','--workdir','tests/local','-o','json'],
  { encoding:'utf8', stdio:['ignore','pipe','pipe'] }
));
if (status.API_URL !== 'http://127.0.0.1:55321') throw new Error('Refusing non-local QA backend');
const child = spawn('node', ['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3100'], {
  stdio:'inherit', env:{...process.env,
    LATIN_QUEST_LOCAL_QA:'1',
    NEXT_PUBLIC_SUPABASE_URL:status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3100',
    AI_GATEWAY_API_KEY:'', OPENAI_API_KEY:'', VERCEL_OIDC_TOKEN:'',
  },
});
process.on('SIGINT',()=>child.kill('SIGINT'));
process.on('SIGTERM',()=>child.kill('SIGTERM'));
child.on('exit',code=>process.exit(code ?? 1));

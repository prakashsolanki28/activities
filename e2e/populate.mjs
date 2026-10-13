// Demo data generator (synthetic employees, for screenshots and load-trying only).
// Submits attempts with varied accuracy through the public API, using the admin API to read keys.
// Usage: node e2e/populate.mjs [baseUrl] [slug] [count]
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const slug = process.argv[3] ?? 'spot-the-phish';
const count = Number(process.argv[4] ?? 10);
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'admin@hrrl.local', password: process.env.ADMIN_PASSWORD ?? 'ChangeMe-2026!' };
const NAMES = ['Aarti Meena', 'Rohit Choudhary', 'Sunita Bishnoi', 'Vikas Jat', 'Pooja Rathore', 'Manoj Saini', 'Kavita Purohit', 'Deepak Sharma', 'Neha Gehlot', 'Imran Khan', 'Lalit Mali', 'Seema Parihar'];

const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) });
const cookie = login.headers.get('set-cookie').split(';')[0];
const list = await (await fetch(`${base}/api/admin/activities`, { headers: { cookie } })).json();
const activity = await (await fetch(`${base}/api/admin/activities/${list.find((a) => a.slug === slug)._id}`, { headers: { cookie } })).json();
const keyed = new Map(activity.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));

function answerFor(q, right) {
  const wrongOf = (opts) => opts.find((o) => !o.correct)?.id ?? opts[0].id;
  switch (q.type) {
    case 'single': return right ? q.options.find((o) => o.correct).id : wrongOf(q.options);
    case 'multi': return right ? q.options.filter((o) => o.correct).map((o) => o.id) : [q.options[0].id];
    case 'boolean': return right ? q.correctBoolean : !q.correctBoolean;
    case 'short_text': return right ? q.acceptedAnswers[0] : 'not sure';
    case 'list_text': return q.keywordGroups.slice(0, right ? q.minGroups : 1).map((g) => g.keywords[0]);
    case 'number': return right ? q.correctNumber : (q.correctNumber ?? 0) + 99;
    default: return null;
  }
}

let best = null;
for (let i = 0; i < count; i++) {
  const accuracy = 0.35 + (0.6 * i) / Math.max(1, count - 1);
  const json = (r) => r.json();
  const { state } = await fetch(`${base}/api/public/activities/${slug}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: NAMES[i % NAMES.length], employeeId: `10${String(4400 + i * 37)}` }),
  }).then(json);
  if (!state) continue;
  const h = { 'Content-Type': 'application/json', 'x-attempt-token': state.token };
  await fetch(`${base}/api/public/attempts/${state.attemptId}/start`, { method: 'POST', headers: h });
  let seq = 1;
  for (const pq of state.questions) {
    const q = keyed.get(pq.id);
    if (q.type === 'spot_flags') {
      // Box each flag with the employee's accuracy; harder flags (small ones) get missed more.
      for (const r of q.regions) {
        const hard = r.w * r.h < 40;
        if (Math.random() < (hard ? accuracy * 0.6 : accuracy)) {
          await fetch(`${base}/api/public/attempts/${state.attemptId}/answers/${pq.id}/marks`, {
            method: 'POST', headers: h, body: JSON.stringify({ x: Math.max(0, r.x - 1), y: Math.max(0, r.y - 1), w: r.w + 2, h: r.h + 2, seq: seq++ }),
          });
        }
      }
      await fetch(`${base}/api/public/attempts/${state.attemptId}/answers/${pq.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ value: null, seq: seq++, check: true }) });
      continue;
    }
    // The first exhibit's sender-domain questions are the classic miss.
    const right = Math.random() < (pq.code.startsWith('S1') && pq.code.endsWith('3') ? accuracy * 0.4 : accuracy);
    const value = answerFor(q, right);
    if (value === null) continue;
    await fetch(`${base}/api/public/attempts/${state.attemptId}/answers/${pq.id}`, { method: 'PUT', headers: h, body: JSON.stringify({ value, seq: seq++, check: true }) });
  }
  const done = await fetch(`${base}/api/public/attempts/${state.attemptId}/submit`, { method: 'POST', headers: h }).then(json);
  console.log(`${state.name.padEnd(16)} ${done.result ? `${String(done.result.pct).padStart(5)}%  ${done.result.certificateCode ?? ""}` : "submitted (results held)"}`);
  if (done.result?.certificateCode) best = done.result.certificateCode;
}
console.log(best ? `CERT ${best}` : 'no certificate earned');

// Cherry Blossom Festival backend (Netlify Function).
import { getStore } from '@netlify/blobs';

const E = k => process.env[k] || '';
const enc = new TextEncoder();
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...h } });
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha1 = async s => hex(await crypto.subtle.digest('SHA-1', enc.encode(s)));
async function sign(m) {
  const k = await crypto.subtle.importKey('raw', enc.encode(E('SESSION_SECRET') || E('ADMIN_PASSWORD')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(m)));
}
const eq = (a, b) => a.length === b.length && [...a].reduce((r, c, i) => r | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
async function authed(req) {
  const c = (req.headers.get('cookie') || '').match(/(?:^|; )s=(\d+)\.([a-f0-9]+)/);
  return !!c && +c[1] > Date.now() && eq(await sign(c[1]), c[2]);
}
const EMPTY = { v: 0, notices: [], events: [], moments: [], info: {} };
const arr = a => (Array.isArray(a) ? a.slice(0, 3000) : []);

export default async (req) => {
  const u = new URL(req.url), p = u.pathname.replace(/^\/api\//, ''), m = req.method;
  if (!E('ADMIN_PASSWORD')) return J({ error: 'ADMIN_PASSWORD is not set in Netlify yet.' }, 500);
  const store = getStore({ name: 'festival', consistency: 'strong' });
  const cloud = E('CLOUDINARY_CLOUD_NAME');
  try {
    if (p === 'data' && m === 'GET') {
      const d = (await store.get('data', { type: 'json' })) || EMPTY;
      const fresh = u.searchParams.has('fresh');
      return J({ ...d, cloud }, 200, fresh ? {} : { 'cache-control': 'public, max-age=15', 'netlify-cdn-cache-control': 'public, s-maxage=30, stale-while-revalidate=60' });
    }
    if (p === 'login' && m === 'POST') {
      const b = await req.json().catch(() => ({}));
      const ok = eq(await sign('p' + (b.password || '')), await sign('p' + E('ADMIN_PASSWORD')));
      if (!ok) { await new Promise(r => setTimeout(r, 800)); return J({ error: 'Wrong password' }, 401); }
      const exp = Date.now() + 2592e6;
      return J({ ok: 1 }, 200, { 'set-cookie': `s=${exp}.${await sign(String(exp))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` });
    }
    if (p === 'logout') return J({ ok: 1 }, 200, { 'set-cookie': 's=; Path=/; Max-Age=0; HttpOnly; Secure' });
    if (p === 'me') return J({ ok: await authed(req) });
    if (!(await authed(req))) return J({ error: 'Please sign in' }, 401);

    if (p === 'save' && m === 'POST') {
      const b = await req.json();
      const cur = (await store.get('data', { type: 'json' })) || EMPTY;
      if ((b.v || 0) !== cur.v) return J({ error: 'Someone else just made changes.', data: cur }, 409);
      const d = b.data || {};
      const clean = { v: cur.v + 1, notices: arr(d.notices), events: arr(d.events), moments: arr(d.moments), info: d.info && typeof d.info === 'object' ? d.info : {} };
      if (JSON.stringify(clean).length > 900000) return J({ error: 'Too much content' }, 413);
      await store.setJSON('data', clean);
      return J({ v: clean.v });
    }
    if (p === 'sign' && m === 'POST') {
      const b = await req.json().catch(() => ({}));
      const y = String(b.year || '');
      if (!/^\d{4}$/.test(y)) return J({ error: 'Bad year' }, 400);
      if (!cloud || !E('CLOUDINARY_API_KEY') || !E('CLOUDINARY_API_SECRET')) return J({ error: 'Cloudinary is not set up yet.' }, 500);
      const folder = 'cherry-blossom/' + y, timestamp = Math.floor(Date.now() / 1000);
      return J({ cloud, apiKey: E('CLOUDINARY_API_KEY'), timestamp, folder, signature: await sha1(`folder=${folder}&timestamp=${timestamp}${E('CLOUDINARY_API_SECRET')}`) });
    }
    if (p === 'destroy' && m === 'POST') {
      const b = await req.json().catch(() => ({}));
      const pid = String(b.public_id || ''), rt = b.rt === 'video' ? 'video' : 'image';
      if (!pid.startsWith('cherry-blossom/') || pid.includes('..')) return J({ error: 'Bad id' }, 400);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = new URLSearchParams({ public_id: pid, timestamp, invalidate: 'true', api_key: E('CLOUDINARY_API_KEY'), signature: await sha1(`invalidate=true&public_id=${pid}&timestamp=${timestamp}${E('CLOUDINARY_API_SECRET')}`) });
      const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${rt}/destroy`, { method: 'POST', body });
      return J({ ok: r.ok });
    }
    return J({ error: 'Not found' }, 404);
  } catch (e) {
    return J({ error: 'Something went wrong. Please try again.' }, 500);
  }
};

export const config = { path: '/api/*' };

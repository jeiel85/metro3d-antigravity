/* METRO 3D SEOUL 서비스워커: 오프라인 실행과 설치형 PWA 지원.
 * - 내비게이션: network-first, 실패 시 캐시된 index.html
 * - 같은 출처 정적 자산: stale-while-revalidate
 * 배포 내용이 바뀌어 캐시를 강제로 비워야 하면 CACHE_VERSION을 올린다. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `metro3d-antigravity-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/network.json',
  './data/timetable.json',
  './data/congestion.json',
  './data/ridership.json'
];

// 서비스워커는 첫 방문 페이지의 load 이후에 설치되므로, 그 페이지가 이미 받은 해시 번들은
// 런타임 캐시에 들어오지 않는다. 설치 시 HTML 셸이 참조하는 같은 출처 스크립트·스타일·
// modulepreload를 읽어 함께 캐시해 두어야 설치 직후 오프라인 실행이 가능하다.
const SHELL_TAG_RE = /<(script|link)\b[^>]*>/gi;
const SRC_RE = /\bsrc\s*=\s*["']([^"']+)["']/i;
const HREF_RE = /\bhref\s*=\s*["']([^"']+)["']/i;
const REL_RE = /\brel\s*=\s*["']([^"']+)["']/i;
const LINK_RELS = new Set(['stylesheet', 'modulepreload', 'preload', 'icon', 'apple-touch-icon']);

function shellAssetUrls(html, pageUrl) {
  const urls = new Set();
  for (const [tag, kind] of html.matchAll(SHELL_TAG_RE)) {
    const isScript = kind.toLowerCase() === 'script';
    const ref = (isScript ? SRC_RE : HREF_RE).exec(tag);
    if (!ref) continue;
    if (!isScript) {
      const rels = ((REL_RE.exec(tag) || [])[1] || '').toLowerCase().split(/\s+/);
      if (!rels.some((rel) => LINK_RELS.has(rel))) continue;
    }
    const url = new URL(ref[1], pageUrl);
    url.hash = '';
    if (url.origin === self.location.origin && url.href.startsWith(self.registration.scope)) {
      urls.add(url.href);
    }
  }
  return urls;
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE_URLS);
  const assets = new Set();
  for (const path of PRECACHE_URLS.filter((u) => u.endsWith('/') || u.endsWith('.html'))) {
    const pageUrl = new URL(path, self.registration.scope).href;
    const page = await cache.match(pageUrl);
    if (page) shellAssetUrls(await page.text(), pageUrl).forEach((u) => assets.add(u));
  }
  await cache.addAll([...assets]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('metro3d-antigravity-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 캐시 저장은 best-effort: 저장 공간 초과 등으로 put이 실패해도 받은 응답은 그대로 돌려준다.
async function putIfOk(request, response) {
  if (response && response.ok && response.type === 'basic') {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    } catch (error) {
      console.warn('Service worker cache write failed:', request.url, error);
    }
  }
  return response;
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    return await putIfOk(request, response);
  } catch (error) {
    const cached = (await caches.match(request, { ignoreSearch: true }))
      || (await caches.match(new URL('./index.html', self.registration.scope).href))
      || (await caches.match(self.registration.scope));
    if (cached) return cached;
    throw error;
  }
}

async function handleAsset(event) {
  const { request } = event;
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => putIfOk(request, response))
    .catch((error) => {
      if (cached) return cached;
      throw error;
    });
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  event.respondWith(handleAsset(event));
});

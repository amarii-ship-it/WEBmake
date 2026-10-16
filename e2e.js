// End-to-end checks for the portfolio site and editor.
// Run: npx http-server -p 8765 -s -c-1 . &  then  node e2e.js
// (set NODE_PATH=$(npm root -g) if playwright is installed globally)
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:8765/';
let failures = 0;
function check(cond, msg) {
  console.log((cond ? '  ok   ' : '  FAIL ') + msg);
  if (!cond) failures++;
}

async function siteTests(browser) {
  console.log('site');
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));

  await page.goto(BASE);
  await page.waitForSelector('.tile');
  check(await page.locator('.tile').count() === 3, 'home shows one tile per gallery');
  const nav = await page.locator('.nav-list a[href^="#"]').allTextContents();
  check(JSON.stringify(nav) === JSON.stringify(['Work', 'Illustration', 'Comics', 'Sketches', 'About', 'Contact']), 'nav items: ' + nav.join(', '));
  check(await page.locator('.nav .icons a').count() === 2, 'instagram + artstation icons in nav');

  await page.click('.tile >> nth=0');
  await page.waitForSelector('.grid .thumb');
  check(await page.locator('.grid .thumb').count() === 8, 'illustration gallery has 8 thumbnails');
  check(await page.locator('.grid').evaluate(g => getComputedStyle(g).gridTemplateColumns.split(' ').length) === 4, 'grid uses 4 columns on desktop');
  check(await page.locator('a[aria-current=page]').textContent() === 'Illustration', 'active nav item marked');

  await page.click('.grid .thumb >> nth=0');
  await page.waitForSelector('#lb:not([hidden])');
  check((await page.textContent('#lbCount')) === '1 / 8', 'lightbox opens at first image');
  await page.keyboard.press('ArrowRight');
  check((await page.textContent('#lbCount')) === '2 / 8', 'right arrow goes to next');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  check((await page.textContent('#lbCount')) === '8 / 8', 'left arrow wraps to last');
  await page.click('#lbNext');
  check((await page.textContent('#lbCount')) === '1 / 8', 'next button works');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  check(await page.evaluate(() => !!document.activeElement.closest('#lb')), 'tab focus stays inside lightbox');
  await page.keyboard.press('Escape');
  check(await page.locator('#lb').isHidden(), 'escape closes lightbox');
  check(await page.evaluate(() => document.activeElement.classList.contains('thumb')), 'focus returns to thumbnail');
  check(await page.evaluate(() => !document.body.classList.contains('lb-lock')), 'page scroll unlocked');

  await page.goto(BASE + '#/sketches');
  await page.waitForSelector('.masonry .col');
  check(await page.locator('.masonry .col').count() === 3, 'masonry has 3 columns on desktop');
  check(await page.locator('.masonry .thumb').count() === 5, 'masonry keeps all 5 images');

  await page.goto(BASE + '#/contact');
  await page.waitForSelector('.contact');
  check(await page.getAttribute('.contact .btn', 'href') === 'mailto:you@example.com', 'contact has mailto button');
  check(await page.locator('.contact .icons a').count() === 2, 'contact lists both socials');
  await page.goto(BASE + '#/about');
  check(await page.locator('.about h1').textContent() === 'About', 'about page renders');

  // Content is data: script-looking text must render as text, bad links must be dropped.
  await page.evaluate(() => fetch('site.json').then(r => r.json()).then(d => {
    d.name = '<img src=x onerror="window.pwned=1">';
    d.social.instagram = 'javascript:window.pwned=1';
    d.galleries[0].title = '<b>x</b>';
    window.WEBMAKE.setData(d);
  }));
  await page.waitForTimeout(200);
  check(await page.evaluate(() => !window.pwned && !document.querySelector('.brand img')), 'name is rendered as text');
  check(await page.locator('a[href^="javascript"]').count() === 0, 'javascript: links dropped');

  // Sidebar layout
  await page.evaluate(() => fetch('site.json').then(r => r.json()).then(d => { d.theme.nav = 'sidebar'; d.home.style = 'first'; window.WEBMAKE.setData(d); }));
  await page.goto(BASE + '#/');
  await page.evaluate(() => fetch('site.json').then(r => r.json()).then(d => { d.theme.nav = 'sidebar'; d.home.style = 'first'; window.WEBMAKE.setData(d); }));
  await page.waitForSelector('.site.sidebar .grid');
  check(true, 'sidebar layout with first gallery as home');

  // Phone
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(BASE + '#/sketches');
  await page.waitForSelector('.masonry .col');
  check(await page.locator('.masonry .col').count() === 1, 'masonry collapses to 1 column on phone');
  check(await page.locator('.nav').isHidden(), 'menu collapsed on phone');
  await page.click('.menu-btn');
  check(await page.locator('.nav').isVisible(), 'menu button opens nav');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'no sideways scrolling on phone');

  check(errors.length === 0, 'no page errors ' + (errors.length ? JSON.stringify(errors) : ''));
  await page.close();
}

async function editorTests(browser) {
  console.log('editor');
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Plein Air' : undefined));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));

  // Fake GitHub
  const siteJson = fs.readFileSync('site.json');
  const calls = [];
  await page.route('https://api.github.com/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ method: req.method(), path: url.pathname, body, auth: req.headers().authorization });
    const json = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    const p = url.pathname.replace('/repos/me/portfolio', '');
    if (req.headers().authorization !== 'Bearer test-token') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Bad credentials"}' });
    if (p === '/contents/site.json') return json({ content: siteJson.toString('base64') });
    if (p === '/git/ref/heads/main') return json({ object: { sha: 'head1' } });
    if (p === '/git/commits/head1') return json({ tree: { sha: 'tree1' } });
    if (p === '/git/trees/tree1') return json({ tree: fs.readdirSync('images').map(f => ({ path: 'images/' + f })) });
    if (p === '/git/blobs') return json({ sha: 'blob' + calls.length });
    if (p === '/git/trees') return json({ sha: 'tree2' });
    if (p === '/git/commits') return json({ sha: 'commit2' });
    if (p === '/git/refs/heads/main') return json({ ref: 'refs/heads/main' });
    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto(BASE + 'admin.html');
  await page.waitForSelector('details[data-key=gals]', { state: 'attached' });
  check(await page.isDisabled('#publish'), 'publish disabled with no changes');

  // Wrong token first
  await page.fill('input[placeholder="amarii-ship-it"]', 'me');
  await page.fill('input[placeholder="WEBmake"]', 'portfolio');
  await page.fill('input[type=password]', 'nope');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.waitForFunction(() => /Could not connect/.test(document.getElementById('status').textContent));
  check(/token is wrong/.test(await page.textContent('#status')), 'bad token gives a clear error');

  await page.fill('input[type=password]', 'test-token');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.waitForFunction(() => /Connected/.test(document.getElementById('status').textContent));
  check(true, 'connects with a good token');
  check(await page.evaluate(() => sessionStorage.getItem('webmake:token') === 'test-token' && !localStorage.getItem('webmake:token')), 'token kept for this tab only by default');

  // Edit name -> preview updates
  const frame = page.frameLocator('#frame');
  await page.locator('details[data-key=site] input').first().fill('Ada Artist');
  await page.waitForTimeout(400);
  check((await frame.locator('.brand').textContent()) === 'Ada Artist', 'preview shows edited name');
  check(!(await page.isDisabled('#publish')), 'publish enabled after a change');

  // Social handle -> full URL
  const ig = page.locator('details[data-key=site] input[placeholder="@yourname"]');
  await ig.fill('@ada.draws');
  await ig.blur();
  check((await ig.inputValue()) === 'https://www.instagram.com/ada.draws/', 'instagram handle becomes a link');

  // Upload a PNG to the first gallery
  await page.click('details[data-key=gals] > summary');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
    const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 3000, 2000);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('.gal').first().locator('input[type=file]').setInputFiles({ name: 'red_dragon.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => document.querySelectorAll('.gal')[0].querySelectorAll('.img-row').length === 9);
  check(true, 'uploaded image appears in the list');
  check((await page.locator('.gal').first().locator('.img-row').last().locator('input').first().inputValue()) === 'red dragon', 'title taken from file name');
  await page.waitForTimeout(300);
  check(await frame.locator('.grid .thumb').count() === 9, 'preview shows the new image');

  // Remove sample-3 (only used once) so publishing should delete the file
  const rows = page.locator('.gal').first().locator('.img-row');
  await rows.nth(2).locator('button[aria-label="Remove image"]').click();
  check(await page.locator('.gal').first().locator('.img-row').count() === 8, 'image removed');

  await page.click('#publish');
  await page.waitForFunction(() => /Published/.test(document.getElementById('status').textContent));
  check(true, 'publish succeeds');
  const blobs = calls.filter(c => c.path.endsWith('/git/blobs'));
  check(blobs.length === 2, 'uploads full image + thumbnail (' + blobs.length + ')');
  const tree = calls.find(c => c.path.endsWith('/git/trees') && c.method === 'POST').body;
  check(tree.base_tree === 'tree1', 'new tree builds on current tree');
  const sj = tree.tree.find(t => t.path === 'site.json');
  const saved = JSON.parse(sj.content);
  check(saved.name === 'Ada Artist', 'site.json saved with new name');
  const newImg = saved.galleries[0].images.find(i => i.title === 'red dragon');
  check(newImg && /^images\/red-dragon-\w+\.jpg$/.test(newImg.src) && /^images\/thumbs\//.test(newImg.thumb), 'new image paths: ' + (newImg && newImg.src));
  check(newImg && newImg.w === 3000 && newImg.h === 2000, 'original size recorded');
  check(tree.tree.some(t => t.path === 'images/sample-3.svg' && t.sha === null), 'unused image deleted');
  check(!tree.tree.some(t => t.sha === null && t.path !== 'images/sample-3.svg'), 'nothing else deleted');
  const commit = calls.find(c => c.path.endsWith('/git/commits') && c.method === 'POST').body;
  check(commit.parents[0] === 'head1' && commit.tree === 'tree2', 'commit points at new tree with current head as parent');
  check(calls.some(c => c.method === 'PATCH' && c.path.endsWith('/git/refs/heads/main') && c.body.sha === 'commit2'), 'branch moved to new commit');
  check(await page.isDisabled('#publish'), 'publish disabled again after publishing');

  // Add gallery
  await page.getByRole('button', { name: '+ Add gallery' }).click();
  await page.waitForTimeout(300);
  check(await page.locator('.gal').count() === 4, 'gallery added');
  check((await frame.locator('.nav-list a').allTextContents()).includes('Plein Air'), 'new gallery in preview menu');

  check(errors.length === 0, 'no page errors ' + (errors.length ? JSON.stringify(errors) : ''));
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await siteTests(browser);
    await editorTests(browser);
  } catch (e) {
    console.error(e);
    failures++;
  }
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();

// Portable browser QA. Pass an installed Chromium browser and Playwright module path.
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.KEYDROP_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({executablePath: process.env.KEYDROP_BROWSER, headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(process.env.KEYDROP_QA_URL || 'http://127.0.0.1:5173/');
  await page.getByRole('heading',{name:'Good work opens doors.'}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/');
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/landing-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const landingWidth=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(landingWidth.scroll<=landingWidth.width,`Landing mobile overflow: ${JSON.stringify(landingWidth)}`);
  await page.screenshot({path:'artifacts/landing-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1080});
  await page.getByRole('button',{name:'Create an airdrop'}).click();
  assert.equal(new URL(page.url()).pathname,'/create');
  await page.getByRole('heading',{name:/Reward the people/}).waitFor();
  await page.locator('#title').fill('Builder Collective');
  await assert.equal(await page.locator('.nft-content h3').innerText(),'Builder Collective');
  // Upload a real image via the application, including the embedded-WebP fallback.
  const image=await page.evaluate(()=>{
    const c=document.createElement('canvas'); c.width=256;c.height=256;
    const ctx=c.getContext('2d');ctx.fillStyle='#bad895';ctx.fillRect(0,0,256,256);
    ctx.fillStyle='#2f5b38';ctx.font='bold 150px sans-serif';ctx.fillText('K',75,185);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file][accept="image/png,image/jpeg,image/webp,image/gif"]').setInputFiles({name:'reward.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await page.getByRole('status').filter({hasText:'Artwork ready'}).waitFor();
  await page.getByRole('button',{name:'Dismiss notification'}).click();
  assert.match(await page.locator('#media').inputValue(),/^data:image\/webp;base64,/);
  await page.getByRole('textbox',{name:'Recipient 1 account'}).fill('alice.testnet');
  await page.getByRole('textbox',{name:'Recipient 2 account'}).fill('bob.testnet');
  await page.getByRole('textbox',{name:'Recipient 2 reward'}).fill('15');
  assert.match(await page.locator('.summary-total').innerText(),/25.24/);
  await page.getByRole('button',{name:'Review airdrop'}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.match(await dialog.innerText(),/alice.testnet/);
  assert.match(await dialog.innerText(),/bob.testnet/);
  assert.match(await dialog.innerText(),/25.24 NEAR/);
  await page.getByRole('button',{name:'Close review'}).click();
  // Duplicate recipients must fail before any wallet request.
  await page.getByRole('textbox',{name:'Recipient 2 account'}).fill('alice.testnet');
  await page.getByRole('button',{name:'Review airdrop'}).click();
  await page.getByRole('status').filter({hasText:'Each recipient must be unique'}).waitFor();
  await page.getByRole('textbox',{name:'Recipient 2 account'}).fill('bob.testnet');
  await page.getByRole('button',{name:'Dismiss notification'}).click();
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/create-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(widths.scroll<=widths.width,`Mobile overflow: ${JSON.stringify(widths)}`);
  await page.screenshot({path:'artifacts/create-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'My rewards',exact:true}).click();
  assert.equal(new URL(page.url()).pathname,'/rewards');
  await page.getByRole('heading',{name:'Your contributions have value.'}).waitFor();
  await page.getByRole('button',{name:'How it works'}).click();
  assert.equal(new URL(page.url()).pathname,'/');
  await page.getByRole('heading',{name:'Good work opens doors.'}).waitFor();
  await page.goBack();
  assert.equal(new URL(page.url()).pathname,'/rewards');
  await page.goForward();
  assert.equal(new URL(page.url()).pathname,'/');
  await page.goto(new URL('/create',page.url()).href);
  await page.getByRole('heading',{name:/Reward the people/}).waitFor();
  await page.goto(new URL('/rewards',page.url()).href);
  await page.getByRole('heading',{name:'Your contributions have value.'}).waitFor();
  assert.deepEqual(errors,[]);
  writeFileSync('artifacts/browser-qa.json',JSON.stringify({passed:true,checks:['landing route and CTA','artwork upload and WebP encoding','live preview','exact funding summary','review modal','duplicate validation','390px layout','recipient empty state','browser history and direct routes','no runtime errors']},null,2));
  console.log('Browser QA passed. Screenshots and report: artifacts/');
} catch(error) {
  console.error('Browser errors:',errors);
  console.error('Page content:',(await page.locator('body').innerText()).slice(0,1500));
  throw error;
} finally { await browser.close(); }

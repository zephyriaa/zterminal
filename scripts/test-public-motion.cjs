const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PUBLIC_URL||'http://localhost:3000';
const out=process.env.PUBLIC_ARTIFACTS||'artifacts/public-motion';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch(); const results=[];
 try{
 for(const [name,width,height,reduced] of [['desktop',1672,941,false],['laptop',1366,768,false],['tablet',768,1024,false],['mobile',390,844,false],['reduced',1672,941,true]]){
  const c=await browser.newContext({viewport:{width,height},hasTouch:width<900,reducedMotion:reduced?'reduce':'no-preference'});const p=await c.newPage();const errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await p.addInitScript(()=>{window.motionCLS=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.motionCLS+=e.value}).observe({type:'layout-shift',buffered:true});});
  await p.goto(base,{waitUntil:'load',timeout:90000});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1500);
  const header=p.locator('header[aria-label="Site navigation"]');const mark=header.locator('img');assert.equal(Math.round((await mark.boundingBox()).width),52);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const initialBox=await header.boundingBox();
  await p.screenshot({path:`${out}/${name}-hero.png`});
  const active=await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').map(a=>a.animationName));assert.deepEqual(active,[],`${name}: resting hero has no perpetual animation`);
  const control=width<=860?p.getByRole('button',{name:'Open navigation'}):p.getByRole('navigation',{name:'Public navigation'}).getByRole('link',{name:'Product',exact:true});
  const r=await control.boundingBox();let cdp;
  if(width<=860){cdp=await c.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});}
  else {await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();}
  await p.waitForTimeout(200);
  const press=await control.evaluate(e=>({opacity:getComputedStyle(e,'::after').opacity,transform:getComputedStyle(e).transform,pressed:e.dataset.pressed}));
  assert.ok(+press.opacity>.95);assert.equal(press.pressed,'true');if(reduced)assert.equal(press.transform,'none');
  await p.screenshot({path:`${out}/${name}-press.png`});
  if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(300);assert.equal(await p.getByRole('button',{name:'Close navigation'}).getAttribute('aria-expanded'),'true');await p.screenshot({path:`${out}/${name}-menu.png`});await p.keyboard.press('Escape');}
  else {await p.mouse.move(5,180);await p.mouse.up();}
  assert.equal(await control.getAttribute('data-pressed'),null);
  await p.keyboard.press('Tab');await control.focus();assert.notEqual(await control.evaluate(e=>getComputedStyle(e).outlineStyle),'none');await control.blur();
  if(!reduced){
   const reveal=await p.locator('[data-reveal-state="pending"]').first().elementHandle();assert.ok(reveal);await reveal.evaluate(e=>e.scrollIntoView({block:'center'}));await p.waitForTimeout(1000);assert.equal(await reveal.getAttribute('data-reveal-state'),'shown');
   const before=await reveal.evaluate(e=>e.getAnimations().map(a=>a.startTime));await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(150);await reveal.evaluate(e=>e.scrollIntoView({block:'center'}));await p.waitForTimeout(200);assert.deepEqual(await reveal.evaluate(e=>e.getAnimations().map(a=>a.startTime)),before);
  } else assert.equal(await p.locator('[data-reveal-state="pending"]').count(),0);
  await p.evaluate(()=>scrollTo(0,700));await p.waitForTimeout(350);
  const scrolledBox=await header.boundingBox();assert.ok(Math.abs(scrolledBox.height-initialBox.height)<1);assert.ok(Math.abs(scrolledBox.y-initialBox.y)<1);
  const material=await header.evaluate(e=>({transform:getComputedStyle(e,'::before').transform,blur:getComputedStyle(e,'::before').backdropFilter}));assert.ok(material.blur.includes('blur'));
  await p.screenshot({path:`${out}/${name}-transition.png`});
  const imgs=p.locator('img[src*="product-"]');assert.equal(await imgs.count(),3);
  for(let i=0;i<3;i++){const img=imgs.nth(i);await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());await p.waitForTimeout(1000);assert.ok((await img.getAttribute('src')).includes('-live.png'));await p.screenshot({path:`${out}/${name}-product-${i}.png`});}
  const sdk=p.getByRole('button',{name:'Python SDK Snippet'});await sdk.click();await p.waitForTimeout(250);assert.ok(await p.locator('pre').filter({hasText:'import zterminal'}).isVisible());await p.getByRole('button',{name:'Workbench View'}).click();
  // Toggling motion while mounted must immediately reveal pending content and reset depth.
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(150);assert.equal(await p.locator('[data-reveal-state="pending"]').count(),0);
  const cls=await p.evaluate(()=>window.motionCLS);assert.ok(cls<.1,`${name} CLS ${cls}`);
  results.push({name,press,material,cls,errors:[...errors]});assert.deepEqual(errors,[]);
  for(const route of ['/research','/docs','/download']){await p.goto(base+route,{waitUntil:'load',timeout:90000});await p.waitForTimeout(650);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(['desktop','mobile'].includes(name))await p.screenshot({path:`${out}/${name}-${route.slice(1)}.png`});assert.deepEqual(errors,[]);}
  await c.close();
 }
 const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();await p.goto(base,{waitUntil:'load'});assert.equal(await p.locator('[data-reveal-state="pending"]').count(),0);assert.ok(await p.getByRole('heading',{name:/Turn market ideas/}).isVisible());await c.close();
 fs.writeFileSync(`${out}/verification.json`,JSON.stringify({base,results,noJavaScript:true},null,2));console.log(JSON.stringify({base,results,noJavaScript:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});


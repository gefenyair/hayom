import {chromium} from 'playwright';
import sharp from 'sharp';
import {google} from 'googleapis';
import {readFile,writeFile} from 'node:fs/promises';
const tz='Asia/Jerusalem';
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const hour=Number(parts.hour);
if(hour!==0&&(hour<6||hour>23)){console.log('Outside scan hours');process.exit(0)}
const date=[parts.year,parts.month,parts.day].join('-');
const slot=String(hour).padStart(2,'0')+':00';
const folderId=process.env.DRIVE_FOLDER_ID;
const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET,refreshToken=process.env.GOOGLE_REFRESH_TOKEN;
if(!folderId||!clientId||!clientSecret||!refreshToken)throw Error('Missing Drive OAuth configuration');
const oauth=new google.auth.OAuth2(clientId,clientSecret);
oauth.setCredentials({refresh_token:refreshToken});
const drive=google.drive({version:'v3',auth:oauth});
// Keep only the current Israel calendar date and the preceding six dates.
// Deleting old date folders permanently (not moving them to Trash) frees Drive quota.
const retentionDays=7;
const todayUtc=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
const oldestDate=new Date(todayUtc-(retentionDays-1)*86400000).toISOString().slice(0,10);
const manifestPath=new URL('./manifest.json',import.meta.url);
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
let pageToken;
do {
 const result=await drive.files.list({
  q:"'"+folderId+"' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
  fields:'nextPageToken,files(id,name)',pageSize:1000,pageToken
 });
 for(const folder of result.data.files||[]){
  if(/^\\d{4}-\\d{2}-\\d{2}$/.test(folder.name)&&folder.name<oldestDate){
   await drive.files.delete({fileId:folder.id});
   console.log('Permanently deleted expired screenshot folder:',folder.name);
  }
 }
 pageToken=result.data.nextPageToken;
}while(pageToken);
manifest.captures=(manifest.captures||[]).filter(x=>x.date>=oldestDate&&x.date<=date);
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\\n');
const folderName=date;
const q="'"+folderId.replace(/'/g,"\\'")+"' in parents and name = '"+folderName+"' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
const existing=await drive.files.list({q,fields:'files(id,name)',pageSize:10});
let dayFolder=existing.data.files?.[0]?.id;
if(!dayFolder){const created=await drive.files.create({requestBody:{name:folderName,mimeType:'application/vnd.google-apps.folder',parents:[folderId]},fields:'id'});dayFolder=created.data.id}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let screenshot;
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'he-IL',timezoneId:tz});
 await page.goto('https://www.israelhayom.co.il/',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForTimeout(6500);
 await page.evaluate(async()=>{const step=650;for(let y=0;y<document.documentElement.scrollHeight;y+=step){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,100))}window.scrollTo(0,0)});
 await page.waitForTimeout(2500);
 const png=await page.screenshot({fullPage:true,type:'png',animations:'disabled',timeout:120000});
 screenshot=await sharp(png,{limitInputPixels:false}).webp({quality:85,effort:5}).toBuffer();
 console.log('Screenshot bytes:',screenshot.length);
}finally{await browser.close()}
const filename=String(hour).padStart(2,'0')+'-00.webp';
const old=await drive.files.list({q:"'"+dayFolder+"' in parents and name = '"+filename+"' and trashed = false",fields:'files(id)',pageSize:10});
let fileId=old.data.files?.[0]?.id;
if(fileId){await drive.files.update({fileId,media:{mimeType:'image/webp',body:(await import('node:stream')).Readable.from(screenshot)}})}
else {const created=await drive.files.create({requestBody:{name:filename,parents:[dayFolder]},media:{mimeType:'image/webp',body:(await import('node:stream')).Readable.from(screenshot)},fields:'id'});fileId=created.data.id}
manifest.captures=manifest.captures.filter(x=>!(x.date===date&&x.hour===slot));
manifest.captures.push({date,hour:slot,fileId});
manifest.captures.sort((a,b)=>(a.date+' '+a.hour).localeCompare(b.date+' '+b.hour));
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Captured',date,slot,fileId);

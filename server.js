'use strict';
const express=require('express'),fs=require('fs/promises'),path=require('path');
const app=express(),PORT=process.env.PORT||3000,DIR=process.env.DATA_DIR||path.join(__dirname,'data'),FILE=path.join(DIR,'state.json');
const EMPTY={rev:0,teams:[],matches:[],tours:[],theme:null};
app.disable('x-powered-by');app.use(require('compression')());
app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});next()});
app.use(express.json({limit:'5mb'}));
let chain=Promise.resolve();
async function read(){try{return JSON.parse(await fs.readFile(FILE,'utf8'))}catch{return {...EMPTY}}}
function write(d){chain=chain.then(async()=>{await fs.mkdir(DIR,{recursive:true});const t=FILE+'.tmp';await fs.writeFile(t,JSON.stringify(d));await fs.rename(t,FILE)});return chain}
const valid=d=>d&&typeof d==='object'&&['teams','matches','tours'].every(k=>Array.isArray(d[k]));
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/api/state',async(req,res)=>{res.set('Cache-Control','no-store');res.json(await read())});
app.put('/api/state',async(req,res)=>{
  if(!valid(req.body))return res.status(400).json({error:'Invalid state'});
  const cur=await read(),d={rev:cur.rev+1,teams:req.body.teams,matches:req.body.matches,tours:req.body.tours,theme:req.body.theme||null};
  try{await write(d);res.json({rev:d.rev})}catch(e){console.error(e);res.status(500).json({error:'Could not save'})}
});
app.use(express.static(path.join(__dirname,'public'),{etag:true,setHeaders:(res)=>res.setHeader('Cache-Control','no-cache')}));
app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
app.use((err,req,res,next)=>res.status(400).json({error:'Bad request'}));
const srv=app.listen(PORT,()=>console.log('Chauka running on http://localhost:'+PORT));
for(const s of['SIGINT','SIGTERM'])process.on(s,()=>chain.finally(()=>srv.close(()=>process.exit(0))));

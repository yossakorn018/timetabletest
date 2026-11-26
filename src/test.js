const TT=require('./engine.js');
const sheets=require('./sheets.json') /* python ดึงจาก Excel */;
const cfg=JSON.parse(JSON.stringify(TT.DEFAULT_CONFIG));
const data=TT.parseWorkbook(sheets,cfg);
const ic=TT.inputCheck(data,cfg);
console.log('sections',data.sections.length,'teachers',data.teachers.length,'input ok',ic.ok);
ic.issues.forEach(i=>console.log(' ',i.level,i.msg));
console.log('groupHours',JSON.stringify(ic.groupHours));
const b=TT.solveBaseline(data,cfg); const vb=TT.validate(data,cfg,b.rows);
console.log('BASELINE unplacedTasks',b.unplaced.length,'hours',b.unplacedHours,'pass',vb.passed+'/'+vb.total,'conflicts',vb.conflicts);
let best=null; const t0=Date.now();
for(let i=0;i<20;i++){const r=TT.solveOnce(data,cfg,42+i); if(!best||r.unplacedHours<best.unplacedHours||(r.unplacedHours===best.unplacedHours&&r.penalty<best.penalty))best=r; console.log(' seed',42+i,'greedyUnplaced',r.greedyUnplaced,'unplacedH',r.unplacedHours,'pen',r.penalty,'splits',r.splits,'repairs',r.log.length);}
console.log('time ms',Date.now()-t0);
const v=TT.validate(data,cfg,best.rows);
console.log('BEST seed',best.seed,'pass',v.passed+'/'+v.total,'conflicts',v.conflicts,'missing',v.missing);
v.checks.forEach(c=>console.log(c.pass?'✓':'✗',c.name,c.count,c.items.slice(0,3).join(' | ')));

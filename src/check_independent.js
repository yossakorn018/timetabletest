/* check_independent.js — ตัวตรวจผลแบบอิสระ (ไม่ใช้ parseWorkbook / validate ของ engine.js)
 *
 * ทำไมต้องมี: engine.js มีตัวตรวจ 11 ข้อของตัวเองอยู่แล้ว แต่ถ้าตัวจัดกับตัวตรวจเขียนจากความเข้าใจเดียวกัน
 * ถ้าเข้าใจโจทย์ผิด ทั้งคู่ก็ผิดเหมือนกัน ไฟล์นี้จึง
 *   1) อ่านรายวิชาจาก Excel เอง (ผ่าน sheets.json)
 *   2) เขียนกฎใหม่จากคำชี้แจงของกรรมการโดยตรง (ค่าคงที่ด้านล่าง)
 *   3) ใช้ engine แค่ "สร้างตาราง" แล้วตรวจผลลัพธ์ด้วยกฎของตัวเอง
 *
 * ใช้: node check_independent.js [จำนวน seed=50]
 * ต้องมี sheets.json (สร้างจาก Excel: python dump_sheets.py ../data/ข้อมูลรายวิชา_ver2.xlsx)
 */
const TT = require("./engine.js");
const sheets = require("./sheets.json");

// ---------------- กฎจากคำชี้แจงของกรรมการ (พิมพ์ใหม่ ไม่ได้ดึงจาก engine) ----------------
const DAYS = 5, PERIODS = 9;
const LOCKED = (day, p) => p === 5 || (day === 2 && (p === 8 || p === 9));   // คาบ 5 พักเที่ยง, พุธคาบ 8-9
const ADMIN_BLOCK = (day, p) => day === 1 && p <= 4;                           // อังคาร คาบ 1-4
const ADMINS = ["ภานุ ศรีวิสุทธิ์", "สุรชัย แซ่ด่าน", "ปรัศนี ช่วยการ ซอลีฮี", "ธรณัส ปัญญาไข", "กู้เกียรติ บุญมี", "ยานี จรคงสี", "นฤมล หวานดี"];
const N_GROUPS = { 1: 4, 2: 4, 3: 3 };            // ปี 4 ฝึกสอน ไม่จัดตาราง (เงื่อนไข 6)
const GROUP_SIZE = { 1: 30, 2: 30, 3: 25 };
const HOME = { "1/1": "321", "1/2": "322", "1/3": "323", "1/4": "324", "2/1": "325", "2/2": "326",
  "2/3": "331", "2/4": "332", "3/1": "333", "3/2": "334", "3/3": "335" };
const THEORY_ROOMS = ["321", "322", "323", "324", "325", "326", "331", "332", "333", "334", "335", "336", "อาคารพิเศษ 1", "อาคารพิเศษ 2"];
const THEORY_CAP = 120, COMPUTER_CAP = 30;
// กีฬา -> คำในชื่อห้อง/สนาม (เรียงคำยาวก่อน เช่น "วอลเลย์บอลชายหาด" ก่อน "วอลเลย์บอล")
const FACILITY = [["วอลเลย์บอลชายหาด", "วอลเลย์ชายหาด"], ["ช่วยชีวิตทางน้ำ", "สระล่าง"], ["เทเบิลเทนนิส", "คอมเพล็กซ์1-1"],
  ["กระบี่กระบอง", "ลานเหนือ"], ["เข้าจังหวะ", "ลานใต้"], ["เซปักตะกร้อ", "ตะกร้อ-1"], ["บาสเกตบอล", "คอมเพล็กซ์2-1"],
  ["วอลเลย์บอล", "ยิมวอลเลย์"], ["ยิมนาสติก", "คอมเพล็กซ์1-4"], ["แฮนด์บอล", "คอมเพล็กซ์2-2"], ["มวยปล้ำ", "คอมเพล็กซ์1-2"],
  ["ว่ายน้ำ", "สระบน"], ["เทคบอล", "ตะกร้อ-2"], ["ฟุตซอล", "ยิมฟุตซอล"], ["ปีนผา", "ปีนผา"], ["เทนนิส", "สนามเทนนิส"],
  ["กรีฑา", "สนามฟุตบอล"], ["มวยไทย", "ยิมมวย-1"], ["มวยสากล", "ยิมมวย-2"], ["แบดมินตัน", "คอมเพล็กซ์1-3"]];
const CAT_THEORY = ["วิชาภาษา", "สังคมศาสตร์", "วิชาชีพครู", "วิชาบังคับ", "คณิตศาสตร์", "วิทยาศาสตร์"];   // เงื่อนไข 1
const CAT_COMPUTER = "นวัตกรรมและเทคโนโลยี";                                                         // เงื่อนไข 2
const CAT_SPORT = "ทักษะและการสอนกีฬา";                                                              // เงื่อนไข 4
const CAT_ELECTIVE = ["ทักษะและการสอนกีฬาขั้นสูง", "การตัดสินกีฬา", "กลวิธีการฝึกกีฬา"];               // เงื่อนไข 5

// ---------------- อ่าน Excel เอง ----------------
const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const nameKey = s => clean(s).replace(/^(อาจารย์\.?|อ\.|ผศ\.|รศ\.|ดร\.|สิบเอก|\s)+/, "").replace(/^(ดร\.|สิบเอก)/, "").trim();
function readCourses() {
  const courses = [];
  sheets.forEach((sh, si) => {
    const year = si + 1;
    let cur = null, head = null;
    for (const r of sh.rows.slice(2)) {
      if (!r || String(r[0] || "").startsWith("รวม")) continue;
      const [no, code, name, cred, cat, teacher] = r;
      if (code) {
        cur = { year, code: clean(code), name: clean(name), cred: clean(cred), cat: clean(cat), teachers: [nameKey(teacher)] };
        if (no) head = cur; else { cur.setOf = head.code; cur.cat = head.cat; cur.cred = head.cred; head.setOf = head.code; }
        courses.push(cur);
      } else if (teacher && cur) cur.teachers.push(nameKey(teacher));
    }
  });
  for (const c of courses) {
    const m = c.cred.match(/(\d+)\((\d+)-(\d+)-(\d+)\)/);
    c.lecture = m ? +m[2] : 0;
    c.hours = m ? +m[2] + +m[3] : (c.year < 4 ? 4 : 0);          // 1(90)/2(90) = ฝึกประสบการณ์ เรียน 4 ชม. รวมทั้งชั้นปี
    c.yearWide = !m || !!c.setOf;                                 // ฝึกประสบการณ์และวิชาเลือก เรียนรวมทั้งชั้นปี
  }
  return courses;
}
const facilityOf = name => { const f = FACILITY.find(([kw]) => name.includes(kw)); return f && f[1]; };

// ---------------- ตรวจ 1 ตาราง ----------------
function check(courses, rows, tName) {
  const err = {};
  const add = (k, v) => (err[k] = err[k] || []).push(v);
  const day = r => Math.floor(r.slot / PERIODS);
  const cell = {};
  for (const r of rows) {
    if (LOCKED(day(r), r.period)) add("A. คาบพักเที่ยง/พบที่ปรึกษา/กิจกรรม ว่าง", `${r.subject} ${r.day} ${r.period}`);
    for (const t of r.teachers) if (ADMINS.includes(nameKey(tName[t])) && ADMIN_BLOCK(day(r), r.period))
      add("B. ผู้บริหารไม่สอนอังคารคาบ 1-4", `${tName[t]} ${r.subject}`);
    (cell[r.slot] = cell[r.slot] || []).push(r);
  }
  for (const rs of Object.values(cell)) {
    const count = list => list.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
    for (const [x, n] of Object.entries(count(rs.flatMap(r => r.teachers)))) if (n > 1) add("C. ผู้สอนไม่ซ้อนคาบ", `${tName[x]} ${rs[0].day} ${rs[0].period}`);
    for (const [x, n] of Object.entries(count(rs.flatMap(r => r.rooms)))) if (n > 1) add("D. ห้อง/สนามไม่ซ้อนคาบ", `${x} ${rs[0].day} ${rs[0].period}`);
    const g = {};
    rs.forEach(r => r.groups.forEach(x => (g[x] = g[x] || new Set()).add(r.set || r.section)));
    for (const [x, s] of Object.entries(g)) if (s.size > 1) add("E. กลุ่มเรียนไม่ซ้อนคาบ", `${x} ${rs[0].day} ${rs[0].period}`);
  }
  const bySubject = {};
  rows.forEach(r => (bySubject[r.subject] = bySubject[r.subject] || []).push(r));
  for (const c of courses) {
    const rs = bySubject[c.code] || [];
    if (c.year === 4) { if (rs.length) add("F. ปี 4 ไม่จัดตาราง", c.code); continue; }
    const groups = Array.from({ length: N_GROUPS[c.year] }, (_, i) => `${c.year}/${i + 1}`);
    for (const g of groups) {
      const h = new Set(rs.filter(r => r.groups.includes(g)).map(r => r.slot)).size;
      if (h !== c.hours) add("G. คาบครบตามหน่วยกิต (บรรยาย+ปฏิบัติ)", `${c.code} กลุ่ม ${g} ได้ ${h}/${c.hours}`);
    }
    if (c.yearWide) for (const r of rs) if (groups.some(g => !r.groups.includes(g))) add("H. เรียนรวมทั้งชั้นปีพร้อมกัน", `${c.code} ${r.day} ${r.period}`);
    for (const r of rs) {
      const got = new Set(r.teachers.map(t => nameKey(tName[t])));
      if (c.teachers.some(t => !got.has(t)) || got.size !== c.teachers.length) add("I. ผู้สอนถูกคน / สอนร่วมครบทุกคน", `${c.code} ${r.day} ${r.period}`);
      const theoryRoom = r.rooms.some(x => THEORY_ROOMS.includes(x));
      if (c.cat === CAT_COMPUTER) {
        if (!r.rooms.some(x => x.startsWith("คอม"))) add("J. ใช้ห้องถูกประเภท", `${c.code} ไม่อยู่ห้องคอมพิวเตอร์`);
        const n = r.groups.reduce((a, g) => a + GROUP_SIZE[g.split("/")[0]], 0);
        if (n > COMPUTER_CAP) add("K. ความจุห้องพอ", `${c.code} ${n} คน > ${COMPUTER_CAP}`);
      } else if (c.cat === CAT_SPORT || CAT_ELECTIVE.includes(c.cat)) {
        const f = facilityOf(c.name);
        if (!f || !r.rooms.some(x => x.includes(f))) add("J. ใช้ห้องถูกประเภท", `${c.code} ${c.name} ไม่อยู่สนามที่ถูกต้อง (${r.rooms})`);
        // เงื่อนไข 4: ใช้ห้องทฤษฎีด้วยเสมอ · เงื่อนไข 5: ใช้ห้องทฤษฎีเมื่อมีชั่วโมงบรรยาย
        if ((c.cat === CAT_SPORT || c.lecture > 0) && !theoryRoom) add("J. ใช้ห้องถูกประเภท", `${c.code} ไม่มีห้องทฤษฎีคู่กับสนาม`);
      } else if (CAT_THEORY.some(k => c.cat.includes(k))) {
        if (!theoryRoom) add("J. ใช้ห้องถูกประเภท", `${c.code} ไม่อยู่ห้องทฤษฎี`);
        const n = r.groups.reduce((a, g) => a + GROUP_SIZE[g.split("/")[0]], 0);
        if (n > THEORY_CAP) add("K. ความจุห้องพอ", `${c.code} ${n} คน > ${THEORY_CAP}`);
      } else add("J. ใช้ห้องถูกประเภท", `${c.code} กลุ่มวิชาไม่รู้จัก: ${c.cat}`);
    }
    if (c.cat === CAT_SPORT || CAT_ELECTIVE.includes(c.cat)) for (const g of groups) {
      const sl = [...new Set(rs.filter(r => r.groups.includes(g)).map(r => r.slot))].sort((a, b) => a - b);
      const ok = sl.length && Math.floor(sl[0] / PERIODS) === Math.floor(sl[sl.length - 1] / PERIODS) && sl.every((x, i) => !i || x === sl[i - 1] + 1);
      if (!ok) add("L. วิชากีฬาเรียนคาบติดกันในวันเดียว", `${c.code} กลุ่ม ${g}`);
    }
  }
  const sets = {};
  for (const c of courses.filter(c => c.setOf)) (sets[c.setOf] = sets[c.setOf] || new Set()).add((bySubject[c.code] || []).map(r => r.slot).sort((a, b) => a - b).join(","));
  for (const [k, s] of Object.entries(sets)) if (s.size > 1) add("M. วิชาเลือกในชุดเดียวกันจัดเวลาเดียวกัน", k);
  return err;
}
const CHECKS = ["A. คาบพักเที่ยง/พบที่ปรึกษา/กิจกรรม ว่าง", "B. ผู้บริหารไม่สอนอังคารคาบ 1-4", "C. ผู้สอนไม่ซ้อนคาบ", "D. ห้อง/สนามไม่ซ้อนคาบ",
  "E. กลุ่มเรียนไม่ซ้อนคาบ", "F. ปี 4 ไม่จัดตาราง", "G. คาบครบตามหน่วยกิต (บรรยาย+ปฏิบัติ)", "H. เรียนรวมทั้งชั้นปีพร้อมกัน",
  "I. ผู้สอนถูกคน / สอนร่วมครบทุกคน", "J. ใช้ห้องถูกประเภท", "K. ความจุห้องพอ", "L. วิชากีฬาเรียนคาบติดกันในวันเดียว", "M. วิชาเลือกในชุดเดียวกันจัดเวลาเดียวกัน"];

// ---------------- รัน ----------------
const N = +process.argv[2] || 50;
const courses = readCourses();
const cfg = JSON.parse(JSON.stringify(TT.DEFAULT_CONFIG));
const data = TT.parseWorkbook(sheets, cfg);                       // ใช้ engine แค่สร้างตาราง
const tName = Object.fromEntries(data.teachers.map(t => [t.id, t.name]));
console.log(`ตัวตรวจอิสระ: อ่านรายวิชาเอง ${courses.length} วิชา, ตรวจ ${CHECKS.length} ข้อจากคำชี้แจง\n`);

// 1) ตรวจวิธีพื้นฐานก่อน เพื่อพิสูจน์ว่าตัวตรวจ "จับผิดได้จริง" ไม่ใช่ผ่านทุกอย่าง
const be = check(courses, TT.solveBaseline(data, cfg).rows, tName);
console.log("วิธีพื้นฐาน (ควรมีข้อไม่ผ่าน):");
CHECKS.forEach(k => be[k] && console.log(`  ✗ ${k}  ${be[k].length} จุด  เช่น ${be[k][0]}`));

// 2) ทดสอบตัวตรวจ: แกล้งใส่ข้อผิดพลาดลงในตารางที่ถูกต้อง ต้องจับได้ทุกกรณี
const good = TT.solveOnce(data, cfg, 1).rows;
const clone = () => good.map(r => Object.assign({}, r, { teachers: r.teachers.slice(), rooms: r.rooms.slice(), groups: r.groups.slice() }));
const theory = good.findIndex(r => r.kind === "theory");
const faults = [
  ["ย้ายวิชาไปคาบพักเที่ยง", "A. คาบพักเที่ยง/พบที่ปรึกษา/กิจกรรม ว่าง", x => { const r = x[theory]; r.slot = Math.floor(r.slot / PERIODS) * PERIODS + 4; r.period = 5; }],
  ["ให้ครูคนเดียวสอน 2 ห้องพร้อมกัน", "C. ผู้สอนไม่ซ้อนคาบ", x => { const a = x[theory], b = x.find(r => r !== a && r.slot === a.slot && r.kind === "theory"); b.teachers = a.teachers.slice(); }],
  ["ลบ 1 คาบออก", "G. คาบครบตามหน่วยกิต (บรรยาย+ปฏิบัติ)", x => { x.splice(theory, 1); }],
  ["ย้ายวิชาทฤษฎีไปสนามกีฬา", "J. ใช้ห้องถูกประเภท", x => { x[theory].rooms = ["สนามฟุตบอล"]; }]
];
console.log("\nทดสอบตัวตรวจ (แกล้งใส่ข้อผิดพลาด ต้องจับได้):");
let caught = 0;
for (const [label, key, mutate] of faults) {
  const x = clone(); mutate(x);
  const ok = !!check(courses, x, tName)[key];
  caught += ok;
  console.log(`  ${ok ? "✓ จับได้" : "✗ จับไม่ได้"}  ${label} -> ข้อ ${key}`);
}

// 3) ตรวจระบบจริง N seed
const fail = {};
let passSeeds = 0;
for (let s = 1; s <= N; s++) {
  const e = check(courses, TT.solveOnce(data, cfg, s).rows, tName);
  if (!Object.keys(e).length) passSeeds++;
  for (const k in e) (fail[k] = fail[k] || []).push(`seed ${s}: ${e[k][0]}`);
}
console.log(`\nระบบ AI ${N} seed (seed 1-${N}):`);
CHECKS.forEach(k => console.log(`  ${fail[k] ? "✗" : "✓"} ${k}${fail[k] ? `  ไม่ผ่าน ${fail[k].length} seed เช่น ${fail[k][0]}` : ""}`));
console.log(`\nผ่านครบทุกข้อ ${passSeeds}/${N} seed`);
process.exit(passSeeds === N && caught === faults.length ? 0 : 1);

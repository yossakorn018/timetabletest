/* engine.js — แกนระบบจัดตารางแบบมหาวิทยาลัย
 * 1) parseWorkbook : แปลงไฟล์รายวิชา (Excel) -> ตอนเรียน (section)
 * 2) inputCheck    : ตรวจข้อมูลก่อนคำนวณ
 * 3) solve         : Greedy + Heuristic + seed + ซ่อม (plan-act-check)
 * 4) validate      : ตรวจผลทุกเงื่อนไข (แยกอิสระจากตัวจัด)
 */
(function () {
  const TT = {};

  // ---------------- ค่าตั้งต้นจากคำชี้แจงโจทย์ (แก้ได้ในหน้าเว็บ) ----------------
  TT.DEFAULT_CONFIG = {
    days: ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"],
    periods: 9,
    startHour: 8,
    locked: [
      { day: "*", period: 5, label: "พักเที่ยง" },
      { day: "พุธ", period: 8, label: "พบอาจารย์ที่ปรึกษา" },
      { day: "พุธ", period: 9, label: "กิจกรรม" }
    ],
    managerBlock: [{ day: "อังคาร", periods: [1, 2, 3, 4], label: "ประชุมฝ่ายบริหาร" }],
    managers: ["ภานุ ศรีวิสุทธิ์", "สุรชัย แซ่ด่าน", "ปรัศนี ช่วยการ ซอลีฮี", "ธรณัส ปัญญาไข",
      "กู้เกียรติ บุญมี", "ยานี จรคงสี", "นฤมล หวานดี"],
    groups: { "1": [4, 30], "2": [4, 30], "3": [3, 25], "4": [3, 20] },
    homeRooms: {
      "1/1": "321", "1/2": "322", "1/3": "323", "1/4": "324",
      "2/1": "325", "2/2": "326", "2/3": "331", "2/4": "332",
      "3/1": "333", "3/2": "334", "3/3": "335",
      "4/1": "336", "4/2": "อาคารพิเศษ 1", "4/3": "อาคารพิเศษ 2"
    },
    theoryRooms: ["321", "322", "323", "324", "325", "326", "331", "332", "333", "334", "335", "336",
      "อาคารพิเศษ 1", "อาคารพิเศษ 2"],
    theoryCapacity: 120,
    computerRooms: [{ id: "คอม 1", cap: 30 }, { id: "คอม 2", cap: 30 }],
    facilities: [
      { id: "ยิมตะกร้อ-1", name: "โรงยิมเซปักตะกร้อ สนาม 1", kw: ["เซปักตะกร้อ"] },
      { id: "ยิมตะกร้อ-2", name: "โรงยิมเซปักตะกร้อ สนาม 2", kw: ["เทคบอล"] },
      { id: "วอลเลย์ชายหาด", name: "สนามวอลเลย์บอลชายหาด", kw: ["วอลเลย์บอลชายหาด"] },
      { id: "ยิมวอลเลย์", name: "โรงยิมวอลเลย์บอล", kw: ["วอลเลย์บอล"] },
      { id: "ยิมฟุตซอล", name: "โรงยิมฟุตซอล", kw: ["ฟุตซอล"] },
      { id: "ยิมปีนผา", name: "โรงยิมปีนผา", kw: ["ปีนผา"] },
      { id: "สระล่าง", name: "สระว่ายน้ำด้านล่าง", kw: ["ช่วยชีวิตทางน้ำ"] },
      { id: "สระบน", name: "สระว่ายน้ำด้านบน", kw: ["ว่ายน้ำ"] },
      { id: "คอมเพล็กซ์1-1", name: "สปอร์ตคอมเพล็กซ์ ชั้น 1 สนาม 1", kw: ["เทเบิลเทนนิส"] },
      { id: "สนามเทนนิส", name: "สนามเทนนิส", kw: ["เทนนิส"] },
      { id: "สนามฟุตบอล", name: "สนามฟุตบอล", kw: ["กรีฑา"] },
      { id: "ลานเหนือ", name: "ลานตึกคณะพลศึกษา ทิศเหนือ", kw: ["กระบี่กระบอง"] },
      { id: "ลานใต้", name: "ลานตึกคณะพลศึกษา ทิศใต้", kw: ["เข้าจังหวะ"] },
      { id: "คอมเพล็กซ์1-2", name: "สปอร์ตคอมเพล็กซ์ ชั้น 1 สนาม 2", kw: ["มวยปล้ำ"] },
      { id: "คอมเพล็กซ์1-3", name: "สปอร์ตคอมเพล็กซ์ ชั้น 1 สนาม 3", kw: ["แบดมินตัน", "แบตมินตัน"] },
      { id: "คอมเพล็กซ์1-4", name: "สปอร์ตคอมเพล็กซ์ ชั้น 1 สนาม 4", kw: ["ยิมนาสติก"] },
      { id: "คอมเพล็กซ์2-1", name: "สปอร์ตคอมเพล็กซ์ ชั้น 2 สนาม 1", kw: ["บาสเกตบอล", "บาสเก็ตบอล"] },
      { id: "คอมเพล็กซ์2-2", name: "สปอร์ตคอมเพล็กซ์ ชั้น 2 สนาม 2", kw: ["แฮนด์บอล"] },
      { id: "ยิมมวย-1", name: "โรงยิมมวย สนาม 1", kw: ["มวยไทย"] },
      { id: "ยิมมวย-2", name: "โรงยิมมวย สนาม 2", kw: ["มวยสากล"] }
    ],
    categories: {
      theory: ["วิชาภาษา", "วิชาสังคมศาสตร์และมนุษยศาสตร์", "วิชาชีพครู", "วิชาบังคับ", "คณิตศาสตร์", "วิทยาศาสตร์"],
      computer: ["นวัตกรรมและเทคโนโลยี"],
      sport: ["ทักษะและการสอนกีฬา"],
      elective: ["ทักษะและการสอนกีฬาขั้นสูง", "การตัดสินกีฬา", "กลวิธีการฝึกกีฬา"]
    },
    electiveCap: 20,
    electiveNeedsTheoryRoom: "lectureOnly",   // lectureOnly | always | never
    noScheduleYears: [4],                     // ปี 4 ฝึกสอนทั้งภาค ไม่จัดคาบ
    allowSplit: true                          // วิชาทฤษฎีแบ่งเป็นช่วงสั้นได้ถ้าลงบล็อกเดียวไม่ได้
  };

  // ---------------- ตัวช่วย ----------------
  const TITLE_RE = /^(อาจารย์\.?|อ\.|ผศ\.|รศ\.|ศ\.|ดร\.|สิบเอก|\s)+/;
  function clean(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/\s+/g, " ").replace(/\.\s+(?=\S)/g, ".").trim();
  }
  function nameKey(s) { return clean(s).replace(TITLE_RE, "").trim(); }
  function parseCredit(s) {
    let m = /^\s*(\d+)\s*\(\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*\)/.exec(s || "");
    if (m) return { credit: +m[1], lec: +m[2], pra: +m[3], self: +m[4] };
    m = /^\s*(\d+)\s*\(\s*(\d+)\s*\)/.exec(s || "");
    if (m) return { credit: +m[1], lec: null, pra: null, self: null, field: +m[2] };
    return null;
  }
  function isEmpty(v) { return v === null || v === undefined || v === ""; }
  TT.mulberry32 = function (a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  // ---------------- 1) แปลงไฟล์ ----------------
  // sheets: [{name, rows: [[cell,...],...]}]  (rows จาก SheetJS header:1)
  TT.parseWorkbook = function (sheets, cfg) {
    const warnings = [];
    const teachers = new Map();
    const catOf = (c) => {
      for (const k of ["theory", "computer", "sport", "elective"]) if (cfg.categories[k].includes(c)) return k;
      return null;
    };
    function teacher(raw, star) {
      const k = nameKey(raw);
      if (!teachers.has(k)) teachers.set(k, { name: clean(raw), star: false });
      const t = teachers.get(k);
      if (clean(raw).length > t.name.length) t.name = clean(raw);
      t.star = t.star || star;
      return k;
    }
    const courses = [];
    sheets.forEach((sh, si) => {
      const m = /(\d)/.exec(sh.name);
      const year = m ? +m[1] : si + 1;
      let current = null, parent = null;
      for (let r = 2; r < sh.rows.length; r++) {
        const row = sh.rows[r] || [];
        const no = row[0], code = clean(row[1]), name = clean(row[2]);
        let credit = clean(row[3]), cat = clean(row[4]);
        const tname = row[5], mark = row[7];
        if (typeof no === "string" && no.trim().startsWith("รวม")) break;
        const star = !isEmpty(mark) && String(mark).includes("*");
        if (code) {
          let parsed = parseCredit(credit);
          if (isEmpty(no) && parent) { parsed = parent.credit; cat = parent.cat; }
          if (!parsed) { warnings.push({ level: "error", msg: `ปี ${year} ${code}: อ่านหน่วยกิต "${credit}" ไม่ได้`, fix: "ตรวจรูปแบบในคอลัมน์ D เช่น 3(2-2-5)" }); continue; }
          if (!name) warnings.push({ level: "error", msg: `ปี ${year} รหัส ${code}: ไม่มีชื่อรายวิชา`, fix: "ใส่ชื่อรายวิชาในคอลัมน์ C ของแถวนี้" });
          current = { year, code, name, credit: parsed, cat, kindCat: catOf(cat),
            teachers: isEmpty(tname) ? [] : [teacher(tname, star)], combinedHours: null, set: null };
          if (current.kindCat === "elective") {
            if (!isEmpty(no)) parent = { credit: parsed, cat, id: `E${year}-${no}` };
            current.set = parent ? parent.id : `E${year}-${code}`;
          } else parent = null;
          courses.push(current);
        } else if (!isEmpty(tname) && current) {
          current.teachers.push(teacher(tname, star));
          const h = /เรียน\s*(\d+)\s*ชม/.exec(credit);
          if (h) current.combinedHours = +h[1];
        }
      }
    });

    // ตรวจภาพรวมของไฟล์
    if (!courses.length) warnings.push({ level: "error", msg: "ไม่พบรายวิชาในไฟล์ (ไฟล์ว่างหรือรูปแบบไม่ตรงแม่แบบ)",
      fix: "ใช้ไฟล์ตามแม่แบบ: แยกชีตตามชั้นปี ข้อมูลเริ่มแถวที่ 3 คอลัมน์ B = รหัสวิชา, C = ชื่อวิชา, D = หน่วยกิต (กด ⬇ ไฟล์แม่แบบ)" });
    sheets.forEach((sh, si) => {
      const m = /(\d)/.exec(sh.name), y = m ? +m[1] : si + 1;
      if (courses.length && !courses.some(c => c.year === y)) warnings.push({ level: "warn", msg: `ชีต "${sh.name}" ไม่มีรายวิชา`, fix: "ตรวจว่าใส่ข้อมูลในชีตนี้ครบหรือไม่ ถ้าตั้งใจเว้นไว้ ข้ามได้" });
    });
    const seen = {};
    courses.forEach(c => { const k = c.year + "|" + c.code; seen[k] = (seen[k] || 0) + 1; });
    Object.entries(seen).filter(([, n]) => n > 1).forEach(([k, n]) => {
      const [y, code] = k.split("|");
      warnings.push({ level: "error", msg: `รหัสวิชา ${code} ซ้ำ ${n} แถวในชั้นปีที่ ${y} (จะถูกจัดซ้ำ ${n} ครั้ง)`,
        fix: "ลบแถวที่ซ้ำ หรือแก้รหัสให้ถูก — ถ้าเป็นผู้สอนร่วม ให้ใส่ชื่อผู้สอนคนที่ 2 ในแถวถัดไปโดยเว้นรหัสวิชาว่าง" });
    });
    courses.filter(c => !c.teachers.length && !cfg.noScheduleYears.includes(c.year)).forEach(c =>
      warnings.push({ level: "error", msg: `${c.code} ${c.name || ""}: ไม่มีผู้สอน`, fix: "ใส่ชื่ออาจารย์ผู้สอนในคอลัมน์ F ของแถววิชานี้" }));

    // ครู
    const mgrKeys = new Set(cfg.managers.map(nameKey));
    const tlist = [...teachers.entries()].sort((a, b) => a[1].name < b[1].name ? -1 : 1);
    const tid = {};
    const teacherRows = tlist.map(([k, t], i) => {
      tid[k] = "T" + String(i + 1).padStart(2, "0");
      const mgr = mgrKeys.has(k);
      if (mgr !== t.star) warnings.push({ level: "warn", msg: `${t.name}: รายชื่อผู้บริหารในคำชี้แจงไม่ตรงกับเครื่องหมาย * ในไฟล์`, fix: "ตรวจรายชื่อผู้บริหารในการตั้งค่า" });
      return { id: tid[k], name: t.name, role: mgr ? "Manager" : "Teacher" };
    });
    const missMgr = [...mgrKeys].filter(k => !teachers.has(k));
    if (courses.length && missMgr.length) warnings.push({ level: "warn", msg: `ผู้บริหารที่ไม่พบในรายวิชา: ${missMgr.join(", ")}`, fix: "ตรวจการสะกดชื่อในการตั้งค่า (managers) — ถ้าผู้บริหารคนนั้นไม่ได้สอนเทอมนี้ ข้ามได้" });

    // กลุ่ม
    const groups = [];
    for (const [y, [n, size]] of Object.entries(cfg.groups))
      for (let g = 1; g <= n; g++) {
        const id = `${y}/${g}`;
        groups.push({ id, year: +y, size, home: cfg.homeRooms[id] || "" });
        if (!cfg.homeRooms[id]) warnings.push({ level: "error", msg: `กลุ่ม ${id} ไม่มีห้องประจำ`, fix: "เพิ่มใน homeRooms" });
      }
    const homeOf = Object.fromEntries(groups.map(g => [g.id, g.home]));

    // วิชา + ตอนเรียน
    const facilityFor = (nm) => {
      for (const f of cfg.facilities) if (f.kw.some(k => nm.includes(k))) return f.id;
      return "";
    };
    const subjects = [], sections = [];
    for (const c of courses) {
      const cr = c.credit, field = cr.lec === null;
      let hours = field ? c.combinedHours : cr.lec + cr.pra;
      if (cfg.noScheduleYears.includes(c.year)) hours = 0;
      if (field && hours === null) { warnings.push({ level: "warn", msg: `${c.code}: วิชาฝึกไม่มีจำนวนชั่วโมงที่ต้องจัด จึงไม่จัดคาบ`, fix: "ระบุ 'เรียน X ชม.' ในไฟล์" }); hours = 0; }
      const needFac = c.kindCat === "sport" || c.kindCat === "elective";
      const fac = needFac ? facilityFor(c.name) : "";
      if (needFac && !fac) warnings.push({ level: "error", msg: `${c.code} ${c.name}: หาสนามไม่เจอ`, fix: "เพิ่มคำค้นในรายการสนาม (facilities)" });
      if (!c.kindCat) warnings.push({ level: "error", msg: `${c.code}: ไม่รู้จักกลุ่มวิชา "${c.cat}"`, fix: "เพิ่มชื่อกลุ่มวิชาใน categories" });
      subjects.push({ code: c.code, name: c.name, year: c.year, cat: c.cat, credit: field ? `${cr.credit}(ฝึก)` : `${cr.credit}(${cr.lec}-${cr.pra}-${cr.self})`,
        lec: cr.lec, pra: cr.pra, hours, facility: fac, teachers: c.teachers.map(k => tid[k]) });
      if (!hours || !c.kindCat) continue;
      const ygroups = groups.filter(g => g.year === c.year).map(g => g.id);
      const T = c.teachers.map(k => tid[k]);
      const base = { subject: c.code, name: c.name, year: c.year, teachers: T, hours, set: null, cap: null, anyTheory: false, anyComputer: false };
      const push = (o) => sections.push(Object.assign({ id: "S" + String(sections.length + 1).padStart(3, "0") }, base, o));
      if (c.set) {
        const needT = cfg.electiveNeedsTheoryRoom === "always" || (cfg.electiveNeedsTheoryRoom === "lectureOnly" && cr.lec > 0);
        push({ groups: ygroups, rooms: fac ? [fac] : [], anyTheory: needT, kind: "elective", consecutive: true, set: c.set, cap: cfg.electiveCap });
      } else if (c.combinedHours) {
        push({ groups: ygroups, rooms: [homeOf[ygroups[0]]], kind: "combined", consecutive: false });
      } else if (c.kindCat === "computer") {
        ygroups.forEach(g => push({ groups: [g], rooms: [], anyComputer: true, kind: "computer", consecutive: false }));
      } else if (c.kindCat === "sport") {
        ygroups.forEach(g => push({ groups: [g], rooms: [homeOf[g], fac].filter(Boolean), kind: "sport", consecutive: true }));
      } else {
        ygroups.forEach(g => push({ groups: [g], rooms: [homeOf[g]], kind: "theory", consecutive: false }));
      }
    }
    return { teachers: teacherRows, groups, subjects, sections, warnings };
  };

  // ---------------- โครงเวลา ----------------
  function timeModel(data, cfg) {
    const D = cfg.days.length, P = cfg.periods;
    const locked = {};
    for (let d = 0; d < D; d++) for (let p = 1; p <= P; p++) {
      const l = cfg.locked.find(x => x.period === p && (x.day === "*" || x.day === cfg.days[d]));
      if (l) locked[d * P + p - 1] = l.label;
    }
    const unav = {};  // teacherId -> Set(slot)
    const mgr = data.teachers.filter(t => t.role === "Manager").map(t => t.id);
    for (const t of mgr) {
      unav[t] = new Set();
      for (const b of cfg.managerBlock) {
        const d = cfg.days.indexOf(b.day);
        if (d >= 0) b.periods.forEach(p => unav[t].add(d * P + p - 1));
      }
    }
    for (const u of (cfg.extraUnavailable || [])) {     // [{teacher_id, day, period}]
      const d = cfg.days.indexOf(u.day);
      if (d < 0) continue;
      (unav[u.teacher_id] = unav[u.teacher_id] || new Set()).add(d * P + u.period - 1);
    }
    const free = D * P - Object.keys(locked).length;
    return { D, P, locked, unav, free };
  }
  TT.timeModel = timeModel;

  // ---------------- 2) ตรวจข้อมูลก่อนคำนวณ ----------------
  TT.inputCheck = function (data, cfg) {
    const out = data.warnings.slice();
    const tm = timeModel(data, cfg);
    const gh = {}, th = {};
    const seenSet = new Set();
    for (const s of data.sections) {
      if (s.set) {
        if (!seenSet.has(s.set)) { seenSet.add(s.set); s.groups.forEach(g => gh[g] = (gh[g] || 0) + s.hours); }
      } else s.groups.forEach(g => gh[g] = (gh[g] || 0) + s.hours);
      s.teachers.forEach(t => th[t] = (th[t] || 0) + s.hours);
      if (s.anyComputer) {
        const size = s.groups.reduce((a, g) => a + data.groups.find(x => x.id === g).size, 0);
        if (!cfg.computerRooms.some(r => r.cap >= size)) out.push({ level: "error", msg: `${s.subject} กลุ่ม ${s.groups}: นักศึกษา ${size} คน เกินจำนวนเครื่องคอม`, fix: "เพิ่มห้องคอมหรือแบ่งกลุ่ม" });
      }
      if (s.kind === "combined") {
        const size = s.groups.reduce((a, g) => a + data.groups.find(x => x.id === g).size, 0);
        if (size > cfg.theoryCapacity) out.push({ level: "error", msg: `${s.subject}: เรียนรวม ${size} คน เกินความจุห้อง ${cfg.theoryCapacity}`, fix: "ใช้ห้องที่ใหญ่ขึ้น" });
      }
    }
    for (const [g, h] of Object.entries(gh))
      if (h > tm.free) out.push({ level: "error", msg: `กลุ่ม ${g} ต้องเรียน ${h} คาบ แต่มีช่องว่าง ${tm.free} คาบ`, fix: "ลดวิชาหรือเพิ่มวัน/คาบ" });
    for (const [t, h] of Object.entries(th)) {
      const cap = tm.free - (tm.unav[t] ? tm.unav[t].size : 0);
      if (h > cap) out.push({ level: "error", msg: `${data.teachers.find(x => x.id === t).name} สอน ${h} คาบ เกินเวลาที่ว่าง ${cap}`, fix: "เพิ่มผู้สอน" });
    }
    // วิชาเลือก: ที่นั่งพอ + สนามไม่ซ้ำในชุดเดียวกัน
    const sets = {};
    data.sections.filter(s => s.set).forEach(s => (sets[s.set] = sets[s.set] || []).push(s));
    for (const [id, ss] of Object.entries(sets)) {
      const students = ss[0].groups.reduce((a, gid) => a + (data.groups.find(g => g.id === gid) || { size: 0 }).size, 0);
      if (students > ss.length * cfg.electiveCap) out.push({ level: "error", msg: `ชุดวิชาเลือก ${id}: นักศึกษา ${students} คน แต่รับได้ ${ss.length * cfg.electiveCap}`, fix: "เพิ่มรายวิชาหรือเพิ่มจำนวนรับ" });
      const facs = ss.flatMap(s => s.rooms);
      if (new Set(facs).size !== facs.length) out.push({ level: "error", msg: `ชุดวิชาเลือก ${id}: มีสนามซ้ำกันในชุดที่ต้องเรียนพร้อมกัน`, fix: "ตรวจการจับคู่สนาม" });
      const nT = ss.filter(s => s.anyTheory).length;
      if (nT > cfg.theoryRooms.length) out.push({ level: "error", msg: `ชุดวิชาเลือก ${id}: ต้องใช้ห้องทฤษฎี ${nT} ห้องพร้อมกัน`, fix: "เพิ่มห้อง" });
      else if (nT) out.push({ level: "info", msg: `ชุดวิชาเลือก ${id}: ใช้ห้องทฤษฎี ${nT} ห้องพร้อมกัน ระบบจะยืมห้องที่ว่างในคาบนั้น`, fix: "" });
    }
    return { issues: out, groupHours: gh, teacherHours: th, freeSlots: tm.free, ok: !out.some(x => x.level === "error") };
  };

  // ---------------- 3) ตัวจัดตาราง ----------------
  function buildTasks(data) {
    const mgr = new Set(data.teachers.filter(t => t.role === "Manager").map(t => t.id));
    const tasks = [], bySet = {};
    data.sections.forEach((s, idx) => {
      if (s.set) {
        if (!bySet[s.set]) { bySet[s.set] = { id: s.set, sections: [], order: idx }; tasks.push(bySet[s.set]); }
        bySet[s.set].sections.push(s);
      } else tasks.push({ id: s.id, sections: [s], order: idx });
    });
    for (const t of tasks) {
      const ss = t.sections;
      t.groups = [...new Set(ss.flatMap(s => s.groups))];
      t.teachers = ss.flatMap(s => s.teachers);
      t.fixedRooms = ss.flatMap(s => s.rooms);
      t.nTheory = ss.filter(s => s.anyTheory).length;
      t.nComputer = ss.filter(s => s.anyComputer).length;
      t.hours = ss[0].hours;
      t.year = ss[0].year;
      t.subject = ss[0].subject;
      t.kind = ss[0].kind;
      t.consecutive = ss[0].consecutive;
      t.label = ss[0].set ? `วิชาเลือก ${ss[0].set} (${ss.length} วิชา)` : `${ss[0].subject} ${ss[0].name} [${ss[0].groups.join(",")}]`;
      const w = { elective: 1000, combined: 800, sport: 500, computer: 400, theory: 100 }[t.kind] || 0;
      t.difficulty = w + ss.length * 10 + (t.teachers.length > 1 ? 200 : 0) +
        (t.teachers.some(x => mgr.has(x)) ? 50 : 0) + t.hours * 5;
    }
    return tasks;
  }
  TT.buildTasks = buildTasks;

  function makeState(data, cfg) {
    const tm = timeModel(data, cfg);
    return { tm, busy: new Map(), placed: new Map(), groupDay: {} };
  }
  const K = (type, id, slot) => type + "|" + id + "|" + slot;

  // ตรวจว่าวาง task ช่วง L คาบเริ่มที่ (d, p0) ได้ไหม -> คืนห้องที่เลือก หรือ null
  function canPlace(st, cfg, task, d, p0, L, rng, ignore) {
    const { P, locked, unav } = st.tm;
    if (p0 + L - 1 > P) return null;
    const slots = [];
    for (let p = p0; p < p0 + L; p++) {
      const s = d * P + p - 1;
      if (locked[s] !== undefined) return null;
      slots.push(s);
    }
    const isFree = (k) => { const v = st.busy.get(k); return v === undefined || (ignore && ignore.has(v)); };
    for (const s of slots) {
      for (const g of task.groups) if (!isFree(K("G", g, s))) return null;
      for (const t of task.teachers) { if (!isFree(K("T", t, s))) return null; if (unav[t] && unav[t].has(s)) return null; }
      for (const r of task.fixedRooms) if (!isFree(K("R", r, s))) return null;
    }
    const pick = (pool, n) => {
      if (!n) return [];
      const ok = pool.filter(r => !task.fixedRooms.includes(r) && slots.every(s => isFree(K("R", r, s))));
      if (ok.length < n) return null;
      // เลือกห้องประจำของกลุ่มในชั้นปีเดียวกันก่อน เพื่อเหลือห้องอื่นไว้
      const home = new Set(st.homeByYear ? (st.homeByYear[task.year] || []) : []);
      ok.sort((a, b) => (home.has(b) - home.has(a)) || (rng() - 0.5));
      return ok.slice(0, n);
    };
    const th = pick(cfg.theoryRooms, task.nTheory);
    if (th === null) return null;
    const cp = pick(cfg.computerRooms.map(r => r.id), task.nComputer);
    if (cp === null) return null;
    return { slots, theory: th, computer: cp };
  }

  function occupy(st, task, place, chunkIdx) {
    for (const s of place.slots) {
      task.groups.forEach(g => st.busy.set(K("G", g, s), task.id));
      task.teachers.forEach(t => st.busy.set(K("T", t, s), task.id));
      task.fixedRooms.forEach(r => st.busy.set(K("R", r, s), task.id));
      place.theory.forEach(r => st.busy.set(K("R", r, s), task.id));
      place.computer.forEach(r => st.busy.set(K("R", r, s), task.id));
    }
    const d = Math.floor(place.slots[0] / st.tm.P);
    task.groups.forEach(g => { st.groupDay[g + "|" + d] = (st.groupDay[g + "|" + d] || 0) + place.slots.length; });
    if (st.trace) st.trace.push({ t: "place", id: task.id, groups: task.groups, slots: place.slots.slice(), kind: task.kind });
    if (!st.placed.has(task.id)) st.placed.set(task.id, []);
    st.placed.get(task.id).push(place);
  }
  function release(st, task) {
    const ps = st.placed.get(task.id) || [];
    if (st.trace && ps.length) st.trace.push({ t: "remove", id: task.id, groups: task.groups, slots: ps.flatMap(p => p.slots) });
    for (const place of ps) {
      for (const s of place.slots) {
        task.groups.forEach(g => st.busy.delete(K("G", g, s)));
        task.teachers.forEach(t => st.busy.delete(K("T", t, s)));
        task.fixedRooms.forEach(r => st.busy.delete(K("R", r, s)));
        place.theory.forEach(r => st.busy.delete(K("R", r, s)));
        place.computer.forEach(r => st.busy.delete(K("R", r, s)));
      }
      const d = Math.floor(place.slots[0] / st.tm.P);
      task.groups.forEach(g => { st.groupDay[g + "|" + d] -= place.slots.length; });
    }
    st.placed.delete(task.id);
  }

  // คะแนนโทษของช่อง (ยิ่งน้อยยิ่งดี) — soft constraint
  function penalty(st, task, d, p0, L, usedDays, rng, jitter) {
    let pen = 0;
    for (const g of task.groups) {
      const load = (st.groupDay[g + "|" + d] || 0) + L;
      if (load > 6) pen += (load - 6) * 20;          // ไม่ให้วันเดียวเรียนหนักเกิน 6 คาบ
      pen += load;                                    // กระจายภาระให้สม่ำเสมอ
    }
    if (usedDays.has(d)) pen += 40;                   // วิชาที่ถูกแบ่ง ไม่ควรอยู่วันเดียวกัน
    if (task.kind === "theory" && p0 + L - 1 >= st.tm.P) pen += 3;  // เลี่ยงทฤษฎีคาบสุดท้าย
    return pen + rng() * jitter;
  }

  function chunkPlans(task, cfg) {
    const h = task.hours;
    const plans = [[h]];
    if (!task.consecutive && cfg.allowSplit && h > 2) {
      if (h === 4) plans.push([2, 2]);
      if (h === 3) plans.push([2, 1]);
      if (h > 4) plans.push([Math.ceil(h / 2), Math.floor(h / 2)]);
    }
    return plans;
  }

  function tryTask(st, cfg, task, rng, opts) {
    for (const plan of chunkPlans(task, cfg)) {
      const usedDays = new Set();
      let ok = true;
      for (let ci = 0; ci < plan.length; ci++) {
        const L = plan[ci];
        let best = null;
        for (let d = 0; d < st.tm.D; d++) for (let p = 1; p <= st.tm.P; p++) {
          if (plan.length > 1 && usedDays.has(d)) continue;   // วิชาที่แบ่งช่วง ต้องอยู่คนละวัน
          const pl = canPlace(st, cfg, task, d, p, L, rng);
          if (!pl) continue;
          if (opts.firstFit) { best = { pl, d, pen: 0 }; break; }
          const pen = penalty(st, task, d, p, L, usedDays, rng, opts.jitter);
          if (!best || pen < best.pen) best = { pl, d, pen };
          if (best && opts.firstFit) break;
        }
        if (!best) { ok = false; break; }
        occupy(st, task, best.pl, ci);
        usedDays.add(best.d);
        st.penalty = (st.penalty || 0) + (opts.firstFit ? 0 : Math.floor(best.pen));
        if (opts.firstFit && best) { /* first fit */ }
      }
      if (ok) { task.splitUsed = plan.length > 1; return true; }
      release(st, task);
      if (opts.noSplit) break;
    }
    return false;
  }

  // ซ่อม (plan-act-check): หาช่องที่ชนน้อยที่สุด ย้ายตัวที่ชนออก วางตัวที่ค้าง แล้วจัดตัวที่ถูกย้ายใหม่
  function repair(st, cfg, tasks, unplaced, rng, opts, log) {
    const byId = Object.fromEntries(tasks.map(t => [t.id, t]));
    let iter = 0;
    const kicked = {};
    while (unplaced.length && iter < opts.repairIters) {
      iter++;
      const task = unplaced.shift();
      const L = task.hours;
      const cands = [];
      for (let d = 0; d < st.tm.D; d++) for (let p = 1; p <= st.tm.P; p++) {
        // หาตัวที่ชน (กลุ่ม/ครู/ห้องตายตัว)
        const conflict = new Set();
        let bad = false;
        for (let q = p; q < p + L; q++) {
          const s = d * st.tm.P + q - 1;
          if (q > st.tm.P || st.tm.locked[s] !== undefined) { bad = true; break; }
          for (const t of task.teachers) if (st.tm.unav[t] && st.tm.unav[t].has(s)) bad = true;
          for (const k of [...task.groups.map(g => K("G", g, s)), ...task.teachers.map(t => K("T", t, s)), ...task.fixedRooms.map(r => K("R", r, s))]) {
            const v = st.busy.get(k);
            if (v !== undefined) conflict.add(v);
          }
        }
        if (bad) continue;
        let cost = 0;
        for (const c of conflict) cost += byId[c].difficulty + (kicked[c] || 0) * 300;
        cands.push({ d, p, conflict, cost: cost + rng() * 50 });
      }
      cands.sort((a, b) => a.cost - b.cost);
      let done = false;
      for (const c of cands.slice(0, 8)) {
        const evicted = [...c.conflict].map(id => byId[id]);
        const saved = evicted.map(t => [t, st.placed.get(t.id)]);
        const tr0 = st.trace; st.trace = null;
        evicted.forEach(t => release(st, t));
        st.trace = tr0;
        const pl = canPlace(st, cfg, task, c.d, c.p, L, rng);
        if (pl) {
          if (st.trace) {
            st.trace.push({ t: "repair", id: task.id, evicted: evicted.map(t => t.id) });
            for (const [t, ps] of saved) st.trace.push({ t: "remove", id: t.id, groups: t.groups, slots: ps.flatMap(p => p.slots) });
          }
          occupy(st, task, pl, 0);
          evicted.forEach(t => { kicked[t.id] = (kicked[t.id] || 0) + 1; });
          for (const t of evicted) if (!tryTask(st, cfg, t, rng, opts)) unplaced.push(t);
          log.push(`ซ่อม: วาง ${task.label} โดยย้าย ${evicted.length} รายการ`);
          done = true;
          break;
        }
        // คืนสภาพ (ไม่บันทึกลง trace)
        const tr = st.trace; st.trace = null;
        for (const [t, ps] of saved) for (const pl2 of ps) occupy(st, t, pl2, 0);
        st.trace = tr;
      }
      if (!done) unplaced.push(task);
    }
    return unplaced;
  }

  function buildOutput(st, data, cfg, tasks) {
    const rows = [];
    const { P } = st.tm;
    for (const task of tasks) {
      const ps = st.placed.get(task.id);
      if (!ps) continue;
      for (const pl of ps) {
        let ti = 0, ci = 0;
        const theoryFor = {}, compFor = {};
        task.sections.forEach(s => {
          if (s.anyTheory) theoryFor[s.id] = pl.theory[ti++];
          if (s.anyComputer) compFor[s.id] = pl.computer[ci++];
        });
        for (const slot of pl.slots)
          for (const s of task.sections) {
            const rooms = s.rooms.concat(theoryFor[s.id] ? [theoryFor[s.id]] : [], compFor[s.id] ? [compFor[s.id]] : []);
            rows.push({ slot, day: cfg.days[Math.floor(slot / P)], period: slot % P + 1, section: s.id, subject: s.subject,
              name: s.name, kind: s.kind, set: s.set || "", groups: s.groups.slice(), teachers: s.teachers.slice(), rooms });
          }
      }
    }
    rows.sort((a, b) => a.slot - b.slot || a.section.localeCompare(b.section));
    return rows;
  }

  // แก้ปัญหา 1 รอบด้วย seed หนึ่ง
  TT.solveOnce = function (data, cfg, seed, opts) {
    opts = Object.assign({ jitter: 8, repairIters: 400, firstFit: false, noSplit: false, ordered: true, repair: true }, opts || {});
    const rng = TT.mulberry32(seed >>> 0);
    const st = makeState(data, cfg);
    st.trace = opts.trace ? [] : null;
    st.homeByYear = {};
    data.groups.forEach(g => (st.homeByYear[g.year] = st.homeByYear[g.year] || []).push(g.home));
    const tasks = buildTasks(data);
    let order = tasks.slice();
    if (opts.ordered) {
      const key = new Map(order.map(t => [t.id, t.difficulty + rng() * 30]));
      order.sort((a, b) => key.get(b.id) - key.get(a.id));
    } else if (opts.shuffle) {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    }
    if (st.trace) st.trace.push({ t: "plan", order: order.map(t => t.id) });
    const log = [];
    let unplaced = [];
    for (const t of order) if (!tryTask(st, cfg, t, rng, opts)) { unplaced.push(t); if (st.trace) st.trace.push({ t: "fail", id: t.id, groups: t.groups }); }
    if (st.trace && unplaced.length) st.trace.push({ t: "check", unplaced: unplaced.map(t => t.id) });
    const greedyUnplaced = unplaced.length;
    if (opts.repair && unplaced.length) unplaced = repair(st, cfg, tasks, unplaced, rng, opts, log);
    const rows = buildOutput(st, data, cfg, tasks);
    const unplacedHours = unplaced.reduce((a, t) => a + t.hours * t.sections.length, 0);
    return { seed, rows, unplaced: unplaced.map(t => ({ id: t.id, label: t.label, hours: t.hours })), unplacedHours,
      penalty: Math.round(st.penalty || 0), greedyUnplaced, splits: tasks.filter(t => t.splitUsed).length, log,
      trace: st.trace, meta: Object.fromEntries(tasks.map(t => [t.id, { label: t.label, kind: t.kind, hours: t.hours }])) };
  };

  // วิธีพื้นฐาน (baseline): ลำดับตามไฟล์ วางช่องแรกที่ว่าง ไม่แบ่ง ไม่ซ่อม
  TT.solveBaseline = function (data, cfg) {
    return TT.solveOnce(data, cfg, 1, { ordered: false, firstFit: true, repair: false, noSplit: true, jitter: 0 });
  };

  // ---------------- 4) ตัวตรวจผล ----------------
  TT.validate = function (data, cfg, rows) {
    const tm = timeModel(data, cfg);
    const checks = [];
    const add = (name, items) => checks.push({ name, pass: items.length === 0, count: items.length, items: items.slice(0, 50) });
    const secById = Object.fromEntries(data.sections.map(s => [s.id, s]));
    const tName = Object.fromEntries(data.teachers.map(t => [t.id, t.name]));
    const at = (r) => `${r.day} คาบ ${r.period}`;

    // 1 จำนวนคาบครบ
    const cnt = {};
    rows.forEach(r => cnt[r.section] = (cnt[r.section] || 0) + 1);
    add("1. ทุกตอนเรียนได้คาบครบตามหน่วยกิต (บรรยาย+ปฏิบัติ)", data.sections.filter(s => (cnt[s.id] || 0) !== s.hours)
      .map(s => `${s.subject} ${s.name} [${s.groups}] ได้ ${cnt[s.id] || 0}/${s.hours} คาบ`));
    // 2 ช่องล็อก
    add("2. ไม่จัดในคาบพักเที่ยง/พบอาจารย์ที่ปรึกษา/กิจกรรม", rows.filter(r => tm.locked[r.slot] !== undefined)
      .map(r => `${r.subject} [${r.groups}] ${at(r)} (${tm.locked[r.slot]})`));
    // 3-5 ชนกัน: นับต่อตอนเรียน
    const clash = (keyFn, label) => {
      const m = {};
      rows.forEach(r => keyFn(r).forEach(k => { const kk = k + "|" + r.slot; (m[kk] = m[kk] || new Set()).add(r.section); }));
      return Object.entries(m).filter(([, v]) => v.size > 1).map(([k, v]) => {
        const [id, slot] = k.split("|"); const s = +slot;
        return `${label(id)} ${cfg.days[Math.floor(s / tm.P)]} คาบ ${s % tm.P + 1}: ${[...v].map(x => secById[x].subject).join(", ")}`;
      });
    };
    add("3. ผู้สอนไม่สอนซ้อนคาบ", clash(r => r.teachers, id => tName[id]));
    add("4. ห้อง/สนามไม่ซ้อนคาบ", clash(r => r.rooms, id => "ห้อง " + id));
    add("5. กลุ่มเรียนไม่เรียนซ้อนคาบ (ยกเว้นวิชาเลือกในชุดเดียวกัน)", (() => {
      const m = {};
      rows.forEach(r => r.groups.forEach(g => { const kk = g + "|" + r.slot; (m[kk] = m[kk] || []).push(r); }));
      return Object.entries(m).filter(([, v]) => {
        const keys = new Set(v.map(r => r.set || r.section));
        return keys.size > 1;
      }).map(([k, v]) => `กลุ่ม ${k.split("|")[0]} ${at(v[0])}: ${[...new Set(v.map(r => r.set || r.subject))].join(", ")}`);
    })());
    // 6 ผู้บริหาร
    add("6. ผู้บริหารไม่สอนในเวลาประชุม (อังคาร คาบ 1-4)", rows.flatMap(r => r.teachers.filter(t => tm.unav[t] && tm.unav[t].has(r.slot))
      .map(t => `${tName[t]} ${at(r)} ${r.subject}`)));
    // 7 ประเภทห้อง
    const comp = new Set(cfg.computerRooms.map(r => r.id)), theo = new Set(cfg.theoryRooms);
    add("7. ใช้ห้องถูกประเภท (ทฤษฎี/คอมพิวเตอร์/ห้องเรียน+สนาม)", rows.filter(r => {
      const s = secById[r.section];
      if (!s.rooms.every(x => r.rooms.includes(x))) return true;
      if (s.anyComputer && !r.rooms.some(x => comp.has(x))) return true;
      if (s.anyTheory && !r.rooms.some(x => theo.has(x) && !s.rooms.includes(x))) return true;
      return false;
    }).map(r => `${r.subject} [${r.groups}] ${at(r)} ห้อง ${r.rooms}`));
    // 8 สอนร่วม
    add("8. วิชาสอนร่วม: ผู้สอนทุกคนอยู่ในคาบเดียวกัน", rows.filter(r => {
      const s = secById[r.section];
      return s.teachers.some(t => !r.teachers.includes(t));
    }).map(r => `${r.subject} ${at(r)}`));
    // 9 คาบติดกัน
    add("9. วิชาทักษะกีฬา/วิชาเลือก เรียนคาบติดกันในวันเดียว", data.sections.filter(s => s.consecutive).filter(s => {
      const sl = rows.filter(r => r.section === s.id).map(r => r.slot).sort((a, b) => a - b);
      if (!sl.length) return false;
      return sl.some((x, i) => i > 0 && x !== sl[i - 1] + 1) || Math.floor(sl[0] / tm.P) !== Math.floor(sl[sl.length - 1] / tm.P);
    }).map(s => `${s.subject} ${s.name} [${s.groups}]`));
    // 10 วิชาเลือกพร้อมกัน
    const setSlots = {};
    rows.filter(r => r.set).forEach(r => { (setSlots[r.set] = setSlots[r.set] || {})[r.section] = (setSlots[r.set][r.section] || []).concat(r.slot); });
    add("10. วิชาเลือกในชุดเดียวกันจัดเวลาเดียวกันทุกวิชา", Object.entries(setSlots).filter(([, m]) => {
      const sigs = Object.values(m).map(a => a.sort((x, y) => x - y).join(","));
      return new Set(sigs).size > 1;
    }).map(([id]) => `ชุด ${id}`));
    // 11 ความจุ
    const gsize = Object.fromEntries(data.groups.map(g => [g.id, g.size]));
    const ccap = Object.fromEntries(cfg.computerRooms.map(r => [r.id, r.cap]));
    add("11. ความจุห้องเพียงพอ", rows.filter(r => {
      const n = r.kind === "elective" ? cfg.electiveCap : r.groups.reduce((a, g) => a + gsize[g], 0);
      return r.rooms.some(x => (ccap[x] !== undefined && n > ccap[x]) || (theo.has(x) && n > cfg.theoryCapacity));
    }).map(r => `${r.subject} ${at(r)}`));
    const passed = checks.filter(c => c.pass).length;
    const conflicts = checks.slice(1).reduce((a, c) => a + c.count, 0);
    return { checks, passed, total: checks.length, conflicts, missing: checks[0].count };
  };

  // ---------------- ขยายข้อมูล k เท่า (stress test) ----------------
  TT.scaleData = function (data, cfg, k) {
    const c2 = JSON.parse(JSON.stringify(cfg));
    const d2 = { teachers: [], groups: [], subjects: data.subjects, sections: [], warnings: [] };
    c2.theoryRooms = []; c2.computerRooms = []; c2.facilities = [];
    for (let c = 0; c < k; c++) {
      const sx = c ? "#" + (c + 1) : "";
      data.teachers.forEach(t => d2.teachers.push(Object.assign({}, t, { id: t.id + sx, name: t.name + sx })));
      data.groups.forEach(g => d2.groups.push(Object.assign({}, g, { id: g.id + sx, home: g.home + sx })));
      cfg.theoryRooms.forEach(r => c2.theoryRooms.push(r + sx));
      cfg.computerRooms.forEach(r => c2.computerRooms.push(Object.assign({}, r, { id: r.id + sx })));
      cfg.facilities.forEach(f => c2.facilities.push(Object.assign({}, f, { id: f.id + sx })));
      data.sections.forEach(s => d2.sections.push(Object.assign({}, s, { id: s.id + sx, groups: s.groups.map(g => g + sx),
        teachers: s.teachers.map(t => t + sx), rooms: s.rooms.map(r => r + sx), set: s.set ? s.set + sx : null })));
    }
    return { data: d2, cfg: c2 };
  };

  // ---------------- สถิติ ----------------
  TT.stats = function (data, cfg, rows) {
    const tm = timeModel(data, cfg);
    const teacherLoad = {}, roomUse = {};
    const seenT = new Set(), seenR = new Set();
    rows.forEach(r => {
      r.teachers.forEach(t => { const k = t + "|" + r.slot; if (!seenT.has(k)) { seenT.add(k); teacherLoad[t] = (teacherLoad[t] || 0) + 1; } });
      r.rooms.forEach(x => { const k = x + "|" + r.slot; if (!seenR.has(k)) { seenR.add(k); roomUse[x] = (roomUse[x] || 0) + 1; } });
    });
    return { teacherLoad, roomUse, freeSlots: tm.free };
  };

  if (typeof module !== "undefined") module.exports = TT; else window.TT = TT;
})();

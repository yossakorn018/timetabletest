/* app.js — หน้าจอระบบจัดตาราง */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const S = { cfg: null, sheets: null, draft: null, data: null, check: null, runs: [], current: null, baseline: null, cancel: false };

  // ---------- แท็บ ----------
  document.querySelectorAll("nav button").forEach(b => b.onclick = () => showTab(b.dataset.tab));
  function showTab(id) {
    document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
    document.querySelectorAll("section.tab").forEach(s => s.hidden = s.id !== id);
    if (id === "view") renderView();
    if (id === "report") renderReport();
  }
  // เอฟเฟกต์คลื่นตอนกดปุ่ม
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("button, .filebtn");
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const sp = document.createElement("span");
    sp.className = "ripple";
    sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(sp);
    setTimeout(() => sp.remove(), 600);
  });
  function markDone() {
    const done = { import: !!S.data, solve: !!S.current, check: !!(S.current && S.current.v.passed === S.current.v.total), view: !!S.current, report: !!S.current };
    document.querySelectorAll("nav button").forEach(b => b.classList.toggle("done", !!done[b.dataset.tab]));
  }
  function toast(msg, kind) {
    const t = $("#toast"); t.textContent = msg; t.className = "show " + (kind || "");
    clearTimeout(t._h); t._h = setTimeout(() => t.className = "", 3500);
  }
  const tName = (id) => (S.data.teachers.find(t => t.id === id) || { name: id }).name;

  // ---------- ตั้งค่า ----------
  function loadCfg() {
    let saved = null;
    try { saved = localStorage.getItem("tt_cfg"); } catch (e) { /* ignore */ }
    S.cfg = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(TT.DEFAULT_CONFIG));
    $("#cfg").value = JSON.stringify(S.cfg, null, 2);
  }
  $("#cfgApply").onclick = () => {
    try {
      S.cfg = JSON.parse($("#cfg").value);
      try { localStorage.setItem("tt_cfg", JSON.stringify(S.cfg)); } catch (e) { /* ignore */ }
      toast("บันทึกการตั้งค่าแล้ว", "ok");
      if (S.sheets) parseDraft();
    } catch (e) { toast("รูปแบบ JSON ผิด: " + e.message, "err"); }
  };
  $("#cfgReset").onclick = () => {
    try { localStorage.removeItem("tt_cfg"); } catch (e) { /* ignore */ }
    loadCfg(); toast("คืนค่าเริ่มต้นตามคำชี้แจงแล้ว", "ok");
    if (S.sheets) parseDraft();
  };

  // ---------- 1) นำเข้า ----------
  $("#file").onchange = (e) => loadFile(e.target.files[0]);
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
  async function loadFile(f) {
    if (!f) return;
    if (typeof XLSX === "undefined") { toast("โหลดไลบรารีอ่าน Excel ไม่ได้ ตรวจอินเทอร์เน็ต", "err"); return; }
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      S.sheets = wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, blankrows: true }) }));
      $("#fileName").textContent = `${f.name} — ${wb.SheetNames.length} ชีต (${wb.SheetNames.join(", ")})`;
      parseDraft();
      toast("อ่านไฟล์สำเร็จ ตรวจข้อมูลด้านล่าง", "ok");
    } catch (err) { toast("อ่านไฟล์ไม่ได้: " + err.message, "err"); }
  }

  function parseDraft() {
    S.draft = TT.parseWorkbook(S.sheets, S.cfg);
    const chk = TT.inputCheck(S.draft, S.cfg);
    const d = S.draft;
    $("#preview").hidden = false;
    $("#sumCards").innerHTML = [
      ["ผู้สอน", d.teachers.length], ["กลุ่มเรียน", d.groups.filter(g => chk.groupHours[g.id]).length],
      ["รายวิชา", d.subjects.length], ["ตอนเรียน", d.sections.length],
      ["ช่องเวลาที่จัดได้/สัปดาห์", chk.freeSlots]
    ].map(([k, v]) => `<div class="card"><b>${v}</b><span>${k}</span></div>`).join("");
    renderIssues(chk, "#issues");
    $("#gh").innerHTML = "<tr><th>กลุ่ม</th><th>คาบที่ต้องเรียน</th><th>ช่องว่าง</th></tr>" +
      Object.entries(chk.groupHours).map(([g, h]) => `<tr><td>${g}</td><td>${h}</td><td>${chk.freeSlots}</td></tr>`).join("");
    renderSections();
    $("#saveData").disabled = !chk.ok;
  }
  function renderIssues(chk, sel) {
    const icon = { error: "⛔", warn: "⚠️", info: "ℹ️" };
    $(sel).innerHTML = chk.issues.length ? chk.issues.map(i =>
      `<li class="${i.level}">${icon[i.level]} ${esc(i.msg)}${i.fix ? `<br><small>วิธีแก้: ${esc(i.fix)}</small>` : ""}</li>`).join("")
      : `<li class="ok">✅ ข้อมูลพร้อมจัดตาราง ไม่พบปัญหา</li>`;
  }
  const kindTH = { theory: "ทฤษฎี", computer: "ห้องคอม", sport: "ทักษะกีฬา", combined: "เรียนรวมทั้งชั้นปี", elective: "วิชาเลือก" };
  function renderSections() {
    const q = ($("#secSearch").value || "").trim();
    const d = S.draft, tn = Object.fromEntries(d.teachers.map(t => [t.id, t.name]));
    const rows = d.sections.filter(s => !q || [s.subject, s.name, s.groups.join(","), s.teachers.map(t => tn[t]).join(",")].join(" ").includes(q));
    $("#secTable").innerHTML = "<tr><th>ตอน</th><th>รหัส</th><th>วิชา</th><th>กลุ่ม</th><th>ผู้สอน</th><th>ห้อง/สนาม</th><th>คาบ</th><th>ประเภท</th></tr>" +
      rows.map(s => `<tr><td>${s.id}</td><td>${esc(s.subject)}</td><td>${esc(s.name)}</td><td>${s.groups.join(", ")}</td>
        <td>${s.teachers.map(t => esc(tn[t])).join("<br>")}</td>
        <td>${esc([...s.rooms, s.anyTheory ? "ห้องทฤษฎีที่ว่าง" : "", s.anyComputer ? "ห้องคอมที่ว่าง" : ""].filter(Boolean).join(" + "))}</td>
        <td>${s.hours}</td><td><span class="tag k-${s.kind}">${kindTH[s.kind]}${s.set ? " " + s.set : ""}</span></td></tr>`).join("");
  }
  $("#secSearch").oninput = renderSections;
  $("#saveData").onclick = () => {
    S.data = S.draft; S.check = TT.inputCheck(S.data, S.cfg);
    S.runs = []; S.current = null; S.baseline = null;
    renderIssues(S.check, "#issues2");
    $("#runBtn").disabled = false;
    toast("บันทึกข้อมูลแล้ว ไปขั้นจัดตาราง", "ok");
    markDone();
    showTab("solve");
  };

  // ---------- 2) จัดตาราง ----------
  $("#randSeed").onclick = () => $("#seed").value = Math.floor(Math.random() * 100000);
  $("#cancelBtn").onclick = () => { S.cancel = true; };
  $("#runBtn").onclick = async () => {
    if (!S.data) { toast("ยังไม่ได้นำเข้าข้อมูล", "err"); return; }
    const seed0 = parseInt($("#seed").value, 10) || 0, rounds = Math.max(1, parseInt($("#rounds").value, 10) || 1);
    S.cancel = false;
    $("#runBtn").disabled = true; $("#runBtn").classList.add("loading"); $("#cancelBtn").disabled = false;
    const bar = $("#bar"), status = $("#status");
    const t0 = performance.now();
    status.textContent = "กำลังคำนวณวิธีพื้นฐาน (baseline)...";
    await new Promise(r => setTimeout(r, 20));
    const tb = performance.now();
    const base = TT.solveBaseline(S.data, S.cfg);
    base.ms = performance.now() - tb;
    base.v = TT.validate(S.data, S.cfg, base.rows);
    S.baseline = base;
    let best = null;
    for (let i = 0; i < rounds; i++) {
      if (S.cancel) break;
      const r = TT.solveOnce(S.data, S.cfg, seed0 + i);
      if (!best || r.unplacedHours < best.unplacedHours || (r.unplacedHours === best.unplacedHours && r.penalty < best.penalty)) best = r;
      bar.style.width = ((i + 1) / rounds * 100) + "%";
      status.textContent = `รอบ ${i + 1}/${rounds} (seed ${seed0 + i}) — ดีที่สุด: ขาด ${best.unplacedHours} คาบ, โทษ ${best.penalty}`;
      if (i % 3 === 2) await new Promise(r => setTimeout(r, 0));
    }
    $("#runBtn").disabled = false; $("#runBtn").classList.remove("loading"); $("#cancelBtn").disabled = true;
    if (!best) { status.textContent = "ยกเลิกแล้ว"; return; }
    best.ms = performance.now() - t0;
    best.v = TT.validate(S.data, S.cfg, best.rows);
    best.rounds = rounds; best.seed0 = seed0; best.cancelled = S.cancel;
    best.at = new Date().toLocaleTimeString("th-TH");
    S.runs.unshift(best); S.current = best;
    status.textContent = (S.cancel ? "ยกเลิกระหว่างทาง ใช้ผลที่ดีที่สุดที่ได้ " : "เสร็จแล้ว ") +
      `seed ${best.seed}: ผ่าน ${best.v.passed}/${best.v.total} เงื่อนไข, ชน ${best.v.conflicts}, ขาด ${best.unplacedHours} คาบ`;
    renderCompare(); renderRuns(); renderValidation(); markDone();
    toast(best.v.passed === best.v.total ? "จัดตารางสำเร็จ ผ่านทุกเงื่อนไข" : "จัดได้บางส่วน ดูรายละเอียดที่หน้าตรวจผล", best.v.passed === best.v.total ? "ok" : "err");
  };
  function renderCompare() {
    const b = S.baseline, a = S.current;
    if (!b || !a) return;
    const row = (k, x, y, better) => `<tr><td>${k}</td><td>${x}</td><td class="${better ? "good" : ""}">${y}</td></tr>`;
    $("#compare").innerHTML = `<tr><th>ตัวชี้วัด</th><th>วิธีพื้นฐาน<br><small>ลำดับตามไฟล์ วางช่องแรกที่ว่าง</small></th><th>ระบบ AI<br><small>Heuristic + seed + ซ่อม</small></th></tr>` +
      row("คาบที่จัดไม่ลง", b.unplacedHours, a.unplacedHours, a.unplacedHours < b.unplacedHours) +
      row("ตอนเรียนที่ได้คาบไม่ครบ", b.v.missing, a.v.missing, a.v.missing < b.v.missing) +
      row("จุดที่ขัดแย้ง", b.v.conflicts, a.v.conflicts, a.v.conflicts <= b.v.conflicts) +
      row("เงื่อนไขที่ผ่าน", `${b.v.passed}/${b.v.total}`, `${a.v.passed}/${a.v.total}`, a.v.passed > b.v.passed) +
      row("คะแนนโทษ (กระจายภาระ ยิ่งน้อยยิ่งดี)", "-", a.penalty, true) +
      row("เวลา (ms)", b.ms.toFixed(0), `${a.ms.toFixed(0)} (${a.rounds} รอบ)`, false);
    $("#logBox").textContent = [`seed ที่ได้ผลดีที่สุด: ${a.seed}`, `greedy รอบแรกค้าง ${a.greedyUnplaced} รายการ → ซ่อม ${a.log.length} ครั้ง`,
      `วิชาทฤษฎีที่ถูกแบ่งช่วง: ${a.splits}`, ...a.log.slice(0, 30), ...(a.unplaced.length ? ["ยังจัดไม่ลง:", ...a.unplaced.map(u => " - " + u.label)] : [])].join("\n");
  }
  function renderRuns() {
    $("#runs").innerHTML = "<tr><th>เวลา</th><th>seed เริ่ม</th><th>รอบ</th><th>seed ที่ดีสุด</th><th>ผ่าน</th><th>ขาด</th><th>โทษ</th><th></th></tr>" +
      S.runs.map((r, i) => `<tr class="${r === S.current ? "sel" : ""}"><td>${r.at}</td><td>${r.seed0}</td><td>${r.rounds}</td><td>${r.seed}</td>
        <td>${r.v.passed}/${r.v.total}</td><td>${r.unplacedHours}</td><td>${r.penalty}</td>
        <td><button data-i="${i}" class="small">ใช้ผลนี้</button></td></tr>`).join("");
    $("#runs").querySelectorAll("button").forEach(b => b.onclick = () => { S.current = S.runs[+b.dataset.i]; renderCompare(); renderRuns(); renderValidation(); toast("เลือกผลรอบนี้แล้ว", "ok"); });
  }

  // ---------- 3) ตรวจผล ----------
  function renderValidation() {
    const v = S.current && S.current.v;
    if (!v) return;
    $("#vSummary").innerHTML = `<div class="card ${v.passed === v.total ? "okc" : "errc"}"><b>${v.passed}/${v.total}</b><span>เงื่อนไขที่ผ่าน</span></div>
      <div class="card"><b>${v.conflicts}</b><span>จุดขัดแย้ง</span></div><div class="card"><b>${v.missing}</b><span>ตอนเรียนคาบไม่ครบ</span></div>
      <div class="card"><b>${S.current.rows.length}</b><span>คาบ×ตอนเรียนที่จัดได้</span></div>`;
    $("#vList").innerHTML = v.checks.map(c => `<li class="${c.pass ? "ok" : "error"}">${c.pass ? "✅" : "❌"} ${esc(c.name)}
      ${c.pass ? "" : `<b>(${c.count})</b><ul>${c.items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`}</li>`).join("");
  }

  // ---------- 4) ดูตาราง ----------
  $("#vType").onchange = () => { fillEntities(); renderView(); };
  $("#vEntity").onchange = renderView;
  $("#vSearch").oninput = () => { fillEntities(); renderView(); };
  function entities() {
    const t = $("#vType").value, d = S.data;
    if (t === "group") return d.groups.filter(g => S.check.groupHours[g.id]).map(g => [g.id, "กลุ่ม " + g.id + " (ห้อง " + g.home + ")"]);
    if (t === "teacher") return d.teachers.map(x => [x.id, x.name + (x.role === "Manager" ? " (ผู้บริหาร)" : "")]);
    const used = new Set(S.current ? S.current.rows.flatMap(r => r.rooms) : []);
    const all = [...S.cfg.theoryRooms, ...S.cfg.computerRooms.map(r => r.id), ...S.cfg.facilities.map(f => f.id)];
    return all.map(r => { const f = S.cfg.facilities.find(x => x.id === r); return [r, (f ? f.name : "ห้อง " + r) + (used.has(r) ? "" : " (ว่าง)")]; });
  }
  function fillEntities() {
    if (!S.data) return;
    const q = $("#vSearch").value.trim(), cur = $("#vEntity").value;
    const list = entities().filter(([, n]) => !q || n.includes(q));
    $("#vEntity").innerHTML = list.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("");
    if (list.some(([id]) => id === cur)) $("#vEntity").value = cur;
  }
  function filterRows(type, id) {
    return S.current.rows.filter(r => type === "group" ? r.groups.includes(id) : type === "teacher" ? r.teachers.includes(id) : r.rooms.includes(id));
  }
  function cellText(type, rs) {
    if (!rs.length) return "";
    const set = rs[0].set;
    if (set && type === "group") return `<b>วิชาเลือก (${new Set(rs.map(r => r.section)).size} วิชา)</b><small>${esc([...new Set(rs.map(r => r.name))].join(" / "))}</small>`;
    const r = rs[0];
    const parts = [`<b>${esc(r.subject)}</b>`, `<span>${esc(r.name)}</span>`];
    if (type !== "teacher") parts.push(`<small>${esc(r.teachers.map(tName).join(", "))}</small>`);
    if (type !== "group") parts.push(`<small>กลุ่ม ${esc(r.groups.join(", "))}</small>`);
    if (type !== "room") parts.push(`<small>📍 ${esc(r.rooms.join(" + "))}</small>`);
    return parts.join("");
  }
  function gridHTML(type, id) {
    const tm = TT.timeModel(S.data, S.cfg), P = tm.P;
    const rows = filterRows(type, id);
    const bySlot = {};
    rows.forEach(r => (bySlot[r.slot] = bySlot[r.slot] || []).push(r));
    const keyOf = (rs) => rs && rs.length ? (rs[0].set || rs[0].section) : null;
    let h = `<table class="grid"><tr><th>วัน / คาบ</th>`;
    for (let p = 1; p <= P; p++) h += `<th>${p}<br><small>${String(S.cfg.startHour + p - 1).padStart(2, "0")}:00-${String(S.cfg.startHour + p).padStart(2, "0")}:00</small></th>`;
    h += "</tr>";
    S.cfg.days.forEach((day, d) => {
      h += `<tr><th>${day}</th>`;
      for (let p = 1; p <= P;) {
        const s = d * P + p - 1;
        if (tm.locked[s] !== undefined) { h += `<td class="locked">${esc(tm.locked[s])}</td>`; p++; continue; }
        const rs = bySlot[s];
        if (!rs) {
          const un = type === "teacher" && tm.unav[id] && tm.unav[id].has(s);
          h += `<td class="${un ? "unav" : ""}">${un ? "ประชุม" : ""}</td>`; p++; continue;
        }
        let span = 1;
        while (p + span <= P && keyOf(bySlot[s + span]) === keyOf(rs) && tm.locked[s + span] === undefined) span++;
        h += `<td colspan="${span}" class="cell k-${rs[0].kind}">${cellText(type, rs)}</td>`;
        p += span;
      }
      h += "</tr>";
    });
    return h + "</table>";
  }
  function renderView() {
    if (!S.current) { $("#gridBox").innerHTML = "<p class='muted'>ยังไม่มีผลการจัดตาราง</p>"; return; }
    if (!$("#vEntity").options.length) fillEntities();
    const type = $("#vType").value, id = $("#vEntity").value;
    if (!id) return;
    const opt = $("#vEntity").selectedOptions[0];
    $("#gridTitle").textContent = `ตาราง${{ group: "เรียน", teacher: "สอน", room: "การใช้พื้นที่" }[type]}: ${opt ? opt.textContent : id}`;
    $("#gridBox").innerHTML = gridHTML(type, id);
    $("#printWho").textContent = $("#gridTitle").textContent;
    $("#printInfo").textContent = `seed ${S.current.seed} · ผ่าน ${S.current.v.passed}/${S.current.v.total} เงื่อนไข · พิมพ์ ${new Date().toLocaleString("th-TH")}`;
  }
  $("#printBtn").onclick = () => window.print();

  // ---------- ส่งออก ----------
  function download(name, blob) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csvLine = (a) => a.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",");
  $("#csvBtn").onclick = () => {
    if (!S.current) return toast("ยังไม่มีผล", "err");
    const lines = [csvLine(["day", "period", "start", "end", "section_id", "subject_id", "subject_name", "kind", "elective_set", "group_ids", "teacher_ids", "teacher_names", "room_ids"])];
    S.current.rows.forEach(r => lines.push(csvLine([r.day, r.period, `${String(S.cfg.startHour + r.period - 1).padStart(2, "0")}:00`, `${String(S.cfg.startHour + r.period).padStart(2, "0")}:00`,
      r.section, r.subject, r.name, r.kind, r.set, r.groups.join(";"), r.teachers.join(";"), r.teachers.map(tName).join(";"), r.rooms.join(";")])));
    download(`timetable_seed${S.current.seed}.csv`, new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }));
  };
  $("#xlsxBtn").onclick = () => {
    if (!S.current) return toast("ยังไม่มีผล", "err");
    const tm = TT.timeModel(S.data, S.cfg), P = tm.P, wb = XLSX.utils.book_new();
    const plain = (type, rs) => {
      if (!rs || !rs.length) return "";
      if (rs[0].set && type === "group") return "วิชาเลือก: " + [...new Set(rs.map(r => r.name))].join(" / ");
      const r = rs[0];
      return [r.subject + " " + r.name, type !== "teacher" ? r.teachers.map(tName).join(", ") : "", type !== "group" ? "กลุ่ม " + r.groups.join(",") : "", type !== "room" ? r.rooms.join("+") : ""].filter(Boolean).join("\n");
    };
    const addGrid = (sheetName, type, id) => {
      const rows = filterRows(type, id), bySlot = {};
      rows.forEach(r => (bySlot[r.slot] = bySlot[r.slot] || []).push(r));
      const aoa = [["วัน/คาบ", ...Array.from({ length: P }, (_, i) => `${i + 1} (${S.cfg.startHour + i}:00)`)]];
      S.cfg.days.forEach((day, d) => aoa.push([day, ...Array.from({ length: P }, (_, i) => { const s = d * P + i; return tm.locked[s] !== undefined ? tm.locked[s] : plain(type, bySlot[s]); })]));
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [{ wch: 10 }, ...Array(P).fill({ wch: 26 })];
      XLSX.utils.book_append_sheet(wb, ws, sheetName.replace(/[\\/?*[\]:]/g, "-").slice(0, 31));
    };
    S.data.groups.filter(g => S.check.groupHours[g.id]).forEach(g => addGrid("กลุ่ม " + g.id, "group", g.id));
    S.data.teachers.forEach(t => addGrid(t.id + " " + t.name, "teacher", t.id));
    const used = [...new Set(S.current.rows.flatMap(r => r.rooms))];
    used.forEach(r => addGrid("ห้อง " + r, "room", r));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(S.current.rows.map(r => ({ day: r.day, period: r.period, section: r.section, subject: r.subject, name: r.name, groups: r.groups.join(";"), teachers: r.teachers.map(tName).join(";"), rooms: r.rooms.join(";") }))), "ข้อมูลดิบ");
    XLSX.writeFile(wb, `timetable_seed${S.current.seed}.xlsx`);
  };

  // ---------- 5) รายงาน ----------
  function renderReport() {
    if (!S.current) { $("#reportBox").innerHTML = "<p class='muted'>ยังไม่มีผลการจัดตาราง</p>"; return; }
    const st = TT.stats(S.data, S.cfg, S.current.rows);
    const tl = S.data.teachers.map(t => [t, st.teacherLoad[t.id] || 0]).sort((a, b) => b[1] - a[1]);
    const maxT = Math.max(...tl.map(x => x[1]), 1);
    const rooms = Object.entries(st.roomUse).sort((a, b) => b[1] - a[1]);
    const totalUse = rooms.reduce((a, [, v]) => a + v, 0);
    $("#reportBox").innerHTML = `
      <div class="cards"><div class="card"><b>${tl.reduce((a, x) => a + x[1], 0)}</b><span>ชั่วโมงสอนรวม/สัปดาห์</span></div>
      <div class="card"><b>${(tl.reduce((a, x) => a + x[1], 0) / tl.filter(x => x[1]).length).toFixed(1)}</b><span>ภาระสอนเฉลี่ย (คาบ/คน)</span></div>
      <div class="card"><b>${rooms.length}</b><span>ห้อง/สนามที่ใช้</span></div>
      <div class="card"><b>${(totalUse / (rooms.length * st.freeSlots) * 100).toFixed(0)}%</b><span>อัตราใช้ห้องเฉลี่ย (เฉพาะที่ใช้)</span></div></div>
      <h3>ภาระสอนของผู้สอน (นับวิชาสอนร่วมให้ทุกคน)</h3>
      <table class="list"><tr><th>ผู้สอน</th><th>บทบาท</th><th>คาบ/สัปดาห์</th><th></th></tr>${tl.map(([t, n]) =>
        `<tr><td>${esc(t.name)}</td><td>${t.role === "Manager" ? "ผู้บริหาร" : "อาจารย์"}</td><td>${n}</td><td><div class="hbar" style="width:${n / maxT * 100}%"></div></td></tr>`).join("")}</table>
      <h3>อัตราการใช้ห้องและสนาม (จาก ${st.freeSlots} ช่องที่จัดได้)</h3>
      <table class="list"><tr><th>ห้อง/สนาม</th><th>คาบที่ใช้</th><th>อัตราใช้</th><th></th></tr>${rooms.map(([r, n]) =>
        `<tr><td>${esc(r)}</td><td>${n}</td><td>${(n / st.freeSlots * 100).toFixed(0)}%</td><td><div class="hbar" style="width:${n / st.freeSlots * 100}%"></div></td></tr>`).join("")}</table>`;
  }

  // ---------- ไฟล์แม่แบบ ----------
  $("#tplBtn").onclick = () => {
    if (typeof XLSX === "undefined") return toast("โหลดไลบรารีอ่าน Excel ไม่ได้ ตรวจอินเทอร์เน็ต", "err");
    const wb = XLSX.utils.book_new();
    Object.keys(S.cfg.groups).forEach(y => {
      const aoa = [[`คณะ...  ชั้นปีที่ ${y}`], ["ที่", "รหัสวิชา", "ชื่อรายวิชา", "หน่วยกิต", "กลุ่มวิชา", "อาจารย์ผู้สอน", "", "หมายเหตุ (* = ผู้บริหาร)"],
        [1, "", "", "3(2-2-5)", "", "", "", ""], ["", "", "", "", "", "(ผู้สอนร่วม ใส่แถวถัดไป)", "", ""], ["รวม"]];
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [{ wch: 5 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 26 }, { wch: 30 }, { wch: 4 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, "ชั้นปีที่" + y);
    });
    XLSX.writeFile(wb, "แม่แบบรายวิชา.xlsx");
  };

  // ---------- เริ่มต้น ----------
  loadCfg();
  showTab("import");
  // ไฟล์ฉบับฝังข้อมูล: โหลดข้อมูล -> บันทึก -> จัดตารางอัตโนมัติ
  if (window.EMBED) {
    S.sheets = window.EMBED.sheets;
    $("#fileName").textContent = `ข้อมูลที่นำเข้าแล้ว: ${window.EMBED.fileName}`;
    parseDraft();
    if (!$("#saveData").disabled) {
      $("#saveData").click();
      $("#runBtn").onclick().then(() => showTab("view"));
    }
  }
})();

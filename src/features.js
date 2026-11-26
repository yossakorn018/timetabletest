  // =====================================================================
  //  ฟีเจอร์เสริม: แอนิเมชัน AI, ลากย้ายวิชา, หลักฐานเชิงตัวเลข, QR Code
  // =====================================================================
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const cssId = (s) => String(s).replace(/[^a-zA-Z0-9]/g, "_");
  const hhmm = (p) => `${String(S.cfg.startHour + p - 1).padStart(2, "0")}:00`;

  // ---------- 1) ดู AI จัดตารางแบบเคลื่อนไหว ----------
  let anim = null;
  function overviewSkeleton() {
    const tm = TT.timeModel(S.data, S.cfg), P = tm.P;
    const groups = S.data.groups.filter(g => S.check.groupHours[g.id]);
    let h = `<table class="ov"><tr><th></th>${S.cfg.days.map(d => `<th colspan="${P}" class="day">${d}</th>`).join("")}</tr>`;
    h += `<tr><th></th>${S.cfg.days.map(() => Array.from({ length: P }, (_, i) => `<th class="p">${i + 1}</th>`).join("")).join("")}</tr>`;
    groups.forEach(g => {
      h += `<tr><th id="ovg-${cssId(g.id)}">${g.id}</th>`;
      for (let s = 0; s < S.cfg.days.length * P; s++)
        h += `<td id="ov-${cssId(g.id)}-${s}" class="${tm.locked[s] !== undefined ? "locked" : ""}${s % P === 0 ? " dstart" : ""}"></td>`;
      h += "</tr>";
    });
    return h + "</table>";
  }
  function setPhase(p) {
    ["plan", "act", "repair", "check"].forEach(x => $("#ph-" + x).classList.toggle("on", x === p));
  }
  function alog(msg, cls) {
    const li = document.createElement("li");
    li.className = cls || ""; li.textContent = msg;
    const ul = $("#animLog"); ul.prepend(li);
    while (ul.children.length > 9) ul.lastChild.remove();
  }
  function paint(e, cls) {
    e.groups.forEach(g => e.slots.forEach(s => {
      const td = document.getElementById(`ov-${cssId(g)}-${s}`);
      if (!td) return;
      td.className = td.className.replace(/\bk-\w+|\bpop|\bflash/g, "").trim();
      if (cls) { void td.offsetWidth; td.classList.add(...cls.split(" ")); }
    }));
  }
  $("#animBtn").onclick = async () => {
    if (!S.current) return toast("กดจัดตารางก่อน", "err");
    if (anim) anim.stop = true;
    const me = anim = { stop: false };
    const r = TT.solveOnce(S.data, S.cfg, S.current.seed, { trace: true });
    $("#ovBox").innerHTML = overviewSkeleton();
    $("#animLog").innerHTML = "";
    const delay = () => 250 - (+$("#animSpeed").value);
    const total = Object.values(r.meta).length;
    let placed = new Set(), repairs = 0;
    const stat = () => $("#animStat").innerHTML = `<span>วางแล้ว <b>${placed.size}</b>/${total} บล็อก</span><span>ซ่อม <b>${repairs}</b> ครั้ง</span><span>seed <b>${r.seed}</b></span>`;
    $("#animBtn").classList.add("loading");
    for (const e of r.trace) {
      if (me.stop) break;
      if (e.t === "plan") {
        setPhase("plan");
        alog(`Plan: เรียง ${e.order.length} บล็อกจากยากไปง่าย — เริ่มที่ "${r.meta[e.order[0]].label}"`, "plan");
        await sleep(900); setPhase("act"); continue;
      }
      if (e.t === "place") {
        placed.add(e.id); paint(e, `k-${e.kind} pop`);
        alog(`Act: วาง ${r.meta[e.id].label}`);
      } else if (e.t === "remove") {
        placed.delete(e.id); paint(e, "flash");
        await sleep(delay() * 1.5); paint(e, null);
        alog(`ย้ายออก: ${r.meta[e.id].label}`, "warn");
      } else if (e.t === "fail") {
        setPhase("check");
        e.groups.forEach(g => { const th = document.getElementById("ovg-" + cssId(g)); if (th) { th.classList.remove("shake"); void th.offsetWidth; th.classList.add("shake"); } });
        alog(`Check: วาง ${r.meta[e.id].label} ไม่ลง → ส่งเข้าคิวซ่อม`, "err");
        await sleep(delay() * 3); setPhase("act");
      } else if (e.t === "repair") {
        setPhase("repair"); repairs++;
        alog(`Repair: หาช่องที่ชนน้อยสุดให้ ${r.meta[e.id].label} แล้วย้าย ${e.evicted.length} บล็อกไปที่อื่น`, "plan");
        await sleep(delay() * 2);
      }
      stat();
      await sleep(delay());
    }
    $("#animBtn").classList.remove("loading");
    if (me.stop) return;
    setPhase("check");
    const v = TT.validate(S.data, S.cfg, r.rows);
    alog(`Check: ตัวตรวจอิสระผ่าน ${v.passed}/${v.total} เงื่อนไข ชน ${v.conflicts} จุด ขาด ${r.unplacedHours} คาบ`, v.passed === v.total ? "ok" : "err");
    stat();
  };
  $("#animStop").onclick = () => { if (anim) anim.stop = true; $("#animBtn").classList.remove("loading"); };

  // ---------- 2) ลากย้ายวิชา ----------
  let drag = null;
  S.undo = []; S.moves = [];
  function chunkRows(d) {
    return S.current.rows.filter(r => (r.set || r.section) === d.key && r.slot >= d.start && r.slot < d.start + d.len);
  }
  function checkMove(d, newStart) {
    const tm = TT.timeModel(S.data, S.cfg), P = tm.P;
    const delta = newStart - d.start;
    if (delta === 0) return { ok: false, same: true, reasons: ["ตำแหน่งเดิม"] };
    if (Math.floor(newStart / P) !== Math.floor((newStart + d.len - 1) / P)) return { ok: false, reasons: ["ยาวเกินคาบสุดท้ายของวัน"] };
    const chunk = chunkRows(d), inChunk = new Set(chunk);
    const bySlot = {};
    S.current.rows.forEach(r => { if (!inChunk.has(r)) (bySlot[r.slot] = bySlot[r.slot] || []).push(r); });
    const reasons = new Set();
    for (const r of chunk) {
      const s = r.slot + delta;
      if (tm.locked[s] !== undefined) reasons.add(`ทับ${tm.locked[s]}`);
      r.teachers.forEach(t => { if (tm.unav[t] && tm.unav[t].has(s)) reasons.add(`${tName(t)} ประชุมฝ่ายบริหาร`); });
      for (const o of bySlot[s] || []) {
        r.groups.forEach(g => { if (o.groups.includes(g)) reasons.add(`กลุ่ม ${g} เรียน ${o.subject} อยู่`); });
        r.teachers.forEach(t => { if (o.teachers.includes(t)) reasons.add(`${tName(t)} สอน ${o.subject} อยู่`); });
        r.rooms.forEach(x => { if (o.rooms.includes(x)) reasons.add(`${x} มี ${o.subject} ใช้อยู่`); });
      }
    }
    return { ok: reasons.size === 0, reasons: [...reasons] };
  }
  function clearTargets() {
    document.querySelectorAll("#gridBox td.can, #gridBox td.cannot").forEach(td => td.classList.remove("can", "cannot"));
    $("#dndHint").className = "";
  }
  S.attachDnD = function () {
    const box = $("#gridBox");
    box.querySelectorAll("td.cell").forEach(td => {
      td.draggable = true;
      td.addEventListener("dragstart", (e) => {
        drag = { key: td.dataset.key, start: +td.dataset.slot, len: +td.dataset.len };
        e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", drag.key);
        setTimeout(() => td.classList.add("dragging"), 0);
        box.querySelectorAll("td[data-slot]").forEach(t => {
          const res = checkMove(drag, +t.dataset.slot);
          if (res.same) return;
          t.classList.add(res.ok ? "can" : "cannot");
          t.dataset.why = res.ok ? "✔ วางได้ ไม่ชนใคร" : "✖ " + res.reasons.slice(0, 3).join(" · ");
        });
      });
      td.addEventListener("dragend", () => { td.classList.remove("dragging"); clearTargets(); drag = null; });
    });
    box.querySelectorAll("td[data-slot]").forEach(t => {
      t.addEventListener("dragover", (e) => {
        if (!drag) return;
        const h = $("#dndHint");
        h.textContent = t.dataset.why || ""; h.className = "show " + (t.classList.contains("can") ? "ok" : "err");
        h.style.left = (e.clientX + 14) + "px"; h.style.top = (e.clientY + 14) + "px";
        if (t.classList.contains("can")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
      });
      t.addEventListener("drop", (e) => { e.preventDefault(); if (drag) applyMove(drag, +t.dataset.slot); });
    });
  };
  function applyMove(d, newStart, silent) {
    const res = checkMove(d, newStart);
    if (!res.ok) { if (!silent) toast("ย้ายไม่ได้: " + res.reasons.join(", "), "err"); return false; }
    const P = S.cfg.periods, delta = newStart - d.start;
    const chunk = chunkRows(d);
    S.undo.push(chunk.map(r => [r, r.slot]));
    chunk.forEach(r => { r.slot += delta; r.day = S.cfg.days[Math.floor(r.slot / P)]; r.period = r.slot % P + 1; });
    S.current.rows.sort((a, b) => a.slot - b.slot || a.section.localeCompare(b.section));
    S.moves.push([d.key, d.start, d.len, delta]);
    S.current.v = TT.validate(S.data, S.cfg, S.current.rows);
    S.current.edited = true;
    if (!silent) {
      renderView(); renderValidation();
      toast(`ย้ายแล้ว · ตรวจผล ${S.current.v.passed}/${S.current.v.total} เงื่อนไข`, S.current.v.passed === S.current.v.total ? "ok" : "err");
    }
    return true;
  }
  $("#undoBtn").onclick = () => {
    const last = S.undo.pop();
    if (!last) return toast("ไม่มีการย้ายให้ย้อนกลับ", "err");
    const P = S.cfg.periods;
    last.forEach(([r, slot]) => { r.slot = slot; r.day = S.cfg.days[Math.floor(slot / P)]; r.period = slot % P + 1; });
    S.moves.pop();
    S.current.v = TT.validate(S.data, S.cfg, S.current.rows);
    renderView(); renderValidation(); toast("ย้อนกลับแล้ว", "ok");
  };

  // ---------- 4) หลักฐานเชิงตัวเลข ----------
  const METHODS = [
    { id: "base", name: "วิธีพื้นฐาน", desc: "ลำดับตามไฟล์ วางช่องแรกที่ว่าง", color: "#94a3b8", fixed: true },
    { id: "rand", name: "Greedy สุ่มลำดับ", desc: "สุ่มลำดับ เลือกช่องโทษน้อยสุด ไม่ซ่อม", color: "#f59e0b", opts: { ordered: false, shuffle: true, repair: false } },
    { id: "heur", name: "Heuristic ยาก→ง่าย", desc: "เรียงยากไปง่าย ไม่ซ่อม", color: "#3b82f6", opts: { repair: false } },
    { id: "full", name: "ระบบเต็ม (Plan-Act-Check)", desc: "Heuristic + ซ่อม + หลาย seed", color: "#16a34a", opts: {} }
  ];
  function barChart(rows, key, fmt, max) {
    const W = 560, rowH = 38, L = 190;
    max = max || Math.max(...rows.map(r => r[key]), 1);
    return `<svg viewBox="0 0 ${W} ${rows.length * rowH + 10}" class="chart">${rows.map((r, i) => {
      const w = Math.max(2, (W - L - 70) * r[key] / max);
      return `<text x="${L - 10}" y="${i * rowH + 24}" text-anchor="end">${esc(r.name)}</text>
        <rect x="${L}" y="${i * rowH + 8}" width="${w}" height="24" rx="6" fill="${r.color}"><animate attributeName="width" from="0" to="${w}" dur=".7s" fill="freeze"/></rect>
        <text x="${L + w + 8}" y="${i * rowH + 25}" class="v">${fmt(r[key])}</text>`;
    }).join("")}</svg>`;
  }
  $("#benchBtn").onclick = async () => {
    if (!S.data) return toast("นำเข้าข้อมูลก่อน", "err");
    const N = Math.max(5, Math.min(500, parseInt($("#benchN").value, 10) || 50));
    $("#benchBtn").classList.add("loading"); $("#benchBtn").disabled = true;
    const res = [];
    for (const m of METHODS) {
      const runs = [];
      const n = m.fixed ? 1 : N;
      for (let i = 0; i < n; i++) {
        const t = performance.now();
        const r = m.fixed ? TT.solveBaseline(S.data, S.cfg) : TT.solveOnce(S.data, S.cfg, 1000 + i, m.opts);
        runs.push({ u: r.unplacedHours, ms: performance.now() - t, conflicts: TT.validate(S.data, S.cfg, r.rows).conflicts });
        $("#benchStatus").textContent = `กำลังทดสอบ ${m.name} รอบ ${i + 1}/${n}`;
        if (i % 5 === 4) await sleep(0);
      }
      res.push(Object.assign({}, m, {
        n, success: runs.filter(r => r.u === 0).length / n * 100,
        avgU: runs.reduce((a, r) => a + r.u, 0) / n, maxU: Math.max(...runs.map(r => r.u)),
        conf: Math.max(...runs.map(r => r.conflicts)), ms: runs.reduce((a, r) => a + r.ms, 0) / n
      }));
    }
    $("#benchBtn").classList.remove("loading"); $("#benchBtn").disabled = false;
    $("#benchStatus").textContent = `ทดสอบเสร็จ: ${N} seed ต่อวิธี (seed 1000–${999 + N}) — กดซ้ำได้ผลเดิมทุกครั้ง`;
    const full = res[3], base = res[0];
    $("#benchCards").innerHTML = `
      <div class="card okc"><b>${full.success.toFixed(0)}%</b><span>ระบบเต็ม จัดครบทุกคาบ (${N} seed)</span></div>
      <div class="card"><b>${base.avgU} → ${full.avgU.toFixed(1)}</b><span>คาบที่จัดไม่ลง: พื้นฐาน → ระบบเต็ม</span></div>
      <div class="card"><b>${full.conf}</b><span>จุดชน (ตัวตรวจอิสระ)</span></div>
      <div class="card"><b>${full.ms.toFixed(1)} ms</b><span>เวลาเฉลี่ยต่อรอบ</span></div>`;
    $("#benchChart1").innerHTML = "<h4>อัตราจัดครบทุกคาบ (%)</h4>" + barChart(res, "success", v => v.toFixed(0) + "%", 100);
    $("#benchChart2").innerHTML = "<h4>คาบที่จัดไม่ลงเฉลี่ย (ยิ่งน้อยยิ่งดี)</h4>" + barChart(res, "avgU", v => v.toFixed(1));
    $("#benchTable").innerHTML = `<tr><th>วิธี</th><th>หลักการ</th><th>จำนวนรอบ</th><th>จัดครบ</th><th>ขาดเฉลี่ย</th><th>ขาดมากสุด</th><th>เวลา/รอบ</th></tr>` +
      res.map(r => `<tr><td><i class="dot" style="background:${r.color}"></i>${esc(r.name)}</td><td>${esc(r.desc)}</td><td>${r.n}</td>
        <td>${r.success.toFixed(0)}%</td><td>${r.avgU.toFixed(1)}</td><td>${r.maxU}</td><td>${r.ms.toFixed(1)} ms</td></tr>`).join("");
  };
  $("#stressBtn").onclick = async () => {
    if (!S.data) return toast("นำเข้าข้อมูลก่อน", "err");
    $("#stressBtn").classList.add("loading"); $("#stressBtn").disabled = true;
    const out = [];
    for (const k of [1, 2, 3, 5, 10]) {
      $("#stressStatus").textContent = `กำลังทดสอบข้อมูล ×${k}...`;
      await sleep(30);
      const sc = TT.scaleData(S.data, S.cfg, k);
      const m0 = performance.memory ? performance.memory.usedJSHeapSize : null;
      const times = []; let best = null;
      for (let i = 0; i < 3; i++) {
        const t = performance.now();
        const r = TT.solveOnce(sc.data, sc.cfg, 7 + i);
        times.push(performance.now() - t);
        if (!best || r.unplacedHours < best.unplacedHours) best = r;
      }
      const v = TT.validate(sc.data, sc.cfg, best.rows);
      const m1 = performance.memory ? performance.memory.usedJSHeapSize : null;
      out.push({ k, groups: sc.data.groups.filter(g => g.year !== 4).length, sections: sc.data.sections.length, rows: best.rows.length,
        ms: times.reduce((a, b) => a + b, 0) / times.length, u: best.unplacedHours, pass: `${v.passed}/${v.total}`,
        mem: m1 !== null ? (m1 / 1048576).toFixed(1) + " MB" : "ดูได้ใน Chrome" });
      $("#stressTable").innerHTML = `<tr><th>ขนาดข้อมูล</th><th>กลุ่มเรียน</th><th>ตอนเรียน</th><th>คาบที่จัด</th><th>เวลาเฉลี่ย</th><th>คาบที่ขาด</th><th>ผ่านเงื่อนไข</th><th>หน่วยความจำ JS ที่ใช้</th></tr>` +
        out.map(o => `<tr><td>×${o.k}</td><td>${o.groups}</td><td>${o.sections}</td><td>${o.rows}</td><td>${o.ms.toFixed(0)} ms</td><td>${o.u}</td><td>${o.pass}</td><td>${o.mem}</td></tr>`).join("");
    }
    $("#stressBtn").classList.remove("loading"); $("#stressBtn").disabled = false;
    $("#stressStatus").textContent = "ทดสอบเสร็จ: เวลาเพิ่มเกือบเป็นเส้นตรงตามขนาดข้อมูล (×k = จำลองคณะ k แห่งที่มีครู ห้อง สนามของตัวเอง)";
  };

  // ---------- 6) QR Code ----------
  function shareURL(type, id) {
    const base = location.href.split("?")[0].split("#")[0].replace(/[^/]*$/, "") + "index_with_data.html";
    const q = new URLSearchParams({ m: "1", seed: S.current.seed, t: type, id });
    if (S.moves.length) q.set("mv", S.moves.map(m => m.join("~")).join(","));
    return base + "?" + q.toString();
  }
  function qrSVG(text, cell) {
    if (typeof qrcode === "undefined") return "<p class='muted'>โหลดตัวสร้าง QR ไม่ได้ ตรวจอินเทอร์เน็ต</p>";
    const qr = qrcode(0, "M"); qr.addData(text); qr.make();
    return qr.createSvgTag({ cellSize: cell || 5, margin: 2, scalable: true });
  }
  $("#qrBtn").onclick = () => {
    if (!S.current) return toast("ยังไม่มีผลการจัดตาราง", "err");
    const type = $("#vType").value, id = $("#vEntity").value;
    const url = shareURL(type, id);
    $("#qrTitle").textContent = $("#gridTitle").textContent;
    $("#qrImg").innerHTML = qrSVG(url, 6);
    $("#qrLink").value = url;
    $("#qrWarn").textContent = location.protocol === "file:" ? "⚠ เปิดไฟล์จากเครื่องอยู่ — QR จะใช้ได้เมื่อเปิดผ่าน GitHub Pages" : "";
    $("#qrAll").innerHTML = "";
    $("#qrModal").classList.add("show");
  };
  $("#qrAllBtn").onclick = () => {
    $("#qrAll").innerHTML = S.data.groups.filter(g => S.check.groupHours[g.id]).map(g =>
      `<div class="qrcard">${qrSVG(shareURL("group", g.id), 3)}<b>กลุ่ม ${g.id}</b></div>`).join("");
  };
  $("#qrCopy").onclick = () => { $("#qrLink").select(); try { navigator.clipboard.writeText($("#qrLink").value); } catch (e) { document.execCommand("copy"); } toast("คัดลอกลิงก์แล้ว", "ok"); };
  $("#qrClose").onclick = () => $("#qrModal").classList.remove("show");
  $("#qrModal").onclick = (e) => { if (e.target.id === "qrModal") $("#qrModal").classList.remove("show"); };

  // หน้ามือถือ (เปิดจาก QR)
  function renderMobile(params) {
    document.body.classList.add("mobile");
    const seed = parseInt(params.get("seed"), 10) || 0, type = params.get("t") || "group", id = params.get("id");
    S.sheets = window.EMBED.sheets;
    S.data = TT.parseWorkbook(S.sheets, S.cfg);
    S.check = TT.inputCheck(S.data, S.cfg);
    const r = TT.solveOnce(S.data, S.cfg, seed);
    S.current = r;
    (params.get("mv") || "").split(",").filter(Boolean).forEach(m => {
      const [key, start, len, delta] = m.split("~");
      applyMove({ key, start: +start, len: +len }, +start + +delta, true);
    });
    const v = TT.validate(S.data, S.cfg, r.rows);
    const tm = TT.timeModel(S.data, S.cfg), P = tm.P;
    const rows = r.rows.filter(x => type === "group" ? x.groups.includes(id) : type === "teacher" ? x.teachers.includes(id) : x.rooms.includes(id));
    const title = type === "group" ? "กลุ่ม " + id : type === "teacher" ? tName(id) : id;
    const today = (new Date().getDay() + 6) % 7;
    let h = `<div class="mhead"><small>${{ group: "ตารางเรียน", teacher: "ตารางสอน", room: "ตารางการใช้พื้นที่" }[type]}</small><h1>${esc(title)}</h1>
      <span>ภาคเรียนที่ 2/2569 · ผ่าน ${v.passed}/${v.total} เงื่อนไข</span></div>`;
    S.cfg.days.forEach((day, d) => {
      const items = [];
      for (let p = 1; p <= P;) {
        const s = d * P + p - 1, rs = rows.filter(x => x.slot === s);
        if (!rs.length) { p++; continue; }
        const key = rs[0].set || rs[0].section; let len = 1;
        while (p + len <= P && rows.some(x => x.slot === s + len && (x.set || x.section) === key)) len++;
        items.push({ p, len, rs }); p += len;
      }
      h += `<div class="mday ${d === today ? "today" : ""}"><h2>${day}${d === today ? " <em>วันนี้</em>" : ""}</h2>` +
        (items.length ? items.map(it => {
          const x = it.rs[0];
          const name = x.set && type === "group" ? "วิชาเลือก: " + [...new Set(it.rs.map(y => y.name))].join(" / ") : `${x.subject} ${x.name}`;
          return `<div class="mitem k-${x.kind}"><div class="mtime">${hhmm(it.p)}<br><small>${hhmm(it.p + it.len)}</small></div>
            <div><b>${esc(name)}</b><small>${esc(type !== "teacher" && !(x.set && type === "group") ? x.teachers.map(tName).join(", ") : "กลุ่ม " + x.groups.join(", "))}</small>
            <small>📍 ${esc(x.set && type === "group" ? "ตามรายวิชาที่เลือก" : x.rooms.join(" + "))}</small></div></div>`;
        }).join("") : `<p class="muted">ไม่มีเรียน</p>`) + "</div>";
    });
    h += `<p class="mfoot"><a href="${location.href.split("?")[0]}">เปิดระบบเต็ม</a></p>`;
    $("#mobile").innerHTML = h;
  }
  S.renderMobile = renderMobile;

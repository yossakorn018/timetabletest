  // =====================================================================
  //  ล็อกอิน + บทบาท (admin / teacher / student) + จัดการผู้ใช้
  //  รหัสผ่านเก็บเป็น SHA-256 + salt ไม่เก็บรหัสจริง
  // =====================================================================
  function sha256(s) {
    const K = [], H = []; let p = 2, c = 0;
    const isP = (n) => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    while (c < 64) { if (isP(p)) { if (c < 8) H[c] = (Math.pow(p, 1 / 2) * 2 ** 32) | 0; K[c++] = (Math.pow(p, 1 / 3) * 2 ** 32) | 0; } p++; }
    const b = unescape(encodeURIComponent(s)), w = [], l = b.length * 8;
    for (let i = 0; i < b.length; i++) w[i >> 2] |= b.charCodeAt(i) << ((3 - i % 4) * 8);
    w[l >> 5] |= 0x80 << (24 - l % 32); w[((l + 64 >> 9) << 4) + 15] = l;
    for (let j = 0; j < w.length; j += 16) {
      const a = H.slice(0, 8), W = [];
      for (let i = 0; i < 64; i++) {
        if (i < 16) W[i] = w[j + i] | 0;
        else { const x = W[i - 15], y = W[i - 2]; W[i] = (((x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3)) + W[i - 7] + ((y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ (y >>> 10)) + W[i - 16]) | 0; }
        const e = a[4], t1 = a[7] + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & a[5]) ^ (~e & a[6])) + K[i] + W[i];
        const A = a[0], t2 = ((A >>> 2 | A << 30) ^ (A >>> 13 | A << 19) ^ (A >>> 22 | A << 10)) + ((A & a[1]) ^ (A & a[2]) ^ (a[1] & a[2]));
        a.unshift((t1 + t2) | 0); a[4] = (a[4] + t1) | 0; a.pop();
      }
      for (let i = 0; i < 8; i++) H[i] = (H[i] + a[i]) | 0;
    }
    return H.map(h => (h >>> 0).toString(16).padStart(8, "0")).join("");
  }
  S.sha256 = sha256;
  const ROLE_TH = { admin: "ผู้ดูแลระบบ", teacher: "อาจารย์", student: "นักศึกษา" };
  const newSalt = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  function makeUser(u, name, role, ref, pw) { const salt = newSalt(); return { u: u.trim().toLowerCase(), name, role, ref: ref || "", salt, hash: sha256(salt + pw) }; }
  function loadUsers() {
    let us = null;
    try { us = JSON.parse(localStorage.getItem("tt_users") || "null"); } catch (e) { /* ignore */ }
    if (!us || !us.length) us = [makeUser("admin", "ผู้ดูแลระบบ", "admin", "", "admin1234")];
    return us;
  }
  function saveUsers() { try { localStorage.setItem("tt_users", JSON.stringify(S.users)); } catch (e) { /* ignore */ } }
  S.users = loadUsers(); saveUsers();
  S.user = null;

  // ---------- ล็อกอิน ----------
  function doLogin() {
    const u = $("#lgUser").value.trim().toLowerCase(), pw = $("#lgPass").value;
    const usr = S.users.find(x => x.u === u);
    if (!usr || usr.hash !== sha256(usr.salt + pw)) {
      $("#lgErr").textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
      $("#loginCard").classList.remove("shake"); void $("#loginCard").offsetWidth; $("#loginCard").classList.add("shake");
      return;
    }
    S.user = usr;
    try { sessionStorage.setItem("tt_session", usr.u); } catch (e) { /* ignore */ }
    $("#lgPass").value = ""; $("#lgErr").textContent = "";
    applyRole();
    toast(`ยินดีต้อนรับ ${usr.name}`, "ok");
  }
  $("#lgBtn").onclick = doLogin;
  $("#lgPass").onkeydown = $("#lgUser").onkeydown = (e) => { if (e.key === "Enter") doLogin(); };
  $("#logoutBtn").onclick = () => {
    S.user = null;
    try { sessionStorage.removeItem("tt_session"); } catch (e) { /* ignore */ }
    document.body.classList.remove("role-admin", "role-teacher", "role-student");
    $("#loginView").classList.add("show");
  };

  S.isAdmin = () => S.user && S.user.role === "admin";
  function applyRole() {
    const r = S.user.role;
    document.body.classList.remove("role-admin", "role-teacher", "role-student");
    document.body.classList.add("role-" + r);
    $("#loginView").classList.remove("show");
    $("#userName").textContent = S.user.name;
    $("#userRole").textContent = ROLE_TH[r];
    document.querySelectorAll("nav button").forEach(b => {
      const roles = (b.dataset.roles || "admin").split(",");
      b.hidden = !roles.includes(r);
    });
    $("#xlsxBtn").textContent = r === "admin" ? "ส่งออก Excel (ทุกตาราง)" : "ส่งออก Excel";
    $("#viewNavLabel").textContent = r === "teacher" ? "ตารางสอนของฉัน" : r === "student" ? "ตารางเรียนของฉัน" : "ดูตาราง/ส่งออก";
    if (r === "admin") { showTab(S.current ? "view" : "import"); renderUsers(); return; }
    // ครู/นักศึกษา: ล็อกมุมมองให้เห็นเฉพาะของตัวเอง
    $("#vType").value = r === "teacher" ? "teacher" : "group";
    showTab("view");
  }
  // ใช้ใน entities(): จำกัดรายการตามบทบาท
  S.roleFilter = (type, list) => {
    if (!S.user || S.user.role === "admin") return list;
    return list.filter(([id]) => id === S.user.ref);
  };
  S.renderMine = () => {
    const box = $("#mySubjects");
    if (!S.user || S.user.role === "admin" || !S.current) { box.hidden = true; return; }
    const me = S.user.ref, isT = S.user.role === "teacher";
    const rows = S.current.rows.filter(r => isT ? r.teachers.includes(me) : r.groups.includes(me));
    if (!rows.length) { box.hidden = false; box.innerHTML = `<p class="muted">ยังไม่พบรายวิชาของบัญชีนี้ (รหัสที่ผูกไว้: ${esc(me)}) — ติดต่อผู้ดูแลระบบ</p>`; return; }
    const agg = {};
    rows.forEach(r => {
      const k = r.section;
      if (!agg[k]) agg[k] = { subject: r.subject, name: r.name, groups: r.groups, teachers: r.teachers, kind: r.kind, hours: 0, rooms: new Set(), when: new Set() };
      agg[k].hours++; r.rooms.forEach(x => agg[k].rooms.add(x)); agg[k].when.add(r.day);
    });
    const list = Object.values(agg);
    const total = new Set(rows.map(r => r.slot)).size;
    box.hidden = false;
    box.innerHTML = `<h3>${isT ? "รายวิชาที่ฉันสอน" : "รายวิชาที่ฉันเรียน"} <span class="pill">${list.length} ตอนเรียน · ${total} คาบ/สัปดาห์</span></h3>
      <table class="list"><tr><th>รหัส</th><th>วิชา</th><th>${isT ? "กลุ่ม" : "ผู้สอน"}</th><th>วัน</th><th>ห้อง/สนาม</th><th>คาบ</th></tr>${list.map(a => `
      <tr><td><span class="tag k-${a.kind}">${esc(a.subject)}</span></td><td>${esc(a.name)}</td>
      <td>${esc(isT ? a.groups.join(", ") : a.teachers.map(tName).join(", "))}</td><td>${[...a.when].join(", ")}</td>
      <td>${esc([...a.rooms].join(", "))}</td><td>${a.hours}</td></tr>`).join("")}</table>`;
  };

  // ---------- จัดการผู้ใช้ (admin) ----------
  function refOptions(role) {
    if (role === "teacher") return S.data ? S.data.teachers.map(t => [t.id, `${t.id} ${t.name}`]) : [];
    if (role === "student") return S.data ? S.data.groups.filter(g => S.check && S.check.groupHours[g.id]).map(g => [g.id, "กลุ่ม " + g.id]) : [];
    return [];
  }
  function fillRef() {
    const role = $("#nuRole").value, opts = refOptions(role);
    $("#nuRefWrap").hidden = role === "admin";
    $("#nuRef").innerHTML = opts.length ? opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")
      : `<option value="">— นำเข้าข้อมูลก่อน —</option>`;
  }
  $("#nuRole").onchange = fillRef;
  function refName(u) {
    if (u.role === "teacher") return tNameSafe(u.ref);
    if (u.role === "student") return "กลุ่ม " + u.ref;
    return "ทุกเมนู";
  }
  const tNameSafe = (id) => (S.data && S.data.teachers.find(t => t.id === id) || { name: id }).name;
  function renderUsers() {
    fillRef();
    $("#userTable").innerHTML = `<tr><th>ชื่อผู้ใช้</th><th>ชื่อที่แสดง</th><th>บทบาท</th><th>สิทธิ์เห็นข้อมูล</th><th></th></tr>` +
      S.users.map((u, i) => `<tr><td><b>${esc(u.u)}</b></td><td>${esc(u.name)}</td><td><span class="rbadge r-${u.role}">${ROLE_TH[u.role]}</span></td>
        <td>${esc(refName(u))}</td><td class="acts"><button class="small" data-pw="${i}">รีเซ็ตรหัส</button>
        <button class="small danger" data-del="${i}" ${u.u === S.user?.u ? "disabled" : ""}>ลบ</button></td></tr>`).join("");
    $("#userTable").querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      const u = S.users[+b.dataset.del];
      if (!confirmInline(b, `ลบ ${u.u}?`)) return;
      S.users.splice(+b.dataset.del, 1); saveUsers(); renderUsers(); toast(`ลบผู้ใช้ ${u.u} แล้ว`, "ok");
    });
    $("#userTable").querySelectorAll("[data-pw]").forEach(b => b.onclick = () => {
      const u = S.users[+b.dataset.pw], pw = $("#nuPass").value || "1234";
      u.salt = newSalt(); u.hash = sha256(u.salt + pw); saveUsers();
      toast(`ตั้งรหัสผ่าน ${u.u} เป็น "${pw}" แล้ว`, "ok");
    });
    $("#userCount").textContent = `${S.users.length} บัญชี · ผู้ดูแล ${S.users.filter(u => u.role === "admin").length} · อาจารย์ ${S.users.filter(u => u.role === "teacher").length} · นักศึกษา ${S.users.filter(u => u.role === "student").length}`;
  }
  // ยืนยันด้วยการกดซ้ำ (ไม่ใช้ confirm() ของเบราว์เซอร์)
  function confirmInline(btn, msg) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = "กดอีกครั้งเพื่อยืนยัน";
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; }, 2500);
    toast(msg + " กดปุ่มอีกครั้งเพื่อยืนยัน", "err");
    return false;
  }
  S.renderUsers = renderUsers;
  S.applyRole = applyRole;
  $("#nuAdd").onclick = () => {
    const u = $("#nuUser").value.trim().toLowerCase(), pw = $("#nuPass").value, role = $("#nuRole").value, ref = role === "admin" ? "" : $("#nuRef").value;
    if (!/^[a-z0-9._-]{3,}$/.test(u)) return toast("ชื่อผู้ใช้ต้องเป็น a-z 0-9 . _ - อย่างน้อย 3 ตัว", "err");
    if (pw.length < 4) return toast("รหัสผ่านอย่างน้อย 4 ตัวอักษร", "err");
    if (role !== "admin" && !ref) return toast("เลือกอาจารย์/กลุ่มที่ผูกกับบัญชีนี้ก่อน", "err");
    if (S.users.some(x => x.u === u)) return toast("มีชื่อผู้ใช้นี้แล้ว", "err");
    const name = $("#nuName").value.trim() || (role === "teacher" ? tNameSafe(ref) : role === "student" ? "นักศึกษากลุ่ม " + ref : u);
    S.users.push(makeUser(u, name, role, ref, pw)); saveUsers(); renderUsers();
    $("#nuUser").value = ""; $("#nuName").value = "";
    toast(`สร้างบัญชี ${u} (${ROLE_TH[role]}) แล้ว`, "ok");
  };
  $("#bulkTeacher").onclick = () => {
    if (!S.data) return toast("นำเข้าข้อมูลก่อน", "err");
    const pw = $("#nuPass").value || "1234"; let n = 0;
    S.data.teachers.forEach(t => { const u = t.id.toLowerCase(); if (!S.users.some(x => x.u === u)) { S.users.push(makeUser(u, t.name, "teacher", t.id, pw)); n++; } });
    saveUsers(); renderUsers(); toast(`สร้างบัญชีอาจารย์ ${n} บัญชี (ชื่อผู้ใช้ t01, t02, ... รหัส ${pw})`, "ok");
  };
  $("#bulkStudent").onclick = () => {
    if (!S.data) return toast("นำเข้าข้อมูลก่อน", "err");
    const pw = $("#nuPass").value || "1234"; let n = 0;
    S.data.groups.filter(g => S.check.groupHours[g.id]).forEach(g => {
      const u = "g" + g.id.replace("/", "-");
      if (!S.users.some(x => x.u === u)) { S.users.push(makeUser(u, "นักศึกษากลุ่ม " + g.id, "student", g.id, pw)); n++; }
    });
    saveUsers(); renderUsers(); toast(`สร้างบัญชีนักศึกษา ${n} บัญชี (ชื่อผู้ใช้ g1-1, g1-2, ... รหัส ${pw})`, "ok");
  };
  $("#usersExport").onclick = () => download("users.json", new Blob([JSON.stringify(S.users, null, 2)], { type: "application/json" }));
  $("#usersImport").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const arr = JSON.parse(await f.text());
      if (!Array.isArray(arr) || !arr.every(x => x.u && x.role && x.salt && x.hash)) throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
      S.users = arr; saveUsers(); renderUsers(); toast(`นำเข้าผู้ใช้ ${arr.length} บัญชีแล้ว`, "ok");
    } catch (err) { toast("นำเข้าไม่ได้: " + err.message, "err"); }
  };

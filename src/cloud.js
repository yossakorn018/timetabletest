/* cloud.js — ซิงก์ข้อมูลทุกเครื่องผ่าน Supabase (REST)
 * หลักการ: แอปยังอ่าน/เขียน localStorage เหมือนเดิม
 *  1) ก่อนเริ่มแอป ดึงข้อมูลกลางจากเซิร์ฟเวอร์มาใส่ localStorage
 *  2) เมื่อแอปเขียน localStorage (บัญชี ตาราง คำขอ ตั้งค่า) ส่งขึ้นเซิร์ฟเวอร์ตามทันที
 *  3) ตรวจทุก 20 วินาทีและเมื่อกลับมาที่หน้า ถ้าเครื่องอื่นแก้ข้อมูล แจ้งให้โหลดใหม่
 * ถ้าไม่ได้ตั้งค่าหรือเซิร์ฟเวอร์ล่ม ระบบทำงานแบบเก็บในเครื่องต่อได้
 */
(function () {
  const CFG = window.CLOUD_CFG || {};
  const KEYS = ["tt_users", "tt_sched", "tt_requests", "tt_cfg", "tt_demo_v1"];
  const on = !!(CFG.url && CFG.key);
  const C = window.CLOUD = { on, status: on ? "connecting" : "local", lastSync: null, pending: {}, applying: false };
  // key แบบใหม่ (sb_publishable_...) ใส่แค่ apikey · key แบบเก่า (JWT eyJ...) ใส่ Authorization ด้วย
  const H = !on ? {} : /^sb_/.test(CFG.key) ? { apikey: CFG.key } : { apikey: CFG.key, Authorization: "Bearer " + CFG.key };
  const base = on ? CFG.url.replace(/\/$/, "") + "/rest/v1/app_state" : "";
  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const ls = window.localStorage;

  function badge() {
    const el = document.getElementById("cloudBadge");
    if (!el) return;
    const t = C.lastSync ? C.lastSync.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "";
    const map = {
      local: ["💾 เก็บในเครื่องนี้", "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้"],
      connecting: ["⏳ กำลังเชื่อมต่อ…", ""],
      online: ["☁️ ออนไลน์" + (t ? " · " + t : ""), "ข้อมูลตรงกันทุกเครื่อง (Supabase)"],
      saving: ["☁️ กำลังบันทึก…", ""],
      offline: ["⚠️ ออฟไลน์", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ข้อมูลเก็บในเครื่องไว้ก่อน จะส่งขึ้นเมื่อกลับมาออนไลน์"]
    };
    const [txt, tip] = map[C.status] || map.local;
    el.textContent = txt; el.title = tip; el.className = "cbadge c-" + C.status;
  }
  C.badge = badge;

  async function pullAll() {
    const url = base + "?select=key,value&key=in.(" + KEYS.join(",") + ")";
    const r = await fetch(url, { headers: H, cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  async function pushOne(key, value) {
    const r = await fetch(base, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, H),
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }
  let timer = null;
  function queue(key, value) {
    C.pending[key] = value;
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  }
  async function flush() {
    const items = Object.entries(C.pending);
    if (!items.length) return;
    C.status = "saving"; badge();
    try {
      for (const [k, v] of items) {
        await pushOne(k, v);
        if (C.pending[k] === v) delete C.pending[k];
      }
      C.status = "online"; C.lastSync = new Date();
    } catch (e) { C.status = "offline"; }
    badge();
  }
  C.flush = flush;

  // เขียน localStorage เมื่อไหร่ ส่งขึ้นเซิร์ฟเวอร์ด้วย (เฉพาะคีย์ของระบบ)
  if (on) {
    Storage.prototype.setItem = function (k, v) {
      rawSet.call(this, k, v);
      if (this === ls && KEYS.includes(k) && !C.applying) queue(k, String(v));
    };
    Storage.prototype.removeItem = function (k) {
      rawRemove.call(this, k);
      if (this === ls && KEYS.includes(k) && !C.applying) queue(k, null);
    };
  }

  function apply(rows) {
    C.applying = true;
    for (const r of rows) {
      if (r.value === null || r.value === undefined) rawRemove.call(ls, r.key);
      else rawSet.call(ls, r.key, typeof r.value === "string" ? r.value : JSON.stringify(r.value));
    }
    C.applying = false;
  }

  // แจ้งเมื่อเครื่องอื่นแก้ข้อมูล
  function notifyRemote() {
    let bar = document.getElementById("cloudBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "cloudBar";
      bar.innerHTML = '🔄 มีข้อมูลใหม่จากเครื่องอื่น <button type="button">โหลดข้อมูลล่าสุด</button>';
      bar.querySelector("button").onclick = () => location.reload();
      document.body.appendChild(bar);
    }
    bar.classList.add("show");
  }
  async function check() {
    if (!on || document.hidden) return;
    try {
      if (Object.keys(C.pending).length) await flush();
      const rows = await pullAll();
      const changed = rows.some(r => !(r.key in C.pending) && r.key !== "tt_demo_v1" &&
        (r.value === null ? ls.getItem(r.key) !== null : ls.getItem(r.key) !== (typeof r.value === "string" ? r.value : JSON.stringify(r.value))));
      C.status = "online"; C.lastSync = new Date(); badge();
      if (changed) notifyRemote();
    } catch (e) { C.status = "offline"; badge(); }
  }

  function start() {
    if (typeof window.__startApp === "function") window.__startApp();
    badge();
  }

  if (!on) { start(); return; }
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000));
  Promise.race([pullAll(), timeout]).then(rows => {
    apply(rows);
    C.status = "online"; C.lastSync = new Date();
    C.cloudKeys = new Set(rows.map(r => r.key));
  }).catch(() => { C.status = "offline"; }).finally(() => {
    start();
    // เครื่องแรก: ส่งข้อมูลในเครื่องขึ้นไปตั้งต้นข้อมูลกลาง
    if (C.status === "online") KEYS.forEach(k => { if (!C.cloudKeys.has(k) && ls.getItem(k) !== null) queue(k, ls.getItem(k)); });
    setInterval(check, 20000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
  });
})();

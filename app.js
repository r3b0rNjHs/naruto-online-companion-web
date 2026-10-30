// Cuartel Ninja: código de la página (lo carga web/cuartel.html después de data.js, gen/ y content/).
(() => {
  const D = window.NOL_DATA || { ninjas: [], summons: [], moves: [] };
  const PICS = window.NOL_PICS || {};
  const BY = new Map(D.ninjas.map(n => [n.s, n]));
  // Nombres del juego en EN cuando la base de datos usa la traducción del chino
  const NAME_EN = { "hanzo-wandering-samurai": "Hanzo [Ronin]", "pain-wandering-samurai": "Pain [Ronin]" };
  Object.entries(NAME_EN).forEach(([s, n]) => { const x = BY.get(s); if (x) x.n = n; });
  const SUM = new Map(D.summons.map(s => [s.s, s]));
  const MAINS = D.ninjas.filter(n => n.m);
  const MOVES = new Set(D.moves);
  // Orden de comprobación de chases por casilla (fila a fila, 0 = arriba-izquierda); la vanguardia (derecha) va primero.
  const RANK = [7, 4, 1, 8, 5, 2, 9, 6, 3];
  const $ = id => document.getElementById(id);
  // En inglés, esc() también traduce el contenido (tc, más abajo): así no hay que tocar cada sitio donde se pinta.
  const esc = s => String(typeof tc === "function" ? tc(s ?? "") : s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Para valores de atributo (ids, claves): escapa sin traducir. Los ids de intentos, equipos y alternativas vienen de
  // copias de seguridad o del almacén compartido: sin escapar, un id con comillas metería atributos (y JS) en la página.
  const escAttr = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------------- estado
  const blankProfile = () => ({ main: "", owned: {}, summons: [], assists: {} });
  let profile = blankProfile();
  let teams = {};              // id -> equipo
  const team = { id: null, cells: Array(9).fill(null), mainSel: {}, summon: "", summonM: "", name: "", mode: "Arena", notes: "" };
  let ui = { tab: "perfil", showMine: false, pickMine: true, picking: null, starter: null, catalogLimit: 120 };

  // ---------------- almacenamiento: db del artifact, o localStorage si no hay
  // Naruto Online Companion (la app de escritorio) inyecta window.NOC_APP al construir: ahí no hay chat con Claude
  // ni base de datos de la página, y los datos se guardan «en este PC».
  const IS_APP = !!window.NOC_APP;
  // La misma app instalable desde el navegador (PWA, tools/build_pwa.py: Android, iPhone): sin Tauri; se actualiza sola.
  const IS_PWA = IS_APP && !!window.NOC_APP.pwa;
  if (IS_APP) document.documentElement.dataset.app = "1";
  // En la app, la versión junto al nombre (cabecera).
  if (IS_APP && window.NOC_APP.version) document.querySelector(".brand h1").insertAdjacentHTML("beforeend", ` <span class="app-ver">v${esc(window.NOC_APP.version)}</span>`);
  let db = null;
  const LS = "cuartel-ninja-v1";
  // ---- Idioma. La app arranca en inglés salvo con Windows en español; el Cuartel del usuario, en español. Botón ES/EN arriba.
  // L(es, en) para los textos que genera el código; tr() y data-en (cuartel.html) + I18N_EN (content/i18n-en.js) para lo fijo.
  const LANG = (() => { try { const v = localStorage.getItem(LS + "-lang"); if (v === "es" || v === "en") return v; } catch {} return IS_APP && !/^es/i.test(navigator.language || "") ? "en" : "es"; })();
  const EN = LANG === "en";
  const HERE = IS_PWA ? (EN ? "on this device" : "en este dispositivo") : IS_APP ? (EN ? "on this PC" : "en este PC") : (EN ? "in this browser" : "en este navegador");
  const L = (es, en) => EN ? en : es;
  const tr = s => (EN && typeof I18N_EN !== "undefined" && I18N_EN[s]) || s;
  // Nombres de ramas de breakthrough (BTI, NINJA_USO) escritos en español: «Pasiva 1» → «Passive 1».
  // Contenido en inglés (web/content/i18n-c.js): la frase exacta, o patrones para los textos que generan los scripts.
  const TC_EX = (typeof I18N_C !== "undefined" && I18N_C.exact) || {};
  const TC_RULES = ((typeof I18N_C !== "undefined" && I18N_C.rules) || []).map(([p, r]) => [new RegExp(p, "g"), r]);
  var tcReady = true;   // var: esc() puede llamarse antes de llegar aquí, y entonces no traduce
  function tc(s) {
    if (!tcReady || !EN || typeof s !== "string" || s.length < 2) return s;
    if (TC_EX[s]) return TC_EX[s];
    if (typeof I18N_EN !== "undefined" && I18N_EN[s]) return I18N_EN[s];
    if (s.indexOf(" ") < 0) return s;
    for (const [re, r] of TC_RULES) { re.lastIndex = 0; if (re.test(s)) { re.lastIndex = 0; s = s.replace(re, r); } }
    return s;
  }
  const btName = b => EN ? String(b).replace(/^Pasiva/, "Passive").replace(/ o /g, " or ") : b;
  function translateStatic() {
    if (!EN) return;
    document.documentElement.lang = "en";
    document.querySelectorAll("[data-en]").forEach(el => { el.innerHTML = el.dataset.en; });
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (!t) continue;
      const en = I18N_EN[t]; if (en) n.nodeValue = n.nodeValue.replace(/\S[\s\S]*\S|\S/, en);
    }
    document.querySelectorAll("[placeholder],[aria-label],[title]").forEach(el => ["placeholder", "aria-label", "title"].forEach(a => { const v = el.getAttribute(a); if (v && I18N_EN[v]) el.setAttribute(a, I18N_EN[v]); }));
    if (document.title === "Cuartel Ninja") document.title = "Naruto Online Companion";
  }
  translateStatic();
  // Idioma: se guarda en este equipo y se recarga. Tema: Automático (sigue a Windows), Oscuro o Claro; el tema ya se aplicó
  // en la cabecera de la página antes de pintar (cuartel.html). Al volver a Automático se devuelve el tema que hubiera de origen.
  // Los dos se cambian en Ajustes (y el idioma, también en el primer paso del asistente).
  function setLang(l) { if ((l === "en") === EN) return; try { localStorage.setItem(LS + "-lang", l); } catch {} location.reload(); }
  const readTheme = () => { try { const t = localStorage.getItem(LS + "-theme"); return t === "dark" || t === "light" ? t : "auto"; } catch { return "auto"; } };
  const THEME_ORIGIN = readTheme() === "auto" ? document.documentElement.getAttribute("data-theme") : null;
  function setTheme(next) { const root = document.documentElement;
    try { if (next === "auto") localStorage.removeItem(LS + "-theme"); else localStorage.setItem(LS + "-theme", next); } catch {}
    if (next === "auto") { if (THEME_ORIGIN) root.setAttribute("data-theme", THEME_ORIGIN); else root.removeAttribute("data-theme"); } else root.dataset.theme = next; }
  document.getElementById("setBtn")?.addEventListener("click", () => { setTab("ajustes"); window.scrollTo({ top: 0 }); });
  const lsRead = () => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };
  const lsWrite = () => { try { localStorage.setItem(LS, JSON.stringify({ profile, teams, tries, customAlts, walls })); } catch {} };
  const setSync = (state, text) => { $("syncDot").className = "dot " + state; $("syncText").textContent = text; };

  // Cambios locales que aún no ha confirmado el almacén: mientras los haya, no dejamos que un
  // snapshot (que puede traer una versión anterior) pise lo que acaba de tocar el usuario.
  let saving = Promise.resolve(), profileTimer = null, edits = 0, savedEdits = 0;
  function saveProfile() {
    bustTick();
    edits++;
    lsWrite();
    clearTimeout(profileTimer);
    profileTimer = setTimeout(pushProfile, 600);
  }
  // Sube el perfil. Si falla, o si aún no hay almacén, lo local sigue «sin guardar» (así un snapshot remoto no lo pisa)
  // y se reintenta: a los 15 s tras un fallo y al conectar el almacén.
  function pushProfile() {
    if (!db) return;
    const upTo = edits;
    const body = JSON.parse(JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }));
    setSync("warn", L("Guardando…", "Saving…"));
    saving = saving.then(() => db.doc("perfil/yo").set(body))
      .then(() => { savedEdits = Math.max(savedEdits, upTo); if (savedEdits >= edits) setSync("ok", L("Perfil guardado", "Profile saved")); })
      .catch(e => { setSync("warn", e && e.code === "quota_exceeded" ? L("Sin espacio para guardar", "No space to save") : L("No se pudo guardar; lo reintento en un momento", "Couldn't save; retrying shortly"));
        clearTimeout(profileTimer); profileTimer = setTimeout(() => { if (hasLocalEdits()) pushProfile(); }, 15000); });
  }
  const hasLocalEdits = () => savedEdits < edits;

  async function initStore() {
    const local0 = lsRead(), local = local0 && local0.profile ? cleanBackup(local0) : local0;   // lo guardado pasa el mismo filtro que una copia
    if (local) { profile = { ...blankProfile(), ...local.profile }; teams = local.teams || {}; }
    if (local) { tries = fixTries(local.tries || {}); customAlts = local.customAlts || {}; walls = local.walls || {}; }
    try { ui.mode = localStorage.getItem(LS + "-mode") || "ar"; } catch { ui.mode = "ar"; }
    renderAll();
    try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch { db = null; }
    if (!db) { setSync("", L("Guardado ", "Saved ") + HERE); return; }
    setSync("warn", L("Sincronizando…", "Syncing…"));
    if (hasLocalEdits()) pushProfile();   // cambios hechos antes de conectar
    let profileLoaded = false;  // al llegar el perfil, repintar la pestaña abierta (si no, salen ninjas tuyos como «falta»)
    db.doc("perfil/yo").onSnapshot(snap => {
      if (hasLocalEdits() || snap.metadata.hasPendingWrites) return;  // lo local manda hasta que se guarde
      // los snapshots llegan congelados: se trabaja siempre sobre una copia profunda
      if (snap.exists) { const d = JSON.parse(JSON.stringify(snap.data())); profile = cleanBackup({ profile: { ...blankProfile(), ...d, summons: d.summons || [] } }).profile; lsWrite(); renderProfile(); renderBuilder(); if (!profileLoaded) { profileLoaded = true; setTab(ui.tab); } }
      else if (Object.keys(profile.owned).length || profile.main) saveProfile();  // subir lo que hubiera en local
      setSync("ok", L("Sincronizado", "Synced"));
    }, () => setSync("warn", L("Sin conexión con el almacén; usando este navegador", "No connection to storage; using this browser")));
    db.collection("intentos").onSnapshot(snap => {
      const next = {};
      snap.docs.forEach(d => { next[d.id] = JSON.parse(JSON.stringify(d.data())); });
      tries = fixTries(next); lsWrite(); setTab(ui.tab);
    }, () => {});
    db.collection("pisos").onSnapshot(snap => {
      const next = {};
      snap.docs.forEach(d => { next[d.id] = JSON.parse(JSON.stringify(d.data())); });
      walls = next; lsWrite(); setTab(ui.tab);
    }, () => {});
    db.collection("alternativas").onSnapshot(snap => {
      const next = {};
      snap.docs.forEach(d => { next[d.id] = JSON.parse(JSON.stringify(d.data())); });
      customAlts = next; lsWrite(); setTab(ui.tab);
    }, () => {});
    db.collection("equipos").onSnapshot(snap => {
      const next = {};
      snap.docs.forEach(d => { next[d.id] = JSON.parse(JSON.stringify(d.data())); });
      teams = next; lsWrite(); renderSaved();
    }, () => {});
  }

  // ---------------- utilidades de pintado
  // data-ninja: tocar la cara abre la ficha rápida del ninja (salvo donde tocar ya hace otra cosa; ver openSheet).
  const pic = (key, name, cls = "pic") => { const dn = key && !String(key).startsWith("s:") ? ` data-ninja="${esc(key)}"` : "";
    return PICS[key] ? `<img class="${escAttr(cls)}" src="${PICS[key]}" alt="" loading="lazy"${dn}>`
      : `<div class="${cls} ph" aria-hidden="true"${dn}>${esc((name || "?").slice(0, 1))}</div>`; };
  const st = s => `<span class="st" data-s="${esc(MOVES.has(s) ? s : (/combo/i.test(s) ? "combo" : ""))}">${esc(s)}</span>`;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, msg.length > 40 ? 4200 : 2200); }

  // ---------------- pestañas
  document.querySelectorAll(".tab[data-sec]").forEach(b => b.addEventListener("click", () => setTab(lastView[b.dataset.sec] || SECTIONS[b.dataset.sec].v[0][0])));
  const SECTIONS = {
    inicio: { t: L("Inicio", "Home"), d: L("Qué hacer hoy, qué toca esta semana y cómo vas.", "What to do today, what's on this week and how you're doing."), v: [["inicio", L("Resumen", "Summary")]] },
    roster: { t: L("Mi roster", "My roster"), d: L("Marca tus ninjas, estrellas, breakthrough y summons; en «Mejorar», a quién compensa subir. Todo lo demás se ajusta a lo que marques aquí.", "Mark your ninjas, stars, breakthrough and summons; in «Upgrade», who's worth upgrading. Everything else adapts to what you mark here."), v: [["perfil", L("Ninjas y summons", "Ninjas and summons")], ["mejorar", L("Mejorar", "Upgrade")]] },
    equipos: { t: L("Equipos", "Teams"), d: L("Tus equipos por modo, los que faltan por probar, tu camino y tu progreso.", "Your teams by mode, those left to try, your path and your progress."), v: [["ii", L("Con tus ninjas", "With your ninjas")], ["probar", L("Por probar", "To try")], ["camino", L("Tu camino", "Your path")], ["progreso", L("Progreso", "Progress")], ["ideal", L("Equipos ideales", "Ideal teams")]] },
    biblioteca: { t: L("Biblioteca", "Library"), d: L("Todo lo que es consulta: tier list, ninjas recomendados, summons, lo que usa el top y las marionetas de Ninja Exam.", "Everything to look up: tier list, recommended ninjas, summons, what the top uses and the Ninja Exam puppets."), v: [["tier", "Tier list"], ["recs", L("Recomendados", "Recommended")], ["summons", "Summons"], ["meta", L("Meta del top", "Top meta")], ["marionetas", L("Marionetas", "Puppets")], ["fuentes", L("Fuentes", "Sources")]] },
    semana: { t: L("Semana", "Week"), d: IS_APP ? L("Eventos del ciclo actual, qué hacer cada día y en qué gastar cada moneda.", "Events of the current cycle, what to do each day and what to spend each currency on.") : L("Eventos del ciclo actual, cuánto recargar, qué hacer cada día y en qué gastar cada moneda.", "Events of the current cycle, what to do each day and what to spend each currency on."), v: [["plan", L("Plan de la semana", "Weekly plan")], ["tiendas", L("Tiendas y monedas", "Shops and currencies")]] },
    ajustes: { t: L("Ajustes", "Settings"), d: L("Todo lo que se configura, en un sitio: tu cuenta, idioma y tema, copias de seguridad y actualizaciones.", "Everything you can configure, in one place: your account, language and theme, backups and updates."), v: [["ajustes", L("General", "General")], ["datos", L("Copia de seguridad", "Backup")]] },
    creador: { t: L("Creador", "Builder"), d: L("Monta un equipo en el tablero con su cadena de chases y guarda los que uses.", "Build a team on the board with its chase chain and save the ones you use."), v: [["creador", L("Creador", "Builder")], ["guardados", L("Equipos guardados", "Saved teams")]] }
  };
  const SEC_OF = Object.fromEntries(Object.entries(SECTIONS).flatMap(([k, x]) => x.v.map(([v]) => [v, k])));
  const lastView = {};
  // Nivel y poder: los escribe el usuario en Ajustes (perfil.level, perfil.power, perfil.powerAt)
  // En la app no hay valores de nadie: hasta que el usuario los apunte, nivel y poder quedan vacíos.
  const DEF_LEVEL = IS_APP ? 0 : 73, DEF_POWER = IS_APP ? 0 : 150000;
  const fmtPower = p => p >= 1e6 ? (p / 1e6).toLocaleString(EN ? "en-GB" : "es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "M" : Math.round(p / 1000) + "k";
  const acctInfo = () => ({ level: profile.level || DEF_LEVEL, power: profile.power || DEF_POWER,
    at: profile.powerAt ? new Date(profile.powerAt).toLocaleDateString(EN ? "en-GB" : "es-ES", { day: "numeric", month: "short", year: "numeric" }) : IS_APP ? L("sin fecha", "no date") : "1 oct 2026" });
  function updateAcct() {
    const m = profile.owned["madara-uchiha-the-final-battle"], n = Object.keys(profile.owned).filter(x => !(BY.get(x) || {}).m).length;
    $("acct").innerHTML = `<span><b class="mono">${n}</b> ninjas</span>${acctInfo().level ? `<span>${L("Nivel", "Level")} ${acctInfo().level}${acctInfo().power ? ` · ~${fmtPower(acctInfo().power)}` : ""}</span>` : ""}`;
  }
  function setTab(t) {
    if (!SEC_OF[t]) t = "inicio";
    bustTick();
    if (SEC_OF[t] !== SEC_OF[ui.tab] && $("toast")) $("toast").hidden = true;   // el aviso de la sección anterior no tapa la nueva
    updateAcct();
    ui.tab = t; const sec = SEC_OF[t]; lastView[sec] = t;
    document.querySelectorAll(".tab[data-sec]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.sec === sec)));
    document.querySelectorAll("#bnav [data-bsec]").forEach(b => b.setAttribute("aria-current", b.dataset.bsec === sec ? "page" : "false"));
    const more = document.querySelector("#bnav [data-bmore]"); if (more) more.classList.toggle("on", ["biblioteca", "semana", "creador", "ajustes"].includes(sec));
    Object.keys(SEC_OF).forEach(v => $("view-" + v).hidden = v !== t);
    const S = SECTIONS[sec];
    $("secTitle").textContent = S.t; $("secDesc").textContent = S.d;
    $("subnav").innerHTML = S.v.length > 1 ? S.v.map(([v, l]) => `<button role="tab" data-view="${escAttr(v)}" aria-selected="${v === t}">${esc(l)}</button>`).join("") : "";
    try { localStorage.setItem(LS + "-tab", t); } catch {}
    if (t === "inicio") renderInicio();
    if (t === "creador") renderBuilder();
    if (t === "ii") renderII();
    if (t === "recs") renderRecs();
    if (t === "summons") renderSummons();
    if (t === "ideal") renderIdeal();
    if (t === "meta") renderMeta();
    if (t === "tier") renderTier();
    if (t === "plan") renderPlan();
    if (t === "tiendas") renderShops();
    if (t === "marionetas") renderPuppets();
    if (t === "progreso") renderProgreso();
    if (t === "probar") renderProbar();
    if (t === "camino") renderCamino();
    if (t === "mejorar") renderMejorar();
    if (t === "datos") renderDatos();
    if (t === "ajustes") renderAjustes();
    if (t === "fuentes") renderFuentes();
  }
  $("subnav").addEventListener("click", e => { const b = e.target.closest("[data-view]"); if (b) setTab(b.dataset.view); });
  const goSec = s => setTab(lastView[s] || SECTIONS[s].v[0][0]);
  const closeMore = () => { $("bmore").hidden = true; document.querySelector("#bnav [data-bmore]").setAttribute("aria-expanded", "false"); };
  document.addEventListener("click", e => {
    const s = e.target.closest("[data-bsec]"); if (s) { closeMore(); goSec(s.dataset.bsec); window.scrollTo({ top: 0 }); return; }
    if (e.target.closest("[data-bqt]")) { closeMore(); openQuickTry(ui.tab === "ii" ? ui.mode : ""); return; }
    const m = e.target.closest("[data-bmore]"); if (m) { const open = $("bmore").hidden; $("bmore").hidden = !open; m.setAttribute("aria-expanded", String(open)); return; }
    if (!e.target.closest("#bmore")) closeMore();
  });

  // ---------------- INICIO: resumen de la cuenta
  // Lista diaria y semanal. Lo marcado se guarda en este navegador (es solo una ayuda), por día y por semana.
  // Los reinicios del juego son a las 05:00 del servidor; aquí se usa el día de tu reloj.
  const CHECKS = {
    daily: [
      { id: "ii", t: L("Infinite Illusion: 2 intentos en Strength, Heart y Will (o barre el mejor)", "Infinite Illusion: 2 attempts in Strength, Heart and Will (or sweep your best)"), go: "ii" },
      { id: "ne", t: L("Ninja Exam: barrido diario y prueba el piso siguiente", "Ninja Exam: daily sweep and try the next floor"), go: "ii" },
      { id: "st", t: L("Survival Trial: cofres de Ninja Points (pisos 3, 6, 9 y 12)", "Survival Trial: Ninja Point chests (floors 3, 6, 9 and 12)") }
    ],
    weekly: [
      { id: "sm", t: L("Gasta Sun y Moon Scrolls en el Groceries antes del lunes 05:00 (lo que pase del tope se pierde en Strange Stone)", "Spend Sun and Moon Scrolls at the Groceries before Monday 05:00 (anything over the cap turns into Strange Stone)"), go: "tiendas" },
      { id: "gv", t: L("Group Shop: compra la Mystery Gem si se ha repuesto", "Group Shop: buy the Mystery Gem if it has restocked"), go: "tiendas" },
      { id: "ar", t: L("Ranked: juega tus combates y anota los que pierdas", "Ranked: play your fights and log the ones you lose"), go: "ii" }
    ],
    events: [
      { id: "ev-sasuke", t: "3v3 Arena: recoge a Sasuke [Ronin] (gratis)", until: "2026-10-06" },
      { id: "ev-cycle", t: "Ciclo del 1 al 7 de octubre: revisa el plan de la semana", until: "2026-10-07", go: "plan" }
    ]
  };
  const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
  const weekKey = (d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return "w" + dayKey(x); };
  function checkLoad() { try { return JSON.parse(localStorage.getItem(LS + "-check")) || {}; } catch { return {}; } }
  function checkSave(s) { try { localStorage.setItem(LS + "-check", JSON.stringify(s)); } catch {} }
  function homeChecklist() {
    const st = checkLoad(), dk = dayKey(), wk = weekKey(), today = dk;
    const done = (scope, id) => !!((st[scope === "daily" ? dk : scope === "weekly" ? wk : "ev"] || {})[id]);
    const item = (scope, x) => `<label class="chk-row"><input type="checkbox" data-chk="${scope}:${x.id}" ${done(scope, x.id) ? "checked" : ""}><span>${esc(x.t)}${x.until ? ` <span class="muted mono">· ${L("hasta el", "until")} ${esc(x.until.slice(8, 10) + "/" + x.until.slice(5, 7))}${Math.round((new Date(x.until) - new Date(today)) / 864e5) <= 1 ? L(" (¡ya!)", " (now!)") : ""}</span>` : ""}${x.go ? ` <a href="#" class="go-link" data-go="${escAttr(x.go)}">ir →</a>` : ""}</span></label>`;
    const ev = CHECKS.events.filter(x => x.until >= today);
    return `<article class="panel"><div class="row" style="justify-content:space-between"><h3>${L("Tu lista", "Your checklist")}</h3><span class="note">${L("Se reinicia cada día y cada lunes", "Resets every day and every Monday")}</span></div>
      <div class="home-grid" style="margin-top:6px">
        <div><div class="eyebrow">${L("Hoy", "Today")}</div><div class="chk-list">${CHECKS.daily.map(x => item("daily", x)).join("")}</div></div>
        <div><div class="eyebrow">${L("Esta semana", "This week")}</div><div class="chk-list">${CHECKS.weekly.map(x => item("weekly", x)).join("")}</div>
          ${ev.length ? `<div class="eyebrow" style="margin-top:10px">${L("Con fecha límite", "With a deadline")}</div><div class="chk-list">${ev.map(x => item("events", x)).join("")}</div>` : ""}</div>
      </div></article>`;
  }
  // Tus mejores resultados por modo (de los intentos registrados): lo que de verdad funciona en tu cuenta.
  function homeBest() {
    const rows = MODES.map(m => {
      const ts = Object.values(tries).filter(x => x.mode === m.k);
      if (!ts.length) return null;
      const best = m.kind === "pvp" ? null : ts.reduce((a, b) => (+b.damage || 0) > (+a.damage || 0) ? b : a);
      if (!best) return null;
      const res = m.kind === "exam" ? L("piso ", "floor ") + best.damage : Number(best.damage).toLocaleString(L("es-ES", "en-GB")) + L(" de daño", " damage");
      return `<div class="best-row"><div class="eyebrow">${esc(m.name)}</div><div class="best-faces">${(best.team || []).map(s => BY.get(s) ? pic(s, BY.get(s).n) : "").join("")}</div><div><b>${esc(res)}</b>${best.power ? ` <span class="muted mono">· ${Math.round(best.power / 1000)}k ${L("de poder", "power")}</span>` : ""}<div class="note">${esc(String(best.altLabel || best.alt).replace(/ · probada.*$/, ""))}</div></div></div>`;
    }).filter(Boolean);
    if (!rows.length) return "";
    return `<article class="panel"><div class="row" style="justify-content:space-between"><h3>${L("Tus mejores resultados", "Your best results")}</h3><button class="btn small" data-go="ii">${L("Ver intentos", "See attempts")}</button></div>
      <p class="note" style="margin:2px 0 8px">${L("El mejor intento registrado en cada modo. Esto manda sobre cualquier tier list.", "Your best logged attempt in each mode. This beats any tier list.")}</p><div class="best-list">${rows.join("")}</div></article>`;
  }
  // Récords por modo (mejor intento registrado, también de equipos ya borrados) y equipos sin probar.
  const shortRes = v => !v ? "0" : v >= 1e6 ? (v / 1e6).toLocaleString(EN ? "en-GB" : "es-ES", { maximumFractionDigits: 2 }) + "M" : Math.round(v / 1000) + "k";
  function modeRecord(m) {
    const ts = Object.values(tries).filter(x => x.mode === m.k);
    if (!ts.length) return null;
    if (m.kind === "pvp") { const w = ts.filter(x => x.result === "win").length, by = {};
      ts.forEach(x => { (by[x.alt] = by[x.alt] || []).push(x); });
      // el equipo con mejor pvpScore que haya ganado alguna vez; su última victoria es la que se enseña
      const top = Object.values(by).filter(l => l.some(x => x.result === "win")).sort((a, b) => pvpScore(b.filter(x => x.result === "win").length, b.length) - pvpScore(a.filter(x => x.result === "win").length, a.length))[0];
      const best = top ? top.filter(x => x.result === "win").sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] : null;
      return { big: `${w}/${ts.length}`, sub: L("victorias", "wins"), best, n: ts.length }; }
    const best = ts.reduce((a, b) => (+b.damage || 0) > (+a.damage || 0) ? b : a);
    return { big: m.kind === "exam" ? L("Piso ", "Floor ") + best.damage : shortRes(+best.damage), sub: m.kind === "exam" ? L("piso más alto", "highest floor") : L("de daño", "damage"), best, n: ts.length };
  }
  // Listas largas: 3 a la vista y el resto en «Ver los N restantes» (rediseño, fases 3-4).
  const foldRest = (list, fn, label) => list.slice(0, 3).map(fn).join("")
    + (list.length > 3 ? `<details class="grp-rest"><summary>${esc(label ? label(list.length - 3) : L(`Ver los ${list.length - 3} restantes`, `See the other ${list.length - 3}`))}</summary>${list.slice(3).map(fn).join("")}</details>` : "");
  const altShort = s => String(tc(s || "")).replace(/^[A-Z]\s*·\s*/, "").replace(/\s*·\s*(probada|sin probar).*$/i, "");
  // Sin intentos y que puedes montar ya (en la app salen también los del top a los que les falta alguien: esos no).
  function untestedOf(m) { return byLearn(m, altsOf(m).filter(a => !a.puppet && !(a.miss || []).length && !triesOf(m.k, a.id).length)); }
  // Recomendados escritos a mano para el usuario del Cuartel (RECS: «ya lo tienes», «tu equipo A»…): en la app no se usan.
  const MY_RECS = IS_APP ? [] : RECS;
  const recAll = s => ["rising", "carry", "sup", "pve"].flatMap(g => REC_ALL[g] || []).find(r => r.s === s);
  const howToGet = s => { const r = MY_RECS.find(x => x.s === s); if (r && r.now) return r.now; const a = recAll(s); return a && a.get ? a.get : ""; };
  // ---- «Helper» para cualquier cuenta: qué conseguir y qué mejorar, a partir de los equipos de cada modo.
  const PLUS = s => ((typeof NINJA_PLUS !== "undefined" && NINJA_PLUS.by) || {})[s] || {};
  // Cuánto gasta el usuario en el juego (lo elige él en el asistente, en Mi roster o en Inicio). Sin elegir, se trata
  // como f2p. Cambia qué conviene conseguir, cómo leer el plan de la semana y en qué invertir. Deducción mía.
  const SPENDS = [["f2p", "No gasto (F2P)", "I don't spend (F2P)"], ["poco", "Gasto poco, en algo concreto", "I spend a little, on specific things"],
    ["medio", "Gasto a menudo", "I spend regularly"], ["ballena", "Gasto mucho", "I spend a lot"]];
  const spendLv = () => ({ poco: 1, medio: 2, ballena: 3 })[profile.spend] || 0;
  const spendName = () => { const x = SPENDS.find(y => y[0] === profile.spend); return x ? L(x[1], x[2]) : ""; };
  // Cómo se consigue: gratis en eventos del último año, gratis hace tiempo, de pago (premio por gasto o evento de pago) o solo gacha.
  // Sin dato de eventos (NINJA_PLUS), los packs de los eventos (PACKS) dicen si sale fuera del gacha: casi todos
  // esos packs son de eventos de pago (recarga o gasto), así que cuenta como de pago, reciente si salió el último año.
  const acqOf = s => { const g = PLUS(s).get;
    if (!g) { const P = typeof packsOf === "function" ? packsOf(s) : []; return !P.length ? "gacha" : packFree(s) ? "free" : P.some(x => x.recent) ? "paid" : "paidold"; }
    return g.paid ? (g.n12 > 0 ? "paid" : "paidold") : g.n12 > 0 ? "free" : "freeold"; };
  const spendSelect = id => `<select id="${escAttr(id)}" data-spend-sel aria-label="${L("Cuánto gastas en el juego", "How much you spend in the game")}"><option value=""${profile.spend ? "" : " selected"}>${L("Sin decir (como F2P)", "Not set (as F2P)")}</option>${SPENDS.map(([k, es, en]) => `<option value="${escAttr(k)}"${profile.spend === k ? " selected" : ""}>${L(es, en)}</option>`).join("")}</select>`;
  // Veredicto del plan para tu perfil: el plan está escrito pensando en F2P; a quien gasta, los eventos de pago le pueden interesar.
  function evVerd(e) {
    // solo se reescriben los «Ignora» de pago; «Si ya tiras» y similares ya están pensados para quien gasta
    const lv = spendLv(); if (!lv || !/^ignora/i.test(e.v || "")) return null;
    const wants = !!eventInterest(e);
    if (lv === 1) return wants ? [L("Solo si te completa equipos", "Only if it completes teams for you"), "Media"] : null;
    return wants ? [L("Te interesa (de pago)", "Useful for you (paid)"), "Alta"] : [L("Si vas a gastar, mira qué da", "If you'll spend, check what it gives"), "Media"];
  }
  const monthTxt = d => { const [y, mo] = String(d).split("-"); return new Date(+y, (+mo || 1) - 1, 15).toLocaleDateString(EN ? "en-GB" : "es-ES", { month: "short", year: "numeric" }); };
  // Cómo se consigue fuera del gacha (NINJA_PLUS.get, de la tabla de eventos y Fukurokumaru): la vía y la última vez.
  function getLine(s) { const wl = weekLine(s), base = getLineBase(s);
    return wl ? wl + (/^(No ha salido|It hasn't been)/.test(base) ? "" : " " + base) : base; }
  function getLineBase(s) {
    const g = PLUS(s).get;
    if (g) { const via = g.paid ? (/^Fukuro/.test(g.src) ? L("Fukurokumaru's Deal (premio por gasto)", "Fukurokumaru's Deal (spending reward)") : g.src + L(" (de pago)", " (paid)")) : g.src;
      return L(`${via}: última vez en ${monthTxt(g.last)}${g.n12 > 1 ? `; ${g.n12} veces en el último año` : ""}.`, `${via}: last time in ${monthTxt(g.last)}${g.n12 > 1 ? `; ${g.n12} times in the last year` : ""}.`); }
    const h = howToGet(s); if (h) return h;
    const pl = packLine(s); if (pl) return pl;
    return L("No ha salido fuera del gacha en los datos (2018-2026): gacha, packs o un evento nuevo.", "It hasn't been given outside the gacha in the data (2018-2026): gacha, packs or a new event.");
  }
  // Ninjas que dan los eventos de esta semana (PLAN.events: nombre y premios). Los nombres del plan van abreviados
  // («Itachi [Ronin]»): se buscan por el nombre completo, por «Nombre [Versión]» y por el nombre suelto si no hay dudas.
  let weekMemo = null;
  function weekNinjas() {
    if (weekMemo) return weekMemo;
    const out = new Map();
    if (typeof PLAN === "undefined" || !PLAN.events || planState() === "old") return (weekMemo = out);
    const alias = new Map(), dup = new Set();
    const add = (a, s) => { a = a.toLowerCase(); if (alias.has(a) && alias.get(a) !== s) dup.add(a); else alias.set(a, s); };
    D.ninjas.filter(n => !n.m).forEach(n => { add(n.n, n.s); const m = n.n.match(/^(\S+)(?: [^[]+)? (\[[^\]]+\])$/); if (m) add(m[1] + " " + m[2], n.s); });
    const names = [...alias.keys()].filter(a => !dup.has(a)).sort((a, b) => b.length - a.length);
    PLAN.events.forEach(e => {
      let txt = ((e.n || "") + " · " + (e.g || "")).toLowerCase();
      names.forEach(a => { const i = txt.indexOf(a); if (i < 0) return;
        const after = txt[i + a.length] || " "; if (/[a-z]/.test(after)) return;   // «Sakura» no vale dentro de «Sakura's Gift»
        txt = txt.slice(0, i) + " ".repeat(a.length) + txt.slice(i + a.length);
        const s = alias.get(a); if (out.has(s)) return;
        const pay = /^ignora/i.test(e.v || "") || (/recarg|seal scroll|lingote/i.test(e.c || "") && !/gratis/i.test(e.c || ""));
        out.set(s, { ev: e.n, v: e.v, pay, rank: /ranking|top \d/i.test(e.g || "") }); });
    });
    return (weekMemo = out);
  }
  // Por qué te interesa un evento de esta semana: los ninjas que da y que te completan equipos (los que ya tienes, no).
  function eventInterest(e) {
    if (!e) return "";
    const W = new Map(wantList().map(x => [x.s, x]));
    const l = [...weekNinjas()].filter(([s, w]) => w.ev === e.n && !profile.owned[s] && W.get(s))
      .map(([s]) => { const x = W.get(s), nm = (BY.get(s) || { n: s }).n;
        return x.one.length ? L(`${nm} te completa ${x.one.length} equipo${x.one.length > 1 ? "s" : ""}`, `${nm} completes ${x.one.length} team${x.one.length > 1 ? "s" : ""} for you`)
          : L(`${nm} va en ${x.two.length} equipos a los que les falta él y otro`, `${nm} is in ${x.two.length} teams missing it and one more`); });
    return l.length ? `<div class="note"><span class="tag-own">${L("Te interesa", "Useful for you")}</span> ${esc(l.join("; "))}${weekNinjas().get([...weekNinjas()].find(([s, w]) => w.ev === e.n && W.get(s))[0]).rank ? esc(L(" (premio de ranking)", " (ranking reward)")) : ""}.</div>` : "";
  }
  // ---- Packs de los eventos (web/gen/packs.js; no se enseñan como tabla ni buscador, solo para recomendar). Por pack: evento, tipo
  // (o = a elegir uno, f = fijo, r = al azar) y ninjas/summons con cantidad. El año va en el nombre («2026 …»).
  const PK = () => (typeof PACKS !== "undefined" && PACKS.packs) || {};
  const pkNorm = s => String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  let pkIdx = null;
  function packIndex() {
    if (pkIdx) return pkIdx;
    const byName = new Map(), byNinja = new Map();
    Object.entries(PK()).forEach(([name, p]) => { const y = +((name.match(/^(20\d\d)\b/) || [])[1] || 0); byName.set(pkNorm(name), { name, y, ...p });
      (p.n || []).forEach(([s, q]) => { const l = byNinja.get(s) || []; l.push({ name, e: p.e, t: p.t, q, y }); byNinja.set(s, l); }); });
    return (pkIdx = { byName, byNinja });
  }
  // Los packs que nombra un evento del plan (por su nombre dentro del texto de premios: «… Optional Pack XI (uno a elegir)…»).
  function eventPacks(e) {
    const txt = pkNorm((e && e.g) || ""); if (!txt) return [];
    return [...packIndex().byName.entries()].filter(([k]) => k.length > 12 && txt.includes(k)).map(([, p]) => p)
      .filter((p, i, a) => !a.some(q => q !== p && q.name.length > p.name.length && pkNorm(q.name).includes(pkNorm(p.name))));   // «Pack XI» no cuenta si está «Pack XIII»
  }
  // Packs en los que sale un ninja, por evento: cuántos, del último año y el más reciente. Para «¿Dónde sale?» y «vuelve a menudo».
  function packsOf(s) {
    const by = new Map(), now = new Date().getFullYear();
    (packIndex().byNinja.get(s) || []).forEach(x => { const g = by.get(x.e) || { e: x.e, n: 0, recent: 0, y: 0, maxQ: 0 }; g.n++; if (x.y >= now - 1) g.recent++; g.y = Math.max(g.y, x.y); g.maxQ = Math.max(g.maxQ, x.q); by.set(x.e, g); });
    return [...by.values()].sort((a, b) => b.recent - a.recent || b.y - a.y || b.n - a.n);
  }
  const packRecent = s => packsOf(s).reduce((a, g) => a + g.recent, 0);
  // Eventos cuyos packs se sacan jugando, sin pagar (deducción mía: el Great Tree se sube con Dew Drops de Survival
  // Trial, Arena y Team Instances). Un ninja que sale ahí cuenta como conseguible gratis.
  const FREE_PK = new Set(["Konoha Great Tree"]);
  const packFree = s => packsOf(s).some(g => FREE_PK.has(g.e));   // sus packs no llevan año: es un evento de casi todas las semanas
  function packLine(s) {
    const P = packsOf(s); if (!P.length) return "";
    const txt = P.slice(0, 3).map(g => `${g.e} (${g.n} pack${g.n > 1 ? "s" : ""}${g.y ? L(`, el último de ${g.y}`, `, latest ${g.y}`) : ""})`).join(", ");
    return L(`Sale en packs de ${txt}${P.length > 3 ? ` y ${P.length - 3} evento${P.length > 4 ? "s" : ""} más` : ""}.`, `It comes in packs from ${txt}${P.length > 3 ? ` and ${P.length - 3} more event${P.length > 4 ? "s" : ""}` : ""}.`)
      + (packsOf(s).some(g => FREE_PK.has(g.e)) ? L(" Los del Konoha Great Tree se sacan jugando (Dew Drops), sin pagar.", " The Konoha Great Tree ones come from playing (Dew Drops), no payment.") : "")
      + (packRecent(s) >= 3 ? L(" Vuelve a menudo: no hace falta forzarlo en una sola semana.", " It comes back often: no need to force it in a single week.") : "");
  }
  const packQA = s => { const l = packsOf(s).length && !/^(Sale en packs|It comes in packs)/.test(getLine(s)) ? packLine(s) : ""; return l ? `<dt>${L("¿En qué packs sale?", "Which packs is it in?")}</dt><dd>${esc(l)}</dd>` : ""; };
  // Puntuación de un premio del plan para tu cuenta (la usan «Tu jugada» y «Para ti» de cada evento).
  const rwPaid = (e, r) => r.pay != null ? r.pay : /^ignora/i.test(e.v || "") || (/recarg|seal scroll|lingote|gast/i.test(e.c || "") && !/gratis/i.test(e.c || ""));
  function playScore(e, r, ctx) {
    const { lv, W, INV } = ctx, pay = rwPaid(e, r), cw = pay ? [0, 0.6, 0.9, 1][lv] : 1; if (!cw) return null;
    const o = profile.owned[r.s], w = W.get(r.s), inv = INV.get(r.s), goal = goalsOf().some(y => y.s === r.s && !goalDone(y));
    let val = 0, act = "";
    if (!o && w) { val = w.score; act = "get"; }
    // subirlo: si compensa según su ficha, o si el usuario lo persigue (lo tiene en Tus objetivos)
    else if (o && inv && (inv.act === "star" || inv.act === "kit") && !inv.neg && (goal || (inv.proof && !inv.slow))) { val = 2 + inv.use * 0.5; act = "up"; }
    if (!val) return null;
    // lo que de verdad puedes sacar: fragmentos que da el evento frente a los que te faltan (tu objetivo; si no,
    // 80 para reclutar y 100 de 3★ a 4★, lo normal en S y SS). Y un objetivo apuntado pesa mucho: es lo que persigues.
    const g = goalsOf().find(y => y.s === r.s && !goalDone(y)), rem = g && +g.need > 0 ? Math.max(0, +g.need - (+g.have || 0)) : act === "get" ? 80 : 100;
    const maxPacks = e.tiers && PLAN.tiers ? PLAN.tiers.reduce((a, t) => a + t.packs, 0) : 3;
    const gets = r.per === "store" ? rem : r.per === "pack" ? r.q * maxPacks : r.q, reach = Math.min(1, gets / (rem || 1));
    val = val * (0.3 + 0.7 * reach) * (r.per === "jackpot" && lv < 3 ? 0.4 : 1) + (g ? 6 : 0);   // el premio gordo pide muchas tiradas de pago
    return { e, r, pay, act, w, inv, val: val * cw, reach, gets };
  }
  const playCtx = () => ({ lv: spendLv(), W: new Map(wantList().map(x => [x.s, x])), INV: new Map(investPlan().map(x => [x.s, x])) });
  // Cuánto gastar en un evento por tramos (PLAN.tiers, Fukurokumaru's Deals): con lo que te falta del mejor premio,
  // el tramo que lo completa y, según tu perfil de gasto, dónde parar. Más allá de ese tramo no te acerca a nada.
  function spendStop(e, best) {
    if (!e.tiers || !PLAN.tiers || !best || best.r.per !== "pack") return "";
    const lv = spendLv(), q = best.r.q, g = goalsOf().find(y => y.s === best.r.s && +y.need > 0 && !goalDone(y));
    const rem = g ? Math.max(0, +g.need - (+g.have || 0)) : best.act === "get" ? 80 : 100, need = Math.ceil(rem / q);
    let cum = 0; const T = PLAN.tiers.map(x => ({ ...x, cum: (cum += x.packs) })), first = T.find(x => x.packs), done = T.find(x => x.cum >= need), top = T[T.length - 1];
    const k = n => n.toLocaleString(EN ? "en-GB" : "es-ES");
    if (!lv) return L("No gastas: este evento no es para ti; lo gratis de la semana, en «Cada día».", "You don't spend: this event isn't for you; this week's free stuff is in «Every day».");
    if (lv === 1) return first ? L(`Con poco gasto: el primer tramo con packs es ${k(first.at)} (${first.packs} packs = ${first.packs * q} de ${rem}). ${done ? `Completarlo pide ${k(done.at)}.` : `Ni a ${k(top.at)} lo completas.`}`,
      `On a small budget: the first tier with packs is ${k(first.at)} (${first.packs} packs = ${first.packs * q} of ${rem}). ${done ? `Completing it takes ${k(done.at)}.` : `Not even ${k(top.at)} completes it.`}`) : "";
    return done ? (done === top ? L(`Llega hasta ${k(done.at)}: es el último tramo.`, `Go up to ${k(done.at)}: it's the last tier.`)
        : L(`Para en ${k(done.at)}: más allá ya no te acerca a nada.`, `Stop at ${k(done.at)}: beyond that it doesn't get you anything.`))
      : L(`Ni a ${k(top.at)} lo completas (${top.cum} packs = ${top.cum * q} de ${rem}): mira si vuelve otra semana.`, `Not even ${k(top.at)} completes it (${top.cum} packs = ${top.cum * q} of ${rem}): check whether it comes back another week.`);
  }
  // Camino a un objetivo esta semana: de dónde salen sus fragmentos (gratis primero), cuánto da cada sitio y si llegas.
  function goalRoute(g) {
    if (!g || !g.s || goalDone(g) || typeof PLAN === "undefined" || !PLAN.events || planState() === "old") return "";
    const rem = +g.need > 0 ? Math.max(0, +g.need - (+g.have || 0)) : 0, lv = spendLv(), k = n => n.toLocaleString(EN ? "en-GB" : "es-ES");
    const src = [];
    PLAN.events.forEach(e => (e.rw || []).filter(r => r.s === g.s).forEach(r => {
      const paid = rwPaid(e, r), packs = e.tiers && PLAN.tiers ? PLAN.tiers.reduce((a, x) => a + x.packs, 0) : 1;
      const sure = r.per === "jackpot" || r.per === "store" || r.q == null ? 0 : r.per === "pack" ? r.q * packs : r.q;
      src.push({ e, r, paid, sure, txt: r.per === "jackpot" ? L(`${e.n} (premio gordo ×${r.q}, al azar)`, `${e.n} (jackpot ×${r.q}, random)`)
        : r.per === "store" ? L(`${e.n} (en su tienda)`, `${e.n} (in its shop)`)
        : r.per === "pack" ? L(`${e.n} (×${r.q} por pack${packs > 1 ? `, hasta ${packs} packs` : ""}${paid ? ", de pago" : ""})`, `${e.n} (×${r.q} per pack${packs > 1 ? `, up to ${packs} packs` : ""}${paid ? ", paid" : ""})`)
        : L(`${e.n} (×${r.q}${paid ? ", de pago" : ""})`, `${e.n} (×${r.q}${paid ? ", paid" : ""})`) });
    }));
    const free = packsOf(g.s).filter(x => FREE_PK.has(x.e));
    if (!src.length && !free.length) return "";
    src.sort((a, b) => a.paid - b.paid || b.sure - a.sure);
    const freeSure = src.filter(x => !x.paid).reduce((a, x) => a + x.sure, 0), paidSure = src.filter(x => x.paid).reduce((a, x) => a + x.sure, 0);
    let v = "";
    if (rem && src.length) v = freeSure >= rem ? L("Lo completas gratis esta semana.", "You complete it for free this week.")
      : lv && freeSure + paidSure >= rem ? (() => { const fk = src.find(x => x.paid && x.e.tiers && x.r.per === "pack"); const st = fk ? spendStop(fk.e, { r: fk.r, act: "up" }) : "";
          return L("Pagando lo completas esta semana.", "Paying, you complete it this week.") + (st ? " " + st : ""); })()
      : L(`Esta semana no llegas: con lo seguro te quedas en ${Math.min(+g.need, (+g.have || 0) + freeSure + (lv ? paidSure : 0))}/${g.need}.`, `You won't make it this week: with the sure part you'd reach ${Math.min(+g.need, (+g.have || 0) + freeSure + (lv ? paidSure : 0))}/${g.need}.`);
    return `<div class="note goal-route">${src.length ? `<b>${L("Esta semana", "This week")}:</b> ${esc(src.map(x => x.txt).join("; "))}. ` : ""}${esc(v)}${free.length ? " " + esc(L(`Sale en ${free[0].n > 1 ? `${free[0].n} packs` : "un pack"} del Konoha Great Tree, que se hace jugando: atento cuando vuelva.`, `It comes in ${free[0].n > 1 ? `${free[0].n} packs` : "a pack"} of the Konoha Great Tree, which you do by playing: watch for it.`)) : ""}</div>`;
  }
  // «Para ti» en cada evento: qué opción elegir en sus packs a elegir y qué sale al azar.
  function packAdvice(e) {
    if (!e) return "";
    // qué elegir no depende de cuánto gastes (eso decide si haces el evento, que ya dice su veredicto): se puntúa como si lo hicieras
    const out = [], P = eventPacks(e), ctx = { ...playCtx(), lv: 3 }, nm = s => (BY.get(s) || { n: s }).n;
    const opts = (e.rw || []).filter(r => r.per === "pack");
    if (opts.length > 1) {
      const best = opts.map(r => playScore(e, r, ctx)).filter(Boolean).sort((a, b) => b.val - a.val)[0];
      // a quien no gasta, un evento de gasto por tramos no le toca: se dice primero, y qué elegir queda para el día que gaste
      if (best && e.tiers && !spendLv()) out.push(L(`<b>Para ti:</b> no gastas, así que este evento no es para ti. Si un día gastas, aquí elige ${esc(nm(best.r.s))} (×${best.r.q} por pack).`, `<b>For you:</b> you don't spend, so this event isn't for you. If you ever spend, pick ${esc(nm(best.r.s))} here (×${best.r.q} per pack).`));
      else if (best) { out.push(L(`<b>Para ti:</b> elige ${esc(nm(best.r.s))} en todos los packs (×${best.r.q} cada uno). ${esc(playMath(best))}`, `<b>For you:</b> pick ${esc(nm(best.r.s))} in every pack (×${best.r.q} each). ${esc(playMath(best))}`));
        const st = spendStop(e, best); if (st) out.push(st); }
      else {
        // ningún ninja te acerca a nada: un summon que no tienes, o los objetos
        const sm = P.flatMap(p => p.s || []).find(([s]) => !(profile.summons || []).includes(s));
        const smn = sm && (SUM.get(sm[0]) || {}).n;
        out.push(smn ? L(`<b>Para ti:</b> ningún ninja de este pack te acerca a nada ahora; coge el summon ${esc(smn)} (no lo tienes).`, `<b>For you:</b> no ninja in this pack helps you right now; take the summon ${esc(smn)} (you don't have it).`)
          : L("<b>Para ti:</b> ningún ninja de este pack te acerca a nada ahora; mejor el pack de objetos.", "<b>For you:</b> no ninja in this pack helps you right now; better take the item pack."));
      }
    }
    // al azar: lo que toca no se elige; el premio gordo pide muchas tiradas
    if (P.some(p => p.t === "r")) out.push(L("Ojo: algún pack de este evento sale <b>al azar</b>; lo que te toque no se elige.", "Careful: some packs in this event are <b>random</b>; you don't choose what you get."));
    else if ((e.rw || []).some(r => r.per === "jackpot")) out.push(L("Ojo: el premio gordo sale al azar y pide muchas tiradas; no cuentes con él.", "Careful: the jackpot is random and takes many spins; don't count on it."));
    return out.length ? `<div class="note pack-adv">${out.join(" ")}</div>` : "";
  }
  // «Tu jugada de la semana»: los premios con cantidades del plan (PLAN.events[].rw: {s, q, per: pack|total|store, pay?})
  // cruzados con tu cuenta: ninjas que te completan equipos (wantList) o que te compensa subir de estrellas (investPlan),
  // según tu perfil de gasto. Con un objetivo apuntado (Tus objetivos), cuenta los packs y el tramo de gasto que hacen falta.
  function weekPlays() {
    if (typeof PLAN === "undefined" || !PLAN.events || planState() === "old") return [];
    const ctx = playCtx(), best = new Map();
    PLAN.events.forEach(e => (e.rw || []).forEach(r => {
      const x = playScore(e, r, ctx); if (!x) return;
      const cur = best.get(r.s); if (!cur || x.val > cur.val) best.set(r.s, x);
    }));
    return [...best.values()].sort((a, b) => b.val - a.val);
  }
  // Cuántos packs o fragmentos hacen falta, si el usuario tiene un objetivo con números para ese ninja.
  function playMath(x) {
    const g = goalsOf().find(y => y.s === x.r.s && +y.need > 0 && !goalDone(y)), rem = g ? Math.max(0, +g.need - (+g.have || 0)) : 0, q = x.r.q;
    if (x.r.per === "store") return L("En su tienda de esta semana.", "In this week's shop.");
    if (x.r.per === "jackpot") return L(`Premio gordo (×${q}): hacen falta muchas tiradas o recargas.`, `Jackpot (×${q}): it takes a lot of spins or recharges.`);
    if (x.r.per === "pack") {
      if (!rem) return L(`×${q} por pack. Apunta en Tus objetivos cuántos fragmentos te faltan y te digo cuántos packs necesitas.`, `×${q} per pack. Note in Your goals how many fragments you're missing and you'll see how many packs you need.`);
      const packs = Math.ceil(rem / q); let cum = 0, tier = null;
      if (x.e.tiers && PLAN.tiers) tier = PLAN.tiers.find(t => (cum += t.packs) >= packs);
      return L(`Te faltan ${rem}: son ${packs} pack${packs > 1 ? "s" : ""} (×${q} cada uno)`, `You're missing ${rem}: that's ${packs} pack${packs > 1 ? "s" : ""} (×${q} each)`)
        + (x.e.tiers && PLAN.tiers ? (tier ? L(`, que se consiguen llegando a ${tier.at.toLocaleString("es-ES")} de gasto.`, `, reached by spending ${tier.at.toLocaleString("en-GB")}.`) : L(": más de los que da el evento.", ": more than the event gives.")) : ".");
    }
    return rem ? (q >= rem ? L(`Da hasta ${q}: te basta para los ${rem} que te faltan.`, `Gives up to ${q}: enough for the ${rem} you're missing.`) : L(`Da hasta ${q} de los ${rem} que te faltan.`, `Gives up to ${q} of the ${rem} you're missing.`))
      : L(`Hasta ×${q}.`, `Up to ×${q}.`);
  }
  function weekPlayHtml(compact) {
    const P = weekPlays(), nm = s => (BY.get(s) || { n: s }).n;
    if (typeof PLAN === "undefined" || planState() === "old") return "";
    if (!P.length) return `<div class="week-play"><span class="eyebrow">${L("Tu jugada de la semana", "Your play of the week")}</span><p class="note" style="margin:4px 0 0">${L("Esta semana ningún premio te completa equipos ni te compensa subir a nadie", "This week no reward completes teams for you or is worth upgrading anyone")}${spendLv() ? "" : L(" sin gastar", " without spending")}: ${L("haz lo gratis.", "do the free stuff.")}</p></div>`;
    const x = P[0], why = x.act === "get" ? wantWhy(x.w, true) : L(`Te compensa subirlo: ${x.inv.act === "kit" ? `a ${x.inv.to}★ cambia su kit` : `a ${x.inv.to}★ se abre su breakthrough`}.`, `Worth upgrading: ${x.inv.act === "kit" ? `at ${x.inv.to}★ its kit changes` : `at ${x.inv.to}★ its breakthrough opens`}.`);
    const short = x.reach < 1 && x.act === "get" ? " " + L(`Ojo: el evento da hasta ${x.gets} fragmentos, probablemente no basta para reclutarlo.`, `Note: the event gives up to ${x.gets} fragments, probably not enough to recruit it.`) : "";
    const tag = x.pay ? `<span class="tag-miss">${L("de pago", "paid")}</span>` : `<span class="tag-own">${L("gratis", "free")}</span>`;
    const also = P.length > 1 ? `${L("También", "Also")}: ${P.slice(1, 3).map(y => `${esc(nm(y.r.s))} (${esc(y.e.n)}${y.pay ? L(", de pago", ", paid") : ""})`).join("; ")}.` : "";
    // En Inicio, una línea: quién y dónde, el botón y el porqué plegado
    if (compact) return `<div class="week-play week-line">${pic(x.r.s, nm(x.r.s))}<div style="min-width:0"><span class="eyebrow">${L("Tu jugada", "Your play")}</span> <b>${esc(nm(x.r.s))}</b> ${L("en", "in")} <b>${esc(x.e.n)}</b> ${tag}
        <details class="why-more"><summary>${L("¿Por qué?", "Why?")}</summary><p class="note">${esc(why)} ${esc(playMath(x))}${esc(short)}${also ? " " + also : ""}</p></details></div>
      <div class="todo-act">${goalBtn(x.r.s, x.act === "get" ? L("Conseguirlo", "Get it") : upWhat(x.inv), x.e.n)}</div></div>`;
    return `<div class="week-play"><span class="eyebrow">${L("Tu jugada de la semana", "Your play of the week")}</span>
      <div class="week-play-main">${pic(x.r.s, nm(x.r.s))}<div style="min-width:0"><b>${esc(nm(x.r.s))}</b> ${L("en", "in")} <b>${esc(x.e.n)}</b> ${tag}
        <div class="note">${esc(why)} ${esc(playMath(x))}${esc(short)}</div>
        <div class="row" style="margin-top:4px">${goalBtn(x.r.s, x.act === "get" ? L("Conseguirlo", "Get it") : upWhat(x.inv), x.e.n)}<button class="btn small" data-go="plan">${L("Ver el plan", "See the plan")}</button></div></div></div>
      ${also ? `<p class="note" style="margin:6px 0 0">${also}</p>` : ""}</div>`;
  }
  const weekLine = s => { const w = weekNinjas().get(s); if (!w) return "";
    return w.pay ? L(`Sale esta semana en ${w.ev} (de pago).`, `It's in ${w.ev} this week (paid).`)
      : w.rank ? L(`Sale esta semana en ${w.ev}, pero como premio del ranking del servidor: difícil si no vas arriba.`, `It's in ${w.ev} this week, but as a server ranking reward: hard unless you're near the top.`)
      : L(`¡Sale esta semana en ${w.ev}!`, `It's in ${w.ev} this week!`); };
  // Equipos de cada modo con los que se cuenta: en la app, los de Equipos (referencia, top, montados, trío);
  // en el Cuartel, los Equipos ideales (los de MODES son los del usuario y ya los tiene).
  // Inicio llama a estas tres varias veces en el mismo repintado (cada evento de la semana, «Qué conseguir», «Tus
  // próximos pasos»…) y con rosters grandes cuestan. Se calculan una vez por repintado: el resultado vale hasta que
  // termina el código que está corriendo (los datos no cambian a mitad de un repintado). No se modifican los resultados.
  const tickCache = {};
  const stInherited = new Set();   // ninjas recién marcados con las estrellas del anterior (Mi roster)
  function perTick(k, fn) { if (!(k in tickCache)) { tickCache[k] = fn(); setTimeout(() => { delete tickCache[k]; }); } return tickCache[k]; }
  // Al cambiar los datos (perfil, intentos) o pintar otra vista, lo calculado ya no vale: al arrancar, el primer pintado
  // es con el perfil vacío y el segundo, en la misma tarea, con el cargado.
  function bustTick() { for (const k in tickCache) delete tickCache[k]; weekMemo = null; }
  function helperTeams() { return perTick("helper", helperTeamsCalc); }
  function wantList() { return perTick("want", wantListCalc); }
  function investPlan() { return perTick("invest", investPlanCalc); }
  function helperTeamsCalc() {
    const has = s => isMainS(s) || !!profile.owned[s];
    const src = IS_APP ? MODES.filter(m => m.k !== "rk").map(m => ({ m, alts: altsOf(m) })) : IDEAL.map(m => ({ m, alts: m.alts }));
    const seen = new Set(), out = [];
    src.forEach(({ m, alts }) => alts.forEach(a => { if (a.puppet || a.custom) return;
      const k = (m.kind === "pvp" ? "pvp" : m.k) + ":" + memKey(a.cells || []); if (seen.has(k)) return; seen.add(k);
      out.push({ m, a, miss: [...new Set(IS_APP ? (a.miss || []) : (a.cells || []).filter(x => x && !has(x)))] }); }));
    return out;
  }
  const modeShort = m => String(m.name).replace(/^II · /, "");
  // Qué conseguir: cada ninja que te falta, por los equipos que te completa (los que solo esperan a él; medio punto
  // los que esperan a él y a otro), su tier y si se puede conseguir fuera del gacha. Deducción mía con esos datos.
  function wantListCalc() {
    const per = new Map(), cw = a => ({ Alta: 1.2, Media: 1, Baja: 0.7 })[(a.conf || [])[0]] || 1;
    helperTeams().forEach(x => { if (!x.miss.length || x.miss.length > 2) return;
      x.miss.forEach(s => { if (!BY.get(s) || isMainS(s) || (!IS_APP && s === "hashirama-senju-new-year")) return;
        const e = per.get(s) || { s, one: [], two: [], v: 0 }; (x.miss.length === 1 ? e.one : e.two).push(x); e.v += x.miss.length === 1 ? 3 * cw(x.a) : 0.5; per.set(s, e); }); });
    const tierB = s => { const b = ["carry", "sup", "ii"].flatMap(k => (TIER[k] || []).filter(r => r.s === s && !r.est)).map(r => r.t).sort((a, b) => "SABCD".indexOf(a) - "SABCD".indexOf(b))[0]; return b; };
    // según lo que gastes: a un F2P le pesa mucho que solo salga pagando; a quien gasta mucho, el tier pesa más
    // («paidold»: de pago, pero sin salir en el último año)
    const lv = spendLv(), AV = [{ free: 1.5, freeold: 0.4, paid: -2, paidold: -2, gacha: -0.8 }, { free: 1.2, freeold: 0.4, paid: 0, paidold: -0.6, gacha: -0.3 },
      { free: 1, freeold: 0.3, paid: 0.4, paidold: 0, gacha: 0.2 }, { free: 0.6, freeold: 0.3, paid: 0.8, paidold: 0.4, gacha: 0.8 }][lv];
    return [...per.values()].map(e => { const t = tierB(e.s), acq = acqOf(e.s);
      const w = weekNinjas().get(e.s), wk = w ? (w.rank ? 0.5 : w.pay ? [0, 0.8, 2, 3][lv] : 3) : 0;   // lo gratis de esta semana, delante; el de ranking, poco
      // packs de los eventos: el que vuelve a menudo en packs de eventos se consigue antes que el que casi
      // nunca sale; el que sale en el Konoha Great Tree se saca jugando. Poco peso: lo que manda son tus equipos.
      const pk = Math.min(1, packRecent(e.s) * 0.25) * (lv ? 1 : 0.5) + (packFree(e.s) ? 0.6 : 0);
      return { ...e, tier: t, week: w, acq, pk, score: e.v + ({ S: 1.5, A: 1, B: 0.3 }[t] || 0) * (lv === 3 ? 1.8 : 1) + AV[acq] + wk + pk }; })
      .filter(e => e.one.length || e.two.length >= 2).sort((a, b) => b.score - a.score);
  }
  // Etiqueta de cómo se consigue, según tu perfil: a un F2P se le avisa de lo de pago; a quien gasta poco,
  // se le señalan las 2 compras que más equipos le completan.
  function wantTag(x, all) {
    if (x.acq === "free") return `<span class="tag-own">${L("gratis en eventos", "free in events")}</span> `;
    if (x.s && packRecent(x.s) >= 3) return `<span class="tag-own">${L("vuelve a menudo en packs", "often back in packs")}</span> ${/^paid/.test(x.acq) && !spendLv() ? `<span class="tag-miss">${L("opción de pago", "paid option")}</span> ` : ""}`;
    const lv = spendLv();
    if (x.acq === "paid" && lv === 1 && (all || []).filter(y => y.acq === "paid").slice(0, 2).includes(x)) return `<span class="tag-own">${L("si vas a gastar, aquí", "if you'll spend, here")}</span> `;
    if (/^paid/.test(x.acq) && lv === 0) return `<span class="tag-miss">${L("opción de pago", "paid option")}</span> `;
    if (x.acq === "gacha" && lv <= 1) return `<span class="tag-miss">${L("solo gacha o packs", "gacha or packs only")}</span> `;
    return "";
  }
  // Una línea para Qué conseguir: con qué perfil se ha ordenado y, a un F2P, cuántos se han dejado fuera por ser de pago.
  function spendNote(paidN) {
    const lv = spendLv(), n = paidN ? L(` Fuera ${paidN} que solo salen pagando (están en Recomendados › Para ti).`, ` ${paidN} that only come from spending are left out (see Recommended › For you).`) : "";
    return profile.spend ? L(`Ordenado para tu perfil: ${spendName().toLowerCase()}.`, `Sorted for your profile: ${spendName().toLowerCase()}.`) + (lv ? "" : n)
      : L("Ordenado como si no gastaras (F2P): dime cuánto gastas en Ajustes (⚙) para ajustarlo.", "Sorted as if you don't spend (F2P): tell me how much you spend in Settings (⚙) to adjust it.") + n;
  }
  function wantWhy(e, short) {
    if (short) return e.one.length ? L(`Te completa ${e.one.length} equipo${e.one.length > 1 ? "s" : ""}.`, `It completes ${e.one.length} team${e.one.length > 1 ? "s" : ""} for you.`) : L(`Está en ${e.two.length} equipos a los que solo les falta él y otro.`, `It's in ${e.two.length} teams that only miss it and one more.`);
    const ex = e.one.slice(0, 3).map(x => `${modeShort(x.m)} (${altShort(x.a.label)})`);
    return e.one.length ? L(`Te completa ${e.one.length} equipo${e.one.length > 1 ? "s" : ""}: ${ex.join(", ")}${e.one.length > 3 ? ` y ${e.one.length - 3} más` : ""}.`, `It completes ${e.one.length} team${e.one.length > 1 ? "s" : ""} for you: ${ex.join(", ")}${e.one.length > 3 ? ` and ${e.one.length - 3} more` : ""}.`)
      : L(`Está en ${e.two.length} equipos a los que solo les falta él y otro ninja.`, `It's in ${e.two.length} teams that only miss it and one more ninja.`);
  }
  // ---- Infinite Illusion: tu récord, el siguiente tramo del premio diario y qué probar después.
  // Los tramos vienen de MODES (rewards) y el usuario los puede corregir (profile.iiRewards, en daño absoluto).
  const II_STAGES = () => MODES.filter(m => /^s\d$/.test(m.k));
  const rewardsOf = m => { const own = (profile.iiRewards || {})[m.k]; return own && own.length ? own : m.rewards ? m.rewards.at : []; };
  const confRank = a => { const c = String((a.conf || [])[0] || ""); return /^Alta/.test(c) ? 0 : /^Media/.test(c) ? 1 : 2; };
  function iiGoal(m) {
    const r = modeRecord(m), best = r ? +r.best.damage || 0 : 0, at = rewardsOf(m);
    const next = at.find(v => v > best) || 0, prev = at.filter(v => v <= best).pop() || 0;
    const t = untestedOf(m).filter(a => !a.custom).sort((a, b) => ((a.miss || []).length - (b.miss || []).length) || learnRank(m, a) - learnRank(m, b) || confRank(a) - confRank(b))[0] || null;
    return { m, r, best, at, next, prev, gap: next ? next - best : 0, pct: next ? Math.max(3, Math.round((best - prev) / (next - prev) * 100)) : 100, t };
  }
  // Inicio del ciclo semanal de eventos (jueves), para contar los intentos de esta semana.
  function cycleStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 3) % 7)); return x; }
  function goalRow(g, opts = {}) {
    const { m, r, best, at, next, prev, gap, pct, t } = g;
    const faces = cells => (cells || []).filter(s => s && BY.get(s) && !BY.get(s).m).map(s => pic(s, BY.get(s).n)).join("");
    const pw = r && r.best.power ? Math.round(r.best.power / 1000) : 0, now = Math.round((+profile.power || 0) / 1000);
    const goal = !at.length ? `<p class="note">${L("No tengo los tramos del premio de esta etapa: apúntalos abajo cuando los veas en el juego.", "I don't have this stage's reward tiers: note them below when you see them in the game.")}</p>`
      : !r ? `<p class="note">${L(`El primer tramo del premio diario es de <b>${shortRes(at[0])}</b>. Registra tu primer intento para ver cuánto te falta.`, `The first daily reward tier is <b>${shortRes(at[0])}</b>. Log your first attempt to see how far you are.`)}</p>`
      : !next ? `<p class="note">${L(`Has pasado el tramo más alto que tengo apuntado (${shortRes(at[at.length - 1])}).`, `You've passed the highest tier on record (${shortRes(at[at.length - 1])}).`)}</p>`
      : `<div class="iig-bar" role="img" aria-label="${L(`${pct}% del camino al siguiente tramo`, `${pct}% of the way to the next tier`)}"><i style="width:${pct}%"></i></div>
         <p class="note">${L(`Te faltan <b>${shortRes(gap)}</b> para el tramo de <b>${shortRes(next)}</b>${prev ? ` (ahora estás en el de ${shortRes(prev)})` : ""}.`, `<b>${shortRes(gap)}</b> to go for the <b>${shortRes(next)}</b> tier${prev ? ` (you're now in the ${shortRes(prev)} one)` : ""}.`)}</p>`;
    const act = t ? `<div class="iig-next"><span class="eyebrow">${L("Siguiente prueba", "Try next")}</span><div class="iig-team">${/^[A-Z]$/.test(t.id) ? `<span class="tc-letter" aria-hidden="true" data-stage="${escAttr(m.k)}">${esc(t.id)}</span>` : ""}<div style="min-width:0"><b>${esc(altShort(t.label))}</b><div class="best-faces">${faces(t.cells)}</div></div></div>
        <div class="row"><button class="btn small primary" data-qt="${m.k}:${esc(t.id)}">${L("Registrar", "Log")}</button><button class="btn small" data-goalt="${m.k}:${esc(t.id)}">${L("Ver equipo", "View team")}</button></div></div>`
      : r ? `<div class="iig-next"><span class="eyebrow">${L("Todos tus equipos están probados", "All your teams have been tried")}</span><p class="note" style="margin:0">${L("Repite tu mejor equipo", "Repeat your best team")}${now > pw * 1.05 && pw ? L(` (tu récord es con ${pw}k de poder y ahora tienes ${now}k)`, ` (your record was at ${pw}k power and you now have ${now}k)`) : ""}.</p>
        <div class="row"><button class="btn small primary" data-qt="${m.k}:${esc(r.best.alt || "")}">${L("Registrar", "Log")}</button></div></div>` : "";
    const raise = t && r && pw && now > pw * 1.05 ? `<p class="note" style="margin:0">${L(`Tu récord es con ${pw}k de poder y ahora tienes ${now}k: repetir tu mejor equipo también puede subirlo.`, `Your record was at ${pw}k power and you now have ${now}k: repeating your best team may also raise it.`)}</p>` : "";
    return `<div class="iig-row" data-stage="${escAttr(m.k)}">
      <div class="iig-head"><h3>${esc(m.name.replace(/^II · /, ""))}${opts.closest ? ` <span class="pill" data-c="Alta">${L("más cerca", "closest")}</span>` : ""}</h3><span class="note">${esc(m.bonus || "")}</span></div>
      <div class="iig-rec">${r ? `<b class="mono">${shortRes(best)}</b> <span class="note">${L("tu récord", "your record")}${pw ? ` · ${pw}k` : ""}</span>` : `<span class="note">${L("Aún sin intentos", "No attempts yet")}</span>`}</div>
      ${opts.lite && !at.length ? "" : goal}${opts.lite ? "" : act + raise}
      ${opts.lite ? "" : `<details class="iig-edit"><summary>${L("Tramos del premio diario", "Daily reward tiers")}</summary><form class="row" data-iirew="${escAttr(m.k)}">
        <input type="text" name="at" value="${esc(at.map(v => String(v / 1e6).replace(".", ",")).join("; "))}" aria-label="${L("Tramos en millones, separados por punto y coma", "Tiers in millions, separated by semicolons")}" placeholder="${L("p. ej. 4; 6; 9; 12,5", "e.g. 4; 6; 9; 12.5")}"> <span class="note">${L("millones", "million")}</span>
        <button class="btn small" type="submit">${L("Guardar", "Save")}</button></form>
        <p class="note" style="margin:6px 0 0">${esc((profile.iiRewards || {})[m.k] ? L("Tramos apuntados por ti.", "Tiers noted by you.") : m.rewards ? L(m.rewards.src, "Infinite Illusion daily reward (reviewed 24-Oct-2026); change them if you see different ones in the game.") : L("Sin tabla todavía.", "No table yet."))}</p></details>`}
    </div>`;
  }
  function homeII() {
    const gs = II_STAGES().map(iiGoal);
    const closest = gs.filter(g => g.next && g.r).sort((a, b) => a.gap / a.next - b.gap / b.next)[0];
    gs.sort((a, b) => (a === closest ? -1 : b === closest ? 1 : 0));
    const since = cycleStart(), n = Object.values(tries).filter(x => /^s\d$/.test(x.mode) && new Date(x.at) >= since).length;
    const day = L(`el jueves ${since.getDate()}`, `Thursday ${since.getDate()}`);
    return `<article class="panel home-ii"><div class="row" style="justify-content:space-between"><h3>Infinite Illusion</h3><button class="btn small" data-go="ii">${L("Equipos", "Teams")}</button></div>
      <p class="note" style="margin:2px 0 10px">${n ? L(`${n} intento${n > 1 ? "s" : ""} registrado${n > 1 ? "s" : ""} desde ${day}.`, `${n} attempt${n > 1 ? "s" : ""} logged since ${day}.`) : (Object.keys(tries).length ? L(`<b>Aún no has registrado intentos desde ${day}.</b>`, `<b>No attempts logged since ${day}.</b>`) : L("<b>Registra tu primer intento</b> y te diré cuánto te falta para el siguiente premio.", "<b>Log your first attempt</b> and you'll see how far you are from the next reward."))} ${L("Primero, la etapa en la que estás más cerca del siguiente premio.", "First, the stage where you're closest to the next reward.")}</p>
      ${gs.some(g => g.r) ? `<div class="iig-grid">${gs.map((g, i) => goalRow(g, { closest: g === closest, lite: i > 0 })).join("")}</div>`
        // sin ningún intento: una línea por etapa (el equipo a probar ya sale en «Tus próximos pasos» y «Por probar»)
        : `<div class="iig-mini">${gs.map(g => `<div><b>${esc(g.m.name.replace(/^II · /, ""))}</b> <span class="note">${esc(g.m.bonus || "")}${g.at.length ? L(` · primer premio: ${shortRes(g.at[0])}`, ` · first reward: ${shortRes(g.at[0])}`) : ""}</span></div>`).join("")}</div>`}</article>`;
  }
  // «Por probar»: el mejor equipo sin intentos de cada modo. Con un roster pequeño suele salir el mismo equipo en varios
  // modos: va en UNA fila con «pruébalo en …» y un botón para registrar en cada modo (los intentos siguen siendo por
  // modo). Arena y Ranked, plegados aparte (otro tipo de prueba).
  function homeTodo() {
    const order = m => m.kind === "pve" ? 0 : m.kind === "exam" ? 1 : 2;  // primero Infinite Illusion y Nine-Tails
    const groups = MODES.slice().sort((a, b) => order(a) - order(b)).map(m => ({ m, list: untestedOf(m).filter(a => !a.custom) })).filter(g => g.list.length);
    const total = groups.reduce((s, g) => s + g.list.length, 0);
    const rowsOf = gs => { const by = new Map();
      gs.forEach(g => { const a = g.list[0], k = memKey(a.cells || []); const r = by.get(k) || { a, k, modes: [] }; r.modes.push({ m: g.m, a, more: g.list.length - 1 }); by.set(k, r); });
      return [...by.values()]; };
    const row = r => { const one = r.modes.length === 1, a = r.a;
      return `<div class="todo-row todo-merged">
          <div style="min-width:0"><b>${esc(altShort(a.label))}</b><div class="best-faces">${(a.cells || []).filter(s => s && BY.get(s) && !BY.get(s).m).map(s => pic(s, BY.get(s).n)).join("")}</div>
            <div class="note">${one ? esc(L(`Para ${r.modes[0].m.name}`, `For ${r.modes[0].m.name}`)) : esc(L(`Pruébalo en ${r.modes.map(x => modeShort(x.m)).join(", ")}`, `Try it in ${r.modes.map(x => modeShort(x.m)).join(", ")}`))}</div></div>
          <div class="todo-act">${one ? "" : `<span class="note" style="align-self:center">${L("Registrar en:", "Log in:")}</span>`}${r.modes.map(x => `<button class="btn small${one ? " primary" : ""}" data-qt="${escAttr(x.m.k)}:${escAttr(x.a.id)}">${one ? L("Registrar", "Log") : esc(modeShort(x.m))}</button>`).join("")}<button class="btn small" data-goalt="${escAttr(r.modes[0].m.k)}:${escAttr(r.modes[0].a.id)}">${L("Ver", "View")}</button></div></div>`; };
    const more = gs => { const m = gs.filter(g => g.list.length > 1); return m.length ? `<p class="note todo-more">${L("Más por probar en", "More to try in")} ${m.map(g => `<button class="more-btn" data-gomode="${escAttr(g.m.k)}">${esc(modeShort(g.m))} (${g.list.length - 1})</button>`).join(" ")}</p>` : ""; };
    const pve = groups.filter(g => g.m.kind !== "pvp"), pvp = groups.filter(g => g.m.kind === "pvp");
    return `<article class="panel"><div class="row" style="justify-content:space-between"><h3>${L("Por probar", "To try")} <span class="muted mono" style="font-size:.9rem">${total}</span></h3></div>
      <p class="note" style="margin:2px 0 10px">${L("Equipos que aún no tienen ningún intento: el mejor de cada modo. Si uno sirve para varios modos, sale una vez con un botón por modo.", "Teams with no attempts yet: the best one per mode. If one fits several modes, it appears once with a button per mode.")}</p>
      ${groups.length ? `<div class="todo-list">${rowsOf(pve).map(row).join("")}</div>${more(pve)}
        ${pvp.length ? `<details class="howto" style="margin-top:8px"><summary>${L("Arena y Ranked", "Arena and Ranked")} (${pvp.reduce((s, x) => s + x.list.length, 0)})</summary><div class="todo-list" style="margin-top:10px">${rowsOf(pvp).map(row).join("")}</div>${more(pvp)}</details>` : ""}`
        : `<p class="note">${L("¡Nada pendiente! Todos los equipos tienen al menos un intento.", "Nothing pending! Every team has at least one attempt.")}</p>`}</article>`;
  }
  // En Equipos, cada tarjeta dice en qué otros modos se propone el mismo equipo (para que no parezca otra idea).
  function alsoIn(m, a) {
    const k = memKey(a.cells || []); if (!k) return [];
    return MODES.filter(x => x.k !== m.k && (x.kind === "pvp") === (m.kind === "pvp")).filter(x => { try { return altsOf(x).some(y => !y.puppet && memKey(y.cells || []) === k); } catch { return false; } });
  }

  // ¿En qué invertir? Tus ninjas salvo los marcados «No usar en mis equipos». Subir estrellas compensa si a esas estrellas cambia su kit (NINJA_PLUS.kit:
  // habilidades nuevas, como el +1 chase de Genma a 3★) o si se abre su breakthrough (BTI k=4); si no, solo da stats.
  // Prioridad: los que más salen en tus equipos (en la app, los que ya puedes montar), tus intentos y tus récords.
  function investPlanCalc() {
    const favs = Object.keys(profile.owned).filter(s => inPool(s) && !(BY.get(s) || {}).m);
    const pool = IS_APP ? helperTeams().filter(x => !x.miss.length) : MODES.flatMap(m => m.alts.filter(a => !a.puppet).map(a => ({ m, a })));
    // un intento solo cuenta como prueba si a ese equipo no le fue flojo frente a tus otros del modo
    const teamsOf = s => pool.filter(x => (x.a.cells || []).includes(s)).map(x => { const n = triesOf(x.m.k, x.a.id).length; return { ...x, n, bad: n > 0 && triedBucket(x.m, x.a.id) === 2 }; });
    const recordTeams = MODES.map(m => { const r = modeRecord(m); return r && r.best ? r.best.team || [] : []; });
    return favs.map(s => {
      const o = profile.owned[s] || {}, b = BTI[s], t = teamsOf(s), st = o.st || 0, C = (CONSULTAS || {})[s];
      const kitUp = (PLUS(s).kit || []).find(k => k > st);
      const use = t.length + t.reduce((x, y) => x + y.n, 0) / 2 + recordTeams.filter(x => x.includes(s)).length * 3 + (IS_APP ? 0 : (BT_NOTE[s] || [0])[0])
        + (C && /^(Meta|Útil)$/.test(C.veredicto) ? 1 : 0);
      // la acción más cercana: el siguiente cambio de kit o el 4★ del breakthrough
      let act = "none", to = 0;
      if (kitUp && (!b || st >= (b.k || 4) || kitUp <= (b.k || 4))) { act = "kit"; to = kitUp; }
      else if (b && st < (b.k || 4)) { act = "star"; to = b.k || 4; }
      else if (b && !o.bt) act = "bt"; else if (b && o.bt) act = "done";
      const proof = t.some(y => y.n > 0 && !y.bad) || recordTeams.some(x => x.includes(s)) || (!IS_APP && !!BT_NOTE[s])
        || (IS_APP && t.length > 0);   // en la app: va en equipos que ya puedes montar
      // lo que dice su ficha revisada: si no se usa o «no compensa», no se propone subirlo; si «no corre prisa», va detrás
      const why = C && C.rapida ? C.rapida.estrellas : "";
      const neg = !!C && (C.veredicto === "No se usa" || /no compensa|no merece|^no hace falta|no es necesari/i.test(why));
      // con poco presupuesto, tampoco corre prisa subir a los que su ficha da por buenos solo mientras la cuenta es pequeña
      const slow = /no corre prisa|no es imprescindible/i.test(why) || (spendLv() <= 1 && /quedan? viejo|no le gastes|no lo subas|no le metas|largo plazo|mientras tanto/i.test(why + " " + ((C && C.rapida && C.rapida.pequena) || "")));
      return { s, o, b, t, use: use - (slow ? 2 : 0), act, to, proof, why, neg, slow };
    });
  }
  // Notas sobre su breakthrough (sube la prioridad y se muestra en la fila).
  const BT_NOTE = { "pakura-edo-tensei": [3, "Sin BT no es un soporte de verdad. Ya a 4★: rompe la Pasiva 1 en +2 (standard extra a 3 ninjas Wind/Fire)"], "asura-otsutsuki": [3, "Staff: con BT sus +chases se suman a los de Genma; en PvE, BT para +2 chases por ronda"], "jiraiya-young-adult": [3, "En Infinite Illusion, sin BT no funciona"],
    "sasuke": [0, "Rareza B: el BT alarga su bucle, pero su daño propio es bajo"] };
  function investPanel(limit) {
    const plan = investPlan();
    const nm = s => (BY.get(s) || { n: s }).n;
    const stars = st => `<span class="stars" aria-label="${st || 0} estrellas">${[1, 2, 3, 4].map(i => `<i class="${i <= (st || 0) ? "on" : ""}${i === 4 ? " bt" : ""}"></i>`).join("")}</span>`;
    const where = x => { if (limit && IS_APP) return x.t.length ? L(`En ${x.t.length} equipo${x.t.length > 1 ? "s" : ""} que puedes montar.`, `In ${x.t.length} team${x.t.length > 1 ? "s" : ""} you can build.`) : L("Aún no está en tus equipos", "Not in your teams yet");   // en Inicio, corto
      const l = x.t.slice().sort((a, b) => b.n - a.n).slice(0, IS_APP ? 2 : 3).map(y => IS_APP ? `${modeShort(y.m)} (${altShort(y.a.label)})` : `${y.m.name.replace("II · ", "")} ${y.a.id}`); return l.length ? L(IS_APP ? `En ${x.t.length} equipo${x.t.length > 1 ? "s" : ""} que puedes montar: ` : "En tus equipos: ", IS_APP ? `In ${x.t.length} team${x.t.length > 1 ? "s" : ""} you can build: ` : "In your teams: ") + l.join(", ") + (x.t.length > l.length ? L(` y ${x.t.length - l.length} más`, ` and ${x.t.length - l.length} more`) : "") : L("Aún no está en tus equipos", "Not in your teams yet"); };
    const row = (x, chip, line) => `<div class="inv-row">${pic(x.s, nm(x.s))}<div style="min-width:0"><div class="inv-top"><b>${esc(nm(x.s))}</b>${stars(x.o.st)}${chip}</div><div class="note">${line}</div></div></div>`;
    const upAct = x => x.act === "star" || x.act === "bt" || x.act === "kit";
    const up = plan.filter(x => upAct(x) && x.proof && !x.neg).sort((a, b) => b.use - a.use);
    const wait = plan.filter(x => upAct(x) && !x.proof && !x.neg).sort((a, b) => b.use - a.use);
    const skip = plan.filter(x => x.act === "none" || (x.neg && upAct(x))).sort((a, b) => b.use - a.use);
    const done = plan.filter(x => x.act === "done");
    const chip = x => x.act === "kit" ? L(`Súbelo a ${x.to}★ · cambia su kit`, `Take it to ${x.to}★ · its kit changes`) : x.act === "star" ? L(`Súbelo a ${x.to}★ · BT`, `Take it to ${x.to}★ · BT`) : L("Rompe su BT con viales", "Break its BT with vials");
    const focus = spendLv() <= 1 ? L(" Con poco presupuesto, concéntrate en 2 o 3 ninjas que vayas a usar mucho tiempo.", " On a small budget, focus on 2 or 3 ninjas you'll use for a long time.") : spendLv() === 3 ? L(" Gastando mucho, puedes subir también a los que solo sirven ahora.", " Spending a lot, you can also upgrade the ones that only help for now.") : "";
    return `${exclNote()}<p class="note" style="margin:2px 0 10px">${L("Subir estrellas solo compensa si cambia el <b>kit</b> del ninja a esas estrellas o si se abre su <b>breakthrough</b> (a 4★; luego cada rama se rompe y se mejora con viales). Si no, solo da stats. Ordenados por lo que los usas en tus equipos.", "More stars only pay off if the ninja's <b>kit</b> changes at those stars or its <b>breakthrough</b> opens (at 4★; then each branch is broken and upgraded with vials). Otherwise they only add stats. Sorted by how much you use them in your teams.")}${focus}</p>
      ${up.length ? `<div class="inv-list">${up.slice(0, limit || 99).map(x => row(x, `<span class="pill" data-c="${x.slow ? "Media" : "Alta"}">${chip(x)}${x.slow ? L(" · sin prisa", " · no rush") : ""}</span>`,
        `${esc(where(x))}${x.b && x.b.f.length && x.act !== "kit" ? ` · ${L("BT primero", "BT first")}: <b>${esc(x.b.f.map(btName).join(" + "))}</b>` : ""}${x.why ? `<br>${esc(x.why)}` : ""}${BT_NOTE[x.s] && !IS_APP ? ` · <i>${esc(BT_NOTE[x.s][1])}</i>` : ""}<div class="row" style="margin-top:4px">${goalBtn(x.s, upWhat(x), x.why)}</div>`)).join("")}</div>` : `<p class="note">${L("Ninguno de tus ninjas necesita estrellas ahora.", "None of your ninjas needs stars right now.")}</p>`}
      ${wait.length ? `<details class="howto" style="margin-top:12px"><summary>${L("Antes de subirlos, pruébalos", "Try them before upgrading")} (${wait.length})</summary><p class="note" style="margin:6px 0">${L("Tienen BT, pero aún no hay ningún intento tuyo que demuestre que te sirven (solo están en equipos sin probar). No gastes fragmentos en ellos hasta ver resultados.", "They have BT, but none of your attempts shows they work for you yet (they're only in untried teams). Don't spend fragments on them until you see results.")}</p><div class="inv-list">${wait.map(x => row(x, `<span class="pill" data-c="Media">${L("Sin probar", "Untried")}</span>`, esc(where(x)))).join("")}</div></details>` : ""}
      ${skip.length ? `<details class="howto" style="margin-top:12px"><summary>${L(`No hace falta subirlos (${skip.length}): solo ganarían stats o su ficha dice que no compensa`, `No need to upgrade them (${skip.length}): they'd only gain stats or their sheet says it isn't worth it`)}</summary><p class="note" style="margin:6px 0">${L("Son buenos tal como están: subirles estrellas solo da un poco de stats. Gasta los fragmentos en los de arriba.", "They're fine as they are: more stars only add a few stats. Spend fragments on the ones above.")}</p><div class="home-s">${skip.map(x => `<span title="${esc(nm(x.s))}">${pic(x.s, nm(x.s))}</span>`).join("")}</div></details>` : ""}
      ${done.length ? `<p class="note" style="margin-top:10px">${L("Ya con breakthrough", "Already with breakthrough")}: ${done.map(x => esc(nm(x.s))).join(", ")}.</p>` : ""}`;
  }
  // Novedades: qué ha cambiado en cada actualización (escrito a mano; la primera es la última). Se marca como vista en este navegador.
  // Lo visto se lee una vez al cargar: así «nuevo» sigue durante esta visita aunque la página se repinte.
  // Se guarda «fecha|título» de la última vista (antes solo la fecha: dos novedades del mismo día se confundían).
  const NEWS_KEY = x => x.d + "|" + x.t;
  const NEWS_SEEN = (() => { try { const s = localStorage.getItem(LS + "-novedades") || ""; if (NOVEDADES[0]) localStorage.setItem(LS + "-novedades", NEWS_KEY(NOVEDADES[0])); return s; } catch { return ""; } })();
  // Las que no habías visto: las de encima de la última vista; con el formato viejo (solo fecha), las de ese día o después.
  const NEWS_FRESH = (() => { if (!NEWS_SEEN) return 0; const i = NOVEDADES.findIndex(x => NEWS_KEY(x) === NEWS_SEEN);
    return i >= 0 ? i : NEWS_SEEN.includes("|") ? NOVEDADES.filter(x => x.d >= NEWS_SEEN.split("|")[0]).length : NOVEDADES.filter(x => x.d >= NEWS_SEEN).length; })();
  // Pop-up «Novedades» al abrir una versión con cambios que aún no has visto (una vez). Quien estrena la app no lo ve
  // (le sale el asistente); en Ajustes › Ayuda se puede volver a abrir con las últimas.
  const NEWS_DAY = d => d.split("-").reverse().slice(0, 2).join("/");
  function openNews(all) {
    const N = NOVEDADES.map(x => EN && x.en ? { ...x, ...x.en } : x), fresh = N.slice(0, NEWS_FRESH);
    const L3 = (all || !fresh.length ? N : fresh).slice(0, 3); if (!L3.length) return;
    let el = $("newsBack");
    if (!el) { el = document.createElement("div"); el.id = "newsBack"; el.className = "qt-back"; document.body.appendChild(el); }
    const ver = IS_APP && window.NOC_APP && window.NOC_APP.version ? ` · ${esc(window.NOC_APP.version)}` : "";
    el.innerHTML = `<div class="qt panel news-pop" role="dialog" aria-modal="true" aria-labelledby="newsTitle">
      <div class="row" style="justify-content:space-between;align-items:baseline"><h2 id="newsTitle">${L("Novedades", "What's new")}<span class="note">${ver}</span></h2><button class="btn small" type="button" data-news-close aria-label="${L("Cerrar", "Close")}">✕</button></div>
      ${L3.map(x => `<section><h3>${esc(x.t)} <span class="note mono">${NEWS_DAY(x.d)}</span></h3><ul class="why">${x.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></section>`).join("")}
      <div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-news-close>${L("Entendido", "Got it")}</button></div></div>`;
    el.hidden = false; document.body.classList.add("modal-open"); el.querySelector("[data-news-close]").focus();
  }
  function closeNews() { const el = $("newsBack"); if (!el || el.hidden) return; el.hidden = true; modalDone(); }
  // Con dos ventanas abiertas (p. ej. una ficha encima del registro rápido), cerrar una no debe soltar el fondo.
  function modalDone() { if (!["nfBack", "qtBack", "wizBack", "newsBack"].some(id => $(id) && !$(id).hidden)) document.body.classList.remove("modal-open"); }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-news-open]")) { openNews(true); return; }
    const el = $("newsBack"); if (!el || el.hidden) return;
    if (e.target.closest("[data-news-close]") || e.target === el) closeNews();
  });
  // Escape cierra solo la ventana de arriba: cada manejador marca la tecla como usada (preventDefault) y los demás la ignoran.
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("newsBack") && !$("newsBack").hidden) { e.preventDefault(); closeNews(); } });
  // tras cargar los datos guardados y el asistente: solo si había algo visto antes y hay novedades más nuevas
  setTimeout(() => { if (NEWS_FRESH && !($("wizBack") && !$("wizBack").hidden)) openNews(false); }, 900);
  function homeNews() {
    // En inglés, cada novedad usa su versión «en» ({t, items}) si la tiene.
    const [last, ...prev] = NOVEDADES.map(x => EN && x.en ? { ...x, ...x.en } : x); if (!last) return "";
    const fresh = NEWS_FRESH > 0 || (!NEWS_SEEN && !IS_APP);   // quien estrena la app no necesita el registro de cambios abierto
    const day = NEWS_DAY;
    const list = x => `<ul class="why" style="margin:6px 0 0">${x.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;
    // Sin leer: abierta y con «nuevo». Ya vista: una sola línea que se despliega.
    return `<details class="panel home-news"${fresh ? " open" : ""}>
      <summary><b>${L("Novedades", "What's new")}</b>${fresh ? ` <span class="pill" data-c="Alta">${L("nuevo", "new")}</span>` : ""} <span class="note">· ${esc(last.t)} · ${day(last.d)}</span></summary>
      ${list(last)}
      ${prev.length ? `<details class="howto" style="margin-top:8px"><summary>${L("Anteriores", "Earlier")} (${prev.length})</summary>${prev.map(x => `<p style="margin:8px 0 0"><b>${esc(x.t)}</b> <span class="note mono">${day(x.d)}</span></p>${list(x)}`).join("")}</details>` : ""}
    </details>`;
  }
  // Objetivos que el usuario persigue (estrellas, ramas de BT…): lleva la cuenta él mismo; se guardan en el perfil.
  // Sin coste automático: las cantidades de la comunidad no se pueden copiar en la página.
  const DEFAULT_GOALS = [
    { s: "jiraiya-toads-chant", what: "4★", have: 44, need: 100, note: "Sakura's Gift (Friendliness) o Fukurokumaru's Deals" },
    { s: "asura-otsutsuki", what: "4★ (abre su breakthrough)", have: 0, need: 100, note: "Tienes 20 fragmentos guardados en packs Otsutsuki-Pain II" } ];
  const goalsOf = () => Array.isArray(profile.goals) ? profile.goals : IS_APP ? [] : DEFAULT_GOALS.map(g => ({ ...g }));
  // Un objetivo se cumple con sus números o solo, con tu roster: «Conseguirlo» al marcar el ninja, «N★» al llegar a N
  // estrellas y «Breakthrough» al marcar su BT.
  function goalDone(g) {
    const o = profile.owned[g.s], w = String(g.what || ""), st = w.match(/^(\d)★/);
    if (/^(Conseguirlo|Get it)$/.test(w) && o) return true;
    if (st && o && (o.st || 0) >= +st[1]) return true;
    if (/^Breakthrough$/.test(w) && o && o.bt) return true;
    return +g.need > 0 && +g.have >= +g.need;
  }
  function goalsPanel() {
    const G = goalsOf(); const nm = s => (BY.get(s) || { n: s }).n;
    const mine = Object.keys(profile.owned).filter(s => !(BY.get(s) || {}).m).sort((a, b) => nm(a).localeCompare(nm(b)));
    return `<div class="row" style="justify-content:space-between"><h3>${L("Tus objetivos", "Your goals")}</h3><span class="note">${G.length ? L(`${G.filter(goalDone).length} de ${G.length} cumplidos`, `${G.filter(goalDone).length} of ${G.length} done`) : ""}</span></div>
      <div class="goal-list">${G.map((g, i) => { const pct = goalDone(g) ? 100 : +g.need ? Math.min(100, Math.round((+g.have || 0) / +g.need * 100)) : 0;
        return `<div class="goal${pct >= 100 ? " done" : ""}">${pic(g.s, nm(g.s))}<div class="goal-main"><div class="goal-top"><b>${esc(nm(g.s))}</b> <span class="chip">${esc(g.what || "")}</span>
          <button class="x-try" data-goal-del="${escAttr(i)}" aria-label="${L("Quitar objetivo", "Remove goal")}">✕</button></div>
          <div class="goal-bar"><i style="width:${pct}%"></i></div>
          <div class="goal-nums"><input type="number" min="0" inputmode="numeric" value="${+g.have || 0}" data-goal-have="${escAttr(i)}" aria-label="${L("Llevas", "You have")}"> ${L("de", "of")} <input type="number" min="1" inputmode="numeric" value="${+g.need || ""}" placeholder="?" data-goal-need="${escAttr(i)}" aria-label="${L("Necesitas", "You need")}">${g.approx ? ` <span class="note" title="${L("Lo habitual en S y SS; corrígelo si en el juego es otro", "Usual for S and SS; fix it if the game shows another")}">${L("aprox.", "approx.")}</span>` : ""}
            <span class="note">${pct >= 100 ? L("¡cumplido!", "done!") : !+g.need ? L("apunta cuántos necesitas (lo ves en el juego)", "note how many you need (you'll see it in the game)") : pct >= 100 ? L("¡cumplido!", "done!") : L(`te faltan ${Math.max(0, (+g.need || 0) - (+g.have || 0))}`, `${Math.max(0, (+g.need || 0) - (+g.have || 0))} to go`)}</span></div>
          ${g.note ? `<div class="note">${esc(g.note)}</div>` : ""}${goalRoute(g)}</div></div>`; }).join("") || `<p class="note">${L("Sin objetivos. Añádelos con «＋ Objetivo» desde cualquier recomendación, o aquí abajo.", "No goals. Add them with «＋ Goal» from any recommendation, or below.")}</p>`}</div>
      <details class="howto" style="margin-top:8px"><summary>${L("Añadir un objetivo", "Add a goal")}</summary><form class="goal-add" data-goal-add>
        <select name="s" aria-label="Ninja">${mine.map(s => `<option value="${escAttr(s)}">${esc(nm(s))}</option>`).join("")}</select>
        <input name="what" placeholder="${L("Qué: 4★, Pasiva 1 +2…", "What: 4★, Passive 1 +2…")}" aria-label="${L("Objetivo", "Goal")}">
        <input name="have" type="number" min="0" inputmode="numeric" placeholder="${L("Llevas", "You have")}" aria-label="${L("Llevas", "You have")}">
        <input name="need" type="number" min="1" inputmode="numeric" placeholder="${L("Necesitas", "You need")}" aria-label="${L("Necesitas", "You need")}" required>
        <button class="btn small primary" type="submit">${L("Añadir", "Add")}</button></form></details>`;
  }
  // ---- Por dónde empezar: las 4 rutas de cuenta pequeña (RUTAS, escritas a mano) con los datos reales de Nexus
  // (formaciones de menos de 4,5M que llevan a su carry). Primero la que mejor encaja con tus ninjas y con lo que gastas.
  const RUTS = () => (typeof RUTAS !== "undefined" ? RUTAS : []);
  function routeOf(r) {
    const own = s => !!profile.owned[s], lv = spendLv();
    const lo = r.lo || 0, hi = r.hi || 4.5;   // tramo de poder de la ruta (en millones)
    const forms = NXF().filter(f => f.cp > lo && f.cp <= hi && f.m.includes(r.carry)), agg = new Map();
    forms.forEach(f => { const k = memKey(f.m), a = agg.get(k);
      if (a) { a.cp = (a.cp * a.n + f.cp * f.n) / (a.n + f.n); a.n += f.n; } else agg.set(k, { k, mem: f.m.filter(x => !isMainS(x)), cp: f.cp, n: f.n }); });
    const all = [...agg.values()].map(f => ({ ...f, miss: f.mem.filter(x => !own(x)) }));
    const players = forms.reduce((a, f) => a + f.n, 0), cp = forms.reduce((a, f) => a + f.cp * f.n, 0) / (players || 1);
    const ready = all.filter(f => !f.miss.length).sort((a, b) => b.n - a.n);
    // el siguiente: sin el carry, el carry; si no, el que más formaciones de la ruta te deja montar, según cómo se consigue y lo que gastas
    const W = { free: 1.5, freeold: 1, paid: [0.2, 0.8, 1, 1.1][lv], paidold: [0.1, 0.5, 0.9, 1][lv], gacha: [0.4, 0.6, 0.9, 1][lv] }, nx = {};
    all.filter(f => f.miss.length === 1 && f.miss[0] !== r.carry).forEach(f => { const x = f.miss[0]; nx[x] = (nx[x] || 0) + f.n * W[acqOf(x)]; });
    // primero los soportes propios de la ruta (no otros carries que también salen en esas formaciones)
    const ranked = Object.entries(nx).sort((a, b) => (r.flex.includes(b[0]) - r.flex.includes(a[0])) || b[1] - a[1]).map(x => x[0]);
    const next = own(r.carry) ? ranked.slice(0, 2) : [r.carry];
    const flexOwn = r.flex.filter(own);
    const carryCost = { free: 0, freeold: 1, paid: [3, 1.5, 0.5, 0][lv], paidold: [3.5, 2, 1, 0.3][lv], gacha: [2.5, 1.5, 0.8, 0.3][lv] }[acqOf(r.carry)];
    const score = (own(r.carry) ? 4 + (profile.owned[r.carry].st || 0) * 0.3 : -carryCost) + flexOwn.length * 0.8 + (ready.length ? 2 : 0) + STRENGTH[r.tramo || "inicio"];
    return { r, players, cp, ready, next, flexOwn, score, hasCarry: own(r.carry) };
  }
  // «Tu camino»: los equipos que más se repiten en Nexus, para cualquier cuenta. El poder solo mide tiempo jugado y gasto,
  // no lo que puedes usar: un equipo que domina por encima de 10M es el mejor (lo elige quien puede elegir cualquiera) y
  // uno que solo se ve con poco poder es el fácil de conseguir. Se ordenan por lo que ya tienes, su nivel y lo que cuesta su carry.
  const STRENGTH = { inicio: 0, media: 1, alta: 2, top: 3 };
  const LEVEL = () => ({ inicio: [L("Equipo de inicio", "Starter team"), "Baja"], media: [L("Intermedio", "Intermediate"), "Media"], alta: [L("Fuerte", "Strong"), "Alta"], top: [L("El meta del top", "Top meta"), "Alta"] });
  const bandTxt = r => r.hi >= 99 ? L(`con más de ${r.lo}M`, `above ${r.lo}M`) : r.lo ? L(`entre ${r.lo} y ${r.hi}M`, `between ${r.lo} and ${r.hi}M`) : L("con poco poder", "with low power");
  function homeStart() {
    if (!RUTS().length) return "";
    const nm = s => (BY.get(s) || { n: s }).n;
    const routes = RUTS().map(routeOf).sort((a, b) => b.score - a.score);
    let ar = []; try { ar = altsOf(modeOf("ar")) || []; } catch {}
    const card = (x, i) => { const r = x.r, f = x.ready[0], a = f ? ar.find(y => memKey(y.cells || []) === f.k) : null;
      return `<div class="route${i ? "" : " best"}">
        <div class="route-head">${pic(r.carry, nm(r.carry))}<div style="min-width:0"><b>${esc(r.t)}</b> <span class="chip">${LEVEL()[r.tramo || "inicio"][0]}</span>${i ? "" : ` <span class="pill" data-c="Alta">${L("Tu mejor opción", "Your best option")}</span>`}
          <div class="note">${L(`${x.players} jugadores del top-10 de su servidor ${bandTxt(r)}, ${cpM(x.cp)}M de media`, `${x.players} top-10 players of their server ${bandTxt(r)}, ${cpM(x.cp)}M on average`)}</div></div></div>
        <div class="route-faces">${[r.carry, ...r.flex].map(s => `<span class="rf${profile.owned[s] ? " on" : ""}" title="${esc(nm(s))}">${pic(s, nm(s))}</span>`).join("")}</div>
        <div class="note">${(x.flexOwn.length + (x.hasCarry ? 1 : 0) ? L(`Tienes ${x.flexOwn.length + (x.hasCarry ? 1 : 0)} de ${r.flex.length + 1}${x.hasCarry ? "" : ", pero no al carry"}.`, `You have ${x.flexOwn.length + (x.hasCarry ? 1 : 0)} of ${r.flex.length + 1}${x.hasCarry ? "" : ", but not the carry"}.`) : L("Aún no tienes ninguno.", "You don't have any yet."))}</div>
        ${i ? `<details class="route-more"><summary>${L("Cómo es esta ruta", "What this route is like")}</summary>` : ""}
        <p class="route-p">${esc(r.que)}</p>
        ${f ? `<div class="route-do"><span class="tag-own">${L("Ya puedes montar", "You can build")}</span> <b>${esc(f.mem.map(nm).join(" + "))}</b> <span class="note">(${f.n > 1 ? L(`${f.n} jugadores`, `${f.n} players`) : L("1 jugador", "1 player")}, ${cpM(f.cp)}M)</span>${a ? ` <button class="btn small" data-goalt="ar:${esc(a.id)}">${L("Ver equipo", "View team")}</button>` : ""}</div>` : ""}
        ${x.next.length ? `<div class="route-do"><span class="eyebrow">${L("Siguiente", "Next")}</span> ${x.next.map(s => `<div class="route-next">${pic(s, nm(s))}<div style="min-width:0"><b>${esc(nm(s))}</b> ${wantTag({ acq: acqOf(s) })}<div class="note">${esc(getLine(s))}</div></div>${goalBtn(s, L("Conseguirlo", "Get it"), getLine(s))}</div>`).join("")}</div>` : ""}
        <p class="note route-p"><b>${L("A la larga", "In the long run")}:</b> ${esc(r.crece)}${(r.sigue || []).length ? ` ${L("Equipo más fuerte con piezas parecidas", "Stronger team with similar pieces")}: <b>${esc(r.sigue.map(k => (RUTS().find(y => y.k === k) || {}).t).filter(Boolean).join(L(" o ", " or ")))}</b>.` : ""}</p>
        <p class="note route-p"><b>${L("Ojo", "Watch out")}:</b> ${esc(r.ojo)}</p>
        ${i ? "</details>" : ""}
      </div>`; };
    // «Tu mejor opción» tiene que ser algo que ya montas en parte: si la mejor puntuada no tiene ninguno de tus ninjas
    // y otra sí, va primero la tuya y la fuerte sale debajo como «Pero puedes mejorarlo con» (usuario, 29-oct).
    const ownN = x => x.flexOwn.length + (x.hasCarry ? 1 : 0);
    let up = null;
    if (routes.length && !ownN(routes[0])) { const i = routes.findIndex(x => ownN(x) > 0);
      if (i > 0) { up = routes[0]; const mine = routes[i]; routes.splice(i, 1); routes.splice(0, 1); routes.unshift(mine); } }
    // las 3 que mejor te encajan, en grande (la primera abierta); el resto, en pequeño
    const main = routes.slice(0, 1), alt = routes.slice(1, 3), more = routes.slice(3);
    const mini = x => `<div class="route-mini">${pic(x.r.carry, nm(x.r.carry))}<div style="min-width:0"><b>${esc(x.r.t)}</b> <span class="chip">${LEVEL()[x.r.tramo || "inicio"][0]}</span>
        <div class="note">${L(`${x.players} jugadores ${bandTxt(x.r)}`, `${x.players} players ${bandTxt(x.r)}`)} · ${L(`tienes ${x.flexOwn.length + (x.hasCarry ? 1 : 0)} de ${x.r.flex.length + 1}`, `you have ${x.flexOwn.length + (x.hasCarry ? 1 : 0)} of ${x.r.flex.length + 1}`)}</div>
        <div class="route-faces">${[x.r.carry, ...x.r.flex].map(s => `<span class="rf${profile.owned[s] ? " on" : ""}" title="${esc(nm(s))}">${pic(s, nm(s))}</span>`).join("")}</div>
        <details class="route-more"><summary>${L("Cómo es", "What it's like")}</summary><p class="route-p">${esc(x.r.que)}</p><p class="note route-p"><b>${L("Ojo", "Watch out")}:</b> ${esc(x.r.ojo)}</p></details></div></div>`;
    return `<article class="panel home-start"><h3>${L("Los equipos que más se repiten, ordenados para ti", "The most repeated teams, sorted for you")}</h3>
      <p class="note" style="margin:6px 0 4px">${L("Primero va el que mejor encaja con tus ninjas", "First comes the one that best fits your ninjas")}${profile.spend ? L(" y con lo que gastas", " and what you spend") : ""}. ${L("Las caras en color son las tuyas.", "Faces in colour are yours.")}</p>
      <details class="howto" style="margin:0 0 10px"><summary>${L("¿Y mi poder?", "What about my power?")}</summary><p class="note" style="margin:6px 0 0">${L("El poder solo mide el tiempo jugado y lo gastado, no lo que puedes usar: si tienes las piezas de un equipo del top, úsalo aunque tengas poco poder. Un equipo que domina por encima de 10M es el mejor, porque lo elige quien puede elegir cualquier ninja; uno que solo se ve con poco poder es el fácil de conseguir.", "Power only measures time played and money spent, not what you can use: if you have the pieces of a top team, use it even with low power. A team that dominates above 10M is the best, because it's chosen by those who can pick any ninja; one only seen at low power is the easy one to get.")}</p></details>
      <div class="route-list">${main.map(card).join("")}</div>
      ${up ? `<div class="eyebrow" style="margin:12px 0 6px">${L("Pero puedes mejorarlo con", "But you can improve it with")}</div><div class="route-list">${mini(up)}</div>` : ""}
      ${alt.length ? `<div class="eyebrow" style="margin:12px 0 6px">${L("Otras opciones para ti", "Other options for you")}</div><div class="route-list">${alt.map(mini).join("")}</div>` : ""}
      ${more.length ? `<details class="route-next-stage"><summary><b>${L("Más equipos", "More teams")}</b> <span class="note">(${more.length})</span></summary>
        <div class="route-list" style="margin-top:8px">${more.map(mini).join("")}</div></details>` : ""}
      <p class="note" style="margin:10px 0 0">${L(`Datos: Nexus, formaciones del top-10 de cada servidor (meta del ${esc(dShort(NX_FORMS.date))}). Textos: KonohaHub, la comunidad y deducción mía.`, `Data: Nexus, top-10 formations of each server (meta of ${esc(dShort(NX_FORMS.date))}). Texts: KonohaHub, the community and my own deduction.`)}</p></article>`;
  }
  // ---- Motor común de recomendaciones (rediseño, 29-oct): una lista de acciones ordenadas (probar un equipo, subir un
  // ninja, conseguir uno), cada una con su porqué corto y el largo. Inicio («Hoy») enseña la primera de cada tipo; la
  // lista completa de cada tipo vive en su sitio: Equipos › Por probar, Mi roster › Mejorar y Recomendados › Para ti.
  const upNow = x => (x.act === "star" || x.act === "bt" || x.act === "kit") && x.proof && !x.neg;
  function actionsCalc() {
    const nm = s => (BY.get(s) || { n: s }).n, out = [];
    const ord = m => /^s\d$/.test(m.k) ? 0 : m.k === "n9" ? 1 : m.k === "ar" ? 2 : m.k === "ne" ? 3 : 4;
    // probar: un equipo que puedes montar y sin intentos (primero Infinite Illusion y Nine-Tails, y de más confianza)
    MODES.slice().sort((a, b) => ord(a) - ord(b)).forEach((m, i) => {
      const a = untestedOf(m).filter(x => !x.custom).sort((x, y) => learnRank(m, x) - learnRank(m, y) || confRank(x) - confRank(y))[0]; if (!a) return;
      const also = alsoIn(m, a).map(modeShort), conf = tc(String(((a.conf || [])[1]) || "")).split(/(?<=\.)\s/)[0];
      out.push({ type: "probar", pri: 300 - i, faces: (a.cells || []).filter(s => s && BY.get(s) && !BY.get(s).m),
        title: L(`Prueba en ${m.name}: ${altShort(a.label)}`, `Try in ${m.name}: ${altShort(a.label)}`),
        why: L("Lo puedes montar ya y aún no tiene intentos.", "You can build it now and it has no attempts yet."),
        long: [conf, also.length ? L(`El mismo equipo también se propone en ${also.join(", ")}.`, `The same team is also suggested in ${also.join(", ")}.`) : "",
          L("Cuando registres el intento, la app aprende si te sirve y ajusta lo demás.", "Once you log the attempt, the app learns whether it works for you and adjusts the rest.")].filter(Boolean).join(" "),
        btn: `<button class="btn small primary" data-qt="${escAttr(m.k)}:${escAttr(a.id)}">${L("Registrar", "Log")}</button>`,
        more: `<button class="btn small" data-goalt="${escAttr(m.k)}:${escAttr(a.id)}">${L("Ver el equipo", "View the team")}</button>` });
    });
    // subir: el que más usas y al que subir le cambia algo (su kit o su breakthrough), con pruebas de que te sirve
    investPlan().filter(x => upNow(x) && !x.slow).sort((a, b) => b.use - a.use).forEach((inv, i) => {
      const n = nm(inv.s);
      out.push({ type: "subir", pri: 200 - i, faces: [inv.s],
        title: inv.act === "kit" ? L(`Sube a ${n} a ${inv.to}★`, `Take ${n} to ${inv.to}★`) : inv.act === "star" ? L(`Sube a ${n} a ${inv.to}★`, `Take ${n} to ${inv.to}★`) : L(`Rompe el breakthrough de ${n}`, `Break ${n}'s breakthrough`),
        why: (inv.act === "kit" ? L(`A ${inv.to}★ cambia su kit.`, `At ${inv.to}★ its kit changes.`) : inv.act === "star" ? L(`A ${inv.to}★ se abre su breakthrough.`, `At ${inv.to}★ its breakthrough opens.`) : L("Ya puedes romperlo con viales.", "You can now break it with vials."))
          + (inv.t.length ? " " + L(`Va en ${inv.t.length} de tus equipos.`, `It's in ${inv.t.length} of your teams.`) : ""),
        long: inv.why || "", btn: goalBtn(inv.s, upWhat(inv), inv.why),
        more: `<button class="btn small" data-ninja="${escAttr(inv.s)}">${L("Su ficha", "Its sheet")}</button>` });
    });
    // conseguir: el que más equipos te completa. A un F2P, aquí no se le propone lo que solo sale pagando, y a quien
    // gasta poco, nada de pago que lleve más de un año sin salir (la lista entera, con los de pago, en Recomendados).
    wantList().filter(x => spendLv() >= 2 || (spendLv() === 1 ? x.acq !== "paidold" : !/^paid/.test(x.acq))).forEach((w, i) => {
      out.push({ type: "conseguir", pri: 100 - i, faces: [w.s], title: L(`Consigue ${nm(w.s)}`, `Get ${nm(w.s)}`), why: wantWhy(w, true),
        long: getLine(w.s), tag: wantTag(w), btn: goalBtn(w.s, L("Conseguirlo", "Get it"), getLine(w.s)),
        more: `<button class="btn small" data-ninja="${escAttr(w.s)}">${L("Su ficha", "Its sheet")}</button>` });
    });
    return out.sort((a, b) => b.pri - a.pri);
  }
  function actions() { return perTick("actions", actionsCalc); }
  // «Hoy»: como mucho 3 cosas, una de cada tipo, con un botón y el porqué plegado.
  function homeHoy() {
    const A = actions(), nm = s => (BY.get(s) || { n: s }).n;
    const ask = profile.spend ? "" : `<label class="spend-ask">${L("¿Gastas dinero en el juego? Así afino lo que te propongo:", "Do you spend money in the game? It sharpens what I suggest:")} ${spendSelect("homeSpend")}</label>`;
    const head = `<div class="row" style="justify-content:space-between"><h3>${L("Hoy", "Today")}</h3><span class="note">${L("lo que más te rinde ahora", "what pays off most now")}</span></div>`;
    if (!Object.keys(profile.owned).length) return `<article class="panel home-hoy">${head}<p class="note">${L("Marca tus ninjas en «Mi roster» y aquí te diré qué probar, qué subir y qué conseguir.", "Mark your ninjas in «My roster» and here you'll see what to try, upgrade and get.")}</p>
      <div class="row"><button class="btn small primary" data-bsec="roster">${L("Marcar mis ninjas", "Mark my ninjas")}</button></div>${ask}</article>`;
    const pick = ["probar", "subir", "conseguir"].map(k => A.find(x => x.type === k)).filter(Boolean);
    const row = x => `<div class="hoy-row" data-type="${x.type}">
        <div class="hoy-txt"><b>${esc(x.title)}</b><div class="best-faces">${x.faces.map(s => pic(s, nm(s))).join("")}</div>
          <div class="note">${x.tag || ""}${esc(x.why)}</div></div>
        <div class="todo-act">${x.btn}</div>
        <details class="why-more"><summary>${L("¿Por qué?", "Why?")}</summary>${x.long ? `<p class="note">${esc(x.long)}</p>` : ""}<div class="row">${x.more}</div></details></div>`;
    const nTry = MODES.reduce((s, m) => s + untestedOf(m).filter(a => !a.custom).length, 0), nUp = investPlan().filter(upNow).length, nGet = wantList().length;
    const more = [[nTry, "probar", L("Por probar", "To try"), ""], [nUp, "mejorar", L("Mejorar", "Upgrade"), ""], [nGet, "recs", L("Qué conseguir", "What to get"), "mine"]].filter(x => x[0])
      .map(([n, go, l, g]) => `<button class="more-btn" data-go="${go}"${g ? ` data-recg="${g}"` : ""}>${esc(l)} (${n})</button>`).join(" ");
    return `<article class="panel home-hoy">${head}
      ${pick.length ? `<div class="hoy-list">${pick.map(row).join("")}</div>` : `<p class="note">${L("Nada urgente: todo probado y nada que compense subir ahora.", "Nothing urgent: everything tried and nothing worth upgrading now.")}</p>`}
      ${more ? `<p class="note hoy-more">${L("Ver todo", "See all")}: ${more}</p>` : ""}${ask}</article>`;
  }
  // «Esta semana»: tu jugada en una línea, lo gratis que hay que hacer (3 como mucho) y el plan completo.
  function homeWeek() {
    if (typeof PLAN === "undefined" || !PLAN.events) return "";
    const old = planState() === "old", free = planGroups().free.map(i => PLAN.events[i]);
    return `<article class="panel home-week-p"><div class="row" style="justify-content:space-between"><h3>${L("Esta semana", "This week")}</h3><button class="btn small" data-go="plan">${L("Plan completo →", "Full plan →")}</button></div>
      ${old ? `<p class="note" style="margin:4px 0 8px">${L(`<b>Caducado:</b> es el plan del ${esc(PLAN.label.replace(/^Ciclo del /, ""))}.`, `<b>Out of date:</b> this is the ${esc(((PLAN.en && PLAN.en.label) || PLAN.label).replace(/^(Ciclo del|Cycle of|Cycle from) /i, ""))} plan.`)} ${IS_APP ? L("El nuevo llegará con la próxima versión de la app.", "The new one will come with the next app version.") : "Pásame el anuncio nuevo."}</p>` : weekPlayHtml(true)}
      ${!old && free.length ? `<div class="eyebrow" style="margin-top:4px">${L("Gratis: hazlo", "Free: do it")}</div><ul class="week-free">${free.slice(0, 3).map(e => `<li><b>${esc(e.n)}</b> <span class="note">· ${esc(e.c)}</span></li>`).join("")}</ul>
        ${free.length > 3 ? `<p class="note" style="margin:4px 0 0"><button class="more-btn" data-go="plan">${L(`y ${free.length - 3} más en el plan`, `and ${free.length - 3} more in the plan`)}</button></p>` : ""}` : ""}</article>`;
  }
  // «＋ Objetivo» desde Qué conseguir, En qué invertir y Tus próximos pasos: crea el objetivo con el ninja, la meta y cómo
  // conseguirlo; los fragmentos que hacen falta los apunta el usuario (cambian según el ninja y no los copiamos de ningún sitio).
  const hasGoal = (s, what) => goalsOf().some(g => g.s === s && String(g.what) === String(what));
  const goalBtn = (s, what, note) => hasGoal(s, what) ? `<span class="chip on">${L("En tus objetivos ✓", "In your goals ✓")}</span>`
    : `<button class="btn small" data-goal-new="${esc(s)}" data-goal-what="${esc(what)}" data-goal-note="${esc(String(note || "").slice(0, 220))}">${L("＋ Objetivo", "＋ Goal")}</button>`;
  const upWhat = x => x.act === "kit" ? `${x.to}★` : x.act === "star" ? `${x.to}★ (BT)` : "Breakthrough";
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-goal-new]"); if (!b) return;
    const s = b.dataset.goalNew, what = b.dataset.goalWhat;
    if (hasGoal(s, what)) { toast(L("Ya está en tus objetivos", "It's already in your goals")); return; }
    // cuántos hacen falta: lo habitual en S y SS (80 para reclutarlo, 100 de 3★ a 4★), lo mismo que usa «Tu jugada».
    // No tenemos la tabla de costes del juego: se rellena como aproximado y el usuario lo corrige si no cuadra.
    const o = profile.owned[s], need = !o ? 80 : (o.st || 0) === 3 && /^4★/.test(what) ? 100 : 0;
    setGoals([...goalsOf(), { s, what, have: 0, need, approx: !!need, note: b.dataset.goalNote || "" }]);
    if (ui.tab !== "inicio") setTab(ui.tab);
    toast(need ? L(`Añadido a tus objetivos (Inicio), con ${need} fragmentos como aproximado: apunta los que llevas y corrígelo si no cuadra.`, `Added to your goals (Home), with ${need} fragments as an estimate: note how many you have and fix it if it's off.`)
      : L("Añadido a tus objetivos (Inicio). Apunta cuántos fragmentos necesitas.", "Added to your goals (Home). Note how many fragments you need."));
  });
  function setGoals(G) { profile.goals = G; saveProfile(); renderInicio(); }
  function renderInicio() {
    const en = KH_USAGE.en, br = KH_USAGE.br, fmt = d => d.split("-").reverse().join("/");
    $("inicioBody").innerHTML = `
      ${homeNews()}
      ${homeHoy()}
      <div class="home-grid">
        ${homeWeek()}
        <article class="panel">${goalsPanel()}</article>
      </div>
      ${homeII()}
      <p class="note" style="margin:12px 0 0">${IS_APP ? `Naruto Online Companion ${esc(window.NOC_APP.version || "")} · ` : ""}${L("Fuentes (detalle en Biblioteca › Fuentes): Nexus (meta del", "Sources (details in Library › Sources): Nexus (meta of")} ${fmt(META_DATA.meta_date)}), KonohaHub (top EN ${en.dates.map(([r, d]) => r.replace("en-", "").toUpperCase() + " " + fmt(d)).join(", ")}; BR ${br.dates.map(([, d]) => fmt(d)).join(", ")}).</p>`;
  }
  // Lo que salía en Inicio y ahora vive en su sitio: Equipos › Por probar y Tu camino, Mi roster › Mejorar.
  function renderProbar() { $("probarBody").innerHTML = homeTodo(); }
  function renderCamino() { $("caminoBody").innerHTML = homeStart() || `<p class="note">${L("Sin rutas todavía.", "No routes yet.")}</p>`; }
  function renderMejorar() {
    $("mejorarBody").innerHTML = `<article class="panel"><div class="row" style="justify-content:space-between"><h3>${L("En qué invertir", "What to invest in")}</h3><button class="btn small" data-go="tier">Tier list</button></div>${investPanel()}</article>`;
  }
  // Ir a la tarjeta de un equipo concreto (desde Inicio o Progreso): abre su modo, la despliega y la enseña.
  function goAlt(key) {
    const [mk, id] = key.split(":"); if (!modeOf(mk)) return;
    ui.mode = mk; try { localStorage.setItem(LS + "-mode", mk); } catch {}
    cardFolds[key] = 0; saveCardFolds(); setTab("ii");
    requestAnimationFrame(() => { const c = [...document.querySelectorAll("#iiGrid .ii-card[data-fkey]")].find(x => x.dataset.fkey === key);
      if (c) { for (let d = c.closest("details"); d; d = d.parentElement.closest("details")) d.open = true; c.classList.remove("folded"); c.scrollIntoView({ behavior: "smooth", block: "start" }); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 1600); } });
  }
  document.addEventListener("submit", e => {
    const f = e.target.closest("form[data-iirew]"); if (!f) return;
    e.preventDefault();
    const at = String(f.at.value || "").split(/[;\s]+/).map(x => Math.round(parseFloat(x.replace(",", ".")) * 1e6)).filter(v => v > 0).sort((a, b) => a - b);
    const own = { ...(profile.iiRewards || {}) }; if (at.length) own[f.dataset.iirew] = at; else delete own[f.dataset.iirew];
    profile.iiRewards = own; saveProfile(); toast(at.length ? L("Tramos guardados", "Reward tiers saved") : L("Tramos por defecto", "Default reward tiers")); renderInicio(); if (ui.tab === "ii") renderII();
  });
  document.addEventListener("click", e => {
    const g = e.target.closest("[data-goalt]"); if (g) { e.preventDefault(); goAlt(g.dataset.goalt); return; }
    const q = e.target.closest("[data-qt]"); if (q) { e.preventDefault(); openQuickTry(q.dataset.qt); }
    const gm = e.target.closest("[data-gomode]"); if (gm) { ui.mode = gm.dataset.gomode; try { localStorage.setItem(LS + "-mode", ui.mode); } catch {} setTab("ii"); }
  });
  document.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (!b) return;
    e.preventDefault(); if (b.dataset.recg) { ui.recG = b.dataset.recg; try { localStorage.setItem(LS + "-recg", ui.recG); } catch {} }
    setTab(b.dataset.go); window.scrollTo({ top: 0 }); });
  $("inicioBody").addEventListener("click", e => {
    const d = e.target.closest("[data-goal-del]"); if (d) { const G = goalsOf(); G.splice(+d.dataset.goalDel, 1); setGoals(G); } });
  $("inicioBody").addEventListener("submit", e => {
    const f = e.target.closest("form[data-goal-add]"); if (!f) return; e.preventDefault();
    const fd = new FormData(f); const need = +fd.get("need"); if (!(need > 0) || !fd.get("s")) return;
    setGoals([...goalsOf(), { s: fd.get("s"), what: String(fd.get("what") || "").trim() || L("objetivo", "goal"), have: +fd.get("have") || 0, need }]);
  });
  $("inicioBody").addEventListener("change", e => {
    const gh = e.target.closest("[data-goal-have], [data-goal-need]");
    if (gh) { const G = goalsOf(), i = +(gh.dataset.goalHave ?? gh.dataset.goalNeed); if (G[i]) { const k = gh.dataset.goalHave !== undefined ? "have" : "need"; G[i][k] = Math.max(0, +gh.value || 0); if (k === "need") delete G[i].approx; setGoals(G); } return; }
    const c = e.target.closest("[data-chk]"); if (!c) return;
    const [scope, id] = c.dataset.chk.split(":"); const st = checkLoad();
    const k = scope === "daily" ? dayKey() : scope === "weekly" ? weekKey() : "ev";
    st[k] = { ...(st[k] || {}), [id]: c.checked };
    Object.keys(st).forEach(x => { if (x !== "ev" && x !== dayKey() && x !== weekKey()) delete st[x]; });
    checkSave(st);
  });

  // ---------------- PERFIL
  function renderMains() {
    if (!$("mains")) return;  // «Main habitual» quitado de Mi roster (3-oct-2026); profile.main se conserva
    $("mains").innerHTML = MAINS.map(m => `
      <button class="main-card" data-main="${escAttr(m.s)}" aria-pressed="${profile.main === m.s}">
        ${pic(m.s, m.n)}<span>${esc(m.n)}</span>
      </button>`).join("");
  }
  if ($("mains")) $("mains").addEventListener("click", e => {
    const b = e.target.closest("[data-main]"); if (!b) return;
    profile.main = profile.main === b.dataset.main ? "" : b.dataset.main;
    saveProfile(); renderProfile(); renderBuilder();
  });

  // Nivel, poder y gasto se cambian en Ajustes; en Mi roster solo se ven, con un enlace.
  const SPEND_TXT = () => { const x = SPENDS.find(([k]) => k === profile.spend); return x ? L(x[1], x[2]) : L("gasto sin decir", "spending not set"); };
  function renderAcctForm() {
    const a = acctInfo(), bits = [a.level ? L(`Nivel ${a.level}`, `Level ${a.level}`) : "", a.power ? L(`${fmtPower(a.power)} de poder`, `${fmtPower(a.power)} power`) : "", SPEND_TXT()].filter(Boolean);
    if ($("acctLine")) $("acctLine").innerHTML = `${esc(bits.join(" · "))} <button class="btn small" data-bsec="ajustes">${L("Cambiar en Ajustes", "Change in Settings")}</button>`;
  }
  // El perfil de gasto se cambia desde el asistente, Ajustes o Inicio: se guarda al momento y se repinta todo.
  document.addEventListener("change", e => {
    const sel = e.target.closest && e.target.closest("[data-spend-sel]"); if (!sel) return;
    if (sel.value) profile.spend = sel.value; else delete profile.spend;
    saveProfile(); if (!sel.closest("#wizBack")) { renderAll(); toast(L("Guardado", "Saved")); }
  });
  function renderSummary() {
    renderAcctForm();
    const owned = Object.keys(profile.owned).filter(s => BY.has(s));
    $("stNinjas").textContent = owned.length;
    $("stSummons").textContent = profile.summons.length;
    $("stBT").textContent = owned.filter(s => profile.owned[s].bt).length;
    $("cntOwned").textContent = owned.length;
    const els = ["Fire", "Water", "Wind", "Earth", "Lightning"];
    const cnt = Object.fromEntries(els.map(e => [e, owned.filter(s => BY.get(s).e === e).length]));
    const max = Math.max(1, ...Object.values(cnt));
    const nameEs = { Fire: "Fuego", Water: "Agua", Wind: "Viento", Earth: "Tierra", Lightning: "Rayo" };
    $("elBars").innerHTML = els.map(e => `<div class="bar"><span>${L(nameEs[e], e)}</span><i style="width:${Math.round(cnt[e] / max * 100)}%;background:var(--el-${e.toLowerCase()})"></i><span class="mono">${cnt[e]}</span></div>`).join("");
  }

  // Veredicto de la ficha revisada (CONSULTAS) para ordenar y etiquetar Mi roster.
  const VERDOF = s => ((typeof CONSULTAS !== "undefined" && CONSULTAS[s]) || {}).veredicto || "";
  const VRANK = s => ({ "Meta": 0, "Útil": 1, "De nicho": 2, "No se usa": 3 })[VERDOF(s)] ?? 4;
  const VLBL = { "Meta": L("Meta", "Meta"), "Útil": L("Útil", "Useful"), "De nicho": L("De nicho", "Niche") };
  // Búsqueda de ninjas (catálogo, creador y cabecera): todas las palabras tienen que estar; primero el nombre exacto,
  // luego el personaje exacto («rin» → Rin Nohara, no Karin), los que empiezan así y las palabras que empiezan así.
  const SEARCH_ALIAS = [[/\brock lee\b/g, "lee"]];
  function searchWords(q) { let s = String(q || "").toLowerCase().replace(/[\[\]()]/g, " "); SEARCH_ALIAS.forEach(([r, x]) => { s = s.replace(r, x); }); return s.split(/\s+/).filter(Boolean); }
  function nameScore(n, W) {
    const name = n.n.toLowerCase(), hay = name + " " + n.s, base = name.split(" [")[0], q = W.join(" ");
    if (!W.every(w => hay.includes(w))) return 9;
    if (name === q || name.replace(/[\[\]]/g, "") === q) return 0;
    if (base === q || base.split(" ")[0] === q) return 1;
    if (name.startsWith(q)) return 2;
    const words = name.replace(/[\[\]()]/g, " ").split(/\s+/);
    return W.every(w => words.some(x => x.startsWith(w))) ? 3 : 4;
  }
  function filteredCatalog() {
    const q = searchWords($("q").value);
    const fe = $("fEl").value, fr = $("fRar").value, fro = $("fRole").value;
    let list = D.ninjas.filter(n => !n.m);
    if (ui.showMine) list = list.filter(n => profile.owned[n.s]);
    if (fe) list = list.filter(n => n.e === fe);
    if (fr) list = list.filter(n => n.r === fr);
    if (fro) list = list.filter(n => n.ro === fro);
    if (q.length) list = list.filter(n => nameScore(n, q) < 9);
    if ($("fSort").value === "meta") list = [...list].sort((a, b) => b.pr - a.pr || a.n.localeCompare(b.n));
    // Más útiles primero: según el veredicto de su ficha revisada (Meta, Útil, De nicho, No se usa) y luego su uso en el top.
    if ($("fSort").value === "util") list = [...list].sort((a, b) => VRANK(a.s) - VRANK(b.s) || b.pr - a.pr || a.n.localeCompare(b.n));
    if (q.length) list = [...list].sort((a, b) => nameScore(a, q) - nameScore(b, q));   // lo que mejor encaja, primero
    return list;
  }
  function renderCatalog() {
    const list = filteredCatalog();
    const shown = list.slice(0, ui.catalogLimit);
    if (!list.length) {
      $("catalog").innerHTML = `<div class="empty" style="grid-column:1/-1">${ui.showMine ? L("Aún no has marcado ningún ninja. Pasa a «Catálogo completo» y toca los que tengas.", "You haven't marked any ninja yet. Switch to «Full catalog» and tap the ones you own.") : L("Ningún ninja coincide con esos filtros.", "No ninja matches those filters.")}</div>`;
      $("catalogMore").textContent = ""; return;
    }
    $("catalog").innerHTML = shown.map(n => {
      const o = profile.owned[n.s];
      return `<div class="card${o ? " owned" : ""}${o && isExcl(n.s) ? " is-excl" : ""}" data-s="${escAttr(n.s)}">
        <button class="info-btn" data-sheet="${escAttr(n.s)}" aria-label="${L("Ficha de", "Sheet of")} ${escAttr(n.n)}" title="${L("Ver su ficha", "See its sheet")}">i</button>
        <button class="own-btn" data-own="${escAttr(n.s)}" aria-pressed="${!!o}" aria-label="${o ? L("Quitar", "Unmark") : L("Marcar", "Mark")} ${esc(n.n)}">
          ${pic(n.s, n.n)}
          <span class="name">${esc(n.n)}</span>
        </button>
        <span class="meta"><span class="el" data-e="${escAttr(n.e)}"></span><span class="rar">${n.r}</span><span>${esc(n.ro)}</span>${n.pr ? `<span class="mono" title="${L("Uso en el top-10 de arena", "Usage in the arena top 10")}">${n.pr}%</span>` : ""}</span>
        ${VLBL[VERDOF(n.s)] ? `<span class="verd" data-v="${VRANK(n.s)}" title="${L("Según su ficha revisada", "According to its reviewed sheet")}">${VLBL[VERDOF(n.s)]}</span>` : ""}
        ${o ? `<div class="ctl">
          <span class="st-pips" role="group" aria-label="${L("Estrellas de ", "Stars of ")}${esc(n.n)}">${[1, 2, 3, 4, 5].map(k => `<button type="button" class="pip${k <= (o.st || 0) ? " on" : ""}" data-st-set="${escAttr(n.s)}" data-st="${escAttr(k)}" aria-pressed="${(o.st || 0) === k}" aria-label="${k}★" title="${k}★">★</button>`).join("")}</span>
          <button class="bt" data-bt="${escAttr(n.s)}" aria-pressed="${!!o.bt}" title="Skill breakthrough">BT</button>
          ${isExcl(n.s) ? `<button class="bt excl" data-excl="${escAttr(n.s)}" title="${L("No se usa para montar tus equipos ni en «En qué invertir». Toca para volver a usarlo.", "Not used to build your teams or in «What to invest in». Tap to use it again.")}">${L("No se usa", "Not used")}</button>` : ""}
        </div>` : ""}
        ${o ? `<span class="tick" aria-hidden="true">✓</span>` : ""}
      </div>`;
    }).join("");
    $("catalogMore").innerHTML = list.length > shown.length
      ? `${L(`Mostrando ${shown.length} de ${list.length}.`, `Showing ${shown.length} of ${list.length}.`)} <button class="btn small" id="more">${L("Mostrar todos", "Show all")}</button>` : `${list.length} ninjas`;
  }
  $("catalogMore").addEventListener("click", e => { if (e.target.id === "more") { ui.catalogLimit = 9999; renderCatalog(); } });
  $("catalog").addEventListener("click", e => {
    const own = e.target.closest("[data-own]");
    const bt = e.target.closest("[data-bt]");
    if (bt) { const o = profile.owned[bt.dataset.bt]; o.bt = !o.bt; saveProfile(); renderCatalog(); renderSummary(); return; }
    const sh = e.target.closest("[data-sheet]"); if (sh) { openSheet(sh.dataset.sheet); return; }   // tocar la tarjeta marca/desmarca; la ⓘ de la esquina abre la ficha
    // Estrellas de un toque; tocar la estrella que ya tiene baja una. Se recuerdan para el siguiente ninja que marques:
    // a ese, el primer toque le fija las estrellas (si no, tocar las 3★ que ya heredó le bajaba a 2★).
    const pip = e.target.closest("[data-st-set]");
    if (pip) { const s = pip.dataset.stSet, k = +pip.dataset.st, o = profile.owned[s]; if (!o) return;
      o.st = (o.st || 0) === k && !stInherited.has(s) ? k - 1 : k; stInherited.delete(s); ui.lastSt = o.st; try { localStorage.setItem(LS + "-lastst", String(o.st)); } catch {}
      saveProfile(); renderCatalog(); renderSummary(); return; }
    if (own) {
      const s = own.dataset.own;
      if (profile.owned[s]) { delete profile.owned[s]; stInherited.delete(s); if (isExcl(s)) toggleExcl(s); } else { profile.owned[s] = { st: ui.lastSt ?? (() => { try { return +localStorage.getItem(LS + "-lastst") || 0; } catch { return 0; } })(), bt: false }; if (profile.owned[s].st) stInherited.add(s); }
      saveProfile(); renderCatalog(); renderSummary(); renderPool(); updateAcct();
    }
  });
  ["q", "fEl", "fRar", "fRole", "fSort"].forEach(id => $(id).addEventListener("input", () => { ui.catalogLimit = 120; renderCatalog(); }));
  // Qué enseña Mi roster: lo elegido la última vez; si nunca se eligió, «Solo los míos» en cuanto hay ninjas marcados.
  let showInit = false;
  function setShow(which, quiet) {
    if (which === "pool") which = "mine";   // el filtro «Favoritos» ya no existe
    ui.showMine = which === "mine"; showInit = true;
    if (!quiet) try { localStorage.setItem(LS + "-rostershow", which); } catch {}
    [["showAll", "all"], ["showMine", "mine"]].forEach(([id, w]) => $(id).setAttribute("aria-pressed", String(w === which)));
    if (!quiet) renderCatalog();
  }
  function initShow() {
    if (showInit) return;
    let s = null; try { s = localStorage.getItem(LS + "-rostershow"); } catch {}
    if (!s && Object.keys(profile.owned).length) s = "mine";
    if (s) setShow(s, true);
  }
  $("showAll").addEventListener("click", () => setShow("all"));
  $("showMine").addEventListener("click", () => setShow("mine"));

  function renderMySummons() {
    $("sumCount").textContent = profile.summons.length || "";
    $("summonCatalog").innerHTML = D.summons.map(s => {
      const own = profile.summons.includes(s.s);
      const flow = s.tr.length ? `${s.tr.map(st).join(" ")} → ${s.ca.map(st).join(" ") || "—"}` : s.th ? st(s.th + " Combo") : s.onMystery ? L("Con el mystery del main", "With the main's mystery") : "";
      return `<div class="card${own ? " owned" : ""}"><button class="own-btn" data-sum="${escAttr(s.s)}" aria-pressed="${escAttr(own)}" title="${esc(s.sn + ": " + s.d)}">
        ${pic("s:" + s.s, s.n)}<span class="name">${esc(s.n)}</span></button>
        <span class="meta"><span>${esc(s.tier || "")}</span></span>
        <span class="meta" style="flex-wrap:wrap">${flow}</span>
        ${own ? `<span class="tick" aria-hidden="true">✓</span>` : ""}</div>`;
    }).join("");
  }
  $("summonCatalog").addEventListener("click", e => {
    const b = e.target.closest("[data-sum]"); if (!b) return;
    const s = b.dataset.sum;
    profile.summons = profile.summons.includes(s) ? profile.summons.filter(x => x !== s) : [...profile.summons, s];
    saveProfile(); renderMySummons(); renderSummary();
  });

  // Cartas de asistencia (datos de Nexus: efecto al nivel máximo). «tag»: para qué se recomienda cada una.
  function renderAssists() {
    const mine = profile.assists || {};
    const f = ui.asF || "all";
    const list = ASSISTS.filter(a => f === "mine" ? mine[a.s] : f === "top" ? (a.top || a.tag) : true)
      .sort((a, b) => (mine[b.s] ? 1 : 0) - (mine[a.s] ? 1 : 0) || (b.top ? 1 : 0) - (a.top ? 1 : 0) || a.n.localeCompare(b.n));
    $("asCount").textContent = Object.keys(mine).length || "";
    $("assistCatalog").innerHTML = list.map(a => { const lv = mine[a.s];
      return `<div class="card${lv ? " owned" : ""}"><button class="own-btn" data-as="${escAttr(a.s)}" aria-pressed="${!!lv}" aria-label="${lv ? L("Quitar", "Unmark") : L("Marcar", "Mark")} ${L("la carta", "card")} ${esc(a.n)}">
        ${pic(a.s, a.n)}<span class="name">${esc(a.n)}</span></button>
        ${a.tag ? `<span class="as-tag${a.top ? " top" : ""}">${esc(tr(a.tag))}</span>` : ""}
        <span class="as-eff" title="${esc(a.d)}">${esc(a.lbl || a.d)}</span>
        ${lv ? `<div class="ctl"><select data-aslv="${escAttr(a.s)}" aria-label="${L("Nivel de la carta", "Level of card")} ${esc(a.n)}">${Array.from({ length: a.lv }, (_, i) => i + 1).map(k => `<option value="${escAttr(k)}"${lv === k ? " selected" : ""}>${L("Nv.", "Lv.")} ${k}</option>`).join("")}</select></div>` : ""}
        ${lv ? `<span class="tick" aria-hidden="true">✓</span>` : ""}</div>`; }).join("") || `<div class="empty" style="grid-column:1/-1">${L("Aún no has marcado ninguna carta: pasa a «Todas» y toca las que tengas.", "You haven't marked any card yet: switch to «All» and tap the ones you have.")}</div>`;
  }
  $("assistCatalog").addEventListener("click", e => {
    const b = e.target.closest("[data-as]"); if (!b) return;
    const s = b.dataset.as; const m = { ...(profile.assists || {}) };
    if (m[s]) delete m[s]; else m[s] = 1;
    profile.assists = m; saveProfile(); renderAssists();
  });
  $("assistCatalog").addEventListener("change", e => {
    const s = e.target.dataset.aslv; if (!s) return;
    profile.assists = { ...(profile.assists || {}), [s]: +e.target.value }; saveProfile();
  });
  document.querySelectorAll("[data-asf]").forEach(b => b.addEventListener("click", () => {
    ui.asF = b.dataset.asf; document.querySelectorAll("[data-asf]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderAssists();
  }));

  $("copyRoster").addEventListener("click", async () => {
    const lines = ["# Exportado desde Cuartel Ninja", "", "[cuenta]", `nivel = ${acctInfo().level}`, `poder_combate = ${acctInfo().power}`, "", "[main]", `personaje = "${profile.main ? (BY.get(profile.main) || {}).n || "" : ""}"`, ""];
    Object.entries(profile.owned).forEach(([s, o]) => { const n = BY.get(s); if (!n) return;
      lines.push("[[ninja]]", `nombre = "${n.n.replace(/"/g, '\\"')}"`, `estrellas = ${o.st || 0}`, `breakthrough = ${o.bt ? 1 : 0}`, ""); });
    lines.push("[summons]", `lista = [${profile.summons.map(s => `"${(SUM.get(s) || {}).n || s}"`).join(", ")}]`, "");
    lines.push("[assists]", ...Object.entries(profile.assists || {}).map(([s, lv]) => `"${((ASSISTS.find(a => a.s === s) || {}).n || s).replace(/"/g, '\\"')}" = ${lv}`));
    const text = lines.join("\n");
    try { await navigator.clipboard.writeText(text); toast(L("Roster copiado", "Roster copied")); }
    catch { toast("No se pudo copiar; tu navegador no lo permite aquí"); }
  });

  function renderPool() {
    const list = exclList().map(s => BY.get(s));
    $("poolPanel").hidden = !list.length; if (!list.length) { $("poolPanel").innerHTML = ""; return; }
    $("poolPanel").innerHTML = `<div class="row fold-head" style="justify-content:space-between"><h2>${L("No usar en mis equipos", "Don't use in my teams")} <span class="muted mono" style="font-size:.9rem">${list.length}</span></h2></div>
      <p class="note" style="margin:4px 0 10px">${L("Los tienes, pero la app no los usa para montar tus equipos ni te propone subirlos en «En qué invertir». Los equipos de referencia y del top que los llevan siguen saliendo.", "You own them, but the app doesn't use them to build your teams or suggest upgrading them in «What to invest in». Reference and top teams that use them still show up.")}</p>
      <div class="pool-faces">${list.map(n => { const o = profile.owned[n.s]; return `<span class="pool-face" title="${esc(n.n)}">${pic(n.s, n.n)}<span>${esc(n.n)}${o.st ? ` <b>${o.st}★</b>` : ""} <button class="btn small" data-excl="${escAttr(n.s)}">${L("Volver a usar", "Use again")}</button></span></span>`; }).join("")}</div>`;
    applyFolds();
  }
  // Secciones plegables de Mi roster: se pliegan tocando el título; se recuerda en este navegador.
  var folds = {}; try { folds = JSON.parse(localStorage.getItem(LS + "-fold") || "{}"); } catch {}
  if (!("tactics" in folds)) folds.tactics = true;  // las tácticas empiezan plegadas
  function applyFolds() { document.querySelectorAll("[data-fold]").forEach(p => { const f = !!folds[p.dataset.fold]; p.classList.toggle("folded", f);
    const h = p.querySelector(".fold-head h2"); if (h) { h.setAttribute("role", "button"); h.setAttribute("tabindex", "0"); h.setAttribute("aria-expanded", String(!f)); } }); }
  function toggleFold(e) {
    const h = e.target.closest(".fold-head h2"); if (!h) return; if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); const k = h.closest("[data-fold]").dataset.fold; folds[k] = !folds[k];
    try { localStorage.setItem(LS + "-fold", JSON.stringify(folds)); } catch {} applyFolds();
  }
  $("view-perfil").addEventListener("click", toggleFold); $("view-perfil").addEventListener("keydown", toggleFold);
  // Subpestañas de Mi roster: cada una enseña sus paneles (se recuerda en este navegador) y los despliega.
  const RT = { ninjas: [".profile-head", '[data-fold="pool"]', '[data-fold="ninjas"]'], cartas: ['[data-fold="assists"]'], summons: ['[data-fold="summons"]'], tacticas: ['[data-fold="tactics"]'] };
  var rosterTab = "ninjas"; try { rosterTab = localStorage.getItem(LS + "-rt") || "ninjas"; } catch {}
  function applyRosterTab() {
    if (!RT[rosterTab]) rosterTab = "ninjas";
    document.querySelectorAll("#rosterTabs [data-rt]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.rt === rosterTab)));
    Object.entries(RT).forEach(([k, sels]) => sels.forEach(s => { const el = document.querySelector("#view-perfil " + s); if (el) el.classList.toggle("rt-hide", k !== rosterTab); }));
  }
  $("rosterTabs").addEventListener("click", e => { const b = e.target.closest("[data-rt]"); if (!b) return;
    rosterTab = b.dataset.rt; try { localStorage.setItem(LS + "-rt", rosterTab); } catch {}
    RT[rosterTab].forEach(s => { const el = document.querySelector("#view-perfil " + s); if (el && el.dataset.fold) folds[el.dataset.fold] = false; });
    try { localStorage.setItem(LS + "-fold", JSON.stringify(folds)); } catch {} applyFolds(); applyRosterTab(); });
  function renderProfile() { initShow(); renderMains(); renderSummary(); renderPool(); renderCatalog(); renderMySummons(); renderAssists(); renderTacBars(); applyFolds(); applyRosterTab(); updateAcct(); fillSearch(); }

  // Textos largos de los modos: se muestran 3 líneas y «Leer más» los despliega.
  document.addEventListener("click", e => { const b = e.target.closest("[data-more]"); if (!b) return;
    const p = b.previousElementSibling; if (!p) return; const open = p.classList.toggle("open");
    b.textContent = open ? L("Leer menos", "Read less") : L("Leer más", "Read more"); b.setAttribute("aria-expanded", String(open)); });

  // ---------------- SIMULADOR DE CHASES
  function unitSkills(n, t = team) {
    if (!n.m) return n.sk;
    // el main solo usa lo equipado: una habilidad de cada tipo
    const sel = t.mainSel || {};
    return n.sk.filter(k => ["Mystery", "Standard", "Chase"].includes(k.t) ? sel[k.t] === k.id : false);
  }
  function lineup(t = team) {
    const units = [];
    t.cells.forEach((s, i) => { const n = s && BY.get(s); if (n) units.push({ cell: i, rank: RANK[i], n, skills: unitSkills(n, t) }); });
    units.sort((a, b) => a.rank - b.rank);
    return units;
  }
  function chasers(units, t = team) {
    const out = [];
    units.forEach(u => u.skills.forEach((k, i) => { if (k.tr || k.th) out.push({ u, k, i, key: u.cell + ":" + k.id, summon: false }); }));
    const sm = t.summon && SUM.get(t.summon);
    const mainU = units.find(u => u.n.m);
    if (sm && (sm.tr.length || sm.th)) {
      const k = { id: "s:" + sm.s, t: "Summon", n: sm.sn || sm.n, tr: sm.tr, th: sm.th, ca: sm.ca, cg: sm.cg, mx: sm.mx, d: sm.d };
      out.push({ u: mainU || { cell: -1, rank: 99, n: { s: "s:" + sm.s, n: sm.n } }, k, i: 99, key: "summon", summon: true, sm });
    }
    return out;
  }
  function simulate(units, starter, t = team) {
    const list = chasers(units, t);
    const used = new Map();
    let statuses = new Set(starter.k.ca || []);
    let combo = starter.k.cg || 0;
    const steps = [{ u: starter.u, k: starter.k, via: "Inicio", causes: [...statuses], combo, add: combo }];
    for (let guard = 0; guard < 40; guard++) {
      const cands = [];
      for (const c of list) {
        if ((used.get(c.key) || 0) >= (c.k.mx || 1)) continue;
        const byStatus = t.superArmor ? null : (c.k.tr || []).find(s => statuses.has(s));
        if (byStatus) cands.push({ ...c, by: "status", label: byStatus });
        else if (c.k.th && combo >= c.k.th) cands.push({ ...c, by: "combo", label: c.k.th + " Combo" });
      }
      // un summon solo entra si la casilla del main no tiene otro chase disponible
      const busy = new Set(cands.filter(c => !c.summon).map(c => c.u.cell));
      const pool = cands.filter(c => !c.summon || !busy.has(c.u.cell));
      if (!pool.length) break;
      pool.sort((a, b) => (a.by !== "status") - (b.by !== "status")
        || ([10, 20, 30].includes(a.k.th) && a.by === "combo") - ([10, 20, 30].includes(b.k.th) && b.by === "combo")
        || a.u.rank - b.u.rank || a.i - b.i);
      const p = pool[0];
      used.set(p.key, (used.get(p.key) || 0) + 1);
      combo += p.k.cg || 0;
      statuses = new Set(p.k.ca || []);
      steps.push({ u: p.u, k: p.k, via: p.label, causes: [...statuses], combo, add: p.k.cg || 0, summon: p.summon, sm: p.sm });
    }
    const last = steps[steps.length - 1];
    const moveLeft = last.causes.filter(s => MOVES.has(s));
    let end;
    if (steps.length === 1 && !statuses.size && !combo) end = L("Esta habilidad no deja ningún estado que se pueda perseguir.", "This skill leaves no status that can be chased.");
    else if (moveLeft.length) end = L(`Nadie más persigue ${moveLeft.join(" / ")}.`, `Nobody else chases ${moveLeft.join(" / ")}.`);
    else if (last.causes.length) end = L(`La cadena acaba con ${last.causes.join(", ")}: nadie del equipo lo persigue.`, `The chain ends with ${last.causes.join(", ")}: nobody in the team chases it.`);
    else end = L("La última habilidad no deja ningún estado que perseguir.", "The last skill leaves no status to chase.");
    return { steps, combo, end, openEnd: moveLeft };
  }
  function starters(units) {
    const out = [];
    units.forEach(u => u.skills.forEach(k => { if (k.t === "Mystery" || k.t === "Standard") out.push({ u, k }); }));
    return out;
  }

  // ---------------- CREADOR
  // Talentos del main por filas, como en la pantalla del juego (capturas de Breeze Dancer y Crimson Fist, 2-oct-2026):
  // mystery, ataque, fila de chases, fila 2 y fila 3; una de cada. Comprobado con capturas en Breeze, Crimson, Scarlet y Midnight (3-oct). Las versiones Ultimate (id 5…) no las tiene el usuario.
  // La 4.ª de la fila 3 (Senjutsu - Recovery, Defense Instruction…) se desbloquea a nivel 76.
  const isUlt = k => String(k.id).startsWith("5");
  function talentRows(m) {
    const base = m.sk.filter(k => !isUlt(k));
    const rest = base.filter(k => !["Mystery", "Standard", "Chase"].includes(k.t));
    return { Mystery: base.filter(k => k.t === "Mystery"), Standard: base.filter(k => k.t === "Standard"), Chase: base.filter(k => k.t === "Chase"), P2: rest.slice(0, 4), P3: rest.slice(4, 8) };
  }
  const TALENT_LABEL = EN ? { Mystery: "Mystery", Standard: "Attack", Chase: "Passive · chases", P2: "Passive · row 2", P3: "Passive · row 3" } : { Mystery: "Mystery", Standard: "Ataque", Chase: "Pasiva · chases", P2: "Pasiva · fila 2", P3: "Pasiva · fila 3" };
  const talentLocked = (row, i) => row === "P3" && i === 3 && (acctInfo().level || 0) < 76;
  function talentNames(m, sel) {
    if (!m || !sel) return [];
    return ["Mystery", "Standard", "Chase", "P2", "P3"].map(r => { const k = m.sk.find(x => x.id === sel[r]); return k ? k.n : null; }).filter(Boolean);
  }
  // Personaje real (dos versiones del mismo no pueden ir juntas). Madara [Five Kage Summit] cuenta como Obito.
  const CHAR_OVERRIDE = { "madara-uchiha-five-kage-summit": "Obito" };
  const charOf = n => CHAR_OVERRIDE[n.s] || (/^Pain - /.test(n.n) ? n.n.split(" [")[0] : n.n.split(" [")[0].split(" ")[0]);
  const BARRIER_RE = /(launch\w*|activat\w*|releas\w*|deploy\w*|acts as)\W+(?:\w+\W+){0,6}?barrier/i;
  // Barreras que no salen en el texto del propio ninja: la de Kabuto [GNW] la lanza Mu al ser invocado
  // (bajo ella solo usan standard Kabuto y los Edo Tensei); la de Hanzo [Ronin] se despliega tras recibir 4 golpes.
  const BARRIER_EXTRA = new Set(["kabuto-great-ninja-war", "hanzo-wandering-samurai"]);
  const hasBarrier = n => BARRIER_EXTRA.has(n.s) || n.sk.some(k => BARRIER_RE.test(String(k.d || "").replace(/<[^>]+>/g, "")));
  // Breakthrough por ninja (7-oct-2026): el acceso al BT se abre al llegar a 4★ (en todos los que lo tienen); luego cada rama se rompe y mejora con viales.
  // f = primeras habilidades a romper según la prioridad de Nexus. Ninjas que no salen aquí no tienen breakthrough: subirlos de estrellas solo da stats.
  // Regla del usuario (3-oct-2026): en tus equipos solo van tus ninjas meta (más los mains). Jiraiya [Sannin War] y
  // Gaara [Fifth Kazekage] entran de momento, a prueba. Temari [Great Ninja War] entrará cuando la subas (está a 2★).
  const DEFAULT_POOL = new Set(["madara-uchiha-the-final-battle", "sasuke-uchiha-sasuke-shinden", "naruto-uzumaki-sasuke-shinden", "genma-shiranui",
    "itachi-uchiha-ronin", "kabuto-great-ninja-war", "sai-swimsuit", "shisui-uchiha-modern-asian-style", "jiraiya-toads-chant",
    "gaara-fifth-kazekage", "obito-uchiha-great-ninja-war"]);
  // Para montar equipos y «En qué invertir» cuentan todos tus ninjas salvo los que marques «No usar en mis equipos»
  // (profile.excl, en su ficha). Sustituye a los antiguos favoritos (29-oct-2026: el usuario no sabía qué hacían y los
  // nuevos entraban o no según si había tocado la lista). DEFAULT_POOL solo sirve para pasar al Cuartel sin lista propia.
  const isExcl = s => (profile.excl || []).includes(s);
  const inPool = s => !!profile.owned[s] && !isExcl(s);
  const exclList = () => (profile.excl || []).filter(s => profile.owned[s] && BY.has(s));
  function toggleExcl(s) { profile.excl = isExcl(s) ? profile.excl.filter(x => x !== s) : [...(profile.excl || []), s]; }
  // Aviso donde se recomienda algo: cuántos has dejado fuera y un enlace para verlos (nunca desaparece nada sin decirlo).
  const exclNote = () => { const n = exclList().length; return n ? `<p class="note excl-note">${L(`${n} ninja${n > 1 ? "s" : ""} tuyo${n > 1 ? "s" : ""} marcado${n > 1 ? "s" : ""} «No usar en mis equipos»`, `${n} of your ninjas marked «Don't use in my teams»`)} · <a href="#" data-excl-go>${L("ver", "see")}</a></p>` : ""; };
  function teamWarnings(cells, pool) {
    const ns = (cells || []).filter(Boolean).map(s => BY.get(s)).filter(n => n && !n.m);
    const out = [], seen = {};
    ns.forEach(n => { const c = charOf(n); if (seen[c]) out.push(L(`${seen[c].n} y ${n.n} son el mismo personaje: no pueden ir en el mismo equipo.`, `${seen[c].n} and ${n.n} are the same character: they can't be in the same team.`)); else seen[c] = n; });
    const bar = ns.filter(hasBarrier);
    if (bar.length > 1) out.push(L(`${bar.length} ninjas con barrera (${bar.map(n => n.n.split(" [")[0]).join(", ")}): solo queda una en el campo, la última que se lanza.`, `${bar.length} ninjas with a barrier (${bar.map(n => n.n.split(" [")[0]).join(", ")}): only one stays on the field, the last one cast.`));
    const nope = pool ? ns.filter(n => !profile.owned[n.s]) : [], off = pool ? ns.filter(n => profile.owned[n.s] && isExcl(n.s)) : [];
    if (nope.length) out.push(L(`No los tienes marcados en Mi roster: ${nope.map(n => n.n).join(", ")}.`, `Not marked as yours in My roster: ${nope.map(n => n.n).join(", ")}.`));
    if (off.length) out.push(L(`Marcado${off.length > 1 ? "s" : ""} «No usar en mis equipos»: ${off.map(n => n.n).join(", ")}.`, `Marked «Don't use in my teams»: ${off.map(n => n.n).join(", ")}.`));
    return out;
  }
  // Elige la combinación de habilidades del main que da la cadena más larga (si el usuario no la ha fijado).
  let mainFixed = false;
  function ensureMainSel() {
    const m = team.cells.map(s => s && BY.get(s)).find(n => n && n.m);
    if (!m) return;
    const types = ["Mystery", "Standard", "Chase"];
    const valid = types.every(t => m.sk.some(k => k.t === t && k.id === team.mainSel[t]) || !m.sk.some(k => k.t === t));
    if (valid && mainFixed) return;
    if (valid && team.mainSel._auto === m.s + team.cells.join(",")) return;
    const opts = Object.fromEntries(types.map(t => [t, m.sk.filter(k => k.t === t && !isUlt(k))]));
    let best = null;
    for (const my of opts.Mystery.length ? opts.Mystery : [null])
      for (const sd of opts.Standard.length ? opts.Standard : [null])
        for (const ch of opts.Chase.length ? opts.Chase : [null]) {
          team.mainSel = { Mystery: my && my.id, Standard: sd && sd.id, Chase: ch && ch.id };
          const units = lineup();
          const score = Math.max(0, ...starters(units).map(st0 => { const r = simulate(units, st0); return r.steps.length * 100 + r.combo; }));
          if (!best || score > best.score) best = { score, sel: { ...team.mainSel } };
        }
    team.mainSel = { ...best.sel, P2: team.mainSel.P2, P3: team.mainSel.P3, _auto: m.s + team.cells.join(",") };
  }
  function renderBoard() {
    const count = team.cells.filter(Boolean).length;
    $("board").innerHTML = team.cells.map((s, i) => {
      const n = s && BY.get(s);
      const target = ui.picking && !s && count < 4;
      return `<div class="cell${n ? " filled" : ""}${target ? " target" : ""}" data-cell="${escAttr(i)}" role="button" tabindex="0" aria-label="${L("Casilla", "Square")} ${RANK[i]}${n ? ": " + esc(n.n) : L(" vacía", " empty")}">
        <span class="order">${RANK[i]}</span>
        ${n ? `<div class="unit">${pic(n.s, n.n)}<span>${esc(n.n)}</span></div><button class="x" data-rm="${escAttr(i)}" aria-label="${L("Quitar", "Remove")} ${esc(n.n)}">×</button>` : `<span class="plus" aria-hidden="true">+</span>`}
      </div>`;
    }).join("");
  }
  function onCell(i) {
    if (team.cells[i]) { if (ui.picking) { toast(L("Esa casilla ya está ocupada", "That square is taken")); } return; }
    if (!ui.picking) { toast(L("Primero elige un ninja de la lista", "First pick a ninja from the list")); return; }
    if (team.cells.filter(Boolean).length >= 4) { toast(L("Ya hay 4 unidades en el equipo", "The team already has 4 units")); return; }
    team.cells[i] = ui.picking; ui.picking = null; ui.starter = null;
    ensureMainSel(); renderBuilder();
  }
  $("board").addEventListener("click", e => {
    const rm = e.target.closest("[data-rm]");
    if (rm) { team.cells[+rm.dataset.rm] = null; ui.starter = null; renderBuilder(); return; }
    const c = e.target.closest("[data-cell]"); if (c) onCell(+c.dataset.cell);
  });
  $("board").addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const c = e.target.closest("[data-cell]"); if (c) { e.preventDefault(); onCell(+c.dataset.cell); }
  });
  $("clearBoard").addEventListener("click", () => { team.cells = Array(9).fill(null); ui.starter = null; renderBuilder(); });

  function renderPicker() {
    const q = searchWords($("pq").value);
    const inTeam = new Set(team.cells.filter(Boolean));
    let list = ui.pickMine ? D.ninjas.filter(n => n.m || profile.owned[n.s]) : D.ninjas;
    if (q.length) list = list.filter(n => nameScore(n, q) < 9);
    list = [...list].sort((a, b) => b.m - a.m || (q.length ? nameScore(a, q) - nameScore(b, q) : 0) || a.n.localeCompare(b.n));
    const hasMain = team.cells.some(s => s && (BY.get(s) || {}).m);
    if (!list.length) {
      $("picker").innerHTML = `<div class="empty" style="grid-column:1/-1">${ui.pickMine ? L("Marca tus ninjas en «Mi roster», o cambia a «Todos».", "Mark your ninjas in «My roster», or switch to «All».") : L("Nada coincide.", "Nothing matches.")}</div>`;
      return;
    }
    $("picker").innerHTML = list.slice(0, 300).map(n => {
      const dis = inTeam.has(n.s) || (n.m && hasMain);
      return `<button class="pick" data-pick="${escAttr(n.s)}" aria-pressed="${ui.picking === n.s}" ${dis ? "disabled" : ""}>${pic(n.s, n.n)}<span>${esc(n.n)}</span></button>`;
    }).join("");
  }
  $("picker").addEventListener("click", e => {
    const b = e.target.closest("[data-pick]"); if (!b || b.disabled) return;
    ui.picking = ui.picking === b.dataset.pick ? null : b.dataset.pick;
    $("pickHint").textContent = ui.picking ? L(`Ahora toca una casilla libre para colocar a ${BY.get(ui.picking).n}.`, `Now tap a free square to place ${BY.get(ui.picking).n}.`) : L("Elige un ninja y después una casilla libre.", "Pick a ninja, then a free square.");
    renderPicker(); renderBoard();
  });
  $("pq").addEventListener("input", renderPicker);
  $("pickMine").addEventListener("click", () => { ui.pickMine = true; $("pickMine").setAttribute("aria-pressed", "true"); $("pickAll").setAttribute("aria-pressed", "false"); renderPicker(); });
  $("pickAll").addEventListener("click", () => { ui.pickMine = false; $("pickAll").setAttribute("aria-pressed", "true"); $("pickMine").setAttribute("aria-pressed", "false"); renderPicker(); });

  function renderLoadout() {
    const m = team.cells.map(s => s && BY.get(s)).find(n => n && n.m);
    $("loadoutBox").hidden = !m;
    if (!m) return;
    const rows = talentRows(m);
    $("loadout").innerHTML = ["Mystery", "Standard", "Chase", "P2", "P3"].map(r => {
      const opts = rows[r].slice();
      const cur = team.mainSel[r];
      const extra = cur && !opts.some(k => k.id === cur) ? m.sk.find(k => k.id === cur) : null;
      const opt = (k, i, ult) => {
        const flow = r === "Chase" ? ` · ${(k.tr || []).join("/") || (k.th ? k.th + " Combo" : "")} → ${(k.ca || []).filter(s => MOVES.has(s)).join("/") || "—"}`
          : ["Mystery", "Standard"].includes(r) ? ` · ${(k.ca || []).filter(s => MOVES.has(s)).join("/") || L("sin movimiento", "no movement")}` : "";
        const lock = !ult && talentLocked(r, i) ? L(" (nivel 76)", " (level 76)") : "";
        return `<option value="${esc(k.id)}"${cur === k.id ? " selected" : ""}${lock ? " disabled" : ""} title="${esc(k.d || "")}">${esc(k.n)}${ult ? L(" (Ultimate, no la tienes)", " (Ultimate, not owned)") : ""}${lock}${esc(flow)}</option>`;
      };
      return `<label>${TALENT_LABEL[r]}${r === "Mystery" && !mainFixed ? ' <span style="font-weight:400">(auto)</span>' : ""}<select data-sel="${escAttr(r)}">${["P2", "P3"].includes(r) && !cur ? `<option value="">${L("— elige —", "— choose —")}</option>` : ""}${opts.map((k, i) => opt(k, i, false)).join("")}${extra ? opt(extra, -1, true) : ""}</select></label>`;
    }).join("");
  }
  $("loadout").addEventListener("change", e => { const t = e.target.dataset.sel; if (t) { team.mainSel[t] = e.target.value; mainFixed = true; ui.starter = null; renderBuilder(); } });

  function renderSummonSel() {
    const mine = D.summons.filter(s => profile.summons.includes(s.s));
    const others = D.summons.filter(s => !profile.summons.includes(s.s));
    const opt = s => `<option value="${escAttr(s.s)}"${team.summon === s.s ? " selected" : ""}>${esc(s.n)}${s.tr.length ? " · " + s.tr.join("/") + " → " + (s.ca.join("/") || "—") : s.th ? " · " + s.th + " Combo" : ""}</option>`;
    $("summonSel").innerHTML = `<option value="">${L("Sin summon", "No summon")}</option>` +
      (mine.length ? `<optgroup label="${L("Mis summons", "My summons")}">${mine.map(opt).join("")}</optgroup>` : "") +
      `<optgroup label="${mine.length ? L("Resto", "Others") : L("Todos", "All")}">${others.map(opt).join("")}</optgroup>`;
    const optM = s => `<option value="${escAttr(s.s)}"${team.summonM === s.s ? " selected" : ""}>${esc(s.n)}</option>`;
    $("summonMSel").innerHTML = `<option value="">${L("Sin summon", "No summon")}</option>` +
      (mine.length ? `<optgroup label="${L("Mis summons", "My summons")}">${mine.map(optM).join("")}</optgroup>` : "") +
      `<optgroup label="${mine.length ? L("Resto", "Others") : L("Todos", "All")}">${others.map(optM).join("")}</optgroup>`;
  }
  $("summonSel").addEventListener("change", e => { team.summon = e.target.value; ui.starter = null; renderChain(); renderGaps(); });
  $("summonMSel").addEventListener("change", e => { team.summonM = e.target.value; });

  function unitPic(u) { return u.n.s && u.n.s.startsWith("s:") ? pic(u.n.s, u.n.n) : pic(u.n.s, u.n.n); }
  function renderChain() {
    const units = lineup();
    const st0 = starters(units);
    if (!units.length) {
      $("starters").innerHTML = `<tr><td colspan="4"><div class="empty">${L("Coloca ninjas en el tablero para ver qué cadenas pueden salir.", "Place ninjas on the board to see which chains can happen.")}</div></td></tr>`;
      $("chain").innerHTML = ""; $("endnote").hidden = true; $("chainSummary").textContent = ""; return;
    }
    const runs = st0.map(s => ({ s, r: simulate(units, s) }));
    runs.sort((a, b) => b.r.steps.length - a.r.steps.length || b.r.combo - a.r.combo);
    if (!runs.length) { $("starters").innerHTML = `<tr><td colspan="4" class="muted">${L("Ninguna unidad tiene mystery o standard.", "No unit has a mystery or standard.")}</td></tr>`; $("chain").innerHTML = ""; $("endnote").hidden = true; return; }
    const key = r => r.s.u.cell + ":" + r.s.k.id;
    if (!ui.starter || !runs.some(r => key(r) === ui.starter)) ui.starter = key(runs[0]);
    const best = runs[0];
    $("chainSummary").textContent = `${team.superArmor ? L("Modo Super Armor (solo chases por combo) · ", "Super Armor mode (combo chases only) · ") : ""}${L("Mejor inicio", "Best opener")}: ${best.s.u.n.n} (${best.s.k.t}) · ${best.r.steps.length - 1} chases`;
    $("starters").innerHTML = runs.map(r => `<tr data-start="${key(r)}" aria-selected="${key(r) === ui.starter}">
      <td><b>${esc(r.s.u.n.n)}</b><br><span class="muted">${r.s.k.t === "Mystery" ? "Mystery" : "Standard"} · ${esc(r.s.k.n)}</span></td>
      <td class="mono">${r.r.steps.length - 1}</td><td class="mono">${r.r.combo}</td>
      <td>${r.r.steps[r.r.steps.length - 1].causes.filter(s => MOVES.has(s)).map(st).join(" ") || '<span class="muted">—</span>'}</td></tr>`).join("");
    const sel = runs.find(r => key(r) === ui.starter);
    $("chain").innerHTML = sel.r.steps.map((s, i) => {
      const t = s.summon ? "Summon" : s.k.t;
      const face = s.summon ? pic("s:" + s.sm.s, s.sm.n) : pic(s.u.n.s, s.u.n.n);
      const who = s.summon ? s.sm.n : s.u.n.n;
      const moves = (s.causes || []).filter(x => MOVES.has(x));
      const other = (s.causes || []).filter(x => !MOVES.has(x) && !/combo/i.test(x));
      return `<li class="step"><span class="n">${i === 0 ? "▶" : i}</span>${face}
        <div class="what"><b>${esc(who)}</b><span class="sk"><span class="type" data-t="${escAttr(t)}">${t}</span> ${esc(s.k.n)}</span>
          <div class="flow">${i ? `${L("persigue", "chases")} ${st(s.via)} ` : ""}${moves.length ? L("→ causa ", "→ causes ") + moves.map(st).join(" ") : ""}${other.length ? ` <span class="muted">+ ${esc(other.slice(0, 4).join(", "))}</span>` : ""}</div></div>
        <span class="cb" title="${L("Combo acumulado", "Accumulated combo")}">${s.add ? "+" + s.add + " · " : ""}${s.combo} combo</span></li>`;
    }).join("");
    $("endnote").hidden = false;
    $("endnote").textContent = sel.r.end;
  }
  $("starters").addEventListener("click", e => { const r = e.target.closest("[data-start]"); if (r) { ui.starter = r.dataset.start; renderChain(); } });

  function renderGaps() {
    const units = lineup();
    if (!units.length) { $("gaps").innerHTML = `<div class="empty">${L("Cuando montes un equipo verás aquí qué estados quedan sin perseguir y qué ninjas tuyos lo arreglarían.", "Once you build a team you'll see here which statuses go unchased and which of your ninjas would fix it.")}</div>`; return; }
    const caused = new Map(), chased = new Map();
    units.forEach(u => u.skills.forEach(k => {
      (k.ca || []).filter(s => MOVES.has(s)).forEach(s => { if (!caused.has(s)) caused.set(s, []); caused.get(s).push(u.n.n); });
      (k.tr || []).forEach(s => { if (!chased.has(s)) chased.set(s, []); chased.get(s).push(u.n.n); });
    }));
    const sm = team.summon && SUM.get(team.summon);
    if (sm) sm.tr.forEach(s => { if (!chased.has(s)) chased.set(s, []); chased.get(s).push(sm.n + " (summon)"); });
    const inTeam = new Set(team.cells.filter(Boolean));
    const pool = D.ninjas.filter(n => !n.m && profile.owned[n.s] && !inTeam.has(n.s));
    const items = [];
    for (const s of D.moves) {
      const c = caused.get(s) || [], h = chased.get(s) || [];
      if (c.length && !h.length) {
        const fix = pool.filter(n => n.sk.some(k => (k.tr || []).includes(s))).slice(0, 6);
        const hasMain = units.some(u => u.n.m);
        const mainFix = hasMain ? [] : MAINS.map(m => { const k = m.sk.find(k => k.t === "Chase" && (k.tr || []).includes(s)); return k ? `<b>${esc(m.n)}</b> (${esc(k.n)})` : null; }).filter(Boolean);
        items.push(`<div class="gap-item bad"><div>${L(`${st(s)} lo causa ${esc([...new Set(c)].join(", "))}, pero nadie lo persigue.`, `${st(s)} is caused by ${esc([...new Set(c)].join(", "))}, but nobody chases it.`)}</div>
          <div class="muted">${fix.length ? L("Tuyos que lo persiguen: ", "Yours that chase it: ") + fix.map(n => `<b>${esc(n.n)}</b>`).join(", ") : pool.length ? L("Ninguno de tus ninjas lo persigue.", "None of your ninjas chases it.") : L("Marca tus ninjas en el perfil para ver sugerencias.", "Mark your ninjas in My roster to see suggestions.")}</div>
          ${mainFix.length ? `<div class="muted">${L("Mains con un chase que lo persigue", "Mains with a chase for it")}: ${mainFix.join(", ")}</div>` : ""}</div>`);
      } else if (h.length && !c.length) {
        const fix = pool.filter(n => n.sk.some(k => (k.t === "Mystery" || k.t === "Standard") && (k.ca || []).includes(s))).slice(0, 6);
        items.push(`<div class="gap-item"><div>${L(`${esc([...new Set(h)].join(", "))} persigue ${st(s)}, pero ningún mystery o standard del equipo lo causa. Solo saltará si otro chase lo deja.`, `${esc([...new Set(h)].join(", "))} chases ${st(s)}, but no mystery or standard in the team causes it. It only fires if another chase leaves it.`)}</div>
          ${fix.length ? `<div class="muted">${L("Tuyos que lo inician", "Yours that start it")}: ${fix.map(n => `<b>${esc(n.n)}</b>`).join(", ")}</div>` : ""}</div>`);
      }
    }
    // Colocación: columna = fila (0 trasera, 1 media, 2 delantera), fila del tablero = línea
    const rowName = EN ? ["back", "middle", "front"] : ["trasera", "media", "delantera"], laneName = EN ? ["top", "middle", "bottom"] : ["de arriba", "central", "de abajo"];
    units.filter(u => u.cell % 3 < 2).forEach(u => {
      const lane = Math.floor(u.cell / 3), row = u.cell % 3;
      const cover = units.find(o => Math.floor(o.cell / 3) === lane && o.cell % 3 > row);
      if (!cover) items.push(`<div class="gap-item bad"><div>${L(`<b>${esc(u.n.n)}</b> es la primera unidad de la línea ${laneName[lane]}: los ataques a «la unidad de delante» de esa línea le darán a él.`, `<b>${esc(u.n.n)}</b> is the first unit in the ${laneName[lane]} lane: attacks on «the front unit» of that lane will hit it.`)}</div><div class="muted">${L("Si es frágil, ponlo detrás de alguien resistente en su misma línea.", "If it's fragile, put it behind someone sturdy in the same lane.")}</div></div>`);
    });
    [0, 1].forEach(row => {
      const same = units.filter(u => u.cell % 3 === row);
      if (same.length > 1) items.push(`<div class="gap-item bad"><div>${L(`${same.map(u => `<b>${esc(u.n.n)}</b>`).join(" y ")} comparten la fila ${rowName[row]}: un ataque a esa fila los alcanza a la vez.`, `${same.map(u => `<b>${esc(u.n.n)}</b>`).join(" and ")} share the ${rowName[row]} row: an attack on that row hits them at once.`)}</div></div>`);
    });
    const els = [...new Set(units.map(u => u.n.e))].join(", ");
    items.push(`<div class="gap-item"><div>${L("Elementos en el equipo", "Elements in the team")}: ${esc(els)}. ${L("Chakra de los mysteries", "Mystery chakra")}: ${units.map(u => { const m = u.skills.find(k => k.t === "Mystery"); return m && m.ck ? `${esc(u.n.n.split(" [")[0])} ${m.ck}` : null; }).filter(Boolean).join(" · ") || "—"}.</div></div>`);
    $("gaps").innerHTML = items.join("");
  }

  function renderBuilder() {
    ensureMainSel();
    $("teamTitle").textContent = team.name || L("Equipo nuevo", "New team");
    renderBoard(); renderPicker(); renderLoadout(); renderSummonSel(); renderChain(); renderGaps();
    const w = teamWarnings(team.cells, true);
    $("builderWarn").hidden = !w.length;
    $("builderWarn").innerHTML = w.map(x => `<p>⚠ ${esc(x)}</p>`).join("");
  }

  // ---------------- guardar / cargar equipos
  $("saveTeam").addEventListener("click", async () => {
    if (!team.cells.some(Boolean)) { toast(L("Coloca al menos un ninja antes de guardar", "Place at least one ninja before saving")); return; }
    const name = $("teamName").value.trim() || L("Equipo sin nombre", "Unnamed team");
    const id = team.id || ("t" + Date.now().toString(36));
    team.superArmor = $("teamMode").value === "Nine-Tails";
    const body = { name, mode: $("teamMode").value, notes: $("teamNotes").value.trim(), cells: team.cells.map(s => s || ""),
      mainSel: { ...team.mainSel }, summon: team.summon || "", summonM: team.summonM || "", updatedAt: new Date().toISOString() };
    team.id = id; team.name = name;
    teams = { ...teams, [id]: body }; lsWrite(); renderSaved(); renderBuilder();
    if (db) {
      try { await db.collection("equipos").doc(id).set(body); toast(L("Equipo guardado", "Team saved")); }
      catch (e) { toast(e && e.code === "quota_exceeded" ? L("No queda espacio: borra algún equipo", "No space left: delete a team") : L("Guardado solo ", "Saved only ") + HERE); }
    } else toast(L("Equipo guardado ", "Team saved ") + HERE);
  });
  $("teamMode").addEventListener("change", () => { team.superArmor = $("teamMode").value === "Nine-Tails"; ui.starter = null; renderChain(); });
  $("newTeam").addEventListener("click", () => {
    Object.assign(team, { id: null, cells: Array(9).fill(null), mainSel: {}, summon: "", summonM: "", name: "", superArmor: false }); mainFixed = false;
    $("teamName").value = ""; $("teamNotes").value = ""; ui.starter = null; renderBuilder();
  });
  function loadTeam(id) {
    const t = teams[id]; if (!t) return;
    Object.assign(team, { id, cells: (t.cells || []).map(s => s && BY.has(s) ? s : null).concat(Array(9).fill(null)).slice(0, 9),
      mainSel: { ...(t.mainSel || {}) }, summon: t.summon || "", summonM: t.summonM || "", name: t.name || "", mode: t.mode, notes: t.notes || "", superArmor: t.mode === "Nine-Tails" });
    mainFixed = Object.keys(team.mainSel).length > 0;
    $("teamName").value = team.name; $("teamMode").value = t.mode || "Arena"; $("teamNotes").value = team.notes;
    ui.starter = null; setTab("creador");
  }
  let pendingDelete = null;
  function renderSaved() {
    const ids = Object.keys(teams).sort((a, b) => String(teams[b].updatedAt).localeCompare(String(teams[a].updatedAt)));
    $("cntTeams").textContent = ids.length;
    if (!ids.length) { $("saved").innerHTML = `<div class="empty" style="grid-column:1/-1">${L("Todavía no hay equipos guardados. Monta uno en «Creador de equipos» y pulsa «Guardar equipo».", "No saved teams yet. Build one in «Team builder» and press «Save team».")}</div>`; return; }
    $("saved").innerHTML = ids.map(id => {
      const t = teams[id];
      const members = (t.cells || []).map((s, i) => s && BY.get(s) ? { n: BY.get(s), rank: RANK[i] } : null).filter(Boolean).sort((a, b) => a.rank - b.rank);
      const sm = t.summon && SUM.get(t.summon);
      return `<article class="panel team-card">
        <div class="row" style="justify-content:space-between"><h3>${esc(t.name)}</h3><span class="chip">${esc(t.mode || "")}</span></div>
        <div class="faces">${members.map(m => pic(m.n.s, m.n.n)).join("")}${sm ? pic("s:" + sm.s, sm.n) : ""}</div>
        <div class="note">${members.map(m => esc(m.n.n)).join(" · ")}${sm ? " · " + esc(sm.n) : ""}</div>
        ${t.notes ? `<div style="font-size:.85rem">${esc(t.notes)}</div>` : ""}
        <div class="row">
          <button class="btn small primary" data-load="${escAttr(id)}">${L("Abrir", "Open")}</button>
          ${pendingDelete === id
            ? `<span class="confirm">${L("¿Borrar?", "Delete?")} <button class="btn small danger" data-del-yes="${escAttr(id)}">${L("Sí, borrar", "Yes, delete")}</button><button class="btn small" data-del-no>No</button></span>`
            : `<button class="btn small danger" data-del="${escAttr(id)}">${L("Borrar", "Delete")}</button>`}
        </div></article>`;
    }).join("");
  }
  $("saved").addEventListener("click", async e => {
    const l = e.target.closest("[data-load]"); if (l) return loadTeam(l.dataset.load);
    const d = e.target.closest("[data-del]"); if (d) { pendingDelete = d.dataset.del; return renderSaved(); }
    if (e.target.closest("[data-del-no]")) { pendingDelete = null; return renderSaved(); }
    const y = e.target.closest("[data-del-yes]");
    if (y) {
      const id = y.dataset.delYes; pendingDelete = null;
      const { [id]: _, ...rest } = teams; teams = rest; lsWrite(); renderSaved();
      if (team.id === id) team.id = null;
      if (db) { try { await db.collection("equipos").doc(id).delete(); } catch {} }
      toast(L("Equipo borrado", "Team deleted"));
    }
  });

  // ---------------- EQUIPOS RECOMENDADOS POR MODO (con alternativas y registro de intentos)
  let customAlts = {};   // id -> {mode, label, cells, mainSel, summon, notes}
  let walls = {};        // Ninja Exam: id -> {floor, what, fix, passed, at}
  let tries = {};        // id -> {mode, alt, kind, damage, result, rival, fallen:[slug], notes, at}
  // Los intentos guardan el nombre que tenía el equipo ese día: los antiguos pueden decir «plantilla de la guía».
  function fixTries(t) { Object.values(t || {}).forEach(x => { if (x && typeof x.altLabel === "string") x.altLabel = x.altLabel.replace(/plantilla de la gu[ií]a/gi, m => m[0] === "P" ? "Plantilla de referencia" : "plantilla de referencia"); }); return t; }
  const modeOf = k => MODES.find(m => m.k === k) || IDEAL.find(m => m.k === k);
  // ---- «Con tus ninjas» en la app (Naruto Online Companion): no hay equipos escritos para cada jugador, así que se parte
  // de los equipos de referencia de Equipos ideales (lo más repetido del top, Infinite Illusion, Nine-Tails, Ninja Exam) y se
  // adaptan a su roster: en Infinite Illusion y Nine-Tails, si le falta un ninja y hay una alternativa que tiene
  // (sin repetir personaje), se cambia y se dice. Orden: primero los que puede montar ya; luego los que tienen menos ninjas por conseguir y más confianza.
  // El id sale de los ninjas del equipo (estable entre versiones), así sus intentos no se pierden si cambia el orden.
  const IDEAL_OF = { ar: "i-ar", rk: "i-ar", s1: "i-s1", s2: "i-s2", s3: "i-s3", n9: "i-n9", ne: "i-ne" };
  const hashId = str => { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return "g" + h.toString(36); };
  let engMemo = { sig: "", out: {} };
  function engineAlts(m) {
    const src = IDEAL.find(x => x.k === IDEAL_OF[m.k]); if (!src) return [];
    const sig = Object.keys(profile.owned).sort().join(",");
    if (engMemo.sig !== sig) engMemo = { sig, out: {} };
    if (engMemo.out[m.k]) return engMemo.out[m.k];
    const has = s => !!((BY.get(s) || {}).m || profile.owned[s]);
    // alternativas por papel de II_TOP para ESA prueba (y las de «Escaladores para cualquier prueba»)
    const stageKey = { s1: "S1", s2: "S2", s3: "S3", n9: "Nine-Tails" }[m.k];
    const altMap = new Map();
    II_TOP.filter(st => stageKey && (st.k.startsWith(stageKey) || st.k.startsWith("Escaladores"))).forEach(st => st.teams.forEach(t => t.core.forEach(([x, , alts]) => (alts || []).forEach(a => { if (!altMap.has(x)) altMap.set(x, []); if (!altMap.get(x).includes(a)) altMap.get(x).push(a); }))));
    const confRk = c => /^Alta/.test(c) ? 0 : /^Media/.test(c) ? 1 : 2;
    const seen = new Set(), out = [];
    src.alts.forEach((a, i) => {
      const subs = [];
      const cells = (a.cells || []).slice();
      cells.forEach((x, k) => {
        if (!x || has(x) || m.kind !== "pve") return;  // las alternativas de II_TOP son para PvE, no para Arena
        const chars = new Set(cells.filter(y => y && y !== x).map(y => charOf(BY.get(y) || { n: y })));
        const c = (altMap.get(x) || []).find(y => has(y) && !cells.includes(y) && !chars.has(charOf(BY.get(y) || { n: y })));
        if (c) { subs.push([x, c]); cells[k] = c; }
      });
      const id = hashId(m.k + ":" + cells.filter(Boolean).slice().sort().join("+"));
      if (seen.has(id)) return; seen.add(id);
      const miss = cells.filter(x => x && !has(x));
      const nm = x => (BY.get(x) || { n: x }).n;
      out.push({ ...a, id, cells, miss, subs, gen: true, order: i,
        label: subs.length ? cells.filter(x => x && !(BY.get(x) || {}).m).map(x => nm(x).replace(/^(\S+) \S+ \[/, "$1 [").replace(/ \[The /, " [")).join(" + ") : altShort(a.label).replace(/\s*·\s*con tus ninjas$/, ""),
        why: [...subs.map(([x, y]) => L(`${nm(y)} en lugar de ${nm(x)}: es una alternativa para ese papel y la tienes. Rinde algo menos que el original.`, `${nm(y)} instead of ${nm(x)}: it's an alternative for that role and you own it. It performs a bit worse than the original.`)), ...(a.why || [])],
        conf: [a.conf[0], a.conf[1]] });
    });
    out.sort((x, y) => (x.miss.length - y.miss.length) || (confRk(x.conf[0]) - confRk(y.conf[0])) || (x.order - y.order));
    return (engMemo.out[m.k] = out);
  }
  // ---- App (pensada para cualquier usuario): además de los equipos de referencia, los equipos del top que coinciden
  // y equipos montados solo con los ninjas del usuario. Nada sale de los equipos personales de MODES.
  const isMainS = s => !!(BY.get(s) || {}).m;
  const teamLabel = cells => cells.filter(x => x && !isMainS(x)).map(x => (BY.get(x) || { n: x }).n.replace(/^(\S+) \S+ \[/, "$1 [").replace(/ \[The /, " [")).join(" + ");
  const memKey = cells => cells.filter(x => x && !isMainS(x)).slice().sort().join("+");
  const p1Of = s => { const u = (NINJA_USO.by || {})[s] || {}; return Math.max((u.kh || {}).p1 || 0, (u.nx || {}).p1 || 0); };
  // Colocación estimada: el que más actúa primero en el top delante en el orden, el main al final; cada uno en la
  // casilla donde más lo pone el Top 100 de KonohaHub (KH_POS), sin cambiar ese orden de actuación.
  function autoCells(members, ordered) {
    const order = ordered ? members.slice() : members.slice().sort((a, b) => (isMainS(a) - isMainS(b)) || (p1Of(b) - p1Of(a)));
    const P = typeof KH_POS !== "undefined" ? KH_POS : null;
    const cnt = s => (P && (P.pos[isMainS(s) ? "main" : s] || P.pool)) || Array(9).fill(1);
    const lp = (s, i) => { const c = cnt(s); return Math.log((c[i] + 0.5) / (c.reduce((a, b) => a + b, 0) + 4.5)); };
    let best = null;
    const rec = (start, pick) => {
      if (pick.length === order.length) { const cs = pick.slice().sort((a, b) => RANK[a] - RANK[b]); const sc = order.reduce((v, x, j) => v + lp(x, cs[j]), 0); if (!best || sc > best[0]) best = [sc, cs]; return; }
      for (let i = start; i < 9; i++) rec(i + 1, [...pick, i]);
    };
    rec(0, []);
    const cells = Array(9).fill(""); order.forEach((s, j) => { cells[best[1][j]] = s; });
    return cells;
  }
  const autoPos = () => L("Estimada: cada ninja va donde más lo pone el Top 100 de KonohaHub, y actúa antes el que más suele abrir en el top.", "Estimated: each ninja goes where KonohaHub's Top 100 places it most, and the one that most often opens in the top acts first.");
  const cpM = v => Number(v).toLocaleString(EN ? "en-GB" : "es-ES", { maximumFractionDigits: 1 });
  const dShort = d => new Date(d + "T12:00:00").toLocaleDateString(EN ? "en-GB" : "es-ES", { day: "numeric", month: "short", year: "numeric" });
  // Equipos más repetidos del top de arena (KonohaHub EN y BR, Nexus y servidores nuevos), juntando los que solo cambian el main.
  // Formaciones reales de Nexus (NX_FORMS, top-10 de cada servidor) y poder del usuario (en millones; null si no lo ha puesto).
  // «Cerca» = cuentas con un poder parecido: hasta el triple del tuyo (mínimo 2M); sin poder apuntado, las de menos de 4M.
  const NXF = () => (typeof NX_FORMS !== "undefined" && NX_FORMS.forms) || [];
  const powerM = () => +profile.power > 0 ? +profile.power / 1e6 : null;
  const nearForm = f => { const P = powerM(); return P ? f.lo <= Math.max(2, P * 3) : f.cp < 4; };
  // Con quién va cada ninja en las formaciones de cuentas como la tuya.
  function nearMates(c) { const o = {}; NXF().filter(f => f.m.includes(c) && nearForm(f)).forEach(f => f.m.forEach(s => { if (s !== c && !isMainS(s)) o[s] = (o[s] || 0) + f.n; })); return o; }
  const topMemo = { sig: "", out: {} };
  function topAlts(m) {
    const sig = rosterSig();
    if (topMemo.sig !== sig) { topMemo.sig = sig; topMemo.out = {}; }
    return topMemo.out[m.k] || (topMemo.out[m.k] = topAltsCalc(m));
  }
  function topAltsCalc(m) {
    if (m.kind !== "pvp") return [];
    const has = s => isMainS(s) || !!profile.owned[s];
    const lastD = ds => ds.map(([, d]) => d).sort().slice(-1)[0];
    const src = [
      ...KH_USAGE.en.teams.map(t => ({ ...t, w: "en", txt: L(`KonohaHub, top EN (${dShort(lastD(KH_USAGE.en.dates))}): ${t.n} formaciones.`, `KonohaHub, EN top (${dShort(lastD(KH_USAGE.en.dates))}): ${t.n} formations.`) })),
      ...META_DATA.teams.map(t => ({ ...t, w: "nx", txt: L(`Nexus (meta del ${dShort(META_DATA.meta_date)}): ${t.n} formaciones del top-10 de cada servidor, ${cpM(t.cp)}M de poder medio.`, `Nexus (meta of ${dShort(META_DATA.meta_date)}): ${t.n} formations from each server's top 10, ${cpM(t.cp)}M average power.`) })),
      ...KH_USAGE.br.teams.map(t => ({ ...t, w: "br", txt: L(`KonohaHub, top BR (${dShort(lastD(KH_USAGE.br.dates))}): ${t.n} formaciones.`, `KonohaHub, BR top (${dShort(lastD(KH_USAGE.br.dates))}): ${t.n} formations.`) })),
      ...META_DATA.lowTeams.map(t => ({ ...t, w: "low", txt: L(`Nexus, servidores nuevos: ${t.n} formaciones, ${cpM(t.cp)}M de poder medio.`, `Nexus, new servers: ${t.n} formations, ${cpM(t.cp)}M average power.`) }))];
    const by = new Map();
    // Todas las formaciones reales de Nexus que puedes montar o a las que solo les falta uno (no solo las más repetidas),
    // primero las de cuentas con un poder parecido al tuyo. Como mucho 24, para no inundar la lista.
    const known = new Set(src.map(t => memKey(t.m)));
    const nmiss = f => f.m.filter(x => !has(x)).length;
    // la misma formación con otro main cuenta como una (se suman jugadores y se promedia el poder)
    const agg = new Map(); NXF().forEach(f => { const k = memKey(f.m), a = agg.get(k);
      if (a) { a.cp = (a.cp * a.n + f.cp * f.n) / (a.n + f.n); a.n += f.n; a.lo = Math.min(a.lo, f.lo); } else agg.set(k, { ...f }); });
    // fuera solo las que repiten personaje (Madara [Five Kage Summit] cuenta como Obito). Los regalados
    // (Hashirama [New Year], Madara [Edo Tensei]…) se quedan: son justo los que tiene una cuenta f2p.
    const okNx = f => (ns => new Set(ns.map(s => charOf(BY.get(s) || { n: s }))).size === ns.length)(f.m.filter(s => !isMainS(s)));
    [...agg.values()].filter(f => !known.has(memKey(f.m)) && nmiss(f) <= 1 && okNx(f))
      .sort((a, b) => nmiss(a) - nmiss(b) || (nearForm(b) - nearForm(a)) || b.n - a.n || a.cp - b.cp).slice(0, 24)
      .forEach(f => src.push({ m: f.m, n: f.n, cp: f.cp, w: "nxall", near: nearForm(f),
        txt: f.n > 1 ? L(`Nexus (meta del ${dShort(META_DATA.meta_date)}): la llevan ${f.n} jugadores del top-10 de su servidor, ${cpM(f.cp)}M de poder medio.`, `Nexus (meta of ${dShort(META_DATA.meta_date)}): ${f.n} players in their server's top 10 use it, ${cpM(f.cp)}M average power.`)
          : L(`Nexus (meta del ${dShort(META_DATA.meta_date)}): la lleva un jugador del top-10 de su servidor, con ${cpM(f.cp)}M de poder.`, `Nexus (meta of ${dShort(META_DATA.meta_date)}): a player in their server's top 10 uses it, at ${cpM(f.cp)}M power.`) }));
    src.forEach(t => { const k = memKey(t.m); const cur = by.get(k); if (cur) { cur.ev.push(t.txt); cur.n += t.w === "low" ? 0 : t.n; if (!cur.mains.includes(t.m.find(isMainS))) cur.mains.push(t.m.find(isMainS)); } else by.set(k, { t, ev: [t.txt], n: t.w === "low" ? 0 : t.n, low: t.w === "low", mains: [t.m.find(isMainS)] }); });
    const CONF_V = { Alta: 3, Media: 2, Baja: 1 };
    return [...by.values()].map(({ t, ev, n, low, mains }) => {
      const cells = autoCells(t.m.filter(Boolean)), miss = cells.filter(x => x && !has(x));
      // si lo puedes montar, la app le pone las habilidades del main y tu mejor summon
      const mainSel = miss.length ? {} : bestMainSel(cells, m), summon = miss.length ? "" : pickSummon(cells, m);
      const other = mains.filter(x => x && x !== t.m.find(isMainS)).map(x => BY.get(x).n);
      return { id: hashId(m.k + ":" + t.m.slice().sort().join("+")), label: teamLabel(t.m.slice().sort((a, b) => p1Of(b) - p1Of(a))), cells, mainSel, summon, top: true, low, n,
        miss, pos: autoPos(), posSrc: "est",
        conf: t.w === "nxall" ? [t.n >= 2 || t.near ? "Media" : "Baja", L("Formación real del top de arena. ", "A real formation from the arena top. ") + ev.join(" ")]
          : [n >= 10 ? "Alta" : "Media", L("Equipo repetido en el top de arena. ", "A team repeated in the arena top. ") + ev.join(" ")],
        near: !!t.near,
        why: [...(low ? [L("Se ve en servidores nuevos, con poco poder: buen objetivo para una cuenta que empieza.", "Seen on new servers with low power: a good target for a new account.")] : []),
          ...(t.w === "nxall" && t.near ? [powerM() ? L("La juegan cuentas con un poder parecido al tuyo.", "Accounts with power similar to yours play it.") : L("La juegan cuentas con poco poder (servidores nuevos).", "Low-power accounts (new servers) play it.")] : []),
          ...(other.length ? [L(`También se juega con main ${other.join(" o ")}.`, `Also played with ${other.join(" or ")} as main.`)] : []),
          ...(miss.length ? [] : [summonWhy(summon, m)])] };
    }).sort((a, b) => a.miss.length - b.miss.length || (CONF_V[b.conf[0]] - CONF_V[a.conf[0]]) || (b.near - a.near) || (b.n || 0) - (a.n || 0));
  }
  // Equipos montados solo con tus ninjas (deducción): tus mejores carries de la tier list y, para cada uno, los ninjas
  // tuyos que más lo acompañan en el top (Nexus y KonohaHub) o, si no, tus mejores soportes. Sin repetir personaje y con una sola barrera.
  // Chases de la ronda 1 con el simulador del creador (el mejor arranque posible).
  const chainLen = (cells, mainSel, m, summon = "") => { const tt = { cells, mainSel, summon, superArmor: !!m.superArmor }; const u = lineup(tt);
    return Math.max(0, ...starters(u).map(s0 => simulate(u, s0, tt).steps.length - 1)); };
  // Habilidades del main que dan la cadena más larga (como ensureMainSel del creador, sin tocar el equipo del creador).
  function bestMainSel(cells, m) {
    const mn = cells.map(s => s && BY.get(s)).find(n => n && n.m); if (!mn) return {};
    const opt = t => { const l = mn.sk.filter(k => k.t === t && !isUlt(k)); return l.length ? l : [null]; };
    let best = null;
    for (const my of opt("Mystery")) for (const sd of opt("Standard")) for (const ch of opt("Chase")) {
      const sel = { Mystery: my && my.id, Standard: sd && sd.id, Chase: ch && ch.id }; const v = chainLen(cells, sel, m);
      if (!best || v > best.v) best = { v, sel };
    }
    return best.sel;
  }
  // Summon (punto 2): de los que tiene el usuario, el que más alarga la cadena; a igualdad, el de mejor valoración
  // (SUMMONS: pvp/pve). Devuelve "" si no tiene ninguno marcado.
  const SUM_RK = { S: 4, A: 3, B: 2, C: 1 };
  function pickSummon(cells, m) {
    const own = (profile.summons || []).filter(s => SUM.has(s)); if (!own.length) return "";
    const rate = s => SUM_RK[((SUMMONS || []).find(x => x.s === s) || {})[m.kind === "pvp" ? "pvp" : "pve"]] || 0;
    const sel = bestMainSel(cells, m);
    return own.map(s => ({ s, v: chainLen(cells, sel, m, s) * 2 + rate(s) })).sort((a, b) => b.v - a.v)[0].s;
  }
  const summonWhy = (s, m) => s ? L(`Summon ${SUM.get(s).n}: de los tuyos, el que más alarga la cadena${((SUMMONS || []).find(x => x.s === s) || {})[m.kind === "pvp" ? "pvp" : "pve"] ? " (valoración " + ((SUMMONS || []).find(x => x.s === s) || {})[m.kind === "pvp" ? "pvp" : "pve"] + ")" : ""}.`, `${SUM.get(s).n} as summon: of yours, the one that extends the chain most${((SUMMONS || []).find(x => x.s === s) || {})[m.kind === "pvp" ? "pvp" : "pve"] ? " (rated " + ((SUMMONS || []).find(x => x.s === s) || {})[m.kind === "pvp" ? "pvp" : "pve"] + ")" : ""}.`)
    : L("Sin summon: marca los tuyos en Mi roster y la app elegirá uno.", "No summon: mark yours in My roster and the app will pick one.");
  // Valor de un ninja tuyo para un papel (carry/sup/ii): la nota de la tier list o, si no está en ella (cuentas que
  // empiezan), un plan B por rareza y estrellas, siempre por debajo de cualquier ninja de la tier list. Para carry, solo
  // los de daño.
  const RAR_V = { S: 1.2, A: 0.8, B: 0.5, C: 0.2 };
  function nScore(s, k) {
    const r = (TIER[k] || []).find(x => x.s === s); if (r) return r.sc || 0;
    const n = BY.get(s) || {}; if (k === "carry" && n.ro !== "Damage") return 0;
    return (RAR_V[n.r] || 0.3) + ((profile.owned[s] || {}).st || 0) * 0.1;
  }
  const inTier = (k, s) => (TIER[k] || []).some(x => x.s === s);
  const builtMemo = { sig: "", out: {} };
  function builtAlts(m) {
    const sig = rosterSig();
    if (builtMemo.sig !== sig) { builtMemo.sig = sig; builtMemo.out = {}; }
    return builtMemo.out[m.k] || (builtMemo.out[m.k] = builtAltsCalc(m));
  }
  // Huella del roster para no recalcular de más: ninjas con sus estrellas y BT, los que no se usan y summons. Si cualquiera
  // cambia, los equipos montados, los del top y el trío se rehacen.
  const rosterSig = () => Object.keys(profile.owned).sort().map(s => s + ":" + (profile.owned[s].st || 0) + (profile.owned[s].bt ? "b" : "")).join(",") + "|" + (profile.excl || []).join(",") + "|" + (profile.summons || []).join(",") + "|" + (profile.power || 0) + "|" + (profile.spend || "");
  function builtAltsCalc(m) {
    const pvp = m.kind === "pvp";
    const mine = Object.keys(profile.owned).filter(s => inPool(s) && BY.get(s) && !isMainS(s));
    const tr = (k, s) => (TIER[k] || []).find(r => r.s === s);
    const sc = (k, s) => (tr(k, s) || {}).sc || 0;
    const ck = pvp ? "carry" : "ii";
    // En II y Nine-Tails pesa más lo que II_TOP da para ESA prueba (o para cualquier prueba)
    const stage = { s1: "S1", s2: "S2", s3: "S3", n9: "Nine-Tails" }[m.k];
    const tag = (s, re) => !!stage && ((tr("ii", s) || {}).why || []).some(w => new RegExp(`^(${stage}|Escaladores para cualquier prueba): (${re})`).test(w));
    const cSc = s => (inTier(ck, s) || (BY.get(s) || {}).ro === "Damage" ? nScore(s, ck) : 0) + (tag(s, "carry") ? 2 : 0);
    const carries = mine.filter(s => cSc(s) > 0).sort((a, b) => cSc(b) - cSc(a)).slice(0, 3);
    const out = [];
    carries.forEach(c => {
      const u = NINJA_USO.by[c] || {}, mates = {}, mains = {};
      [u.nx, u.kh].forEach(x => { ((x || {}).mates || []).forEach(([y, k]) => { mates[y] = (mates[y] || 0) + k; }); ((x || {}).mains || []).forEach(([y, k]) => { mains[y] = (mains[y] || 0) + k; }); });
      // y con quién va en cuentas de tu poder (formaciones reales de Nexus): cuenta doble
      const near = nearMates(c); Object.entries(near).forEach(([y, k]) => { mates[y] = (mates[y] || 0) + 2 * k; });
      const score = s => (mates[s] ? 3 + Math.log10(1 + mates[s]) : 0) + (pvp ? nScore(s, "sup") : nScore(s, "ii") + sc("sup", s) * 0.3 + (tag(s, "apoyo|alternativa") ? 1.5 : 0));
      const main = Object.entries(mains).sort((a, b) => b[1] - a[1]).map(([x]) => x).find(x => BY.get(x)) || "scarlet-blaze";
      // candidatos: los 6 que mejor puntúan con este carry; de cada pareja válida se simula la cadena de chases de la ronda 1
      const cn = BY.get(c), cand = mine.filter(s => s !== c && score(s) > 0 && charOf(BY.get(s)) !== charOf(cn)).sort((a, b) => score(b) - score(a)).slice(0, 6);
      let best = null;
      cand.forEach((a, i) => cand.slice(i + 1).forEach(b => {
        const na = BY.get(a), nb = BY.get(b);
        if (charOf(na) === charOf(nb) || [cn, na, nb].filter(hasBarrier).length > 1) return;
        const ord = [c, ...[a, b].sort((x, y) => p1Of(y) - p1Of(x)), main], cells = autoCells(ord, true);
        const v = score(a) + score(b) + 1.5 * chainLen(cells, {}, m);
        if (!best || v > best.v) best = { v, team: [c, a, b], cells };
      }));
      if (!best) return;
      const team = best.team, cells = best.cells, mainSel = bestMainSel(cells, m), summon = pickSummon(cells, m);
      const CAT = { carry: L("Carry PvP", "PvP carry"), sup: L("Soporte PvP", "PvP support"), ii: "Infinite Illusion" };
      const nm = s => BY.get(s).n, tierTxt = (k, s) => { const r = tr(k, s); return r ? `${r.t} · ${CAT[k]}` : ""; };
      out.push({ id: hashId(m.k + ":b:" + team.slice().sort().join("+")), label: teamLabel(team), cells, mainSel, summon, built: true, miss: [],
        pos: autoPos(), posSrc: "est",
        conf: ["Baja", L("Deducción mía con tus ninjas: nadie ha registrado este equipo exacto. Pruébalo y anota el resultado.", "My deduction from your ninjas: nobody has logged this exact team. Try it and log the result.")],
        why: [inTier(ck, c) ? L(`${nm(c)}: de tus mejores carries para este modo en la tier list (${tierTxt(ck, c)})${tag(c, "carry") ? "; es un carry habitual en esta prueba" : ""}.`, `${nm(c)}: one of your best carries for this mode in the tier list (${tierTxt(ck, c)})${tag(c, "carry") ? "; it's a usual carry for this trial" : ""}.`)
            : L(`${nm(c)}: aún no tienes carries de la tier list para este modo, así que va de carry tu ninja de daño de más rareza y estrellas. Es un equipo para empezar: mira «Qué conseguir» en Inicio.`, `${nm(c)}: you don't have tier-list carries for this mode yet, so your highest-rarity, highest-star damage ninja carries. It's a starter team: see «What to get» on Home.`),
          ...team.slice(1).map(s => near[s] ? L(`${nm(s)}: va con ${nm(c).split(" [")[0]} en ${near[s]} formaci${near[s] > 1 ? "ones" : "ón"} de cuentas con un poder como el tuyo (Nexus).`, `${nm(s)}: plays with ${nm(c).split(" [")[0]} in ${near[s]} formation${near[s] > 1 ? "s" : ""} of accounts with power like yours (Nexus).`)
            : mates[s] ? L(`${nm(s)}: va con ${nm(c).split(" [")[0]} en ${mates[s]} formaci${mates[s] > 1 ? "ones" : "ón"} top (Nexus y KonohaHub).`, `${nm(s)}: plays with ${nm(c).split(" [")[0]} in ${mates[s]} top formation${mates[s] > 1 ? "s" : ""} (Nexus and KonohaHub).`)
            : tierTxt(pvp ? "sup" : "ii", s) ? L(`${nm(s)}: de tus mejores soportes en la tier list (${tierTxt(pvp ? "sup" : "ii", s)}).`, `${nm(s)}: one of your best supports in the tier list (${tierTxt(pvp ? "sup" : "ii", s)}).`)
            : L(`${nm(s)}: de tus ninjas con más rareza y estrellas (no está en la tier list).`, `${nm(s)}: one of your highest-rarity, highest-star ninjas (not in the tier list).`)),
          mains[main] ? L(`Main ${nm(main)}: el que más lleva ${nm(c).split(" [")[0]} en el top.`, `${nm(main)} as main: the one ${nm(c).split(" [")[0]} uses most in the top.`) : L(`Main ${nm(main)}: no hay datos del top para este carry; cámbialo si prefieres otro.`, `${nm(main)} as main: no top data for this carry; change it if you prefer another.`), summonWhy(summon, m)] });
    });
    return out;
  }
  // Ranked (punto 1): una propuesta de 3 equipos que van juntos. Reglas (ficha del modo, confirmadas): el main va en
  // uno solo; los otros dos llevan 4 ninjas; cada personaje una sola vez en toda la formación (tampoco otra versión);
  // solo queda una barrera en el campo (aquí, como mucho un ninja con barrera); un solo summon para toda la formación.
  // El equipo con main sale de los que ya puedes montar (referencia, top, montados o tuyos); los otros dos se montan con
  // lo que queda: tu mejor carry de PvP y los 3 compañeros que mejor puntúan (top y tier list), simulando la cadena.
  const trioMemo = { sig: "", out: null };
  function rankedTrio(m, mainCands) {
    const sig = rosterSig() + "|" + Object.keys(customAlts).join(",");
    if (trioMemo.sig === sig) return trioMemo.out;
    trioMemo.sig = sig; return (trioMemo.out = rankedTrioCalc(m, mainCands));
  }
  function rankedTrioCalc(m, mainCands) {
    const mine = Object.keys(profile.owned).filter(s => inPool(s) && BY.get(s) && !isMainS(s));
    const sc = (k, s) => ((TIER[k] || []).find(r => r.s === s) || {}).sc || 0;
    const matesOf = c => { const u = NINJA_USO.by[c] || {}, o = {}; [u.nx, u.kh].forEach(x => ((x || {}).mates || []).forEach(([y, k]) => { o[y] = (o[y] || 0) + k; })); return o; };
    const confV = a => ({ Alta: 3, Media: 2, Baja: 1 })[(a.conf || [])[0]] || 2;
    const ninjasOf = a => (a.cells || []).filter(x => x && !isMainS(x));
    // Un equipo de 4 sin main con lo que queda (sin personajes usados y respetando la barrera que ya haya).
    let maxBar = 1;
    function side(usedChars, barUsed) {
      const free = mine.filter(s => !usedChars.has(charOf(BY.get(s))));
      if (free.length < 4) return null;
      let best = null;
      free.filter(s => nScore(s, "carry") > 0).sort((a, b) => nScore(b, "carry") - nScore(a, "carry")).slice(0, 3).forEach(c => {
        const mc = matesOf(c), cn = BY.get(c);
        const score = s => (mc[s] ? 3 + Math.log10(1 + mc[s]) : 0) + nScore(s, "sup") + sc("carry", s) * 0.3;
        const cand = free.filter(s => s !== c && charOf(BY.get(s)) !== charOf(cn)).sort((a, b) => score(b) - score(a)).slice(0, 7);
        for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) for (let k = j + 1; k < cand.length; k++) {
          const ps = [cand[i], cand[j], cand[k]], ns = [cn, ...ps.map(s => BY.get(s))];
          if (new Set(ns.map(charOf)).size < 4) continue;
          const bars = ns.filter(hasBarrier).length; if (bars + barUsed > maxBar) continue;
          const cells = autoCells([c, ...ps.sort((x, y) => p1Of(y) - p1Of(x))], true);
          const v = nScore(c, "carry") + ps.reduce((a, s) => a + score(s), 0) + 1.5 * chainLen(cells, {}, m);
          if (!best || v > best.v) best = { v, team: [c, ...ps], cells, mates: mc, bars };
        }
      });
      return best;
    }
    let best = null;
    // primero con una sola barrera en toda la formación; si con tus ninjas no sale, se permite alguna más (y se avisa)
    for (; maxBar <= 3 && !best; maxBar++) mainCands.filter(a => !(a.miss || []).length && (a.cells || []).some(isMainS) && ninjasOf(a).every(inPool))
      .map(a => ({ a, v: confV(a) + chainLen(a.cells, a.mainSel || {}, m) })).sort((x, y) => y.v - x.v).slice(0, 4).forEach(({ a, v }) => {
        const ns = ninjasOf(a).map(s => BY.get(s)).filter(Boolean);
        if (new Set(ns.map(charOf)).size < ns.length) return;
        const used = new Set(ns.map(charOf)); let bar = ns.filter(hasBarrier).length; if (bar > maxBar) return;
        const s2 = side(used, bar); if (!s2) return;
        s2.team.forEach(s => used.add(charOf(BY.get(s)))); bar += s2.bars;
        const s3 = side(used, bar); if (!s3) return;
        const tot = v * 2 + s2.v + s3.v;
        if (!best || tot > best.tot) best = { tot, a, s2, s3, bar };
      });
    if (!best) return [];
    const barNote = best.bar > 1 ? [L(`Ojo: lleva ${best.bar} ninjas con barrera entre los tres equipos y solo queda una en el campo (la última que se lanza). Con tus ninjas no sale una formación con una sola; mira qué barrera te conviene que quede.`, `Careful: there are ${best.bar} ninjas with a barrier across the three teams and only one stays on the field (the last one cast). Your ninjas can't make a formation with just one; check which barrier you want to keep.`)] : [];
    const nm = s => BY.get(s).n, summon = best.a.summon && (profile.summons || []).includes(best.a.summon) ? best.a.summon : pickSummon(best.a.cells, m);
    const rule = L("Los tres van juntos: cada personaje una sola vez, el main en uno solo, una sola barrera en el campo y un solo summon para toda la formación.", "The three go together: each character only once, the main in one team only, a single barrier on the field and one summon for the whole formation.");
    const sideAlt = (s, i) => ({ id: hashId("rk:trio:" + s.team.slice().sort().join("+")), trio: i, built: true, label: L(`Ranked ${i} · `, `Ranked ${i} · `) + teamLabel(s.team), cells: s.cells, mainSel: {}, summon: "", miss: [],
      pos: autoPos(), posSrc: "est", conf: ["Baja", L("Deducción mía para Ranked con lo que te queda tras los otros equipos. ", "My Ranked deduction with what you have left after the other teams. ") + rule],
      why: [inTier("carry", s.team[0]) ? L(`${nm(s.team[0])}: de tus mejores carries de PvP que no van en los otros equipos.`, `${nm(s.team[0])}: one of your best PvP carries not used in the other teams.`) : L(`${nm(s.team[0])}: de carry, tu ninja de daño de más rareza y estrellas que queda libre.`, `${nm(s.team[0])}: as carry, your highest-rarity, highest-star damage ninja left.`),
        ...s.team.slice(1).map(x => s.mates[x] ? L(`${nm(x)}: va con ${nm(s.team[0]).split(" [")[0]} en ${s.mates[x]} formaci${s.mates[x] > 1 ? "ones" : "ón"} top.`, `${nm(x)}: plays with ${nm(s.team[0]).split(" [")[0]} in ${s.mates[x]} top formation${s.mates[x] > 1 ? "s" : ""}.`) : L(`${nm(x)}: de tus mejores soportes libres en la tier list.`, `${nm(x)}: one of your best free supports in the tier list.`)),
        L("Sin main: en Ranked solo un equipo lo lleva, así que este lleva 4 ninjas.", "No main: in Ranked only one team has it, so this one has 4 ninjas.")] });
    const a = best.a;
    return [{ ...a, id: hashId("rk:trio:" + (a.cells || []).filter(Boolean).slice().sort().join("+")), trio: 1, custom: undefined, summon,
        label: L("Ranked 1 · con main · ", "Ranked 1 · with main · ") + String(a.label || "").replace(/^(Tuya|Yours) · /, ""),
        conf: [a.custom ? "Media" : (a.conf || [])[0] || "Media", L("El equipo con main: de los que ya puedes montar, el que deja mejores equipos para los otros dos. ", "The team with the main: of those you can already build, the one that leaves the best teams for the other two. ") + rule + " " + ((a.conf || [])[1] || "")],
        warn: barNote, why: [...(a.why || []), summonWhy(summon, m)] },
      sideAlt(best.s2, 2), sideAlt(best.s3, 3)];
  }
  function altsOf(m) {
    const own = Object.entries(customAlts).filter(([, a]) => a.mode === m.k)
      .map(([id, a]) => ({ ...a, id: "mi-" + id, custom: id, label: L("Tuya · ", "Yours · ") + (a.label || L("sin nombre", "unnamed")), conf: [L("Tuya", "Yours"), L("La has añadido tú desde el creador.", "You added it from the Builder.")] }));
    // Equipos ideales (IDEAL) se enseñan tal cual. En la app, cada modo de Equipos junta los de referencia adaptados
    // a tus ninjas, los del top y los montados con tus ninjas (sin repetir equipo), más los tuyos.
    if (!(IS_APP && MODES.includes(m))) return [...m.alts, ...own];
    const seen = new Set(), out = [];
    [...engineAlts(m), ...topAlts(m), ...builtAlts(m)].forEach(a => { const k = memKey(a.cells || []); if (seen.has(k)) return; seen.add(k); out.push(a); });
    // a un F2P se le avisa cuando el que falta solo sale pagando
    const paidMiss = a => { const x = (a.miss || []).length === 1 && !spendLv() && /^paid/.test(acqOf(a.miss[0])) ? a.miss[0] : "";
      return x ? { ...a, why: [...(a.why || []), L(`Te falta ${(BY.get(x) || { n: x }).n}, que solo sale pagando (premio por gasto o evento de pago).`, `You're missing ${(BY.get(x) || { n: x }).n}, who only comes from spending (spending reward or paid event).`)] } : a; };
    return [...(m.k === "rk" ? rankedTrio(m, [...out, ...own]) : []), ...out.map(paidMiss), ...own];
  }
  const triesOf = (mk, altId) => Object.entries(tries).filter(([, t]) => t.mode === mk && t.alt === altId)
    .sort((x, y) => String(y[1].at).localeCompare(String(x[1].at)));
  const fmtNum = n => Number(n).toLocaleString(EN ? "en-GB" : "es-ES");
  // PvP: con pocas partidas el porcentaje engaña (1/1 = 100% ganaría a 7/10). Se puntúa como si llevaras 2 victorias y
  // 2 derrotas más: 1/1 → 60%, 3/3 → 71%, 7/10 → 64%, 30/40 → 73%. Con muchas partidas queda casi el porcentaje real.
  const pvpScore = (w, n) => (w + 2) / (n + 4), PVP_FEW = 5;
  function statsOf(m, altId) {
    const ts = triesOf(m.k, altId).map(([, t]) => t);
    if (!ts.length) return null;
    if (m.kind === "pvp") { const w = ts.filter(t => t.result === "win").length, few = ts.length < PVP_FEW;
      return { n: ts.length, few, txt: L(`${w}/${ts.length} victorias`, `${w}/${ts.length} wins`) + (few ? L(" · pocas partidas", " · few games") : ""), score: pvpScore(w, ts.length) }; }
    const d = ts.map(t => +t.damage || 0); const best = Math.max(...d); const avg = Math.round(d.reduce((a, b) => a + b, 0) / d.length);
    if (m.kind === "exam") return { n: ts.length, txt: L(`piso máx. ${best}`, `max floor ${best}`), score: best };
    return { n: ts.length, txt: L(`mejor ${fmtNum(best)} · media ${fmtNum(avg)}`, `best ${fmtNum(best)} · avg ${fmtNum(avg)}`), score: best };
  }

  // Aprender de tus intentos: cada equipo probado del modo (también los descartados, con el equipo que guardaron) tiene
  // una nota de 0 a 1. En PvE y Exam, su mejor resultado frente a tu mejor del modo; en PvP, pvpScore (desde 2 partidas).
  // Un equipo sin probar que comparte 2 de sus 3 ninjas con uno probado hereda esa señal: si aquel te fue bien, sube en
  // «Por probar»; si te fue flojo, baja y lo dice. No toca lo que nadie ha probado.
  const LEARN_GOOD = { pve: 0.85, exam: 0.85, pvp: 0.6 }, LEARN_BAD = { pve: 0.6, exam: 0.6, pvp: 0.45 };
  function triedGroups(m) {
    const by = new Map();
    Object.values(tries).filter(x => x.mode === m.k).forEach(x => { const g = by.get(x.alt) || { alt: x.alt, label: x.altLabel || x.alt, team: (x.team || []).filter(s => BY.get(s) && !BY.get(s).m), ts: [] }; g.ts.push(x); by.set(x.alt, g); });
    const G = [...by.values()];
    G.forEach(g => { if (m.kind === "pvp") { g.w = g.ts.filter(x => x.result === "win").length; g.score = pvpScore(g.w, g.ts.length); }
      else g.score = Math.max(...g.ts.map(x => +x.damage || 0)); });
    const top = Math.max(0, ...G.map(g => g.score));
    G.forEach(g => { g.q = m.kind === "pvp" ? g.score : top ? g.score / top : 0; g.ok = m.kind !== "pvp" || g.ts.length >= 2; });
    return G;
  }
  // Nota de un equipo ya probado: 0 bueno, 1 sin señal, 2 flojo (para «Qué subir»). En PvE/Exam hace falta otro probado
  // con el que comparar.
  function triedBucket(m, altId) { const G = triedGroups(m), g = G.find(x => x.alt === altId); if (!g || !g.ok || (G.length < 2 && m.kind !== "pvp")) return 1;
    return g.q >= LEARN_GOOD[m.kind] ? 0 : g.q < LEARN_BAD[m.kind] ? 2 : 1; }
  function learnOf(m, a) {
    if (triesOf(m.k, a.id).length) return null;
    const mem = (a.cells || []).filter(s => s && BY.get(s) && !BY.get(s).m), G = triedGroups(m);
    const near = G.filter(g => g.alt !== a.id && g.ok && mem.filter(s => g.team.includes(s)).length >= 2);
    if (!near.length) return null;
    const ref = near.slice().sort((x, y) => y.ts.length - x.ts.length || y.q - x.q)[0], q = near.reduce((s, g) => s + g.q, 0) / near.length;
    const bucket = q >= LEARN_GOOD[m.kind] ? 0 : q < LEARN_BAD[m.kind] ? 2 : 1;
    const shared = mem.filter(s => ref.team.includes(s)).map(s => BY.get(s).n.replace(/^(\S+) \S+ \[/, "$1 [")).join(L(" y ", " and "));
    const top = Math.max(...G.map(g => g.score)), lbl = altShort(ref.label);
    const res = m.kind === "pvp" ? L(`${ref.w}/${ref.ts.length} victorias`, `${ref.w}/${ref.ts.length} wins`) : m.kind === "exam" ? L(`piso ${ref.score}`, `floor ${ref.score}`) : shortRes(ref.score);
    const vs = m.kind === "pvp" || ref.score === top ? "" : L(` (tu mejor: ${m.kind === "exam" ? "piso " + top : shortRes(top)})`, ` (your best: ${m.kind === "exam" ? "floor " + top : shortRes(top)})`);
    const why = L(`Comparte ${shared} con «${lbl}», que te dio ${res}${vs}.`, `Shares ${shared} with «${lbl}», which got you ${res}${vs}.`)
      + (bucket === 0 ? L(" Buena señal: pruébalo pronto.", " Good sign: try it soon.") : bucket === 2 ? L(" Aquel te fue flojo: déjalo para después.", " That one did poorly: leave it for later.") : "");
    return { q, bucket, why, n: near.length };
  }
  const learnRank = (m, a) => { const l = learnOf(m, a); return l ? l.bucket : 1; };
  const byLearn = (m, list) => list.map((a, i) => ({ a, i, r: learnRank(m, a) })).sort((x, y) => x.r - y.r || x.i - y.i).map(x => x.a);
  // ¿Rinde lo esperado para tu poder? Daño por poder del último intento frente al mejor de antes (PvE, con poder apuntado).
  // Si al subir de poder el daño no sube igual, algo del equipo se ha quedado atrás (colocación, summon, tácticas…).
  function powerTrend(m, altId) {
    if (m.kind !== "pve") return "";
    const ts = triesOf(m.k, altId).map(([, x]) => x).filter(x => +x.damage > 0 && +x.power > 0).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    if (ts.length < 2) return "";
    const last = ts[ts.length - 1], prev = Math.max(...ts.slice(0, -1).map(x => +x.damage / +x.power)), d = (+last.damage / +last.power) / prev - 1, pct = Math.round(Math.abs(d) * 100);
    if (d <= -0.15) return L(`Para tu poder rinde un ${pct}% menos que en su mejor intento: revisa la colocación, el summon o las tácticas.`, `For your power it does ${pct}% less than in its best attempt: check placement, summon or tactics.`);
    if (d >= 0.1) return L(`Para tu poder rinde un ${pct}% más que antes: va a mejor.`, `For your power it does ${pct}% more than before: it's improving.`);
    return "";
  }
  // Gráfica de intentos del modo: daño de cada intento en orden de fecha (una sola serie, sin leyenda);
  // al pasar el ratón, equipo, fecha y poder. Debajo, la misma información en tabla.
  function triesChart(m) {
    if (m.kind !== "pve") return "";
    const all = Object.entries(tries).filter(([, x]) => x.mode === m.k && +x.damage > 0).map(([, x]) => x)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    if (all.length < 2) return "";
    const W = 640, H = 190, PL = 58, R = 16, T = 18, B = 34;
    const max = Math.max(...all.map(x => +x.damage));
    const step = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / step) * step;
    const X = i => PL + (all.length === 1 ? 0 : i * (W - PL - R) / (all.length - 1));
    const Y = v => T + (H - T - B) * (1 - v / top);
    const short = v => !v ? "0" : v >= 1e6 ? (v / 1e6).toLocaleString(EN ? "en-GB" : "es-ES", { maximumFractionDigits: 2 }) + "M" : Math.round(v / 1000) + "k";
    const lbl = x => String(x.altLabel || x.alt).split(" · ")[0];
    const bestI = all.findIndex(x => +x.damage === max);
    const grid = [0, top / 2, top].map(v => `<line x1="${escAttr(PL)}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="cg"/><text x="${PL - 8}" y="${Y(v) + 4}" text-anchor="end" class="ct">${short(v)}</text>`).join("");
    const dots = all.map((x, i) => `<g class="cd"><circle cx="${X(i)}" cy="${Y(+x.damage)}" r="9" fill="transparent"/><circle cx="${X(i)}" cy="${Y(+x.damage)}" r="5" class="cdot"/><title>${esc(lbl(x))} · ${esc(String(x.at).slice(0, 10))} · ${fmtNum(+x.damage)}${L(" de daño", " damage")}${x.power ? " · " + Math.round(x.power / 1000) + L("k de poder", "k power") : ""}</title></g>`).join("");
    const xl = all.map((x, i) => `<text x="${X(i)}" y="${H - 12}" text-anchor="middle" class="ct">${esc(lbl(x))}</text>`).join("");
    return `<div class="tchart"><div class="eyebrow">${L("Tus intentos en orden (daño)", "Your attempts in order (damage)")}</div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L(`Daño de cada intento de ${esc(m.name)}, de ${short(Math.min(...all.map(x => +x.damage)))} a ${short(max)}`, `Damage of each ${esc(m.name)} attempt, from ${short(Math.min(...all.map(x => +x.damage)))} to ${short(max)}`)}">${grid}
        <polyline points="${all.map((x, i) => X(i) + "," + Y(+x.damage)).join(" ")}" class="cl"/>${dots}${xl}
        <text x="${X(bestI)}" y="${Y(max) - 10}" text-anchor="middle" class="ct cb">${short(max)}</text></svg>
      <details><summary>${L("Ver como tabla", "Show as table")}</summary><div class="table-scroll"><table class="starters"><thead><tr><th>${L("Fecha", "Date")}</th><th>${L("Equipo", "Team")}</th><th>${L("Daño", "Damage")}</th><th>${L("Poder", "Power")}</th></tr></thead>
        <tbody>${all.map(x => `<tr><td class="mono">${esc(String(x.at).slice(0, 10))}</td><td>${esc(x.altLabel || x.alt)}</td><td class="mono">${fmtNum(+x.damage)}</td><td class="mono">${x.power ? Math.round(x.power / 1000) + "k" : "—"}</td></tr>`).join("")}</tbody></table></div></details></div>`;
  }

  // Comparación por equipo: el mejor intento de cada uno y su daño por cada 100k de poder de ese día,
  // para comparar equipos probados con poderes distintos (250k frente a 320k).
  function teamCompare(m) {
    if (m.kind !== "pve") return "";
    const by = new Map();
    Object.values(tries).filter(x => x.mode === m.k && +x.damage > 0).forEach(x => {
      const k = x.alt + "|" + (x.team || []).slice().sort().join(","); const cur = by.get(k);
      if (!cur) by.set(k, { x, n: 1 }); else { cur.n++; if (+x.damage > +cur.x.damage) cur.x = x; }
    });
    const rows = [...by.values()].map(r => ({ ...r, eff: r.x.power ? +r.x.damage / r.x.power * 1e5 : null }))
      .sort((a, b) => (b.eff ?? -1) - (a.eff ?? -1) || +b.x.damage - +a.x.damage);
    if (rows.length < 2) return "";
    const ids = new Set(altsOf(m).map(a => a.id));
    const name = x => esc(String(x.altLabel || x.alt).replace(/\s*·\s*(probada|sin probar).*$/i, ""));
    // plegada: el título ya dice cuál rinde más para su poder; la tabla entera, al abrirla
    return `<details class="howto" style="margin-top:10px"><summary>${L("Por equipo: daño por cada 100k de poder", "By team: damage per 100k power")}${rows[0].eff ? ` <span class="note">· ${L("el que más rinde", "best for its power")}: <b>${name(rows[0].x)}</b></span>` : ""}</summary><div class="table-scroll"><table class="starters">
      <thead><tr><th>${L("Equipo", "Team")}</th><th>${L("Mejor", "Best")}</th><th>${L("Poder", "Power")}</th><th>${L("Por 100k", "Per 100k")}</th><th>${L("Intentos", "Attempts")}</th></tr></thead><tbody>${rows.map((r, i) => `<tr>
        <td>${name(r.x)}${ids.has(r.x.alt) ? "" : ` <span class="note">${L("(descartado)", "(retired)")}</span>`}</td><td class="mono">${shortRes(+r.x.damage)}</td>
        <td class="mono">${r.x.power ? Math.round(r.x.power / 1000) + "k" : "—"}</td><td class="mono">${r.eff ? `<b>${shortRes(r.eff)}</b>${i === 0 ? " ★" : ""}` : "—"}</td><td class="mono">${r.n}</td></tr>`).join("")}</tbody></table></div>
      <p class="note" style="margin:6px 0 0">${L("★ el que más rinde para su poder. Es orientativo: el daño no crece del todo en proporción al poder.", "★ the best for its power. It's only indicative: damage doesn't grow fully in proportion to power.")}</p></details>`;
  }

  // Registro de muros de Ninja Exam: piso, qué te mata, qué lo resolvió y si lo pasaste.
  function wallsPanel() {
    const list = Object.entries(walls).sort((a, b) => (+b[1].floor || 0) - (+a[1].floor || 0));
    const top = list.filter(([, w]) => w.passed).reduce((mx, [, w]) => Math.max(mx, +w.floor || 0), 0);
    return `<div class="panel walls"><div class="row" style="justify-content:space-between"><h3>${L("Tus muros", "Your walls")}</h3>${top ? `<span class="chip">${L("Piso más alto superado anotado", "Highest floor cleared logged")}: ${top}</span>` : ""}</div>
      <p class="note" style="margin:2px 0 8px">${L("Apunta cada piso que se te atasque: quién o qué te mata y qué lo resolvió. Sirve para los pisos que vuelven con los mismos enemigos (Hiruzen en el 300 y el 350).", "Note down each floor you get stuck on: who or what kills you and what solved it. Useful for floors that come back with the same enemies (Hiruzen on 300 and 350).")}</p>
      ${list.length ? `<div class="wall-list">${list.map(([id, w]) => `<div class="wall${w.passed ? " ok" : ""}"><b class="mono">${L("Piso", "Floor")} ${esc(String(w.floor))}</b><span class="pill" data-c="${w.passed ? "Alta" : "Media"}">${w.passed ? L("superado", "cleared") : L("atascado", "stuck")}</span>
        <div><div><span class="muted">${L("Qué pasa", "What happens")}:</span> ${esc(w.what || "—")}</div>${w.fix ? `<div><span class="muted">${L("Solución", "Solution")}:</span> ${esc(w.fix)}</div>` : ""}</div>
        <span class="muted mono">${esc(String(w.at || "").slice(0, 10))}</span><button class="x-try" data-wall-del="${escAttr(id)}" aria-label="${L("Borrar el piso", "Delete floor")} ${esc(String(w.floor))}">×</button></div>`).join("")}</div>` : `<p class="note">${L("Aún no has apuntado ningún piso.", "You haven't noted any floor yet.")}</p>`}
      <form class="log" data-wall-form><div class="row"><input type="number" name="floor" min="1" max="600" required placeholder="${L("Piso", "Floor")}" aria-label="${L("Piso", "Floor")}" style="width:90px">
        <input type="text" name="what" placeholder="${L("Qué te mata (p. ej. Hiruzen revive y mata a Madara)", "What kills you (e.g. Hiruzen revives and kills your carry)")}" aria-label="${L("Qué te mata", "What kills you")}" style="flex:1 1 220px"></div>
        <div class="row"><input type="text" name="fix" placeholder="${L("Qué lo resolvió (si lo sabes)", "What solved it (if you know)")}" aria-label="${L("Solución", "Solution")}" style="flex:1 1 220px">
        <label class="chk"><input type="checkbox" name="passed"> ${L("Superado", "Cleared")}</label><button class="btn small primary" type="submit">${L("Apuntar", "Note it")}</button></div></form></div>`;
  }
  function renderII() {
    const m = modeOf(ui.mode) || MODES[0]; ui.mode = m.k; tacKind = kindOf(m.k);
    $("modeTabs").innerHTML = MODES.map(x => { const r = modeRecord(x); return `<button class="subtab mode-tab" role="tab" data-mode="${escAttr(x.k)}" aria-selected="${x.k === m.k}"><span>${esc(x.name)}</span><small>${r ? esc(r.big) : L("sin intentos", "no attempts")}</small></button>`; }).join("");
    const alts = altsOf(m);
    const rows = alts.map(a => ({ a, st: statsOf(m, a.id) }));
    const ranked = rows.filter(r => r.st).sort((x, y) => y.st.score - x.st.score);
    const info = IS_APP ? (tc((IDEAL.find(x => x.k === IDEAL_OF[m.k]) || m).info) + L(" Aquí salen los equipos de referencia y los más repetidos del top que puedes montar, equipos hechos solo con tus ninjas y los que añadas tú.", " Here you get the reference teams and the top's most repeated teams you can build, teams made only from your ninjas and the ones you add.")) : m.info;
    $("modeInfo").innerHTML = `<div class="row" style="justify-content:space-between"><h2>${esc(m.name)}</h2><span class="bonus-tag">${esc(m.bonus)}</span></div>
      <p class="note clamp" id="modeNote" style="margin:6px 0 0">${esc(info)}</p><button class="more-btn" data-more aria-expanded="false" aria-controls="modeNote">${L("Leer más", "Read more")}</button>${m.tips && !IS_APP ? `<details class="howto" open style="margin-top:8px"><summary>${L("Consejos", "Tips")}</summary><ul class="why" style="margin:6px 0 0">${m.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
      ${(() => { const ch = triesChart(m); return ch ? `<details class="howto" style="margin-top:8px"><summary>${L("Gráfica de tus intentos", "Chart of your attempts")}</summary>${ch}</details>` : ""; })()}${IS_APP && exclList().length ? `<div style="margin-top:8px">${exclNote()}</div>` : ""}`;
    // Intentos cuyo equipo ya no está en la lista (borrado o renombrado): se muestran igual, con el equipo que guardaron.
    const ids = new Set(alts.map(a => a.id));
    const orphan = Object.entries(tries).filter(([, x]) => x.mode === m.k && !ids.has(x.alt))
      .sort((x, y) => String(y[1].at).localeCompare(String(x[1].at)));
    const orphanHtml = orphan.length ? `<details class="panel"><summary><b>${L("Descartados", "Retired")}</b> <span class="note">· ${L(`${orphan.length} intento${orphan.length > 1 ? "s" : ""} de equipos que ya no están en la lista`, `${orphan.length} attempt${orphan.length > 1 ? "s" : ""} with teams no longer listed`)}</span></summary>
      <p class="note">${L("Se conservan con el equipo que llevabas ese día.", "They're kept with the team you used that day.")}</p><ul class="why" style="margin:6px 0 0">${orphan.map(([, x]) => {
        const who = (x.team || []).map(s => BY.get(s) ? shortName(BY.get(s)) : s).join(" + ");
        const res = m.kind === "pvp" ? (x.result === "win" ? L("victoria", "win") : L("derrota", "loss")) : m.kind === "exam" ? L("piso ", "floor ") + x.damage : fmtNum(+x.damage || 0) + L(" de daño", " damage");
        return `<li><b>${esc(x.altLabel || x.alt)}</b>: ${esc(who)} · ${esc(res)}${x.power ? L(" · con ", " · at ") + Math.round(x.power / 1000) + L("k de poder", "k power") : ""} · ${esc(String(x.at || "").slice(0, 10))}${x.notes ? " · " + esc(x.notes) : ""}</li>`; }).join("")}</ul></details>` : "";
    const pupAlts = alts.filter(a => a.puppet);
    $("iiGrid").innerHTML = (/^s\d$/.test(m.k) ? `<div class="panel home-ii">${goalRow(iiGoal(m))}</div>` : "") + `<div class="row fold-all"><button class="btn small" data-foldall="1">${L("Plegar todos", "Collapse all")}</button><button class="btn small" data-foldall="0">${L("Desplegar todos", "Expand all")}</button><span class="note">${L("o toca el título de un equipo", "or tap a team's title")}</span></div>`
      + (() => { const main = alts.filter(a => !a.puppet);
          const bestId = ranked.length && !ranked[0].a.puppet ? ranked[0].a.id : null;
          // 3 tarjetas por grupo; el resto, en «Ver los N restantes» (rediseño, fase 3)
          const grp = (title, list, note, open) => list.length ? `<div class="grp-head"><h3>${title} <span class="muted mono">${list.length}</span></h3>${note ? `<span class="note">${note}</span>` : ""}</div>` + list.slice(0, 3).map(a => altCard(m, a, { open })).join("")
            + (list.length > 3 ? `<details class="grp-rest"><summary>${L(`Ver los ${list.length - 3} restantes`, `See the other ${list.length - 3}`)}</summary>${list.slice(3).map(a => altCard(m, a, { open })).join("")}</details>` : "") : "";
          return grp(L("Tu mejor equipo", "Your best team"), main.filter(a => a.id === bestId), L("el mejor resultado registrado en este modo", "the best result logged in this mode"), true)
            + (IS_APP ? (() => { const un = byLearn(m, main.filter(a => a.id !== bestId && !triesOf(m.k, a.id).length && !a.trio)), nMiss = a => (a.miss || []).length;
                const trio = main.filter(a => a.trio && a.id !== bestId && !triesOf(m.k, a.id).length);
                const trioHtml = m.k === "rk" ? (trio.length ? grp(L("Trío para Ranked", "Ranked trio"), trio, L("los tres van juntos, sin repetir personaje", "the three go together, no repeated character"), true)
                  : main.some(a => a.trio) ? "" : `<div class="panel"><h3>${L("Trío para Ranked", "Ranked trio")}</h3><p class="note">${L("Para proponerte los 3 equipos necesitas un equipo de Arena completo con main y al menos 8 ninjas más de personajes distintos (con una sola barrera entre todos).", "To propose the 3 teams you need a complete Arena team with a main plus at least 8 more ninjas of different characters (with a single barrier among all of them).")}</p></div>`) : "";
                return trioHtml + (() => {
                const far = un.filter(a => !a.custom && !a.built && nMiss(a) > 1);
                return grp(L("Puedes montarlos ya", "You can build these now"), un.filter(a => !a.custom && !a.built && !nMiss(a)), L("equipos de referencia y del top que tienes completos", "reference and top teams you have complete"))
                  + grp(L("Montados con tus ninjas", "Built from your ninjas"), un.filter(a => a.built), L("tus mejores carries con quien más los acompaña en el top", "your best carries with who most often joins them in the top"))
                  + grp(L("Tuyos", "Yours"), un.filter(a => a.custom), L("añadidos desde el creador", "added from the Builder"))
                  + grp(L("Te falta un ninja", "One ninja missing"), un.filter(a => !a.custom && !a.built && nMiss(a) === 1), L("consíguelo y lo tienes", "get it and it's ready"))
                  + (far.length ? `<details class="panel pup-fold"><summary><b>${L("Te faltan más ninjas", "More ninjas missing")} (${far.length})</b> <span class="note">· ${L("objetivos a largo plazo; qué conseguir primero, en Equipos ideales", "long-term goals; what to get first, in Ideal teams")}</span></summary><div class="stack" style="margin-top:12px">${(() => { const F = far.sort((a, b) => nMiss(a) - nMiss(b)); return F.slice(0, 12).map(a => altCard(m, a)).join("") + (F.length > 12 ? `<details class="grp-rest"><summary>${L(`Ver los ${F.length - 12} restantes`, `See the other ${F.length - 12}`)}</summary>${F.slice(12).map(a => altCard(m, a)).join("")}</details>` : ""); })()}</div>${false ? `<p class="note">${L(`Y ${far.length - 12} más en Equipos ideales y Biblioteca › Meta del top.`, `And ${far.length - 12} more in Ideal teams and Library › Top meta.`)}</p>` : ""}</details>` : ""); })(); })()
              : grp("Por probar", byLearn(m, main.filter(a => !triesOf(m.k, a.id).length)), "aún sin intentos"))
            + grp(L("Ya probados", "Already tried"), main.filter(a => a.id !== bestId && triesOf(m.k, a.id).length), ""); })()
      + (pupAlts.length ? `<details class="panel pup-fold"><summary><b>${L("Equipos de marionetas", "Puppet teams")} (${pupAlts.length})</b> <span class="note">· ${L("los mismos que en Meta → Marionetas; ábrelo para registrar sus intentos", "the same as in Library → Puppets; open it to log their attempts")}</span></summary><div class="stack" style="margin-top:12px">${pupAlts.map(a => altCard(m, a)).join("")}</div></details>` : "")
      + orphanHtml + `
      <div class="panel add-alt"><h3>${L("¿Tienes otra idea?", "Got another idea?")}</h3><p class="note">${L("Monta el equipo en el creador y añádelo aquí como alternativa para registrar sus intentos igual que las demás.", "Build the team in the Builder and add it here as an alternative to log its attempts like the others.")}</p>
        <button class="btn small" data-add-alt="${escAttr(m.k)}">${L("Añadir el equipo del creador", "Add the Builder's team")}</button></div>`;
  }

  // ---- piezas comunes de las tarjetas A/B/C/D
  const shortName = n => n.n.split(" [")[0];
  function cardHead(t) {
    const letter = /^[A-Z]$/.test(t.id) ? t.id : "+";
    const title = tc(t.label).replace(/^[A-Z]\s*·\s*/, "");
    return `<div class="tc-head${letter === "+" ? " no-letter" : ""}">${letter !== "+" ? `<span class="tc-letter" aria-hidden="true">${letter}</span>` : ""}
      <div class="tc-title"><h3>${letter !== "+" ? `<span class="sr">${L("Alternativa", "Alternative")} ${letter}: </span>` : ""}${esc(title)}</h3>${t.origin ? `<span class="origin" data-o="${esc(t.origin[0])}" title="${esc(t.origin[1])}">${esc(t.origin[0])}</span>` : ""}${t.conf && /^(Media|Baja)$/.test(t.conf[0]) ? `<span class="pill" data-c="${esc(t.conf[0])}">${L(`Confianza ${esc(t.conf[0].toLowerCase())}`, `${({ Alta: "High", Media: "Medium", Baja: "Low", Tuya: "Yours" })[t.conf[0]] || esc(t.conf[0])} confidence`)}</span>` : ""}</div>
      ${t.conf ? `<div class="tc-idea">${esc(t.conf[1])}</div>` : t.notes ? `<div class="tc-idea">${esc(t.notes)}</div>` : ""}</div>`;
  }
  // ---- Tácticas: cada una da un bonus a las 9 casillas (en Ghost Kill, por columnas: Ninjutsu / Ataque / Vida).
  // El usuario elige qué táctica usa en PvP (Arena, Ranked) y en PvE, su nivel y el bonus de cada casilla
  // (Ghost Kill viene rellena). Los tableros muestran el bonus de cada casilla y recolocan sin cambiar el orden.
  const TACTIC_NAMES = ["Ghost Kill", "Sparrow Thorn", "Goose Wood", "Sun Move", "Windmill", "Emerald", "Thunder God", "Vehicle Suspense", "Tiger Hunt", "Speed Rush Tactic"];
  const STATS = EN ? { "": "—", life: "Life", atk: "Attack", nin: "Ninjutsu", def: "Defence", res: "Resistance", ini: "Initiative", crit: "Crit" }
    : { "": "—", life: "Vida", atk: "Ataque", nin: "Ninjutsu", def: "Defensa", res: "Resistencia", ini: "Iniciativa", crit: "Crítico" };
  const STAT_AB = { life: EN ? "L" : "V", atk: "A", nin: "N", def: "D", res: "R", ini: "I", crit: "C" };
  // Ghost Kill (captura del usuario, 2-oct-2026): columna izquierda Ninjutsu, centro Ataque, derecha Vida; por casilla
  const GK = { cells: ["nin", "atk", "life", "nin", "atk", "life", "nin", "atk", "life"],
    val: { 1: { life: 80, atk: 40, nin: 40 }, 2: { life: 280, atk: 140, nin: 140 }, 3: { life: 500, atk: 250, nin: 250 }, 4: { life: 750, atk: 375, nin: 375 }, 5: { life: 1020, atk: 510, nin: 510 } } };
  let tacKind = "pvp";
  const kindOf = k => ["ar", "rk"].includes(String(k).replace(/^i-/, "")) ? "pvp" : "pve";
  function tacState() {
    let T = profile.tactics;
    const bad = !T || Object.values(T).some(v => Array.isArray(v));   // formato antiguo (casillas «iluminadas»)
    if (bad) {
      // En la app, las tácticas se abren a nivel 60: por debajo (o sin nivel apuntado) no se da ninguna por puesta.
      const on = !IS_APP || (+profile.level || 0) >= 60;
      T = { "Ghost Kill": { level: on ? 4 : 0, cells: GK.cells.slice() } };
      profile.tactics = T; profile.tacUse = on ? { pvp: "Ghost Kill", pve: "Ghost Kill" } : {};
    }
    profile.tacUse = profile.tacUse || {};
    return { tactics: T, use: profile.tacUse };
  }
  const tacOf = (kind = tacKind) => { const st = tacState(); const nm = st.use[kind]; const x = nm && st.tactics[nm]; return x && x.cells.some(Boolean) ? { name: nm, ...x } : null; };
  const tacCells = (kind = tacKind) => { const x = tacOf(kind); return x ? x.cells : []; };
  const tacVal = (x, stat) => x && x.name === "Ghost Kill" && GK.val[x.level] ? GK.val[x.level][stat] : null;
  // Qué le conviene a cada ninja: Vida a los tanques, si no su mejor estadística de daño (grados de data.js: vida, ataque, defensa, ninjutsu, resistencia)
  const GR = { SS: 5, S: 4, A: 3, B: 2, C: 1 };
  function prefStat(n) {
    const g = (n.gr || []).map(x => GR[x] || 0);
    if (!g.length) return "nin";
    const tank = Math.max(g[0], g[2], g[4]), off = Math.max(g[1], g[3]);
    if (n.ro === "Tank" || tank > off) return "life";
    return g[1] > g[3] ? "atk" : "nin";
  }
  // No se recoloca por la táctica: la colocación depende del orden (iniciativa), de quién debe recibir los golpes,
  // del clon de Madara y de la táctica a la vez, y las rejillas del top ya lo tienen en cuenta (también juegan con
  // táctica). Solo se muestra qué bonus recibe cada ninja en esa rejilla.
  function placeCells(raw) { return (raw || []).map(s => s || null); }
  function placeNote(t, cells) {
    const T = tacOf();
    const moved = (t.cells || []).some((s, i) => (s || null) !== cells[i]);
    let tac = "";
    if (T) {
      const got = cells.map((s, i) => s && { n: BY.get(s), st: T.cells[i] }).filter(x => x && x.n && x.st);
      tac = L(` Con ${esc(T.name)}${T.level ? " nv. " + T.level : ""}: `, ` With ${esc(T.name)}${T.level ? " lv. " + T.level : ""}: `) + got.map(x => `${esc(shortName(x.n))} +${STATS[x.st]}${tacVal(T, x.st) ? " " + tacVal(T, x.st) : ""}`).join(", ") + ".";
    }
    if (moved) return `<div class="tc-place"><b>${L("Colocación", "Placement")}</b>${L("Ajustada a tu táctica sin cambiar quién actúa primero.", "Adjusted to your tactic without changing who acts first.")}${tac}</div>`;
    return t.pos || tac ? `<div class="tc-place"><b>${L("Colocación", "Placement")}</b>${esc(t.pos || "")}${tac}</div>` : "";
  }
  function renderTacBars() {
    const st = tacState();
    const edit = ui.tacEdit || st.use[tacKind] || "Ghost Kill";
    const cur = st.tactics[edit] || { level: 0, cells: Array(9).fill("") };
    const opt = (sel, none) => (none ? [""] : []).concat(TACTIC_NAMES).map(v => `<option value="${escAttr(v)}"${v === sel ? " selected" : ""}>${v || L("Ninguna", "None")}</option>`).join("");
    const T = tacOf();
    const html = `<div style="min-width:0"><h3>${L("Tus tácticas", "Your tactics")}</h3>
      <p class="note" style="margin:0 0 8px">${L("Cada táctica da un bonus a las 9 casillas: en Ghost Kill, la columna izquierda da Ninjutsu, la del centro Ataque y la derecha Vida (la derecha es la delantera). Elige cuál usas en cada tipo de modo y su nivel; para otra táctica, copia aquí el bonus de cada casilla de su pantalla. Los tableros muestran qué bonus recibe cada ninja, pero no los mueven: la colocación depende a la vez del orden de actuación, de quién debe aguantar los golpes (y quién no), del clon de Madara y de la táctica, y las rejillas copiadas del top ya equilibran todo eso (esos jugadores también usan táctica).", "Each tactic gives a bonus to the 9 squares: in Ghost Kill, the left column gives Ninjutsu, the middle Attack and the right Life (the right is the front). Choose which one you use in each kind of mode and its level; for another tactic, copy the bonus of each square from its screen. The boards show which bonus each ninja gets but don't move them: placement depends on acting order, who must take the hits (and who mustn't), Madara's clone and the tactic all at once, and grids copied from top players already balance all that (they use tactics too).")}</p>
      <div class="row" style="gap:8px 14px;flex-wrap:wrap;align-items:end">
        <label class="note" style="display:grid;gap:3px">${L("En Arena y Ranked", "In Arena and Ranked")}<select data-tac-use="pvp">${opt(st.use.pvp || "", true)}</select></label>
        <label class="note" style="display:grid;gap:3px">${L("En PvE", "In PvE")}<select data-tac-use="pve">${opt(st.use.pve || "", true)}</select></label>
        <label class="note" style="display:grid;gap:3px">${L("Editar", "Edit")}<select data-tac-edit>${opt(edit, false)}</select></label>
        <label class="note" style="display:grid;gap:3px">${L("Nivel", "Level")}<input type="number" min="0" max="10" data-tac-level value="${cur.level || 0}" style="width:5em"></label>
      </div>
      <p class="note" style="margin:8px 0 0">${L("En este modo se aplica", "Applied in this mode")}: <b>${T ? esc(T.name) + L(" nv. ", " lv. ") + (T.level || "?") : L("ninguna", "none")}</b>. ${IS_APP ? L("¿Cuál subir? Ghost Kill es la más versátil: la columna de ninjutsu sirve a la mayoría de carries y la de vida a los tanques de delante.", "Which to upgrade? Ghost Kill is the most versatile: the ninjutsu column suits most carries and the life column suits front tanks.") : "¿Cuál subir? Ghost Kill: casi todos tus ninjas clave hacen daño de <b>ninjutsu</b> (Madara, Jiraiya, Kabuto, Sasuke, Shisui) y la vida va bien a los tanques delante; el ataque solo lo aprovechan los de taijutsu (Guy, Midnight Blade)."}</p></div>
      <div><div class="tac-grid tac-stats" role="group" aria-label="${L("Bonus de cada casilla de", "Bonus of each square of")} ${esc(edit)}">${[0,1,2,3,4,5,6,7,8].map(i => `<select data-tac-cell="${escAttr(i)}" title="${L("Casilla", "Square")} ${RANK[i]}">${Object.entries(STATS).map(([k, l]) => `<option value="${escAttr(k)}"${(cur.cells[i] || "") === k ? " selected" : ""}>${k ? STAT_AB[k] : "—"}</option>`).join("")}</select>`).join("")}</div>
      <div class="tac-cap">${esc(edit)} · ${L("Delante ▸", "Front ▸")}</div>${edit === "Ghost Kill" ? "" : `<button class="btn small" data-tac-gk style="margin-top:6px">${L("Copiar formato de Ghost Kill", "Copy Ghost Kill layout")}</button>`}</div>`;
    document.querySelectorAll("[data-tacbar]").forEach(el => { el.innerHTML = html; });
  }
  const rerenderTeams = () => { renderTacBars(); if (ui.tab === "ideal") renderIdeal(); else if (ui.tab === "ii") renderII(); };
  document.addEventListener("change", e => {
    const ed = e.target.closest("[data-tac-edit]"); if (ed) { ui.tacEdit = ed.value; renderTacBars(); return; }
    const st = tacState(); const edit = ui.tacEdit || st.use[tacKind] || "Ghost Kill";
    const cur = st.tactics[edit] || { level: 0, cells: Array(9).fill("") };
    const us = e.target.closest("[data-tac-use]");
    if (us) { profile.tacUse = { ...profile.tacUse, [us.dataset.tacUse]: us.value }; saveProfile(); rerenderTeams(); return; }
    const lv = e.target.closest("[data-tac-level]");
    if (lv) { profile.tactics = { ...st.tactics, [edit]: { ...cur, level: Math.max(0, Math.min(10, Math.round(+lv.value) || 0)) } }; saveProfile(); rerenderTeams(); return; }
    const c = e.target.closest("[data-tac-cell]");
    if (c) { const cells = cur.cells.slice(); cells[+c.dataset.tacCell] = c.value; profile.tactics = { ...st.tactics, [edit]: { ...cur, cells } }; saveProfile(); rerenderTeams(); }
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-tac-gk]"); if (!b) return;
    const st = tacState(); const edit = ui.tacEdit || st.use[tacKind] || "Ghost Kill"; const cur = st.tactics[edit] || { level: 0 };
    profile.tactics = { ...st.tactics, [edit]: { ...cur, cells: GK.cells.slice() } }; saveProfile(); rerenderTeams();
  });
  function board(cells) {
    const T = tacOf();
    return `<div class="tboard" aria-label="${L("Formación: la columna derecha es la fila delantera", "Formation: the right column is the front row")}">
      <div class="tb-cols"><span>${L("Atrás", "Back")}</span><span>${L("Medio", "Middle")}</span><span>${L("Delante ▸", "Front ▸")}</span></div>
      <div class="tb-grid">${cells.map((x, i) => { const n = x && BY.get(x);
        const st = T && T.cells[i]; const tg = st ? `<span class="tb-tac" data-st="${escAttr(st)}">+${STAT_AB[st]}</span>` : "";
        return n ? `<div class="tb-c f"><span class="o">${RANK[i]}</span>${tg}${face(n.s)}<span class="nm">${esc(shortName(n))}</span></div>` : `<div class="tb-c"><span class="o">${RANK[i]}</span>${tg}</div>`; }).join("")}</div>
      <div class="tb-leg">${L("El número es el orden en que actúan y persiguen.", "The number is the order in which they act and chase.")}${T ? L(` +V/+A/+N = bonus de ${esc(T.name)} (Vida, Ataque, Ninjutsu).`, ` +L/+A/+N = ${esc(T.name)} bonus (Life, Attack, Ninjutsu).`) : ""}</div></div>`;
  }

  // Reparte las frases de «por qué» entre los ninjas que nombran al empezar; el resto va a «Además».
  function splitWhy(units, why) {
    const jobs = new Map(); const rest = [];
    (why || []).map(tc).forEach(w => {
      const at = u => { const sn = shortName(u.n); const first = sn.split(" ")[0];
        const k = [sn, first.length > 3 ? first : null].filter(Boolean).map(x => w.indexOf(x)).filter(x => x >= 0);
        return k.length ? Math.min(...k) : -1; };
      const u = units.map(u => [u, at(u)]).filter(([, k]) => k >= 0 && k < 25).sort((x, y) => x[1] - y[1]).map(([u]) => u)[0];
      if (u && !jobs.has(u.n.s)) jobs.set(u.n.s, w.replace(/^[^:]{0,40}:\s*/, "").replace(/^./, c => c.toUpperCase()));
      else rest.push(w);
    });
    return { jobs, rest };
  }
  const ROLE_ES = EN ? {} : { Damage: "Daño", Tank: "Tanque", Support: "Apoyo", Control: "Control" };
  function kitLine(u) {
    const k = u.skills.find(q => q.t === "Chase");
    const ch = k ? (k.tr && k.tr.length ? L("persigue ", "chases ") + k.tr.join("/") : k.th ? L("chase a " + k.th + " combo", "chase at " + k.th + " combo") : "") + (k.ca && k.ca.length ? L(" → causa ", " → causes ") + k.ca.join("/") : "") : "";
    return [ROLE_ES[u.n.ro] || u.n.ro, ch].filter(Boolean).join(" · ");
  }
  function jobsList(units, jobs) {
    const ord = [...units.filter(u => !u.n.m).sort((a, b) => a.rank - b.rank), ...units.filter(u => u.n.m)];
    return `<div class="jobs">${ord.map(u => { const o = profile.owned[u.n.s]; const mine = u.n.m || o || u.n.s === "madara-uchiha-the-final-battle";
      const tag = u.n.m ? `<span class="muted" style="font-size:.7rem">main</span>` : o ? `<span class="tag-own">${o.st ? o.st + "★" : ""}${o.bt ? " BT" : ""} ${L("tuyo", "yours")}</span>` : mine ? "" : `<span class="tag-miss">${L("te falta", "missing")}</span>`;
      const j = jobs.get(u.n.s);
      return `<div class="job">${face(u.n.s)}<div><b>${esc(shortName(u.n))}</b> ${tag}${j ? `<div class="d">${esc(j)}</div>` : ""}<div class="k">${esc(kitLine(u))}</div></div></div>`; }).join("")}</div>`;
  }
  // De dónde sale cada equipo: probado por ti, tuyo, de referencia (`ref` en MODES/IDEAL), top (jugadores o vídeos) o combinación de Claude.
  function originOf(m, t) {
    if (t.custom) return [L("Tuyo", "Yours"), L("Lo has añadido tú desde el creador.", "You added it from the Builder.")];
    if (t.built) return [L("Con tus ninjas", "Your ninjas"), L("Montado por la app con tus ninjas a partir del top y la tier list; nadie lo ha probado.", "Built by the app from your ninjas using the top and the tier list; nobody has tried it.")];
    if ((m.kind && triesOf(m.k, t.id).length) || /probad/i.test(((t.conf || [])[0] || "") + " " + t.label)) return [L("Probado por ti", "Tried by you"), L("Tiene intentos tuyos registrados: mira el resultado.", "It has attempts logged by you: check the result.")];
    const c = (t.conf || [])[1] || "";
    if (/(construcci[oó]n m[ií]a|combinaci[oó]n m[ií]a|deducci[oó]n m[ií]a|idea sin probar|es m[ií]a)/i.test(c)) return [L("Idea de Claude", "Claude's idea"), L("Combinación de Claude a partir de los textos de las habilidades; nadie la ha probado.", "Claude's combination based on the skill texts; nobody has tried it.")];
    if (t.ref || /fuente:/i.test(c)) return [L("Referencia", "Reference"), L("Equipo de referencia para este modo.", "Reference team for this mode.")];
    if (t.posSrc === "top" || /top|v[ií]deo|konohahub|nexus/i.test(c)) return ["Top", L("Sale de equipos del top o de vídeos de jugadores.", "From top teams or players' videos.")];
    return [L("Idea de Claude", "Claude's idea"), L("Combinación de Claude; nadie la ha probado.", "Claude's combination; nobody has tried it.")];
  }
  function setupTiles(t, main, sm) {
    const sel = main ? ["Mystery", "Standard", "Chase", "P2", "P3"].map(x => { const sk = main.n.sk.find(q => q.id === (t.mainSel || {})[x]); return sk ? `<div><span class="muted">${TALENT_LABEL[x]}:</span> ${esc(sk.n)}</div>` : ""; }).join("") : "";
    const tiles = [];
    if (main) tiles.push(`<div class="tile"><span class="lbl">Main · ${esc(main.n.n)}</span>${sel || `<span class="muted">${L("Las habilidades que prefieras", "The skills you prefer")}</span>`}</div>`);
    const smTag = s => s ? (profile.summons.includes(s.s) ? `<span class="tag-own">${L("tuyo", "yours")}</span>` : `<span class="tag-miss">${L("no lo tienes", "not owned")}</span>`) : "";
    if (t.summon) tiles.push(`<div class="tile"><span class="lbl">Summon · chase</span>${sm ? esc(sm.n) : esc(t.summon)} ${smTag(sm)}</div>`);
    const smM = t.summonM && SUM.get(t.summonM);
    if (t.summonM) tiles.push(`<div class="tile"><span class="lbl">Summon · mystery</span>${smM ? esc(smM.n) : esc(t.summonM)} ${smTag(smM)}</div>`);
    if (t.assist && !/^No funcionan/.test(t.assist)) tiles.push(`<div class="tile"><span class="lbl">Assist</span>${esc(t.assist)}</div>`);
    if (t.passives) tiles.push(`<div class="tile wide"><span class="lbl">${L("Pasivas del main", "Main's passives")}</span>${esc(t.passives)}</div>`);
    return `<div class="tiles">${tiles.join("")}</div>`;
  }
  // Montaje usado en un intento: talentos del main (una por fila), los dos summons y la carta de assist.
  function setupForm(t, main, summary) {
    const ms = t.mainSel || {};
    const selRow = r => { const rows = talentRows(main.n); const cur = ms[r] || (rows[r].find(k => String(t.passives || "").includes(k.n)) || {}).id;
      return `<label>${TALENT_LABEL[r]}<select name="t_${r}"><option value="">—</option>${rows[r].map((k, i) => `<option value="${esc(k.id)}"${cur === k.id ? " selected" : ""}${talentLocked(r, i) ? " disabled" : ""}>${esc(k.n)}${talentLocked(r, i) ? L(" (nivel 76)", " (level 76)") : ""}</option>`).join("")}</select></label>`; };
    const sumOpts = cur => `<option value="">—</option>` + D.summons.filter(s => profile.summons.includes(s.s) || s.s === cur).map(s => `<option value="${escAttr(s.s)}"${cur === s.s ? " selected" : ""}>${esc(s.n)}</option>`).join("");
    const card = String(t.assist || "").split(/[ ,.(]/)[0];
    return `<details class="setup" open><summary>${summary || L("Montaje usado: si cambiaste algo respecto a la tarjeta (habilidades del main, summons, carta), cámbialo aquí antes de guardar", "Setup used: if you changed something from the card (main skills, summons, card), change it here before saving")}</summary>
      ${main ? `<div class="loadout">${["Mystery", "Standard", "Chase", "P2", "P3"].map(selRow).join("")}</div>` : ""}
      <div class="loadout"><label>Summon · mystery<select name="s_m">${sumOpts(t.summonM || "")}</select></label><label>Summon · chase<select name="s_c">${sumOpts(t.summon || "")}</select></label>
      <label>${L("Carta de assist", "Assist card")}<input type="text" name="assist" value="${esc(/^(No|Sin|Una|Karin o|Torune o)/.test(card) ? "" : card)}" placeholder="${L("p. ej. Torune", "e.g. Torune")}"></label></div></details>`;
  }
  function setupLine(x) {
    const s = x.setup; if (!s) return "";
    const m = s.main && BY.get(s.main);
    const tal = m ? talentNames(m, s.mainSel).join(", ") : "";
    const sm = [s.summonM, s.summon].filter(Boolean).map(id => (SUM.get(id) || { n: id }).n).join(" + ");
    return `<span class="note">${[tal && esc(m.n) + ": " + esc(tal), sm && "summons " + esc(sm), s.assist && L("carta ", "card ") + esc(s.assist)].filter(Boolean).join(" · ")}</span>`;
  }
  var cardFolds = {}; try { cardFolds = JSON.parse(localStorage.getItem(LS + "-cardfold") || "{}"); } catch {}
  function saveCardFolds() { try { localStorage.setItem(LS + "-cardfold", JSON.stringify(cardFolds)); } catch {} }
  function altCard(m, t, opts = {}) {
    const cells = placeCells(t.cells);
    const tt = { cells, mainSel: t.mainSel || {}, summon: t.summon || "", superArmor: !!m.superArmor };
    const units = lineup(tt);
    const runs = starters(units).map(st0 => simulate(units, st0, tt));
    runs.sort((a, b) => b.steps.length - a.steps.length || b.combo - a.combo);
    const r = runs[0];
    const main = units.find(u => u.n.m);
    const sm = t.summon && SUM.get(t.summon);
    const key = m.k + ":" + t.id;
    const hist = triesOf(m.k, t.id);
    const st0 = statsOf(m, t.id);
    const { jobs, rest } = splitWhy(units, t.why);
    const lrn = opts.ideal ? null : learnOf(m, t);
    const chain = r ? `<div class="ii-chain">${r.steps.map((s0, i) => `${i ? "→" : ""}<span>${esc((s0.summon ? s0.sm.n : s0.u.n.n).split(" [")[0])}</span>${s0.causes.filter(x => MOVES.has(x)).map(st).join("")}`).join(" ")}</div><div class="note">${L(`${r.steps.length - 1} chase${r.steps.length === 2 ? "" : "s"} en la ronda 1${m.superArmor ? " (solo chases por combo)" : ""}`, `${r.steps.length - 1} chase${r.steps.length === 2 ? "" : "s"} in round 1${m.superArmor ? " (combo chases only)" : ""}`)}</div>` : "—";
    const warns = [...(t.miss && t.miss.length ? [L(`Te falta${t.miss.length > 1 ? "n" : ""}: ${t.miss.map(x => (BY.get(x) || { n: x }).n).join(", ")}. Mira su ficha para saber cómo conseguirlo.`, `Missing: ${t.miss.map(x => (BY.get(x) || { n: x }).n).join(", ")}. Open its sheet to see how to get it.`)] : []),
      ...teamWarnings(t.miss ? t.cells.map(x => t.miss.includes(x) ? "" : x) : t.cells, !m.k.startsWith("i-")), ...(t.warn || [])];
    // Plegadas por defecto salvo tu mejor equipo; si la abres o la pliegas tú, se recuerda (1 = plegada, 0 = abierta).
    const folded = key in cardFolds ? !!cardFolds[key] : !opts.open;
    const mini = `<div class="tc-mini"><span class="tc-faces">${(t.cells || []).filter(Boolean).map(s => { const n = BY.get(s) || { s, n: s }; return pic(n.s, n.n); }).join("")}</span>
      ${t.miss && t.miss.length ? `<span class="chip miss">${L(`te falta${t.miss.length > 1 ? "n" : ""} ${t.miss.length}`, `${t.miss.length} missing`)}</span>` : ""}
      ${st0 ? `<span class="chip on">${esc(st0.txt)} · ${st0.n} ${L("intento", "attempt")}${st0.n > 1 ? "s" : ""}</span>` : ""}
      ${opts.ideal ? "" : `<button class="btn small primary tc-mini-log" data-qt="${esc(key)}">${L("Registrar", "Log")}</button>`}</div>`;
    return `<article class="panel ii-card${folded ? " folded" : ""}" data-stage="${escAttr(m.k)}" data-fkey="${esc(key)}">
      ${cardHead({ ...t, origin: originOf(m, t), conf: t.conf && hist.length ? [t.conf[0], String(t.conf[1] || "").replace(/(Deducción mía con tus ninjas|My deduction from your ninjas): .*$/, L("$1: ya lo has probado, mira tus intentos.", "$1: you've tried it, see your attempts."))] : t.conf })}
      ${mini}
      ${(() => { const pt = powerTrend(m, t.id); return pt ? `<p class="learn-note${/menos|less/.test(pt) ? " bad" : " good"}">${esc(pt)}</p>` : ""; })()}
      ${(() => { const o = opts.ideal ? [] : alsoIn(m, t); return o.length ? `<p class="note also-in">${esc(L(`El mismo equipo también se propone en ${o.map(modeShort).join(", ")}.`, `The same team is also suggested in ${o.map(modeShort).join(", ")}.`))}</p>` : ""; })()}
      ${lrn ? `<p class="learn-note${lrn.bucket === 2 ? " bad" : lrn.bucket === 0 ? " good" : ""}">${esc(lrn.why)}</p>` : ""}
      ${warns.length ? `<div class="warn-box">${warns.map(x => `<p>⚠ ${esc(x)}</p>`).join("")}</div>` : ""}
      ${st0 ? `<div class="tc-status"><span class="chip on">${L("Tus intentos", "Your attempts")}: ${esc(st0.txt)} · ${st0.n}</span></div>` : ""}
      <div class="tc-mid">${board(cells)}${jobsList(units, jobs)}</div>
      ${placeNote(t, cells)}
      ${setupTiles(t, main, sm)}
      <details><summary>${L("Cadena de chases", "Chase chain")}${rest.length ? L(" y más notas", " and more notes") : ""}</summary>${chain}
        ${rest.length ? `<ul class="why" style="margin-top:8px">${rest.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}</details>
      ${t.notes && t.conf ? `<div class="note"><b>Notas:</b> ${esc(t.notes)}</div>` : ""}
      <div class="row">
        <button class="btn small primary" data-alt-open="${escAttr(key)}">${L("Abrir en el creador", "Open in Builder")}</button>
        <button class="btn small" data-alt-save="${escAttr(key)}">${L("Guardar en mis equipos", "Save to my teams")}</button>
        ${t.custom ? (ui.delAlt === key ? `<span class="confirm">${L("¿Quitar?", "Remove?")} <button class="btn small danger" data-alt-del-yes="${escAttr(key)}">${L("Sí", "Yes")}</button><button class="btn small" data-alt-del-no>No</button></span>` : `<button class="btn small danger" data-alt-del="${escAttr(key)}">${L("Quitar", "Remove")}</button>`) : ""}
      </div>
      ${opts.ideal ? missingBlock(units) : `<div class="row tc-log"><button class="btn primary" data-qt="${esc(key)}">${L("Registrar un intento", "Log an attempt")}</button><span class="note">${L("Solo el daño: el montaje sale de tu último intento con este equipo.", "Just the damage: the setup comes from your last attempt with this team.")}</span></div>`}
      ${!opts.ideal && hist.length ? `<div class="hist"><div class="eyebrow">${L("Intentos", "Attempts")}</div>${hist.slice(0, 6).map(([id, x]) => `
        <div class="try"><span class="mono">${esc(String(x.at).slice(0, 10))}</span>
          <b class="mono">${m.kind === "pvp" ? (x.result === "win" ? L("Victoria", "Win") : L("Derrota", "Loss")) : fmtNum(x.damage || 0)}</b>
          ${x.rival ? `<span>vs ${esc(x.rival)}</span>` : ""}
          ${x.power ? `<span class="muted">${L(`con ${fmtNum(Math.round(x.power / 1000))}k de poder`, `at ${fmtNum(Math.round(x.power / 1000))}k power`)}</span>` : ""}
          ${(x.fallen || []).length ? `<span class="tag-miss">${L("cayó", "fell")}: ${esc(x.fallen.map(f => (BY.get(f) || { n: f }).n.split(" [")[0]).join(", "))}</span>` : `<span class="tag-own">${L("nadie cayó", "nobody fell")}</span>`}
          ${setupLine(x)}
          ${x.notes ? `<span class="note">${esc(x.notes)}</span>` : ""}
          ${ui.delTry === id ? `<span class="confirm"><button class="btn small danger" data-try-del-yes="${escAttr(id)}">${L("Borrar", "Delete")}</button><button class="btn small" data-try-del-no>No</button></span>` : `<button class="x-try" data-try-del="${escAttr(id)}" aria-label="${L("Borrar intento", "Delete attempt")}">×</button>`}
        </div>`).join("")}</div>` : ""}
    </article>`;
  }
  function findAlt(key) { const i = key.indexOf(":"), mk = key.slice(0, i), id = key.slice(i + 1); const m = modeOf(mk); return { m, a: m ? altsOf(m).find(x => x.id === id) : null }; }
  $("modeTabs").addEventListener("click", e => {
    const b = e.target.closest("[data-mode]"); if (!b) return;
    ui.mode = b.dataset.mode; try { localStorage.setItem(LS + "-mode", ui.mode); } catch {} renderII();
  });
  function tryBody(m, a, fd, fallen) {
    const body = { mode: m.k, alt: a.id, altLabel: a.label, kind: m.kind, fallen, notes: (fd.get("notes") || "").trim(),
      team: (a.cells || []).filter(Boolean), at: new Date().toISOString() };
    if (+profile.power) body.power = +profile.power;   // para comparar intentos hechos con distinto poder
    const mainN = (a.cells || []).map(s => s && BY.get(s)).find(n => n && n.m);
    const setup = { main: mainN ? mainN.s : "", mainSel: {}, summon: fd.get("s_c") || "", summonM: fd.get("s_m") || "", assist: (fd.get("assist") || "").trim() };
    ["Mystery", "Standard", "Chase", "P2", "P3"].forEach(r => { const v = fd.get("t_" + r); if (v) setup.mainSel[r] = v; });
    body.setup = setup;
    if (m.kind === "pvp") { body.result = fd.get("result"); body.rival = (fd.get("rival") || "").trim(); }
    else { const d = parseAmount(fd.get("damage"));
      if (!(d >= 0)) { toast(L("Escribe el resultado: p. ej. 5,1M o 5.100.000", "Enter the result: e.g. 5.1M or 5,100,000")); return null; }
      if (m.kind === "pve" && d < 1000) { toast(L(`¿${fmtNum(d)} de daño? Escribe el daño entero: p. ej. 5,1M o 5.100.000`, `${fmtNum(d)} damage? Enter the full damage: e.g. 5.1M or 5,100,000`)); return null; }
      body.damage = d; }
    if (fd.has("power")) { const pw = Number(fd.get("power")); if (pw > 0) body.power = pw; else delete body.power; }
    return body;
  }
  // Cómo queda el intento frente al récord anterior del modo (daño o piso); en PvP no hay récord que comparar.
  function vsRecord(body) {
    const m = modeOf(body.mode); if (!m || m.kind === "pvp") return "";
    const prev = modeRecord(m); const d = +body.damage || 0;
    if (!prev) return L(" · primer intento en ", " · first attempt in ") + m.name;
    const r = +prev.best.damage || 0;
    if (d > r) return m.kind === "exam" ? L(` · ¡récord! (antes, piso ${r})`, ` · record! (before, floor ${r})`) : L(` · ¡récord! +${Math.round((d / Math.max(r, 1) - 1) * 100)}% sobre ${shortRes(r)}`, ` · record! +${Math.round((d / Math.max(r, 1) - 1) * 100)}% over ${shortRes(r)}`);
    if (d === r) return L(" · igualas tu récord", " · you match your record");
    return m.kind === "exam" ? L(` · tu récord es el piso ${r}`, ` · your record is floor ${r}`) : L(` · ${Math.round(d / Math.max(r, 1) * 100)}% de tu récord (${shortRes(r)})`, ` · ${Math.round(d / Math.max(r, 1) * 100)}% of your record (${shortRes(r)})`);
  }
  async function storeTry(body) {
    const id = "i" + Date.now().toString(36);
    const vs = vsRecord(body);   // antes de añadirlo, para comparar con el récord anterior
    tries = { ...tries, [id]: body }; lsWrite();
    if (db) { try { await db.collection("intentos").doc(id).set(body); toast(L("Intento guardado", "Attempt saved") + vs); } catch (err) { toast(err && err.code === "quota_exceeded" ? L("No queda espacio para más intentos", "No space left for more attempts") : L("Guardado solo ", "Saved only ") + HERE + vs); } }
    else toast(L("Intento guardado ", "Attempt saved ") + HERE + vs);
  }

  // ---------------- REGISTRO RÁPIDO («＋ Intento»): modo, equipo y resultado; el montaje sale del último intento de ese equipo.
  function lastTryOf(mk, id) { const h = triesOf(mk, id); return h.length ? h[0][1] : null; }
  function quickForm(mk, id) {
    const modes = MODES;
    const m = modeOf(mk) || modes.find(x => x.kind === "pve") || modes[0];
    // Primero los que puedes montar (los que ya tienen intentos, delante); los que piden ninjas que no tienes, al final y marcados.
    const nMiss = x => (x.miss || []).length;
    const alts = altsOf(m).slice().sort((x, y) => (nMiss(x) > 0) - (nMiss(y) > 0) || (triesOf(m.k, y.id).length > 0) - (triesOf(m.k, x.id).length > 0));
    const a = alts.find(x => x.id === id) || alts.find(x => !nMiss(x) && !x.puppet) || alts[0];
    const last = lastTryOf(m.k, a.id), s = last && last.setup;
    const t2 = s ? { ...a, mainSel: s.mainSel || a.mainSel, summon: s.summon || "", summonM: s.summonM || "", assist: s.assist || a.assist } : a;
    const units = lineup({ cells: placeCells(a.cells), mainSel: t2.mainSel || {}, summon: t2.summon || "" });
    const main = units.find(u => u.n.m);
    return `<input type="hidden" name="qt_alt" value="${esc(a.id)}">
      <div class="loadout"><label>${L("Modo", "Mode")}<select name="qt_mode">${modes.map(x => `<option value="${escAttr(x.k)}"${x.k === m.k ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
        <label>${L("Equipo", "Team")}<select name="qt_pick">${alts.map(x => `<option value="${esc(x.id)}"${x.id === a.id ? " selected" : ""}>${esc((/^[A-Z]$/.test(x.id) ? x.id + " · " : "") + altShort(x.label))}${nMiss(x) ? L(` (te falta${nMiss(x) > 1 ? "n" : ""} ${nMiss(x)})`, ` (${nMiss(x)} missing)`) : triesOf(m.k, x.id).length ? "" : L(" (sin probar)", " (untried)")}</option>`).join("")}</select></label></div>
      <div class="best-faces" style="margin:4px 0">${(a.cells || []).filter(Boolean).map(c => BY.get(c) ? pic(c, BY.get(c).n) : "").join("")}</div>
      <div class="loadout">${m.kind === "pvp"
        ? `<label>${L("Resultado", "Result")}<select name="result"><option value="win">${L("Victoria", "Win")}</option><option value="loss">${L("Derrota", "Loss")}</option></select></label><label>${L("Equipo rival", "Rival team")}<input type="text" name="rival" placeholder="${L("p. ej. Obito RM", "e.g. Obito RM")}"></label>`
        : `<label>${m.kind === "exam" ? L("Piso alcanzado", "Floor reached") : L("Daño total", "Total damage")}<input type="text" name="damage" required autocomplete="off" placeholder="${m.kind === "exam" ? L("p. ej. 120", "e.g. 120") : L("p. ej. 3,78M o 3.780.000", "e.g. 3.78M or 3,780,000")}"><span class="note dmg-read" aria-live="polite"></span></label>`}
        <label>${L("Poder", "Power")}<input type="number" name="power" min="0" step="1000" inputmode="numeric" value="${+profile.power || ""}"></label></div>
      <details class="qt-more"><summary>${L("Más detalles (opcional): quién cayó, montaje y notas", "More details (optional): who fell, setup and notes")}</summary>
      <div class="fallen"><span class="note">${L("¿Quién cayó?", "Who fell?")}</span> ${units.map(u => `<label class="chk"><input type="checkbox" value="${escAttr(u.n.s)}" data-qt-fallen> ${esc(shortName(u.n))}</label>`).join("")}</div>
      ${setupForm(t2, main, last ? L("Montaje: el de tu último intento con este equipo (tócalo si cambiaste algo)", "Setup: from your last attempt with this team (change it if you changed something)") : L("Montaje: el de la tarjeta (tócalo si cambiaste algo)", "Setup: the card's (change it if you changed something)"))}
      <input type="text" name="notes" placeholder="${L("Notas (opcional): quién cayó y en qué ronda, qué falló…", "Notes (optional): who fell and in which round, what failed…")}" aria-label="${L("Notas", "Notes")}"></details>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-qt-close>${L("Cancelar", "Cancel")}</button><button class="btn primary" type="submit">${L("Guardar intento", "Save attempt")}</button></div>`;
  }
  let qtLast = null;
  function openQuickTry(key) {
    const [mk, id] = String(key || "").split(":");
    qtLast = document.activeElement;
    $("qtForm").innerHTML = quickForm(mk || ui.mode, id);
    $("qtBack").hidden = false; document.body.classList.add("modal-open");
    const f = $("qtForm").querySelector('[name="damage"], [name="result"]'); if (f) f.focus();
  }
  // ---------------- FICHA RÁPIDA DE NINJA: kit, tier, tus estrellas, en qué equipos tuyos va y cómo conseguirlo.
  const TIER_CAT = EN ? { carry: "PvP carry", sup: "PvP support", ii: "Infinite Illusion" } : { carry: "Carry PvP", sup: "Soporte PvP", ii: "Infinite Illusion" };
  // ---- Consulta de un ninja: ¿se usa?, ¿dónde?, ¿4★ y breakthrough?, ¿con qué main y con quién? (NINJA_USO = build_ninja_uso.py)
  function ninjaAdvice(s) {
    const n = BY.get(s); if (!n || n.m) return null;
    const UM = (typeof NINJA_USO !== "undefined" && NINJA_USO.meta) || { nxN: 1, khN: 1 }, U = (typeof NINJA_USO !== "undefined" && NINJA_USO.by[s]) || {};
    const nm = x => (BY.get(x) || { n: x }).n, sn = x => nm(x).split(" [")[0];
    const tiers = ["carry", "sup", "ii"].flatMap(k => (TIER[k] || []).filter(r => r.s === s && !r.est).map(r => ({ ...r, k })));
    const bestT = tiers.map(r => r.t).sort((a, b) => "SABCD".indexOf(a) - "SABCD".indexOf(b))[0] || "";
    const nxP = U.nx ? U.nx.n / UM.nxN * 100 : 0, khP = U.kh ? U.kh.n / UM.khN * 100 : 0;
    // PvE: equipos de II_TOP y equipos ideales donde sale
    const pve = [];
    II_TOP.forEach(st => st.teams.forEach(t => t.core.forEach(([x, role, alts]) => {
      const conf = t.conf ? L(` (confianza ${t.conf.toLowerCase()})`, ` (${({ Alta: "high", Media: "medium", Baja: "low" })[t.conf] || t.conf} confidence)`) : "";
      if (x === s) pve.push({ k: st.k, t: (x === t.core[0][0] ? L(`carry de su propio equipo`, `carry of its own team`) : L(`en el equipo de ${sn(t.core[0][0])}`, `in ${sn(t.core[0][0])}'s team`)) + (EN ? conf : `: ${role.charAt(0).toLowerCase() + role.slice(1)}${conf}`) });
      else if ((alts || []).includes(s)) pve.push({ k: st.k, t: L(`alternativa a ${sn(x)} en el equipo de ${sn(t.core[0][0])}${conf}`, `alternative to ${sn(x)} in ${sn(t.core[0][0])}'s team${conf}`) });
    })));
    const ideal = IDEAL.filter(m => m.alts.some(a => (a.cells || []).includes(s))).map(m => m.name);
    const level = bestT === "S" || nxP >= 5 || khP >= 5 ? ["Meta", "Alta", L("Lo usa mucha gente del top", "Many top players use it")]
      : bestT === "A" || nxP >= 1 || khP >= 2 || pve.length || ideal.length ? [L("Útil", "Useful"), "Media", L("Tiene su sitio, aunque no está en todos los equipos", "It has its place, though it isn't in every team")]
      : bestT || U.nx || U.kh ? [L("De nicho", "Niche"), "Baja", L("Sale poco: solo compensa en equipos concretos", "Rarely used: only worth it in specific teams")]
      : [L("No se usa", "Not used"), "Baja", L("No aparece en el top ni en las tier lists", "It doesn't show up in top teams or tier lists")];
    const where = [];
    if (U.nx || U.kh) {
      const p1 = Math.round(((U.nx ? U.nx.p1 * U.nx.n : 0) + (U.kh ? U.kh.p1 * U.kh.n : 0)) / ((U.nx ? U.nx.n : 0) + (U.kh ? U.kh.n : 0)));
      where.push(EN ? `Arena: ${[U.nx ? `${U.nx.n} of ${UM.nxN} Nexus top formations (${nxP.toFixed(1)}%)` : "", U.kh ? `${U.kh.n} of ${UM.khN} in KonohaHub's Top 100` : ""].filter(Boolean).join(" and ")}. ${p1 >= 40 ? `Plays as carry: acts first in ${p1}% of them.` : p1 >= 10 ? `Usually a support (acts first in only ${p1}%).` : "Plays as support: almost never acts first."}`
        : `Arena: ${[U.nx ? `${U.nx.n} de ${UM.nxN} formaciones top de Nexus (${nxP.toFixed(1).replace(".", ",")}%)` : "", U.kh ? `${U.kh.n} de ${UM.khN} del Top 100 de KonohaHub` : ""].filter(Boolean).join(" y ")}. ${p1 >= 40 ? `Va de carry: actúa el primero en el ${p1}% de ellas.` : p1 >= 10 ? `Suele ir de soporte (actúa el primero solo en el ${p1}%).` : "Va de soporte: casi nunca actúa el primero."}`);
    }
    const TL = EN ? { carry: "PvP carry", sup: "PvP support", ii: "Infinite Illusion" } : { carry: "carry PvP", sup: "soporte PvP", ii: "Infinite Illusion" };
    if (tiers.length) where.push("Tier list: " + tiers.map(r => L(`${r.t} de ${TL[r.k]}`, `${r.t} as ${TL[r.k]}`)).join(", ") + ".");
    const stages = [...new Set(pve.map(x => x.k))];
    stages.forEach(k => where.push(`${k}: ${pve.filter(x => x.k === k).map(x => x.t).join("; ")}.`));
    if (ideal.length) where.push(L(`En los equipos ideales de: ${[...new Set(ideal)].join(", ")}.`, `In the ideal teams for: ${[...new Set(ideal)].map(tr).join(", ")}.`));
    const used = level[1] !== "Baja";
    // Estrellas y breakthrough. Regla: todo breakthrough se abre a 4★; sin breakthrough, el 4★ solo da stats.
    const b = BTI[s], hasBT = !!b || U.bt === 1, noBT = !b && U.bt === 0, o = profile.owned[s];
    const order = U.btp ? { t: U.btp.map(g => g.map(btName).join(L(" o ", " or "))).join(" → "), src: "Nexus" } : b && b.f.length ? { t: b.f.map(btName).join(" → ") + L(" primero", " first"), src: L("KonohaHub y Nexus", "KonohaHub and Nexus") } : null;
    const stars = hasBT
      ? [L(`Tiene breakthrough: se abre a 4★ y después cada rama se rompe y se mejora con viales.`, `It has a breakthrough: it opens at 4★, then each branch is broken and upgraded with vials.`),
         used ? L(`¿Merece el 4★? Si lo vas a usar en alguno de los sitios de arriba, sí.`, `Worth 4★? Yes, if you'll use it in any of the places above.`) : L(`¿Merece el 4★? Solo si lo vas a usar: hoy apenas sale en el top.`, `Worth 4★? Only if you'll use it: it barely shows up in top teams today.`),
         order ? L(`Orden de ramas: ${order.t} (${order.src}).`, `Branch order: ${order.t} (${order.src}).`) : "", BT_NOTE[s] ? tc(BT_NOTE[s][1]) + "." : ""]
      : noBT ? [L("No tiene breakthrough: subirlo a 4★ solo le da stats. Gasta los fragmentos en otro.", "No breakthrough: 4★ only gives it stats. Spend the fragments on someone else.")]
      : [L("No tengo datos de su breakthrough.", "I have no data on its breakthrough.")];
    const mine = o ? L(`Tú lo tienes a ${o.st || 0}★${o.bt ? " con breakthrough" : ""}.`, `You have it at ${o.st || 0}★${o.bt ? " with breakthrough" : ""}.`) : L("No lo tienes.", "You don't have it.");
    // Cómo se juega: main y compañeros más habituales (Nexus + KonohaHub juntos)
    const add = (acc, xs) => (xs || []).forEach(([x, k]) => acc.set(x, (acc.get(x) || 0) + k));
    const mains = new Map(), mates = new Map(); add(mains, U.nx && U.nx.mains); add(mains, U.kh && U.kh.mains); add(mates, U.nx && U.nx.mates); add(mates, U.kh && U.kh.mates);
    const tot = (U.nx ? U.nx.n : 0) + (U.kh ? U.kh.n : 0);
    const topMain = [...mains].sort((a, b) => b[1] - a[1]).slice(0, 2), topMates = [...mates].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { n, level, where, stars, mine, topMain, topMates, tot, used, UM };
  }
  // Formaciones reales de Nexus de menos de 4M de poder en las que sale (NX_FORMS): lo que juega una cuenta pequeña.
  // La misma formación con otro main cuenta como una; primero las que te faltan menos.
  const LOW_CP = 4;
  function lowForms(s) {
    const agg = new Map();
    NXF().filter(f => f.cp <= LOW_CP && f.m.includes(s)).forEach(f => { const k = memKey(f.m), a = agg.get(k), mn = f.m.find(isMainS);
      if (a) { a.cp = (a.cp * a.n + f.cp * f.n) / (a.n + f.n); a.n += f.n; a.mains[mn] = (a.mains[mn] || 0) + f.n; }
      else agg.set(k, { k, mem: f.m.filter(x => !isMainS(x)), cp: f.cp, n: f.n, mains: { [mn]: f.n } }); });
    return [...agg.values()].map(f => ({ ...f, main: Object.entries(f.mains).sort((a, b) => b[1] - a[1])[0][0], miss: f.mem.filter(x => !profile.owned[x]).length }))
      .sort((a, b) => a.miss - b.miss || b.n - a.n || a.cp - b.cp);
  }
  // «¿Y en una cuenta pequeña?» automática para las fichas sin respuesta escrita a mano: con 0-1 jugadores de menos
  // de 4M en Nexus no hay base para más (las escritas a mano son las de los ninjas que se juegan con poco poder).
  function autoPequena(s, C) {
    const nm = x => (BY.get(x) || { n: x }).n, all = NXF().filter(f => f.m.includes(s));
    const lowN = all.filter(f => f.cp <= LOW_CP).reduce((a, f) => a + f.n, 0), totN = all.reduce((a, f) => a + f.n, 0);
    const good = C && /^(Meta|Útil)$/.test(C.veredicto), auto = L(" (Automático, con los datos de Nexus.)", " (Automatic, from Nexus data.)");
    // un ninja del top que casi no sale con poco poder: no es «poca base», es un objetivo para más adelante
    if (good && totN >= 10) return L(`Con poco poder ${lowN ? `casi no sale (${lowN === 1 ? "1 jugador" : lowN + " jugadores"} con menos de ${LOW_CP}M)` : "no sale"}, pero las cuentas con más poder sí lo eligen (${totN} jugadores de Nexus). Eso es porque cuesta conseguirlo, no porque no rinda: si lo tienes, úsalo.`,
      `At low power it ${lowN ? `barely shows up (${lowN === 1 ? "1 player" : lowN + " players"} under ${LOW_CP}M)` : "doesn't show up"}, but higher-power accounts do pick it (${totN} Nexus players). That's because it's hard to get, not because it underperforms: if you have it, use it.`) + auto;
    if (lowN) { const mates = [...new Set(lowForms(s).flatMap(f => f.mem))].filter(x => x !== s).slice(0, 2).map(nm);
      return L(`Con poco poder casi no sale: ${lowN === 1 ? "1 jugador" : lowN + " jugadores"} con menos de ${LOW_CP}M${mates.length ? ` (con ${mates.join(" y ")})` : ""}. Poca base para recomendarlo: úsalo solo si ya lo tienes y te encaja.`,
        `At low power it barely shows up: ${lowN === 1 ? "1 player" : lowN + " players"} under ${LOW_CP}M${mates.length ? ` (with ${mates.join(" and ")})` : ""}. Little basis to recommend it: use it only if you already have it and it fits.`) + auto; }
    if (totN) return L(`No sale en ninguna formación de menos de ${LOW_CP}M: los ${totN} jugadores de Nexus que lo llevan tienen más poder.`, `It isn't in any formation under ${LOW_CP}M: the ${totN} Nexus players who use it have more power.`)
      + (good ? L(" Si lo tienes, úsalo: lo eligen cuentas que pueden elegir mucho.", " If you have it, use it: accounts that can choose a lot pick it.") : L(" Y arriba tampoco es de los más usados: no es prioridad.", " And it isn't among the most used higher up either: not a priority.")) + auto;
    return L("No sale en ninguna formación de Nexus, ni con poco ni con mucho poder.", "It isn't in any Nexus formation, at low or high power.")
      + (C && C.veredicto === "No se usa" ? L(" No compensa invertir en él.", " It isn't worth investing in.") : L(" Úsalo si encaja en un equipo que ya tengas o en una prueba concreta (mira «Dónde se usa»).", " Use it if it fits a team you already have or a specific trial (see «Where it's used»).")) + auto;
  }
  // Quién lo usa según el poder de la cuenta: cuántos jugadores de Nexus lo llevan en cada tramo y, si su ficha la tiene,
  // la frase escrita a mano (CONSULTAS.tramos). No es un límite: el poder mide tiempo y gasto. Mucho uso arriba = muy bueno
  // (lo elige quien puede elegir cualquiera); uso solo abajo = fácil de conseguir y se cambia en cuanto se puede.
  const BANDS = [["inicio", 0, 4], ["media", 4, 7], ["alta", 7, 10], ["top", 10, 99]];
  function bandsHtml(s, C) {
    const rows = BANDS.map(([k, lo, hi]) => { const F = NXF().filter(f => f.cp > lo && f.cp <= hi);
      return { k, lo, hi, n: F.filter(f => f.m.includes(s)).reduce((a, f) => a + f.n, 0), tot: F.reduce((a, f) => a + f.n, 0) }; });
    if (!rows.some(r => r.n)) return "";
    const T = (C && C.tramos) || {};
    const lbl = r => r.hi >= 99 ? L(`Más de ${r.lo}M`, `Above ${r.lo}M`) : r.lo ? `${r.lo}–${r.hi}M` : L(`Menos de ${r.hi}M`, `Under ${r.hi}M`);
    const note = r => r.k === "inicio" ? (C && C.rapida && C.rapida.pequena ? L("Mira «¿Y en una cuenta pequeña?» arriba.", "See «And on a small account?» above.") : "") : T[r.k] || "";
    return `<h3 class="nf-h">${L("Quién lo usa, según el poder de la cuenta", "Who uses it, by account power")}</h3>
      <p class="note" style="margin:0 0 8px">${L("No es un límite: el poder solo mide tiempo jugado y gasto. Si sale mucho con más de 10M es que lo eligen quienes pueden elegir cualquier ninja (muy buena señal); si solo sale con poco poder, es fácil de conseguir y se cambia en cuanto se puede.", "It's not a limit: power only measures time played and spending. If it shows up a lot above 10M, it's chosen by players who can pick any ninja (a very good sign); if it only shows up at low power, it's easy to get and gets replaced as soon as possible.")}</p><div class="nf-bands">${rows.map(r => `<div class="nf-band">
        <div class="nf-band-top"><b>${lbl(r)}</b><span class="note mono">${L(`${r.n} de ${r.tot} jugadores`, `${r.n} of ${r.tot} players`)}</span></div>
        <div class="nf-band-bar"><i style="width:${Math.max(r.n ? 3 : 0, Math.round(r.n / (r.tot || 1) * 100))}%"></i></div>
        ${note(r) ? `<div class="note">${esc(note(r))}</div>` : ""}</div>`).join("")}</div>
      <p class="note" style="margin:6px 0 0">${L(`Jugadores del top-10 de su servidor que lo llevan, por el poder de su formación. Nexus, meta del ${esc(dShort(NX_FORMS.date))}.`, `Top-10 players of their server who use it, by formation power. Nexus, meta of ${esc(dShort(NX_FORMS.date))}.`)}</p>`;
  }
  // «Parecidos y sustitutos»: quién puede hacer su trabajo si no lo tienes. Dos partes, para no mezclar cosas distintas:
  // 1) En sus equipos del top: formaciones de Nexus con los mismos dos compañeros y otro ninja en su hueco. Es un cambio
  //    probado, pero solo vale para ese equipo (un hueco libre lo llena cualquiera que encaje con esos dos).
  // 2) Trabajo parecido: II_TOP los da como alternativa, o tienen el mismo papel (lleva el daño o no,
  //    rol) y su kit hace cosas parecidas (cura, quita debuffs, persigue lo mismo...). Solo ninjas que se usan de verdad,
  //    para no proponer uno parecido pero flojo. Nunca el mismo personaje. Deducción con esos datos.
  let swapIdx = null;
  function swapIndex() {
    if (swapIdx) return swapIdx;
    swapIdx = new Map();   // «los otros dos» → Map(ninja → jugadores)
    NXF().forEach(f => { const mem = f.m.filter(x => !isMainS(x));
      mem.forEach(x => { const k = mem.filter(y => y !== x).sort().join("+"), m = swapIdx.get(k) || new Map(); m.set(x, (m.get(x) || 0) + f.n); swapIdx.set(k, m); }); });
    return swapIdx;
  }
  // Qué hace su kit, leído de las descripciones (frases con «cannot» y similares no cuentan: «no puede ser curado» no cura).
  // Las cuatro primeras son raras y dicen mucho de su papel; las otras cuatro las tiene medio juego y pesan menos.
  const JOB_FX = [["heal", /\bheal(s|ing)?\b|restores? [^.]*\bHP\b|recovers? [^.]*\bHP\b/i, "cura", "heals", 1.2],
    ["cleanse", /(cancels?|removes?|dispels?|clears?) [^.]{0,25}Debuffs|cleanse/i, "quita debuffs", "removes debuffs", 1.2],
    ["revive", /reviv|resurrect/i, "revive", "revives", 1.2],
    ["chakraUp", /(gains?|restores?|recovers?|increases?|gives?) [^.]{0,25}\bchakra\b(?! cost)/i, "da chakra", "gives chakra", 1.2],
    ["shield", /shield|Barrier/i, "da escudos", "gives shields", 0.6],
    ["control", /Immobile|Paralysis|Sleep|Chaos|Fear|Blind|Slowness|Horror/i, "controla (inmoviliza, ciega…)", "controls (Immobile, Blind…)", 0.6],
    ["dot", /Ignition|Poison|Acupuncture|Amaterasu|Laceration|Melt|Corrosion/i, "daño continuo (Ignition, Poison…)", "damage over time (Ignition, Poison…)", 0.6],
    ["protect", /damage [^.]{0,30}(reduced|decreased)|reduces? [^.]{0,30}damage (suffered|received|taken)|immune to/i, "protege (reduce daño o da inmunidad)", "protects (damage reduction or immunity)", 0.6]];
  const JOB_RARE = new Set(["u:heal", "u:cleanse", "u:revive", "u:chakraUp"]);
  const JOB_NEG = /cannot|can't|unable|Suppress Healing|reduc\w* [^.]{0,20}heal/i;
  const JOB_TAGS = new Set(["Edo Tensei", "Akatsuki", "Jinchuriki", "Otsutsuki Clan", "Uchiha Clan", "Senju Clan", "Uzumaki Clan", "Sword-User", "Senjutsu", "Rinnegan", "Curse Mark", "Puppet"]);
  const jobC = new Map();
  function jobOf(n) {
    if (jobC.has(n.s)) return jobC.get(n.s);
    const sk = n.sk || [], fr = sk.flatMap(k => (k.d || "").split(/(?<=\.)\s/)).filter(x => !JOB_NEG.test(x)), f = new Map(), st = x => x.replace(/^Level 2 - /, "");
    JOB_FX.forEach(([k, r, , , w]) => { if (fr.some(x => r.test(x))) f.set("u:" + k, w); });
    f.set("ro:" + n.ro, 1.5); f.set("carry:" + (p1Of(n.s) >= 40), 2.5);
    sk.filter(k => k.t === "Chase").forEach(k => { (k.tr || []).forEach(x => f.set("tr:" + x, 1)); (k.ca || []).filter(c => !/Combo$/.test(c)).forEach(x => f.set("ca:" + st(x), 0.6)); });
    sk.filter(k => k.t === "Mystery").forEach(k => (k.ca || []).filter(c => !/Combo$/.test(c)).forEach(x => f.set("my:" + st(x), 0.6)));
    (n.tg || []).filter(x => JOB_TAGS.has(x)).forEach(x => f.set("tg:" + x, 0.4));
    jobC.set(n.s, f); return f;
  }
  const jobSim = (a, b) => { let i = 0, u = 0; new Set([...a.keys(), ...b.keys()]).forEach(k => { const x = a.get(k) || 0, y = b.get(k) || 0; i += Math.min(x, y); u += Math.max(x, y); }); return u ? i / u : 0; };
  // Lo que comparten, en palabras: «también lleva el daño; cura y quita debuffs; persigue Knockdown».
  function jobWhy(a, b, ro) {
    const both = [...a.keys()].filter(k => b.has(k)), of = p => both.filter(k => k.startsWith(p)).map(k => k.slice(p.length));
    const fx = of("u:").map(k => JOB_FX.find(x => x[0] === k)).map(x => L(x[2], x[3])), tr = of("tr:"), my = of("my:");
    return [a.get("carry:true") && b.get("carry:true") ? L("también lleva el daño", "also carries the damage") : ro ? L(`también es ${ro} y acompaña al que pega`, `also a ${ro} that backs up the damage dealer`) : L("también acompaña al que pega", "also backs up the damage dealer"),
      fx.length ? fx.slice(0, 3).join(", ") : "", tr.length ? L(`persigue ${tr.join(" y ")}`, `chases ${tr.join(" and ")}`) : "",
      my.length ? L(`su mystery causa ${my.slice(0, 2).join(" y ")}`, `its mystery causes ${my.slice(0, 2).join(" and ")}`) : ""].filter(Boolean).join("; ");
  }
  // Que se use de verdad: en el top de Nexus o KonohaHub (4+ jugadores) o con veredicto Meta/Útil en su ficha.
  const provenN = s => { const u = (NINJA_USO.by || {})[s] || {}; return ((u.nx || {}).n || 0) >= 4 || ((u.kh || {}).n || 0) >= 4 || /^(Meta|Útil)$/.test(VERDOF(s)); };
  function similarOf(s) {
    const n = BY.get(s); if (!n || n.m) return { teams: [], alike: [] };
    const me = charOf(n), okY = y => { const ny = BY.get(y); return ny && !ny.m && y !== s && charOf(ny) !== me; };
    // 1) por equipo: sus 3 equipos más jugados, y quién va en su hueco con esos mismos dos compañeros
    const ctx = new Map();
    NXF().forEach(f => { const mem = f.m.filter(x => !isMainS(x)); if (!mem.includes(s)) return; const k = mem.filter(y => y !== s).sort().join("+"); ctx.set(k, (ctx.get(k) || 0) + f.n); });
    const teams = [...ctx].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ mates: k.split("+"), c,
      alt: [...(swapIndex().get(k) || new Map())].filter(([y, cy]) => okY(y) && cy >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([y, cy]) => ({ s: y, c: cy })) }))
      .filter(t => t.alt.length).slice(0, 3);
    // 2) trabajo parecido: II_TOP + kit; los cambios del top suman si además el papel se parece
    const J = jobOf(n), out = new Map(), sw = new Map(), uses = [...ctx.values()].reduce((a, b) => a + b, 0) || 1;
    teams.forEach(t => t.alt.forEach(a => sw.set(a.s, (sw.get(a.s) || 0) + a.c)));
    const add = (y, pts, why) => { if (!okY(y)) return; const o = out.get(y) || { s: y, score: 0, why: [] }; o.score += pts; if (why && !o.why.includes(why)) o.why.push(why); out.set(y, o); };
    (typeof II_TOP !== "undefined" ? II_TOP : []).forEach(st => st.teams.forEach(tm => tm.core.forEach(([x, , alts]) => {
      const why = L(`Se usan como alternativa en ${st.k}.`, `They're used as alternatives in ${st.k}.`);
      if (x === s) (alts || []).forEach(y => { if (!out.has(y) || !out.get(y).guide) { add(y, 3, why); out.get(y) && (out.get(y).guide = true); } });
      else if ((alts || []).includes(s) && (!out.has(x) || !out.get(x).guide)) { add(x, 3, why); out.get(x) && (out.get(x).guide = true); }
    })));
    D.ninjas.forEach(y => { if (!okY(y.s)) return; const g = out.has(y.s), c = sw.get(y.s) || 0;
      if (!g && !c && !provenN(y.s)) return;
      const Y = jobOf(y), v = jobSim(J, Y), carry = !!J.get("carry:true"), sameCarry = carry === !!Y.get("carry:true");
      // algo concreto en común: los que llevan el daño, en su cadena de chases; los demás, también en lo que hace su kit
      const shared = [...J.keys()].filter(k => Y.has(k)), mech = shared.filter(k => /^(tr|ca|my):/.test(k) && !/^my:(Knockdown|Interruption)$/.test(k)).length, fx = shared.filter(k => JOB_RARE.has(k)).length;
      const swapOk = c >= 2 && sameCarry && v >= 0.3;
      const kitOk = sameCarry && (carry ? mech >= 2 && v >= 0.5 : (mech + fx) >= 1 && (v >= 0.5 || (v >= 0.4 && fx >= 1 && y.ro === n.ro)));
      if (!g && !swapOk && !kitOk) return;
      add(y.s, v * 3 + (swapOk ? 1 + Math.min(1.5, (c / uses) * 6) : 0), "");
      const o = out.get(y.s); o.kit = (mech + fx) || swapOk ? jobWhy(J, Y, y.ro === n.ro && n.ro !== "Damage" ? L({ Support: "soporte", Tank: "tanque" }[n.ro], n.ro === "Tank" ? "tank" : "support") : "") : ""; o.swap = swapOk ? c : 0; });
    // uno por personaje (el mejor), para que la lista no se llene de versiones del mismo
    const seen = new Set(), alike = [...out.values()].sort((a, b) => (b.score + (profile.owned[b.s] ? 0.5 : 0)) - (a.score + (profile.owned[a.s] ? 0.5 : 0)))
      .filter(o => { const c = charOf(BY.get(o.s)); if (seen.has(c)) return false; seen.add(c); return true; }).slice(0, 5);
    return { teams, alike };
  }
  function similarHtml(s) {
    const R = similarOf(s); if (!R.teams.length && !R.alike.length) return "";
    const nm = x => (BY.get(x) || { n: x }).n, sh = x => nm(x).replace(/^(\S+) \S+ \[/, "$1 ["), own = x => !!profile.owned[x], has = own(s);
    const chip = a => `<button type="button" class="sim-alt${own(a.s) ? " on" : ""}" data-sim="${esc(a.s)}">${pic(a.s, nm(a.s))}<span>${esc(sh(a.s))} <span class="note">×${a.c}</span>${own(a.s) ? ` <span class="tag-own">${L("tuyo", "yours")}</span>` : ""}</span></button>`;
    const teamsH = R.teams.length ? `<p class="note" style="margin:0 0 6px">${L("En sus equipos del top, con los mismos dos compañeros, en su hueco también ponen (×N = jugadores):", "In its top teams, with the same two teammates, players also put in its slot (×N = players):")}</p>
      <div class="sim-teams">${R.teams.map(t => `<div class="sim-team"><div class="sim-ctx">${L("Con", "With")} <b>${esc(t.mates.map(sh).join(L(" y ", " and ")))}</b> <span class="note">· ${L(`${t.c} jugadores con él`, `${t.c} players with it`)}</span></div><div class="sim-alts">${t.alt.map(chip).join("")}</div></div>`).join("")}</div>` : "";
    const alikeH = R.alike.length ? `<h4 class="sim-h">${L("Hacen un trabajo parecido", "Do a similar job")}</h4>
      <div class="nf-mates nf-mates-wide">${R.alike.map(o => `<div class="nf-mate">${pic(o.s, nm(o.s))}<div style="min-width:0"><button type="button" class="sim-name" data-sim="${esc(o.s)}">${esc(nm(o.s))}</button> ${own(o.s) ? `<span class="tag-own">${L("tuyo", "yours")}</span>` : wantTag({ acq: acqOf(o.s) })}
        <div class="note">${esc([...o.why, o.kit ? L(`Kit: ${o.kit}.`, `Kit: ${o.kit}.`) : "", o.swap ? L(`En el top lo ponen en su lugar ${o.swap} veces.`, `Top players put it in its place ${o.swap} times.`) : ""].filter(Boolean).join(" "))}</div></div></div>`).join("")}</div>` : "";
    const mine = new Set([...R.teams.flatMap(t => t.alt.map(a => a.s)), ...R.alike.map(o => o.s)].filter(own)).size;
    return `<h3 class="nf-h">${L("Parecidos y sustitutos", "Similar ninjas and substitutes")}</h3>
      <p class="note" style="margin:0 0 8px">${has ? L("Por si quieres cambiarlo o no lo tienes a punto.", "In case you want to swap it or it isn't ready yet.") : L("No lo tienes: estos pueden hacer su trabajo.", "You don't have it: these can do its job.")}${mine ? L(` De los que salen, tienes ${mine}.`, ` Of the ones listed, you have ${mine}.`) : ""}</p>
      ${teamsH}${alikeH}
      <p class="note" style="margin:6px 0 0">${L(`Deducción mía con las formaciones del top de Nexus (meta del ${esc(dShort(NX_FORMS.date))}), las alternativas habituales de Infinite Illusion y sus habilidades. Un cambio de equipo solo vale con esos mismos compañeros. Toca un nombre para abrir su ficha.`,
        `My own deduction from Nexus top formations (meta of ${esc(dShort(NX_FORMS.date))}), the usual Infinite Illusion alternatives and their skills. A team swap only holds with those same teammates. Tap a name to open its sheet.`)}</p>`;
  }
  function lowHtml(s, skip = []) {
    const L4 = lowForms(s).filter(f => !skip.includes(f.k)); if (!L4.length) return "";
    const nm = x => (BY.get(x) || { n: x }).n, tot = L4.reduce((a, f) => a + f.n, 0);
    let ar = []; try { ar = altsOf(modeOf("ar")) || []; } catch {}
    const row = f => { const a = ar.find(x => memKey(x.cells) === f.k), key = a ? "ar:" + a.id : "";
      return `<div class="nf-team"><div class="nf-team-faces">${[...f.mem, f.main].map(x => pic(x, nm(x))).join("")}</div>
        <div class="nf-team-txt"><b>${esc(f.mem.map(x => nm(x).replace(/^(\S+) \S+ \[/, "$1 [")).join(" + "))}</b> <span class="note">· ${esc(nm(f.main))}</span>
          <div class="note">${f.n > 1 ? L(`${f.n} jugadores, ${cpM(f.cp)}M de poder medio`, `${f.n} players, ${cpM(f.cp)}M average power`) : L(`1 jugador, con ${cpM(f.cp)}M de poder`, `1 player, at ${cpM(f.cp)}M power`)}</div>
          <span class="chip${f.miss ? "" : " on"}">${f.miss ? L(`te falta${f.miss > 1 ? "n" : ""} ${f.miss}`, `${f.miss} missing`) : L("lo tienes todo", "you have them all")}</span></div>
        ${key ? `<div class="nf-team-act"><button class="btn small primary" data-alt-open="${esc(key)}">${L("Abrir en el creador", "Open in Builder")}</button><button class="btn small" data-alt-save="${esc(key)}">${L("Guardar", "Save")}</button></div>` : ""}</div>`; };
    return `<h3 class="nf-h">${L(`En cuentas con poco poder (menos de ${LOW_CP}M)`, `On low-power accounts (under ${LOW_CP}M)`)}</h3>
      <div class="nf-teams">${L4.slice(0, 4).map(row).join("")}</div>
      <p class="note" style="margin:6px 0 0">${L(`Formaciones reales del top-10 de servidores con poco poder: sale en ${L4.length} distinta${L4.length > 1 ? "s" : ""} (${tot} jugador${tot > 1 ? "es" : ""}). Nexus, meta del ${esc(dShort(NX_FORMS.date))}.`,
        `Real formations from the top 10 of low-power servers: it's in ${L4.length} different one${L4.length > 1 ? "s" : ""} (${tot} player${tot > 1 ? "s" : ""}). Nexus, meta of ${esc(dShort(NX_FORMS.date))}.`)}</p>`;
  }
  const CONS = () => (typeof CONSULTAS !== "undefined" ? CONSULTAS : {});
  const VERD = { "Meta": "Alta", "Útil": "Media", "De nicho": "Baja", "No se usa": "Baja" };
  const VERD_EN = { "Meta": "Meta", "Útil": "Useful", "De nicho": "Niche", "No se usa": "Not used" };
  // Datos automáticos del top (siempre): en las fichas revisadas van plegados debajo; en las demás, son la ficha.
  function autoHtml(A) {
    const nm = x => (BY.get(x) || { n: x }).n;
    return `<h3 class="nf-h">${L("Dónde se usa", "Where it's used")}</h3>${A.where.length ? `<ul class="why">${A.where.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : `<p class="note" style="margin:0">${L("No aparece en las formaciones top (Nexus, KonohaHub) ni en los equipos de PvE que tengo.", "It doesn't appear in top formations (Nexus, KonohaHub) or in the PvE teams I have.")}</p>`}
      <h3 class="nf-h">${L("Estrellas y breakthrough", "Stars and breakthrough")}</h3><ul class="why">${A.stars.filter(Boolean).map(w => `<li>${esc(w)}</li>`).join("")}</ul>
      ${A.tot ? `<h3 class="nf-h">${L("Cómo lo juega el top", "How top players use it")}</h3>
        ${A.topMain.length ? `<p class="note" style="margin:0 0 6px">Main: ${A.topMain.map(([x, k]) => `<b>${esc(nm(x))}</b> (${k} ${L("de", "of")} ${A.tot})`).join(", ")}.</p>` : ""}
        ${A.topMates.length ? `<div class="nf-mates">${A.topMates.map(([x, k]) => `<div class="nf-mate">${pic(x, nm(x))}<div><b>${esc(nm(x))}</b>${profile.owned[x] ? ` <span class="tag-own">${L("tuyo", "yours")}</span>` : ""}<div class="note">${L("juntos en", "together in")} ${k}</div></div></div>`).join("")}</div>` : ""}
        <p class="note" style="margin:6px 0 0">${L(`Nexus (meta del ${esc(A.UM.nxDate.split("-").reverse().join("/"))}) y Top 100 de KonohaHub (${esc(A.UM.khDate.split("-").reverse().join("/"))}).`, `Nexus (meta of ${esc(A.UM.nxDate.split("-").reverse().join("/"))}) and KonohaHub's Top 100 (${esc(A.UM.khDate.split("-").reverse().join("/"))}).`)}</p>` : ""}`;
  }
  function adviceHtml(A) {
    const C0 = CONS()[A.n.s], nm = x => (BY.get(x) || { n: x }).n, day = d => d.split("-").reverse().join("/");
    const C = C0;
    if (!C) return `<div class="nf-verdict"><span class="pill" data-c="${A.level[1]}">${esc(A.level[0])}</span> <span class="note">${esc(A.level[2])}. ${esc(A.mine)}</span></div>
      <dl class="nf-qa"><dt>${L("¿Cómo se consigue?", "How do you get it?")}</dt><dd>${esc(getLine(A.n.s))}</dd>${packQA(A.n.s)}</dl>
      <p class="note nf-auto">${L("Ficha automática, con los datos del top: aún no la he revisado a mano.", "Automatic sheet, built from top-player data: not hand-reviewed yet.")}</p>${similarHtml(A.n.s)}${lowHtml(A.n.s)}${bandsHtml(A.n.s, null)}${autoHtml(A)}`;
    const R = C.rapida || {}, QA = [[L("¿Se usa?", "Is it used?"), R.usa], [L("¿Para qué?", "For what?"), R.para], [L("¿4★ y BT?", "4★ and BT?"), R.estrellas], [L("¿Con quién?", "With whom?"), R.con], [L("¿Y en una cuenta pequeña?", "And on a small account?"), R.pequena || autoPequena(A.n.s, C0)], [L("¿Cómo se consigue?", "How do you get it?"), getLine(A.n.s)], [L("¿En qué packs sale?", "Which packs is it in?"), packsOf(A.n.s).length && !/^(Sale en packs|It comes in packs)/.test(getLine(A.n.s)) ? packLine(A.n.s) : ""]].filter(x => x[1]);
    // Equipos montables: los de Equipos ideales / Con tus ninjas (ref) se pueden abrir en el creador o guardar.
    const teamRow = t => { const a = t.ref ? findAlt(t.ref).a : null, m = t.ref ? findAlt(t.ref).m : null;
      const mem = (a ? a.cells.filter(Boolean) : t.m).slice().sort((x, y) => ((BY.get(x) || {}).m ? 1 : 0) - ((BY.get(y) || {}).m ? 1 : 0));
      const miss = mem.filter(x => !(BY.get(x) || {}).m && !profile.owned[x]).length;
      return `<div class="nf-team"><div class="nf-team-faces">${mem.map(x => pic(x, nm(x))).join("")}</div>
        <div class="nf-team-txt"><b>${esc(a ? altShort(a.label) : mem.filter(x => !(BY.get(x) || {}).m).map(x => nm(x).replace(/^(\S+) \S+ \[/, "$1 [")).join(" + "))}</b> <span class="note">· ${esc(nm(mem.find(x => (BY.get(x) || {}).m) || ""))}</span>
          <div class="note">${esc(t.nota || "")}${m ? ` (${esc(m.name)} ${esc(a.id)})` : ""}</div>
          <span class="chip${miss ? "" : " on"}">${miss ? L(`te falta${miss > 1 ? "n" : ""} ${miss}`, `${miss} missing`) : L("lo tienes todo", "you have them all")}</span></div>
        ${a ? `<div class="nf-team-act"><button class="btn small primary" data-alt-open="${esc(t.ref)}">${L("Abrir en el creador", "Open in Builder")}</button><button class="btn small" data-alt-save="${esc(t.ref)}">${L("Guardar", "Save")}</button></div>` : ""}</div>`; };
    return `<div class="nf-verdict"><span class="pill" data-c="${VERD[C0.veredicto] || "Media"}">${esc(EN ? VERD_EN[C0.veredicto] || C0.veredicto : C.veredicto)}</span> <span class="note">${esc(A.mine)}</span></div>
      ${QA.length ? `<dl class="nf-qa">${QA.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : `<p class="nf-p">${esc(C.resumen)}</p>`}
      ${C.equipos && C.equipos.length ? `<h3 class="nf-h">${L("Equipos con él", "Teams with it")}</h3><div class="nf-teams">${C.equipos.map(teamRow).join("")}</div>` : ""}
      ${similarHtml(A.n.s)}
      ${lowHtml(A.n.s, (C.equipos || []).filter(e => e.m).map(e => memKey(e.m)))}
      ${bandsHtml(A.n.s, C0)}
      <details class="nf-more"><summary>${L("Todo el detalle", "Full detail")}</summary>
      ${QA.length ? `<p class="nf-p" style="margin-top:8px">${esc(C.resumen)}</p>` : ""}
      <h3 class="nf-h">${L("Dónde se usa", "Where it's used")}</h3><div class="nf-uses">${C.usos.map(u => `<div class="nf-use"><div><b>${esc(u.modo)}</b> <span class="chip">${esc(u.rol)}</span></div><p class="note">${esc(u.nota)}</p></div>`).join("")}</div>
      <h3 class="nf-h">${L("Estrellas y breakthrough", "Stars and breakthrough")}</h3><p class="nf-p">${esc(C.estrellas)}</p>
      ${C.btOrden ? `<div class="nf-bt">${C.btOrden.map((b, i) => `<span class="chip">${EN ? "#" + (i + 1) : i + 1 + ".º"} ${esc(btName(b))}</span>`).join("")}</div>` : ""}
      ${C.btNota ? `<p class="note" style="margin:6px 0 0">${esc(C.btNota)}</p>` : ""}
      ${C.main && C.main.length ? `<h3 class="nf-h">${L("Con qué main", "Which main")}</h3><div class="nf-mates">${C.main.map(x => `<div class="nf-mate">${pic(x.s, nm(x.s))}<div><b>${esc(nm(x.s))}</b><div class="note">${esc(x.nota)}</div></div></div>`).join("")}</div>` : ""}
      ${C.con && C.con.length ? `<h3 class="nf-h">${L("Con quién", "With whom")}</h3><div class="nf-mates nf-mates-wide">${C.con.map(x => `<div class="nf-mate">${pic(x.s, nm(x.s))}<div><b>${esc(nm(x.s))}</b>${profile.owned[x.s] ? ` <span class="tag-own">${L("tuyo", "yours")}</span>` : ""}<div class="note">${esc(x.nota)}</div></div></div>`).join("")}</div>` : ""}
      ${C.carta ? `<h3 class="nf-h">${L("Carta de asistencia", "Assist card")}</h3><p class="nf-p">${esc(C.carta)}</p>` : ""}
      ${C.ojo && C.ojo.length ? `<h3 class="nf-h">${L("Ojo", "Watch out")}</h3><ul class="why">${C.ojo.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
      ${C.contra ? `<h3 class="nf-h">${L("Cómo ganarle", "How to beat it")}</h3><p class="nf-p">${esc(C.contra)}</p>` : ""}
      <h3 class="nf-h">${L("Datos del top", "Top-player data")}</h3>${autoHtml(A)}
      </details>
      <p class="note nf-src">${L(`Revisada a mano el ${day(C.rev)}. Fuentes`, `Hand-reviewed on ${day(C.rev)}. Sources`)}: ${C.fuentes.map(esc).join(" · ")}.</p>`;
  }
  // Resumen en texto para pegarlo en un chat cuando alguien pregunta por un ninja.
  function adviceText(A) {
    const nm = x => (BY.get(x) || { n: x }).n, C0 = CONS()[A.n.s], C = C0, T = x => tc(x);
    if (C) return [`${A.n.n}: ${EN ? VERD_EN[C0.veredicto] || C0.veredicto : C.veredicto}. ${T(C.resumen)}`, ...(C.rapida ? [[L("¿Se usa?", "Is it used?"), C.rapida.usa], [L("¿Para qué?", "For what?"), C.rapida.para], [L("¿4★ y BT?", "4★ and BT?"), C.rapida.estrellas], [L("¿Con quién?", "With whom?"), C.rapida.con], [L("¿Y en una cuenta pequeña?", "And on a small account?"), C.rapida.pequena]].filter(x => x[1]).map(([k, v]) => `${k} ${T(v)}`) : []), "", ...C.usos.map(u => `- ${T(u.modo)} (${T(u.rol)}): ${T(u.nota)}`),
      `- ${L("Estrellas y breakthrough", "Stars and breakthrough")}: ${T(C.estrellas)}`, C.btOrden ? `- ${L("Orden de ramas", "Branch order")}: ${C.btOrden.map(btName).join(" → ")}.` : "", C.btNota ? `- ${T(C.btNota)}` : "",
      C.main && C.main.length ? `- Main: ${C.main.map(x => nm(x.s)).join(L(" o ", " or "))}.` : "", C.con && C.con.length ? `- ${L("Con", "With")}: ${C.con.map(x => nm(x.s)).join(", ")}.` : "",
      C.carta ? `- ${L("Carta", "Card")}: ${T(C.carta)}` : "", ...(C.ojo || []).map(w => `- ${L("Ojo", "Watch out")}: ${T(w)}`)].filter(Boolean).join("\n");
    return [`${A.n.n}: ${A.level[0]}. ${A.level[2]}.`, ...A.where.map(w => "- " + w), ...A.stars.filter(Boolean).map(w => "- " + w),
      A.topMain.length ? `- ${L("Main más usado", "Most used main")}: ${A.topMain.map(([x]) => nm(x)).join(L(" o ", " or "))}.` : "",
      A.topMates.length ? `- ${L("Suele ir con", "Usually with")}: ${A.topMates.map(([x]) => nm(x)).join(", ")}.` : ""].filter(Boolean).join("\n");
  }

  function ninjaSheet(s) {
    const n = BY.get(s); if (!n) return "";
    const o = profile.owned[s];
    const tiers = ["carry", "sup", "ii"].flatMap(k => (TIER[k] || []).filter(r => r.s === s).map(r => ({ ...r, k })));
    const uses = MODES.flatMap(m => altsOf(m).filter(a => (a.cells || []).includes(s)).map(a => ({ m, a, st: statsOf(m, a.id) })));
    const bt = BTI[s]; const rec = MY_RECS.find(r => r.s === s);
    const A = ninjaAdvice(s);
    const rall = ["rising", "carry", "sup", "pve"].flatMap(g => REC_ALL[g] || []).find(r => r.s === s);
    const how = rec && rec.now ? rec.now : rall && rall.get ? rall.get : "";
    const ty = EN ? { Standard: "Attack", "Passive 1": "Passive", "Passive 2": "Passive" } : { Mystery: "Mystery", Standard: "Ataque", Chase: "Chase", Passive: "Pasiva", "Passive 1": "Pasiva", "Passive 2": "Pasiva", Trigger: "Trigger" };
    const first = d => { const t = String(d || "").replace(/<[^>]+>/g, ""); const i = t.indexOf(". "); return i > 40 && i < 220 ? t.slice(0, i + 1) : t.slice(0, 220) + (t.length > 220 ? "…" : ""); };
    return `<div class="nf-head">${PICS[s] ? `<img class="nf-pic" src="${PICS[s]}" alt="">` : `<div class="nf-pic ph">${esc(n.n.slice(0, 1))}</div>`}
        <div><h2 id="nfTitle">${esc(n.n)}</h2><div class="note">${esc([n.r, n.e, n.ro].filter(Boolean).join(" · "))}</div>
          <div class="kh-tags" style="margin-top:6px">${o ? `<span class="chip on">${L("Tuyo", "Yours")} · ${o.st || 0}★${o.bt ? " · BT" : ""}</span>${isExcl(s) ? `<span class="chip">${L("No se usa en tus equipos", "Not used in your teams")}</span>` : ""}` : `<span class="chip">${L("No lo tienes", "Not owned")}</span>`}
            ${bt ? `<span class="chip">${L("Breakthrough a 4★", "Breakthrough at 4★")}${bt.f.length ? L(": primero ", ": first ") + esc(bt.f.map(btName).join(" + ")) : ""}</span>` : ((typeof NINJA_USO !== "undefined" && NINJA_USO.by[s]) || {}).bt === 1 ? `<span class="chip">${L("Breakthrough a 4★", "Breakthrough at 4★")}</span>` : ((typeof NINJA_USO !== "undefined" && NINJA_USO.by[s]) || {}).bt === 0 ? `<span class="chip">${L("Sin breakthrough", "No breakthrough")}</span>` : ""}</div></div></div>
      ${o && !n.m ? `<div class="excl-box"><button class="btn small${isExcl(s) ? " primary" : ""}" data-excl="${escAttr(s)}" aria-pressed="${isExcl(s)}">${isExcl(s) ? L("Volver a usarlo en mis equipos", "Use it in my teams again") : L("No usar en mis equipos", "Don't use in my teams")}</button>
        <span class="note">${isExcl(s) ? L("Ahora la app no lo usa para montar tus equipos ni te propone subirlo.", "Right now the app doesn't use it to build your teams or suggest upgrading it.") : L("Si lo marcas, la app no lo usará para montar tus equipos ni te propondrá subirlo (p. ej. uno que no vas a subir). Puedes deshacerlo cuando quieras.", "If you mark it, the app won't use it to build your teams or suggest upgrading it (e.g. one you won't level up). You can undo it any time.")}</span></div>` : ""}
      ${A ? adviceHtml(A) : BT_NOTE[s] ? `<p class="note" style="margin:8px 0 0"><i>${esc(BT_NOTE[s][1])}</i></p>` : ""}
      <h3 class="nf-h">${L("En tus equipos", "In your teams")}</h3>${uses.length ? `<ul class="why">${uses.map(x => `<li><a href="#" data-goalt="${x.m.k}:${esc(x.a.id)}">${esc(x.m.name)} ${/^[A-Z]$/.test(x.a.id) ? esc(x.a.id) : ""}</a> · ${esc(altShort(x.a.label))}${x.st ? ` · <b>${esc(x.st.txt)}</b>` : L(" · sin probar", " · untried")}</li>`).join("")}</ul>` : `<p class="note">${L("No está en ninguno de tus equipos.", "It's not in any of your teams.")}</p>`}
      ${how ? `<h3 class="nf-h">${o ? L("Más fragmentos", "More fragments") : L("Cómo conseguirlo", "How to get it")}</h3><p class="note" style="margin:0">${esc(how)}</p>` : ""}
      <details class="howto" style="margin-top:10px"><summary>${L("Habilidades", "Skills")} (${n.sk.length})</summary><ul class="why">${n.sk.map(k => `<li><b>${esc(ty[k.t] || k.t)} · ${esc(k.n)}</b>${k.ck ? ` <span class="note">(${k.ck} chakra)</span>` : ""}: ${esc(first(k.d))}</li>`).join("")}</ul></details>
      <details class="howto" style="margin-top:10px"><summary>${L("Tier list en detalle", "Tier list in detail")}</summary>${tiers.length ? `<ul class="why">${tiers.map(r => `<li><span class="rk-seal" data-t="${escAttr(r.t)}" style="transform:none;width:18px;height:18px;font-size:.66rem;display:inline-grid">${r.t}</span> <b>${TIER_CAT[r.k]}</b>${r.est ? L(" (estimado)", " (estimated)") : ""}: ${(r.why || []).slice(0, 2).map(esc).join(" · ")}</li>`).join("")}</ul>` : `<p class="note">${L("Sin valoración en la tier list.", "Not rated in the tier list.")}</p>`}</details>
      ${A ? `<div class="row" style="margin-top:12px"><button class="btn small" data-nf-copy="${esc(s)}">${L("Copiar resumen", "Copy summary")}</button><span class="note">${L("para pegarlo en un chat", "to paste it in a chat")}</span></div>` : ""}`;
  }
  // Si el portapapeles no deja copiar, el texto queda a la vista y seleccionado para copiarlo a mano.
  function showCopyBox(txt) {
    const ta = document.createElement("textarea"); ta.className = "nf-copybox"; ta.value = txt; ta.readOnly = true; ta.rows = 8;
    $("nfBody").appendChild(ta); ta.focus(); ta.select(); toast(L("Selecciónalo y cópialo", "Select it and copy it"));
  }
  // Ficha más corta (rediseño, fase 3): a la vista, el veredicto, las respuestas rápidas, los equipos con él y cómo
  // conseguirlo; el resto de secciones (sustitutos, poco poder, por poder, en tus equipos) va plegado con su título.
  // Las listas largas enseñan 3 y «Ver los N restantes».
  const SHEET_OPEN = /^(Equipos con él|Teams with it|Más fragmentos|More fragments|Cómo conseguirlo|How to get it)$/;
  function foldSheet(root) {
    [...root.querySelectorAll(":scope > h3.nf-h")].forEach(h => {
      if (SHEET_OPEN.test(h.textContent.trim())) return;
      const d = document.createElement("details"); d.className = "nf-fold";
      d.innerHTML = `<summary><b>${esc(h.textContent)}</b></summary>`;
      let x = h.nextElementSibling;
      while (x && !(x.matches("h3.nf-h, details, .nf-src, .row"))) { const nx = x.nextElementSibling; d.appendChild(x); x = nx; }
      h.replaceWith(d);
    });
    root.querySelectorAll(".nf-teams, .sim-teams, .nf-fold > ul.why").forEach(l => {
      const k = [...l.children]; if (k.length <= 4) return;
      const d = document.createElement("details"); d.className = "grp-rest";
      d.innerHTML = `<summary>${esc(L(`Ver los ${k.length - 3} restantes`, `See the other ${k.length - 3}`))}</summary>`;
      const box = document.createElement(l.tagName); box.className = l.className; k.slice(3).forEach(c => box.appendChild(c)); d.appendChild(box);
      l.after(d);
    });
  }
  let nfLast = null;
  function openSheet(s) {
    const html = ninjaSheet(s); if (!html) return;
    // desde otra ficha (un sustituto) se cambia de ficha sin perder a dónde volver al cerrar
    if ($("nfBack").hidden) nfLast = document.activeElement;
    $("nfBody").innerHTML = html; foldSheet($("nfBody")); $("nfBack").hidden = false; document.body.classList.add("modal-open"); $("nfBody").parentElement.scrollTop = 0;
    $("nfBack").querySelector("[data-nf-close]").focus();
  }
  document.addEventListener("click", e => {
    const x = e.target.closest("[data-excl]");
    if (x) { e.preventDefault(); const s = x.dataset.excl; toggleExcl(s); saveProfile();
      toast(isExcl(s) ? L("No se usará en tus equipos", "Won't be used in your teams") : L("Vuelve a usarse en tus equipos", "Used in your teams again"));
      if (!$("nfBack").hidden) openSheet(s); renderAll(); return; }
    if (e.target.closest("[data-excl-go]")) { e.preventDefault(); if (!$("nfBack").hidden) closeSheet();
      rosterTab = "ninjas"; folds.pool = false; setTab("perfil"); applyFolds(); applyRosterTab(); $("poolPanel").scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  function closeSheet() { $("nfBack").hidden = true; modalDone(); if (nfLast && nfLast.focus) nfLast.focus(); }
  // En fase de captura, para que tocar una cara no pliegue/abra además la tarjeta que la contiene.
  document.addEventListener("click", e => {
    const f = e.target.closest("[data-ninja]"); if (!f) return;
    if (f.closest("#catalog, #picker, #board, #nfBack, #qtBack, a, label, select, .cell")) return;  // ahí tocar ya hace otra cosa
    const btn = f.closest("button"); if (btn && btn !== f) return;   // una cara dentro de otro botón: manda el botón
    e.preventDefault(); e.stopPropagation(); openSheet(f.dataset.ninja);
  }, true);
  $("nfBack").addEventListener("click", e => {
    const sm = e.target.closest("[data-sim]"); if (sm) { openSheet(sm.dataset.sim); return; }
    const ab = e.target.closest("[data-alt-open], [data-alt-save]");
    if (ab) { if (ab.dataset.altOpen) closeSheet(); onAltClick(e); return; }
    const cp = e.target.closest("[data-nf-copy]");
    if (cp) { const txt = adviceText(ninjaAdvice(cp.dataset.nfCopy));
      const done = () => toast(L("Resumen copiado", "Summary copied"));
      try { navigator.clipboard.writeText(txt).then(done, () => { showCopyBox(txt); }); } catch { showCopyBox(txt); } return; }
    if (e.target === $("nfBack") || e.target.closest("[data-nf-close]")) { closeSheet(); return; }
    if (e.target.closest("[data-goalt]")) closeSheet();   // el enlace a un equipo lo resuelve el manejador general
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !e.defaultPrevented && !$("nfBack").hidden) { e.preventDefault(); closeSheet(); } });
  // Buscador de la cabecera: nombre de un ninja → su ficha. Los tuyos salen primero en la lista.
  function fillSearch() {
    const all = D.ninjas.filter(n => !n.m);
    const mine = all.filter(n => profile.owned[n.s]), rest = all.filter(n => !profile.owned[n.s]);
    $("nsearchList").innerHTML = mine.concat(rest).map(n => `<option value="${esc(n.n)}"></option>`).join("");
  }
  function findNinja(q) {
    const W = searchWords(q); if (!W.length) return null;
    return D.ninjas.filter(n => !n.m && nameScore(n, W) < 9).sort((a, b) => nameScore(a, W) - nameScore(b, W) || (!!profile.owned[b.s] - !!profile.owned[a.s]) || b.pr - a.pr || a.n.length - b.n.length)[0] || null;
  }
  function searchGo() { if (!$("nsearchIn").value.trim()) return; const n = findNinja($("nsearchIn").value); if (!n) { toast(L("No encuentro ese ninja", "Can't find that ninja")); return; } $("nsearchIn").value = ""; $("nsearchIn").blur(); openSheet(n.s); }
  $("nsearch").addEventListener("submit", e => { e.preventDefault(); searchGo(); });
  // Al elegir una opción de la lista (sin pulsar Intro), abrir ya la ficha. Firefox lo marca como «insertReplacementText»;
  // Chromium y el WebView2 de la app de Windows no dan inputType. Solo al elegirla, no al teclear: si se abriera al
  // coincidir el texto mientras escribes, «Ao» abriría Ao camino de «Aoneko».
  const NS_NAMES = new Set(D.ninjas.filter(n => !n.m).map(n => n.n));
  $("nsearchIn").addEventListener("input", e => {
    if ((e.inputType === "insertReplacementText" || !e.inputType) && NS_NAMES.has(e.target.value)) searchGo(); });
  fillSearch();
  function closeQuickTry() { $("qtBack").hidden = true; modalDone(); if (qtLast && qtLast.focus) qtLast.focus(); }
  $("fab").addEventListener("click", () => openQuickTry(ui.tab === "ii" ? ui.mode : ""));
  $("qtBack").addEventListener("click", e => { if (e.target === $("qtBack") || e.target.closest("[data-qt-close]")) closeQuickTry(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !e.defaultPrevented && !$("qtBack").hidden) { e.preventDefault(); closeQuickTry(); } });
  // Cantidades como las escribe la gente: «5,1M», «6.3M», «850k», «6.300.000», «6,300,000» o «6300000».
  function parseAmount(v) {
    const s = String(v ?? "").replace(/\s/g, "").toLowerCase(); if (!s) return NaN;
    const m = s.match(/^(\d+(?:[.,]\d+)?)(k|m)$/);
    if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * (m[2] === "m" ? 1e6 : 1e3));
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return +s.replace(/[.,]/g, "");
    if (/^\d+$/.test(s)) return +s;
    if (/^\d+[.,]\d+$/.test(s)) return parseFloat(s.replace(",", "."));
    return NaN;
  }
  $("qtForm").addEventListener("input", e => {
    if (e.target.name !== "damage") return;
    const out = e.target.parentElement.querySelector(".dmg-read"); if (!out) return;
    const d = parseAmount(e.target.value); out.textContent = !e.target.value.trim() ? "" : d >= 0 ? "= " + fmtNum(d) : L("No lo entiendo: p. ej. 5,1M o 5.100.000", "Can't read it: e.g. 5.1M or 5,100,000");
  });
  $("qtForm").addEventListener("change", e => {
    const n = e.target.name;
    if (n !== "qt_mode" && n !== "qt_pick") return;
    const f = $("qtForm"), keep = ["damage", "power", "notes", "result", "rival"].map(k => [k, f.elements[k] ? (f.elements[k].type === "radio" ? (f.querySelector(`[name="${k}"]:checked`) || {}).value : f.elements[k].value) : undefined]);
    f.innerHTML = n === "qt_mode" ? quickForm(e.target.value, "") : quickForm(f.qt_mode.value, e.target.value);
    // lo escrito se queda (el resultado, la potencia y las notas no dependen del equipo elegido)
    keep.forEach(([k, v]) => { if (v === undefined || v === "" || !f.elements[k]) return; const el = f.elements[k];
      if (el.type === "radio" || (el.length && el[0] && el[0].type === "radio")) { const r = f.querySelector(`[name="${k}"][value="${v}"]`); if (r) r.checked = true; } else el.value = v; });
  });
  $("qtForm").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.target; const fd = new FormData(f);
    const m = modeOf(fd.get("qt_mode")); const a = altsOf(m).find(x => x.id === fd.get("qt_alt")); if (!m || !a) return;
    const fallen = [...f.querySelectorAll("input[data-qt-fallen]:checked")].map(x => x.value);
    const body = tryBody(m, a, fd, fallen); if (!body) return;
    closeQuickTry(); await storeTry(body);
    setTab(ui.tab);
  });

  // ---------------- TUS DATOS: copia de seguridad. En la app se guarda con el diálogo de Windows (comando save_backup de
  // app/src-tauri); en el artifact las descargas están bloqueadas, así que se copia el texto. Importar sustituye todo.
  const TAURI = () => (window.__TAURI__ && window.__TAURI__.core) || null;
  const backupObj = () => ({ app: "naruto-online-companion", v: 1, at: new Date().toISOString(), profile, teams, tries, customAlts, walls });
  const backupName = () => `naruto-online-companion-${new Date().toISOString().slice(0, 10)}.json`;
  let pendingImport = null;
  // «1 intento», «2 intentos»: plural según el número, en los dos idiomas
  const plur = (n, es1, esN, en1, enN) => `${n} ${n === 1 ? L(es1, en1) : L(esN, enN)}`;
  function dataSummary(o) {
    const n = Object.keys((o.profile || {}).owned || {}).filter(x => !(BY.get(x) || {}).m).length, t = Object.keys(o.teams || {}).length, a = Object.keys(o.tries || {}).length;
    return [plur(n, "ninja", "ninjas", "ninja", "ninjas"), plur(t, "equipo guardado", "equipos guardados", "saved team", "saved teams"), plur(a, "intento", "intentos", "attempt", "attempts")].join(", ");
  }
  function renderDatos() {
    $("datosBody").innerHTML = `
      <div class="panel"><h3>${L("Hacer una copia", "Make a backup")}</h3>
        <p class="note" style="margin:2px 0 10px">${L(`Todo lo tuyo en un archivo: ninjas, estrellas, equipos, intentos y objetivos (${esc(dataSummary(backupObj()))}). Sirve de copia de seguridad y para pasar tus datos a otro ${IS_PWA ? "dispositivo (el móvil, el PC…)" : "PC"}${IS_APP ? "" : " o a la app de escritorio"}.`, `All your data in one file: ninjas, stars, teams, attempts and goals (${esc(dataSummary(backupObj()))}). Use it as a backup or to move your data to another ${IS_PWA ? "device (your phone, your PC…)" : "PC"}.`)}</p>
        <div class="row">${IS_APP && TAURI() ? `<button class="btn primary" data-bk-save>${L("Guardar copia…", "Save backup…")}</button>` : ""}${IS_PWA ? `<button class="btn primary" data-bk-dl>${L("Descargar copia", "Download backup")}</button>` : ""}<button class="btn${(IS_APP && TAURI()) || IS_PWA ? "" : " primary"}" data-bk-copy>${L("Copiar al portapapeles", "Copy to clipboard")}</button></div>
        <textarea class="bk-text" id="bkText" rows="5" readonly hidden></textarea></div>
      <div class="panel"><h3>${L("Recuperar una copia", "Restore a backup")}</h3>
        <p class="note" style="margin:2px 0 10px">${L(`Elige el archivo o pega su texto. <b>Sustituye lo que tengas ahora ${esc(HERE)}</b>: antes te enseño qué contiene.`, `Choose the file or paste its text. <b>It replaces what you have now ${esc(HERE)}</b>: you will see what it contains first.`)}</p>
        <div class="row"><label class="btn"><input type="file" accept=".json,application/json" id="bkFile" hidden>${L("Elegir archivo…", "Choose file…")}</label></div>
        <textarea class="bk-text" id="bkPaste" rows="4" placeholder="${L("…o pega aquí el texto de la copia", "…or paste the backup text here")}"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn" data-bk-check>${L("Revisar", "Check")}</button></div>
        <div id="bkConfirm"></div></div>`;
  }
  // Una copia puede venir editada a mano o rota: solo entran entradas con forma de dato (objeto) e id sencillo. Si no,
  // un null o un id con comillas rompería la página en cada arranque (se guarda en local) o metería HTML.
  const isObj = x => !!x && typeof x === "object" && !Array.isArray(x);
  const okId = k => /^[\w:.\-]{1,100}$/.test(k);
  function cleanCol(c) { return isObj(c) ? Object.fromEntries(Object.entries(c).filter(([k, v]) => okId(k) && isObj(v))) : {}; }
  // Ninjas marcados: solo los que existen, con estrellas de 0 a 5 y breakthrough sí/no (se pintan en el HTML).
  function cleanOwned(x) {
    return Object.fromEntries(Object.entries(isObj(x) ? x : {}).filter(([k, v]) => BY.has(k) && isObj(v))
      .map(([k, v]) => [k, { ...v, st: Math.max(0, Math.min(5, Math.trunc(+v.st) || 0)), bt: !!v.bt }]));
  }
  const dLong = s => { const d = new Date(s); return isNaN(d) ? String(s).slice(0, 10) : d.toLocaleDateString(EN ? "en-GB" : "es-ES", { day: "numeric", month: "long", year: "numeric" }); };
  function cleanBackup(o) {
    const p = isObj(o.profile) ? { ...o.profile } : {};
    p.owned = cleanOwned(p.owned);
    ["level", "power"].forEach(k => { if (p[k] !== undefined) { const n = Math.trunc(+p[k]); if (n > 0) p[k] = n; else delete p[k]; } });
    p.summons = Array.isArray(p.summons) ? p.summons.filter(x => typeof x === "string") : [];
    if (p.main && !BY.has(p.main)) p.main = "";
    if (p.goals !== undefined && !Array.isArray(p.goals)) delete p.goals;
    p.excl = (Array.isArray(p.excl) ? p.excl : []).filter(s => typeof s === "string" && p.owned[s]);
    // Favoritos antiguos: los tuyos que no eran favoritos pasan a «No usar en mis equipos» (así no cambia lo que te recomendaba).
    // En el Cuartel sin lista propia, la lista era DEFAULT_POOL; en la app, sin lista, contaban todos.
    if (o.profile && o.profile.excl === undefined) {
      const fav = Array.isArray(p.pool) ? new Set(p.pool) : !IS_APP ? DEFAULT_POOL : null;
      if (fav) p.excl = Object.keys(p.owned).filter(s => !fav.has(s) && !(BY.get(s) || {}).m);
    }
    delete p.pool;
    return { ...o, profile: p, teams: cleanCol(o.teams), tries: cleanCol(o.tries), customAlts: cleanCol(o.customAlts), walls: cleanCol(o.walls) };
  }
  function checkImport(txt) {
    let o; try { o = JSON.parse(txt); } catch { toast(L("Ese texto no es una copia válida", "That text is not a valid backup")); return; }
    if (!o || typeof o !== "object" || !o.profile || typeof o.profile !== "object") { toast(L("No encuentro tus datos en esa copia", "No data found in that backup")); return; }
    o = cleanBackup(o);
    pendingImport = o;
    $("bkConfirm").innerHTML = `<div class="warn-box" style="margin-top:10px"><p>${L(`La copia${o.at ? ` del ${esc(dLong(o.at))}` : ""} tiene ${esc(dataSummary(o))}. Ahora tienes ${esc(dataSummary(backupObj()))}. ¿Sustituyo lo tuyo por la copia?`, `The backup${o.at ? ` from ${esc(dLong(o.at))}` : ""} has ${esc(dataSummary(o))}. You now have ${esc(dataSummary(backupObj()))}. Replace your data with the backup?`)}</p>
      <div class="row"><button class="btn danger" data-bk-yes>${L("Sí, sustituir", "Yes, replace")}</button><button class="btn" data-bk-no>${L("Cancelar", "Cancel")}</button></div></div>`;
  }
  async function applyImport(o) {
    profile = { ...blankProfile(), ...o.profile, owned: (o.profile || {}).owned || {}, summons: (o.profile || {}).summons || [] };
    teams = o.teams || {}; tries = fixTries(o.tries || {}); customAlts = o.customAlts || {}; walls = o.walls || {};
    lsWrite(); renderAll();
    if (db) {  // en el artifact, también a su base de datos (añade o sustituye; no borra lo que no venga en la copia)
      try { await db.doc("perfil/yo").set(JSON.parse(JSON.stringify({ ...profile, updatedAt: new Date().toISOString() })));
        for (const [col, obj] of [["equipos", teams], ["intentos", tries], ["alternativas", customAlts], ["pisos", walls]])
          for (const [id, d] of Object.entries(obj)) await db.collection(col).doc(id).set(d);
      } catch { toast(L("Recuperado ", "Restored ") + HERE + L(", pero no se pudo subir todo", ", but not everything could be uploaded")); return; }
    }
    toast(L("Copia recuperada", "Backup restored")); setTab("datos");
  }
  $("datosBody").addEventListener("click", async e => {
    if (e.target.closest("[data-bk-save]")) {
      try { const ok = await TAURI().invoke("save_backup", { name: backupName(), contents: JSON.stringify(backupObj(), null, 1) }); if (ok) toast(L("Copia guardada", "Backup saved")); }
      catch (err) { toast(L("No se pudo guardar: ", "Could not save: ") + err); }
      return; }
    if (e.target.closest("[data-bk-dl]")) {   // PWA: un archivo .json en Descargas
      const a = document.createElement("a"), url = URL.createObjectURL(new Blob([JSON.stringify(backupObj(), null, 1)], { type: "application/json" }));
      a.href = url; a.download = backupName(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(L("Copia descargada", "Backup downloaded")); return; }
    if (e.target.closest("[data-bk-copy]")) {
      const txt = JSON.stringify(backupObj()), ta = $("bkText"); ta.value = txt;
      try { await navigator.clipboard.writeText(txt); toast((IS_PWA ? L("Copia en el portapapeles: pégala en un archivo o en el otro dispositivo", "Backup copied: paste it into a file or on the other device") : L("Copia en el portapapeles: pégala en un archivo o en el otro PC", "Backup copied: paste it into a file or on the other PC"))); }
      catch { ta.hidden = false; ta.focus(); ta.select(); toast(L("Selecciona el texto y cópialo", "Select the text and copy it")); }
      return; }
    if (e.target.closest("[data-bk-check]")) { checkImport($("bkPaste").value); return; }
    if (e.target.closest("[data-bk-yes]") && pendingImport) { const o = pendingImport; pendingImport = null; await applyImport(o); return; }
    if (e.target.closest("[data-bk-no]")) { pendingImport = null; $("bkConfirm").innerHTML = ""; }
  });
  $("datosBody").addEventListener("change", e => {
    const f = e.target.closest("#bkFile"); if (!f || !f.files[0]) return;
    const r = new FileReader(); r.onload = () => checkImport(String(r.result)); r.readAsText(f.files[0]);
  });
  // ---------------- AJUSTES: lo que antes estaba repartido (cuenta en Mi roster, idioma y tema en la cabecera, copia en
  // Mi roster › Tus datos, actualizaciones en Fuentes). La copia de seguridad es la otra vista de esta sección.
  function renderAjustes() {
    const a = acctInfo(), th = readTheme(), opt = (on, attr, val, txt) => `<button type="button" class="btn small${on ? " primary" : ""}" ${attr}="${escAttr(val)}" aria-pressed="${escAttr(on)}">${txt}</button>`;
    $("ajustesBody").innerHTML = `
      <div class="panel"><h3>${L("Tu cuenta", "Your account")}</h3>
        <p class="note" style="margin:2px 0 10px">${L("Con esto se ajustan las recomendaciones (qué conseguir, qué subir, la jugada de la semana) y se comparan tus intentos.", "Recommendations (what to get, what to upgrade, the play of the week) and attempt comparisons use this.")}</p>
        <form class="acct-form set-form" id="setForm" autocomplete="off">
          <label>${L("Nivel", "Level")}<input type="number" id="setLevel" min="1" max="200" step="1" inputmode="numeric" value="${a.level || ""}"></label>
          <label>${L("Poder de combate", "Combat power")}<input type="number" id="setPower" min="0" step="1000" inputmode="numeric" placeholder="${L("p. ej. 150000", "e.g. 150000")}" value="${a.power || ""}"></label>
          <label>${L("Cuánto gastas", "How much you spend")}${spendSelect("setSpend")}</label>
        </form>
        <p class="note" style="margin:8px 0 0">${L("Poder actualizado: ", "Power updated: ")}${esc(a.at)}. ${L("Se guarda al cambiarlo.", "Saved as you change it.")}</p></div>
      <div class="panel"><h3>${L("Idioma y aspecto", "Language and look")}</h3>
        <div class="set-row"><span>${L("Idioma", "Language")}</span><span class="row">${opt(!EN, "data-set-lang", "es", "Español")}${opt(EN, "data-set-lang", "en", "English")}</span></div>
        <div class="set-row"><span>${L("Tema", "Theme")}</span><span class="row">${opt(th === "auto", "data-set-theme", "auto", L("Automático", "Automatic"))}${opt(th === "dark", "data-set-theme", "dark", L("Oscuro", "Dark"))}${opt(th === "light", "data-set-theme", "light", L("Claro", "Light"))}</span></div>
        <p class="note" style="margin:6px 0 0">${IS_PWA ? L("Automático sigue el tema del sistema. Cambiar el idioma recarga la página; tus datos no se tocan.", "Automatic follows the system theme. Changing the language reloads the page; your data is untouched.") : L("Automático sigue el tema de Windows. Cambiar el idioma recarga la página; tus datos no se tocan.", "Automatic follows the Windows theme. Changing the language reloads the page; your data is untouched.")}</p></div>
      <div class="panel"><h3>${L("Tus datos", "Your data")}</h3>
        <p class="note" style="margin:2px 0 10px">${L(`Se guardan ${esc(HERE)}. Ahora tienes ${esc(dataSummary(backupObj()))}.`, `They're stored ${esc(HERE)}. You now have ${esc(dataSummary(backupObj()))}.`)}</p>
        <button class="btn small" data-set-go="datos">${L("Hacer o recuperar una copia", "Make or restore a backup")}</button></div>
      ${IS_PWA ? `<div class="panel"><h3>${L("Actualizaciones", "Updates")}</h3><p class="note" style="margin:2px 0 0">${L("Se actualiza sola: cada vez que la abres con conexión carga la última versión. Sin conexión funciona con la última que guardó.", "It updates itself: every time you open it online it loads the latest version. Offline it works with the last one it saved.")}</p></div>` : ""}
      ${IS_APP && !IS_PWA ? `<div class="panel"><h3>${L("Actualizaciones", "Updates")}</h3><p class="note${updState.err ? " upd-err" : ""}" style="margin:2px 0 8px">${esc(updState.t)}</p>
        <p class="note${contState.err ? " upd-err" : ""}" style="margin:0 0 8px">${esc(contState.t || contentLine())}</p>
        <div class="row"><button class="btn small" data-upd-check>${L("Buscar actualizaciones", "Check for updates")}</button>${updState.v ? `<button class="btn small primary" data-upd-go>${L("Actualizar a la", "Update to")} ${esc(updState.v)}</button>` : ""}${contState.ready ? `<button class="btn small primary" data-cont-go>${L("Aplicar el contenido nuevo", "Apply the new content")}</button>` : ""}</div></div>` : ""}
      <div class="panel"><h3>${L("Ayuda", "Help")}</h3>
        <div class="row"><button class="btn small" data-news-open>${L("Ver las novedades", "See what's new")}</button><button class="btn small" data-set-wiz>${L("Repetir los primeros pasos", "Redo the first steps")}</button><button class="btn small" data-set-go="fuentes">${L("Fuentes y créditos", "Sources and credits")}</button></div>
        ${IS_APP ? `<p class="note" style="margin:8px 0 0">Naruto Online Companion ${esc(window.NOC_APP.version || "")}</p>` : ""}</div>`;
  }
  $("ajustesBody").addEventListener("click", e => {
    const lg = e.target.closest("[data-set-lang]"); if (lg) { setLang(lg.dataset.setLang); return; }
    const tm = e.target.closest("[data-set-theme]"); if (tm) { setTheme(tm.dataset.setTheme); renderAjustes(); return; }
    const go = e.target.closest("[data-set-go]"); if (go) { setTab(go.dataset.setGo); window.scrollTo({ top: 0 }); return; }
    if (e.target.closest("[data-set-wiz]")) { wiz.step = 0; openWizard(); }
  });
  $("ajustesBody").addEventListener("change", e => {
    const id = e.target.id;
    if (id === "setLevel") { const lv = Math.round(+e.target.value); if (!(lv >= 1 && lv <= 200)) { toast(L("El nivel va de 1 a 200", "Level goes from 1 to 200")); return; } profile.level = lv; }
    else if (id === "setPower") { const pw = Math.round(+e.target.value); if (!(pw > 0)) { toast(L("Escribe tu poder de combate", "Type your combat power")); return; } profile.power = pw; profile.powerAt = new Date().toISOString(); }
    else return;   // el gasto lo guarda el manejador común de [data-spend-sel]
    saveProfile(); updateAcct(); renderAcctForm(); toast(L("Guardado", "Saved"));
  });
  // ---------------- FUENTES Y CRÉDITOS
  function renderFuentes() {
    const F0 = typeof FUENTES !== "undefined" ? FUENTES : { items: [] }, F = EN && F0.en ? { ...F0, ...F0.en, items: F0.items.map((x, i) => ({ ...x, d: (F0.en.items || [])[i] || x.d })) } : F0;
    $("fuentesBody").innerHTML = `<div class="panel"><p style="margin:0">${esc(F.intro || "")}</p></div>
      <div class="panel"><h3>${L("Fuentes de los datos", "Data sources")}</h3><div class="src-list">${F.items.map(x => `<div class="src-item"><b>${esc(x.n)}</b><div class="note">${esc(x.d)}</div><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url.replace(/^https:\/\//, "").slice(0, 60))}${x.url.length > 68 ? "…" : ""}</a></div>`).join("")}</div></div>
      <div class="panel"><h3>${L("Arte del juego", "Game art")}</h3><p class="note" style="margin:0">${esc(F.arte || "")}</p></div>
      <div class="panel"><h3>${L("Hecho con", "Made with")}</h3><p class="note" style="margin:0">${esc(F.ia || "")}</p><p class="note" style="margin:6px 0 0">${esc(F.fuentesLetra || "")}</p>
        ${IS_APP ? `<p class="note" style="margin:6px 0 0">Naruto Online Companion ${esc(window.NOC_APP.version || "")}</p>` : ""}</div>
      ${IS_APP ? `<p class="note" style="margin:0">${L("Las actualizaciones están en Ajustes.", "Updates are in Settings.")} <button class="btn small" data-bsec="ajustes">${L("Ir a Ajustes", "Go to Settings")}</button></p>` : ""}`;
  }
  // ---------------- ASISTENTE DE PRIMER ARRANQUE (solo app, perfil vacío): idioma, nivel, poder y gasto, y a marcar ninjas.
  let wiz = { step: 0 };
  const WIZ_STEPS = 3;   // sin paso de main: el main cambia según el modo y cada equipo trae el suyo (usuario, 29-oct)
  function wizHtml() {
    const dots = `<div class="wiz-dots">${Array.from({ length: WIZ_STEPS }, (_, i) => `<i class="${i === wiz.step ? "on" : ""}"></i>`).join("")}</div>`;
    const body = [
      () => `<h2>${L("Bienvenido a Naruto Online Companion", "Welcome to Naruto Online Companion")}</h2>
        <p>${L("Tu cuartel de Naruto Online: apuntas los ninjas que tienes y la app te dice qué equipos montar, en qué invertir, qué te falta para el siguiente premio de Infinite Illusion y qué hace cada ninja.",
          "Your Naruto Online HQ: note the ninjas you own and the app tells you which teams to build, what to invest in, how far you are from the next Infinite Illusion reward and what each ninja does.")}</p>
        <ul class="why"><li>${L(`Todo se guarda ${HERE}.`, `Everything is stored ${HERE}.`)}</li><li>${L("Se actualiza sola con información nueva.", "It updates itself with new information.")}</li><li>${L("Todo lo que se configura está en Ajustes (⚙, arriba).", "Everything you can configure is in Settings (⚙, at the top).")}</li></ul>
        <div class="row wiz-lang"><span class="note">Idioma · Language</span><button type="button" class="btn small${EN ? "" : " primary"}" data-wiz-lang="es" aria-pressed="${!EN}">Español</button><button type="button" class="btn small${EN ? " primary" : ""}" data-wiz-lang="en" aria-pressed="${escAttr(EN)}">English</button></div>
        <div class="row wiz-act"><button class="btn primary" data-wiz-next>${L("Empezar", "Start")}</button><button class="btn" data-wiz-backup>${L("Tengo una copia de seguridad", "I have a backup")}</button></div>`,
      () => `<h2>${L("Tu cuenta", "Your account")}</h2><p class="note">${L("Sirven para comparar tus intentos con los de otros días. Los ves en tu perfil del juego.", "They're used to compare your attempts across days. You'll find them in your in-game profile.")}</p>
        <div class="row wiz-nums"><label>${L("Nivel", "Level")}<input type="number" min="1" max="200" inputmode="numeric" id="wizLevel" value="${+profile.level || ""}"></label>
          <label>${L("Poder de combate", "Combat power")}<input type="number" min="0" step="1000" inputmode="numeric" id="wizPower" value="${+profile.power || ""}" placeholder="${L("p. ej. 150000", "e.g. 150000")}"></label></div>
        <label class="wiz-spend">${L("¿Gastas dinero en el juego?", "Do you spend money in the game?")}${spendSelect("wizSpend")}</label>
        <p class="note">${L("Así sé si recomendarte solo lo que sale gratis o también lo de pago. Nadie más lo ve.", "So I know whether to recommend only free things or paid ones too. Nobody else sees it.")}</p>
        <div class="row wiz-act"><button class="btn primary" data-wiz-next>${L("Siguiente", "Next")}</button><button class="btn" data-wiz-back>${L("Atrás", "Back")}</button></div>`,
      () => `<h2>${L("Ahora, tus ninjas", "Now, your ninjas")}</h2><p>${L("Te llevo a «Mi roster». Ahí:", "I'll take you to «My roster». There:")}</p>
        <ol class="why"><li>${L("Toca cada ninja que tengas (usa el buscador o los filtros).", "Tap every ninja you own (use the search box or the filters).")}</li><li>${L("Ajusta sus estrellas y marca si tiene breakthrough.", "Set its stars and mark whether it has breakthrough.")}</li><li>${L("En las pestañas de arriba, marca también tus summons y tus cartas de asistencia.", "In the tabs at the top, also mark your summons and assist cards.")}</li></ol>
        <p class="note">${L("Con eso, Inicio y Equipos se ajustan a tu cuenta. Puedes cambiarlo cuando quieras.", "With that, Home and Teams adapt to your account. You can change it any time.")}</p>
        <div class="row wiz-act"><button class="btn primary" data-wiz-done>${L("Ir a marcar mis ninjas", "Go mark my ninjas")}</button><button class="btn" data-wiz-back>${L("Atrás", "Back")}</button></div>`
    ][wiz.step]();
    return `<div class="wiz-card" role="dialog" aria-modal="true" aria-label="${L("Primeros pasos", "First steps")}">${dots}${body}<button class="wiz-skip" data-wiz-skip>${L("Saltar", "Skip")}</button></div>`;
  }
  function openWizard() {
    let el = $("wizBack");
    if (!el) { el = document.createElement("div"); el.id = "wizBack"; el.className = "wiz-back"; document.body.appendChild(el); }
    el.innerHTML = wizHtml(); el.hidden = false; document.body.classList.add("modal-open");
  }
  function closeWizard(go) {
    const lv = $("wizLevel"), pw = $("wizPower");
    if (lv && +lv.value >= 1 && +lv.value <= 200) profile.level = +lv.value;
    if (pw && +pw.value > 0) { profile.power = +pw.value; profile.powerAt = new Date().toISOString(); }
    profile.onboarded = true; saveProfile();
    $("wizBack").hidden = true; modalDone();
    renderAll(); if (go) setTab(go);
  }
  document.addEventListener("click", e => {
    if (!e.target.closest("#wizBack")) return;
    const lg = e.target.closest("[data-wiz-lang]"); if (lg) { setLang(lg.dataset.wizLang); return; }
    if (e.target.closest("[data-wiz-next]") || e.target.closest("[data-wiz-back]")) {
      const lv = $("wizLevel"), pw = $("wizPower");  // lo escrito no se pierde al cambiar de paso
      if (lv && +lv.value >= 1 && +lv.value <= 200) profile.level = +lv.value;
      if (pw && +pw.value > 0) { profile.power = +pw.value; profile.powerAt = new Date().toISOString(); }
      wiz.step = Math.max(0, Math.min(WIZ_STEPS - 1, wiz.step + (e.target.closest("[data-wiz-next]") ? 1 : -1)));
      $("wizBack").innerHTML = wizHtml(); return; }
    if (e.target.closest("[data-wiz-done]")) { closeWizard("perfil"); return; }
    if (e.target.closest("[data-wiz-backup]")) { closeWizard("datos"); return; }
    if (e.target.closest("[data-wiz-skip]")) closeWizard();
  });
  // Se mira cuando ya están cargados los datos guardados (initStore): a quien ya tiene ninjas no le sale.
  if (IS_APP) setTimeout(() => { if (!profile.onboarded && !Object.keys(profile.owned).length) openWizard(); }, 400);

  // ---------------- ACTUALIZACIONES (solo app): al abrir se busca versión nueva; el estado se ve en Fuentes.
  let updState = { t: L("Sin comprobar todavía.", "Not checked yet.") }, contState = {};
  async function checkUpdates(manual) {
    const T = TAURI(); if (!IS_APP || !T) return;
    updState = { t: L("Buscando…", "Checking…") }; if (ui.tab === "ajustes") renderAjustes();
    try {
      const r = await T.invoke("check_update");
      updState = r.available ? { t: L(`Hay una versión nueva: ${r.available} (tienes la ${r.current}).`, `A new version is available: ${r.available} (you have ${r.current}).`), v: r.available, cur: r.current } : { t: L(`Estás en la última versión (${r.current}).`, `You are on the latest version (${r.current}).`) };
      if (r.available) showUpdateBar(r.available, r.current); else if (manual) toast(L("Ya tienes la última versión", "You already have the latest version"));
    } catch (err) { updState = { t: L("No se pudo comprobar: ", "Could not check: ") + err, err: true }; if (manual) toast(L("No se pudo comprobar las actualizaciones", "Could not check for updates")); }
    if (ui.tab === "ajustes") renderAjustes();
  }
  function showUpdateBar(v, cur) {
    let bar = $("updBar");
    if (!bar) { bar = document.createElement("div"); bar.id = "updBar"; bar.className = "upd-bar"; document.body.appendChild(bar); }
    bar.innerHTML = `<span>${L(`<b>Hay una versión nueva (${esc(v)})</b>. Tienes la ${esc(cur)}; tus datos se conservan.`, `<b>A new version is available (${esc(v)})</b>. You have ${esc(cur)}; your data is kept.`)}</span>
      <span class="row"><button class="btn small primary" data-upd-go>${L("Actualizar ahora", "Update now")}</button><button class="btn small" data-upd-later>${L("Más tarde", "Later")}</button></span>`;
    bar.hidden = false;
  }
  document.addEventListener("click", async e => {
    if (e.target.closest("[data-upd-later]")) { $("updBar").hidden = true; return; }
    if (e.target.closest("[data-upd-check]")) { checkUpdates(true); return; }
    const go = e.target.closest("[data-upd-go]"); if (!go) return;
    go.disabled = true; go.textContent = L("Descargando…", "Downloading…");
    try { await TAURI().invoke("install_update"); }  // si va bien, la app se reinicia ya actualizada
    catch (err) { go.disabled = false; go.textContent = L("Actualizar ahora", "Update now"); updState = { t: L("No se pudo actualizar: ", "Could not update: ") + err, err: true }; toast(L("No se pudo actualizar: ", "Could not update: ") + err); }
  });
  if (IS_APP) setTimeout(() => checkUpdates(false), 1500);
  // ---- Contenido nuevo sin reinstalar (tools/contenido.py): datos y textos firmados en la rama «contenido» del repo
  // público de versiones. La app lo descarga, Rust comprueba la firma (content_put) y se aplica al volver a abrir
  // (o con «Aplicar ahora», que recarga la ventana). Si es para otra versión de la app (schema), no se toca.
  const CONTENT_URL = "https://raw.githubusercontent.com/r3b0rNjHs/noc-releases/contenido/";
  function fmtV(v) { const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString(EN ? "en-GB" : "es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function contentLine() { const C = window.NOC_CONTENT; return C ? L(`Datos y textos del ${fmtV(C.v)} (${C.downloaded ? "descargados" : "los que trae la app"}).`, `Data and texts from ${fmtV(C.v)} (${C.downloaded ? "downloaded" : "included with the app"}).`) : ""; }
  async function checkContent(manual) {
    const T = TAURI(), C = window.NOC_CONTENT; if (!IS_APP || !T || !C) return;
    try {
      const get = async (f, json) => { const r = await fetch(CONTENT_URL + f, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return json ? r.json() : r.text(); };
      const v = await get("version.json", true);
      if (v.schema !== C.schema) contState = { t: contentLine() + " " + L("Hay datos nuevos para una versión más nueva de la app: llegarán al actualizarla.", "There's new data for a newer app version: it will arrive when you update.") };
      else if (!(String(v.v) > String(C.v))) { contState = { t: contentLine() + " " + L("Son los más recientes.", "They're the latest.") }; if (manual) toast(L("Ya tienes los datos más recientes", "You already have the latest data")); }
      else {
        const [data, sig] = await Promise.all([get("contenido.json"), get("contenido.json.sig")]);
        await T.invoke("content_put", { data, sig });
        contState = { t: L(`Hay datos y textos nuevos (del ${fmtV(v.v)}), ya descargados: se aplican al volver a abrir la app.`, `New data and texts (from ${fmtV(v.v)}) downloaded: they apply when you reopen the app.`), ready: true };
        showContentBar(v.v);
      }
    } catch (err) { contState = { t: contentLine() + " " + L("No se pudo comprobar si hay datos nuevos: ", "Couldn't check for new data: ") + err, err: true }; if (manual) toast(L("No se pudo comprobar si hay datos nuevos", "Couldn't check for new data")); }
    if (ui.tab === "ajustes") renderAjustes();
  }
  function showContentBar(v) {
    if ($("updBar") && !$("updBar").hidden) return;   // si hay versión nueva de la app, manda ese aviso
    let bar = $("contBar");
    if (!bar) { bar = document.createElement("div"); bar.id = "contBar"; bar.className = "upd-bar"; document.body.appendChild(bar); }
    bar.innerHTML = `<span>${L(`<b>Datos y textos nuevos</b> (del ${esc(fmtV(v))}): plan, fichas, tier list y equipos al día. Tus datos se conservan.`, `<b>New data and texts</b> (from ${esc(fmtV(v))}): plan, sheets, tier list and teams up to date. Your data is kept.`)}</span>
      <span class="row"><button class="btn small primary" data-cont-go>${L("Aplicar ahora", "Apply now")}</button><button class="btn small" data-cont-later>${L("Más tarde", "Later")}</button></span>`;
    bar.hidden = false;
  }
  document.addEventListener("click", e => {
    if (e.target.closest("[data-cont-later]")) { $("contBar").hidden = true; return; }
    if (e.target.closest("[data-cont-go]")) { location.reload(); return; }
    if (e.target.closest("[data-upd-check]")) checkContent(true);
  });
  if (IS_APP) setTimeout(() => checkContent(false), 4000);
  // En la app, los enlaces web se abren en el navegador del sistema (dentro de la app se perdería la ventana).
  if (IS_APP) document.addEventListener("click", e => {
    const a = e.target.closest("a[href^='http']"); if (!a) return;
    e.preventDefault(); const t = TAURI(); if (t) t.invoke("open_link", { url: a.href }).catch(() => toast(L("No se pudo abrir el enlace", "Could not open the link")));
  }, true);

  // ---------------- PROGRESO: récords por modo, gráficas y todos los intentos en orden
  function renderProgreso() {
    const all = Object.entries(tries).map(([id, x]) => ({ id, ...x })).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const recs = MODES.map(m => { const r = modeRecord(m); return r ? `<div class="rec-tile static"><span class="eyebrow">${esc(m.name)}</span><b class="rec-big">${esc(r.big)}</b><span class="note">${esc(r.sub)} · ${r.n} ${L("intento", "attempt")}${r.n > 1 ? "s" : ""}</span></div>` : ""; }).join("");
    const charts = MODES.filter(m => m.kind === "pve").map(m => { const ch = triesChart(m); return ch ? `<article class="panel"><h3>${esc(m.name)}</h3>${ch}${teamCompare(m)}</article>` : ""; }).join("");
    const byDay = {}; all.forEach(x => { const d = String(x.at || "").slice(0, 10); (byDay[d] = byDay[d] || []).push(x); });
    const fmtD = d => d ? new Date(d + "T12:00:00").toLocaleDateString(EN ? "en-GB" : "es-ES", { weekday: "long", day: "numeric", month: "long" }) : L("Sin fecha", "No date");
    const resOf = (m, x) => !m ? "" : m.kind === "pvp" ? (x.result === "win" ? L("Victoria", "Win") : L("Derrota", "Loss")) : m.kind === "exam" ? L("Piso ", "Floor ") + x.damage : fmtNum(+x.damage || 0);
    $("progresoBody").innerHTML = `
      <article class="panel"><div class="row" style="justify-content:space-between"><h3>${L("Tus récords", "Your records")}</h3><span class="note">${plur(all.length, "intento en total", "intentos en total", "attempt in total", "attempts in total")}</span></div><div class="rec-grid" style="margin-top:10px">${recs || `<p class="note">${L("Aún no hay intentos.", "No attempts yet.")}</p>`}</div></article>
      ${charts ? `<div class="prog-charts">${charts}</div>` : ""}
      <article class="panel"><h3>${L("Todos tus intentos", "All your attempts")}</h3>
        <div class="timeline">${foldRest(Object.entries(byDay), ([d, xs]) => `<div class="tl-day"><div class="eyebrow">${esc(fmtD(d))}</div>${xs.map(x => { const m = modeOf(x.mode);
          const live = m && altsOf(m).some(a => a.id === x.alt);
          return `<div class="tl-row"><span class="chip">${esc(m ? m.name : x.mode)}</span><b class="mono">${esc(resOf(m, x))}</b>
            <span class="best-faces">${(x.team || []).filter(s => BY.get(s) && !BY.get(s).m).map(s => pic(s, BY.get(s).n)).join("")}</span>
            <span class="tl-lbl">${esc(altShort(x.altLabel || x.alt))}${x.power ? ` <span class="muted mono">· ${Math.round(x.power / 1000)}k</span>` : ""}${live ? "" : ` <span class="muted">· ${L("descartado", "retired")}</span>`}</span>
            ${live ? `<button class="btn small" data-goalt="${esc(x.mode + ":" + x.alt)}">${L("Ver", "View")}</button>` : ""}</div>`; }).join("")}</div>`, n => L(`Ver ${n} día${n > 1 ? "s" : ""} más`, `See ${n} more day${n > 1 ? "s" : ""}`)) || `<p class="note">${L("Registra tu primer intento con «＋ Intento».", "Log your first attempt with «＋ Attempt».")}</p>`}</div></article>`;
  }
  // Tarjetas de equipo plegables: tocar la cabecera las pliega; se recuerda en este navegador.
  $("iiGrid").addEventListener("click", e => {
    const all = e.target.closest("[data-foldall]");
    if (all) { const fold = all.dataset.foldall === "1"; document.querySelectorAll("#iiGrid .ii-card[data-fkey]").forEach(c => { c.classList.toggle("folded", fold); cardFolds[c.dataset.fkey] = fold ? 1 : 0; }); saveCardFolds(); return; }
    const h = e.target.closest(".ii-card .tc-head, .ii-card.folded > .tc-mini"); if (!h || e.target.closest("a, button, input, select, .origin")) return;
    const c = h.closest(".ii-card"); const k = c.dataset.fkey; if (!k) return;
    c.classList.toggle("folded"); cardFolds[k] = c.classList.contains("folded") ? 1 : 0; saveCardFolds();
  });
  $("iiGrid").addEventListener("click", e => onAltClick(e));
  $("iiGrid").addEventListener("submit", async e => {
    const f = e.target.closest("form[data-wall-form]"); if (!f) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const fd = new FormData(f);
    const body = { floor: Number(fd.get("floor")), what: (fd.get("what") || "").trim(), fix: (fd.get("fix") || "").trim(), passed: !!fd.get("passed"), at: new Date().toISOString() };
    if (!(body.floor > 0)) { toast(L("Escribe el piso", "Enter the floor")); return; }
    const id = "p" + body.floor + "-" + Date.now().toString(36);
    walls = { ...walls, [id]: body }; lsWrite(); renderII();
    if (db) { try { await db.collection("pisos").doc(id).set(body); toast(L("Piso apuntado", "Floor noted")); } catch { toast(L("Guardado solo ", "Saved only ") + HERE); } }
  }, true);
  $("iiGrid").addEventListener("click", async e => {
    const b = e.target.closest("[data-wall-del]"); if (!b) return;
    const id = b.dataset.wallDel; const { [id]: _, ...rest } = walls; walls = rest; lsWrite(); renderII();
    if (db) { try { await db.collection("pisos").doc(id).delete(); } catch {} }
  });
  $("idealGrid").addEventListener("click", e => onAltClick(e));
  $("idealGrid").addEventListener("click", e => {
    const h = e.target.closest(".ii-card .tc-head, .ii-card.folded > .tc-mini"); if (!h || e.target.closest("a, button, input, select, .origin")) return;
    const c = h.closest(".ii-card"); const k = c.dataset.fkey; if (!k) return;
    c.classList.toggle("folded"); cardFolds[k] = c.classList.contains("folded") ? 1 : 0; saveCardFolds();
  });
  async function onAltClick(e) {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if (d.altOpen) {
      const { m, a } = findAlt(d.altOpen); if (!a) { toast(L("Ese equipo ya no está", "That team is gone")); renderII(); return; }
      Object.assign(team, { id: null, cells: placeCells(a.cells), mainSel: { ...(a.mainSel || {}) }, summon: a.summon || "", summonM: a.summonM || "", name: m.name + " · " + a.label, notes: "", superArmor: !!m.superArmor });
      mainFixed = Object.keys(a.mainSel || {}).length > 0;
      $("teamName").value = team.name; $("teamMode").value = { ar: "Arena", s1: "Infinite Illusion · Stage 1 (Chase)", s2: "Infinite Illusion · Stage 2 (Mystery)", s3: "Infinite Illusion · Stage 3 (Standard)", n9: "Nine-Tails", rk: "Ranked Battle", ne: "Ninja Exam" }[m.k.replace(/^i-/, "")]; $("teamNotes").value = "";
      ui.starter = null; setTab("creador"); return;
    }
    if (d.altSave) {
      const { m, a } = findAlt(d.altSave); if (!a) { toast(L("Ese equipo ya no está", "That team is gone")); renderII(); return; }
      const id = ("rec-" + d.altSave).replace(/[^a-zA-Z0-9_-]/g, "-");
      const body = { name: m.name + " · " + a.label, mode: { ar: "Arena", n9: "Nine-Tails", rk: "Ranked Battle", ne: "Ninja Exam" }[m.k.replace(/^i-/, "")] || "Infinite Illusion", notes: [a.passives, a.assist ? "Assist: " + a.assist : ""].filter(Boolean).join(" · "),
        cells: placeCells(a.cells).map(s => s || ""), mainSel: { ...(a.mainSel || {}) }, summon: a.summon || "", summonM: a.summonM || "", updatedAt: new Date().toISOString() };
      teams = { ...teams, [id]: body }; lsWrite(); renderSaved();
      if (db) { try { await db.collection("equipos").doc(id).set(body); } catch {} }
      toast(L("Guardado en «Equipos guardados»", "Saved to «Saved teams»")); return;
    }
    if (d.addAlt) {
      if (!team.cells.some(Boolean)) { toast(L("Monta primero el equipo en el creador", "Build the team in the Builder first")); return; }
      const id = "c" + Date.now().toString(36);
      const body = { mode: d.addAlt, label: $("teamName").value.trim() || L("Mi alternativa", "My alternative"), cells: team.cells.map(s => s || ""), mainSel: { ...team.mainSel }, summon: team.summon || "", notes: $("teamNotes").value.trim() };
      customAlts = { ...customAlts, [id]: body }; lsWrite(); renderII();
      if (db) { try { await db.collection("alternativas").doc(id).set(body); } catch {} }
      toast(L("Alternativa añadida", "Alternative added")); return;
    }
    if (d.altDel) { ui.delAlt = d.altDel; renderII(); return; }
    if (b.hasAttribute("data-alt-del-no")) { ui.delAlt = null; renderII(); return; }
    if (d.altDelYes) {
      const { a } = findAlt(d.altDelYes); ui.delAlt = null; if (!a) { renderII(); return; }
      const { [a.custom]: _, ...rest } = customAlts; customAlts = rest; lsWrite(); renderII();
      if (db) { try { await db.collection("alternativas").doc(a.custom).delete(); } catch {} }
      return;
    }
    if (d.tryDel) { ui.delTry = d.tryDel; renderII(); return; }
    if (b.hasAttribute("data-try-del-no")) { ui.delTry = null; renderII(); return; }
    if (d.tryDelYes) {
      const id = d.tryDelYes; ui.delTry = null;
      const { [id]: _, ...rest } = tries; tries = rest; lsWrite(); renderII();
      if (db) { try { await db.collection("intentos").doc(id).delete(); } catch {} }
    }
  }

  function missingBlock(units) {
    const miss = units.filter(u => !u.n.m && !profile.owned[u.n.s]);
    if (!miss.length) return `<div class="conf" data-c="Alta">${L("<b>Lo tienes todo.</b> Puedes montarlo ya.", "<b>You have them all.</b> You can build it now.")}</div>`;
    return `<div class="missing"><div class="eyebrow">${L("Te falta", "Missing")}</div>${miss.map(u => {
      const r = MY_RECS.find(x => x.s === u.n.s);
      return `<div class="miss-item">${pic(u.n.s, u.n.n)}<div><b>${esc(u.n.n)}</b><div class="note">${r ? esc(r.now) : L("Consulta «Ninjas › Ninjas recomendados».", "See «Library › Recommended».")}</div></div></div>`;
    }).join("")}</div>`;
  }
  const face = (slug, cls = "") => { const n = BY.get(slug) || { s: slug, n: slug };
    const miss = !n.m && !profile.owned[slug] && (IS_APP || slug !== "madara-uchiha-the-final-battle");
    return `<span class="face${miss ? " miss" : ""} ${cls}" title="${esc(n.n)}${miss ? L(" (te falta)", " (missing)") : ""}">${pic(n.s, n.n)}</span>`; };
  // Etiqueta corta de cómo se consigue, a partir del texto de «Ninjas › Ninjas recomendados»
  const howTag = t => /gratis ahora|fácil|Fácil/.test(t) ? L("Fácil de conseguir", "Easy to get") : /No sale|no sale/.test(t) ? L("Sin eventos gratis", "No free events")
    : /Solo Fukurokumaru|Fukurokumaru's Deal/.test(t) ? L("Fukurokumaru (gasto)", "Fukurokumaru (spending)") : /Muy difícil/.test(t) ? L("Muy difícil", "Very hard") : /Difícil|difícil/.test(t) ? L("Difícil", "Hard") : L("Eventos", "Events");
  function renderIdealHero() {
    // piezas que faltan, contadas en cuántos equipos ideales aparecen
    const cnt = new Map();
    IDEAL.forEach(m => m.alts.forEach(a => (a.cells || []).filter(Boolean).forEach(x => {
      const n = BY.get(x); if (!n || n.m || profile.owned[x]) return; cnt.set(x, (cnt.get(x) || 0) + 1);
    })));
    const inv = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
    const all = IDEAL.flatMap(m => m.alts), ready = all.filter(a => (a.cells || []).every(x => !x || (BY.get(x) || {}).m || profile.owned[x])).length;
    const invItem = (([x, k]) => { const n = BY.get(x); const r = MY_RECS.find(q => q.s === x) || (howToGet(x) ? { now: howToGet(x) } : null);
          return `<div class="invest-item">${pic(n.s, n.n)}<div><b>${esc(n.n)}</b><span class="n">${L("en", "in")} ${k} ${L("equipo", "team")}${k > 1 ? "s" : ""}</span>${r ? `<span class="how">${esc(howTag(r.now))}</span>` : ""}</div></div>`; });
    $("idealHero").innerHTML = `
      <div class="ideal-hero">${inv.length ? pic(inv[0][0], (BY.get(inv[0][0]) || {}).n || "") : ""}
        <div><div class="eyebrow">${L("Equipos ideales", "Ideal teams")}</div><h2>${L("Lo mejor de cada modo, aunque te falten ninjas", "The best of each mode, even if you lack ninjas")}</h2>
          <div class="sub">${L("Los equipos que más usa el top en Arena (Nexus y KonohaHub) y los mejores de referencia para Infinite Illusion, Nine-Tails y Ninja Exam, sea cual sea su carry. No están pensados para tu cuenta: para eso está «Con tus ninjas».", "The teams top players use most in Arena (Nexus and KonohaHub) and the best reference teams for Infinite Illusion, Nine-Tails and Ninja Exam, whatever their carry. They're not tailored to your account: that's what «With your ninjas» is for.")}</div>
          <div class="hero-facts"><span class="gold">${L(`Puedes montar ${ready} de ${all.length}`, `You can build ${ready} of ${all.length}`)}</span><span>${L(`Te faltan ${cnt.size} ninjas distintos`, `You're missing ${cnt.size} different ninjas`)}</span></div></div></div>
      ${inv.length ? `<div class="panel invest"><h3>${L("Qué conseguir primero", "What to get first")}</h3><p class="note" style="margin:2px 0 0">${L("Ninjas que te faltan, ordenados por cuántos equipos ideales de esta pestaña completan.", "Ninjas you're missing, sorted by how many ideal teams in this tab they complete.")}</p>
        <div class="invest-row">${inv.slice(0, 10).map(invItem).join("")}</div>${inv.length > 12 ? `<details class="more-rows"><summary>${L(`Ver ${inv.length - 10} más`, `Show ${inv.length - 10} more`)}</summary><div class="invest-row">${inv.slice(10).map(invItem).join("")}</div></details>` : inv.slice(10).length ? `<div class="invest-row">${inv.slice(10).map(invItem).join("")}</div>` : ""}</div>` : ""}`;
  }
  function idealCard(m, t, first) {
    const cells = placeCells(t.cells);
    const tt = { cells, mainSel: t.mainSel || {}, summon: t.summon || "", superArmor: !!m.superArmor };
    const units = lineup(tt);
    const members = units.filter(u => !u.n.m);
    const main = units.find(u => u.n.m);
    const have = members.filter(u => profile.owned[u.n.s]).length;
    const sm = t.summon && SUM.get(t.summon);
    const key = m.k + ":" + t.id;
    const miss = members.filter(u => !profile.owned[u.n.s]);
    const { jobs, rest } = splitWhy(units, t.why);
    // Plegadas como las de Equipos (la primera abierta); el resumen dice si puedes montarlo ya.
    const fk = "ideal:" + key, folded = fk in cardFolds ? !!cardFolds[fk] : !first;
    const mini = `<div class="tc-mini"><span class="tc-faces">${members.map(u => face(u.n.s)).join("")}</span>
      <span class="chip${miss.length ? "" : " on"}">${miss.length ? L(`te falta${miss.length > 1 ? "n" : ""} ${miss.length}`, `${miss.length} missing`) : L("lo tienes todo", "you have them all")}</span></div>`;
    return `<article class="panel icard ii-card${folded ? " folded" : ""}" data-fkey="${esc(fk)}">
      ${cardHead(t)}
      ${mini}
      <div class="progress"><div class="track"><i style="width:${Math.round(have / Math.max(1, members.length) * 100)}%"></i></div>
        <span>${have === members.length ? L("Lo tienes todo: puedes montarlo ya.", "You have them all: you can build it now.") : L(`Tienes ${have} de ${members.length}. Te falta: `, `You have ${have} of ${members.length}. Missing: `) + `${miss.map(u => esc(u.n.n)).join(", ")}.`}</span></div>
      <div class="tc-mid">${board(cells)}${jobsList(units, jobs)}</div>
      ${placeNote(t, cells)}
      ${setupTiles(t, main, sm)}
      ${rest.length ? `<details><summary>${L("Más notas", "More notes")}</summary><ul class="why">${rest.map(w => `<li>${esc(w)}</li>`).join("")}</ul></details>` : ""}
      ${miss.length ? `<details><summary>${L("Cómo conseguir lo que falta", "How to get what's missing")}</summary>${miss.map(u => { const r = MY_RECS.find(q => q.s === u.n.s) || (howToGet(u.n.s) ? { now: howToGet(u.n.s) } : null);
        return `<div class="miss-item" style="margin-top:6px">${pic(u.n.s, u.n.n)}<div><b>${esc(u.n.n)}</b><div class="note">${r ? esc(r.now) : L("Mira «Ninjas › Ninjas recomendados».", "See «Library › Recommended».")}</div></div></div>`; }).join("")}</details>` : ""}
      <div class="row"><button class="btn small primary" data-alt-open="${escAttr(key)}">${L("Abrir en el creador", "Open in Builder")}</button><button class="btn small" data-alt-save="${escAttr(key)}">${L("Guardar en mis equipos", "Save to my teams")}</button></div>
    </article>`;
  }
  function renderIdeal() {
    const m = IDEAL.find(x => x.k === ui.idealMode) || IDEAL[0]; ui.idealMode = m.k; tacKind = kindOf(m.k);
    renderTacBars();
    renderIdealHero();
    $("idealTabs").innerHTML = IDEAL.map(x => `<button class="subtab" role="tab" data-imode="${escAttr(x.k)}" aria-selected="${x.k === m.k}">${esc(x.name)}</button>`).join("");
    let extra = "";
    if (m.k === "i-ar") extra = `<p class="note" style="margin:8px 0 0">${L("Las listas completas de equipos más repetidos (Nexus, KonohaHub EN y BR) están en Biblioteca › Meta del top.", "The full lists of most repeated teams (Nexus, KonohaHub EN and BR) are in Library › Top meta.")} <button class="btn small" data-go="meta">${L("Ver Meta del top", "See Top meta")}</button></p>`;
    $("idealInfo").innerHTML = `<div class="row" style="justify-content:space-between"><h2>${esc(m.name)}</h2><span class="bonus-tag" style="color:var(--uchiha)">${esc(m.bonus)}</span></div><p class="note clamp" style="margin:6px 0 0">${esc(m.info)}</p><button class="more-btn" data-more aria-expanded="false">${L("Leer más", "Read more")}</button>${extra}`;
    $("idealGrid").innerHTML = m.alts.map((a, i) => idealCard(m, a, i === 0)).join("");
  }
  $("idealTabs").addEventListener("click", e => { const b = e.target.closest("[data-imode]"); if (b) { ui.idealMode = b.dataset.imode; renderIdeal(); } });

  // ---------------- RECOMENDADOS
  function renderRecs() {
    const own = s => !!profile.owned[s];
    const RBY = new Map(MY_RECS.map(r => [r.s, r]));
    const CAT = TIER_CAT;
    const seen = new Set();
    const groups = EN ? [["rising", "New and rising", "New in 2026 or just got a breakthrough. Little or no usage data yet: this is what videos and the community say."],
      ["carry", "PvP carries (position 1)", "The ones dealing the main damage in Arena and Ranked, sorted by tier list and by how often they act first in the Top 100."],
      ["sup", "PvP supports", "The ones that most often go with top carries, sorted by tier list and usage."],
      ["pve", "PvE: Infinite Illusion, Nine-Tails and Ninja Exam", "From KonohaHub's Infinite Illusion chase tier list, the PvE reference teams and the Ninja Exam research."]]
      : [["rising", "Novedades y en alza", "Lo nuevo de 2026 o lo que acaba de recibir breakthrough. Hay poca o ninguna estadística aún: es lo que dicen los vídeos y la comunidad."],
      ["carry", "Carries PvP (posición 1)", "Los que hacen el daño principal en Arena y Ranked, ordenados por tier list y por cuántas veces actúan los primeros en el Top 100."],
      ["sup", "Soportes PvP", "Los que más acompañan a los carries del top, ordenados por tier list y uso."],
      ["pve", "PvE: Infinite Illusion, Nine-Tails y Ninja Exam", "Por la tier list de chases de Infinite Illusion de KonohaHub, los equipos de referencia de PvE y la investigación de Ninja Exam."]];
    const card = e => {
      const n = BY.get(e.s) || { s: e.s, n: e.name || e.s, e: "", r: "", ro: "" };
      const r = RBY.get(e.s);
      const tiers = Object.entries(e.t).map(([k, v]) => `<span class="chip"><span class="rk-seal" data-t="${escAttr(v)}" style="transform:none;width:18px;height:18px;font-size:.66rem">${v}</span> ${CAT[k]}</span>`).join("");
      return `<article class="panel rec">
        ${pic(n.s, n.n)}
        <div style="min-width:0">
          <div class="head">${e.est ? `<span class="prio" data-p="Media">${L("Estimado ≈", "Estimated ≈")}</span>` : ""}<h3>${esc(n.n)}</h3>
            <span class="meta" style="display:inline-flex;gap:6px;align-items:center;font-size:.8rem;color:var(--muted)"><span class="el" data-e="${escAttr(n.e)}"></span><span class="rar">${n.r || ""}</span>${esc(n.ro || "")}</span></div>
          <div class="kh-tags" style="margin-top:4px">${tiers}${(e.modes || []).map(m => `<span class="chip">${esc(m)}</span>`).join("")}</div>
          ${e.ev.length ? `<div class="note mono" style="margin-top:6px">${e.ev.map(esc).join(" · ")}</div>` : ""}
          <div class="cols">
            <div><h4>${L("Por qué", "Why")}</h4><ul>${(e.why || []).map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>
            <div><h4>${L("Cómo conseguirlo", "How to get it")}</h4><div style="font-size:.86rem">${esc(r && r.now ? r.now : e.get)}</div>
              ${r && r.teams ? `<h4 style="margin-top:10px">${L("Con tu cuenta", "With your account")}</h4><ul>${r.teams.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}</div>
          </div>
        </div></article>`;
    };
    let shown = 0, hidden = 0;
    // Un grupo cada vez (pestañas): con los cuatro seguidos la página medía ~7.000 px.
    const lists = groups.map(([g, title, sub]) => {
      const list = (REC_ALL[g] || []).filter(e => { if (seen.has(e.s)) return false; seen.add(e.s); if (own(e.s)) { hidden++; return false; } return true; });
      shown += list.length; return { g, title, sub, list };
    }).filter(x => x.list.length);
    const W = wantList();
    if (W.length) lists.unshift({ g: "mine", title: L("Para tu cuenta", "For your account"), sub: L("Los ninjas que más equipos te completan con lo que ya tienes (los de Equipos de cada modo). Deducción con tus ninjas, la tier list y cuándo se ha podido conseguir cada uno.", "The ninjas that complete the most teams with what you already have (each mode's Teams). Deduced from your ninjas, the tier list and when each one could be obtained.") + " " + spendNote(0), list: (spendLv() ? W : [...W.filter(x => !/^paid/.test(x.acq)), ...W.filter(x => /^paid/.test(x.acq))]).slice(0, 15) });
    const cur = lists.find(x => x.g === ui.recG) || lists[0];
    const curG = cur && cur.g;
    const short = EN ? { mine: "For you", rising: "New", carry: "PvP carries", sup: "PvP supports", pve: "PvE" } : { mine: "Para ti", rising: "Novedades", carry: "Carries PvP", sup: "Soportes PvP", pve: "PvE" };
    const mineCard = x => { const n = BY.get(x.s); const e = recAll(x.s);
      return `<article class="panel rec">${pic(n.s, n.n)}<div style="min-width:0">
        <div class="head"><h3>${esc(n.n)}</h3>${x.tier ? `<span class="rk-seal" data-t="${escAttr(x.tier)}" style="transform:none">${x.tier}</span>` : ""}</div>
        <div class="cols"><div><h4>${L("Qué te da", "What it gives you")}</h4><ul><li>${esc(wantWhy(x))}</li>${x.one.slice(3, 6).map(y => `<li>${esc(modeShort(y.m))}: ${esc(altShort(y.a.label))}</li>`).join("")}${e && e.why ? e.why.slice(0, 2).map(w => `<li>${esc(w)}</li>`).join("") : ""}</ul></div>
          <div><h4>${L("Cómo conseguirlo", "How to get it")}</h4><div style="font-size:.86rem">${wantTag(x, W)}${esc(getLine(x.s))}</div></div></div>
        <div class="row" style="margin-top:6px"><button class="btn small" data-ninja="${escAttr(x.s)}">${L("Ver su ficha", "Open its sheet")}</button>${goalBtn(x.s, L("Conseguirlo", "Get it"), getLine(x.s))}</div></div></article>`; };
    $("recs").innerHTML = `<p class="note" style="margin:0 0 4px">${EN ? `${shown} recommended ninjas you don't have${hidden ? ` (${hidden} you own are hidden)` : ""}. Data: KonohaHub's Top 100 (${REC_ALL.meta.top100} real formations), usage in KonohaHub's EN/BR top and Nexus, the tier list and research from ${REC_ALL.meta.date}.`
        : `${shown} ninjas recomendados que no tienes${hidden ? ` (ocultos ${hidden} que ya tienes)` : ""}. Datos: Top 100 de KonohaHub (${REC_ALL.meta.top100} formaciones reales), uso en el top EN/BR de KonohaHub y Nexus, la tier list y la investigación del ${REC_ALL.meta.date}.`}</p>
      <nav class="subtabs" role="tablist" aria-label="${L("Grupo de recomendados", "Recommended group")}" style="margin:8px 0">${lists.map(x => `<button class="subtab" role="tab" data-recg="${escAttr(x.g)}" aria-selected="${x.g === curG}">${short[x.g]} <span class="muted mono">${x.list.length}</span></button>`).join("")}</nav>`
      + (cur ? `<div class="rec-group"><h2>${cur.title}</h2><p class="note" style="margin:2px 0 0">${cur.sub}</p></div>${foldRest(cur.list, cur.g === "mine" ? mineCard : card)}` : "");
  }

  $("recs").addEventListener("click", e => { const b = e.target.closest("[data-recg]"); if (!b) return; ui.recG = b.dataset.recg; try { localStorage.setItem(LS + "-recg", ui.recG); } catch {} renderRecs(); });
  try { ui.recG = localStorage.getItem(LS + "-recg") || ""; } catch {}

  // ---------------- SUMMONS
  function renderSummons() {
    const mine = new Set(profile.summons || []);
    // Tu equipo de Arena: en el Cuartel, el A del usuario; en la app, tu mejor equipo registrado o el primero que puedes montar.
    const ar = MODES.find(m => m.k === "ar");
    const A = !IS_APP ? ar.alts[0] : (() => { const al = altsOf(ar).filter(a => !(a.miss || []).length && !a.trio), r = modeRecord(ar);
      return (r && r.best && al.find(a => a.id === r.best.alt)) || al[0] || null; })();
    const causes = new Set();
    (A ? A.cells : []).filter(Boolean).forEach(s => { const n = BY.get(s); if (!n) return; (n.m ? unitSkills(n, { mainSel: A.mainSel || {} }) : n.sk).forEach(k => (k.ca || []).forEach(c => causes.add(c))); });
    const fits = x => x.combo === 10 || x.trig.some(st => causes.has(st));
    const TC = EN ? {} : { Red: "Rojo", Yellow: "Amarillo", Purple: "Morado", Blue: "Azul" };
    const seal = (g, lbl) => `<span class="chip"><span class="rk-seal" data-t="${escAttr(g)}" style="transform:none;width:18px;height:18px;font-size:.66rem">${g}</span> ${lbl}</span>`;
    const ownedList = SUMMONS.filter(x => mine.has(x.s));
    const bestOwn = k => ownedList.slice().sort((a, b) => "SABCD".indexOf(a[k]) - "SABCD".indexOf(b[k]))[0];
    const want = k => SUMMONS.filter(x => !mine.has(x.s) && "SA".includes(x[k])).sort((a, b) => ("SABCD".indexOf(a[k]) - "SABCD".indexOf(b[k])) || ((fits(b) ? 1 : 0) - (fits(a) ? 1 : 0))).slice(0, 4);
    const f = ui.sumF || "best";
    const list = SUMMONS.filter(x => f === "mine" ? mine.has(x.s) : f === "best" ? ("SA".includes(x.pvp) || "SA".includes(x.pve)) : f === "Red" || f === "Yellow" ? x.tier === f : true);
    const row = x => `<article class="panel sum-row${mine.has(x.s) ? " own" : ""}">
        <div class="sum-head"><span class="sum-dot" data-c="${escAttr(x.tier)}"></span><h3>${esc(x.n)}</h3>
          ${seal(x.pvp, "PvP")}${seal(x.pve, "PvE")}
          <span class="chip">${TC[x.tier] || x.tier} · ${x.frag || "?"} ${L("fragmentos", "fragments")}</span>
          ${fits(x) ? `<span class="chip on">${L("Encaja con tu equipo", "Fits your team")}</span>` : ""}${mine.has(x.s) ? `<span class="tag-own">${L("Lo tienes", "Owned")}</span>` : ""}</div>
        <div class="sum-cols"><div><h4>${L("Habilidad", "Skill")}</h4><p>${esc(x.desc)}</p></div>${x.myst ? `<div><h4>${L("Mystery para el main (nivel alto)", "Mystery for the main (high level)")}</h4><p>${esc(x.myst)}</p></div>` : ""}</div>
        ${x.why ? `<p class="note" style="margin:6px 0 0"><b>${L("Valoración", "Rating")}:</b> ${esc(x.why)}</p>` : ""}
      </article>`;
    const pill = (k, l) => `<button class="subtab" data-sumf="${escAttr(k)}" aria-selected="${f === k}">${l}</button>`;
    $("sumBody").innerHTML = `
      <div class="panel" style="margin-bottom:14px"><h2 style="margin:0 0 6px">${L("Para tu cuenta", "For your account")}</h2>
        <p class="note" style="margin:0 0 8px">${L(`Tienes ${ownedList.length} summons.`, `You have ${ownedList.length} summons.`)}${A ? ` ${L(IS_APP ? "Tu equipo de Arena" : "Tu equipo principal", IS_APP ? "Your Arena team" : "Your main team")} (${esc(String(A.label).replace(/^[A-Z] · /, "").replace(/^(Tuya|Yours) · /, ""))}) ${L("causa", "causes")}: ${[...causes].filter(c => ["Knockdown", "Low Float", "High Float", "Repulse", "Immobile"].includes(c)).join(", ") || "—"}.` : ""}</p>
        <div class="home-list">
          ${bestOwn("pvp") ? `<div class="home-li"><span class="rk-seal" data-t="${bestOwn("pvp").pvp}">${bestOwn("pvp").pvp}</span><div><b>${L("Para PvP con lo que tienes", "For PvP with what you have")}: ${esc(bestOwn("pvp").n)}</b><div class="note">${esc(bestOwn("pvp").why || bestOwn("pvp").desc)}</div></div></div>` : ""}
          ${bestOwn("pve") ? `<div class="home-li"><span class="rk-seal" data-t="${bestOwn("pve").pve}">${bestOwn("pve").pve}</span><div><b>${L("Para PvE con lo que tienes", "For PvE with what you have")}: ${esc(bestOwn("pve").n)}</b><div class="note">${esc(bestOwn("pve").why || bestOwn("pve").desc)}</div></div></div>` : ""}
        </div>
        <h3 style="margin:12px 0 4px">${L("Qué conseguir", "What to get")}</h3>
        <div class="home-list">${[...new Map([...want("pvp"), ...want("pve")].map(x => [x.s, x])).values()].map(x => { const pv = "SABCD".indexOf(x.pvp) <= "SABCD".indexOf(x.pve); const g = pv ? x.pvp : x.pve;
          return `<div class="home-li"><span class="rk-seal" data-t="${escAttr(g)}">${g}</span><div><b>${esc(x.n)}</b> <span class="chip">${pv ? "PvP" : "PvE"} ${g}${pv && "SA".includes(x.pve) ? " · PvE " + x.pve : !pv && "SA".includes(x.pvp) ? " · PvP " + x.pvp : ""}</span> ${fits(x) ? `<span class="chip on">${L("Encaja con tu equipo", "Fits your team")}</span>` : ""}<div class="note">${esc(x.why)}</div></div></div>`; }).join("")}</div>
      </div>
      <div class="panel only-claude" style="margin-bottom:14px"><h2 style="margin:0 0 6px">Quintuple Rashomon: ya lo tienes</h2>
        <ul class="why" style="margin:0">
          <li><b>Para qué sirve:</b> a 10 combo quita todos los escudos y buffs del rival y le aplica Weakness, y su mystery protege a tu main de los mysteries. Úsalo en Arena, Ranked y en los pisos de Ninja Exam con enemigos que se escudan.</li>
          <li><b>Siguiente summon rojo: Manda II</b> (sale en los Red Summon Optional Packs). A 10 combo da Weakness a una fila, y su mystery a nivel 3 hace inesquivables los chases de todo tu equipo.</li>
          <li><b>Para los pisos de marionetas de Ninja Exam: Centipede.</b> Su mystery a nivel 2 envenena a 3 rivales y a 10 combo da +25% de crítico a tu equipo, pero el veneno exige subir su mystery con gemas.</li>
          <li>No cojas otro Giant Shark ni las runas.</li>
        </ul>
        <p class="note" style="margin:6px 0 0">Valoración propia por el texto de las habilidades: no hay datos de qué summon usa el top.</p></div>
      <nav class="subtabs" style="margin-bottom:10px">${pill("best", L("Mejores (S y A)", "Best (S and A)"))}${pill("Red", L("Rojos", "Red"))}${pill("Yellow", L("Amarillos", "Yellow"))}${pill("mine", L("Los míos", "Mine"))}${pill("all", L("Todos", "All"))}</nav>
      <div class="sum-list">${list.map(row).join("") || `<p class="note">${L("Ninguno.", "None.")}</p>`}</div>`;
  }
  $("sumBody").addEventListener("click", e => { const b = e.target.closest("[data-sumf]"); if (b) { ui.sumF = b.dataset.sumf; renderSummons(); } });

  // ---------------- META Y CONSEJOS

  // Mejores equipos de Infinite Illusion y Nine-Tails (II_TOP) y KonohaHub

  function metaFaces(m) { return m.map(x => face(x)).join(""); }
  function renderMeta() {
    const sec = IS_APP && ui.metaSec === "mine" ? "used" : ui.metaSec || "used";
    const SECS = [["used", L("Lo más usado", "Most used")], ["iitop", "Top Infinite Illusion"], ["counters", L("Cómo ganarles", "How to beat them")], ["mine", "Tus ninjas"], ["assist", "Assist cards"], ["low", L("Rivales de servidor nuevo", "New-server rivals")]].filter(([k]) => !(IS_APP && k === "mine"));
    $("metaTabs").innerHTML = SECS.map(([k, t]) => `<button class="subtab" role="tab" data-msec="${escAttr(k)}" aria-selected="${k === sec}">${t}</button>`).join("");
    const owned = s => (BY.get(s) || {}).m || profile.owned[s];
    const nm = s => (BY.get(s) || { n: s }).n;
    // Listas largas: se ven las primeras `lim` filas y el resto queda tras «Ver las N restantes».
    const more = (rows, lim, cls) => rows.length <= lim + 2 ? `<div class="${escAttr(cls)}">${rows.join("")}</div>`
      : `<div class="${escAttr(cls)}">${rows.slice(0, lim).join("")}</div><details class="more-rows"><summary>${L(`Ver ${rows.length - lim} más`, `Show ${rows.length - lim} more`)}</summary><div class="${escAttr(cls)}">${rows.slice(lim).join("")}</div></details>`;
    const teamStrips = (list, lim = 99) => { const max = Math.max(...list.map(t => t.n));
      return more(list.map((t, i) => { const miss = t.m.filter(x => !owned(x)).length;
        return `<div class="strip${miss ? "" : " buildable"}"><span class="rank">${i + 1}</span><span class="faces">${metaFaces(t.m)}</span>
          <span class="meter"><i style="width:${Math.round(t.n / max * 100)}%"></i><span>${t.n} ${L("formaciones", "formations")} · ${miss ? L(`te falta${miss > 1 ? "n" : ""} ${miss}`, `${miss} missing`) : L("la puedes montar", "you can build it")}</span></span>
          <span class="cp">${typeof t.cp === "number" ? (EN ? String(t.cp) : String(t.cp).replace(".", ",")) + "M" : ""}</span></div>`; }), lim, "strips"); };
    const usedRows = (list, withP1, lim = 99) => { const max = Math.max(...list.map(u => u.n));
      return more(list.map((u, i) => `<div class="used-row${owned(u.s) ? " mine" : ""}"><span class="rank">${i + 1}</span>${face(u.s)}
        <div><b>${esc(nm(u.s))}</b> ${owned(u.s) ? `<span class="tag-own">${L("tuyo", "yours")}${profile.owned[u.s] && profile.owned[u.s].st ? " · " + profile.owned[u.s].st + "★" : ""}</span>` : ""}
          <div class="meter"><i style="width:${Math.round(u.n / max * 100)}%"></i></div>
          <span class="note">${u.n} ${L("formaciones", "formations")}${withP1 ? ` · ${u.p1 >= 40 ? L("carry principal", "main carry") : L("apoyo", "support")} (${u.p1}% ${L("en posición 1", "in position 1")})` : ""}</span></div></div>`), lim, "used"); };
    let html = "";
    if (sec === "now") html = `<p class="note"><b>Ciclo del 1 al 7 de octubre</b>, del anuncio oficial que me pasaste (más el 3v3 que sigue hasta el 6). El plan detallado y cuánto recargar están en la pestaña «Semana».</p>
      <div class="now-list">${META_TXT.now.map(e => `<article class="panel now-item">${pic(e.s, e.t)}<div><div class="now-top"><h3>${esc(e.t)}</h3><span class="pill" data-c="${e.tag === "Cógelo" ? "Alta" : e.tag === "Termina hoy" || e.tag === "Atento" ? "Media" : ""}">${esc(e.tag)}</span></div>
        <div class="note mono">${esc(e.when)}</div><p>${esc(e.d)}</p></div></article>`).join("")}</div>`;
    const khDates = KH_USAGE.en.dates.map(([r, d]) => `${r.replace("en-", "").toUpperCase()} ${d.split("-").reverse().join("/")}`).join(", "), brDates = KH_USAGE.br.dates.map(([, d]) => d.split("-").reverse().join("/")).join("");
    if (sec === "used") html = `<p class="note">${EN ? `Ninjas that appear most in top formations across the game according to Nexus (data from ${META_DATA.meta_date}). «Main carry» if they're in position 1 at least 40% of the time. Yours in green. Careful: appearing a lot doesn't always mean being good. The ones given to everyone (Madara [Edo Tensei], Hashirama [New Year], Choji [Great Ninja War]…) are inflated because almost everyone has them.`
        : `Ninjas que más aparecen en las formaciones top de todo el juego según Nexus (datos del ${META_DATA.meta_date}). «Carry principal» si van en posición 1 al menos el 40% de las veces. En verde, los tuyos. Ojo: aparecer mucho no siempre significa ser bueno. Los que se regalan a todos (Madara [Edo Tensei], Hashirama [New Year], Choji [Great Ninja War]…) salen inflados porque los tiene casi todo el mundo.`}</p>
      ${usedRows(META_DATA.used, true, 8)}
      <h2 style="margin-top:18px">${L("Equipos más repetidos (4M de poder o más)", "Most repeated teams (4M power or more)")}</h2>
      <p class="note">${L(`${META_DATA.allN} formaciones distintas del top-10 de arena por servidor. En gris, lo que te falta; a la derecha, el poder medio.`, `${META_DATA.allN} distinct formations from each server's arena top 10. Greyed out: what you're missing; on the right, average power.`)}</p>${teamStrips(META_DATA.teams, 6)}
      <h2 style="margin-top:18px">${L("Equipos más repetidos en los servidores EN (KonohaHub)", "Most repeated teams on EN servers (KonohaHub)")}</h2>
      <p class="note">${EN ? `Second source: KonohaHub rankings for the 4 EN zones (${KH_USAGE.en.n} top formations; ${khDates}). It only counts each zone's most repeated teams, so the numbers are minimums.`
        : `Segunda fuente: los rankings de KonohaHub de las 4 zonas EN (${KH_USAGE.en.n} formaciones top; ${khDates}). Solo cuenta los equipos más repetidos de cada zona, así que los números son mínimos.${IS_APP ? "" : " El n.º 1 es tu equipo A de Arena."}`}</p>${teamStrips(KH_USAGE.en.teams.map(t => ({ ...t, cp: "—" })), 6)}
      <h2 style="margin-top:18px">${L("Ninjas más usados en el top EN (KonohaHub)", "Most used ninjas in the EN top (KonohaHub)")}</h2>
      <p class="note">${L("Mínimos: KonohaHub solo publica los 12 más usados de cada zona.", "Minimums: KonohaHub only publishes each zone's 12 most used.")}</p>${usedRows(KH_USAGE.en.ninjas.map(u => ({ s: u.s, n: u.c, p1: u.p1 })), true, 8)}
      <h2 style="margin-top:18px">${L(`Equipos más repetidos en BR (KonohaHub, ${KH_USAGE.br.n} formaciones, ${brDates})`, `Most repeated teams in BR (KonohaHub, ${KH_USAGE.br.n} formations, ${brDates})`)}</h2>
      <p class="note">${L("Otra región, con datos de hoy: sirve de contraste con EN.", "Another region, with current data: a contrast to EN.")}</p>${teamStrips(KH_USAGE.br.teams.map(t => ({ ...t, cp: "—" })), 6)}`;
    if (sec === "low") html = `<p class="note">${L(`Formaciones del top con menos de 4M de poder (${META_DATA.lowN} de ${META_DATA.allN}). Son sobre todo servidores nuevos. Tus equipos se basan en el top meta, porque ahí están los ninjas que mejor funcionan; esta sección es solo una referencia de los rivales que puedes encontrarte en un servidor nuevo, para preparar los counters.`, `Top formations under 4M power (${META_DATA.lowN} of ${META_DATA.allN}). Mostly new servers. Your teams are based on the top meta, where the best ninjas are; this section is only a reference of the rivals you may meet on a new server, to prepare counters.`)}</p>
      <h2>${L("Los más usados en esta franja", "Most used in this range")}</h2>${usedRows(META_DATA.lowUsed, false)}
      <h2 style="margin-top:18px">${L("Equipos más repetidos", "Most repeated teams")}</h2>${teamStrips(META_DATA.lowTeams)}
      ${IS_APP ? "" : `<p class="note" style="margin-top:8px">Casi montables: Madara [Edo Tensei] + Gengetsu [Edo Tensei] + Sasori [Edo Tensei] + Scarlet Blaze (solo te falta Sasori, que no sale gratis desde 2022).</p>`}`;
    if (sec === "iitop") {
      const nm2 = x => (BY.get(x) || { n: x }).n;
      const tag = x => owned(x) ? `<span class="tag-own">${L("tuyo", "yours")}</span>` : `<span class="tag-miss">${L("falta", "missing")}</span>`;
      html = `<p class="note">${L("Los mejores equipos de cada prueba (septiembre de 2026), con el tier de KonohaHub donde lo hay. No están pensados para tu Madara: son los mejores en general. En gris, lo que te falta.", "The best teams for each trial (September 2026), with KonohaHub's tier where available. They're the best overall, not tailored to your roster. Greyed out: what you're missing.")}</p>
        <div class="tc-place" style="margin:10px 0"><b>${L("Lo que se repite", "What repeats")}</b>${EN ? "Madara [Five Kage] (lowers stats with his Y barrier) and Asura Otsutsuki (more chases) appear in almost every team. Careful: according to KonohaHub, Madara [Five Kage] only becomes useful at 4★ with the Y mystery unlocked, and Asura performs best at 4★. Asura isn't in free events. If you lack him, Genma, Hashirama [New Year] or Pakura also work."
          : `Madara [Five Kage] (baja stats con su barrera Y) y Asura Otsutsuki (más chases) aparecen en casi todos los equipos. Ojo: según KonohaHub, Madara [Five Kage] solo empieza a servir a 4★ con el mystery Y desbloqueado, y Asura rinde al máximo a 4★. Asura no sale en eventos gratis. Si falta, también sirven Genma, Hashirama [New Year] o Pakura${IS_APP ? "." : ", y los dos primeros los tienes."}`}</div>
        ${II_TOP.map(st => `<h2 class="plan-h">${esc(st.k)} <span class="muted" style="font-size:.8rem;font-family:var(--body)">${esc(st.bonus)}</span></h2>
        <div class="iitop-grid">${st.teams.map(t => `<article class="panel iitop">
          <div class="iitop-head"><h3>${esc(t.name)}</h3>${t.conf ? `<span class="pill" data-c="${esc(t.conf)}">${L(`Confianza ${esc(t.conf.toLowerCase())}`, `${({ Alta: "High", Media: "Medium", Baja: "Low" })[t.conf] || esc(t.conf)} confidence`)}</span>` : ""}</div>
          ${t.kh ? `<span class="chip" style="justify-self:start;white-space:normal">${esc(t.kh)}</span>` : ""}
          ${t.src ? `<div class="note"><b>${L("Fuente", "Source")}:</b> ${esc(t.src)}</div>` : ""}
          <div class="iitop-core">${t.core.map(([x, role, alts]) => `<div class="iitop-m">${face(x)}<div><b>${esc(nm2(x))}</b> ${tag(x)}<div class="note">${esc(role)}</div>
            ${alts.length ? `<div class="iitop-alt"><span class="muted">${L("o", "or")}</span> ${alts.map(a => `<span class="${owned(a) ? "tag-own" : "muted"}">${esc(nm2(a))}</span>`).join(", ")}</div>` : ""}</div></div>`).join("")}</div>
          <div class="tiles"><div class="tile"><span class="lbl">Main</span>${esc(t.main)}</div><div class="tile"><span class="lbl">Assist card</span>${esc(t.card)}</div></div>
        </article>`).join("")}</div>
        ${II_MORE[st.k] ? `<div class="panel iitop-more"><h3>${L("Más candidatos para", "More candidates for")} ${esc(st.k.split(" · ")[1])}</h3><p class="note" style="margin:2px 0 8px">${L("Sin equipo detallado, pero son una opción. En verde, los tuyos.", "No detailed team, but they're an option. Yours in green.")}</p>
          <div class="more-list">${II_MORE[st.k].map(([x, why]) => `<div class="more-item${owned(x) ? " mine" : ""}">${face(x)}<div><b>${esc(nm2(x))}</b><div class="note">${esc(why)}</div></div></div>`).join("")}</div></div>` : ""}`).join("")}`;
    }
    if (sec === "counters") html = `<p class="note">${L("Resumen propio de cómo ganar a los carries más usados (septiembre de 2026).", "Our own summary of how to beat the most used carries (September 2026).")}</p>
      <div class="tips">${META_TXT.counters.map(c => `<article class="panel tip">${pic(c.s, nm(c.s))}<div><h3>${esc(nm(c.s))}</h3><p>${esc(c.d)}</p></div></article>`).join("")}</div>`;
    if (sec === "mine") html = `<p class="note">Lo que conviene saber de los ninjas que ya tienes y que el top usa más. Datos de Nexus y de la comunidad.</p>
      <div class="tips">${META_TXT.mine.map(c => { const o = profile.owned[c.s]; return `<article class="panel tip">${pic(c.s, nm(c.s))}<div><h3>${esc(nm(c.s))} ${o ? `<span class="tag-own">${o.st ? o.st + "★" : ""}${o.bt ? " BT" : ""}</span>` : ""}</h3><p>${esc(c.d)}</p></div></article>`; }).join("")}</div>`;
    if (sec === "assist") html = `<p class="note">${L("Cómo usar cada carta de asistencia (revisado el 24 de septiembre de 2026).", "How to use each assist card (reviewed 24 September 2026).")}</p>
      <div class="panel"><dl class="kv assist-kv">${META_TXT.assist.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>`;
    $("metaBody").innerHTML = html;
  }
  $("metaTabs").addEventListener("click", e => { const b = e.target.closest("[data-msec]"); if (b) { ui.metaSec = b.dataset.msec; renderMeta(); } });
  // ---------------- TIER LIST (datos de scraper/build_tierlist.py)
  function renderTier() {
    const sec = ui.tierSec || "you", mineOnly = !!ui.tierMine;
    const SECS = [["you", L("Para ti", "For you")], ["carry", "PvP · Carries"], ["sup", L("PvP · Soportes", "PvP · Supports")], ["ii", "Infinite Illusion"], ["none", L("Sin datos", "No data")]];
    $("tierTabs").innerHTML = SECS.map(([k, t]) => `<button class="subtab" role="tab" data-tsec="${escAttr(k)}" aria-selected="${k === sec}">${t}${TIER[k] ? `<span class="count">${TIER[k].length}</span>` : ""}</button>`).join("");
    $("tierMine").checked = mineOnly;
    const own = s => !!profile.owned[s];
    const names = Object.fromEntries(["carry", "sup", "ii"].flatMap(k => TIER[k]).filter(r => r.name).map(r => [r.s, r.name]));
    const nm = s => (BY.get(s) || { n: names[s] || s }).n;
    const short = s => nm(s).replace(/ Uchiha| Uzumaki| Senju| Otsutsuki| Hozuki| Sarutobi| Namikaze| Haruno/g, "");
    const cell = r => { const s = r.s || r, o = profile.owned[s];
      const f = BY.has(s) ? face(s) : `<span class="face${own(s) ? "" : " miss"}">${pic(s, nm(s))}</span>`;
      return `<button class="tier-n${own(s) ? " mine" : ""}${r.est ? " est" : ""}" data-tn="${esc(s)}" aria-pressed="${ui.tierPick === s}" title="${esc(nm(s))}${r.est ? L(" (estimado)", " (estimated)") : ""}">${f}<small>${r.est ? "≈ " : ""}${esc(short(s))}${o && o.st ? " · " + o.st + "★" : ""}</small></button>`; };
    const CAT = { carry: L("carry PvP", "PvP carry"), sup: L("soporte PvP", "PvP support"), ii: "Infinite Illusion" };
    const best = s => ["carry", "sup", "ii"].flatMap(k => TIER[k].filter(r => r.s === s).map(r => ({ ...r, k }))).sort((a, b) => "SABCD".indexOf(a.t) - "SABCD".indexOf(b.t));
    // Buscador: dónde está cada ninja que coincide
    const q = (ui.tierFind || "").trim().toLowerCase();
    if (q.length >= 2) {
      const all = [...new Set(["carry", "sup", "ii"].flatMap(k => TIER[k].map(r => r.s)).concat(TIER.none))];
      const hits = all.filter(s => nm(s).toLowerCase().includes(q)).slice(0, 12);
      $("tierHits").innerHTML = `<div class="tier-hits">${hits.length ? hits.map(s => { const b = best(s);
        return `<div class="tier-hit">${cell(b[0] || s)}<div><b>${esc(nm(s))}</b><div class="note">${b.length ? b.map(r => `${r.est ? "≈" : ""}${r.t} ${L("en", "as")} ${CAT[r.k]}`).join(" · ") : L("Sin datos: ninguna fuente lo valora", "No data: no source rates it")}</div></div></div>`; }).join("") : `<span class="note">${L("Ningún ninja coincide.", "No ninja matches.")}</span>`}</div>`;
    } else $("tierHits").innerHTML = "";
    let html = "";
    if (sec === "you") {
      const mine = Object.keys(profile.owned).filter(s => !(BY.get(s) || {}).m);
      const invest = mine.map(s => ({ s, b: best(s) })).filter(x => x.b.length && "SA".includes(x.b[0].t)).sort((a, b) => "SABCD".indexOf(a.b[0].t) - "SABCD".indexOf(b.b[0].t));
      const stop = mine.filter(s => { const b = best(s); return !b.length || "CD".includes(b[0].t); });
      // «Encaja con tu Madara»: solo si tienes a Madara [Final Battle].
      const madPartners = !profile.owned["madara-uchiha-the-final-battle"] ? new Set() : new Set(TOP_MADARA.flatMap(t => t.m).concat(MY_RECS.filter(r => r.g === "madara").map(r => r.s), ["en", "br"].flatMap(r => KH_USAGE[r].teams.filter(t => t.m.includes("madara-uchiha-the-final-battle")).flatMap(t => t.m))));
      const recOf = s => MY_RECS.find(r => r.s === s) || (howToGet(s) ? { now: howToGet(s) } : null);
      const targets = [...new Set(["sup", "carry", "ii"].flatMap(k => TIER[k].filter(r => "SA".includes(r.t) && !own(r.s)).map(r => r.s)))]
        .map(s => ({ s, b: best(s), mad: madPartners.has(s) })).sort((a, b) => (b.mad - a.mad) || ("SABCD".indexOf(a.b[0].t) - "SABCD".indexOf(b.b[0].t)) || (a.b[0].est || 0) - (b.b[0].est || 0));
      const row = (x, extra) => `<div class="you-row">${cell(x.b[0])}<div><b>${esc(nm(x.s))}</b> ${x.b.map(r => `<span class="chip">${r.est ? "≈" : ""}${r.t} · ${CAT[r.k]}</span>`).join(" ")}<div class="note">${extra}</div></div></div>`;
      html = `<p class="note">${L(`La tier list aplicada a tu cuenta (${mine.length} ninjas marcados en «Mi roster»).`, `The tier list applied to your account (${mine.length} ninjas marked in «My roster»).`)}</p>
        <div class="panel"><div class="row" style="justify-content:space-between"><h3>${L("En qué invertir", "What to invest in")}</h3><button class="btn small" data-go="mejorar">${L("Mi roster › Mejorar", "My roster › Upgrade")}</button></div></div>
        <div class="panel"><h3>${L("Tus siguientes objetivos", "Your next targets")}</h3><p class="note" style="margin:2px 0 8px">${EN ? `S or A and you don't have them. ${profile.owned["madara-uchiha-the-final-battle"] ? "Those that fit your Madara [Final Battle] first (they go with him in the top)" : "Best rated first"}.` : `En S o A y no los tienes. ${profile.owned["madara-uchiha-the-final-battle"] ? "Primero los que encajan con tu Madara [Final Battle]" : "Primero los mejor valorados"} (salen con él en el top o en «Ninjas › Ninjas recomendados»).`}</p>
          <div class="you-list">${targets.slice(0, 14).map(x => { const r = recOf(x.s);
            return row(x, `${x.mad ? L("<b>Encaja con tu Madara.</b> ", "<b>Fits your Madara.</b> ") : ""}${r ? esc(r.now) : (x.b[0].est ? (IS_APP ? L("Valoración estimada; mira «Biblioteca › Recomendados».", "Estimated rating; see «Library › Recommended».") : "Valoración estimada; mira «Ninjas › Ninjas recomendados» o pregúntame cómo conseguirlo.") : "")}`); }).join("")}</div></div>
        <div class="panel"><h3>${L("No inviertas más en estos", "Don't invest more in these")}</h3><p class="note" style="margin:2px 0 8px">${L(`Tuyos pero en C, D o sin datos de meta (${stop.length}). Sirven de relleno o para colección; no gastes fragmentos ni recursos de breakthrough en ellos.`, `Yours but C, D or without meta data (${stop.length}). Fillers or collection pieces; don't spend fragments or breakthrough resources on them.`)}</p>
          <div class="tier-faces">${stop.map(s => cell(best(s)[0] || s)).join("")}</div></div>`;
    } else if (sec === "none") {
      const list = TIER.none.filter(s => !mineOnly || own(s));
      html = `<p class="note">${L("Ninjas sin datos en ninguna fuente de meta actual ni valoración estimada: no salen en las tier lists de KonohaHub, ni con uso en el top, ni en vídeos recientes. Revisé a fondo los nuevos (2024-2026) y los que aún se usan; estos son sobre todo antiguos, de rareza baja o versiones de colección.", "Ninjas with no data in any current meta source and no estimated rating: they're not in KonohaHub's tier lists, top usage or recent videos. The new ones (2024-2026) and those still in use were checked in depth; these are mostly old, low rarity or collection versions.")}</p>
        <div class="panel"><div class="tier-faces">${list.length ? list.map(cell).join("") : `<span class="tier-empty">${L("Ninguno.", "None.")}</span>`}</div></div>`;
    } else {
      const intro = (EN ? { carry: "Position 1 ninjas: the ones dealing the main damage in Arena and PvP.", sup: "Support ninjas for Arena and PvP.", ii: "Best in Infinite Illusion (above all Trial of Strength, the chase trial), from KonohaHub's tier and the teams in «Meta → Top Infinite Illusion»." }
        : { carry: "Ninjas de posición 1: los que hacen el daño principal en Arena y PvP.", sup: "Ninjas de apoyo para Arena y PvP.", ii: "Mejores en Infinite Illusion (sobre todo Trial of Strength, la prueba de chases), por el tier de KonohaHub y los equipos de la pestaña «Meta → Top Infinite Illusion»." })[sec];
      const rows = "SABCD".split("").map(t => { const list = TIER[sec].filter(r => r.t === t && (!mineOnly || own(r.s)));
        return list.length || !mineOnly ? `<div class="tier-row" data-t="${escAttr(t)}"><div class="tier-badge">${t}</div><div class="tier-faces">${list.length ? list.map(cell).join("") : `<span class="tier-empty">—</span>`}</div></div>` : ""; }).join("");
      const pick = TIER[sec].find(r => r.s === ui.tierPick);
      html = `<p class="note">${intro} ${L("En gris, los que no tienes. Con borde discontinuo y «≈», valoración estimada (ninjas nuevos o sin tier list).", "Greyed out: the ones you don't have. Dashed border and «≈»: estimated rating (new ninjas or without a tier list).")}</p>
        ${pick ? `<div class="panel tier-why"><div class="now-top"><h3>${esc(nm(pick.s))} · tier ${pick.t}</h3>${own(pick.s) ? `<span class="tag-own">${L("tuyo", "yours")}</span>` : `<span class="tag-miss">${L("no lo tienes", "not owned")}</span>`}</div>
          <ul class="why">${(pick.why || []).map(w => `<li>${esc(w)}</li>`).join("")}</ul><p class="note" style="margin:4px 0 0">${pick.est ? L("Valoración estimada: ninguna tier list lo valora. Sale de su kit, de los títulos de vídeos de la comunidad (EN y China, sin ver el contenido) y de su uso en el top. Tope A.", "Estimated rating: no tier list rates it. It comes from its kit, community video titles (EN and China, without watching them) and top usage. Capped at A.") : L(`Nota media ${String(pick.sc).replace(".", ",")} de 5 con ${pick.n} fuente${pick.n > 1 ? "s" : ""}.`, `Average score ${pick.sc} of 5 from ${pick.n} source${pick.n > 1 ? "s" : ""}.`)}</p></div>` : ""}
        ${rows}
        <p class="note">${L(`Datos: ${TIER.meta.lineups} formaciones distintas del top-10 de arena (Nexus), KonohaHub ${esc(TIER.meta.kh)}, valoraciones de la comunidad ${esc(TIER.meta.sheet)}. Para Ranked no hay datos públicos actuales: usa la de PvP como referencia.`, `Data: ${TIER.meta.lineups} distinct arena top-10 formations (Nexus), KonohaHub ${esc(TIER.meta.kh)}, community ratings ${esc(TIER.meta.sheet)}. There's no current public data for Ranked: use the PvP one as reference.`)}</p>`;
    }
    $("tierBody").innerHTML = html;
  }
  $("tierTabs").addEventListener("click", e => { const b = e.target.closest("[data-tsec]"); if (b) { ui.tierSec = b.dataset.tsec; ui.tierPick = null; renderTier(); } });
  $("tierMine").addEventListener("change", e => { ui.tierMine = e.target.checked; renderTier(); });
  $("tierFind").addEventListener("input", e => { ui.tierFind = e.target.value; renderTier(); });
  const best0 = s => ["carry", "sup", "ii"].map(k => [k, TIER[k].find(r => r.s === s)]).filter(x => x[1]).sort((a, b) => "SABCD".indexOf(a[1].t) - "SABCD".indexOf(b[1].t)).map(x => x[0])[0];
  const onTierPick = e => { const b = e.target.closest("[data-tn]"); if (!b) return;
    const sec = ui.tierSec || "you", fromHits = !!b.closest("#tierHits");
    if (sec === "none" || sec === "you" || fromHits) { const k = best0(b.dataset.tn); if (!k) return; ui.tierSec = k; if (fromHits) ui.tierPick = null; }
    ui.tierPick = ui.tierPick === b.dataset.tn ? null : b.dataset.tn; renderTier(); $("tierBody").scrollIntoView({ block: "nearest" }); };
  $("tierBody").addEventListener("click", onTierPick);
  $("tierHits").addEventListener("click", onTierPick);

  // ---------------- PLAN DE EVENTOS (ciclo del 1 al 7 de octubre de 2026)
  function planLoad() { try { return JSON.parse(localStorage.getItem(LS + "-plan-" + PLAN.cycle) || "{}"); } catch { return {}; } }
  function planSave(p) { try { localStorage.setItem(LS + "-plan-" + PLAN.cycle, JSON.stringify(p)); } catch {} }
  function fukuState(total) {
    let packs = 0, reached = null;
    (PLAN.tiers || []).forEach(t => { if (total >= t.at) { packs += t.packs; reached = t; } });
    const next = (PLAN.tiers || []).find(t => total < t.at);
    return { packs, reached, next };
  }
  // ---------------- MARIONETAS (Four Symbols Puppet Shinobi, Ninja Exam)
  // Fuentes: wiki de enemigos (fandom) y fragmentos de dos hilos del foro EN (tras Cloudflare, no se pudieron abrir enteros):
  // inmunes al daño de ninjutsu puro o de taijutsu puro según el tipo; Poison e Ignition les afectan siempre.
  // Las listas se calculan con los textos de habilidades (data.js), tu roster y la tier list.
  const DOT_RE = /(Level 2 - )?(Strong Poison|Poison(?:ing)?|Ignition|Inferno|Amaterasu Blaze)/i;
  const MIX_RE = /(Taijutsu(?: Attack)? (?:and|&) Ninjutsu|Ninjutsu (?:and|&) Taijutsu) damage/i;
  const RECEIVED_RE = /(immune to|attacker|Units who cause|When causing Taijutsu damage against)/i;
  function puppetPick(n) {
    const sk = n.sk.filter(k => !isUlt(k));
    const dot = sk.filter(k => DOT_RE.test(k.d || "") && !RECEIVED_RE.test(k.d || ""));
    const mix = sk.filter(k => MIX_RE.test(k.d || "") && !RECEIVED_RE.test(k.d || ""));
    const l2 = dot.some(k => /Level 2 - (Strong Poison|Poison|Ignition)/i.test(k.d || ""));
    const aoe = dot.some(k => /(all units|up to [4-9]|up to 1\d|entire)/i.test(k.d || ""));
    return { dot, mix, l2, aoe };
  }
  const bestTier = s => { const r = ["carry", "sup", "ii"].flatMap(k => (TIER[k] || []).filter(x => x.s === s)).sort((a, b) => "SABCD".indexOf(a.t) - "SABCD".indexOf(b.t))[0]; return r ? r.t : ""; };
  const PUP_ELEMS = [["Wind", L("Wind (morada)", "Wind (purple)")], ["Fire", "Fire"], ["Earth", "Earth"], ["Lightning", "Lightning"], ["Water", "Water"]];
  let pElem = "Wind";
  function pupCard(a, i) {
    const u = lineup({ cells: placeCells(a.cells), mainSel: a.mainSel || {} }); const mn = u.find(x => x.n.m);
    const w = teamWarnings(a.cells, true);
    // Plegables como las de Equipos: abierta solo la primera de cada bloque, y se recuerda lo que abras o pliegues.
    const fk = "pup:" + a.id, folded = fk in cardFolds ? !!cardFolds[fk] : i > 0;
    const mini = `<div class="tc-mini"><span class="tc-faces">${(a.cells || []).filter(Boolean).map(s => { const n = BY.get(s) || { s, n: s }; return pic(n.s, n.n); }).join("")}</span></div>`;
    return `<article class="pup-team ii-card${folded ? " folded" : ""}" data-fkey="${esc(fk)}">${cardHead({ ...a, origin: originOf(modeOf("ne"), a) })}${mini}${w.length ? `<div class="warn-box">${w.map(x => `<p>⚠ ${esc(x)}</p>`).join("")}</div>` : ""}<div class="pup-row"><div class="tc-mid">${board(placeCells(a.cells))}</div><ul class="why">${(a.why || []).map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>${setupTiles(a, mn, a.summon && SUM.get(a.summon))}</article>`;
  }
  function renderPuppets() {
    const pupAlts = (modeOf("ne").alts || []).filter(x => x.puppet);
    const owned = s => !!profile.owned[s];
    const rows = D.ninjas.filter(n => !n.m).map(n => ({ n, p: puppetPick(n), t: bestTier(n.s) }));
    const score = r => (r.p.l2 ? 4 : 0) + (r.p.aoe ? 2 : 0) + ("SABCD".indexOf(r.t) >= 0 ? 5 - "SABCD".indexOf(r.t) : 0) + (owned(r.n.s) ? 0 : 0);
    const dotMine = rows.filter(r => r.p.dot.length && owned(r.n.s)).sort((a, b) => score(b) - score(a));
    const dotMeta = rows.filter(r => r.p.dot.length && !owned(r.n.s) && "SA".includes(r.t || "x")).sort((a, b) => score(b) - score(a)).slice(0, 10);
    const mixAll = rows.filter(r => r.p.mix.length).sort((a, b) => (owned(b.n.s) - owned(a.n.s)) || score(b) - score(a));
    const ELEM_RE = /\b(Fire|Water|Wind|Lightning|Earth)(?: attribute)? damage|\b(Fire|Water|Wind|Lightning|Earth) and (Fire|Water|Wind|Lightning|Earth) attributes? damage|damage of (Fire|Water|Wind|Lightning|Earth)/i;
    const elemOf = n => n.sk.filter(k => !isUlt(k) && ["Mystery", "Standard", "Chase", "Trigger"].includes(k.t) && ELEM_RE.test(String(k.d || "")) && !/Launches a Barrier/i.test(k.d || ""));
    const elemMine = D.ninjas.filter(n => (owned(n.s) || n.m) && elemOf(n).length).map(n => ({ n, ks: elemOf(n), t: bestTier(n.s) }))
      .sort((a, b) => (b.n.m ? 1 : 0) - (a.n.m ? 1 : 0) || ("SABCD".indexOf(a.t || "E") - "SABCD".indexOf(b.t || "E")));
    const mains = MAINS.map(m => ({ m, p: puppetPick(BY.get(m.s) || { sk: [] }) })).filter(x => x.p.dot.length);
    const sums = D.summons.filter(s => DOT_RE.test(JSON.stringify(s)));
    const seal = t => t ? `<span class="rk-seal" data-t="${escAttr(t)}">${t}</span>` : `<span class="rk-seal" data-t="-">–</span>`;
    const why = r => [r.p.l2 ? L("nivel 2 (ignora la inmunidad)", "level 2 (ignores immunity)") : "", r.p.aoe ? L("a varios", "multi-target") : ""].filter(Boolean).join(", ");
    const item = (r, kind) => { const ks = kind === "mix" ? r.p.mix : r.p.dot; const o = profile.owned[r.n.s];
      return `<div class="home-li">${seal(r.t)}${pic(r.n.s, r.n.n)}<div><b>${esc(r.n.n)}</b>${o ? ` <span class="muted mono">${o.st ? o.st + "★" : ""}</span>` : ""}${kind !== "dmg" && why(r) && kind !== "mix" ? ` <span class="chip">${esc(why(r))}</span>` : ""}
        <div class="note">${kind === "dmg" ? esc(r.n.ro + " · " + r.n.e) : ks.map(k => `${esc(k.t)}: ${esc(k.n)}`).join(" · ")}</div></div></div>`; };
    // Las 5 primeras a la vista; el resto tras «Ver N más».
    const list = (arr, kind, empty) => { if (!arr.length) return `<p class="note">${empty}</p>`;
      const rows = arr.map(r => item(r, kind)); if (rows.length <= 6) return `<div class="home-list">${rows.join("")}</div>`;
      return `<div class="home-list">${rows.slice(0, 5).join("")}</div><details class="more-rows"><summary>${L(`Ver ${rows.length - 5} más`, `Show ${rows.length - 5} more`)}</summary><div class="home-list">${rows.slice(5).join("")}</div></details>`; };
    $("puppetsBody").innerHTML = `
      <div class="panel"><h2>${L("Marionetas de Ninja Exam (Four Symbols Puppet Shinobi)", "Ninja Exam puppets (Four Symbols Puppet Shinobi)")}</h2>
        <p class="note" style="margin:6px 0 0">${L("Salen en los pisos 86-89 y en otros más altos, y algunas usan Immobile como mystery.", "They appear on floors 86-89 and other higher ones, and some use Immobile as a mystery.")}</p>
        <div class="pup-rule">${EN ? "<b>The rule, confirmed by the game staff</b> (Rosie, 3-Oct-2026): each puppet only takes damage from <b>its own element</b>. The Wind one only takes damage from a hit with <b>Wind elemental damage</b> (for example, a Breeze Dancer skill), not any hit from a Wind ninja; the same goes for Fire, Water, Lightning and Earth. <b>Status damage</b> always hurts them too: <b>burn (Ignition) and poison (Poison)</b>."
          : "<b>La regla, confirmada por el staff del juego</b> (Rosie, 3-oct-2026): cada marioneta solo recibe daño de <b>su propio elemento</b>. A la de Wind solo le hace daño un golpe con <b>daño elemental Wind</b> (por ejemplo, una habilidad de Breeze Dancer), no cualquier golpe de un ninja Wind; igual con Fire, Water, Lightning y Earth. Además les hace daño siempre el <b>daño por estado</b>: <b>quemadura (Ignition) y veneno (Poison)</b>."}</div>
        <p class="note" style="margin:10px 0 0">${EN ? "Colours: the <b>purple one is Wind</b>. Old forum threads mention brown (Earth) and red (Fire). The «green only takes taijutsu and yellow only ninjutsu» idea comes from an old version and doesn't match what the staff says: go by the element."
          : "Colores que conoces: la <b>morada es la de Wind</b>. En los hilos antiguos del foro se habla de marrón (Earth) y roja (Fire). Lo de «la verde solo recibe taijutsu y la amarilla solo ninjutsu» es de una versión vieja y no cuadra con lo que dice el staff: guíate por el elemento."}</p></div>

      <div class="panel"><div class="row" style="justify-content:space-between"><h3>${L("Equipos generales", "General teams")}</h3><button class="btn small" data-go-ne>${L("Registrar intentos en Ninja Exam", "Log attempts in Ninja Exam")}</button></div>
        <p class="note" style="margin:2px 0 10px">${EN ? "For any puppet floor. Each team combines <b>two layers</b>: ninjas that hit with the element during the round (mystery, standard or chase) and ninjas that leave <b>burn or poison</b>, which deal damage at the end of the round. L first; if it's not enough, F. Only one barrier per team. Claude's combinations, untested: log how it goes in Ninja Exam."
          : "Para cualquier piso de marionetas. Cada equipo junta <b>dos capas</b>: ninjas que pegan con el elemento durante la ronda (mystery, standard o chase) y ninjas que dejan <b>quemadura o veneno</b>, que hacen daño al final de la ronda. Primero el L; si no llega, el F. Solo una barrera por equipo. Combinaciones mías, sin probar: registra cómo te va en Ninja Exam."}</p>
        <div class="pup-teams">${pupAlts.filter(a => a.general).sort((x, y) => x.general - y.general).map(pupCard).join("")}</div></div>
      <div class="panel"><h3>${L("Un equipo por elemento", "One team per element")}</h3>
        <p class="note" style="margin:2px 0 10px">${L("Si todas las marionetas del piso son del mismo elemento, este pega más fuerte que los generales.", "If all the puppets on the floor share an element, this one hits harder than the general ones.")}</p>
        <div class="subtabs" role="tablist" style="margin-bottom:12px">${PUP_ELEMS.map(([k, l]) => `<button class="subtab" role="tab" data-pelem="${escAttr(k)}" aria-selected="${k === pElem}">${esc(l)}</button>`).join("")}</div>
        ${(() => { const el = pupAlts.filter(a => a.elem === pElem); return el.length ? `<div class="pup-teams">${el.map(pupCard).join("")}</div>` : `<p class="note">${L(`Ninguno de tus ninjas meta hace daño ${esc(pElem)}${IS_APP ? "" : " y Azure Fang sigue bloqueado"}: usa el <b>F</b> de arriba (solo veneno y quemadura).`, `None of the meta ninjas deals ${esc(pElem)} damage: use <b>F</b> above (only poison and burn).`)}</p>`; })()}</div>

      <div class="panel"><h3>${L("Por elemento: qué le hace daño a cada una", "By element: what damages each one")}</h3><p class="note" style="margin:2px 0 8px">${L("Tus habilidades con daño elemental de cada elemento (mains incluidos). Además, contra todas: veneno y quemadura (listas de arriba).", "Your skills with elemental damage of each element (mains included). Against all of them: poison and burn (lists above).")}</p><p class="note pup-types-hint" style="margin:0 0 6px">${L("En el móvil se ve solo el elemento elegido arriba, en «Un equipo por elemento».", "On mobile only the element chosen above, in «One team per element», is shown.")}</p>
        <div class="pup-types">${["Wind", "Fire", "Earth", "Lightning", "Water"].map(el => { const rs = elemMine.filter(r => r.ks.some(k => new RegExp("\\b" + el + "\\b").test(k.d || "")));
          return `<div class="pup-type${el === pElem ? " sel" : ""}"><h3>${el}${el === "Wind" ? L(" (la morada)", " (purple)") : ""}</h3>${rs.length ? rs.map(r => `<div class="note"><b>${esc(r.n.n)}</b>${r.n.m ? " (main" + (r.n.s === "azure-fang" && !IS_APP ? ", bloqueado" : "") + ")" : profile.owned[r.n.s] ? " " + (profile.owned[r.n.s].st || "") + "★" : ""}: ${esc(r.ks.filter(k => new RegExp("\\b" + el + "\\b").test(k.d || "")).map(k => k.n).join(", "))}</div>`).join("") : `<p class="note">${L("Nada tuyo: solo veneno y quemadura.", "Nothing of yours: only poison and burn.")}</p>`}</div>`; }).join("")}</div></div>
      <div class="home-grid">
        <article class="panel"><h3>${L("Veneno y quemadura: los tuyos", "Poison and burn: yours")}</h3><p class="note" style="margin:2px 0 8px">${L("Funcionan contra todas. Primero los de nivel 2 y los que golpean a varios.", "They work against all of them. Level 2 and multi-target first.")}</p>${list(dotMine.slice(0, 10), "dot", L("Ninguno de tus ninjas aplica veneno o quemadura.", "None of your ninjas applies poison or burn."))}</article>
        <article class="panel"><h3>${L("Veneno y quemadura: del meta que no tienes", "Poison and burn: meta ones you don't have")}</h3><p class="note" style="margin:2px 0 8px">${L("En S o A en la tier list.", "S or A in the tier list.")}</p>${list(dotMeta, "dot", L("Ninguno en S o A.", "None in S or A."))}</article>
      </div>
      <div class="home-grid">

        <article class="panel"><h3>${L("Mains y summons", "Mains and summons")}</h3>
          <p class="note" style="margin:2px 0 6px">${L("Mains con quemadura o veneno", "Mains with burn or poison")}: ${mains.map(x => `<b>${esc(x.m.n)}</b> (${esc(x.p.dot.map(k => k.n).join(", "))})`).join("; ")}. ${L("Azure Fang envenena a todo el equipo rival", "Azure Fang poisons the whole enemy team")}${IS_APP ? L(" (si lo tienes desbloqueado)", " (if you've unlocked it)") : ", pero aún no lo tienes desbloqueado"}.</p>
          <p class="note" style="margin:2px 0 0">${L("Summons con veneno", "Summons with poison")}: ${sums.map(s => `<b>${esc(s.n)}</b>${profile.summons.includes(s.s) ? ` <span class="tag-own">${L("tuyo", "yours")}</span>` : ` <span class="tag-miss">${L("no lo tienes", "not owned")}</span>`}`).join(", ") || L("ninguno", "none")}.${IS_APP ? "" : " Con lo que tienes, Giant Shark."}</p></article>
      </div>
</div>`;
  }
  $("puppetsBody").addEventListener("click", e => {
    const h = e.target.closest(".ii-card .tc-head, .ii-card.folded > .tc-mini"); if (!h || e.target.closest("a, button, input, select, .origin")) return;
    const c = h.closest(".ii-card"); const k = c.dataset.fkey; if (!k) return;
    c.classList.toggle("folded"); cardFolds[k] = c.classList.contains("folded") ? 1 : 0; saveCardFolds();
  });
  $("puppetsBody").addEventListener("click", e => { if (e.target.closest("[data-go-ne]")) { ui.mode = "ne"; setTab("ii"); } const pe = e.target.closest("[data-pelem]"); if (pe) { pElem = pe.dataset.pelem; renderPuppets(); } });

  // ---------------- TIENDAS Y MONEDAS (investigado y con capturas del usuario, 2-oct-2026)
  // Saldos: los escribes tú (se guardan en tu perfil); si no, los de tu captura del 2-oct-2026.
  const walletOf = s => { const w = (profile.wallet || {})[s.k]; return w != null ? w : s.have != null && !IS_APP ? s.have : ""; };
  function renderShops() {
    const at = (profile.wallet || {})._at;
    $("shopsBody").innerHTML = `
      <div class="panel"><h2>${L("En qué gastar cada moneda", "What to spend each currency on")}</h2>
        <p class="note" style="margin:4px 0 0">${EN ? `Balances ${at ? "updated by you on " + esc(String(at).slice(0, 10)) : "not entered yet"}: change them on each card and they're saved. Prices from in-game screenshots and BT fragment costs (2-Oct-2026). Anything marked «unconfirmed» couldn't be verified.`
          : `Saldos ${at ? "actualizados por ti el " + esc(String(at).slice(0, 10)) : IS_APP ? "sin apuntar todavía" : "de tu captura del 2-oct-2026"}: cámbialos en cada tarjeta y se guardan. Precios de ${IS_APP ? "capturas del juego" : "tus capturas"} y costes de fragmentos de BT (2-oct-2026). Lo que pone «sin confirmar» no lo he podido verificar${IS_APP ? "." : ": si en el juego ves otra cosa, dímelo y lo corrijo."}`}</p></div>
      <div class="shops">${SHOPS.list.map(s => `
        <article class="panel shop">
          <div class="row" style="justify-content:space-between;align-items:baseline;gap:8px"><h3>${esc(s.k)}</h3><label class="have">${L("tienes", "you have")} <input type="number" min="0" step="1" inputmode="numeric" class="mono" data-wallet="${esc(s.k)}" value="${walletOf(s)}" placeholder="?" aria-label="${L(`Cuántos ${esc(s.k)} tienes`, `How many ${esc(s.k)} you have`)}"></label></div>
          <p class="note" style="margin:4px 0 0">${esc(s.where)}</p>
          <p class="note" style="margin:4px 0 0"><b>${L("Reinicio", "Reset")}:</b> ${esc(s.reset)}</p>
          <h4>${L("Compra", "Buy")}</h4><ul class="why">${s.buy.map(x => `<li>${tc(x)}</li>`).join("")}</ul>
          ${s.skip.length ? `<h4>${L("Sáltate", "Skip")}</h4><ul class="why muted">${s.skip.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        </article>`).join("")}</div>`;
  }

  $("shopsBody").addEventListener("change", e => {
    const i = e.target.closest("[data-wallet]"); if (!i) return;
    const v = i.value === "" ? null : Math.max(0, Math.round(Number(i.value) || 0));
    profile.wallet = { ...(profile.wallet || {}), [i.dataset.wallet]: v, _at: new Date().toISOString() };
    saveProfile(); renderShops();
  });
  // Los ciclos de eventos duran 7 días desde PLAN.cycle (jueves a miércoles). Pasado el último, el plan está caducado.
  function planState() {
    const start = new Date(PLAN.cycle + "T00:00:00"), end = new Date(start); end.setDate(end.getDate() + 6);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return today > end ? "old" : today.getTime() === end.getTime() ? "last" : "on";
  }
  function planBanner() {
    const s = planState();
    if (s === "old") return `<div class="warn-box plan-old"><p>${EN ? `<b>This plan has ended</b> (${esc(PLAN.cycle)}). The new cycle's plan will come with the next app version; meanwhile, what's below is from last week.` : `<b>Este plan ya terminó</b> (${esc(PLAN.label.replace(/^Ciclo del /, "del "))}). ${IS_APP ? "El del ciclo nuevo llegará con la próxima versión de la app" : "Pásame el anuncio del ciclo nuevo y lo rehago"}; mientras, lo de abajo es de la semana pasada.`}</p></div>`;
    if (s === "last") return `<div class="warn-box"><p>${L("<b>Hoy es el último día del ciclo</b>: repasa la lista «Último día» antes del reinicio.", "<b>Today is the cycle's last day</b>: go through the «Last day» list before the reset.")}</p></div>`;
    return "";
  }
  // Grupos de eventos del plan (índices de PLAN.events). «mine»: te da un ninja que te completa equipos (eventInterest),
  // tu jugada de la semana o un ninja de tus objetivos; «free»: veredicto «Haz…»; «paid»: de pago (recarga, gasto o
  // veredicto «Ignora» / «Si ya gastas» / «Si vas a gastar»); «info»: el resto (requisitos, tiendas, monedas).
  function planGroups() {
    const G = { mine: [], free: [], paid: [], info: [] };
    if (typeof PLAN === "undefined" || !PLAN.events) return G;
    const plays = new Set(weekPlays().map(x => x.e)), goals = new Set(goalsOf().filter(g => !goalDone(g)).map(g => g.s));
    PLAN.events.forEach((e, i) => {
      const v = e.v || "", paid = /^ignora|si ya gastas|si vas a gastar/i.test(v) || (/recarg|lingote|gastar/i.test(e.c || "") && !/gratis/i.test(e.c || ""));
      const mine = !!eventInterest(e) || plays.has(e) || (e.rw || []).some(r => goals.has(r.s));
      G[mine ? "mine" : /^haz/i.test(v) && !paid ? "free" : paid ? "paid" : "info"].push(i);
    });
    return G;
  }
  function renderPlan() {
    const st = planLoad();
    const lvl = (PLAN.levels || []).find(l => l.k === (st.level || "r1")) || (PLAN.levels || []).find(l => l.rec);   // en la app no hay niveles (tools/limpieza.py)
    const cu = Number(st.cu || 0), ing = Number(st.ing || 0), total = cu + ing;
    const f = fukuState(total);
    const pct = Math.min(100, Math.round(total / 40000 * 100));
    const done = st.done || {};
    const box = (id, text) => `<label class="chk-row"><input type="checkbox" data-plan-chk="${escAttr(id)}" ${done[id] || text.startsWith("✓") ? "checked" : ""}><span>${esc(text)}</span></label>`;
    const verdict = v => /Imprescindible|^Haz|Muy buena|Must|^Do it|Very good/.test(v) ? "Alta" : /Ignora|Ignore|Skip/.test(v) ? "Baja" : "Media";
    // En inglés, PLAN.en trae los textos del ciclo traducidos (eventos, diarias, último día); si falta, se usa el español.
    const P = EN && PLAN.en ? { ...PLAN, ...PLAN.en } : PLAN;
    // Lo personal del plan (saldo, recomendación, objetivos, cuánto recargar, Fukurokumaru) es del usuario del Cuartel;
    // en la app solo va lo general del ciclo.
    $("planBody").innerHTML = `${planBanner()}
      ${IS_APP ? `<div class="panel plan-hero"><div><div class="eyebrow">${esc(EN && PLAN.en ? PLAN.en.label : PLAN.label)}</div><h2>${L("Plan de la semana", "This week's plan")}</h2>
        <p class="note" style="margin:4px 0 0">${L("Los eventos del ciclo, qué hacer cada día y qué no olvidar el último día, según el anuncio oficial.", "The cycle's events, what to do each day and what not to forget on the last day, according to the official announcement.")}</p>${weekPlayHtml()}</div></div>` : `
      <div class="panel plan-hero">
        <div><div class="eyebrow">${esc(PLAN.label)}</div><h2>Tu plan de la semana</h2>
          <p class="note" style="margin:4px 0 0">Del anuncio oficial que me pasaste.${PLAN.wallet ? ` ${esc(PLAN.wallet.note)} <b>${PLAN.wallet.coupons.toLocaleString("es")} cupones</b> (estimado) y <b>${PLAN.wallet.ingots.toLocaleString("es")} lingotes</b>.` : ""}</p></div>
        <div class="plan-sum">
          <div><span class="lbl">Mi recomendación</span><b>${esc(PLAN.hero.rec)}</b></div>
          <div><span class="lbl">Seguro</span>${esc(PLAN.hero.sure)}</div>
          <div><span class="lbl">Por confirmar el primer día</span>${esc(PLAN.hero.pending)}</div>
        </div>
      </div>

      <div class="panel"><h3>Antes de gastar nada (día 1)</h3>
        <div class="chk-list">${PLAN.checks.map((c, i) => box("c" + i, c)).join("")}</div></div>

      <h2 class="plan-h">Ahora en el juego</h2>
      <div class="now-list">${META_TXT.now.map(e => `<article class="panel now-item">${pic(e.s, e.t)}<div><div class="now-top"><h3>${esc(e.t)}</h3><span class="pill" data-c="${e.tag === "Cógelo" || e.tag === "Ahora" ? "Alta" : e.tag === "Ignora" ? "Baja" : "Media"}">${esc(e.tag)}</span></div>
        <div class="note mono">${esc(e.when)}</div><p>${esc(e.d)}</p></div></article>`).join("")}</div>

      <h2 class="plan-h">Qué te llevas esta semana</h2>
      <div class="goal-cols">${PLAN.goals.map(g => `<div class="panel goal-col"><h3>${esc(g.k)}</h3>${g.items.map(it => `
        <div class="goal">${it.s ? pic(it.s, it.t) : `<span class="goal-ico" aria-hidden="true">⚙</span>`}<div>
          <div class="goal-top"><b>${esc(it.t)}</b><span class="pill" data-c="${it.sure === "Seguro" ? "Alta" : it.sure === "Azar" || it.sure === "Opcional" ? "Baja" : "Media"}">${esc(it.sure)}</span></div>
          <div class="note">${esc(it.how)}</div></div></div>`).join("")}</div>`).join("")}</div>

      <h2 class="plan-h">¿Cuánto recargar?</h2>
      <div class="lvl-tabs" role="tablist">${PLAN.levels.map(l => `<button class="subtab" role="tab" data-plan-lvl="${escAttr(l.k)}" aria-selected="${l.k === lvl.k}">${esc(l.name)}${l.rec ? " ★" : ""}</button>`).join("")}</div>
      <div class="panel lvl-card">
        <div class="lvl-head"><h3>${esc(lvl.name)}</h3>${lvl.rec ? `<span class="pill" data-c="Alta">Recomendado</span>` : ""}</div>
        <div class="note"><b>Coste:</b> ${esc(lvl.cost)}</div>
        <ol class="lvl-steps">${lvl.plan.map(p => `<li>${esc(p)}</li>`).join("")}</ol>
        <div class="tc-place"><b>Resultado</b>${esc(lvl.end)}</div>
        ${lvl.alt ? `<p class="note" style="margin:8px 0 0">${esc(lvl.alt)}</p>` : ""}
      </div>

      ${PLAN.tiers ? `      <h2 class="plan-h">Contador de Fukurokumaru's Deals</h2>
      <div class="panel fuku">
        <div class="fuku-inputs">
          <label>Cupones gastados que cuentan<input type="number" min="0" step="100" inputmode="numeric" data-plan-num="cu" value="${cu || ""}" placeholder="0"></label>
          <label>Lingotes gastados<input type="number" min="0" step="100" inputmode="numeric" data-plan-num="ing" value="${ing || ""}" placeholder="0"></label>
        </div>
        <div class="fuku-bar"><i style="width:${pct}%"></i>${PLAN.tiers.map(t => `<span class="tick${total >= t.at ? " on" : ""}" style="left:${t.at / 400}%" title="${escAttr(t.at)}"></span>`).join("")}</div>
        <div class="fuku-out"><b>${total.toLocaleString("es")}</b> de 40.000 · <b>${f.packs}</b> packs = <b>${f.packs * 4}</b> fragmentos de Jiraiya
          ${f.next ? `· siguiente tramo: ${f.next.at.toLocaleString("es")} (faltan ${(f.next.at - total).toLocaleString("es")})` : "· todos los tramos conseguidos"}</div>
        <div class="fuku-tiers">${PLAN.tiers.map(t => `<div class="${total >= t.at ? "on" : ""}"><span class="mono">${t.at.toLocaleString("es")}</span>${t.packs ? `<b>${t.packs} packs</b>` : `<span class="muted">—</span>`}<span class="note">${esc(t.extra)}</span></div>`).join("")}</div>
      </div>` : ""}

`}
      ${(() => {
        // Eventos en 4 grupos (rediseño, fase 2): lo que te interesa a ti, con detalle; lo gratis, una línea cada uno;
        // lo de pago y lo informativo, plegados. Cada evento sale en un solo grupo.
        const card = i => { const e = P.events[i], o = PLAN.events[i];
          return `<div class="ev-row"><div><b>${esc(e.n)}</b>${e.need ? `<span class="tag-miss" style="margin-left:6px">${esc(e.need)}</span>` : ""}
            <div class="note"><b>${L("Cuesta", "Costs")}:</b> ${esc(e.c)}</div>${eventInterest(o)}${packAdvice(o)}
            <details class="why-more"><summary>${IS_APP ? L("Qué da", "What it gives") : "Para ti"}</summary><p class="note">${esc(e.g)}</p></details></div>
            ${(() => { const v = evVerd(o); return v ? `<span class="pill" data-c="${v[1]}">${esc(v[0])}</span>` : `<span class="pill" data-c="${verdict(e.vk || e.v)}">${esc(e.v)}</span>`; })()}</div>`; };
        const G = planGroups(), line = i => { const e = P.events[i];
          return `<li><details class="why-more"><summary><b>${esc(e.n)}</b> <span class="note">· ${esc(e.c)}</span></summary><p class="note"><b>${L("Qué da", "Gives")}:</b> ${esc(e.g)}</p>${packAdvice(PLAN.events[i])}</details></li>`; };
        const fold = (k, title, sub) => G[k].length ? `<details class="panel plan-fold"><summary><b>${title}</b> <span class="note">(${G[k].length}) · ${sub}</span></summary><div class="ev-list" style="margin-top:10px">${G[k].map(card).join("")}</div></details>` : "";
        return `${G.mine.length ? `<h2 class="plan-h">${L("Te interesa a ti", "Useful for you")}</h2><p class="note" style="margin:-4px 0 8px">${L("Dan ninjas que te completan equipos, que te compensa subir o que tienes en tus objetivos.", "They give ninjas that complete teams for you, are worth upgrading or are in your goals.")}</p><div class="ev-list">${G.mine.map(card).join("")}</div>` : ""}
          ${G.free.length ? `<h2 class="plan-h">${L("Gratis: hazlo", "Free: do it")}</h2><div class="panel"><ul class="week-free plan-free">${G.free.map(line).join("")}</ul></div>` : ""}
          ${fold("paid", L("De pago", "Paid"), spendLv() ? L("mira qué da cada uno antes de gastar", "check what each gives before spending") : L("no gastas: puedes saltártelos", "you don't spend: you can skip them"))}
          ${fold("info", L("Info y otros", "Info and others"), L("requisitos, tiendas y monedas", "requirements, shops and currencies"))}`; })()}

      <div class="plan-two">
        <div class="panel"><h3>${L("Cada día", "Every day")}</h3><div class="chk-list">${P.daily.map((d, i) => box("d" + i, d)).join("")}</div>
          <p class="note" style="margin:8px 0 0">${L("Las casillas se guardan", "Checkboxes are saved")} ${HERE}. <button class="btn small" data-plan-reset>${L("Vaciar las diarias", "Clear the dailies")}</button></p></div>
        <div class="panel"><h3>${L("Último día", "Last day")} (${esc(P.lastDay)})</h3><div class="chk-list">${P.last.map((d, i) => box("l" + i, d)).join("")}</div>
          <p class="note" style="margin:8px 0 0">${L("Los eventos semanales acaban según la hora de tu ordenador, no la del servidor.", "Weekly events end according to your computer's clock, not the server's.")}</p></div>
      </div>

      <details class="panel plan-fold"><summary><b>${L("Lo que el anuncio no dice", "What the announcement doesn't say")}</b> <span class="note">(${P.unknowns.length})</span></summary><ul class="why">${P.unknowns.map(u => `<li>${esc(u)}</li>`).join("")}</ul></details>`;
  }
  $("planBody").addEventListener("click", e => {
    const b = e.target.closest("[data-plan-lvl]");
    if (b) { const p = planLoad(); p.level = b.dataset.planLvl; planSave(p); renderPlan(); return; }
    if (e.target.closest("[data-plan-reset]")) { const p = planLoad(); p.done = Object.fromEntries(Object.entries(p.done || {}).filter(([k]) => !k.startsWith("d"))); planSave(p); renderPlan(); }
  });
  $("planBody").addEventListener("change", e => {
    const c = e.target.closest("[data-plan-chk]");
    if (c) { const p = planLoad(); p.done = { ...(p.done || {}), [c.dataset.planChk]: c.checked }; planSave(p); return; }
    const n = e.target.closest("[data-plan-num]");
    if (n) { const p = planLoad(); p[n.dataset.planNum] = Math.max(0, Number(n.value) || 0); planSave(p); renderPlan(); }
  });

  // ---------------- arranque: un equipo de ejemplo para que el creador no salga vacío
  function exampleTeam() {
    const pick = ["scarlet-blaze", "obito-uchiha-rage-mode", "asura-otsutsuki", "jiraiya-toads-chant"].filter(s => BY.has(s));
    const cells = [5, 2, 8, 1];
    pick.forEach((s, i) => team.cells[cells[i]] = s);
    team.name = L("Ejemplo · cámbialo por tu equipo", "Example · replace it with your team");
  }
  function renderAll() { bustTick(); renderProfile(); renderBuilder(); renderSaved(); renderII(); renderIdeal(); renderRecs(); renderMeta(); renderTier(); renderPlan(); setTab(ui.tab); }   // y la vista abierta (Progreso, Ajustes, Summons… no están arriba)

  if (!D.ninjas.length) { document.querySelector(".wrap").insertAdjacentHTML("beforeend", `<div class="empty">No se han cargado los datos de ninjas (data.js).</div>`); }
  exampleTeam();
  { let t = null; try { t = localStorage.getItem(LS + "-tab"); } catch {} setTab(t || "inicio"); }
  initStore();
})();

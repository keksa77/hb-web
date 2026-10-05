// Zápis časů na předávce (telefon časoměřiče). Přihlášení kódem předávky z formuláře (predavky.kod_predavky,
// 8 číslic), bez účtu (rozhodnutí 5. a 6. 10. 2026).
// Zápis ve dvou krocích (Keksa 6. 10. 2026): DOBĚHL TÝM zachytí čas, pak se vybere tým (číslo z dresu
// nebo nabídka) a potvrdí se podle jména běžce. Klepnutí na tým v seznamu „Dobíhají“ zachytí čas a jde
// rovnou k potvrzení. Kontrola věrohodnosti varuje (tým už dál, nereálné tempo), uložit jde jen s výslovným
// potvrzením. Bez signálu se zápis uloží v telefonu s původním časem a odešle se sám (klient_id = žádné
// duplicity). Zpět a Opravit tým (čas zůstane, změní se tým) fungují 60 minut, nic se nemaže.
(function () {
  var koren = document.getElementById("predavka-zapis");
  if (!koren) return;
  var CFG = window.HB || {};
  var K_KOD = "hb_predavka_kod", K_FRONTA = "hb_predavka_fronta", K_INFO = "hb_predavka_data";
  var kod = null, info = null, model = null, posun = 0, chyba = null, odesilam = false, cisloText = "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var FMT = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  var FMT_HM = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" });
  function hms(ms) { return FMT.format(new Date(ms)); }
  function odhad(s) { return "≈ " + FMT_HM.format(new Date(Math.round(s / 300) * 300000)); }
  function ted() { return Date.now() + posun; }
  function cti(k, v) { try { var x = JSON.parse(localStorage.getItem(k)); return x == null ? v : x; } catch (e) { return v; } }
  function pis(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fronta() { return cti(K_FRONTA, []); }
  function ulozFrontu(f) { pis(K_FRONTA, f.slice(-300)); }
  function noveId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  async function rpc(fce, telo) {
    var o = await fetch(CFG.url + "/rest/v1/rpc/" + fce, {
      method: "POST",
      headers: { apikey: CFG.klic, Authorization: "Bearer " + CFG.klic, "Content-Type": "application/json" },
      body: JSON.stringify(telo)
    });
    var j = await o.json().catch(function () { return null; });
    if (!o.ok) { var e = new Error((j && j.message) || "HTTP " + o.status); e.server = o.status < 500; throw e; }
    return j;
  }

  // ---------- přihlášení a data ----------
  async function prihlas(k) {
    var j = await rpc("web_predavka_prihlas", { p_kod: k });
    if (j.chyba) throw Object.assign(new Error(j.chyba), { server: true });
    kod = k.toUpperCase(); pis(K_KOD, kod);
    info = j; pis(K_INFO, { kod: kod, info: j });
    var tedServer = Date.parse(j.data && j.data.ted);
    if (tedServer) posun = tedServer - Date.now();
    model = HBVysl.spocitej(j.data, Math.floor(ted() / 1000));
    chyba = null;
  }
  async function obnov() {
    if (!kod) return;
    try { await prihlas(kod); } catch (e) { if (e.server) chyba = e.message; }
    vykresli();
  }

  // ---------- zápis ve dvou krocích: 1) čas, 2) tým + potvrzení ----------
  // Stavy položky: bez_tymu (čas zachycen) → potvrdit (tým vybrán, čeká na potvrzení) → ceka (k odeslání)
  // → odeslano | konflikt (tým už čas má) | varovani (databáze našla nesrovnalost) | chyba; zruseno.
  var vstupy = {}; // rozepsaná čísla týmů podle položky
  function polozka(id) { var f = fronta(); return { f: f, z: f.filter(function (x) { return x.id === id; })[0] }; }
  function tymDat(id) { return (info.data.tymy || []).filter(function (x) { return String(x.id) === String(id); })[0]; }
  function tymModel(id) { return model.tymy.filter(function (x) { return String(x.id) === String(id); })[0]; }
  function tymPodleCisla(c) { return (info.data.tymy || []).filter(function (t) { return String(t.c) === String(c).trim(); })[0]; }
  function dobehl() {
    var f = fronta();
    f.push({ id: noveId(), kod: kod, cas: ted(), stav: "bez_tymu", vytvoreno: Date.now() });
    ulozFrontu(f); if (navigator.vibrate) navigator.vibrate(60); vykresli();
  }
  function zeSeznamu(tymId) {
    var f = fronta();
    f.push({ id: noveId(), kod: kod, cas: ted(), stav: "bez_tymu", vytvoreno: Date.now() });
    ulozFrontu(f); if (navigator.vibrate) navigator.vibrate(60);
    prirad(f[f.length - 1].id, tymId);
  }
  // Kontrola věrohodnosti – stejná pravidla jako v databázi (web_predavka_kontrola).
  function kontrola(tymId, cas) {
    var t = tymModel(tymId), e = info.etapa, v = [];
    if (!t) return v;
    for (var j = e; j < 30; j++) if (t.E[j].dobeh != null) { v.push("Tým " + (t.c || "?") + " už má zapsaný příchod na P" + (j + 2) + ", tedy dál po trati."); break; }
    var ze = 0, zakl = t.s;
    for (var k = e - 1; k >= 1; k--) if (t.E[k - 1].dobeh != null) { ze = k; zakl = t.E[k - 1].dobeh; break; }
    if (zakl != null) {
      var s = cas / 1000;
      if (s <= zakl) v.push(ze ? "Tým " + (t.c || "?") + " má na P" + (ze + 1) + " čas pozdější než tento." : "Tým " + (t.c || "?") + " ještě nestartoval.");
      else {
        var km = 0;
        for (var i = ze + 1; i <= e; i++) { var m = (info.data.mista || [])[i - 1]; km += m && m[2] ? Number(m[2]) : 0; }
        var tempo = km ? (s - zakl) / 60 / km : null;
        if (tempo != null && tempo < 3.25) v.push("Od " + (ze ? "P" + (ze + 1) : "startu") + " by tým " + (t.c || "?") + " musel běžet tempem " +
          Math.floor(tempo) + ":" + String(Math.round((tempo % 1) * 60)).padStart(2, "0") + " min/km – to je nereálně rychle.");
      }
    }
    return v;
  }
  function prirad(id, tymId) {
    var p = polozka(id), z = p.z, t = tymDat(tymId); if (!z || !t) return;
    if (z.oprava) { z.oprava = { tym: t.id, c: t.c, n: t.n, varovani: kontrola(t.id, z.cas) }; }
    else {
      z.tym = t.id; z.c = t.c; z.n = t.n; z.varovani = kontrola(t.id, z.cas); z.potvrzeno = false;
      z.stav = z.varovani.length ? "potvrdit" : "ceka"; // bez nesrovnalostí se ukládá hned (Zpět / Opravit tým 60 min)
    }
    delete vstupy[id]; ulozFrontu(p.f); vykresli();
    if (!z.oprava && z.stav === "ceka") odesli();
  }
  function ulozit(id) {
    var p = polozka(id), z = p.z; if (!z) return;
    z.potvrzeno = (z.varovani || []).length > 0; z.stav = "ceka"; ulozFrontu(p.f); vykresli(); odesli();
  }
  function jinyTym(id) {
    var p = polozka(id), z = p.z; if (!z) return;
    if (z.oprava) z.oprava = {}; else { z.stav = "bez_tymu"; delete z.tym; delete z.varovani; }
    ulozFrontu(p.f); vykresli();
  }
  async function odesli() {
    if (odesilam) return;
    odesilam = true;
    try {
      var f = fronta();
      for (var i = 0; i < f.length; i++) {
        var z = f[i];
        if (z.stav !== "ceka" || z.kod !== kod) continue;
        try {
          var r = await rpc("web_predavka_uloz", { p_kod: z.kod, p_tym: z.tym, p_cas: new Date(z.cas).toISOString(),
            p_klient_id: z.id, p_nahradit: !!z.nahradit, p_potvrzeno: !!z.potvrzeno });
          if (r.chyba) { z.stav = "chyba"; z.zprava = r.chyba; }
          else if (r.stav === "uz_zapsano") { z.stav = "konflikt"; z.existujici = Date.parse(r.cas); }
          else if (r.stav === "varovani") { z.stav = "varovani"; z.varovani = r.varovani; }
          else { z.stav = "odeslano"; z.odeslano = Date.now(); }
        } catch (e) {
          if (e.server) { z.stav = "chyba"; z.zprava = e.message; }
          else break; // bez signálu – zkusí se znovu
        }
        ulozFrontu(f);
        vykresli();
      }
    } finally { odesilam = false; }
    if (fronta().some(function (z) { return z.stav === "odeslano" && Date.now() - z.odeslano < 5000; })) obnov();
  }
  async function zpet(id) {
    var p = polozka(id), f = p.f, z = p.z;
    if (!z) return;
    if (z.oprava) { delete z.oprava; ulozFrontu(f); vykresli(); return; }
    if (z.stav !== "odeslano") { z.stav = "zruseno"; ulozFrontu(f); vykresli(); return; }
    try {
      var r = await rpc("web_predavka_zpet", { p_kod: z.kod, p_klient_id: z.id });
      if (r.chyba) { alertText(r.chyba); return; }
      z.stav = "zruseno"; ulozFrontu(f); obnov();
    } catch (e) { alertText(e.server ? e.message : "Bez signálu nejde zápis vrátit. Zkus to za chvíli."); }
  }
  function nahradit(id) {
    var p = polozka(id), z = p.z; if (!z) return;
    if (z.oprava) { z.oprava.nahradit = true; ulozFrontu(p.f); potvrditOpravu(id); return; }
    z.nahradit = true; z.stav = "ceka"; ulozFrontu(p.f); vykresli(); odesli();
  }
  function zacitOpravu(id) {
    var p = polozka(id), z = p.z; if (!z) return;
    if (z.stav !== "odeslano") { jinyTym(id); return; }
    z.oprava = {}; ulozFrontu(p.f); vykresli();
  }
  // Oprava týmu: čas zůstane, přiřadí se jinému týmu. Jde jen se signálem, v jedné transakci v databázi.
  async function potvrditOpravu(id) {
    var p = polozka(id), z = p.z; if (!z || !z.oprava || !z.oprava.tym) return;
    var o = z.oprava; if (!o.id2) { o.id2 = noveId(); ulozFrontu(p.f); }
    try {
      var r = await rpc("web_predavka_oprav", { p_kod: z.kod, p_klient_id: z.id, p_tym_novy: o.tym, p_klient_id_novy: o.id2,
        p_nahradit: !!o.nahradit, p_potvrzeno: (o.varovani || []).length > 0 || !!o.potvrzeno });
      p = polozka(id); z = p.z; o = z.oprava;
      if (r.chyba) { alertText(r.chyba); return; }
      if (r.stav === "uz_zapsano") { o.konflikt = Date.parse(r.cas); ulozFrontu(p.f); vykresli(); return; }
      if (r.stav === "varovani") { o.varovani = r.varovani; o.serverVarovani = true; ulozFrontu(p.f); vykresli(); return; }
      z.puvodne = (z.c ? "č. " + z.c + " " : "") + z.n;
      z.id = o.id2; z.tym = o.tym; z.c = o.c; z.n = o.n; z.vytvoreno = Date.now(); delete z.oprava;
      ulozFrontu(p.f); obnov();
    } catch (e) { alertText(e.server ? e.message : "Bez signálu nejde oprava provést. Zkus to za chvíli."); }
  }
  var hlaskaCas = null;
  function alertText(t) {
    var h = document.getElementById("p-hlaska");
    if (h) { h.textContent = t; h.hidden = false; clearTimeout(hlaskaCas); hlaskaCas = setTimeout(function () { h.hidden = true; }, 8000); }
  }

  // ---------- vykreslení ----------
  function prihlaseni() {
    return '<form id="p-prihlaseni" class="p-prihlaseni"><label for="p-kod">Kód předávky</label>' +
      '<p class="p-napoveda">8 číslic z formuláře předávky. Nebo naskenuj QR kód dole na formuláři.</p>' +
      '<input id="p-kod" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="12" required>' +
      '<button type="submit">Přihlásit</button>' + (chyba ? '<p class="p-chyba">' + esc(chyba) + "</p>" : "") + "</form>";
  }
  function ocekavane(vynechat) {
    var e = info.etapa;
    return model.tymy.filter(function (t) { return t.E[e - 1].dobeh == null && !vynechat[t.id]; })
      .sort(function (a, b) { return (a.E[e - 1].odhad || Infinity) - (b.E[e - 1].odhad || Infinity) || (a.c || 0) - (b.c || 0); });
  }
  function bezec(tymId) {
    var t = tymModel(tymId); if (!t) return "";
    var x = t.E[info.etapa - 1], r = ((info.data.tymy || []).filter(function (d) { return d.id === t.id; })[0] || {}).e;
    var sc = r && r[info.etapa - 1] ? r[info.etapa - 1][7] : null;
    return x.jm ? x.jm + (sc ? " (číslo " + sc + ")" : "") : "";
  }
  function vyberTymu(z, vynechat, popis) {
    var txt = vstupy[z.id] || "", t = txt ? tymPodleCisla(txt) : null;
    var navrhy = ocekavane(vynechat).slice(0, 4);
    return '<form class="p-vyber" data-form="' + z.id + '"><label for="p-v-' + z.id + '">' + popis + '</label><div>' +
      '<input id="p-v-' + z.id + '" data-vstup="' + z.id + '" inputmode="numeric" autocomplete="off" value="' + esc(txt) + '">' +
      '<button type="submit">Vybrat</button></div>' +
      '<p class="p-napoveda">' + (txt ? (t ? esc(t.n) : "Tým s tímto číslem tu nezávodí.") : "") + "</p>" +
      '<div class="p-navrhy">' + navrhy.map(function (n) {
        return '<button type="button" data-prirad="' + z.id + ":" + n.id + '"><strong>' + esc(n.c || "–") + "</strong> " + esc(n.n) + "</button>";
      }).join("") + "</div></form>";
  }
  function potvrzeni(z, cil, bylo) {
    var v = cil.varovani || [], c = cil.c || "–";
    var h = '<div class="p-potvrzeni' + (v.length ? " p-pozor" : "") + '">';
    if (bylo) h += '<p class="p-bylo">Bylo: <s>' + esc(bylo) + "</s></p>";
    h += '<p class="p-velke">' + esc(c) + "</p><p><strong>" + esc(cil.n) + "</strong><br>" + hms(z.cas) +
      (bezec(cil.tym) ? "<br>Běží: " + esc(bezec(cil.tym)) : "") + "</p>";
    if (v.length) h += '<ul class="p-varovani">' + v.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") +
      "</ul><p><strong>Zkontroluj číslo na dresu.</strong></p>";
    if (cil.konflikt) h += '<p class="p-chyba">Tým ' + esc(c) + " už má na této předávce čas " + hms(cil.konflikt) + ".</p>" +
      '<p class="p-akce"><button type="button" class="p-hlavni" data-nahradit="' + z.id + '">Platí opravovaný čas</button> <button type="button" data-zpet="' + z.id + '">Neopravovat</button></p>';
    else h += '<p class="p-akce"><button type="button" class="p-hlavni" data-' + (bylo ? "potvrdit-opravu" : "ulozit") + '="' + z.id + '">' +
      (v.length ? "Ano, je to tým " + esc(c) + " – " + (bylo ? "potvrdit opravu" : "uložit") : (bylo ? "Potvrdit opravu" : "Uložit")) + "</button> " +
      '<button type="button" data-jiny="' + z.id + '">Jiný tým</button> <button type="button" data-zpet="' + z.id + '">Zrušit</button></p>';
    return h + "</div>";
  }
  function vykresli() {
    if (!kod || !info) { koren.innerHTML = prihlaseni(); return; }
    var e = info.etapa, f = fronta().filter(function (z) { return z.kod === kod; });
    var obsazene = {};
    f.forEach(function (z) { if (z.tym && z.stav !== "zruseno" && z.stav !== "chyba") obsazene[z.tym] = true; });
    var tymy = model.tymy, prosli = tymy.filter(function (t) { return t.E[e - 1].dobeh != null; }).length;
    var cekajici = f.filter(function (z) { return z.stav === "ceka"; }).length;
    var h = '<div class="p-hlavicka"><p class="p-misto"><strong>Předávka P' + info.predavka + " · " + esc(info.misto || "") + "</strong><br>" +
      "Prošlo " + prosli + " z " + tymy.length + "</p>" +
      '<button type="button" id="p-odhlasit" class="p-male">Odhlásit</button></div>';
    if (info.rezim === "test") h += '<p class="upozorneni">Zkušební režim – jen zkušební týmy.</p>';
    if (cekajici) h += '<p class="p-signal">Bez signálu – čeká ' + cekajici + ", odešle se samo.</p>";
    if (chyba) h += '<p class="p-chyba">' + esc(chyba) + "</p>";
    h += '<p id="p-hlaska" class="p-chyba" hidden></p>';
    h += '<button type="button" id="p-dobehl" class="p-dobehl">DOBĚHL TÝM</button>';
    // rozpracované: čas bez týmu a čekající na potvrzení
    f.filter(function (z) { return z.stav === "bez_tymu" || z.stav === "potvrdit"; }).forEach(function (z) {
      h += '<section class="p-rozprac"><p class="p-cas">Doběh ' + hms(z.cas) + "</p>" +
        (z.stav === "bez_tymu" ? vyberTymu(z, obsazene, "Číslo týmu z dresu") + '<p class="p-akce"><button type="button" data-zpet="' + z.id + '">Zrušit</button></p>'
          : potvrzeni(z, z, null)) + "</section>";
    });
    var dobihaji = ocekavane(obsazene);
    h += "<h2>Dobíhají</h2>";
    if (!dobihaji.length) h += "<p>Všechny týmy už tu prošly.</p>";
    h += '<div class="p-tymy">' + dobihaji.slice(0, 8).map(function (t) {
      var x = t.E[e - 1];
      return '<button type="button" class="p-tym" data-zapis="' + t.id + '"><span class="p-tym-cislo">' + esc(t.c || "–") + "</span>" +
        '<span class="p-tym-text"><strong>' + esc(t.n) + "</strong><small>" + esc(x.jm || "") + (x.odhad ? " · " + odhad(x.odhad) : "") + "</small></span></button>";
    }).join("") + "</div>";
    var hotove = f.slice().reverse().filter(function (z) { return z.stav !== "zruseno" && z.stav !== "bez_tymu" && z.stav !== "potvrdit"; }).slice(0, 20);
    if (hotove.length) {
      h += "<h2>Zapsáno</h2><ul class=\"p-zapsano\">" + hotove.map(function (z) {
        var stav = z.stav === "odeslano" ? '<span class="p-ok">odesláno</span>' :
          z.stav === "ceka" ? '<span class="p-ceka">čeká na signál</span>' :
          z.stav === "konflikt" ? '<span class="p-chyba">už bylo zapsáno ' + hms(z.existujici) + "</span>" :
          z.stav === "varovani" ? '<span class="p-chyba">databáze hlásí nesrovnalost</span>' :
          '<span class="p-chyba">' + esc(z.zprava || "chyba") + "</span>";
        var li = "<li><strong>" + hms(z.cas) + "</strong> " + (z.c ? "č. " + esc(z.c) + " " : "") + esc(z.n) + " · " + stav +
          (z.puvodne ? ' <small class="p-napoveda">(opraveno z ' + esc(z.puvodne) + ")</small>" : "");
        if (z.oprava) {
          li += z.oprava.tym ? potvrzeni(z, z.oprava, (z.c ? "č. " + z.c + " " : "") + z.n)
            : vyberTymu(z, obsazene, "Opravit na tým:") + '<p class="p-akce"><button type="button" data-zpet="' + z.id + '">Neopravovat</button></p>';
        } else if (z.stav === "konflikt") {
          li += '<span class="p-akce"><button type="button" data-nahradit="' + z.id + '">Platí můj čas</button> <button type="button" data-zpet="' + z.id + '">Nechat původní</button></span>';
        } else if (z.stav === "varovani") {
          li += '<ul class="p-varovani">' + (z.varovani || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
            '<span class="p-akce"><button type="button" data-ulozit="' + z.id + '">Ano, je to tým ' + esc(z.c || "") + " – uložit</button> " +
            '<button type="button" data-oprav="' + z.id + '">Jiný tým</button> <button type="button" data-zpet="' + z.id + '">Zrušit</button></span>';
        } else if (Date.now() - z.vytvoreno < 60 * 60000) {
          li += '<span class="p-akce"><button type="button" data-oprav="' + z.id + '">Opravit tým</button> <button type="button" data-zpet="' + z.id + '">Zpět</button></span>';
        }
        return li + "</li>";
      }).join("") + "</ul>";
    }
    var fokus = document.activeElement && document.activeElement.id;
    koren.innerHTML = h;
    if (fokus) { var c = document.getElementById(fokus); if (c && c.setSelectionRange) { c.focus(); c.setSelectionRange(c.value.length, c.value.length); } }
  }

  koren.addEventListener("click", function (ev) {
    var b;
    if (ev.target.closest("#p-dobehl")) { dobehl(); return; }
    b = ev.target.closest("[data-zapis]"); if (b) { zeSeznamu(b.getAttribute("data-zapis")); return; }
    b = ev.target.closest("[data-prirad]"); if (b) { var x = b.getAttribute("data-prirad").split(":"); prirad(x[0], x[1]); return; }
    b = ev.target.closest("[data-ulozit]"); if (b) { ulozit(b.getAttribute("data-ulozit")); return; }
    b = ev.target.closest("[data-potvrdit-opravu]"); if (b) { potvrditOpravu(b.getAttribute("data-potvrdit-opravu")); return; }
    b = ev.target.closest("[data-jiny]"); if (b) { jinyTym(b.getAttribute("data-jiny")); return; }
    b = ev.target.closest("[data-oprav]"); if (b) { zacitOpravu(b.getAttribute("data-oprav")); return; }
    b = ev.target.closest("[data-zpet]"); if (b) { zpet(b.getAttribute("data-zpet")); return; }
    b = ev.target.closest("[data-nahradit]"); if (b) { nahradit(b.getAttribute("data-nahradit")); return; }
    if (ev.target.id === "p-odhlasit") {
      if (fronta().some(function (z) { return z.stav === "ceka" || z.stav === "bez_tymu" || z.stav === "potvrdit"; }) &&
          !confirm("Některé zápisy ještě nejsou dokončené nebo odeslané. Opravdu odhlásit? Zůstanou v telefonu a dokončíš je po dalším přihlášení stejným kódem.")) return;
      kod = null; info = null; pis(K_KOD, null); pis(K_INFO, null); vykresli();
    }
  });
  koren.addEventListener("input", function (ev) {
    var id = ev.target.getAttribute("data-vstup");
    if (id) { vstupy[id] = ev.target.value; var p = ev.target.closest("form").querySelector(".p-napoveda");
      var t = ev.target.value ? tymPodleCisla(ev.target.value) : null;
      if (p) p.textContent = !ev.target.value ? "" : t ? t.n : "Tým s tímto číslem tu nezávodí."; }
  });
  koren.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    if (ev.target.id === "p-prihlaseni") {
      var k = document.getElementById("p-kod").value.replace(/\s/g, "");
      try { await prihlas(k); odesli(); } catch (e) { chyba = e.server ? e.message : "Bez signálu se nejde přihlásit. Zkus to za chvíli."; }
      vykresli();
      return;
    }
    var id = ev.target.getAttribute("data-form");
    if (id) {
      var t = tymPodleCisla(vstupy[id] || "");
      if (!t) { alertText("Tým s číslem " + (vstupy[id] || "") + " tu nezávodí."); return; }
      prirad(id, t.id);
    }
  });
  window.addEventListener("online", odesli);
  setInterval(function () { odesli(); }, 15000);
  setInterval(function () { if (!document.hidden) obnov(); }, 60000);

  // kód z odkazu (QR v pokynech): /predavka/?k=K7M2QX
  var Q = new URLSearchParams(location.search), zOdkazu = Q.get("k");
  if (zOdkazu) history.replaceState(null, "", location.pathname);
  kod = zOdkazu || cti(K_KOD, null);
  // poslední známá data – stránka funguje i bez signálu
  var ulozene = cti(K_INFO, null);
  if (kod && ulozene && ulozene.kod === String(kod).toUpperCase()) {
    info = ulozene.info; model = HBVysl.spocitej(info.data, Math.floor(ted() / 1000));
  }
  vykresli();
  if (kod) {
    var k0 = kod; if (!info) kod = null;
    prihlas(k0).then(function () { odesli(); }).catch(function (e) {
      chyba = e.server ? e.message : null;
      if (!e.server) chyba = "Bez signálu. Přihlášení se zopakuje samo.";
      kod = e.server ? null : k0;
      if (e.server) { info = null; pis(K_KOD, null); pis(K_INFO, null); }
    }).then(vykresli);
  }
})();

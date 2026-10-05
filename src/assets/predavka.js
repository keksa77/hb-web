// Zápis časů na předávce (telefon časoměřiče). Přihlášení kódem předávky, bez účtu (rozhodnutí 5. 10. 2026).
// Klepnutí na tým = doběh v tu chvíli. Bez signálu se zápis uloží v telefonu s původním časem
// a odešle se sám, až se signál vrátí (každý zápis má vlastní klient_id, takže se nikdy nezapíše dvakrát).
// Už zapsaný čas se nepřepíše bez potvrzení; Zpět funguje 15 minut. Seznam „Dobíhají“ řadí
// týmy podle živého odhadu (vysledky-model.js).
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

  // ---------- zápis a fronta ----------
  function zapis(tymId) {
    var t = (info.data.tymy || []).filter(function (x) { return String(x.id) === String(tymId); })[0];
    if (!t) return;
    var f = fronta();
    f.push({ id: noveId(), kod: kod, tym: t.id, c: t.c, n: t.n, cas: ted(), stav: "ceka", vytvoreno: Date.now() });
    ulozFrontu(f);
    if (navigator.vibrate) navigator.vibrate(60);
    vykresli();
    odesli();
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
          var r = await rpc("web_predavka_zapis", { p_kod: z.kod, p_tym: z.tym, p_cas: new Date(z.cas).toISOString(),
            p_klient_id: z.id, p_nahradit: !!z.nahradit });
          if (r.chyba) { z.stav = "chyba"; z.zprava = r.chyba; }
          else if (r.stav === "uz_zapsano") { z.stav = "konflikt"; z.existujici = Date.parse(r.cas); }
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
    var f = fronta(), z = f.filter(function (x) { return x.id === id; })[0];
    if (!z) return;
    if (z.stav === "ceka" || z.stav === "konflikt" || z.stav === "chyba") { z.stav = "zruseno"; ulozFrontu(f); vykresli(); return; }
    try {
      var r = await rpc("web_predavka_zpet", { p_kod: z.kod, p_klient_id: z.id });
      if (r.chyba) { alertText(r.chyba); return; }
      z.stav = "zruseno"; ulozFrontu(f); obnov();
    } catch (e) { alertText(e.server ? e.message : "Bez signálu nejde zápis vrátit. Zkus to za chvíli."); }
  }
  function nahradit(id) {
    var f = fronta(), z = f.filter(function (x) { return x.id === id; })[0];
    if (!z) return;
    z.nahradit = true; z.stav = "ceka"; ulozFrontu(f); vykresli(); odesli();
  }
  var hlaskaCas = null;
  function alertText(t) {
    var h = document.getElementById("p-hlaska");
    if (h) { h.textContent = t; h.hidden = false; clearTimeout(hlaskaCas); hlaskaCas = setTimeout(function () { h.hidden = true; }, 8000); }
  }

  // ---------- vykreslení ----------
  function prihlaseni() {
    return '<form id="p-prihlaseni" class="p-prihlaseni"><label for="p-kod">Kód předávky</label>' +
      '<p class="p-napoveda">Najdeš ho v pokynech pro předávku (6 znaků, např. K7M2QX).</p>' +
      '<input id="p-kod" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" required>' +
      '<button type="submit">Přihlásit</button>' + (chyba ? '<p class="p-chyba">' + esc(chyba) + "</p>" : "") + "</form>";
  }
  function vykresli() {
    if (!kod || !info) { koren.innerHTML = prihlaseni(); return; }
    var e = info.etapa, f = fronta().filter(function (z) { return z.kod === kod; });
    var lokalne = {};
    f.forEach(function (z) { if (z.stav === "ceka" || z.stav === "odeslano") lokalne[z.tym] = true; });
    var tymy = model.tymy, prosli = tymy.filter(function (t) { return t.E[e - 1].dobeh != null; }).length;
    var dobihaji = tymy.filter(function (t) { return t.E[e - 1].dobeh == null && !lokalne[t.id]; })
      .sort(function (a, b) { return (a.E[e - 1].odhad || Infinity) - (b.E[e - 1].odhad || Infinity) || (a.c || 0) - (b.c || 0); });
    var cekajici = f.filter(function (z) { return z.stav === "ceka"; }).length;
    var h = '<div class="p-hlavicka"><p class="p-misto"><strong>Předávka ' + info.predavka + " · " + esc(info.misto || "") + "</strong><br>" +
      "Zapisuješ doběh etapy " + e + ". Prošlo " + prosli + " z " + tymy.length + " týmů.</p>" +
      '<button type="button" id="p-odhlasit" class="p-male">Odhlásit</button></div>';
    if (info.rezim === "test") h += '<p class="upozorneni">Zkušební režim: mimo závod se zapisují jen zkušební týmy.</p>';
    if (cekajici) h += '<p class="p-signal">Čeká na odeslání: ' + cekajici + ". Odešle se samo, až bude signál.</p>";
    if (chyba) h += '<p class="p-chyba">' + esc(chyba) + "</p>";
    h += '<p id="p-hlaska" class="p-chyba" hidden></p>';
    h += "<h2>Dobíhají</h2>";
    if (!dobihaji.length) h += "<p>Všechny týmy už tu prošly.</p>";
    h += '<div class="p-tymy">' + dobihaji.slice(0, 8).map(function (t) {
      var x = t.E[e - 1];
      return '<button type="button" class="p-tym" data-zapis="' + t.id + '"><span class="p-tym-cislo">' + esc(t.c || "–") + "</span>" +
        '<span class="p-tym-text"><strong>' + esc(t.n) + "</strong><small>" + esc(x.jm || "") + (x.odhad ? " · " + odhad(x.odhad) : "") + "</small></span></button>";
    }).join("") + "</div>";
    h += '<form id="p-jiny" class="p-jiny"><label for="p-cislo">Jiný tým – číslo týmu</label><div>' +
      '<input id="p-cislo" inputmode="numeric" autocomplete="off" value="' + esc(cisloText) + '"><button type="submit">Zapsat teď</button></div>' +
      '<p id="p-cislo-nazev" class="p-napoveda"></p></form>';
    var posledni = f.slice().reverse().filter(function (z) { return z.stav !== "zruseno"; }).slice(0, 20);
    if (posledni.length) {
      h += "<h2>Zapsáno</h2><ul class=\"p-zapsano\">" + posledni.map(function (z) {
        var stav = z.stav === "odeslano" ? '<span class="p-ok">odesláno</span>' :
          z.stav === "ceka" ? '<span class="p-ceka">čeká na signál</span>' :
          z.stav === "konflikt" ? '<span class="p-chyba">už bylo zapsáno ' + hms(z.existujici) + "</span>" :
          '<span class="p-chyba">' + esc(z.zprava || "chyba") + "</span>";
        var akce = "";
        if (z.stav === "konflikt") akce = '<button type="button" data-nahradit="' + z.id + '">Platí můj čas</button> <button type="button" data-zpet="' + z.id + '">Nechat původní</button>';
        else if (Date.now() - z.vytvoreno < 15 * 60000) akce = '<button type="button" data-zpet="' + z.id + '">Zpět</button>';
        return "<li><strong>" + hms(z.cas) + "</strong> č. " + esc(z.c) + " " + esc(z.n) + " · " + stav + (akce ? '<span class="p-akce">' + akce + "</span>" : "") + "</li>";
      }).join("") + "</ul>";
    }
    var fokus = document.activeElement && document.activeElement.id;
    koren.innerHTML = h;
    if (fokus === "p-cislo") { var c = document.getElementById("p-cislo"); c.focus(); c.setSelectionRange(c.value.length, c.value.length); ukazNazev(); }
  }
  function tymPodleCisla(c) {
    return (info.data.tymy || []).filter(function (t) { return String(t.c) === String(c).trim(); })[0];
  }
  function ukazNazev() {
    var p = document.getElementById("p-cislo-nazev"); if (!p) return;
    var t = cisloText ? tymPodleCisla(cisloText) : null;
    p.textContent = !cisloText ? "" : t ? t.n : "Tým s tímto číslem tu nezávodí.";
  }

  koren.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-zapis]");
    if (b) { zapis(b.getAttribute("data-zapis")); return; }
    b = ev.target.closest("[data-zpet]"); if (b) { zpet(b.getAttribute("data-zpet")); return; }
    b = ev.target.closest("[data-nahradit]"); if (b) { nahradit(b.getAttribute("data-nahradit")); return; }
    if (ev.target.id === "p-odhlasit") {
      if (fronta().some(function (z) { return z.stav === "ceka"; }) && !confirm("Některé zápisy ještě nejsou odeslané. Opravdu odhlásit? Odešlou se po dalším přihlášení stejným kódem.")) return;
      kod = null; info = null; pis(K_KOD, null); pis(K_INFO, null); vykresli();
    }
  });
  koren.addEventListener("input", function (ev) {
    if (ev.target.id === "p-cislo") { cisloText = ev.target.value; ukazNazev(); }
  });
  koren.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    if (ev.target.id === "p-prihlaseni") {
      var k = document.getElementById("p-kod").value.trim();
      try { await prihlas(k); odesli(); } catch (e) { chyba = e.server ? e.message : "Bez signálu se nejde přihlásit. Zkus to za chvíli."; }
      vykresli();
    } else if (ev.target.id === "p-jiny") {
      var t = tymPodleCisla(cisloText);
      if (!t) { alertText("Tým s číslem " + cisloText + " tu nezávodí."); return; }
      cisloText = ""; zapis(t.id);
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

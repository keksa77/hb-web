// Online výsledky – veřejná stránka Výsledky.
// Data: RPC web_vysledky_online (jen veřejné údaje: tým, jméno běžce s iniciálou, časy).
// Živý odhad počítá vysledky-model.js (metoda C ze zpětného testu). Chybějící čas zůstává vidět jako chybějící.
// Ukázka: ?ukazka=hb26 přehraje ročník 2026 s posuvníkem času (data assets/ukazka-hb26.json).
(function () {
  var koren = document.getElementById("vysledky-online");
  if (!koren) return;
  var CFG = window.HB || {};
  var Q = new URLSearchParams(location.search);
  var UKAZKA = Q.get("ukazka") === "hb26";
  var POHLEDY = [
    { k: "poradi", n: "Pořadí" },
    { k: "tym", n: "Můj tým" },
    { k: "predavky", n: "Předávky" },
    { k: "etapy", n: "Časy etap" }
  ];
  var KAT = { "muzi-mix": "Muži + mix", "zeny": "Ženy" };
  var data = null, model = null, ted = null, chyba = null, nacteno = null;
  var st = { pohled: "poradi", etapa: null, kat: "", tym: null, etapaCasy: null, hledat: "" };

  // ---------- pomocné ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var FMT_HM = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" });
  var FMT_HMS = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  var FMT_DEN = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", weekday: "short" });
  function hm(s) { return s == null ? "" : FMT_HM.format(new Date(s * 1000)); }
  function hms(s) { return s == null ? "" : FMT_HMS.format(new Date(s * 1000)); }
  function den(s) { return FMT_DEN.format(new Date(s * 1000)); }
  function odhadText(s) { return s == null ? "" : "≈ " + hm(Math.round(s / 300) * 300); }
  function trvani(s) {
    if (s == null) return "";
    var z = s < 0 ? "−" : ""; s = Math.abs(Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return z + h + ":" + (m < 10 ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x;
  }
  function rozdil(s) {
    if (s == null) return "";
    var z = s > 0 ? "+" : s < 0 ? "−" : ""; s = Math.abs(Math.round(s));
    var m = Math.floor(s / 60), x = s % 60;
    return z + m + ":" + (x < 10 ? "0" : "") + x;
  }
  function tempo(sek, km) {
    if (!sek || !km) return "";
    var p = sek / 60 / km, m = Math.floor(p), x = Math.round((p - m) * 60);
    if (x === 60) { m++; x = 0; }
    return m + ":" + (x < 10 ? "0" : "") + x;
  }
  function omez(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function misto(c) { var m = (data.mista || [])[c - 1]; return m ? m[1] : "předávka " + c; }
  function km(etapa) { var m = (data.mista || [])[etapa - 1]; return m && m[2] ? Number(m[2]) : null; }

  function spocitej() { model = HBVysl.spocitej(data, ted); }

  // ---------- vykreslení ----------
  function zahlavi() {
    var h = "";
    if (data.nahled) h += '<p class="upozorneni">Náhled pro organizátory – veřejnost tyto výsledky zatím nevidí (Nastavení → Online výsledky na webu).</p>';
    if (UKAZKA) {
      var od = model.nejdrivStart - 1800, doo = Math.max.apply(null, data.tymy.map(function (t) { var r = (t.e || [])[29]; return r && r[3] || 0; })) + 1800;
      h += '<div class="v-ukazka"><p><strong>Ukázka:</strong> přehrání ročníku 2026 podle skutečných časů. Posuvníkem nastavíš, jaký je „teď“.</p>' +
        '<label class="v-cas-posuvnik">Teď: <strong id="v-ted">' + den(ted) + " " + hm(ted) + '</strong>' +
        '<input type="range" id="v-posuvnik" min="' + od + '" max="' + doo + '" step="300" value="' + ted + '"></label>' +
        '<p class="v-tlacitka"><button type="button" data-posun="-3600">−1 h</button> <button type="button" data-posun="-900">−15 min</button> ' +
        '<button type="button" data-posun="900">+15 min</button> <button type="button" data-posun="3600">+1 h</button></p></div>';
    }
    var stav;
    if (!model.zacal) stav = "Závod ještě nezačal.";
    else if (model.dobehnuto) stav = data.oficialni ? "Oficiální výsledky." : "Všechny týmy doběhly. Neoficiální výsledky – probíhá kontrola.";
    else stav = "Průběžné výsledky.";
    h += '<p class="v-stav">' + stav + (UKAZKA ? "" : ' <span class="v-aktualizace">Aktualizováno ' + hms(nacteno) +
      ", obnovuje se každou minutu.</span>") + "</p>";
    if (model.dobehnuto && data.oficialni && data.pdf) h += '<p><a class="v-pdf" href="' + esc(data.pdf) + '">Výsledková listina (PDF)</a></p>';
    h += '<nav class="v-pohledy" aria-label="Pohledy na výsledky">' + POHLEDY.map(function (p) {
      return '<button type="button" data-pohled="' + p.k + '"' + (st.pohled === p.k ? ' aria-current="page" class="v-aktivni"' : "") + ">" + p.n + "</button>";
    }).join("") + "</nav>";
    return h;
  }

  function vyberKat() {
    return '<label>Kategorie <select id="v-kat"><option value="">Všechny</option>' +
      Object.keys(KAT).map(function (k) { return '<option value="' + k + '"' + (st.kat === k ? " selected" : "") + ">" + KAT[k] + "</option>"; }).join("") +
      "</select></label>";
  }
  function vyberEtapy(id, hodnota, jenProbehle) {
    var h = '<label>Po etapě <select id="' + id + '">';
    for (var e = 1; e <= 30; e++) {
      var n = model.poradi[e].length;
      if (jenProbehle && !n) continue;
      h += '<option value="' + e + '"' + (hodnota === e ? " selected" : "") + ">" + e + " → " + esc(misto(e + 1)) + " (" + n + " týmů)</option>";
    }
    return h + "</select></label>";
  }
  function kdeJe(t) {
    if (t.cil != null) return "v cíli " + hm(t.cil);
    if (t.s == null) return "start neurčen";
    if (ted < t.s) return "start " + hm(t.s);
    var e = t.E[t.bezi - 1];
    return "běží " + t.bezi + ". etapu" + (e && e.zpozdeni ? ' <span class="v-zpozdeni">déle, než se čekalo</span>' : "");
  }

  function pohledPoradi() {
    if (!model.zacal || model.vychozi == null) return predStartem();
    var e = st.etapa || model.vychozi;
    var rada = model.poradi[e].filter(function (t) { return !st.kat || t.k === st.kat; });
    var prvni = rada.length ? rada[0].E[e - 1].casTymu : null;
    var h = '<div class="v-filtry">' + vyberEtapy("v-etapa", e, true) + vyberKat() + "</div>";
    h += '<div class="table-responsive"><table class="v-tabulka"><thead><tr><th>Poř.</th><th>Tým</th><th>Čas týmu</th><th class="v-mimo-mobil">Ztráta</th><th class="v-mimo-mobil">Posun</th></tr></thead><tbody>';
    rada.forEach(function (t, j) {
      var x = t.E[e - 1], pred = e > 1 ? t.E[e - 2] : null;
      var por = st.kat ? x.poradiKat : x.poradi, porPred = pred ? (st.kat ? pred.poradiKat : pred.poradi) : null;
      var posun = porPred ? porPred - por : null;
      h += "<tr><td>" + por + '.</td><td><a href="#pohled=tym&tym=' + t.id + '" data-tym="' + t.id + '">' + esc(t.n) + '</a> <span class="v-cislo">' + esc(t.c) + "</span>" +
        '<small class="v-kde">' + kdeJe(t) + "</small></td><td>" + trvani(x.casTymu) + '</td><td class="v-mimo-mobil">' + (j ? "+" + trvani(x.casTymu - prvni) : "") +
        '</td><td class="v-mimo-mobil">' + (posun ? '<span class="' + (posun > 0 ? "v-nahoru" : "v-dolu") + '">' + (posun > 0 ? "▲ " + posun : "▼ " + -posun) + "</span>" : "") + "</td></tr>";
    });
    h += "</tbody></table></div>";
    var zbyva = model.tymy.filter(function (t) { return t.E[e - 1].casTymu == null && (!st.kat || t.k === st.kat); });
    if (zbyva.length) {
      h += "<h3>Etapou " + e + " zatím neproběhli (" + zbyva.length + ")</h3><ul class=\"v-zbyva\">" + zbyva.map(function (t) {
        var x = t.E[e - 1];
        return '<li><a href="#pohled=tym&tym=' + t.id + '" data-tym="' + t.id + '">' + esc(t.n) + "</a> – " + kdeJe(t) +
          (x.odhad ? ", na předávce " + (e + 1) + " " + odhadText(x.odhad) : x.dobeh == null && t.posledni > e ? ", čas etapy chybí" : "") + "</li>";
      }).join("") + "</ul>";
    }
    return h;
  }

  function predStartem() {
    var r = model.tymy.slice().sort(function (a, b) { return (a.s || 0) - (b.s || 0) || (a.c || 0) - (b.c || 0); });
    var h = "<p>Průběžné pořadí se objeví po prvních doběhnutých etapách." + (data.datum_zavodu ? " Start závodu: " + new Date(data.datum_zavodu + "T12:00:00").toLocaleDateString("cs-CZ") + "." : "") + "</p>";
    if (!r.length) return h;
    h += '<h3>Startovní listina</h3><div class="table-responsive"><table class="v-tabulka"><thead><tr><th>Start</th><th>Tým</th><th>Kategorie</th></tr></thead><tbody>';
    r.forEach(function (t) {
      h += "<tr><td>" + (t.s ? hm(t.s) : "–") + '</td><td><a href="#pohled=tym&tym=' + t.id + '" data-tym="' + t.id + '">' + esc(t.n) + '</a> <span class="v-cislo">' + esc(t.c) + "</span></td><td>" + esc(KAT[t.k] || "") + "</td></tr>";
    });
    return h + "</tbody></table></div>";
  }

  function pohledTym() {
    var t = model.tymy.filter(function (x) { return String(x.id) === String(st.tym); })[0];
    var h = '<div class="v-filtry"><label>Najdi tým (název nebo číslo) <input type="search" id="v-hledat" value="' + esc(st.hledat) + '"></label></div>';
    var q = st.hledat.trim().toLowerCase();
    if (q || !t) {
      var nal = model.tymy.filter(function (x) { return !q || String(x.c) === q || String(x.n).toLowerCase().indexOf(q) >= 0; })
        .sort(function (a, b) { return String(a.n).localeCompare(String(b.n), "cs"); });
      h += '<ul class="v-seznam-tymu">' + nal.map(function (x) {
        return '<li><a href="#pohled=tym&tym=' + x.id + '" data-tym="' + x.id + '">' + esc(x.n) + '</a> <span class="v-cislo">' + esc(x.c) + "</span></li>";
      }).join("") + "</ul>";
      if (!t) return h;
    }
    var posl = t.posledni ? t.E[t.posledni - 1] : null;
    h += '<h2 class="v-tym-nazev">' + esc(t.n) + ' <span class="v-cislo">' + esc(t.c) + "</span></h2>";
    h += '<p class="v-tym-stav">' + esc(KAT[t.k] || "") + " · " + kdeJe(t) +
      (posl && posl.poradi ? " · po " + t.posledni + ". etapě " + posl.poradi + ". celkově, " + posl.poradiKat + ". v kategorii" +
        (model.poradi[t.posledni].length < model.tymy.length ? " (z " + model.poradi[t.posledni].length + " týmů, které ji už proběhly)" : "") : "") + "</p>";
    h += '<p><button type="button" id="v-odkaz">Zkopírovat odkaz na tým</button> <span id="v-odkaz-ok" class="v-ok" hidden>Zkopírováno.</span></p>';
    h += '<div class="table-responsive"><table class="v-tabulka v-detail"><thead><tr><th>Etapa</th><th>Běžec</th><th>Na předávce</th><th>Čas etapy</th><th class="v-mimo-mobil">Proti plánu</th></tr></thead><tbody>';
    t.E.forEach(function (e) {
      var tr = e.dobeh != null ? "" : e.i === t.bezi ? ' class="v-bezi"' : e.odhad ? ' class="v-budouci"' : "";
      var naPred, casE = "", proti = "";
      if (e.dobeh != null) {
        naPred = hms(e.dobeh);
        if (e.cas != null) { casE = trvani(e.cas); proti = e.plan ? rozdil(e.cas - e.plan) : ""; }
        else casE = '<span class="v-chybi">chybí čas předávky ' + e.i + "</span>";
      } else if (e.odhad) {
        naPred = '<span class="v-odhad">' + odhadText(e.odhad) + "</span>" + (e.zpozdeni ? ' <span class="v-zpozdeni">déle, než se čekalo</span>' : "");
      } else if (t.posledni > e.i) {
        naPred = '<span class="v-chybi">chybí</span>';
      } else naPred = "";
      h += "<tr" + tr + "><td>" + e.i + ' <small class="v-misto">' + esc(misto(e.i)) + " → " + esc(misto(e.i + 1)) + "</small></td><td>" + esc(e.jm) +
        (e.i === t.bezi ? ' <small class="v-bezi-znacka">běží</small>' : "") + "</td><td>" + naPred + "</td><td>" + casE + '</td><td class="v-mimo-mobil">' + proti + "</td></tr>";
    });
    return h + "</tbody></table></div>" + legenda();
  }

  function pohledPredavky() {
    var h = '<p class="v-poznamka">U každé předávky: kolik týmů už prošlo a kdy se čekají další. Odhad je zaokrouhlený na 5 minut.</p><div class="v-predavky">';
    var hotove = 0;
    for (var m0 = 2; m0 <= 31; m0++) {
      if (model.tymy.every(function (t) { return t.E[m0 - 2].dobeh != null || t.posledni > m0 - 1; })) hotove = m0; else break;
    }
    if (hotove >= 2) h += '<p class="v-predavka">' + (hotove > 2 ? "Předávkami 2–" + hotove : "Předávkou 2") + " už prošly všechny týmy.</p>";
    for (var m = Math.max(2, hotove + 1); m <= 31; m++) {
      var e = m - 1, pros = [], ceka = [];
      model.tymy.forEach(function (t) {
        var x = t.E[e - 1];
        if (x.dobeh != null) pros.push(x.dobeh);
        else if (x.odhad) ceka.push({ t: t, p: x.odhad });
      });
      ceka.sort(function (a, b) { return a.p - b.p; });
      var brzy = ceka.filter(function (c) { return c.p <= ted + 1800; });
      pros.sort(function (a, b) { return a - b; });
      var souhrn = "prošlo " + pros.length + " z " + model.tymy.length + (ceka.length ? " · další " + odhadText(ceka[0].p) : pros.length === model.tymy.length ? " · všichni prošli" : "");
      h += '<details class="v-predavka"' + (brzy.length ? " open" : "") + "><summary><strong>" + m + " " + esc(misto(m)) + "</strong> <span>" + souhrn + "</span></summary>";
      h += "<p>" + (pros.length ? "První prošel " + hm(pros[0]) + ", zatím poslední " + hm(pros[pros.length - 1]) + ". " : "") +
        (ceka.length ? "Ze zbývajících se první čeká " + odhadText(ceka[0].p) + ", poslední " + odhadText(ceka[ceka.length - 1].p) + "." : "") + "</p>";
      if (brzy.length) h += "<p>Do 30 minut:</p><ul>" + brzy.map(function (c) {
        return "<li>" + odhadText(c.p) + ' <a href="#pohled=tym&tym=' + c.t.id + '" data-tym="' + c.t.id + '">' + esc(c.t.n) + "</a> – " + esc(c.t.E[e - 1].jm) + "</li>";
      }).join("") + "</ul>";
      h += "</details>";
    }
    return h + "</div>";
  }

  function pohledEtapy() {
    var e = st.etapaCasy || model.vychozi || 1;
    var r = model.tymy.filter(function (t) { return t.E[e - 1].cas != null && (!st.kat || t.k === st.kat); })
      .sort(function (a, b) { return a.E[e - 1].cas - b.E[e - 1].cas; });
    var h = '<div class="v-filtry"><label>Etapa <select id="v-etapa-casy">';
    for (var i = 1; i <= 30; i++) h += '<option value="' + i + '"' + (i === e ? " selected" : "") + ">" + i + " " + esc(misto(i)) + " → " + esc(misto(i + 1)) + "</option>";
    h += "</select></label>" + vyberKat() + "</div>";
    if (!r.length) return h + "<p>Na této etapě zatím nejsou změřené časy.</p>";
    h += '<p class="v-poznamka">' + (km(e) ? km(e) + " km · " : "") + "změřeno " + r.length + " běžců.</p>";
    h += '<div class="table-responsive"><table class="v-tabulka"><thead><tr><th>Poř.</th><th>Běžec</th><th>Tým</th><th>Čas</th><th class="v-mimo-mobil">Tempo</th><th class="v-mimo-mobil">Proti plánu</th></tr></thead><tbody>';
    r.forEach(function (t, j) {
      var x = t.E[e - 1];
      h += "<tr><td>" + (j + 1) + ".</td><td>" + esc(x.jm) + '</td><td><a href="#pohled=tym&tym=' + t.id + '" data-tym="' + t.id + '">' + esc(t.n) + "</a></td><td>" + trvani(x.cas) +
        '</td><td class="v-mimo-mobil">' + (tempo(x.cas, km(e)) ? tempo(x.cas, km(e)) + " min/km" : "") + '</td><td class="v-mimo-mobil">' + (x.plan ? rozdil(x.cas - x.plan) : "") + "</td></tr>";
    });
    return h + "</tbody></table></div>";
  }

  function legenda() {
    return '<p class="v-legenda">14:32:10 = změřený čas · <span class="v-odhad">≈ 14:35</span> = odhad podle dosavadního tempa (zaokrouhlený na 5 min) · <span class="v-chybi">chybí</span> = čas nebyl zapsán.</p>';
  }

  function vykresli() {
    if (chyba) { koren.innerHTML = '<p class="upozorneni">' + esc(chyba) + "</p>"; return; }
    if (!data) { koren.innerHTML = "<p>Načítám výsledky…</p>"; return; }
    if (!data.zobrazit) {
      koren.innerHTML = "<p>Průběžné výsledky ročníku se tu objeví během závodu" +
        (data.datum_zavodu ? " (" + new Date(data.datum_zavodu + "T12:00:00").toLocaleDateString("cs-CZ") + ")" : "") + ".</p>" +
        '<p><a href="?ukazka=hb26">Vyzkoušej ukázku na ročníku 2026</a></p>';
      return;
    }
    spocitej();
    var obsah = st.pohled === "tym" ? pohledTym() : st.pohled === "predavky" ? pohledPredavky() : st.pohled === "etapy" ? pohledEtapy() : pohledPoradi();
    var fokus = document.activeElement && document.activeElement.id;
    var poz = fokus === "v-hledat" ? document.activeElement.selectionStart : null;
    koren.innerHTML = zahlavi() + '<section class="v-obsah">' + obsah + "</section>";
    if (fokus) { var f = document.getElementById(fokus); if (f) { f.focus(); if (poz != null && f.setSelectionRange) f.setSelectionRange(poz, poz); } }
  }

  // ---------- stav v adrese (#pohled=tym&tym=12) ----------
  function zAdresy() {
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get("pohled")) st.pohled = h.get("pohled");
    if (h.get("tym")) { st.tym = h.get("tym"); st.pohled = "tym"; st.hledat = ""; }
  }
  function doAdresy() {
    var h = "#pohled=" + st.pohled + (st.pohled === "tym" && st.tym ? "&tym=" + st.tym : "");
    if (location.hash !== h) history.replaceState(null, "", location.pathname + location.search + h);
  }

  koren.addEventListener("click", function (ev) {
    var p = ev.target.closest("[data-pohled]");
    if (p) { st.pohled = p.getAttribute("data-pohled"); doAdresy(); vykresli(); return; }
    var t = ev.target.closest("[data-tym]");
    if (t) { ev.preventDefault(); st.tym = t.getAttribute("data-tym"); st.pohled = "tym"; st.hledat = ""; doAdresy(); vykresli(); window.scrollTo(0, koren.offsetTop - 10); return; }
    var b = ev.target.closest("[data-posun]");
    if (b) { ted = omez(ted + Number(b.getAttribute("data-posun")), Number(document.getElementById("v-posuvnik").min), Number(document.getElementById("v-posuvnik").max)); vykresli(); return; }
    if (ev.target.id === "v-odkaz") {
      var url = location.origin + location.pathname + (UKAZKA ? "?ukazka=hb26" : "") + "#pohled=tym&tym=" + st.tym;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
        var ok = document.getElementById("v-odkaz-ok"); if (ok) ok.hidden = false;
      }).catch(function () { prompt("Zkopíruj odkaz:", url); });
    }
  });
  koren.addEventListener("change", function (ev) {
    var id = ev.target.id;
    if (id === "v-etapa") st.etapa = Number(ev.target.value);
    else if (id === "v-etapa-casy") st.etapaCasy = Number(ev.target.value);
    else if (id === "v-kat") st.kat = ev.target.value;
    else return;
    vykresli();
  });
  koren.addEventListener("input", function (ev) {
    if (ev.target.id === "v-posuvnik") { ted = Number(ev.target.value); vykresli(); }
    else if (ev.target.id === "v-hledat") { st.hledat = ev.target.value; vykresli(); }
  });
  window.addEventListener("hashchange", function () { zAdresy(); vykresli(); });

  // ---------- načtení dat ----------
  function tokenOrganizatora() {
    try {
      var r = JSON.parse(localStorage.getItem("hb_admin_relace") || "null");
      return r && Date.now() < r.vyprsi - 60000 ? r.access_token : null;
    } catch (e) { return null; }
  }
  async function nacti() {
    try {
      if (UKAZKA) {
        var o = await fetch((CFG.zaklad || "") + "/assets/ukazka-hb26.json");
        data = await o.json();
        if (ted == null) ted = Number(Q.get("cas")) || Math.round((data.tymy[0].s + 12 * 3600) / 300) * 300;
      } else {
        var odp = await fetch(CFG.url + "/rest/v1/rpc/web_vysledky_online", {
          method: "POST",
          headers: { apikey: CFG.klic, Authorization: "Bearer " + (tokenOrganizatora() || CFG.klic), "Content-Type": "application/json" },
          body: "{}"
        });
        if (!odp.ok) throw new Error("HTTP " + odp.status);
        data = await odp.json();
        ted = Math.floor(Date.parse(data.ted) / 1000) || Math.floor(Date.now() / 1000);
      }
      nacteno = Math.floor(Date.now() / 1000);
      chyba = null;
    } catch (e) {
      if (!data) chyba = "Výsledky se nepodařilo načíst. Zkus stránku obnovit za chvíli.";
    }
    vykresli();
  }
  zAdresy();
  vykresli();
  nacti();
  if (!UKAZKA) setInterval(function () { if (!document.hidden) nacti(); }, 60000);
})();

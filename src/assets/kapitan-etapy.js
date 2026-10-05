// Kapitánská sekce – rozdělení na etapy. 30 řádků, u každého výběr běžce, uloží se všechno najednou.
// Dvě etapy za sebou databáze nepustí; třetiny 1–10 / 11–20 / 21–30 a prázdné etapy jen upozorní
// (rozhodnutí Keksy 1. 10. 2026). Stránka chyby ukazuje hned při výběru, ještě před uložením.
(function () {
  var e = HBK.esc;
  var P = null, ETAPY = [], BEZCI = [], VYBER = {}, TRASA = {};
  function cislo(n) { return n == null || n === "" ? "" : Number(n).toLocaleString("cs-CZ", { maximumFractionDigits: 1 }); }
  function info(x) { return TRASA[x.etapa] || {}; }

  function jmeno(id) { var b = BEZCI.filter(function (x) { return x.soupiska_id === id; })[0]; return b ? b.jmeno + " " + b.prijmeni : ""; }

  // kontrola v prohlížeči: stejná pravidla jako v databázi
  function kontrola() {
    var zaSebou = {}, chyby = [];
    for (var i = 1; i < 30; i++) {
      if (VYBER[i] && VYBER[i] === VYBER[i + 1]) {
        zaSebou[i] = zaSebou[i + 1] = true;
        chyby.push(jmeno(VYBER[i]) + " má etapy " + i + " a " + (i + 1) + " hned za sebou. To pravidla nedovolují.");
      }
    }
    var volne = []; for (var j = 1; j <= 30; j++) if (!VYBER[j]) volne.push(j);
    var upoz = [];
    if (volne.length) upoz.push("Bez běžce: " + volne.join(", ") + ".");
    BEZCI.forEach(function (b) {
      var t = [false, false, false], n = 0;
      for (var k = 1; k <= 30; k++) if (VYBER[k] === b.soupiska_id) { t[Math.floor((k - 1) / 10)] = true; n++; }
      b._tretiny = t; b._pocet = n;
      if (!n) upoz.push(b.jmeno + " " + b.prijmeni + " nemá žádnou etapu.");
      else if (!(t[0] && t[1] && t[2])) upoz.push(b.jmeno + " " + b.prijmeni + " nemá etapu z úseku " +
        ["1–10", "11–20", "21–30"].filter(function (x, idx) { return !t[idx]; }).join(", ") + ".");
    });
    return { zaSebou: zaSebou, chyby: chyby, upoz: upoz };
  }

  function vykresli(hlaska, chyba) {
    var vede = P.role !== "bezec", lze = vede && P.soupiska_otevrena;
    var k = kontrola();
    // součty na běžce: km, stoupání a klesání přidělených etap (Keksa 4. 10. 2026)
    var km = {}, nahoru = {}, dolu = {};
    ETAPY.forEach(function (x) {
      var b = VYBER[x.etapa]; if (!b) return; var i = info(x);
      km[b] = (km[b] || 0) + Number(i.delka_km != null ? i.delka_km : x.delka_km || 0);
      nahoru[b] = (nahoru[b] || 0) + Number(i.prevyseni_m || 0); dolu[b] = (dolu[b] || 0) + Number(i.klesani_m || 0);
    });
    var h = ['<p class="k-hlaska" id="k-stav" role="status"></p>'];
    h.push('<p class="pocet">Každou etapu běží jeden běžec. Nikdo nesmí běžet dvě etapy za sebou a každý musí mít aspoň jednu etapu z 1–10, 11–20 i 21–30. ' +
      (P.soupiska_otevrena ? (P.soupiska_do ? "Změny jdou do " + e(HBK.cas(P.soupiska_do)) + "." : "")
                           : "<b>Rozdělení je uzavřené.</b> Změny řeší pořadatel na info@horybory.cz.") + "</p>");
    if (!BEZCI.length) h.push('<p class="k-chyba">Nejdřív přidej běžce na <a href="' + HB.zaklad + '/kapitan/soupiska/">soupisku</a>.</p>');
    h.push('<div class="k-tabulka-obal"><table class="k-tabulka"><thead><tr><th>Etapa</th><th>Odkud – kam</th><th>Km</th><th>Stoupání</th><th>Klesání</th><th>Povrch</th><th>Běžec</th></tr></thead><tbody>' +
      ETAPY.map(function (x) {
        var sel = lze ? '<select data-etapa="' + x.etapa + '" aria-label="Běžec etapy ' + x.etapa + '"><option value="">— nikdo —</option>' +
          BEZCI.map(function (b) { return '<option value="' + b.soupiska_id + '"' + (VYBER[x.etapa] === b.soupiska_id ? " selected" : "") + ">" +
            e(b.startovni_cislo + " " + b.jmeno + " " + b.prijmeni) + "</option>"; }).join("") + "</select>"
          : e(jmeno(VYBER[x.etapa]) || "—");
        var i = info(x), useka = i.start_nazev && i.cil_nazev ? i.start_nazev + " – " + i.cil_nazev : (i.nazev || x.nazev || "");
        return '<tr' + (k.zaSebou[x.etapa] ? ' class="k-spatne"' : "") + '><td class="k-cislo"><a href="' + HB.zaklad + "/trasa/etapa-" + String(x.etapa).padStart(2, "0") +
          '/" target="_blank" rel="noopener" title="Stránka etapy ' + x.etapa + '">' + x.etapa + "</a></td><td>" + e(useka) +
          '</td><td class="k-cislo">' + cislo(i.delka_km != null ? i.delka_km : x.delka_km) + '</td><td class="k-cislo">' + (i.prevyseni_m != null ? cislo(i.prevyseni_m) + " m" : "") +
          '</td><td class="k-cislo">' + (i.klesani_m != null ? cislo(i.klesani_m) + " m" : "") + "</td><td>" + e(i.povrch || "") + "</td><td>" + sel + "</td></tr>";
      }).join("") + "</tbody></table></div>");
    if (lze) h.push('<div class="k-akce"><button type="button" class="k-tlacitko" id="k-ulozit"' + (k.chyby.length ? " disabled" : "") + ">Uložit rozdělení</button>" +
      '<span class="pocet" id="k-zmeny"></span></div>');
    if (k.chyby.length) h.push('<div class="k-chyba"><ul class="k-upozorneni">' + k.chyby.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul></div>");
    var celkem = {km: 0, nahoru: 0, dolu: 0, etap: 0};
    BEZCI.forEach(function (b) { celkem.km += km[b.soupiska_id] || 0; celkem.nahoru += nahoru[b.soupiska_id] || 0; celkem.dolu += dolu[b.soupiska_id] || 0; });
    for (var c = 1; c <= 30; c++) if (VYBER[c]) celkem.etap++;
    h.push('<div class="k-karta"><h2>Běžci a jejich etapy</h2><div class="k-tabulka-obal"><table class="k-tabulka"><thead><tr><th>Běžec</th><th>Etapy</th><th>Km</th><th>Stoupání</th><th>Klesání</th><th>Přidělena etapa z úseku</th></tr></thead><tbody>' +
      BEZCI.map(function (b) {
        var et = []; for (var i = 1; i <= 30; i++) if (VYBER[i] === b.soupiska_id) et.push(i);
        return "<tr><td>" + e(b.startovni_cislo + " " + b.jmeno + " " + b.prijmeni) + "</td><td>" + e(et.join(", ") || "—") +
          '</td><td class="k-cislo">' + (km[b.soupiska_id] ? cislo(km[b.soupiska_id]) : "") +
          '</td><td class="k-cislo">' + (nahoru[b.soupiska_id] ? cislo(nahoru[b.soupiska_id]) + " m" : "") +
          '</td><td class="k-cislo">' + (dolu[b.soupiska_id] ? cislo(dolu[b.soupiska_id]) + " m" : "") +
          '</td><td class="k-tretiny">' + ["1–10", "11–20", "21–30"].map(function (t, idx) {
            return '<span class="' + (b._tretiny[idx] ? "k-tretina-ano" : "k-tretina-ne") + '">' + t + "</span>"; }).join("") + "</td></tr>";
      }).join("") + '</tbody><tfoot><tr><td>Celkem</td><td>' + celkem.etap + ' z 30 etap</td><td class="k-cislo">' + cislo(celkem.km) +
      '</td><td class="k-cislo">' + cislo(celkem.nahoru) + ' m</td><td class="k-cislo">' + cislo(celkem.dolu) + " m</td><td></td></tr></tfoot></table></div>" +
      (k.upoz.length ? '<h3>Co ještě nesedí</h3><ul class="k-upozorneni">' + k.upoz.map(function (x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>"
                     : '<p class="k-ok">Rozdělení splňuje pravidla. Potvrdíš ho v posledním kroku <a href="' + HB.zaklad + '/kapitan/potvrzeni/">Kontrola a potvrzení</a>.</p>') + "</div>");
    document.getElementById("k-obsah").innerHTML = h.join("");
    if (hlaska) HBK.hlaska("k-stav", hlaska, chyba);
  }

  var ULOZENO = "";
  function otisk() { var a = []; for (var i = 1; i <= 30; i++) a.push(VYBER[i] || 0); return a.join(","); }
  function zmeneno() { return otisk() !== ULOZENO; }

  document.addEventListener("change", function (ev) {
    var t = ev.target; if (!t || !t.dataset || !t.dataset.etapa) return;
    var v = t.value ? Number(t.value) : null;
    if (v) VYBER[Number(t.dataset.etapa)] = v; else delete VYBER[Number(t.dataset.etapa)];
    var y = window.scrollY; vykresli(); window.scrollTo(0, y);
    var z = document.getElementById("k-zmeny"); if (z) z.textContent = zmeneno() ? "Máš neuložené změny. Uloží je i tlačítko Dál." : "";
    hintDal();
  });

  document.addEventListener("click", async function (ev) {
    if (!ev.target || ev.target.id !== "k-ulozit") return;
    ev.target.disabled = true;
    try {
      await ulozit();
      await nacti();
      vykresli("Rozdělení je uložené."); hintDal(); HBK.toast("Rozdělení je uložené.");
    } catch (err) { HBK.hlaska("k-stav", err.message, true); ev.target.disabled = false; window.scrollTo(0, 0); }
  });

  // Neuložené rozdělení: tlačítka Zpět/Dál a ukazatel kroků ho uloží sama, ať se kapitán nemusí vracet
  // k tlačítku „Uložit rozdělení“ a prohlížeč neukazuje hlášku „Změny možná nebudou uloženy“ (Keksa 5. 10. 2026).
  function lzeUkladat() { return P && P.role !== "bezec" && P.soupiska_otevrena; }
  async function ulozit() {
    var data = []; for (var i = 1; i <= 30; i++) data.push({ etapa: i, soupiska_id: VYBER[i] || null });
    await HBK.rpc("web_k_uloz_etapy", { p_rozdeleni: data });
    ULOZENO = otisk();
  }
  function hintDal() {
    var s = document.querySelector("#k-navigace .k-nav-dal small"); if (!s) return;
    if (!s.dataset.puvodni) s.dataset.puvodni = s.textContent;
    s.textContent = lzeUkladat() && zmeneno() ? "Uloží rozdělení etap a pokračuje." : s.dataset.puvodni;
  }
  document.addEventListener("click", async function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest("#k-navigace a, #k-kroky a");
    if (!a || !lzeUkladat() || !zmeneno()) return;
    ev.preventDefault();
    if (kontrola().chyby.length) {
      HBK.hlaska("k-stav", "Rozdělení nejde uložit: " + kontrola().chyby.join(" ") + " Oprav to, nebo odejdi bez uložení.", true);
      window.scrollTo(0, 0);
      if (confirm("Rozdělení má chybu a nejde uložit. Odejít bez uložení změn?")) { ULOZENO = otisk(); location.href = a.href; }
      return;
    }
    a.classList.add("k-nav-uklada");
    try {
      await ulozit();
      try { sessionStorage.setItem("hb_k_toast", "Rozdělení etap je uložené."); } catch (e) {}
      location.href = a.href;
    } catch (err) { a.classList.remove("k-nav-uklada"); HBK.hlaska("k-stav", err.message, true); window.scrollTo(0, 0); }
  }, true);

  window.addEventListener("beforeunload", function (ev) { if (lzeUkladat() && zmeneno()) { ev.preventDefault(); ev.returnValue = ""; } });

  async function nacti() {
    var v = await Promise.all([HBK.rpc("web_k_prehled"), HBK.rpc("web_k_etapy"), HBK.rpc("web_k_soupiska")]);
    P = v[0]; ETAPY = v[1] || []; BEZCI = v[2] || [];
    // podrobnosti etap ze stejného zdroje jako stránky Trasa a etapy
    try {
      TRASA = {};
      (await HBK.db("web_v_trasa?select=cislo,nazev,start_nazev,cil_nazev,delka_km,prevyseni_m,klesani_m,povrch&rok=eq." + encodeURIComponent(P.rocnik)) || [])
        .forEach(function (r) { TRASA[r.cislo] = r; });
    } catch (err) { TRASA = {}; }
    VYBER = {}; ETAPY.forEach(function (x) { if (x.soupiska_id) VYBER[x.etapa] = x.soupiska_id; });
    ULOZENO = otisk();
  }

  document.addEventListener("DOMContentLoaded", async function () {
    P = await HBK.vyzadovat(); if (!P) return;
    try { await nacti(); } catch (err) { document.getElementById("k-obsah").innerHTML = '<p class="k-chyba">' + e(err.message) + "</p>"; return; }
    vykresli();
  });
})();

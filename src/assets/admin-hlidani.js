// Hlídání závodu – neveřejná stránka administrace, jen pro admina (Keksa 6. 10. 2026). Maily se neposílají.
// Data: RPC web_hlidani_data (výsledková data všech týmů + zápisy z předávek uložené přes varování nebo opravené).
// Počítá se tady, ze stejného modelu jako online výsledky (vysledky-model.js, metoda C):
//  • zpožděné týmy – pozadu za živým odhadem víc než práh (Nastavení: Hlídání: zpoždění týmu od, výchozí 20 min;
//    zpětný test HB24–HB26: 11–21 hlášení za závod),
//  • pozdní doběh – odhad cíle po zavření cíle (Nastavení: cil_zavren, neděle),
//  • čelo – náskok prvního týmu před dalším (od 45 min se zvýrazní),
//  • zápisy z předávek uložené přes varování a opravy týmů – k prověření,
//  • nelogické časy (záporná etapa), odstoupené týmy (DNF, tlačítko Odstoupil / Vrátit do závodu),
//  • hromadné zkoušení kódů předávek (od 50 chybných kódů za 10 minut; 6. 10. 2026).
// Samostatné „ticho 120 min“ se nehlídá: v HB26 by nevzniklo ani jednou, zpoždění ho pokryje.
// Ukázka na HB26: ?ukazka=hb26&cas=<unix sekundy>.
(function () {
  var Q = new URLSearchParams(location.search), UKAZKA = Q.get("ukazka") === "hb26";
  var el, data = null, ted = null, nacteno = null, ptam = null, hlaska = "";
  function esc(s) { return HBA.esc(s); }
  var F_HM = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" });
  var F_HMS = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  var F_DEN = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", weekday: "short" });
  function hm(s) { return s == null ? "" : F_HM.format(new Date(s * 1000)); }
  function denHm(s) { return s == null ? "" : F_DEN.format(new Date(s * 1000)) + " " + hm(s); }
  function hms(iso) { return iso ? F_HMS.format(new Date(iso)) : ""; }
  function misto(c) { var m = (data.mista || [])[c - 1]; return m ? m[1] : ""; }
  function P(c) { return "P" + c + " " + misto(c); }
  function min(s) { return Math.round(s / 60); }
  function tym(t) { return '<strong>' + esc(t.c != null ? t.c : "–") + "</strong> " + esc(t.n); }

  function cilZavren() {
    var d = data.datum_zavodu, h = data.cil_zavren || "18:00";
    if (!d) return null;
    var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); // cíl se zavírá v neděli
    var den = x.toISOString().slice(0, 10);
    return Math.floor(Date.parse(den + "T" + h.slice(0, 5) + ":00+02:00") / 1000);
  }

  function vykresli() {
    var model = HBVysl.spocitej(data, ted), tymy = model.tymy, prah = (data.prah_min || 20) * 60;
    var naTrati = tymy.filter(function (t) { return t.bezi; }), vCili = tymy.filter(function (t) { return t.cil != null; });
    var predStartem = tymy.filter(function (t) { return !t.dnf && (t.s == null || ted < t.s); });
    var odstoupili = model.odstoupili;
    var h = '<p class="hl-souhrn">Teď ' + denHm(ted) + " · na trati " + naTrati.length + " · v cíli " + vCili.length +
      " · před startem " + predStartem.length + (odstoupili.length ? " · odstoupilo " + odstoupili.length : "") +
      (data.chybne_kody ? " · chybné kódy za 10 min " + data.chybne_kody : "") + (data.posledni_zapis ? " · poslední zápis z předávky " + hms(data.posledni_zapis) : "") +
      (UKAZKA ? " · <em>ukázka HB26</em>" : ' · <span class="adm-sub">načteno ' + F_HMS.format(new Date(nacteno)) + "</span>") + "</p>";
    if (hlaska) h += '<p class="hl-hlaska">' + esc(hlaska) + "</p>";
    if (data.zadosti_cas) h += '<section class="hl-blok hl-pozor"><h2>Žádosti o opravu času: ' + data.zadosti_cas + ' čeká</h2><p>Kapitáni nebo zástupci žádají o opravu času. ' +
      '<a href="' + HB.zaklad + '/admin/zadosti-casu/">Otevřít žádosti</a></p></section>';
    if ((data.chybne_kody || 0) >= 50) h += '<section class="hl-blok hl-pozor"><h2>Hromadné zkoušení kódů předávek</h2><p>Za posledních 10 minut ' +
      data.chybne_kody + " chybných kódů z " + (data.chybne_kody_ip || "?") + " adres. Někdo možná zkouší kódy. Sleduj zápisy z předávek níže.</p></section>";

    // 1) zpožděné týmy
    var zpozdene = naTrati.filter(function (t) { var e = t.E[t.bezi - 1]; return e.zpozdeni > prah; })
      .sort(function (a, b) { return b.E[b.bezi - 1].zpozdeni - a.E[a.bezi - 1].zpozdeni; });
    h += '<section class="hl-blok' + (zpozdene.length ? " hl-pozor" : "") + '"><h2>Zpožděné týmy (' + zpozdene.length + ")</h2>" +
      '<p class="adm-sub">Pozadu za živým odhadem víc než ' + (prah / 60) + " min. Zavolej na předávku nebo kapitánovi.</p>";
    if (zpozdene.length) {
      h += '<table class="hl-tab"><thead><tr><th>Tým</th><th>Běží na</th><th>Běžec</th><th>Čekal se</th><th>Pozadu</th><th>Naposledy</th><th></th></tr></thead><tbody>' +
        zpozdene.map(function (t) {
          var e = t.E[t.bezi - 1], posl = t.posledni ? t.E[t.posledni - 1].dobeh : t.s;
          return "<tr><td>" + tym(t) + "</td><td>" + esc(P(t.bezi + 1)) + "</td><td>" + esc(e.jm) + "</td><td>≈ " + hm(ted - e.zpozdeni) +
            '</td><td class="hl-cislo">' + min(e.zpozdeni) + " min</td><td>" + (t.posledni ? esc(P(t.posledni + 1)) : "start") + " " + hm(posl) + "</td><td>" +
            (UKAZKA ? "" : dnfAkce(t, t.bezi)) + "</td></tr>";
        }).join("") + "</tbody></table>";
    } else h += "<p>Nikdo.</p>";
    h += "</section>";

    // 2) pozdní doběh
    var zav = cilZavren();
    var pozde = zav ? tymy.filter(function (t) { return t.cil == null && t.E[29].odhad && t.E[29].odhad > zav; })
      .sort(function (a, b) { return b.E[29].odhad - a.E[29].odhad; }) : [];
    h += '<section class="hl-blok' + (pozde.length ? " hl-pozor" : "") + '"><h2>Nestihnou zavření cíle (' + pozde.length + ")</h2>" +
      '<p class="adm-sub">Odhad doběhu do cíle po ' + (zav ? denHm(zav) : "zavření cíle (nastav cil_zavren a datum závodu)") + ".</p>";
    h += pozde.length ? '<table class="hl-tab"><thead><tr><th>Tým</th><th>Teď</th><th>Odhad cíle</th><th>Po zavření</th></tr></thead><tbody>' +
      pozde.map(function (t) {
        return "<tr><td>" + tym(t) + "</td><td>" + (t.bezi ? "běží na " + esc(P(t.bezi + 1)) : "před startem") + "</td><td>≈ " + denHm(t.E[29].odhad) +
          '</td><td class="hl-cislo">' + min(t.E[29].odhad - zav) + " min</td></tr>";
      }).join("") + "</tbody></table>" : "<p>Nikdo.</p>";
    h += "</section>";

    // 3) čelo závodu
    var vedouci = tymy.filter(function (t) { return t.posledni > 0 && !t.dnf; }).sort(function (a, b) {
      return b.posledni - a.posledni || a.E[a.posledni - 1].dobeh - b.E[b.posledni - 1].dobeh; })[0];
    h += '<section class="hl-blok"><h2>Čelo závodu</h2>';
    if (vedouci) {
      var k = vedouci.posledni, prichod = vedouci.E[k - 1].dobeh, dalsi = null;
      tymy.forEach(function (t) {
        if (t === vedouci || t.dnf) return;
        var x = t.E[k - 1], c = x.dobeh != null ? x.dobeh : x.odhad;
        if (c != null && (!dalsi || c < dalsi.c)) dalsi = { t: t, c: c, odhad: x.dobeh == null };
      });
      var naskok = dalsi ? dalsi.c - prichod : null;
      h += "<p" + (naskok != null && naskok >= 45 * 60 ? ' class="hl-pozor-text"' : "") + ">" + tym(vedouci) + " prošel " + esc(P(k + 1)) + " v " + hm(prichod) +
        (dalsi ? ", další " + tym(dalsi.t) + (dalsi.odhad ? " ≈ " : " v ") + hm(dalsi.c) + " – náskok " + min(naskok) + " min" +
          (naskok >= 45 * 60 ? ". <strong>Čelo utíká – ověř, že na dalších předávkách už někdo je.</strong>" : ".") : ".") + "</p>";
    } else h += "<p>Zatím žádný zapsaný čas.</p>";
    h += "</section>";

    // 3b) nelogické časy
    var nelog = tymy.filter(function (t) { return t.nelogicke.length; });
    h += '<section class="hl-blok' + (nelog.length ? " hl-pozor" : "") + '"><h2>Nelogické časy (' + nelog.length + ")</h2>" +
      '<p class="adm-sub">Doběh je dřív než příchod na předchozí předávku – nejspíš překlep nebo prohozené týmy. Oprav v sekci Časy.</p>';
    h += nelog.length ? "<ul>" + nelog.map(function (t) {
      return "<li>" + tym(t) + ": " + t.nelogicke.map(function (i) { return "úsek P" + i + " → P" + (i + 1) + " (" + esc(misto(i + 1)) + ")"; }).join(", ") + "</li>";
    }).join("") + "</ul>" : "<p>Žádné.</p>";
    h += "</section>";

    // 3c) odstoupené týmy
    h += '<section class="hl-blok"><h2>Odstoupené týmy (' + odstoupili.length + ")</h2>" +
      '<p class="adm-sub">Na webu jsou na konci pořadí se značkou DNF, Hlídání je nehlásí a předávky je nevyhlížejí.</p>';
    h += odstoupili.length ? '<table class="hl-tab"><thead><tr><th>Tým</th><th>Odstoupil na úseku</th><th>Poslední čas</th><th></th></tr></thead><tbody>' +
      odstoupili.map(function (t) {
        var k = Math.min(t.posledni, t.dnf - 1);
        return "<tr><td>" + tym(t) + "</td><td>P" + t.dnf + " → P" + (t.dnf + 1) + " " + esc(misto(t.dnf + 1)) + "</td><td>" +
          (k ? esc(P(k + 1)) + " " + hm(t.E[k - 1].dobeh) : "–") + "</td><td>" + (UKAZKA ? "" : dnfAkce(t, null)) + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p>Nikdo.</p>";
    h += "</section>";

    // 4) zápisy přes varování a opravy
    var zapisy = data.zapisy || [];
    h += '<section class="hl-blok"><h2>Zápisy z předávek k prověření (' + zapisy.length + ")</h2>" +
      '<p class="adm-sub">Uložené přes varování nebo opravené na předávce. Opravu času udělej v sekci Časy.</p>';
    h += zapisy.length ? '<table class="hl-tab"><thead><tr><th>Zapsáno</th><th>Předávka</th><th>Tým</th><th>Čas</th><th>Platí</th><th>Poznámka</th></tr></thead><tbody>' +
      zapisy.map(function (z) {
        return "<tr" + (z.plati ? "" : ' class="hl-neplati"') + "><td>" + hms(z.zapsano) + "</td><td>" + esc(P(z.etapa + 1)) + "</td><td>" +
          tym(z) + "</td><td>" + hms(z.cas) + "</td><td>" + (z.plati ? "ano" : "ne") + "</td><td>" + esc(z.poznamka) + "</td></tr>";
      }).join("") + "</tbody></table>" : "<p>Žádné.</p>";
    h += "</section>";
    el.innerHTML = h;
  }

  // tlačítko Odstoupil / Vrátit do závodu s potvrzením přímo na stránce
  function dnfAkce(t, etapa) {
    var klic = t.id + ":" + (etapa || "");
    if (ptam === klic) return '<span class="hl-ptam">' + (etapa ? "Zapsat tým " + esc(t.c) + " jako odstoupený na úseku P" + etapa + " → P" + (etapa + 1) + "?" :
      "Vrátit tým " + esc(t.c) + " do závodu?") + ' <button type="button" class="adm-tlacitko adm-tlacitko-male" data-dnf-ano="' + klic + '">' + (etapa ? "Ano, odstoupil" : "Ano, vrátit") +
      '</button> <button type="button" class="adm-tlacitko adm-tlacitko-male" data-dnf-ne="1">Ne</button></span>';
    return '<button type="button" class="adm-tlacitko adm-tlacitko-male" data-dnf="' + klic + '">' + (etapa ? "Odstoupil" : "Vrátit do závodu") + "</button>";
  }
  async function nacti() {
    if (UKAZKA) {
      data = await (await fetch(HB.zaklad + "/assets/ukazka-hb26.json")).json();
      data.prah_min = 20; data.zapisy = [];
      ted = Number(Q.get("cas")) || Math.round((data.tymy[0].s + 12 * 3600) / 300) * 300;
    } else {
      data = await HBA.rpc("web_hlidani_data", {});
      ted = Math.floor(Date.parse(data.ted) / 1000);
    }
    nacteno = Date.now();
    vykresli();
  }

  document.addEventListener("DOMContentLoaded", async function () {
    el = document.getElementById("hl-obsah");
    el.addEventListener("click", async function (ev) {
      var b = ev.target.closest("[data-dnf]");
      if (b) { ptam = b.getAttribute("data-dnf"); vykresli(); return; }
      if (ev.target.closest("[data-dnf-ne]")) { ptam = null; vykresli(); return; }
      b = ev.target.closest("[data-dnf-ano]");
      if (b) {
        var x = b.getAttribute("data-dnf-ano").split(":"); b.disabled = true;
        try {
          var r = await HBA.rpc("web_tym_dnf", { p_tym: Number(x[0]), p_etapa: x[1] ? Number(x[1]) : null });
          hlaska = r.dnf_etapa ? "Tým " + r.c + " je zapsaný jako odstoupený." : "Tým " + r.c + " je zpátky v závodě.";
          ptam = null; await nacti();
        } catch (e) { hlaska = e.message || String(e); ptam = null; vykresli(); }
      }
    });
    var j = await HBA.vyzadovat(); if (!j) return;
    try { await nacti(); } catch (e) { el.innerHTML = '<p class="adm-chyba">' + esc(e.message || e) + "</p>"; return; }
    if (!UKAZKA) setInterval(function () { if (!document.hidden) nacti().catch(function () {}); }, 60000);
  });
})();

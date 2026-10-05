// Kapitánská sekce – krok 2: soupiska. Jen tabulka běžců, tlačítko „Přidat běžce“ a upozornění na chybějící údaje.
// Přidání a úprava běžce mají vlastní stránky (Kdo poběží? → Údaje běžce), Keksa 4. 10. 2026.
(function () {
  var e = HBK.esc;
  var P = null, RADKY = [], KRAJE = [];
  var POHLAVI = { zena: "žena", muz: "muž", jine: "jiné" };

  function kraj(kod) { var k = KRAJE.filter(function (x) { return x.kod === kod; })[0]; return k ? k.nazev : (kod || ""); }
  function neuplny(r) { return !r.rok_narozeni || !r.pohlavi || !r.kraj || !r.mesto || !r.velikost || !r.vykonnost_10km; }

  function tabulka() {
    var vede = P.role !== "bezec", otevreno = P.soupiska_otevrena;
    if (!RADKY.length) return '<p class="prazdno">Na soupisce zatím nikdo není.</p>';
    return '<div class="k-tabulka-obal"><table class="k-tabulka"><thead><tr>' +
      "<th>Číslo</th><th>Jméno</th>" + (vede ? "<th>Kontakt</th>" : "") +
      "<th>Rok narození</th><th>Pohlaví</th><th>Kraj, město</th><th>Velikost trička</th><th>Čas na 10 km</th><th>Etapy</th><th></th></tr></thead><tbody>" +
      RADKY.map(function (r) {
        var akce = "";
        if (otevreno && r.muzu_upravit) akce += '<a class="k-vedlejsi" href="' + HB.zaklad + "/kapitan/bezec/udaje/?id=" + r.soupiska_id + '">' + (neuplny(r) ? "Doplnit" : "Upravit") + "</a>";
        if (otevreno && vede && !P.pocet_potvrzen) akce += '<button type="button" class="k-vedlejsi" data-odebrat="' + r.soupiska_id + '">Odebrat</button>';
        return '<tr data-radek="' + r.soupiska_id + '"' + (neuplny(r) ? ' class="k-neuplny" title="Chybí povinné údaje, doplň je"' : "") + '><td class="k-cislo">' + e(r.startovni_cislo) + "</td><td>" +
          e(r.jmeno + " " + r.prijmeni) + (r.jsem_to_ja ? " <small>(ty)</small>" : "") + "</td>" +
          (vede ? '<td class="k-zalom">' + e(r.email || "") + (r.telefon ? '<br><span class="k-nezalom">' + e(r.telefon) + "</span>" : "") + "</td>" : "") +
          "<td>" + e(r.rok_narozeni || "") + "</td><td>" + e(POHLAVI[r.pohlavi] || "") + "</td>" +
          "<td>" + e([kraj(r.kraj), r.mesto].filter(Boolean).join(", ")) + "</td>" +
          "<td>" + e(r.velikost ? r.velikost_rada + " " + r.velikost : "") + "</td>" +
          '<td class="k-cislo">' + e(HBK.vykonnost(r.vykonnost_10km)) + "</td>" +
          "<td>" + e((r.etapy || []).join(", ")) + '</td><td class="k-akce-bunka">' + akce + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function vykresli(hlaska, chyba) {
    var vede = P.role !== "bezec";
    var h = ['<p class="k-hlaska" id="k-stav" role="status"></p>'];
    h.push('<p class="pocet">Na soupisce ' + RADKY.length + " z nejvýš " + e(P.max_bezcu) + " běžců. " +
      (P.soupiska_otevrena ? (P.soupiska_do ? "Změny jdou do " + e(HBK.cas(P.soupiska_do)) + "." : "")
                           : "<b>Soupiska je uzavřená.</b> Změny řeší pořadatel na info@horybory.cz.") + "</p>");
    h.push(tabulka());
    if (vede && P.soupiska_otevrena) {
      if (P.pocet_potvrzen) h.push('<p class="k-pozn">Konečný počet máš potvrzený, takže běžce nepřidáš ani neodebereš. Změníš ho v kroku ' +
        '<a href="' + HB.zaklad + '/kapitan/pocet/">Konečný počet</a>. Údaje běžců upravit můžeš.</p>');
      else if (RADKY.length >= P.max_bezcu) h.push('<p class="k-pozn">Soupiska je plná (' + e(P.max_bezcu) + " běžců).</p>");
      else h.push('<div class="k-akce k-akce-hlavni"><a class="k-tlacitko k-tlacitko-s-napovedou" href="' + HB.zaklad + '/kapitan/bezec/">+ Přidat běžce' +
        "<small>Vybereš někoho z minulých ročníků, nebo zadáš nového.</small></a></div>");
    }
    var u = (P.upozorneni || []).filter(function (x) { return ["neuplne", "vykonnost_mimo", "kulate", "bez_vykonnosti", "zensky_tym"].indexOf(x.druh) >= 0; });
    if (u.length) h.push('<div class="k-karta"><h2>Zkontroluj</h2><ul class="k-upozorneni">' + u.map(function (x) { return "<li>" + e(x.text) + "</li>"; }).join("") + "</ul></div>");
    document.getElementById("k-obsah").innerHTML = h.join("");
    if (hlaska) HBK.hlaska("k-stav", hlaska, chyba);
  }

  function zvyrazni(id, text) {
    var tr = id && document.querySelector('tr[data-radek="' + id + '"]');
    if (tr) { tr.classList.add("k-zmeneno"); tr.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(function () { tr.classList.remove("k-zmeneno"); }, 3000); }
    if (text) HBK.toast(text);
  }

  async function obnov(hlaska) {
    var v = await Promise.all([HBK.rpc("web_k_prehled"), HBK.rpc("web_k_soupiska")]);
    P = v[0]; RADKY = v[1] || [];
    vykresli(); HBK.kroky(P);
    if (hlaska) HBK.toast(hlaska);
  }

  document.addEventListener("click", async function (ev) {
    var t = ev.target; if (!t || !t.dataset || !t.dataset.odebrat) return;
    var r = RADKY.filter(function (x) { return x.soupiska_id === Number(t.dataset.odebrat); })[0];
    if (!r || !confirm("Odebrat " + r.jmeno + " " + r.prijmeni + " ze soupisky? Jeho etapy se uvolní.")) return;
    try {
      var v = await HBK.rpc("web_k_odeber_bezce", { p_soupiska: r.soupiska_id });
      await obnov(r.jmeno + " " + r.prijmeni + " už na soupisce není." + (v.uvolnene_etapy && v.uvolnene_etapy.length
        ? " Uvolněné etapy: " + v.uvolnene_etapy.join(", ") + "." : ""));
    } catch (err) { HBK.hlaska("k-stav", err.message, true); window.scrollTo(0, 0); }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    P = await HBK.vyzadovat(); if (!P) return;
    try {
      var v = await Promise.all([HBK.rpc("web_k_soupiska"), HBK.db("web_kraj?select=kod,nazev&aktivni=eq.true&order=poradi")]);
      RADKY = v[0] || []; KRAJE = v[1] || [];
    } catch (err) { document.getElementById("k-obsah").innerHTML = '<p class="k-chyba">' + e(err.message) + "</p>"; return; }
    vykresli();
    var x = HBK.prevezmiHlasku(); if (x) zvyrazni(x.id, x.text);
  });
})();

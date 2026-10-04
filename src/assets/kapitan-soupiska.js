// Kapitánská sekce – soupiska. Kapitán a zástupce přidávají, upravují a odebírají běžce,
// běžec upravuje jen své údaje (e-mail ne). Kontroly a hlášky jsou v databázi (web_k_*).
(function () {
  var e = HBK.esc;
  var P = null, RADKY = [], KRAJE = [], VELIKOSTI = [], UPRAVUJI = null;
  var POHLAVI = { zena: "žena", muz: "muž", jine: "jiné" };

  function kraj(kod) { var k = KRAJE.filter(function (x) { return x.kod === kod; })[0]; return k ? k.nazev : (kod || ""); }

  function tabulka() {
    var vede = P.role !== "bezec", otevreno = P.soupiska_otevrena;
    if (!RADKY.length) return '<p class="prazdno">Na soupisce zatím nikdo není.</p>';
    return '<div class="k-tabulka-obal"><table class="k-tabulka"><thead><tr>' +
      "<th>Číslo</th><th>Jméno</th>" + (vede ? "<th>E-mail</th><th>Telefon</th>" : "") +
      "<th>Rok</th><th>Pohlaví</th><th>Kraj, město</th><th>Velikost</th><th>10 km</th><th>Etapy</th><th></th></tr></thead><tbody>" +
      RADKY.map(function (r) {
        var akce = "";
        if (otevreno && r.muzu_upravit) akce += '<button type="button" class="k-vedlejsi" data-upravit="' + r.soupiska_id + '">Upravit</button> ';
        if (otevreno && vede && !P.pocet_potvrzen) akce += '<button type="button" class="k-vedlejsi" data-odebrat="' + r.soupiska_id + '">Odebrat</button>';
        return "<tr><td class=\"k-cislo\">" + e(r.startovni_cislo) + "</td><td>" + e(r.jmeno + " " + r.prijmeni) + (r.jsem_to_ja ? " <small>(ty)</small>" : "") + "</td>" +
          (vede ? "<td>" + e(r.email || "") + "</td><td>" + e(r.telefon || "") + "</td>" : "") +
          "<td>" + e(r.rok_narozeni || "") + "</td><td>" + e(POHLAVI[r.pohlavi] || "") + "</td>" +
          "<td>" + e([kraj(r.kraj), r.mesto].filter(Boolean).join(", ")) + "</td>" +
          "<td>" + e(r.velikost ? r.velikost_rada + " " + r.velikost : "") + "</td>" +
          '<td class="k-cislo">' + e(HBK.vykonnost(r.vykonnost_10km)) + "</td>" +
          "<td>" + e((r.etapy || []).join(", ")) + "</td><td>" + akce + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function formular(r) {
    var nova = !r, ja = r && r.jsem_to_ja && P.role === "bezec";
    r = r || {};
    function vyber(id, moznosti, hodnota) {
      return '<select id="' + id + '"><option value="">— vyber —</option>' + moznosti.map(function (m) {
        return '<option value="' + e(m[0]) + '"' + (m[0] === hodnota ? " selected" : "") + ">" + e(m[1]) + "</option>"; }).join("") + "</select>";
    }
    return '<form class="k-karta" id="k-form" novalidate><h2>' + (nova ? "Přidat běžce" : "Upravit: " + e(r.jmeno + " " + r.prijmeni)) + "</h2>" +
      '<div class="k-formular">' +
      '<label class="k-pole" for="f-jmeno">Jméno *<input id="f-jmeno" value="' + e(r.jmeno || "") + '" required></label>' +
      '<label class="k-pole" for="f-prijmeni">Příjmení *<input id="f-prijmeni" value="' + e(r.prijmeni || "") + '" required></label>' +
      '<label class="k-pole" for="f-email">E-mail *<input id="f-email" type="email" value="' + e(r.email || "") + '"' + (ja ? " disabled" : "") + ' required>' +
        (ja ? "<small>E-mail změní kapitán.</small>" : "<small>Na něj přijde běžci odkaz do sekce.</small>") + "</label>" +
      '<label class="k-pole" for="f-telefon">Telefon *<input id="f-telefon" type="tel" value="' + e(r.telefon || "") + '" placeholder="777 123 456" required></label>' +
      '<label class="k-pole" for="f-rok">Rok narození<input id="f-rok" inputmode="numeric" value="' + e(r.rok_narozeni || "") + '" placeholder="1990"></label>' +
      '<label class="k-pole" for="f-pohlavi">Pohlaví' + vyber("f-pohlavi", [["zena", "žena"], ["muz", "muž"], ["jine", "jiné"]], r.pohlavi) + "</label>" +
      '<label class="k-pole" for="f-kraj">Kraj' + vyber("f-kraj", KRAJE.map(function (k) { return [k.kod, k.nazev]; }), r.kraj) + "</label>" +
      '<label class="k-pole" for="f-mesto">Město<input id="f-mesto" value="' + e(r.mesto || "") + '"></label>' +
      '<label class="k-pole" for="f-velikost">Velikost trička' + vyber("f-velikost", VELIKOSTI.map(function (v) { return [v.rada + "|" + v.kod, v.rada + " " + v.kod]; }),
        r.velikost ? r.velikost_rada + "|" + r.velikost : "") + "</label>" +
      '<label class="k-pole" for="f-vykonnost">Čas na 10 km<input id="f-vykonnost" value="' + e(HBK.vykonnost(r.vykonnost_10km)) + '" placeholder="52:30">' +
        "<small>Minuty:sekundy, např. 52:30, nebo 1:02:30.</small></label>" +
      '<label class="k-pole" for="f-poznamka">Poznámka<input id="f-poznamka" value="' + e(r.poznamka || "") + '"></label>' +
      "</div>" +
      '<div class="k-akce"><button type="submit" class="k-tlacitko">' + (nova ? "Přidat na soupisku" : "Uložit změny") + "</button>" +
      (nova ? "" : '<button type="button" class="k-vedlejsi" id="k-zrusit">Zrušit úpravu</button>') + "</div>" +
      '<p class="k-hlaska" id="k-hlaska" role="status"></p></form>';
  }

  // 1 běžec / 2–4 běžci / 5 běžců; ve 4. pádě 1 běžce / 2–4 běžce / 5 běžců
  function bezcu(n, akuz) { return n + " " + (n === 1 ? (akuz ? "běžce" : "běžec") : n >= 2 && n <= 4 ? (akuz ? "běžce" : "běžci") : "běžců"); }

  // Konečný počet běžců (Keksa 4. 10. 2026): kapitán nebo zástupce potvrdí, že počet jmen na soupisce je konečný.
  // Po potvrzení nejde přidat ani odebrat běžce, dokud potvrzení nezruší. Údaje (i jméno při náhradě) upravit jde dál.
  function pocetKarta() {
    var vede = P.role !== "bezec", n = RADKY.length, h = '<div class="k-karta"><h2>Konečný počet běžců</h2>';
    if (P.pocet_potvrzen) {
      h += '<p><span class="k-stitek k-stitek-ok">potvrzeno</span> ' + e(bezcu(Number(P.pocet_konecny))) + ", " + e(HBK.cas(P.pocet_potvrzen)) + "</p>";
      if (vede) h += '<p class="pocet">Běžce teď nepřidáš ani neodebereš. Jméno a údaje běžce upravit můžeš, třeba když za někoho nastupuje náhradník.</p>' +
        (P.soupiska_otevrena ? '<div class="k-akce"><button type="button" class="k-vedlejsi" id="k-zmenit-pocet">Změnit počet</button></div>' : "");
    } else if (!vede) {
      h += "<p>Kapitán ho zatím nepotvrdil.</p>";
    } else if (!P.soupiska_otevrena) {
      h += "<p>Počet nebyl potvrzený a soupiska je uzavřená.</p>";
    } else if (!n) {
      h += "<p>Potvrdit půjde, až bude na soupisce aspoň jeden běžec.</p>";
    } else {
      h += "<p>Na soupisce " + (n >= 2 && n <= 4 ? "jsou " : "je ") + e(bezcu(n)) + ". Až budeš vědět, že tvůj tým poběží právě v tomhle složení, potvrď to. " +
        "Pak už běžce nepřidáš ani neodebereš, dokud potvrzení nezrušíš. Údaje běžců upravovat můžeš dál" +
        (P.soupiska_do ? ", změnit počet jde do " + e(HBK.cas(P.soupiska_do)) : "") + ".</p>" +
        '<div class="k-akce"><button type="button" class="k-tlacitko" id="k-potvrdit-pocet">Potvrdit konečný počet: ' + e(bezcu(n)) + "</button></div>";
    }
    return h + '<p class="k-hlaska" id="k-hlaska-pocet" role="status"></p></div>';
  }

  function vykresli(hlaska, chyba) {
    var vede = P.role !== "bezec";
    var h = ['<p class="k-hlaska" id="k-stav" role="status"></p>'];
    h.push('<p class="pocet">Na soupisce ' + RADKY.length + " z nejvýš " + e(P.max_bezcu) + " běžců. " +
      (P.soupiska_otevrena ? (P.soupiska_do ? "Změny jdou do " + e(HBK.cas(P.soupiska_do)) + "." : "")
                           : "<b>Soupiska je uzavřená.</b> Změny řeší pořadatel na info@horybory.cz.") + "</p>");
    h.push(tabulka());
    h.push(pocetKarta());
    var u = (P.upozorneni || []).filter(function (x) { return ["vykonnost_mimo", "kulate", "bez_vykonnosti", "zensky_tym", "bez_etapy"].indexOf(x.druh) >= 0; });
    if (u.length) h.push('<div class="k-karta"><h2>Zkontroluj</h2><ul class="k-upozorneni">' + u.map(function (x) { return "<li>" + e(x.text) + "</li>"; }).join("") + "</ul></div>");
    if (P.soupiska_otevrena) {
      var r = UPRAVUJI ? RADKY.filter(function (x) { return x.soupiska_id === UPRAVUJI; })[0] : null;
      if (r) h.push(formular(r));
      else if (vede && RADKY.length < P.max_bezcu && !P.pocet_potvrzen) h.push(formular(null));
    }
    h.push('<div class="k-karta k-text" id="k-proc"></div>');
    document.getElementById("k-obsah").innerHTML = h.join("");
    if (hlaska) HBK.hlaska("k-stav", hlaska, chyba);
    nactiText();
  }

  var TEXT = null;
  async function nactiText() {
    var el = document.getElementById("k-proc"); if (!el) return;
    if (TEXT === null) {
      try {
        var t = await HBK.db("web_texty?select=web_texty_preklady(titulek,obsah,jazyk)&kod=eq.kapitan_vykonnost_proc");
        var p = (t[0] && t[0].web_texty_preklady || []).filter(function (x) { return x.jazyk === "cs"; })[0];
        TEXT = p ? "<h2>" + e(p.titulek) + "</h2>" + p.obsah : "";
      } catch (err) { TEXT = ""; }
    }
    if (TEXT) el.innerHTML = TEXT; else el.remove();   // text je z redakce webu (web_texty), proto jako HTML
  }

  async function obnov(hlaska, chyba) {
    var v = await Promise.all([HBK.rpc("web_k_prehled"), HBK.rpc("web_k_soupiska")]);
    P = v[0]; RADKY = v[1] || [];
    vykresli(hlaska, chyba);
  }

  function hodnota(id) { var el = document.getElementById(id); return el && !el.disabled ? el.value.trim() : null; }

  document.addEventListener("submit", async function (ev) {
    if (ev.target.id !== "k-form") return;
    ev.preventDefault();
    var b = ev.target.querySelector("button[type=submit]"); b.disabled = true;
    var vel = hodnota("f-velikost") || "", rok = hodnota("f-rok");
    if (rok && !/^\d{4}$/.test(rok)) { HBK.hlaska("k-hlaska", "Rok narození napiš čtyřmi číslicemi, např. 1990.", true); b.disabled = false; return; }
    var data = {
      p_jmeno: hodnota("f-jmeno"), p_prijmeni: hodnota("f-prijmeni"), p_email: hodnota("f-email"), p_telefon: hodnota("f-telefon"),
      p_rok_narozeni: rok ? Number(rok) : null, p_pohlavi: hodnota("f-pohlavi"), p_kraj: hodnota("f-kraj"), p_mesto: hodnota("f-mesto"),
      p_velikost_rada: vel ? vel.split("|")[0] : "", p_velikost: vel ? vel.split("|")[1] : "",
      p_vykonnost: hodnota("f-vykonnost"), p_poznamka: hodnota("f-poznamka")
    };
    try {
      if (UPRAVUJI) {
        data.p_soupiska = UPRAVUJI;
        await HBK.rpc("web_k_uprav_bezce", data);
        UPRAVUJI = null;
        await obnov("Uloženo.");
      } else {
        if (!data.p_vykonnost) data.p_vykonnost = null;
        await HBK.rpc("web_k_pridej_bezce", data);
        await obnov("Běžec je na soupisce.");
      }
    } catch (err) { HBK.hlaska("k-hlaska", err.message, true); b.disabled = false; }
  });

  document.addEventListener("click", async function (ev) {
    var t = ev.target; if (!t) return;
    if (t.dataset && t.dataset.upravit) { UPRAVUJI = Number(t.dataset.upravit); vykresli(); document.getElementById("k-form").scrollIntoView({ behavior: "smooth" }); }
    if (t.id === "k-zrusit") { UPRAVUJI = null; vykresli(); }
    if (t.id === "k-potvrdit-pocet") {
      t.disabled = true;
      try { await HBK.rpc("web_k_potvrd_pocet"); await obnov("Konečný počet běžců je potvrzený."); }
      catch (err) { HBK.hlaska("k-hlaska-pocet", err.message, true); t.disabled = false; }
    }
    if (t.id === "k-zmenit-pocet") {
      if (!confirm("Zrušit potvrzení konečného počtu? Pokud máš potvrzenou i soupisku a etapy, zruší se i to.")) return;
      t.disabled = true;
      try { await HBK.rpc("web_k_zrus_potvrzeni_poctu"); await obnov("Potvrzení počtu je zrušené. Teď můžeš běžce přidat nebo odebrat."); }
      catch (err) { HBK.hlaska("k-hlaska-pocet", err.message, true); t.disabled = false; }
    }
    if (t.dataset && t.dataset.odebrat) {
      var r = RADKY.filter(function (x) { return x.soupiska_id === Number(t.dataset.odebrat); })[0];
      if (!r || !confirm("Odebrat " + r.jmeno + " " + r.prijmeni + " ze soupisky? Jeho etapy se uvolní.")) return;
      try {
        var v = await HBK.rpc("web_k_odeber_bezce", { p_soupiska: r.soupiska_id });
        await obnov(r.jmeno + " " + r.prijmeni + " už na soupisce není." + (v.uvolnene_etapy && v.uvolnene_etapy.length
          ? " Uvolněné etapy: " + v.uvolnene_etapy.join(", ") + ". Rozděl je na stránce Etapy." : ""));
      } catch (err) { alert(err.message); }
    }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    P = await HBK.vyzadovat(); if (!P) return;
    try {
      var v = await Promise.all([
        HBK.rpc("web_k_soupiska"),
        HBK.db("web_kraj?select=kod,nazev&aktivni=eq.true&order=poradi"),
        HBK.db("velikosti?select=rada,kod,poradi&aktivni=eq.true&order=rada,poradi")
      ]);
      RADKY = v[0] || []; KRAJE = v[1] || []; VELIKOSTI = v[2] || [];
    } catch (err) { document.getElementById("k-obsah").innerHTML = '<p class="k-chyba">' + e(err.message) + "</p>"; return; }
    vykresli();
  });
})();

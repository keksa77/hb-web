// Etapy a předávky – řádek = předávka N, na které začíná etapa N. Řádek 31 je cíl.
// Délka, převýšení a koeficient patří k etapě, která z předávky vychází.
// Zápis jde přes web_uprav_etapu, aby databáze hlídala, co se smí měnit a v jakém formátu.
(function () {
  var e = HBA.esc;
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }
  function hhmm(t) { return t ? String(t).slice(0, 5) : ""; }
  // Úprava jednoho pole: pošle se rok, číslo, název pole a napsaná hodnota.
  function pole(nazev, hodnoty) {
    return { klic: "rok", hodnoty: hodnoty, ulozit: function (r, v) {
      return HBA.rpc("web_uprav_etapu", { p_rok: r.rok, p_cislo: r.cislo, p_pole: nazev, p_hodnota: v == null ? "" : String(v) });
    } };
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "etapy",
      nazev: "Etapy a předávky",
      idPole: "klic",
      nacist: function () { return HBA.db("web_v_etapy?select=*&order=rok.desc,cislo.asc"); },
      pripravit: function (r) {
        r.overeno_t = an(r.zajisteni_overeno);
        r.zavrit_od_t = hhmm(r.zavrit_od);
        r.zavrit_do_t = hhmm(r.zavrit_do);
        r.odhad_prvni_t = hhmm(r.odhad_prvni);
        r.odhad_posledni_t = hhmm(r.odhad_posledni);
        r.penalizace_t = HBT.trvaniText(r.penalizace);
        r.penalizace_s = HBT.trvaniS(r.penalizace);
        r.gps = r.gps_lat == null ? "" : Number(r.gps_lat).toFixed(5) + ", " + Number(r.gps_lon).toFixed(5);
        r.karta_t = r.karta_z10 + " z 10";
        r.upraveno_m = HBT.mistniCas(r.upraveno);
        return r;
      },
      popisRadku: function (r) { return r.rok + " · " + r.cislo + " " + r.nazev; },
      sloupce: [
        { pole: "rok", nazev: "Ročník", typ: "vycet", sirka: 70 },
        { pole: "cislo", nazev: "Č.", typ: "cislo", sirka: 80, napoveda: "Předávka N = start etapy N. 31 je cíl." },
        { pole: "nazev", nazev: "Předávka", sirka: 150, uprava: pole("nazev") },
        { pole: "typ_zajisteni", nazev: "Zajištění", typ: "vycet", sirka: 95, uprava: pole("typ_zajisteni", ["Local", "Interně HB"]) },
        { pole: "overeno_t", nazev: "Ověřeno", typ: "bool", sirka: 80, uprava: pole("zajisteni_overeno"),
          napoveda: "Zajištění je pro tenhle ročník potvrzené. Nový ročník se zakládá s „ne“." },
        { pole: "poznamka", nazev: "Poznámka k zajištění", sirka: 220, uprava: Object.assign(pole("poznamka"), { dlouhy: true }) },
        { pole: "delka_km", nazev: "Délka km", typ: "cislo", sirka: 80, uprava: pole("delka_km") },
        { pole: "prevyseni_m", nazev: "Stoupání m", typ: "cislo", sirka: 90, uprava: pole("prevyseni_m") },
        { pole: "klesani_m", nazev: "Klesání m", typ: "cislo", sirka: 85, uprava: pole("klesani_m") },
        { pole: "stoupani_na_km", nazev: "Stoupání m/km", typ: "cislo", sirka: 105, napoveda: "Stoupání dělené délkou. Počítá databáze." },
        { pole: "koeficient", nazev: "Koeficient", typ: "cislo", sirka: 90, uprava: pole("koeficient"),
          napoveda: "Odhad času etapy = čas běžce na 10 km × délka / 10 × koeficient." },
        { pole: "penalizace_t", nazev: "Penalizace", sirka: 90, razeni: "penalizace_s", zarovnat: "right", trvani: true, uprava: pole("penalizace"),
          napoveda: "Čas za neodběhnutou etapu. Spočítaný jako běžec s výkonností 10 min/km: 10 × délka × koeficient. Zadává se 1:52:00 nebo 112 (minut)." },
        { pole: "loni_delka_km", nazev: "Loni délka", typ: "cislo", sirka: 85 },
        { pole: "loni_koeficient", nazev: "Loni koeficient", typ: "cislo", sirka: 110 },
        { pole: "loni_typ_zajisteni", nazev: "Loni zajištění", typ: "vycet", sirka: 105, skryty: true },
        { pole: "povrch", nazev: "Povrch", sirka: 230, uprava: pole("povrch") },
        { pole: "auto_km", nazev: "Auto km", typ: "cislo", sirka: 80, uprava: pole("auto_km"), napoveda: "Na následující předávku." },
        { pole: "auto_min", nazev: "Auto min", typ: "cislo", sirka: 80, uprava: pole("auto_min") },
        { pole: "useku", nazev: "Úseků profilu", typ: "cislo", sirka: 100, skryty: true },
        { pole: "zavrit_od_t", nazev: "Zavřít od", sirka: 85, uprava: pole("zavrit_od"),
          napoveda: "Od kdy se předávka smí zavřít – dohoda s místními, ne výpočet. Prázdné = výchozí okno z nastavení." },
        { pole: "zavrit_do_t", nazev: "Zavřít do", sirka: 85, uprava: pole("zavrit_do") },
        { pole: "odhad_prvni_t", nazev: "Odhad první", sirka: 95, napoveda: "Z kalkulace startu. Ručně se nezadává." },
        { pole: "odhad_posledni_t", nazev: "Odhad poslední", sirka: 110 },
        { pole: "karta_t", nazev: "Karta etapy", sirka: 95, razeni: "karta_z10", napoveda: "Kolik z 10 polí karty etapy je vyplněných." },
        { pole: "popis_trasy", nazev: "Popis trasy", sirka: 240, skryty: true, uprava: Object.assign(pole("popis_trasy"), { dlouhy: true }) },
        { pole: "start_detail", nazev: "Upřesnění startu", sirka: 200, skryty: true, uprava: Object.assign(pole("start_detail"), { dlouhy: true }) },
        { pole: "cil_detail", nazev: "Upřesnění cíle", sirka: 200, skryty: true, uprava: Object.assign(pole("cil_detail"), { dlouhy: true }) },
        { pole: "gpx_soubor", nazev: "GPX", sirka: 140, skryty: true, uprava: pole("gpx_soubor"), napoveda: "Název souboru, formát hb27-NN-v1.gpx." },
        { pole: "pdf_soubor", nazev: "PDF karty", sirka: 140, skryty: true, uprava: pole("pdf_soubor") },
        { pole: "profil_obrazek", nazev: "Obrázek profilu", sirka: 140, skryty: true, uprava: pole("profil_obrazek") },
        { pole: "mapa_obrazek", nazev: "Obrázek mapy", sirka: 140, skryty: true, uprava: pole("mapa_obrazek") },
        { pole: "parkovani_obrazek", nazev: "Obrázek parkování", sirka: 150, skryty: true, uprava: pole("parkovani_obrazek") },
        { pole: "qr_auto", nazev: "QR pro auta", sirka: 130, skryty: true, uprava: pole("qr_auto") },
        { pole: "video", nazev: "Video", sirka: 140, skryty: true, uprava: pole("video") },
        { pole: "mapa_url", nazev: "Odkaz na mapu", sirka: 150, skryty: true, uprava: pole("mapa_url") },
        { pole: "gps", nazev: "GPS", sirka: 150, skryty: true },
        { pole: "koeficient_zdroj", nazev: "Zdroj koeficientu", sirka: 190, skryty: true, uprava: pole("koeficient_zdroj") },
        { pole: "upraveno_m", nazev: "Změněno", typ: "cas", sirka: 130, skryty: true }
      ],
      vychozi: { s: [{ field: "cislo", dir: "asc" }] },
      historieRadku: async function (r) {
        var z = await HBA.db("historie_zmen?select=kdy,kdo,operace,stare,nove&tabulka=eq.predavky&nove->>rok=eq." + encodeURIComponent(r.rok) +
                             "&nove->>cislo=eq." + r.cislo + "&order=kdy.desc&limit=30");
        return z.map(function (x) {
          var zm = [];
          Object.keys(x.nove || {}).forEach(function (k) {
            if (k === "upraveno") return;
            var a = (x.stare || {})[k], b = (x.nove || {})[k];
            if (JSON.stringify(a) !== JSON.stringify(b)) zm.push("<b>" + e(k) + "</b>: " + e(a == null ? "–" : a) + " → " + e(b == null ? "–" : b));
          });
          return { kdy: x.kdy, kdo: x.kdo, html: zm.length ? zm.join("<br>") : "<i>založeno</i>" };
        }).filter(function (x) { return x.html; });
      },
      info: async function () {
        var r = await HBA.db("web_v_etapy?select=rok,zajisteni_overeno,karta_z10&rok=eq." + encodeURIComponent(await HBA.rpc("web_aktivni_rok")));
        if (!r.length) return "";
        var neover = r.filter(function (x) { return !x.zajisteni_overeno; }).length;
        var bezkarty = r.filter(function (x) { return (x.karta_z10 || 0) < 10; }).length;
        return "Neověřené zajištění: " + neover + " · karta etapy není úplná u " + bezkarty + " z " + r.length + ".";
      }
    });
  });
})();

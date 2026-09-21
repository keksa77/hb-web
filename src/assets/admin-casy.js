// Časy – řádek = tým × etapa. Časy se nikdy nepřepisují: každá změna je nový záznam v web_cas,
// předchozí se zneplatní a zůstane vidět v historii vpravo.
// Doběh stačí zadat jako „14:32“ nebo „14:32:10“ – den se dopočítá ze startu etapy.
(function () {
  var e = HBA.esc;
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }
  var ZDROJ = { predavka: "předávka", papir: "papír", admin: "administrace", import: "import" };
  var DRUH = { dobeh: "doběh", pauza: "pauza", penalizace: "penalizace", pausal: "paušál" };
  function zapis(druh) {
    return { klic: "tym_id", ulozit: function (r, v) {
      return HBA.rpc("web_zapis_cas", { p_tym: r.tym_id, p_etapa: r.etapa, p_druh: druh, p_hodnota: v == null ? "" : String(v), p_zdroj: "admin" });
    } };
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "casy",
      nazev: "Časy",
      idPole: "klic",
      nacist: function () { return HBA.db("web_v_casy?select=*&order=tym_cislo.asc.nullslast,tym.asc,etapa.asc"); },
      pripravit: function (r) {
        r.klic = r.tym_id + "-" + r.etapa;
        r.plan_start_m = HBT.mistniCas(r.plan_start, true);
        r.plan_konec_m = HBT.mistniCas(r.plan_konec, true);
        r.start_m = HBT.mistniCas(r.start_skutecny, true);
        r.dobeh_m = HBT.mistniCas(r.dobeh, true);
        r.cas_etapy_s = HBT.trvaniS(r.cas_etapy);
        r.cas_etapy_t = HBT.trvaniText(r.cas_etapy);
        r.pauza_t = HBT.trvaniText(r.pauza);
        r.penalizace_t = HBT.trvaniText(r.penalizace);
        r.pausal_t = an(r.pausal);
        r.zdroj_t = ZDROJ[r.zdroj] || r.zdroj || "";
        r.zapsano_m = HBT.mistniCas(r.zapsano);
        r.testovaci_t = an(r.testovaci);
        return r;
      },
      popisRadku: function (r) { return (r.tym_cislo ? r.tym_cislo + " " : "") + r.tym + " – etapa " + r.etapa; },
      sloupce: [
        { pole: "rok", nazev: "Ročník", typ: "vycet", sirka: 70 },
        { pole: "tym_cislo", nazev: "Č. týmu", typ: "cislo", sirka: 75 },
        { pole: "tym", nazev: "Tým", sirka: 170 },
        { pole: "kategorie", nazev: "Kategorie", typ: "vycet", sirka: 100, skryty: true },
        { pole: "etapa", nazev: "Etapa", typ: "cislo", sirka: 70 },
        { pole: "etapa_nazev", nazev: "Název etapy", sirka: 120 },
        { pole: "startovni_cislo", nazev: "Číslo", sirka: 65 },
        { pole: "bezec", nazev: "Běžec", sirka: 140 },
        { pole: "plan_start_m", nazev: "Plán start", typ: "cas", sirka: 140, napoveda: "Z platné kalkulace startu" },
        { pole: "plan_konec_m", nazev: "Plán doběh", typ: "cas", sirka: 140 },
        { pole: "start_m", nazev: "Start", typ: "cas", sirka: 140, napoveda: "Skutečný start = doběh předchozí etapy + pauza (u 1. etapy start týmu)" },
        { pole: "dobeh_m", nazev: "Doběh", typ: "cas", sirka: 140, uprava: zapis("dobeh"),
          napoveda: "Zadejte 14:32 nebo 14:32:10, den se dopočítá. Prázdná hodnota čas zruší." },
        { pole: "cas_etapy_t", nazev: "Čas etapy", sirka: 85, razeni: "cas_etapy_s", zarovnat: "right" },
        { pole: "pauza_t", nazev: "Pauza po etapě", sirka: 95, zarovnat: "right", uprava: zapis("pauza"), napoveda: "Např. 0:10:00" },
        { pole: "penalizace_t", nazev: "Penalizace", sirka: 90, zarovnat: "right", uprava: zapis("penalizace"), napoveda: "Přičte se k času etapy" },
        { pole: "pausal_t", nazev: "Paušál", typ: "bool", sirka: 75, uprava: zapis("pausal"), napoveda: "Etapa se počítá paušálem z nastavení etapy" },
        { pole: "zdroj_t", nazev: "Zdroj", typ: "vycet", sirka: 100 },
        { pole: "zapsal", nazev: "Zapsal", sirka: 120 },
        { pole: "zapsano_m", nazev: "Zapsáno", typ: "cas", sirka: 125 },
        { pole: "oprav", nazev: "Opravy", typ: "cislo", sirka: 70, napoveda: "Kolikrát se doběh opravoval" },
        { pole: "poznamka", nazev: "Poznámka", sirka: 150 },
        { pole: "testovaci_t", nazev: "Zkušební", typ: "bool", sirka: 80 }
      ],
      vychozi: { h: [{ field: "testovaci_t", value: ["ne"] }] },
      historieRadku: async function (r) {
        var z = await HBA.db("web_cas?select=*,web_osoba(jmeno,prijmeni)&tym_id=eq." + r.tym_id + "&etapa=eq." + r.etapa + "&order=zapsano.desc");
        return z.map(function (x) {
          var hodnota = x.druh === "dobeh" ? HBT.ceskeDatum(HBT.mistniCas(x.cas, true)) :
                        x.druh === "pausal" ? an(x.pausal) : HBT.trvaniText(x.trvani);
          return { kdy: x.zapsano, kdo: x.web_osoba ? x.web_osoba.jmeno + " " + x.web_osoba.prijmeni : "",
                   neplati: !x.plati,
                   html: "<b>" + e(DRUH[x.druh]) + "</b>: " + (hodnota ? e(hodnota) : "<i>zrušeno</i>") +
                         " · " + e(ZDROJ[x.zdroj] || x.zdroj) + (x.plati ? "" : " · <i>neplatí, opraveno</i>") +
                         (x.poznamka ? "<br>" + e(x.poznamka) : "") };
        });
      },
      info: async function () {
        return "Doběh stačí zadat jako 14:32. Každá oprava se zapíše jako nový záznam, původní zůstane v historii vpravo.";
      }
    });
  });
})();

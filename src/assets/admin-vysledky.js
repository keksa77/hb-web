// Výsledky – řádek = tým. Jen ke čtení, počítá se z Časů (pohled web_v_vysledky).
// Čas týmu = součet časů etap = doběh 30. etapy − start − pauzy (+ penalizace), stejně jako starý web.
// Veřejné výsledky se generují do PDF až po kontrole (rozhodnuto 22. 9. 2026).
(function () {
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }
  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "vysledky",
      nazev: "Výsledky",
      idPole: "tym_id",
      nacist: function () { return HBA.db("web_v_vysledky?select=*&order=poradi.asc.nullslast,tym_cislo.asc"); },
      pripravit: function (r) {
        r.start_m = HBT.mistniCas(r.start, true);
        r.cil_m = HBT.mistniCas(r.cil, true);
        r.cas_tymu_s = HBT.trvaniS(r.cas_tymu);
        r.cas_tymu_t = HBT.trvaniText(r.cas_tymu);
        r.pauzy_t = HBT.trvaniS(r.pauzy) ? HBT.trvaniText(r.pauzy) : "";
        r.penalizace_t = HBT.trvaniS(r.penalizace) ? HBT.trvaniText(r.penalizace) : "";
        r.testovaci_t = an(r.testovaci);
        return r;
      },
      popisRadku: function (r) { return (r.tym_cislo ? r.tym_cislo + " " : "") + r.tym; },
      vychozi: { h: [{ field: "testovaci_t", value: ["ne"] }], s: [{ field: "poradi", dir: "asc" }] },
      sloupce: [
        { pole: "rok", nazev: "Ročník", typ: "vycet", sirka: 70 },
        { pole: "poradi", nazev: "Pořadí", typ: "cislo", sirka: 70 },
        { pole: "poradi_kategorie", nazev: "V kategorii", typ: "cislo", sirka: 85 },
        { pole: "kategorie", nazev: "Kategorie", typ: "vycet", sirka: 110 },
        { pole: "tym_cislo", nazev: "Č. týmu", typ: "cislo", sirka: 75 },
        { pole: "tym", nazev: "Tým", sirka: 200 },
        { pole: "start_m", nazev: "Start", typ: "cas", sirka: 140 },
        { pole: "cil_m", nazev: "Cíl", typ: "cas", sirka: 140 },
        { pole: "cas_tymu_t", nazev: "Čas týmu", sirka: 90, razeni: "cas_tymu_s", zarovnat: "right" },
        { pole: "pauzy_t", nazev: "Pauzy", sirka: 75, zarovnat: "right" },
        { pole: "penalizace_t", nazev: "Penalizace", sirka: 85, zarovnat: "right" },
        { pole: "pausalu", nazev: "Paušálů", typ: "cislo", sirka: 75 },
        { pole: "chybi_casy", nazev: "Chybí časy etap", sirka: 200, napoveda: "Dokud nějaká etapa nemá čas, tým nemá celkový čas ani pořadí" },
        { pole: "vs", nazev: "VS", sirka: 80, skryty: true },
        { pole: "testovaci_t", nazev: "Zkušební", typ: "bool", sirka: 80 }
      ],
      info: async function () {
        return "Jen ke čtení – počítá se z Časů. Pořadí má jen tým se všemi 30 časy. Export do Excelu je podklad pro PDF po kontrole.";
      }
    });
  });
})();

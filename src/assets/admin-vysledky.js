// Výsledky – řádek = tým. Jen ke čtení, počítá se z Časů (pohled web_v_vysledky).
// Čas týmu = cíl − start − pauzy + penalizace, u paušálové etapy paušál místo skutečného času (6. 10. 2026, stejně jako
// veřejné online výsledky a listina HB26). Chybějící mezičas čas týmu nezruší. Odstoupený tým (DNF) nemá čas ani pořadí.
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
        r.dnf_t = r.dnf_etapa ? "DNF – úsek P" + r.dnf_etapa + " → P" + (r.dnf_etapa + 1) : "";
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
        { pole: "cas_tymu_t", nazev: "Čas týmu", sirka: 90, razeni: "cas_tymu_s", zarovnat: "right", trvani: true },
        { pole: "pauzy_t", nazev: "Pauzy", sirka: 75, zarovnat: "right", trvani: true },
        { pole: "penalizace_t", nazev: "Penalizace", sirka: 85, zarovnat: "right", trvani: true },
        { pole: "pausalu", nazev: "Paušálů", typ: "cislo", sirka: 75 },
        { pole: "dnf_t", nazev: "Odstoupil", sirka: 150, napoveda: "Zapisuje se v Hlídání závodu nebo v Časech (sloupec Odstoupil zde)" },
        { pole: "chybi_casy", nazev: "Chybí časy etap", sirka: 200, napoveda: "Etapy bez času. Čas týmu se počítá z cíle, chybějící mezičas ho nezruší." },
        { pole: "vs", nazev: "VS", sirka: 80, skryty: true },
        { pole: "testovaci_t", nazev: "Zkušební", typ: "bool", sirka: 80 }
      ],
      info: async function () {
        return "Jen ke čtení – počítá se z Časů. Čas týmu = cíl − start − pauzy + penalizace (paušál místo času etapy). Shodný čas = stejné pořadí. Odstoupený tým je bez pořadí. Export do Excelu je podklad pro PDF po kontrole.";
      }
    });
  });
})();

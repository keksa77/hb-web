// Běžci – soupisky týmů. Řádek = běžec v týmu v ročníku.
// Osobní údaje se ukládají k osobě (web_osoba, stejná napříč ročníky), údaje pro ročník k soupisce (web_soupiska).
// Medaile se neevidují – dostanou je všichni (rozhodnuto 22. 9. 2026).
(function () {
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }
  var O = { tabulka: "web_osoba", klic: "osoba_id" };
  var S = { tabulka: "web_soupiska", klic: "id" };
  function o(sloupec, x) { return Object.assign({ sloupec: sloupec }, O, x || {}); }
  function s(sloupec, x) { return Object.assign({ sloupec: sloupec }, S, x || {}); }

  // "52" → 0:52:00, "52:30" → 0:52:30, "1:02:30" zůstane
  function vykonnost(v) {
    v = String(v || "").trim().replace(",", ":").replace(".", ":");
    if (!v) return null;
    if (/^\d{1,3}$/.test(v)) return "00:" + v + ":00";
    if (/^\d{1,2}:\d{2}$/.test(v)) return "00:" + v;
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(v)) return v;
    throw new Error("Čas na 10 km zadejte jako minuty:sekundy, např. 52:30.");
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "bezci",
      nazev: "Běžci",
      idPole: "id",
      nacist: function () { return HBA.db("web_v_bezci_admin?select=*&order=tym_cislo.asc.nullslast,tym.asc,poradi.asc"); },
      pripravit: function (r) {
        r.kapitan_t = an(r.kapitan);
        r.testovaci_t = an(r.testovaci);
        r.vytvoreno_m = HBT.mistniCas(r.vytvoreno);
        r.vykonnost_s = HBT.trvaniS(r.vykonnost_10km);
        return r;
      },
      popisRadku: function (r) { return (r.startovni_cislo || "") + " " + r.jmeno + " " + r.prijmeni + " – " + r.tym; },
      pridat: {
        nazev: "Přidat běžce",
        napoveda: "Když e-mail už v databázi je, přiřadí se k té osobě (stejný člověk napříč ročníky). Ostatní údaje doplníte v tabulce.",
        pole: [
          { pole: "tym", nazev: "Tým", povinne: true, hodnoty: async function () {
              var t = await HBA.db("web_tym?select=id,rok,cislo,nazev,testovaci&order=rok.desc,cislo.asc.nullslast,nazev.asc");
              return t.map(function (x) { return { value: x.id, label: x.rok + " · " + (x.cislo ? x.cislo + " " : "") + x.nazev + (x.testovaci ? " (zkušební)" : "") }; });
            } },
          { pole: "jmeno", nazev: "Jméno", povinne: true },
          { pole: "prijmeni", nazev: "Příjmení", povinne: true },
          { pole: "email", nazev: "E-mail", typ: "email" },
          { pole: "telefon", nazev: "Telefon" }
        ],
        ulozit: function (d) {
          return HBA.rpc("web_pridej_bezce", { p_tym: +d.tym, p_jmeno: d.jmeno, p_prijmeni: d.prijmeni, p_email: d.email || null, p_telefon: d.telefon || null });
        }
      },
      sloupce: [
        { pole: "rok", nazev: "Ročník", typ: "vycet", sirka: 70 },
        { pole: "startovni_cislo", nazev: "Číslo", sirka: 70, razeni: "poradi", napoveda: "Startovní číslo = číslo týmu / pořadí na soupisce" },
        { pole: "tym", nazev: "Tým", sirka: 180 },
        { pole: "vs", nazev: "VS", sirka: 80, skryty: true },
        { pole: "jmeno", nazev: "Jméno", sirka: 100, uprava: o("jmeno") },
        { pole: "prijmeni", nazev: "Příjmení", sirka: 120, uprava: o("prijmeni") },
        { pole: "kapitan_t", nazev: "Kapitán", typ: "bool", sirka: 75 },
        { pole: "email", nazev: "E-mail", sirka: 180, uprava: o("email") },
        { pole: "telefon", nazev: "Telefon", sirka: 110, uprava: o("telefon") },
        { pole: "vykonnost_10km", nazev: "Čas na 10 km", sirka: 95, razeni: "vykonnost_s", zarovnat: "right",
          napoveda: "Nahlášená výkonnost – minuty:sekundy",
          uprava: s("vykonnost_10km", { ulozit: async function (r, v) {
            var x = await HBA.db("web_soupiska?id=eq." + r.id, { metoda: "PATCH", telo: { vykonnost_10km: vykonnost(v) }, vratit: true });
            if (!x || !x.length) throw new Error("Změna se neuložila — nejspíš na ni nemáte práva.");
          } }) },
        { pole: "etapy", nazev: "Etapy", sirka: 110, napoveda: "Čísla etap oddělená čárkou, např. 3, 17, 28",
          uprava: { klic: "id", ulozit: function (r, v) { return HBA.rpc("web_nastav_etapy", { p_soupiska: r.id, p_etapy: v || "" }); } } },
        { pole: "pocet_etap", nazev: "Počet etap", typ: "cislo", sirka: 80 },
        { pole: "velikost", nazev: "Velikost", typ: "vycet", sirka: 100, uprava: s("velikost") },
        { pole: "rok_narozeni", nazev: "Rok narození", typ: "cislo", sirka: 90, uprava: o("rok_narozeni") },
        { pole: "kraj", nazev: "Kraj", typ: "vycet", sirka: 130, uprava: o("kraj") },
        { pole: "mesto", nazev: "Město", sirka: 120, uprava: o("mesto") },
        { pole: "ulice", nazev: "Ulice", sirka: 140, uprava: o("ulice") },
        { pole: "cislo_domu", nazev: "Č. domu", sirka: 70, uprava: o("cislo_domu") },
        { pole: "psc", nazev: "PSČ", sirka: 70, uprava: o("psc") },
        { pole: "pojistovna", nazev: "Pojišťovna", typ: "vycet", sirka: 100, uprava: o("pojistovna"), skryty: true },
        { pole: "poznamka", nazev: "Poznámka", sirka: 160, uprava: s("poznamka", { dlouhy: true }) },
        { pole: "testovaci_t", nazev: "Zkušební", typ: "bool", sirka: 80 },
        { pole: "vytvoreno_m", nazev: "Přidáno", typ: "cas", sirka: 125, skryty: true }
      ],
      hromadne: [
        { nazev: "Odebrat ze soupisky", akce: "odebrat" }
      ],
      akce: {
        odebrat: async function (r) {
          var x = await HBA.db("web_soupiska?id=eq." + r.id, { metoda: "PATCH", telo: { "do": new Date().toISOString() }, vratit: true });
          if (!x || !x.length) throw new Error("Nepodařilo se — nejspíš na to nemáte práva.");
        }
      },
      historie: function (r) { return [{ tabulka: "web_soupiska", id: r.id }, { tabulka: "web_osoba", id: r.osoba_id }]; },
      info: async function () {
        return "Dvojklik upraví buňku. Etapy pište jako „3, 17, 28“ – etapu, kterou měl jiný běžec týmu, převezme tento. Odebraný běžec zůstane v historii.";
      }
    });
  });
})();

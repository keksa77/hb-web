// Běžci – soupisky týmů. Řádek = běžec v týmu v ročníku (web_soupiska).
// Údaje běžce se vedou u řádku soupisky, zvlášť pro každý ročník a tým (rozhodnuto 29. 9. 2026);
// osoba (web_osoba) drží jen identitu podle e-mailu kvůli historii a přihlášení.
// Bez adresy, pojišťovny a medaile (medaili dostanou všichni). Nejvýš max_bezcu běžců (Nastavení).
(function () {
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }
  var S = { tabulka: "web_soupiska", klic: "id" };
  function s(sloupec, x) { return Object.assign({ sloupec: sloupec }, S, x || {}); }
  async function patch(r, telo) {
    var x = await HBA.db("web_soupiska?id=eq." + r.id, { metoda: "PATCH", telo: telo, vratit: true });
    if (!x || !x.length) throw new Error("Změna se neuložila — nejspíš na ni nemáte práva.");
  }
  var POHLAVI = { "žena": "zena", "zena": "zena", "muž": "muz", "muz": "muz", "jiné": "jine", "jine": "jine" };
  var KRAJE = [];

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
    try { KRAJE = await HBA.db("web_kraj?select=kod,nazev&order=poradi"); } catch (e) { KRAJE = []; }
    HBT({
      sekce: "bezci",
      nazev: "Běžci",
      idPole: "id",
      nacist: function () { return HBA.db("web_v_bezci_admin?select=*&order=tym_cislo.asc.nullslast,tym.asc,poradi.asc"); },
      pripravit: function (r) {
        r.kapitan_t = an(r.kapitan);
        r.zastupce_t = an(r.zastupce);
        r.testovaci_t = an(r.testovaci);
        r.vytvoreno_m = HBT.mistniCas(r.vytvoreno);
        r.vykonnost_s = HBT.trvaniS(r.vykonnost_10km);
        return r;
      },
      popisRadku: function (r) { return (r.startovni_cislo || "") + " " + r.jmeno + " " + r.prijmeni + " – " + r.tym; },
      pridat: {
        nazev: "Přidat běžce",
        napoveda: "E-mail a telefon jsou povinné. Když e-mail už v databázi je, řádek se napojí na tu osobu kvůli historii — její dřívější údaje se nepřebírají ani nemění. Ostatní údaje doplníte v tabulce.",
        pole: [
          { pole: "tym", nazev: "Tým", povinne: true, hodnoty: async function () {
              var t = await HBA.db("web_tym?select=id,rok,cislo,nazev,testovaci&order=rok.desc,cislo.asc.nullslast,nazev.asc");
              return t.map(function (x) { return { value: x.id, label: x.rok + " · " + (x.cislo ? x.cislo + " " : "") + x.nazev + (x.testovaci ? " (zkušební)" : "") }; });
            } },
          { pole: "jmeno", nazev: "Jméno", povinne: true },
          { pole: "prijmeni", nazev: "Příjmení", povinne: true },
          { pole: "email", nazev: "E-mail", typ: "email", povinne: true },
          { pole: "telefon", nazev: "Telefon", povinne: true }
        ],
        ulozit: function (d) {
          return HBA.rpc("web_pridej_bezce", { p_tym: +d.tym, p_jmeno: d.jmeno, p_prijmeni: d.prijmeni, p_email: d.email, p_telefon: d.telefon });
        }
      },
      sloupce: [
        { pole: "rok", nazev: "Ročník", typ: "vycet", sirka: 70 },
        { pole: "startovni_cislo", nazev: "Číslo", sirka: 70, razeni: "poradi", napoveda: "Startovní číslo = číslo týmu / pořadí na soupisce" },
        { pole: "tym", nazev: "Tým", sirka: 180 },
        { pole: "vs", nazev: "VS", sirka: 80, skryty: true },
        { pole: "jmeno", nazev: "Jméno", sirka: 100, uprava: s("jmeno") },
        { pole: "prijmeni", nazev: "Příjmení", sirka: 120, uprava: s("prijmeni") },
        { pole: "kapitan_t", nazev: "Kapitán", typ: "bool", sirka: 75 },
        { pole: "zastupce_t", nazev: "Zástupce", typ: "bool", sirka: 80, skryty: true },
        { pole: "email", nazev: "E-mail", sirka: 180, uprava: s("email") },
        { pole: "telefon", nazev: "Telefon", sirka: 110, uprava: s("telefon") },
        { pole: "vykonnost_10km", nazev: "Čas na 10 km", sirka: 95, razeni: "vykonnost_s", zarovnat: "right", trvani: true,
          napoveda: "Nahlášená výkonnost: 52 = 52 minut, 52:30 = minuty:sekundy, 1:02:30 = hodiny:minuty:sekundy",
          uprava: s("vykonnost_10km", { ulozit: function (r, v) { return patch(r, { vykonnost_10km: vykonnost(v) }); } }) },
        { pole: "etapy", nazev: "Etapy", sirka: 110, napoveda: "Čísla etap oddělená čárkou, např. 3, 17, 28",
          uprava: { klic: "id", ulozit: function (r, v) { return HBA.rpc("web_nastav_etapy", { p_soupiska: r.id, p_etapy: v || "" }); } } },
        { pole: "pocet_etap", nazev: "Počet etap", typ: "cislo", sirka: 80 },
        { pole: "pohlavi_text", nazev: "Pohlaví", typ: "vycet", sirka: 80, napoveda: "žena, muž, nebo jiné",
          uprava: s("pohlavi", { ulozit: function (r, v) {
            var t = String(v || "").trim().toLowerCase();
            if (t && !POHLAVI[t]) throw new Error("Pohlaví napište jako žena, muž, nebo jiné.");
            return patch(r, { pohlavi: t ? POHLAVI[t] : null });
          } }) },
        { pole: "rok_narozeni", nazev: "Rok narození", typ: "cislo", sirka: 90, uprava: s("rok_narozeni") },
        { pole: "velikost_text", nazev: "Velikost", typ: "vycet", sirka: 110, napoveda: "Řada a velikost, např. „pánská M“, „dámská S“, „unisex XL“",
          uprava: s("velikost", { ulozit: function (r, v) {
            var t = String(v || "").trim();
            if (!t) return patch(r, { velikost_rada: null, velikost: null });
            var m = t.match(/^(dámská|damska|pánská|panska|unisex)\s+(.+)$/i);
            if (!m) throw new Error("Velikost napište jako řadu a velikost, např. „pánská M“.");
            var rada = m[1].toLowerCase().replace("damska", "dámská").replace("panska", "pánská");
            return patch(r, { velikost_rada: rada, velikost: m[2].trim().toUpperCase() === "JEDNA VELIKOST" ? "jedna velikost" : m[2].trim().toUpperCase() });
          } }) },
        { pole: "kraj_nazev", nazev: "Kraj", typ: "vycet", sirka: 130,
          uprava: s("kraj", { ulozit: function (r, v) {
            var t = String(v || "").trim().toLowerCase();
            if (!t) return patch(r, { kraj: null });
            var k = KRAJE.filter(function (x) { return x.kod === t || String(x.nazev).toLowerCase() === t; })[0];
            if (!k) throw new Error("Kraj „" + v + "“ není v číselníku.");
            return patch(r, { kraj: k.kod });
          } }) },
        { pole: "mesto", nazev: "Město", sirka: 120, uprava: s("mesto") },
        { pole: "poznamka", nazev: "Poznámka", sirka: 160, uprava: s("poznamka", { dlouhy: true }) },
        { pole: "zdroj", nazev: "Přidal přes", typ: "vycet", sirka: 100, skryty: true },
        { pole: "pridal", nazev: "Přidal", sirka: 120, skryty: true },
        { pole: "testovaci_t", nazev: "Zkušební", typ: "bool", sirka: 80 },
        { pole: "vytvoreno_m", nazev: "Přidáno", typ: "cas", sirka: 125, skryty: true }
      ],
      hromadne: [
        { nazev: "Odebrat ze soupisky", akce: "odebrat" }
      ],
      akce: {
        odebrat: async function (r) {
          await patch(r, { "do": new Date().toISOString() });
        }
      },
      historie: function (r) { return [{ tabulka: "web_soupiska", id: r.id }]; },
      info: async function () {
        return "Dvojklik upraví buňku. Etapy pište jako „3, 17, 28“ – etapu, kterou měl jiný běžec týmu, převezme tento. Odebraný běžec zůstane v historii a jeho etapy se uvolní. Víc běžců, než je v Nastavení (Nejvíc běžců na soupisce), databáze na soupisku nepustí.";
      }
    });
  });
})();

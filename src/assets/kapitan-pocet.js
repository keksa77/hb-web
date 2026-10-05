// Kapitánská sekce – krok 3: konečný počet běžců. Kapitán nebo zástupce potvrdí, že počet jmen na soupisce je konečný;
// pak nejde přidat ani odebrat běžce, dokud potvrzení nezruší. Údaje běžců upravit jde dál (Keksa 4. 10. 2026).
(function () {
  var e = HBK.esc, P = null;
  function bezcu(n) { return n + " " + (n === 1 ? "běžec" : n >= 2 && n <= 4 ? "běžci" : "běžců"); }

  function vykresli() {
    var vede = P.role !== "bezec", n = Number(P.bezcu) || 0, h = [];
    var neuplni = (P.upozorneni || []).filter(function (x) { return x.druh === "neuplne"; })[0];
    h.push('<p class="k-hlaska" id="k-stav" role="status"></p>');
    if (P.pocet_potvrzen) {
      h.push('<div class="k-karta"><p class="k-velky"><span class="k-stitek k-stitek-ok">potvrzeno</span> ' + e(bezcu(Number(P.pocet_konecny))) + "</p>" +
        '<p class="pocet">Potvrzeno ' + e(HBK.cas(P.pocet_potvrzen)) + ". Běžce teď nepřidáš ani neodebereš. Jméno a údaje upravit můžeš, třeba když za někoho nastupuje náhradník.</p>" +
        (vede && P.soupiska_otevrena ? '<div class="k-akce"><button type="button" class="k-vedlejsi k-tlacitko-s-napovedou" id="k-zmenit-pocet">Změnit počet' +
          "<small>Zruší potvrzení, pak můžeš běžce přidat nebo odebrat.</small></button></div>" : "") + "</div>");
    } else if (!vede) {
      h.push('<div class="k-karta"><p>Konečný počet běžců zatím není potvrzený.</p></div>');
    } else if (!P.soupiska_otevrena) {
      h.push('<div class="k-karta"><p>Počet nebyl potvrzený a soupiska je uzavřená. Napiš nám na info@horybory.cz.</p></div>');
    } else if (!n) {
      h.push('<div class="k-karta"><p>Na soupisce zatím nikdo není. Nejdřív přidej běžce v kroku <a href="' + HB.zaklad + '/kapitan/soupiska/">Soupiska</a>.</p></div>');
    } else {
      h.push('<div class="k-karta"><p class="k-velky">Na soupisce ' + (n >= 2 && n <= 4 ? "jsou " : "je ") + "<b>" + e(bezcu(n)) + "</b>.</p>" +
        "<p>Až budeš vědět, že tvůj tým poběží právě v tomhle složení, potvrď to. Pak už běžce nepřidáš ani neodebereš, dokud potvrzení nezrušíš" +
        (P.soupiska_do ? "; změnit počet jde do " + e(HBK.cas(P.soupiska_do)) : "") + ".</p>" +
        (neuplni ? '<p class="k-chyba">Potvrdit půjde, až budou u všech běžců vyplněné povinné údaje. Doplň je v kroku <a href="' + HB.zaklad + '/kapitan/soupiska/">Soupiska</a>.</p>' : "") +
        '<div class="k-akce"><button type="button" class="k-tlacitko k-tlacitko-s-napovedou" id="k-potvrdit-pocet"' + (neuplni ? " disabled" : "") + ">Potvrdit konečný počet: " + e(bezcu(n)) +
        "<small>Dáš nám vědět, kolik běžců tvůj tým bude mít.</small></button></div></div>");
    }
    document.getElementById("k-obsah").innerHTML = h.join("");
  }

  async function obnov(text) { P = await HBK.rpc("web_k_prehled"); vykresli(); HBK.kroky(P); if (text) HBK.toast(text); }

  document.addEventListener("click", async function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest("button"); if (!t) return;
    if (t.id === "k-potvrdit-pocet") {
      t.disabled = true;
      try { await HBK.rpc("web_k_potvrd_pocet"); await obnov("Konečný počet běžců je potvrzený."); }
      catch (err) { HBK.hlaska("k-stav", err.message, true); t.disabled = false; }
    }
    if (t.id === "k-zmenit-pocet") {
      if (!confirm("Zrušit potvrzení konečného počtu? Pokud máš potvrzenou i soupisku a etapy, zruší se i to.")) return;
      t.disabled = true;
      try { await HBK.rpc("web_k_zrus_potvrzeni_poctu"); await obnov("Potvrzení počtu je zrušené. Teď můžeš běžce přidat nebo odebrat."); }
      catch (err) { HBK.hlaska("k-stav", err.message, true); t.disabled = false; }
    }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    P = await HBK.vyzadovat(); if (!P) return;
    vykresli();
  });
})();

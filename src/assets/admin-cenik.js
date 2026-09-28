// Ceník startovného ročníku (tabulka rocnik_startovne) – vlny, od kdy do kdy platí a cena.
// Měnit smí jen organizátor (pravidlo v databázi). Cena týmu se řídí dnem PLATBY.
// Kontrola dole hlídá, aby vlny navazovaly bez mezer a pokryly celou registraci.
(function () {
  var e = HBA.esc, ROK = "HB27";

  // „24. 11. 2026 10:00:00“ nebo „24. 11. 2026 10:00“ → „2026-11-24 10:00:00“ (čas v Praze, databáze to tak bere)
  function zCeskeho(v) {
    function d2(x) { return String(x).padStart(2, "0"); }
    var t = String(v || "").trim();
    var iso = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3] + " " + d2(iso[4]) + ":" + iso[5] + ":" + (iso[6] || "00");
    var m = t.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) throw new Error("Zadejte datum a čas jako 24. 11. 2026 10:00:00.");
    return m[3] + "-" + d2(m[2]) + "-" + d2(m[1]) + " " + d2(m[4]) + ":" + m[5] + ":" + (m[6] || "00");
  }
  async function uloz(r, telo) {
    var v = await HBA.db("rocnik_startovne?rok=eq." + encodeURIComponent(r.rok) + "&vlna=eq." + encodeURIComponent(r.vlna),
      { metoda: "PATCH", telo: telo, vratit: true });
    if (!v || !v.length) throw new Error("Změna se neuložila — ceník smí měnit jen organizátor.");
  }
  function kc(n) { return n == null ? "" : Number(n).toLocaleString("cs-CZ") + " Kč"; }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    try { ROK = (await HBA.rpc("web_rocnik_webu")) || ROK; } catch (err) {}
    HBT({
      sekce: "cenik",
      nazev: "Ceník startovného",
      idPole: "vlna",
      nacist: function () { return HBA.db("rocnik_startovne?select=*&rok=eq." + ROK + "&order=poradi"); },
      pripravit: function (r) {
        r.od_m = HBT.mistniCas(r.od, true);
        r.do_m = HBT.mistniCas(r["do"], true);
        r.cena_text = kc(r.cena_kc);
        return r;
      },
      popisRadku: function (r) { return "Vlna " + r.vlna + " · " + r.rok; },
      sloupce: [
        { pole: "vlna", nazev: "Vlna", sirka: 70 },
        { pole: "od_m", nazev: "Platí od", typ: "cas", sirka: 170,
          uprava: { ulozit: function (r, v) { return uloz(r, { od: zCeskeho(v) }); } } },
        { pole: "do_m", nazev: "Platí do", typ: "cas", sirka: 170,
          uprava: { ulozit: function (r, v) { return uloz(r, { "do": zCeskeho(v) }); } } },
        { pole: "cena_kc", nazev: "Cena (Kč)", typ: "cislo", sirka: 110,
          uprava: { ulozit: function (r, v) {
            var n = Number(String(v).replace(/\s/g, "").replace(",", "."));
            if (!(n > 0)) throw new Error("Cena musí být kladné číslo.");
            return uloz(r, { cena_kc: n });
          } } },
        { pole: "poradi", nazev: "Pořadí", typ: "cislo", sirka: 80 }
      ],
      info: async function () {
        var h = ["Ročník <b>" + e(ROK) + "</b>. Cena týmu se řídí dnem <b>platby</b>. Změny jsou hned vidět v nových mailech."];
        // kontrola návaznosti vln
        var s = (await HBA.db("rocnik_startovne?select=vlna,od,do&rok=eq." + ROK + "&order=od"));
        var chyby = [];
        for (var i = 1; i < s.length; i++) {
          var rozdil = (new Date(s[i].od) - new Date(s[i - 1]["do"])) / 1000;
          if (rozdil > 1) chyby.push("mezera mezi vlnou " + s[i - 1].vlna + " a " + s[i].vlna);
          if (rozdil < 1) chyby.push("vlny " + s[i - 1].vlna + " a " + s[i].vlna + " se překrývají");
        }
        try {
          var p = await HBA.db("parametr_hodnota?select=klic,hodnota&rok=eq." + ROK + "&klic=in.(registrace_od,registrace_do)");
          var reg = {}; p.forEach(function (x) { reg[x.klic] = x.hodnota; });
          if (s.length && reg.registrace_od && new Date(s[0].od) > new Date(reg.registrace_od.replace(" ", "T")))
            chyby.push("první vlna začíná až po otevření registrace (" + e(HBT.ceskeDatum(reg.registrace_od)) + ")");
          if (s.length && reg.registrace_do && new Date(s[s.length - 1]["do"]) < new Date(reg.registrace_do.replace(" ", "T")))
            chyby.push("poslední vlna končí dřív než registrace (" + e(HBT.ceskeDatum(reg.registrace_do)) + ")");
        } catch (err) {}
        h.push(chyby.length ? '<b style="color:#A3302B">Pozor: ' + chyby.join("; ") + ".</b>" : "Vlny navazují bez mezer a pokrývají celou registraci.");
        h.push('Úpravy: dvojklik na buňku, nebo klikněte na řádek a upravte vpravo. Datum a čas pište jako 24. 11. 2026 10:00:00.');
        return h.join(" · ");
      }
    });
  });
})();

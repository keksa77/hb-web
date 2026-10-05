// Model online výsledků – sdílí ho stránka Výsledky (vysledky.js) a zápis na předávce (predavka.js).
// Ze surových dat (RPC web_vysledky_data) spočítá časy etap, čas týmu, pořadí po etapách a živý odhad.
// Živý odhad = metoda C ze zpětného testu HB24–HB26 (5. 10. 2026): plán etapy × tempo;
// u běžce, který už běžel, rozhoduje z 80 % jeho vlastní poměr skutečnost / plán, jinak tempo týmu
// ze všech změřených etap (zpočátku tlumené k 1,00, omezené na 0,85–1,15).
// Odhad se nikam neukládá a nikdy nenahrazuje změřený čas.
(function () {
  function omez(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function spocitej(data, ted) {
    var tymy = (data.tymy || []).map(function (t) {
      var E = [], i;
      for (i = 0; i < 30; i++) {
        var r = (t.e || [])[i] || [];
        E.push({ i: i + 1, plan: r[0], bid: r[1], jm: r[2] || "", dobeh: r[3] != null && r[3] <= ted ? r[3] : null,
                 pauza: r[4] || 0, penal: r[5] || 0 });
      }
      var x = { id: t.id, c: t.c, n: t.n, k: t.k, s: t.s, E: E, posledni: 0 };
      for (i = 0; i < 30; i++) if (E[i].dobeh != null) x.posledni = i + 1;
      // čas etapy jen tam, kde je známý i začátek (předchozí doběh nebo start)
      var sumR = 0, sumP = 0, k = 0, pauzy = 0, penal = 0, bezci = {};
      for (i = 0; i < 30; i++) {
        var e = E[i], zac = i === 0 ? t.s : (E[i - 1].dobeh != null ? E[i - 1].dobeh + E[i - 1].pauza : null);
        e.zacatek = zac;
        penal += e.penal;
        if (e.dobeh != null && t.s != null) e.casTymu = e.dobeh - t.s - pauzy + penal;
        pauzy += e.pauza;
        if (e.dobeh != null && zac != null) {
          e.cas = e.dobeh - zac + e.penal;
          if (e.plan > 0) {
            sumR += e.dobeh - zac; sumP += e.plan; k++;
            (bezci[e.bid] = bezci[e.bid] || []).push((e.dobeh - zac) / e.plan);
          }
        }
      }
      x.cil = E[29].dobeh;
      x.tempoTymu = k ? omez(1 + (sumR / sumP - 1) * k / (k + 3), 0.85, 1.15) : 1;
      // živý odhad dalších předávek
      if (t.s != null && x.posledni < 30) {
        var t0 = x.posledni ? E[x.posledni - 1].dobeh + E[x.posledni - 1].pauza : t.s;
        for (i = x.posledni; i < 30; i++) {
          var e2 = E[i];
          if (!(e2.plan > 0)) break;
          var f = x.tempoTymu, rb = bezci[e2.bid];
          if (rb && rb.length) {
            var prum = rb.reduce(function (a, b) { return a + b; }, 0) / rb.length;
            f = omez(0.8 * prum + 0.2 * x.tempoTymu, 0.8, 1.2);
          }
          var p = t0 + e2.plan * f;
          if (i === x.posledni && ted >= t.s && p < ted) { e2.zpozdeni = ted - p; p = ted; }
          e2.odhad = p;
          t0 = p + e2.pauza;
        }
      }
      x.bezi = t.s != null && ted >= t.s && x.posledni < 30 ? x.posledni + 1 : null;
      return x;
    });
    // pořadí po každé etapě (celkem a v kategorii) + nejdál proběhlá etapa
    var poradi = {};
    for (var e = 1; e <= 30; e++) {
      var s = tymy.filter(function (t) { return t.E[e - 1].casTymu != null; })
        .sort(function (a, b) { return a.E[e - 1].casTymu - b.E[e - 1].casTymu; });
      var vk = {};
      s.forEach(function (t, j) {
        t.E[e - 1].poradi = j + 1;
        vk[t.k] = (vk[t.k] || 0) + 1; t.E[e - 1].poradiKat = vk[t.k];
      });
      poradi[e] = s;
    }
    var vychozi = null;
    for (var e3 = 30; e3 >= 1; e3--) {
      if (tymy.length && poradi[e3].length / tymy.length >= 0.9) { vychozi = e3; break; }
    }
    if (vychozi == null) for (var e4 = 30; e4 >= 1; e4--) if (poradi[e4].length) { vychozi = e4; break; }
    return { tymy: tymy, poradi: poradi, vychozi: vychozi,
      zacal: tymy.some(function (t) { return t.s != null && t.s <= ted; }),
      dobehnuto: tymy.length > 0 && tymy.every(function (t) { return t.cil != null; }),
      nejdrivStart: Math.min.apply(null, tymy.map(function (t) { return t.s || Infinity; })) };
  }
  window.HBVysl = { spocitej: spocitej };
})();

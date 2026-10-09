// Model online výsledků – sdílí ho stránka Výsledky (vysledky.js), zápis na předávce (predavka.js) a Hlídání.
// Ze surových dat (RPC web_vysledky_data) spočítá časy etap, čas týmu, pořadí po etapách a živý odhad.
// Čas týmu = doběh − start − pauzy + penalizace; u paušálové etapy platí paušál místo skutečného času
// (stejně jako administrace, pohled web_v_vysledky, a listina HB26 – sjednoceno 6. 10. 2026).
// Shodný čas = stejné pořadí (1., 1., 3.). Odstoupený tým (DNF, pole x = etapa) od té etapy nemá čas týmu ani odhad.
// Živý odhad = metoda C ze zpětného testu HB24–HB26 (5. 10. 2026): plán etapy × tempo;
// u běžce, který už běžel, rozhoduje z 80 % jeho vlastní poměr skutečnost / plán, jinak tempo týmu
// ze všech změřených etap (zpočátku tlumené k 1,00, omezené na 0,85–1,15). Paušálové etapy se do tempa nepočítají.
// Odhad se nikam neukládá a nikdy nenahrazuje změřený čas.
(function () {
  function omez(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function spocitej(data, ted) {
    var tymy = (data.tymy || []).map(function (t) {
      var E = [], i, dnf = t.x || null;
      for (i = 0; i < 30; i++) {
        var r = (t.e || [])[i] || [];
        E.push({ i: i + 1, plan: r[0], bid: r[1], jm: r[2] || "", dobeh: r[3] != null && r[3] <= ted ? r[3] : null,
                 pauza: r[4] || 0, penal: r[5] || 0, pausal: r[6] != null ? r[6] : null });
      }
      var x = { id: t.id, c: t.c, n: t.n, k: t.k, s: t.s, E: E, posledni: 0, dnf: dnf, proveruje: t.v || [] };
      x.proveruje.forEach(function (et) { if (E[et - 1]) E[et - 1].proveruje = true; }); // čekající žádost kapitána o opravu času
      for (i = 0; i < 30; i++) if (E[i].dobeh != null) x.posledni = i + 1;
      // čas etapy jen tam, kde je známý i začátek (předchozí doběh nebo start)
      var sumR = 0, sumP = 0, k = 0, pauzy = 0, upravy = 0, bezci = {};
      x.nelogicke = [];
      for (i = 0; i < 30; i++) {
        var e = E[i], zac = i === 0 ? t.s : (E[i - 1].dobeh != null ? E[i - 1].dobeh + E[i - 1].pauza : null);
        e.zacatek = zac;
        var skut = e.dobeh != null && zac != null ? e.dobeh - zac : null;
        if (e.pausal != null) { if (skut != null) upravy += e.pausal - skut; }
        else upravy += e.penal;
        if (e.dobeh != null && t.s != null && !(dnf && e.i >= dnf)) e.casTymu = e.dobeh - t.s - pauzy + upravy;
        pauzy += e.pauza;
        if (e.pausal != null) e.cas = e.pausal;
        else if (skut != null) e.cas = skut + e.penal;
        if (skut != null && skut < 0) { e.nelogicky = true; x.nelogicke.push(e.i); }
        if (skut != null && skut > 0 && e.pausal == null && e.plan > 0) {
          sumR += skut; sumP += e.plan; k++;
          (bezci[e.bid] = bezci[e.bid] || []).push(skut / e.plan);
        }
      }
      x.cil = dnf ? null : E[29].dobeh;
      x.tempoTymu = k ? omez(1 + (sumR / sumP - 1) * k / (k + 3), 0.85, 1.15) : 1;
      // živý odhad dalších předávek (odstoupený tým už nemá)
      if (t.s != null && x.posledni < 30 && !dnf) {
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
      x.bezi = t.s != null && ted >= t.s && x.posledni < 30 && !dnf ? x.posledni + 1 : null;
      return x;
    });
    // pořadí po každé etapě (celkem a v kategorii); shodný čas = stejné pořadí
    var poradi = {};
    for (var e = 1; e <= 30; e++) {
      var s = tymy.filter(function (t) { return t.E[e - 1].casTymu != null; })
        .sort(function (a, b) { return a.E[e - 1].casTymu - b.E[e - 1].casTymu || (a.c || 0) - (b.c || 0); });
      var predCas = null, predPor = 0, vk = {};
      s.forEach(function (t, j) {
        var c = t.E[e - 1].casTymu;
        t.E[e - 1].poradi = c === predCas ? predPor : j + 1;
        predCas = c; predPor = t.E[e - 1].poradi;
        var kk = vk[t.k] || (vk[t.k] = { n: 0, cas: null, por: 0 });
        kk.n++;
        t.E[e - 1].poradiKat = c === kk.cas ? kk.por : kk.n;
        kk.cas = c; kk.por = t.E[e - 1].poradiKat;
      });
      poradi[e] = s;
    }
    var zavodi = tymy.filter(function (t) { return !t.dnf; });
    var vychozi = null;
    for (var e3 = 30; e3 >= 1; e3--) {
      if (zavodi.length && poradi[e3].length / zavodi.length >= 0.9) { vychozi = e3; break; }
    }
    if (vychozi == null) for (var e4 = 30; e4 >= 1; e4--) if (poradi[e4].length) { vychozi = e4; break; }
    // odstoupené týmy: na konec, podle počtu proběhnutých etap a pak času posledního doběhu
    var odstoupili = tymy.filter(function (t) { return t.dnf; }).sort(function (a, b) {
      var pa = Math.min(a.posledni, a.dnf - 1), pb = Math.min(b.posledni, b.dnf - 1);
      return pb - pa || ((pa ? a.E[pa - 1].casTymu : 0) - (pb ? b.E[pb - 1].casTymu : 0)) || (a.c || 0) - (b.c || 0);
    });
    return { tymy: tymy, poradi: poradi, vychozi: vychozi, odstoupili: odstoupili,
      zacal: tymy.some(function (t) { return t.s != null && t.s <= ted; }),
      dobehnuto: tymy.length > 0 && tymy.every(function (t) { return t.cil != null || t.dnf; }),
      nejdrivStart: Math.min.apply(null, tymy.map(function (t) { return t.s || Infinity; })) };
  }

  // Sloučí plná data s odpovědí „jen změny od“ (týmy se změnou přijdou celé, ids = kdo v datech zůstává).
  function slouc(stara, zmeny) {
    if (!stara || !zmeny || !zmeny.ids) return zmeny;
    var nove = {}, out = {}, k;
    (zmeny.tymy || []).forEach(function (t) { nove[t.id] = t; });
    for (k in stara) out[k] = stara[k];
    for (k in zmeny) if (k !== "tymy" && k !== "ids" && k !== "zmeny_od") out[k] = zmeny[k];
    var drz = {}; zmeny.ids.forEach(function (id) { drz[id] = 1; });
    var tymy = (stara.tymy || []).filter(function (t) { return drz[t.id]; }).map(function (t) { return nove[t.id] || t; });
    var mam = {}; tymy.forEach(function (t) { mam[t.id] = 1; });
    (zmeny.tymy || []).forEach(function (t) { if (!mam[t.id] && drz[t.id]) tymy.push(t); });
    tymy.sort(function (a, b) { return (a.c == null) - (b.c == null) || (a.c || 0) - (b.c || 0) || a.id - b.id; });
    out.tymy = tymy;
    return out;
  }
  window.HBVysl = { spocitej: spocitej, slouc: slouc };
})();

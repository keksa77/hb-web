// Tabulka administrace – společný základ pro všechny sekce (fronta, týmy, …).
// Postavené na knihovně Tabulator (licence MIT). Umí:
//  - filtr jako v Excelu (šipka ▾ v hlavičce: řazení, podmínka, seznam hodnot), všechny filtry platí najednou,
//  - hledání přes všechny sloupce, řazení podle více sloupců (Shift + klik),
//  - skrývání, přesouvání a šířku sloupců (pamatuje si prohlížeč),
//  - uložené pohledy v databázi (web_admin_pohled) a filtr v adrese stránky,
//  - úpravu dvojklikem v buňce i v panelu vpravo, historii změn,
//  - zaškrtávání řádků a hromadné akce s protokolem (web_admin_protokol),
//  - export odfiltrovaných řádků do .xlsx a .csv.
// Co kdo smí zapsat, hlídá databáze, ne tenhle soubor.
(function () {
  var e = HBA.esc;

  // ---------- pomocníci ----------
  function bezDiakritiky(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  function dvoj(n) { return String(n).padStart(2, "0"); }
  // Časové razítko z databáze → "RRRR-MM-DD HH:MM" v místním čase (řadí se i filtruje jako text).
  function mistniCas(v, sekundy) {
    if (!v) return "";
    var d = new Date(v);
    if (isNaN(d)) return v;
    return d.getFullYear() + "-" + dvoj(d.getMonth() + 1) + "-" + dvoj(d.getDate()) + " " + dvoj(d.getHours()) + ":" + dvoj(d.getMinutes()) +
      (sekundy ? ":" + dvoj(d.getSeconds()) : "");
  }
  // Interval z databáze ("01:05:00", "1 day 01:45:34") → sekundy a text "25:45:34".
  function trvaniS(v) {
    if (v == null || v === "") return null;
    var m = String(v).match(/^(?:(-?\d+) days? )?(-?)(\d+):(\d{2}):(\d{2})/);
    if (!m) return null;
    var s = (+(m[1] || 0)) * 86400 + (+m[3]) * 3600 + (+m[4]) * 60 + (+m[5]);
    return m[2] === "-" ? -s : s;
  }
  function trvaniText(v) {
    var s = typeof v === "number" ? v : trvaniS(v);
    if (s == null) return "";
    var z = s < 0 ? "-" : ""; s = Math.abs(s);
    return z + Math.floor(s / 3600) + ":" + dvoj(Math.floor(s % 3600 / 60)) + ":" + dvoj(s % 60);
  }
  function ceskeDatum(v) {
    if (!v) return "";
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return e(v);
    return (+m[3]) + ". " + (+m[2]) + ". " + m[1] + (m[4] ? " " + m[4] + ":" + m[5] + (m[6] ? ":" + m[6] : "") : "");
  }
  function prazdne(v) { return v == null || v === "" || (Array.isArray(v) && !v.length); }

  // ---------- filtry ----------
  function filtrObsahuje(hledane, hodnota) {
    return bezDiakritiky(hodnota).indexOf(bezDiakritiky(hledane)) >= 0;
  }
  // Filtr čísel v jednom políčku: „3“, „>2“, „<10“, „>=5“, „2-5“.
  function filtrCisla(f, hodnota) {
    f = String(f || "").replace(/\s/g, "").replace(",", ".");
    if (!f) return true;
    if (prazdne(hodnota)) return false;
    var n = Number(hodnota), m;
    if ((m = f.match(/^(-?[\d.]+)-(-?[\d.]+)$/))) return n >= +m[1] && n <= +m[2];
    if ((m = f.match(/^(>=|<=|>|<|=)(-?[\d.]+)$/))) {
      var x = +m[2];
      return m[1] === ">" ? n > x : m[1] === "<" ? n < x : m[1] === ">=" ? n >= x : m[1] === "<=" ? n <= x : n === x;
    }
    return String(hodnota) === f;
  }
  // Filtr datumu a času: hledá v tom, co je vidět v buňce („5. 9.“, „14:3“).
  function filtrCasu(f, hodnota) {
    if (!f) return true;
    return bezDiakritiky(ceskeDatum(hodnota)).replace(/\s/g, "").indexOf(bezDiakritiky(f).replace(/\s/g, "")) >= 0;
  }
  // Editor okamžiku v buňce: ukáže hodnotu česky („4. 9. 2027 08:00:00“), přepisuje se stejně.
  function editorCasu(cell, onRendered, success, cancel) {
    var puvodni = ceskeDatum(cell.getValue());
    var i = document.createElement("input");
    i.type = "text"; i.value = puvodni; i.style.width = "100%"; i.style.boxSizing = "border-box";
    onRendered(function () { i.focus(); i.select(); });
    function hotovo() { if (i.value.trim() === puvodni) cancel(); else success(i.value.trim()); }
    i.addEventListener("blur", hotovo);
    i.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") hotovo();
      if (ev.key === "Escape") cancel();
    });
    return i;
  }
  // Pro Excel: český datum a čas → sériové číslo Excelu; doba „25:45:34“ → zlomek dne.
  function excelDatum(t) {
    var m = String(t || "").match(/^(\d{1,2})\. (\d{1,2})\. (\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    var ms = Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return { v: (ms - Date.UTC(1899, 11, 30)) / 86400000, cas: !!m[4], sek: !!m[6] };
  }
  // ---------- autofiltr jako v Excelu ----------
  var IKONA_SIPKA = '<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M1 3h8L5 8z" fill="currentColor"/></svg>';
  var IKONA_TRYCHTYR = '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M0.5 1h9L6 5v4L4 8V5z" fill="currentColor"/></svg>';
  function skrytyFiltr() { var x = document.createElement("span"); x.hidden = true; return x; }
  // Hodnota buňky → položka v seznamu filtru (u datumu a času jen den).
  function klic(typ, v) {
    if (prazdne(v)) return "(prázdné)";
    if (typ === "datum" || typ === "cas") { var m = String(v).match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : String(v); }
    return String(v);
  }
  function popisKlice(typ, k) {
    if (k === "(prázdné)") return k;
    return typ === "datum" || typ === "cas" ? ceskeDatum(k) : k;
  }
  // Jeden filtr pro všechny sloupce: seznam zaškrtnutých hodnot, nebo podmínka napsaná textem.
  function filtrSloupce(typ, f, h) {
    if (f == null || f === "") return true;
    if (Array.isArray(f)) return !f.length || f.indexOf(klic(typ, h)) >= 0;
    if (typeof f === "object") return true; // starý filtr od–do z uložených pohledů
    if (typ === "cislo") return filtrCisla(f, h);
    if (typ === "datum" || typ === "cas") return filtrCasu(f, h);
    return filtrObsahuje(f, h);
  }

  function popisFiltru(f, typ) {
    if (f == null || f === "") return "";
    if (Array.isArray(f)) return f.map(function (k) { return popisKlice(typ, k); }).join(" nebo ");
    if (typ === "cislo" && typeof f === "string") return f;
    if (typeof f === "object") {
      if (f.od && f.do) return f.od + " až " + f.do;
      if (f.od) return "od " + f.od;
      if (f.do) return "do " + f.do;
      return "";
    }
    return "obsahuje „" + f + "“";
  }

  // ---------- stav (filtry, řazení, hledání) do adresy a zpět ----------
  function stavZAdresy() {
    var m = location.hash.match(/[#&]stav=([^&]+)/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (err) { return null; }
  }

  // ---------- hlavní funkce ----------
  // nastaveni: { sekce, nazev, nacist(): Promise<řádky>, sloupce: [...], vychozi: {h, s},
  //   akceRadku(řádek) → html, akce: { jméno: async fn(řádek) }, hromadne: [{nazev, akce, jen(řádek)?}],
  //   pripravit(řádek) → řádek, info() → Promise<html>, idPole }
  window.HBT = function (N) {
    var koren = document.getElementById("adm-tabulka-obal");
    koren.innerHTML =
      '<div class="adm-lista">' +
        '<h1>' + e(N.nazev) + '</h1>' +
        '<input type="search" id="t-hledat" placeholder="Hledat ve všech sloupcích…">' +
        '<span id="t-pocet" class="adm-pocet-radku"></span>' +
        '<label class="adm-pohled">Pohled <select id="t-pohled"><option value="">—</option></select></label>' +
        (N.pridat ? '<button type="button" class="adm-tlacitko adm-tlacitko-male" id="t-pridat">+ ' + e(N.pridat.nazev) + '</button>' : "") +
        '<button type="button" class="adm-male" id="t-ulozit-pohled">Uložit pohled</button>' +
        '<button type="button" class="adm-male" id="t-zrusit">Zrušit filtry</button>' +
        '<span class="adm-rozbal"><button type="button" class="adm-male" id="t-sloupce">Sloupce ▾</button><div class="adm-rozbal-obsah" id="t-sloupce-seznam" hidden></div></span>' +
        '<button type="button" class="adm-male" id="t-xlsx">Excel</button>' +
        '<button type="button" class="adm-male" id="t-csv">CSV</button>' +
        '<button type="button" class="adm-male" id="t-obnovit" title="Načíst znovu z databáze">↻</button>' +
      '</div>' +
      '<div class="adm-lista adm-lista-2">' +
        '<div id="t-stitky" class="adm-stitky"></div>' +
        '<div id="t-hromadne" class="adm-hromadne" hidden></div>' +
        '<div id="t-info" class="adm-info"></div>' +
      '</div>' +
      '<div class="adm-ulozit-pohled" id="t-pohled-form" hidden>Název pohledu <input id="t-pohled-nazev"> ' +
        '<button type="button" class="adm-male" id="t-pohled-ok">Uložit</button> ' +
        '<button type="button" class="adm-male" id="t-pohled-smazat" hidden>Smazat vybraný pohled</button> ' +
        '<button type="button" class="adm-male" id="t-pohled-zpet">Zavřít</button></div>' +
      '<p class="adm-chyba" id="t-chyba" hidden></p><p class="adm-ok" id="t-ok" hidden></p>' +
      '<div class="adm-prostor"><div id="t-tabulka"></div><aside class="adm-panel" id="t-panel" hidden></aside></div>';

    function el(id) { return document.getElementById(id); }
    function hlaska(druh, text) {
      el("t-chyba").hidden = true; el("t-ok").hidden = true;
      if (text) { el(druh === "ok" ? "t-ok" : "t-chyba").textContent = text; el(druh === "ok" ? "t-ok" : "t-chyba").hidden = false; }
    }
    function chyba(err) { hlaska("chyba", err && err.message ? err.message : String(err)); }

    var popisy = {}, typy = {};
    N.sloupce.forEach(function (s) { popisy[s.pole] = s.nazev; typy[s.pole] = s.typ || "text"; });

    // --- sloupce pro Tabulator ---
    function sloupec(s) {
      var c = { title: s.nazev, field: s.pole, visible: !s.skryty, headerTooltip: s.napoveda || s.nazev,
                width: s.sirka, minWidth: 40, tooltip: true };
      // Šířka aspoň na celý nadpis, ať se nezkracuje na „Ro…“.
      var naNadpis = Math.round(s.nazev.length * 7.2 + 40);
      if (!c.width || c.width < naNadpis) c.width = naNadpis;
      var typ = s.typ || "text";
      // Filtr jako v Excelu: řádek s filtry je skrytý, ovládá se šipkou ▾ v hlavičce (viz autofiltr níže).
      c.headerFilter = skrytyFiltr;
      c.headerFilterFunc = function (f, h) { return filtrSloupce(typ, f, h); };
      c.headerFilterEmptyCheck = function (v) { return v == null || v === "" || (Array.isArray(v) && !v.length); };
      c.titleFormatter = function () {
        return '<span class="adm-af-nadpis">' + e(s.nazev) + '</span>' +
               '<button type="button" class="adm-af" data-pole="' + e(s.pole) + '" title="Řadit a filtrovat">' + IKONA_SIPKA + '</button>';
      };
      c.headerTooltip = s.napoveda || false;
      if (typ === "cislo") {
        c.hozAlign = "right"; c.sorter = "number"; c.sorterParams = { alignEmptyValues: "bottom" };
      } else if (typ === "datum" || typ === "cas") {
        c.formatter = function (cell) { return ceskeDatum(cell.getValue()); };
        c.accessorDownload = function (v) { return ceskeDatum(v); };
      }
      if (s.formatter) c.formatter = s.formatter;
      if (s.razeni) c.sorter = function (a, b, ar, br) {
        var x = ar.getData()[s.razeni], y = br.getData()[s.razeni];
        return (x == null ? -Infinity : x) - (y == null ? -Infinity : y);
      };
      if (s.zarovnat) c.hozAlign = s.zarovnat;
      if (s.uprava) {
        c.editable = true;
        var u = s.uprava;
        if (typ === "bool") { c.editor = "list"; c.editorParams = { values: ["ano", "ne"] }; }
        else if (u.hodnoty) { c.editor = "list"; c.editorParams = { values: u.hodnoty }; }
        else if (typ === "cislo") c.editor = "number";
        else if (typ === "datum") c.editor = "date";
        else if (typ === "cas") c.editor = editorCasu;
        else c.editor = "input";
        c.cssClass = "adm-upravitelne";
      }
      return c;
    }
    var sloupce = N.sloupce.map(sloupec);
    if (N.akceRadku) {
      sloupce.unshift({ title: "Akce", field: "_akce", headerSort: false, frozen: true, download: false, width: N.sirkaAkci || 150,
        formatter: function (cell) { return N.akceRadku(cell.getRow().getData()); },
        cellClick: function (ev, cell) {
          var b = ev.target.closest("button[data-akce]"); if (!b) return;
          provedAkci(b, [cell.getRow().getData()], b.dataset.akce, b.dataset.arg);
        } });
    }

    var tab = new Tabulator("#t-tabulka", {
      data: [],
      index: N.idPole || "id",
      layout: "fitDataStretch",
      height: "100%",
      placeholder: "Žádný řádek neodpovídá filtrům.",
      columns: sloupce,
      rowHeader: { download: false, formatter: "rowSelection", titleFormatter: "rowSelection", headerSort: false, resizable: false,
                   frozen: true, width: 32, hozAlign: "center", headerHozAlign: "center",
                   cellClick: function (ev, cell) { cell.getRow().toggleSelect(); } },
      selectableRows: "highlight",
      movableColumns: true,
      columnHeaderSortMulti: true,
      headerSortClickElement: "header",
      editTriggerEvent: "dblclick",
      persistence: { columns: ["width", "visible"] },
      persistenceID: "hb-admin-v2-" + N.sekce,
      locale: "cs",
      langs: { cs: { data: { loading: "Načítám…", error: "Chyba" },
                     headerFilters: { "default": "" } } }
    });

    var hotovo = false;
    tab.on("tableBuilt", async function () {
      try { await nacist(true); } catch (err) { chyba(err); }
    });

    // --- načtení dat ---
    var hledat = "";
    async function nacist(poprve) {
      var radky = await N.nacist();
      radky = radky.map(N.pripravit || function (r) { return r; });
      if (poprve) {
        await tab.setData(radky);
        var st = stavZAdresy();
        try { if (!st) st = JSON.parse(localStorage.getItem("hb-admin-stav-" + N.sekce) || "null"); } catch (err) {}
        if (!st) {
          // Výchozí pohled: filtry sekce + jen aktivní ročník, když tabulka ročník má (ostatní ročníky jdou vybrat ve filtru).
          st = JSON.parse(JSON.stringify(N.vychozi || {}));
          if (N.sloupce.some(function (x) { return x.pole === "rok"; })) {
            try {
              var akt = await HBA.rpc("web_aktivni_rok");
              if (akt) st.h = (st.h || []).filter(function (f) { return f.field !== "rok"; }).concat([{ field: "rok", value: [akt] }]);
            } catch (err) { /* bez aktivního ročníku ukáže všechny */ }
          }
        }
        if (st) pouzijStav(st);
        hotovo = true; // až teď se smí stav ukládat, jinak by prázdná tabulka přepsala uložené filtry
        ulozStav();
        nactiPohledy();
      } else {
        await tab.replaceData(radky);
      }
      if (N.info) N.info().then(function (h) { el("t-info").innerHTML = h || ""; }).catch(function () {});
      obnovPocet();
      obnovPanel();
    }

    function pouzijStav(st) {
      tab.clearHeaderFilter();
      (st.h || []).forEach(function (f) {
        if (f.value && typeof f.value === "object" && !Array.isArray(f.value)) return; // starý filtr od–do
        try { tab.setHeaderFilterValue(f.field, f.value); } catch (err) {}
      });
      if (st.s && st.s.length) tab.setSort(st.s.map(function (x) { return { column: x.field, dir: x.dir }; }));
      else tab.clearSort();
      hledat = st.q || ""; el("t-hledat").value = hledat; pouzijHledani();
      if (st.sloupce) { try { tab.setColumnLayout(st.sloupce); } catch (err) {} }
    }
    function aktualniStav(sLayoutem) {
      var st = { h: tab.getHeaderFilters().map(function (f) { return { field: f.field, value: f.value }; }),
                 s: tab.getSorters().map(function (x) { return { field: x.field, dir: x.dir }; }),
                 q: hledat };
      if (sLayoutem) st.sloupce = tab.getColumnLayout();
      return st;
    }
    function ulozStav() {
      if (!hotovo) return;
      var st = aktualniStav(false);
      var prazdny = !st.h.length && !st.s.length && !st.q;
      try { localStorage.setItem("hb-admin-stav-" + N.sekce, JSON.stringify(st)); } catch (err) {}
      history.replaceState(null, "", location.pathname + location.search + (prazdny ? "" : "#stav=" + encodeURIComponent(JSON.stringify(st))));
      stitky();
    }

    function pouzijHledani() {
      if (!hledat) { tab.clearFilter(); return; }
      var pole = N.sloupce.map(function (s) { return s.pole; });
      var q = bezDiakritiky(hledat);
      tab.setFilter(function (r) {
        for (var i = 0; i < pole.length; i++) { if (bezDiakritiky(r[pole[i]]).indexOf(q) >= 0) return true; }
        return false;
      });
    }
    el("t-hledat").addEventListener("input", function () { hledat = this.value.trim(); pouzijHledani(); ulozStav(); });

    function obnovPocet() {
      var vid = tab.getDataCount("active"), vse = tab.getDataCount();
      el("t-pocet").textContent = vid === vse ? vse + " řádků" : vid + " z " + vse + " řádků";
    }
    tab.on("dataFiltered", function () { setTimeout(function () { obnovPocet(); ulozStav(); }, 0); });
    tab.on("dataSorted", function () { setTimeout(ulozStav, 0); });

    function stitky() {
      var h = [];
      if (hledat) h.push('<span class="adm-stitek-filtr">hledat: ' + e(hledat) + '</span>');
      tab.getHeaderFilters().forEach(function (f) {
        var p = popisFiltru(f.value, typy[f.field]); if (!p) return;
        h.push('<span class="adm-stitek-filtr">' + e(popisy[f.field] || f.field) + ': ' + e(p) +
               ' <button type="button" data-zrus="' + e(f.field) + '" title="Zrušit tento filtr">×</button></span>');
      });
      el("t-stitky").innerHTML = h.length ? '<span class="adm-sub-mini">Platí najednou:</span> ' + h.join(" ") : "";
    }
    el("t-stitky").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-zrus]"); if (!b) return;
      tab.setHeaderFilterValue(b.dataset.zrus, "");
    });
    el("t-zrusit").addEventListener("click", function () {
      tab.clearHeaderFilter(); tab.clearSort(); hledat = ""; el("t-hledat").value = ""; pouzijHledani();
      el("t-pohled").value = ""; ulozStav();
    });
    el("t-obnovit").addEventListener("click", function () { hlaska(); nacist(false).catch(chyba); });

    // --- autofiltr: šipka ▾ v hlavičce otevře nabídku jako v Excelu ---
    var menu = document.createElement("div");
    menu.className = "adm-af-menu"; menu.hidden = true;
    document.body.appendChild(menu);
    var menuPole = null;
    function zavriMenu() { menu.hidden = true; menuPole = null; }
    function hodnotaFiltru(pole) {
      var f = tab.getHeaderFilters().find(function (x) { return x.field === pole; });
      return f ? f.value : "";
    }
    // Hodnoty do seznamu: z řádků, které projdou ostatními filtry (jako v Excelu).
    function hodnotySloupce(pole, typ) {
      var jine = tab.getHeaderFilters().filter(function (f) { return f.field !== pole; });
      var q = bezDiakritiky(hledat), vsechnaPole = N.sloupce.map(function (s) { return s.pole; });
      var h = {};
      tab.getData().forEach(function (r) {
        for (var i = 0; i < jine.length; i++) { if (!filtrSloupce(typy[jine[i].field], jine[i].value, r[jine[i].field])) return; }
        if (q && !vsechnaPole.some(function (p) { return bezDiakritiky(r[p]).indexOf(q) >= 0; })) return;
        h[klic(typ, r[pole])] = r[pole];
      });
      var k = Object.keys(h);
      k.sort(function (a, b) {
        if (a === "(prázdné)") return 1; if (b === "(prázdné)") return -1;
        if (typ === "cislo") return Number(a) - Number(b);
        return a.localeCompare(b, "cs", { numeric: true });
      });
      return k;
    }
    function otevriMenu(tlacitko) {
      var pole = tlacitko.dataset.pole, typ = typy[pole] || "text", nazev = popisy[pole] || pole;
      if (menuPole === pole && !menu.hidden) { zavriMenu(); return; }
      menuPole = pole;
      var f = hodnotaFiltru(pole);
      var podminka = typeof f === "string" ? f : "";
      var vybrane = Array.isArray(f) && f.length ? f : null;
      var hodnoty = hodnotySloupce(pole, typ);
      if (vybrane) vybrane.forEach(function (k) { if (hodnoty.indexOf(k) < 0) hodnoty.push(k); });
      var razeni = typ === "cislo" ? ["od nejmenšího", "od největšího"] : (typ === "datum" || typ === "cas") ? ["od nejstaršího", "od nejnovějšího"] : ["od A do Z", "od Z do A"];
      var podmPopis = typ === "cislo" ? "Podmínka" : "Obsahuje";
      var podmNapoveda = typ === "cislo" ? "např. 5, >2, <10, 2-5" : (typ === "datum" || typ === "cas") ? "např. 5. 9. nebo 14:3" : "část textu";
      menu.innerHTML =
        '<button type="button" class="adm-af-polozka" data-m="asc">↑ Seřadit ' + razeni[0] + '</button>' +
        '<button type="button" class="adm-af-polozka" data-m="desc">↓ Seřadit ' + razeni[1] + '</button>' +
        '<hr>' +
        '<button type="button" class="adm-af-polozka" data-m="zrus"' + (f === "" || f == null || (Array.isArray(f) && !f.length) ? " disabled" : "") + '>✕ Vymazat filtr ze sloupce „' + e(nazev) + '“</button>' +
        '<label class="adm-af-podm">' + podmPopis + ' <input type="text" data-m="podm" placeholder="' + e(podmNapoveda) + '" value="' + e(podminka) + '"></label>' +
        '<hr>' +
        '<input type="search" class="adm-af-hledat" data-m="hledat" placeholder="Hledat v seznamu">' +
        '<div class="adm-af-seznam">' +
          '<label><input type="checkbox" data-vse> (Vybrat vše)</label>' +
          hodnoty.map(function (k) {
            var zaskrt = podminka ? true : !vybrane || vybrane.indexOf(k) >= 0;
            return '<label data-text="' + e(bezDiakritiky(popisKlice(typ, k))) + '"><input type="checkbox" value="' + e(k) + '"' + (zaskrt ? " checked" : "") + '> ' + e(popisKlice(typ, k)) + '</label>';
          }).join("") +
        '</div>' +
        '<div class="adm-af-tlacitka"><button type="button" class="adm-male adm-af-ok" data-m="ok">OK</button><button type="button" class="adm-male" data-m="zpet">Zrušit</button></div>';
      var r = tlacitko.closest(".tabulator-col").getBoundingClientRect();
      menu.hidden = false;
      var sirka = menu.offsetWidth;
      menu.style.left = Math.max(4, Math.min(r.left, window.innerWidth - sirka - 8)) + "px";
      menu.style.top = (r.bottom + 1) + "px";
      menu.style.maxHeight = (window.innerHeight - r.bottom - 12) + "px";
      obnovVse();
      var p = menu.querySelector('[data-m="podm"]');
      if (podminka) { p.focus(); p.select(); } else menu.querySelector('[data-m="hledat"]').focus();
    }
    function viditelnePolozky() {
      return Array.prototype.filter.call(menu.querySelectorAll(".adm-af-seznam label[data-text]"), function (l) { return !l.hidden; });
    }
    function obnovVse() {
      var vid = viditelnePolozky(), zaskrt = vid.filter(function (l) { return l.firstChild.checked; }).length;
      var vse = menu.querySelector("[data-vse]");
      vse.checked = vid.length > 0 && zaskrt === vid.length;
      vse.indeterminate = zaskrt > 0 && zaskrt < vid.length;
    }
    function potvrdMenu() {
      var pole = menuPole; if (!pole) return;
      var podm = menu.querySelector('[data-m="podm"]').value.trim();
      var hledano = menu.querySelector('[data-m="hledat"]').value.trim();
      var vsechny = menu.querySelectorAll(".adm-af-seznam label[data-text]");
      var vid = viditelnePolozky();
      var vybrane = vid.filter(function (l) { return l.firstChild.checked; }).map(function (l) { return l.firstChild.value; });
      var hodnota;
      if (podm) hodnota = podm;
      else if (!hledano && vybrane.length === vsechny.length) hodnota = "";
      else hodnota = vybrane;
      zavriMenu();
      tab.setHeaderFilterValue(pole, hodnota);
    }
    menu.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var b = ev.target.closest("[data-m]"); if (!b || b.tagName === "INPUT") return;
      var m = b.dataset.m, pole = menuPole;
      if (m === "asc" || m === "desc") { zavriMenu(); tab.setSort(pole, m); }
      else if (m === "zrus") { zavriMenu(); tab.setHeaderFilterValue(pole, ""); }
      else if (m === "ok") potvrdMenu();
      else if (m === "zpet") zavriMenu();
    });
    menu.addEventListener("change", function (ev) {
      if (ev.target.hasAttribute("data-vse")) {
        var z = ev.target.checked;
        viditelnePolozky().forEach(function (l) { l.firstChild.checked = z; });
      }
      if (ev.target.type === "checkbox") menu.querySelector('[data-m="podm"]').value = "";
      obnovVse();
    });
    menu.addEventListener("input", function (ev) {
      if (ev.target.dataset.m !== "hledat") return;
      var q = bezDiakritiky(ev.target.value.trim());
      menu.querySelectorAll(".adm-af-seznam label[data-text]").forEach(function (l) { l.hidden = q && l.dataset.text.indexOf(q) < 0; });
      obnovVse();
    });
    menu.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); potvrdMenu(); }
      if (ev.key === "Escape") zavriMenu();
    });
    document.addEventListener("click", function (ev) { if (!menu.hidden && !menu.contains(ev.target)) zavriMenu(); });
    window.addEventListener("resize", zavriMenu);
    el("t-tabulka").addEventListener("scroll", zavriMenu, true);
    // Klik na šipku nesmí zároveň řadit ani přesouvat sloupec – zachytíme ho dřív než Tabulator.
    ["mousedown", "pointerdown", "touchstart"].forEach(function (u) {
      el("t-tabulka").addEventListener(u, function (ev) { if (ev.target.closest(".adm-af")) ev.stopPropagation(); }, true);
    });
    el("t-tabulka").addEventListener("click", function (ev) {
      var b = ev.target.closest(".adm-af"); if (!b) return;
      ev.stopPropagation(); ev.preventDefault();
      otevriMenu(b);
    }, true);
    // Filtrovaný sloupec má místo šipky trychtýř.
    function obnovIkony() {
      var aktivni = {};
      tab.getHeaderFilters().forEach(function (f) { if (!(f.value == null || f.value === "" || (Array.isArray(f.value) && !f.value.length))) aktivni[f.field] = 1; });
      el("t-tabulka").querySelectorAll(".adm-af").forEach(function (b) {
        var a = !!aktivni[b.dataset.pole];
        if (b.classList.contains("aktivni") !== a) { b.classList.toggle("aktivni", a); b.innerHTML = a ? IKONA_TRYCHTYR : IKONA_SIPKA; }
        b.title = a ? "Filtr je zapnutý – klikněte pro změnu" : "Řadit a filtrovat";
      });
    }
    tab.on("dataFiltered", function () { setTimeout(obnovIkony, 0); });
    tab.on("columnMoved", function () { setTimeout(obnovIkony, 0); });
    tab.on("columnVisibilityChanged", function () { setTimeout(obnovIkony, 0); });

    // --- sloupce: skrýt / zobrazit ---
    el("t-sloupce").addEventListener("click", function (ev) {
      ev.stopPropagation();
      var s = el("t-sloupce-seznam");
      if (s.hidden) {
        s.innerHTML = tab.getColumns().filter(function (c) { return c.getField() && c.getField() !== "_akce"; }).map(function (c) {
          return '<label><input type="checkbox" data-sloupec="' + e(c.getField()) + '"' + (c.isVisible() ? " checked" : "") + '> ' + e(c.getDefinition().title) + '</label>';
        }).join("") + '<button type="button" class="adm-male" id="t-sloupce-vse">Zobrazit všechny</button>';
      }
      s.hidden = !s.hidden;
    });
    el("t-sloupce-seznam").addEventListener("click", function (ev) { ev.stopPropagation(); if (ev.target.id === "t-sloupce-vse") { tab.getColumns().forEach(function (c) { c.show(); }); el("t-sloupce-seznam").hidden = true; } });
    el("t-sloupce-seznam").addEventListener("change", function (ev) {
      var f = ev.target.dataset.sloupec; if (!f) return;
      var c = tab.getColumn(f); if (ev.target.checked) c.show(); else c.hide();
    });
    document.addEventListener("click", function () { el("t-sloupce-seznam").hidden = true; });

    // --- export ---
    function nazevSouboru(pripona) {
      var d = new Date();
      return "HB_" + N.sekce + "_" + d.getFullYear() + dvoj(d.getMonth() + 1) + dvoj(d.getDate()) + "_" + dvoj(d.getHours()) + dvoj(d.getMinutes()) + "." + pripona;
    }
    el("t-xlsx").addEventListener("click", function () {
      if (!window.XLSX) { chyba(new Error("Knihovna pro Excel se nenačetla. Zkuste CSV.")); return; }
      tab.download("xlsx", nazevSouboru("xlsx"), { sheetName: N.nazev.slice(0, 31), documentProcessing: excelCasy }, "active");
    });
    // Časové sloupce v Excelu jako skutečné datum/čas a doba, se kterými jde počítat.
    function excelCasy(wb) {
      var druhy = {};
      N.sloupce.forEach(function (s) {
        if (s.typ === "cas" || s.typ === "datum") druhy[s.nazev] = "okamzik";
        else if (s.trvani) druhy[s.nazev] = "trvani";
      });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rozsah = XLSX.utils.decode_range(ws["!ref"]);
      for (var c = rozsah.s.c; c <= rozsah.e.c; c++) {
        var hlava = ws[XLSX.utils.encode_cell({ r: 0, c: c })];
        var druh = hlava && druhy[hlava.v];
        if (!druh) continue;
        for (var r = 1; r <= rozsah.e.r; r++) {
          var bunka = ws[XLSX.utils.encode_cell({ r: r, c: c })];
          if (!bunka || bunka.v === "" || bunka.v == null) continue;
          if (druh === "okamzik") {
            var d = excelDatum(bunka.v);
            if (d) { bunka.t = "n"; bunka.v = d.v; bunka.z = d.cas ? (d.sek ? "d.m.yyyy h:mm:ss" : "d.m.yyyy h:mm") : "d.m.yyyy"; delete bunka.w; }
          } else {
            var sek = trvaniS(bunka.v);
            if (sek != null) { bunka.t = "n"; bunka.v = sek / 86400; bunka.z = "[h]:mm:ss"; delete bunka.w; }
          }
        }
      }
      return wb;
    }
    el("t-csv").addEventListener("click", function () {
      tab.download("csv", nazevSouboru("csv"), { delimiter: ";", bom: true }, "active");
    });

    // --- uložené pohledy ---
    var pohledy = [];
    async function nactiPohledy() {
      try {
        pohledy = await HBA.db("web_admin_pohled?select=id,nazev,nastaveni&sekce=eq." + encodeURIComponent(N.sekce) + "&order=nazev");
      } catch (err) { pohledy = []; }
      var v = el("t-pohled").value;
      el("t-pohled").innerHTML = '<option value="">—</option>' + pohledy.map(function (p) { return '<option value="' + p.id + '">' + e(p.nazev) + '</option>'; }).join("");
      el("t-pohled").value = v;
    }
    el("t-pohled").addEventListener("change", function () {
      var p = pohledy.find(function (x) { return String(x.id) === this.value; }, this);
      if (p) { pouzijStav(p.nastaveni || {}); ulozStav(); }
    });
    el("t-ulozit-pohled").addEventListener("click", function () {
      var p = pohledy.find(function (x) { return String(x.id) === el("t-pohled").value; });
      el("t-pohled-nazev").value = p ? p.nazev : "";
      el("t-pohled-smazat").hidden = !p; el("t-pohled-smazat").dataset.potvrd = "";
      el("t-pohled-smazat").textContent = "Smazat vybraný pohled";
      el("t-pohled-form").hidden = false; el("t-pohled-nazev").focus();
    });
    el("t-pohled-zpet").addEventListener("click", function () { el("t-pohled-form").hidden = true; });
    el("t-pohled-ok").addEventListener("click", async function () {
      var nazev = el("t-pohled-nazev").value.trim(); if (!nazev) return;
      try {
        var r = await HBA.db("web_admin_pohled?on_conflict=sekce,nazev", { metoda: "POST", vratit: true, prefer: "resolution=merge-duplicates",
          telo: { sekce: N.sekce, nazev: nazev, nastaveni: aktualniStav(true), upraveno: new Date().toISOString() } });
        await nactiPohledy();
        if (r && r[0]) el("t-pohled").value = r[0].id;
        el("t-pohled-form").hidden = true;
        hlaska("ok", "Pohled „" + nazev + "“ je uložený. Uvidí ho všichni organizátoři.");
      } catch (err) { chyba(err); }
    });
    el("t-pohled-smazat").addEventListener("click", async function () {
      var b = this, id = el("t-pohled").value; if (!id) return;
      if (!b.dataset.potvrd) { b.dataset.potvrd = "1"; b.textContent = "Opravdu smazat? Klikněte znovu"; return; }
      try {
        await HBA.db("web_admin_pohled?id=eq." + id, { metoda: "DELETE" });
        el("t-pohled").value = ""; await nactiPohledy(); el("t-pohled-form").hidden = true;
        hlaska("ok", "Pohled je smazaný. Data v tabulce se nezměnila.");
      } catch (err) { chyba(err); }
    });

    // --- úprava v buňce ---
    async function zapis(radek, zmeny) {
      // zmeny: [{ s: definice sloupce, v: nová hodnota }] – seskupí se podle tabulky a klíče
      var skupiny = {};
      for (var i = 0; i < zmeny.length; i++) {
        if (zmeny[i].s.uprava.ulozit) await zmeny[i].s.uprava.ulozit(radek, zmeny[i].v);
      }
      zmeny = zmeny.filter(function (z) { return !z.s.uprava.ulozit; });
      zmeny.forEach(function (z) {
        var u = z.s.uprava, klic = radek[u.klic || N.idPole || "id"];
        if (klic == null) throw new Error("Řádek nemá " + (u.klic || "id") + " – tuhle hodnotu tady upravit nejde.");
        var k = u.tabulka + "|" + (u.sloupecKlice || "id") + "|" + klic;
        skupiny[k] = skupiny[k] || { tabulka: u.tabulka, sloupecKlice: u.sloupecKlice || "id", klic: klic, telo: {} };
        var v = z.v;
        if (z.s.typ === "bool") v = v === "ano" ? true : v === "ne" ? false : null;
        else if (z.s.typ === "cislo") v = v === "" || v == null ? null : Number(v);
        else if (v === "") v = null;
        skupiny[k].telo[u.sloupec || z.s.pole] = v;
      });
      for (var k in skupiny) {
        var g = skupiny[k];
        var r = await HBA.db(g.tabulka + "?" + g.sloupecKlice + "=eq." + encodeURIComponent(g.klic), { metoda: "PATCH", telo: g.telo, vratit: true });
        if (!r || !r.length) throw new Error("Změna se neuložila — nejspíš na ni nemáte práva.");
      }
    }
    tab.on("cellEdited", async function (cell) {
      var s = N.sloupce.find(function (x) { return x.pole === cell.getField(); });
      if (!s || !s.uprava) return;
      if ((cell.getValue() ?? "") === (cell.getOldValue() ?? "")) return;
      hlaska();
      try {
        await zapis(cell.getRow().getData(), [{ s: s, v: cell.getValue() }]);
        hlaska("ok", "Uloženo: " + s.nazev + ".");
        await nacist(false);
      } catch (err) { cell.restoreOldValue(); chyba(err); }
    });

    // --- akce (jednotlivě i hromadně) s protokolem ---
    async function provedAkci(tlacitko, radky, akce, arg, hromadne) {
      if (tlacitko) tlacitko.disabled = true;
      hlaska();
      var ok = 0, chyby = [];
      for (var i = 0; i < radky.length; i++) {
        try { await N.akce[akce](radky[i], arg); ok++; }
        catch (err) { chyby.push({ id: radky[i][N.idPole || "id"], popis: N.popisRadku ? N.popisRadku(radky[i]) : "", chyba: err.message }); }
      }
      if (hromadne) {
        HBA.db("web_admin_protokol", { metoda: "POST", telo: { sekce: N.sekce, akce: akce + (arg ? ":" + arg : ""), pocet: radky.length, ok: ok,
          chyby: chyby.length ? chyby : null, detail: { id: radky.map(function (r) { return r[N.idPole || "id"]; }) } } }).catch(function () {});
      }
      if (chyby.length) {
        hlaska("chyba", (radky.length > 1 ? "Prošlo " + ok + " z " + radky.length + ". " : "") +
          chyby.map(function (c) { return (c.popis ? c.popis + ": " : "") + c.chyba; }).join(" · "));
      } else {
        hlaska("ok", radky.length > 1 ? "Hotovo: " + ok + " z " + radky.length + " řádků." : "Uloženo" + (N.popisRadku ? ": " + N.popisRadku(radky[0]) : "") + ".");
      }
      if (tlacitko) tlacitko.disabled = false;
      try { await nacist(false); } catch (err) { chyba(err); }
    }

    function obnovHromadne() {
      var vyb = tab.getSelectedData();
      var h = el("t-hromadne");
      if (!vyb.length || !N.hromadne) { h.hidden = true; h.innerHTML = ""; return; }
      h.hidden = false;
      h.innerHTML = '<b>Označeno ' + vyb.length + ':</b> ' + N.hromadne.map(function (a, i) {
        var n = a.jen ? vyb.filter(a.jen).length : vyb.length;
        return '<button type="button" class="adm-male" data-hromadne="' + i + '"' + (n ? "" : " disabled") + '>' + e(a.nazev) + (n !== vyb.length ? " (" + n + ")" : "") + '</button>';
      }).join(" ") + ' <button type="button" class="adm-odkaz-tmavy" id="t-odznacit">Zrušit označení</button>';
    }
    tab.on("rowSelectionChanged", obnovHromadne);
    el("t-hromadne").addEventListener("click", function (ev) {
      if (ev.target.id === "t-odznacit") { tab.deselectRow(); return; }
      var b = ev.target.closest("button[data-hromadne]"); if (!b) return;
      var a = N.hromadne[+b.dataset.hromadne];
      var radky = tab.getSelectedData(); if (a.jen) radky = radky.filter(a.jen);
      provedAkci(b, radky, a.akce, a.arg, true).then(function () { tab.deselectRow(); });
    });

    // --- panel vpravo ---
    // Panel se otevírá s malým zpožděním: dvojklik (úprava buňky) ho nesmí otevřít,
    // jinak by se tabulka zúžila a úprava by se nespustila.
    var otevreny = null, casovac = null;
    tab.on("rowClick", function (ev, row) {
      if (ev.target.closest("button, input, select, textarea, .tabulator-row-header, [tabulator-field=_akce], .tabulator-editing")) return;
      clearTimeout(casovac);
      casovac = setTimeout(function () { otevreny = row.getData()[N.idPole || "id"]; obnovPanel(); }, 280);
    });
    tab.on("cellDblClick", function () { clearTimeout(casovac); });
    function obnovPanel() {
      var p = el("t-panel");
      if (otevreny == null) { p.hidden = true; return; }
      var row = tab.getRow(otevreny);
      if (!row) { p.hidden = true; otevreny = null; return; }
      var r = row.getData();
      tab.getRows().forEach(function (x) { x.getElement().classList.toggle("adm-radek-otevreny", x === row); });
      var pole = N.sloupce.map(function (s) {
        var v = r[s.pole], zobraz;
        if (s.uprava) {
          var typ = s.typ || "text", vstup;
          if (typ === "bool" || s.uprava.hodnoty) {
            var hodn = typ === "bool" ? ["ano", "ne"] : s.uprava.hodnoty;
            vstup = '<select data-pole="' + e(s.pole) + '"><option value=""></option>' + hodn.map(function (h) { return '<option' + (String(v) === String(h) ? " selected" : "") + '>' + e(h) + '</option>'; }).join("") + '</select>';
          } else if (s.uprava.dlouhy) {
            vstup = '<textarea data-pole="' + e(s.pole) + '" rows="2">' + e(v) + '</textarea>';
          } else {
            vstup = '<input data-pole="' + e(s.pole) + '" type="' + (typ === "cislo" ? "number" : typ === "datum" ? "date" : "text") + '" value="' + e(typ === "cas" ? ceskeDatum(v) : v) + '">';
          }
          zobraz = vstup;
        } else {
          zobraz = (s.typ === "datum" || s.typ === "cas") ? ceskeDatum(v) : e(v);
        }
        return '<dt>' + e(s.nazev) + '</dt><dd>' + (zobraz === "" ? "–" : zobraz) + '</dd>';
      }).join("");
      p.innerHTML =
        '<div class="adm-panel-hlava"><b>' + e(N.popisRadku ? N.popisRadku(r) : "") + '</b>' +
          '<button type="button" class="adm-male" id="t-panel-zavrit" title="Zavřít">×</button></div>' +
        (N.akceRadku ? '<div class="adm-panel-akce">' + N.akceRadku(r) + '</div>' : "") +
        '<dl class="adm-panel-pole">' + pole + '</dl>' +
        '<div class="adm-panel-ulozit"><button type="button" class="adm-tlacitko" id="t-panel-ulozit" disabled>Uložit změny</button></div>' +
        '<h3>Historie změn</h3><div id="t-historie" class="adm-historie"><span class="adm-sub-mini">Načítám…</span></div>';
      p.hidden = false;
      nactiHistorii(r);
    }
    el("t-panel").addEventListener("input", function (ev) { if (ev.target.dataset.pole) el("t-panel-ulozit").disabled = false; });
    el("t-panel").addEventListener("change", function (ev) { if (ev.target.dataset.pole) el("t-panel-ulozit").disabled = false; });
    el("t-panel").addEventListener("click", async function (ev) {
      if (ev.target.id === "t-panel-zavrit") {
        otevreny = null; el("t-panel").hidden = true;
        tab.getRows().forEach(function (x) { x.getElement().classList.remove("adm-radek-otevreny"); });
        return;
      }
      var b = ev.target.closest("button[data-akce]");
      if (b) { provedAkci(b, [tab.getRow(otevreny).getData()], b.dataset.akce, b.dataset.arg); return; }
      if (ev.target.id === "t-panel-ulozit") {
        var r = tab.getRow(otevreny).getData(), zmeny = [];
        el("t-panel").querySelectorAll("[data-pole]").forEach(function (i) {
          var s = N.sloupce.find(function (x) { return x.pole === i.dataset.pole; });
          var puvodni = s.typ === "cas" ? ceskeDatum(r[s.pole]) : String(r[s.pole] ?? "");
          if (puvodni !== i.value.trim()) zmeny.push({ s: s, v: i.value.trim() });
        });
        if (!zmeny.length) return;
        ev.target.disabled = true; hlaska();
        try {
          await zapis(r, zmeny);
          hlaska("ok", "Uloženo: " + zmeny.map(function (z) { return z.s.nazev; }).join(", ") + ".");
          await nacist(false);
        } catch (err) { chyba(err); ev.target.disabled = false; }
      }
    });
    async function nactiHistorii(r) {
      var hist = el("t-historie");
      if (N.historieRadku) {
        try {
          var zaznamy = await N.historieRadku(r);
          hist.innerHTML = zaznamy.length ? "<ul>" + zaznamy.map(function (z) {
            return '<li' + (z.neplati ? ' class="adm-neplati"' : "") + '><span class="adm-sub-mini">' + ceskeDatum(mistniCas(z.kdy)) + ' · ' + e(z.kdo || "?") + '</span><br>' + z.html + '</li>';
          }).join("") + "</ul>" : '<span class="adm-sub-mini">Zatím nic zapsáno.</span>';
        } catch (err) { hist.innerHTML = '<span class="adm-sub-mini">Historii se nepodařilo načíst: ' + e(err.message) + '</span>'; }
        return;
      }
      if (!N.historie) { hist.innerHTML = '<span class="adm-sub-mini">U této sekce se historie nevede.</span>'; return; }
      try {
        var dotazy = N.historie(r).map(function (h) {
          return HBA.db("historie_zmen?select=kdy,kdo,tabulka,operace,stare,nove&tabulka=eq." + h.tabulka + "&nove->>id=eq." + encodeURIComponent(h.id) + "&order=kdy.desc&limit=30");
        });
        var vse = [].concat.apply([], await Promise.all(dotazy));
        vse.sort(function (a, b) { return a.kdy < b.kdy ? 1 : -1; });
        var radky = vse.map(function (z) {
          var zm = [];
          Object.keys(z.nove || {}).forEach(function (k) {
            if (k === "upraveno") return;
            var a = (z.stare || {})[k], b = (z.nove || {})[k];
            if (JSON.stringify(a) !== JSON.stringify(b)) zm.push('<b>' + e(k) + '</b>: ' + e(a == null ? "–" : a) + ' → ' + e(b == null ? "–" : b));
          });
          if (!zm.length) return "";
          return '<li><span class="adm-sub-mini">' + ceskeDatum(mistniCas(z.kdy)) + ' · ' + e(z.kdo || "?") + '</span><br>' + zm.join("<br>") + '</li>';
        }).filter(Boolean);
        hist.innerHTML = radky.length ? "<ul>" + radky.join("") + "</ul>" : '<span class="adm-sub-mini">Zatím beze změn.</span>';
      } catch (err) { hist.innerHTML = '<span class="adm-sub-mini">Historii se nepodařilo načíst: ' + e(err.message) + '</span>'; }
    }

    // --- přidání řádku (formulář v panelu vpravo) ---
    if (N.pridat) el("t-pridat").addEventListener("click", async function () {
      otevreny = null;
      tab.getRows().forEach(function (x) { x.getElement().classList.remove("adm-radek-otevreny"); });
      var p = el("t-panel"), pole = [];
      for (var i = 0; i < N.pridat.pole.length; i++) {
        var f = N.pridat.pole[i], vstup;
        if (f.hodnoty) {
          var h = typeof f.hodnoty === "function" ? await f.hodnoty() : f.hodnoty;
          vstup = '<select data-nove="' + e(f.pole) + '"><option value=""></option>' + h.map(function (x) {
            return '<option value="' + e(x.value) + '">' + e(x.label) + '</option>'; }).join("") + '</select>';
        } else {
          vstup = '<input data-nove="' + e(f.pole) + '" type="' + (f.typ || "text") + '">';
        }
        pole.push('<dt>' + e(f.nazev) + (f.povinne ? " *" : "") + '</dt><dd>' + vstup + '</dd>');
      }
      p.innerHTML = '<div class="adm-panel-hlava"><b>' + e(N.pridat.nazev) + '</b>' +
        '<button type="button" class="adm-male" id="t-panel-zavrit" title="Zavřít">×</button></div>' +
        (N.pridat.napoveda ? '<p class="adm-sub-mini">' + e(N.pridat.napoveda) + '</p>' : "") +
        '<dl class="adm-panel-pole">' + pole.join("") + '</dl>' +
        '<div class="adm-panel-ulozit"><button type="button" class="adm-tlacitko" id="t-pridat-ulozit">Přidat</button></div>';
      p.hidden = false;
      el("t-pridat-ulozit").addEventListener("click", async function () {
        var data = {}, chybi = [];
        p.querySelectorAll("[data-nove]").forEach(function (i) { data[i.dataset.nove] = i.value.trim(); });
        N.pridat.pole.forEach(function (f) { if (f.povinne && !data[f.pole]) chybi.push(f.nazev); });
        if (chybi.length) { chyba(new Error("Vyplňte: " + chybi.join(", ") + ".")); return; }
        this.disabled = true; hlaska();
        try {
          await N.pridat.ulozit(data);
          hlaska("ok", "Přidáno.");
          p.hidden = true;
          await nacist(false);
        } catch (err) { chyba(err); this.disabled = false; }
      });
    });

    return { tabulka: tab, nacist: nacist, hlaska: hlaska };
  };

  window.HBT.mistniCas = mistniCas;
  window.HBT.ceskeDatum = ceskeDatum;
  window.HBT.trvaniS = trvaniS;
  window.HBT.trvaniText = trvaniText;
})();

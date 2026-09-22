// Tabulka administrace – společný základ pro všechny sekce (fronta, týmy, …).
// Postavené na knihovně Tabulator (licence MIT). Umí:
//  - filtr pod hlavičkou každého sloupce, všechny filtry platí najednou,
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
  // (Starý filtr od–do se už nepoužívá – zůstává kvůli uloženým pohledům.)
  function editorRozsahu(typ) {
    return function (cell, onRendered, success) {
      var v = cell.getValue() || {};
      var obal = document.createElement("div");
      obal.className = "adm-rozsah";
      var t = typ === "cislo" ? "number" : "date";
      obal.innerHTML = '<input type="' + t + '" placeholder="od" title="od">' +
                       '<input type="' + t + '" placeholder="do" title="do">';
      var od = obal.children[0], dd = obal.children[1];
      od.value = v.od || ""; dd.value = v.do || "";
      function zmena() { success(od.value || dd.value ? { od: od.value, do: dd.value } : ""); }
      od.addEventListener("input", zmena); dd.addEventListener("input", zmena);
      od.addEventListener("keydown", function (ev) { ev.stopPropagation(); });
      dd.addEventListener("keydown", function (ev) { ev.stopPropagation(); });
      return obal;
    };
  }
  function filtrRozsahu(typ) {
    return function (f, hodnota) {
      if (!f) return true;
      if (prazdne(hodnota)) return false;
      if (typ === "cislo") {
        var n = Number(hodnota);
        if (f.od !== "" && f.od != null && n < Number(f.od)) return false;
        if (f.do !== "" && f.do != null && n > Number(f.do)) return false;
        return true;
      }
      var d = String(hodnota).slice(0, 10);
      if (f.od && d < f.od) return false;
      if (f.do && d > f.do) return false;
      return true;
    };
  }
  function filtrVyctu(vybrane, hodnota) {
    if (!vybrane || !vybrane.length) return true;
    var h = prazdne(hodnota) ? "(prázdné)" : String(hodnota);
    return vybrane.indexOf(h) >= 0;
  }
  function popisFiltru(f) {
    if (f == null || f === "") return "";
    if (Array.isArray(f)) return f.join(" nebo ");
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
      var naNadpis = Math.round(s.nazev.length * 7.2 + 22);
      if (!c.width || c.width < naNadpis) c.width = naNadpis;
      var typ = s.typ || "text";
      c.headerFilterPlaceholder = "";
      if (typ === "text") {
        c.headerFilter = "input"; c.headerFilterFunc = filtrObsahuje;
        c.headerTooltip = (s.napoveda ? s.napoveda + "\n" : "") + "Filtr: napište část textu.";
      } else if (typ === "cislo") {
        c.headerFilter = "input"; c.headerFilterFunc = filtrCisla;
        c.hozAlign = "right"; c.sorter = "number"; c.sorterParams = { alignEmptyValues: "bottom" };
        c.headerTooltip = (s.napoveda ? s.napoveda + "\n" : "") + "Filtr: 3 (přesně), >2, <10, 2-5 (rozsah).";
      } else if (typ === "datum" || typ === "cas") {
        c.headerFilter = "input"; c.headerFilterFunc = filtrCasu;
        c.formatter = function (cell) { return ceskeDatum(cell.getValue()); };
        c.headerTooltip = (s.napoveda ? s.napoveda + "\n" : "") + "Filtr: napište, co hledáte, např. 5. 9. nebo 14:3.";
      } else if (typ === "vycet" || typ === "bool") {
        c.headerFilter = "list";
        c.headerFilterParams = { valuesLookup: function (cell) {
            var h = {}; cell.getTable().getData().forEach(function (r) { var v = r[s.pole]; h[prazdne(v) ? "(prázdné)" : v] = 1; });
            return Object.keys(h).sort();
          }, multiselect: true, clearable: true, placeholderEmpty: "—", placeholderLoading: "" };
        c.headerTooltip = (s.napoveda ? s.napoveda + "\n" : "") + "Filtr: klikněte a zaškrtněte hodnoty.";
        c.headerFilterFunc = filtrVyctu;
        c.headerFilterEmptyCheck = function (v) { return !v || !v.length; };
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
        if (!st && N.vychozi) st = N.vychozi;
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
        var p = typy[f.field] === "cislo" && typeof f.value === "string" ? f.value : popisFiltru(f.value); if (!p) return;
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
      tab.download("xlsx", nazevSouboru("xlsx"), { sheetName: N.nazev.slice(0, 31) }, "active");
    });
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
            vstup = '<input data-pole="' + e(s.pole) + '" type="' + (typ === "cislo" ? "number" : typ === "datum" ? "date" : "text") + '" value="' + e(v) + '">';
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
          if (String(r[s.pole] ?? "") !== i.value) zmeny.push({ s: s, v: i.value });
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

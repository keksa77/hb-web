// Seznamka – Hledám tým / Hledáme běžce (Keksa 11. 10. 2026). Veřejný seznam inzerátů běžců bez týmu a poptávek týmů,
// kontakt přes formulář (e-mail autora se nikde neukáže), nový inzerát běžce se zveřejní až po potvrzení odkazem z e-mailu.
// Jména veřejně jen „Jméno I.“. Inzeráty zmizí po skončení závodu. Poptávku za tým zadává kapitán nebo zástupce v kapitánské sekci.
// Databáze: web_seznamka_seznam, web_seznamka_pridat, web_seznamka_napsat (bez přihlášení).
(function () {
  var C = window.HB, KRAJE = [];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  async function rpc(f, d) {
    var r = await fetch(C.url + "/rest/v1/rpc/" + f, { method: "POST", headers: { apikey: C.klic, Authorization: "Bearer " + C.klic, "Content-Type": "application/json" }, body: JSON.stringify(d || {}) });
    var j = await r.json().catch(function () { return null; });
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || "Chyba " + r.status);
    return j;
  }
  window.HBS = { rpc: rpc, esc: esc, kraje: async function () {
    if (KRAJE.length) return KRAJE;
    var r = await fetch(C.url + "/rest/v1/web_kraj?select=kod,nazev,zeme&aktivni=eq.true&order=poradi", { headers: { apikey: C.klic, Authorization: "Bearer " + C.klic } });
    KRAJE = r.ok ? await r.json() : []; return KRAJE;
  }, krajSelect: function (id, vybrany) {
    var Z = { CZ: "Česko", SK: "Slovensko", PL: "Polsko" }, z = null, h = '<select id="' + id + '"><option value="">— neuvádím —</option>';
    KRAJE.forEach(function (k) { if (k.zeme !== z) { if (z) h += "</optgroup>"; z = k.zeme; h += '<optgroup label="' + esc(Z[z] || z) + '">'; }
      h += '<option value="' + esc(k.kod) + '"' + (k.kod === vybrany ? " selected" : "") + ">" + esc(k.nazev) + "</option>"; });
    return h + (z ? "</optgroup>" : "") + "</select>";
  } };

  var D = null, el = document.getElementById("seznamka"), F = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
  if (!el) return;

  function inzerat(x) {
    var tym = x.druh === "tym";
    return '<article class="sz-inzerat" id="sz-' + x.id + '"><h3>' + esc(tym ? x.tym : x.jmeno) + "</h3>" +
      '<p class="sz-meta">' + [tym ? "hledá " + x.pocet + (x.pocet < 5 ? " běžce" : " běžců") : (x.etap ? "zvládne " + x.etap + (x.etap === 1 ? " etapu" : x.etap < 5 ? " etapy" : " etap") : ""),
        x.kraj, x.vykonnost ? x.vykonnost + " min / 10 km" : "", "přidáno " + F.format(new Date(x.vytvoreno))].filter(Boolean).map(esc).join(" · ") + "</p>" +
      '<p class="sz-text">' + esc(x.text) + "</p>" +
      '<div class="sz-napsat-misto"><button type="button" class="sz-vedlejsi" data-napsat="' + x.id + '">' + (tym ? "Napsat týmu" : "Napsat běžci") + "</button></div></article>";
  }

  function vykresli() {
    var tymy = D.inzeraty.filter(function (x) { return x.druh === "tym"; }), bezci = D.inzeraty.filter(function (x) { return x.druh === "bezec"; });
    var h = '<p class="sz-pozn">Hledáš tým, nebo běžce do týmu? Napiš inzerát. Na webu se ukáže jen křestní jméno a první písmeno příjmení, ' +
      "e-mail nikde. Kdo ti chce napsat, použije formulář a zprávu ti pošleme e-mailem. Inzeráty zmizí po skončení závodu.</p>";
    h += '<div class="sz-sloupce"><section><h2>Týmy hledají běžce</h2>' + (tymy.length ? tymy.map(inzerat).join("") : '<p class="sz-prazdno">Zatím žádná poptávka.</p>') +
      '<p class="sz-pozn">Kapitán nebo zástupce zadá poptávku za tým v <a href="' + C.zaklad + '/kapitan/seznamka/">kapitánské sekci</a>.</p></section>' +
      "<section><h2>Běžci hledají tým</h2>" + (bezci.length ? bezci.map(inzerat).join("") : '<p class="sz-prazdno">Zatím žádný inzerát.</p>') + "</section></div>";
    if (D.otevreno) h += '<div id="sz-pridat-misto"><button type="button" class="sz-tlacitko" id="sz-pridat">Přidat inzerát – hledám tým</button></div>';
    else h += '<p class="sz-prazdno">Seznamka letos skončila.</p>';
    el.innerHTML = h;
  }

  function formNapsat(id) {
    return '<form class="sz-form" data-form-napsat="' + id + '" novalidate>' +
      '<div class="sz-radek"><label>Tvoje jméno *<input name="jmeno" autocomplete="name"></label><label>Tvůj e-mail *<input name="email" type="email" autocomplete="email"><small>Na něj ti autor odpoví.</small></label></div>' +
      '<label>Zpráva *<textarea name="text" rows="4" maxlength="2000"></textarea></label><p class="sz-hlaska" role="status"></p>' +
      '<button type="submit" class="sz-tlacitko">Odeslat zprávu</button> <button type="button" class="sz-vedlejsi" data-zavrit>Zavřít</button></form>';
  }

  function formPridat() {
    return '<form class="sz-form" id="sz-form-pridat" novalidate><h2>Hledám tým</h2>' +
      '<div class="sz-radek"><label>Jméno *<input name="jmeno" autocomplete="given-name"></label><label>Příjmení *<input name="prijmeni" autocomplete="family-name"><small>Na webu jen první písmeno.</small></label></div>' +
      '<label>E-mail *<input name="email" type="email" autocomplete="email"><small>Nikde se neukáže. Přijde na něj odkaz, kterým inzerát zveřejníš, upravíš nebo stáhneš.</small></label>' +
      '<div class="sz-radek"><label>Kraj' + HBS.krajSelect("sz-kraj") + '</label><label>Výkonnost na 10 km<input name="vykonnost" inputmode="numeric" placeholder="52:30"></label>' +
      '<label>Kolik etap zvládneš<input name="etap" type="number" min="1" max="30" inputmode="numeric"></label></div>' +
      '<label>O mně *<textarea name="text" rows="4" maxlength="1000" placeholder="Jak běháš, odkud jsi, jestli máš auto…"></textarea></label>' +
      '<p class="sz-hlaska" role="status"></p><button type="submit" class="sz-tlacitko">Odeslat inzerát</button> <button type="button" class="sz-vedlejsi" data-zavrit-pridat>Zavřít</button></form>';
  }

  function hlaska(f, t, chyba) { var h = f.querySelector(".sz-hlaska"); h.textContent = t; h.className = "sz-hlaska" + (t ? (chyba ? " chyba" : " ok") : ""); }

  el.addEventListener("click", async function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.napsat) { b.parentNode.innerHTML = formNapsat(b.dataset.napsat); return; }
    if ("zavrit" in b.dataset) { var f = b.closest("form"); f.parentNode.innerHTML = '<button type="button" class="sz-vedlejsi" data-napsat="' + f.dataset.formNapsat + '">Napsat</button>'; return; }
    if (b.id === "sz-pridat") { await HBS.kraje(); document.getElementById("sz-pridat-misto").innerHTML = formPridat(); return; }
    if ("zavritPridat" in b.dataset) { document.getElementById("sz-pridat-misto").innerHTML = '<button type="button" class="sz-tlacitko" id="sz-pridat">Přidat inzerát – hledám tým</button>'; }
  });

  el.addEventListener("input", function (ev) { var f = ev.target.closest && ev.target.closest("form"); if (f && f.querySelector(".sz-hlaska")) hlaska(f, ""); });
  el.addEventListener("submit", async function (ev) {
    ev.preventDefault(); var f = ev.target, v = function (n) { return (f.elements[n] && f.elements[n].value || "").trim(); };
    var b = f.querySelector("button[type=submit]");
    if (f.dataset.formNapsat) {
      if (!v("jmeno")) return hlaska(f, "Napiš své jméno.", true);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) return hlaska(f, "E-mail nemá správný tvar.", true);
      if (!v("text")) return hlaska(f, "Napiš zprávu.", true);
      b.disabled = true;
      try { await rpc("web_seznamka_napsat", { p_id: Number(f.dataset.formNapsat), p_jmeno: v("jmeno"), p_email: v("email"), p_text: v("text") });
        f.parentNode.innerHTML = '<p class="sz-hlaska ok">Zpráva je odeslaná. Autor ti odpoví na tvůj e-mail.</p>'; }
      catch (e) { hlaska(f, e.message, true); b.disabled = false; }
      return;
    }
    if (f.id === "sz-form-pridat") {
      if (!v("jmeno") || !v("prijmeni")) return hlaska(f, "Vyplň jméno a příjmení.", true);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) return hlaska(f, "E-mail nemá správný tvar.", true);
      if (v("vykonnost") && !/^\d{1,2}:\d{2}$/.test(v("vykonnost"))) return hlaska(f, "Výkonnost napiš jako čas na 10 km, např. 52:30.", true);
      if (!v("text")) return hlaska(f, "Napiš pár slov o sobě.", true);
      b.disabled = true;
      try { await rpc("web_seznamka_pridat", { p_jmeno: v("jmeno"), p_prijmeni: v("prijmeni"), p_email: v("email"), p_kraj: document.getElementById("sz-kraj").value || null,
          p_vykonnost: v("vykonnost") || null, p_etap: v("etap") ? Number(v("etap")) : null, p_text: v("text") });
        document.getElementById("sz-pridat-misto").innerHTML = '<p class="sz-pozn"><b>Skoro hotovo.</b> Poslali jsme ti e-mail s odkazem. Inzerát se zveřejní, až na odkaz klikneš.</p>'; }
      catch (e) { hlaska(f, e.message, true); b.disabled = false; }
    }
  });

  rpc("web_seznamka_seznam").then(function (d) { D = d; vykresli(); }).catch(function (e) { el.innerHTML = '<p class="sz-hlaska chyba">' + esc(e.message) + "</p>"; });
})();

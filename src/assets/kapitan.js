// Kapitánská sekce Hory Bory – společný základ: přihlášení odkazem z mailu, relace, volání databáze.
// Přihlášení bez hesla: Supabase Auth pošle na e-mail jednorázový odkaz (magic link).
// Co kdo vidí a smí, hlídá databáze (funkce web_k_*): kapitán a zástupce celý tým, běžec své údaje.
(function () {
  var KLIC_RELACE = "hb_kapitan_relace";

  function nactiRelaci() {
    try { return JSON.parse(localStorage.getItem(KLIC_RELACE) || "null"); } catch (e) { return null; }
  }
  function ulozRelaci(r) {
    try {
      if (r) localStorage.setItem(KLIC_RELACE, JSON.stringify(r));
      else localStorage.removeItem(KLIC_RELACE);
    } catch (e) { /* bez úložiště se jen nepamatuje přihlášení */ }
  }
  function zRelace(j) {
    return { access_token: j.access_token, refresh_token: j.refresh_token,
             vyprsi: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  }

  async function auth(cesta, telo) {
    var r = await fetch(HB.url + "/auth/v1/" + cesta, {
      method: "POST",
      headers: { apikey: HB.klic, "Content-Type": "application/json" },
      body: JSON.stringify(telo)
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var zprava = j.error_description || j.msg || j.message || ("Chyba " + r.status);
      if (/rate limit|security purposes/i.test(zprava)) zprava = "Odkaz jsme posílali před chvílí. Zkus to prosím za minutu znovu.";
      throw new Error(zprava);
    }
    return j;
  }

  // Pošle na e-mail přihlašovací odkaz. Odkaz vede zpět na stránku přihlášení.
  async function poslatOdkaz(email) {
    var zpet = location.origin + HB.zaklad + "/kapitan/prihlaseni/";
    await auth("otp?redirect_to=" + encodeURIComponent(zpet), { email: String(email || "").trim(), create_user: true });
  }

  // Po kliknutí na odkaz z mailu přijdou údaje relace v adrese za #. Uloží je a adresu vyčistí.
  function prevezmiZOdkazu() {
    if (!location.hash || location.hash.length < 2) return null;
    var p = new URLSearchParams(location.hash.slice(1));
    if (p.get("error_description") || p.get("error")) {
      history.replaceState(null, "", location.pathname + location.search);
      var chyba = p.get("error_description") || p.get("error");
      if (/expired|invalid/i.test(chyba)) chyba = "Odkaz už neplatí. Nech si poslat nový.";
      return { chyba: chyba };
    }
    if (!p.get("access_token")) return null;
    ulozRelaci(zRelace({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_in: p.get("expires_in") }));
    try { sessionStorage.removeItem("hb_kapitan_dokonceno"); } catch (e) {}
    history.replaceState(null, "", location.pathname + location.search);
    return { ok: true };
  }

  async function platnyToken() {
    var r = nactiRelaci();
    if (!r) return null;
    if (Date.now() < r.vyprsi - 60000) return r.access_token;
    try {
      var j = await auth("token?grant_type=refresh_token", { refresh_token: r.refresh_token });
      var n = zRelace(j); ulozRelaci(n); return n.access_token;
    } catch (e) { ulozRelaci(null); return null; }
  }

  async function odhlasit() {
    var t = await platnyToken();
    if (t) {
      fetch(HB.url + "/auth/v1/logout", { method: "POST",
        headers: { apikey: HB.klic, Authorization: "Bearer " + t } }).catch(function () {});
    }
    ulozRelaci(null);
    try { sessionStorage.removeItem("hb_kapitan_dokonceno"); } catch (e) {}
    location.href = HB.zaklad + "/kapitan/prihlaseni/";
  }

  async function db(cesta, volby) {
    volby = volby || {};
    var t = await platnyToken();
    var hlavicky = { apikey: HB.klic, "Content-Type": "application/json" };
    if (t) hlavicky.Authorization = "Bearer " + t;
    var r = await fetch(HB.url + "/rest/v1/" + cesta, {
      method: volby.metoda || "GET", headers: hlavicky,
      body: volby.telo ? JSON.stringify(volby.telo) : undefined
    });
    var text = await r.text();
    var j = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || ("Chyba " + r.status));
    return j;
  }
  function rpc(fce, data) { return db("rpc/" + fce, { metoda: "POST", telo: data || {} }); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function datum(d) {
    if (!d) return "–";
    var x = new Date(String(d).length === 10 ? d + "T12:00:00" : d);
    return x.getDate() + ". " + (x.getMonth() + 1) + ". " + x.getFullYear();
  }
  function cas(d) {
    if (!d) return "–";
    var x = new Date(d);
    return datum(d) + " " + String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0");
  }
  function kc(n) { return n == null ? "–" : Number(n).toLocaleString("cs-CZ") + " Kč"; }
  // interval z databáze („00:52:30“) → „52:30“, „1:05:00“
  function vykonnost(v) {
    if (!v) return "";
    var m = String(v).match(/^(\d+):(\d{2}):(\d{2})/);
    if (!m) return String(v);
    var h = Number(m[1]);
    return h ? h + ":" + m[2] + ":" + m[3] : Number(m[2]) + ":" + m[3];
  }

  function hlaska(el, text, chyba) {
    if (typeof el === "string") el = document.getElementById(el);
    if (!el) return;
    el.textContent = text || "";
    el.className = "k-hlaska" + (text ? (chyba ? " k-hlaska-chyba" : " k-hlaska-ok") : "");
  }

  // Krátká hláška dole na obrazovce, když se po uložení stránka překreslí (Keksa 4. 10. 2026).
  var toastCasovac = null;
  function toast(text) {
    var el = document.getElementById("k-toast");
    if (!el) { el = document.createElement("div"); el.id = "k-toast"; el.className = "k-toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = text; el.hidden = false;
    clearTimeout(toastCasovac); toastCasovac = setTimeout(function () { el.hidden = true; }, 4000);
  }

  // Stránky sekce zavolají HBK.vyzadovat(): ověří přihlášení, propojí účet s osobou a vrátí přehled týmu.
  async function vyzadovat() {
    var obsah = document.getElementById("k-obsah");
    if (!(await platnyToken())) {
      location.href = HB.zaklad + "/kapitan/prihlaseni/?zpet=" + encodeURIComponent(location.pathname);
      return null;
    }
    var hotovo = false;
    try { hotovo = sessionStorage.getItem("hb_kapitan_dokonceno") === "1"; } catch (e) {}
    if (!hotovo) {
      try { await rpc("web_prihlaseni_dokonci"); try { sessionStorage.setItem("hb_kapitan_dokonceno", "1"); } catch (e) {} }
      catch (e) { if (obsah) obsah.innerHTML = '<p class="k-chyba">' + esc(e.message) + "</p>"; return null; }
    }
    var p = null;
    try { p = await rpc("web_k_prehled"); } catch (e) {
      if (obsah) obsah.innerHTML = '<p class="k-chyba">' + esc(e.message) + "</p>"; return null;
    }
    var lista = document.getElementById("k-lista");
    if (!p) {
      if (lista) lista.hidden = false;
      if (obsah) obsah.innerHTML = '<div class="k-karta"><h2>Tým jsme nenašli</h2><p>K tomuhle e-mailu nemáme v letošním ročníku tým ani místo na soupisce. ' +
        'Kapitán tě na soupisku přidá pod e-mailem, na který ti pak přijde i odkaz. Když si myslíš, že jde o chybu, napiš na ' +
        '<a href="mailto:info@horybory.cz">info@horybory.cz</a>.</p></div>';
      return null;
    }
    if (lista) {
      lista.hidden = false;
      var role = { kapitan: "kapitán", zastupce: "zástupce kapitána", bezec: "běžec" }[p.role] || p.role;
      document.getElementById("k-tym").textContent = (p.cislo ? p.cislo + " · " : "") + p.nazev + " · " + role;
    }
    return p;
  }

  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "k-odhlasit") odhlasit();
  });

  window.HBK = { poslatOdkaz: poslatOdkaz, prevezmiZOdkazu: prevezmiZOdkazu, platnyToken: platnyToken,
                 odhlasit: odhlasit, db: db, rpc: rpc, esc: esc, datum: datum, cas: cas, kc: kc,
                 vykonnost: vykonnost, hlaska: hlaska, toast: toast, vyzadovat: vyzadovat };
})();

// Administrace – Fotky: nahrání náhledů 768 px do úložiště fotky-nahledy a spárování s katalogem fotky (Keksa 12. 10. 2026).
// Jméno náhledu určí databáze (web_admin_fotka_zaloz podle ročníku a jména souboru), prohlížeč fotku zmenší a nahraje.
(async function () {
  var j = await HBA.vyzadovat(); if (!j) return;
  var $ = function (id) { return document.getElementById(id); };
  var DELKA = 768, KVALITA = 0.82, SOUBEZNE = 3;
  var rokSel = $("fo-rok"), prehled = null;

  var letos = new Date().getFullYear() % 100 + 1;
  for (var r = letos; r >= 19; r--) {
    var o = document.createElement("option"); o.value = "HB" + r; o.textContent = "HB" + r + " (20" + r + ")"; rokSel.appendChild(o);
  }
  rokSel.value = "HB26";
  rokSel.addEventListener("change", nacti);

  async function nacti() {
    $("fo-prehled").innerHTML = '<p class="adm-sub">Načítám…</p>';
    try {
      prehled = await HBA.rpc("web_admin_fotky_prehled", { p_rok: rokSel.value });
      var s = prehled.sekce || {};
      $("fo-prehled").innerHTML =
        "<p><b>" + prehled.celkem + "</b> fotek v katalogu, <b>" + prehled.s_nahledem + "</b> má náhled, chybí <b>" + prehled.chybi.length + "</b>.</p>" +
        "<p>Na webu: " + prehled.na_webu + " · Start " + (s.start || 0) + " · Trasa " + (s.trasa || 0) + " · Cíl " + (s["cil"] || 0) + " · nezařazeno " + (s.bez || 0) + "</p>" +
        (prehled.chybi.length ? '<p class="adm-sub">Chybí např.: ' + prehled.chybi.slice(0, 8).map(function (x) { return HBA.esc(x.soubor); }).join(", ") + (prehled.chybi.length > 8 ? " …" : "") + "</p>" : "");
    } catch (e) { $("fo-prehled").innerHTML = '<p class="adm-chyba">' + HBA.esc(e.message) + "</p>"; }
  }

  async function zmensi(soubor) {
    var bmp = await createImageBitmap(soubor, { imageOrientation: "from-image" });
    var k = Math.min(1, DELKA / Math.max(bmp.width, bmp.height));
    var c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    var g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    return await new Promise(function (ok) { c.toBlob(ok, "image/jpeg", KVALITA); });
  }

  async function nahraj(soubor) {
    var z = await HBA.rpc("web_admin_fotka_zaloz", { p_rok: rokSel.value, p_soubor: soubor.name,
      p_fotograf: $("fo-fotograf").value || null, p_cas: soubor.lastModified ? new Date(soubor.lastModified).toISOString() : null });
    var blob = await zmensi(soubor);
    var t = await HBA.token();
    var r = await fetch(HB.url + "/storage/v1/object/fotky-nahledy/" + encodeURIComponent(z.nahled), {
      method: "POST", headers: { apikey: HB.klic, Authorization: "Bearer " + t, "Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=31536000" },
      body: blob
    });
    if (!r.ok) { var tx = await r.text(); throw new Error("úložiště " + r.status + " " + tx.slice(0, 120)); }
  }

  async function zpracuj(seznam) {
    var fotky = Array.prototype.filter.call(seznam, function (f) { return /\.(jpe?g|png|webp)$/i.test(f.name) && !/^\._/.test(f.name) && !/__MACOSX/.test(f.webkitRelativePath || ""); });
    if ($("fo-jen-chybejici").checked && prehled) {
      var maji = {}; (prehled.maji || []).forEach(function (x) { maji[x] = 1; });
      fotky = fotky.filter(function (f) { return !maji[f.name]; });
    }
    // stejné jméno ve dvou podsložkách nahraj jen jednou
    var videno = {}; fotky = fotky.filter(function (f) { if (videno[f.name]) return false; videno[f.name] = 1; return true; });
    $("fo-chyby").innerHTML = "";
    $("fo-prubeh").hidden = false;
    var hotovo = 0, chyb = 0, i = 0, n = fotky.length;
    $("fo-progress").max = Math.max(n, 1); $("fo-progress").value = 0;
    $("fo-stav").textContent = n ? "0 / " + n : "Žádná fotka k nahrání.";
    async function pracant() {
      while (i < n) {
        var f = fotky[i++];
        try { await nahraj(f); hotovo++; }
        catch (e) { chyb++; var li = document.createElement("li"); li.textContent = f.name + ": " + e.message; $("fo-chyby").appendChild(li); }
        $("fo-progress").value = hotovo + chyb;
        $("fo-stav").textContent = (hotovo + chyb) + " / " + n + (chyb ? " · chyby: " + chyb : "");
      }
    }
    await Promise.all(Array.from({ length: SOUBEZNE }, pracant));
    $("fo-stav").textContent = "Hotovo: nahráno " + hotovo + (chyb ? ", chyby: " + chyb : "") + ". Na webu se objeví po dalším sestavení webu.";
    nacti();
  }

  $("fo-slozka").addEventListener("change", function (e) { zpracuj(e.target.files); e.target.value = ""; });
  $("fo-soubory").addEventListener("change", function (e) { zpracuj(e.target.files); e.target.value = ""; });
  nacti();
})();

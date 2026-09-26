// Trasa a etapy. Stahuje se ze Supabase při buildu stejně jako ostatní obsah —
// hotové stránky pak mají text i čísla přímo v HTML.
import web from "./web.js";
import gpxData from "./gpx.js";
import { readFile } from "node:fs/promises";

const zeSouboru = process.env.TRASA_ZE_SOUBORU;

async function pohled(cesta) {
  const url = `${web.supabaseUrl}/rest/v1/${cesta}`;
  const odpoved = await fetch(url, {
    headers: { apikey: web.supabaseKlic, Authorization: `Bearer ${web.supabaseKlic}` },
  });
  if (!odpoved.ok) {
    throw new Error(`Supabase nevrátil data pro ${cesta}: ${odpoved.status} ${await odpoved.text()}`);
  }
  return odpoved.json();
}

const cislo = (x) => (x === null || x === undefined || x === "" ? null : Number(x));

// Z času 01:52:00 udělá „1:52 h“.
function hodiny(cas) {
  if (!cas) return null;
  const [h, m] = String(cas).split(":");
  return `${Number(h)}:${m} h`;
}

// Výškový profil: úseky mají jen převýšení a klesání, absolutní výšku dopočítáme
// od výšky startovní předávky. Vrací body pro SVG (x v metrech od startu, y v m n. m.).
function profil(useky, startVyska, gpx) {
  // Když je pro etapu GPX, kreslíme profil z něj — tak vznikaly i staré karty.
  if (gpx && gpx.body.length > 1) {
    return { body: gpx.body, delkaM: gpx.delkaM, min: gpx.min, max: gpx.max,
             startV: gpx.start, cilV: gpx.cil, zdroj: "GPX" };
  }
  const body = [];
  let v = startVyska === null ? 0 : startVyska;
  body.push({ m: 0, v });
  for (const u of useky) {
    v += (u.prevyseni_m || 0) - (u.klesani_m || 0);
    body.push({ m: u.do_m, v });
  }
  const vysky = body.map((b) => b.v);
  return {
    body,
    delkaM: body[body.length - 1].m,
    min: Math.min(...vysky),
    max: Math.max(...vysky),
    startV: body[0].v,
    cilV: body[body.length - 1].v,
    zdroj: "úseky",
  };
}

// Z bodů profilu udělá cestu pro SVG o rozměrech 1000 × 260 (viewBox).
function cesta(p) {
  const S = 1000, V = 260, okraj = 26;
  const rozsah = Math.max(30, p.max - p.min);
  const x = (m) => (p.delkaM ? (m / p.delkaM) * S : 0);
  const y = (v) => V - okraj - ((v - p.min) / rozsah) * (V - 2 * okraj);
  const cara = p.body.map((b, i) => `${i ? "L" : "M"}${x(b.m).toFixed(1)} ${y(b.v).toFixed(1)}`).join(" ");
  const plocha = `${cara} L${S} ${V} L0 ${V} Z`;

  // Popisky nadmořské výšky jako na staré kartě: start, nejvyšší bod, cíl.
  const vrchol = p.body.reduce((a, b) => (b.v > a.v ? b : a), p.body[0]);
  const body = [p.body[0], vrchol, p.body[p.body.length - 1]];
  const popisky = [];
  for (const b of body) {
    if (popisky.some((z) => Math.abs(z.m - b.m) < p.delkaM * 0.08)) continue;
    const px = x(b.m);
    popisky.push({
      m: b.m,
      v: b.v,
      x: Number(px.toFixed(1)),
      y: Number(y(b.v).toFixed(1)),
      // text se u krajů zarovná dovnitř, ať nevyleze mimo obrázek
      kotva: px < S * 0.12 ? "start" : px > S * 0.88 ? "end" : "middle",
    });
  }
  // Měřítko na vodorovné ose. Krok volíme tak, aby popisků bylo pět až osm.
  const km = p.delkaM / 1000;
  const krok = km <= 8 ? 1 : km <= 16 ? 2 : 5;
  const osa = [];
  for (let k = 0; k <= km; k += krok) {
    const px = x(k * 1000);
    osa.push({
      km: k,
      x: Number(px.toFixed(1)),
      kotva: px < S * 0.02 ? "start" : px > S * 0.98 ? "end" : "stred",
    });
  }
  // Jednotka se pověsí za poslední hodnotu, ne na konec osy — jinak by se
  // u etap, které končí těsně za celým kilometrem, popisky překrývaly.
  if (osa.length) osa[osa.length - 1].jednotka = true;

  return { cara, plocha, popisky, osa, S, V };
}

export default async function () {
  const gpx = await gpxData();
  let data;
  if (zeSouboru) {
    data = JSON.parse(await readFile(zeSouboru, "utf8"));
  } else {
    const [rocniky, etapy, useky] = await Promise.all([
      pohled("web_v_rocnik?select=*"),
      pohled("web_v_trasa?select=*&order=cislo"),
      pohled("web_v_trasa_useky?select=*&order=cislo,poradi"),
    ]);
    data = { rocnik: rocniky[0], etapy, useky };
  }

  const rok = data.rocnik ? data.rocnik.rok : null;
  // Rok v názvech karet: 2027 pro HB27. Bere se z data závodu.
  const rokCislo = data.rocnik && data.rocnik.datum_zavodu
    ? String(new Date(data.rocnik.datum_zavodu).getFullYear())
    : "";
  const etapy = data.etapy
    .filter((e) => !rok || e.rok === rok)
    .map((e) => {
      const poradi = String(e.cislo).padStart(2, "0");
      const moje = data.useky.filter((u) => u.cislo === e.cislo && (!rok || u.rok === rok));
      const g = gpx[poradi];
      const p = profil(moje, cislo(e.start_vyska), g);
      const c = cesta(p);
      // Označení předávky: P1 až P30, poslední bod trasy je Cíl.
      const kod = (n) => (n > 30 ? "Cíl" : "P" + n);
      return {
        cislo: e.cislo,
        poradi,
        adresa: `/trasa/etapa-${poradi}/`,
        nazev: e.nazev,
        start: {
          nazev: e.start_nazev, kod: kod(e.cislo),
          lat: cislo(e.start_lat), lon: cislo(e.start_lon), vyska: cislo(e.start_vyska),
          detail: e.start_detail, plny: e.start_detail || e.start_nazev,
        },
        cil: {
          nazev: e.cil_nazev, kod: kod(e.cislo + 1),
          lat: cislo(e.cil_lat), lon: cislo(e.cil_lon), vyska: cislo(e.cil_vyska),
          detail: e.cil_detail, plny: e.cil_detail || e.cil_nazev,
        },
        delkaKm: cislo(e.delka_km),
        prevyseni: cislo(e.prevyseni_m),
        klesani: cislo(e.klesani_m),
        povrch: e.povrch,
        koeficient: cislo(e.koeficient),
        penalizace: hodiny(e.penalizace),
        autoKm: cislo(e.auto_km),
        autoMin: cislo(e.auto_min),
        mapaUrl: e.mapa_url,
        // QR na kartě vede řidiče doprovodu do cíle etapy; trasa běžce je
        // na druhé straně karty přímo v mapě a na stránce jako odkaz.
        qrAuto: e.qr_auto,
        popis: e.popis_trasy,
        video: e.video,
        useky: moje,
        profil: p,
        svg: c,
        pdf: rokCislo ? `/karty/e${poradi}-${rokCislo}.pdf` : null,
        gpx: g ? g.soubor : null,
        obrazky: {
          mapa: `/assets/etapy/e${poradi}-mapa.jpg`,
          parkoviste: `/assets/etapy/e${poradi}-parkoviste.jpg`,
          qr: `/assets/etapy/e${poradi}-qr.svg`,
        },
      };
    })
    .sort((a, b) => a.cislo - b.cislo);

  // sousedi pro přecházení mezi etapami
  etapy.forEach((e, i) => {
    e.predchozi = i > 0 ? etapy[i - 1] : null;
    e.dalsi = i < etapy.length - 1 ? etapy[i + 1] : null;
  });

  const soucet = (klic) => etapy.reduce((s, e) => s + (e[klic] || 0), 0);
  return {
    rocnik: data.rocnik,
    rokCislo,
    etapy,
    celkem: {
      etap: etapy.length,
      km: Math.round(soucet("delkaKm") * 10) / 10,
      prevyseni: soucet("prevyseni"),
      klesani: soucet("klesani"),
    },
  };
}

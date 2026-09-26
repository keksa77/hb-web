// Výškový profil z GPX. Staré karty etap se kreslily přesně z těchhle souborů,
// proto se z nich počítá i teď — jinak by čísla na kartě neseděla s tím, co
// běžci znají. Soubory leží v src/assets/etapy/ a zároveň se vystavují ke stažení.
import { readFile } from "node:fs/promises";

const R = 6371000; // poloměr Země v metrech

function vzdalenost(a, b) {
  const f1 = (a.lat * Math.PI) / 180;
  const f2 = (b.lat * Math.PI) / 180;
  const df = f2 - f1;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Z GPX vytáhne body trasy. Stačí nám lat, lon a nadmořská výška.
function body(xml) {
  const ven = [];
  const re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>\s*<ele>([-\d.]+)<\/ele>/g;
  let m;
  while ((m = re.exec(xml))) {
    ven.push({ lat: Number(m[1]), lon: Number(m[2]), v: Number(m[3]) });
  }
  return ven;
}

// Do obrázku nepotřebujeme všech pět set bodů. Vybereme jich nejvýš 180,
// ale v každém vzorku necháme ten nejvyšší a nejnižší, aby se neztratily špičky.
function prorid(b, kolik = 180) {
  if (b.length <= kolik) return b;
  const krok = b.length / kolik;
  const ven = [b[0]];
  for (let i = 0; i < kolik; i++) {
    const od = Math.floor(i * krok);
    const do_ = Math.min(b.length, Math.floor((i + 1) * krok));
    let nej = b[od], nejn = b[od];
    for (let j = od; j < do_; j++) {
      if (b[j].v > nej.v) nej = b[j];
      if (b[j].v < nejn.v) nejn = b[j];
    }
    const prvni = nej.m <= nejn.m ? nej : nejn;
    const druhy = prvni === nej ? nejn : nej;
    if (prvni !== ven[ven.length - 1]) ven.push(prvni);
    if (druhy !== prvni) ven.push(druhy);
  }
  if (ven[ven.length - 1] !== b[b.length - 1]) ven.push(b[b.length - 1]);
  return ven;
}

export default async function () {
  const vse = {};
  for (let n = 1; n <= 30; n++) {
    const poradi = String(n).padStart(2, "0");
    const cesta = new URL(`../assets/etapy/e${poradi}-2027.gpx`, import.meta.url);
    let xml;
    try {
      xml = await readFile(cesta, "utf8");
    } catch {
      continue; // etapa bez GPX se prostě přeskočí
    }
    const b = body(xml);
    if (b.length < 2) continue;

    let m = 0;
    b[0].m = 0;
    for (let i = 1; i < b.length; i++) {
      m += vzdalenost(b[i - 1], b[i]);
      b[i].m = m;
    }
    const vysky = b.map((p) => p.v);
    vse[poradi] = {
      delkaM: Math.round(m),
      min: Math.round(Math.min(...vysky)),
      max: Math.round(Math.max(...vysky)),
      start: Math.round(b[0].v),
      cil: Math.round(b[b.length - 1].v),
      body: prorid(b).map((p) => ({ m: Math.round(p.m), v: Math.round(p.v) })),
      soubor: `/assets/etapy/e${poradi}-2027.gpx`,
    };
  }
  return vse;
}

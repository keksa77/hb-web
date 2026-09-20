// Obsah webu se stahuje ze Supabase při buildu, ne v prohlížeči návštěvníka.
// Když databáze neodpoví, build spadne schválně — je lepší nevydat nic
// než vydat web s prázdnými stránkami.
import web from "./web.js";
import { readFile } from "node:fs/promises";

// Zkušební režim: když se nastaví OBSAH_ZE_SOUBORU, obsah se vezme z místního
// souboru misto/obsah-nanecisto.json místo z databáze. Slouží jen k vyzkoušení
// šablon tam, kde na Supabase není vidět. Při ostrém buildu se nepoužívá.
const zeSouboru = process.env.OBSAH_ZE_SOUBORU;

async function tabulka(cesta) {
  const url = `${web.supabaseUrl}/rest/v1/${cesta}`;
  const odpoved = await fetch(url, {
    headers: { apikey: web.supabaseKlic, Authorization: `Bearer ${web.supabaseKlic}` },
  });
  if (!odpoved.ok) {
    throw new Error(`Supabase nevrátil data pro ${cesta}: ${odpoved.status} ${await odpoved.text()}`);
  }
  return odpoved.json();
}

// Které textové bloky patří na kterou stránku. Pořadí je pořadí na stránce.
const blokyStranek = {
  "uvod": ["infoList", "whyContent"],
  "o-zavodu": ["proposition"],
  "trasa": ["route", "route-last"],
  "pravidla": ["rules", "outfit", "penalties"],
  "startovne": ["startingFee", "startingPayment", "registration"],
};

export default async function () {
  if (zeSouboru) {
    return JSON.parse(await readFile(zeSouboru, "utf8"));
  }
  const [stranky, preklady, texty, textyPreklady, faq, faqPreklady, jazyky] = await Promise.all([
    tabulka("web_stranky?select=*&order=poradi"),
    tabulka("web_stranky_preklady?select=*"),
    tabulka("web_texty?select=*&order=poradi"),
    tabulka("web_texty_preklady?select=*"),
    tabulka("web_faq?select=*&order=poradi"),
    tabulka("web_faq_preklady?select=*"),
    tabulka("web_jazyky?select=*&order=poradi"),
  ]);

  const jazyk = web.jazyk;
  const textPodleKodu = {};
  for (const t of texty) {
    const p = textyPreklady.find((x) => x.text_id === t.id && x.jazyk === jazyk);
    if (p) textPodleKodu[t.kod] = { titulek: p.titulek, obsah: p.obsah, popis: t.popis };
  }

  const seznamStranek = stranky
    .filter((s) => s.aktivni && s.sekce === "verejna")
    .map((s) => {
      const p = preklady.find((x) => x.stranka_id === s.id && x.jazyk === jazyk);
      if (!p) return null;
      return {
        kod: s.kod,
        stav: s.stav,
        upozorneni: s.upozorneni,
        poradi: s.poradi,
        titulek: p.titulek,
        slug: p.slug,
        adresa: p.slug === "" ? "/" : `/${p.slug}/`,
        text: p.text,
        metaPopis: p.meta_popis,
        bloky: (blokyStranek[s.kod] || []).map((kod) => textPodleKodu[kod]).filter(Boolean),
      };
    })
    .filter(Boolean);

  const otazky = faq
    .filter((f) => f.aktivni)
    .map((f) => {
      const p = faqPreklady.find((x) => x.faq_id === f.id && x.jazyk === jazyk);
      return p ? { poradi: f.poradi, otazka: p.otazka, odpoved: p.odpoved } : null;
    })
    .filter(Boolean);

  return {
    stranky: seznamStranek,
    otazky,
    jazyky: jazyky.filter((j) => j.aktivni),
    staženo: new Date().toISOString(),
  };
}

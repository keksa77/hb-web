import { readFileSync } from "node:fs";

// Číslo nasazené verze: verze z package.json + pořadové číslo sestavení na GitHubu.
// Mimo GitHub (sestavení u sebe) se ukáže „místní“.
const balicek = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const zaklad = balicek.version.split(".").slice(0, 2).join(".");
const sestaveni = process.env.GITHUB_RUN_NUMBER;
const sestaveno = new Date().toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric",
  year: "numeric", hour: "2-digit", minute: "2-digit" });

// Nastavení webu. Klíč je veřejný (publishable) — sám o sobě neotevře nic,
// dovnitř pouštějí až pravidla (policy) v databázi.
export default {
  nazev: "Hory Bory",
  popis: "Štafetový běh z Beskyd na Pálavu. 30 etap, nepřetržitě dnem i nocí.",
  supabaseUrl: process.env.SUPABASE_URL || "https://rjuxqlyckikuxfaeaozf.supabase.co",
  supabaseKlic: process.env.SUPABASE_KLIC || "sb_publishable_wsSsZ1hCLbrRThr8Co4xbg_W9yAucb6",
  // Adresa, pod kterou web běží. Na testovací adrese GitHub Pages je web
  // v podsložce /hb-web/, na ostrém webu v kořeni.
  zaklad: process.env.ZAKLAD_URL || "",
  jazyk: "cs",
  verze: sestaveni ? "v" + zaklad + "." + sestaveni : "místní",
  commit: (process.env.GITHUB_SHA || "").slice(0, 7),
  sestaveno,
};

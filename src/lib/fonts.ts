import {
  Inter,
  Playfair_Display,
  Lora,
  JetBrains_Mono,
  Caveat,
  Space_Grotesk,
} from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const allFontVariables = [
  inter.variable,
  playfair.variable,
  lora.variable,
  jetbrainsMono.variable,
  caveat.variable,
  spaceGrotesk.variable,
].join(" ");

export type DiaryFontId =
  | "inter"
  | "playfair"
  | "lora"
  | "mono"
  | "caveat"
  | "space";

export const DIARY_FONTS: {
  id: DiaryFontId;
  label: string;
  cssVar: string;
}[] = [
  { id: "inter", label: "Sans", cssVar: "var(--font-inter), sans-serif" },
  { id: "lora", label: "Livro", cssVar: "var(--font-lora), serif" },
  { id: "playfair", label: "Editorial", cssVar: "var(--font-playfair), serif" },
  { id: "space", label: "Geométrica", cssVar: "var(--font-space), sans-serif" },
  { id: "mono", label: "Mono", cssVar: "var(--font-mono), monospace" },
  { id: "caveat", label: "Manuscrita", cssVar: "var(--font-caveat), cursive" },
];

export const DIARY_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "white", label: "Branco", hex: "#FFFFFF" },
  { id: "silver", label: "Prata", hex: "#D4D4D8" },
  { id: "smoke", label: "Cinza", hex: "#A1A1AA" },
  { id: "cream", label: "Papel", hex: "#F5EFE6" },
  { id: "amber", label: "Âmbar", hex: "#FDE68A" },
  { id: "ice", label: "Gelo", hex: "#BAE6FD" },
  { id: "mint", label: "Menta", hex: "#A7F3D0" },
  { id: "lavender", label: "Lavanda", hex: "#DDD6FE" },
  { id: "rose", label: "Rosa", hex: "#FBCFE8" },
];

export type DiaryFontSize = "sm" | "md" | "lg" | "xl";

export const DIARY_FONT_SIZES: {
  id: DiaryFontSize;
  label: string;
  px: string;
}[] = [
  { id: "sm", label: "P", px: "15px" },
  { id: "md", label: "M", px: "17px" },
  { id: "lg", label: "G", px: "20px" },
  { id: "xl", label: "XG", px: "24px" },
];

export type DiaryTextAlign = "left" | "center" | "right" | "justify";

export type DiaryPaperStyle = "clear" | "frosted" | "lined" | "obsidian";

export const DIARY_PAPER_STYLES: { id: DiaryPaperStyle; label: string }[] = [
  { id: "clear", label: "Vidro" },
  { id: "frosted", label: "Fosco" },
  { id: "lined", label: "Pautado" },
  { id: "obsidian", label: "Escuro" },
];

export function getFontCss(id: DiaryFontId): string {
  return (
    DIARY_FONTS.find((f) => f.id === id)?.cssVar ??
    "var(--font-inter), sans-serif"
  );
}

export function getFontSizePx(size: DiaryFontSize): string {
  return DIARY_FONT_SIZES.find((s) => s.id === size)?.px ?? "17px";
}

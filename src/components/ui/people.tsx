import type { CharacterId } from "@/lib/simulation/characters";
import { PixelSprite, type SpriteGrid, type SpritePalette } from "./PixelSprite";

type PersonProps = { id: CharacterId; size?: number; bob?: boolean; label?: string; className?: string };

const SKIN = "#f2c79b";
const SKIN_DARK = "#d9a273";

/* ---------- Finn, Finance Bro: Gel-Tolle, Hemd, Steppweste ---------- */
const FINANCE_BRO: SpriteGrid = [
  "....hhhhhhhh....",
  "...hhhhhhhhhhh..",
  "..hhhhhhhhhhhh..",
  "..hhsssssssshh..",
  "...ssssssssss...",
  "...sskssssksss..",
  "...ssssssssss...",
  "...ssssssssss...",
  "....sssskkks....",
  ".....ssssss.....",
  "...vvvllllvvv...",
  "..vvvvlllvvvvv..",
  ".vvvvvlllvvvvvv.",
  ".svvvvlllvvvvvs.",
  "...bbbbbbbbbb...",
  "...kkk....kkk...",
];
const FINANCE_BRO_COLORS: SpritePalette = { h: "#6b4423", s: SKIN, k: "var(--px-ink)", v: "#1f3a5f", l: "#bcd6f2", b: "#c9b38a" };

/* ---------- Oma Gisela: Dutt, Brille, Falten, Strickjacke mit Perlen ---------- */
const OMA: SpriteGrid = [
  "......gggg......",
  ".....gggggg.....",
  "....gggggggg....",
  "...gggggggggg...",
  "...gssssssssg...",
  "...kkkkskkkks...",
  "...kwwkskwwks...",
  "...kkkkskkkks...",
  "...rssssssssr...",
  "....ssssssss....",
  ".....skkkks.....",
  "...ppwppwppwpp..",
  "..pppppppppppp..",
  ".sspppppppppppss",
  "..dddddddddddd..",
  "...kk......kk...",
];
const OMA_COLORS: SpritePalette = { g: "#c8c8cc", s: SKIN, k: "var(--px-ink)", w: "#dbeeff", r: SKIN_DARK, p: "#8a5aa8", d: "#5b4a6b" };

/* ---------- Bauer Heinz: Schirmmütze, Schnurrbart, Karohemd, Latzhose ---------- */
const LANDWIRT: SpriteGrid = [
  "................",
  "....cccccccc....",
  "...cccccccccc...",
  "...ccccccccccccc",
  "...ssssssssss...",
  "...sskssssksss..",
  "...ssssssssss...",
  "...shhhhhhhhs...",
  "....ssskkksss...",
  ".....ssssss.....",
  "...rwrooooowr...",
  "..rwrrooyyoorwr.",
  ".rwrroooooooorwr",
  ".ssrroooooooorss",
  "....oooo.oooo...",
  "...kkkk...kkkk..",
];
const LANDWIRT_COLORS: SpritePalette = { c: "#3d7a2a", s: SKIN, k: "var(--px-ink)", h: "#8a5a2b", r: "var(--px-red)", w: "#f6e7e7", o: "#3e6fb0", y: "var(--px-yellow)" };

/* ---------- Lea, Umweltaktivistin: lange Haare mit Blume, Pulli mit Blatt ---------- */
const UMWELT: SpriteGrid = [
  ".....hhhhhh.....",
  "....hhhhhhhhff..",
  "...hhhhhhhhhfyf.",
  "...hhssssssshff.",
  "..hhsssssssshh..",
  "..hhskksskksshh.",
  "..hhssssssssshh.",
  "..hhsssrrssssh..",
  "..hhhssssssshh..",
  "..hhh.ssssss.hh.",
  "...ggggggggggg..",
  "..ggggglllgggg..",
  ".ggggglllggggggg",
  ".sggggglggggggs.",
  "...bbbbbbbbbb...",
  "...kk......kk...",
];
const UMWELT_COLORS: SpritePalette = { h: "#a0522d", f: "#e85d9a", y: "var(--px-yellow)", s: SKIN, k: "var(--px-ink)", r: "#c96a5a", g: "var(--px-green)", l: "#d9f5cf", b: "#3e6fb0" };

/* ---------- Mika aus Berlin: Mütze, runde Brille, Hoodie, Club-Mate ---------- */
const BERLIN: SpriteGrid = [
  ".....mmmmmm.....",
  "....mmmmmmmm....",
  "...mmmmmmmmmm...",
  "...wwwwwwwwww...",
  "...ssssssssss...",
  "...kkksskkkss...",
  "...kwkkkkwkss...",
  "...kkksskkkss...",
  "...ssshhhhsss...",
  "....sshhhhss....",
  "...dddddddddd...",
  "..dddddpdddddd..",
  ".ddddddddddddyy.",
  ".sddddddddddsoy.",
  "...nnnnnnnnnnoy.",
  "...kk......kk...",
];
const BERLIN_COLORS: SpritePalette = { m: "var(--px-red)", w: "#f2e4e4", s: SKIN, k: "var(--px-ink)", h: "#5c3a1a", d: "#2e2e3a", p: "#e85d9a", n: "#4a4a5a", y: "#f2a33a", o: "#7a4a14" };

/* ---------- Karen: blonder Bob, Sonnenbrille im Haar, zwei Kinder ---------- */
const KAREN: SpriteGrid = [
  "....kkkkkkk.....",
  "...yyyyyyyyyy...",
  "..yyyyyyyyyyyy..",
  "..yyysssssssyy..",
  "..yyssssssssy...",
  "..yysksssskss...",
  "..yyssssssss....",
  "..yyssskksss....",
  "....ssssssss....",
  "....pppppppp....",
  "cc.pppppppppp.ee",
  "ss.pppppppppp.ss",
  "aa.ssppppppss.ff",
  "aa..jjjjjjjj..ff",
  "kk..jjjjjjjj..kk",
  "....kk....kk....",
];
const KAREN_COLORS: SpritePalette = { y: "#f2d16b", s: SKIN, k: "var(--px-ink)", p: "#e87fae", j: "#3e6fb0", c: "#6b4423", a: "#59c06b", e: "#f2d16b", f: "#f28c38" };

const SPRITES: Record<CharacterId, [SpriteGrid, SpritePalette]> = {
  "finance-bro": [FINANCE_BRO, FINANCE_BRO_COLORS],
  oma: [OMA, OMA_COLORS],
  landwirt: [LANDWIRT, LANDWIRT_COLORS],
  umwelt: [UMWELT, UMWELT_COLORS],
  berlin: [BERLIN, BERLIN_COLORS],
  karen: [KAREN, KAREN_COLORS],
};

/** Eine der sechs festen Bürgerfiguren als Pixel-Sprite. */
export function PersonSprite({ id, size = 64, bob = true, label, className }: PersonProps) {
  const [grid, palette] = SPRITES[id];
  return <PixelSprite grid={grid} palette={palette} size={size} bob={bob} label={label} className={className} />;
}

export const PERSON_GRIDS = SPRITES;

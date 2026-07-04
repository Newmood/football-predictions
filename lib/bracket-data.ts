export type MatchId = string;

export type Stage =
  | "Round of 32"
  | "Round of 16"
  | "Quarter-finals"
  | "Semi-finals"
  | "Final"
  | "Bronze final";

export type Team = {
  id: string;
  name: string;
  code: string;
  flag: string;
};

export type Match = {
  id: MatchId;
  stage: Stage;
  side: "left" | "right" | "center";
  slot: number;
  matchNumber: number;
  dateLabel: string;
  label: string;
  teamIds: [string | null, string | null];
  sourceMatchIds?: [MatchId, MatchId];
  loserSourceMatchIds?: [MatchId, MatchId];
  actualScoreLabels?: [string | null, string | null];
  actualWinnerId?: string | null;
};

export type BracketData = {
  title: string;
  subtitle: string;
  updatedAt: string;
  fetchedAt: string;
  sourceName: string;
  sourceUrl: string;
  teams: Team[];
  matches: Match[];
};

export const stageOrder: Stage[] = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Final",
  "Bronze final"
];

const TEAM_LOOKUP: Record<string, Omit<Team, "id">> = {
  ALG: { code: "ALG", name: "Algeria", flag: "🇩🇿" },
  ARG: { code: "ARG", name: "Argentina", flag: "🇦🇷" },
  AUS: { code: "AUS", name: "Australia", flag: "🇦🇺" },
  AUT: { code: "AUT", name: "Austria", flag: "🇦🇹" },
  BEL: { code: "BEL", name: "Belgium", flag: "🇧🇪" },
  BIH: { code: "BIH", name: "Bosnia and Herzegovina", flag: "🇧🇦" },
  BRA: { code: "BRA", name: "Brazil", flag: "🇧🇷" },
  CAN: { code: "CAN", name: "Canada", flag: "🇨🇦" },
  CIV: { code: "CIV", name: "Ivory Coast", flag: "🇨🇮" },
  COD: { code: "COD", name: "DR Congo", flag: "🇨🇩" },
  COL: { code: "COL", name: "Colombia", flag: "🇨🇴" },
  CPV: { code: "CPV", name: "Cape Verde", flag: "🇨🇻" },
  CRO: { code: "CRO", name: "Croatia", flag: "🇭🇷" },
  ECU: { code: "ECU", name: "Ecuador", flag: "🇪🇨" },
  EGY: { code: "EGY", name: "Egypt", flag: "🇪🇬" },
  ENG: { code: "ENG", name: "England", flag: "🏴" },
  ESP: { code: "ESP", name: "Spain", flag: "🇪🇸" },
  FRA: { code: "FRA", name: "France", flag: "🇫🇷" },
  GER: { code: "GER", name: "Germany", flag: "🇩🇪" },
  GHA: { code: "GHA", name: "Ghana", flag: "🇬🇭" },
  JPN: { code: "JPN", name: "Japan", flag: "🇯🇵" },
  MAR: { code: "MAR", name: "Morocco", flag: "🇲🇦" },
  MEX: { code: "MEX", name: "Mexico", flag: "🇲🇽" },
  NED: { code: "NED", name: "Netherlands", flag: "🇳🇱" },
  NOR: { code: "NOR", name: "Norway", flag: "🇳🇴" },
  PAR: { code: "PAR", name: "Paraguay", flag: "🇵🇾" },
  POR: { code: "POR", name: "Portugal", flag: "🇵🇹" },
  RSA: { code: "RSA", name: "South Africa", flag: "🇿🇦" },
  SEN: { code: "SEN", name: "Senegal", flag: "🇸🇳" },
  SUI: { code: "SUI", name: "Switzerland", flag: "🇨🇭" },
  SWE: { code: "SWE", name: "Sweden", flag: "🇸🇪" },
  USA: { code: "USA", name: "United States", flag: "🇺🇸" }
};

export function getTeamDefinition(code: string): Team {
  const known = TEAM_LOOKUP[code];

  if (known) {
    return {
      id: code.toLowerCase(),
      ...known
    };
  }

  return {
    id: code.toLowerCase(),
    code,
    name: code,
    flag: "🏳️"
  };
}

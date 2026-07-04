import { BracketData, Match, MatchId, Team, getTeamDefinition } from "@/lib/bracket-data";

const WIKIPEDIA_API_URL =
  "https://en.wikipedia.org/w/api.php?action=parse&page=2026_FIFA_World_Cup_knockout_stage&prop=wikitext&format=json&formatversion=2";

type ParsedScore = {
  label: string | null;
  value: number | null;
  shootout: number | null;
};

type ParsedLine = {
  dateLabel: string;
  team1Code: string | null;
  team2Code: string | null;
  score1: ParsedScore;
  score2: ParsedScore;
  winnerCode: string | null;
};

type WikipediaResponse = {
  parse?: {
    wikitext?: string;
  };
};

export async function fetchLiveBracketData() {
  const response = await fetch(WIKIPEDIA_API_URL, {
    next: { revalidate: 300 }
  });

  if (!response.ok) {
    throw new Error(`Live bracket fetch failed with ${response.status}`);
  }

  const payload = (await response.json()) as WikipediaResponse;
  const wikitext = payload.parse?.wikitext;

  if (!wikitext) {
    throw new Error("Live bracket fetch returned no wikitext.");
  }

  return buildBracketDataFromWikipedia(wikitext);
}

export function buildBracketDataFromWikipedia(wikitext: string): BracketData {
  const blockMatch = wikitext.match(
    /<section begin="Bracket" \/>\{\{#invoke:RoundN\|N32([\s\S]*?)\}\}<section end="Bracket" \/>/
  );

  if (!blockMatch) {
    throw new Error("Could not locate bracket block in live source.");
  }

  const lines = blockMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|June") || line.startsWith("|July"));

  if (lines.length !== 32) {
    throw new Error(`Expected 32 bracket lines, found ${lines.length}.`);
  }

  const parsed = lines.map(parseBracketLine);
  const teams = buildTeams(parsed);
  const matches = buildMatches(parsed);

  return {
    title: "FIFA Prediction Board",
    subtitle: "Live knockout board with editable future predictions and goal picks.",
    updatedAt: new Date().toISOString().slice(0, 10),
    fetchedAt: new Date().toISOString(),
    sourceName: "Wikipedia knockout-stage wikitext",
    sourceUrl: "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage",
    teams,
    matches
  };
}

function buildTeams(parsedLines: ParsedLine[]): Team[] {
  const seen = new Set<string>();
  const teams: Team[] = [];

  for (const line of parsedLines) {
    for (const code of [line.team1Code, line.team2Code]) {
      if (!code || seen.has(code)) {
        continue;
      }

      seen.add(code);
      teams.push(getTeamDefinition(code));
    }
  }

  return teams.sort((a, b) => a.code.localeCompare(b.code));
}

function buildMatches(parsed: ParsedLine[]): Match[] {
  const ids = {
    r32Left: [
      "r32-left-1",
      "r32-left-2",
      "r32-left-3",
      "r32-left-4",
      "r32-left-5",
      "r32-left-6",
      "r32-left-7",
      "r32-left-8"
    ],
    r32Right: [
      "r32-right-1",
      "r32-right-2",
      "r32-right-3",
      "r32-right-4",
      "r32-right-5",
      "r32-right-6",
      "r32-right-7",
      "r32-right-8"
    ],
    r16Left: ["r16-left-1", "r16-left-2", "r16-left-3", "r16-left-4"],
    r16Right: ["r16-right-1", "r16-right-2", "r16-right-3", "r16-right-4"],
    qfLeft: ["qf-left-1", "qf-left-2"],
    qfRight: ["qf-right-1", "qf-right-2"],
    sfLeft: "sf-left-1",
    sfRight: "sf-right-1",
    final: "final",
    bronze: "bronze"
  } as const;

  const matches: Match[] = [];

  const round32Left = parsed.slice(0, 8);
  const round32Right = parsed.slice(8, 16);
  const round16Left = parsed.slice(16, 20);
  const round16Right = parsed.slice(20, 24);
  const quarterfinals = parsed.slice(24, 28);
  const semifinals = parsed.slice(28, 30);
  const final = parsed[30];
  const bronze = parsed[31];

  round32Left.forEach((line, index) => {
    matches.push(createLiveMatch(ids.r32Left[index], "Round of 32", "left", index, 73 + index, line));
  });

  round32Right.forEach((line, index) => {
    matches.push(
      createLiveMatch(ids.r32Right[index], "Round of 32", "right", index, 81 + index, line)
    );
  });

  round16Left.forEach((line, index) => {
    matches.push(
      createLiveMatch(ids.r16Left[index], "Round of 16", "left", index, [89, 90, 93, 94][index], line, [
        ids.r32Left[index * 2],
        ids.r32Left[index * 2 + 1]
      ])
    );
  });

  round16Right.forEach((line, index) => {
    matches.push(
      createLiveMatch(
        ids.r16Right[index],
        "Round of 16",
        "right",
        index,
        [91, 92, 95, 96][index],
        line,
        [ids.r32Right[index * 2], ids.r32Right[index * 2 + 1]]
      )
    );
  });

  matches.push(
    createLiveMatch(ids.qfLeft[0], "Quarter-finals", "left", 0, 97, quarterfinals[0], [
      ids.r16Left[0],
      ids.r16Left[1]
    ]),
    createLiveMatch(ids.qfLeft[1], "Quarter-finals", "left", 1, 98, quarterfinals[1], [
      ids.r16Left[2],
      ids.r16Left[3]
    ]),
    createLiveMatch(ids.qfRight[0], "Quarter-finals", "right", 0, 99, quarterfinals[2], [
      ids.r16Right[0],
      ids.r16Right[1]
    ]),
    createLiveMatch(ids.qfRight[1], "Quarter-finals", "right", 1, 100, quarterfinals[3], [
      ids.r16Right[2],
      ids.r16Right[3]
    ]),
    createLiveMatch(ids.sfLeft, "Semi-finals", "left", 0, 101, semifinals[0], [
      ids.qfLeft[0],
      ids.qfLeft[1]
    ]),
    createLiveMatch(ids.sfRight, "Semi-finals", "right", 0, 102, semifinals[1], [
      ids.qfRight[0],
      ids.qfRight[1]
    ]),
    createLiveMatch(ids.final, "Final", "center", 0, 104, final, [ids.sfLeft, ids.sfRight]),
    createLiveMatch(
      ids.bronze,
      "Bronze final",
      "center",
      1,
      103,
      bronze,
      undefined,
      [ids.sfLeft, ids.sfRight]
    )
  );

  return matches;
}

function createLiveMatch(
  id: MatchId,
  stage: Match["stage"],
  side: Match["side"],
  slot: number,
  matchNumber: number,
  parsedLine: ParsedLine,
  sourceMatchIds?: [MatchId, MatchId],
  loserSourceMatchIds?: [MatchId, MatchId]
): Match {
  return {
    id,
    stage,
    side,
    slot,
    matchNumber,
    dateLabel: parsedLine.dateLabel,
    label: `Match ${matchNumber}`,
    teamIds: [
      parsedLine.team1Code ? parsedLine.team1Code.toLowerCase() : null,
      parsedLine.team2Code ? parsedLine.team2Code.toLowerCase() : null
    ],
    sourceMatchIds,
    loserSourceMatchIds,
    actualScoreLabels: [parsedLine.score1.label, parsedLine.score2.label],
    actualWinnerId: parsedLine.winnerCode ? parsedLine.winnerCode.toLowerCase() : null
  };
}

function parseBracketLine(line: string): ParsedLine {
  const segments = splitTopLevelPipes(line.slice(1));

  if (segments.length !== 5) {
    throw new Error(`Unexpected bracket line shape: ${line}`);
  }

  const score1 = parseScore(segments[2]);
  const score2 = parseScore(segments[4]);
  const team1Code = extractTeamCode(segments[1]);
  const team2Code = extractTeamCode(segments[3]);

  return {
    dateLabel: normalizeDateLabel(segments[0]),
    team1Code,
    team2Code,
    score1,
    score2,
    winnerCode: determineWinnerCode(team1Code, team2Code, score1, score2)
  };
}

function splitTopLevelPipes(input: string) {
  const parts: string[] = [];
  let current = "";
  let braceDepth = 0;
  let bracketDepth = 0;
  let commentDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1] ?? "";

    if (char === "<" && input.slice(index, index + 4) === "<!--") {
      commentDepth += 1;
      current += "<!--";
      index += 3;
      continue;
    }

    if (commentDepth > 0 && input.slice(index, index + 3) === "-->") {
      commentDepth -= 1;
      current += "-->";
      index += 2;
      continue;
    }

    if (commentDepth === 0) {
      if (char === "{" && next === "{") {
        braceDepth += 1;
        current += "{{";
        index += 1;
        continue;
      }

      if (char === "}" && next === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
        current += "}}";
        index += 1;
        continue;
      }

      if (char === "[" && next === "[") {
        bracketDepth += 1;
        current += "[[";
        index += 1;
        continue;
      }

      if (char === "]" && next === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
        current += "]]";
        index += 1;
        continue;
      }

      if (char === "|" && braceDepth === 0 && bracketDepth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
}

function normalizeDateLabel(raw: string) {
  return raw
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .split(" – ")[0]
    .replace("June", "Jun")
    .replace("July", "Jul")
    .trim();
}

function extractTeamCode(token: string) {
  const flagMatch = token.match(/\{\{#invoke:flag\|fb(?:-rt)?\|([A-Z0-9]+)\}\}/);
  return flagMatch?.[1] ?? null;
}

function parseScore(token: string): ParsedScore {
  const value = token.trim();

  if (!value) {
    return {
      label: null,
      value: null,
      shootout: null
    };
  }

  const match = value.match(/^(\d+)(?:\s*\((\d+)\))?$/);

  if (!match) {
    return {
      label: value,
      value: null,
      shootout: null
    };
  }

  return {
    label: value,
    value: Number(match[1]),
    shootout: match[2] ? Number(match[2]) : null
  };
}

function determineWinnerCode(
  team1Code: string | null,
  team2Code: string | null,
  score1: ParsedScore,
  score2: ParsedScore
) {
  if (!team1Code || !team2Code || score1.value === null || score2.value === null) {
    return null;
  }

  if (score1.value > score2.value) {
    return team1Code;
  }

  if (score2.value > score1.value) {
    return team2Code;
  }

  if (score1.shootout !== null && score2.shootout !== null) {
    return score1.shootout > score2.shootout ? team1Code : team2Code;
  }

  return null;
}

import { BracketData, Match, MatchId, Team } from "@/lib/bracket-data";

export type MatchPrediction = {
  scores: [string, string];
  winnerId?: string;
};

export type PredictionState = Partial<Record<MatchId, MatchPrediction>>;

export type ComputedMatch = Match & {
  resolvedTeamIds: [string | null, string | null];
  winnerId: string | null;
  loserId: string | null;
  locked: boolean;
  scoreLabels: [string | null, string | null];
  prediction: MatchPrediction | null;
};

export function getTeamMap(teams: Team[]) {
  return Object.fromEntries(teams.map((team) => [team.id, team])) as Record<string, Team>;
}

export function computeBracket(
  data: BracketData,
  predictions: PredictionState
): Record<MatchId, ComputedMatch> {
  const matchMap = Object.fromEntries(data.matches.map((match) => [match.id, match])) as Record<MatchId, Match>;
  const computed = {} as Record<MatchId, ComputedMatch>;

  const resolveMatch = (matchId: MatchId): ComputedMatch => {
    if (computed[matchId]) {
      return computed[matchId];
    }

    const match = matchMap[matchId];
    let resolvedTeamIds: [string | null, string | null] = [...match.teamIds] as [string | null, string | null];

    if (match.sourceMatchIds) {
      const [sourceA, sourceB] = match.sourceMatchIds;
      const leftSource = resolveMatch(sourceA);
      const rightSource = resolveMatch(sourceB);
      resolvedTeamIds = [leftSource.winnerId, rightSource.winnerId];
    }

    if (match.loserSourceMatchIds) {
      const [sourceA, sourceB] = match.loserSourceMatchIds;
      const leftSource = resolveMatch(sourceA);
      const rightSource = resolveMatch(sourceB);
      resolvedTeamIds = [leftSource.loserId, rightSource.loserId];
    }

    const locked = Boolean(match.actualWinnerId);
    const prediction = predictions[match.id] ?? null;
    const scoreWinnerId = deriveWinnerFromPrediction(resolvedTeamIds, prediction);
    const winnerId = match.actualWinnerId ?? scoreWinnerId ?? prediction?.winnerId ?? null;
    const loserId =
      winnerId && resolvedTeamIds[0] && resolvedTeamIds[1]
        ? resolvedTeamIds[0] === winnerId
          ? resolvedTeamIds[1]
          : resolvedTeamIds[0]
        : null;

    computed[match.id] = {
      ...match,
      resolvedTeamIds,
      winnerId: resolvedTeamIds.includes(winnerId) ? winnerId : null,
      loserId: resolvedTeamIds.includes(winnerId) ? loserId : null,
      locked,
      scoreLabels: match.actualWinnerId
        ? match.actualScoreLabels ?? [null, null]
        : prediction?.scores ?? [null, null],
      prediction
    };

    return computed[match.id];
  };

  for (const match of data.matches) {
    resolveMatch(match.id);
  }

  return computed;
}

export function canPickWinner(match: ComputedMatch) {
  return !match.locked && Boolean(match.resolvedTeamIds[0] && match.resolvedTeamIds[1]);
}

function deriveWinnerFromPrediction(
  resolvedTeamIds: [string | null, string | null],
  prediction: MatchPrediction | null
) {
  if (!prediction || !resolvedTeamIds[0] || !resolvedTeamIds[1]) {
    return null;
  }

  const left = parseGoal(prediction.scores[0]);
  const right = parseGoal(prediction.scores[1]);

  if (left === null || right === null || left === right) {
    return null;
  }

  return left > right ? resolvedTeamIds[0] : resolvedTeamIds[1];
}

function parseGoal(value: string | null | undefined) {
  if (!value || value.trim() === "") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return null;
  }

  return numberValue;
}

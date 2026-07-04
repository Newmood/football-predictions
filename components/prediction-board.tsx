"use client";

import { toPng } from "html-to-image";
import { useEffect, useRef, useState, useTransition } from "react";
import { BracketData, MatchId, Team, stageOrder } from "@/lib/bracket-data";
import {
  canPickWinner,
  ComputedMatch,
  computeBracket,
  getTeamMap,
  PredictionState
} from "@/lib/bracket";

export function PredictionBoard() {
  const [data, setData] = useState<BracketData | null>(null);
  const [predictions, setPredictions] = useState<PredictionState>({});
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorPath[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<MatchId, HTMLElement>());

  const loadData = async () => {
    setErrorMessage(null);

    const response = await fetch("/api/bracket", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      throw new Error(payload.message ?? "Unable to fetch live bracket.");
    }

    const nextData = (await response.json()) as BracketData;
    setData(nextData);
  };

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const response = await fetch("/api/bracket", { cache: "no-store" });
        const payload = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setErrorMessage((payload as { message?: string }).message ?? "Unable to fetch live bracket.");
          return;
        }

        setPredictions({});
        setData(payload as BracketData);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to fetch live bracket.");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
    };
  }, []);

  const setWinner = (matchId: MatchId, teamId: string) => {
    startTransition(() => {
      setPredictions((current) => ({
        ...current,
        [matchId]: {
          scores: current[matchId]?.scores ?? ["", ""],
          winnerId: current[matchId]?.winnerId === teamId ? undefined : teamId
        }
      }));
    });
  };

  const setGoal = (matchId: MatchId, sideIndex: 0 | 1, value: string) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    startTransition(() => {
      setPredictions((current) => {
        const scores = [...(current[matchId]?.scores ?? ["", ""])] as [string, string];
        scores[sideIndex] = value;

        return {
          ...current,
          [matchId]: {
            scores,
            winnerId: current[matchId]?.winnerId
          }
        };
      });
    });
  };

  const resetPredictions = () => {
    startTransition(() => {
      setPredictions({});
    });
  };

  const refreshLiveBoard = async () => {
    startTransition(() => {
      void loadData();
    });
  };

  const exportBoard = async () => {
    if (!boardRef.current) {
      return;
    }

    try {
      setIsExporting(true);
      await waitForNextPaint();
      await waitForNextPaint();
      const dataUrl = await toPng(boardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#111111"
      });
      const link = document.createElement("a");
      link.download = "fifa-prediction-board.png";
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  const registerCardRef = (matchId: MatchId, node: HTMLElement | null) => {
    if (node) {
      cardRefs.current.set(matchId, node);
    } else {
      cardRefs.current.delete(matchId);
    }
  };

  useEffect(() => {
    const renderConnectors = () => {
      if (!boardRef.current || !data) {
        return;
      }

      const boardBounds = boardRef.current.getBoundingClientRect();
      const nextConnectors: ConnectorPath[] = [];

      for (const match of data.matches) {
        const targetCard = cardRefs.current.get(match.id);
        if (!targetCard || (!match.sourceMatchIds && !match.loserSourceMatchIds)) {
          continue;
        }

        const sourceIds = match.sourceMatchIds ?? match.loserSourceMatchIds ?? [];
        for (const sourceId of sourceIds) {
          const sourceCard = cardRefs.current.get(sourceId);
          if (!sourceCard) {
            continue;
          }

          const sourceBounds = sourceCard.getBoundingClientRect();
          const targetBounds = targetCard.getBoundingClientRect();
          nextConnectors.push(
            buildConnectorPath(sourceBounds, targetBounds, boardBounds, match.side, sourceId, match.id)
          );
        }
      }

      setConnectors(nextConnectors);
    };

    renderConnectors();
    window.addEventListener("resize", renderConnectors);

    return () => {
      window.removeEventListener("resize", renderConnectors);
    };
  }, [data, predictions, isEditing]);

  if (errorMessage) {
    return (
      <main className="app-shell">
        <div className="status-shell">
          <h1>Live bracket unavailable</h1>
          <p>{errorMessage}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return <div className="status-shell">Loading live prediction board...</div>;
  }

  const computedMatches = computeBracket(data, predictions);
  const teamMap = getTeamMap(data.teams);
  const groupedMatches = stageOrder.reduce<Record<(typeof stageOrder)[number], typeof data.matches>>(
    (acc, stage) => {
      acc[stage] = data.matches.filter((match) => match.stage === stage);
      return acc;
    },
    {} as Record<(typeof stageOrder)[number], typeof data.matches>
  );

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <h1>{data.title}</h1>
          <p className="hero-copy">{data.subtitle}</p>
          <p className="hero-meta">Live sync: {formatTimestamp(data.fetchedAt)}</p>
        </div>

        <div className="hero-actions">
          <button className="ghost-button" onClick={() => setIsEditing((current) => !current)}>
            {isEditing ? "View live board" : "Edit predictions"}
          </button>
          <button className="ghost-button" onClick={resetPredictions} disabled={isPending}>
            Reset predictions
          </button>
          <button className="ghost-button" onClick={refreshLiveBoard} disabled={isPending}>
            Refresh live board
          </button>
          <button className="primary-button" onClick={exportBoard} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export PNG"}
          </button>
          <button className="ghost-button guide-button" onClick={() => setIsGuideOpen(true)}>
            Guide
          </button>
        </div>
      </section>

      <section className="content-grid compact-layout">
        <div className={`board-frame ${isExporting ? "is-exporting" : ""}`} ref={boardRef}>
          <header className="board-header">
            <div>
              <p className="board-kicker">Prediction board</p>
            </div>
            <div className="board-status">
              <p className="board-mode export-hidden">
                {isEditing ? "Editing predictions" : "Viewing live board"}
              </p>
            </div>
          </header>

          <svg className="board-connectors" aria-hidden="true">
            {connectors.map((connector) => (
              <path
                key={connector.id}
                d={connector.path}
                className={`connector-path connector-${connector.variant}`}
              />
            ))}
          </svg>

          <div className="board-columns full-knockout-columns">
            <StageColumn
              title="Round of 32"
              matches={groupedMatches["Round of 32"].filter((match) => match.side === "left")}
              computedMatches={computedMatches}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              side="left"
              registerCardRef={registerCardRef}
            />
            <StageColumn
              title="Round of 16"
              matches={groupedMatches["Round of 16"].filter((match) => match.side === "left")}
              computedMatches={computedMatches}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              side="left"
              registerCardRef={registerCardRef}
            />
            <StageColumn
              title="Quarter-finals"
              matches={groupedMatches["Quarter-finals"].filter((match) => match.side === "left")}
              computedMatches={computedMatches}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              side="left"
              registerCardRef={registerCardRef}
            />
            <StageColumn
              title="Semi-finals"
              matches={groupedMatches["Semi-finals"].filter((match) => match.side === "left")}
              computedMatches={computedMatches}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              side="left"
              registerCardRef={registerCardRef}
            />
            <FinalColumn
              matches={[computedMatches.final, computedMatches.bronze]}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              registerCardRef={registerCardRef}
            />
            <StageColumn
              title="Semi-finals"
              matches={groupedMatches["Semi-finals"].filter((match) => match.side === "right")}
              computedMatches={computedMatches}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              side="right"
              registerCardRef={registerCardRef}
            />
            <StageColumn
              title="Quarter-finals"
              matches={groupedMatches["Quarter-finals"].filter((match) => match.side === "right")}
              computedMatches={computedMatches}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              side="right"
              registerCardRef={registerCardRef}
            />
            <StageColumn
              title="Round of 16"
              matches={groupedMatches["Round of 16"].filter((match) => match.side === "right")}
              computedMatches={computedMatches}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              side="right"
              registerCardRef={registerCardRef}
            />
            <StageColumn
              title="Round of 32"
              matches={groupedMatches["Round of 32"].filter((match) => match.side === "right")}
              computedMatches={computedMatches}
              teamMap={teamMap}
              isEditing={isEditing}
              onPick={setWinner}
              onGoalChange={setGoal}
              side="right"
              registerCardRef={registerCardRef}
            />
          </div>
        </div>
      </section>

      {isGuideOpen ? (
        <div className="modal-backdrop" onClick={() => setIsGuideOpen(false)}>
          <div className="guide-modal" onClick={(event) => event.stopPropagation()}>
            <div className="guide-header">
              <div>
                <p className="board-kicker">Guide</p>
                <h2>Using the board</h2>
              </div>
              <button className="ghost-button modal-close" onClick={() => setIsGuideOpen(false)}>
                Close
              </button>
            </div>

            <div className="guide-grid">
              <div className="panel-card">
                <h2>Live source</h2>
                <p>{data.sourceName}</p>
                <p className="muted-copy">{data.sourceUrl}</p>
              </div>

              <div className="panel-card">
                <h2>Prediction mode</h2>
                <p>
                  Completed matches stay locked with live results. Future matches become editable when both
                  teams are known.
                </p>
                <p className="muted-copy">
                  Add goal integers for each side. If the numbers tie, click the team you want to advance.
                </p>
              </div>

              <div className="panel-card">
                <h2>Updated</h2>
                <p>{data.updatedAt}</p>
                <p className="muted-copy">Fetched at {formatTimestamp(data.fetchedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StageColumn({
  title,
  matches,
  computedMatches,
  teamMap,
  isEditing,
  onPick,
  onGoalChange,
  side,
  registerCardRef
}: {
  title: string;
  matches: BracketData["matches"];
  computedMatches: ReturnType<typeof computeBracket>;
  teamMap: Record<string, Team>;
  isEditing: boolean;
  onPick: (matchId: MatchId, teamId: string) => void;
  onGoalChange: (matchId: MatchId, sideIndex: 0 | 1, value: string) => void;
  side: "left" | "right";
  registerCardRef: (matchId: MatchId, node: HTMLElement | null) => void;
}) {
  const stageClassName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className={`stage-column stage-${side} stage-${stageClassName}`}>
      <p className="stage-title">{title}</p>
      <div className="match-stack">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={computedMatches[match.id]}
            teamMap={teamMap}
            isEditing={isEditing}
            onPick={onPick}
            onGoalChange={onGoalChange}
            registerCardRef={registerCardRef}
          />
        ))}
      </div>
    </div>
  );
}

function FinalColumn({
  matches,
  teamMap,
  isEditing,
  onPick,
  onGoalChange,
  registerCardRef
}: {
  matches: ComputedMatch[];
  teamMap: Record<string, Team>;
  isEditing: boolean;
  onPick: (matchId: MatchId, teamId: string) => void;
  onGoalChange: (matchId: MatchId, sideIndex: 0 | 1, value: string) => void;
  registerCardRef: (matchId: MatchId, node: HTMLElement | null) => void;
}) {
  return (
    <div className="final-column stage-center stage-finals">
      <p className="stage-title">Finals</p>
      <div className="trophy-mark">🏆</div>
      <MatchCard
        match={matches[0]}
        teamMap={teamMap}
        isEditing={isEditing}
        onPick={onPick}
        onGoalChange={onGoalChange}
        accent="gold"
        registerCardRef={registerCardRef}
      />
      <MatchCard
        match={matches[1]}
        teamMap={teamMap}
        isEditing={isEditing}
        onPick={onPick}
        onGoalChange={onGoalChange}
        accent="blue"
        registerCardRef={registerCardRef}
      />
    </div>
  );
}

function MatchCard({
  match,
  teamMap,
  isEditing,
  onPick,
  onGoalChange,
  accent = "default",
  registerCardRef
}: {
  match: ComputedMatch;
  teamMap: Record<string, Team>;
  isEditing: boolean;
  onPick: (matchId: MatchId, teamId: string) => void;
  onGoalChange: (matchId: MatchId, sideIndex: 0 | 1, value: string) => void;
  accent?: "default" | "gold" | "blue";
  registerCardRef: (matchId: MatchId, node: HTMLElement | null) => void;
}) {
  const pickable = isEditing && canPickWinner(match);

  return (
    <article
      className={`match-card accent-${accent} side-${match.side}`}
      ref={(node) => registerCardRef(match.id, node)}
    >
      <div className="match-meta">
        <span>{match.label}</span>
        <span>{match.dateLabel}</span>
      </div>

      <div className="team-list">
        {match.resolvedTeamIds.map((teamId, index) => {
          const team = teamId ? teamMap[teamId] : null;
          const selected = teamId && match.winnerId === teamId;
          const scoreValue = match.scoreLabels[index];
          const editable = pickable && Boolean(teamId);

          return (
            <div
              key={teamId ?? `${match.id}-empty-${index}`}
              className={`team-row${selected ? " is-selected" : ""}${match.locked ? " is-locked" : ""}`}
            >
              <button
                className="team-button"
                disabled={!editable}
                onClick={() => teamId && onPick(match.id, teamId)}
              >
                <span className="team-main">
                  <span className="flag-chip">{team?.flag ?? "?"}</span>
                  <span>{team?.code ?? "TBD"}</span>
                </span>
                <span className="team-name">{team?.name ?? "Waiting for winner"}</span>
              </button>

              {match.locked ? (
                <span className="score-pill">{scoreValue ?? "-"}</span>
              ) : (
                <input
                  className="goal-input"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="-"
                  disabled={!editable}
                  value={scoreValue ?? ""}
                  onChange={(event) => onGoalChange(match.id, index as 0 | 1, event.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

type ConnectorPath = {
  id: string;
  path: string;
  variant: "left" | "right" | "center";
};

function buildConnectorPath(
  sourceBounds: DOMRect,
  targetBounds: DOMRect,
  boardBounds: DOMRect,
  targetSide: "left" | "right" | "center",
  sourceId: MatchId,
  targetId: MatchId
): ConnectorPath {
  const sourceOnLeft = sourceBounds.left < targetBounds.left;
  const startX = sourceOnLeft ? sourceBounds.right - boardBounds.left : sourceBounds.left - boardBounds.left;
  const endX = sourceOnLeft
    ? targetBounds.left - boardBounds.left
    : targetBounds.right - boardBounds.left;
  const startY = sourceBounds.top + sourceBounds.height / 2 - boardBounds.top;
  const endY = targetBounds.top + targetBounds.height / 2 - boardBounds.top;
  const bendOffset = Math.max(16, Math.abs(endX - startX) * 0.46);
  const midX = sourceOnLeft ? startX + bendOffset : startX - bendOffset;

  return {
    id: `${sourceId}-${targetId}`,
    variant: targetSide === "center" ? "center" : sourceOnLeft ? "left" : "right",
    path: `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`
  };
}

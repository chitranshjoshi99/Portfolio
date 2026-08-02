import { useEffect, useRef, useState } from "react";
import type { Bank, PadId, PadMode } from "../lib/constants";
import {
  clearBassRow,
  clearPattern,
  clearRow,
  emptyPattern,
  type Pattern,
} from "../lib/pattern";

export const PATTERN_SLOTS = ["1", "2", "3", "4"] as const;
export type PatternSlot = (typeof PATTERN_SLOTS)[number];
export type PatternBank = Record<PatternSlot, Pattern>;
export type DeleteTarget =
  | { kind: "slot" }
  | { kind: "row"; mode: "drums" | "bass" };
export type UndoSnapshot = { slot: PatternSlot; pattern: Pattern };

export type PatternBankController = {
  patterns: PatternBank;
  activePattern: Pattern;
  activePatternRef: React.MutableRefObject<Pattern>;
  activeSlot: PatternSlot;
  queuedSlot: PatternSlot | null;
  padMode: PadMode;
  deleteTarget: DeleteTarget | null;
  undo: UndoSnapshot | null;
  commitActiveSlot: (mutator: (pattern: Pattern) => Pattern) => boolean;
  selectSlot: (slot: PatternSlot, playing: boolean) => boolean;
  commitQueuedSlot: () => void;
  replacePatternBank: (patterns: PatternBank) => void;
  setGlobalBank: (kind: "drumBank" | "bassBank", bank: Bank) => void;
  setPadMode: (mode: Exclude<PadMode, "delete">) => void;
  cancelPadMode: () => void;
  armDelete: (target: DeleteTarget) => void;
  clearActiveRow: (pad: PadId, mode: "drums" | "bass") => boolean;
  clearSlot: (slot: PatternSlot) => boolean;
  undoLastClear: () => boolean;
};

export function emptyPatternBank(): PatternBank {
  return {
    "1": emptyPattern(),
    "2": emptyPattern(),
    "3": emptyPattern(),
    "4": emptyPattern(),
  };
}

function withRuntimeBanks(
  pattern: Pattern,
  banks: { drumBank: Bank; bassBank: Bank },
): Pattern {
  return { ...pattern, drumBank: banks.drumBank, bassBank: banks.bassBank };
}

export function usePatternBank(): PatternBankController {
  const runtimeBanksRef = useRef<{ drumBank: Bank; bassBank: Bank }>({
    drumBank: "ROK",
    bassBank: "ROK",
  });
  const [patterns, setPatterns] = useState<PatternBank>(() => emptyPatternBank());
  const patternsRef = useRef(patterns);
  const [activeSlot, setActiveSlot] = useState<PatternSlot>("1");
  const activeSlotRef = useRef<PatternSlot>("1");
  const [queuedSlot, setQueuedSlot] = useState<PatternSlot | null>(null);
  const queuedSlotRef = useRef<PatternSlot | null>(null);
  const activePatternRef = useRef(patterns["1"]);
  const [padMode, setPadModeState] = useState<PadMode>("normal");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [undo, setUndo] = useState<UndoSnapshot | null>(null);
  const undoRef = useRef<UndoSnapshot | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  function expireUndo(): void {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    undoRef.current = null;
    setUndo(null);
  }

  function startUndo(snapshot: UndoSnapshot): void {
    expireUndo();
    undoRef.current = snapshot;
    setUndo(snapshot);
    undoTimerRef.current = window.setTimeout(expireUndo, 15_000);
  }

  function commitBank(next: PatternBank): void {
    patternsRef.current = next;
    activePatternRef.current = next[activeSlotRef.current];
    setPatterns(next);
  }

  function commitActiveSlot(mutator: (pattern: Pattern) => Pattern): boolean {
    const slot = activeSlotRef.current;
    const current = patternsRef.current[slot];
    const nextPattern = mutator(current);
    if (nextPattern === current) return false;
    expireUndo();
    commitBank({ ...patternsRef.current, [slot]: nextPattern });
    return true;
  }

  function selectSlot(slot: PatternSlot, playing: boolean): boolean {
    expireUndo();
    if (playing) {
      queuedSlotRef.current = slot;
      setQueuedSlot(slot);
      return true;
    }

    queuedSlotRef.current = null;
    setQueuedSlot(null);
    activeSlotRef.current = slot;
    setActiveSlot(slot);
    activePatternRef.current = patternsRef.current[slot];
    return true;
  }

  // Called from the audio subscriber at step 0. Ref/state updates are kept in
  // this synchronous order so the audio callback reads the new slot below it.
  function commitQueuedSlot(): void {
    const slot = queuedSlotRef.current;
    if (slot === null) return;
    queuedSlotRef.current = null;
    setQueuedSlot(null);
    activeSlotRef.current = slot;
    setActiveSlot(slot);
    activePatternRef.current = patternsRef.current[slot];
  }

  function replacePatternBank(nextPatterns: PatternBank): void {
    const next = {
      "1": withRuntimeBanks(nextPatterns["1"], runtimeBanksRef.current),
      "2": withRuntimeBanks(nextPatterns["2"], runtimeBanksRef.current),
      "3": withRuntimeBanks(nextPatterns["3"], runtimeBanksRef.current),
      "4": withRuntimeBanks(nextPatterns["4"], runtimeBanksRef.current),
    };
    queuedSlotRef.current = null;
    setQueuedSlot(null);
    expireUndo();
    commitBank(next);
  }

  function setGlobalBank(kind: "drumBank" | "bassBank", bank: Bank): void {
    if (runtimeBanksRef.current[kind] === bank) return;
    expireUndo();
    runtimeBanksRef.current = { ...runtimeBanksRef.current, [kind]: bank };
    const next = {
      "1": withRuntimeBanks(patternsRef.current["1"], runtimeBanksRef.current),
      "2": withRuntimeBanks(patternsRef.current["2"], runtimeBanksRef.current),
      "3": withRuntimeBanks(patternsRef.current["3"], runtimeBanksRef.current),
      "4": withRuntimeBanks(patternsRef.current["4"], runtimeBanksRef.current),
    };
    commitBank(next);
  }

  function setPadMode(mode: Exclude<PadMode, "delete">): void {
    setDeleteTarget(null);
    setPadModeState(mode);
  }

  function cancelPadMode(): void {
    setDeleteTarget(null);
    setPadModeState("normal");
  }

  function armDelete(target: DeleteTarget): void {
    setDeleteTarget(target);
    setPadModeState("delete");
  }

  function clearActiveRow(pad: PadId, mode: "drums" | "bass"): boolean {
    return commitActiveSlot((pattern) =>
      mode === "drums" ? clearRow(pattern, pad) : clearBassRow(pattern, pad),
    );
  }

  function clearSlot(slot: PatternSlot): boolean {
    const current = patternsRef.current[slot];
    const cleared = clearPattern(current);
    if (cleared === current) return false;
    startUndo({ slot, pattern: current });
    commitBank({ ...patternsRef.current, [slot]: cleared });
    return true;
  }

  function undoLastClear(): boolean {
    const snapshot = undoRef.current;
    if (!snapshot) return false;
    expireUndo();
    commitBank({ ...patternsRef.current, [snapshot.slot]: snapshot.pattern });
    return true;
  }

  useEffect(() => () => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }, []);

  // Keep the ref current if React renders after a state replacement that did
  // not pass through one of the imperative mutation paths above.
  activePatternRef.current = patterns[activeSlot];

  return {
    patterns,
    activePattern: patterns[activeSlot],
    activePatternRef,
    activeSlot,
    queuedSlot,
    padMode,
    deleteTarget,
    undo,
    commitActiveSlot,
    selectSlot,
    commitQueuedSlot,
    replacePatternBank,
    setGlobalBank,
    setPadMode,
    cancelPadMode,
    armDelete,
    clearActiveRow,
    clearSlot,
    undoLastClear,
  };
}

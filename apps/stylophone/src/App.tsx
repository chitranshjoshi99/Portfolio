import { useEffect, useRef, useState } from "react";
import type { Mode, PadId, PadMode } from "./lib/constants";
import { padSemitone } from "./lib/audio";
import LessonLibrary from "./components/LessonLibrary";
import Modal from "./components/Modal";
import Header from "./components/Header";
import ScoreSection from "./components/ScoreSection";
import ControlRail from "./components/ControlRail";
import LessonPanel from "./components/LessonPanel";
import VisualizerPad, { type VisualizerPadHandle } from "./components/VisualizerPad";
import ReplacementConfirmDialog from "./components/ReplacementConfirmDialog";
import Walkthrough from "./components/Walkthrough";
import { usePattern } from "./hooks/usePattern";
import { usePatternBank } from "./hooks/usePatternBank";
import { useLiveInput } from "./hooks/useLiveInput";
import { useTransportEngine } from "./hooks/useTransportEngine";
import { useKeyboardControls } from "./hooks/useKeyboardControls";
import { useDraftPersistence } from "./hooks/useDraftPersistence";
import { useWalkthrough, TOUR_STEPS } from "./hooks/useWalkthrough";

// Below this width the layout gets cramped. v1.2 warns instead of blocking —
// the user can dismiss and keep working in the poorer layout (product-owner
// call, overriding the original hard-gate design).
const DESKTOP_FLOOR_WIDTH = 1280;

// App owns the shell's local state, split by operation into hooks below.
// Child controls (pad, knob, transport) get value + change callbacks.
export default function App() {
  const [mode, setMode] = useState<Mode>("drums");
  const [openDialog, setOpenDialog] = useState<"lessons" | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [narrowNoticeDismissed, setNarrowNoticeDismissed] = useState(false);
  const [visualizerExpanded, setVisualizerExpanded] = useState(false);
  const visualizerRef = useRef<VisualizerPadHandle>(null);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Re-arm the notice each time the window crosses back above the floor, so
  // shrinking narrow again later shows it fresh rather than staying silenced.
  useEffect(() => {
    if (viewportWidth >= DESKTOP_FLOOR_WIDTH) setNarrowNoticeDismissed(false);
  }, [viewportWidth]);

  const bank = usePatternBank();
  const transposeOffsetRef = useRef(0);
  const [transposeOffset, setTransposeOffset] = useState(0);

  function resetTranspose() {
    transposeOffsetRef.current = 0;
    setTransposeOffset(0);
  }

  const pattern = usePattern(mode, setMode, bank, resetTranspose);
  const liveInput = useLiveInput(
    pattern.patternRef,
    pattern.octave,
    pattern.commitPatternEdit,
    pattern.guideRef,
  );
  function cancelPadMode() {
    keyboard.clearHeldKeys();
    liveInput.handleBassRelease();
    resetTranspose();
    bank.cancelPadMode();
  }

  function setPadMode(next: Exclude<PadMode, "delete">) {
    if (next === "transpose" && !canTranspose) return;
    keyboard.clearHeldKeys();
    liveInput.handleBassRelease();
    resetTranspose();
    bank.setPadMode(next);
  }

  function handleControlPad(padId: PadId) {
    if (bank.padMode === "pattern") {
      if (padId === "1" || padId === "2" || padId === "3" || padId === "4") {
        pattern.selectSlot(padId, transport.playing);
      }
      return;
    }
    if (bank.padMode !== "delete" || !bank.deleteTarget) return;
    const target = bank.deleteTarget;
    if (target.kind === "slot") {
      if (padId === "1" || padId === "2" || padId === "3" || padId === "4") {
        bank.clearSlot(padId);
        bank.cancelPadMode();
      }
      return;
    }
    if (target.mode === "bass") resetTranspose();
    bank.clearActiveRow(padId, target.mode);
    bank.cancelPadMode();
  }
  const transport = useTransportEngine(
    pattern.patternRef,
    transposeOffsetRef,
    liveInput.stepRef,
    bank.commitQueuedSlot,
    pattern.guideRef,
    liveInput.extendRecordedBass,
    liveInput.handleBassRelease,
    liveInput.setRecording,
    pattern.pauseGuidance,
    pattern.resumeGuidance,
    resetTranspose,
  );
  const canTranspose =
    transport.playing &&
    pattern.guide.status === "compose" &&
    pattern.pattern.bass.some(Boolean);

  useEffect(() => {
    if (canTranspose) return;
    resetTranspose();
    if (bank.padMode === "transpose") bank.cancelPadMode();
  }, [bank.padMode, canTranspose]);

  function handleTransposeStart(padId: PadId) {
    if (!canTranspose) return;
    const offset = padSemitone(padId);
    transposeOffsetRef.current = offset;
    setTransposeOffset(offset);
  }

  function handleTransposeEnd() {
    resetTranspose();
  }
  const keyboard = useKeyboardControls(
    mode,
    bank.padMode,
    openDialog,
    (padId) => visualizerRef.current?.playDrum(padId),
    (padId) => visualizerRef.current?.attackBass(padId),
    (padId) => visualizerRef.current?.moveBass(padId),
    () => visualizerRef.current?.releaseBass(),
    handleControlPad,
    cancelPadMode,
    transport.onTogglePlay,
  );
  const draft = useDraftPersistence(
    bank.patterns,
    bank.replacePatternBank,
    transport.bpm,
    transport.setBpm,
    pattern.setGuideCompose,
    pattern.setSelectedBassStep,
  );
  const walkthrough = useWalkthrough(
    pattern.commitPatternEdit,
    pattern.startGuidance,
    pattern.setGuideCompose,
    transport.setBpm,
    transport.clickEnabled,
    transport.onToggleClick,
    transport.playing,
    transport.onTogglePlay,
  );

  const selectedSound =
    mode === "drums" ? pattern.pattern.drumBank : pattern.pattern.bassBank;
  // const guidanceActive = pattern.guide.status === "guided";

  // The expanded visualizer is a temporary guidance aid. Keep the regular
  // three-panel layout whenever guidance is not actively running.
  // useEffect(() => {
  //   if (!guidanceActive) setVisualizerExpanded(false);
  // }, [guidanceActive]);

  function handleModeChange(nextMode: Mode) {
    cancelPadMode();
    if (nextMode !== mode) {
      keyboard.clearHeldKeys();
      liveInput.handleBassRelease();
      pattern.setSelectedBassStep(null);
    }
    setMode(nextMode);
  }

  // Starting or restarting guidance always ends any in-progress recording —
  // guidance and REC-armed capture are mutually exclusive editor modes.
  function beginGuidance() {
    cancelPadMode();
    liveInput.stopRecording();
    pattern.startGuidance();
  }

  return (
    <div className={`app workspace${visualizerExpanded ? " is-visualizer-expanded" : ""}`}>
      <Header
        bpm={transport.bpm}
        onBpmChange={transport.setBpm}
        mode={mode}
        selectedSound={selectedSound}
        beat={transport.beat}
        playing={transport.playing}
        guideLabel={pattern.guideLabel}
        passSummary={pattern.passSummary}
        onReplayTour={walkthrough.retriggerTour}
      />

      <ScoreSection
        pattern={pattern.pattern}
        mode={mode}
        currentStep={transport.playing ? transport.step : -1}
        onToggleCell={pattern.handleToggleCell}
        onPaintDrum={pattern.handlePaintDrum}
        onRowFill={pattern.commitPatternEdit}
        selectedBassStep={pattern.selectedBassStep}
        onSelectBass={pattern.handleSelectBass}
        onExtendBass={pattern.handleExtendBass}
        dimmed={pattern.guide.status === "guided"}
        disabled={pattern.guide.status === "guided"}
        drumPassStates={pattern.drumPassStates}
        bassPassState={pattern.bassPassState}
        activeSlot={pattern.activeSlot}
        queuedSlot={pattern.queuedSlot}
        playing={transport.playing}
        duplicateDisabled={pattern.guide.status === "guided"}
        onDuplicateBar={pattern.handleDuplicateBar}
        slotSelectionDisabled={pattern.guide.status !== "compose"}
        onSelectSlot={(slot) => pattern.selectSlot(slot, transport.playing)}
      />

      <section
        className={`workspace__deck${visualizerExpanded ? " is-visualizer-expanded" : ""}`}
        aria-label="Controls, lesson actions, and visualizer"
      >
        <ControlRail
          mode={mode}
          onModeChange={handleModeChange}
          selectedSound={selectedSound}
          onBankChange={pattern.handleBankChange}
          isPlaying={transport.playing}
          onTogglePlay={transport.onTogglePlay}
          recording={liveInput.recording}
          onToggleRec={liveInput.onToggleRecording}
          guideStatus={pattern.guide.status}
          clickEnabled={transport.clickEnabled}
          onToggleClick={transport.onToggleClick}
          octave={pattern.octave}
          onOctaveChange={pattern.handleOctaveChange}
          padMode={bank.padMode}
          onSetPadMode={setPadMode}
          transposeEnabled={canTranspose}
        />

        <LessonPanel
          guideStatus={pattern.guide.status}
          guideLabel={pattern.guideLabel}
          passes={pattern.guidancePasses}
          currentIndex={pattern.guide.passIndex}
          onStartGuidance={beginGuidance}
          onNextGuidance={pattern.advanceGuidance}
          onRestartGuidance={beginGuidance}
          onStopLesson={() => pattern.setGuideCompose()}
          onRedoPass={pattern.redoGuidance}
          onResetPattern={draft.handleResetPattern}
          onOpenDraft={() => setOpenDialog("lessons")}
          // guideNotice={pattern.guideNotice}
        />

        <VisualizerPad
          ref={visualizerRef}
          mode={mode}
          padMode={bank.padMode}
          onDrumPad={liveInput.handleDrumPad}
          onControlPad={handleControlPad}
          onBassAttack={liveInput.handleBassAttack}
          onBassMove={liveInput.handleBassMove}
          onBassRelease={liveInput.handleBassRelease}
          activePads={
            mode === "drums"
              ? transport.sequencedPads.drums
              : transport.sequencedPads.bass
          }
          hitPad={liveInput.hitPad}
          missPad={liveInput.missPad}
          // guidanceActive={guidanceActive}
          expanded={visualizerExpanded}
          onToggleExpanded={() => setVisualizerExpanded((expanded) => !expanded)}
          onArmDelete={() => {
            keyboard.clearHeldKeys();
            liveInput.handleBassRelease();
            bank.armDelete(
              bank.padMode === "pattern"
                ? { kind: "slot" }
                : { kind: "row", mode },
            );
            resetTranspose();
          }}
          onCancelPadMode={cancelPadMode}
          undo={bank.undo}
          onUndo={bank.undoLastClear}
          onTransposeStart={handleTransposeStart}
          onTransposeEnd={handleTransposeEnd}
          transposeOffset={transposeOffset}
        />
      </section>

      {/* Keep pad and guide announcements available to assistive technology while
          the visual hierarchy stays focused on the score. */}
      <p className="sr-only" aria-live="polite">
        {liveInput.lastPad ? `Pad ${liveInput.lastPad}` : "No pad played yet"}
      </p>

      <Modal
        open={openDialog === "lessons"}
        title="Save & Load Beat"
        onClose={() => setOpenDialog(null)}
      >
        <LessonLibrary
          onExport={draft.exportCurrentDocument}
          onImport={draft.importPatternDocument}
          hydrated={draft.draftHydrated}
          dirty={draft.draftDirty}
          saveFailed={draft.draftSaveFailed}
          importMessage={draft.importMessage}
        />
      </Modal>

      <Modal
        open={draft.pendingReplacement !== null}
        title={
          draft.pendingReplacement?.kind === "import"
            ? "Import this backup?"
            : draft.pendingReplacement?.kind === "reset"
              ? "Reset this beat?"
              : "Start a new beat?"
        }
        onClose={() => draft.setPendingReplacement(null)}
      >
        <ReplacementConfirmDialog
          pendingReplacement={draft.pendingReplacement}
          onExportBackup={draft.exportCurrentDocument}
          onCancel={() => draft.setPendingReplacement(null)}
          onConfirm={() => {
            if (!draft.pendingReplacement) return;
            if (draft.pendingReplacement.kind === "import") {
              draft.performImport(draft.pendingReplacement.document);
            } else {
              draft.performReplacement(draft.pendingReplacement.kind);
            }
          }}
        />
      </Modal>

      <Modal
        open={viewportWidth < DESKTOP_FLOOR_WIDTH && !narrowNoticeDismissed}
        title="Best on a larger screen"
        onClose={() => setNarrowNoticeDismissed(true)}
      >
        <p>
          Beats Drum Machine Coach is best viewed at 1280px width or wider.
          You can keep going here, but layout and controls may feel cramped.
        </p>
      </Modal>

      {walkthrough.tourStepIndex !== null && (
        <Walkthrough
          step={TOUR_STEPS[walkthrough.tourStepIndex]}
          stepIndex={walkthrough.tourStepIndex}
          totalSteps={TOUR_STEPS.length}
          onNext={walkthrough.nextTourStep}
          onSkip={walkthrough.skipTour}
        />
      )}
    </div>
  );
}

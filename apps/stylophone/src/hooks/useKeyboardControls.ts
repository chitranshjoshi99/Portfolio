import { useEffect, useRef } from "react";
import { PAD_IDS, type Mode, type PadId, type PadMode } from "../lib/constants";

// Desktop keyboard play: the top letter row maps left-to-right onto PAD_IDS[0..11].
// ponytail: v1 QWERTY-row mapping; per-key layout tuning can come later.
const KEY_TO_PAD_INDEX = "qwertyuiop[]";

// Registers the window-level keyboard listener once; refs keep it pointed at
// the latest handlers so it always sees current mode/octave/recording without
// re-subscribing. Desktop keyboard play mirrors the physical bass surface:
// the first held key attacks, additional mapped keys slide the same
// monophonic voice, and release only happens after the last held mapped key
// is lifted.
export function useKeyboardControls(
  mode: Mode,
  padMode: PadMode,
  openDialog: "lessons" | null,
  handleDrumPad: (padId: PadId) => void,
  handleBassAttack: (padId: PadId) => void,
  handleBassMove: (padId: PadId) => void,
  handleBassRelease: () => void,
  handleControlPad: (padId: PadId) => void,
  onCancelPadMode: () => void,
  onTogglePlay: () => void,
) {
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const padModeRef = useRef(padMode);
  padModeRef.current = padMode;
  const openDialogRef = useRef(openDialog);
  openDialogRef.current = openDialog;
  const heldBassKeysRef = useRef(new Map<string, PadId>());

  const handleDrumPadRef = useRef(handleDrumPad);
  handleDrumPadRef.current = handleDrumPad;
  const handleBassAttackRef = useRef(handleBassAttack);
  handleBassAttackRef.current = handleBassAttack;
  const handleBassMoveRef = useRef(handleBassMove);
  handleBassMoveRef.current = handleBassMove;
  const handleBassReleaseRef = useRef(handleBassRelease);
  handleBassReleaseRef.current = handleBassRelease;
  const handleControlPadRef = useRef(handleControlPad);
  handleControlPadRef.current = handleControlPad;
  const onCancelPadModeRef = useRef(onCancelPadMode);
  onCancelPadModeRef.current = onCancelPadMode;
  const onTogglePlayRef = useRef(onTogglePlay);
  onTogglePlayRef.current = onTogglePlay;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      // R9: a modal traps focus/pointer on the background via `inert`, but a
      // window-level listener still sees its bubbled keydowns. Without this
      // guard, typing inside an open utility dialog could silently play a
      // background drum or attack a background bass note.
      if (openDialogRef.current) return;

      if (e.key === "Escape" && padModeRef.current !== "normal") {
        e.preventDefault();
        heldBassKeysRef.current.clear();
        handleBassReleaseRef.current();
        onCancelPadModeRef.current();
        return;
      }

      // Never hijack typing.
      const el = e.target as HTMLElement;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;

      if (e.code === "Space" || e.key === " ") {
        // A focused control should get Space to activate itself; only toggle
        // transport (and block page scroll) when the body has focus.
        const active = document.activeElement;
        if (
          active &&
          active !== document.body &&
          (active.tagName === "BUTTON" ||
            active.tagName === "INPUT" ||
            (active as HTMLElement).getAttribute?.("role") === "button" ||
            active.tagName === "A")
        ) {
          // let the control handle Space
        } else {
          e.preventDefault();
          onTogglePlayRef.current();
        }
        return;
      }

      const idx = KEY_TO_PAD_INDEX.indexOf(e.key.toLowerCase());
      if (idx < 0 || idx >= PAD_IDS.length) return;

      const pad = PAD_IDS[idx];
      if (padModeRef.current !== "normal") {
        e.preventDefault();
        if (padModeRef.current === "pattern" || padModeRef.current === "delete") {
          handleControlPadRef.current(pad);
        }
        return;
      }
      if (modeRef.current === "bass") {
        const held = heldBassKeysRef.current;
        const wasHoldingBass = held.size > 0;
        held.set(e.code, pad);
        if (wasHoldingBass) handleBassMoveRef.current(pad);
        else handleBassAttackRef.current(pad);
      } else {
        handleDrumPadRef.current(pad);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      const held = heldBassKeysRef.current;
      if (!held.delete(e.code)) return;
      const heldPads = Array.from(held.values());
      const nextHeldPad = heldPads[heldPads.length - 1];
      if (nextHeldPad && modeRef.current === "bass") {
        handleBassMoveRef.current(nextHeldPad);
      } else {
        handleBassReleaseRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A browser can stop delivering a keyup when it loses focus. Clear the
  // bookkeeping and release the live voice on that boundary and on teardown.
  useEffect(() => {
    function releaseHeldBass() {
      heldBassKeysRef.current.clear();
      handleBassReleaseRef.current();
    }
    window.addEventListener("blur", releaseHeldBass);
    return () => {
      window.removeEventListener("blur", releaseHeldBass);
      releaseHeldBass();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearHeldKeys() {
    heldBassKeysRef.current.clear();
  }

  return { clearHeldKeys };
}

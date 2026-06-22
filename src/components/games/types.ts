import type { MutableRefObject } from "react";

/** Logical control inputs a game understands, independent of keyboard/touch. */
export type GameAction = "up" | "down" | "left" | "right" | "action";

/** Imperative handle the mobile Handheld console uses to drive a game with
 *  on-screen buttons. `phase` distinguishes press from release — momentary
 *  games (Snake direction, Dino jump) react to "down"; held inputs (Pong
 *  paddle) use both. */
export interface GameHandle {
  input(action: GameAction, phase: "down" | "up"): void;
}

export interface GameProps {
  active: boolean;
  /** When provided (Handheld on mobile), the game publishes its GameHandle
   *  here so touch buttons can drive it. Desktop/keyboard leaves it undefined. */
  controlRef?: MutableRefObject<GameHandle | null>;
}

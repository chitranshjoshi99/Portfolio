import { useEffect, useRef, useState } from 'react';
import { ChannelStatic } from '../ChannelStatic';
import { Snake } from '../games/Snake';
import { Pong } from '../games/Pong';
import { DinoRun } from '../games/DinoRun';
import type { LabExperiment } from '../../data/labs';
import type { GameProps } from '../games/types';
import './style.css';

type TVStatus = 'live' | 'static';

const GAME_MAP: Record<string, React.ComponentType<GameProps>> = {
  snake: Snake,
  pong: Pong,
  dino: DinoRun,
};

interface Props {
  activeChannel: number;
  tvExperiments: LabExperiment[];
}

export function TVScreen({ activeChannel, tvExperiments }: Props) {
  const [displayChannel, setDisplayChannel] = useState(activeChannel);
  const [status, setStatus] = useState<TVStatus>('live');
  const prevChannel = useRef(activeChannel);

  useEffect(() => {
    if (activeChannel === prevChannel.current) return;
    prevChannel.current = activeChannel;

    // Trigger static burst, then switch
    setStatus('static');
    const t = setTimeout(() => {
      setDisplayChannel(activeChannel);
      setStatus('live');
    }, 280);
    return () => clearTimeout(t);
  }, [activeChannel]);

  const exp = tvExperiments.find((e) => e.channel === displayChannel);
  const incomingExp = tvExperiments.find((e) => e.channel === activeChannel);
  const GameComponent = exp ? GAME_MAP[exp.game] : null;

  return (
    <div
      className={`tv-screen tv-screen--${status}`}
      aria-live="polite"
      aria-label={`Channel ${displayChannel}${exp ? `: ${exp.title}` : ''}`}
    >
      {status === 'static' && (
        <>
          <ChannelStatic />
          <div
            className="tv-screen__ch-flash pixel-text"
            style={{ color: incomingExp?.accent }}
            aria-hidden="true"
          >
            CH {String(activeChannel).padStart(2, '0')}
          </div>
        </>
      )}
      {status === 'live' && GameComponent && (
        /* key ensures fresh mount (and fresh state) on channel change */
        <GameComponent key={displayChannel} active={true} />
      )}
      {status === 'live' && !GameComponent && (
        <div className="tv-screen__nosignal pixel-text" aria-label="No signal">
          NO SIGNAL
        </div>
      )}
    </div>
  );
}

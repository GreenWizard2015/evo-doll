import React, { useState, useRef, useCallback, useEffect } from 'react';
import Arena, { IFightFinishedEvent, IPlayerData, IScores } from './Arena';

interface IArenaData {
  brainA: IPlayerData;
  brainB: IPlayerData;
  uuid: any;
}
type IArenaDataItem = IArenaData | null;

type IColosseumProps = {
  totalArenas?: number; // the total number of arenas
  updateScores: (scores: IScores[]) => void; // the callback to update the scores per arena
};

function Colosseum({ totalArenas = 2, updateScores }: IColosseumProps) {
  const brainQueue = useRef<IPlayerData[]>([]);
  const arenas = useRef<IArenaDataItem[]>(Array(totalArenas).fill(null));
  const [scores, setScores] = useState<IScores[]>(
    Array(totalArenas).fill({ playerA: 0, playerB: 0 })
  );

  useEffect(() => {
    updateScores(scores);
  }, [scores, updateScores]); // propagate the scores to the parent component

  const enqueue = (brain, onFinish, uuid) => {
    brainQueue.current.push({ model: brain, callback: onFinish, uuid });
    startNextFight();
  };

  const onUpdateScores = useCallback((scores: IScores, uuid: any) => {
    setScores((prevScores) => {
      const newScores = [...prevScores];
      newScores[uuid] = scores; // update the scores of the arena
      return newScores;
    });
  }, []);

  const startNextFight = useCallback(() => {
    const freeArenaIndex = arenas.current.indexOf(null);
    if (freeArenaIndex < 0) return; // No free arena
    if (brainQueue.current.length < 2) return; // Not enough brains to fight

    const brainA = brainQueue.current.shift();
    const brainB = brainQueue.current.shift();
    const newArenaData: IArenaData = {
      brainA: brainA,
      brainB: brainB,
      uuid: freeArenaIndex, // the UUID of the arena is the index
    };
    arenas.current[freeArenaIndex] = newArenaData; // assign the new fight to the arena
  }, []);

  const handleFinished = React.useCallback((ev: IFightFinishedEvent) => {
    const { playerA, playerB, scores, uuid } = ev;
    // send evaluation results to the players
    playerA.callback({
      score: scores.playerA,
      uuid: playerA.uuid,
      model: playerA.model,
      arena: uuid
    });
    playerB.callback({
      score: scores.playerB,
      uuid: playerB.uuid,
      model: playerB.model,
      arena: uuid
    });

    // update the arena data
    arenas.current[uuid] = null; // free the arena
  }, []);

  return (
    <>
      {arenas.current.map((arena, i) => 
        arena ? (
          <Arena
            key={i}
            uuid={arena.uuid}
            ZPos={i * 2}
            timeLimit={30 * 1000}
            playerA={arena.brainA}
            playerB={arena.brainB}
            updateScores={onUpdateScores}
            onFinished={handleFinished}
          />
        ) : null
      )}
    </>
  );
}

export default Colosseum;

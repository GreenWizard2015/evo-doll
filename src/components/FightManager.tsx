import React from "react";
import { useColosseum } from "./Colosseum";
import { v5 as generateUUID } from "uuid";
import { Brain } from "../helpers/NN";
import { RAGDOLL_PARTS } from "./Ragdoll";
import { IPlayerData } from "./Arena";

interface IFighter extends IPlayerData {
  score: number | null; // null if the fighter is not evaluated yet
}

function FightManager({
  fightersPerEpoch = 10,
}) {
  const colosseum = useColosseum();
  const { addFighter } = colosseum; // get the addFighter function from the context
  const fighters = React.useRef<Map<string, IFighter>>(new Map()); // store the fighters
  const [left, setLeft] = React.useState<number>(0); // number of fighters left to evaluate
  const [epoch, setEpoch] = React.useState<number>(0); // current epoch

  const onFinished = React.useCallback(({score, uuid, model}) => {
    fighters.current[uuid].score = score; // update the score
    console.log('Fighter', uuid, 'scored', score);
    
    setLeft((prevLeft) => prevLeft - 1); // decrease the number of fighters left to evaluate
  }, [fighters]);
  
  React.useEffect(() => {
    // create fighters
    const fightersLocal: Map<string, IFighter> = new Map();
    for (let i = 0; i < fightersPerEpoch; i++) {
      const uuid = generateUUID(Date.now().toString(), generateUUID.DNS);
      const model = new Brain({ inputSize: 240, outputSize: RAGDOLL_PARTS.length });
      // apply huge mutation to the model
      model.mutate({ rate: 1.0, std: 10.0 });
      const player: IFighter = { model, callback: onFinished, uuid, score: null };
      fightersLocal[uuid] = player;
      // add the fighter to the colosseum
      addFighter(player, player.uuid);
      setLeft(left => left + 1);
    }
    fighters.current = fightersLocal;
  }, [addFighter, fightersPerEpoch, onFinished]);

  return null;
}

export default FightManager;
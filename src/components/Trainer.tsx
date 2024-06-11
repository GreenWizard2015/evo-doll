import React, { MutableRefObject } from "react";
import { ReplayBuffer } from "./ReplayBuffer";
import { CActorNetwork } from "../networks/ActorNetwork";

type TrainedEventCallback = (model: CActorNetwork, uuid: string, data?: any) => void;
interface ITrainerContext {
  nextEpoch: () => void;
  train: (model: CActorNetwork, callback: MutableRefObject<TrainedEventCallback>, uuid: string) => void;
}

const TrainerContext = React.createContext<ITrainerContext | undefined>(undefined);

export const useTrainer = () => {
  const context = React.useContext(TrainerContext);
  if (!context) {
    throw new Error('useTrainer must be used within a TrainerProvider');
  }
  return context;
};

function TrainerProvider({ children, trainable}) {
  const [worker, setWorker] = React.useState<Worker | null>(null);
  const [callbacksByUUID, setCallbacksByUUID] = React.useState<
    Record<string, MutableRefObject<TrainedEventCallback>
  >>({});
  const nextEpoch = React.useCallback(() => {
    if (!worker) return; // FIXME: handle this case on start
    if (!trainable) return;
    worker.postMessage({
      type: 'dataset',
      dataset: ReplayBuffer.raw() // clone the replay buffer
    });
  }, [worker, trainable]);

  const train = React.useCallback(
    (model: CActorNetwork, callback: MutableRefObject<TrainedEventCallback>, uuid: string) => {
      console.log('Training', uuid);
      if (!worker) {
        throw new Error('Worker not ready');
      }
      if (!trainable) {
        callback.current(model, uuid); // immediately return the model
        return;
      }
      setCallbacksByUUID((prev) => ({ ...prev, [uuid]: callback }));
      worker.postMessage({
        type: 'train',
        model: model.toTranserable(),
        uuid
      });
    }
  , [worker, trainable]);

  React.useEffect(() => {
    const worker = new Worker(new URL('../workers/trainer.worker.js', import.meta.url));
    setWorker(worker);
    worker.onmessage = (event) => {
      const { type, model, uuid } = event.data;
      if (type === 'trained') {
        console.log('Trained', uuid);
        const callback = callbacksByUUID[uuid];
        if (callback && callback.current) {
          const network = CActorNetwork.fromTransferable(model);
          callback.current(network, uuid);
        }
      }
      if (type === 'stopped') {
        console.log('Worker is stopped');
        worker.terminate();
      }
    };
    return () => {
      worker.postMessage({ type: 'stop' });
    };
  }, []);

  const api = React.useMemo(
    () => ({ nextEpoch, train }),
    [nextEpoch, train]
  );

  return (
    <TrainerContext.Provider value={api}>
      {children}
    </TrainerContext.Provider>
  );
};

function Trainer({ children, trainable }) {
  return (
    <TrainerProvider trainable={trainable}>
      {children}
    </TrainerProvider>
  );
}

export default Trainer;
export type { TrainedEventCallback };
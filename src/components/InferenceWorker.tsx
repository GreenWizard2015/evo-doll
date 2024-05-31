import { useEffect } from 'react';

export interface InferenceResult {
  data: any;
  uuid: string;
};

let worker;
function runInference({ model, state, callback, uuid }) {
  if(!worker) {
    throw new Error('Worker not initialized');
  }
  worker.postMessage({
    type: 'runInference',
    model: model,
    state: state,
    uuid: uuid,
    callback: callback
  });
}

function InferenceWorker({ }) {
  useEffect(() => {
    const newWorker = new Worker(new URL('./InferenceWorker.worker.js', import.meta.url));
    worker = newWorker;

    newWorker.onmessage = function(e) {
      const { status } = e.data;
      if('done' === status) {
        const { callback, data, uuid } = e.data;
        callback({ data, uuid });
        return;
      }
      throw new Error('Unknown status: ' + status);
    };

    return () => {
      newWorker.terminate();
    };
  }, []);
  return null;
};

export default InferenceWorker;
export { runInference };
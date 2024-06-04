import { useEffect } from 'react';

export interface InferenceResult {
  data: any;
  uuid: string;
};

let worker;
const CALLBACKS_BY_UUID = {};
function runInference({ model, state, callback, uuid, extras}) {
  if(!worker) {
    throw new Error('Worker not initialized');
  }
  CALLBACKS_BY_UUID[uuid] = callback; // store the callback
  worker.postMessage({
    type: 'runInference',
    model: model.toTranserable(),
    state, uuid, extras
  });
}

function InferenceWorker({ }) {
  useEffect(() => {
    const newWorker = new Worker(new URL('./InferenceWorker.worker.js', import.meta.url));
    worker = newWorker;

    newWorker.onmessage = function(e) {
      const { status } = e.data;
      if('done' === status) {
        const { data, uuid, state, extras } = e.data;
        const callback = CALLBACKS_BY_UUID[uuid];
        callback({ data, uuid, state, extras });
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
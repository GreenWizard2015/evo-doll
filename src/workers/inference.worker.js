const { CActorNetwork } = require("../networks/ActorNetwork.tsx");

const models = {}; // modelId -> { network, time }
let queue = {}; // uuid -> { model, state, callback }
let keys = []; // uuids
let running = false; // dumb way to check if worker is busy

function disposeOldModels(period) {
  const now = Date.now();
  const outdated = [];
  for (const modelId in models) {
    const { time } = models[modelId];
    const delta = now - time;
    if (period < delta) {
      outdated.push(modelId);
    }
  }
  for (const modelId of outdated) {
    const { network } = models[modelId];
    network.dispose();
    delete models[modelId];
  }

  if(0 < outdated.length) {
    self.postMessage({ status: "disposed", models: outdated });
  }
}

async function processQueue() {
  running = keys.length > 0;
  if (!running) return; // No tasks to process
  
  // Get next task
  const taskId = keys.pop();
  const task = queue[taskId];
  delete queue[taskId];

  const { state, extras } = task;
  const model = models[taskId];
  if (!model) {
    console.error("Model not found", taskId);
  } else {
    const results = model.network.predict([state]);
    model.time = Date.now(); // Update last used time
    self.postMessage({
      status: "done", 
      data: results, 
      uuid: taskId,
      state,
      extras
    });
  }

  disposeOldModels(1000 * 25); // Dispose models older than 5 seconds
  setTimeout(processQueue, 0); // Process next task
}

self.onmessage = async function({ data }) {
  if (data.type === "stop") {
    disposeOldModels(-Number.MAX_VALUE); // Dispose all models
    self.postMessage({ status: "stopped" });
    return;
  }
  if (data.type === "model") { // store the model "locally"
    const { model, uuid } = data;
    const network = CActorNetwork.fromTransferable(model);
    models[uuid] = {network, time: Date.now()};
    return;
  }
  if (data.type === "runInference") { // run inference for the given state and model
    const { state, uuid, extras } = data;
    queue[uuid] = { state, extras };
    if (!keys.includes(uuid)) keys.push(uuid);
    if (!running) {
      processQueue();
    }
  }
}
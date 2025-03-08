const { CActorNetwork } = require("../networks/ActorNetwork.tsx");

const INFERENCE_INTERVAL = 1000 / 10; // Interval between inferences
const models = {}; // modelId -> { network, time when last used }
let queue = {}; // uuid -> { model, state }
let to_be_processed = []; // list of uuids to be processed
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

  if (0 < outdated.length) {
    self.postMessage({ status: "disposed", models: outdated });
  }
}

function nextTask() {
  const now = Date.now();
  let bestTime = Number.MAX_VALUE;
  let bestMatch = null;
  for (const taskId in to_be_processed) {
    const model = models[taskId];
    // if model is not used, set time to INFERENCE_INTERVAL
    const time = model.time ? now - model.time : INFERENCE_INTERVAL;
    if (time < INFERENCE_INTERVAL) continue; // Skip this model

    if (time < bestTime) {
      bestTime = time;
      bestMatch = taskId;
    }
  }
  if (bestMatch) {
    const { state, extras } = queue[bestMatch];
    delete queue[bestMatch];
    delete to_be_processed[to_be_processed.indexOf(bestMatch)];
    return {
      state, extras,
      model: models[bestMatch],
      taskId: bestMatch
    };
  }
  return null;
}

async function processQueue() {
  running = to_be_processed.length > 0;
  if (!running) return; // No tasks to process

  // Get next task
  const taskData = nextTask();
  if (taskData) {
    const { state, extras, model, taskId } = taskData;
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
  }

  disposeOldModels(1000 * 25); // Dispose models older than 25 seconds
  setTimeout(processQueue, 0); // Process next task
}

self.onmessage = async function ({ data }) {
  if (data.type === "stop") {
    disposeOldModels(-Number.MAX_VALUE); // Dispose all models
    self.postMessage({ status: "stopped" });
    return;
  }
  if (data.type === "model") { // store the model "locally"
    const { model, uuid } = data;
    const network = CActorNetwork.fromTransferable(model);
    models[uuid] = { network, time: Date.now() };
    return;
  }
  if (data.type === "runInference") { // run inference for the given state and model
    const { state, uuid, extras } = data;
    queue[uuid] = { state, extras };
    if (!to_be_processed.includes(uuid)) to_be_processed.push(uuid);
    if (!running) {
      processQueue();
    }
  }
}
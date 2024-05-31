let queue = {}; // uuid -> { model, state, callback }
let running = false; // dumb way to check if worker is busy

async function processQueue() {
  const keys = Object.keys(queue);
  running = keys.length > 0;
  if (!running) return; // No tasks to process

  // Get next task
  const taskId = keys[0];
  const task = queue[taskId];
  delete queue[taskId];

  const { model, state, callback } = task;
  const results = model.predict(state);
  self.postMessage({ status: "done", data: results, callback, uuid: taskId });
  
  processQueue(); // Process next task
}

self.onmessage = async function({ data }) {
  if (data.type === "runInference") {
    const { model, state, callback, uuid } = data;
    queue[uuid] = { model, state, callback };
    if (!running) {
      processQueue();
    }
  }
}
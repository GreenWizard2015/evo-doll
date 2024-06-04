interface IRBItem {
  state: any;
  action: any;
  score: number;
  time: number;
}

interface IRBItemProcessed {
  state: any;
  action: any;
  reward: number;
}

class CReplayBuffer {
  private buffer: IRBItemProcessed[];
  private size: number;
  private index: number;
  private discount: number;
  private runs: Map<string, IRBItem[]>;

  constructor({ size, discount = 0.99 }) {
    this.size = size;
    this.discount = discount;
    this.buffer = [];
    this.index = 0;
    this.runs = new Map();
  }

  private _add(item: IRBItemProcessed): void {
    if (this.buffer.length < this.size) {
      this.buffer.push(item);
      return;
    }
    // replace the oldest item
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.size;
  }

  public add({state, action, score, time, runId, isDone=false}): void {
    if (!this.runs.has(runId)) {
      this.runs.set(runId, []);
    }
    const item: IRBItem = { state, action, score, time };
    const run: IRBItem[] = this.runs.get(runId);
    run.push(item); // add to run

    if (isDone) { // process run
      // sort run by time in ascending order
      run.sort((a, b) => a.time - b.time);
      // convert score to rewards, and then to discounted rewards
      const scores = run.map((item, i) => item.score);
      // to obtain rewards, we need to subtract the next score from the current score
      const rewards = [0];
      for (let i = 1; i < scores.length; i++) {
        rewards.push(scores[i] - scores[i - 1]);
      }
      // calculate discounted rewards
      const discountedRewards = [];
      let reward = 0;
      for (let i = rewards.length - 1; i >= 0; i--) {
        reward = rewards[i] + this.discount * reward;
        discountedRewards.unshift(reward); // add to the beginning of the array
      }
      // convert to IRBItemProcessed and add to buffer
      for (let i = 0; i < run.length; i++) {
        const item = run[i];
        const processedItem: IRBItemProcessed = {
          state: item.state,
          action: item.action,
          reward: discountedRewards[i]
        };
        this._add(processedItem);
      }
    }
  }

  // return all samples in the buffer and clear the buffer
  public samples(): IRBItemProcessed[] {
    const samples: IRBItemProcessed[] = this.buffer;
    this.buffer = []; // clear buffer
    return samples;
  }
}

export const ReplayBuffer = new CReplayBuffer({
  size: 10000
});
interface IRBItem {
  state: any;
  action: any;
  score: number;
  time: number;
}

interface IRBItemProcessed {
  state: any;
  nextState: any;
  action: any;
  nextAction: any;
  reward: number;
  isDone: boolean;
}

class CReplayBuffer {
  private buffer: IRBItemProcessed[];
  private size: number;
  private index: number;
  private runs: Map<string, IRBItem[]>;
  public readonly discount: number;

  constructor({ size, discount = 0.9, buffer = []}) {
    this.size = size;
    this.discount = discount;
    this.buffer = [...buffer];
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
    if((null == state) || (null == action)) {
      if(!isDone) {
        throw new Error('state and action are required.');
      }
      
      console.log('bad episode, skipping...');
      console.log(this.runs[runId]);

      if(this.runs.has(runId)) {
        this.runs.delete(runId);
      }
      return;
    }
    
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
        const nextItem = ((i + 1) < run.length) ? run[i + 1] : run[i];
        const processedItem: IRBItemProcessed = {
          state: item.state,
          nextState: nextItem.state,
          action: item.action,
          nextAction: nextItem.action,
          reward: discountedRewards[i],
          isDone: i === run.length - 1,
        };
        this._add(processedItem);
      }
    }
  }

  public raw() {
    return {
      size: this.size,
      discount: this.discount,
      buffer: this.buffer
    };
  }
  
  public sample(size: number) {
    const samples = [];
    for (let i = 0; i < size; i++) {
      const index = Math.floor(Math.random() * this.buffer.length);
      samples.push(this.buffer[index]);
    }
    return {
      state: samples.map((item) => item.state),
      nextState: samples.map((item) => item.nextState),
      action: samples.map((item) => item.action),
      nextAction: samples.map((item) => item.nextAction),
      reward: samples.map((item) => [item.reward]),
      discount: samples.map((item) => [item.isDone ? 0 : this.discount])
    }
  }
}

export const ReplayBuffer = new CReplayBuffer({
  size: 10000
});

export { CReplayBuffer };
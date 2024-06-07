import * as tf from '@tensorflow/tfjs';

// Prevents OutOfMemory - forces TFJS to clear WebGL textures when reaching 256Mb
tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 256000000);

// Define the model creation function
const createModel = ({
  inputSize, outputSize,
  hiddenLayers = 4, hiddenUnits = 64,
  finalActivation = 'tanh'
}) => {
  const model = tf.sequential();
  
  // Input layer
  model.add(tf.layers.dense({ inputShape: [inputSize], units: hiddenUnits, activation: 'relu' }));
  
  // Hidden layers
  for (let i = 0; i < hiddenLayers; i++) {
    model.add(tf.layers.dense({ units: hiddenUnits, activation: 'relu' }));
  }
  
  // Output layer
  model.add(tf.layers.dense({
    units: outputSize,
    activation: finalActivation as any
  }));
  return model;
};

class CMLPNetwork {
  private _config: any;
  private _optimizer: tf.Optimizer;
  private model: tf.Sequential;

  constructor(config, optimizer=null) {
    this._config = config;
    this._optimizer = optimizer;
    this.model = createModel(config);
    if (optimizer) {
      this.model.compile({ optimizer, loss: [null] });
    }
  }

  dispose() {
    this.model.dispose();
  }

  // Mutating the weights of a neural network model in a genetic algorithm with a given mutation rate and a random Gaussian function.
  mutate({ rate, std=0.1}) {
    tf.tidy(() => {
      const weights = this.model.getWeights();
      const mutatedWeights = [];
      for (let i = 0; i < weights.length; i++) {
        const values = weights[i];
        const shape = values.shape;
        const noise = tf.randomNormal(shape, 0, std);
        const mask = tf.less(tf.randomUniform(shape), rate).asType('bool');
        mutatedWeights[i] = tf.tensor(
          tf.add(values, tf.where(mask, noise, tf.zerosLike(noise))).dataSync(),
          shape
        );
      }

      this.model.setWeights(mutatedWeights);
    });
  }

  // Copying weights to the new model, mutates the copied model, and returns a new network object with the mutated copied model.
  copy() {
    return tf.tidy(() => {
      const weights = this.model.getWeights();
      const weightCopies = [];
      for (let i = 0; i < weights.length; i++) {
        weightCopies[i] = weights[i].clone();
      }

      const network = new CMLPNetwork(this._config);
      network.model.setWeights(weightCopies);
      return network as any;
    });
  }

  combine({ model, factor=0.5, inplace=false }) {
    return tf.tidy(() => {
      const weights1 = this.model.getWeights();
      const weights2 = model.model.getWeights();
      const newWeights = [];

      for (let i = 0; i < weights1.length; i++) {
        const A = weights1[i];
        const shape = A.shape;
        const B = weights2[i];
        const newValues = tf.add(
          tf.mul(A, factor),
          tf.mul(B, 1 - factor)
        ).dataSync();

        newWeights[i] = tf.tensor(newValues, shape);
      }
      if (inplace) {
        this.model.setWeights(newWeights);
        return this;
      }
      // create a new network object with the combined weights
      const network = new CMLPNetwork(this._config);
      network.model.setWeights(newWeights);
      return network as any;
    });
  }

  // Predicting the output using a neural network model, gets the output values, and returns the predicted outputs.
  predict(inputs) {
    const B = inputs.length;
    const N = inputs[0].length;
    return tf.tidy(() => {
      const tensor2d = tf.tensor2d(inputs, [B, N]);
      const prediction = this.predictRaw(tensor2d) as tf.Tensor;
      return prediction.dataSync();
    });
  }

  predictRaw(inputs) {
    return this.model.predict(inputs);
  }

  flatWeights() {
    return tf.tidy(() => {
      const weights = this.model.getWeights();
      const flat = [];
      for (let i = 0; i < weights.length; i++) {
        const size = weights[i].size;
        flat.push(tf.reshape(weights[i], [size]).dataSync());
      }
      return flat.reduce((acc, val) => acc.concat(Array.from(val)), []);;
    });
  }

  toTranserable() {
    return {
      configs: this._config,
      weights: this.flatWeights()
    };
  }

  // static method to create a network object from a transferable object
  static fromTransferable({ configs, weights }) {
    const network = new CMLPNetwork(configs);
    tf.tidy(() => {
      const modelWeights = network.model.getWeights();
      let offset = 0;
      for (let i = 0; i < modelWeights.length; i++) {
        const size = modelWeights[i].size;
        const shape = modelWeights[i].shape;
        const values = weights.slice(offset, offset + size);
        modelWeights[i] = tf.tensor(values, shape);
        offset += size;
      }
      network.model.setWeights(modelWeights);
    });
    return network;
  }

  fit(lossFn) {
    return this._optimizer.minimize(lossFn, true, this.model.getWeights(true) as any);
  }
}

export { CMLPNetwork };
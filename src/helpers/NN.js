import * as tf from '@tensorflow/tfjs';

// Prevents OutOfMemory - forces TFJS to clear WebGL textures when reaching 256Mb
tf.env().set("WEBGL_DELETE_TEXTURE_THRESHOLD", 256000000);

const MUTATION_RATE = 0.1;

// Define the model creation function
const createModel = ({ inputSize, outputSize }) => {
  const model = tf.sequential();

  // Input layer
  model.add(tf.layers.dense({ inputShape: [inputSize], units: 256, activation: 'relu' }));

  // Hidden layers
  for (let i = 0; i < 4; i++) {
    model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
  }

  // Output layer
  model.add(tf.layers.dense({ units: outputSize, activation: 'sigmoid' }));
  return model;
};

class Brain {
  constructor({ inputSize, outputSize }) {
    this._inputSize = inputSize;
    this._outputSize = outputSize;
    this.model = createModel({ inputSize: this._inputSize, outputSize: this._outputSize });
  }

  dispose() {
    this.model.dispose();
  }

  // Mutating the weights of a neural network model in a genetic algorithm with a given mutation rate and a random Gaussian function.
  mutate({ rate=MUTATION_RATE, std=0.1}) {
    tf.tidy(() => {
      const weights = this.model.getWeights();
      const mutatedWeights = [];

      for (let i = 0; i < weights.length; i++) {
        let tensor = weights[i];
        let values = tensor.dataSync().slice();
        const noise = tf.randomNormal([values.length], 0, std);
        const mask = tf.less(tf.randomUniform([values.length]), rate).asType('bool');
        values = values + tf.where(mask, noise, tf.zerosLike(noise)).dataSync();

        let newTensor = tf.tensor(values, shape);
        mutatedWeights[i] = newTensor;
      }

      this.model.setWeights(mutatedWeights);
    });
  }

  // Copying weights to the new model, mutates the copied model, and returns a new brain object with the mutated copied model.
  copy({ mutate=true }) {
    return tf.tidy(() => {
      const modelCopy = createModel({ inputSize: this.input_count, outputSize: this.output_count });
      const weights = this.model.getWeights();
      const weightCopies = [];
      for (let i = 0; i < weights.length; i++) {
        weightCopies[i] = weights[i].clone();
      }
      modelCopy.setWeights(weightCopies);

      let brain = new Brain();
      brain.model = modelCopy;
      if (mutate) brain.mutate();

      return brain;
    });
  }

  combine(brain, factor=0.5) {
    // Combine the weights of two neural network models by averaging the weights of the two models.
    tf.tidy(() => {
      const weights1 = this.model.getWeights();
      const weights2 = brain.model.getWeights();
      const newWeights = [];

      for (let i = 0; i < weights1.length; i++) {
        const A = weights1[i];
        const B = weights2[i];
        const newValues = tf.add(
          tf.mul(A, factor),
          tf.mul(B, 1 - factor)
        ).dataSync();

        newWeights[i] = tf.tensor(newValues, shape);
      }

      this.model.setWeights(newWeights);
    });
  }

  // Predicting the output using a neural network model, gets the output values, and returns the predicted outputs.
  predict(inputs) {
    return tf.tidy(() => {
      const tensor2d = tf.tensor2d([inputs], [1, inputs.length]);
      const prediction = this.model.predict(tensor2d);
      const outputs = prediction.dataSync();

      return outputs;
    });
  }
}

export { Brain };
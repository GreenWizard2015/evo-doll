import React, { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { OrbitControls } from '@react-three/drei';
import Scene from './Scene';
import CustomCamera from './CustomCamera';
import InferenceWorker from './InferenceWorker';
import Colosseum from './Colosseum';
import { IScores } from './Arena';
import FightManager from './FightManager';
import FormRange from 'react-bootstrap/FormRange';
import Trainer from './Trainer';
import { Form } from 'react-bootstrap';
import ConfidenceIntervalsGraph from './ConfidenceIntervalsGraph';

function estimateAgentsToEvaluate(seedsN: number, withNoise: boolean, crossoversSplits: number) {
  const pairs = seedsN * (seedsN + 1) / 2;
  const bySplittings = pairs * crossoversSplits;
  return seedsN + (withNoise ? seedsN : 0) + bySplittings;
}

const App: React.FC = () => {
  const [scores, setScores] = React.useState<IScores[]>([]);
  const [fightStats, setFightStats] = React.useState<Array<React.ReactNode>>([]);
  const [totalArenas, setTotalArenas] = React.useState<number>(10);
  const [seedsN, setSeedsN] = React.useState<number>(20);
  const [inferSpeed, setInferSpeed] = React.useState<number>(0);
  const [isTrainable, setIsTrainable] = React.useState<boolean>(false);
  const [isPaused, setIsPaused] = React.useState<boolean>(false);
  const togglePause = React.useCallback((e) => {
    setIsPaused((oldValue) => !oldValue);
  }, []);

  const btnStyle: CSSProperties = {
    position: 'absolute',
    bottom: 20,
    left: 0,
    color: 'white',
    padding: '10px',
    background: 'green',
    borderRadius: '5px',
    width: '100%',
  };
  const sidebarStyle: CSSProperties = {
    position: 'absolute', top: 0, right: 0, 
    color: 'white', padding: '10px', background: 'rgba(0, 0, 0, 0.5)', 
    borderRadius: '5px',
    width: '300px',
    height: '100%'
  };

  const [timeLimit, setTimeLimit] = React.useState<number>(10);
  const [runId, setRunId] = React.useState<string>(Date.now().toString());

  const newRun = React.useCallback(() => {
    setRunId(Date.now().toString());
  }, []);

  const statistics = React.useRef<number[][]>([]);
  React.useEffect(() => {
    statistics.current = [];
  }, [runId]); // reset the statistics when a new run is started
  const addStatistic = React.useCallback((newStatistics: { epoch: number, scores: number[] }) => {
    const scoresNew = [...newStatistics.scores]; // copy the scores
    scoresNew.sort((a, b) => a - b); // sort the scores
    statistics.current.push(scoresNew); // add the scores to the statistics
  }, []);

  const [withNoise, setWithNoise] = React.useState<boolean>(true);
  const [noiseStd, setNoiseStd] = React.useState<number>(0.001);
  const [crossoversSplits, setCrossoversSplits] = React.useState<number>(1);

  return (
    <>
      <Canvas id='canvas' style={{ position: 'absolute' }}>
        <CustomCamera />
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <Physics isPaused={isPaused} allowSleep={false}>
          <Scene />

          <Colosseum 
            key={runId}
            totalArenas={totalArenas} updateScores={setScores} isPaused={isPaused}
            timeLimit={timeLimit * 1000}
          >
            <Trainer trainable={isTrainable}>
              <FightManager 
                updateStats={setFightStats} 
                addStatistic={addStatistic}
                additiveNoiseStd={withNoise ? noiseStd : 0}
                seedsN={seedsN}
                crossoversSplits={crossoversSplits}
              />
            </Trainer>
          </Colosseum>
        </Physics>
        <OrbitControls />
      </Canvas>

      <div style={{ position: 'absolute', top: 0, left: 0, color: 'white', padding: '10px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '5px' }}>
        {scores.map((scores, i) => (
          <div key={i}>
            <div>Arena {i + 1} | Player A: {scores.playerA} | Player B: {scores.playerB}</div>
          </div>
        ))}
        <div>
          <label>Inference speed: {inferSpeed.toFixed(2)} per second</label>
        </div>
        {fightStats}
      </div>
      <InferenceWorker updateSpeed={setInferSpeed} />
      {/* right sidebar */}
      <div style={sidebarStyle}>
        <div>
          <label>Total arenas ({totalArenas})</label>
          <FormRange 
            min={1} max={20} value={totalArenas} 
            onChange={(e) => setTotalArenas(parseInt(e.target.value))} 
          />
        </div>
        <div>
          <label>Seeds N ({seedsN})</label>
          <FormRange 
            min={1} max={100} value={seedsN} 
            onChange={(e) => setSeedsN(parseInt(e.target.value))}
          />
        </div>
        <div>
          <label>Time limit ({timeLimit} seconds)</label>
          <FormRange 
            min={1} max={100} value={timeLimit} 
            onChange={(e) => setTimeLimit(parseInt(e.target.value))}
          />
        </div>
        {/* panel for noise */}
        <div style={{border: '1px solid white', padding: '10px', borderRadius: '5px' }}>
          <Form.Check
            type='checkbox'
            label={'Additive noise (' + noiseStd.toFixed(3) + ')'}
            checked={withNoise}
            onChange={(e) => setWithNoise(e.target.checked)}
          />
          <FormRange 
            min={0.001} max={1.0} step={0.001} value={noiseStd} 
            onChange={(e) => setNoiseStd(parseFloat(e.target.value))}
            disabled={!withNoise}
          />
        </div>
        {/* panel for crossovers */}
        <div style={{border: '1px solid white', padding: '10px', borderRadius: '5px' }}>
          <label>Crossovers splits ({crossoversSplits})</label>
          <FormRange 
            min={0} max={5} value={crossoversSplits} 
            onChange={(e) => setCrossoversSplits(parseInt(e.target.value))}
          />
        </div>
        <div>
          {'Estimated agents to evaluate: ' + estimateAgentsToEvaluate(seedsN, withNoise, crossoversSplits)}
        </div>
        {/* 
        <div>
          <Form.Check
            type='checkbox'
            label='Trainable'
            checked={isTrainable}
            onChange={(e) => setIsTrainable(e.target.checked)}
          />
        </div>
         */}
        {/* button to start a new run */}
        <button style={{background: 'blue', color: 'white', padding: '10px', borderRadius: '5px', width: '100%', marginTop: '10px'}} onClick={newRun}>
          New run
        </button>
        {/* at bottom green button */}
        <button style={btnStyle} onClick={togglePause}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <ConfidenceIntervalsGraph 
        data={statistics.current} 
        height={400} width={600}
        levels={[[1.0, 'black'], [0.9, 'red'], [0.75, 'green'], [0.5, 'blue']]}
        style={{ position: 'absolute', bottom: 0, left: 0 }}
      />
    </>
  );
}

export default App;
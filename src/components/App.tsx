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

const App: React.FC = () => {
  const [scores, setScores] = React.useState<IScores[]>([]);
  const [fightStats, setFightStats] = React.useState<Array<React.ReactNode>>([]);
  const [totalArenas, setTotalArenas] = React.useState<number>(10);
  const [fightersPerEpoch, setFightersPerEpoch] = React.useState<number>(100);
  const [seedsN, setSeedsN] = React.useState<number>(20);
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

  const [timeLimit, setTimeLimit] = React.useState<number>(10);

  return (
    <>
      <Canvas id='canvas' style={{ position: 'absolute' }}>
        <CustomCamera />
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <Physics isPaused={isPaused} allowSleep={false}>
          <Scene />

          <Colosseum 
            totalArenas={totalArenas} updateScores={setScores} isPaused={isPaused}
            timeLimit={timeLimit * 1000}
          >
            <FightManager 
              updateStats={setFightStats} 
              fightersPerEpoch={fightersPerEpoch} 
              seedsN={seedsN} 
            />
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
        {fightStats}
      </div>
      <InferenceWorker />
      {/* right sidebar */}
      <div style={{ 
        position: 'absolute', top: 0, right: 0, 
        color: 'white', padding: '10px', background: 'rgba(0, 0, 0, 0.5)', 
        borderRadius: '5px',
        width: '300px',
        height: '100%'
      }}>
        <div>
          <label>Total arenas ({totalArenas})</label>
          <FormRange 
            min={1} max={100} value={totalArenas} 
            onChange={(e) => setTotalArenas(parseInt(e.target.value))} 
          />
        </div>
        <div>
          <label>Fighters per epoch ({fightersPerEpoch})</label>
          <FormRange 
            min={1} max={100} value={fightersPerEpoch} 
            onChange={(e) => setFightersPerEpoch(parseInt(e.target.value))}
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
        {/* at bottom green button */}
        <button style={btnStyle} onClick={togglePause}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </>
  );
}

export default App;
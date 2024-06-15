import React from 'react';

type CongidenceLevel = [number, string];
type ConfidenceIntervalsGraphProps = {
  data: number[][], // data in subarrays should be sorted
  height: number,
  width: number,
  style?: React.CSSProperties,
  levels: CongidenceLevel[],
};
const ConfidenceIntervalsGraph = ({ 
  data,
  height, width,
  style,
  levels,
}: ConfidenceIntervalsGraphProps) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const colors = React.useMemo(() => {
    return levels.map((level, index) => level[1]);
  }, [levels]);
  const levelsValues = React.useMemo(() => {
    return levels.map((level) => level[0]);
  }, [levels]);
  const visibleData = React.useMemo(() => {
    const res = data;
    // only last 50 values
    if (50 < res.length) {
      return res.slice(-50);
    }
    return res;
  }, [data]);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // fill the background
    ctx.fillStyle = 'silver';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const graphWidth = canvas.width;
    const graphHeight = canvas.height;
    const xScale = graphWidth / (visibleData.length - 1);

    // calculate levels
    const perLevel = [];
    levelsValues.forEach((level) => {      
      perLevel.push(visibleData.map(values => values[Math.floor(values.length * level) - 1]));
    });
    console.log(perLevel);

    const flat = perLevel.flat();
    const yMax = Math.max(...flat);
    const yMin = Math.min(...flat);
    const yScale = graphHeight / (yMax - yMin);

    perLevel.forEach((level, levelIndex) => {
      ctx.beginPath();
      ctx.strokeStyle = colors[levelIndex];

      level.forEach((y, index) => {
        const x = index * xScale;
        const yPosition = graphHeight - (y - yMin) * yScale;

        if (index === 0) {
          ctx.moveTo(x, yPosition);
        } else {
          ctx.lineTo(x, yPosition);
        }
      });

      ctx.stroke();
    });
    ctx.closePath();
    ctx.restore();
  }, [levelsValues, colors, visibleData]);

  // animate the graph by using requestAnimationFrame
  React.useEffect(() => {
    let frameId = null;
    const render = () => {
      draw();
      frameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [draw]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={style} />
  );
};

export default ConfidenceIntervalsGraph;

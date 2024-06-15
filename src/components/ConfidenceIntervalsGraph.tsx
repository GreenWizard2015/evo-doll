import React from 'react';

type ConfidenceLevel = [number, string];
type ConfidenceIntervalsGraphProps = {
  data: number[][], // data in subarrays should be sorted
  height: number,
  width: number,
  style?: React.CSSProperties,
  levels: ConfidenceLevel[],
};

const ConfidenceIntervalsGraph = ({ 
  data,
  height, 
  width, 
  style, 
  levels 
}: ConfidenceIntervalsGraphProps) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const colors = React.useMemo(() => levels.map((level) => level[1]), [levels]);
  const levelsValues = React.useMemo(() => levels.map((level) => level[0]), [levels]);

  const visibleData = React.useMemo(() => {
    // Ensure only the last N entries are returned
    const N = 50;
    return N < data.length ? data.slice(-N) : data;
  }, [data]);  

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'silver';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const graphWidth = canvas.width;
    const graphHeight = canvas.height;
    const xScale = graphWidth / (visibleData.length - 1);

    // Calculate levels
    const perLevel = levelsValues.map(level => {
      return visibleData.map(values => values[Math.floor(values.length * level) - 1]);
    });

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
      ctx.closePath();
    });
  }, [levelsValues, colors, visibleData]);

  // Animate the graph by using requestAnimationFrame
  React.useEffect(() => {
    let frameId = null;
    const render = () => {
      draw();
      frameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [draw]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={style} />
  );
};

export default ConfidenceIntervalsGraph;

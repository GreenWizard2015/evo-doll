import React from 'react';

const ConfidenceIntervalsGraph = ({ 
  data, 
  height, width,
  style,
  levels = [0.9, 0.75, 0.5],
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // fill the background
    ctx.fillStyle = 'silver';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const graphWidth = canvas.width;
    const graphHeight = canvas.height;
    const xScale = graphWidth / (data.length - 1);

    // calculate levels
    const perLevel = [];
    levels.forEach((level) => {      
      perLevel.push(data.map(values => values[Math.floor(values.length * level)]));
    });
    console.log(perLevel);    

    const flat = perLevel.flat();
    const yMax = Math.max(...flat);
    const yMin = Math.min(...flat);
    const yScale = graphHeight / (yMax - yMin);

    perLevel.forEach((level, levelIndex) => {
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${(levelIndex / levels.length) * 360}, 100%, 50%)`;

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
  }, [data, levels, canvasRef, height, width]);

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

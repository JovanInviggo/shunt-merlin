import { useEffect, useRef } from "react";

interface WaveformChartProps {
  data?: number[];
  width?: number;
  height?: number;
  color?: string;
  progress?: number; // 0 to 1 representing playback progress
  interactive?: boolean; // Allow clicking to seek
  onSeek?: (progress: number) => void;
}

export const WaveformChart = ({ 
  data, 
  width = 800, 
  height = 120,
  color = "#10b981", // green color for heartbeat
  progress = 0,
  interactive = false,
  onSeek
}: WaveformChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !onSeek || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickProgress = x / rect.width;
    onSeek(Math.max(0, Math.min(1, clickProgress)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines (thin gray lines)
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    const horizontalLines = 6;
    for (let i = 0; i <= horizontalLines; i++) {
      const y = (height / horizontalLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical grid lines
    const verticalLines = 20;
    for (let i = 0; i <= verticalLines; i++) {
      const x = (width / verticalLines) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Generate or use provided waveform data
    const waveformData = data || generateHeartbeatWaveform(width);

    // Draw waveform (green heartbeat)
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const centerY = height / 2;
    const amplitude = height * 0.35;

    waveformData.forEach((point, index) => {
      const x = (width / waveformData.length) * index;
      const y = centerY + point * amplitude;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw progress indicator (vertical line)
    if (progress > 0) {
      const progressX = width * progress;
      ctx.strokeStyle = "#ef4444"; // red color for progress line
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, height);
      ctx.stroke();

      // Add a subtle shadow/glow effect
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [data, width, height, color, progress]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
      style={{ maxWidth: "100%", cursor: interactive ? "pointer" : "default" }}
      onClick={handleCanvasClick}
    />
  );
};

// Generate realistic heartbeat waveform pattern
function generateHeartbeatWaveform(points: number): number[] {
  const waveform: number[] = [];
  const beatPattern = 150; // Points per heartbeat
  const numBeats = Math.floor(points / beatPattern);

  for (let beat = 0; beat < numBeats; beat++) {
    for (let i = 0; i < beatPattern; i++) {
      const progress = i / beatPattern;
      
      // P wave (small bump)
      if (progress < 0.15) {
        waveform.push(Math.sin(progress * Math.PI * 6.67) * 0.15);
      }
      // Flat segment
      else if (progress < 0.25) {
        waveform.push(0);
      }
      // QRS complex (sharp spike)
      else if (progress < 0.35) {
        const qrsProgress = (progress - 0.25) / 0.1;
        if (qrsProgress < 0.3) {
          waveform.push(-Math.sin(qrsProgress * Math.PI * 3.33) * 0.3);
        } else if (qrsProgress < 0.6) {
          waveform.push(Math.sin((qrsProgress - 0.3) * Math.PI * 3.33) * 1.0);
        } else {
          waveform.push(-Math.sin((qrsProgress - 0.6) * Math.PI * 2.5) * 0.2);
        }
      }
      // ST segment
      else if (progress < 0.45) {
        waveform.push(0);
      }
      // T wave (medium bump)
      else if (progress < 0.65) {
        waveform.push(Math.sin((progress - 0.45) * Math.PI * 5) * 0.25);
      }
      // Rest
      else {
        waveform.push(0);
      }
    }
  }

  // Fill remaining points
  while (waveform.length < points) {
    waveform.push(0);
  }

  return waveform.slice(0, points);
}

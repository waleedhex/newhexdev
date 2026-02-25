import React from 'react';

interface GoldenTextProps {
  visible: boolean;
  text?: string;
}

const GoldenText: React.FC<GoldenTextProps> = ({ visible, text = '✨ حرف ذهبي ✨' }) => {
  if (!visible) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
      <div
        className="text-[10vw] font-bold animate-golden-text whitespace-nowrap"
        style={{
          color: '#ffd700',
          textShadow: `
            0 0 10px #ffd700,
            0 0 20px #ffd700,
            0 0 30px #ff4500,
            2px 2px 4px rgba(0,0,0,0.5)
          `,
          WebkitTextStroke: '1.5px rgba(0,0,0,0.3)'
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default GoldenText;

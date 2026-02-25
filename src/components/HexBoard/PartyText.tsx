import React from 'react';

interface PartyTextProps {
  visible: boolean;
  textColor: string;
  text?: string;
}

const PartyText: React.FC<PartyTextProps> = ({ visible, textColor, text = 'مبروك' }) => {
  if (!visible) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
      <div
        className="text-[12vw] font-bold animate-party-text"
        style={{
          color: textColor,
          textShadow: `
            0 0 10px ${textColor},
            0 0 20px ${textColor},
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

export default PartyText;

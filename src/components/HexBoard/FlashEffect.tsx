import React from 'react';

interface FlashEffectProps {
  left: string;
  top: string;
  color: string;
}

const FlashEffect: React.FC<FlashEffectProps> = ({ left, top, color }) => {
  return (
    <div
      className="absolute w-5 h-5 rounded-full z-[5] animate-flash"
      style={{
        left,
        top,
        backgroundColor: color
      }}
    />
  );
};

export default FlashEffect;

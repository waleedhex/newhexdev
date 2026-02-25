import React, { forwardRef } from 'react';

interface HexagonProps {
  letter: string;
  backgroundColor: string;
  isWinning: boolean;
  winAnimationDelay?: number;
  isFixed: boolean;
  fixedType?: 'red' | 'green';
  clipClass?: string;
  onClick?: () => void;
  sizeUnit?: 'vw' | 'vh';
}

const Hexagon = forwardRef<HTMLDivElement, HexagonProps>(({
  letter,
  backgroundColor,
  isWinning,
  winAnimationDelay = 0,
  isFixed,
  fixedType,
  clipClass,
  onClick,
  sizeUnit = 'vw'
}, ref) => {
  const sizeBase = sizeUnit === 'vh' ? '75vh' : '90vw';
  
  const baseStyles = {
    width: `calc(${sizeBase}/7)`,
    height: `calc(1.15*(${sizeBase}/7))`,
    fontSize: `calc(${sizeBase}/28)`,
  };

  const baseClasses = `
    min-w-[40px] min-h-[46px]
    flex justify-center items-center
    font-bold
    transition-colors duration-300
    relative
    shadow-[0_2px_4px_rgba(0,0,0,0.2)]
    text-[#222]
  `;

  const getClipPath = () => {
    switch (clipClass) {
      case 'outer-fixed-odd-right':
        return 'polygon(0% 25%, 50% 0%, 50% 100%, 0% 75%, 0% 25%)';
      case 'outer-fixed-even-left':
        return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 50% 0%)';
      case 'outer-fixed-top':
        return 'polygon(0% 25%, 100% 25%, 100% 75%, 50% 100%, 0% 75%)';
      case 'outer-fixed-bottom':
        return 'polygon(0% 25%, 50% 0%, 100% 25%, 100% 75%, 0% 75%)';
      case 'outer-fixed-top-left':
        return 'polygon(50% 25%, 100% 25%, 100% 75%, 50% 100%, 50% 75%)';
      case 'outer-fixed-bottom-left':
        return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 75%, 50% 25%)';
      default:
        return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
    }
  };

  const clipPath = getClipPath();

  return (
    <div
      ref={ref}
      className={`
        ${baseClasses}
        ${isFixed ? 'cursor-default' : 'cursor-pointer'}
        ${isWinning ? 'animate-win-sequence z-[2]' : ''}
      `}
      style={{
        ...baseStyles,
        backgroundColor,
        clipPath,
        animationDelay: isWinning ? `${winAnimationDelay}ms` : undefined,
        boxShadow: isWinning ? '0 0 25px 10px gold, inset 0 0 20px 5px rgba(255, 215, 0, 0.5)' : undefined,
      }}
      onClick={!isFixed ? onClick : undefined}
    >
      {/* border halo (matches original .hexagon::before) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 scale-[1.05]"
        style={{ backgroundColor, clipPath }}
      />
      {/* Sparkle overlay for winning cells */}
      {isWinning && (
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ clipPath }}
        >
          <div 
            className="absolute w-2 h-2 bg-yellow-200 rounded-full animate-sparkle"
            style={{ top: '20%', left: '30%', animationDelay: `${winAnimationDelay + 100}ms` }}
          />
          <div 
            className="absolute w-1.5 h-1.5 bg-yellow-100 rounded-full animate-sparkle"
            style={{ top: '60%', left: '70%', animationDelay: `${winAnimationDelay + 200}ms` }}
          />
          <div 
            className="absolute w-1 h-1 bg-white rounded-full animate-sparkle"
            style={{ top: '40%', left: '50%', animationDelay: `${winAnimationDelay + 150}ms` }}
          />
        </div>
      )}
      {letter}
    </div>
  );
});

Hexagon.displayName = 'Hexagon';

export default Hexagon;

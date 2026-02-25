import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { HexGrid } from '@/components/HexBoard';

const HostPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background font-tajawal" dir="rtl">
      <HexGrid />
    </div>
  );
};

export default HostPage;

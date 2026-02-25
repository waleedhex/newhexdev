import React from 'react';
import { useSearchParams } from 'react-router-dom';
import DisplayHexGrid from '@/components/HexBoard/DisplayHexGrid';

const DisplayPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name') || '';

  return <DisplayHexGrid playerName={name ? decodeURIComponent(name) : undefined} />;
};

export default DisplayPage;

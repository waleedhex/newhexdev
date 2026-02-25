export interface ColorSet {
  red: string;
  green: string;
}

export interface HexState {
  color: string;
  clickCount: number;
}

export interface GridCell {
  el?: HTMLElement;
  color: 'red' | 'green' | 'neutral';
}

export interface Coordinate {
  r: number;
  c: number;
}

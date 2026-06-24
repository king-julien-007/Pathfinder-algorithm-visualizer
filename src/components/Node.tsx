import React from 'react';
import { TerrainType } from '../types';

interface NodeProps {
  col: number;
  row: number;
  isEnd: boolean;
  isStart: boolean;
  isWall: boolean;
  terrainType: TerrainType;
  weight: number;
}

export const Node = React.memo(({
  col,
  row,
  isEnd,
  isStart,
  isWall,
  terrainType,
  weight,
}: NodeProps) => {
  const extraClassName = isStart
    ? 'node-start'
    : isEnd
    ? 'node-finish'
    : isWall
    ? 'node-wall'
    : terrainType === 'mud'
    ? 'node-mud'
    : terrainType === 'water'
    ? 'node-water'
    : '';

  return (
    <div
      id={`node-${row}-${col}`}
      className={`node ${extraClassName}`}
      onDragStart={(e) => e.preventDefault()} // Prevent default HTML5 drag
      title={weight > 1 ? `Cost: ${weight}` : undefined}
    />
  );
});

Node.displayName = 'Node';

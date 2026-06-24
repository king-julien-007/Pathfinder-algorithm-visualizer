export type TerrainType = 'normal' | 'mud' | 'water';

export type NodeType = {
  col: number;
  row: number;
  isStart: boolean;
  isEnd: boolean;
  distance: number;
  isVisited: boolean;
  isWall: boolean;
  previousNode: NodeType | null;
  // For A*
  distanceToStart?: number;
  heuristic?: number;
  
  // Terrain
  terrainType: TerrainType;
  weight: number;
};

export type AlgorithmType = 'DIJKSTRA' | 'A_STAR' | 'BFS';
export type MazeType = 'RECURSIVE_DIVISION' | 'RANDOM';

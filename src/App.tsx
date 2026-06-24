import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, Trash2, Map, Activity, ZoomIn, ZoomOut, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { Node } from './components/Node';
import { NodeType, AlgorithmType, MazeType } from './types';
import { dijkstra, aStar, bfs, getNodesInShortestPathOrder } from './lib/pathfinding';
import { recursiveDivisionMaze } from './lib/maze';

const ROWS = 21;
const COLS = 41;
const INITIAL_START_ROW = 10;
const INITIAL_START_COL = 10;
const INITIAL_END_ROW = 10;
const INITIAL_END_COL = 30;

export type PaintMode = 'wall' | 'erase' | 'mud' | 'water' | 'move-start' | 'move-end';

export default function App() {
  const [grid, setGrid] = useState<NodeType[][]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('DIJKSTRA');
  const [startNode, setStartNode] = useState({ row: INITIAL_START_ROW, col: INITIAL_START_COL });
  const [endNode, setEndNode] = useState({ row: INITIAL_END_ROW, col: INITIAL_END_COL });
  const [zoom, setZoom] = useState(1);
  const [isStatsMinimized, setIsStatsMinimized] = useState(false);
  const [activeStatsTab, setActiveStatsTab] = useState<'stats' | 'logs'>('stats');
  const [animationSpeed, setAnimationSpeed] = useState(50); // 1-100
  const [paintMode, setPaintMode] = useState<PaintMode>('wall');

  // Drag state for the stats dashboard
  const [dashboardPos, setDashboardPos] = useState({ x: 0, y: 0 });
  const isDraggingDashboard = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingDashboard.current) return;
      const dx = e.clientX - dragStartPos.current.startX;
      const dy = e.clientY - dragStartPos.current.startY;
      setDashboardPos({
        x: dragStartPos.current.x + dx,
        y: dragStartPos.current.y + dy,
      });
    };

    const handleGlobalMouseUp = () => {
      isDraggingDashboard.current = false;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const interactionState = useRef({
    isPressed: false,
    mode: 'none' as 'drawWall' | 'eraseWall' | 'moveStart' | 'moveEnd' | 'none',
    lastHovered: null as {row: number, col: number} | null
  });

  // Initialize grid on mount
  useEffect(() => {
    const initialGrid = getInitialGrid(startNode, endNode);
    setGrid(initialGrid);
  }, []);

  const getInitialGrid = (start: { row: number, col: number }, end: { row: number, col: number }) => {
    const grid: NodeType[][] = [];
    for (let row = 0; row < ROWS; row++) {
      const currentRow: NodeType[] = [];
      for (let col = 0; col < COLS; col++) {
        currentRow.push(createNode(col, row, start, end));
      }
      grid.push(currentRow);
    }
    return grid;
  };

  const createNode = (col: number, row: number, start: { row: number, col: number }, end: { row: number, col: number }): NodeType => {
    return {
      col,
      row,
      isStart: row === start.row && col === start.col,
      isEnd: row === end.row && col === end.col,
      distance: Infinity,
      isVisited: false,
      isWall: false,
      previousNode: null,
      terrainType: 'normal',
      weight: 1,
    };
  };

  const repaintGridFromState = (currentGrid: NodeType[][]) => {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const node = currentGrid[row][col];
        const domNode = document.getElementById(`node-${row}-${col}`);
        if (!domNode) continue;
        
        // Wipe all dynamic classes, restore base terrain
        let extraClassName = '';
        if (node.isStart) extraClassName = 'node-start';
        else if (node.isEnd) extraClassName = 'node-finish';
        else if (node.isWall) extraClassName = 'node-wall';
        else if (node.terrainType === 'mud') extraClassName = 'node-mud';
        else if (node.terrainType === 'water') extraClassName = 'node-water';

        domNode.className = `node ${extraClassName}`.trim();
      }
    }
  };

  const resetNodeState = (currentGrid: NodeType[][]): NodeType[][] => {
    return currentGrid.map((row) =>
      row.map((node) => ({
        ...node,
        distance: Infinity,
        distanceToStart: undefined,
        heuristic: undefined,
        isVisited: false,
        previousNode: null,
      }))
    );
  };

  const clearStats = () => {
    const nodesVisitedEl = document.getElementById('stats-nodes-visited');
    if (nodesVisitedEl) nodesVisitedEl.innerText = '0';
    const pathLengthEl = document.getElementById('stats-path-length');
    if (pathLengthEl) pathLengthEl.innerText = '0';
    const pathCostEl = document.getElementById('stats-path-cost');
    if (pathCostEl) pathCostEl.innerText = '0';
    const executionTimeEl = document.getElementById('stats-execution-time');
    if (executionTimeEl) executionTimeEl.innerText = '0.00 ms';
    const logsEl = document.getElementById('stats-logs-container');
    if (logsEl) logsEl.innerHTML = '<div class="text-zinc-600 italic">Ready to visualize...</div>';
  };

  const clearGridKeepWalls = () => {
    if (isAnimating) return;

    clearStats();

    const newGrid = resetNodeState(grid);

    setGrid(newGrid);
    repaintGridFromState(newGrid);
  };

  const clearBoard = () => {
    if (isAnimating) return;

    clearStats();

    const logsEl = document.getElementById('stats-logs-container');
    if (logsEl) logsEl.innerHTML = '<div class="text-zinc-600 italic">Board completely reset (all terrain wiped)...</div>';

    const initialGrid = getInitialGrid({ row: INITIAL_START_ROW, col: INITIAL_START_COL }, { row: INITIAL_END_ROW, col: INITIAL_END_COL });
    setStartNode({ row: INITIAL_START_ROW, col: INITIAL_START_COL });
    setEndNode({ row: INITIAL_END_ROW, col: INITIAL_END_COL });
    
    setGrid(initialGrid);
    repaintGridFromState(initialGrid);
  };

  const getLineNodes = (r0: number, c0: number, r1: number, c1: number) => {
    const nodes = [];
    const dr = Math.abs(r1 - r0);
    const dc = Math.abs(c1 - c0);
    const sr = r0 < r1 ? 1 : -1;
    const sc = c0 < c1 ? 1 : -1;
    let err = (dr > dc ? dr : -dc) / 2;
    
    let r = r0;
    let c = c0;
    while (true) {
      nodes.push({row: r, col: c});
      if (r === r1 && c === c1) break;
      const e2 = err;
      if (e2 > -dr) { err -= dc; r += sr; }
      if (e2 < dc) { err += dr; c += sc; }
    }
    return nodes;
  };

  const applyPaintModeToNode = (node: NodeType, mode: PaintMode): NodeType => {
    // don't let terrain overwrite start/end
    if (node.isStart || node.isEnd) return node;
  
    switch (mode) {
      case 'wall':
        return {
          ...node,
          isWall: true,
          terrainType: 'normal',
          weight: 1,
        };
  
      case 'erase':
        return {
          ...node,
          isWall: false,
          terrainType: 'normal',
          weight: 1,
        };
  
      case 'mud':
        return {
          ...node,
          isWall: false,
          terrainType: 'mud',
          weight: 5,
        };
  
      case 'water':
        return {
          ...node,
          isWall: false,
          terrainType: 'water',
          weight: 10,
        };
  
      default:
        return node;
    }
  };

  const moveSpecialNode = (type: 'start' | 'end', row: number, col: number) => {
    if (isAnimating) return;
  
    const targetNode = grid[row][col];
  
    // don't place on wall
    if (targetNode.isWall) return;
  
    const newGrid = grid.map(r =>
      r.map(node => ({
        ...node,
        isStart: type === 'start' ? false : node.isStart,
        isEnd: type === 'end' ? false : node.isEnd,
      }))
    );
  
    if (type === 'start') {
      newGrid[row][col] = {
        ...newGrid[row][col],
        isStart: true,
        isWall: false,
      };
      setStartNode({ row, col });
    } else {
      newGrid[row][col] = {
        ...newGrid[row][col],
        isEnd: true,
        isWall: false,
      };
      setEndNode({ row, col });
    }
  
    const cleanedGrid = resetNodeState(newGrid);
    setGrid(cleanedGrid);
    repaintGridFromState(cleanedGrid);
  };

  const handleMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    if (isAnimating) return;
    
    // Always track that mouse is pressed for drag actions
    interactionState.current.isPressed = true;
    interactionState.current.lastHovered = { row, col };

    const clickedNode = grid[row][col];
    
    // If they click on start/end, temporarily override mode so they can drag it
    if (clickedNode.isStart) {
      interactionState.current.mode = 'moveStart';
      return;
    } else if (clickedNode.isEnd) {
      interactionState.current.mode = 'moveEnd';
      return;
    } else {
      interactionState.current.mode = 'none'; // Use global paintMode
    }
  
    // move start
    if (paintMode === 'move-start') {
      moveSpecialNode('start', row, col);
      return;
    }
  
    // move end
    if (paintMode === 'move-end') {
      moveSpecialNode('end', row, col);
      return;
    }
  
    // otherwise terrain paint mode
    const newGrid = grid.map(r => r.map(node => ({ ...node })));
    newGrid[row][col] = applyPaintModeToNode(newGrid[row][col], paintMode);
  
    setGrid(newGrid);
  };

  const handleMouseEnter = (row: number, col: number, e: React.MouseEvent) => {
    if (!interactionState.current.isPressed || isAnimating) return;
    
    const dragMode = interactionState.current.mode;
    if (dragMode === 'moveStart') {
      moveSpecialNode('start', row, col);
      return;
    } else if (dragMode === 'moveEnd') {
      moveSpecialNode('end', row, col);
      return;
    }

    if (paintMode === 'move-start' || paintMode === 'move-end') return;

    const newGrid = grid.map(r => r.map(node => ({ ...node })));
    
    const last = interactionState.current.lastHovered;
    if (last) {
       const nodesToPaint = getLineNodes(last.row, last.col, row, col);
       nodesToPaint.forEach(n => {
         newGrid[n.row][n.col] = applyPaintModeToNode(newGrid[n.row][n.col], paintMode);
       });
    } else {
       newGrid[row][col] = applyPaintModeToNode(newGrid[row][col], paintMode);
    }
    
    setGrid(newGrid);
    interactionState.current.lastHovered = { row, col };
  };

  const handleMouseUp = () => {
    interactionState.current.isPressed = false;
    interactionState.current.mode = 'none';
    interactionState.current.lastHovered = null;
  };

  const animateAlgorithm = (visitedNodesInOrder: NodeType[], nodesInShortestPathOrder: NodeType[]) => {
    setIsAnimating(true);
    const speedMultiplier = Math.max(0.1, (101 - animationSpeed) / 10);
    const nodeDelay = 1 * speedMultiplier;
    
    const logsEl = document.getElementById('stats-logs-container');
    if (logsEl) logsEl.innerHTML = `<div class="text-emerald-400">Initializing ${algorithm}...</div>`;

    let previousSearchingNode: NodeType | null = null;

    for (let i = 0; i <= visitedNodesInOrder.length; i++) {
      if (i === visitedNodesInOrder.length) {
        setTimeout(() => {
          // make sure last searching node becomes visited before shortest path animation
          if (previousSearchingNode) {
            const prevEl = document.getElementById(
              `node-${previousSearchingNode.row}-${previousSearchingNode.col}`
            );
            if (
              prevEl &&
              !prevEl.classList.contains('node-start') &&
              !prevEl.classList.contains('node-finish')
            ) {
              prevEl.classList.remove('node-searching');
              prevEl.classList.add('node-visited');
            }
          }

          if (logsEl) {
            if (nodesInShortestPathOrder.length > 0) {
              logsEl.innerHTML += `<div class="text-blue-400 mt-2">Found target! Tracing shortest path...</div>`;
              logsEl.scrollTop = logsEl.scrollHeight;
              animateShortestPath(nodesInShortestPathOrder, speedMultiplier);
            } else {
              logsEl.innerHTML += `<div class="text-rose-400 font-bold mt-2">No path found! Target is unreachable.</div>`;
              logsEl.scrollTop = logsEl.scrollHeight;
              setIsAnimating(false);
            }
          } else {
            if (nodesInShortestPathOrder.length > 0) {
              animateShortestPath(nodesInShortestPathOrder, speedMultiplier);
            } else {
              setIsAnimating(false);
            }
          }
        }, nodeDelay * i);
        return;
      }
      setTimeout(() => {
        const currentNode = visitedNodesInOrder[i];
        const currentEl = document.getElementById(
          `node-${currentNode.row}-${currentNode.col}`
        );

        // convert previous searching node to visited
        if (previousSearchingNode) {
          const prevEl = document.getElementById(
            `node-${previousSearchingNode.row}-${previousSearchingNode.col}`
          );

          if (
            prevEl &&
            !prevEl.classList.contains('node-start') &&
            !prevEl.classList.contains('node-finish')
          ) {
            prevEl.classList.remove('node-searching');
            prevEl.classList.add('node-visited');
          }
        }

        // make current node the actively searching node
        if (
          currentEl &&
          !currentEl.classList.contains('node-start') &&
          !currentEl.classList.contains('node-finish')
        ) {
          currentEl.classList.remove('node-frontier');
          currentEl.classList.add('node-searching');
          
          // Add frontier class to neighbors
          const neighbors = [
            { r: currentNode.row - 1, c: currentNode.col },
            { r: currentNode.row + 1, c: currentNode.col },
            { r: currentNode.row, c: currentNode.col - 1 },
            { r: currentNode.row, c: currentNode.col + 1 }
          ];
          neighbors.forEach(n => {
            const neighborEl = document.getElementById(`node-${n.r}-${n.c}`);
            if (neighborEl && 
                !neighborEl.classList.contains('node-visited') && 
                !neighborEl.classList.contains('node-start') && 
                !neighborEl.classList.contains('node-finish') && 
                !neighborEl.classList.contains('node-wall')) {
              neighborEl.classList.add('node-frontier');
              setTimeout(() => {
                if (neighborEl.classList.contains('node-frontier')) {
                  neighborEl.classList.remove('node-frontier');
                }
              }, 120);
            }
          });
        }

        previousSearchingNode = currentNode;
        
        // Update stats
        const nodesVisitedEl = document.getElementById('stats-nodes-visited');
        if (nodesVisitedEl) nodesVisitedEl.innerText = (i + 1).toString();

        if (i > 0 && i % 25 === 0 && logsEl) {
          logsEl.innerHTML += `<div class="text-zinc-500">Evaluating node [${currentNode.col}, ${currentNode.row}]</div>`;
          logsEl.scrollTop = logsEl.scrollHeight;
        }
      }, nodeDelay * i);
    }
  };

  const calculatePathCost = (nodesInPath: NodeType[]) => {
    if (nodesInPath.length === 0) return 0;
    
    // usually skip the first node if you don't want start cost counted
    let total = 0;
    for (let i = 1; i < nodesInPath.length; i++) {
      total += nodesInPath[i].weight;
    }
    return total;
  };

  const animateShortestPath = (nodesInShortestPathOrder: NodeType[], speedMultiplier: number) => {
    const logsEl = document.getElementById('stats-logs-container');
    const pathDelay = 5 * speedMultiplier;
    
    const totalCost = calculatePathCost(nodesInShortestPathOrder);

    for (let i = 0; i < nodesInShortestPathOrder.length; i++) {
      setTimeout(() => {
        const node = nodesInShortestPathOrder[i];
        if (!node.isStart && !node.isEnd) {
          const domNode = document.getElementById(`node-${node.row}-${node.col}`);
          if (domNode) domNode.classList.add('node-shortest-path');
        }

        // Update stats
        const pathLengthEl = document.getElementById('stats-path-length');
        if (pathLengthEl) pathLengthEl.innerText = (i + 1).toString();
        
        const pathCostEl = document.getElementById('stats-path-cost');
        if (pathCostEl && i === nodesInShortestPathOrder.length - 1) {
           pathCostEl.innerText = totalCost.toString();
        }

        if (logsEl) {
          logsEl.innerHTML += `<div class="text-yellow-400">Path step [${node.col}, ${node.row}]</div>`;
          logsEl.scrollTop = logsEl.scrollHeight;
        }
      }, pathDelay * i);
    }
    setTimeout(() => {
      if (logsEl) {
        logsEl.innerHTML += `<div class="text-emerald-400 font-bold mt-2">Visualization Complete.</div>`;
        logsEl.scrollTop = logsEl.scrollHeight;
      }
      setIsAnimating(false);
    }, pathDelay * nodesInShortestPathOrder.length);
  };

  const visualizeAlgorithm = () => {
    if (isAnimating) return;

    const preparedGrid = resetNodeState(grid);
    repaintGridFromState(preparedGrid);
    clearStats();
    
    const { startNode: foundStart, finishNode: foundFinish } = findSpecialNodes(preparedGrid);

    if (!foundStart || !foundFinish) return;

    let visitedNodesInOrder: NodeType[] = [];
    const startTime = performance.now();

    if (algorithm === 'DIJKSTRA') {
      visitedNodesInOrder = dijkstra(preparedGrid, foundStart, foundFinish);
    } else if (algorithm === 'A_STAR') {
      visitedNodesInOrder = aStar(preparedGrid, foundStart, foundFinish);
    } else if (algorithm === 'BFS') {
      visitedNodesInOrder = bfs(preparedGrid, foundStart, foundFinish);
    }
    
    const endTime = performance.now();
    const executionTimeMs = endTime - startTime;
    const executionTimeEl = document.getElementById('stats-execution-time');
    if (executionTimeEl) executionTimeEl.innerText = `${executionTimeMs.toFixed(2)} ms`;

    const nodesInShortestPathOrder = getNodesInShortestPathOrder(foundFinish);
    setGrid(preparedGrid);
    animateAlgorithm(visitedNodesInOrder, nodesInShortestPathOrder);
  };

  const generateMaze = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    clearStats();

    // Preserve existing terrain, but clear all current walls and algorithm states
    const freshGrid = resetNodeState(grid).map(row => 
      row.map(node => ({
        ...node,
        isWall: false
      }))
    );

    const logsEl = document.getElementById('stats-logs-container');
    if (logsEl) logsEl.innerHTML = '<div class="text-zinc-600 italic">Generating maze (preserving terrain)...</div>';

    setGrid(freshGrid);
    repaintGridFromState(freshGrid);

    setTimeout(() => {
      const start = freshGrid[startNode.row][startNode.col];
      const finish = freshGrid[endNode.row][endNode.col];

      const wallsToAnimate = recursiveDivisionMaze(freshGrid, start, finish);

      if (wallsToAnimate.length === 0) {
        setGrid([...freshGrid]);
        setIsAnimating(false);
        return;
      }

      const speedMultiplier = Math.max(0.1, (101 - animationSpeed) / 10);
      const wallDelay = 1 * speedMultiplier;

      for (let i = 0; i < wallsToAnimate.length; i++) {
        setTimeout(() => {
          const node = wallsToAnimate[i];
          node.isWall = true;

          const domNode = document.getElementById(`node-${node.row}-${node.col}`);
          if (domNode && !node.isStart && !node.isEnd) {
            // Re-evaluating the class string to ensure consistency, even though it's a wall
            domNode.className = 'node node-wall';
          }

          if (i === wallsToAnimate.length - 1) {
            setGrid([...freshGrid]);
            if (logsEl) {
              logsEl.innerHTML += `<div class="text-emerald-400 mt-2">Maze generation complete.</div>`;
            }
            setIsAnimating(false);
          }
        }, wallDelay * i);
      }
    }, 50);
  };

  const getRandomValidCell = (
    currentGrid: NodeType[][],
    exclude?: { row: number; col: number }
  ) => {
    const validCells: { row: number; col: number }[] = [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const node = currentGrid[row][col];

        const isExcluded =
          exclude && exclude.row === row && exclude.col === col;

        // Don't place on walls, and don't reuse the excluded cell
        if (!node.isWall && node.terrainType === 'normal' && !isExcluded) {
          validCells.push({ row, col });
        }
      }
    }

    if (validCells.length < 2 && !exclude) return null;
    if (validCells.length < 1 && exclude) return null;

    return validCells[Math.floor(Math.random() * validCells.length)];
  };

  const findSpecialNodes = (grid: NodeType[][]) => {
    let startNode: NodeType | null = null;
    let finishNode: NodeType | null = null;

    for (const row of grid) {
      for (const node of row) {
        if (node.isStart) startNode = node;
        if (node.isEnd) finishNode = node;
      }
    }

    return { startNode, finishNode };
  };

  const randomizeStartAndEnd = () => {
    if (isAnimating || grid.length === 0) return;

    clearStats();
    let newGrid = resetNodeState(grid);

    // remove old start/end flags first
    newGrid[startNode.row][startNode.col] = {
      ...newGrid[startNode.row][startNode.col],
      isStart: false,
    };

    newGrid[endNode.row][endNode.col] = {
      ...newGrid[endNode.row][endNode.col],
      isEnd: false,
    };

    // pick new start and end on NON-WALL cells
    const randomStart = getRandomValidCell(newGrid);
    if (!randomStart) return;

    const randomEnd = getRandomValidCell(newGrid, randomStart);
    if (!randomEnd) return;

    newGrid[randomStart.row][randomStart.col] = {
      ...newGrid[randomStart.row][randomStart.col],
      isStart: true,
      isWall: false,
    };

    newGrid[randomEnd.row][randomEnd.col] = {
      ...newGrid[randomEnd.row][randomEnd.col],
      isEnd: true,
      isWall: false,
    };

    setStartNode(randomStart);
    setEndNode(randomEnd);
    setGrid(newGrid);

    repaintGridFromState(newGrid);
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 font-sans text-zinc-100">
      {/* Header & Controls */}
      <header className="bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 sticky top-0 z-10 p-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg">
              <Map className="w-4 h-4 text-zinc-300" />
            </div>
            <h1 className="text-lg font-medium tracking-wide">Visualizer</h1>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3">
            <select
              disabled={isAnimating}
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50 transition-colors"
            >
              <option value="DIJKSTRA">Dijkstra's Algorithm</option>
              <option value="A_STAR">A* Search</option>
              <option value="BFS">Breadth-First Search</option>
            </select>

            <button
              onClick={visualizeAlgorithm}
              disabled={isAnimating}
              className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              Visualize
            </button>
            
            <button
              onClick={generateMaze}
              disabled={isAnimating}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-4 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Maze
            </button>

            <button
              onClick={clearGridKeepWalls}
              disabled={isAnimating}
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Path
            </button>
            
            <button
              onClick={clearBoard}
              disabled={isAnimating}
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-rose-950/30 hover:text-rose-400 hover:border-rose-900/50 text-zinc-300 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>

            <button
              onClick={randomizeStartAndEnd}
              disabled={isAnimating}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-4 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Random Start/End
            </button>

            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 ml-2">
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Speed</span>
              <input
                type="range"
                min="1"
                max="100"
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
                disabled={isAnimating}
                className="w-24 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-300 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-md p-1">
              <button
                onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono w-10 text-center text-zinc-400">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
            <div className="flex gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-md">
              <button 
                onClick={() => setPaintMode('wall')} 
                className={`px-3 py-1 text-xs font-medium rounded ${paintMode === 'wall' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Wall
              </button>
              <button 
                onClick={() => setPaintMode('erase')} 
                className={`px-3 py-1 text-xs font-medium rounded ${paintMode === 'erase' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Erase
              </button>
              <button 
                onClick={() => setPaintMode('mud')} 
                className={`px-3 py-1 text-xs font-medium rounded ${paintMode === 'mud' ? 'bg-amber-900 text-white' : 'text-amber-500 hover:text-amber-300'}`}
              >
                Mud (5)
              </button>
              <button 
                onClick={() => setPaintMode('water')} 
                className={`px-3 py-1 text-xs font-medium rounded ${paintMode === 'water' ? 'bg-blue-900 text-white' : 'text-blue-500 hover:text-blue-300'}`}
              >
                Water (10)
              </button>
              <button 
                onClick={() => setPaintMode('move-start')} 
                className={`px-3 py-1 text-xs font-medium rounded ${paintMode === 'move-start' ? 'bg-emerald-900 text-white' : 'text-emerald-500 hover:text-emerald-300'}`}
              >
                Move Start
              </button>
              <button 
                onClick={() => setPaintMode('move-end')} 
                className={`px-3 py-1 text-xs font-medium rounded ${paintMode === 'move-end' ? 'bg-rose-900 text-white' : 'text-rose-500 hover:text-rose-300'}`}
              >
                Move End
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Legend */}
      <div className="max-w-7xl mx-auto w-full pt-6 pb-2 px-4 flex flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-8 text-xs font-mono text-zinc-500 uppercase tracking-wider">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-[2px] shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ backgroundColor: '#10b981' }}></div> Start</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-[2px] shadow-[0_0_8px_rgba(239,68,68,0.5)]" style={{ backgroundColor: '#ef4444' }}></div> Target</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-[2px] shadow-[0_0_8px_rgba(255,255,255,0.4)]" style={{ backgroundColor: '#ffffff' }}></div> Wall</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: '#3b82f6' }}></div> Visited</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-[2px] shadow-[0_0_8px_rgba(254,240,138,0.8)]" style={{ backgroundColor: '#fef08a' }}></div> Path</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-[2px]" style={{ background: 'linear-gradient(135deg, #6b4f2a, #4b3419)' }}></div> Mud</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-[2px]" style={{ background: 'linear-gradient(135deg, #0f4c81, #082f49)' }}></div> Water</div>
        </div>
        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest text-center">
          Note: BFS ignores terrain cost. Dijkstra and A* respect weighted cost.
        </div>
      </div>

      {/* Grid Canvas */}
      <main className="flex-1 flex flex-col items-center p-4 overflow-auto relative">
        {/* Dashboard Overlay */}
        <div 
          className="absolute top-8 right-8 bg-zinc-950/60 backdrop-blur-xl shadow-2xl shadow-black rounded-xl border border-zinc-800/50 z-10 w-72 overflow-hidden flex flex-col pointer-events-auto"
          style={{ transform: `translate(${dashboardPos.x}px, ${dashboardPos.y}px)` }}
        >
          
          {/* Header */}
          <div 
            className="flex items-center justify-between p-3 border-b border-zinc-800/50 bg-zinc-900/50 cursor-move"
            onMouseDown={(e) => {
              isDraggingDashboard.current = true;
              dragStartPos.current = {
                x: dashboardPos.x,
                y: dashboardPos.y,
                startX: e.clientX,
                startY: e.clientY
              };
            }}
          >
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveStatsTab('stats')}
                className={`font-mono text-xs uppercase tracking-wider flex items-center gap-2 transition-colors ${activeStatsTab === 'stats' ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'}`}
              >
                <Activity className="w-3.5 h-3.5" /> Stats
              </button>
              <button 
                onClick={() => setActiveStatsTab('logs')}
                className={`font-mono text-xs uppercase tracking-wider flex items-center gap-2 transition-colors ${activeStatsTab === 'logs' ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'}`}
              >
                <Terminal className="w-3.5 h-3.5" /> Logs
              </button>
            </div>
            <button 
              onClick={() => setIsStatsMinimized(!isStatsMinimized)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            >
              {isStatsMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {/* Content */}
          <div className={`transition-all duration-300 ease-in-out ${isStatsMinimized ? 'h-0 opacity-0' : 'h-48 opacity-100'}`}>
            <div className="h-full relative">
              {/* Stats Tab */}
              <div className={`space-y-4 absolute inset-0 p-4 transition-opacity duration-300 ${activeStatsTab === 'stats' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-mono text-xs">TIME</span>
                  <span id="stats-execution-time" className="font-mono text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">0.00 ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-mono text-xs">VISITED</span>
                  <span id="stats-nodes-visited" className="font-mono text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-mono text-xs">PATH</span>
                  <span id="stats-path-length" className="font-mono text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-mono text-xs">COST</span>
                  <span id="stats-path-cost" className="font-mono text-xs text-emerald-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">0</span>
                </div>
              </div>

              {/* Logs Tab */}
              <div 
                id="stats-logs-container"
                className={`absolute inset-0 p-4 overflow-y-auto font-mono text-xs space-y-1 transition-opacity duration-300 ${activeStatsTab === 'logs' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              >
                <div className="text-zinc-600 italic">Ready to visualize...</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full mt-4 mb-16 overflow-visible">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <div 
              className="bg-zinc-950 p-2 rounded-xl flex flex-col cursor-crosshair shadow-2xl shadow-black/50 border border-zinc-800/50"
              onMouseLeave={handleMouseUp}
              onMouseUp={handleMouseUp}
              onMouseDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.classList.contains('node')) {
                  const match = target.id.match(/node-(\d+)-(\d+)/);
                  if (match) {
                    handleMouseDown(parseInt(match[1]), parseInt(match[2]), e);
                  }
                }
              }}
              onMouseMove={(e) => {
                const target = e.target as HTMLElement;
                // Performance: only process if button is pressed
                if (interactionState.current.isPressed && target.classList.contains('node')) {
                  const match = target.id.match(/node-(\d+)-(\d+)/);
                  if (match) {
                    handleMouseEnter(parseInt(match[1]), parseInt(match[2]), e);
                  }
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {grid.map((row, rowIdx) => {
                return (
                  <div key={rowIdx} className="flex" style={{ height: '22px' }}>
                    {row.map((node, nodeIdx) => {
                      const { row, col, isEnd, isStart, isWall, terrainType, weight } = node;
                      return (
                        <Node
                          key={nodeIdx}
                          col={col}
                          row={row}
                          isEnd={isEnd}
                          isStart={isStart}
                          isWall={isWall}
                          terrainType={terrainType}
                          weight={weight}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs font-mono text-zinc-600 fixed bottom-4 bg-zinc-950/80 backdrop-blur px-4 py-2 rounded-full border border-zinc-900">
          [LEFT-CLICK DRAG] TO DRAW WALLS &bull; [RIGHT-CLICK DRAG] TO ERASE WALLS &bull; [DRAG NODES] TO REPOSITION
        </p>
      </main>
    </div>
  );
}

import { NodeType } from '../types';

/**
 * Small min-heap priority queue for pathfinding.
 * Lower priority value comes out first.
 */
class MinHeap<T> {
  private heap: { item: T; priority: number }[] = [];

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  push(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop()?.item;

    const root = this.heap[0].item;
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return root;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (this.heap[parentIndex].priority <= this.heap[index].priority) {
        break;
      }

      [this.heap[parentIndex], this.heap[index]] = [
        this.heap[index],
        this.heap[parentIndex],
      ];

      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (
        left < length &&
        this.heap[left].priority < this.heap[smallest].priority
      ) {
        smallest = left;
      }

      if (
        right < length &&
        this.heap[right].priority < this.heap[smallest].priority
      ) {
        smallest = right;
      }

      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [
        this.heap[smallest],
        this.heap[index],
      ];

      index = smallest;
    }
  }
}

/**
 * Dijkstra's algorithm using a min-heap.
 * Works on an unweighted grid where each step cost = 1.
 */
export function dijkstra(
  grid: NodeType[][],
  startNode: NodeType,
  finishNode: NodeType
) {
  const visitedNodesInOrder: NodeType[] = [];
  const pq = new MinHeap<NodeType>();

  startNode.distance = 0;
  pq.push(startNode, startNode.distance);

  while (!pq.isEmpty()) {
    const currentNode = pq.pop();
    if (!currentNode) break;

    // Skip walls
    if (currentNode.isWall) continue;

    // Skip stale heap entries / already processed nodes
    if (currentNode.isVisited) continue;

    // If current best distance is Infinity, remaining nodes are unreachable
    if (currentNode.distance === Infinity) break;

    currentNode.isVisited = true;
    visitedNodesInOrder.push(currentNode);

    if (currentNode === finishNode) {
      return visitedNodesInOrder;
    }

    const neighbors = getUnvisitedNeighbors(currentNode, grid);

    for (const neighbor of neighbors) {
      if (neighbor.isWall) continue;

      const newDistance = currentNode.distance + neighbor.weight;

      // Proper relaxation step
      if (newDistance < neighbor.distance) {
        neighbor.distance = newDistance;
        neighbor.previousNode = currentNode;
        pq.push(neighbor, neighbor.distance);
      }
    }
  }

  return visitedNodesInOrder;
}

/**
 * A* algorithm using a min-heap.
 * Uses:
 * g(n) = distanceToStart
 * h(n) = Manhattan distance to finish
 * f(n) = g(n) + h(n)
 */
export function aStar(
  grid: NodeType[][],
  startNode: NodeType,
  finishNode: NodeType
) {
  const visitedNodesInOrder: NodeType[] = [];
  const pq = new MinHeap<NodeType>();

  startNode.distanceToStart = 0;
  startNode.heuristic = manhattanDistance(startNode, finishNode);
  startNode.distance = startNode.distanceToStart + startNode.heuristic; // f-score

  pq.push(startNode, startNode.distance);

  while (!pq.isEmpty()) {
    const currentNode = pq.pop();
    if (!currentNode) break;

    if (currentNode.isWall) continue;
    if (currentNode.isVisited) continue;

    currentNode.isVisited = true;
    visitedNodesInOrder.push(currentNode);

    if (currentNode === finishNode) {
      return visitedNodesInOrder;
    }

    const neighbors = getUnvisitedNeighbors(currentNode, grid);

    for (const neighbor of neighbors) {
      if (neighbor.isWall) continue;

      const tentativeGScore = (currentNode.distanceToStart ?? Infinity) + neighbor.weight;

      if (tentativeGScore < (neighbor.distanceToStart ?? Infinity)) {
        neighbor.previousNode = currentNode;
        neighbor.distanceToStart = tentativeGScore;
        neighbor.heuristic = manhattanDistance(neighbor, finishNode);
        neighbor.distance = neighbor.distanceToStart + neighbor.heuristic; // f-score

        pq.push(neighbor, neighbor.distance);
      }
    }
  }

  return visitedNodesInOrder;
}

/**
 * BFS is already fine enough for this project.
 */
export function bfs(
  grid: NodeType[][],
  startNode: NodeType,
  finishNode: NodeType
) {
  const visitedNodesInOrder: NodeType[] = [];
  const queue: NodeType[] = [startNode];
  startNode.isVisited = true;

  while (queue.length) {
    const currentNode = queue.shift();
    if (!currentNode) break;

    if (currentNode.isWall && currentNode !== startNode) continue;

    visitedNodesInOrder.push(currentNode);

    if (currentNode === finishNode) {
      return visitedNodesInOrder;
    }

    const neighbors = getUnvisitedNeighbors(currentNode, grid);

    for (const neighbor of neighbors) {
      if (!neighbor.isVisited && !neighbor.isWall) {
        neighbor.isVisited = true;
        neighbor.previousNode = currentNode;
        queue.push(neighbor);
      }
    }
  }

  return visitedNodesInOrder;
}

function getUnvisitedNeighbors(node: NodeType, grid: NodeType[][]) {
  const neighbors: NodeType[] = [];
  const { row, col } = node;

  if (row > 0) neighbors.push(grid[row - 1][col]);
  if (row < grid.length - 1) neighbors.push(grid[row + 1][col]);
  if (col > 0) neighbors.push(grid[row][col - 1]);
  if (col < grid[0].length - 1) neighbors.push(grid[row][col + 1]);

  return neighbors.filter((neighbor) => !neighbor.isVisited);
}

function manhattanDistance(nodeA: NodeType, nodeB: NodeType) {
  return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
}

/**
 * Backtracks from the finish node to reconstruct the shortest path.
 */
export function getNodesInShortestPathOrder(finishNode: NodeType) {
  const nodesInShortestPathOrder: NodeType[] = [];
  
  if (finishNode.previousNode === null && !finishNode.isStart) {
    return [];
  }

  let currentNode: NodeType | null = finishNode;

  while (currentNode !== null) {
    nodesInShortestPathOrder.unshift(currentNode);
    currentNode = currentNode.previousNode;
  }

  return nodesInShortestPathOrder;
}

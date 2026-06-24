import { NodeType } from '../types';

export function recursiveDivisionMaze(
  grid: NodeType[][],
  startNode: NodeType,
  finishNode: NodeType
): NodeType[] {
  const wallsToAnimate: NodeType[] = [];
  const rows = grid.length;
  const cols = grid[0].length;
  
  // Add outer walls first
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        const node = grid[r][c];
        if (!node.isStart && !node.isEnd) {
          wallsToAnimate.push(node);
        }
      }
    }
  }

  divide(grid, 1, rows - 2, 1, cols - 2, chooseOrientation(rows - 2, cols - 2), wallsToAnimate);
  
  return wallsToAnimate;
}

function divide(
  grid: NodeType[][],
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
  orientation: 'HORIZONTAL' | 'VERTICAL',
  wallsToAnimate: NodeType[]
) {
  if (rowEnd < rowStart || colEnd < colStart) {
    return;
  }

  let horizontal = orientation === 'HORIZONTAL';

  // Where will the wall be drawn?
  let possibleRows: number[] = [];
  let possibleCols: number[] = [];

  for (let number = rowStart; number <= rowEnd; number += 2) {
    possibleRows.push(number);
  }
  for (let number = colStart; number <= colEnd; number += 2) {
    possibleCols.push(number);
  }

  let randomRowIndex = Math.floor(Math.random() * possibleRows.length);
  let randomColIndex = Math.floor(Math.random() * possibleCols.length);

  let currentRow = possibleRows[randomRowIndex];
  let currentCol = possibleCols[randomColIndex];

  // Where will the passage be?
  let possibleRowPassages: number[] = [];
  let possibleColPassages: number[] = [];

  for (let number = rowStart - 1; number <= rowEnd + 1; number += 2) {
    possibleRowPassages.push(number);
  }
  for (let number = colStart - 1; number <= colEnd + 1; number += 2) {
    possibleColPassages.push(number);
  }

  let randomRowPassageIndex = Math.floor(Math.random() * possibleRowPassages.length);
  let randomColPassageIndex = Math.floor(Math.random() * possibleColPassages.length);

  let randomRowPassage = possibleRowPassages[randomRowPassageIndex];
  let randomColPassage = possibleColPassages[randomColPassageIndex];

  if (horizontal) {
    if (possibleRows.length === 0) return;
    for (let c = colStart - 1; c <= colEnd + 1; c++) {
      if (c !== randomColPassage && c >= 0 && c < grid[0].length && currentRow >= 0 && currentRow < grid.length) {
        const node = grid[currentRow][c];
        if (!node.isStart && !node.isEnd) {
          wallsToAnimate.push(node);
        }
      }
    }
    divide(grid, rowStart, currentRow - 2, colStart, colEnd, chooseOrientation(currentRow - 2 - rowStart + 1, colEnd - colStart + 1), wallsToAnimate);
    divide(grid, currentRow + 2, rowEnd, colStart, colEnd, chooseOrientation(rowEnd - (currentRow + 2) + 1, colEnd - colStart + 1), wallsToAnimate);
  } else {
    if (possibleCols.length === 0) return;
    for (let r = rowStart - 1; r <= rowEnd + 1; r++) {
      if (r !== randomRowPassage && r >= 0 && r < grid.length && currentCol >= 0 && currentCol < grid[0].length) {
        const node = grid[r][currentCol];
        if (!node.isStart && !node.isEnd) {
          wallsToAnimate.push(node);
        }
      }
    }
    divide(grid, rowStart, rowEnd, colStart, currentCol - 2, chooseOrientation(rowEnd - rowStart + 1, currentCol - 2 - colStart + 1), wallsToAnimate);
    divide(grid, rowStart, rowEnd, currentCol + 2, colEnd, chooseOrientation(rowEnd - rowStart + 1, colEnd - (currentCol + 2) + 1), wallsToAnimate);
  }
}

function chooseOrientation(width: number, height: number): 'HORIZONTAL' | 'VERTICAL' {
  if (width < height) {
    return 'HORIZONTAL';
  } else if (height < width) {
    return 'VERTICAL';
  } else {
    return Math.random() < 0.5 ? 'HORIZONTAL' : 'VERTICAL';
  }
}

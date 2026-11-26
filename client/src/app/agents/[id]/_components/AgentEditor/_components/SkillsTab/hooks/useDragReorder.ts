import React from "react";

/**
 * Native HTML5 drag-and-drop for a vertical list (no library). Spread
 * `rowProps(i)` on each row; a drop calls `onMove(from, to)`. `overIndex` lets
 * the row show where the item will land.
 */
export function useDragReorder(onMove: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const reset = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const rowProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragIndex(index);
      // Firefox needs data to start a drag.
      e.dataTransfer?.setData?.("text/plain", String(index));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragIndex === null) return;
      e.preventDefault(); // allow the drop
      if (overIndex !== index) setOverIndex(index);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index);
      reset();
    },
    onDragEnd: reset,
  });

  return { dragIndex, overIndex, rowProps };
}

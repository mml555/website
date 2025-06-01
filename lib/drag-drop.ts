import { useState, useRef, useEffect } from 'react'

interface DragDropOptions {
  onReorder?: (fromIndex: number, toIndex: number) => void
  onDragStart?: (index: number) => void
  onDragEnd?: (index: number) => void
}

export function useDragDrop<T>(items: T[], options: DragDropOptions = {}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null)
  const dragRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
    options.onDragStart?.(index)
  }

  const handleDragEnd = () => {
    if (draggedIndex !== null && draggedOverIndex !== null) {
      options.onReorder?.(draggedIndex, draggedOverIndex)
    }
    setDraggedIndex(null)
    setDraggedOverIndex(null)
    options.onDragEnd?.(draggedIndex!)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDraggedOverIndex(index)
  }

  const getDragProps = (index: number) => ({
    draggable: true,
    onDragStart: () => handleDragStart(index),
    onDragEnd: handleDragEnd,
    onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
    className: `cursor-move ${
      draggedIndex === index
        ? 'opacity-50'
        : draggedOverIndex === index
        ? 'border-2 border-blue-500'
        : ''
    }`,
  })

  return {
    draggedIndex,
    draggedOverIndex,
    getDragProps,
  }
}

// Example usage in a component:
/*
function ReorderableList<T>({ items, onReorder }: { items: T[], onReorder: (from: number, to: number) => void }) {
  const { getDragProps } = useDragDrop(items, { onReorder })

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          {...getDragProps(index)}
          className="p-4 bg-white rounded shadow"
        >
          {item}
        </div>
      ))}
    </div>
  )
}
*/ 
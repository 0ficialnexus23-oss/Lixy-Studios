import type { CanvasElement } from './types'

export function arrangeContainerChildren(elements: CanvasElement[], container: CanvasElement): CanvasElement[] {
  if (container.autoLayout !== 'horizontal' && container.autoLayout !== 'vertical') {
    return elements.map(item => {
      if (item.parentId !== container.id) return item
      return {
        ...item,
        ...(item.layoutBaseWidth !== undefined ? { width: item.layoutBaseWidth } : {}),
        ...(item.layoutBaseHeight !== undefined ? { height: item.layoutBaseHeight } : {}),
        layoutBaseWidth: undefined,
        layoutBaseHeight: undefined,
      }
    })
  }
  const horizontal = container.autoLayout === 'horizontal'
  const padding = Math.max(0, container.layoutPadding ?? 16)
  const gap = Math.max(0, container.layoutGap ?? 12)
  const alignment = container.layoutAlign || 'start'
  const children = elements
    .filter(item => item.parentId === container.id && !item.hidden)
    .sort((a, b) => horizontal ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x)
  let cursor = padding
  const positions = new Map<string, Partial<CanvasElement>>()
  for (const child of children) {
    const baseWidth = child.layoutBaseWidth ?? child.width
    const baseHeight = child.layoutBaseHeight ?? child.height
    let width = baseWidth
    let height = baseHeight
    let x = horizontal ? cursor : padding
    let y = horizontal ? padding : cursor
    if (horizontal) {
      if (alignment === 'stretch') height = Math.max(1, container.height - padding * 2)
      else if (alignment === 'center') y += Math.max(0, (container.height - padding * 2 - baseHeight) / 2)
      else if (alignment === 'end') y += Math.max(0, container.height - padding * 2 - baseHeight)
      cursor += width + gap
    } else {
      if (alignment === 'stretch') width = Math.max(1, container.width - padding * 2)
      else if (alignment === 'center') x += Math.max(0, (container.width - padding * 2 - baseWidth) / 2)
      else if (alignment === 'end') x += Math.max(0, container.width - padding * 2 - baseWidth)
      cursor += height + gap
    }
    positions.set(child.id, {
      x,
      y,
      width,
      height,
      layoutBaseWidth: alignment === 'stretch' ? baseWidth : undefined,
      layoutBaseHeight: alignment === 'stretch' ? baseHeight : undefined,
    })
  }
  return elements.map(item => {
    const position = positions.get(item.id)
    return position ? { ...item, ...position } : item
  })
}

export function reflowContainerById(elements: CanvasElement[], containerId: string): CanvasElement[] {
  const container = elements.find(item => item.id === containerId)
  return container && (container.type === 'frame' || container.type === 'group')
    ? arrangeContainerChildren(elements, container)
    : elements
}

export function reflowElementAndParent(elements: CanvasElement[], elementId: string): CanvasElement[] {
  const arranged = reflowContainerById(elements, elementId)
  const element = arranged.find(item => item.id === elementId)
  return element?.parentId ? reflowContainerById(arranged, element.parentId) : arranged
}

export function reflowParents(elements: CanvasElement[], parentIds: Iterable<string>): CanvasElement[] {
  let arranged = elements
  for (const parentId of parentIds) arranged = reflowContainerById(arranged, parentId)
  return arranged
}
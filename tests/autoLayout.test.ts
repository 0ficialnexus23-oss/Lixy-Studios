import assert from 'node:assert/strict'
import test from 'node:test'
import { arrangeContainerChildren, reflowContainerById } from '../src/autoLayout.ts'
import type { CanvasElement } from '../src/types.ts'

function makeElement(overrides: Partial<CanvasElement>): CanvasElement {
  return {
    id: 'element',
    type: 'text',
    name: 'Element',
    parentId: 'frame',
    x: 0,
    y: 0,
    width: 40,
    height: 20,
    text: '',
    background: 'transparent',
    color: '#20222a',
    radius: 0,
    opacity: 1,
    fontSize: 16,
    locked: false,
    hidden: false,
    ...overrides,
  }
}

test('arranges visible children in horizontal order and preserves hidden children', () => {
  const frame = makeElement({
    id: 'frame',
    type: 'frame',
    parentId: undefined,
    width: 240,
    height: 120,
    autoLayout: 'horizontal',
    layoutPadding: 10,
    layoutGap: 8,
  })
  const first = makeElement({ id: 'first', x: 80, width: 30, height: 20 })
  const second = makeElement({ id: 'second', x: 20, width: 50, height: 24 })
  const hidden = makeElement({ id: 'hidden', x: 12, y: 64, hidden: true })

  const arranged = arrangeContainerChildren([frame, first, hidden, second], frame)

  assert.deepEqual(
    arranged.filter(item => item.id !== frame.id).map(({ id, x, y }) => ({ id, x, y })),
    [
      { id: 'first', x: 68, y: 10 },
      { id: 'hidden', x: 12, y: 64 },
      { id: 'second', x: 10, y: 10 },
    ],
  )
})

test('restores a stretched child to its base size when auto layout is disabled', () => {
  const frame = makeElement({ id: 'frame', type: 'frame', parentId: undefined, autoLayout: 'none' })
  const child = makeElement({
    id: 'child',
    width: 168,
    height: 20,
    layoutBaseWidth: 40,
    layoutBaseHeight: 20,
  })

  const restored = arrangeContainerChildren([frame, child], frame)[1]

  assert.equal(restored.width, 40)
  assert.equal(restored.height, 20)
  assert.equal(restored.layoutBaseWidth, undefined)
  assert.equal(restored.layoutBaseHeight, undefined)
})

test('stretch alignment preserves base dimensions while sizing children to the container', () => {
  const frame = makeElement({
    id: 'frame',
    type: 'frame',
    parentId: undefined,
    width: 240,
    height: 120,
    autoLayout: 'vertical',
    layoutAlign: 'stretch',
    layoutPadding: 10,
    layoutGap: 8,
  })
  const child = makeElement({ id: 'child', width: 40, height: 20 })

  const stretched = arrangeContainerChildren([frame, child], frame)[1]

  assert.equal(stretched.width, 220)
  assert.equal(stretched.layoutBaseWidth, 40)
})

test('does not reflow an identifier that is not a frame or group', () => {
  const text = makeElement({ id: 'text' })
  const elements = [text]

  assert.equal(reflowContainerById(elements, 'text'), elements)
})

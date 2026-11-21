import { useEffect, useEffectEvent, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import JSZip from 'jszip'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Box, Circle,
  CaseSensitive, ChevronDown, ChevronLeft, ChevronRight, Copy, Crop,
  Eye, EyeOff, FileCode2, Frame, Folder, Globe, Grid3X3, Image, Italic, Layers3, Lock, Menu, Minus, Monitor, Search, Square,
  Magnet, MousePointer2, Plus, Redo2, RotateCw, Save, Settings2, Unlock,
  SlidersHorizontal, Smartphone, Strikethrough, Tablet, Terminal, Trash2, Type,
  Underline, Undo2, Upload, X,
  RectangleHorizontal as ButtonIcon, TextCursorInput as Input,
} from 'lucide-react'
import type { CanvasElement, ElementType, ShapeKind } from './types'
import { buildWebExport } from './webExport'
import './App.css'

const STORAGE_KEY = 'lixy-studios-project'
const DATABASE_NAME = 'lixy-studios-storage'
const DATABASE_STORE = 'projects'
const PHONE_PREVIEW_WIDTH = 402
const PHONE_PREVIEW_HEIGHT = 874

interface SavedProject {
  elements: CanvasElement[]
  pageElements?: Record<string, CanvasElement[]>
  pages: string[]
  activePage: string
  projectName: string
  savedAt: number
}

const initialElements: CanvasElement[] = [
  { id: 'hero', type: 'card', name: 'Hero card', x: 84, y: 82, width: 420, height: 260, text: 'Build without limits', background: '#20232b', color: '#ffffff', radius: 18, opacity: 1, fontSize: 34, locked: false, hidden: false },
  { id: 'cta', type: 'button', name: 'Primary button', x: 148, y: 246, width: 170, height: 48, text: 'Get started', background: '#7957ff', color: '#ffffff', radius: 10, opacity: 1, fontSize: 15, locked: false, hidden: false },
]
const EMPTY_ELEMENTS: CanvasElement[] = []

const palette: { type: ElementType; label: string; icon: typeof Box; shapeKind?: ShapeKind }[] = [
  { type: 'frame', label: 'Frame', icon: Frame },
  { type: 'text', label: 'Text', icon: Menu },
  { type: 'button', label: 'Button', icon: ButtonIcon },
  { type: 'input', label: 'Input', icon: Input },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'card', label: 'Card', icon: Box },
  { type: 'shape', label: 'Circle', icon: Circle, shapeKind: 'circle' },
  { type: 'shape', label: 'Rectangle', icon: Square, shapeKind: 'rectangle' },
  { type: 'shape', label: 'Line', icon: Minus, shapeKind: 'line' },
]
type InsertTool = { type: ElementType; shapeKind?: ShapeKind }

const defaultElementProperties: Partial<CanvasElement> = {
  fontFamily: 'Inter', fontWeight: 400, fontStyle: 'normal',
  textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, wordSpacing: 0,
  textDecoration: 'none', textTransform: 'none', rotation: 0,
  imageFit: 'contain', objectPositionX: 50, objectPositionY: 50, shadow: 0,
  shadowAngle: 90, shadowDistance: 8, shadowColor: '#000000', shadowInset: false,
}

function normalizeElements(elements: CanvasElement[] | undefined): CanvasElement[] {
  return (elements || []).map(item => ({ ...defaultElementProperties, ...item }))
}

function arrangeContainerChildren(elements: CanvasElement[], container: CanvasElement): CanvasElement[] {
  if (container.autoLayout !== 'horizontal' && container.autoLayout !== 'vertical') {
    return elements.map(item => item.parentId === container.id
      ? { ...item, layoutBaseWidth: undefined, layoutBaseHeight: undefined }
      : item)
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

function reflowContainerById(elements: CanvasElement[], containerId: string): CanvasElement[] {
  const container = elements.find(item => item.id === containerId)
  return container && (container.type === 'frame' || container.type === 'group')
    ? arrangeContainerChildren(elements, container)
    : elements
}

function reflowElementAndParent(elements: CanvasElement[], elementId: string): CanvasElement[] {
  const arranged = reflowContainerById(elements, elementId)
  const element = arranged.find(item => item.id === elementId)
  return element?.parentId ? reflowContainerById(arranged, element.parentId) : arranged
}

function reflowParents(elements: CanvasElement[], parentIds: Iterable<string>): CanvasElement[] {
  let arranged = elements
  for (const parentId of parentIds) arranged = reflowContainerById(arranged, parentId)
  return arranged
}

function getElementShadow(element: CanvasElement) {
  const blur = Math.max(0, element.shadow || 0)
  const distance = Math.max(0, element.shadowDistance ?? 8)
  if (!blur) return undefined
  const angle = (element.shadowAngle ?? 90) * Math.PI / 180
  const x = Math.round(Math.cos(angle) * distance * 100) / 100
  const y = Math.round(Math.sin(angle) * distance * 100) / 100
  const color = element.shadowColor || '#000000'
  return `${element.shadowInset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${color}`
}

function safeFontFamily(value?: string) {
  return (value || 'Inter').replace(/["'\\;{}]/g, '').trim() || 'Inter'
}

function imageMimeType(file: Blob) {
  const type = file.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type.toLowerCase()
  if (/^image\/(?:png|jpeg|webp|gif)$/.test(type)) return type
  const name = file instanceof File ? file.name.toLowerCase() : ''
  if (/\.png$/.test(name)) return 'image/png'
  if (/\.jpe?g$/.test(name)) return 'image/jpeg'
  if (/\.webp$/.test(name)) return 'image/webp'
  if (/\.gif$/.test(name)) return 'image/gif'
  return null
}

let elementIdSequence = 0

function createElementId(type: ElementType) {
  elementIdSequence += 1
  return `${type}-${Date.now()}-${elementIdSequence}`
}

function openProjectDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('El almacenamiento ampliado no está disponible en este navegador'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DATABASE_STORE)) {
        request.result.createObjectStore(DATABASE_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento del proyecto'))
  })
}

async function readIndexedProject(): Promise<SavedProject | null> {
  const database = await openProjectDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(DATABASE_STORE, 'readonly').objectStore(DATABASE_STORE).get('current')
    request.onsuccess = () => {
      database.close()
      resolve((request.result as SavedProject | undefined) || null)
    }
    request.onerror = () => {
      database.close()
      reject(request.error || new Error('No se pudo recuperar el proyecto guardado'))
    }
  })
}

async function writeIndexedProject(project: SavedProject): Promise<void> {
  const database = await openProjectDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DATABASE_STORE, 'readwrite')
    transaction.objectStore(DATABASE_STORE).put(project, 'current')
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error || new Error('No se pudo guardar el proyecto en el almacenamiento ampliado'))
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error || new Error('Se canceló el guardado del proyecto'))
    }
  })
}

function makeElement(type: ElementType, index: number): CanvasElement {
  const defaults: Record<ElementType, Partial<CanvasElement>> = {
    frame: { name: 'Frame', width: PHONE_PREVIEW_WIDTH, height: PHONE_PREVIEW_HEIGHT, text: '', background: '#ffffff', radius: 0 },
    group: { name: 'Group', width: 180, height: 80, text: '', background: 'transparent', radius: 0 },
    text: { name: 'Text', width: 220, height: 44, text: 'Your text', background: 'transparent', color: '#20222a', fontSize: 20, fontFamily: 'Inter', fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, letterSpacing: 0, wordSpacing: 0, textDecoration: 'none', textTransform: 'none', rotation: 0 },
    button: { name: 'Button', width: 150, height: 44, text: 'Button', background: '#7957ff', color: '#ffffff', radius: 8 },
    input: { name: 'Input', width: 220, height: 44, text: 'Placeholder', background: '#ffffff', color: '#737682', radius: 8 },
    image: { name: 'Image', width: 220, height: 150, text: '', background: '#dfe2ea', imageFit: 'contain', objectPositionX: 50, objectPositionY: 50, radius: 0, rotation: 0 },
    card: { name: 'Card', width: 260, height: 180, text: 'Card title', background: '#ffffff', color: '#20222a', radius: 14 },
    shape: { name: 'Shape', width: 120, height: 120, text: '', background: '#7957ff', radius: 0 },
  }
  return {
    id: createElementId(type), type, x: 160 + index * 12, y: 120 + index * 12,
    width: 180, height: 80, text: '', background: '#ffffff', color: '#20222a',
    radius: 8, opacity: 1, fontSize: 16, locked: false, hidden: false,
    ...defaultElementProperties,
    ...defaults[type],
  } as CanvasElement
}

function getLayerRows(elements: CanvasElement[]) {
  const rows: { item: CanvasElement; depth: number }[] = []
  const visited = new Set<string>()
  const visit = (parentId: string | undefined, depth: number) => {
    for (const item of [...elements].filter(element => element.parentId === parentId).reverse()) {
      if (visited.has(item.id)) continue
      visited.add(item.id)
      rows.push({ item, depth })
      if (item.type === 'frame' || item.type === 'group') visit(item.id, depth + 1)
    }
  }
  visit(undefined, 0)
  for (const item of [...elements].reverse()) {
    if (visited.has(item.id)) continue
    visited.add(item.id)
    rows.push({ item, depth: 0 })
    if (item.type === 'frame' || item.type === 'group') visit(item.id, 1)
  }
  return rows
}

interface StudioMenuItem {
  label: string
  action: () => void
  disabled?: boolean
}

function StudioMenu({
  name,
  active,
  items,
  onToggle,
  onClose,
}: {
  name: string
  active: boolean
  items: StudioMenuItem[]
  onToggle: () => void
  onClose: () => void
}) {
  return (
    <div className="menu-group">
      <button
        className={`menu-trigger ${active ? 'active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={active}
        onClick={onToggle}
      >{name}</button>
      {active && (
        <div
          className="menu-popover"
          role="menu"
          aria-label={`${name} menu`}
          onClick={event => {
            if ((event.target as HTMLElement).closest('button:not(:disabled)')) onClose()
          }}
        >
          {items.map(item => (
            <button key={item.label} role="menuitem" disabled={item.disabled} onClick={item.action}>{item.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      return Array.isArray(saved?.elements) ? saved.elements[0]?.id || null : 'hero'
    } catch { return 'hero' }
  })
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      return Array.isArray(saved?.elements) && saved.elements[0]?.id ? [saved.elements[0].id] : []
    } catch { return ['hero'] }
  })
  const [pages, setPages] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      const savedPages = Array.isArray(saved?.pages) && saved.pages.length ? saved.pages as string[] : ['Home', 'About']
      const currentPage = typeof saved?.activePage === 'string' ? saved.activePage : 'Home'
      return savedPages.includes(currentPage) ? savedPages : [...savedPages, currentPage]
    }
    catch { return ['Home', 'About'] }
  })
  const [editingPage, setEditingPage] = useState<string | null>(null)
  const [pageNameDraft, setPageNameDraft] = useState('')
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [layerNameDraft, setLayerNameDraft] = useState('')
  const [pageToDelete, setPageToDelete] = useState<string | null>(null)
  const [activePage, setActivePage] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')?.activePage || 'Home' }
    catch { return 'Home' }
  })
  const [pageElements, setPageElements] = useState<Record<string, CanvasElement[]>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      const storedPages = Array.isArray(saved?.pages) ? saved.pages as string[] : ['Home', 'About']
      const currentPage = typeof saved?.activePage === 'string' ? saved.activePage : 'Home'
      if (!storedPages.includes(currentPage)) storedPages.push(currentPage)
      if (saved?.pageElements && typeof saved.pageElements === 'object') {
        return Object.fromEntries(storedPages.map(page => [
          page,
          normalizeElements((saved.pageElements as Record<string, CanvasElement[]>)[page]),
        ]))
      }
      const legacyElements = Array.isArray(saved?.elements)
        ? normalizeElements(saved.elements as CanvasElement[])
        : initialElements
      return Object.fromEntries(storedPages.map(page => [page, page === currentPage ? legacyElements : []]))
    } catch {
      return { Home: initialElements, About: [] }
    }
  })
  const elements = pageElements[activePage] || EMPTY_ELEMENTS
  function setElements(action: CanvasElement[] | ((current: CanvasElement[]) => CanvasElement[])) {
    setPageElements(current => {
      const next = typeof action === 'function' ? action(current[activePage] || []) : action
      return { ...current, [activePage]: next }
    })
  }
  const [dockTab, setDockTab] = useState<'code' | 'console' | 'problems'>('code')
  const [inspectorTab, setInspectorTab] = useState<'design' | 'styles' | 'advanced'>('design')
  const [sidebarTab, setSidebarTab] = useState<'layers' | 'components' | 'resources'>('layers')
  const [layerQuery, setLayerQuery] = useState('')
  const [collapsedLayerIds, setCollapsedLayerIds] = useState<string[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({})
  const [activeFile, setActiveFile] = useState('index.html')
  const [runtimeStatus, setRuntimeStatus] = useState<'building' | 'running' | 'error'>('building')
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<string[]>([])
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewBuilding, setPreviewBuilding] = useState(false)
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [previewPage, setPreviewPage] = useState('Home')
  const [previewFrameId, setPreviewFrameId] = useState<string | null>(null)
  const [previewDevice, setPreviewDevice] = useState<'iphone' | 'galaxy' | 'pixel' | 'none'>('iphone')
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'phone'>('desktop')
  const [activeTool, setActiveTool] = useState<InsertTool | null>(null)
  const [zoom, setZoom] = useState(82)
  const [grid, setGrid] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [saved, setSaved] = useState(true)
  const [projectName, setProjectName] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')?.projectName || 'Untitled project' }
    catch { return 'Untitled project' }
  })
  const [storageReady, setStorageReady] = useState(false)
  const [gridSize, setGridSize] = useState(16)
  const [gridIntensity, setGridIntensity] = useState(12)
  const [leftCollapsed, setLeftCollapsed] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [leftWidth, setLeftWidth] = useState(300)
  const [rightWidth, setRightWidth] = useState(280)
  const [dockHeight, setDockHeight] = useState(250)
  const [dockVisible, setDockVisible] = useState(true)
  const [dockPreviewScale, setDockPreviewScale] = useState(0.35)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    add: true, pages: true, layers: true,
    typography: true, transform: true, layout: true, appearance: true, spacing: false, effects: false, advanced: false,
  })
  const drag = useRef<{ ids: string[]; startX: number; startY: number; positions: Map<string, { x: number; y: number }>; recorded: boolean } | null>(null)
  const resize = useRef<{ id: string; startX: number; startY: number; x: number; y: number; width: number; height: number; handle: string; recorded: boolean } | null>(null)
  const rotate = useRef<{ id: string; startRotation: number; startAngle: number; centerX: number; centerY: number; recorded: boolean } | null>(null)
  const panelResize = useRef<{ side: 'left' | 'right' | 'bottom'; startX: number; startY: number; startWidth: number } | null>(null)
  const drawing = useRef<{ id: string; startX: number; startY: number; clientX: number; clientY: number; scale: number } | null>(null)
  const marquee = useRef<{ startX: number; startY: number; clientX: number; clientY: number; scale: number; additive: boolean } | null>(null)
  const elementClipboard = useRef<{ elements: CanvasElement[]; rootIds: string[] } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const previewStageRef = useRef<HTMLDivElement>(null)
  const dockPreviewStageRef = useRef<HTMLDivElement>(null)
  const previewIframeRef = useRef<HTMLIFrameElement>(null)
  const dockPreviewIframeRef = useRef<HTMLIFrameElement>(null)
  const previewDocuments = useRef<Record<string, string>>({})
  const exportInProgress = useRef(false)
  const pageNameInput = useRef<HTMLInputElement>(null)
  const layerSearchInput = useRef<HTMLInputElement>(null)
  const cancelDeletePageButton = useRef<HTMLButtonElement>(null)
  const cancelPageRename = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const fontInput = useRef<HTMLInputElement>(null)
  const imageTargetId = useRef<string | null>(null)
  const lastClipboardImageTime = useRef(0)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [phonePreviewScale, setPhonePreviewScale] = useState(0.74)
  const [fontSizeDraft, setFontSizeDraft] = useState<{ id: string; value: string } | null>(null)
  const textEditHasHistory = useRef(false)
  const [toast, setToast] = useState<string | null>(null)
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [snapGuides, setSnapGuides] = useState<{ axis: 'x' | 'y'; position: number }[]>([])
  const undoStack = useRef<{ page: string; elements: CanvasElement[] }[]>([])
  const redoStack = useRef<{ page: string; elements: CanvasElement[] }[]>([])
  const draggedLayerId = useRef<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const selected = elements.find(item => item.id === selectedId) || null
  const selectedElements = elements.filter(item => selectedIds.includes(item.id))
  const collapsedLayers = new Set(collapsedLayerIds)
  const visibleLayerRows = getLayerRows(elements)
    .filter(({ item }) => {
      if (!`${item.name} ${item.type} ${item.text}`.toLocaleLowerCase().includes(layerQuery.trim().toLocaleLowerCase())) return false
      let parentId = item.parentId
      while (parentId) {
        if (collapsedLayers.has(parentId)) return false
        parentId = elements.find(candidate => candidate.id === parentId)?.parentId
      }
      return true
    })
  function selectOnly(id: string | null) {
    setSelectedId(id)
    setSelectedIds(id ? [id] : [])
  }
  const previewFrame = (pageElements[previewPage] || []).find(item => item.id === previewFrameId && item.type === 'frame') || null
  const persistCurrentProject = useEffectEvent(() => { void persistProject() })
  const processPastedImage = useEffectEvent((file: Blob) => { void processImageFile(file) })
  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const modifier = event.ctrlKey || event.metaKey
    const target = event.target as HTMLElement
    const isEditing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    if (modifier && event.key.toLowerCase() === 's') {
      event.preventDefault()
      saveProject()
      return
    }
    if (modifier && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      setSidebarTab('layers')
      setLeftCollapsed(false)
      layerSearchInput.current?.focus()
      return
    }
    if (event.key === 'Escape') {
      setPreview(false)
      setEditingTextId(null)
      setPageToDelete(null)
      setActiveTool(null)
      return
    }
    if (modifier && event.key.toLowerCase() === 'z') {
      if (isEditing) return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    if (modifier && event.key.toLowerCase() === 'y') {
      if (isEditing) return
      event.preventDefault()
      redo()
      return
    }
    if (modifier && event.key.toLowerCase() === 'd' && selectedId) {
      if (isEditing) return
      event.preventDefault()
      duplicateSelected()
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length) {
      if (!isEditing) {
        event.preventDefault()
        deleteSelected()
      }
      return
    }
    if (modifier && event.key.toLowerCase() === 'c' && selectedIds.length && !isEditing) {
      event.preventDefault()
      copySelected()
      return
    }
    if (modifier && event.key.toLowerCase() === 'v') {
      if (isEditing) return
      event.preventDefault()
      const previousImagePaste = lastClipboardImageTime.current
      const clipboardApi = navigator.clipboard as unknown as { read?: unknown }
      window.setTimeout(() => {
        if (lastClipboardImageTime.current !== previousImagePaste) return
        if (elementClipboard.current) pasteCopiedElements()
        else if (typeof clipboardApi?.read === 'function') void readClipboardImages()
      }, 120)
      return
    }
    if (modifier && event.key.toLowerCase() === 'g' && !isEditing) {
      event.preventDefault()
      if (event.shiftKey) ungroupSelected()
      else groupSelected()
      return
    }
    if (!modifier && !isEditing) {
      const key = event.key.toLowerCase()
      if (key === 'v') { setActiveTool(null); return }
      const tool = palette.find(item =>
        (key === 'f' && item.type === 'frame') ||
        (key === 't' && item.type === 'text') ||
        (key === 'b' && item.type === 'button') ||
        (key === 'i' && item.type === 'image') ||
        (key === 'o' && item.shapeKind === 'circle') ||
        (key === 'r' && item.shapeKind === 'rectangle') ||
        (key === 'l' && item.shapeKind === 'line')
      )
      if (tool) {
        event.preventDefault()
        setActiveTool({ type: tool.type, shapeKind: tool.shapeKind })
      }
    }
  })

  useEffect(() => {
    let active = true
    void readIndexedProject().then(project => {
      if (!active) return
      const localProject = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (project && project.savedAt > (localProject?.savedAt || 0)) {
        const restoredPages = project.pages.length ? project.pages : ['Home']
        const restoredPageElements = project.pageElements
          ? Object.fromEntries(restoredPages.map(page => [page, normalizeElements(project.pageElements?.[page])]))
          : Object.fromEntries(restoredPages.map(page => [
            page,
            page === project.activePage ? normalizeElements(project.elements) : [],
          ]))
        setPageElements(restoredPageElements)
        setPages(restoredPages)
        setActivePage(project.activePage)
        setProjectName(project.projectName)
        selectOnly((restoredPageElements[project.activePage] || [])[0]?.id || null)
      }
      setStorageReady(true)
    }).catch(error => {
      if (!active) return
      setStorageReady(true)
      showToast(`No se pudo abrir el almacenamiento ampliado: ${error instanceof Error ? error.message : 'error desconocido'}. Se usará el almacenamiento local.`)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    const timer = window.setTimeout(() => {
      persistCurrentProject()
    }, 500)
    return () => window.clearTimeout(timer)
  }, [pageElements, pages, activePage, projectName, storageReady])

  useEffect(() => {
    if (!storageReady) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setRuntimeStatus('building')
      void (async () => {
        try {
          const result = await buildWebExport({ projectName, pages, activePage, pageElements })
          const archive = await JSZip.loadAsync(result.archive)
          const files: Record<string, string> = {}
          for (const [path, file] of Object.entries(archive.files)) {
            if (!file.dir && /\.(?:html|css|js)$/i.test(path)) files[path] = await file.async('string')
          }
          if (cancelled) return
          previewDocuments.current = result.previewDocuments
          setGeneratedFiles(files)
          setActiveFile(current => files[current] ? current : Object.keys(files)[0] || 'index.html')
          setPreviewPage(activePage)
          setPreviewHtml(result.previewDocuments[activePage] || '')
          setPreviewWarnings(result.warnings)
          setRuntimeDiagnostics(result.warnings)
        } catch (error) {
          if (cancelled) return
          const message = error instanceof Error ? error.message : 'No se pudo compilar el proyecto.'
          setRuntimeDiagnostics([message])
          setRuntimeStatus('error')
        }
      })()
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [storageReady, projectName, pages, activePage, pageElements])

  useEffect(() => {
    const stage = previewStageRef.current
    if (!preview || previewDevice === 'none' || !stage) return
    const measure = () => {
      const availableWidth = Math.max(0, stage.clientWidth - 48)
      const availableHeight = Math.max(0, stage.clientHeight - 48)
      setPhonePreviewScale(Math.min(1, availableWidth / 430, availableHeight / 934))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    measure()
    return () => observer.disconnect()
  }, [preview, previewDevice])

  useEffect(() => {
    const stage = dockPreviewStageRef.current
    if (!dockVisible || !stage) return
    const measure = () => {
      const designWidth = device === 'phone' ? PHONE_PREVIEW_WIDTH : device === 'tablet' ? 768 : 900
      const designHeight = device === 'phone' ? PHONE_PREVIEW_HEIGHT : device === 'tablet' ? 1024 : 600
      setDockPreviewScale(Math.min(1, Math.max(0, stage.clientWidth - 24) / designWidth, Math.max(0, stage.clientHeight - 24) / designHeight))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    measure()
    return () => observer.disconnect()
  }, [dockVisible, device, dockHeight])

  useEffect(() => {
    if (pageToDelete) cancelDeletePageButton.current?.focus()
  }, [pageToDelete])

  useEffect(() => {
    for (const element of elements) {
      if (!element.fontSource || !element.fontFamily) continue
      const font = new FontFace(element.fontFamily, `url(${element.fontSource})`)
      void font.load().then(loadedFont => document.fonts.add(loadedFont)).catch(() => {
        showToast(`No se pudo cargar la fuente ${element.fontFamily}`)
      })
    }
  }, [elements])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || [])
      const item = Array.from(event.clipboardData?.items || []).find(entry =>
        entry.kind === 'file' && /^image\/(?:png|jpeg|webp|gif)$/.test(entry.type)
      )
      const file = item?.getAsFile() || files.find(entry => imageMimeType(entry))
      if (!file) return
      event.preventDefault()
      lastClipboardImageTime.current = Date.now()
      processPastedImage(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 5000)
  }

  function startPageRename(page: string) {
    cancelPageRename.current = false
    setPageNameDraft(page)
    setEditingPage(page)
    window.setTimeout(() => pageNameInput.current?.select(), 0)
  }

  function commitPageRename(page: string) {
    const name = pageNameDraft.trim()
    setEditingPage(null)
    if (!name) {
      showToast('El nombre de la página no puede estar vacío.')
      return
    }
    if (pages.some(existing => existing !== page && existing.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      showToast('Ya existe una página con ese nombre.')
      return
    }
    if (name === page) return
    setPages(items => items.map(existing => existing === page ? name : existing))
    setPageElements(current => Object.fromEntries(
      Object.entries(current).map(([pageName, pageItems]) => [
        pageName === page ? name : pageName,
        pageItems.map(item => item.linkToPage === page ? { ...item, linkToPage: name } : item),
      ]),
    ))
    setActivePage((current: string) => current === page ? name : current)
    undoStack.current = []
    redoStack.current = []
    setCanUndo(false)
    setCanRedo(false)
    setSaved(false)
  }

  function commitLayerRename(id: string) {
    const name = layerNameDraft.trim()
    setEditingLayerId(null)
    if (!name) {
      showToast('El nombre de la capa no puede estar vacío.')
      return
    }
    if (elements.some(item => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      showToast('Ya existe una capa con ese nombre en esta página.')
      return
    }
    const item = elements.find(candidate => candidate.id === id)
    if (item && item.name !== name) updateLayer(id, { name })
  }

  function addPage() {
    let number = pages.length + 1
    let name = `Page ${number}`
    while (pages.some(page => page.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      number += 1
      name = `Page ${number}`
    }
    setSaved(false)
    setPages(items => [...items, name])
    setPageElements(current => ({ ...current, [name]: [] }))
    setActivePage(name)
    selectOnly(null)
    undoStack.current = []
    redoStack.current = []
    setCanUndo(false)
    setCanRedo(false)
  }

  function selectPage(page: string) {
    if (page === activePage) return
    setSaved(false)
    setActivePage(page)
    selectOnly(null)
    setEditingTextId(null)
    undoStack.current = []
    redoStack.current = []
    setCanUndo(false)
    setCanRedo(false)
  }

  function deletePage(page: string) {
    if (pages.length <= 1) {
      setPageToDelete(null)
      showToast('El proyecto debe conservar al menos una página.')
      return
    }
    const remaining = pages.filter(item => item !== page)
    setPages(remaining)
    setPageElements(current => Object.fromEntries(
      Object.entries(current)
        .filter(([pageName]) => pageName !== page)
        .map(([pageName, pageItems]) => [
          pageName,
          pageItems.map(item => item.linkToPage === page ? { ...item, linkToPage: undefined } : item),
        ]),
    ))
    if (activePage === page) {
      setActivePage(remaining[0])
      selectOnly(null)
    }
    undoStack.current = []
    redoStack.current = []
    setCanUndo(false)
    setCanRedo(false)
    setPageToDelete(null)
    setSaved(false)
    showToast(`Página «${page}» eliminada.`)
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer la imagen'))
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
      reader.readAsDataURL(blob)
    })
  }

  async function getImageSize(src: string) {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('El formato de imagen no es válido'))
      image.src = src
    })
  }

  function recordUndo() {
    undoStack.current.push({ page: activePage, elements })
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
    setCanUndo(true)
    setCanRedo(false)
    setSaved(false)
  }

  async function persistProject(showSuccess = false) {
    setSaved(false)
    const project: SavedProject = { elements, pageElements, pages, activePage, projectName, savedAt: Date.now() }
    let localSaved = false
    let indexedSaved = false
    const errors: string[] = []
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
      localSaved = true
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Almacenamiento local lleno')
    }
    try {
      await writeIndexedProject(project)
      indexedSaved = true
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Falló el almacenamiento ampliado')
    }
    if (localSaved || indexedSaved) {
      setSaved(true)
      if (showSuccess) showToast(localSaved ? 'Proyecto guardado' : 'Proyecto guardado en almacenamiento ampliado')
      else if (errors.length) showToast(`Guardado parcial: ${errors.join('. ')}`)
    } else {
      setSaved(false)
      showToast(`No se pudo guardar el proyecto: ${errors.join('. ')}`)
    }
  }

  function saveProject() {
    if (!storageReady) return
    void persistProject(true)
  }

  function openImagePicker(targetId: string | null = selectedId) {
    imageTargetId.current = targetId
    fileInput.current?.click()
  }

  async function processImageFile(file: Blob, point?: { x: number; y: number }, targetIdOverride?: string | null) {
    const mimeType = imageMimeType(file)
    if (!mimeType) {
      showToast('Formato no compatible. Usa PNG, JPEG, WebP o GIF.')
      return
    }
    try {
      const src = await blobToDataUrl(file)
      const size = await getImageSize(src)

      const targetId = targetIdOverride !== undefined ? targetIdOverride : imageTargetId.current ?? selectedId
      imageTargetId.current = null
      const selectedElement = elements.find(item => item.id === targetId)
      const frame = selectedElement?.type === 'frame'
        ? selectedElement
        : selectedElement?.parentId
          ? elements.find(item => item.id === selectedElement.parentId)
          : null

      recordUndo()
      if (selectedElement?.type === 'image' ||
        selectedElement?.type === 'shape' && (selectedElement.shapeKind === 'circle' || selectedElement.shapeKind === 'rectangle')) {
        setElements(items => items.map(item => item.id === selectedElement.id
          ? {
            ...item,
            src,
            mimeType,
            ...(item.type === 'shape' ? { imageFit: 'cover' as const } : {}),
          }
          : item))
        showToast(selectedElement.type === 'shape' ? 'Imagen aplicada a la forma' : 'Imagen reemplazada')
      } else {
        const maxWidth = Math.max(24, (frame ? frame.width : canvasWidth()) - 24)
        const maxHeight = Math.max(24, (frame ? frame.height : 600) - 24)
        const scale = Math.min(1, maxWidth / size.width, maxHeight / size.height)
        const width = size.width * scale
        const height = size.height * scale
        const origin = frame ? framePosition(frame) : { x: 0, y: 0 }
        const x = frame
          ? point ? Math.max(0, point.x - origin.x) : Math.max(12, (frame.width - width) / 2)
          : point ? point.x : 180
        const y = frame
          ? point ? Math.max(0, point.y - origin.y) : Math.max(12, (frame.height - height) / 2)
          : point ? point.y : 140
        const newElement: CanvasElement = {
          id: createElementId('image'),
          type: 'image',
          name: file instanceof File && file.name ? file.name.replace(/\.[^.]+$/, '') : 'Image',
          parentId: frame?.id,
          src,
          mimeType,
          x, y, width, height,
          text: '',
          background: 'transparent',
          color: '#20222a',
          radius: 0,
          opacity: 1,
          fontSize: 16,
          imageFit: 'contain',
          objectPositionX: 50,
          objectPositionY: 50,
          locked: false,
          hidden: false,
        }
        setElements(items => {
          const next = [...items, newElement]
          return frame ? arrangeContainerChildren(next, frame) : next
        })
        selectOnly(newElement.id)
      }
      if (selectedElement?.type !== 'image' &&
        !(selectedElement?.type === 'shape' && (selectedElement.shapeKind === 'circle' || selectedElement.shapeKind === 'rectangle'))) {
        showToast('Imagen importada')
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo procesar la imagen')
    }
  }

  async function readClipboardImages() {
    const clipboardApi = navigator.clipboard as unknown as {
      read?: () => Promise<Array<{ types: string[]; getType(type: string): Promise<Blob> }>>
    }
    if (typeof clipboardApi?.read !== 'function') {
      showToast('Tu navegador no permite leer el portapapeles. Usa Importar imagen.')
      return
    }
    try {
      const clipboardItems = await clipboardApi.read()
      for (const clipboardItem of clipboardItems) {
        const type = clipboardItem.types.find(value => /^image\/(?:png|jpeg|webp|gif)$/.test(value))
        if (!type) continue
        const blob = await clipboardItem.getType(type)
        await processImageFile(blob)
        return
      }
      showToast('El portapapeles no contiene una imagen compatible.')
    } catch {
      showToast('Acceso al portapapeles denegado. Usa CTRL + V o Importar imagen.')
    }
  }

  function updateSelected(patch: Partial<CanvasElement>) {
    if (!selectedId) return
    recordUndo()
    setElements(items => {
      const updated = items.map(item => item.id === selectedId ? { ...item, ...patch } : item)
      return reflowElementAndParent(updated, selectedId)
    })
  }

  function updateLayer(id: string, patch: Partial<CanvasElement>) {
    recordUndo()
    setElements(items => items.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function reorderLayer(targetId: string) {
    const sourceId = draggedLayerId.current
    draggedLayerId.current = null
    if (!sourceId || sourceId === targetId) return
    const sourceIndex = elements.findIndex(item => item.id === sourceId)
    const targetIndex = elements.findIndex(item => item.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0 || elements[sourceIndex].parentId !== elements[targetIndex].parentId) {
      showToast('Las capas solo se pueden reordenar dentro del mismo contenedor.')
      return
    }
    recordUndo()
    setElements(items => {
      const reordered = [...items]
      const [moved] = reordered.splice(sourceIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      return reordered
    })
  }

  function updateAutoLayout(patch: Partial<Pick<CanvasElement, 'autoLayout' | 'layoutAlign' | 'layoutGap' | 'layoutPadding'>>) {
    if (!selected || (selected.type !== 'frame' && selected.type !== 'group')) return
    recordUndo()
    setElements(items => {
      const updated = items.map(item => item.id === selected.id ? { ...item, ...patch } : item)
      return reflowElementAndParent(updated, selected.id)
    })
  }

  function setFlowStartingPoint() {
    if (!selected || selected.type !== 'frame') return
    recordUndo()
    setElements(items => items.map(item => item.type === 'frame'
      ? { ...item, flowStartingPoint: item.id === selected.id ? !selected.flowStartingPoint : false }
      : item))
  }

  function addElement(type: ElementType, shapeKind?: ShapeKind) {
    setActiveTool({ type, shapeKind })
    selectOnly(null)
  }

  function frameOrigin(element: CanvasElement) {
    let x = 0
    let y = 0
    let parentId = element.parentId
    const visited = new Set<string>()
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      const parent = elements.find(item => item.id === parentId && (item.type === 'frame' || item.type === 'group'))
      if (!parent) break
      x += parent.x
      y += parent.y
      parentId = parent.parentId
    }
    return { x, y }
  }

  function framePosition(frame: CanvasElement) {
    const origin = frameOrigin(frame)
    return { x: frame.x + origin.x, y: frame.y + origin.y }
  }

  function frameDepth(frame: CanvasElement) {
    let depth = 0
    let parentId = frame.parentId
    const visited = new Set<string>()
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      const parent = elements.find(item => item.id === parentId && (item.type === 'frame' || item.type === 'group'))
      if (!parent) break
      depth += 1
      parentId = parent.parentId
    }
    return depth
  }

  function findFrameAtPoint(point: { x: number; y: number }) {
    return elements
      .filter(item => (item.type === 'frame' || item.type === 'group') && !item.hidden)
      .sort((a, b) => frameDepth(b) - frameDepth(a) || elements.indexOf(b) - elements.indexOf(a))
      .find(frame => {
        const position = framePosition(frame)
        const x = position.x
        const y = position.y
        return point.x >= x && point.y >= y && point.x <= x + frame.width && point.y <= y + frame.height
      }) || null
  }

  function beginCreateElement(event: React.PointerEvent, tool: InsertTool, point: { x: number; y: number }, parentFrame: CanvasElement | null) {
    event.preventDefault()
    event.stopPropagation()
    const base = makeElement(tool.type, elements.length)
    const origin = parentFrame ? framePosition(parentFrame) : { x: 0, y: 0 }
    const localX = point.x - origin.x
    const localY = point.y - origin.y
    const element: CanvasElement = {
      ...base,
      x: localX,
      y: localY,
      ...(parentFrame ? { parentId: parentFrame.id } : {}),
      ...(tool.shapeKind ? {
        shapeKind: tool.shapeKind,
        name: tool.shapeKind === 'circle' ? 'Circle' : tool.shapeKind === 'rectangle' ? 'Rectangle' : 'Line',
        width: tool.shapeKind === 'circle' ? 120 : tool.shapeKind === 'rectangle' ? 160 : 180,
        height: tool.shapeKind === 'circle' ? 120 : tool.shapeKind === 'rectangle' ? 120 : 4,
        radius: tool.shapeKind === 'circle' ? 999 : tool.shapeKind === 'rectangle' ? 8 : 2,
        background: '#7957ff',
      } : {}),
    }
    recordUndo()
    setElements(items => [...items, element])
    selectOnly(element.id)
    drawing.current = {
      id: element.id,
      startX: localX,
      startY: localY,
      clientX: event.clientX,
      clientY: event.clientY,
      scale: zoom / 100,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function canvasPoint(clientX: number, clientY: number) {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const scale = zoom / 100
    return bounds
      ? { x: Math.max(0, (clientX - bounds.left) / scale), y: Math.max(0, (clientY - bounds.top) / scale) }
      : { x: 0, y: 0 }
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!activeTool) {
      const point = canvasPoint(event.clientX, event.clientY)
      marquee.current = {
        startX: point.x,
        startY: point.y,
        clientX: event.clientX,
        clientY: event.clientY,
        scale: zoom / 100,
        additive: event.shiftKey,
      }
      setMarqueeBox(null)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    const point = canvasPoint(event.clientX, event.clientY)
    beginCreateElement(event, activeTool, point, findFrameAtPoint(point))
  }

  function handleElementPointerDown(event: React.PointerEvent<HTMLDivElement>, element: CanvasElement) {
    if (!activeTool) {
      beginDrag(event, element)
      return
    }
    const point = canvasPoint(event.clientX, event.clientY)
    const parentFrame = element.type === 'frame'
      ? element
      : element.parentId ? elements.find(item => item.id === element.parentId && (item.type === 'frame' || item.type === 'group')) || null
        : findFrameAtPoint(point)
    beginCreateElement(event, activeTool, point, parentFrame)
  }

  function alignSelection(mode: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'distributeX' | 'distributeY') {
    const movable = selectedElements.filter(item => !item.locked && (() => {
      let parentId = item.parentId
      while (parentId) {
        if (selectedIds.includes(parentId)) return false
        parentId = elements.find(candidate => candidate.id === parentId)?.parentId
      }
      return true
    })())
    if (movable.length < (mode.startsWith('distribute') ? 3 : 2)) return
    const bounds = movable.map(item => {
      const parent = item.parentId ? elements.find(candidate => candidate.id === item.parentId && (candidate.type === 'frame' || candidate.type === 'group')) : null
      const origin = parent ? framePosition(parent) : { x: 0, y: 0 }
      return {
        item,
        x: item.x + origin.x,
        y: item.y + origin.y,
        right: item.x + origin.x + item.width,
        bottom: item.y + origin.y + item.height,
      }
    })
    const left = Math.min(...bounds.map(item => item.x))
    const right = Math.max(...bounds.map(item => item.right))
    const top = Math.min(...bounds.map(item => item.y))
    const bottom = Math.max(...bounds.map(item => item.bottom))
    const updates = new Map<string, { x: number; y: number }>()
    if (mode === 'distributeX' || mode === 'distributeY') {
      const horizontal = mode === 'distributeX'
      const ordered = [...bounds].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y)
      const totalLength = ordered.reduce((total, item) => total + (horizontal ? item.item.width : item.item.height), 0)
      const start = horizontal ? ordered[0].x : ordered[0].y
      const end = horizontal ? ordered[ordered.length - 1].right : ordered[ordered.length - 1].bottom
      const gap = (end - start - totalLength) / (ordered.length - 1)
      let cursor = start
      for (const entry of ordered) {
        const origin = entry.item.parentId
          ? framePosition(elements.find(item => item.id === entry.item.parentId && (item.type === 'frame' || item.type === 'group'))!)
          : { x: 0, y: 0 }
        updates.set(entry.item.id, {
          x: horizontal ? cursor - origin.x : entry.item.x,
          y: horizontal ? entry.item.y : cursor - origin.y,
        })
        cursor += (horizontal ? entry.item.width : entry.item.height) + gap
      }
    } else {
      for (const entry of bounds) {
        const origin = entry.item.parentId
          ? framePosition(elements.find(item => item.id === entry.item.parentId && (item.type === 'frame' || item.type === 'group'))!)
          : { x: 0, y: 0 }
        const x = mode === 'left' ? left
          : mode === 'right' ? right - entry.item.width
            : mode === 'centerX' ? (left + right) / 2 - entry.item.width / 2
              : entry.x
        const y = mode === 'top' ? top
          : mode === 'bottom' ? bottom - entry.item.height
            : mode === 'centerY' ? (top + bottom) / 2 - entry.item.height / 2
              : entry.y
        updates.set(entry.item.id, { x: x - origin.x, y: y - origin.y })
      }
    }
    recordUndo()
    setElements(items => items.map(item => {
      const position = updates.get(item.id)
      return position ? { ...item, ...position } : item
    }))
  }

  function groupSelected() {
    const items = selectedElements
    if (items.length < 2) {
      showToast('Selecciona al menos dos capas para agrupar.')
      return
    }
    if (items.some(item => item.locked)) {
      showToast('Desbloquea las capas seleccionadas antes de agruparlas.')
      return
    }
    const parentId = items[0].parentId
    if (items.some(item => item.parentId !== parentId)) {
      showToast('Para agrupar, selecciona capas del mismo Frame o contenedor.')
      return
    }
    const roots = items.filter(item => {
      let ancestor = item.parentId
      while (ancestor) {
        if (selectedIds.includes(ancestor)) return false
        ancestor = elements.find(candidate => candidate.id === ancestor)?.parentId
      }
      return true
    })
    if (roots.length < 2) {
      showToast('Selecciona capas hermanas para crear un grupo.')
      return
    }
    const x = Math.min(...roots.map(item => item.x))
    const y = Math.min(...roots.map(item => item.y))
    const right = Math.max(...roots.map(item => item.x + item.width))
    const bottom = Math.max(...roots.map(item => item.y + item.height))
    const group: CanvasElement = {
      ...makeElement('group', elements.length),
      name: 'Group',
      parentId,
      x,
      y,
      width: right - x,
      height: bottom - y,
      background: 'transparent',
      radius: 0,
    }
    recordUndo()
    setElements(current => {
      const grouped = [
        ...current.map(item => roots.some(root => root.id === item.id)
          ? { ...item, parentId: group.id, x: item.x - x, y: item.y - y }
          : item),
        group,
      ]
      return parentId ? reflowContainerById(grouped, parentId) : grouped
    })
    selectOnly(group.id)
  }

  function ungroupSelected() {
    if (selected?.type !== 'group') {
      showToast('Selecciona un grupo para desagruparlo.')
      return
    }
    const group = selected
    const children = elements.filter(item => item.parentId === group.id)
    if (!children.length) {
      showToast('Este grupo no contiene capas.')
      return
    }
    recordUndo()
    setElements(current => {
      const ungrouped = current
        .filter(item => item.id !== group.id)
        .map(item => item.parentId === group.id
          ? { ...item, parentId: group.parentId, x: item.x + group.x, y: item.y + group.y }
          : item)
      return group.parentId ? reflowContainerById(ungrouped, group.parentId) : ungrouped
    })
    setSelectedId(children[0].id)
    setSelectedIds(children.map(item => item.id))
  }

  function deleteSelected() {
    if (!selectedIds.length) return
    const deletedIds = new Set(selectedIds)
    let foundChild = true
    while (foundChild) {
      foundChild = false
      for (const item of elements) {
        if (item.parentId && deletedIds.has(item.parentId) && !deletedIds.has(item.id)) {
          deletedIds.add(item.id)
          foundChild = true
        }
      }
    }
    const affectedParents = new Set(elements
      .filter(item => deletedIds.has(item.id))
      .map(item => item.parentId)
      .filter((parentId): parentId is string => !!parentId))
    recordUndo()
    setElements(items => {
      const remaining = items
        .filter(item => !deletedIds.has(item.id))
        .map(item => item.linkToElementId && deletedIds.has(item.linkToElementId)
          ? { ...item, linkToElementId: undefined }
          : item)
      return reflowParents(remaining, affectedParents)
    })
    selectOnly(null)
  }

  function duplicateSelected() {
    if (!selected) return
    copySelected()
    pasteCopiedElements()
  }

  function copySelected() {
    if (!selectedElements.length) return
    const rootIds = selectedElements
      .filter(item => {
        let parentId = item.parentId
        while (parentId) {
          if (selectedIds.includes(parentId)) return false
          parentId = elements.find(candidate => candidate.id === parentId)?.parentId
        }
        return true
      })
      .map(item => item.id)
    const copied = elements.filter(item => rootIds.includes(item.id))
    const addChildren = (parentId: string) => {
      for (const child of elements.filter(item => item.parentId === parentId)) {
        copied.push(child)
        if (child.type === 'frame' || child.type === 'group') addChildren(child.id)
      }
    }
    for (const rootId of rootIds) {
      const root = elements.find(item => item.id === rootId)
      if (root?.type === 'frame' || root?.type === 'group') addChildren(rootId)
    }
    elementClipboard.current = { elements: [...new Map(copied.map(item => [item.id, item])).values()], rootIds }
  }

  function pasteCopiedElements() {
    const clipboard = elementClipboard.current
    if (!clipboard) return
    const roots = clipboard.rootIds.map(id => clipboard.elements.find(item => item.id === id)).filter((item): item is CanvasElement => !!item)
    if (!roots.length) return
    const destinationFrame = selected?.type === 'frame' && !clipboard.rootIds.includes(selected.id)
      ? selected
      : selected?.type === 'frame'
        ? selected.parentId ? elements.find(item => item.id === selected.parentId && (item.type === 'frame' || item.type === 'group')) || null : null
        : selected?.parentId
          ? elements.find(item => item.id === selected.parentId && (item.type === 'frame' || item.type === 'group')) || null
          : null
    const idMap = new Map(clipboard.elements.map(item => [item.id, createElementId(item.type)]))
    const rootOffsets = new Map(roots.map((root, index) => [
      root.id,
      destinationFrame && root.parentId !== destinationFrame.id
        ? { x: Math.max(0, (destinationFrame.width - root.width) / 2) + index * 16, y: Math.max(0, (destinationFrame.height - root.height) / 2) + index * 16 }
        : { x: root.x + (root.type === 'frame' ? root.width + 32 : 16) + index * 16, y: root.y + index * 16 },
    ]))
    const copies = clipboard.elements.map(item => ({
      ...item,
      id: idMap.get(item.id)!,
      name: clipboard.rootIds.includes(item.id) ? `${item.name} copy` : item.name,
      x: clipboard.rootIds.includes(item.id) ? rootOffsets.get(item.id)!.x : item.x,
      y: clipboard.rootIds.includes(item.id) ? rootOffsets.get(item.id)!.y : item.y,
      parentId: clipboard.rootIds.includes(item.id)
        ? destinationFrame?.id ?? (roots.find(root => root.id === item.id)?.parentId)
        : item.parentId ? idMap.get(item.parentId) || item.parentId : undefined,
      flowStartingPoint: false,
      linkToElementId: item.linkToElementId ? idMap.get(item.linkToElementId) || item.linkToElementId : undefined,
    }))
    recordUndo()
    setElements(items => {
      const next = [...items, ...copies]
      return destinationFrame ? reflowContainerById(next, destinationFrame.id) : next
    })
    const pastedRootIds = clipboard.rootIds.map(id => idMap.get(id)).filter((id): id is string => !!id)
    setSelectedId(pastedRootIds[0] || null)
    setSelectedIds(pastedRootIds)
  }

  function undo() {
    const previous = undoStack.current.pop()
    if (!previous) return
    redoStack.current.push({ page: activePage, elements })
    setPageElements(current => ({ ...current, [previous.page]: previous.elements }))
    setSelectedIds(current => current.filter(id => previous.elements.some(item => item.id === id)))
    setSelectedId(current => previous.elements.some(item => item.id === current) ? current : null)
    if (previous.page !== activePage) setActivePage(previous.page)
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
    setSaved(false)
  }

  function redo() {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push({ page: activePage, elements })
    setPageElements(current => ({ ...current, [next.page]: next.elements }))
    setSelectedIds(current => current.filter(id => next.elements.some(item => item.id === id)))
    setSelectedId(current => next.elements.some(item => item.id === current) ? current : null)
    if (next.page !== activePage) setActivePage(next.page)
    setCanUndo(true)
    setCanRedo(redoStack.current.length > 0)
    setSaved(false)
  }

  function beginDrag(event: React.PointerEvent, element: CanvasElement) {
    if (element.locked) return
    event.stopPropagation()
    if (event.shiftKey) {
      const next = selectedIds.includes(element.id)
        ? selectedIds.filter(id => id !== element.id)
        : [...selectedIds, element.id]
      setSelectedIds(next)
      setSelectedId(next.includes(element.id) ? element.id : next[next.length - 1] || null)
      return
    }
    const ids = selectedIds.includes(element.id) ? selectedIds : [element.id]
    setSelectedIds(ids)
    setSelectedId(element.id)
    if (element.type === 'image' && !element.src) {
      return
    }
    const movableIds = ids.filter(id => {
      const selectedItem = elements.find(item => item.id === id)
      if (!selectedItem || selectedItem.locked) return false
      let parentId = selectedItem.parentId
      while (parentId) {
        if (ids.includes(parentId)) return false
        parentId = elements.find(item => item.id === parentId)?.parentId
      }
      return true
    })
    drag.current = {
      ids: movableIds,
      startX: event.clientX,
      startY: event.clientY,
      positions: new Map(elements.filter(item => movableIds.includes(item.id)).map(item => [item.id, { x: item.x, y: item.y }])),
      recorded: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginResize(event: React.PointerEvent, element: CanvasElement, handle = 'se') {
    event.stopPropagation()
    if (element.locked) return
    if (!selectedIds.includes(element.id)) selectOnly(element.id)
    const bounds = canvasRef.current?.getBoundingClientRect()
    const scale = zoom / 100
    const parent = element.parentId ? elements.find(item => item.id === element.parentId && (item.type === 'frame' || item.type === 'group')) : null
    const origin = parent ? framePosition(parent) : { x: 0, y: 0 }
    const startX = (bounds ? (event.clientX - bounds.left) / scale : event.clientX / scale) - origin.x
    const startY = (bounds ? (event.clientY - bounds.top) / scale : event.clientY / scale) - origin.y
    resize.current = {
      id: element.id,
      startX,
      startY,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      handle,
      recorded: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function beginRotate(event: React.PointerEvent, element: CanvasElement) {
    event.preventDefault()
    event.stopPropagation()
    if (element.locked) return
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!bounds) return
    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    rotate.current = {
      id: element.id,
      startRotation: element.rotation || 0,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      centerX,
      centerY,
      recorded: false,
    }
    if (!selectedIds.includes(element.id)) selectOnly(element.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePointer(event: React.PointerEvent) {
    if (panelResize.current) {
      const current = panelResize.current
      if (current.side === 'bottom') {
        setDockHeight(Math.max(160, Math.min(440, current.startWidth + current.startY - event.clientY)))
        return
      }
      const delta = event.clientX - current.startX
      if (current.side === 'left') setLeftWidth(Math.max(230, Math.min(420, current.startWidth + delta)))
      else setRightWidth(Math.max(240, Math.min(420, current.startWidth - delta)))
      return
    }
    if (marquee.current) {
      const current = marquee.current
      const x = current.startX + (event.clientX - current.clientX) / current.scale
      const y = current.startY + (event.clientY - current.clientY) / current.scale
      setMarqueeBox({
        x: Math.min(current.startX, x),
        y: Math.min(current.startY, y),
        width: Math.abs(x - current.startX),
        height: Math.abs(y - current.startY),
      })
      return
    }
    if (drawing.current) {
      const current = drawing.current
      const element = elements.find(item => item.id === current.id)
      if (!element) return
      const localX = current.startX + (event.clientX - current.clientX) / current.scale
      const localY = current.startY + (event.clientY - current.clientY) / current.scale
      const x = Math.min(current.startX, localX)
      const y = Math.min(current.startY, localY)
      const width = Math.max(24, Math.abs(localX - current.startX))
      const height = Math.max(24, Math.abs(localY - current.startY))
      setElements(items => items.map(item => item.id === current.id ? { ...item, x, y, width, height } : item))
      return
    }
    if (rotate.current) {
      const current = rotate.current
      const angle = Math.atan2(event.clientY - current.centerY, event.clientX - current.centerX)
      const delta = ((angle - current.startAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      const degrees = ((current.startRotation + delta * 180 / Math.PI + 180) % 360 + 360) % 360 - 180
      if (!current.recorded) {
        recordUndo()
        rotate.current = { ...current, recorded: true }
      }
      setElements(items => items.map(item => item.id === current.id ? { ...item, rotation: degrees } : item))
      return
    }
    if (drag.current) {
      const next = drag.current
      let dx = (event.clientX - next.startX) / (zoom / 100)
      let dy = (event.clientY - next.startY) / (zoom / 100)
      const movingBounds = next.ids.flatMap(id => {
        const item = elements.find(candidate => candidate.id === id)
        const position = next.positions.get(id)
        if (!item || !position) return []
        const parent = item.parentId
          ? elements.find(candidate => candidate.id === item.parentId && (candidate.type === 'frame' || candidate.type === 'group'))
          : null
        const origin = parent ? framePosition(parent) : { x: 0, y: 0 }
        return [{ left: position.x + origin.x, top: position.y + origin.y, right: position.x + origin.x + item.width, bottom: position.y + origin.y + item.height }]
      })
      if (movingBounds.length) {
        const bounds = {
          left: Math.min(...movingBounds.map(item => item.left)),
          top: Math.min(...movingBounds.map(item => item.top)),
          right: Math.max(...movingBounds.map(item => item.right)),
          bottom: Math.max(...movingBounds.map(item => item.bottom)),
        }
        if (snapToGrid) {
          dx += Math.round((bounds.left + dx) / gridSize) * gridSize - (bounds.left + dx)
          dy += Math.round((bounds.top + dy) / gridSize) * gridSize - (bounds.top + dy)
        }
        const movingIds = new Set(next.ids)
        const referenceElements = elements.filter(item => {
          if (item.hidden || movingIds.has(item.id)) return false
          let parentId = item.parentId
          while (parentId) {
            if (movingIds.has(parentId)) return false
            parentId = elements.find(candidate => candidate.id === parentId)?.parentId
          }
          return true
        })
        let guideX: number | undefined
        let guideY: number | undefined
        let correctionX = Number.POSITIVE_INFINITY
        let correctionY = Number.POSITIVE_INFINITY
        const threshold = 8 / (zoom / 100)
        const xAnchors = [bounds.left + dx, (bounds.left + bounds.right) / 2 + dx, bounds.right + dx]
        const yAnchors = [bounds.top + dy, (bounds.top + bounds.bottom) / 2 + dy, bounds.bottom + dy]
        for (const reference of referenceElements) {
          const parent = reference.parentId
            ? elements.find(candidate => candidate.id === reference.parentId && (candidate.type === 'frame' || candidate.type === 'group'))
            : null
          const origin = parent ? framePosition(parent) : { x: 0, y: 0 }
          const xTargets = [reference.x + origin.x, reference.x + origin.x + reference.width / 2, reference.x + origin.x + reference.width]
          const yTargets = [reference.y + origin.y, reference.y + origin.y + reference.height / 2, reference.y + origin.y + reference.height]
          for (const anchor of xAnchors) {
            for (const target of xTargets) {
              const difference = target - anchor
              if (Math.abs(difference) < Math.abs(correctionX)) {
                correctionX = difference
                guideX = target
              }
            }
          }
          for (const anchor of yAnchors) {
            for (const target of yTargets) {
              const difference = target - anchor
              if (Math.abs(difference) < Math.abs(correctionY)) {
                correctionY = difference
                guideY = target
              }
            }
          }
        }
        const guides: { axis: 'x' | 'y'; position: number }[] = []
        if (Math.abs(correctionX) <= threshold && guideX !== undefined) {
          dx += correctionX
          guides.push({ axis: 'x', position: guideX })
        }
        if (Math.abs(correctionY) <= threshold && guideY !== undefined) {
          dy += correctionY
          guides.push({ axis: 'y', position: guideY })
        }
        setSnapGuides(guides)
      }
      if (!next.recorded && (dx !== 0 || dy !== 0)) {
        recordUndo()
        drag.current = { ...next, recorded: true }
      }
      setElements(items => items.map(item => {
        const position = next.positions.get(item.id)
        return position && next.ids.includes(item.id)
          ? { ...item, x: Math.max(0, position.x + dx), y: Math.max(0, position.y + dy) }
          : item
      }))
    }
    if (resize.current) {
      const next = resize.current
      const scale = zoom / 100
      const bounds = canvasRef.current?.getBoundingClientRect()
      const element = elements.find(item => item.id === next.id)
      const parent = element?.parentId ? elements.find(item => item.id === element.parentId && (item.type === 'frame' || item.type === 'group')) : null
      const origin = parent ? framePosition(parent) : { x: 0, y: 0 }
      const clientX = (bounds ? (event.clientX - bounds.left) / scale : event.clientX / scale) - origin.x
      const clientY = (bounds ? (event.clientY - bounds.top) / scale : event.clientY / scale) - origin.y
      const deltaX = clientX - next.startX
      const deltaY = clientY - next.startY
      if (!next.recorded && (deltaX !== 0 || deltaY !== 0)) {
        recordUndo()
        resize.current = { ...next, recorded: true }
      }
      setElements(items => items.map(item => {
        if (item.id !== next.id) return item
        let x = next.x
        let y = next.y
        let width = next.width
        let height = next.height
        if (next.handle.includes('e')) width = Math.max(24, next.width + deltaX)
        if (next.handle.includes('w')) { width = Math.max(24, next.width - deltaX); x = next.x + next.width - width }
        if (next.handle.includes('s')) height = Math.max(24, next.height + deltaY)
        if (next.handle.includes('n')) { height = Math.max(24, next.height - deltaY); y = next.y + next.height - height }
        return { ...item, x, y, width, height }
      }))
    }
  }

  function endPointer() {
    const selectedDrag = drag.current
    if (selectedDrag && !selectedDrag.recorded) {
      const element = elements.find(item => item.id === selectedId)
      if (element?.type === 'image' && element.src) openImagePicker(element.id)
    }
    const movedElements = selectedDrag?.ids.map(id => elements.find(item => item.id === id)).filter((item): item is CanvasElement => !!item) || []
    const movedParentId = movedElements[0]?.parentId
    const allShareParent = movedParentId && movedElements.every(item => item.parentId === movedParentId)
    if (selectedDrag?.recorded && allShareParent) {
      setElements(items => reflowContainerById(items, movedParentId))
    }
    const drawnElement = drawing.current ? elements.find(item => item.id === drawing.current?.id) : null
    const drawnParent = drawnElement?.parentId
      ? elements.find(item => item.id === drawnElement.parentId)
      : null
    if (drawnParent && (drawnParent.type === 'frame' || drawnParent.type === 'group')) {
      setElements(items => reflowContainerById(items, drawnParent.id))
    }
    const resizedElement = resize.current ? elements.find(item => item.id === resize.current?.id) : null
    if (resize.current?.recorded && resizedElement) {
      setElements(items => reflowElementAndParent(items, resizedElement.id))
    }
    if (marquee.current) {
      const current = marquee.current
      if (marqueeBox && (marqueeBox.width > 3 || marqueeBox.height > 3)) {
        const hits = elements.filter(item => {
          if (item.hidden) return false
          const parent = item.parentId ? elements.find(candidate => candidate.id === item.parentId && (candidate.type === 'frame' || candidate.type === 'group')) : null
          const origin = parent ? framePosition(parent) : { x: 0, y: 0 }
          const left = item.x + origin.x
          const top = item.y + origin.y
          return left <= marqueeBox.x + marqueeBox.width && left + item.width >= marqueeBox.x
            && top <= marqueeBox.y + marqueeBox.height && top + item.height >= marqueeBox.y
        }).map(item => item.id)
        const next = current.additive ? [...new Set([...selectedIds, ...hits])] : hits
        setSelectedIds(next)
        setSelectedId(next[next.length - 1] || null)
      } else if (!current.additive) {
        selectOnly(null)
      }
    }
    drag.current = null
    setSnapGuides([])
    marquee.current = null
    setMarqueeBox(null)
    drawing.current = null
    resize.current = null
    rotate.current = null
    panelResize.current = null
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    const file = files.find(entry => imageMimeType(entry))
    if (!file) {
      if (files.length) showToast('Formato no compatible. Usa PNG, JPEG, WebP o GIF.')
      return
    }
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-element-id]')
    const targetId = target?.dataset.elementId || null
    const canvasBounds = canvasRef.current?.getBoundingClientRect()
    const point = canvasBounds
      ? { x: Math.max(0, (event.clientX - canvasBounds.left) / (zoom / 100)), y: Math.max(0, (event.clientY - canvasBounds.top) / (zoom / 100)) }
      : undefined
    void processImageFile(file, point, targetId)
  }

  async function loadCustomFont(file: File) {
    const family = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    try {
      const source = await blobToDataUrl(file)
      const font = new FontFace(family, `url(${source})`)
      await font.load()
      document.fonts.add(font)
      updateSelected({ fontFamily: family, fontSource: source })
      showToast(`Fuente ${family} cargada`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo cargar la fuente')
    }
  }

  async function openPreview() {
    setPreviewPage(activePage)
    const topLevelFrames = elements.filter(item => item.type === 'frame' && !item.parentId && !item.hidden)
    const startFrame = topLevelFrames.find(item => item.flowStartingPoint) || topLevelFrames[0]
    setPreviewFrameId(startFrame?.id || null)
    setPreview(true)
    setPreviewBuilding(true)
    setPreviewHtml('')
    setPreviewWarnings([])
    try {
      const result = await buildWebExport({ projectName, pages, activePage, pageElements })
      previewDocuments.current = result.previewDocuments
      setPreviewHtml(result.previewDocuments[activePage] || '')
      setPreviewWarnings(result.warnings)
    } catch (error) {
      setPreview(false)
      showToast(error instanceof Error ? error.message : 'No se pudo generar la vista previa')
    } finally {
      setPreviewBuilding(false)
    }
  }

  function navigatePreviewToPage(page: string) {
    if (!pages.includes(page)) {
      showToast(`La página "${page}" ya no existe`)
      return
    }
    const nextElements = pageElements[page] || []
    const topLevelFrames = nextElements.filter(item => item.type === 'frame' && !item.parentId && !item.hidden)
    const startFrame = topLevelFrames.find(item => item.flowStartingPoint) || topLevelFrames[0]
    const document = previewDocuments.current[page]
    if (!document) {
      showToast(`No se pudo cargar la vista previa de "${page}"`)
      return
    }
    setPreviewPage(page)
    setPreviewFrameId(startFrame?.id || null)
    setPreviewHtml(document)
  }

  const handlePreviewNavigationEvent = useEffectEvent((event: MessageEvent<unknown>) => {
    if (event.source !== previewIframeRef.current?.contentWindow
      && event.source !== dockPreviewIframeRef.current?.contentWindow) return
    if (!event.data || typeof event.data !== 'object') return
    const message = event.data as { source?: unknown; page?: unknown }
    if (message.source !== 'lixy-preview' || typeof message.page !== 'string') return
    navigatePreviewToPage(message.page)
  })

  useEffect(() => {
    window.addEventListener('message', handlePreviewNavigationEvent)
    return () => window.removeEventListener('message', handlePreviewNavigationEvent)
  }, [])

  async function exportProject() {
    if (exportInProgress.current) return
    exportInProgress.current = true
    setExporting(true)
    try {
      const result = await buildWebExport({ projectName, pages, activePage, pageElements })
      const url = URL.createObjectURL(result.archive)
      const link = document.createElement('a')
      link.href = url
      link.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lixy-project'}.zip`
      link.style.display = 'none'
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast(result.warnings.length ? `Proyecto exportado. Advertencias: ${result.warnings.join(' ')}` : 'Proyecto exportado')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo exportar el proyecto')
    } finally {
      exportInProgress.current = false
      setExporting(false)
    }
  }

  function canvasWidth() {
    return device === 'phone' ? PHONE_PREVIEW_WIDTH : device === 'tablet' ? 768 : 900
  }

  function canvasHeight() {
    return device === 'phone' ? PHONE_PREVIEW_HEIGHT : device === 'tablet' ? 1024 : 600
  }

  function toggleSection(section: string) {
    setOpenSections(current => ({ ...current, [section]: !current[section] }))
  }

  function resizePanelStart(event: React.PointerEvent, side: 'left' | 'right') {
    event.preventDefault()
    panelResize.current = { side, startX: event.clientX, startY: event.clientY, startWidth: side === 'left' ? leftWidth : rightWidth }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function resizeDockStart(event: React.PointerEvent) {
    event.preventDefault()
    panelResize.current = { side: 'bottom', startX: event.clientX, startY: event.clientY, startWidth: dockHeight }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function resizePanelByKeyboard(event: React.KeyboardEvent, side: 'left' | 'right' | 'bottom') {
    const direction = side === 'bottom'
      ? event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
      : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!direction) return
    event.preventDefault()
    if (side === 'left') setLeftWidth(width => Math.max(230, Math.min(420, width + direction * 12)))
    else if (side === 'right') setRightWidth(width => Math.max(240, Math.min(420, width - direction * 12)))
    else setDockHeight(height => Math.max(160, Math.min(440, height + direction * 12)))
  }

  function toggleMenu(name: string) {
    setOpenMenu(current => current === name ? null : name)
  }

  function renderResizeHandles(element: CanvasElement) {
    return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => (
      <button
        key={handle}
        type="button"
        className={`resize-handle handle-${handle}`}
        aria-label={`Resize ${handle}`}
        onPointerDown={event => beginResize(event, element, handle)}
      />
    ))
  }

  function renderRotateHandle(element: CanvasElement) {
    return (
      <button
        type="button"
        className="rotation-handle"
        aria-label="Rotate element"
        title="Drag to rotate"
        onPointerDown={event => beginRotate(event, element)}
        onKeyDown={event => {
          const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
          if (!direction) return
          event.preventDefault()
          recordUndo()
          setElements(items => items.map(item => item.id === element.id
            ? { ...item, rotation: (item.rotation || 0) + direction * (event.shiftKey ? 15 : 1) }
            : item))
        }}
      >
        <RotateCw />
      </button>
    )
  }

  function textStyle(element: CanvasElement): React.CSSProperties {
    return {
      fontFamily: safeFontFamily(element.fontFamily),
      fontWeight: element.fontWeight || 400,
      fontStyle: element.fontStyle || 'normal',
      textAlign: element.textAlign || 'left',
      lineHeight: element.lineHeight || 1.2,
      letterSpacing: element.letterSpacing || 0,
      wordSpacing: element.wordSpacing || 0,
      textDecoration: element.textDecoration || 'none',
      textTransform: element.textTransform || 'none',
    }
  }

  function nodeStyle(element: CanvasElement): React.CSSProperties {
    return {
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      background: element.background,
      color: element.color,
      borderRadius: element.radius,
      opacity: element.opacity,
      fontSize: element.fontSize,
      transform: `rotate(${element.rotation || 0}deg)`,
      boxShadow: getElementShadow(element),
      padding: element.padding || 0,
      ...textStyle(element),
    }
  }

  function renderCanvasElement(item: CanvasElement): React.ReactNode {
    let content: React.ReactNode
    if (item.type === 'input') {
      content = <input aria-label={item.name} placeholder={item.text} />
    } else if (item.type === 'image') {
      content = item.src
        ? <img className="canvas-image" src={item.src} alt={item.name} draggable={false} style={{ objectFit: item.imageFit || 'contain', objectPosition: `${item.objectPositionX ?? 50}% ${item.objectPositionY ?? 50}%` }} />
        : <button className="image-placeholder" aria-label="Choose image" onClick={event => { event.stopPropagation(); openImagePicker(item.id) }}><Image /><span>Choose image</span></button>
    } else if (item.type === 'button') {
      content = <button style={textStyle(item)}>{item.text}</button>
    } else if (item.type === 'shape') {
      content = <span className={`shape-content ${item.shapeKind || 'circle'}`}>
        {item.src && <img className="shape-image" src={item.src} alt={item.name} draggable={false} style={{ objectFit: item.imageFit || 'cover', objectPosition: `${item.objectPositionX ?? 50}% ${item.objectPositionY ?? 50}%` }} />}
      </span>
    } else if (item.type === 'frame' || item.type === 'group') {
      content = <div className={item.type === 'group' ? 'group-content' : 'frame-content'}>
        {elements.filter(child => child.parentId === item.id && !child.hidden).map(renderCanvasElement)}
      </div>
    } else {
      content = <span
        className="node-text"
        style={textStyle(item)}
        contentEditable={editingTextId === item.id}
        suppressContentEditableWarning
        onInput={event => {
          const text = event.currentTarget.innerText
          if (!textEditHasHistory.current) {
            recordUndo()
            textEditHasHistory.current = true
          }
          setElements(current => current.map(element => element.id === item.id ? { ...element, text } : element))
        }}
        onBlur={() => {
          setEditingTextId(current => current === item.id ? null : current)
          textEditHasHistory.current = false
        }}
      >{item.text}</span>
    }
    return (
      <div
        key={item.id}
        data-element-id={item.id}
        className={`canvas-node ${item.parentId ? 'nested-image' : ''} ${item.type} ${item.shapeKind || ''} ${selectedIds.includes(item.id) ? 'selected' : ''} ${editingTextId === item.id ? 'editing' : ''}`}
        style={nodeStyle(item)}
        onPointerDown={event => {
          if (editingTextId === item.id) { event.stopPropagation(); return }
          handleElementPointerDown(event, item)
        }}
        onDoubleClick={event => {
          if (item.type === 'text' && editingTextId !== item.id) {
            event.stopPropagation()
            recordUndo()
            setEditingTextId(item.id)
          }
        }}
      >
        {content}
        {selectedId === item.id && !item.locked && <>{renderRotateHandle(item)}{renderResizeHandles(item)}</>}
      </div>
    )
  }

  return (
    <main
      className="studio"
      style={{
        gridTemplateColumns: `${leftCollapsed ? 48 : leftWidth}px minmax(0, 1fr) ${rightCollapsed ? 48 : rightWidth}px`,
        gridTemplateRows: `46px minmax(0, 1fr) ${dockVisible ? `${dockHeight}px` : '0px'}`,
        ['--left-panel-width' as string]: `${leftWidth}px`,
        ['--right-panel-width' as string]: `${rightCollapsed ? 48 : rightWidth}px`,
        ['--dock-height' as string]: `${dockVisible ? dockHeight : 0}px`,
      }}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <input
        ref={fileInput}
        className="hidden-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) void processImageFile(file)
          else imageTargetId.current = null
          event.target.value = ''
        }}
      />
      <input
        ref={fontInput}
        className="hidden-file-input"
        type="file"
        accept=".woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file && selected) void loadCustomFont(file)
          event.target.value = ''
        }}
      />
      <header className="topbar">
        <div className="brand"><img className="brand-mark" src={`${import.meta.env.BASE_URL}lixy-logo.svg`} alt="Lixy Studios" /><strong>Lixy Studios</strong></div>
        <nav className="menu-bar" aria-label="Main menu">
          <StudioMenu name="Proyecto" active={openMenu === 'Proyecto'} onToggle={() => toggleMenu('Proyecto')} onClose={() => setOpenMenu(null)} items={[
            { label: 'Guardar proyecto · Ctrl+S', action: () => saveProject() },
            { label: 'Importar imagen', action: () => openImagePicker() },
            { label: 'Exportar proyecto', action: () => { void exportProject() } },
          ]} />
          <StudioMenu name="Editar" active={openMenu === 'Editar'} onToggle={() => toggleMenu('Editar')} onClose={() => setOpenMenu(null)} items={[
            { label: 'Deshacer · Ctrl+Z', action: () => undo(), disabled: !canUndo },
            { label: 'Rehacer · Ctrl+Shift+Z', action: () => redo(), disabled: !canRedo },
            { label: 'Duplicar selección · Ctrl+D', action: () => duplicateSelected(), disabled: !selected },
            { label: 'Eliminar selección · Supr', action: () => deleteSelected(), disabled: !selectedIds.length },
          ]} />
          <StudioMenu name="Ver" active={openMenu === 'Ver'} onToggle={() => toggleMenu('Ver')} onClose={() => setOpenMenu(null)} items={[
            { label: grid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula', action: () => setGrid(value => !value) },
            { label: snapToGrid ? 'Desactivar ajuste a cuadrícula' : 'Ajustar a cuadrícula', action: () => setSnapToGrid(value => !value) },
            { label: 'Alejar', action: () => setZoom(value => Math.max(25, value - 10)) },
            { label: 'Acercar', action: () => setZoom(value => Math.min(150, value + 10)) },
          ]} />
          <StudioMenu name="Diseño" active={openMenu === 'Diseño'} onToggle={() => toggleMenu('Diseño')} onClose={() => setOpenMenu(null)} items={[
            ...palette.map(tool => ({
              label: `Insertar ${tool.label}`,
              action: () => addElement(tool.type, tool.shapeKind),
            })),
          ]} />
          <StudioMenu name="Ejecutar" active={openMenu === 'Ejecutar'} onToggle={() => toggleMenu('Ejecutar')} onClose={() => setOpenMenu(null)} items={[{ label: 'Vista previa ejecutable', action: openPreview }]} />
          <StudioMenu name="Ventana" active={openMenu === 'Ventana'} onToggle={() => toggleMenu('Ventana')} onClose={() => setOpenMenu(null)} items={[
            { label: leftCollapsed ? 'Mostrar panel lateral' : 'Ocultar panel lateral', action: () => setLeftCollapsed(value => !value) },
            { label: rightCollapsed ? 'Mostrar inspector' : 'Ocultar inspector', action: () => setRightCollapsed(value => !value) },
            { label: dockVisible ? 'Ocultar panel inferior' : 'Mostrar panel inferior', action: () => setDockVisible(value => !value) },
          ]} />
          <StudioMenu name="Ayuda" active={openMenu === 'Ayuda'} onToggle={() => toggleMenu('Ayuda')} onClose={() => setOpenMenu(null)} items={[
            { label: 'Atajos de teclado', action: () => showToast('V seleccionar · F marco · T texto · B botón · I imagen · Ctrl+Z deshacer · Ctrl+D duplicar · Ctrl+S guardar') },
            { label: 'Acerca de Lixy Studios', action: () => showToast('Lixy Studios · editor visual local para diseño y exportación web') },
          ]} />
        </nav>
        <nav className="history">
          <button title="Undo (Ctrl+Z)" aria-label="Undo" onClick={undo} disabled={!canUndo}><Undo2 /></button>
          <button title="Redo (Ctrl+Shift+Z)" aria-label="Redo" onClick={redo} disabled={!canRedo}><Redo2 /></button>
        </nav>
        <div className="page-name"><span className={`status-dot ${saved ? '' : 'saving'}`} /><input aria-label="Project name" value={projectName} onChange={event => { setSaved(false); setProjectName(event.target.value) }} /></div>
        <div className="top-actions">
          <button className="icon-button" title="Save project" onClick={saveProject} disabled={!storageReady}><Save /> <span>{saved ? 'Saved' : 'Saving...'}</span></button>
          <button className="icon-button" title="Import image" onClick={() => openImagePicker()}><Image /> Import</button>
          <button className="icon-button" title="Preview project" onClick={openPreview}><Eye /> Preview</button>
          <button className="primary-button" title="Export project as ZIP" onClick={() => void exportProject()} disabled={exporting} aria-busy={exporting}><Upload /> {exporting ? 'Exporting…' : 'Export'}</button>
        </div>
      </header>

      <aside className={`leftbar ${leftCollapsed ? 'collapsed' : ''}`}>
        <div className="mode-switch">
          <button className="collapse-toggle" onClick={() => setLeftCollapsed(value => !value)} title={leftCollapsed ? 'Expand layers panel' : 'Collapse layers panel'} aria-label="Toggle layers panel"><ChevronLeft /></button>
          <button className={!activeTool ? 'active' : ''} aria-pressed={!activeTool} onClick={() => setActiveTool(null)} title="Select · V"><MousePointer2 /></button>
          {palette.map(tool => (
            <button
              key={tool.label}
              className={activeTool?.type === tool.type && activeTool.shapeKind === tool.shapeKind ? 'active' : ''}
              aria-pressed={activeTool?.type === tool.type && activeTool.shapeKind === tool.shapeKind}
              onClick={() => addElement(tool.type, tool.shapeKind)}
              title={`Insert ${tool.label}`}
            ><tool.icon /></button>
          ))}
          <button onClick={() => { setDockTab('code'); setDockVisible(true) }} title="Open generated code"><FileCode2 /></button>
          <button onClick={() => openImagePicker()} title="Import image"><Upload /></button>
        </div>
        {!leftCollapsed && <div className="left-panel">
          <div className="sidebar-tabs" role="tablist" aria-label="Project panels">
            {([
              ['layers', 'Capas'],
              ['components', 'Componentes'],
              ['resources', 'Recursos'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                role="tab"
                aria-selected={sidebarTab === tab}
                className={sidebarTab === tab ? 'active' : ''}
                onClick={() => setSidebarTab(tab)}
              >{label}</button>
            ))}
          </div>
          {sidebarTab === 'layers' && <>
            <section className="panel-section pages">
              <div className="panel-heading"><button onClick={() => toggleSection('pages')} aria-expanded={!!openSections.pages}><span>Páginas</span><ChevronDown className={openSections.pages ? '' : 'closed'} /></button><button title="Add page" aria-label="Add page" onClick={addPage}><Plus /></button></div>
              {openSections.pages && pages.map(page => (
                <div
                  key={page}
                  className={`page-row ${activePage === page ? 'active' : ''}`}
                  onDoubleClick={() => startPageRename(page)}
                  title="Double-click to rename"
                >
                  {editingPage === page ? (
                    <input
                      ref={pageNameInput}
                      className="page-name-input"
                      aria-label={`Rename page ${page}`}
                      value={pageNameDraft}
                      onChange={event => setPageNameDraft(event.target.value)}
                      onBlur={() => {
                        if (cancelPageRename.current) {
                          cancelPageRename.current = false
                          return
                        }
                        commitPageRename(page)
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                        if (event.key === 'Escape') {
                          cancelPageRename.current = true
                          setEditingPage(null)
                          setPageNameDraft(page)
                          event.currentTarget.blur()
                        }
                      }}
                      onDoubleClick={event => event.stopPropagation()}
                    />
                  ) : (
                    <button
                      className="page-select"
                      aria-current={activePage === page ? 'page' : undefined}
                      onClick={() => selectPage(page)}
                      onDoubleClick={event => { event.stopPropagation(); startPageRename(page) }}
                    >
                      <Folder /><span>{page}</span>
                    </button>
                  )}
                  <button
                    className="page-delete"
                    title={pages.length > 1 ? `Delete ${page}` : 'A project must have at least one page'}
                    aria-label={`Delete page ${page}`}
                    disabled={pages.length <= 1}
                    onClick={() => setPageToDelete(page)}
                    onDoubleClick={event => event.stopPropagation()}
                  ><Trash2 /></button>
                </div>
              ))}
            </section>
            <label className="layer-search"><Search /><input ref={layerSearchInput} aria-label="Search layers" placeholder="Buscar capas..." value={layerQuery} onChange={event => setLayerQuery(event.target.value)} /><kbd>Ctrl K</kbd></label>
            <section className="panel-section layers-section">
              <div className="panel-heading"><span>Capas</span><Layers3 /></div>
              {visibleLayerRows.map(({ item, depth }) => (
                  <div
                    key={item.id}
                    className={`layer-row ${selectedIds.includes(item.id) ? 'active' : ''} ${item.hidden ? 'hidden-layer' : ''}`}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => { event.preventDefault(); reorderLayer(item.id) }}
                  >
                    {elements.some(child => child.parentId === item.id) ? (
                      <button
                        className={`layer-toggle ${collapsedLayers.has(item.id) ? 'collapsed' : ''}`}
                        aria-label={`${collapsedLayers.has(item.id) ? 'Expand' : 'Collapse'} ${item.name}`}
                        onClick={() => setCollapsedLayerIds(current => collapsedLayers.has(item.id)
                          ? current.filter(id => id !== item.id)
                          : [...current, item.id])}
                      ><ChevronDown /></button>
                    ) : <span className="layer-toggle-spacer" />}
                    {editingLayerId === item.id ? (
                      <input
                        className="layer-name-input"
                        aria-label={`Rename ${item.name}`}
                        autoFocus
                        value={layerNameDraft}
                        onChange={event => setLayerNameDraft(event.target.value)}
                        onBlur={() => commitLayerRename(item.id)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') event.currentTarget.blur()
                          if (event.key === 'Escape') setEditingLayerId(null)
                        }}
                      />
                    ) : (
                      <button
                        className="layer"
                        draggable={!item.locked}
                        aria-pressed={selectedIds.includes(item.id)}
                        onClick={event => {
                          setActiveTool(null)
                          if (event.shiftKey) {
                            const next = selectedIds.includes(item.id) ? selectedIds.filter(id => id !== item.id) : [...selectedIds, item.id]
                            setSelectedIds(next)
                            setSelectedId(next[next.length - 1] || null)
                          } else selectOnly(item.id)
                        }}
                        onDoubleClick={() => { setLayerNameDraft(item.name); setEditingLayerId(item.id) }}
                        onDragStart={() => { draggedLayerId.current = item.id }}
                        onDragEnd={() => { draggedLayerId.current = null }}
                        title={`${item.name} · Shift-click to add to selection · double-click to rename`}
                        style={{ paddingLeft: 8 + depth * 12 }}
                      >
                        {item.type === 'frame' ? <Frame /> : item.type === 'group' ? <Layers3 /> : item.type === 'text' ? <Type /> : item.type === 'image' ? <Image /> : item.shapeKind === 'circle' ? <Circle /> : item.shapeKind === 'rectangle' ? <Square /> : item.shapeKind === 'line' ? <Minus /> : <Box />}
                        <span>{item.name}</span>
                      </button>
                    )}
                    <div className="layer-actions">
                      <button aria-label={`${item.hidden ? 'Show' : 'Hide'} ${item.name}`} title={item.hidden ? 'Show layer' : 'Hide layer'} onClick={() => updateLayer(item.id, { hidden: !item.hidden })}>{item.hidden ? <EyeOff /> : <Eye />}</button>
                      <button aria-label={`${item.locked ? 'Unlock' : 'Lock'} ${item.name}`} title={item.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => updateLayer(item.id, { locked: !item.locked })}>{item.locked ? <Lock /> : <Unlock />}</button>
                    </div>
                  </div>
                ))}
              {elements.length === 0 && <p className="sidebar-empty">Esta página todavía no tiene capas.</p>}
            </section>
          </>}
          {sidebarTab === 'components' && (
            <section className="sidebar-placeholder">
              <Layers3 />
              <strong>Componentes del proyecto</strong>
              <span>La biblioteca de componentes reutilizables se habilitará en su fase de implementación.</span>
            </section>
          )}
          {sidebarTab === 'resources' && (() => {
            const resources = elements.flatMap(item => [
              ...(item.src ? [{ owner: item, label: item.name, type: 'Imagen' }] : []),
              ...(item.fontSource ? [{ owner: item, label: item.fontFamily || item.name, type: 'Fuente' }] : []),
            ])
            return (
              <section className="resource-list" aria-label="Imported resources">
                {resources.map((resource, index) => (
                  <button key={`${resource.owner.id}-${resource.type}-${index}`} onClick={() => selectOnly(resource.owner.id)}>
                    {resource.type === 'Imagen' ? <Image /> : <Type />}
                    <span><strong>{resource.label}</strong><small>{resource.type} · {resource.owner.name}</small></span>
                  </button>
                ))}
                {resources.length === 0 && <p className="sidebar-empty">Los recursos importados de esta página aparecerán aquí.</p>}
                <button className="resource-import" onClick={() => openImagePicker()}><Upload /> Importar imagen</button>
              </section>
            )
          })()}
        </div>}
      </aside>

      <section className="workspace">
        <div className="canvas-toolbar">
          <div className="device-picker">
            <button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')} title="Desktop"><Monitor /></button>
            <button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')} title="Tablet"><Tablet /></button>
            <button className={device === 'phone' ? 'active' : ''} onClick={() => setDevice('phone')} title="Phone"><Smartphone /></button>
          </div>
          {activeTool && <span className="active-tool-hint" role="status">{activeTool.type === 'shape' ? activeTool.shapeKind : activeTool.type} tool · click or drag · Esc to exit</span>}
          {(selectedElements.length > 1 || selected?.type === 'group') && <div className="selection-actions" role="toolbar" aria-label="Selection actions">
            <button title="Align left" aria-label="Align left" onClick={() => alignSelection('left')}><AlignLeft /></button>
            <button title="Align horizontal centers" aria-label="Align horizontal centers" onClick={() => alignSelection('centerX')}><AlignCenter /></button>
            <button title="Align right" aria-label="Align right" onClick={() => alignSelection('right')}><AlignRight /></button>
            <button title="Align top" aria-label="Align top" onClick={() => alignSelection('top')}>Top</button>
            <button title="Align vertical centers" aria-label="Align vertical centers" onClick={() => alignSelection('centerY')}>Mid</button>
            <button title="Align bottom" aria-label="Align bottom" onClick={() => alignSelection('bottom')}>Bot</button>
            {selectedElements.length >= 3 && <>
              <button title="Distribute horizontally" aria-label="Distribute horizontally" onClick={() => alignSelection('distributeX')}>D-H</button>
              <button title="Distribute vertically" aria-label="Distribute vertically" onClick={() => alignSelection('distributeY')}>D-V</button>
            </>}
            {selectedElements.length > 1 && <button title="Group selection (Ctrl+G)" aria-label="Group selection" onClick={groupSelected}>Group</button>}
            {selected?.type === 'group' && <button title="Ungroup (Ctrl+Shift+G)" aria-label="Ungroup" onClick={ungroupSelected}>Ungroup</button>}
            <span aria-live="polite">{selectedElements.length} selected</span>
          </div>}
          <button className={grid ? 'active' : ''} onClick={() => setGrid(value => !value)} title="Toggle grid" aria-label="Toggle grid"><Grid3X3 /></button>
          <button className={snapToGrid ? 'active' : ''} aria-pressed={snapToGrid} onClick={() => setSnapToGrid(value => !value)} title={`Snap to grid (${gridSize}px)`} aria-label="Snap to grid"><Magnet /></button>
          <label className="grid-control" title="Grid size"><span>Grid</span><input aria-label="Grid size" type="number" min="4" max="64" step="1" value={gridSize} onChange={event => setGridSize(Math.max(4, Math.min(64, Number(event.target.value) || 4)))} /></label>
          <label className="grid-intensity" title="Grid intensity"><SlidersHorizontal /><input aria-label="Grid intensity" type="range" min="4" max="32" value={gridIntensity} onChange={event => setGridIntensity(Number(event.target.value))} /></label>
          <div className="zoom"><button onClick={() => setZoom(value => Math.max(25, value - 10))}>-</button><span>{zoom}%</span><button onClick={() => setZoom(value => Math.min(150, value + 10))}>+</button></div>
        </div>
        <div className="canvas-scroll">
          <div
            ref={canvasRef}
            className={`canvas ${grid ? 'grid' : ''} ${activeTool ? 'is-placing' : ''}`}
            style={{
              width: canvasWidth(), height: device === 'phone' ? PHONE_PREVIEW_HEIGHT : 600,
              transform: `scale(${zoom / 100})`,
              backgroundSize: `${gridSize}px ${gridSize}px`,
              ['--grid-opacity' as string]: gridIntensity / 100,
            }}
            onPointerDown={handleCanvasPointerDown}
            onDragOver={event => event.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            {elements.filter(item => !item.hidden && !item.parentId).map(renderCanvasElement)}
            {marqueeBox && <div className="selection-marquee" style={{ left: marqueeBox.x, top: marqueeBox.y, width: marqueeBox.width, height: marqueeBox.height }} aria-hidden="true" />}
            {snapGuides.map((guide, index) => (
              <div key={`${guide.axis}-${index}`} className={`smart-guide ${guide.axis}`} style={guide.axis === 'x' ? { left: guide.position } : { top: guide.position }} aria-hidden="true" />
            ))}
          </div>
        </div>
      </section>

      {dockVisible && (
        <section className="bottom-dock" aria-label="Code, diagnostics, and live preview">
          <div
            className="panel-resizer bottom"
            role="separator"
            aria-label="Resize bottom panels"
            aria-orientation="horizontal"
            aria-valuenow={dockHeight}
            tabIndex={0}
            onPointerDown={resizeDockStart}
            onKeyDown={event => resizePanelByKeyboard(event, 'bottom')}
          />
          <section className="dock-code">
            <nav className="dock-tabs" role="tablist" aria-label="Code and diagnostics">
              <button role="tab" aria-selected={dockTab === 'code'} className={dockTab === 'code' ? 'active' : ''} onClick={() => setDockTab('code')}><FileCode2 />Código</button>
              <button role="tab" aria-selected={dockTab === 'console'} className={dockTab === 'console' ? 'active' : ''} onClick={() => setDockTab('console')}><Terminal />Consola</button>
              <button role="tab" aria-selected={dockTab === 'problems'} className={dockTab === 'problems' ? 'active' : ''} onClick={() => setDockTab('problems')}><Settings2 />Problemas{runtimeDiagnostics.length > 0 && <span className="problem-count">{runtimeDiagnostics.length}</span>}</button>
            </nav>
            {dockTab === 'code' ? (
              <div className="dock-code-body">
                <aside className="file-explorer" aria-label="Generated project files">
                  <div className="file-explorer-heading">ARCHIVOS GENERADOS</div>
                  {Object.keys(generatedFiles).map(file => (
                    <button key={file} className={activeFile === file ? 'active' : ''} onClick={() => setActiveFile(file)}>
                      <FileCode2 /><span>{file}</span>
                    </button>
                  ))}
                  {Object.keys(generatedFiles).length === 0 && <p className="sidebar-empty">Preparando archivos…</p>}
                </aside>
                <div className="generated-code">
                  <div className="generated-code-title">
                    <span>{activeFile}</span>
                    <span>Salida generada · solo lectura</span>
                  </div>
                  <div className="generated-code-editor">
                    <Editor
                      height="100%"
                      language={activeFile.endsWith('.css') ? 'css' : activeFile.endsWith('.js') ? 'javascript' : 'html'}
                      theme="vs-dark"
                      value={generatedFiles[activeFile] || ''}
                      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', wordWrap: 'on', scrollBeyondLastLine: false, padding: { top: 8 } }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="diagnostic-panel" role="tabpanel">
                <div className={`runtime-status ${runtimeStatus}`}><span />{runtimeStatus === 'building' ? 'Compilando proyecto…' : runtimeStatus === 'running' ? 'Proyecto generado y ejecutándose en el preview' : 'No se pudo generar la salida del proyecto'}</div>
                {runtimeDiagnostics.length > 0
                  ? runtimeDiagnostics.map((message, index) => <p key={`${index}-${message}`} className={runtimeStatus === 'error' ? 'diagnostic-error' : ''}>{message}</p>)
                  : <p>{dockTab === 'console' ? 'El proyecto se compiló sin advertencias.' : 'No hay problemas detectados por el validador de exportación.'}</p>}
              </div>
            )}
          </section>
          <section className="dock-preview">
            <div className="dock-preview-toolbar">
              <strong>Vista previa</strong>
              <div className="dock-device-picker" role="group" aria-label="Canvas device size">
                <button className={device === 'phone' ? 'active' : ''} aria-label="Phone viewport" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}><Smartphone /></button>
                <button className={device === 'tablet' ? 'active' : ''} aria-label="Tablet viewport" aria-pressed={device === 'tablet'} onClick={() => setDevice('tablet')}><Tablet /></button>
                <button className={device === 'desktop' ? 'active' : ''} aria-label="Desktop viewport" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor /></button>
              </div>
              <span className={`runtime-badge ${runtimeStatus}`}><span />{runtimeStatus === 'building' ? 'Compilando' : runtimeStatus === 'running' ? 'En ejecución' : 'Error'}</span>
              <button className="dock-open-preview" onClick={() => { void openPreview() }}><Eye />Abrir</button>
            </div>
            <div ref={dockPreviewStageRef} className="dock-preview-stage">
              {previewHtml
                ? <div className="dock-preview-fit" style={{ width: canvasWidth() * dockPreviewScale + 2, height: canvasHeight() * dockPreviewScale + 2 }}>
                  <iframe
                    ref={dockPreviewIframeRef}
                    className="dock-preview-frame"
                    title={`Live website preview · ${activePage}`}
                    srcDoc={previewHtml}
                    sandbox="allow-forms allow-scripts"
                    style={{ width: canvasWidth(), height: canvasHeight(), transform: `scale(${dockPreviewScale})` }}
                    onLoad={() => setRuntimeStatus(current => current === 'error' ? current : 'running')}
                  />
                </div>
                : <div className="preview-loading" role="status">Generando la vista previa desde los archivos del proyecto…</div>}
            </div>
          </section>
        </section>
      )}

      <div className="panel-resizer left" style={{ left: leftCollapsed ? 46 : leftWidth - 2 }} role="separator" aria-label="Resize layers panel" aria-orientation="vertical" tabIndex={0} onPointerDown={event => resizePanelStart(event, 'left')} onKeyDown={event => resizePanelByKeyboard(event, 'left')} />
      <div className="panel-resizer right" style={{ right: rightCollapsed ? 46 : rightWidth - 2 }} role="separator" aria-label="Resize properties panel" aria-orientation="vertical" tabIndex={0} onPointerDown={event => resizePanelStart(event, 'right')} onKeyDown={event => resizePanelByKeyboard(event, 'right')} />
      <aside className={`rightbar ${rightCollapsed ? 'collapsed' : ''}`}>
        <div className="inspector-title">
          {!rightCollapsed && <><span>{selectedElements.length > 1 ? `${selectedElements.length} layers selected` : selected?.name || 'Properties'}</span><div>
            <button title="Duplicate (Ctrl+D)" aria-label="Duplicate" onClick={duplicateSelected} disabled={!selected}><Copy /></button>
            <button title="Delete selected element" aria-label="Delete" onClick={deleteSelected} disabled={!selected}><Trash2 /></button>
          </div></>}
          <button className="collapse-toggle" title={rightCollapsed ? 'Expand properties panel' : 'Collapse properties panel'} aria-label="Toggle properties panel" onClick={() => setRightCollapsed(value => !value)}>{rightCollapsed ? <ChevronLeft /> : <ChevronRight />}</button>
        </div>
        {!rightCollapsed && <nav className="inspector-tabs" role="tablist" aria-label="Inspector sections">
          {([
            ['design', 'Diseño'],
            ['styles', 'Estilos'],
            ['advanced', 'Avanzado'],
          ] as const).map(([tab, label]) => (
            <button key={tab} role="tab" aria-selected={inspectorTab === tab} className={inspectorTab === tab ? 'active' : ''} onClick={() => setInspectorTab(tab)}>{label}</button>
          ))}
        </nav>}
        {selected && selectedElements.length > 1 && !rightCollapsed ? (
          <div className="multi-selection-inspector">
            <Layers3 />
            <strong>{selectedElements.length} layers selected</strong>
            <span>Use Shift-click or drag on empty canvas to adjust the selection. Align and distribute from the canvas toolbar.</span>
            <button onClick={copySelected}><Copy /> Copy selection</button>
          </div>
        ) : selected && !rightCollapsed ? (
          <>
            {inspectorTab === 'design' && <section className="inspector-section">
              <button className="inspector-heading" onClick={() => toggleSection('transform')} aria-expanded={!!openSections.transform}><span>Transform</span><ChevronDown className={openSections.transform ? '' : 'closed'} /></button>
              {openSections.transform && <>
                <div className="field-grid">
                  <label>X<input aria-label="X position" type="number" value={Math.round(selected.x)} onChange={event => updateSelected({ x: Number(event.target.value) })} /></label>
                  <label>Y<input aria-label="Y position" type="number" value={Math.round(selected.y)} onChange={event => updateSelected({ y: Number(event.target.value) })} /></label>
                  <label>W<input aria-label="Width" type="number" min="1" value={Math.round(selected.width)} onChange={event => updateSelected({ width: Math.max(1, Number(event.target.value)) })} /></label>
                  <label>H<input aria-label="Height" type="number" min="1" value={Math.round(selected.height)} onChange={event => updateSelected({ height: Math.max(1, Number(event.target.value)) })} /></label>
                </div>
                <label className="range-row">Rotation<input aria-label="Rotation" type="range" min="-180" max="180" value={selected.rotation || 0} onChange={event => updateSelected({ rotation: Number(event.target.value) })} /><span>{selected.rotation || 0}°</span></label>
                <div className="rotation-actions"><button title="Rotate counter-clockwise" onClick={() => updateSelected({ rotation: (selected.rotation || 0) - 15 })}><RotateCw className="flip-icon" /> -15°</button><button title="Rotate clockwise" onClick={() => updateSelected({ rotation: (selected.rotation || 0) + 15 })}><RotateCw /> +15°</button></div>
              </>}
            </section>}
            {inspectorTab === 'design' && <section className="inspector-section">
              <button className="inspector-heading" onClick={() => toggleSection('layout')} aria-expanded={!!openSections.layout}><span>Layout</span><ChevronDown className={openSections.layout ? '' : 'closed'} /></button>
              {openSections.layout && <>
                <label className="stacked">Name<input value={selected.name} onChange={event => updateSelected({ name: event.target.value })} /></label>
                {(selected.type === 'frame' || selected.type === 'group') && <>
                  <label className="stacked">Auto Layout<select aria-label="Auto Layout direction" value={selected.autoLayout || 'none'} onChange={event => {
                    const value = event.target.value
                    if (value === 'none' || value === 'vertical' || value === 'horizontal') {
                      updateAutoLayout({ autoLayout: value })
                    }
                  }}><option value="none">Off · free positioning</option><option value="vertical">Vertical flow</option><option value="horizontal">Horizontal flow</option></select></label>
                  {selected.autoLayout && selected.autoLayout !== 'none' && <>
                    <div className="field-grid compact-grid">
                      <label>Gap<input aria-label="Auto Layout gap" type="number" min="0" max="256" value={selected.layoutGap ?? 12} onChange={event => updateAutoLayout({ layoutGap: Math.max(0, Math.min(256, Number(event.target.value) || 0)) })} /></label>
                      <label>Padding<input aria-label="Auto Layout padding" type="number" min="0" max="512" value={selected.layoutPadding ?? 16} onChange={event => updateAutoLayout({ layoutPadding: Math.max(0, Math.min(512, Number(event.target.value) || 0)) })} /></label>
                    </div>
                    <label className="stacked">Alignment<select aria-label="Auto Layout alignment" value={selected.layoutAlign || 'start'} onChange={event => {
                      const value = event.target.value
                      if (value === 'start' || value === 'center' || value === 'end' || value === 'stretch') {
                        updateAutoLayout({ layoutAlign: value })
                      }
                    }}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="stretch">Stretch</option></select></label>
                    <span className="advanced-note">Children flow by canvas position. Drag a child along the flow axis to reorder it.</span>
                  </>}
                </>}
                {(selected.type !== 'image' && selected.type !== 'frame' && selected.type !== 'group' && selected.type !== 'shape') && <label className="stacked">Text<textarea value={selected.text} onChange={event => updateSelected({ text: event.target.value })} /></label>}
                <label className="stacked">Navigate to page<select aria-label="Navigate to page" value={selected.linkToPage || ''} onChange={event => updateSelected({ linkToPage: event.target.value || undefined, linkToElementId: undefined })}>
                  <option value="">No page link</option>
                  {pages.filter(page => page !== activePage).map(page => <option key={page} value={page}>{page}</option>)}
                </select></label>
                {selected.type !== 'frame' && <label className="stacked">Navigate to frame<select aria-label="Navigate to frame" value={selected.linkToElementId || ''} onChange={event => updateSelected({ linkToElementId: event.target.value || undefined, linkToPage: undefined })}>
                  <option value="">No frame link</option>
                  {elements.filter(item => item.type === 'frame' && !item.parentId && item.id !== selected.id).map(frame => <option key={frame.id} value={frame.id}>{frame.name}</option>)}
                </select></label>}
                {selected.type === 'frame' && !selected.parentId && <>
                  <label className="stacked">Frame preset<select aria-label="Frame preset" value={
                    selected.width === PHONE_PREVIEW_WIDTH && selected.height === PHONE_PREVIEW_HEIGHT ? 'phone'
                      : selected.width === 768 && selected.height === 1024 ? 'tablet'
                        : selected.width === 1440 && selected.height === 900 ? 'desktop' : 'custom'
                  } onChange={event => {
                    if (event.target.value === 'phone') updateSelected({ width: PHONE_PREVIEW_WIDTH, height: PHONE_PREVIEW_HEIGHT })
                    if (event.target.value === 'tablet') updateSelected({ width: 768, height: 1024 })
                    if (event.target.value === 'desktop') updateSelected({ width: 1440, height: 900 })
                  }}><option value="custom">Custom</option><option value="phone">Phone · 402 × 874</option><option value="tablet">Tablet · 768 × 1024</option><option value="desktop">Desktop · 1440 × 900</option></select></label>
                  <button className={`shadow-mode ${selected.flowStartingPoint ? 'active' : ''}`} aria-pressed={!!selected.flowStartingPoint} onClick={setFlowStartingPoint}>{selected.flowStartingPoint ? 'Page starting point' : 'Set as page start'}</button>
                </>}
                <div className="toggles">
                  <button className={selected.locked ? 'active' : ''} onClick={() => updateSelected({ locked: !selected.locked })}>{selected.locked ? 'Locked' : 'Lock layer'}</button>
                  <button className={selected.hidden ? 'active' : ''} onClick={() => updateSelected({ hidden: !selected.hidden })}>{selected.hidden ? 'Hidden' : 'Hide layer'}</button>
                </div>
              </>}
            </section>}
            {inspectorTab === 'styles' && <section className="inspector-section">
              <button className="inspector-heading" onClick={() => toggleSection('typography')} aria-expanded={!!openSections.typography}><span>Typography</span><ChevronDown className={openSections.typography ? '' : 'closed'} /></button>
              {openSections.typography && <>
                <div className="font-size-control">
                  <label htmlFor="font-size">Size</label>
                  <button aria-label="Decrease font size" title="Decrease font size" onClick={() => updateSelected({ fontSize: Math.max(1, selected.fontSize - 1) })}><Minus /></button>
                  <input
                    id="font-size"
                    type="number"
                    min="1"
                    max="500"
                    value={fontSizeDraft?.id === selected.id ? fontSizeDraft.value : selected.fontSize}
                    onFocus={() => setFontSizeDraft({ id: selected.id, value: String(selected.fontSize) })}
                    onChange={event => setFontSizeDraft({ id: selected.id, value: event.target.value })}
                    onBlur={() => {
                      if (fontSizeDraft?.id !== selected.id) return
                      const parsed = Number(fontSizeDraft.value)
                      if (Number.isFinite(parsed)) updateSelected({ fontSize: Math.max(1, Math.min(500, parsed)) })
                      setFontSizeDraft(null)
                    }}
                    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
                  />
                  <button aria-label="Increase font size" title="Increase font size" onClick={() => updateSelected({ fontSize: Math.min(500, selected.fontSize + 1) })}><Plus /></button>
                </div>
                <label className="stacked">Family<input list="font-families" value={selected.fontFamily || 'Inter'} onChange={event => updateSelected({ fontFamily: event.target.value })} /><datalist id="font-families">
                  {['Inter', 'Arial', 'Arial Black', 'Arial Narrow', 'Aptos', 'Calibri', 'Cambria', 'Candara', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Garamond', 'Helvetica', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Menlo', 'Monaco', 'Palatino Linotype', 'Roboto', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'system-ui', 'serif', 'sans-serif', 'monospace'].map(font => <option key={font} value={font} />)}
                </datalist></label>
                <button className="font-upload" onClick={() => fontInput.current?.click()}><Upload /> Load custom font</button>
                <label className="stacked">Weight<select value={selected.fontWeight || 400} onChange={event => updateSelected({ fontWeight: Number(event.target.value) })}>
                  <option value="100">Thin · 100</option><option value="200">Extra Light · 200</option><option value="300">Light · 300</option><option value="400">Regular · 400</option><option value="500">Medium · 500</option><option value="600">Semi Bold · 600</option><option value="700">Bold · 700</option><option value="800">Extra Bold · 800</option><option value="900">Black · 900</option>
                </select></label>
                <div className="formatting-row" role="group" aria-label="Text formatting">
                  <button className={selected.fontWeight && selected.fontWeight >= 700 ? 'active' : ''} title="Bold" aria-label="Bold" onClick={() => updateSelected({ fontWeight: selected.fontWeight && selected.fontWeight >= 700 ? 400 : 700 })}><Bold /></button>
                  <button className={selected.fontStyle === 'italic' ? 'active' : ''} title="Italic" aria-label="Italic" onClick={() => updateSelected({ fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic /></button>
                  <button className={selected.textDecoration === 'underline' ? 'active' : ''} title="Underline" aria-label="Underline" onClick={() => updateSelected({ textDecoration: selected.textDecoration === 'underline' ? 'none' : 'underline' })}><Underline /></button>
                  <button className={selected.textDecoration === 'line-through' ? 'active' : ''} title="Strikethrough" aria-label="Strikethrough" onClick={() => updateSelected({ textDecoration: selected.textDecoration === 'line-through' ? 'none' : 'line-through' })}><Strikethrough /></button>
                  <button className={selected.textTransform === 'uppercase' ? 'active' : ''} title="Uppercase" aria-label="Uppercase" onClick={() => updateSelected({ textTransform: selected.textTransform === 'uppercase' ? 'none' : 'uppercase' })}><CaseSensitive /></button>
                </div>
                <div className="formatting-row alignment-row" role="group" aria-label="Text alignment">
                  <button className={(selected.textAlign || 'left') === 'left' ? 'active' : ''} title="Align left" aria-label="Align left" onClick={() => updateSelected({ textAlign: 'left' })}><AlignLeft /></button>
                  <button className={selected.textAlign === 'center' ? 'active' : ''} title="Align center" aria-label="Align center" onClick={() => updateSelected({ textAlign: 'center' })}><AlignCenter /></button>
                  <button className={selected.textAlign === 'right' ? 'active' : ''} title="Align right" aria-label="Align right" onClick={() => updateSelected({ textAlign: 'right' })}><AlignRight /></button>
                  <button className={selected.textAlign === 'justify' ? 'active' : ''} title="Justify" aria-label="Justify" onClick={() => updateSelected({ textAlign: 'justify' })}><AlignJustify /></button>
                </div>
                <label className="stacked">Case<select value={selected.textTransform || 'none'} onChange={event => updateSelected({ textTransform: event.target.value as CanvasElement['textTransform'] })}><option value="none">Original</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option><option value="capitalize">Capitalize</option></select></label>
                <div className="field-grid compact-grid">
                  <label>Line<input aria-label="Line height" type="number" min="0.5" max="5" step="0.1" value={selected.lineHeight || 1.2} onChange={event => updateSelected({ lineHeight: Number(event.target.value) })} /></label>
                  <label>Letter<input aria-label="Letter spacing" type="number" step="0.5" value={selected.letterSpacing || 0} onChange={event => updateSelected({ letterSpacing: Number(event.target.value) })} /></label>
                  <label>Word<input aria-label="Word spacing" type="number" step="0.5" value={selected.wordSpacing || 0} onChange={event => updateSelected({ wordSpacing: Number(event.target.value) })} /></label>
                </div>
              </>}
            </section>}
            {inspectorTab === 'styles' && <section className="inspector-section">
              <button className="inspector-heading" onClick={() => toggleSection('appearance')} aria-expanded={!!openSections.appearance}><span>Appearance</span><ChevronDown className={openSections.appearance ? '' : 'closed'} /></button>
              {openSections.appearance && <>
                <div className="color-row">
                  <label>Fill<input aria-label="Fill color" type="color" value={selected.background === 'transparent' ? '#ffffff' : selected.background} onChange={event => updateSelected({ background: event.target.value })} /></label>
                  <label>Text<input aria-label="Text color" type="color" value={selected.color} onChange={event => updateSelected({ color: event.target.value })} /></label>
                </div>
                <label className="range-row">Radius<input aria-label="Corner radius" type="range" min="0" max="80" value={selected.radius} onChange={event => updateSelected({ radius: Number(event.target.value) })} /><span>{selected.radius}</span></label>
                <label className="range-row">Opacity<input aria-label="Opacity" type="range" min="0" max="1" step="0.01" value={selected.opacity} onChange={event => updateSelected({ opacity: Number(event.target.value) })} /><span>{Math.round(selected.opacity * 100)}%</span></label>
                {selected.type === 'image' && <>
                  <button className="font-upload" onClick={() => openImagePicker(selected.id)}><Crop /> Replace image</button>
                  <button className="font-upload danger-action" onClick={deleteSelected}><Trash2 /> Delete image</button>
                </>}
                {selected.type === 'shape' && (selected.shapeKind === 'circle' || selected.shapeKind === 'rectangle') && <>
                  <button className="font-upload" onClick={() => openImagePicker(selected.id)}><Crop /> {selected.src ? 'Replace image' : 'Choose image'}</button>
                  {selected.src && <button className="font-upload danger-action" onClick={() => updateSelected({ src: undefined, mimeType: undefined })}><Trash2 /> Remove image</button>}
                </>}
              </>}
            </section>}
            {inspectorTab === 'advanced' && <section className="inspector-section">
              <button className="inspector-heading" onClick={() => toggleSection('spacing')} aria-expanded={!!openSections.spacing}><span>Spacing</span><ChevronDown className={openSections.spacing ? '' : 'closed'} /></button>
              {openSections.spacing && <label className="range-row">Padding<input aria-label="Padding" type="range" min="0" max="64" value={selected.padding || 0} onChange={event => updateSelected({ padding: Number(event.target.value) })} /><span>{selected.padding || 0}</span></label>}
            </section>}
            {inspectorTab === 'advanced' && <section className="inspector-section">
              <button className="inspector-heading" onClick={() => toggleSection('effects')} aria-expanded={!!openSections.effects}><span>Effects</span><ChevronDown className={openSections.effects ? '' : 'closed'} /></button>
              {openSections.effects && <>
                <label className="range-row">Blur<input aria-label="Shadow blur" type="range" min="0" max="64" value={selected.shadow || 0} onChange={event => updateSelected({ shadow: Number(event.target.value) })} /><span>{selected.shadow || 0}</span></label>
                <label className="range-row">Distance<input aria-label="Shadow distance" type="range" min="0" max="48" value={selected.shadowDistance ?? 8} onChange={event => updateSelected({ shadowDistance: Number(event.target.value) })} /><span>{selected.shadowDistance ?? 8}</span></label>
                <label className="range-row">Angle<input aria-label="Shadow angle" type="range" min="0" max="360" value={selected.shadowAngle ?? 90} onChange={event => updateSelected({ shadowAngle: Number(event.target.value) })} /><span>{selected.shadowAngle ?? 90}°</span></label>
                <label className="stacked">Shadow color<input aria-label="Shadow color" type="color" value={selected.shadowColor || '#000000'} onChange={event => updateSelected({ shadowColor: event.target.value })} /></label>
                <button className={`shadow-mode ${selected.shadowInset ? 'active' : ''}`} aria-pressed={!!selected.shadowInset} onClick={() => updateSelected({ shadowInset: !selected.shadowInset })}>Inner shadow</button>
              </>}
            </section>}
            {inspectorTab === 'advanced' && <section className="inspector-section">
              <button className="inspector-heading" onClick={() => toggleSection('advanced')} aria-expanded={!!openSections.advanced}><span>Advanced</span><ChevronDown className={openSections.advanced ? '' : 'closed'} /></button>
              {openSections.advanced && (selected.type === 'image' || selected.type === 'shape' && !!selected.src ? <>
                <label className="stacked">Image fit<select value={selected.imageFit || 'contain'} onChange={event => updateSelected({ imageFit: event.target.value as CanvasElement['imageFit'] })}><option value="contain">Fit · contain</option><option value="cover">Crop · cover</option><option value="fill">Stretch · fill</option></select></label>
                <label className="range-row">Position X<input aria-label="Image horizontal position" type="range" min="0" max="100" value={selected.objectPositionX ?? 50} onChange={event => updateSelected({ objectPositionX: Number(event.target.value) })} /><span>{selected.objectPositionX ?? 50}%</span></label>
                <label className="range-row">Position Y<input aria-label="Image vertical position" type="range" min="0" max="100" value={selected.objectPositionY ?? 50} onChange={event => updateSelected({ objectPositionY: Number(event.target.value) })} /><span>{selected.objectPositionY ?? 50}%</span></label>
              </> : <span className="advanced-note">No additional settings for this layer.</span>)}
            </section>}
          </>
        ) : !rightCollapsed ? <div className="empty-inspector"><Settings2 /><span>Select a layer to edit it</span></div> : null}
      </aside>

      {toast && <div className="clipboard-toast" role="status">{toast}</div>}

      {pageToDelete && (
        <div className="confirm-overlay" onPointerDown={() => setPageToDelete(null)}>
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-page-title"
            aria-describedby="delete-page-description"
            onPointerDown={event => event.stopPropagation()}
          >
            <div className="confirm-icon"><Trash2 /></div>
            <h2 id="delete-page-title">Delete “{pageToDelete}”?</h2>
            <p id="delete-page-description">This page will be removed. Its elements stay in the project, and links targeting it are cleared.</p>
            <div className="confirm-actions">
              <button ref={cancelDeletePageButton} onClick={() => setPageToDelete(null)}>Cancel</button>
              <button className="confirm-danger" onClick={() => deletePage(pageToDelete)}>Delete page</button>
            </div>
          </section>
        </div>
      )}

      {preview && (
        <div className="preview-modal" onPointerDown={() => setPreview(false)}>
          <div className={`preview-window ${previewDevice === 'none' ? 'desktop-preview' : 'with-device'}`} onPointerDown={event => event.stopPropagation()}>
            <div className="preview-head">
              <div className="preview-title">
                <span className="preview-live-indicator" />
                <div><strong>Website preview</strong><span>{previewFrame?.name || previewPage}</span></div>
              </div>
              <div className="preview-controls">
                {pages.length > 1 && <label className="preview-page-picker">Page<select aria-label="Preview page" value={previewPage} onChange={event => navigatePreviewToPage(event.target.value)}>
                  {pages.map(page => <option key={page} value={page}>{page}</option>)}
                </select></label>}
                {previewWarnings.length > 0 && <span className="preview-warning" role="status" title={previewWarnings.join('\n')}>{previewWarnings.length} warnings</span>}
                <span className="preview-size">{previewDevice === 'none'
                  ? `${canvasWidth()} × ${device === 'phone' ? PHONE_PREVIEW_HEIGHT : 600}`
                  : `${PHONE_PREVIEW_WIDTH} × ${PHONE_PREVIEW_HEIGHT}`}</span>
                <label className="preview-device-picker"><Globe /><select aria-label="Preview device" value={previewDevice} onChange={event => setPreviewDevice(event.target.value as typeof previewDevice)}>
                  <option value="iphone">iPhone 17 Pro</option><option value="galaxy">Samsung Galaxy S25</option><option value="pixel">Google Pixel 10</option><option value="none">Responsive canvas</option>
                </select></label>
                <button className="preview-close" aria-label="Close preview" title="Close preview" onClick={() => setPreview(false)}><X /></button>
              </div>
            </div>
            <div className="preview-browser-bar"><Globe /><span>Previewing <strong>{projectName}</strong><span className="preview-breadcrumb"> / {previewPage}</span></span></div>
            <div ref={previewStageRef} className={`preview-stage ${previewDevice === 'none' ? 'desktop-stage' : ''}`}>
              {previewBuilding ? <div className="preview-loading" role="status">Preparing your website preview…</div>
                : !previewHtml ? <div className="preview-loading" role="status">No preview document is available.</div>
                  : previewDevice === 'none' ? (
                <iframe
                  ref={previewIframeRef}
                  className="export-preview responsive-export-preview"
                  title={`Website preview · ${previewPage}`}
                  srcDoc={previewHtml}
                  sandbox="allow-forms allow-scripts"
                  style={{ width: canvasWidth(), height: device === 'phone' ? PHONE_PREVIEW_HEIGHT : 600 }}
                />
              ) : (
                <div className="phone-preview-fit" style={{ width: 430 * phonePreviewScale, height: 934 * phonePreviewScale }}>
                  <div
                    className={`phone-shell ${previewDevice}`}
                    style={{ transform: `scale(${phonePreviewScale})` }}
                    aria-label={`Preview in ${previewDevice === 'iphone' ? 'iPhone 17 Pro' : previewDevice === 'galaxy' ? 'Samsung Galaxy S25' : 'Google Pixel 10'} · ${PHONE_PREVIEW_WIDTH} × ${PHONE_PREVIEW_HEIGHT}`}
                  >
                    <div className="phone-status"><span>9:41</span><span className="phone-status-icons">● ▰</span></div>
                    <div className="phone-screen">
                      <iframe
                        ref={previewIframeRef}
                        className="export-preview"
                        title={`Website preview · ${previewPage}`}
                        srcDoc={previewHtml}
                        sandbox="allow-forms allow-scripts"
                        width={PHONE_PREVIEW_WIDTH}
                        height={PHONE_PREVIEW_HEIGHT}
                      />
                    </div>
                    <div className="phone-home-indicator" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App

import JSZip from 'jszip'
import type { CanvasElement } from './types.ts'
import { getStudioIcon, renderStudioIconSvg } from './iconCatalog.ts'

export interface WebProject {
  projectName: string
  pages: string[]
  activePage: string
  pageElements: Record<string, CanvasElement[]>
}

export interface WebExportResult {
  archive: Blob
  previewDocuments: Record<string, string>
  warnings: string[]
}

export interface WebExportValidation {
  errors: string[]
  warnings: string[]
}

interface ExportAsset {
  path: string
  source: string
  mimeType: string
  bytes: Uint8Array
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'font/otf': 'otf',
  'font/ttf': 'ttf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'application/font-woff': 'woff',
  'application/vnd.ms-fontobject': 'eot',
  'application/x-font-otf': 'otf',
  'application/x-font-ttf': 'ttf',
  'application/x-font-woff': 'woff',
}

export function validateWebProject(project: WebProject): WebExportValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const projectPages = new Set(project.pages)

  if (!project.pages.length) errors.push('El proyecto debe tener al menos una página.')
  if (projectPages.size !== project.pages.length) errors.push('Hay nombres de página duplicados.')
  if (!projectPages.has(project.activePage)) errors.push('La página activa no pertenece a este proyecto.')

  for (const page of project.pages) {
    const items = project.pageElements[page] || []
    const elementsById = new Map<string, CanvasElement>()

    for (const item of items) {
      if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.text !== 'string') {
        errors.push(`Hay un elemento con texto o identificador no válido en "${page}".`)
        continue
      }
      if (!item.id.trim()) errors.push(`Hay un elemento sin identificador en "${page}".`)
      else if (elementsById.has(item.id)) errors.push(`El identificador "${item.id}" está duplicado en "${page}".`)
      else elementsById.set(item.id, item)

      const numericFields = [
        ['X', item.x], ['Y', item.y], ['ancho', item.width], ['alto', item.height],
        ['radio', item.radius], ['opacidad', item.opacity], ['tamaño de texto', item.fontSize],
        ['peso de texto', item.fontWeight], ['interlineado', item.lineHeight],
        ['espaciado entre letras', item.letterSpacing], ['espaciado entre palabras', item.wordSpacing],
        ['rotación', item.rotation], ['posición horizontal de imagen', item.objectPositionX],
        ['posición vertical de imagen', item.objectPositionY], ['sombra', item.shadow],
        ['ángulo de sombra', item.shadowAngle], ['distancia de sombra', item.shadowDistance],
        ['relleno', item.padding], ['espaciado de layout', item.layoutGap],
        ['relleno de layout', item.layoutPadding],
        ['grosor de icono', item.iconStrokeWidth],
      ] as const
      for (const [label, value] of numericFields) {
        if (value === undefined) continue
        if (!Number.isFinite(value)) errors.push(`El valor ${label} de "${item.name}" no es válido en "${page}".`)
      }

      if (item.width < 0 || item.height < 0) errors.push(`"${item.name}" tiene dimensiones negativas en "${page}".`)
      if (item.opacity < 0 || item.opacity > 1) errors.push(`La opacidad de "${item.name}" debe estar entre 0 y 1.`)
      if (typeof item.background !== 'string' || typeof item.color !== 'string'
        || !isSafeCssValue(item.background) || !isSafeCssValue(item.color)) {
        errors.push(`El color de "${item.name}" contiene valores no compatibles con la exportación.`)
      }
      if (item.shadowColor && (typeof item.shadowColor !== 'string' || !isSafeCssValue(item.shadowColor))) {
        errors.push(`El color de sombra de "${item.name}" no es válido.`)
      }
      if (item.fontStyle && !['normal', 'italic'].includes(item.fontStyle)) errors.push(`El estilo de texto de "${item.name}" no es válido.`)
      if (item.textAlign && !['left', 'center', 'right', 'justify'].includes(item.textAlign)) errors.push(`La alineación de "${item.name}" no es válida.`)
      if (item.textDecoration && !['none', 'underline', 'line-through'].includes(item.textDecoration)) errors.push(`La decoración de "${item.name}" no es válida.`)
      if (item.textTransform && !['none', 'uppercase', 'lowercase', 'capitalize'].includes(item.textTransform)) errors.push(`La transformación de "${item.name}" no es válida.`)
      if (item.imageFit && !['contain', 'cover', 'fill'].includes(item.imageFit)) errors.push(`El ajuste de imagen de "${item.name}" no es válido.`)
      if (item.shapeKind && !['circle', 'rectangle', 'line'].includes(item.shapeKind)) errors.push(`La forma de "${item.name}" no es válida.`)
      if (item.type === 'icon' && !getStudioIcon(item.iconName)) errors.push(`El icono de "${item.name}" no existe en la biblioteca.`)
      if (item.type === 'icon' && item.iconStrokeWidth !== undefined && (item.iconStrokeWidth < 1 || item.iconStrokeWidth > 4)) {
        errors.push(`El grosor del icono de "${item.name}" debe estar entre 1 y 4.`)
      }
      if (item.autoLayout && !['none', 'vertical', 'horizontal'].includes(item.autoLayout)) errors.push(`El layout de "${item.name}" no es válido.`)
      if (item.layoutAlign && !['start', 'center', 'end', 'stretch'].includes(item.layoutAlign)) errors.push(`La alineación de layout de "${item.name}" no es válida.`)
      if (item.linkToPage && !projectPages.has(item.linkToPage)) {
        errors.push(`"${item.name}" enlaza a la página inexistente "${item.linkToPage}".`)
      }
      if (item.src && (typeof item.src !== 'string' || !isSupportedAssetSource(item.src, false))) {
        errors.push(`El recurso de imagen de "${item.name}" no se puede exportar.`)
      }
      if (typeof item.src === 'string' && item.src && !item.src.startsWith('data:')) {
        warnings.push(`La imagen de "${item.name}" usa una URL externa y requiere conexión a internet.`)
      }
      if (item.fontSource && (typeof item.fontSource !== 'string' || !isSupportedAssetSource(item.fontSource, true))) {
        errors.push(`La fuente de "${item.name}" no se puede exportar.`)
      }
      if (item.type === 'image' && !item.src) warnings.push(`"${item.name}" no tiene una imagen asignada.`)
      if (item.type === 'button' && !item.linkToPage && !item.linkToElementId) {
        warnings.push(`"${item.name}" es solo visual: asigna un enlace a página o frame para darle navegación.`)
      }
      if (item.type === 'input') {
        warnings.push(`"${item.name}" se exporta como campo editable; el envío de formularios aún no está configurado.`)
      }
    }

    for (const item of items) {
      if (item.parentId) {
        const parent = elementsById.get(item.parentId)
        if (!parent || (parent.type !== 'frame' && parent.type !== 'group')) {
          errors.push(`El contenedor de "${item.name}" no existe en "${page}".`)
        }
      }
      if (item.linkToElementId) {
        const target = elementsById.get(item.linkToElementId)
        if (!target || target.type !== 'frame' || !!target.parentId) {
          errors.push(`"${item.name}" enlaza a un frame inexistente en "${page}".`)
        }
      }

      const visited = new Set<string>([item.id])
      let parentId = item.parentId
      while (parentId) {
        if (visited.has(parentId)) {
          errors.push(`Se detectó un ciclo de contenedores en "${page}".`)
          break
        }
        visited.add(parentId)
        parentId = elementsById.get(parentId)?.parentId
      }
    }

    if (!items.some(item => !item.hidden)) warnings.push(`La página "${page}" no contiene elementos visibles.`)
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

function isSafeCssValue(value: string) {
  return typeof value === 'string' && value.trim().length > 0 && !/[<>"'\\;{}]/.test(value)
}

function isSupportedAssetSource(source: string, font: boolean) {
  if (source.startsWith('data:')) {
    try {
      parseDataUrl(source, font)
      return true
    } catch {
      return false
    }
  }
  if (font) return false
  try {
    return ['http:', 'https:'].includes(new URL(source).protocol)
  } catch {
    return false
  }
}

function parseDataUrl(source: string, font: boolean) {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/i.exec(source)
  if (!match) throw new Error('El recurso no es un Data URL válido.')
  const mimeType = match[1].toLowerCase()
  const extension = MIME_EXTENSIONS[mimeType]
  if (!extension || (font ? !extension.match(/^(?:eot|otf|ttf|woff2?)$/) : !mimeType.startsWith('image/'))) {
    throw new Error(`El formato "${mimeType}" no es compatible.`)
  }
  if (match[2]) {
    const binary = atob(match[3])
    return { mimeType, extension, bytes: Uint8Array.from(binary, character => character.charCodeAt(0)) }
  }
  return { mimeType, extension, bytes: new TextEncoder().encode(decodeURIComponent(match[3])) }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character)
}

function escapeAttribute(value: string) {
  return escapeHtml(value)
}

function safeFontFamily(value?: string) {
  return (value || 'Inter').replace(/["'\\;{}<>]/g, '').trim() || 'Inter'
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
}

function elementShadow(item: CanvasElement) {
  const blur = Math.max(0, item.shadow || 0)
  if (!blur) return 'none'
  const distance = Math.max(0, item.shadowDistance ?? 8)
  const angle = (item.shadowAngle ?? 90) * Math.PI / 180
  const x = Math.round(Math.cos(angle) * distance * 100) / 100
  const y = Math.round(Math.sin(angle) * distance * 100) / 100
  return `${item.shadowInset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${item.shadowColor || '#000000'}`
}

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function createPageFiles(pages: string[]) {
  const files = new Map<string, string>()
  const used = new Set<string>()
  for (const [index, page] of pages.entries()) {
    const base = slugify(page) || `page-${index + 1}`
    let slug = index === 0 ? 'index' : base === 'index' ? 'page-index' : base
    let suffix = 2
    while (used.has(slug)) {
      slug = `${base}-${suffix}`
      suffix += 1
    }
    used.add(slug)
    files.set(page, `${slug}.html`)
  }
  return files
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

export async function buildWebExport(project: WebProject): Promise<WebExportResult> {
  const validation = validateWebProject(project)
  if (validation.errors.length) throw new Error(`No se puede exportar el proyecto:\n${validation.errors.join('\n')}`)

  const iconSvgById = new Map<string, string>()
  const iconElements = Object.values(project.pageElements).flat().filter(item => item.type === 'icon')
  if (iconElements.length) {
    await Promise.all(iconElements.map(async item => {
      iconSvgById.set(item.id, await renderStudioIconSvg(item.iconName, item.color, item.width, item.height, item.iconStrokeWidth))
    }))
  }

  const pageFiles = createPageFiles(project.pages)
  const assets = new Map<string, ExportAsset>()
  const assetPathBySource = new Map<string, string>()
  let assetIndex = 0

  const getAssetPath = (source: string, font = false) => {
    if (!source.startsWith('data:')) return source
    const existing = assetPathBySource.get(source)
    if (existing) return existing
    const parsed = parseDataUrl(source, font)
    assetIndex += 1
    const path = `assets/${font ? 'font' : 'image'}-${assetIndex}.${parsed.extension}`
    assets.set(path, { path, source, mimeType: parsed.mimeType, bytes: parsed.bytes })
    assetPathBySource.set(source, path)
    return path
  }

  const fontFaces = new Map<string, string>()
  for (const items of Object.values(project.pageElements)) {
    for (const item of items) {
      if (item.src) getAssetPath(item.src)
      if (item.fontSource && item.fontFamily) {
        const path = getAssetPath(item.fontSource, true)
        fontFaces.set(`${safeFontFamily(item.fontFamily)}|${path}`, `@font-face{font-family:"${safeFontFamily(item.fontFamily)}";src:url("${path}");font-display:swap}`)
      }
    }
  }

  const css = generateCss([...fontFaces.values()])
  const script = generateScript()
  const zip = new JSZip()
  const previewDocuments: Record<string, string> = {}
  const exportedPages: Record<string, CanvasElement[]> = {}

  const renderElement = (
    item: CanvasElement,
    page: string,
    pageItems: CanvasElement[],
    depth = 0,
  ): string => {
    if (depth > 100) throw new Error(`La jerarquía de elementos de "${page}" supera el límite permitido.`)
    const imagePath = item.src ? getAssetPath(item.src) : null
    const fontPath = item.fontSource ? getAssetPath(item.fontSource, true) : null
    const styles = [
      `left:${formatNumber(item.x)}px`,
      `top:${formatNumber(item.y)}px`,
      `width:${formatNumber(item.width)}px`,
      `height:${formatNumber(item.height)}px`,
      `background:${item.background}`,
      `color:${item.color}`,
      `border-radius:${formatNumber(item.radius)}px`,
      `opacity:${formatNumber(item.opacity)}`,
      `font-size:${formatNumber(item.fontSize)}px`,
      `font-family:"${safeFontFamily(item.fontFamily)}"`,
      `font-weight:${item.fontWeight || 400}`,
      `font-style:${item.fontStyle || 'normal'}`,
      `text-align:${item.textAlign || 'left'}`,
      `line-height:${item.lineHeight || 1.2}`,
      `letter-spacing:${item.letterSpacing || 0}px`,
      `word-spacing:${item.wordSpacing || 0}px`,
      `text-decoration:${item.textDecoration || 'none'}`,
      `text-transform:${item.textTransform || 'none'}`,
      `transform:rotate(${item.rotation || 0}deg)`,
      `object-fit:${item.imageFit || 'contain'}`,
      `object-position:${item.objectPositionX ?? 50}% ${item.objectPositionY ?? 50}%`,
      `padding:${item.padding || 0}px`,
      `box-shadow:${elementShadow(item)}`,
      ...(fontPath ? [`--custom-font-source:url("${fontPath}")`] : []),
    ].join(';')

    let content = ''
    if (item.type === 'image') {
      content = imagePath
        ? `<img src="${escapeAttribute(imagePath)}" alt="${escapeAttribute(item.name)}" />`
        : `<span class="image-placeholder" role="img" aria-label="${escapeAttribute(item.name)}"></span>`
    } else if (item.type === 'icon') {
      content = iconSvgById.get(item.id) || ''
    } else if (item.type === 'input') {
      return `<input id="${escapeAttribute(item.id)}" class="node input" type="text" name="${escapeAttribute(item.id)}" placeholder="${escapeAttribute(item.text)}" aria-label="${escapeAttribute(item.name)}" style="${escapeAttribute(styles)}" />`
    } else if (item.type === 'button') {
      content = escapeHtml(item.text)
    } else if (item.type === 'frame' || item.type === 'group') {
      content = pageItems.filter(child => child.parentId === item.id && !child.hidden)
        .map(child => renderElement(child, page, pageItems, depth + 1)).join('')
    } else if (item.type === 'shape') {
      content = `<span class="shape-content ${escapeAttribute(item.shapeKind || 'circle')}">${imagePath ? `<img class="shape-image" src="${escapeAttribute(imagePath)}" alt="${escapeAttribute(item.name)}" style="object-fit:${item.imageFit || 'cover'};object-position:${item.objectPositionX ?? 50}% ${item.objectPositionY ?? 50}%" />` : ''}</span>`
    } else {
      content = `<span class="node-text">${escapeHtml(item.text)}</span>`
    }

    const linkedFrame = item.linkToElementId
      ? pageItems.find(target => target.id === item.linkToElementId && target.type === 'frame' && !target.parentId)
      : null
    const targetPage = item.linkToPage && pageFiles.has(item.linkToPage) ? item.linkToPage : null
    const href = targetPage
      ? `${pageFiles.get(targetPage)}${getPageStartFrame(project.pageElements[targetPage] || []) ? `#screen-${encodeURIComponent(getPageStartFrame(project.pageElements[targetPage] || [])!.id)}` : ''}`
      : linkedFrame ? `#screen-${encodeURIComponent(linkedFrame.id)}` : null
    const attributes = [
      `id="${escapeAttribute(item.id)}"`,
      `class="node ${escapeAttribute(item.type)} ${escapeAttribute(item.shapeKind || '')}"`,
      `style="${escapeAttribute(styles)}"`,
      ...(href ? [`href="${escapeAttribute(href)}"`] : []),
      ...(targetPage ? [`data-page-target="${escapeAttribute(targetPage)}"`] : []),
      ...(href && item.type === 'button' ? [`aria-label="${escapeAttribute(item.name)}"`] : []),
    ].join(' ')
    const tag = href ? 'a' : 'div'
    return `<${tag} ${attributes}>${content}</${tag}>`
  }

  for (const page of project.pages) {
    const items = project.pageElements[page] || []
    const visibleItems = items.filter(item => !item.hidden)
    const frames = visibleItems.filter(item => item.type === 'frame' && !item.parentId)
    let body: string

    if (frames.length) {
      const shared = visibleItems.filter(item => !item.parentId && item.type !== 'frame')
        .map(item => renderElement(item, page, items)).join('')
      const screens = frames.map(frame => {
        const startFrame = getPageStartFrame(items)
        const isStartingPoint = frame.id === startFrame?.id
        const children = items.filter(item => item.parentId === frame.id && !item.hidden)
          .map(item => renderElement(item, page, items, 1)).join('')
        const screenId = `screen-${frame.id}`
        const screen = `<section id="${escapeAttribute(screenId)}" class="frame-screen${isStartingPoint ? ' active' : ''}" data-frame-screen data-start="${isStartingPoint}" style="--design-width:${formatNumber(frame.width)}px;--design-height:${formatNumber(frame.height)}px;background:${escapeAttribute(frame.background)}">${children}</section>`
        return `<div class="screen-container${isStartingPoint ? ' active' : ''}" data-screen-container style="--design-width:${formatNumber(frame.width)}px;--design-height:${formatNumber(frame.height)}px">${screen}</div>`
      }).join('')
      body = `${shared ? `<div class="shared-layer">${shared}</div>` : ''}${screens}`
    } else {
      body = visibleItems.filter(item => !item.parentId)
        .map(item => renderElement(item, page, items)).join('')
    }

    const title = `${project.projectName || 'Lixy Studios'} · ${page}`
    const mainClass = frames.length ? 'app-viewport' : 'canvas'
    const documentHtml = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="styles.css"></head><body><main class="${mainClass}">${body}</main><script src="script.js" defer></script></body></html>`
    zip.file(pageFiles.get(page)!, documentHtml)
    previewDocuments[page] = createPreviewDocument(documentHtml, css, script, assets)
    exportedPages[page] = items.map(item => ({
      ...item,
      ...(item.src ? { src: getAssetPath(item.src) } : {}),
      ...(item.fontSource ? { fontSource: getAssetPath(item.fontSource, true) } : {}),
    }))
  }

  for (const asset of assets.values()) zip.file(asset.path, asset.bytes)
  zip.file('styles.css', css)
  zip.file('script.js', script)
  zip.file('project.json', JSON.stringify({
    projectName: project.projectName,
    pages: project.pages,
    activePage: project.activePage,
    savedAt: Date.now(),
    elements: exportedPages[project.activePage] || [],
    pageElements: exportedPages,
  }, null, 2))
  zip.file('README.md', [
    `# ${project.projectName || 'Lixy Studios'}`,
    '',
    'Generated by Lixy Studios. Open `index.html` in a modern browser to run the website.',
    'All pages, styles, scripts, images, and custom fonts are included in this folder.',
    '',
    '## Files',
    '- `index.html`: the entry page.',
    '- `styles.css`: editable layout and visual styles.',
    '- `script.js`: frame navigation and responsive layout behavior.',
    '- `assets/`: imported images and custom fonts.',
    '- `project.json`: editable source data for the Lixy Studios design.',
    '',
    'For local development servers, serve this folder over HTTP to avoid browser restrictions on local files.',
  ].join('\n'))

  return {
    archive: await zip.generateAsync({ type: 'blob' }),
    previewDocuments,
    warnings: validation.warnings,
  }
}

function getPageStartFrame(items: CanvasElement[]) {
  const frames = items.filter(item => item.type === 'frame' && !item.parentId && !item.hidden)
  return frames.find(item => item.flowStartingPoint) || frames[0]
}

function generateCss(fontFaces: string[]) {
  return `${fontFaces.join('\n')}
*{box-sizing:border-box}
html,body{margin:0;min-width:0;min-height:100%;font-family:Inter,Arial,sans-serif}
body{background:#f7f8fa}
button,input{font:inherit}
.canvas{position:relative;flex:none;width:min(900px,100%);min-height:600px;margin:0 auto;overflow:visible;background:#fff}
.node{position:absolute;display:flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;color:inherit;text-decoration:none}
.node.text{display:block;white-space:pre-wrap;overflow-wrap:anywhere}
.node.frame{overflow:hidden}
.node.group{overflow:visible;background:transparent}
.node.image img{width:100%;height:100%;display:block;object-fit:inherit;object-position:inherit}
.node.input{display:block;appearance:none;border:0;padding:0 12px;border-radius:inherit;background:inherit;color:inherit;font:inherit;outline-offset:2px}
.node.button{border:0;font:inherit}
a.node.button{cursor:pointer}
a.node.button:hover{filter:brightness(.96)}
a.node.button:active{filter:brightness(.9)}
a.node.button:focus-visible,.node.input:focus-visible{outline:2px solid #7957ff;outline-offset:2px}
.node-text{display:block;width:100%;height:100%;white-space:inherit;overflow-wrap:anywhere}
.node.shape{overflow:visible}
.node.shape.circle .shape-content,.node.shape.rectangle .shape-content{width:100%;height:100%;display:block;overflow:hidden;background:inherit}
.node.shape.circle .shape-content{border-radius:50%}
.node.shape.rectangle .shape-content{border-radius:inherit}
.shape-image{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:inherit;object-position:inherit}
.node.shape.line{overflow:visible}
.node.shape.line .shape-content{position:absolute;inset:50% 0 auto;height:1px;background:inherit;transform:translateY(-50%)}
.image-placeholder{width:100%;height:100%;display:block;background:linear-gradient(135deg,#cfd4df,#edf0f5)}
.app-viewport{position:relative;width:100%;min-height:100vh;display:flex;flex-direction:column;align-items:center;overflow:hidden;background:#f7f8fa}
.shared-layer{position:absolute;inset:0;z-index:2;pointer-events:none}
.shared-layer .node{pointer-events:auto}
.screen-container{position:relative;display:none;flex:none;width:min(var(--design-width),100%);height:var(--design-height);overflow:visible}
.screen-container.active{display:block}
.frame-screen{position:absolute;top:0;left:0;display:block;width:var(--design-width);height:var(--design-height);max-width:none;max-height:none;overflow:hidden;transform:scale(var(--screen-scale,1));transform-origin:top left;background:#fff}
.frame-screen>.node{position:absolute}
.frame-screen>.node.frame{overflow:hidden}
.frame-screen .node.frame>.node{position:absolute}
.frame-screen .node.image img{object-fit:inherit}
@media(max-width:900px){.canvas{margin:0 auto}}`
}

function generateScript() {
  return `(() => {
  const containers = [...document.querySelectorAll('[data-screen-container]')];
  const screens = [...document.querySelectorAll('[data-frame-screen]')];
  const start = () => screens.find(screen => screen.dataset.start === 'true') || screens[0];
  const currentId = () => {
    try { return decodeURIComponent(location.hash.slice(1)); }
    catch { return location.hash.slice(1); }
  };
  const show = id => {
    const target = screens.find(screen => screen.id === id) || start();
    if (!target) return;
    screens.forEach(screen => screen.classList.toggle('active', screen === target));
    containers.forEach(container => container.classList.toggle('active', container.contains(target)));
  };
  const resize = () => containers.forEach(container => {
    const width = Number.parseFloat(container.style.getPropertyValue('--design-width'));
    const height = Number.parseFloat(container.style.getPropertyValue('--design-height'));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const scale = Math.min(1, innerWidth / width);
    container.style.width = width * scale + 'px';
    container.style.height = height * scale + 'px';
    const screen = container.querySelector('[data-frame-screen]');
    if (screen) screen.style.setProperty('--screen-scale', String(scale));
  });
  const navigate = id => {
    const target = screens.find(screen => screen.id === id);
    if (!target) return false;
    if (currentId() !== id) location.hash = encodeURIComponent(id);
    show(id);
    return true;
  };
  if (screens.length) {
    show(currentId());
    resize();
    addEventListener('resize', resize);
    addEventListener('hashchange', () => show(currentId()));
    document.addEventListener('click', event => {
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link) return;
      const page = link.dataset.pageTarget;
      if (page && document.documentElement.dataset.lixyPreview === 'true') {
        event.preventDefault();
        parent.postMessage({ source: 'lixy-preview', page }, '*');
        return;
      }
      if (!link.hash.startsWith('#screen-')) return;
      let id;
      try { id = decodeURIComponent(link.hash.slice(1)); }
      catch { return; }
      if (navigate(id)) event.preventDefault();
    });
  }
})();`
}

function createPreviewDocument(
  html: string,
  css: string,
  script: string,
  assets: Map<string, ExportAsset>,
) {
  const previewHtml = html
    .replace('<html lang="es">', '<html lang="es" data-lixy-preview="true">')
    .replace('<link rel="stylesheet" href="styles.css">', `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`)
    .replace('<script src="script.js" defer></script>', `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>`)
  const replacements = [...assets.values()]
    .map(asset => [asset.path, bytesToDataUrl(asset.bytes, asset.mimeType)] as const)
    .sort(([a], [b]) => b.length - a.length)
  const withAssets = replacements.reduce((document, [path, dataUrl]) => document.replaceAll(path, dataUrl), previewHtml)
  return withAssets
}

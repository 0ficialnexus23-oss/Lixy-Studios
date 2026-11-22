import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import type { CanvasElement } from '../src/types.ts'
import { buildWebExport, validateWebProject, type WebProject } from '../src/webExport.ts'

const imageSource = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l24AAAAASUVORK5CYII='
const fontSource = 'data:font/woff2;base64,d09GMgABAAAAAA=='

function makeElement(overrides: Partial<CanvasElement>): CanvasElement {
  return {
    id: 'element',
    type: 'text',
    name: 'Element',
    x: 16,
    y: 24,
    width: 160,
    height: 40,
    text: 'Hello',
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

function makeProject(): WebProject {
  const homeFrame = makeElement({
    id: 'home-frame',
    type: 'frame',
    name: 'Home screen',
    width: 402,
    height: 874,
    background: '#ffffff',
    text: '',
    flowStartingPoint: true,
  })
  const aboutFrame = makeElement({
    id: 'about-frame',
    type: 'frame',
    name: 'About screen',
    x: 0,
    y: 0,
    width: 402,
    height: 874,
    background: '#ffffff',
    text: '',
  })

  return {
    projectName: 'Lixy & Studio',
    pages: ['Home', 'About'],
    activePage: 'Home',
    pageElements: {
      Home: [
        homeFrame,
        makeElement({
          id: 'about-link',
          type: 'button',
          name: 'About link',
          parentId: homeFrame.id,
          text: 'About',
          linkToPage: 'About',
          background: '#7957ff',
          color: '#ffffff',
        }),
        makeElement({
          id: 'hero-image',
          type: 'image',
          name: 'Hero image',
          parentId: homeFrame.id,
          src: imageSource,
          mimeType: 'image/png',
        }),
        makeElement({
          id: 'email',
          type: 'input',
          name: 'Email',
          parentId: homeFrame.id,
          text: 'you@example.com',
        }),
        makeElement({
          id: 'brand-copy',
          type: 'text',
          name: 'Brand copy',
          parentId: homeFrame.id,
          fontFamily: 'Brand',
          fontSource,
        }),
      ],
      About: [
        aboutFrame,
        makeElement({
          id: 'home-link',
          type: 'button',
          name: 'Home link',
          parentId: aboutFrame.id,
          text: 'Back home',
          linkToPage: 'Home',
        }),
        makeElement({
          id: 'local-screen-link',
          type: 'button',
          name: 'Local screen link',
          parentId: aboutFrame.id,
          text: 'Another screen',
          linkToElementId: aboutFrame.id,
        }),
        makeElement({
          id: 'action-button',
          type: 'button',
          name: 'Action button',
          parentId: aboutFrame.id,
          text: 'Continue',
        }),
      ],
    },
  }
}

test('exports independent HTML, CSS, JavaScript, and image assets', async () => {
  const result = await buildWebExport(makeProject())
  const zip = await JSZip.loadAsync(result.archive)
  const homeHtml = await zip.file('index.html')?.async('string')
  const aboutHtml = await zip.file('about.html')?.async('string')
  const css = await zip.file('styles.css')?.async('string')
  const script = await zip.file('script.js')?.async('string')
  const source = await zip.file('project.json')?.async('string')

  assert.ok(homeHtml)
  assert.ok(aboutHtml)
  assert.ok(css)
  assert.ok(script)
  assert.ok(source)
  assert.ok(zip.file('assets/image-1.png'))
  assert.ok(zip.file('assets/font-2.woff2'))
  assert.match(homeHtml, /href="about\.html#screen-about-frame"/)
  assert.match(homeHtml, /data-page-target="About"/)
  assert.match(homeHtml, /src="script\.js"/)
  assert.match(homeHtml, /<input id="email"[^>]+placeholder="you@example\.com"/)
  assert.match(aboutHtml, /<div id="action-button" class="node button\s*"[^>]+>Continue<\/div>/)
  assert.match(aboutHtml, /href="#screen-about-frame"/)
  assert.match(css, /@media\(max-width:900px\)/)
  assert.match(css, /@font-face\{font-family:"Brand";src:url\("assets\/font-2\.woff2"\)/)
  assert.match(script, /addEventListener\('resize'/)
  assert.match(script, /location\.hash = encodeURIComponent\(id\)/)
  assert.doesNotMatch(script, /history\.pushState/)
  assert.match(script, /dataset\.lixyPreview === 'true'/)
  assert.match(result.previewDocuments.Home, /data-lixy-preview="true"/)
  assert.doesNotMatch(source, /data:image\/png;base64/)
  assert.match(source, /assets\/image-1\.png/)
  assert.match(source, /"elements":\s*\[/)

  assert.match(result.previewDocuments.Home, /<style>/)
  assert.match(result.previewDocuments.Home, /<script>\(\(\) =>/)
  assert.match(result.previewDocuments.Home, new RegExp(imageSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(result.previewDocuments.Home, new RegExp(fontSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(result.previewDocuments.Home, /href="styles\.css"/)
  assert.ok(result.warnings.some(warning => warning.includes('Action button')))
  assert.ok(result.warnings.some(warning => warning.includes('Email') && warning.includes('formulario')))
})

test('exports library icons as styled inline SVGs', async () => {
  const project = makeProject()
  project.pageElements.Home.push(makeElement({
    id: 'heart-icon',
    type: 'icon',
    name: 'Icono · Me gusta',
    parentId: 'home-frame',
    iconName: 'Heart',
    iconStrokeWidth: 3,
    width: 40,
    height: 40,
    color: '#ff3366',
    background: 'transparent',
    text: '',
  }))

  const result = await buildWebExport(project)
  const html = result.previewDocuments.Home
  const archive = await JSZip.loadAsync(result.archive)
  const source = await archive.file('project.json')?.async('string')

  assert.match(html, /<svg[^>]*width="40"[^>]*height="40"[^>]*stroke="#ff3366"[^>]*>/)
  assert.match(html, /stroke-width="3"/)
  assert.match(html, /<path /)
  assert.ok(source)
  assert.match(source, /"iconName":\s*"Heart"/)
  assert.deepEqual(validateWebProject(project).errors, [])
})

test('reports broken references and invalid geometry before export', async () => {
  const project = makeProject()
  project.pageElements.Home[1] = makeElement({
    id: 'broken-link',
    name: 'Broken link',
    linkToPage: 'Missing page',
    width: Number.NaN,
  })

  const result = validateWebProject(project)
  assert.ok(result.errors.some(error => error.includes('Missing page')))
  assert.ok(result.errors.some(error => error.includes('no es válido')))
  await assert.rejects(buildWebExport(project), /No se puede exportar/)
})

test('rejects unsupported icons and invalid icon stroke widths', () => {
  const project = makeProject()
  project.pageElements.Home.push(makeElement({
    id: 'unknown-icon',
    type: 'icon',
    iconName: '<script>',
    text: '',
  }))
  project.pageElements.Home.push(makeElement({
    id: 'invalid-icon-stroke',
    type: 'icon',
    iconName: 'Heart',
    iconStrokeWidth: 5,
    text: '',
  }))

  const result = validateWebProject(project)
  assert.ok(result.errors.some(error => error.includes('no existe en la biblioteca')))
  assert.ok(result.errors.some(error => error.includes('grosor del icono') && error.includes('entre 1 y 4')))
})

test('rejects cyclic frame and group hierarchies', () => {
  const project = makeProject()
  project.pageElements.Home = [
    makeElement({ id: 'group-one', type: 'group', parentId: 'group-two' }),
    makeElement({ id: 'group-two', type: 'group', parentId: 'group-one' }),
  ]

  const result = validateWebProject(project)
  assert.ok(result.errors.some(error => error.includes('ciclo de contenedores')))
})

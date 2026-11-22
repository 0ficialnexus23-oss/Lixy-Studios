import { useState } from 'react'
import {
  ArrowDownToLine, ArrowRight, BookOpen, CircleHelp, Code2,
  Eye, FilePlus2, FolderOpen, Grid2X2, Home, Image, LayoutGrid,
  Monitor, Moon, MousePointer2, Puzzle, Search, Settings2, Shapes,
  Sun, Upload,
} from 'lucide-react'
import type { CanvasElement } from './types'
import './StudioDashboard.css'

interface StudioDashboardProps {
  projectName: string
  pages: string[]
  activePage: string
  pageElements: Record<string, CanvasElement[]>
  previewDocuments: Record<string, string>
  runtimeStatus: 'building' | 'running' | 'error'
  toast: string | null
  onOpenEditor: () => void
  onOpenCode: () => void
  onOpenIcons: () => void
  onSelectPage: (page: string) => void
  onOpenResources: () => void
  onImportResource: () => void
  onExport: () => void
  onPreview: () => void
  onHelp: () => void
}

const THEME_KEY = 'lixy-studios-home-theme'

export default function StudioDashboard({
  projectName, pages, activePage, pageElements, previewDocuments, runtimeStatus, toast,
  onOpenEditor, onOpenCode, onOpenIcons, onSelectPage, onOpenResources,
  onImportResource, onExport, onPreview, onHelp,
}: StudioDashboardProps) {
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
  })
  const [themeError, setThemeError] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const projectMatches = !normalizedQuery || projectName.toLocaleLowerCase().includes(normalizedQuery)
  const visiblePages = pages.filter(page => !normalizedQuery
    || page.toLocaleLowerCase().includes(normalizedQuery)
    || (pageElements[page] || []).some(element =>
      `${element.name} ${element.text}`.toLocaleLowerCase().includes(normalizedQuery)))
  const elementCount = Object.values(pageElements).reduce((total, items) => total + items.length, 0)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
      setThemeError('')
    } catch {
      setThemeError('No se pudo guardar el tema en este navegador.')
    }
  }

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className={`studio-home ${theme === 'light' ? 'home-light' : ''}`}>
      <aside className="home-sidebar">
        <button className="home-brand" onClick={onOpenEditor} aria-label="Abrir el editor de Lixy Studios">
          <span className="home-brand-logo"><img src={`${import.meta.env.BASE_URL}lixy-logo.svg`} alt="" /></span>
          <span className="home-brand-text"><strong>Lixy Studios</strong><small>CREATIVE DEVELOPMENT</small></span>
        </button>
        <span className="home-nav-label">WORKSPACE</span>
        <nav className="home-nav" aria-label="Navegación principal">
          <button className="home-nav-item active" aria-label="Inicio" aria-current="page" onClick={() => goTo('home-top')}><Home /><span>Inicio</span></button>
          <button className="home-nav-item" aria-label="Mi proyecto" onClick={() => goTo('home-projects')}><FolderOpen /><span>Mi proyecto</span><small>01</small></button>
          <button className="home-nav-item" aria-label="Plantillas" onClick={() => goTo('home-templates')}><Grid2X2 /><span>Plantillas</span></button>
          <button className="home-nav-item" aria-label="Recursos" onClick={onOpenResources}><Image /><span>Recursos</span></button>
        </nav>
        <span className="home-nav-label">HERRAMIENTAS</span>
        <nav className="home-nav" aria-label="Herramientas">
          <button className="home-nav-item" aria-label="Código generado" onClick={onOpenCode}><Code2 /><span>Código generado</span></button>
          <button className="home-nav-item" aria-label="Diseñador visual" onClick={onOpenEditor}><MousePointer2 /><span>Diseñador visual</span></button>
          <button className="home-nav-item" aria-label="Biblioteca de iconos" onClick={onOpenIcons}><Shapes /><span>Biblioteca de iconos</span></button>
          <button className="home-nav-item" aria-label="Extensiones (próximamente)" disabled title="Las extensiones aún no están disponibles"><Puzzle /><span>Extensiones</span><small>Pronto</small></button>
        </nav>
        <div className="home-sidebar-bottom">
          <div className="home-promo"><strong>Tu creatividad no tiene límites.</strong><p>Explora tus herramientas y lleva tu proyecto más lejos.</p><button onClick={onOpenEditor}>EXPLORAR HERRAMIENTAS <ArrowRight /></button></div>
          <nav className="home-nav" aria-label="Ayuda y configuración">
            <button className="home-nav-item" aria-label="Configuración (próximamente)" disabled title="La configuración avanzada aún no está disponible"><Settings2 /><span>Configuración</span><small>Pronto</small></button>
            <button className="home-nav-item" aria-label="Centro de ayuda" onClick={onHelp}><CircleHelp /><span>Centro de ayuda</span></button>
          </nav>
          <div className="home-profile"><span>LX</span><div><strong>Mi espacio de trabajo</strong><small>Usuario local</small></div></div>
        </div>
      </aside>

      <section className="home-main" id="home-top">
        <header className="home-topbar">
          <div className="home-breadcrumb">Workspace <span>/</span> <strong>Inicio</strong></div>
          <div className="home-top-actions">
            <label className="home-search"><Search /><input type="search" aria-label="Buscar proyectos y páginas" placeholder="Buscar proyecto o página..." value={query} onChange={event => setQuery(event.target.value)} /><kbd>Ctrl K</kbd></label>
            <button className="home-icon-button" onClick={toggleTheme} title="Cambiar tema del inicio" aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
            <button className="home-icon-button" onClick={onHelp} title="Ayuda" aria-label="Ayuda"><CircleHelp /></button>
            <span className="home-avatar" title="Espacio local">LX</span>
          </div>
        </header>

        <div className="home-content">
          <section className="home-welcome">
            <div className="home-welcome-copy"><div className="home-eyebrow"><span /> YOUR CREATIVE SPACE</div><h1>Bienvenido a <span>Lixy Studios.</span></h1><p>Tu espacio de trabajo para diseñar, programar y crear.</p></div>
            <div className="home-welcome-art" aria-label="Espacio creativo de diseño y desarrollo">
              <img src={`${import.meta.env.BASE_URL}home/design-workspace.png`} alt="Estación de trabajo de diseño web con varias pantallas" />
              <img className="home-welcome-orb" src={`${import.meta.env.BASE_URL}home/purple-orb.png`} alt="" />
              <span>CREATIVE WORKSPACE · LOCAL</span>
            </div>
          </section>

          <section className="home-action-grid" aria-label="Acciones principales">
            <button className="home-action-card primary" onClick={onOpenEditor}><img className="home-action-image" src={`${import.meta.env.BASE_URL}home/creative-studio.png`} alt="" /><span className="home-action-icon"><MousePointer2 /></span><strong>Continuar diseñando</strong><span>Abre tu proyecto local y convierte tus ideas en realidad.</span><ArrowRight className="home-action-arrow" /></button>
            <button className="home-action-card" onClick={onPreview}><span className="home-action-icon"><Eye /></span><strong>Vista previa</strong><span>Prueba tu sitio web generado antes de exportarlo.</span><ArrowRight className="home-action-arrow" /></button>
            <button className="home-action-card" onClick={onExport}><span className="home-action-icon"><ArrowDownToLine /></span><strong>Exportar proyecto</strong><span>Descarga tus archivos HTML, CSS y JavaScript.</span><ArrowRight className="home-action-arrow" /></button>
          </section>

          <section className="home-section" id="home-projects">
            <div className="home-section-heading"><div><h2>Proyecto reciente</h2><p>Vuelve rápidamente a tu trabajo guardado en este dispositivo.</p></div><button onClick={onOpenEditor}>Abrir editor <ArrowRight /></button></div>
            {projectMatches ? <div className="home-project-grid">
              <article className="home-project-card">
                <button className="home-project-preview" onClick={onOpenEditor} aria-label={`Abrir proyecto ${projectName}`}>
                  <span className="home-preview-window"><span className="home-preview-bar"><i /><i /><i /></span>{previewDocuments[activePage]
                    ? <iframe title={`Vista en miniatura de ${projectName}`} srcDoc={previewDocuments[activePage]} sandbox="allow-forms allow-scripts" tabIndex={-1} />
                    : <span className="home-preview-placeholder"><img src={`${import.meta.env.BASE_URL}lixy-logo.svg`} alt="" /><span>Preparando vista previa</span></span>}</span>
                </button>
                <div className="home-project-info"><div><strong>{projectName}</strong><button onClick={onOpenEditor} aria-label={`Abrir ${projectName}`}><ArrowRight /></button></div><p>{pages.length} páginas · {elementCount} elementos <span>{runtimeStatus === 'running' ? 'Listo' : runtimeStatus === 'error' ? 'Revisar proyecto' : 'Preparando'}</span></p></div>
              </article>
              <div className="home-project-note"><img src={`${import.meta.env.BASE_URL}home/creative-studio.png`} alt="Estudio creativo con herramientas digitales" /><div className="home-project-note-copy"><FolderOpen /><strong>Tu proyecto permanece aquí</strong><span>Lixy guarda el proyecto localmente. Exporta una copia para compartirlo o publicarlo.</span><button onClick={onExport}>Exportar proyecto <ArrowRight /></button></div></div>
            </div> : <div className="home-empty">No se encontró un proyecto con ese nombre. Busca también en sus páginas abajo.</div>}
          </section>

          <section className="home-section" id="home-pages">
            <div className="home-section-heading"><div><h2>Páginas de tu proyecto</h2><p>Selecciona una página para seguir editándola.</p></div><button onClick={onOpenEditor}>Gestionar páginas <ArrowRight /></button></div>
            {visiblePages.length ? <div className="home-page-grid">{visiblePages.map(page => <button className="home-page-card" key={page} onClick={() => onSelectPage(page)}><span className="home-page-icon"><LayoutGrid /></span><span><strong>{page}</strong><small>{(pageElements[page] || []).length} elementos</small></span><ArrowRight /></button>)}</div> : <div className="home-empty">No hay páginas que coincidan con tu búsqueda.</div>}
          </section>

          <section className="home-section" id="home-templates">
            <div className="home-section-heading"><div><h2>Comienza con una plantilla</h2><p>La biblioteca de plantillas está en desarrollo.</p></div></div>
            <div className="home-template-grid">
              {([{ name: 'Proyecto en blanco', description: 'Ideas y dirección visual', image: 'design-display.png', color: 'purple' }, { name: 'Portafolio creativo', description: 'Diseño web y editorial', image: 'agency-website.png', color: 'pink' }, { name: 'Aplicación web', description: 'Interfaces para móvil', image: 'mobile-mockup.png', color: 'blue' }, { name: 'Sitio empresarial', description: 'Identidad para tu marca', image: 'brand-identity.png', color: 'orange' }] as const).map(item => <article className="home-template-card" key={item.name}><div className={`home-template-art ${item.color}`}><img src={`${import.meta.env.BASE_URL}home/${item.image}`} alt="" loading="lazy" /><span>PRÓXIMAMENTE</span></div><div><strong>{item.name}</strong><small>{item.description}</small></div></article>)}
            </div>
          </section>

          <section className="home-bottom-grid">
            <div className="home-tools"><h3>Herramientas de creación</h3>
              <button onClick={onOpenCode}><span><img src={`${import.meta.env.BASE_URL}home/code-workstation.png`} alt="" loading="lazy" /></span><div><strong>Código generado</strong><small>Consulta los archivos exportables en modo lectura.</small></div><ArrowRight /></button>
              <button onClick={onOpenEditor}><span><img src={`${import.meta.env.BASE_URL}home/design-display.png`} alt="" loading="lazy" /></span><div><strong>Diseñador visual</strong><small>Construye interfaces mediante diseño visual.</small></div><ArrowRight /></button>
              <button onClick={onOpenIcons}><span><Shapes /></span><div><strong>Biblioteca de iconos</strong><small>Explora e inserta iconos SVG en tu proyecto.</small></div><ArrowRight /></button>
              <button onClick={onImportResource}><span><Upload /></span><div><strong>Importar imagen</strong><small>Añade una imagen a tu proyecto.</small></div><ArrowRight /></button>
            </div>
            <div className="home-release"><div className="home-release-art" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}home/abstract-purple.png`} alt="" loading="lazy" /><img src={`${import.meta.env.BASE_URL}home/purple-orb.png`} alt="" loading="lazy" /></div><div className="home-release-copy"><span>WELCOME TO LIXY STUDIOS</span><h3>Imagina. Diseña. Construye.</h3><p>Un espacio donde el diseño y el desarrollo se encuentran para convertir tus ideas en proyectos reales.</p><div><Monitor /> LIXY STUDIOS · CREATIVE DEVELOPMENT</div><button onClick={onHelp}><BookOpen /> Ayuda y atajos <ArrowRight /></button></div></div>
          </section>
          <div className="home-limitations"><FilePlus2 /><span>Crear proyectos independientes, abrir proyectos desde archivos y utilizar plantillas todavía no está disponible. Tu proyecto actual se conserva.</span></div>
        </div>
      </section>
      {(toast || themeError) && <div className="home-toast" role="status">{themeError || toast}</div>}
    </main>
  )
}

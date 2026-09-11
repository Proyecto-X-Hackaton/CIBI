// strings.ts — UI language ES/EN (Ajustes). Capture always accepts ES/PT
// and normalizes to EN internally; this switch only changes strings.

export type UiLang = 'es' | 'en';

export const STR = {
  es: {
    home: 'Inicio', panel: 'Panel', network: 'Red', settings: 'Ajustes',
    inspections: 'Inspecciones',
    inspectionsSub: 'Inspección = captura editable · Informe = reporte generado (siempre re-generable)',
    newInspection: '+ Nueva inspección con IA',
    offline: 'SIN CONEXIÓN', pending: 'pendientes',
    disclaimer: 'Extracción de inventario de equipamiento.\nNo es diagnóstico clínico.',
    chatPlaceholder: 'Escribe un mensaje…',
    goReview: 'Pasar a revisar →',
    saveReport: 'Guardar inspección → generar informe',
    saveDraft: 'Guardar borrador y salir a Inicio',
    report: 'Informe', sites: 'Mis sedes', nextAction: 'Próxima acción',
    schedule: '📅 Agendar', viewReport: 'Ver informe',
  },
  en: {
    home: 'Home', panel: 'Board', network: 'Network', settings: 'Settings',
    inspections: 'Inspections',
    inspectionsSub: 'Inspection = editable capture · Report = generated output (always re-generable)',
    newInspection: '+ New AI inspection',
    offline: 'OFFLINE', pending: 'pending',
    disclaimer: 'Equipment inventory extraction.\nNot a clinical diagnosis.',
    chatPlaceholder: 'Type a message…',
    goReview: 'Go to review →',
    saveReport: 'Save inspection → generate report',
    saveDraft: 'Save draft and exit to Home',
    report: 'Report', sites: 'My sites', nextAction: 'Next action',
    schedule: '📅 Schedule', viewReport: 'View report',
  },
} as const;

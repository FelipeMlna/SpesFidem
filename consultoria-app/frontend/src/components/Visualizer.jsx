import React from 'react';

export default function Visualizer({ specs }) {
  const boxWidth  = Math.min(220, Math.max(110, specs.width * 100));
  const boxHeight = Math.min(300, Math.max(160, specs.height * 100));
  const leaves    = Math.max(1, parseInt(specs.leafCount) || 2);

  // Frame color por perfil
  const profileColors = {
    'Natural': '#94a3b8',
    'Negro':   '#334155',
    'Madera':  '#92400e',
    'Blanco':  '#e2e8f0',
  };
  const frameColor = profileColors[specs.profile] || '#38bdf8';

  // Color vidrio
  const glassColorMap = {
    'Incoloro':         'rgba(56,189,248,0.09)',
    'Bronce':           'rgba(180,130,60,0.28)',
    'BronceReflectivo': 'rgba(215,165,50,0.36)',
    'AzulEspejo':       'rgba(30,80,200,0.38)',
  };
  const glassByType = {
    'Templado':  'rgba(56,189,248,0.10)',
    'Laminado':  'rgba(100,200,150,0.12)',
    'Esmerilado':'rgba(200,200,200,0.22)',
  };
  const glassFill = specs.glass === 'Crudo'
    ? (glassColorMap[specs.glassColor] || glassColorMap['Incoloro'])
    : (glassByType[specs.glass]        || 'rgba(56,189,248,0.09)');

  // Etiqueta de vidrio
  const glassLabel = specs.glass === 'Crudo'
    ? `Crudo ${specs.glassThickness}mm – ${specs.glassColor}`
    : specs.glass;

  // Render de hojas (paneles) como elementos flex
  const panels = Array.from({ length: leaves }, (_, i) => (
    <div
      key={i}
      style={{
        flex: 1,
        height: '100%',
        borderRight: i < leaves - 1 ? `4px solid ${frameColor}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* Manija en cada hoja */}
      <div style={{
        width: 4,
        height: 20,
        borderRadius: 4,
        background: frameColor,
        opacity: 0.7,
        position: 'absolute',
        // alternas izquierda/derecha
        [i % 2 === 0 ? 'right' : 'left']: 6,
      }} />
    </div>
  ));

  return (
    <div className="glass-card flex flex-col h-full bg-slate-900/60 p-4 relative">
      <h2 className="text-base font-bold font-['Outfit'] text-accent mb-3 flex items-center gap-2">
        <i className="fas fa-drafting-compass"></i> Esquema Dinámico
      </h2>

      <div className="flex-grow flex items-center justify-center relative bg-black/30 rounded-xl overflow-hidden p-6 border border-white/5">
        {/* Marco externo */}
        <div
          className="relative transition-all duration-300"
          style={{
            width: `${boxWidth}px`,
            height: `${boxHeight}px`,
            border: `6px solid ${frameColor}`,
            borderRadius: '4px',
            overflow: 'hidden',
            background: glassFill,
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          {panels}

          {/* Etiqueta vidrio */}
          <div className="absolute bottom-1.5 right-1.5 bg-black/50 text-green-400 text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide truncate max-w-[90%]">
            {glassLabel}
          </div>
          {/* Etiqueta perfil */}
          <div className="absolute top-1.5 left-1.5 bg-black/50 text-accent text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            {specs.profile}
          </div>

          {/* Cota ancho */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-accent font-bold text-[10px] whitespace-nowrap">
            {specs.width}m
          </div>
          {/* Cota alto */}
          <div className="absolute -left-9 top-1/2 -translate-y-1/2 -rotate-90 text-accent font-bold text-[10px] whitespace-nowrap">
            {specs.height}m
          </div>
        </div>
      </div>

      {/* Barra resumen */}
      <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
        <span className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-text-muted">
          <i className="fas fa-th-large mr-1 text-accent"></i>{leaves} {leaves === 1 ? 'hoja' : 'hojas'}
        </span>
        <span className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-text-muted">
          <i className="fas fa-expand-arrows-alt mr-1 text-accent"></i>{specs.width}m × {specs.height}m
        </span>
        <span className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-text-muted">
          <i className="fas fa-square mr-1 text-accent"></i>{specs.glass === 'Crudo' ? `Crudo ${specs.glassThickness}mm` : specs.glass}
        </span>
      </div>
    </div>
  );
}

export default function Workspace({ specs, onChange }) {
  const isCrudo = specs.glass === 'Crudo';

  return (
    <div className="glass-card flex flex-col h-full overflow-y-auto">
      <h2 className="text-xl font-bold font-['Outfit'] text-accent mb-6 flex items-center gap-2">
        <i className="fas fa-tools"></i> Especificaciones
      </h2>

      {/* Dimensiones */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">Ancho (m)</label>
          <input type="number" step="0.01" className="form-control"
            value={specs.width} onChange={e => onChange('width', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">Alto (m)</label>
          <input type="number" step="0.01" className="form-control"
            value={specs.height} onChange={e => onChange('height', e.target.value)} />
        </div>
      </div>

      {/* N° de Hojas / Puertas */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">
          <i className="fas fa-th-large mr-1"></i> N° de Hojas / Puertas
        </label>
        <div className="flex gap-2">
          {['2','3','4','5','6'].map(n => (
            <button key={n} onClick={() => onChange('leafCount', n)}
              className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${
                specs.leafCount === n
                  ? 'bg-accent text-slate-900 border-accent shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                  : 'bg-white/5 text-text-muted border-white/10 hover:bg-white/10'
              }`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Perfil */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">Perfil de Aluminio</label>
        <select className="form-control" value={specs.profile} onChange={e => onChange('profile', e.target.value)}>
          <option value="Natural">Natural (Plata)</option>
          <option value="Negro">Negro Intenso</option>
          <option value="Madera">Acabado Madera</option>
          <option value="Blanco">Blanco</option>
        </select>
      </div>

      {/* Tipo de Vidrio */}
      <div className="mb-4">
        <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">Tipo de Vidrio</label>
        <select className="form-control" value={specs.glass} onChange={e => onChange('glass', e.target.value)}>
          <optgroup label="— Vidrio de Seguridad —">
            <option value="Templado">Templado de Seguridad</option>
            <option value="Laminado">Laminado Acústico</option>
          </optgroup>
          <optgroup label="— Vidrio Crudo —">
            <option value="Crudo">Crudo (Flotado)</option>
          </optgroup>
          <optgroup label="— Especiales —">
            <option value="Esmerilado">Esmerilado / Sandblasting</option>
          </optgroup>
        </select>
      </div>

      {/* Sub-opciones Crudo */}
      {isCrudo && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">
              <i className="fas fa-ruler mr-1"></i> Espesor
            </label>
            <div className="flex gap-2">
              {['3','4','5'].map(mm => (
                <button key={mm} onClick={() => onChange('glassThickness', mm)}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${
                    specs.glassThickness === mm
                      ? 'bg-accent text-slate-900 border-accent'
                      : 'bg-white/5 text-text-muted border-white/10 hover:bg-white/10'
                  }`}>
                  {mm} mm
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">
              <i className="fas fa-palette mr-1"></i> Color del Vidrio
            </label>
            <select className="form-control" value={specs.glassColor} onChange={e => onChange('glassColor', e.target.value)}>
              <option value="Incoloro">Incoloro (Transparente)</option>
              <option value="Bronce">Bronce</option>
              <option value="BronceReflectivo">Bronce Reflectivo</option>
              <option value="AzulEspejo">Azul Espejo</option>
            </select>
          </div>
        </div>
      )}

      {/* Espejo */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">Opciones de Espejo</label>
        <select className="form-control" value={specs.mirror} onChange={e => onChange('mirror', e.target.value)}>
          <option value="Ninguno">Ninguno</option>
          <option value="Biselado">Biselado</option>
          <option value="LED">Con Luz LED Integrada</option>
          <option value="Flotado">Flotado Simple</option>
          <option value="Mosaico">Mosaico</option>
        </select>
      </div>

      {/* Notas */}
      <div className="flex-grow flex flex-col mt-auto">
        <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wide">Notas de Consulta</label>
        <textarea className="form-control flex-grow resize-none min-h-[100px]"
          placeholder="Observaciones adicionales, detalles del cliente..."
          value={specs.notes} onChange={e => onChange('notes', e.target.value)} />
      </div>
    </div>
  );
}

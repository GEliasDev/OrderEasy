import { useState, useEffect, useCallback } from 'react';
import { X, FileText, User, Edit3, TrendingUp, TrendingDown } from 'lucide-react';
import './styles/EditTransaccionModal.css';

function EditTransaccionModal({
  isOpen,
  onClose,
  onSave,
  tipo,
  descripcion: descripcionInicial,
  entidadId: entidadIdInicial,
  entidades,
  entidadLabel,
  entidadKey,
  entidadNombreKey,
}) {
  const [descripcion, setDescripcion] = useState('');
  const [entidadId, setEntidadId] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  // Sincronizar valores al abrir
  useEffect(() => {
    if (isOpen) {
      setDescripcion(descripcionInicial ?? '');
      setEntidadId(entidadIdInicial ?? '');
      setClosing(false);
    }
  }, [isOpen, descripcionInicial, entidadIdInicial]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !saving) handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, saving]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { descripcion };
      data[entidadKey] = entidadId || null;
      await onSave(data);
      handleClose();
    } catch {
      // Error manejado en el padre
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const IconTipo = tipo === 'venta' ? TrendingUp : TrendingDown;
  const titulo = tipo === 'venta' ? 'Editar Venta' : 'Editar Egreso';
  const subtitulo = tipo === 'venta'
    ? 'Modifica la descripción o el cliente asociado'
    : 'Modifica la descripción o el proveedor asociado';
  const defaultEntidad = tipo === 'venta' ? 'Consumidor Final' : 'General / Varios';

  return (
    <div
      className={`edit-modal-overlay ${closing ? 'closing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) handleClose(); }}
    >
      <div className="edit-modal-container">
        {/* Header */}
        <div className="edit-modal-header">
          <div className={`edit-modal-icon ${tipo}`}>
            <IconTipo size={18} />
          </div>
          <div className="edit-modal-header-text">
            <h2>{titulo}</h2>
            <p>{subtitulo}</p>
          </div>
          <button
            className="edit-modal-close-btn"
            onClick={handleClose}
            disabled={saving}
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="edit-modal-body">
            {/* Campo: Descripción */}
            <div className="edit-modal-field">
              <label className="edit-modal-label" htmlFor="edit-descripcion">
                <FileText size={12} />
                Descripción
              </label>
              <textarea
                id="edit-descripcion"
                className="edit-modal-textarea"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Escribe una descripción..."
                disabled={saving}
              />
            </div>

            {/* Campo: Cliente / Proveedor */}
            <div className="edit-modal-field">
              <label className="edit-modal-label" htmlFor="edit-entidad">
                <User size={12} />
                {entidadLabel}
              </label>
              <select
                id="edit-entidad"
                className="edit-modal-select"
                value={entidadId}
                onChange={(e) => setEntidadId(e.target.value)}
                disabled={saving}
              >
                <option value="">{defaultEntidad}</option>
                {entidades?.map((ent) => (
                  <option key={ent[entidadKey]} value={ent[entidadKey]}>
                    {ent[entidadNombreKey]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="edit-modal-footer">
            <button
              type="button"
              className="edit-modal-btn edit-modal-btn-cancel"
              onClick={handleClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="edit-modal-btn edit-modal-btn-save"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="edit-modal-btn-spinner" />
                  Guardando...
                </>
              ) : (
                <>
                  <Edit3 size={14} />
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditTransaccionModal;

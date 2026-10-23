import './styles/PeriodSelector.css';

const PERIODS = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Todo' },
];

const PeriodSelector = ({ value, onChange }) => (
  <div className="period-selector" role="radiogroup" aria-label="Período a consultar">
    {PERIODS.map((p) => (
      <button
        key={p.value}
        role="radio"
        aria-checked={value === p.value}
        className={`period-chip ${value === p.value ? 'period-chip--active' : ''}`}
        onClick={() => onChange(p.value)}
        type="button"
      >
        {p.label}
      </button>
    ))}
  </div>
);

export default PeriodSelector;

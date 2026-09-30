import React from 'react';

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function TextArea({ rows = 4, ...props }) {
  return <textarea className="field__control" rows={rows} {...props} />;
}

export function TextInput(props) {
  return <input className="field__control" type="text" {...props} />;
}

export function Select({ options, ...props }) {
  return (
    <select className="field__control" {...props}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className={`check ${checked ? 'check--on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check__box">{checked ? '×' : ''}</span>
      <span>{label}</span>
    </label>
  );
}

export function Button({ variant = '', children, ...props }) {
  const classes = ['btn', variant ? `btn--${variant}` : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

export function Panel({ title, neon = false, actions, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <header className={`panel__head ${neon ? 'panel__head--neon' : ''}`}>
        <span>{title}</span>
        <span className="panel__head-spacer" />
        {actions}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

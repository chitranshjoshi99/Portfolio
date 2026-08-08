interface NameInputProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export function NameInput({ value, placeholder, onChange, onCommit, onCancel }: NameInputProps) {
  return (
    <input
      className="explorer__input"
      autoFocus
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onFocus={(event) => event.target.select()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCancel}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onCommit();
        if (event.key === 'Escape') onCancel();
      }}
    />
  );
}

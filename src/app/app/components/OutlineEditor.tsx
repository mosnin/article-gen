"use client";

export interface OutlineItem {
  id: string;
  level: 2 | 3;
  heading: string;
  notes?: string;
}

interface OutlineEditorProps {
  title: string;
  outline: OutlineItem[];
  onChange: (outline: OutlineItem[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  generating?: boolean;
}

export default function OutlineEditor({
  title,
  outline,
  onChange,
  onConfirm,
  onCancel,
  generating = false,
}: OutlineEditorProps) {
  function updateItem(id: string, patch: Partial<OutlineItem>) {
    onChange(outline.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    onChange(outline.filter((item) => item.id !== id));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const next = direction === -1 ? index - 1 : index + 1;
    if (next < 0 || next >= outline.length) return;
    const updated = [...outline];
    [updated[index], updated[next]] = [updated[next], updated[index]];
    onChange(updated);
  }

  function addSection(level: 2 | 3) {
    const newItem: OutlineItem = {
      id: crypto.randomUUID(),
      level,
      heading: level === 2 ? "New Section" : "New Subsection",
      notes: "",
    };
    onChange([...outline, newItem]);
  }

  const containerStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--card-border)",
    borderRadius: "12px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--foreground)",
    margin: 0,
    paddingBottom: "12px",
    borderBottom: "1px solid var(--card-border)",
  };

  const itemRowStyle = (level: 2 | 3): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    paddingLeft: level === 3 ? "20px" : "0px",
  });

  const inputStyle = (level: 2 | 3): React.CSSProperties => ({
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    padding: "4px 8px",
    fontSize: level === 2 ? "14px" : "13px",
    fontWeight: level === 2 ? 600 : 400,
    color: level === 2 ? "var(--foreground)" : "var(--muted)",
    fontFamily: "inherit",
    cursor: "text",
  });

  const levelBadgeStyle = (level: 2 | 3): React.CSSProperties => ({
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 5px",
    borderRadius: "4px",
    border: "1px solid var(--card-border)",
    background: "transparent",
    color: "var(--muted)",
    cursor: "pointer",
    minWidth: "28px",
    textAlign: "center",
    flexShrink: 0,
    lineHeight: level === 2 ? "14px" : "14px",
  });

  const iconBtnStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--muted)",
    padding: "2px 4px",
    borderRadius: "4px",
    fontSize: "12px",
    lineHeight: 1,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const addBtnStyle: React.CSSProperties = {
    background: "transparent",
    border: "1px dashed var(--card-border)",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    color: "var(--muted)",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const confirmBtnStyle: React.CSSProperties = {
    background: "var(--accent)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: generating ? "not-allowed" : "pointer",
    opacity: generating ? 0.7 : 1,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "inherit",
  };

  const cancelBtnStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "var(--muted)",
    fontSize: "14px",
    cursor: "pointer",
    padding: "8px 4px",
    textDecoration: "underline",
    fontFamily: "inherit",
  };

  return (
    <div style={containerStyle}>
      <p style={titleStyle}>{title}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {outline.map((item, index) => (
          <div key={item.id} style={itemRowStyle(item.level)}>
            <button
              style={levelBadgeStyle(item.level)}
              title="Toggle H2/H3"
              onClick={() =>
                updateItem(item.id, { level: item.level === 2 ? 3 : 2 })
              }
            >
              H{item.level}
            </button>

            <input
              style={inputStyle(item.level)}
              value={item.heading}
              onChange={(e) => updateItem(item.id, { heading: e.target.value })}
              placeholder="Heading..."
            />

            <button
              style={iconBtnStyle}
              title="Move up"
              onClick={() => moveItem(index, -1)}
              disabled={index === 0}
            >
              ↑
            </button>
            <button
              style={iconBtnStyle}
              title="Move down"
              onClick={() => moveItem(index, 1)}
              disabled={index === outline.length - 1}
            >
              ↓
            </button>
            <button
              style={{ ...iconBtnStyle, color: "var(--destructive, #e53e3e)" }}
              title="Remove"
              onClick={() => removeItem(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button style={addBtnStyle} onClick={() => addSection(2)}>
          + Add H2 section
        </button>
        <button
          style={{ ...addBtnStyle, marginLeft: "20px" }}
          onClick={() => addSection(3)}
        >
          + Add H3 subsection
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "12px",
          paddingTop: "8px",
          borderTop: "1px solid var(--card-border)",
        }}
      >
        <button style={cancelBtnStyle} onClick={onCancel}>
          Cancel
        </button>
        <button style={confirmBtnStyle} onClick={onConfirm} disabled={generating}>
          {generating && (
            <span
              style={{
                width: "14px",
                height: "14px",
                border: "2px solid currentColor",
                borderTopColor: "transparent",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
              }}
            />
          )}
          Generate Article
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

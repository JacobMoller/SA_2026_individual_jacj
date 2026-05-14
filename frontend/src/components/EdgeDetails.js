export default function EdgeDetails({ edge, implicit }) {
  if (!edge) return null;
  return (
    <div className="settings-section">
      <strong>{implicit ? "Implicit edge" : "Dependency edge"}</strong>
      <div className="commit-meta">
        {edge.source} to {edge.target}
      </div>
      <div className="change-totals">
        <span>weight {edge.weight || 1}</span>
        {edge.changeStatus ? <span>{edge.changeStatus}</span> : null}
      </div>
      {edge.files?.length ? (
        <div className="change-list">
          {edge.files.slice(0, 16).map((file) => (
            <code key={file}>{file}</code>
          ))}
          {edge.files.length > 16 ? (
            <small>{edge.files.length - 16} more files</small>
          ) : null}
        </div>
      ) : null}
      {edge.imports?.length ? (
        <div className="change-list">
          {edge.imports.slice(0, 12).map((item, index) => (
            <div
              className="change-item"
              key={`${item.file}-${item.import}-${index}`}
            >
              <span>import</span>
              <code>{item.file}</code>
              <small>{item.import}</small>
            </div>
          ))}
          {edge.imports.length > 12 ? (
            <small>{edge.imports.length - 12} more imports</small>
          ) : null}
        </div>
      ) : null}
      {edge.evidence?.length ? (
        <div className="change-list">
          {edge.evidence.slice(-5).map((item) => (
            <div className="change-item" key={item.commit}>
              <span>{item.message}</span>
              {item.files.slice(0, 4).map((file) => (
                <code key={file}>{file}</code>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

import { totalAdded, totalDeleted } from "./utils";

function groupModuleChanges(changes, fallbackModules = []) {
  const groups = new Map();
  changes.forEach((change) => {
    const module = change.module || "unknown";
    const current = groups.get(module) || {
      module,
      files: [],
      addedLines: 0,
      deletedLines: 0,
      changeTypes: {},
    };
    current.files.push(change);
    current.addedLines += change.added_lines || 0;
    current.deletedLines += change.deleted_lines || 0;
    const type = change.change_type || "changed";
    current.changeTypes[type] = (current.changeTypes[type] || 0) + 1;
    groups.set(module, current);
  });

  fallbackModules.forEach((module) => {
    if (!groups.has(module)) {
      groups.set(module, {
        module,
        files: [],
        addedLines: 0,
        deletedLines: 0,
        changeTypes: { changed: 1 },
      });
    }
  });

  return [...groups.values()].sort((a, b) => a.module.localeCompare(b.module));
}

function formatChangeTypes(changeTypes) {
  return Object.entries(changeTypes)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
}

export default function CommitSummary({ snapshot }) {
  const changes = snapshot?.module_changes || [];
  const moduleChanges = groupModuleChanges(
    changes,
    snapshot?.changed_modules || []
  );
  if (!snapshot) return <div className="empty-panel">Select a commit.</div>;
  return (
    <div className="settings-section">
      <strong>Commit changes</strong>
      <div className="commit-meta">{snapshot.message}</div>
      <div className="change-totals">
        <span>+{totalAdded(snapshot)}</span>
        <span>-{totalDeleted(snapshot)}</span>
      </div>
      <div className="change-list">
        {moduleChanges.map((moduleChange) => (
          <details className="module-change" key={moduleChange.module}>
            <summary>
              <span>{moduleChange.module}</span>
              <small>
                {formatChangeTypes(moduleChange.changeTypes)} ·{" "}
                {moduleChange.files.length || 1} file
                {moduleChange.files.length === 1 ? "" : "s"} · +
                {moduleChange.addedLines} -{moduleChange.deletedLines}
              </small>
            </summary>
            {moduleChange.files.length ? (
              <div className="change-list nested">
                {moduleChange.files.map((change) => (
                  <div
                    className="change-item"
                    key={`${change.path}-${change.change_type}`}
                  >
                    <span>{change.change_type}</span>
                    <code>{change.path}</code>
                    <small>
                      +{change.added_lines || 0} -{change.deleted_lines || 0}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="commit-meta">
                Regenerate snapshots to see file-level changes.
              </div>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

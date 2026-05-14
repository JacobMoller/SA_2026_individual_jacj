const architectureRules = [
  {
    id: "acyclic",
    title: "No dependency cycles",
    description: "Modules should not form circular dependency chains.",
  },
  {
    id: "layer-direction",
    title: "Dependencies point inward",
    description:
      "Higher-level modules may depend on lower-level modules, not the other way around.",
  },
  {
    id: "forbidden-dependencies",
    title: "Forbidden dependency patterns",
    description:
      "Dependencies matching the editable forbidden list are reported.",
  },
];

export default function ArchitectureRules({
  ruleConfig,
  onRuleConfigChange,
  violations,
}) {
  const violationsByRule = architectureRules.reduce((acc, rule) => {
    acc[rule.id] = violations.filter(
      (violation) => violation.ruleId === rule.id
    );
    return acc;
  }, {});

  return (
    <div className="settings-section">
      <strong>Architecture rules</strong>
      <div className="commit-meta">
        Evaluated on the accumulated module graph up to the selected commit.
      </div>
      <label className="field-label" htmlFor="layer-rule">
        Layer order
      </label>
      <input
        id="layer-rule"
        className="settings-input"
        value={ruleConfig.layerRule}
        onChange={(event) =>
          onRuleConfigChange((current) => ({
            ...current,
            layerRule: event.target.value,
          }))
        }
      />
      <div className="commit-meta">
        Lower layers are allowed targets for higher layers.
      </div>
      <label className="field-label" htmlFor="forbidden-dependencies">
        Forbidden dependencies
      </label>
      <textarea
        id="forbidden-dependencies"
        className="settings-textarea"
        value={ruleConfig.forbiddenDependencies}
        onChange={(event) =>
          onRuleConfigChange((current) => ({
            ...current,
            forbiddenDependencies: event.target.value,
          }))
        }
      />
      <div className="commit-meta">
        One rule per line, e.g. <code>core -&gt; api</code> or{" "}
        <code>api -&gt; ci</code>.
      </div>
      <div className="rule-list">
        {architectureRules.map((rule) => {
          const ruleViolations = violationsByRule[rule.id] || [];
          return (
            <details className="rule-item" key={rule.id} open={false}>
              <summary>
                <span>{rule.title}</span>
                <small
                  className={
                    ruleViolations.length ? "violation-count" : "ok-count"
                  }
                >
                  {ruleViolations.length
                    ? `${ruleViolations.length} violation(s)`
                    : "ok"}
                </small>
              </summary>
              <div className="commit-meta">{rule.description}</div>
              {ruleViolations.length ? (
                <div className="change-list nested">
                  {ruleViolations.slice(0, 8).map((violation, index) => (
                    <div
                      className="change-item"
                      key={`${violation.ruleId}-${violation.detail}-${index}`}
                    >
                      <span>{violation.title}</span>
                      <code>{violation.detail}</code>
                      {violation.evidence?.length ? (
                        <div className="change-list nested">
                          {violation.evidence
                            .slice(0, 4)
                            .map((item, evidenceIndex) => (
                              <code
                                key={`${item.file}-${item.import}-${evidenceIndex}`}
                              >
                                {item.file}
                                {item.import ? ` imports ${item.import}` : ""}
                              </code>
                            ))}
                          {violation.evidence.length > 4 ? (
                            <small>
                              {violation.evidence.length - 4} more imports
                            </small>
                          ) : null}
                        </div>
                      ) : (
                        <small>
                          Regenerate snapshots to see import-level evidence.
                        </small>
                      )}
                    </div>
                  ))}
                  {ruleViolations.length > 8 ? (
                    <small>{ruleViolations.length - 8} more violations</small>
                  ) : null}
                </div>
              ) : null}
            </details>
          );
        })}
      </div>
    </div>
  );
}

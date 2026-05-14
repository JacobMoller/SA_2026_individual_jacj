import React, { useEffect, useRef, useState, useMemo } from "react";
import { Timeline } from "vis-timeline/standalone";
import { DataSet } from "vis-data";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import SigmaRenderer from "./SigmaRenderer";
import ArchitectureRules from "./components/ArchitectureRules";
import CommitSummary from "./components/CommitSummary";
import EdgeDetails from "./components/EdgeDetails";
import { totalAdded, totalDeleted } from "./components/utils";
import "./App.css";

const emptyGraph = { nodes: [], edges: [] };
const defaultLayerRule = "config, logging > core > operations > api > ci";
const defaultForbiddenDependencies =
  "api -> ci\ncore -> ci\noperations -> ci\nconfig -> ci\nlogging -> ci";
const moduleAliases = {
  cl: "ci",
};

function edgeKey(edge) {
  return `${edge.source}->${edge.target}`;
}

function parseComponentFilter(value) {
  return value
    .split(",")
    .map((item) => normalizeModuleId(item.trim()))
    .filter(Boolean);
}

function parseLayerRule(value) {
  const layers = {};
  value
    .split(">")
    .map((group) =>
      group
        .split(",")
        .map((item) => normalizeModuleId(item.trim()))
        .filter(Boolean)
    )
    .forEach((modules, index) => {
      modules.forEach((module) => {
        layers[module] = index;
      });
    });
  return layers;
}

function parseForbiddenDependencies(value) {
  return value
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [source = "", target = ""] = line
        .split("->")
        .map((item) => item.trim());
      const sources = source
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const targets = target
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return sources.flatMap((sourcePattern) =>
        targets.map((targetPattern) => ({
          source:
            normalizeModuleId(sourcePattern.replace(/^!/, "")) ||
            sourcePattern.replace(/^!/, ""),
          sourceNegated: sourcePattern.startsWith("!"),
          target:
            normalizeModuleId(targetPattern.replace(/^!/, "")) ||
            targetPattern.replace(/^!/, ""),
          targetNegated: targetPattern.startsWith("!"),
        }))
      );
    });
}

function matchesPattern(value, pattern, negated) {
  const matches = pattern === "*" || value === pattern;
  return negated ? !matches : matches;
}

function normalizeModuleId(id) {
  if (!id) return null;
  let parts = String(id).split(".");
  if (parts[0] === "zeeguu") {
    parts = parts.slice(1);
  }
  if (!parts.length) return null;
  if (parts[0].startsWith("zeeguu_")) {
    parts[0] = parts[0].replace(/^zeeguu_/, "");
  }
  const normalized = parts.join(".");
  return moduleAliases[normalized] || normalized;
}

function normalizeGraph(graph = emptyGraph) {
  const nodeIds = new Set();
  const edges = new Map();

  graph.nodes?.forEach((node) => {
    const id = normalizeModuleId(node.id);
    if (id) nodeIds.add(id);
  });

  graph.edges?.forEach((edge) => {
    const source = normalizeModuleId(edge.source);
    const target = normalizeModuleId(edge.target);
    if (!source || !target || source === target) return;
    const key = `${source}->${target}`;
    const existing = edges.get(key);
    edges.set(key, {
      ...existing,
      ...edge,
      source,
      target,
      weight: (existing?.weight || 0) + (edge.weight || 1),
      files: [...new Set([...(existing?.files || []), ...(edge.files || [])])],
      imports: [...(existing?.imports || []), ...(edge.imports || [])],
      evidence: [...(existing?.evidence || []), ...(edge.evidence || [])],
    });
    nodeIds.add(source);
    nodeIds.add(target);
  });

  return {
    nodes: [...nodeIds].sort().map((id) => ({ id })),
    edges: [...edges.values()],
  };
}

function normalizeSnapshot(snapshot) {
  const moduleChanges = (snapshot.module_changes || [])
    .map((change) => ({
      ...change,
      module: normalizeModuleId(change.module),
    }))
    .filter((change) => change.module);
  const changedModules = [
    ...new Set(
      (snapshot.changed_modules || []).map(normalizeModuleId).filter(Boolean)
    ),
  ].sort();

  return {
    ...snapshot,
    graph: normalizeGraph(snapshot.graph),
    changed_modules: changedModules,
    module_changes: moduleChanges,
    implicit_dependencies: normalizeGraph(snapshot.implicit_dependencies),
  };
}

function buildEvolutionGraph(snapshots, selectedIndex) {
  const selectedSnapshots = snapshots.slice(0, selectedIndex + 1);
  const currentSnapshot = snapshots[selectedIndex];
  const previousSnapshot = snapshots[selectedIndex - 1];
  const currentGraph = currentSnapshot?.graph || emptyGraph;
  const previousGraph = previousSnapshot?.graph || emptyGraph;
  const changedModules = new Set(currentSnapshot?.changed_modules || []);
  const moduleChanges = currentSnapshot?.module_changes || [];
  const changesByModule = moduleChanges.reduce((acc, change) => {
    acc[change.module] = acc[change.module] || [];
    acc[change.module].push(change);
    return acc;
  }, {});

  const currentNodes = new Set(currentGraph.nodes.map((node) => node.id));
  const previousNodes = new Set(previousGraph.nodes.map((node) => node.id));
  const accumulatedNodes = new Map();
  selectedSnapshots.forEach((snapshot, index) => {
    snapshot.graph?.nodes?.forEach((node) => {
      if (!accumulatedNodes.has(node.id)) {
        accumulatedNodes.set(node.id, {
          id: node.id,
          firstSeenIndex: index,
          firstSeenCommit: snapshot.commit,
          firstSeenDate: snapshot.date,
        });
      }
      const current = accumulatedNodes.get(node.id);
      accumulatedNodes.set(node.id, {
        ...current,
        lastSeenIndex: index,
        lastSeenCommit: snapshot.commit,
        lastSeenDate: snapshot.date,
      });
    });
    snapshot.changed_modules?.forEach((module) => {
      if (!accumulatedNodes.has(module)) {
        accumulatedNodes.set(module, {
          id: module,
          firstSeenIndex: index,
          firstSeenCommit: snapshot.commit,
          firstSeenDate: snapshot.date,
        });
      }
    });
  });

  const previousEdges = new Map(
    previousGraph.edges.map((edge) => [edgeKey(edge), edge])
  );
  const currentEdges = new Map(
    currentGraph.edges.map((edge) => [edgeKey(edge), edge])
  );
  const accumulatedEdges = new Map();
  selectedSnapshots.forEach((snapshot, index) => {
    snapshot.graph?.edges?.forEach((edge) => {
      const key = edgeKey(edge);
      const existing = accumulatedEdges.get(key);
      accumulatedEdges.set(key, {
        ...existing,
        ...edge,
        firstSeenIndex: existing?.firstSeenIndex ?? index,
        firstSeenCommit: existing?.firstSeenCommit ?? snapshot.commit,
        firstSeenDate: existing?.firstSeenDate ?? snapshot.date,
        lastSeenIndex: index,
        lastSeenCommit: snapshot.commit,
        lastSeenDate: snapshot.date,
        maxWeight: Math.max(existing?.maxWeight || 0, edge.weight || 1),
        files: [
          ...new Set([...(existing?.files || []), ...(edge.files || [])]),
        ],
        imports: [...(existing?.imports || []), ...(edge.imports || [])],
        evidence: [...(existing?.evidence || []), ...(edge.evidence || [])],
      });
    });
  });

  return {
    nodes: [...accumulatedNodes.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((node) => ({
        ...node,
        changeStatus: !currentNodes.has(node.id)
          ? "removed"
          : !previousNodes.has(node.id)
          ? "added"
          : changedModules.has(node.id)
          ? "changed"
          : "unchanged",
        changes: changesByModule[node.id] || [],
      })),
    edges: [...accumulatedEdges.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, edge]) => {
        const current = currentEdges.get(id);
        const previous = previousEdges.get(id);
        return {
          ...edge,
          weight: current?.weight || edge.maxWeight || edge.weight || 1,
          changeStatus: !current
            ? "removed"
            : !previous
            ? "added"
            : "unchanged",
        };
      }),
  };
}

function filterGraph(graph, hiddenModules, focusedModules = []) {
  const hidden = new Set(hiddenModules);
  const focused = new Set(focusedModules);
  return {
    nodes: graph.nodes.filter(
      (node) => !hidden.has(node.id) && (!focused.size || focused.has(node.id))
    ),
    edges: graph.edges.filter(
      (edge) =>
        !hidden.has(edge.source) &&
        !hidden.has(edge.target) &&
        (!focused.size ||
          (focused.has(edge.source) && focused.has(edge.target)))
    ),
  };
}

function buildImplicitGraphFromTimeline(snapshots, selectedIndex) {
  const counts = new Map();
  const evidence = new Map();
  const modules = new Set();

  snapshots.slice(0, selectedIndex + 1).forEach((snapshot) => {
    const changedModules = [...new Set(snapshot.changed_modules || [])].sort();
    changedModules.forEach((module) => modules.add(module));
    snapshot.graph?.nodes?.forEach((node) => modules.add(node.id));

    for (let i = 0; i < changedModules.length; i += 1) {
      for (let j = i + 1; j < changedModules.length; j += 1) {
        const source = changedModules[i];
        const target = changedModules[j];
        const key = `${source}--${target}`;
        counts.set(key, (counts.get(key) || 0) + 1);
        const files = (snapshot.module_changes || [])
          .filter(
            (change) => change.module === source || change.module === target
          )
          .map((change) => change.path);
        evidence.set(key, [
          ...(evidence.get(key) || []),
          {
            commit: snapshot.commit,
            date: snapshot.date,
            message: snapshot.message,
            files,
          },
        ]);
      }
    }
  });

  return {
    nodes: [...modules].sort().map((id) => ({ id })),
    edges: [...counts.entries()].map(([key, weight]) => {
      const [source, target] = key.split("--");
      const edgeEvidence = evidence.get(key) || [];
      return {
        source,
        target,
        weight,
        commits: edgeEvidence.length,
        files: [
          ...new Set(edgeEvidence.flatMap((item) => item.files || [])),
        ].sort(),
        evidence: edgeEvidence.slice(-10),
        implicit: true,
        changeStatus: "implicit",
      };
    }),
  };
}

function findCycles(graph) {
  const adjacency = graph.nodes.reduce((acc, node) => {
    acc[node.id] = [];
    return acc;
  }, {});
  graph.edges.forEach((edge) => {
    if (adjacency[edge.source] && adjacency[edge.target]) {
      adjacency[edge.source].push(edge.target);
    }
  });

  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const path = [];

  function visit(node) {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      if (start >= 0) {
        const cycle = [...path.slice(start), node];
        const key = cycle.join("->");
        if (!cycles.some((item) => item.key === key)) {
          cycles.push({ key, modules: cycle });
        }
      }
      return;
    }
    if (visited.has(node)) return;

    visiting.add(node);
    path.push(node);
    adjacency[node]?.forEach(visit);
    path.pop();
    visiting.delete(node);
    visited.add(node);
  }

  graph.nodes.forEach((node) => visit(node.id));
  return cycles;
}

function edgeEvidence(edge) {
  const imports = edge.imports || [];
  if (imports.length) return imports;
  return (edge.files || []).map((file) => ({ file, import: "" }));
}

function cycleEvidence(graph, modules) {
  const edges = new Map(graph.edges.map((edge) => [edgeKey(edge), edge]));
  return modules.slice(0, -1).flatMap((source, index) => {
    const target = modules[index + 1];
    return edgeEvidence(edges.get(`${source}->${target}`) || {});
  });
}

function evaluateArchitectureRules(graph, ruleConfig) {
  const violations = [];
  const architectureLayers = parseLayerRule(ruleConfig.layerRule);
  const forbiddenDependencies = parseForbiddenDependencies(
    ruleConfig.forbiddenDependencies
  );

  findCycles(graph).forEach((cycle) => {
    violations.push({
      ruleId: "acyclic",
      title: "Dependency cycle",
      modules: cycle.modules,
      detail: cycle.modules.join(" -> "),
      evidence: cycleEvidence(graph, cycle.modules),
    });
  });

  graph.edges.forEach((edge) => {
    const sourceLayer = architectureLayers[edge.source];
    const targetLayer = architectureLayers[edge.target];
    if (
      sourceLayer !== undefined &&
      targetLayer !== undefined &&
      sourceLayer < targetLayer
    ) {
      violations.push({
        ruleId: "layer-direction",
        title: "Dependency points outward",
        modules: [edge.source, edge.target],
        detail: `${edge.source} depends on ${edge.target}`,
        evidence: edgeEvidence(edge),
      });
    }
    forbiddenDependencies
      .filter(
        (rule) =>
          matchesPattern(edge.source, rule.source, rule.sourceNegated) &&
          matchesPattern(edge.target, rule.target, rule.targetNegated)
      )
      .forEach(() => {
        violations.push({
          ruleId: "forbidden-dependencies",
          title: "Forbidden dependency",
          modules: [edge.source, edge.target],
          detail: `${edge.source} depends on ${edge.target}`,
          evidence: edgeEvidence(edge),
        });
      });
  });

  return violations;
}

export default function App() {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const [timeline, setTimeline] = useState([]);
  const [isSettingsVisible, setIsSettingsVisible] = React.useState(true);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [showImplicitDependencies, setShowImplicitDependencies] =
    useState(false);
  const [hiddenModules, setHiddenModules] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [componentFilter, setComponentFilter] = useState(
    "api, ci, config, core, logging, operations"
  );
  const [ruleConfig, setRuleConfig] = useState({
    layerRule: defaultLayerRule,
    forbiddenDependencies: defaultForbiddenDependencies,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const convertToVisFormat = (snapshots) => {
      return snapshots.map((snapshot) => ({
        id: snapshot.commit,
        content: `${snapshot.message} (+${totalAdded(snapshot)} -${totalDeleted(
          snapshot
        )})`,
        start: snapshot.date,
      }));
    };

    const options = {
      stack: true,
      height: "30vh",
      showCurrentTime: true,

      // zooming + scaling behavior
      zoomable: true,
      zoomMin: 1000 * 60 * 60 * 24 * 30, // ~1 month
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 10, // TODO: Make dynamic based on repo

      selectable: true,
      multiselect: true,

      moveable: true,
      editable: false,

      margin: {
        item: 10,
        axis: 20,
      },

      orientation: "bottom",
    };

    fetch("/snapshots.json")
      .then((response) => response.json())
      .then((data) => data.map(normalizeSnapshot))
      .then((data) => {
        setTimeline(data);
        setSelectedCommit(data[data.length - 1]?.commit || null);

        if (timelineRef.current) {
          timelineRef.current.destroy();
        }

        var dataSet = new DataSet(convertToVisFormat(data));

        timelineRef.current = new Timeline(
          containerRef.current,
          dataSet,
          options
        );

        timelineRef.current.setWindow(
          dataSet
            .get()
            .map((item) => item.start)
            .sort()[0],
          new Date()
        );

        // set specific timeline if item is selected
        timelineRef.current.on("select", (props) => {
          console.log("Selected items:", props.items);
          const selectedTimeline = data.find(
            (snapshot) => snapshot.commit === props.items[0]
          );
          if (selectedTimeline) {
            setSelectedCommit(selectedTimeline.commit);
            setSelectedNode(null);
            setSelectedEdge(null);
          } else {
            setSelectedCommit(null);
            setSelectedNode(null);
            setSelectedEdge(null);
          }
        });
      })
      .catch((err) => {
        console.error(err);
      });

    //timelineRef.current.setWindow("2019-01-01", "2025-12-31"); //TODO: Set period of first and last commit

    //timelineRef.current.on("rangechanged", (props) => {
    //  console.log("Selected range:", props.start, props.end);

    // TODO: hold state for Sigma graph updating - Select commits closes to selected range?
    // setTimeRange({ from: props.start, to: props.end });
    //});

    return () => {
      timelineRef.current?.destroy();
    };
  }, []);

  const selectedIndex = timeline.findIndex(
    (snapshot) => snapshot.commit === selectedCommit
  );
  const selectedSnapshot = selectedIndex >= 0 ? timeline[selectedIndex] : null;

  const structuralGraph = useMemo(() => {
    if (!selectedSnapshot) return emptyGraph;
    return buildEvolutionGraph(timeline, selectedIndex);
  }, [selectedSnapshot, timeline, selectedIndex]);

  const visibleGraph = useMemo(() => {
    if (!selectedSnapshot) return emptyGraph;
    const focusedModules = parseComponentFilter(componentFilter);
    const implicitGraph =
      selectedSnapshot.implicit_dependencies?.edges?.length ||
      selectedSnapshot.implicit_dependencies?.nodes?.length
        ? selectedSnapshot.implicit_dependencies
        : buildImplicitGraphFromTimeline(timeline, selectedIndex);
    const graph = showImplicitDependencies
      ? {
          nodes: implicitGraph.nodes || [],
          edges: (implicitGraph.edges || []).map((edge) => ({
            ...edge,
            implicit: true,
            changeStatus: "implicit",
          })),
        }
      : structuralGraph;
    return filterGraph(graph, hiddenModules, focusedModules);
  }, [
    selectedSnapshot,
    showImplicitDependencies,
    hiddenModules,
    componentFilter,
    timeline,
    selectedIndex,
    structuralGraph,
  ]);

  const ruleViolations = useMemo(
    () => evaluateArchitectureRules(structuralGraph, ruleConfig),
    [structuralGraph, ruleConfig]
  );

  const play = () => {
    if (!timeline.length) return;
    let currentIndex = 0;

    const interval = setInterval(() => {
      const snapshot = timeline[currentIndex];
      setSelectedCommit(snapshot.commit);
      setSelectedNode(null);
      setSelectedEdge(null);
      timelineRef.current?.setSelection(snapshot.commit);
      timelineRef.current?.moveTo(snapshot.date);
      currentIndex += 1;
      if (currentIndex >= timeline.length) {
        clearInterval(interval);
      }
    }, 450);
  };

  const toggleModule = (module) => {
    setHiddenModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module]
    );
  };

  return (
    <div className="app-shell">
      {isSettingsVisible ? (
        <div className="settings-panel">
          <div className="settings-header">
            <strong>Settings</strong>
            <button onClick={() => setIsSettingsVisible(false)}>Hide</button>
          </div>
          <label className="setting-row">
            <input
              type="checkbox"
              checked={showImplicitDependencies}
              onChange={(event) => {
                setShowImplicitDependencies(event.target.checked);
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
            />
            Show implicit dependencies
          </label>
          <ComponentFilter
            value={componentFilter}
            onChange={setComponentFilter}
          />
          {showImplicitDependencies ? <ImplicitDependencyHelp /> : null}
          <SelectionActions
            selectedNode={selectedNode}
            hiddenModules={hiddenModules}
            onToggleModule={toggleModule}
          />
          <ArchitectureRules
            ruleConfig={ruleConfig}
            onRuleConfigChange={setRuleConfig}
            violations={ruleViolations}
          />
          <CommitSummary snapshot={selectedSnapshot} />
          <EdgeDetails
            edge={selectedEdge}
            implicit={showImplicitDependencies}
          />
        </div>
      ) : (
        <button
          onClick={() => setIsSettingsVisible(true)}
          style={{ position: "absolute", top: 10, left: 10, zIndex: 1000 }}
        >
          Settings
        </button>
      )}
      <div className="graph-column">
        <div style={{ flex: 1, position: "relative" }}>
          <SigmaRenderer
            graph={visibleGraph}
            layoutEditKey="Shift"
            onNodeClick={(node) => {
              setSelectedNode(node);
              setSelectedEdge(null);
            }}
            onEdgeClick={(edge) => {
              setSelectedEdge(edge);
              setSelectedNode(null);
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              margin: "5px",
            }}
          >
            <button onClick={play}>Play timeline</button>
          </div>
        </div>
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: "100%",
            backgroundColor: "white",
          }}
          ref={containerRef}
        />
      </div>
    </div>
  );
}

function ComponentFilter({ value, onChange }) {
  return (
    <div className="settings-section">
      <label className="field-label" htmlFor="component-filter">
        Components to show
      </label>
      <input
        id="component-filter"
        className="settings-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="api, ci, config, core, logging, operations"
      />
      <div className="commit-meta">
        Leave empty to show all modules. Use comma-separated module names.
      </div>
    </div>
  );
}

function ImplicitDependencyHelp() {
  return (
    <div className="settings-section">
      <strong>Co-change dependencies</strong>
      <div className="commit-meta">
        These are not import dependencies. They connect modules that changed
        together in the same commits. The edge weight is the number of
        co-changing commits; click an edge to inspect the commits and files.
      </div>
    </div>
  );
}

function SelectionActions({ selectedNode, hiddenModules, onToggleModule }) {
  const selectedNodeIsHidden =
    selectedNode && hiddenModules.includes(selectedNode.id);
  return (
    <div className="settings-section">
      <strong>Selected module</strong>
      {selectedNode ? (
        <>
          <div className="commit-meta">{selectedNode.id}</div>
          <button
            className="context-button"
            onClick={() => onToggleModule(selectedNode.id)}
          >
            {selectedNodeIsHidden
              ? "Show selected module"
              : "Hide selected module"}
          </button>
        </>
      ) : (
        <div className="commit-meta">
          Click a module in the graph to hide it.
        </div>
      )}
      <div className="commit-meta">
        Hold Shift and drag a module to adjust the layout.
      </div>
      {hiddenModules.length ? (
        <div className="hidden-list">
          <small>Hidden modules</small>
          {hiddenModules.map((module) => (
            <button
              key={module}
              className="module-button hidden"
              onClick={() => onToggleModule(module)}
            >
              Show {module}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

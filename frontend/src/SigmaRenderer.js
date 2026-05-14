import { useEffect } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import { useRef } from "react";

const sigmaStyle = {
  height: "70vh",
  width: "100%",
  backgroundColor: "#f0f0f0",
};

const nodeColors = {
  added: "#2f9e44",
  removed: "#c92a2a",
  changed: "#f08c00",
  unchanged: "#4FA3FA",
};

const edgeColors = {
  added: "#2f9e44",
  removed: "#c92a2a",
  implicit: "#7048e8",
  unchanged: "#6c757d",
};

function hasReverseEdge(edge, allEdges) {
  return allEdges.some(
    (candidate) =>
      candidate.source === edge.target &&
      candidate.target === edge.source &&
      candidate.implicit === edge.implicit
  );
}

function reciprocalAnchor(edge, graph, index) {
  const source = graph.getNodeAttributes(edge.source);
  const target = graph.getNodeAttributes(edge.target);
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const direction = edge.source < edge.target ? 1 : -1;
  const offset = 1.6 * direction;

  return {
    id: `anchor:${edge.source}:${edge.target}:${index}`,
    x: (source.x + target.x) / 2 + (-dy / length) * offset,
    y: (source.y + target.y) / 2 + (dx / length) * offset,
  };
}

function edgeVisualAttributes(edge, label = edge.weight?.toString() || "") {
  return {
    ...edge,
    label,
    weight: edge.weight || 1,
    size: Math.max(1, Math.min(edge.weight || 1, 8)),
    color: edgeColors[edge.changeStatus] || edgeColors.unchanged,
  };
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function fallbackPosition(id) {
  const hash = hashString(id);
  const angle = ((hash % 3600) / 3600) * Math.PI * 2;
  const radius = 8 + ((hash >> 4) % 12);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

// Component that load the graph
export const LoadGraph = ({
  graphData,
  layoutEditKey,
  onNodeClick,
  onEdgeClick,
}) => {
  console.log("Loading graph with data:", graphData);
  const sigma = useSigma();
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const positionsRef = useRef({});
  const draggedNodeRef = useRef(null);
  const layoutEditActiveRef = useRef(false);

  useEffect(() => {
    const isLayoutEditKey = (event) => event.key === layoutEditKey;
    const handleKeyDown = (event) => {
      if (isLayoutEditKey(event)) {
        layoutEditActiveRef.current = true;
      }
    };
    const handleKeyUp = (event) => {
      if (isLayoutEditKey(event)) {
        layoutEditActiveRef.current = false;
        draggedNodeRef.current = null;
        sigma.getMouseCaptor().enabled = true;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [layoutEditKey, sigma]);

  useEffect(() => {
    const graph = new Graph({ type: "directed" });
    const savedPositionCount = Object.keys(positionsRef.current).length;
    let missingPositionCount = 0;

    registerEvents({
      // node events
      downNode: (event) => {
        const original = event.event.original;

        if (!original.shiftKey) return;

        const node = graph.getNodeAttributes(event.node);

        if (node.isAnchor) return;

        draggedNodeRef.current = event.node;

        sigma.getMouseCaptor().enabled = false;

        event.preventSigmaDefault();
        original.preventDefault();
      },
      clickNode: (event) => {
        const node = graph.getNodeAttributes(event.node);
        if (!node.isAnchor) {
          onNodeClick?.({ id: event.node, ...node });
        }
      },
      clickEdge: (event) => {
        const edge = graph.getEdgeAttributes(event.edge);
        onEdgeClick?.(edge);
      },
      mousemovebody: (event) => {
        if (!draggedNodeRef.current) return;
        const position = sigma.viewportToGraph(event);
        graph.setNodeAttribute(draggedNodeRef.current, "x", position.x);
        graph.setNodeAttribute(draggedNodeRef.current, "y", position.y);
        positionsRef.current[draggedNodeRef.current] = position;
        sigma.scheduleRender();
      },
      mouseup: () => {
        if (!draggedNodeRef.current) return;
        draggedNodeRef.current = null;
        sigma.getMouseCaptor().enabled = true;
      },
    });

    // Add nodes
    graphData?.nodes.forEach((node) => {
      const position =
        positionsRef.current[node.id] || fallbackPosition(node.id);
      if (!positionsRef.current[node.id]) {
        missingPositionCount += 1;
      }
      graph.addNode(node.id, {
        x: position.x,
        y: position.y,
        size: node.changeStatus === "changed" ? 18 : 15,
        label: node.id,
        color: nodeColors[node.changeStatus] || nodeColors.unchanged,
        changeStatus: node.changeStatus,
        changes: node.changes || [],
      });
    });

    // Add edges
    graphData?.edges.forEach((edge) => {
      const key = edge.implicit
        ? [edge.source, edge.target].sort().join("--")
        : `${edge.source}->${edge.target}`;
      if (!hasReverseEdge(edge, graphData?.edges || [])) {
        graph.addDirectedEdgeWithKey(
          key,
          edge.source,
          edge.target,
          edgeVisualAttributes(edge)
        );
      }
    });

    if (
      missingPositionCount > 0 &&
      savedPositionCount === 0 &&
      graph.order > 1
    ) {
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: {
          gravity: 1,
          scalingRatio: 10,
          strongGravityMode: true,
        },
      });
    }

    graph.forEachNode((node, attributes) => {
      if (!attributes.isAnchor) {
        positionsRef.current[node] = { x: attributes.x, y: attributes.y };
      }
    });

    graphData?.edges.forEach((edge, index) => {
      if (!hasReverseEdge(edge, graphData?.edges || [])) return;

      const anchor = reciprocalAnchor(edge, graph, index);
      graph.addNode(anchor.id, {
        x: anchor.x,
        y: anchor.y,
        size: 0.01,
        label: "",
        color: "rgba(0, 0, 0, 0)",
        isAnchor: true,
      });

      const key = edge.implicit
        ? [edge.source, edge.target].sort().join("--")
        : `${edge.source}->${edge.target}`;
      const attrs = edgeVisualAttributes(edge);
      graph.addDirectedEdgeWithKey(`${key}:lead`, edge.source, anchor.id, {
        ...attrs,
        label: "",
        type: "line",
      });
      graph.addDirectedEdgeWithKey(
        `${key}:arrow`,
        anchor.id,
        edge.target,
        attrs
      );
    });

    loadGraph(graph);
  }, [
    graphData?.edges,
    graphData?.nodes,
    loadGraph,
    onEdgeClick,
    onNodeClick,
    registerEvents,
    sigma,
  ]);

  return null;
};

function SigmaRenderer({
  graph,
  layoutEditKey = "Shift",
  onNodeClick,
  onEdgeClick,
}) {
  console.log("Rendering Sigma with graph:", graph);
  return (
    <SigmaContainer
      style={sigmaStyle}
      settings={{
        renderEdgeLabels: true,
        enableEdgeEvents: true,
        defaultEdgeType: "arrow",
      }}
    >
      <LoadGraph
        graphData={graph}
        layoutEditKey={layoutEditKey}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
      />
    </SigmaContainer>
  );
}

export default SigmaRenderer;

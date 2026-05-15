import { useCallback, useEffect, useRef } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core";
import { EdgeDoubleArrowProgram } from "sigma/rendering";
import "@react-sigma/core/lib/style.css";

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

function reverseEdge(edge, allEdges) {
  if (edge.source === edge.target) return undefined;

  return allEdges.find(
    (candidate) =>
      candidate.source === edge.target &&
      candidate.target === edge.source &&
      candidate.implicit === edge.implicit
  );
}

function reciprocalKey(edge) {
  const [a, b] = [edge.source, edge.target].sort();
  return `${edge.implicit ? "implicit" : "dependency"}:${a}<->${b}`;
}

function edgeVisualAttributes(
  edge,
  label = edge.weight?.toString() || "",
  type
) {
  return {
    ...edge,
    label,
    weight: edge.weight || 1,
    size: Math.max(1, Math.min(edge.weight || 1, 8)),
    color: edgeColors[edge.changeStatus] || edgeColors.unchanged,
    ...(type ? { type } : {}),
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
  const layoutEditActiveRef = useRef(false);
  const dragRef = useRef({
    node: null,
    hasMoved: false,
    restoreCameraPanning: true,
  });

  const endNodeDrag = useCallback(() => {
    if (!dragRef.current.node) return;

    sigma.setSetting(
      "enableCameraPanning",
      dragRef.current.restoreCameraPanning
    );
    dragRef.current.node = null;
    dragRef.current.restoreCameraPanning = true;
  }, [sigma]);

  useEffect(() => {
    const isLayoutEditKey = (event) =>
      event.key === layoutEditKey || event.code === layoutEditKey;
    const handleKeyDown = (event) => {
      if (isLayoutEditKey(event)) {
        layoutEditActiveRef.current = true;
      }
    };
    const handleKeyUp = (event) => {
      if (isLayoutEditKey(event)) {
        layoutEditActiveRef.current = false;
        endNodeDrag();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [endNodeDrag, layoutEditKey]);

  useEffect(() => {
    const graph = new Graph({ type: "directed" });
    const savedPositionCount = Object.keys(positionsRef.current).length;
    let missingPositionCount = 0;

    registerEvents({
      // node events
      downNode: (event) => {
        const original = event.event.original;

        if (!original?.shiftKey && !layoutEditActiveRef.current) return;

        const node = graph.getNodeAttributes(event.node);

        if (node.isAnchor) return;

        dragRef.current.node = event.node;
        dragRef.current.hasMoved = false;
        dragRef.current.restoreCameraPanning = sigma.getSetting(
          "enableCameraPanning"
        );
        sigma.setSetting("enableCameraPanning", false);

        event.preventSigmaDefault();
        original?.preventDefault();
      },
      clickNode: (event) => {
        if (dragRef.current.hasMoved) {
          dragRef.current.hasMoved = false;
          return;
        }

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
        if (!dragRef.current.node) return;
        event.preventSigmaDefault();
        event.original?.preventDefault();
        const position = sigma.viewportToGraph(event);
        graph.setNodeAttribute(dragRef.current.node, "x", position.x);
        graph.setNodeAttribute(dragRef.current.node, "y", position.y);
        positionsRef.current[dragRef.current.node] = position;
        dragRef.current.hasMoved = true;
        sigma.scheduleRender();
      },
      mouseup: () => {
        endNodeDrag();
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

    // Add edges. Reciprocal dependencies render as one double-arrow edge.
    const processedReciprocalEdges = new Set();
    graphData?.edges.forEach((edge) => {
      const allEdges = graphData?.edges || [];
      const reciprocal = reverseEdge(edge, allEdges);

      if (reciprocal) {
        const key = reciprocalKey(edge);
        if (processedReciprocalEdges.has(key)) return;

        processedReciprocalEdges.add(key);
        graph.addDirectedEdgeWithKey(
          key,
          edge.source,
          edge.target,
          edgeVisualAttributes(
            {
              ...edge,
              reciprocalEdges: [edge, reciprocal],
              isBidirectional: true,
              weight: Math.max(edge.weight || 1, reciprocal.weight || 1),
            },
            `${edge.weight || 1}/${reciprocal.weight || 1}`,
            "doubleArrow"
          )
        );
        return;
      }

      const key = edge.implicit
        ? [edge.source, edge.target].sort().join("--")
        : `${edge.source}->${edge.target}`;
      graph.addDirectedEdgeWithKey(
        key,
        edge.source,
        edge.target,
        edgeVisualAttributes(edge)
      );
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

    loadGraph(graph);
  }, [
    graphData?.edges,
    graphData?.nodes,
    loadGraph,
    onEdgeClick,
    onNodeClick,
    registerEvents,
    sigma,
    endNodeDrag,
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
        edgeProgramClasses: {
          doubleArrow: EdgeDoubleArrowProgram,
        },
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

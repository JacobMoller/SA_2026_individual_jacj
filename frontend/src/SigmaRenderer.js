import { useEffect } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";

const sigmaStyle = {
  height: "70vh",
  width: "100%",
  backgroundColor: "#f0f0f0",
};

// Component that load the graph
export const LoadGraph = ({ graphData }) => {
  console.log("Loading graph with data:", graphData);
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    const graph = new Graph({ type: "directed" });

    registerEvents({
      // node events
      clickNode: (event) =>
        console.log(
          "clickNode",
          event.event,
          event.node,
          event.preventSigmaDefault
        ),
    });

    // Add nodes
    graphData?.nodes.forEach((node, index) => {
      graph.addNode(node.id, {
        x: Math.cos(index) * 10,
        y: Math.sin(index) * 10,
        size: 15,
        label: node.id,
        color: "#4FA3FA",
      });
    });

    // Add edges
    graphData?.edges.forEach((edge) => {
      graph.addEdge(edge.source, edge.target, {
        label: edge.weight?.toString() || "",
        weight: edge.weight || 1,
        size: edge.weight || 1,
      });
    });

    // Layout with ForceAtlas2
    forceAtlas2.assign(graph, {
      iterations: 100,
      settings: {
        gravity: 1,
        scalingRatio: 10,
        strongGravityMode: true,
      },
    });

    loadGraph(graph);
  }, [graphData?.edges, graphData?.nodes, loadGraph]);

  return null;
};

function SigmaRenderer({ graph }) {
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
      <LoadGraph graphData={graph} />
    </SigmaContainer>
  );
}

export default SigmaRenderer;

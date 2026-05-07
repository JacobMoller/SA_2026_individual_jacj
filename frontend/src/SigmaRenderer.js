import { useEffect } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { SigmaContainer, useLoadGraph } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";

const sigmaStyle = {
  height: "70vh",
  width: "100%",
  backgroundColor: "#f0f0f0",
};

// Component that load the graph
export const LoadGraph = () => {
  const loadGraph = useLoadGraph();

  useEffect(() => {
    const graph = new Graph({ type: "directed" });

    graph.addNode("first", {
      x: Math.random(),
      y: Math.random(),
      size: 15,
      label: "First",
      color: "#FA4F40",
    });

    graph.addNode("second", {
      x: Math.random(),
      y: Math.random(),
      size: 15,
      label: "Second",
      color: "#4FA3FA",
    });

    graph.addEdge("first", "second", {
      label: "5",
      labelSize: 100,
      weight: 15,
      size: 10,
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
  }, [loadGraph]);

  return null;
};

function SigmaRenderer() {
  return (
    <SigmaContainer
      style={sigmaStyle}
      settings={{
        renderEdgeLabels: true,
        enableEdgeEvents: true,
        defaultEdgeType: "arrow",
      }}
    >
      <LoadGraph />
    </SigmaContainer>
  );
}

export default SigmaRenderer;

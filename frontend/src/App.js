import React, { useEffect, useRef } from "react";
import { Timeline } from "vis-timeline/standalone";
import { DataSet } from "vis-data";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import SigmaRenderer from "./SigmaRenderer";

export default function App() {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = React.useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Fake git commit data ---
    const items = new DataSet([
      { id: 1, content: "Init repo", start: "2019-01-10" },
      { id: 7, content: "Major refactor", start: "2026-02-18" },
    ]);

    const options = {
      stack: true,
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

    timelineRef.current = new Timeline(containerRef.current, items, options);

    timelineRef.current.setWindow("2019-01-01", "2025-12-31"); //TODO: Set period of first and last commit

    timelineRef.current.on("rangechanged", (props) => {
      console.log("Selected range:", props.start, props.end);

      // TODO: hold state for Sigma graph updating - Select commits closes to selected range?
      // setTimeRange({ from: props.start, to: props.end });
    });

    return () => {
      timelineRef.current?.destroy();
    };
  }, []);

  const play = () => {
    const start = new Date("2019-01-01").getTime();
    const end = new Date("2025-12-31").getTime();

    let current = start;

    const interval = setInterval(() => {
      current += 1000 * 60 * 60 * 24 * 30; // step 1 month TODO: step per commit instead?

      timelineRef.current.setWindow(new Date(start), new Date(current));

      if (current >= end) {
        clearInterval(interval);
      }
    }, 300);
  };

  return isLoading ? (
    <div>Loading...</div>
  ) : (
    <div>
      {isSettingsVisible ? (
        <div
          style={{
            backgroundColor: "lightskyblue",
            float: "left",
            height: "100vh",
            padding: "10px",
          }}
        >
          Settings
          <button onClick={() => setIsSettingsVisible(false)}>Hide</button>
        </div>
      ) : (
        <button
          onClick={() => setIsSettingsVisible(true)}
          style={{ position: "absolute", top: 10, left: 10, zIndex: 1000 }}
        >
          Settings
        </button>
      )}
      <div
        style={{ display: "flex", flexDirection: "column", height: "100vh" }}
      >
        <div style={{ flex: 1 }}>
          <SigmaRenderer />
        </div>
        <div
          style={{
            borderTop: "1px solid #333",
            padding: "5px",
          }}
        >
          <button onClick={play}>Play timeline</button>
        </div>
        <div ref={containerRef} />
      </div>
    </div>
  );
}

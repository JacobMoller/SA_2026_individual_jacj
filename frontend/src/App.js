import React, { useEffect, useRef, useState } from "react";
import { Timeline } from "vis-timeline/standalone";
import { DataSet } from "vis-data";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import SigmaRenderer from "./SigmaRenderer";

export default function App() {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const [timeline, setTimeline] = useState({
    snapshots: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = React.useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const convertToVisFormat = (snapshots) => {
      return snapshots.map((snapshot) => ({
        id: snapshot.commit,
        content: snapshot.message,
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
      .then((data) => {
        setTimeline(data);

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
            padding: "10px",
            height: "calc(100vh - 20px)",
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
        <div style={{ flex: 1, position: "relative" }}>
          <SigmaRenderer />
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

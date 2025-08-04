import "./main.css";
import type { Query } from "./types";
import Worker from "./worker?worker";

const worker = new Worker();

async function main() {
  const initQuery: Query = {};
  const ports = new MessageChannel();
  ports.port1.onmessage = (event) => {
    const { results } = event.data;
    console.log("Worker results:", results);
  };
  worker.postMessage(initQuery, [ports.port2]);
}

main();

import ReactDOM from "react-dom";
import { detectFrames } from "@/lib/detectFrames";
import { Landing } from "@/components/Landing";

export const dynamic = "force-static";

export default function Page() {
  const frames = detectFrames();
  if (frames[0]) {
    ReactDOM.preload(frames[0].src, { as: "image", fetchPriority: "high" });
  }
  return <Landing frames={frames} />;
}

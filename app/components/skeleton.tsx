import styles from "../app.module.css";
import { italiana } from "../fonts";

export default function Skeleton() {
  return (
    <div
      className={`${styles["noisy-background-16-2-low-res"]} ${italiana.className}`}
      style={{ cursor: "progress", width: "100vw", height: "100vh" }}
    />
  );
}

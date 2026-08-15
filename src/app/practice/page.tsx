import type { Metadata } from "next";
import PracticeClient from "./PracticeClient";

export const metadata: Metadata = {
  title: "Practice — swage",
  description:
    "ASL fingerspelling handshape practice, graded live by a classifier this project trained and evaluated itself.",
};

export default function PracticePage() {
  return <PracticeClient />;
}

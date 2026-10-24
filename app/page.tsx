import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import App from "@/components/App";
export const dynamic = "force-dynamic";
export default function Home() {
  if (!isAuthed()) redirect("/login");
  return <App />;
}

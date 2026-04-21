import { redirect } from "next/navigation";
import { getRootRedirectPath } from "@/lib/root-redirect";

export default function Home() {
  redirect(getRootRedirectPath());
}

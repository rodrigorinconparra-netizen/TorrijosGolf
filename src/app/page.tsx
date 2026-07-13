import { redirect } from "next/navigation";

// El middleware decide: con sesión → /dashboard, sin sesión → /login.
export default function Home() {
  redirect("/dashboard");
}

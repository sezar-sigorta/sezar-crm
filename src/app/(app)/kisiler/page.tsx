import { redirect } from "next/navigation";

// The combined people list was split into /leadler and /musteriler.
export default function Kisiler() {
  redirect("/leadler");
}

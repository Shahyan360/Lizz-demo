import { redirect } from "next/navigation";

// The mailbox is the default screen — send the root straight to it.
export default function Home() {
  redirect("/zoho");
}

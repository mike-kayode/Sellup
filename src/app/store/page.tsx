import { redirect } from "next/navigation";

/** Legacy URL: sellup.ng/store -> sellup.ng/ */
export default function LegacyStoreIndex() {
  redirect("/");
}
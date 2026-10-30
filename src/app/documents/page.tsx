import { redirect } from "next/navigation";
import { profileHref } from "@/lib/profile/tabs";

/** Documents now live in the "CVs & documents" tab of /profile. */
export default function DocumentsPage() {
  redirect(profileHref("documents"));
}

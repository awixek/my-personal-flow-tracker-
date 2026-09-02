import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="dash-shell">
      <div className="dash-top">
        <span className="who">{user.email}</span>
        <SignOutButton />
      </div>

      <div className="dash-center">
        <svg
          className="dash-vessel"
          viewBox="0 0 40 56"
          aria-hidden="true"
        >
          <rect
            x="1.5"
            y="1.5"
            width="37"
            height="53"
            fill="none"
            stroke="#111"
            strokeWidth="2"
          />
        </svg>
        <h1>Ready to start.</h1>
        <p>
          Your account is connected. Once a roadmap is loaded, today's Main
          Tasks will appear here.
        </p>
      </div>
    </div>
  );
}

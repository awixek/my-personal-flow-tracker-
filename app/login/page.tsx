"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function VesselMark({ fill = 55 }: { fill?: number }) {
  return (
    <svg viewBox="0 0 40 56" width="40" height="56" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="53"
        fill="none"
        stroke="#111"
        strokeWidth="2"
      />
      <rect
        x="1.5"
        y={1.5 + (53 * (100 - fill)) / 100}
        width="37"
        height={(53 * fill) / 100}
        fill="#79c24c"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      // If email confirmation is on in the Supabase project, there's no
      // session yet — tell the user to confirm rather than redirecting.
      setSignupDone(true);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="auth-screen">
      <div className="auth-intro">
        <div className="auth-mark">
          <VesselMark fill={62} />
        </div>
        <h1>Time is the only unit that counts here.</h1>
        <p>
          Core Architect tracks study by the hour, not the checkbox. Start a
          task, and the day fills in as you go.
        </p>
      </div>

      <div className="auth-panel">
        {signupDone ? (
          <>
            <h2>Check your email</h2>
            <p className="sub">
              We sent a confirmation link to <strong>{email}</strong>. Follow
              it, then come back and sign in.
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                setSignupDone(false);
                setMode("login");
              }}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
            <p className="sub">
              {mode === "login"
                ? "Pick up where you left off."
                : "One password, set once — your session stays open after this."}
            </p>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading
                  ? "Working..."
                  : mode === "login"
                  ? "Sign in"
                  : "Create account"}
              </button>
            </form>

            <div className="switch-mode">
              {mode === "login" ? (
                <>
                  New here?{" "}
                  <button onClick={() => setMode("signup")}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")}>Sign in</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

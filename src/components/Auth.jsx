import { useState } from "react";
import { FolderKanban, HardDrive, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { Button, Field, inputClass } from "../ui/primitives";

export default function Auth({ onUseLocalMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ tone: "", text: "" });

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage({ tone: "", text: "" });

    try {
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (result.error) {
        setMessage({ tone: "error", text: result.error.message });
      } else if (mode === "signup") {
        setMessage({
          tone: "success",
          text: result.data?.session
            ? "Account created. Signing you in..."
            : "Account created. Check your email to confirm it, then sign in.",
        });
        if (!result.data?.session) setMode("login");
      }
    } catch (error) {
      console.error("Authentication failed:", error);
      setMessage({
        tone: "error",
        text: "Could not reach the sign-in service. Check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-slate-900 p-8 text-white md:flex">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500">
              <FolderKanban className="h-5 w-5" />
            </div>
            <span className="font-semibold">Project Planner</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold leading-tight">
              Plan, track and report on every project in one place.
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li>Gantt timeline, board, sprints and a spreadsheet-style schedule</li>
              <li>Import from Excel, CSV, Jira, Asana, Trello or MS Project</li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-300" /> Claude finds risks and drafts your reports
              </li>
            </ul>
          </div>
          <p className="text-xs text-slate-400">Your data syncs securely to your account.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4 p-8">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isLogin ? "Sign in to open your workspace." : "It takes less than a minute."}
            </p>
          </div>

          <Field label="Email" htmlFor="auth-email" required>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              required
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="you@company.com"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="auth-password"
            required
            hint={isLogin ? "" : "At least 6 characters."}
          >
            <input
              id="auth-password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
              value={password}
              required
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </Field>

          {message.text ? (
            <p
              role={message.tone === "error" ? "alert" : "status"}
              className={`rounded-xl px-3 py-2 text-sm ${
                message.tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            {isLogin ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-indigo-600 hover:underline"
              onClick={() => {
                setMode(isLogin ? "signup" : "login");
                setMessage({ tone: "", text: "" });
              }}
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>

          {onUseLocalMode ? (
            <div className="border-t border-slate-100 pt-4">
              <Button icon={HardDrive} className="w-full" onClick={onUseLocalMode}>
                Continue without an account
              </Button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Your data stays in this browser only. You can sign in later.
              </p>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

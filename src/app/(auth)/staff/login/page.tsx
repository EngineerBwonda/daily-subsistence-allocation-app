"use client";

import {
  useState,
  useEffect,
  Suspense,
  type FormEvent,
  type ChangeEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  FileText,
  Users,
  MessageSquare,
  AlertCircle,
  LogIn,
  CheckCircle2,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

interface FormState {
  email: string;
  password: string;
  remember: boolean;
}

type FormErrors = Partial<Record<"email" | "password", string>>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    remember: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [showRegisteredBanner, setShowRegisteredBanner] = useState(false);

  // Show banner if redirected from register with ?registered=1
  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      setShowRegisteredBanner(true);
      // Clean the URL so a refresh doesn't keep re-showing it
      window.history.replaceState(null, "", "/login");
      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => setShowRegisteredBanner(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "email" || name === "password") {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) setServerError("");
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.email.trim()) next.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Please enter a valid email address";
    if (!form.password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate() || isLoading) return;

    setIsLoading(true);
    setServerError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (error) {
        setServerError(
          error.message === "Invalid login credentials"
            ? "Incorrect email or password."
            : error.message,
        );
        return;
      }

      if (!data.user) {
        setServerError("Unable to sign in. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("staff_profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile lookup failed:", profileError);
        setServerError("Could not verify your account. Please try again.");
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();
        setServerError(
          "Your account has no profile record. Please contact an administrator.",
        );
        return;
      }

      const roleRoutes: Record<string, string> = {
        member: "/member/dashboard",
        secretary: "/secretary/dashboard",
        director: "/director/dashboard",
      };

      router.replace(roleRoutes[profile.role] || "/member/dashboard");
    } catch (err) {
      console.error(err);
      setServerError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      {/* LEFT INFORMATION PANEL */}
      <section className={styles.visualSection}>
        <div className={styles.visualOverlay} />

        <div className={styles.visualContent}>
          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark}>S</div>
            <div>
              <strong>SENATE LIAISON</strong>
              <span>DSA MANAGEMENT SYSTEM</span>
            </div>
          </Link>

          <motion.div
            className={styles.heroContent}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className={styles.badge}>
              <ShieldCheck size={15} />
              Secure Staff Portal
            </div>

            <h1>
              Welcome back to
              <span> DSA Management.</span>
            </h1>

            <p>
              Sign in to submit, review, and approve Daily Subsistence Allowance
              claims through a secure, role-based workflow built for the Senate
              Liaison Office.
            </p>

            <div className={styles.benefits}>
              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
                  <FileText size={18} />
                </div>
                <div>
                  <strong>Submit Claims Digitally</strong>
                  <span>Members submit DSA claims in seconds.</span>
                </div>
              </div>

              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
                  <Users size={18} />
                </div>
                <div>
                  <strong>Structured Review Workflow</strong>
                  <span>Secretary reviews, Director approves.</span>
                </div>
              </div>

              <div className={styles.benefit}>
                <div className={styles.benefitIcon}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <strong>Real-time Notifications</strong>
                  <span>Members are notified at every stage.</span>
                </div>
              </div>
            </div>
          </motion.div>

          <div className={styles.bottomMessage}>
            <span />
            <p>Claim. Review. Approve. Pay.</p>
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className={styles.formSection}>
        <div className={styles.formContainer}>
          <Link href="/" className={styles.mobileLogo}>
            <div className={styles.logoMark}>S</div>
            <div>
              <strong>SENATE LIAISON</strong>
              <span>DSA MANAGEMENT</span>
            </div>
          </Link>

          <motion.div
            className={styles.formHeader}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className={styles.formEyebrow}>Staff Login</span>
            <h2>Sign in to your account</h2>
            <p>Enter your credentials to access your DSA dashboard.</p>
          </motion.div>

          {/* REGISTERED SUCCESS BANNER */}
          {showRegisteredBanner && (
            <div className={styles.successAlert} role="status">
              <CheckCircle2 size={16} />
              <div>
                <strong>Account created!</strong>
                <p>
                  Your account is ready. Please sign in with your email and
                  password below.
                </p>
              </div>
            </div>
          )}

          {serverError && (
            <div className={styles.errorAlert} role="alert">
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}

          <motion.form
            onSubmit={handleSubmit}
            className={styles.form}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            noValidate
          >
            {/* EMAIL */}
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email address</label>
              <div
                className={`${styles.inputWrapper} ${
                  errors.email ? styles.inputError : ""
                }`}
              >
                <Mail size={18} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@senate.go.ke"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  disabled={isLoading}
                  aria-invalid={!!errors.email}
                />
              </div>
              {errors.email && (
                <p className={styles.errorMessage}>{errors.email}</p>
              )}
            </div>

            {/* PASSWORD */}
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <div
                className={`${styles.inputWrapper} ${
                  errors.password ? styles.inputError : ""
                }`}
              >
                <Lock size={18} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  disabled={isLoading}
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  className={styles.passwordButton}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className={styles.errorMessage}>{errors.password}</p>
              )}
            </div>

            {/* REMEMBER + FORGOT */}
            <div className={styles.formOptions}>
              <label className={styles.rememberCheck}>
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.remember}
                  onChange={handleChange}
                  disabled={isLoading}
                />
                <span>Remember me</span>
              </label>
              <Link href="/forgot-password" className={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner} />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </motion.form>

          <div className={styles.loginPrompt}>
            <span>Don&apos;t have an account?</span>
            <Link href="/register">Create an account</Link>
          </div>

          <div className={styles.securityNote}>
            <ShieldCheck size={15} />
            <span>All activity is monitored for security purposes.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

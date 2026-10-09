"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Briefcase,
  Phone,
  ArrowRight,
  ShieldCheck,
  FileText,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Users,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

type Role = "member" | "secretary" | "director";

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState<FormState>({
    fullName: "",
    email: "",
    phone: "",
    role: "member",
    password: "",
    confirmPassword: "",
    terms: false,
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validate = (): boolean => {
    if (!formData.fullName.trim()) {
      setError("Full name is required.");
      return false;
    }
    if (!formData.email.trim()) {
      setError("Email address is required.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    if (!formData.terms) {
      setError("Please accept the terms and conditions.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validate()) return;

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            profile_type: "staff",
            full_name: formData.fullName.trim(),
            phone: formData.phone.trim(),
            role: formData.role,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError(
            "An account with this email already exists. Please sign in.",
          );
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!authData.user) {
        setError("Unable to create account. Please try again.");
        return;
      }

      // Sign out the auto-session so the user logs in explicitly
      await supabase.auth.signOut();

      setSuccess("Account created successfully! Redirecting you to sign in...");

      setTimeout(() => {
        router.replace("/staff/login?registered=1");
      }, 1500);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
              Secure Staff Registration
            </div>

            <h1>
              Daily Subsistence Allowance,
              <span> managed digitally.</span>
            </h1>

            <p>
              Register for the Senate Liaison Office DSA Management System.
              Submit, review, and approve daily subsistence allowance claims
              through a secure, role-based workflow.
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
            <span className={styles.formEyebrow}>Staff Registration</span>
            <h2>Create your account</h2>
            <p>Sign up to access the DSA Management System.</p>
          </motion.div>

          {error && (
            <div className={styles.errorAlert} role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.successAlert} role="alert">
              <CheckCircle2 size={16} />
              <div>
                <strong>Account created!</strong>
                <p>{success}</p>
              </div>
            </div>
          )}

          <motion.form
            onSubmit={handleSubmit}
            className={styles.form}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* FULL NAME */}
            <div className={styles.inputGroup}>
              <label htmlFor="fullName">Full name *</label>
              <div className={styles.inputWrapper}>
                <User size={18} />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Dr. Jane Kamau"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            {/* EMAIL */}
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email address *</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@senate.go.ke"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* ROLE */}
            <div className={styles.inputGroup}>
              <label htmlFor="role">Staff Role *</label>
              <div className={styles.inputWrapper}>
                <Briefcase size={18} />
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                >
                  <option value="member">Administrator</option>
                  <option value="secretary">Secretary</option>
                  <option value="director">Director</option>
                </select>
              </div>
            </div>

            {/* PHONE */}
            <div className={styles.inputGroup}>
              <label htmlFor="phone">Phone number</label>
              <div className={styles.inputWrapper}>
                <Phone size={18} />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+254 700 000 000"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password *</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  className={styles.passwordButton}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* CONFIRM PASSWORD */}
            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">Confirm password *</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  className={styles.passwordButton}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* TERMS */}
            <label className={styles.termsCheck}>
              <input
                type="checkbox"
                name="terms"
                checked={formData.terms}
                onChange={handleChange}
              />
              <span>
                I agree to the Senate Liaison Office&apos;s terms and privacy
                policy.
              </span>
            </label>

            {/* BUTTON */}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </motion.form>

          <div className={styles.loginPrompt}>
            <span>Already have an account?</span>
            <Link href="/login">Sign in</Link>
          </div>

          <div className={styles.securityNote}>
            <ShieldCheck size={15} />
            <span>Your data is encrypted and stored securely.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
// "use client";

// import { useState, ChangeEvent, FormEvent, useMemo } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import {
//   User,
//   Mail,
//   Lock,
//   Eye,
//   EyeOff,
//   AlertCircle,
//   Loader2,
//   ArrowRight,
//   ShieldCheck,
// } from "lucide-react";
// import { createClient } from "@/utils/supabase/client";
// import styles from "./styles.module.css";

// interface RegisterForm {
//   full_name: string;
//   email: string;
//   password: string;
//   confirm_password: string;
// }

// type FormErrors = Partial<Record<keyof RegisterForm, string | null>>;

// export default function RegisterPage() {
//   const router = useRouter();
//   const supabase = useMemo(() => createClient(), []);

//   const [form, setForm] = useState<RegisterForm>({
//     full_name: "",
//     email: "",
//     password: "",
//     confirm_password: "",
//   });

//   const [showPw, setShowPw] = useState(false);
//   const [showCf, setShowCf] = useState(false);
//   const [errors, setErrors] = useState<FormErrors>({});
//   const [errorMsg, setErrorMsg] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [success, setSuccess] = useState(false);

//   const update = <K extends keyof RegisterForm>(
//     field: K,
//     value: RegisterForm[K],
//   ) => {
//     setForm((f) => ({ ...f, [field]: value }));
//     if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
//   };

//   const validate = (): boolean => {
//     const e: FormErrors = {};
//     if (!form.full_name.trim()) e.full_name = "Full name is required.";
//     if (!form.email.trim()) e.email = "Email is required.";
//     else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
//       e.email = "Enter a valid email address.";
//     if (!form.password) e.password = "Password is required.";
//     else if (form.password.length < 6)
//       e.password = "Password must be at least 6 characters.";
//     if (!form.confirm_password)
//       e.confirm_password = "Please confirm your password.";
//     else if (form.password !== form.confirm_password)
//       e.confirm_password = "Passwords do not match.";
//     setErrors(e);
//     return Object.keys(e).length === 0;
//   };

//   const handleSubmit = async (ev: FormEvent<HTMLFormElement>) => {
//     ev.preventDefault();
//     setErrorMsg(null);
//     if (!validate()) {
//       setErrorMsg("Please correct the highlighted fields.");
//       return;
//     }
//     setLoading(true);

//     try {
//       const { data, error } = await supabase.auth.signUp({
//         email: form.email.trim(),
//         password: form.password,
//         options: {
//           data: { full_name: form.full_name.trim() },
//         },
//       });

//       if (error) {
//         let msg = "We could not create your account. Please try again.";
//         const m = error.message?.toLowerCase() ?? "";
//         if (m.includes("already registered"))
//           msg = "This email is already registered. Try signing in instead.";
//         else if (m.includes("password"))
//           msg = "Your password does not meet the requirements.";
//         else if (m.includes("network"))
//           msg = "Network error. Please check your connection and try again.";
//         setErrorMsg(msg);
//         setLoading(false);
//         return;
//       }

//       if (data.session) {
//         router.push("/member/dashboard");
//         return;
//       }
//       setSuccess(true);
//     } catch {
//       setErrorMsg("An unexpected error occurred. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (success) {
//     return (
//       <div className={styles.page}>
//         <div className={styles.card}>
//           <div className={styles.successIcon}>
//             <Mail size={32} strokeWidth={1.75} />
//           </div>
//           <h1 className={styles.successTitle}>Check your inbox</h1>
//           <p className={styles.successText}>
//             We&apos;ve sent a verification link to <strong>{form.email}</strong>
//             . Confirm it to activate your account.
//           </p>
//           <Link href="/login" className={styles.submitBtn}>
//             Back to sign in
//           </Link>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className={styles.page}>
//       <div className={styles.card}>
//         <div className={styles.brand}>
//           <div className={styles.logo}>
//             <ShieldCheck size={22} strokeWidth={2} />
//           </div>
//           <span className={styles.brandName}>DSA Claims</span>
//         </div>

//         <div className={styles.header}>
//           <h1>Create your account</h1>
//           <p>It only takes a minute to get started.</p>
//         </div>

//         {errorMsg && (
//           <div className={styles.errorBanner} role="alert">
//             <AlertCircle size={16} />
//             <span>{errorMsg}</span>
//           </div>
//         )}

//         <form onSubmit={handleSubmit} noValidate className={styles.form}>
//           <Field
//             label="Full name"
//             icon={<User size={16} />}
//             error={errors.full_name}
//           >
//             <input
//               type="text"
//               className={errors.full_name ? styles.inputError : ""}
//               placeholder="Jane Doe"
//               value={form.full_name}
//               autoComplete="name"
//               onChange={(e: ChangeEvent<HTMLInputElement>) =>
//                 update("full_name", e.target.value)
//               }
//             />
//           </Field>

//           <Field label="Email" icon={<Mail size={16} />} error={errors.email}>
//             <input
//               type="email"
//               className={errors.email ? styles.inputError : ""}
//               placeholder="you@example.com"
//               value={form.email}
//               autoComplete="email"
//               onChange={(e: ChangeEvent<HTMLInputElement>) =>
//                 update("email", e.target.value)
//               }
//             />
//           </Field>

//           <Field
//             label="Password"
//             icon={<Lock size={16} />}
//             error={errors.password}
//           >
//             <div className={styles.passwordWrap}>
//               <input
//                 type={showPw ? "text" : "password"}
//                 className={errors.password ? styles.inputError : ""}
//                 placeholder="Create a password"
//                 value={form.password}
//                 autoComplete="new-password"
//                 onChange={(e: ChangeEvent<HTMLInputElement>) =>
//                   update("password", e.target.value)
//                 }
//               />
//               <button
//                 type="button"
//                 className={styles.eyeBtn}
//                 onClick={() => setShowPw((v) => !v)}
//                 aria-label={showPw ? "Hide password" : "Show password"}
//                 tabIndex={-1}
//               >
//                 {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
//               </button>
//             </div>
//           </Field>

//           <Field
//             label="Confirm password"
//             icon={<Lock size={16} />}
//             error={errors.confirm_password}
//           >
//             <div className={styles.passwordWrap}>
//               <input
//                 type={showCf ? "text" : "password"}
//                 className={errors.confirm_password ? styles.inputError : ""}
//                 placeholder="Re-enter your password"
//                 value={form.confirm_password}
//                 autoComplete="new-password"
//                 onChange={(e: ChangeEvent<HTMLInputElement>) =>
//                   update("confirm_password", e.target.value)
//                 }
//               />
//               <button
//                 type="button"
//                 className={styles.eyeBtn}
//                 onClick={() => setShowCf((v) => !v)}
//                 aria-label={showCf ? "Hide password" : "Show password"}
//                 tabIndex={-1}
//               >
//                 {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
//               </button>
//             </div>
//           </Field>

//           <button type="submit" className={styles.submitBtn} disabled={loading}>
//             {loading ? (
//               <>
//                 <Loader2 size={18} className={styles.spin} />
//                 Creating account…
//               </>
//             ) : (
//               <>
//                 Create account <ArrowRight size={18} />
//               </>
//             )}
//           </button>

//           <p className={styles.footerNote}>
//             Already have an account?{" "}
//             <Link href="/login" className={styles.link}>
//               Sign in
//             </Link>
//           </p>
//         </form>
//       </div>
//     </div>
//   );
// }

// /* ---------- Helper components ---------- */

// function Field({
//   label,
//   icon,
//   error,
//   children,
// }: {
//   label: string;
//   icon: React.ReactNode;
//   error?: string | null;
//   children: React.ReactNode;
// }) {
//   const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
//   return (
//     <div className={styles.field}>
//       <label htmlFor={id} className={styles.label}>
//         <span className={styles.labelIcon}>{icon}</span>
//         {label}
//       </label>
//       {children}
//       {error && <span className={styles.fieldError}>{error}</span>}
//     </div>
//   );
// }

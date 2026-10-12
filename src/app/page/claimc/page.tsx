"use client";

import { Fragment, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Calendar,
  Building2,
  Moon,
  CheckCircle2,
  AlertCircle,
  Send,
  FileText,
  ShieldCheck,
  Pencil,
  X,
  Check,
  MapPin,
  Video,
  Users,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./stylesb.module.css";

// ---------- Types ----------
type CommitteeMode = "physical" | "virtual";

interface CommitteeEntry {
  id: string;
  name: string;
  attendance_date: string;
  mode: CommitteeMode;
  sittings: number;
}

interface WeekRow {
  id: string;
  week_starting: string;
  week_ending: string;
  attended_chamber: boolean;
  attended_committee: boolean;
  committees: CommitteeEntry[];
}

interface FormState {
  claim_month: string;
  claim_year: number;
  weeks: WeekRow[];
  nights_chamber: number;
  nights_committee: number;
  declaration_signed_name: string;
  declaration_confirmed: boolean;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const COMMITTEES = [
  "Finance and Budget Committee",
  "Education Committee",
  "Health Committee",
  "Agriculture Committee",
  "Energy Committee",
  "Transport Committee",
  "Justice and Legal Affairs",
  "Labour and Social Welfare",
  "National Security",
  "County Public Accounts",
  "Delegated Legislation",
  "Standing Orders",
];

const STEP_LABELS = ["Weeks attended", "Nights claimed", "Review and submit"];

const uid = () => Math.random().toString(36).slice(2, 10);

const blankWeek = (): WeekRow => ({
  id: uid(),
  week_starting: "",
  week_ending: "",
  attended_chamber: false,
  attended_committee: false,
  committees: [],
});

type Stage = 1 | 2 | 3;

export default function NewClaimPage() {
  const router = useRouter();
  const supabase = createClient();

  const now = new Date();
  const [stage, setStage] = useState<Stage>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [form, setForm] = useState<FormState>({
    claim_month: MONTHS[now.getMonth()],
    claim_year: now.getFullYear(),
    weeks: [blankWeek()],
    nights_chamber: 0,
    nights_committee: 0,
    declaration_signed_name: "",
    declaration_confirmed: false,
  });

  // ---------- Week handlers ----------
  const addWeek = () =>
    setForm((p) => ({ ...p, weeks: [...p.weeks, blankWeek()] }));

  const removeWeek = (id: string) =>
    setForm((p) => ({ ...p, weeks: p.weeks.filter((w) => w.id !== id) }));

  const updateWeek = (id: string, patch: Partial<WeekRow>) =>
    setForm((p) => ({
      ...p,
      weeks: p.weeks.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));

  // ---------- Committee handlers ----------
  const toggleCommittee = (weekId: string, committee: string) => {
    setForm((p) => ({
      ...p,
      weeks: p.weeks.map((w) => {
        if (w.id !== weekId) return w;
        const existing = w.committees.find((c) => c.name === committee);
        if (existing) {
          return {
            ...w,
            committees: w.committees.filter((c) => c.name !== committee),
          };
        }
        return {
          ...w,
          committees: [
            ...w.committees,
            {
              id: uid(),
              name: committee,
              attendance_date: "",
              mode: "physical",
              sittings: 1,
            },
          ],
        };
      }),
    }));
  };

  const updateCommittee = (
    weekId: string,
    committeeId: string,
    patch: Partial<CommitteeEntry>,
  ) => {
    setForm((p) => ({
      ...p,
      weeks: p.weeks.map((w) =>
        w.id === weekId
          ? {
              ...w,
              committees: w.committees.map((c) =>
                c.id === committeeId ? { ...c, ...patch } : c,
              ),
            }
          : w,
      ),
    }));
  };

  const removeCommittee = (weekId: string, committeeId: string) => {
    setForm((p) => ({
      ...p,
      weeks: p.weeks.map((w) =>
        w.id === weekId
          ? {
              ...w,
              committees: w.committees.filter((c) => c.id !== committeeId),
            }
          : w,
      ),
    }));
  };

  // ---------- Validation ----------
  const validateStage1 = (): string | null => {
    if (form.weeks.length === 0) return "Add at least one week.";
    for (let i = 0; i < form.weeks.length; i++) {
      const w = form.weeks[i];
      if (!w.week_starting) return `Week ${i + 1}: start date is required.`;
      if (!w.week_ending) return `Week ${i + 1}: end date is required.`;
      if (new Date(w.week_ending) < new Date(w.week_starting))
        return `Week ${i + 1}: end date cannot be before start date.`;
      if (!w.attended_chamber && !w.attended_committee)
        return `Week ${i + 1}: tick at least Chamber or Committee.`;

      if (w.attended_committee) {
        if (w.committees.length === 0)
          return `Week ${i + 1}: select at least one committee.`;
        for (const c of w.committees) {
          if (!c.attendance_date)
            return `Week ${i + 1}: "${c.name}" — attendance date is required.`;
          if (
            new Date(c.attendance_date) < new Date(w.week_starting) ||
            new Date(c.attendance_date) > new Date(w.week_ending)
          )
            return `Week ${i + 1}: "${c.name}" — attendance date must be within the week.`;
          if (c.sittings < 1)
            return `Week ${i + 1}: "${c.name}" — number of sittings must be at least 1.`;
        }
      }
    }
    return null;
  };

  const validateStage2 = (): string | null => {
    if (form.nights_chamber < 0 || form.nights_committee < 0)
      return "Nights cannot be negative.";
    if (form.nights_chamber + form.nights_committee === 0)
      return "Enter at least one night claimed.";
    return null;
  };

  const validateStage3 = (): string | null => {
    if (!form.declaration_signed_name.trim())
      return "Type your full name to sign the declaration.";
    if (!form.declaration_confirmed) return "Please confirm the declaration.";
    return null;
  };

  const goNext = () => {
    setError("");
    if (stage === 1) {
      const v = validateStage1();
      if (v) return setError(v);
      setStage(2);
    } else if (stage === 2) {
      const v = validateStage2();
      if (v) return setError(v);
      setStage(3);
    }
  };

  const goBack = () => {
    setError("");
    if (stage === 3) setStage(2);
    else if (stage === 2) setStage(1);
  };

  // ---------- Submit ----------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const v = validateStage3();
    if (v) return setError(v);

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) {
        console.error("Could not verify the signed-in member:", userError);
        setError("We could not verify your account. Please sign in again.");
        return;
      }
      if (!user) {
        router.replace("/member/login");
        return;
      }

      const weekPayload = form.weeks.map((w, i) => ({
        week_number: i + 1,
        week_starting: w.week_starting,
        week_ending: w.week_ending,
        attended_chamber: w.attended_chamber,
        attended_committee: w.attended_committee,
        committees: w.attended_committee
          ? w.committees.map((c) => ({
              name: c.name,
              attendance_date: c.attendance_date,
              mode: c.mode,
              sittings: c.sittings,
            }))
          : [],
      }));

      const { error: claimErr } = await supabase.rpc("submit_member_claim", {
        p_claim_month: form.claim_month,
        p_claim_year: form.claim_year,
        p_nights_chamber: form.nights_chamber,
        p_nights_committee: form.nights_committee,
        p_declaration_signed_name: form.declaration_signed_name.trim(),
        p_weeks: weekPayload,
      });

      if (claimErr) {
        console.error(claimErr);
        setError(
          claimErr.code === "PGRST202"
            ? "Claim submission is not set up in the database yet. Apply the latest Supabase migrations, then try again."
            : "Could not save your claim. Please try again.",
        );
        return;
      }

      setDone(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Success ----------
  if (done) {
    return (
      <div className={styles.app}>
        <main className={styles.successWrap}>
          <motion.div
            className={styles.successCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={styles.successIcon}>
              <CheckCircle2 size={36} />
            </div>
            <h1>Claim submitted</h1>
            <p>
              Your DSA claim for{" "}
              <strong>
                {form.claim_month} {form.claim_year}
              </strong>{" "}
              has been submitted and is now <strong>under review</strong> by the
              Secretary.
            </p>
            <p className={styles.successNote}>
              You can follow the review status from your profile page.
            </p>
            <div className={styles.successActions}>
              <Link href="/member/profile" className={styles.secondaryButton}>
                Go to profile
              </Link>
              <Link href="/member/profile" className={styles.primaryButton}>
                View my claims <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  const totalNights = form.nights_chamber + form.nights_committee;
  const committeeTotal = form.weeks.reduce(
    (sum, w) => sum + w.committees.length,
    0,
  );

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <Link href="/member/profile" className={styles.backLink}>
          <ArrowLeft size={16} />
          Back
        </Link>
        <div className={styles.topTitle}>
          <span className={styles.topIcon}>
            <FileText size={17} />
          </span>
          <div>
            <strong>New DSA claim</strong>
            <span>Domestic subsistence facilitation</span>
          </div>
        </div>
      </header>

      <main className={styles.shell}>
        {/* Stepper */}
        <ol className={styles.stepper} aria-label="Claim progress">
          {[1, 2, 3].map((n) => (
            <Fragment key={n}>
              <li
                className={styles.step}
                data-active={stage === n}
                data-done={stage > n}
                aria-current={stage === n ? "step" : undefined}
              >
                <span className={styles.stepNum}>
                  {stage > n ? <Check size={14} strokeWidth={3} /> : n}
                </span>
                <span className={styles.stepLabel}>{STEP_LABELS[n - 1]}</span>
              </li>
              {n < 3 && (
                <span className={styles.stepLine} data-done={stage > n} />
              )}
            </Fragment>
          ))}
        </ol>

        {error && (
          <div className={styles.errorAlert} role="alert">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.layout}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <AnimatePresence mode="wait">
              {/* ================= STAGE 1 ================= */}
              {stage === 1 && (
                <motion.section
                  key="stage1"
                  className={styles.card}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className={styles.cardHeader}>
                    <h2>Claim period and weeks attended</h2>
                    <p>
                      Add each week you attended parliamentary business. For
                      each committee you attended, provide the attendance date,
                      mode, and number of sittings.
                    </p>
                  </div>

                  <div className={styles.rowGrid2}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Claim month</span>
                      <select
                        className={styles.control}
                        value={form.claim_month}
                        onChange={(e) =>
                          setForm({ ...form, claim_month: e.target.value })
                        }
                      >
                        {MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Year</span>
                      <input
                        className={styles.control}
                        type="number"
                        min={2020}
                        max={2100}
                        value={form.claim_year}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            claim_year:
                              parseInt(e.target.value, 10) || now.getFullYear(),
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.weeksHeader}>
                    <h3>Weeks</h3>
                    <button
                      type="button"
                      onClick={addWeek}
                      className={styles.addButton}
                    >
                      <Plus size={16} />
                      Add week
                    </button>
                  </div>

                  <div className={styles.weeks}>
                    {form.weeks.map((w, idx) => (
                      <motion.div
                        key={w.id}
                        layout
                        className={styles.weekRow}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className={styles.weekTop}>
                          <span className={styles.weekBadge}>
                            Week {idx + 1}
                          </span>
                          {form.weeks.length > 1 && (
                            <button
                              type="button"
                              className={styles.removeButton}
                              onClick={() => removeWeek(w.id)}
                              aria-label="Remove week"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className={styles.rowGrid2}>
                          <label className={styles.field}>
                            <span className={styles.fieldLabel}>
                              Week starting
                            </span>
                            <span className={styles.inputWrapper}>
                              <Calendar size={16} />
                              <input
                                type="date"
                                value={w.week_starting}
                                onChange={(e) =>
                                  updateWeek(w.id, {
                                    week_starting: e.target.value,
                                  })
                                }
                              />
                            </span>
                          </label>
                          <label className={styles.field}>
                            <span className={styles.fieldLabel}>
                              Week ending
                            </span>
                            <span className={styles.inputWrapper}>
                              <Calendar size={16} />
                              <input
                                type="date"
                                value={w.week_ending}
                                onChange={(e) =>
                                  updateWeek(w.id, {
                                    week_ending: e.target.value,
                                  })
                                }
                              />
                            </span>
                          </label>
                        </div>

                        <div className={styles.checkRow}>
                          <label className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={w.attended_chamber}
                              onChange={(e) =>
                                updateWeek(w.id, {
                                  attended_chamber: e.target.checked,
                                })
                              }
                            />
                            <span>Chamber sitting</span>
                          </label>
                          <label className={styles.checkItem}>
                            <input
                              type="checkbox"
                              checked={w.attended_committee}
                              onChange={(e) =>
                                updateWeek(w.id, {
                                  attended_committee: e.target.checked,
                                  committees: e.target.checked
                                    ? w.committees
                                    : [],
                                })
                              }
                            />
                            <span>Committee sitting</span>
                          </label>
                        </div>

                        {w.attended_committee && (
                          <div className={styles.committeePicker}>
                            <div className={styles.committeePickerHeader}>
                              <span className={styles.fieldLabel}>
                                Committees attended
                              </span>
                              {w.committees.length > 0 && (
                                <span className={styles.committeeCount}>
                                  {w.committees.length} selected
                                </span>
                              )}
                            </div>

                            <div className={styles.chipGrid}>
                              {COMMITTEES.map((c) => {
                                const selected = w.committees.some(
                                  (x) => x.name === c,
                                );
                                return (
                                  <button
                                    type="button"
                                    key={c}
                                    className={styles.chip}
                                    data-selected={selected}
                                    aria-pressed={selected}
                                    onClick={() => toggleCommittee(w.id, c)}
                                  >
                                    <span className={styles.chipCheck}>
                                      {selected ? (
                                        <Check size={12} />
                                      ) : (
                                        <Plus size={12} />
                                      )}
                                    </span>
                                    {c}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Per-committee details */}
                            {w.committees.length > 0 && (
                              <div className={styles.committeeDetails}>
                                {w.committees.map((c) => (
                                  <div
                                    key={c.id}
                                    className={styles.committeeDetailCard}
                                  >
                                    <div
                                      className={styles.committeeDetailHeader}
                                    >
                                      <div className={styles.committeeName}>
                                        <Building2 size={14} />
                                        <strong>{c.name}</strong>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeCommittee(w.id, c.id)
                                        }
                                        className={styles.removeButton}
                                        aria-label={`Remove ${c.name}`}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>

                                    <div className={styles.committeeGrid}>
                                      <label className={styles.field}>
                                        <span className={styles.fieldLabel}>
                                          Attendance date
                                        </span>
                                        <span className={styles.inputWrapper}>
                                          <Calendar size={14} />
                                          <input
                                            type="date"
                                            min={w.week_starting || undefined}
                                            max={w.week_ending || undefined}
                                            value={c.attendance_date}
                                            onChange={(e) =>
                                              updateCommittee(w.id, c.id, {
                                                attendance_date: e.target.value,
                                              })
                                            }
                                          />
                                        </span>
                                      </label>

                                      <div
                                        className={styles.field}
                                        role="group"
                                        aria-label="Mode"
                                      >
                                        <span className={styles.fieldLabel}>
                                          Mode
                                        </span>
                                        <div className={styles.modeToggle}>
                                          <button
                                            type="button"
                                            className={styles.modeOption}
                                            data-active={c.mode === "physical"}
                                            onClick={() =>
                                              updateCommittee(w.id, c.id, {
                                                mode: "physical",
                                              })
                                            }
                                          >
                                            <MapPin size={14} />
                                            Physical
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.modeOption}
                                            data-active={c.mode === "virtual"}
                                            onClick={() =>
                                              updateCommittee(w.id, c.id, {
                                                mode: "virtual",
                                              })
                                            }
                                          >
                                            <Video size={14} />
                                            Virtual
                                          </button>
                                        </div>
                                      </div>

                                      <label className={styles.field}>
                                        <span className={styles.fieldLabel}>
                                          Number of sittings
                                        </span>
                                        <span className={styles.inputWrapper}>
                                          <Users size={14} />
                                          <input
                                            type="number"
                                            min={1}
                                            max={30}
                                            value={c.sittings}
                                            onChange={(e) =>
                                              updateCommittee(w.id, c.id, {
                                                sittings: Math.max(
                                                  1,
                                                  parseInt(
                                                    e.target.value,
                                                    10,
                                                  ) || 1,
                                                ),
                                              })
                                            }
                                          />
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* ================= STAGE 2 ================= */}
              {stage === 2 && (
                <motion.section
                  key="stage2"
                  className={styles.card}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className={styles.cardHeader}>
                    <h2>Nights claimed</h2>
                    <p>
                      Enter the total nights claimed for chamber and committee
                      attendance during the claim period.
                    </p>
                  </div>

                  <div className={styles.rowGrid2}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        Nights claimed: chamber attendance
                      </span>
                      <span className={styles.inputWrapper}>
                        <Moon size={16} />
                        <input
                          type="number"
                          min={0}
                          value={form.nights_chamber}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              nights_chamber: Math.max(
                                0,
                                parseInt(e.target.value, 10) || 0,
                              ),
                            })
                          }
                        />
                      </span>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        Nights claimed: committee attendance
                      </span>
                      <span className={styles.inputWrapper}>
                        <Moon size={16} />
                        <input
                          type="number"
                          min={0}
                          value={form.nights_committee}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              nights_committee: Math.max(
                                0,
                                parseInt(e.target.value, 10) || 0,
                              ),
                            })
                          }
                        />
                      </span>
                    </label>
                  </div>

                  <div className={styles.totalBox}>
                    <div>
                      <span>Total nights claimed</span>
                      <strong>{totalNights}</strong>
                    </div>
                  </div>
                </motion.section>
              )}

              {/* ================= STAGE 3 ================= */}
              {stage === 3 && (
                <motion.section
                  key="stage3"
                  className={styles.card}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className={styles.cardHeader}>
                    <h2>Review your claim</h2>
                    <p>
                      Please confirm all information is correct before
                      submitting.
                    </p>
                  </div>

                  <div className={styles.previewBlock}>
                    <div className={styles.previewTitle}>
                      <FileText size={16} />
                      Claim period
                    </div>
                    <div className={styles.previewContent}>
                      <strong>
                        {form.claim_month} {form.claim_year}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.previewBlock}>
                    <div className={styles.previewTitle}>
                      <Calendar size={16} />
                      Weeks attended ({form.weeks.length})
                    </div>
                    <div className={styles.previewTable}>
                      <div className={styles.previewHead}>
                        <span>#</span>
                        <span>Week starting</span>
                        <span>Week ending</span>
                        <span>Attended</span>
                      </div>
                      {form.weeks.map((w, i) => (
                        <div key={w.id} className={styles.previewRow}>
                          <span>{i + 1}</span>
                          <span>{w.week_starting || "—"}</span>
                          <span>{w.week_ending || "—"}</span>
                          <span>
                            {w.attended_chamber && "Chamber"}
                            {w.attended_chamber && w.attended_committee && ", "}
                            {w.attended_committee &&
                              w.committees.map((c) => c.name).join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Committee breakdown */}
                  {form.weeks.some((w) => w.committees.length > 0) && (
                    <div className={styles.previewBlock}>
                      <div className={styles.previewTitle}>
                        <Building2 size={16} />
                        Committee attendance
                      </div>
                      <div className={styles.committeePreviewList}>
                        {form.weeks.flatMap((w, wi) =>
                          w.committees.map((c) => (
                            <div
                              key={c.id}
                              className={styles.committeePreviewRow}
                            >
                              <div className={styles.committeePreviewLeft}>
                                <strong>{c.name}</strong>
                                <span>Week {wi + 1}</span>
                              </div>
                              <div className={styles.committeePreviewRight}>
                                <span>
                                  <Calendar size={12} />
                                  {c.attendance_date || "—"}
                                </span>
                                <span
                                  className={styles.modePill}
                                  data-mode={c.mode}
                                >
                                  {c.mode === "physical" ? (
                                    <>
                                      <MapPin size={12} /> Physical
                                    </>
                                  ) : (
                                    <>
                                      <Video size={12} /> Virtual
                                    </>
                                  )}
                                </span>
                                <span>
                                  <Users size={12} />
                                  {c.sittings} sitting
                                  {c.sittings > 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          )),
                        )}
                      </div>
                    </div>
                  )}

                  <div className={styles.previewBlock}>
                    <div className={styles.previewTitle}>
                      <Moon size={16} />
                      Nights claimed
                    </div>
                    <div className={styles.previewRows}>
                      <div>
                        <span>Chamber attendance</span>
                        <strong>{form.nights_chamber}</strong>
                      </div>
                      <div>
                        <span>Committee attendance</span>
                        <strong>{form.nights_committee}</strong>
                      </div>
                      <div className={styles.previewTotal}>
                        <span>Total</span>
                        <strong>{totalNights}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Declaration */}
                  <div className={styles.declaration}>
                    <div className={styles.declarationTitle}>
                      <ShieldCheck size={16} />
                      Declaration
                    </div>
                    <p className={styles.declarationText}>
                      I certify that I did not travel out of the country, nor
                      benefit from government accommodation on any of the dates
                      stated above.
                    </p>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        Full name of member
                      </span>
                      <span className={styles.inputWrapper}>
                        <Pencil size={16} />
                        <input
                          type="text"
                          placeholder="Type your full name to sign"
                          value={form.declaration_signed_name}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              declaration_signed_name: e.target.value,
                            })
                          }
                        />
                      </span>
                    </label>

                    <label className={styles.termsCheck}>
                      <input
                        type="checkbox"
                        checked={form.declaration_confirmed}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            declaration_confirmed: e.target.checked,
                          })
                        }
                      />
                      <span>
                        I confirm the information above is true and correct.
                      </span>
                    </label>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Nav buttons */}
            <div className={styles.formActions}>
              {stage > 1 ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={goBack}
                  disabled={submitting}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              ) : (
                <Link href="/profile" className={styles.secondaryButton}>
                  Cancel
                </Link>
              )}

              {stage < 3 ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={goNext}
                >
                  Continue
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className={styles.spinner} />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Submit claim
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* ===== Live summary ===== */}
          <aside className={styles.side} aria-label="Claim summary">
            <div className={styles.summaryPanel}>
              <h2>Claim summary</h2>
              <dl className={styles.summaryList}>
                <div>
                  <dt>Period</dt>
                  <dd>
                    {form.claim_month} {form.claim_year}
                  </dd>
                </div>
                <div>
                  <dt>Weeks</dt>
                  <dd>{form.weeks.length}</dd>
                </div>
                <div>
                  <dt>Committees selected</dt>
                  <dd>{committeeTotal}</dd>
                </div>
                <div>
                  <dt>Chamber nights</dt>
                  <dd>{form.nights_chamber}</dd>
                </div>
                <div>
                  <dt>Committee nights</dt>
                  <dd>{form.nights_committee}</dd>
                </div>
              </dl>
              <div className={styles.summaryTotal}>
                <span>Total nights</span>
                <strong>{totalNights}</strong>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// "use client";

// import { useState, type FormEvent } from "react";
// import { useRouter } from "next/navigation";
// import Link from "next/link";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   ArrowLeft,
//   ArrowRight,
//   Plus,
//   Trash2,
//   Calendar,
//   Building2,
//   Moon,
//   CheckCircle2,
//   AlertCircle,
//   Send,
//   FileText,
//   ShieldCheck,
//   Pencil,
//   X,
//   Check,
//   MapPin,
//   Video,
//   Users,
// } from "lucide-react";

// import { createClient } from "@/utils/supabase/client";
// import styles from "./styles.module.css";

// // ---------- Types ----------
// type CommitteeMode = "physical" | "virtual";

// interface CommitteeEntry {
//   id: string;
//   name: string;
//   attendance_date: string;
//   mode: CommitteeMode;
//   sittings: number;
// }

// interface WeekRow {
//   id: string;
//   week_starting: string;
//   week_ending: string;
//   attended_chamber: boolean;
//   attended_committee: boolean;
//   committees: CommitteeEntry[];
// }

// interface FormState {
//   claim_month: string;
//   claim_year: number;
//   weeks: WeekRow[];
//   nights_chamber: number;
//   nights_committee: number;
//   declaration_signed_name: string;
//   declaration_confirmed: boolean;
// }

// const MONTHS = [
//   "January",
//   "February",
//   "March",
//   "April",
//   "May",
//   "June",
//   "July",
//   "August",
//   "September",
//   "October",
//   "November",
//   "December",
// ];

// const COMMITTEES = [
//   "Finance and Budget Committee",
//   "Education Committee",
//   "Health Committee",
//   "Agriculture Committee",
//   "Energy Committee",
//   "Transport Committee",
//   "Justice and Legal Affairs",
//   "Labour and Social Welfare",
//   "National Security",
//   "County Public Accounts",
//   "Delegated Legislation",
//   "Standing Orders",
// ];

// const uid = () => Math.random().toString(36).slice(2, 10);

// const blankWeek = (): WeekRow => ({
//   id: uid(),
//   week_starting: "",
//   week_ending: "",
//   attended_chamber: false,
//   attended_committee: false,
//   committees: [],
// });

// type Stage = 1 | 2 | 3;

// export default function NewClaimPage() {
//   const router = useRouter();
//   const supabase = createClient();

//   const now = new Date();
//   const [stage, setStage] = useState<Stage>(1);
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState("");
//   const [done, setDone] = useState(false);

//   const [form, setForm] = useState<FormState>({
//     claim_month: MONTHS[now.getMonth()],
//     claim_year: now.getFullYear(),
//     weeks: [blankWeek()],
//     nights_chamber: 0,
//     nights_committee: 0,
//     declaration_signed_name: "",
//     declaration_confirmed: false,
//   });

//   // ---------- Week handlers ----------
//   const addWeek = () =>
//     setForm((p) => ({ ...p, weeks: [...p.weeks, blankWeek()] }));

//   const removeWeek = (id: string) =>
//     setForm((p) => ({ ...p, weeks: p.weeks.filter((w) => w.id !== id) }));

//   const updateWeek = (id: string, patch: Partial<WeekRow>) =>
//     setForm((p) => ({
//       ...p,
//       weeks: p.weeks.map((w) => (w.id === id ? { ...w, ...patch } : w)),
//     }));

//   // ---------- Committee handlers ----------
//   const toggleCommittee = (weekId: string, committee: string) => {
//     setForm((p) => ({
//       ...p,
//       weeks: p.weeks.map((w) => {
//         if (w.id !== weekId) return w;
//         const existing = w.committees.find((c) => c.name === committee);
//         if (existing) {
//           return {
//             ...w,
//             committees: w.committees.filter((c) => c.name !== committee),
//           };
//         }
//         return {
//           ...w,
//           committees: [
//             ...w.committees,
//             {
//               id: uid(),
//               name: committee,
//               attendance_date: "",
//               mode: "physical",
//               sittings: 1,
//             },
//           ],
//         };
//       }),
//     }));
//   };

//   const updateCommittee = (
//     weekId: string,
//     committeeId: string,
//     patch: Partial<CommitteeEntry>,
//   ) => {
//     setForm((p) => ({
//       ...p,
//       weeks: p.weeks.map((w) =>
//         w.id === weekId
//           ? {
//               ...w,
//               committees: w.committees.map((c) =>
//                 c.id === committeeId ? { ...c, ...patch } : c,
//               ),
//             }
//           : w,
//       ),
//     }));
//   };

//   const removeCommittee = (weekId: string, committeeId: string) => {
//     setForm((p) => ({
//       ...p,
//       weeks: p.weeks.map((w) =>
//         w.id === weekId
//           ? {
//               ...w,
//               committees: w.committees.filter((c) => c.id !== committeeId),
//             }
//           : w,
//       ),
//     }));
//   };

//   // ---------- Validation ----------
//   const validateStage1 = (): string | null => {
//     if (form.weeks.length === 0) return "Add at least one week.";
//     for (let i = 0; i < form.weeks.length; i++) {
//       const w = form.weeks[i];
//       if (!w.week_starting) return `Week ${i + 1}: start date is required.`;
//       if (!w.week_ending) return `Week ${i + 1}: end date is required.`;
//       if (new Date(w.week_ending) < new Date(w.week_starting))
//         return `Week ${i + 1}: end date cannot be before start date.`;
//       if (!w.attended_chamber && !w.attended_committee)
//         return `Week ${i + 1}: tick at least Chamber or Committee.`;

//       if (w.attended_committee) {
//         if (w.committees.length === 0)
//           return `Week ${i + 1}: select at least one committee.`;
//         for (const c of w.committees) {
//           if (!c.attendance_date)
//             return `Week ${i + 1}: "${c.name}" — attendance date is required.`;
//           if (
//             new Date(c.attendance_date) < new Date(w.week_starting) ||
//             new Date(c.attendance_date) > new Date(w.week_ending)
//           )
//             return `Week ${i + 1}: "${c.name}" — attendance date must be within the week.`;
//           if (c.sittings < 1)
//             return `Week ${i + 1}: "${c.name}" — number of sittings must be at least 1.`;
//         }
//       }
//     }
//     return null;
//   };

//   const validateStage2 = (): string | null => {
//     if (form.nights_chamber < 0 || form.nights_committee < 0)
//       return "Nights cannot be negative.";
//     if (form.nights_chamber + form.nights_committee === 0)
//       return "Enter at least one night claimed.";
//     return null;
//   };

//   const validateStage3 = (): string | null => {
//     if (!form.declaration_signed_name.trim())
//       return "Type your full name to sign the declaration.";
//     if (!form.declaration_confirmed) return "Please confirm the declaration.";
//     return null;
//   };

//   const goNext = () => {
//     setError("");
//     if (stage === 1) {
//       const v = validateStage1();
//       if (v) return setError(v);
//       setStage(2);
//     } else if (stage === 2) {
//       const v = validateStage2();
//       if (v) return setError(v);
//       setStage(3);
//     }
//   };

//   const goBack = () => {
//     setError("");
//     if (stage === 3) setStage(2);
//     else if (stage === 2) setStage(1);
//   };

//   // ---------- Submit ----------
//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     setError("");
//     const v = validateStage3();
//     if (v) return setError(v);

//     setSubmitting(true);

//     try {
//       const {
//         data: { user },
//         error: userError,
//       } = await supabase.auth.getUser();
//       if (userError) {
//         console.error("Could not verify the signed-in member:", userError);
//         setError("We could not verify your account. Please sign in again.");
//         return;
//       }
//       if (!user) {
//         router.replace("/member/login");
//         return;
//       }

//       const weekPayload = form.weeks.map((w, i) => ({
//         week_number: i + 1,
//         week_starting: w.week_starting,
//         week_ending: w.week_ending,
//         attended_chamber: w.attended_chamber,
//         attended_committee: w.attended_committee,
//         committees: w.attended_committee
//           ? w.committees.map((c) => ({
//               name: c.name,
//               attendance_date: c.attendance_date,
//               mode: c.mode,
//               sittings: c.sittings,
//             }))
//           : [],
//       }));

//       const { error: claimErr } = await supabase.rpc("submit_member_claim", {
//         p_claim_month: form.claim_month,
//         p_claim_year: form.claim_year,
//         p_nights_chamber: form.nights_chamber,
//         p_nights_committee: form.nights_committee,
//         p_declaration_signed_name: form.declaration_signed_name.trim(),
//         p_weeks: weekPayload,
//       });

//       if (claimErr) {
//         console.error(claimErr);
//         setError(
//           claimErr.code === "PGRST202"
//             ? "Claim submission is not set up in the database yet. Apply the latest Supabase migrations, then try again."
//             : "Could not save your claim. Please try again.",
//         );
//         return;
//       }

//       setDone(true);
//     } catch (err) {
//       console.error(err);
//       setError("Something went wrong. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   // ---------- Success ----------
//   if (done) {
//     return (
//       <main className={styles.page}>
//         <motion.div
//           className={styles.successCard}
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//         >
//           <div className={styles.successIcon}>
//             <CheckCircle2 size={36} />
//           </div>
//           <h1>Claim Submitted</h1>
//           <p>
//             Your DSA claim for{" "}
//             <strong>
//               {form.claim_month} {form.claim_year}
//             </strong>{" "}
//             has been submitted and is now <strong>under review</strong> by the
//             Secretary.
//           </p>
//           <p className={styles.successNote}>
//             You can follow the review status from your profile page.
//           </p>
//           <div className={styles.successActions}>
//             <Link href="/member/profile" className={styles.secondaryButton}>
//               Go to profile
//             </Link>
//             <Link href="/member/profile" className={styles.primaryButton}>
//               View my claims <ArrowRight size={16} />
//             </Link>
//           </div>
//         </motion.div>
//       </main>
//     );
//   }

//   const totalNights = form.nights_chamber + form.nights_committee;

//   return (
//     <main className={styles.page}>
//       <header className={styles.topBar}>
//         <Link href="/member/profile" className={styles.backLink}>
//           <ArrowLeft size={16} />
//           Back
//         </Link>
//         <div className={styles.topTitle}>
//           <FileText size={18} />
//           <div>
//             <strong>New DSA Claim</strong>
//             <span>Domestic Subsistence Facilitation</span>
//           </div>
//         </div>
//       </header>

//       {/* Stepper */}
//       <div className={styles.stepper}>
//         {[1, 2, 3].map((n) => (
//           <div
//             key={n}
//             className={styles.step}
//             data-active={stage === n}
//             data-done={stage > n}
//           >
//             <span className={styles.stepNum}>{stage > n ? "✓" : n}</span>
//             <span className={styles.stepLabel}>
//               {n === 1 && "Weeks attended"}
//               {n === 2 && "Nights claimed"}
//               {n === 3 && "Review & submit"}
//             </span>
//           </div>
//         ))}
//       </div>

//       {error && (
//         <div className={styles.errorAlert} role="alert">
//           <AlertCircle size={16} />
//           <span>{error}</span>
//         </div>
//       )}

//       <form onSubmit={handleSubmit} className={styles.form}>
//         <AnimatePresence mode="wait">
//           {/* ================= STAGE 1 ================= */}
//           {stage === 1 && (
//             <motion.section
//               key="stage1"
//               className={styles.card}
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -20 }}
//             >
//               <div className={styles.cardHeader}>
//                 <h2>Claim period & weeks attended</h2>
//                 <p>
//                   Add each week you attended parliamentary business. For each
//                   committee you attended, provide the attendance date, mode, and
//                   number of sittings.
//                 </p>
//               </div>

//               <div className={styles.rowGrid2}>
//                 <div className={styles.inputGroup}>
//                   <label>Claim month</label>
//                   <select
//                     value={form.claim_month}
//                     onChange={(e) =>
//                       setForm({ ...form, claim_month: e.target.value })
//                     }
//                   >
//                     {MONTHS.map((m) => (
//                       <option key={m} value={m}>
//                         {m}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//                 <div className={styles.inputGroup}>
//                   <label>Year</label>
//                   <input
//                     type="number"
//                     min={2020}
//                     max={2100}
//                     value={form.claim_year}
//                     onChange={(e) =>
//                       setForm({
//                         ...form,
//                         claim_year:
//                           parseInt(e.target.value, 10) || now.getFullYear(),
//                       })
//                     }
//                   />
//                 </div>
//               </div>

//               <div className={styles.weeksHeader}>
//                 <h3>Weeks</h3>
//                 <button
//                   type="button"
//                   onClick={addWeek}
//                   className={styles.addButton}
//                 >
//                   <Plus size={16} />
//                   Add week
//                 </button>
//               </div>

//               <div className={styles.weeks}>
//                 {form.weeks.map((w, idx) => (
//                   <motion.div
//                     key={w.id}
//                     layout
//                     className={styles.weekRow}
//                     initial={{ opacity: 0, y: -8 }}
//                     animate={{ opacity: 1, y: 0 }}
//                   >
//                     <div className={styles.weekTop}>
//                       <span className={styles.weekBadge}>Week {idx + 1}</span>
//                       {form.weeks.length > 1 && (
//                         <button
//                           type="button"
//                           className={styles.removeButton}
//                           onClick={() => removeWeek(w.id)}
//                           aria-label="Remove week"
//                         >
//                           <Trash2 size={15} />
//                         </button>
//                       )}
//                     </div>

//                     <div className={styles.rowGrid2}>
//                       <div className={styles.inputGroup}>
//                         <label>Week starting</label>
//                         <div className={styles.inputWrapper}>
//                           <Calendar size={16} />
//                           <input
//                             type="date"
//                             value={w.week_starting}
//                             onChange={(e) =>
//                               updateWeek(w.id, {
//                                 week_starting: e.target.value,
//                               })
//                             }
//                           />
//                         </div>
//                       </div>
//                       <div className={styles.inputGroup}>
//                         <label>Week ending</label>
//                         <div className={styles.inputWrapper}>
//                           <Calendar size={16} />
//                           <input
//                             type="date"
//                             value={w.week_ending}
//                             onChange={(e) =>
//                               updateWeek(w.id, {
//                                 week_ending: e.target.value,
//                               })
//                             }
//                           />
//                         </div>
//                       </div>
//                     </div>

//                     <div className={styles.checkRow}>
//                       <label className={styles.checkItem}>
//                         <input
//                           type="checkbox"
//                           checked={w.attended_chamber}
//                           onChange={(e) =>
//                             updateWeek(w.id, {
//                               attended_chamber: e.target.checked,
//                             })
//                           }
//                         />
//                         <span>Chamber sitting</span>
//                       </label>
//                       <label className={styles.checkItem}>
//                         <input
//                           type="checkbox"
//                           checked={w.attended_committee}
//                           onChange={(e) =>
//                             updateWeek(w.id, {
//                               attended_committee: e.target.checked,
//                               committees: e.target.checked ? w.committees : [],
//                             })
//                           }
//                         />
//                         <span>Committee sitting</span>
//                       </label>
//                     </div>

//                     {w.attended_committee && (
//                       <div className={styles.committeePicker}>
//                         <div className={styles.committeePickerHeader}>
//                           <label>Committees attended</label>
//                           {w.committees.length > 0 && (
//                             <span className={styles.committeeCount}>
//                               {w.committees.length} selected
//                             </span>
//                           )}
//                         </div>

//                         <div className={styles.chipGrid}>
//                           {COMMITTEES.map((c) => {
//                             const selected = w.committees.some(
//                               (x) => x.name === c,
//                             );
//                             return (
//                               <button
//                                 type="button"
//                                 key={c}
//                                 className={styles.chip}
//                                 data-selected={selected}
//                                 onClick={() => toggleCommittee(w.id, c)}
//                               >
//                                 <span className={styles.chipCheck}>
//                                   {selected ? (
//                                     <Check size={12} />
//                                   ) : (
//                                     <Plus size={12} />
//                                   )}
//                                 </span>
//                                 {c}
//                               </button>
//                             );
//                           })}
//                         </div>

//                         {/* Per-committee details */}
//                         {w.committees.length > 0 && (
//                           <div className={styles.committeeDetails}>
//                             {w.committees.map((c) => (
//                               <div
//                                 key={c.id}
//                                 className={styles.committeeDetailCard}
//                               >
//                                 <div className={styles.committeeDetailHeader}>
//                                   <div className={styles.committeeName}>
//                                     <Building2 size={14} />
//                                     <strong>{c.name}</strong>
//                                   </div>
//                                   <button
//                                     type="button"
//                                     onClick={() => removeCommittee(w.id, c.id)}
//                                     className={styles.removeButton}
//                                     aria-label={`Remove ${c.name}`}
//                                   >
//                                     <X size={14} />
//                                   </button>
//                                 </div>

//                                 <div className={styles.committeeGrid}>
//                                   <div className={styles.inputGroup}>
//                                     <label>Attendance date</label>
//                                     <div className={styles.inputWrapper}>
//                                       <Calendar size={14} />
//                                       <input
//                                         type="date"
//                                         min={w.week_starting || undefined}
//                                         max={w.week_ending || undefined}
//                                         value={c.attendance_date}
//                                         onChange={(e) =>
//                                           updateCommittee(w.id, c.id, {
//                                             attendance_date: e.target.value,
//                                           })
//                                         }
//                                       />
//                                     </div>
//                                   </div>

//                                   <div className={styles.inputGroup}>
//                                     <label>Mode</label>
//                                     <div className={styles.modeToggle}>
//                                       <button
//                                         type="button"
//                                         className={styles.modeOption}
//                                         data-active={c.mode === "physical"}
//                                         onClick={() =>
//                                           updateCommittee(w.id, c.id, {
//                                             mode: "physical",
//                                           })
//                                         }
//                                       >
//                                         <MapPin size={14} />
//                                         Physical
//                                       </button>
//                                       <button
//                                         type="button"
//                                         className={styles.modeOption}
//                                         data-active={c.mode === "virtual"}
//                                         onClick={() =>
//                                           updateCommittee(w.id, c.id, {
//                                             mode: "virtual",
//                                           })
//                                         }
//                                       >
//                                         <Video size={14} />
//                                         Virtual
//                                       </button>
//                                     </div>
//                                   </div>

//                                   <div className={styles.inputGroup}>
//                                     <label>Number of sittings</label>
//                                     <div className={styles.inputWrapper}>
//                                       <Users size={14} />
//                                       <input
//                                         type="number"
//                                         min={1}
//                                         max={30}
//                                         value={c.sittings}
//                                         onChange={(e) =>
//                                           updateCommittee(w.id, c.id, {
//                                             sittings: Math.max(
//                                               1,
//                                               parseInt(e.target.value, 10) || 1,
//                                             ),
//                                           })
//                                         }
//                                       />
//                                     </div>
//                                   </div>
//                                 </div>
//                               </div>
//                             ))}
//                           </div>
//                         )}
//                       </div>
//                     )}
//                   </motion.div>
//                 ))}
//               </div>
//             </motion.section>
//           )}

//           {/* ================= STAGE 2 ================= */}
//           {stage === 2 && (
//             <motion.section
//               key="stage2"
//               className={styles.card}
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -20 }}
//             >
//               <div className={styles.cardHeader}>
//                 <h2>Nights claimed</h2>
//                 <p>
//                   Enter the total nights claimed for chamber and committee
//                   attendance during the claim period.
//                 </p>
//               </div>

//               <div className={styles.inputGroup}>
//                 <label>Nights claimed — Chamber attendance</label>
//                 <div className={styles.inputWrapper}>
//                   <Moon size={16} />
//                   <input
//                     type="number"
//                     min={0}
//                     value={form.nights_chamber}
//                     onChange={(e) =>
//                       setForm({
//                         ...form,
//                         nights_chamber: Math.max(
//                           0,
//                           parseInt(e.target.value, 10) || 0,
//                         ),
//                       })
//                     }
//                   />
//                 </div>
//               </div>

//               <div className={styles.inputGroup}>
//                 <label>Nights claimed — Committee attendance</label>
//                 <div className={styles.inputWrapper}>
//                   <Moon size={16} />
//                   <input
//                     type="number"
//                     min={0}
//                     value={form.nights_committee}
//                     onChange={(e) =>
//                       setForm({
//                         ...form,
//                         nights_committee: Math.max(
//                           0,
//                           parseInt(e.target.value, 10) || 0,
//                         ),
//                       })
//                     }
//                   />
//                 </div>
//               </div>

//               <div className={styles.totalBox}>
//                 <div>
//                   <span>Total nights claimed</span>
//                   <strong>{totalNights}</strong>
//                 </div>
//               </div>
//             </motion.section>
//           )}

//           {/* ================= STAGE 3 ================= */}
//           {stage === 3 && (
//             <motion.section
//               key="stage3"
//               className={styles.card}
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -20 }}
//             >
//               <div className={styles.cardHeader}>
//                 <h2>Review your claim</h2>
//                 <p>
//                   Please confirm all information is correct before submitting.
//                 </p>
//               </div>

//               <div className={styles.previewBlock}>
//                 <div className={styles.previewTitle}>
//                   <FileText size={16} />
//                   Claim period
//                 </div>
//                 <div className={styles.previewContent}>
//                   <strong>
//                     {form.claim_month} {form.claim_year}
//                   </strong>
//                 </div>
//               </div>

//               <div className={styles.previewBlock}>
//                 <div className={styles.previewTitle}>
//                   <Calendar size={16} />
//                   Weeks attended ({form.weeks.length})
//                 </div>
//                 <div className={styles.previewTable}>
//                   <div className={styles.previewHead}>
//                     <span>#</span>
//                     <span>Week starting</span>
//                     <span>Week ending</span>
//                     <span>Attended</span>
//                   </div>
//                   {form.weeks.map((w, i) => (
//                     <div key={w.id} className={styles.previewRow}>
//                       <span>{i + 1}</span>
//                       <span>{w.week_starting || "—"}</span>
//                       <span>{w.week_ending || "—"}</span>
//                       <span>
//                         {w.attended_chamber && "Chamber"}
//                         {w.attended_chamber && w.attended_committee && " · "}
//                         {w.attended_committee &&
//                           w.committees.map((c) => c.name).join(", ")}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* Committee breakdown */}
//               {form.weeks.some((w) => w.committees.length > 0) && (
//                 <div className={styles.previewBlock}>
//                   <div className={styles.previewTitle}>
//                     <Building2 size={16} />
//                     Committee attendance
//                   </div>
//                   <div className={styles.committeePreviewList}>
//                     {form.weeks.flatMap((w, wi) =>
//                       w.committees.map((c) => (
//                         <div key={c.id} className={styles.committeePreviewRow}>
//                           <div className={styles.committeePreviewLeft}>
//                             <strong>{c.name}</strong>
//                             <span>Week {wi + 1}</span>
//                           </div>
//                           <div className={styles.committeePreviewRight}>
//                             <span>
//                               <Calendar size={12} />
//                               {c.attendance_date || "—"}
//                             </span>
//                             <span
//                               className={styles.modePill}
//                               data-mode={c.mode}
//                             >
//                               {c.mode === "physical" ? (
//                                 <>
//                                   <MapPin size={12} /> Physical
//                                 </>
//                               ) : (
//                                 <>
//                                   <Video size={12} /> Virtual
//                                 </>
//                               )}
//                             </span>
//                             <span>
//                               <Users size={12} />
//                               {c.sittings} sitting{c.sittings > 1 ? "s" : ""}
//                             </span>
//                           </div>
//                         </div>
//                       )),
//                     )}
//                   </div>
//                 </div>
//               )}

//               <div className={styles.previewBlock}>
//                 <div className={styles.previewTitle}>
//                   <Moon size={16} />
//                   Nights claimed
//                 </div>
//                 <div className={styles.previewRows}>
//                   <div>
//                     <span>Chamber attendance</span>
//                     <strong>{form.nights_chamber}</strong>
//                   </div>
//                   <div>
//                     <span>Committee attendance</span>
//                     <strong>{form.nights_committee}</strong>
//                   </div>
//                   <div className={styles.previewTotal}>
//                     <span>Total</span>
//                     <strong>{totalNights}</strong>
//                   </div>
//                 </div>
//               </div>

//               {/* Declaration */}
//               <div className={styles.declaration}>
//                 <div className={styles.declarationTitle}>
//                   <ShieldCheck size={16} />
//                   Declaration
//                 </div>
//                 <p className={styles.declarationText}>
//                   I certify that I did not travel out of the country, nor
//                   benefit from government accommodation on any of the dates
//                   stated above.
//                 </p>

//                 <div className={styles.inputGroup}>
//                   <label>Full name of member</label>
//                   <div className={styles.inputWrapper}>
//                     <Pencil size={16} />
//                     <input
//                       type="text"
//                       placeholder="Type your full name to sign"
//                       value={form.declaration_signed_name}
//                       onChange={(e) =>
//                         setForm({
//                           ...form,
//                           declaration_signed_name: e.target.value,
//                         })
//                       }
//                     />
//                   </div>
//                 </div>

//                 <label className={styles.termsCheck}>
//                   <input
//                     type="checkbox"
//                     checked={form.declaration_confirmed}
//                     onChange={(e) =>
//                       setForm({
//                         ...form,
//                         declaration_confirmed: e.target.checked,
//                       })
//                     }
//                   />
//                   <span>
//                     I confirm the information above is true and correct.
//                   </span>
//                 </label>
//               </div>
//             </motion.section>
//           )}
//         </AnimatePresence>

//         {/* Nav buttons */}
//         <div className={styles.formActions}>
//           {stage > 1 ? (
//             <button
//               type="button"
//               className={styles.secondaryButton}
//               onClick={goBack}
//               disabled={submitting}
//             >
//               <ArrowLeft size={16} />
//               Back
//             </button>
//           ) : (
//             <Link href="/profile" className={styles.secondaryButton}>
//               Cancel
//             </Link>
//           )}

//           {stage < 3 ? (
//             <button
//               type="button"
//               className={styles.primaryButton}
//               onClick={goNext}
//             >
//               Continue
//               <ArrowRight size={16} />
//             </button>
//           ) : (
//             <button
//               type="submit"
//               className={styles.primaryButton}
//               disabled={submitting}
//             >
//               {submitting ? (
//                 <>
//                   <span className={styles.spinner} />
//                   Submitting…
//                 </>
//               ) : (
//                 <>
//                   <Send size={16} />
//                   Submit claim
//                 </>
//               )}
//             </button>
//           )}
//         </div>
//       </form>
//     </main>
//   );
// }
// "use client";

// import { useState, type FormEvent, type ChangeEvent } from "react";
// import { useRouter } from "next/navigation";
// import Link from "next/link";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   ArrowLeft,
//   ArrowRight,
//   Plus,
//   Trash2,
//   Calendar,
//   Building2,
//   Moon,
//   CheckCircle2,
//   AlertCircle,
//   Send,
//   FileText,
//   ShieldCheck,
//   Pencil,
// } from "lucide-react";

// import { createClient } from "@/utils/supabase/client";
// import styles from "./styles.module.css";

// // ---------- Types ----------
// interface WeekRow {
//   id: string; // local key only
//   week_starting: string;
//   week_ending: string;
//   attended_chamber: boolean;
//   attended_committee: boolean;
//   committee_name: string;
// }

// interface FormState {
//   claim_month: string; // e.g. "January"
//   claim_year: number;
//   weeks: WeekRow[];
//   nights_chamber: number;
//   nights_committee: number;
//   declaration_signed_name: string;
//   declaration_confirmed: boolean;
// }

// const MONTHS = [
//   "January",
//   "February",
//   "March",
//   "April",
//   "May",
//   "June",
//   "July",
//   "August",
//   "September",
//   "October",
//   "November",
//   "December",
// ];

// const COMMITTEES = [
//   "Finance and Budget Committee",
//   "Education Committee",
//   "Health Committee",
//   "Agriculture Committee",
//   "Energy Committee",
//   "Transport Committee",
//   "Justice and Legal Affairs",
//   "Labour and Social Welfare",
//   "National Security",
//   "County Public Accounts",
//   "Delegated Legislation",
//   "Standing Orders",
// ];

// const uid = () => Math.random().toString(36).slice(2, 10);

// const blankWeek = (): WeekRow => ({
//   id: uid(),
//   week_starting: "",
//   week_ending: "",
//   attended_chamber: false,
//   attended_committee: false,
//   committee_name: "",
// });

// type Stage = 1 | 2 | 3;

// export default function NewClaimPage() {
//   const router = useRouter();
//   const supabase = createClient();

//   const now = new Date();
//   const [stage, setStage] = useState<Stage>(1);
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState("");
//   const [done, setDone] = useState(false);

//   const [form, setForm] = useState<FormState>({
//     claim_month: MONTHS[now.getMonth()],
//     claim_year: now.getFullYear(),
//     weeks: [blankWeek()],
//     nights_chamber: 0,
//     nights_committee: 0,
//     declaration_signed_name: "",
//     declaration_confirmed: false,
//   });

//   // ---------- Week handlers ----------
//   const addWeek = () =>
//     setForm((p) => ({ ...p, weeks: [...p.weeks, blankWeek()] }));

//   const removeWeek = (id: string) =>
//     setForm((p) => ({
//       ...p,
//       weeks: p.weeks.filter((w) => w.id !== id),
//     }));

//   const updateWeek = (id: string, patch: Partial<WeekRow>) =>
//     setForm((p) => ({
//       ...p,
//       weeks: p.weeks.map((w) => (w.id === id ? { ...w, ...patch } : w)),
//     }));

//   // ---------- Validation ----------
//   const validateStage1 = (): string | null => {
//     if (form.weeks.length === 0) return "Add at least one week.";
//     for (let i = 0; i < form.weeks.length; i++) {
//       const w = form.weeks[i];
//       if (!w.week_starting) return `Week ${i + 1}: start date is required.`;
//       if (!w.week_ending) return `Week ${i + 1}: end date is required.`;
//       if (new Date(w.week_ending) < new Date(w.week_starting))
//         return `Week ${i + 1}: end date cannot be before start date.`;
//       if (!w.attended_chamber && !w.attended_committee)
//         return `Week ${i + 1}: tick at least Chamber or Committee.`;
//       if (w.attended_committee && !w.committee_name)
//         return `Week ${i + 1}: select the committee attended.`;
//     }
//     return null;
//   };

//   const validateStage2 = (): string | null => {
//     if (form.nights_chamber < 0 || form.nights_committee < 0)
//       return "Nights cannot be negative.";
//     if (form.nights_chamber + form.nights_committee === 0)
//       return "Enter at least one night claimed.";
//     return null;
//   };

//   const validateStage3 = (): string | null => {
//     if (!form.declaration_signed_name.trim())
//       return "Type your full name to sign the declaration.";
//     if (!form.declaration_confirmed) return "Please confirm the declaration.";
//     return null;
//   };

//   const goNext = () => {
//     setError("");
//     if (stage === 1) {
//       const v = validateStage1();
//       if (v) return setError(v);
//       setStage(2);
//     } else if (stage === 2) {
//       const v = validateStage2();
//       if (v) return setError(v);
//       setStage(3);
//     }
//   };

//   const goBack = () => {
//     setError("");
//     if (stage === 3) setStage(2);
//     else if (stage === 2) setStage(1);
//   };

//   // ---------- Submit ----------
//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     setError("");
//     const v = validateStage3();
//     if (v) return setError(v);

//     setSubmitting(true);

//     try {
//       const {
//         data: { user },
//       } = await supabase.auth.getUser();
//       if (!user) {
//         router.replace("/login");
//         return;
//       }

//       // 1. Insert claim header
//       const { data: claim, error: claimErr } = await supabase
//         .from("claims")
//         .insert({
//           member_id: user.id,
//           claim_month: form.claim_month,
//           claim_year: form.claim_year,
//           nights_chamber: form.nights_chamber,
//           nights_committee: form.nights_committee,
//           status: "secretary_review",
//           declaration_signed_name: form.declaration_signed_name.trim(),
//           declaration_confirmed: true,
//         })
//         .select()
//         .single();

//       if (claimErr || !claim) {
//         console.error(claimErr);
//         setError("Could not save your claim. Please try again.");
//         return;
//       }

//       // 2. Insert week rows
//       const weekPayload = form.weeks.map((w, i) => ({
//         claim_id: claim.id,
//         week_number: i + 1,
//         week_starting: w.week_starting,
//         week_ending: w.week_ending,
//         attended_chamber: w.attended_chamber,
//         attended_committee: w.attended_committee,
//         committee_name: w.attended_committee ? w.committee_name : null,
//       }));

//       const { error: weeksErr } = await supabase
//         .from("claim_weeks")
//         .insert(weekPayload);

//       if (weeksErr) {
//         console.error(weeksErr);
//         setError(
//           "Your claim was saved, but the week details failed. Please contact support.",
//         );
//         return;
//       }

//       // 3. Notify secretaries
//       const { data: secretaries } = await supabase
//         .from("profiles")
//         .select("id")
//         .eq("role", "secretary");

//       if (secretaries && secretaries.length > 0) {
//         await supabase.from("notifications").insert(
//           secretaries.map((s) => ({
//             user_id: s.id,
//             claim_id: claim.id,
//             title: "New DSA Claim Submitted",
//             message: `A DSA claim for ${form.claim_month} ${form.claim_year} has been submitted and is awaiting your review.`,
//             type: "info",
//           })),
//         );
//       }

//       // 4. Notify the member
//       await supabase.from("notifications").insert({
//         user_id: user.id,
//         claim_id: claim.id,
//         title: "Claim submitted — under review",
//         message: `Your DSA claim for ${form.claim_month} ${form.claim_year} has been submitted and is now under review by the Secretary.`,
//         type: "info",
//       });

//       setDone(true);
//     } catch (err) {
//       console.error(err);
//       setError("Something went wrong. Please try again.");
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   // ---------- Success ----------
//   if (done) {
//     return (
//       <main className={styles.page}>
//         <motion.div
//           className={styles.successCard}
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//         >
//           <div className={styles.successIcon}>
//             <CheckCircle2 size={36} />
//           </div>
//           <h1>Claim Submitted</h1>
//           <p>
//             Your DSA claim for{" "}
//             <strong>
//               {form.claim_month} {form.claim_year}
//             </strong>{" "}
//             has been submitted and is now <strong>under review</strong> by the
//             Secretary.
//           </p>
//           <p className={styles.successNote}>
//             You&apos;ll receive a notification once it&apos;s forwarded to the
//             Director or approved.
//           </p>
//           <div className={styles.successActions}>
//             <Link href="/profile" className={styles.secondaryButton}>
//               Go to profile
//             </Link>
//             <Link href="/member/claims" className={styles.primaryButton}>
//               View my claims <ArrowRight size={16} />
//             </Link>
//           </div>
//         </motion.div>
//       </main>
//     );
//   }

//   const totalNights = form.nights_chamber + form.nights_committee;

//   return (
//     <main className={styles.page}>
//       <header className={styles.topBar}>
//         <Link href="/profile" className={styles.backLink}>
//           <ArrowLeft size={16} />
//           Back
//         </Link>
//         <div className={styles.topTitle}>
//           <FileText size={18} />
//           <div>
//             <strong>New DSA Claim</strong>
//             <span>Domestic Subsistence Facilitation</span>
//           </div>
//         </div>
//       </header>

//       {/* Stepper */}
//       <div className={styles.stepper}>
//         {[1, 2, 3].map((n) => (
//           <div
//             key={n}
//             className={styles.step}
//             data-active={stage === n}
//             data-done={stage > n}
//           >
//             <span className={styles.stepNum}>{stage > n ? "✓" : n}</span>
//             <span className={styles.stepLabel}>
//               {n === 1 && "Weeks attended"}
//               {n === 2 && "Nights claimed"}
//               {n === 3 && "Review & submit"}
//             </span>
//           </div>
//         ))}
//       </div>

//       {error && (
//         <div className={styles.errorAlert} role="alert">
//           <AlertCircle size={16} />
//           <span>{error}</span>
//         </div>
//       )}

//       <form onSubmit={handleSubmit} className={styles.form}>
//         <AnimatePresence mode="wait">
//           {/* ================= STAGE 1 ================= */}
//           {stage === 1 && (
//             <motion.section
//               key="stage1"
//               className={styles.card}
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -20 }}
//             >
//               <div className={styles.cardHeader}>
//                 <h2>Claim period & weeks attended</h2>
//                 <p>
//                   Add each week you attended parliamentary business. Tick
//                   Chamber, Committee, or both.
//                 </p>
//               </div>

//               <div className={styles.rowGrid2}>
//                 <div className={styles.inputGroup}>
//                   <label>Claim month</label>
//                   <select
//                     value={form.claim_month}
//                     onChange={(e) =>
//                       setForm({ ...form, claim_month: e.target.value })
//                     }
//                   >
//                     {MONTHS.map((m) => (
//                       <option key={m} value={m}>
//                         {m}
//                       </option>
//                     ))}
//                   </select>
//                 </div>
//                 <div className={styles.inputGroup}>
//                   <label>Year</label>
//                   <input
//                     type="number"
//                     min={2020}
//                     max={2100}
//                     value={form.claim_year}
//                     onChange={(e) =>
//                       setForm({
//                         ...form,
//                         claim_year:
//                           parseInt(e.target.value, 10) || now.getFullYear(),
//                       })
//                     }
//                   />
//                 </div>
//               </div>

//               <div className={styles.weeksHeader}>
//                 <h3>Weeks</h3>
//                 <button
//                   type="button"
//                   onClick={addWeek}
//                   className={styles.addButton}
//                 >
//                   <Plus size={16} />
//                   Add week
//                 </button>
//               </div>

//               <div className={styles.weeks}>
//                 {form.weeks.map((w, idx) => (
//                   <motion.div
//                     key={w.id}
//                     layout
//                     className={styles.weekRow}
//                     initial={{ opacity: 0, y: -8 }}
//                     animate={{ opacity: 1, y: 0 }}
//                   >
//                     <div className={styles.weekTop}>
//                       <span className={styles.weekBadge}>Week {idx + 1}</span>
//                       {form.weeks.length > 1 && (
//                         <button
//                           type="button"
//                           className={styles.removeButton}
//                           onClick={() => removeWeek(w.id)}
//                           aria-label="Remove week"
//                         >
//                           <Trash2 size={15} />
//                         </button>
//                       )}
//                     </div>

//                     <div className={styles.rowGrid2}>
//                       <div className={styles.inputGroup}>
//                         <label>Week starting</label>
//                         <div className={styles.inputWrapper}>
//                           <Calendar size={16} />
//                           <input
//                             type="date"
//                             value={w.week_starting}
//                             onChange={(e) =>
//                               updateWeek(w.id, {
//                                 week_starting: e.target.value,
//                               })
//                             }
//                           />
//                         </div>
//                       </div>
//                       <div className={styles.inputGroup}>
//                         <label>Week ending</label>
//                         <div className={styles.inputWrapper}>
//                           <Calendar size={16} />
//                           <input
//                             type="date"
//                             value={w.week_ending}
//                             onChange={(e) =>
//                               updateWeek(w.id, { week_ending: e.target.value })
//                             }
//                           />
//                         </div>
//                       </div>
//                     </div>

//                     <div className={styles.checkRow}>
//                       <label className={styles.checkItem}>
//                         <input
//                           type="checkbox"
//                           checked={w.attended_chamber}
//                           onChange={(e) =>
//                             updateWeek(w.id, {
//                               attended_chamber: e.target.checked,
//                             })
//                           }
//                         />
//                         <span>Chamber sitting</span>
//                       </label>
//                       <label className={styles.checkItem}>
//                         <input
//                           type="checkbox"
//                           checked={w.attended_committee}
//                           onChange={(e) =>
//                             updateWeek(w.id, {
//                               attended_committee: e.target.checked,
//                             })
//                           }
//                         />
//                         <span>Committee sitting</span>
//                       </label>
//                     </div>

//                     {w.attended_committee && (
//                       <div className={styles.inputGroup}>
//                         <label>Committee attended</label>
//                         <div className={styles.inputWrapper}>
//                           <Building2 size={16} />
//                           <select
//                             value={w.committee_name}
//                             onChange={(e) =>
//                               updateWeek(w.id, {
//                                 committee_name: e.target.value,
//                               })
//                             }
//                           >
//                             <option value="">Select a committee…</option>
//                             {COMMITTEES.map((c) => (
//                               <option key={c} value={c}>
//                                 {c}
//                               </option>
//                             ))}
//                           </select>
//                         </div>
//                       </div>
//                     )}
//                   </motion.div>
//                 ))}
//               </div>
//             </motion.section>
//           )}

//           {/* ================= STAGE 2 ================= */}
//           {stage === 2 && (
//             <motion.section
//               key="stage2"
//               className={styles.card}
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -20 }}
//             >
//               <div className={styles.cardHeader}>
//                 <h2>Nights claimed</h2>
//                 <p>
//                   Enter the total nights claimed for chamber and committee
//                   attendance during the claim period.
//                 </p>
//               </div>

//               <div className={styles.inputGroup}>
//                 <label>Nights claimed — Chamber attendance</label>
//                 <div className={styles.inputWrapper}>
//                   <Moon size={16} />
//                   <input
//                     type="number"
//                     min={0}
//                     value={form.nights_chamber}
//                     onChange={(e) =>
//                       setForm({
//                         ...form,
//                         nights_chamber: Math.max(
//                           0,
//                           parseInt(e.target.value, 10) || 0,
//                         ),
//                       })
//                     }
//                   />
//                 </div>
//               </div>

//               <div className={styles.inputGroup}>
//                 <label>Nights claimed — Committee attendance</label>
//                 <div className={styles.inputWrapper}>
//                   <Moon size={16} />
//                   <input
//                     type="number"
//                     min={0}
//                     value={form.nights_committee}
//                     onChange={(e) =>
//                       setForm({
//                         ...form,
//                         nights_committee: Math.max(
//                           0,
//                           parseInt(e.target.value, 10) || 0,
//                         ),
//                       })
//                     }
//                   />
//                 </div>
//               </div>

//               <div className={styles.totalBox}>
//                 <div>
//                   <span>Total nights claimed</span>
//                   <strong>{totalNights}</strong>
//                 </div>
//               </div>
//             </motion.section>
//           )}

//           {/* ================= STAGE 3 ================= */}
//           {stage === 3 && (
//             <motion.section
//               key="stage3"
//               className={styles.card}
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0, x: -20 }}
//             >
//               <div className={styles.cardHeader}>
//                 <h2>Review your claim</h2>
//                 <p>
//                   Please confirm all information is correct before submitting.
//                 </p>
//               </div>

//               <div className={styles.previewBlock}>
//                 <div className={styles.previewTitle}>
//                   <FileText size={16} />
//                   Claim period
//                 </div>
//                 <div className={styles.previewContent}>
//                   <strong>
//                     {form.claim_month} {form.claim_year}
//                   </strong>
//                 </div>
//               </div>

//               <div className={styles.previewBlock}>
//                 <div className={styles.previewTitle}>
//                   <Calendar size={16} />
//                   Weeks attended ({form.weeks.length})
//                 </div>
//                 <div className={styles.previewTable}>
//                   <div className={styles.previewHead}>
//                     <span>#</span>
//                     <span>Week starting</span>
//                     <span>Week ending</span>
//                     <span>Attended</span>
//                   </div>
//                   {form.weeks.map((w, i) => (
//                     <div key={w.id} className={styles.previewRow}>
//                       <span>{i + 1}</span>
//                       <span>{w.week_starting || "—"}</span>
//                       <span>{w.week_ending || "—"}</span>
//                       <span>
//                         {w.attended_chamber && "Chamber"}
//                         {w.attended_chamber && w.attended_committee && " + "}
//                         {w.attended_committee && w.committee_name}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               <div className={styles.previewBlock}>
//                 <div className={styles.previewTitle}>
//                   <Moon size={16} />
//                   Nights claimed
//                 </div>
//                 <div className={styles.previewRows}>
//                   <div>
//                     <span>Chamber attendance</span>
//                     <strong>{form.nights_chamber}</strong>
//                   </div>
//                   <div>
//                     <span>Committee attendance</span>
//                     <strong>{form.nights_committee}</strong>
//                   </div>
//                   <div className={styles.previewTotal}>
//                     <span>Total</span>
//                     <strong>{totalNights}</strong>
//                   </div>
//                 </div>
//               </div>

//               {/* Declaration */}
//               <div className={styles.declaration}>
//                 <div className={styles.declarationTitle}>
//                   <ShieldCheck size={16} />
//                   Declaration
//                 </div>
//                 <p className={styles.declarationText}>
//                   I certify that I did not travel out of the country, nor
//                   benefit from government accommodation on any of the dates
//                   stated above.
//                 </p>

//                 <div className={styles.inputGroup}>
//                   <label>Full name of member</label>
//                   <div className={styles.inputWrapper}>
//                     <Pencil size={16} />
//                     <input
//                       type="text"
//                       placeholder="Type your full name to sign"
//                       value={form.declaration_signed_name}
//                       onChange={(e) =>
//                         setForm({
//                           ...form,
//                           declaration_signed_name: e.target.value,
//                         })
//                       }
//                     />
//                   </div>
//                 </div>

//                 <label className={styles.termsCheck}>
//                   <input
//                     type="checkbox"
//                     checked={form.declaration_confirmed}
//                     onChange={(e) =>
//                       setForm({
//                         ...form,
//                         declaration_confirmed: e.target.checked,
//                       })
//                     }
//                   />
//                   <span>
//                     I confirm the information above is true and correct.
//                   </span>
//                 </label>
//               </div>
//             </motion.section>
//           )}
//         </AnimatePresence>

//         {/* Nav buttons */}
//         <div className={styles.formActions}>
//           {stage > 1 ? (
//             <button
//               type="button"
//               className={styles.secondaryButton}
//               onClick={goBack}
//               disabled={submitting}
//             >
//               <ArrowLeft size={16} />
//               Back
//             </button>
//           ) : (
//             <Link href="/profile" className={styles.secondaryButton}>
//               Cancel
//             </Link>
//           )}

//           {stage < 3 ? (
//             <button
//               type="button"
//               className={styles.primaryButton}
//               onClick={goNext}
//             >
//               Continue
//               <ArrowRight size={16} />
//             </button>
//           ) : (
//             <button
//               type="submit"
//               className={styles.primaryButton}
//               disabled={submitting}
//             >
//               {submitting ? (
//                 <>
//                   <span className={styles.spinner} />
//                   Submitting…
//                 </>
//               ) : (
//                 <>
//                   <Send size={16} />
//                   Submit claim
//                 </>
//               )}
//             </button>
//           )}
//         </div>
//       </form>
//     </main>
//   );
// }

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Inbox,
  Landmark,
  LogOut,
  Mail,
  Printer,
  RefreshCw,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./stylesc.module.css";

type CommitteeEntry = {
  name: string;
  attendance_date: string;
  mode: "physical" | "virtual" | string;
  sittings: number;
};

type ClaimWeek = {
  id: string;
  week_number: number;
  week_starting: string;
  week_ending: string;
  attended_chamber: boolean;
  attended_committee: boolean;
  committees: CommitteeEntry[];
};

type ReviewClaim = {
  id: string;
  member_id: string;
  claimant_name: string;
  claimant_email: string;
  claim_month: string;
  claim_year: number;
  nights_chamber: number;
  nights_committee: number;
  declaration_signed_name: string;
  status: "secretary_review" | "director_review" | "approved" | "rejected";
  created_at: string;
  secretary_reviewed_at: string | null;
  secretary_reviewed_by: string | null;
  reviewed_at: string | null;
  claim_weeks: ClaimWeek[];
};

const statusLabels: Record<ReviewClaim["status"], string> = {
  secretary_review: "Awaiting review",
  director_review: "Awaiting director review",
  approved: "Approved",
  rejected: "Rejected",
};

type ClaimReviewPageProps = {
  reviewerRole: "secretary" | "director";
};

// ---------- Date helpers ----------
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_FULL = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

const MONTHS_ABBR = [
  "JAN.",
  "FEB.",
  "MAR.",
  "APR.",
  "MAY",
  "JUN.",
  "JUL.",
  "AUG.",
  "SEP.",
  "OCT.",
  "NOV.",
  "DEC.",
];

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Render a date range as "3rd Nov – 7th Nov 2025".
 */
function formatWeekRange(start: string, end: string): string {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} – ${end}`;

  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const sMonth = MONTHS_SHORT[s.getUTCMonth()];
  const eMonth = MONTHS_SHORT[e.getUTCMonth()];
  const sYear = s.getUTCFullYear();
  const eYear = e.getUTCFullYear();

  const sLabel = `${ordinal(sDay)} ${sMonth}`;
  const eLabel = `${ordinal(eDay)} ${eMonth}`;
  const yearLabel = sYear === eYear ? sYear : `${sYear}/${eYear}`;

  return `${sLabel} – ${eLabel} ${yearLabel}`;
}

/**
 * Render an attendance date as "8.1.2025" (D.M.YYYY).
 */
function formatShortDate(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

/**
 * Turn a week's committee data into parallel arrays for the multi-row span,
 * so we can render one row per committee.
 */
function explodeWeek(week: ClaimWeek) {
  const committees = week.committees ?? [];

  // Case A: committee attended + has committees → one row per committee
  if (week.attended_committee && committees.length > 0) {
    return committees.map((c, idx) => ({
      isFirst: idx === 0,
      spanRows: committees.length,
      committeeName: c.name,
      sittingLine: formatShortDate(c.attendance_date),
      mode: c.mode.charAt(0).toUpperCase() + c.mode.slice(1),
      sittings: c.sittings,
      chamberMarker: week.attended_chamber && idx === 0,
    }));
  }

  // Case B: chamber only
  if (week.attended_chamber && !week.attended_committee) {
    return [
      {
        isFirst: true,
        spanRows: 1,
        committeeName: "",
        sittingLine: "",
        mode: "",
        sittings: 0,
        chamberMarker: true,
      },
    ];
  }

  // Case C: committee attended but nothing selected (edge case)
  return [
    {
      isFirst: true,
      spanRows: 1,
      committeeName: "",
      sittingLine: "",
      mode: "",
      sittings: 0,
      chamberMarker: false,
    },
  ];
}

// ---------- Print-only helpers (match the official PDF schedule) ----------

/** 3 + "RD" as superscript: 3<sup>RD</sup> */
function Ord({ n }: { n: number }) {
  const suffix = ordinal(n).slice(String(n).length).toUpperCase();
  return (
    <>
      {n}
      <sup>{suffix}</sup>
    </>
  );
}

/**
 * "3RD-7TH NOVEMBER, 2025"
 * "30TH JUNE-4TH JULY, 2025"
 * "29TH DEC. 2025-2ND JAN. 2026"
 */
function PrintWeekLabel({ start, end }: { start: string; end: string }) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    return (
      <>
        {start} – {end}
      </>
    );
  }

  const sd = s.getUTCDate();
  const ed = e.getUTCDate();
  const sm = s.getUTCMonth();
  const em = e.getUTCMonth();
  const sy = s.getUTCFullYear();
  const ey = e.getUTCFullYear();

  if (sy !== ey) {
    return (
      <>
        <Ord n={sd} /> {MONTHS_ABBR[sm]} {sy}-<Ord n={ed} /> {MONTHS_ABBR[em]}{" "}
        {ey}
      </>
    );
  }
  if (sm !== em) {
    return (
      <>
        <Ord n={sd} /> {MONTHS_FULL[sm]}-<Ord n={ed} /> {MONTHS_FULL[em]}, {sy}
      </>
    );
  }
  return (
    <>
      <Ord n={sd} />-<Ord n={ed} /> {MONTHS_FULL[sm]}, {sy}
    </>
  );
}

/** Flat rows for the printed schedule: one row per sitting, one blank row for empty weeks */
function buildPrintRows(claim: ReviewClaim) {
  const weeks = [...claim.claim_weeks].sort((a, b) =>
    a.week_starting.localeCompare(b.week_starting),
  );

  return weeks.flatMap((week) => {
    const committees = week.attended_committee ? (week.committees ?? []) : [];

    if (committees.length === 0) {
      return [
        {
          week,
          isFirst: true,
          span: 1,
          label: week.attended_chamber ? "CHAMBER" : "",
          mode: "",
          sittings: 0,
        },
      ];
    }

    return committees.map((c, i) => ({
      week,
      isFirst: i === 0,
      span: committees.length,
      label: `${c.name.toUpperCase()}-${formatShortDate(c.attendance_date)}`,
      mode: c.mode.toUpperCase(),
      sittings: c.sittings,
    }));
  });
}

/** The document that is shown only when printing */
function PrintDocument({ claim }: { claim: ReviewClaim }) {
  const printRows = buildPrintRows(claim);
  const committeeNames = Array.from(
    new Set(
      claim.claim_weeks.flatMap((w) =>
        w.attended_committee
          ? (w.committees ?? []).map((c) => c.name.toUpperCase())
          : [],
      ),
    ),
  );
  const totalSittings = printRows.reduce((sum, r) => sum + r.sittings, 0);

  return (
    <div className={styles.printDoc}>
      {/* Logo as the document header */}
      <Image
        src="/senatelogo-removebg-preview.png"
        alt="Parliament of Kenya — The Senate"
        width={400}
        height={400}
        className={styles.documentLogo}
      />

      <h2 className={styles.printTitle}>
        CHAMBER/COMMITTEE ATTENDANCE SCHEDULE
      </h2>
      {/* If you store a voucher/claim number, render it here:
          <p className={styles.printNo}>No. {claim.claim_number}</p> */}
      <p className={styles.printSenator}>
        NAME OF SENATOR:{" "}
        <strong>{claim.claimant_name.toUpperCase()}, MP</strong>
      </p>

      <div className={styles.printTableWrap}>
        <table className={styles.printTable}>
          <thead>
            <tr>
              <th>WEEK CLAIMED</th>
              <th>COMMITTEE(S)</th>
              <th>SITTINGS, DATES</th>
              <th>NATURE OF SITTING</th>
              <th>NUMBER OF SITTING</th>
            </tr>
          </thead>
          <tbody>
            {printRows.map((row, idx) => (
              <tr
                key={`${row.week.id}-${idx}`}
                className={row.isFirst ? styles.printWeekStart : ""}
              >
                {row.isFirst && (
                  <td rowSpan={row.span} className={styles.printWeek}>
                    <PrintWeekLabel
                      start={row.week.week_starting}
                      end={row.week.week_ending}
                    />
                  </td>
                )}
                {idx === 0 && (
                  <td
                    rowSpan={printRows.length}
                    className={styles.printCommittees}
                  >
                    {committeeNames.map((n) => (
                      <div key={n}>{n}</div>
                    ))}
                  </td>
                )}
                <td>{row.label}</td>
                <td className={styles.printCenter}>
                  {row.mode ? (
                    <span
                      className={styles.modePill}
                      data-mode={row.mode.toLowerCase()}
                    >
                      {row.mode}
                    </span>
                  ) : (
                    ""
                  )}
                </td>
                <td className={styles.printCenter}>
                  {row.sittings > 0 ? row.sittings : ""}
                </td>
              </tr>
            ))}
            <tr className={styles.printTotalRow}>
              <td colSpan={4}>TOTAL</td>
              <td className={styles.printCenter}>{totalSittings || ""}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signatories at the bottom of the document */}
      <div className={styles.printSignatures}>
        <div>
          <p>SIGNATURE 1…………………………………</p>
          <p>DATE:………………………………………….</p>
          <p>
            <strong>NJENGA NJUGUNA</strong>
          </p>
          <p>DIRECTOR, GOVERNANCE AND ACCOUNTABILITY COMMITTEES</p>
        </div>
        <div>
          <p>SIGNATURE 2…………………………………</p>
          <p>DATE:………………………………………….</p>
          <p>
            <strong>MARY CHESIRE</strong>
          </p>
          <p>DIRECTOR, SOCIAL-ECONOMIC COMMITTEES</p>
        </div>
      </div>
    </div>
  );
}

export default function ClaimReviewPage({
  reviewerRole,
}: ClaimReviewPageProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [claims, setClaims] = useState<ReviewClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [claimsLoaded, setClaimsLoaded] = useState(false);
  const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

  // ---------- Data loading ----------
  const loadClaims = useCallback(async () => {
    const { data, error } = await supabase
      .from("claims")
      .select(
        "id, member_id, claimant_name, claimant_email, claim_month, claim_year, nights_chamber, nights_committee, declaration_signed_name, status, created_at, secretary_reviewed_at, secretary_reviewed_by, reviewed_at, claim_weeks(id, week_number, week_starting, week_ending, attended_chamber, attended_committee, committees)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load submitted claims:", error);
      setMessage("We could not load submitted claims. Please try again.");
      return;
    }

    setClaims((data as ReviewClaim[]) ?? []);
    setClaimsLoaded(true);
    setMessage("");
  }, [supabase]);

  useEffect(() => {
    let isActive = true;

    async function initialize() {
      const { data, error } = await supabase.auth.getUser();
      if (!isActive) return;

      if (error) {
        console.error("Could not load the signed-in user:", error);
        setMessage("We could not verify your account. Please sign in again.");
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        router.replace("/staff/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("staff_profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!isActive) return;

      if (profileError) {
        console.error("Staff profile lookup failed:", profileError);
        setMessage("We could not verify your staff role. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!profile) {
        setMessage("This account does not have a staff profile.");
        setIsLoading(false);
        return;
      }

      if (profile.role !== reviewerRole) {
        router.replace("/staff/profile");
        return;
      }

      await loadClaims();
      if (isActive) setIsLoading(false);
    }

    void initialize();

    return () => {
      isActive = false;
    };
  }, [loadClaims, reviewerRole, router, supabase]);

  // ---------- Review action ----------
  async function reviewClaim(claimId: string, status: "approved" | "rejected") {
    setUpdatingClaimId(claimId);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      if (userError) console.error("Could not verify the reviewer:", userError);
      setMessage("Your session could not be verified. Please sign in again.");
      setUpdatingClaimId(null);
      return;
    }

    const reviewedAt = new Date().toISOString();
    const nextStatus =
      reviewerRole === "secretary" && status === "approved"
        ? "director_review"
        : status;
    const update =
      reviewerRole === "secretary"
        ? {
            status: nextStatus,
            secretary_reviewed_by: userData.user.id,
            secretary_reviewed_at: reviewedAt,
          }
        : {
            status: nextStatus,
            reviewed_by: userData.user.id,
            reviewed_at: reviewedAt,
          };
    const expectedStatus =
      reviewerRole === "secretary" ? "secretary_review" : "director_review";

    const { data, error } = await supabase
      .from("claims")
      .update(update)
      .eq("id", claimId)
      .eq("status", expectedStatus)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Could not update claim review status:", error);
      setMessage("The claim could not be updated. Please try again.");
      setUpdatingClaimId(null);
      return;
    }

    if (!data) {
      setMessage("This claim has already been reviewed. Refreshing the list.");
      await loadClaims();
      setUpdatingClaimId(null);
      return;
    }

    setClaims((current) =>
      current.map((claim) =>
        claim.id === claimId
          ? reviewerRole === "secretary"
            ? {
                ...claim,
                status: nextStatus,
                secretary_reviewed_at: reviewedAt,
                secretary_reviewed_by: userData.user.id,
              }
            : { ...claim, status: nextStatus, reviewed_at: reviewedAt }
          : claim,
      ),
    );
    setUpdatingClaimId(null);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not sign out:", error);
      setMessage("We could not sign you out. Please try again.");
      return;
    }
    router.replace("/staff/login");
  }

  async function refreshClaims() {
    setIsRefreshing(true);
    await loadClaims();
    setIsRefreshing(false);
  }

  const pendingStatus =
    reviewerRole === "secretary" ? "secretary_review" : "director_review";

  /* ---------- Derived (display only) ---------- */
  const totalPending = claims.filter((c) => c.status === pendingStatus).length;
  const approvedCount = claims.filter((c) => c.status === "approved").length;
  const rejectedCount = claims.filter((c) => c.status === "rejected").length;

  const pendingClaims = claims.filter((c) => c.status === pendingStatus);
  const reviewedClaims = claims.filter((c) => c.status !== pendingStatus);

  // ---------- Rendering ----------
  function renderClaimRow(claim: ReviewClaim) {
    const isPending = claim.status === pendingStatus;
    const isOpen = activeClaimId === claim.id;

    return (
      <li key={claim.id} className={styles.claimRow} data-open={isOpen}>
        {/* Collapsed header */}
        <button
          type="button"
          className={styles.claimToggle}
          onClick={() => setActiveClaimId(isOpen ? null : claim.id)}
          aria-expanded={isOpen}
          aria-controls={`claim-${claim.id}`}
        >
          <span className={styles.avatar} aria-hidden="true">
            {getInitials(claim.claimant_name) || "M"}
          </span>

          <span className={styles.claimInfo}>
            <span className={styles.claimName}>{claim.claimant_name}</span>
            <span className={styles.claimPeriod}>
              {claim.claim_month} {claim.claim_year}
            </span>
          </span>

          <span className={styles.claimNights}>
            <strong>{claim.nights_chamber + claim.nights_committee}</strong>
            <span>nights</span>
          </span>

          <span className={styles.statusPill} data-status={claim.status}>
            {statusLabels[claim.status]}
          </span>

          <ChevronDown
            size={18}
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          />
        </button>

        {/* Expanded details */}
        {isOpen && (
          <div className={styles.claimBody} id={`claim-${claim.id}`}>
            {/* Print-only document (hidden on screen) — logo is the header */}
            <PrintDocument claim={claim} />

            {/* Claim header (screen only) */}
            <div className={styles.scheduleHeader}>
              <div className={styles.scheduleTitle}>
                <span>
                  <Landmark size={16} />
                </span>
                <h3>Chamber and committee attendance schedule</h3>
              </div>
              <div className={styles.scheduleMeta}>
                <span className={styles.scheduleMetaLabel}>
                  Name of senator
                </span>
                <strong>{claim.claimant_name}</strong>
              </div>
            </div>

            {/* Contact + audit trail (screen only) */}
            <div className={styles.metaStrip}>
              <span className={styles.metaChip}>
                <Mail size={13} />
                <a href={`mailto:${claim.claimant_email}`}>
                  {claim.claimant_email}
                </a>
              </span>
              <span className={styles.metaChip}>
                <strong>Submitted</strong>
                {new Date(claim.created_at).toLocaleString()}
              </span>
              {claim.secretary_reviewed_at && (
                <span className={styles.metaChip}>
                  <strong>Secretary</strong>
                  {new Date(claim.secretary_reviewed_at).toLocaleString()}
                </span>
              )}
              {claim.reviewed_at && (
                <span className={styles.metaChip}>
                  <strong>Director</strong>
                  {new Date(claim.reviewed_at).toLocaleString()}
                </span>
              )}
            </div>

            {/* The attendance table — one row per committee (screen only) */}
            <div className={styles.tableWrap}>
              <table className={styles.scheduleTable}>
                <thead>
                  <tr>
                    <th>Week claimed</th>
                    <th>Committee(s)</th>
                    <th>Sitting dates</th>
                    <th>Nature of sitting</th>
                    <th>Number of sittings</th>
                  </tr>
                </thead>
                <tbody>
                  {claim.claim_weeks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyCell}>
                        No weeks submitted
                      </td>
                    </tr>
                  ) : (
                    claim.claim_weeks.flatMap((week) => {
                      const rows = explodeWeek(week);
                      return rows.map((row, idx) => (
                        <tr
                          key={`${week.id}-${idx}`}
                          className={row.isFirst ? styles.weekFirstRow : ""}
                        >
                          {row.isFirst && (
                            <td
                              rowSpan={row.spanRows}
                              className={styles.weekCell}
                            >
                              {formatWeekRange(
                                week.week_starting,
                                week.week_ending,
                              )}
                              {week.attended_chamber && (
                                <span className={styles.chamberTag}>
                                  Chamber
                                </span>
                              )}
                            </td>
                          )}

                          <td className={styles.committeeCell}>
                            {row.committeeName ||
                              (week.attended_chamber ? "Chamber" : "—")}
                          </td>
                          <td className={styles.dateCell}>
                            {row.sittingLine || "—"}
                          </td>
                          <td className={styles.modeCell}>
                            {row.mode ? (
                              <span
                                className={styles.modePill}
                                data-mode={row.mode.toLowerCase()}
                              >
                                {row.mode}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={styles.sittingCountCell}>
                            {row.sittings > 0 ? row.sittings : "—"}
                          </td>
                        </tr>
                      ));
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary block (screen only) */}
            <div className={styles.summaryBlock}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Nights claimed</span>
                <div className={styles.summaryRows}>
                  <div>
                    <span>Chamber attendance</span>
                    <strong>{claim.nights_chamber}</strong>
                  </div>
                  <div>
                    <span>Committee attendance</span>
                    <strong>{claim.nights_committee}</strong>
                  </div>
                  <div className={styles.summaryTotal}>
                    <span>Total</span>
                    <strong>
                      {claim.nights_chamber + claim.nights_committee}
                    </strong>
                  </div>
                </div>
              </div>

              <div className={styles.declarationCard}>
                <span className={styles.summaryLabel}>Declaration</span>
                <p className={styles.declarationText}>
                  I certify that I did not travel out of the country, nor
                  benefit from government accommodation on any of the dates
                  stated above.
                </p>
                <p className={styles.signedBy}>
                  Signed: <strong>{claim.declaration_signed_name}</strong>
                </p>
              </div>
            </div>

            {/* Actions (screen only) */}
            {isPending && (
              <div className={styles.reviewActions}>
                <button
                  type="button"
                  className={styles.approveButton}
                  onClick={() => void reviewClaim(claim.id, "approved")}
                  disabled={updatingClaimId !== null}
                >
                  <Check size={16} />
                  {updatingClaimId === claim.id
                    ? "Saving..."
                    : reviewerRole === "secretary"
                      ? "Forward to director"
                      : "Approve"}
                </button>
                <button
                  type="button"
                  className={styles.rejectButton}
                  onClick={() => void reviewClaim(claim.id, "rejected")}
                  disabled={updatingClaimId !== null}
                >
                  <X size={16} />
                  Reject
                </button>
                <button
                  type="button"
                  className={styles.printButton}
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  Print
                </button>
              </div>
            )}

            {!isPending && (
              <div className={styles.finalizedNote}>
                <BadgeCheck size={16} />
                <span>
                  This claim has been {statusLabels[claim.status].toLowerCase()}
                  .
                </span>
                <button
                  type="button"
                  className={styles.printButton}
                  onClick={() => window.print()}
                >
                  <Printer size={16} />
                  Print
                </button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <div className={styles.app}>
      {/* ===== Top bar ===== */}
      <header className={styles.topbar}>
        <Link href="/staff/profile" className={styles.brand}>
          <span className={styles.brandMark}>
            <Landmark size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.brandText}>
            <strong>Senate Liaison</strong>
            <span>DSA management system</span>
          </span>
        </Link>

        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.ghostBtn}
            aria-label="Refresh claims"
            onClick={() => void refreshClaims()}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? styles.spin : undefined}
            />
            <span className={styles.btnLabel}>
              {isRefreshing ? "Refreshing..." : "Refresh claims"}
            </span>
          </button>
          <button
            className={`${styles.ghostBtn} ${styles.dangerHover}`}
            type="button"
            aria-label="Sign out"
            onClick={handleSignOut}
          >
            <LogOut size={15} />
            <span className={styles.btnLabel}>Sign out</span>
          </button>
        </div>
      </header>

      <main className={styles.shell}>
        {/* ===== Page heading ===== */}
        <div className={styles.pageHead}>
          <div>
            <span className={styles.roleTag}>
              {reviewerRole === "secretary"
                ? "Secretary workspace"
                : "Director workspace"}
            </span>
            <h1>
              {reviewerRole === "director"
                ? "Director claim approvals"
                : "Member claims"}
            </h1>
            <p>
              {reviewerRole === "secretary"
                ? "Review submitted DSA claims and forward approved claims to the Director."
                : "Review claims forwarded by the Secretary and record the final decision."}
            </p>
          </div>
        </div>

        {message && (
          <p className={styles.alert} role="alert">
            <TriangleAlert size={16} />
            {message}
          </p>
        )}

        {isLoading ? (
          <div
            className={styles.loadingWrap}
            aria-live="polite"
            aria-busy="true"
          >
            <span className={styles.srOnly}>Loading claims...</span>
            <div className={styles.kpis}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`${styles.skel} ${styles.skelKpi}`} />
              ))}
            </div>
            <span className={`${styles.skel} ${styles.skelPanel}`} />
          </div>
        ) : !claimsLoaded ? null : (
          <>
            {/* ===== KPI tiles ===== */}
            <section className={styles.kpis} aria-label="Claims overview">
              <div className={`${styles.kpi} ${styles.kpiFocus}`}>
                <div className={styles.kpiTop}>
                  <span>Awaiting your review</span>
                  <span className={styles.kpiIcon}>
                    <Clock size={16} />
                  </span>
                </div>
                <span className={styles.kpiValue}>{totalPending}</span>
              </div>

              <div className={`${styles.kpi} ${styles.kpiGreen}`}>
                <div className={styles.kpiTop}>
                  <span>Approved</span>
                  <span className={styles.kpiIcon}>
                    <CheckCircle2 size={16} />
                  </span>
                </div>
                <span className={styles.kpiValue}>{approvedCount}</span>
              </div>

              <div className={`${styles.kpi} ${styles.kpiRed}`}>
                <div className={styles.kpiTop}>
                  <span>Rejected</span>
                  <span className={styles.kpiIcon}>
                    <XCircle size={16} />
                  </span>
                </div>
                <span className={styles.kpiValue}>{rejectedCount}</span>
              </div>

              <div className={styles.kpi}>
                <div className={styles.kpiTop}>
                  <span>Total claims</span>
                  <span className={styles.kpiIcon}>
                    <FileText size={16} />
                  </span>
                </div>
                <span className={styles.kpiValue}>{claims.length}</span>
              </div>
            </section>

            {/* ===== Awaiting review ===== */}
            <section className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  {reviewerRole === "secretary"
                    ? "Awaiting secretary review"
                    : "Awaiting director review"}
                </h2>
                <span className={styles.count}>{pendingClaims.length}</span>
              </div>
              {pendingClaims.length ? (
                <ul className={styles.claimList}>
                  {pendingClaims.map(renderClaimRow)}
                </ul>
              ) : (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}>
                    <Inbox size={20} />
                  </span>
                  <strong>Youre all caught up</strong>
                  <span>There are no claims awaiting review.</span>
                </div>
              )}
            </section>

            {/* ===== Reviewed ===== */}
            <section className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>Reviewed claims</h2>
                <span className={styles.count}>{reviewedClaims.length}</span>
              </div>
              {reviewedClaims.length ? (
                <ul className={styles.claimList}>
                  {reviewedClaims.map(renderClaimRow)}
                </ul>
              ) : (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}>
                    <Inbox size={20} />
                  </span>
                  <strong>Nothing reviewed yet</strong>
                  <span>No claims have been reviewed yet.</span>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// "use client";

// import { useCallback, useEffect, useMemo, useState } from "react";
// import Image from "next/image";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import {
//   BadgeCheck,
//   Check,
//   CheckCircle2,
//   ChevronDown,
//   Clock,
//   FileText,
//   Inbox,
//   Landmark,
//   LogOut,
//   Mail,
//   Printer,
//   RefreshCw,
//   TriangleAlert,
//   X,
//   XCircle,
// } from "lucide-react";

// import { createClient } from "@/utils/supabase/client";
// import styles from "./stylesb.module.css";

// type CommitteeEntry = {
//   name: string;
//   attendance_date: string;
//   mode: "physical" | "virtual" | string;
//   sittings: number;
// };

// type ClaimWeek = {
//   id: string;
//   week_number: number;
//   week_starting: string;
//   week_ending: string;
//   attended_chamber: boolean;
//   attended_committee: boolean;
//   committees: CommitteeEntry[];
// };

// type ReviewClaim = {
//   id: string;
//   member_id: string;
//   claimant_name: string;
//   claimant_email: string;
//   claim_month: string;
//   claim_year: number;
//   nights_chamber: number;
//   nights_committee: number;
//   declaration_signed_name: string;
//   status: "secretary_review" | "director_review" | "approved" | "rejected";
//   created_at: string;
//   secretary_reviewed_at: string | null;
//   secretary_reviewed_by: string | null;
//   reviewed_at: string | null;
//   claim_weeks: ClaimWeek[];
// };

// const statusLabels: Record<ReviewClaim["status"], string> = {
//   secretary_review: "Awaiting review",
//   director_review: "Awaiting director review",
//   approved: "Approved",
//   rejected: "Rejected",
// };

// type ClaimReviewPageProps = {
//   reviewerRole: "secretary" | "director";
// };

// // ---------- Date helpers ----------
// const MONTHS_SHORT = [
//   "Jan",
//   "Feb",
//   "Mar",
//   "Apr",
//   "May",
//   "Jun",
//   "Jul",
//   "Aug",
//   "Sep",
//   "Oct",
//   "Nov",
//   "Dec",
// ];

// function ordinal(n: number) {
//   const s = ["th", "st", "nd", "rd"];
//   const v = n % 100;
//   return n + (s[(v - 20) % 10] || s[v] || s[0]);
// }

// function getInitials(name: string) {
//   return name
//     .trim()
//     .split(/\s+/)
//     .slice(0, 2)
//     .map((part) => part[0]?.toUpperCase() ?? "")
//     .join("");
// }

// /**
//  * Render a date range as "3rd Nov – 7th Nov 2025".
//  */
// function formatWeekRange(start: string, end: string): string {
//   if (!start || !end) return "—";
//   const s = new Date(start);
//   const e = new Date(end);
//   if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} – ${end}`;

//   const sDay = s.getUTCDate();
//   const eDay = e.getUTCDate();
//   const sMonth = MONTHS_SHORT[s.getUTCMonth()];
//   const eMonth = MONTHS_SHORT[e.getUTCMonth()];
//   const sYear = s.getUTCFullYear();
//   const eYear = e.getUTCFullYear();

//   const sLabel = `${ordinal(sDay)} ${sMonth}`;
//   const eLabel = `${ordinal(eDay)} ${eMonth}`;
//   const yearLabel = sYear === eYear ? sYear : `${sYear}/${eYear}`;

//   return `${sLabel} – ${eLabel} ${yearLabel}`;
// }

// /**
//  * Render an attendance date as "8.1.2025" (D.M.YYYY).
//  */
// function formatShortDate(date: string): string {
//   if (!date) return "";
//   const d = new Date(date);
//   if (isNaN(d.getTime())) return date;
//   return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
// }

// /**
//  * Turn a week's committee data into parallel arrays for the multi-row span,
//  * so we can render one row per committee.
//  */
// function explodeWeek(week: ClaimWeek) {
//   const committees = week.committees ?? [];

//   // Case A: committee attended + has committees → one row per committee
//   if (week.attended_committee && committees.length > 0) {
//     return committees.map((c, idx) => ({
//       isFirst: idx === 0,
//       spanRows: committees.length,
//       committeeName: c.name,
//       sittingLine: formatShortDate(c.attendance_date),
//       mode: c.mode.charAt(0).toUpperCase() + c.mode.slice(1),
//       sittings: c.sittings,
//       chamberMarker: week.attended_chamber && idx === 0,
//     }));
//   }

//   // Case B: chamber only
//   if (week.attended_chamber && !week.attended_committee) {
//     return [
//       {
//         isFirst: true,
//         spanRows: 1,
//         committeeName: "",
//         sittingLine: "",
//         mode: "",
//         sittings: 0,
//         chamberMarker: true,
//       },
//     ];
//   }

//   // Case C: committee attended but nothing selected (edge case)
//   return [
//     {
//       isFirst: true,
//       spanRows: 1,
//       committeeName: "",
//       sittingLine: "",
//       mode: "",
//       sittings: 0,
//       chamberMarker: false,
//     },
//   ];
// }

// export default function ClaimReviewPage({
//   reviewerRole,
// }: ClaimReviewPageProps) {
//   const router = useRouter();
//   const supabase = useMemo(() => createClient(), []);
//   const [claims, setClaims] = useState<ReviewClaim[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [claimsLoaded, setClaimsLoaded] = useState(false);
//   const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);
//   const [message, setMessage] = useState("");
//   const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

//   // ---------- Data loading ----------
//   const loadClaims = useCallback(async () => {
//     const { data, error } = await supabase
//       .from("claims")
//       .select(
//         "id, member_id, claimant_name, claimant_email, claim_month, claim_year, nights_chamber, nights_committee, declaration_signed_name, status, created_at, secretary_reviewed_at, secretary_reviewed_by, reviewed_at, claim_weeks(id, week_number, week_starting, week_ending, attended_chamber, attended_committee, committees)",
//       )
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("Could not load submitted claims:", error);
//       setMessage("We could not load submitted claims. Please try again.");
//       return;
//     }

//     setClaims((data as ReviewClaim[]) ?? []);
//     setClaimsLoaded(true);
//     setMessage("");
//   }, [supabase]);

//   useEffect(() => {
//     let isActive = true;

//     async function initialize() {
//       const { data, error } = await supabase.auth.getUser();
//       if (!isActive) return;

//       if (error) {
//         console.error("Could not load the signed-in user:", error);
//         setMessage("We could not verify your account. Please sign in again.");
//         setIsLoading(false);
//         return;
//       }

//       if (!data.user) {
//         router.replace("/staff/login");
//         return;
//       }

//       const { data: profile, error: profileError } = await supabase
//         .from("staff_profiles")
//         .select("role")
//         .eq("id", data.user.id)
//         .maybeSingle();

//       if (!isActive) return;

//       if (profileError) {
//         console.error("Staff profile lookup failed:", profileError);
//         setMessage("We could not verify your staff role. Please try again.");
//         setIsLoading(false);
//         return;
//       }

//       if (!profile) {
//         setMessage("This account does not have a staff profile.");
//         setIsLoading(false);
//         return;
//       }

//       if (profile.role !== reviewerRole) {
//         router.replace("/staff/profile");
//         return;
//       }

//       await loadClaims();
//       if (isActive) setIsLoading(false);
//     }

//     void initialize();

//     return () => {
//       isActive = false;
//     };
//   }, [loadClaims, reviewerRole, router, supabase]);

//   // ---------- Review action ----------
//   async function reviewClaim(claimId: string, status: "approved" | "rejected") {
//     setUpdatingClaimId(claimId);
//     setMessage("");

//     const { data: userData, error: userError } = await supabase.auth.getUser();

//     if (userError || !userData.user) {
//       if (userError) console.error("Could not verify the reviewer:", userError);
//       setMessage("Your session could not be verified. Please sign in again.");
//       setUpdatingClaimId(null);
//       return;
//     }

//     const reviewedAt = new Date().toISOString();
//     const nextStatus =
//       reviewerRole === "secretary" && status === "approved"
//         ? "director_review"
//         : status;
//     const update =
//       reviewerRole === "secretary"
//         ? {
//             status: nextStatus,
//             secretary_reviewed_by: userData.user.id,
//             secretary_reviewed_at: reviewedAt,
//           }
//         : {
//             status: nextStatus,
//             reviewed_by: userData.user.id,
//             reviewed_at: reviewedAt,
//           };
//     const expectedStatus =
//       reviewerRole === "secretary" ? "secretary_review" : "director_review";

//     const { data, error } = await supabase
//       .from("claims")
//       .update(update)
//       .eq("id", claimId)
//       .eq("status", expectedStatus)
//       .select("id")
//       .maybeSingle();

//     if (error) {
//       console.error("Could not update claim review status:", error);
//       setMessage("The claim could not be updated. Please try again.");
//       setUpdatingClaimId(null);
//       return;
//     }

//     if (!data) {
//       setMessage("This claim has already been reviewed. Refreshing the list.");
//       await loadClaims();
//       setUpdatingClaimId(null);
//       return;
//     }

//     setClaims((current) =>
//       current.map((claim) =>
//         claim.id === claimId
//           ? reviewerRole === "secretary"
//             ? {
//                 ...claim,
//                 status: nextStatus,
//                 secretary_reviewed_at: reviewedAt,
//                 secretary_reviewed_by: userData.user.id,
//               }
//             : { ...claim, status: nextStatus, reviewed_at: reviewedAt }
//           : claim,
//       ),
//     );
//     setUpdatingClaimId(null);
//   }

//   async function handleSignOut() {
//     const { error } = await supabase.auth.signOut();
//     if (error) {
//       console.error("Could not sign out:", error);
//       setMessage("We could not sign you out. Please try again.");
//       return;
//     }
//     router.replace("/staff/login");
//   }

//   async function refreshClaims() {
//     setIsRefreshing(true);
//     await loadClaims();
//     setIsRefreshing(false);
//   }

//   const pendingStatus =
//     reviewerRole === "secretary" ? "secretary_review" : "director_review";

//   /* ---------- Derived (display only) ---------- */
//   const totalPending = claims.filter((c) => c.status === pendingStatus).length;
//   const approvedCount = claims.filter((c) => c.status === "approved").length;
//   const rejectedCount = claims.filter((c) => c.status === "rejected").length;

//   const pendingClaims = claims.filter((c) => c.status === pendingStatus);
//   const reviewedClaims = claims.filter((c) => c.status !== pendingStatus);

//   // ---------- Rendering ----------
//   function renderClaimRow(claim: ReviewClaim) {
//     const isPending = claim.status === pendingStatus;
//     const isOpen = activeClaimId === claim.id;

//     return (
//       <li key={claim.id} className={styles.claimRow} data-open={isOpen}>
//         {/* Collapsed header */}
//         <button
//           type="button"
//           className={styles.claimToggle}
//           onClick={() => setActiveClaimId(isOpen ? null : claim.id)}
//           aria-expanded={isOpen}
//           aria-controls={`claim-${claim.id}`}
//         >
//           <span className={styles.avatar} aria-hidden="true">
//             {getInitials(claim.claimant_name) || "M"}
//           </span>

//           <span className={styles.claimInfo}>
//             <span className={styles.claimName}>{claim.claimant_name}</span>
//             <span className={styles.claimPeriod}>
//               {claim.claim_month} {claim.claim_year}
//             </span>
//           </span>

//           <span className={styles.claimNights}>
//             <strong>{claim.nights_chamber + claim.nights_committee}</strong>
//             <span>nights</span>
//           </span>

//           <span className={styles.statusPill} data-status={claim.status}>
//             {statusLabels[claim.status]}
//           </span>

//           <ChevronDown
//             size={18}
//             className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
//           />
//         </button>

//         {/* Expanded details */}
//         {isOpen && (
//           <div className={styles.claimBody} id={`claim-${claim.id}`}>
//             <Image
//               src="/senatelogo-removebg-preview.png"
//               alt="Parliament of Kenya — The Senate"
//               width={400}
//               height={400}
//               className={styles.documentLogo}
//             />

//             {/* Claim header */}
//             <div className={styles.scheduleHeader}>
//               <div className={styles.scheduleTitle}>
//                 <span>
//                   <Landmark size={16} />
//                 </span>
//                 <h3>Chamber and committee attendance schedule</h3>
//               </div>
//               <div className={styles.scheduleMeta}>
//                 <span className={styles.scheduleMetaLabel}>
//                   Name of senator
//                 </span>
//                 <strong>{claim.claimant_name}</strong>
//               </div>
//             </div>

//             {/* Contact + audit trail */}
//             <div className={styles.metaStrip}>
//               <span className={styles.metaChip}>
//                 <Mail size={13} />
//                 <a href={`mailto:${claim.claimant_email}`}>
//                   {claim.claimant_email}
//                 </a>
//               </span>
//               <span className={styles.metaChip}>
//                 <strong>Submitted</strong>
//                 {new Date(claim.created_at).toLocaleString()}
//               </span>
//               {claim.secretary_reviewed_at && (
//                 <span className={styles.metaChip}>
//                   <strong>Secretary</strong>
//                   {new Date(claim.secretary_reviewed_at).toLocaleString()}
//                 </span>
//               )}
//               {claim.reviewed_at && (
//                 <span className={styles.metaChip}>
//                   <strong>Director</strong>
//                   {new Date(claim.reviewed_at).toLocaleString()}
//                 </span>
//               )}
//             </div>

//             {/* The attendance table — one row per committee */}
//             <div className={styles.tableWrap}>
//               <table className={styles.scheduleTable}>
//                 <thead>
//                   <tr>
//                     <th>Week claimed</th>
//                     <th>Committee(s)</th>
//                     <th>Sitting dates</th>
//                     <th>Nature of sitting</th>
//                     <th>Number of sittings</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {claim.claim_weeks.length === 0 ? (
//                     <tr>
//                       <td colSpan={5} className={styles.emptyCell}>
//                         No weeks submitted
//                       </td>
//                     </tr>
//                   ) : (
//                     claim.claim_weeks.flatMap((week) => {
//                       const rows = explodeWeek(week);
//                       return rows.map((row, idx) => (
//                         <tr
//                           key={`${week.id}-${idx}`}
//                           className={row.isFirst ? styles.weekFirstRow : ""}
//                         >
//                           {row.isFirst && (
//                             <td
//                               rowSpan={row.spanRows}
//                               className={styles.weekCell}
//                             >
//                               {formatWeekRange(
//                                 week.week_starting,
//                                 week.week_ending,
//                               )}
//                               {week.attended_chamber && (
//                                 <span className={styles.chamberTag}>
//                                   Chamber
//                                 </span>
//                               )}
//                             </td>
//                           )}

//                           <td className={styles.committeeCell}>
//                             {row.committeeName ||
//                               (week.attended_chamber ? "Chamber" : "—")}
//                           </td>
//                           <td className={styles.dateCell}>
//                             {row.sittingLine || "—"}
//                           </td>
//                           <td className={styles.modeCell}>
//                             {row.mode ? (
//                               <span
//                                 className={styles.modePill}
//                                 data-mode={row.mode.toLowerCase()}
//                               >
//                                 {row.mode}
//                               </span>
//                             ) : (
//                               "—"
//                             )}
//                           </td>
//                           <td className={styles.sittingCountCell}>
//                             {row.sittings > 0 ? row.sittings : "—"}
//                           </td>
//                         </tr>
//                       ));
//                     })
//                   )}
//                 </tbody>
//               </table>
//             </div>

//             {/* Summary block */}
//             <div className={styles.summaryBlock}>
//               <div className={styles.summaryCard}>
//                 <span className={styles.summaryLabel}>Nights claimed</span>
//                 <div className={styles.summaryRows}>
//                   <div>
//                     <span>Chamber attendance</span>
//                     <strong>{claim.nights_chamber}</strong>
//                   </div>
//                   <div>
//                     <span>Committee attendance</span>
//                     <strong>{claim.nights_committee}</strong>
//                   </div>
//                   <div className={styles.summaryTotal}>
//                     <span>Total</span>
//                     <strong>
//                       {claim.nights_chamber + claim.nights_committee}
//                     </strong>
//                   </div>
//                 </div>
//               </div>

//               <div className={styles.declarationCard}>
//                 <span className={styles.summaryLabel}>Declaration</span>
//                 <p className={styles.declarationText}>
//                   I certify that I did not travel out of the country, nor
//                   benefit from government accommodation on any of the dates
//                   stated above.
//                 </p>
//                 <p className={styles.signedBy}>
//                   Signed: <strong>{claim.declaration_signed_name}</strong>
//                 </p>
//               </div>
//             </div>

//             {/* Actions */}
//             {isPending && (
//               <div className={styles.reviewActions}>
//                 <button
//                   type="button"
//                   className={styles.approveButton}
//                   onClick={() => void reviewClaim(claim.id, "approved")}
//                   disabled={updatingClaimId !== null}
//                 >
//                   <Check size={16} />
//                   {updatingClaimId === claim.id
//                     ? "Saving..."
//                     : reviewerRole === "secretary"
//                       ? "Forward to director"
//                       : "Approve"}
//                 </button>
//                 <button
//                   type="button"
//                   className={styles.rejectButton}
//                   onClick={() => void reviewClaim(claim.id, "rejected")}
//                   disabled={updatingClaimId !== null}
//                 >
//                   <X size={16} />
//                   Reject
//                 </button>
//                 <button
//                   type="button"
//                   className={styles.printButton}
//                   onClick={() => window.print()}
//                 >
//                   <Printer size={16} />
//                   Print
//                 </button>
//               </div>
//             )}

//             {!isPending && (
//               <div className={styles.finalizedNote}>
//                 <BadgeCheck size={16} />
//                 <span>
//                   This claim has been {statusLabels[claim.status].toLowerCase()}
//                   .
//                 </span>
//                 <button
//                   type="button"
//                   className={styles.printButton}
//                   onClick={() => window.print()}
//                 >
//                   <Printer size={16} />
//                   Print
//                 </button>
//               </div>
//             )}
//           </div>
//         )}
//       </li>
//     );
//   }

//   return (
//     <div className={styles.app}>
//       {/* ===== Top bar ===== */}
//       <header className={styles.topbar}>
//         <Link href="/staff/profile" className={styles.brand}>
//           <span className={styles.brandMark}>
//             <Landmark size={20} strokeWidth={1.8} />
//           </span>
//           <span className={styles.brandText}>
//             <strong>Senate Liaison</strong>
//             <span>DSA management system</span>
//           </span>
//         </Link>

//         <div className={styles.topActions}>
//           <button
//             type="button"
//             className={styles.ghostBtn}
//             aria-label="Refresh claims"
//             onClick={() => void refreshClaims()}
//             disabled={isRefreshing || isLoading}
//           >
//             <RefreshCw
//               size={15}
//               className={isRefreshing ? styles.spin : undefined}
//             />
//             <span className={styles.btnLabel}>
//               {isRefreshing ? "Refreshing..." : "Refresh claims"}
//             </span>
//           </button>
//           <button
//             className={`${styles.ghostBtn} ${styles.dangerHover}`}
//             type="button"
//             aria-label="Sign out"
//             onClick={handleSignOut}
//           >
//             <LogOut size={15} />
//             <span className={styles.btnLabel}>Sign out</span>
//           </button>
//         </div>
//       </header>

//       <main className={styles.shell}>
//         {/* ===== Page heading ===== */}
//         <div className={styles.pageHead}>
//           <div>
//             <span className={styles.roleTag}>
//               {reviewerRole === "secretary"
//                 ? "Secretary workspace"
//                 : "Director workspace"}
//             </span>
//             <h1>
//               {reviewerRole === "director"
//                 ? "Director claim approvals"
//                 : "Member claims"}
//             </h1>
//             <p>
//               {reviewerRole === "secretary"
//                 ? "Review submitted DSA claims and forward approved claims to the Director."
//                 : "Review claims forwarded by the Secretary and record the final decision."}
//             </p>
//           </div>
//         </div>

//         {message && (
//           <p className={styles.alert} role="alert">
//             <TriangleAlert size={16} />
//             {message}
//           </p>
//         )}

//         {isLoading ? (
//           <div
//             className={styles.loadingWrap}
//             aria-live="polite"
//             aria-busy="true"
//           >
//             <span className={styles.srOnly}>Loading claims...</span>
//             <div className={styles.kpis}>
//               {[0, 1, 2, 3].map((i) => (
//                 <span key={i} className={`${styles.skel} ${styles.skelKpi}`} />
//               ))}
//             </div>
//             <span className={`${styles.skel} ${styles.skelPanel}`} />
//           </div>
//         ) : !claimsLoaded ? null : (
//           <>
//             {/* ===== KPI tiles ===== */}
//             <section className={styles.kpis} aria-label="Claims overview">
//               <div className={`${styles.kpi} ${styles.kpiFocus}`}>
//                 <div className={styles.kpiTop}>
//                   <span>Awaiting your review</span>
//                   <span className={styles.kpiIcon}>
//                     <Clock size={16} />
//                   </span>
//                 </div>
//                 <span className={styles.kpiValue}>{totalPending}</span>
//               </div>

//               <div className={`${styles.kpi} ${styles.kpiGreen}`}>
//                 <div className={styles.kpiTop}>
//                   <span>Approved</span>
//                   <span className={styles.kpiIcon}>
//                     <CheckCircle2 size={16} />
//                   </span>
//                 </div>
//                 <span className={styles.kpiValue}>{approvedCount}</span>
//               </div>

//               <div className={`${styles.kpi} ${styles.kpiRed}`}>
//                 <div className={styles.kpiTop}>
//                   <span>Rejected</span>
//                   <span className={styles.kpiIcon}>
//                     <XCircle size={16} />
//                   </span>
//                 </div>
//                 <span className={styles.kpiValue}>{rejectedCount}</span>
//               </div>

//               <div className={styles.kpi}>
//                 <div className={styles.kpiTop}>
//                   <span>Total claims</span>
//                   <span className={styles.kpiIcon}>
//                     <FileText size={16} />
//                   </span>
//                 </div>
//                 <span className={styles.kpiValue}>{claims.length}</span>
//               </div>
//             </section>

//             {/* ===== Awaiting review ===== */}
//             <section className={styles.panel}>
//               <div className={styles.sectionHead}>
//                 <h2>
//                   {reviewerRole === "secretary"
//                     ? "Awaiting secretary review"
//                     : "Awaiting director review"}
//                 </h2>
//                 <span className={styles.count}>{pendingClaims.length}</span>
//               </div>
//               {pendingClaims.length ? (
//                 <ul className={styles.claimList}>
//                   {pendingClaims.map(renderClaimRow)}
//                 </ul>
//               ) : (
//                 <div className={styles.empty}>
//                   <span className={styles.emptyIcon}>
//                     <Inbox size={20} />
//                   </span>
//                   <strong>Youre all caught up</strong>
//                   <span>There are no claims awaiting review.</span>
//                 </div>
//               )}
//             </section>

//             {/* ===== Reviewed ===== */}
//             <section className={styles.panel}>
//               <div className={styles.sectionHead}>
//                 <h2>Reviewed claims</h2>
//                 <span className={styles.count}>{reviewedClaims.length}</span>
//               </div>
//               {reviewedClaims.length ? (
//                 <ul className={styles.claimList}>
//                   {reviewedClaims.map(renderClaimRow)}
//                 </ul>
//               ) : (
//                 <div className={styles.empty}>
//                   <span className={styles.emptyIcon}>
//                     <Inbox size={20} />
//                   </span>
//                   <strong>Nothing reviewed yet</strong>
//                   <span>No claims have been reviewed yet.</span>
//                 </div>
//               )}
//             </section>
//           </>
//         )}
//       </main>
//     </div>
//   );
// }

// "use client";

// import { useCallback, useEffect, useMemo, useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import {
//   BadgeCheck,
//   Check,
//   Landmark,
//   LogOut,
//   Mail,
//   Printer,
//   X,
// } from "lucide-react";

// import { createClient } from "@/utils/supabase/client";
// import styles from "./styles.module.css";

// type CommitteeEntry = {
//   name: string;
//   attendance_date: string;
//   mode: "physical" | "virtual" | string;
//   sittings: number;
// };

// type ClaimWeek = {
//   id: string;
//   week_number: number;
//   week_starting: string;
//   week_ending: string;
//   attended_chamber: boolean;
//   attended_committee: boolean;
//   committees: CommitteeEntry[];
// };

// type ReviewClaim = {
//   id: string;
//   member_id: string;
//   claimant_name: string;
//   claimant_email: string;
//   claim_month: string;
//   claim_year: number;
//   nights_chamber: number;
//   nights_committee: number;
//   declaration_signed_name: string;
//   status: "secretary_review" | "director_review" | "approved" | "rejected";
//   created_at: string;
//   secretary_reviewed_at: string | null;
//   secretary_reviewed_by: string | null;
//   reviewed_at: string | null;
//   claim_weeks: ClaimWeek[];
// };

// const statusLabels: Record<ReviewClaim["status"], string> = {
//   secretary_review: "Awaiting review",
//   director_review: "Awaiting director review",
//   approved: "Approved",
//   rejected: "Rejected",
// };

// type ClaimReviewPageProps = {
//   reviewerRole: "secretary" | "director";
// };

// // ---------- Date helpers ----------
// const MONTHS_SHORT = [
//   "JAN",
//   "FEB",
//   "MAR",
//   "APR",
//   "MAY",
//   "JUN",
//   "JUL",
//   "AUG",
//   "SEP",
//   "OCT",
//   "NOV",
//   "DEC",
// ];

// function ordinal(n: number) {
//   const s = ["TH", "ST", "ND", "RD"];
//   const v = n % 100;
//   return n + (s[(v - 20) % 10] || s[v] || s[0]);
// }

// /**
//  * Render a date range as "3RD - 7TH NOVEMBER, 2025" — matching the paper form.
//  */
// function formatWeekRange(start: string, end: string): string {
//   if (!start || !end) return "—";
//   const s = new Date(start);
//   const e = new Date(end);
//   if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} – ${end}`;

//   const sDay = s.getUTCDate();
//   const eDay = e.getUTCDate();
//   const sMonth = MONTHS_SHORT[s.getUTCMonth()];
//   const eMonth = MONTHS_SHORT[e.getUTCMonth()];
//   const sYear = s.getUTCFullYear();
//   const eYear = e.getUTCFullYear();

//   const sLabel = `${ordinal(sDay)} ${sMonth}`;
//   const eLabel = `${ordinal(eDay)} ${eMonth}`;
//   const yearLabel = sYear === eYear ? sYear : `${sYear}/${eYear}`;

//   return `${sLabel} - ${eLabel}, ${yearLabel}`;
// }

// /**
//  * Render an attendance date as "8.1.2025" (D.M.YYYY) — matching the paper form.
//  */
// function formatShortDate(date: string): string {
//   if (!date) return "";
//   const d = new Date(date);
//   if (isNaN(d.getTime())) return date;
//   return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
// }

// /**
//  * Turn a week's committee data into parallel arrays for the multi-row span,
//  * so we can render one row per committee — like the paper form does.
//  */
// function explodeWeek(week: ClaimWeek) {
//   const committees = week.committees ?? [];

//   // Case A: committee attended + has committees → one row per committee
//   if (week.attended_committee && committees.length > 0) {
//     return committees.map((c, idx) => ({
//       isFirst: idx === 0,
//       spanRows: committees.length,
//       committeeName: c.name,
//       sittingLine: `${c.name.toUpperCase()} - ${formatShortDate(c.attendance_date)}`,
//       mode: c.mode.charAt(0).toUpperCase() + c.mode.slice(1),
//       sittings: c.sittings,
//       chamberMarker: week.attended_chamber && idx === 0,
//     }));
//   }

//   // Case B: chamber only
//   if (week.attended_chamber && !week.attended_committee) {
//     return [
//       {
//         isFirst: true,
//         spanRows: 1,
//         committeeName: "",
//         sittingLine: "",
//         mode: "",
//         sittings: 0,
//         chamberMarker: true,
//       },
//     ];
//   }

//   // Case C: committee attended but nothing selected (edge case)
//   return [
//     {
//       isFirst: true,
//       spanRows: 1,
//       committeeName: "",
//       sittingLine: "",
//       mode: "",
//       sittings: 0,
//       chamberMarker: false,
//     },
//   ];
// }

// export default function ClaimReviewPage({
//   reviewerRole,
// }: ClaimReviewPageProps) {
//   const router = useRouter();
//   const supabase = useMemo(() => createClient(), []);
//   const [claims, setClaims] = useState<ReviewClaim[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [claimsLoaded, setClaimsLoaded] = useState(false);
//   const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);
//   const [message, setMessage] = useState("");
//   const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

//   // ---------- Data loading ----------
//   const loadClaims = useCallback(async () => {
//     const { data, error } = await supabase
//       .from("claims")
//       .select(
//         "id, member_id, claimant_name, claimant_email, claim_month, claim_year, nights_chamber, nights_committee, declaration_signed_name, status, created_at, secretary_reviewed_at, secretary_reviewed_by, reviewed_at, claim_weeks(id, week_number, week_starting, week_ending, attended_chamber, attended_committee, committees)",
//       )
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("Could not load submitted claims:", error);
//       setMessage("We could not load submitted claims. Please try again.");
//       return;
//     }

//     setClaims((data as ReviewClaim[]) ?? []);
//     setClaimsLoaded(true);
//     setMessage("");
//   }, [supabase]);

//   useEffect(() => {
//     let isActive = true;

//     async function initialize() {
//       const { data, error } = await supabase.auth.getUser();
//       if (!isActive) return;

//       if (error) {
//         console.error("Could not load the signed-in user:", error);
//         setMessage("We could not verify your account. Please sign in again.");
//         setIsLoading(false);
//         return;
//       }

//       if (!data.user) {
//         router.replace("/staff/login");
//         return;
//       }

//       const { data: profile, error: profileError } = await supabase
//         .from("staff_profiles")
//         .select("role")
//         .eq("id", data.user.id)
//         .maybeSingle();

//       if (!isActive) return;

//       if (profileError) {
//         console.error("Staff profile lookup failed:", profileError);
//         setMessage("We could not verify your staff role. Please try again.");
//         setIsLoading(false);
//         return;
//       }

//       if (!profile) {
//         setMessage("This account does not have a staff profile.");
//         setIsLoading(false);
//         return;
//       }

//       if (profile.role !== reviewerRole) {
//         router.replace("/staff/profile");
//         return;
//       }

//       await loadClaims();
//       if (isActive) setIsLoading(false);
//     }

//     void initialize();

//     return () => {
//       isActive = false;
//     };
//   }, [loadClaims, reviewerRole, router, supabase]);

//   // ---------- Review action ----------
//   async function reviewClaim(claimId: string, status: "approved" | "rejected") {
//     setUpdatingClaimId(claimId);
//     setMessage("");

//     const { data: userData, error: userError } = await supabase.auth.getUser();

//     if (userError || !userData.user) {
//       if (userError) console.error("Could not verify the reviewer:", userError);
//       setMessage("Your session could not be verified. Please sign in again.");
//       setUpdatingClaimId(null);
//       return;
//     }

//     const reviewedAt = new Date().toISOString();
//     const nextStatus =
//       reviewerRole === "secretary" && status === "approved"
//         ? "director_review"
//         : status;
//     const update =
//       reviewerRole === "secretary"
//         ? {
//             status: nextStatus,
//             secretary_reviewed_by: userData.user.id,
//             secretary_reviewed_at: reviewedAt,
//           }
//         : {
//             status: nextStatus,
//             reviewed_by: userData.user.id,
//             reviewed_at: reviewedAt,
//           };
//     const expectedStatus =
//       reviewerRole === "secretary" ? "secretary_review" : "director_review";

//     const { data, error } = await supabase
//       .from("claims")
//       .update(update)
//       .eq("id", claimId)
//       .eq("status", expectedStatus)
//       .select("id")
//       .maybeSingle();

//     if (error) {
//       console.error("Could not update claim review status:", error);
//       setMessage("The claim could not be updated. Please try again.");
//       setUpdatingClaimId(null);
//       return;
//     }

//     if (!data) {
//       setMessage("This claim has already been reviewed. Refreshing the list.");
//       await loadClaims();
//       setUpdatingClaimId(null);
//       return;
//     }

//     setClaims((current) =>
//       current.map((claim) =>
//         claim.id === claimId
//           ? reviewerRole === "secretary"
//             ? {
//                 ...claim,
//                 status: nextStatus,
//                 secretary_reviewed_at: reviewedAt,
//                 secretary_reviewed_by: userData.user.id,
//               }
//             : { ...claim, status: nextStatus, reviewed_at: reviewedAt }
//           : claim,
//       ),
//     );
//     setUpdatingClaimId(null);
//   }

//   async function handleSignOut() {
//     const { error } = await supabase.auth.signOut();
//     if (error) {
//       console.error("Could not sign out:", error);
//       setMessage("We could not sign you out. Please try again.");
//       return;
//     }
//     router.replace("/staff/login");
//   }

//   async function refreshClaims() {
//     setIsRefreshing(true);
//     await loadClaims();
//     setIsRefreshing(false);
//   }

//   const pendingStatus =
//     reviewerRole === "secretary" ? "secretary_review" : "director_review";
//   const pendingClaims = claims.filter((c) => c.status === pendingStatus);
//   const reviewedClaims = claims.filter((c) => c.status !== pendingStatus);

//   // ---------- Rendering ----------
//   function renderClaimRow(claim: ReviewClaim) {
//     const isPending = claim.status === pendingStatus;
//     const isOpen = activeClaimId === claim.id;

//     return (
//       <li key={claim.id} className={styles.claimRow}>
//         {/* Collapsed header */}
//         <button
//           type="button"
//           className={styles.claimToggle}
//           onClick={() => setActiveClaimId(isOpen ? null : claim.id)}
//           aria-expanded={isOpen}
//         >
//           <div className={styles.toggleLeft}>
//             <span className={styles.togglePeriod}>
//               {claim.claim_month.toUpperCase()} {claim.claim_year}
//             </span>
//             <span className={styles.toggleName}>{claim.claimant_name}</span>
//           </div>
//           <div className={styles.toggleRight}>
//             <span className={styles.status} data-status={claim.status}>
//               {statusLabels[claim.status]}
//             </span>
//           </div>
//         </button>

//         {/* Expanded details */}
//         {isOpen && (
//           <div className={styles.claimBody}>
//             {/* Claim header (like the paper form title bar) */}
//             <div className={styles.scheduleHeader}>
//               <div className={styles.scheduleTitle}>
//                 <Landmark size={16} />
//                 <span>CHAMBER/COMMITTEE ATTENDANCE SCHEDULE</span>
//               </div>
//               <div className={styles.scheduleMeta}>
//                 <span className={styles.scheduleMetaLabel}>
//                   NAME OF SENATOR
//                 </span>
//                 <strong>{claim.claimant_name}</strong>
//               </div>
//             </div>

//             {/* Contact strip */}
//             <div className={styles.metaStrip}>
//               <span className={styles.metaItem}>
//                 <Mail size={13} />
//                 <a href={`mailto:${claim.claimant_email}`}>
//                   {claim.claimant_email}
//                 </a>
//               </span>
//               <span className={styles.metaItem}>
//                 <strong>Submitted:</strong>{" "}
//                 {new Date(claim.created_at).toLocaleString()}
//               </span>
//               {claim.secretary_reviewed_at && (
//                 <span className={styles.metaItem}>
//                   <strong>Secretary:</strong>{" "}
//                   {new Date(claim.secretary_reviewed_at).toLocaleString()}
//                 </span>
//               )}
//               {claim.reviewed_at && (
//                 <span className={styles.metaItem}>
//                   <strong>Director:</strong>{" "}
//                   {new Date(claim.reviewed_at).toLocaleString()}
//                 </span>
//               )}
//             </div>

//             {/* The attendance table — one row per committee */}
//             <div className={styles.tableWrap}>
//               <table className={styles.scheduleTable}>
//                 <thead>
//                   <tr>
//                     <th>WEEK CLAIMED</th>
//                     <th>COMMITTEE(S)</th>
//                     <th>SITTINGS, DATES</th>
//                     <th>NATURE OF SITTING</th>
//                     <th>NUMBER OF SITTINGS</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {claim.claim_weeks.length === 0 ? (
//                     <tr>
//                       <td colSpan={5} className={styles.emptyCell}>
//                         No weeks submitted
//                       </td>
//                     </tr>
//                   ) : (
//                     claim.claim_weeks.flatMap((week) => {
//                       const rows = explodeWeek(week);
//                       return rows.map((row, idx) => (
//                         <tr
//                           key={`${week.id}-${idx}`}
//                           className={row.isFirst ? styles.weekFirstRow : ""}
//                         >
//                           {row.isFirst && (
//                             <td
//                               rowSpan={row.spanRows}
//                               className={styles.weekCell}
//                             >
//                               {formatWeekRange(
//                                 week.week_starting,
//                                 week.week_ending,
//                               )}
//                               {week.attended_chamber && (
//                                 <span className={styles.chamberTag}>
//                                   CHAMBER
//                                 </span>
//                               )}
//                             </td>
//                           )}

//                           <td className={styles.committeeCell}>
//                             {row.committeeName ||
//                               (week.attended_chamber ? "CHAMBER" : "—")}
//                           </td>
//                           <td className={styles.dateCell}>
//                             {row.sittingLine || "—"}
//                           </td>
//                           <td className={styles.modeCell}>
//                             {row.mode ? (
//                               <span
//                                 className={styles.modePill}
//                                 data-mode={row.mode.toLowerCase()}
//                               >
//                                 {row.mode}
//                               </span>
//                             ) : (
//                               "—"
//                             )}
//                           </td>
//                           <td className={styles.sittingCountCell}>
//                             {row.sittings > 0 ? row.sittings : "—"}
//                           </td>
//                         </tr>
//                       ));
//                     })
//                   )}
//                 </tbody>
//               </table>
//             </div>

//             {/* Summary block */}
//             <div className={styles.summaryBlock}>
//               <div className={styles.summaryCard}>
//                 <span className={styles.summaryLabel}>Nights claimed</span>
//                 <div className={styles.summaryRows}>
//                   <div>
//                     <span>Chamber attendance</span>
//                     <strong>{claim.nights_chamber}</strong>
//                   </div>
//                   <div>
//                     <span>Committee attendance</span>
//                     <strong>{claim.nights_committee}</strong>
//                   </div>
//                   <div className={styles.summaryTotal}>
//                     <span>Total</span>
//                     <strong>
//                       {claim.nights_chamber + claim.nights_committee}
//                     </strong>
//                   </div>
//                 </div>
//               </div>

//               <div className={styles.declarationCard}>
//                 <span className={styles.summaryLabel}>Declaration</span>
//                 <p className={styles.declarationText}>
//                   I certify that I did not travel out of the country, nor
//                   benefit from government accommodation on any of the dates
//                   stated above.
//                 </p>
//                 <p className={styles.signedBy}>
//                   Signed: <strong>{claim.declaration_signed_name}</strong>
//                 </p>
//               </div>
//             </div>

//             {/* Actions */}
//             {isPending && (
//               <div className={styles.reviewActions}>
//                 <button
//                   type="button"
//                   className={styles.approveButton}
//                   onClick={() => void reviewClaim(claim.id, "approved")}
//                   disabled={updatingClaimId !== null}
//                 >
//                   <Check size={16} />
//                   {updatingClaimId === claim.id
//                     ? "Saving..."
//                     : reviewerRole === "secretary"
//                       ? "Forward to director"
//                       : "Approve"}
//                 </button>
//                 <button
//                   type="button"
//                   className={styles.rejectButton}
//                   onClick={() => void reviewClaim(claim.id, "rejected")}
//                   disabled={updatingClaimId !== null}
//                 >
//                   <X size={16} />
//                   Reject
//                 </button>
//                 <button
//                   type="button"
//                   className={styles.printButton}
//                   onClick={() => window.print()}
//                 >
//                   <Printer size={16} />
//                   Print
//                 </button>
//               </div>
//             )}

//             {!isPending && (
//               <div className={styles.finalizedNote}>
//                 <BadgeCheck size={15} />
//                 <span>
//                   This claim has been {statusLabels[claim.status].toLowerCase()}
//                   .
//                 </span>
//                 <button
//                   type="button"
//                   className={styles.printButton}
//                   onClick={() => window.print()}
//                 >
//                   <Printer size={16} />
//                   Print
//                 </button>
//               </div>
//             )}
//           </div>
//         )}
//       </li>
//     );
//   }

//   return (
//     <main className={styles.page}>
//       <header className={styles.header}>
//         <Link href="/staff/profile" className={styles.brand}>
//           <span className={styles.brandMark}>
//             <Landmark size={20} strokeWidth={1.8} />
//           </span>
//           <span className={styles.brandText}>
//             <strong>SENATE LIAISON</strong>
//             <span>DSA MANAGEMENT SYSTEM</span>
//           </span>
//         </Link>
//         <button
//           className={styles.signOutButton}
//           type="button"
//           onClick={handleSignOut}
//         >
//           <LogOut size={16} />
//           Sign out
//         </button>
//       </header>

//       <div className={styles.content}>
//         <div className={styles.intro}>
//           <span className={styles.eyebrow}>
//             <BadgeCheck size={15} />
//             {reviewerRole === "secretary"
//               ? "Secretary workspace"
//               : "Director workspace"}
//           </span>
//           <h1>
//             {reviewerRole === "director"
//               ? "Director claim approvals"
//               : "Member claims"}
//           </h1>
//           <p>
//             {reviewerRole === "secretary"
//               ? "Review submitted DSA claims and forward approved claims to the Director."
//               : "Review claims forwarded by the Secretary and record the final decision."}
//           </p>
//           <button
//             type="button"
//             className={styles.refreshButton}
//             onClick={() => void refreshClaims()}
//             disabled={isRefreshing || isLoading}
//           >
//             {isRefreshing ? "Refreshing..." : "Refresh claims"}
//           </button>
//         </div>

//         {message && (
//           <p className={styles.message} role="alert">
//             {message}
//           </p>
//         )}

//         {isLoading ? (
//           <section className={styles.loadingCard} aria-live="polite">
//             <span className={styles.spinner} aria-hidden="true" />
//             <p>Loading claims...</p>
//           </section>
//         ) : !claimsLoaded ? null : (
//           <>
//             <section className={styles.claimSection}>
//               <div className={styles.sectionHeading}>
//                 <h2>
//                   {reviewerRole === "secretary"
//                     ? "Awaiting secretary review"
//                     : "Awaiting director review"}
//                 </h2>
//                 <span>{pendingClaims.length}</span>
//               </div>
//               {pendingClaims.length ? (
//                 <ul className={styles.claimList}>
//                   {pendingClaims.map(renderClaimRow)}
//                 </ul>
//               ) : (
//                 <p className={styles.emptyState}>
//                   There are no claims awaiting review.
//                 </p>
//               )}
//             </section>

//             <section className={styles.claimSection}>
//               <div className={styles.sectionHeading}>
//                 <h2>Reviewed claims</h2>
//                 <span>{reviewedClaims.length}</span>
//               </div>
//               {reviewedClaims.length ? (
//                 <ul className={styles.claimList}>
//                   {reviewedClaims.map(renderClaimRow)}
//                 </ul>
//               ) : (
//                 <p className={styles.emptyState}>
//                   No claims have been reviewed yet.
//                 </p>
//               )}
//             </section>
//           </>
//         )}
//       </div>
//     </main>
//   );
// }

// "use client";

// import { useCallback, useEffect, useMemo, useState } from "react";
// import Link from "next/link";
// import { usePathname, useRouter } from "next/navigation";
// import {
//   BadgeCheck,
//   CalendarDays,
//   Check,
//   Landmark,
//   LogOut,
//   Mail,
//   X,
// } from "lucide-react";

// import { createClient } from "@/utils/supabase/client";
// import styles from "@/app/secretary/claims/styles.module.css";

// type ClaimWeek = {
//   id: string;
//   week_number: number;
//   week_starting: string;
//   week_ending: string;
//   attended_chamber: boolean;
//   attended_committee: boolean;
//   committees: Array<{
//     name: string;
//     attendance_date: string;
//     mode: string;
//     sittings: number;
//   }>;
// };

// type ReviewClaim = {
//   id: string;
//   member_id: string;
//   claimant_name: string;
//   claimant_email: string;
//   claim_month: string;
//   claim_year: number;
//   nights_chamber: number;
//   nights_committee: number;
//   declaration_signed_name: string;
//   status: "secretary_review" | "director_review" | "approved" | "rejected";
//   created_at: string;
//   secretary_reviewed_at: string | null;
//   secretary_reviewed_by: string | null;
//   reviewed_at: string | null;
//   claim_weeks: ClaimWeek[];
// };

// const statusLabels: Record<ReviewClaim["status"], string> = {
//   secretary_review: "Awaiting review",
//   director_review: "Awaiting director review",
//   approved: "Approved",
//   rejected: "Rejected",
// };

// type ClaimReviewPageProps = {
//   reviewerRole: "secretary" | "director";
// };

// export default function ClaimReviewPage({
//   reviewerRole,
// }: ClaimReviewPageProps) {
//   const router = useRouter();
//   const pathname = usePathname();
//   const supabase = useMemo(() => createClient(), []);
//   const [claims, setClaims] = useState<ReviewClaim[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [claimsLoaded, setClaimsLoaded] = useState(false);
//   const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);
//   const [message, setMessage] = useState("");

//   const loadClaims = useCallback(async () => {
//     const { data, error } = await supabase
//       .from("claims")
//       .select(
//         "id, member_id, claimant_name, claimant_email, claim_month, claim_year, nights_chamber, nights_committee, declaration_signed_name, status, created_at, secretary_reviewed_at, secretary_reviewed_by, reviewed_at, claim_weeks(id, week_number, week_starting, week_ending, attended_chamber, attended_committee, committees)",
//       )
//       .order("created_at", { ascending: false });

//     if (error) {
//       console.error("Could not load submitted claims:", error);
//       setMessage("We could not load submitted claims. Please try again.");
//       return;
//     }

//     setClaims(data ?? []);
//     setClaimsLoaded(true);
//     setMessage("");
//   }, [supabase]);

//   useEffect(() => {
//     let isActive = true;

//     async function initialize() {
//       const { data, error } = await supabase.auth.getUser();

//       if (!isActive) return;

//       if (error) {
//         console.error("Could not load the signed-in user:", error);
//         setMessage("We could not verify your account. Please sign in again.");
//         setIsLoading(false);
//         return;
//       }

//       if (!data.user) {
//         router.replace("/staff/login");
//         return;
//       }

//       const userRole =
//         data.user.user_metadata?.role ?? data.user.app_metadata?.role;

//       if (
//         userRole !== reviewerRole ||
//         (reviewerRole === "director" && pathname.startsWith("/secretary/")) ||
//         (reviewerRole === "secretary" && pathname.startsWith("/director/"))
//       ) {
//         router.replace("/staff/profile");
//         return;
//       }

//       await loadClaims();

//       if (isActive) setIsLoading(false);
//     }

//     void initialize();

//     return () => {
//       isActive = false;
//     };
//   }, [loadClaims, pathname, reviewerRole, router, supabase]);

//   async function reviewClaim(
//     claimId: string,
//     status: "approved" | "rejected",
//   ) {
//     setUpdatingClaimId(claimId);
//     setMessage("");

//     const { data: userData, error: userError } = await supabase.auth.getUser();

//     if (userError || !userData.user) {
//       if (userError) console.error("Could not verify the secretary:", userError);
//       setMessage("Your session could not be verified. Please sign in again.");
//       setUpdatingClaimId(null);
//       return;
//     }

//     const userRole =
//       userData.user.user_metadata?.role ?? userData.user.app_metadata?.role;
//     if (userRole !== reviewerRole) {
//       setMessage("Your account does not have permission to review claims.");
//       setUpdatingClaimId(null);
//       return;
//     }

//     const reviewedAt = new Date().toISOString();
//     const nextStatus =
//       reviewerRole === "secretary" && status === "approved"
//         ? "director_review"
//         : status;
//     const update =
//       reviewerRole === "secretary"
//         ? {
//             status: nextStatus,
//             secretary_reviewed_by: userData.user.id,
//             secretary_reviewed_at: reviewedAt,
//           }
//         : {
//             status: nextStatus,
//             reviewed_by: userData.user.id,
//             reviewed_at: reviewedAt,
//           };
//     const expectedStatus =
//       reviewerRole === "secretary" ? "secretary_review" : "director_review";
//     const { data, error } = await supabase
//       .from("claims")
//       .update(update)
//       .eq("id", claimId)
//       .eq("status", expectedStatus)
//       .select("id")
//       .maybeSingle();

//     if (error) {
//       console.error("Could not update claim review status:", error);
//       setMessage("The claim could not be updated. Please try again.");
//       setUpdatingClaimId(null);
//       return;
//     }

//     if (!data) {
//       setMessage("This claim has already been reviewed. Refreshing the list.");
//       await loadClaims();
//       setUpdatingClaimId(null);
//       return;
//     }

//     setClaims((current) =>
//       current.map((claim) =>
//         claim.id === claimId
//           ? reviewerRole === "secretary"
//             ? {
//                 ...claim,
//                 status: nextStatus,
//                 secretary_reviewed_at: reviewedAt,
//                 secretary_reviewed_by: userData.user.id,
//               }
//             : {
//                 ...claim,
//                 status: nextStatus,
//                 reviewed_at: reviewedAt,
//               }
//           : claim,
//       ),
//     );
//     setUpdatingClaimId(null);
//   }

//   async function handleSignOut() {
//     const { error } = await supabase.auth.signOut();

//     if (error) {
//       console.error("Could not sign out:", error);
//       setMessage("We could not sign you out. Please try again.");
//       return;
//     }

//     router.replace("/staff/login");
//   }

//   async function refreshClaims() {
//     setIsRefreshing(true);
//     await loadClaims();
//     setIsRefreshing(false);
//   }

//   const pendingStatus =
//     reviewerRole === "secretary" ? "secretary_review" : "director_review";
//   const pendingClaims = claims.filter((claim) => claim.status === pendingStatus);
//   const reviewedClaims = claims.filter(
//     (claim) => claim.status !== pendingStatus,
//   );

//   function renderClaim(claim: ReviewClaim) {
//     const isPending = claim.status === pendingStatus;

//     return (
//       <li className={styles.claimCard} key={claim.id}>
//         <div className={styles.claimHeader}>
//           <div>
//             <h3>
//               {claim.claim_month} {claim.claim_year}
//             </h3>
//             <p className={styles.memberName}>{claim.claimant_name}</p>
//           </div>
//           <span className={styles.status} data-status={claim.status}>
//             {statusLabels[claim.status]}
//           </span>
//         </div>

//         <div className={styles.memberEmail}>
//           <Mail size={15} />
//           <a href={`mailto:${claim.claimant_email}`}>
//             {claim.claimant_email}
//           </a>
//         </div>

//         <p className={styles.submittedAt}>
//           Submitted {new Date(claim.created_at).toLocaleString()}
//           {claim.secretary_reviewed_at &&
//             ` · Secretary reviewed ${new Date(claim.secretary_reviewed_at).toLocaleString()}`}
//           {claim.reviewed_at &&
//             ` · Director reviewed ${new Date(claim.reviewed_at).toLocaleString()}`}
//         </p>

//         <div className={styles.nights}>
//           <span>Chamber: {claim.nights_chamber} nights</span>
//           <span>Committee: {claim.nights_committee} nights</span>
//         </div>
//         <p className={styles.signedName}>
//           Declaration signed by <strong>{claim.declaration_signed_name}</strong>
//         </p>

//         <details className={styles.weekDetails}>
//           <summary>
//             <CalendarDays size={16} />
//             View {claim.claim_weeks.length} week
//             {claim.claim_weeks.length === 1 ? "" : "s"} of claim details
//           </summary>
//           <ol className={styles.weekList}>
//             {claim.claim_weeks.map((week) => (
//               <li key={week.id}>
//                 <strong>
//                   Week {week.week_number}: {week.week_starting} to{" "}
//                   {week.week_ending}
//                 </strong>
//                 <span>
//                   {[
//                     week.attended_chamber && "Chamber",
//                     week.attended_committee && "Committee",
//                   ]
//                     .filter(Boolean)
//                     .join(" and ")}
//                 </span>
//                 {week.committees.length > 0 && (
//                   <ul>
//                     {week.committees.map((committee) => (
//                       <li key={`${week.id}-${committee.name}`}>
//                         {committee.name} — {committee.attendance_date},{" "}
//                         {committee.mode}, {committee.sittings} sitting
//                         {committee.sittings === 1 ? "" : "s"}
//                       </li>
//                     ))}
//                   </ul>
//                 )}
//               </li>
//             ))}
//           </ol>
//         </details>

//         {isPending && (
//           <div className={styles.reviewActions}>
//             <button
//               type="button"
//               className={styles.approveButton}
//               onClick={() => void reviewClaim(claim.id, "approved")}
//               disabled={updatingClaimId !== null}
//             >
//               <Check size={16} />
//               {updatingClaimId === claim.id
//                 ? "Saving..."
//                 : reviewerRole === "secretary"
//                   ? "Forward to director"
//                   : "Approve"}
//             </button>
//             <button
//               type="button"
//               className={styles.rejectButton}
//               onClick={() => void reviewClaim(claim.id, "rejected")}
//               disabled={updatingClaimId !== null}
//             >
//               <X size={16} />
//               Reject
//             </button>
//           </div>
//         )}
//       </li>
//     );
//   }

//   return (
//     <main className={styles.page}>
//       <header className={styles.header}>
//         <Link href="/staff/profile" className={styles.brand}>
//           <span className={styles.brandMark}>
//             <Landmark size={20} strokeWidth={1.8} />
//           </span>
//           <span className={styles.brandText}>
//             <strong>SENATE LIAISON</strong>
//             <span>DSA MANAGEMENT SYSTEM</span>
//           </span>
//         </Link>
//         <button
//           className={styles.signOutButton}
//           type="button"
//           onClick={handleSignOut}
//         >
//           <LogOut size={16} />
//           Sign out
//         </button>
//       </header>

//       <div className={styles.content}>
//         <div className={styles.intro}>
//           <span className={styles.eyebrow}>
//             <BadgeCheck size={15} />
//             {reviewerRole === "secretary"
//               ? "Secretary workspace"
//               : "Director workspace"}
//           </span>
//           <h1>Member claims</h1>
//           <p>
//             {reviewerRole === "secretary"
//               ? "Review submitted DSA claims and forward approved claims to the Director."
//               : "Review claims forwarded by the Secretary and record the final decision."}
//           </p>
//           <button
//             type="button"
//             className={styles.refreshButton}
//             onClick={() => void refreshClaims()}
//             disabled={isRefreshing || isLoading}
//           >
//             {isRefreshing ? "Refreshing..." : "Refresh claims"}
//           </button>
//         </div>

//         {message && (
//           <p className={styles.message} role="alert">
//             {message}
//           </p>
//         )}

//         {isLoading ? (
//           <section className={styles.loadingCard} aria-live="polite">
//             <span className={styles.spinner} aria-hidden="true" />
//             <p>Loading claims...</p>
//           </section>
//         ) : !claimsLoaded ? null : (
//           <>
//             <section className={styles.claimSection}>
//               <div className={styles.sectionHeading}>
//                 <h2>
//                   {reviewerRole === "secretary"
//                     ? "Awaiting secretary review"
//                     : "Awaiting director review"}
//                 </h2>
//                 <span>{pendingClaims.length}</span>
//               </div>
//               {pendingClaims.length ? (
//                 <ul className={styles.claimList}>
//                   {pendingClaims.map(renderClaim)}
//                 </ul>
//               ) : (
//                 <p className={styles.emptyState}>
//                   There are no claims awaiting review.
//                 </p>
//               )}
//             </section>

//             <section className={styles.claimSection}>
//               <div className={styles.sectionHeading}>
//                 <h2>Reviewed claims</h2>
//                 <span>{reviewedClaims.length}</span>
//               </div>
//               {reviewedClaims.length ? (
//                 <ul className={styles.claimList}>
//                   {reviewedClaims.map(renderClaim)}
//                 </ul>
//               ) : (
//                 <p className={styles.emptyState}>
//                   No claims have been reviewed yet.
//                 </p>
//               )}
//             </section>
//           </>
//         )}
//       </div>
//     </main>
//   );
// }

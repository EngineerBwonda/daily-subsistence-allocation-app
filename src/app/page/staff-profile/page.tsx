"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Search,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import styles from "./styles.module.css";

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

export default function ClaimReviewPage({
  reviewerRole,
}: ClaimReviewPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [claims, setClaims] = useState<ReviewClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [claimsLoaded, setClaimsLoaded] = useState(false);
  const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

  /* UI-only state */
  const [query, setQuery] = useState("");

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

      const userRole =
        data.user.user_metadata?.role ?? data.user.app_metadata?.role;

      if (
        userRole !== reviewerRole ||
        (reviewerRole === "director" && pathname.startsWith("/secretary/")) ||
        (reviewerRole === "secretary" && pathname.startsWith("/director/"))
      ) {
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
  }, [loadClaims, pathname, reviewerRole, router, supabase]);

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

  const q = query.trim().toLowerCase();
  const matchesQuery = (c: ReviewClaim) =>
    !q ||
    c.claimant_name.toLowerCase().includes(q) ||
    `${c.claim_month} ${c.claim_year}`.toLowerCase().includes(q);

  const pendingClaims = claims.filter(
    (c) => c.status === pendingStatus && matchesQuery(c),
  );
  const reviewedClaims = claims.filter(
    (c) => c.status !== pendingStatus && matchesQuery(c),
  );

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
            {/* Claim header */}
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

            {/* Contact + audit trail */}
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

            {/* The attendance table — one row per committee */}
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

            {/* Summary block */}
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

            {/* Actions */}
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

          <label className={styles.search}>
            <Search size={15} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or month"
              aria-label="Search claims by name or month"
            />
          </label>
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
                  <strong>
                    {q ? "No matching claims" : "You're all caught up"}
                  </strong>
                  <span>
                    {q
                      ? "Try a different name or month."
                      : "There are no claims awaiting review."}
                  </span>
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
                  <strong>
                    {q ? "No matching claims" : "Nothing reviewed yet"}
                  </strong>
                  <span>
                    {q
                      ? "Try a different name or month."
                      : "No claims have been reviewed yet."}
                  </span>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  Landmark,
  CalendarRange,
  Users,
  ClipboardCheck,
  ShieldCheck,
  Plus,
  X,
  Building2,
  Printer,
  Send,
  FileText,
  BadgeCheck,
  Clock,
  ChevronDown,
} from "lucide-react";
import styles from "./styles.module.css";

type ClaimRow = {
  id: number;
  weekStart: string;
  weekEnd: string;
  chamber: boolean;
  committee: boolean;
  committees: string[]; // committees attended this week
};

const START_ROWS = 6;

const DEFAULT_MASTER_COMMITTEES = [
  "Finance & Budget",
  "Education",
  "Health",
  "Agriculture",
  "Energy & ICT",
  "Justice & Legal Affairs",
  "Foreign Relations",
  "Labour & Social Welfare",
];

function nightsBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export default function ClaimForm() {
  const [serial, setSerial] = useState("");
  const [claimMonth, setClaimMonth] = useState("");
  const [masterCommittees, setMasterCommittees] = useState<string[]>(
    DEFAULT_MASTER_COMMITTEES,
  );
  const [rows, setRows] = useState<ClaimRow[]>(
    Array.from({ length: START_ROWS }, (_, i) => ({
      id: i + 1,
      weekStart: "",
      weekEnd: "",
      chamber: false,
      committee: false,
      committees: [],
    })),
  );
  const [certified, setCertified] = useState(false);
  const [openPickerId, setOpenPickerId] = useState<number | null>(null);

  /* ---------- row helpers ---------- */
  function updateRow<K extends keyof ClaimRow>(
    id: number,
    key: K,
    value: ClaimRow[K],
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  }

  function toggleRowCommittee(id: number, name: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              committees: r.committees.includes(name)
                ? r.committees.filter((c) => c !== name)
                : [...r.committees, name],
            }
          : r,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: (prev[prev.length - 1]?.id ?? 0) + 1,
        weekStart: "",
        weekEnd: "",
        chamber: false,
        committee: false,
        committees: [],
      },
    ]);
  }

  function removeRow(id: number) {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (openPickerId === id) setOpenPickerId(null);
  }

  /* ---------- master committee list editor ---------- */
  function updateMasterCommittee(index: number, value: string) {
    setMasterCommittees((prev) =>
      prev.map((c, i) => (i === index ? value : c)),
    );
  }

  function addMasterCommittee() {
    setMasterCommittees((prev) => [...prev, ""]);
  }

  function removeMasterCommittee(index: number) {
    if (masterCommittees.length <= 1) return;
    const removed = masterCommittees[index];
    setMasterCommittees((prev) => prev.filter((_, i) => i !== index));
    // also strip it from any row that had it selected
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        committees: r.committees.filter((c) => c !== removed),
      })),
    );
  }

  /* ---------- derived ---------- */
  const summary = useMemo(() => {
    let total = 0;
    let chamberNights = 0;
    let committeeNights = 0;
    const committeeTally: Record<string, number> = {};

    for (const r of rows) {
      const n = nightsBetween(r.weekStart, r.weekEnd);
      total += n;
      if (r.chamber) chamberNights += n;
      if (r.committee) committeeNights += n;
      for (const c of r.committees) {
        committeeTally[c] = (committeeTally[c] ?? 0) + n;
      }
    }
    return { total, chamberNights, committeeNights, committeeTally };
  }, [rows]);

  const filledPeriods = rows.filter((r) => r.weekStart || r.weekEnd).length;

  return (
    <div className={styles.appShell}>
      {/* ===== TOP BAR ===== */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Landmark size={26} strokeWidth={1.6} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandKicker}>The Senate</span>
            <h1 className={styles.brandTitle}>
              Domestic Subsistence Facilitation
            </h1>
          </div>
        </div>

        <div className={styles.topBarMeta}>
          <div className={styles.serialChip}>
            <span className={styles.serialLabel}>Serial</span>
            <input
              className={styles.serialInput}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="—"
              aria-label="Serial number"
            />
          </div>
          <div className={styles.statusChip}>
            <span className={styles.statusDot} data-active={certified} />
            {certified ? "Ready to submit" : "Draft"}
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroEyebrow}>
            <FileText size={14} strokeWidth={2} />
            Claim Form · MP Submission
          </span>
          <h2 className={styles.heroTitle}>
            Declare your overnight stays in Nairobi
          </h2>
          <p className={styles.heroSub}>
            Please prepare my domestic subsistence facilitation for the night(s)
            indicated hereunder which I spent in Nairobi attending to
            parliamentary business.
          </p>
        </div>

        <div className={styles.statCluster}>
          <div className={styles.statCard}>
            <Clock size={16} strokeWidth={1.8} />
            <div>
              <span className={styles.statValue}>{summary.total}</span>
              <span className={styles.statLabel}>Total nights</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <CalendarRange size={16} strokeWidth={1.8} />
            <div>
              <span className={styles.statValue}>{filledPeriods}</span>
              <span className={styles.statLabel}>Periods filled</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <BadgeCheck size={16} strokeWidth={1.8} />
            <div>
              <span className={styles.statValue}>
                {certified ? "Yes" : "No"}
              </span>
              <span className={styles.statLabel}>Certified</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MONTH ===== */}
      <section className={styles.monthStrip}>
        <label htmlFor="claimMonth" className={styles.monthLabel}>
          Claim for the month of
        </label>
        <input
          id="claimMonth"
          className={styles.monthInput}
          value={claimMonth}
          onChange={(e) => setClaimMonth(e.target.value)}
          placeholder="e.g. July 2024"
        />
      </section>

      {/* ===== WORKBENCH ===== */}
      <div className={styles.workbench}>
        {/* LEFT: Period table (wide) */}
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div className={styles.panelHeadTitle}>
              <CalendarRange size={18} strokeWidth={1.8} />
              <span>Period Claimed — Night(s) in Nairobi</span>
            </div>
            <span className={styles.panelBadge}>
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colNum}>#</th>
                  <th>Week starting</th>
                  <th>Week ending</th>
                  <th className={styles.colCheck}>Chamber</th>
                  <th className={styles.colCheck}>Committee</th>
                  <th>Committees attended this week</th>
                  <th className={styles.colAction}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const pickerEnabled = row.chamber || row.committee;
                  const isOpen = openPickerId === row.id;
                  return (
                    <tr key={row.id}>
                      <td className={styles.colNum}>{i + 1}</td>

                      <td>
                        <input
                          type="date"
                          className={styles.cellInput}
                          value={row.weekStart}
                          onChange={(e) =>
                            updateRow(row.id, "weekStart", e.target.value)
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="date"
                          className={styles.cellInput}
                          value={row.weekEnd}
                          onChange={(e) =>
                            updateRow(row.id, "weekEnd", e.target.value)
                          }
                        />
                      </td>

                      {/* Chamber toggle */}
                      <td className={styles.colCheck}>
                        <button
                          type="button"
                          className={`${styles.checkBtn} ${row.chamber ? styles.checkBtnActive : ""}`}
                          onClick={() =>
                            updateRow(row.id, "chamber", !row.chamber)
                          }
                          aria-pressed={row.chamber}
                          aria-label="Mark chamber sitting"
                        >
                          {row.chamber ? <ClipboardCheck size={14} /> : null}
                        </button>
                      </td>

                      {/* Committee toggle */}
                      <td className={styles.colCheck}>
                        <button
                          type="button"
                          className={`${styles.checkBtn} ${row.committee ? styles.checkBtnActive : ""}`}
                          onClick={() =>
                            updateRow(row.id, "committee", !row.committee)
                          }
                          aria-pressed={row.committee}
                          aria-label="Mark committee sitting"
                        >
                          {row.committee ? <ClipboardCheck size={14} /> : null}
                        </button>
                      </td>

                      {/* Row-level committee picker */}
                      <td className={styles.pickerCell}>
                        <div className={styles.pickerWrap}>
                          <button
                            type="button"
                            className={styles.pickerTrigger}
                            disabled={!pickerEnabled}
                            onClick={() =>
                              setOpenPickerId(isOpen ? null : row.id)
                            }
                            aria-haspopup="listbox"
                            aria-expanded={isOpen}
                          >
                            <span className={styles.pickerTriggerText}>
                              {!pickerEnabled
                                ? "Flag Chamber or Committee first"
                                : row.committees.length === 0
                                  ? "Select committees…"
                                  : row.committees.length === 1
                                    ? row.committees[0]
                                    : `${row.committees.length} committees selected`}
                            </span>
                            <ChevronDown
                              size={14}
                              className={
                                isOpen
                                  ? styles.pickerChevronOpen
                                  : styles.pickerChevron
                              }
                            />
                          </button>

                          {isOpen && pickerEnabled && (
                            <div
                              className={styles.pickerMenu}
                              role="listbox"
                              aria-multiselectable="true"
                            >
                              {masterCommittees.filter(Boolean).length === 0 ? (
                                <div className={styles.pickerEmpty}>
                                  No committees defined. Add some in the panel
                                  on the right.
                                </div>
                              ) : (
                                masterCommittees.filter(Boolean).map((name) => {
                                  const selected =
                                    row.committees.includes(name);
                                  return (
                                    <label
                                      key={name}
                                      className={`${styles.pickerOption} ${selected ? styles.pickerOptionActive : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() =>
                                          toggleRowCommittee(row.id, name)
                                        }
                                      />
                                      <span
                                        className={styles.pickerCheckBox}
                                        aria-hidden="true"
                                      />
                                      <span
                                        className={styles.pickerOptionLabel}
                                      >
                                        {name}
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        {/* chip strip below trigger */}
                        {row.committees.length > 0 && (
                          <div className={styles.chipStrip}>
                            {row.committees.map((c) => (
                              <span key={c} className={styles.chip} title={c}>
                                {c}
                                <button
                                  type="button"
                                  className={styles.chipRemove}
                                  onClick={() => toggleRowCommittee(row.id, c)}
                                  aria-label={`Remove ${c}`}
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Remove row */}
                      <td className={styles.colAction}>
                        <button
                          type="button"
                          className={styles.removeRow}
                          onClick={() => removeRow(row.id)}
                          aria-label="Remove row"
                        >
                          <X size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" className={styles.addRowBtn} onClick={addRow}>
            <Plus size={14} /> Add period
          </button>
        </section>

        {/* RIGHT: Master committee list + Summary */}
        <aside className={styles.sideColumn}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div className={styles.panelHeadTitle}>
                <Users size={18} strokeWidth={1.8} />
                <span>Committee register</span>
              </div>
              <button
                type="button"
                className={styles.panelAction}
                onClick={addMasterCommittee}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            <p className={styles.panelHint}>
              Edit the master list once — it becomes selectable in every row.
            </p>

            <ul className={styles.masterList}>
              {masterCommittees.map((c, idx) => (
                <li className={styles.masterItem} key={idx}>
                  <span className={styles.romanNum}>{idx + 1}</span>
                  <input
                    className={styles.masterInput}
                    value={c}
                    onChange={(e) => updateMasterCommittee(idx, e.target.value)}
                    placeholder="Committee name"
                  />
                  <button
                    type="button"
                    className={styles.masterRemove}
                    onClick={() => removeMasterCommittee(idx)}
                    aria-label={`Remove ${c || "committee"}`}
                    disabled={masterCommittees.length <= 1}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div className={styles.panelHeadTitle}>
                <Building2 size={18} strokeWidth={1.8} />
                <span>Summary</span>
              </div>
            </div>
            <div className={styles.summaryBox}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Chamber attendance</span>
                <span className={styles.summaryValue}>
                  {summary.chamberNights}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>
                  Committee attendance
                </span>
                <span className={styles.summaryValue}>
                  {summary.committeeNights}
                </span>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span className={styles.summaryLabel}>
                  Total nights claimed
                </span>
                <span className={styles.summaryValue}>{summary.total}</span>
              </div>
            </div>

            {/* per-committee tally */}
            {Object.keys(summary.committeeTally).length > 0 && (
              <div className={styles.tallyBox}>
                <div className={styles.tallyHead}>Nights by committee</div>
                <ul className={styles.tallyList}>
                  {Object.entries(summary.committeeTally)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, nights]) => (
                      <li key={name} className={styles.tallyItem}>
                        <span className={styles.tallyName}>{name}</span>
                        <span className={styles.tallyValue}>{nights}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ===== CERTIFICATION ===== */}
      <section className={styles.certBlock}>
        <label className={styles.certLabel}>
          <input
            type="checkbox"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
          />
          <span className={styles.certCheck} aria-hidden="true">
            <ShieldCheck size={18} strokeWidth={2} />
          </span>
          <span className={styles.certText}>
            I certify that I did not travel out of the country, nor benefit from
            government accommodation on any of the date(s) stated above.
          </span>
        </label>
      </section>

      {/* ===== OFFICIAL USE ===== */}
      <section className={styles.officialBlock}>
        <div className={styles.officialLabel}>For official use only</div>
        <div className={styles.officialGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Chamber attendance confirmed by (Director)
            </span>
            <input
              className={styles.fieldInput}
              disabled
              placeholder="Pending review"
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Committee attendance confirmed by (Director)
            </span>
            <input
              className={styles.fieldInput}
              disabled
              placeholder="Pending review"
            />
          </div>
        </div>
      </section>

      {/* ===== ACTIONS ===== */}
      <footer className={styles.actionBar}>
        <button
          type="button"
          className={styles.btnGhost}
          onClick={() => window.print()}
        >
          <Printer size={16} /> Print
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!certified}
        >
          <Send size={16} /> Submit claim
        </button>
      </footer>
    </div>
  );
}

// "use client";

// import { useMemo, useState } from "react";
// import {
//   Landmark,
//   CalendarRange,
//   Users,
//   ClipboardCheck,
//   ShieldCheck,
//   Plus,
//   X,
//   Building2,
//   Printer,
//   Send,
//   FileText,
//   BadgeCheck,
//   Clock,
// } from "lucide-react";
// import styles from "./styles.module.css";

// type ClaimRow = {
//   id: number;
//   weekStart: string;
//   weekEnd: string;
//   chamber: boolean;
//   committee: boolean;
// };

// const START_ROWS = 6;
// const ROMAN = ["i", "ii", "iii", "iv", "v", "vi"];

// function nightsBetween(start: string, end: string): number {
//   if (!start || !end) return 0;
//   const a = new Date(start).getTime();
//   const b = new Date(end).getTime();
//   if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
//   return Math.round((b - a) / 86400000) + 1;
// }

// export default function ClaimForm() {
//   const [serial, setSerial] = useState("");
//   const [claimMonth, setClaimMonth] = useState("");
//   const [rows, setRows] = useState<ClaimRow[]>(
//     Array.from({ length: START_ROWS }, (_, i) => ({
//       id: i + 1,
//       weekStart: "",
//       weekEnd: "",
//       chamber: false,
//       committee: false,
//     })),
//   );
//   const [committees, setCommittees] = useState<string[]>(["", "", "", ""]);
//   const [certified, setCertified] = useState(false);

//   function updateRow<K extends keyof ClaimRow>(
//     id: number,
//     key: K,
//     value: ClaimRow[K],
//   ) {
//     setRows((prev) =>
//       prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
//     );
//   }

//   function addRow() {
//     setRows((prev) => [
//       ...prev,
//       {
//         id: (prev[prev.length - 1]?.id ?? 0) + 1,
//         weekStart: "",
//         weekEnd: "",
//         chamber: false,
//         committee: false,
//       },
//     ]);
//   }

//   function removeRow(id: number) {
//     setRows((prev) =>
//       prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
//     );
//   }

//   const summary = useMemo(() => {
//     let total = 0;
//     let chamberNights = 0;
//     let committeeNights = 0;
//     for (const r of rows) {
//       const n = nightsBetween(r.weekStart, r.weekEnd);
//       total += n;
//       if (r.chamber) chamberNights += n;
//       if (r.committee) committeeNights += n;
//     }
//     return { total, chamberNights, committeeNights };
//   }, [rows]);

//   const filledPeriods = rows.filter((r) => r.weekStart || r.weekEnd).length;

//   return (
//     <div className={styles.appShell}>
//       {/* ===== TOP BAR ===== */}
//       <header className={styles.topBar}>
//         <div className={styles.brand}>
//           <div className={styles.brandMark}>
//             <Landmark size={26} strokeWidth={1.6} />
//           </div>
//           <div className={styles.brandText}>
//             <span className={styles.brandKicker}>The Senate</span>
//             <h1 className={styles.brandTitle}>
//               Domestic Subsistence Facilitation
//             </h1>
//           </div>
//         </div>

//         <div className={styles.topBarMeta}>
//           <div className={styles.serialChip}>
//             <span className={styles.serialLabel}>Serial</span>
//             <input
//               className={styles.serialInput}
//               value={serial}
//               onChange={(e) => setSerial(e.target.value)}
//               placeholder="—"
//               aria-label="Serial number"
//             />
//           </div>
//           <div className={styles.statusChip}>
//             <span className={styles.statusDot} data-active={certified} />
//             {certified ? "Ready to submit" : "Draft"}
//           </div>
//         </div>
//       </header>

//       {/* ===== HERO ===== */}
//       <section className={styles.hero}>
//         <div className={styles.heroText}>
//           <span className={styles.heroEyebrow}>
//             <FileText size={14} strokeWidth={2} />
//             Claim Form · MP Submission
//           </span>
//           <h2 className={styles.heroTitle}>
//             Declare your overnight stays in Nairobi
//           </h2>
//           <p className={styles.heroSub}>
//             Please prepare my domestic subsistence facilitation for the night(s)
//             indicated hereunder which I spent in Nairobi attending to
//             parliamentary business.
//           </p>
//         </div>

//         <div className={styles.statCluster}>
//           <div className={styles.statCard}>
//             <Clock size={16} strokeWidth={1.8} />
//             <div>
//               <span className={styles.statValue}>{summary.total}</span>
//               <span className={styles.statLabel}>Total nights</span>
//             </div>
//           </div>
//           <div className={styles.statCard}>
//             <CalendarRange size={16} strokeWidth={1.8} />
//             <div>
//               <span className={styles.statValue}>{filledPeriods}</span>
//               <span className={styles.statLabel}>Periods filled</span>
//             </div>
//           </div>
//           <div className={styles.statCard}>
//             <BadgeCheck size={16} strokeWidth={1.8} />
//             <div>
//               <span className={styles.statValue}>
//                 {certified ? "Yes" : "No"}
//               </span>
//               <span className={styles.statLabel}>Certified</span>
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* ===== MONTH ===== */}
//       <section className={styles.monthStrip}>
//         <label htmlFor="claimMonth" className={styles.monthLabel}>
//           Claim for the month of
//         </label>
//         <input
//           id="claimMonth"
//           className={styles.monthInput}
//           value={claimMonth}
//           onChange={(e) => setClaimMonth(e.target.value)}
//           placeholder="e.g. July 2024"
//         />
//       </section>

//       {/* ===== WORKBENCH ===== */}
//       <div className={styles.workbench}>
//         <section className={styles.panel}>
//           <div className={styles.panelHead}>
//             <div className={styles.panelHeadTitle}>
//               <CalendarRange size={18} strokeWidth={1.8} />
//               <span>Period Claimed — Night(s) in Nairobi</span>
//             </div>
//             <span className={styles.panelBadge}>
//               {rows.length} {rows.length === 1 ? "row" : "rows"}
//             </span>
//           </div>

//           <div className={styles.tableWrap}>
//             <table className={styles.table}>
//               <thead>
//                 <tr>
//                   <th className={styles.colNum}>#</th>
//                   <th>Week starting</th>
//                   <th>Week ending</th>
//                   <th className={styles.colCheck}>Chamber</th>
//                   <th className={styles.colCheck}>Committee</th>
//                   <th className={styles.colAction}></th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {rows.map((row, i) => (
//                   <tr key={row.id}>
//                     <td className={styles.colNum}>{i + 1}</td>
//                     <td>
//                       <input
//                         type="date"
//                         className={styles.cellInput}
//                         value={row.weekStart}
//                         onChange={(e) =>
//                           updateRow(row.id, "weekStart", e.target.value)
//                         }
//                       />
//                     </td>
//                     <td>
//                       <input
//                         type="date"
//                         className={styles.cellInput}
//                         value={row.weekEnd}
//                         onChange={(e) =>
//                           updateRow(row.id, "weekEnd", e.target.value)
//                         }
//                       />
//                     </td>
//                     <td className={styles.colCheck}>
//                       <button
//                         type="button"
//                         className={`${styles.checkBtn} ${row.chamber ? styles.checkBtnActive : ""}`}
//                         onClick={() =>
//                           updateRow(row.id, "chamber", !row.chamber)
//                         }
//                         aria-pressed={row.chamber}
//                         aria-label="Mark chamber sitting"
//                       >
//                         {row.chamber ? <ClipboardCheck size={14} /> : null}
//                       </button>
//                     </td>
//                     <td className={styles.colCheck}>
//                       <button
//                         type="button"
//                         className={`${styles.checkBtn} ${row.committee ? styles.checkBtnActive : ""}`}
//                         onClick={() =>
//                           updateRow(row.id, "committee", !row.committee)
//                         }
//                         aria-pressed={row.committee}
//                         aria-label="Mark committee sitting"
//                       >
//                         {row.committee ? <ClipboardCheck size={14} /> : null}
//                       </button>
//                     </td>
//                     <td className={styles.colAction}>
//                       <button
//                         type="button"
//                         className={styles.removeRow}
//                         onClick={() => removeRow(row.id)}
//                         aria-label="Remove row"
//                       >
//                         <X size={15} />
//                       </button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>

//           <button type="button" className={styles.addRowBtn} onClick={addRow}>
//             <Plus size={14} /> Add period
//           </button>
//         </section>

//         <aside className={styles.sideColumn}>
//           <div className={styles.panel}>
//             <div className={styles.panelHead}>
//               <div className={styles.panelHeadTitle}>
//                 <Users size={18} strokeWidth={1.8} />
//                 <span>Committee(s) Attended</span>
//               </div>
//             </div>
//             <ul className={styles.committeeList}>
//               {committees.map((c, idx) => (
//                 <li className={styles.committeeItem} key={idx}>
//                   <span className={styles.romanNum}>
//                     ({ROMAN[idx] ?? idx + 1})
//                   </span>
//                   <input
//                     className={styles.committeeInput}
//                     value={c}
//                     onChange={(e) =>
//                       setCommittees((prev) =>
//                         prev.map((v, i) => (i === idx ? e.target.value : v)),
//                       )
//                     }
//                     placeholder="Title of committee"
//                   />
//                 </li>
//               ))}
//             </ul>
//           </div>

//           <div className={styles.panel}>
//             <div className={styles.panelHead}>
//               <div className={styles.panelHeadTitle}>
//                 <Building2 size={18} strokeWidth={1.8} />
//                 <span>Summary</span>
//               </div>
//             </div>
//             <div className={styles.summaryBox}>
//               <div className={styles.summaryRow}>
//                 <span className={styles.summaryLabel}>Chamber attendance</span>
//                 <span className={styles.summaryValue}>
//                   {summary.chamberNights}
//                 </span>
//               </div>
//               <div className={styles.summaryRow}>
//                 <span className={styles.summaryLabel}>
//                   Committee attendance
//                 </span>
//                 <span className={styles.summaryValue}>
//                   {summary.committeeNights}
//                 </span>
//               </div>
//               <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
//                 <span className={styles.summaryLabel}>
//                   Total nights claimed
//                 </span>
//                 <span className={styles.summaryValue}>{summary.total}</span>
//               </div>
//             </div>
//           </div>
//         </aside>
//       </div>

//       {/* ===== CERTIFICATION ===== */}
//       <section className={styles.certBlock}>
//         <label className={styles.certLabel}>
//           <input
//             type="checkbox"
//             checked={certified}
//             onChange={(e) => setCertified(e.target.checked)}
//           />
//           <span className={styles.certCheck} aria-hidden="true">
//             <ShieldCheck size={18} strokeWidth={2} />
//           </span>
//           <span className={styles.certText}>
//             I certify that I did not travel out of the country, nor benefit from
//             government accommodation on any of the date(s) stated above.
//           </span>
//         </label>
//       </section>

//       {/* ===== OFFICIAL USE ===== */}
//       <section className={styles.officialBlock}>
//         <div className={styles.officialLabel}>For official use only</div>
//         <div className={styles.officialGrid}>
//           <div className={styles.field}>
//             <span className={styles.fieldLabel}>
//               Chamber attendance confirmed by (Director)
//             </span>
//             <input
//               className={styles.fieldInput}
//               disabled
//               placeholder="Pending review"
//             />
//           </div>
//           <div className={styles.field}>
//             <span className={styles.fieldLabel}>
//               Committee attendance confirmed by (Director)
//             </span>
//             <input
//               className={styles.fieldInput}
//               disabled
//               placeholder="Pending review"
//             />
//           </div>
//         </div>
//       </section>

//       {/* ===== ACTIONS ===== */}
//       <footer className={styles.actionBar}>
//         <button
//           type="button"
//           className={styles.btnGhost}
//           onClick={() => window.print()}
//         >
//           <Printer size={16} /> Print
//         </button>
//         <button
//           type="button"
//           className={styles.btnPrimary}
//           disabled={!certified}
//         >
//           <Send size={16} /> Submit claim
//         </button>
//       </footer>
//     </div>
//   );
// }

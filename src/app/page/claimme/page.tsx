"use client";

import { useMemo, useState } from "react";
import {
  Landmark,
  CalendarRange,
  Users,
  ClipboardCheck,
  ShieldCheck,
  PenLine,
  Plus,
  X,
  Building2,
  Printer,
  Send,
} from "lucide-react";
import styles from "./styles.module.css";

type ClaimRow = {
  id: number;
  weekStart: string;
  weekEnd: string;
  chamber: boolean;
  committee: boolean;
};

const START_ROWS = 6;

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
  const [rows, setRows] = useState<ClaimRow[]>(
    Array.from({ length: START_ROWS }, (_, i) => ({
      id: i + 1,
      weekStart: "",
      weekEnd: "",
      chamber: false,
      committee: false,
    })),
  );
  const [committees, setCommittees] = useState<string[]>(["", "", "", ""]);
  const [certified, setCertified] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [signature, setSignature] = useState("");
  const [county, setCounty] = useState("");
  const [dated, setDated] = useState("");

  function updateRow<K extends keyof ClaimRow>(
    id: number,
    key: K,
    value: ClaimRow[K],
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
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
      },
    ]);
  }

  function removeRow(id: number) {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
    );
  }

  const summary = useMemo(() => {
    let total = 0;
    let chamberNights = 0;
    let committeeNights = 0;
    for (const r of rows) {
      const n = nightsBetween(r.weekStart, r.weekEnd);
      total += n;
      if (r.chamber) chamberNights += n;
      if (r.committee) committeeNights += n;
    }
    return { total, chamberNights, committeeNights };
  }, [rows]);

  return (
    <div className={styles.page}>
      <div className={styles.sheet}>
        {/* Header */}
        <div className={styles.headerBand}>
          <div className={styles.stamp}>
            <span className={styles.stampLabel}>Serial No.</span>
            <input
              className={styles.stampInput}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="—"
            />
          </div>

          <div className={styles.crestRow}>
            <Landmark
              size={38}
              className={styles.crestIcon}
              strokeWidth={1.4}
            />
            <div>
              <div className={styles.institution}>The Senate</div>
              <div className={styles.formTitle}>
                Domestic Subsistence Facilitation
              </div>
            </div>
          </div>

          <div className={styles.claimTitle}>Claim Form</div>
          <div className={styles.subline}>
            To be completed by a Member of Parliament
          </div>
        </div>

        <div className={styles.body}>
          <p className={styles.intro}>
            Please prepare my domestic subsistence facilitation for the night(s)
            indicated hereunder which I spent in Nairobi attending to
            parliamentary business.
          </p>

          {/* Claim month */}
          <div className={styles.section}>
            <div className={styles.monthRow}>
              <label htmlFor="claimMonth">Claim for the month of</label>
              <input
                id="claimMonth"
                className={styles.monthInput}
                value={claimMonth}
                onChange={(e) => setClaimMonth(e.target.value)}
                placeholder="e.g. July 2024"
              />
            </div>
          </div>

          {/* Period table */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <CalendarRange size={18} strokeWidth={1.6} />
              Period Claimed — Night(s) Spent in Nairobi
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.rowNum}>No.</th>
                    <th>Week Starting</th>
                    <th>Week Ending</th>
                    <th className={styles.checkCell}>Chamber</th>
                    <th className={styles.checkCell}>Committee</th>
                    <th className={styles.rowActions}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id}>
                      <td className={styles.rowNum}>{i + 1}</td>
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
                      <td className={styles.checkCell}>
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
                      <td className={styles.checkCell}>
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
                      <td className={styles.rowActions}>
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
                  ))}
                </tbody>
              </table>
            </div>

            <button type="button" className={styles.addRowBtn} onClick={addRow}>
              <Plus size={14} /> Add period
            </button>
          </div>

          {/* Committees + Summary */}
          <div className={`${styles.section} ${styles.grid2}`}>
            <div>
              <div className={styles.sectionHead}>
                <Users size={18} strokeWidth={1.6} />
                Committee(s) Attended
              </div>
              <ul className={styles.committeeList}>
                {committees.map((c, idx) => (
                  <li className={styles.committeeItem} key={idx}>
                    <span className={styles.romanNum}>
                      ({["i", "ii", "iii", "iv"][idx] ?? idx + 1})
                    </span>
                    <input
                      className={styles.committeeInput}
                      value={c}
                      onChange={(e) =>
                        setCommittees((prev) =>
                          prev.map((v, i) => (i === idx ? e.target.value : v)),
                        )
                      }
                      placeholder="Title of committee"
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className={styles.sectionHead}>
                <Building2 size={18} strokeWidth={1.6} />
                Summary
              </div>
              <div className={styles.summaryBox}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>
                    Nights — Chamber attendance
                  </span>
                  <span className={styles.summaryValue}>
                    {summary.chamberNights}
                  </span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>
                    Nights — Committee attendance
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
            </div>
          </div>

          {/* Certification */}
          <div className={styles.section}>
            <label className={styles.certBlock}>
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                <ShieldCheck
                  size={16}
                  style={{
                    display: "inline",
                    marginRight: 6,
                    verticalAlign: "-3px",
                  }}
                />
                I certify that I did not travel out of the country, nor benefit
                from government accommodation on any of the date(s) stated
                above.
              </span>
            </label>
          </div>

          {/* Member details / signature */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <PenLine size={18} strokeWidth={1.6} />
              Member Declaration
            </div>
            <div className={styles.signGrid}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>FULL NAME OF MEMBER</span>
                <input
                  className={styles.fieldInput}
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Sen. Jane Doe"
                />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>COUNTY / NOMINATED</span>
                <input
                  className={styles.fieldInput}
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  placeholder="e.g. Nairobi County"
                />
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>SIGNATURE</span>
                <div className={styles.signaturePad}>
                  <input
                    className={styles.signatureText}
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Type full name to sign"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>DATED</span>
                <input
                  type="date"
                  className={styles.fieldInput}
                  value={dated}
                  onChange={(e) => setDated(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Official use only */}
          <div className={styles.section}>
            <div className={styles.officialSection}>
              <div className={styles.officialLabel}>FOR OFFICIAL USE ONLY</div>
              <div className={styles.signGrid}>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>
                    CHAMBER ATTENDANCE CONFIRMED BY (DIRECTOR)
                  </span>
                  <input
                    className={styles.fieldInput}
                    disabled
                    placeholder="Pending review"
                  />
                </div>
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>
                    COMMITTEE ATTENDANCE CONFIRMED BY (DIRECTOR)
                  </span>
                  <input
                    className={styles.fieldInput}
                    disabled
                    placeholder="Pending review"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
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
        </div>
      </div>
    </div>
  );
}

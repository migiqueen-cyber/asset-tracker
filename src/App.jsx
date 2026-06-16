import { useState, useMemo, useEffect, useRef } from "react";

const STORAGE_KEY = "asset-tracker-v2";

// ── localStorage ──────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ── 포맷 ──────────────────────────────────────────────────
function formatKRW(n) {
  if (!n && n !== 0) return "—";
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4)}만`;
  return `${n.toLocaleString()}원`;
}

// ── 금액 입력 컴포넌트 ────────────────────────────────────
function AmountInput({ value, onChange, placeholder = "금액 입력 (원)", style = {} }) {
  const [raw, setRaw] = useState(value ? value.toLocaleString() : "");
  useEffect(() => { if (value === 0) setRaw(""); }, [value]);
  const handleChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/g, "");
    setRaw(v ? Number(v).toLocaleString() : "");
    onChange(Number(v) || 0);
  };
  return (
    <input type="text" inputMode="numeric" value={raw} onChange={handleChange}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "8px 12px", borderRadius: 8,
        border: "1px solid #374151", background: "#111827",
        color: "#F9FAFB", fontSize: 14, outline: "none", boxSizing: "border-box", ...style
      }} />
  );
}

// ── 게이지 바 ─────────────────────────────────────────────
function GaugeBar({ current, target, color }) {
  const diff = current - target;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>0%</span>
        <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>목표 {target}%</span>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>100%</span>
      </div>
      <div style={{ position: "relative", height: 10, background: "#1F2937", borderRadius: 999 }}>
        <div style={{ position: "absolute", left: `${target}%`, top: -2, width: 2, height: 14, background: "#F59E0B", borderRadius: 1, zIndex: 2 }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: `${Math.min(current, 100)}%`, height: "100%", background: diff > 0 ? "#EF4444" : color, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: diff > 0 ? "#F87171" : "#34D399", textAlign: "right" }}>
        {diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : "목표 달성 ✓"}
      </div>
    </div>
  );
}

// ── 인라인 편집 가능 텍스트 ───────────────────────────────
function EditableLabel({ value, onChange, style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef();
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const commit = () => { onChange(draft || value); setEditing(false); };
  if (editing) return (
    <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
      style={{ fontWeight: 700, fontSize: 15, background: "none", border: "none", borderBottom: "1px solid #F59E0B", color: "#F9FAFB", outline: "none", width: 120, ...style }} />
  );
  return (
    <span onClick={() => { setDraft(value); setEditing(true); }}
      style={{ fontWeight: 700, fontSize: 15, cursor: "text", borderBottom: "1px dashed #4B5563", ...style }}
      title="클릭해서 이름 변경">
      {value}
    </span>
  );
}

// ── 기본값 ────────────────────────────────────────────────
const DEFAULT_STATE = {
  nameA: "주식A", nameB: "주식B",
  stockA: 0, stockB: 0,
  deposit: 0, withdraw: 0,
  surplusItems: [], // [{ id, name, amount, type: "주식"|"비주식" }]
};

function genId() { return Math.random().toString(36).slice(2, 8); }

// ── 메인 앱 ───────────────────────────────────────────────
export default function App() {
  const saved = loadState();
  const init = { ...DEFAULT_STATE, ...saved };

  const [nameA, setNameA] = useState(init.nameA);
  const [nameB, setNameB] = useState(init.nameB);
  const [stockA, setStockA] = useState(init.stockA ?? 0);
  const [stockB, setStockB] = useState(init.stockB ?? 0);
  const [deposit, setDeposit] = useState(init.deposit ?? 0);
  const [withdraw, setWithdraw] = useState(init.withdraw ?? 0);
  const [surplusItems, setSurplusItems] = useState(init.surplusItems ?? []);
  const [tab, setTab] = useState("현황");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // auto-save
  useEffect(() => {
    saveState({ nameA, nameB, stockA, stockB, deposit, withdraw, surplusItems });
  }, [nameA, nameB, stockA, stockB, deposit, withdraw, surplusItems]);

  // 계산
  const totalSurplus = surplusItems.reduce((a, i) => a + (i.amount || 0), 0);
  const total = stockA + stockB + totalSurplus + deposit - withdraw;

  const currentPct = total > 0
    ? { A: stockA / total * 100, B: stockB / total * 100, 잉여: totalSurplus / total * 100 }
    : { A: 0, B: 0, 잉여: 0 };

  const rebalance = useMemo(() => {
    if (total <= 0) return null;
    return { A: total * 0.4 - stockA, B: total * 0.4 - stockB, 잉여: total * 0.2 - totalSurplus };
  }, [total, stockA, stockB, totalSurplus]);

  // 잉여자금 주식/비주식
  const surplusStockAmt = surplusItems.filter(i => i.type === "주식").reduce((a, i) => a + i.amount, 0);
  const surplusNonStockAmt = surplusItems.filter(i => i.type === "비주식").reduce((a, i) => a + i.amount, 0);
  const surplusStockPct = totalSurplus > 0 ? surplusStockAmt / totalSurplus * 100 : 0;
  const surplusNonStockPct = totalSurplus > 0 ? surplusNonStockAmt / totalSurplus * 100 : 0;

  // 잉여 항목 CRUD
  const addItem = () => setSurplusItems(prev => [...prev, { id: genId(), name: "", amount: 0, type: "비주식" }]);
  const removeItem = (id) => setSurplusItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id, patch) => setSurplusItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  // 초기화
  const handleReset = () => {
    setNameA("주식A"); setNameB("주식B");
    setStockA(0); setStockB(0);
    setDeposit(0); setWithdraw(0);
    setSurplusItems([]);
    localStorage.removeItem(STORAGE_KEY);
    setShowResetConfirm(false);
  };

  const TABS = ["현황", "잉여자금", "리밸런싱"];
  const COLORS = { A: "#3B82F6", B: "#8B5CF6", 잉여: "#10B981" };

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A", color: "#F9FAFB", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", paddingBottom: 60 }}>

      {/* ── 헤더 ── */}
      <div style={{ background: "#0F1629", borderBottom: "1px solid #1F2937", padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: 2, marginBottom: 4 }}>PORTFOLIO</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>자산 배분 트래커</div>
          </div>
          <button onClick={() => setShowResetConfirm(true)} style={{ marginTop: 4, padding: "6px 12px", borderRadius: 8, fontSize: 12, background: "none", border: "1px solid #374151", color: "#6B7280", cursor: "pointer" }}>초기화</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: "#9CA3AF" }}>
          총 자산&nbsp;<span style={{ color: "#F59E0B", fontWeight: 700, fontSize: 16 }}>{total > 0 ? formatKRW(total) : "—"}</span>
          {total > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: "#4B5563" }}>● 자동 저장됨</span>}
        </div>
        {/* 입출금 요약 */}
        {(deposit > 0 || withdraw > 0) && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#6B7280" }}>
            입금 <span style={{ color: "#34D399" }}>+{formatKRW(deposit)}</span>
            &nbsp;·&nbsp;출금 <span style={{ color: "#F87171" }}>-{formatKRW(withdraw)}</span>
          </div>
        )}
      </div>

      {/* ── 초기화 모달 ── */}
      {showResetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#111827", borderRadius: 16, padding: 24, border: "1px solid #374151", maxWidth: 300, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>데이터 초기화</div>
            <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>입력한 모든 데이터가 삭제됩니다.<br />계속하시겠어요?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14, background: "#1F2937", border: "1px solid #374151", color: "#9CA3AF", cursor: "pointer" }}>취소</button>
              <button onClick={handleReset} style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14, background: "#EF4444", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}>초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 탭 ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1F2937", background: "#0F1629" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "12px 0", fontSize: 13, fontWeight: tab === t ? 700 : 400, color: tab === t ? "#F59E0B" : "#6B7280", background: "none", border: "none", cursor: "pointer", borderBottom: tab === t ? "2px solid #F59E0B" : "2px solid transparent" }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: "20px 16px" }}>

        {/* ════════ 현황 탭 ════════ */}
        {tab === "현황" && (
          <div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>목표: {nameA} 40% · {nameB} 40% · 잉여자금 20%</div>

            {/* 주식A */}
            {[{ key: "A", name: nameA, setName: setNameA, val: stockA, setVal: setStockA, color: COLORS.A, emoji: "📈", pct: currentPct.A },
              { key: "B", name: nameB, setName: setNameB, val: stockB, setVal: setStockB, color: COLORS.B, emoji: "📊", pct: currentPct.B }
            ].map(({ key, name, setName, val, setVal, color, emoji, pct }) => (
              <div key={key} style={{ background: "#111827", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid #1F2937" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{emoji}</span>
                    <EditableLabel value={name} onChange={setName} />
                    <span style={{ fontSize: 11, color: "#4B5563" }}>✏️</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color, fontWeight: 700, fontSize: 15 }}>{pct.toFixed(1)}%</div>
                    <div style={{ color: "#6B7280", fontSize: 11 }}>{formatKRW(val)}</div>
                  </div>
                </div>
                <GaugeBar current={pct} target={40} color={color} />
                <div style={{ marginTop: 10 }}>
                  <AmountInput value={val} onChange={setVal} placeholder={`${name} 평가금액 입력`} />
                </div>
              </div>
            ))}

            {/* 잉여자금 */}
            <div style={{ background: "#111827", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid #1F2937" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>💰</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>잉여자금</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: COLORS.잉여, fontWeight: 700, fontSize: 15 }}>{currentPct.잉여.toFixed(1)}%</div>
                  <div style={{ color: "#6B7280", fontSize: 11 }}>{formatKRW(totalSurplus)}</div>
                </div>
              </div>
              <GaugeBar current={currentPct.잉여} target={20} color={COLORS.잉여} />
              <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>잉여자금 세부 입력은 '잉여자금' 탭에서</div>
            </div>

            {/* 입금 / 출금 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[{ label: "입금", emoji: "📥", val: deposit, setVal: setDeposit, color: "#34D399" },
                { label: "출금", emoji: "📤", val: withdraw, setVal: setWithdraw, color: "#F87171" }
              ].map(({ label, emoji, val, setVal, color }) => (
                <div key={label} style={{ background: "#111827", borderRadius: 12, padding: 14, border: "1px solid #1F2937" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span>{emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 8 }}>{val > 0 ? formatKRW(val) : "—"}</div>
                  <AmountInput value={val} onChange={setVal} placeholder={`${label} 금액`} />
                </div>
              ))}
            </div>

            {/* 구성 비율 바 */}
            {total > 0 && (
              <div style={{ background: "#111827", borderRadius: 12, padding: 16, border: "1px solid #1F2937" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>구성 비율</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  {[{ label: nameA, pct: currentPct.A, color: COLORS.A }, { label: nameB, pct: currentPct.B, color: COLORS.B }, { label: "잉여자금", pct: currentPct.잉여, color: COLORS.잉여 }].map(({ label, pct, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                      <span style={{ color: "#9CA3AF" }}>{label}</span>
                      <span style={{ color: "#F9FAFB", fontWeight: 600 }}>{pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 24, borderRadius: 6, display: "flex", overflow: "hidden" }}>
                  <div style={{ width: `${currentPct.A}%`, background: COLORS.A, transition: "width 0.4s ease" }} />
                  <div style={{ width: `${currentPct.B}%`, background: COLORS.B, transition: "width 0.4s ease" }} />
                  <div style={{ width: `${currentPct.잉여}%`, background: COLORS.잉여, transition: "width 0.4s ease" }} />
                </div>
                {/* 총자산 계산식 */}
                <div style={{ marginTop: 12, fontSize: 11, color: "#4B5563", lineHeight: 1.8 }}>
                  총자산 = {nameA}({formatKRW(stockA)}) + {nameB}({formatKRW(stockB)}) + 잉여자금({formatKRW(totalSurplus)}) + 입금({formatKRW(deposit)}) - 출금({formatKRW(withdraw)})
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ 잉여자금 탭 ════════ */}
        {tab === "잉여자금" && (
          <div>
            {/* 요약 */}
            <div style={{ background: "#111827", borderRadius: 12, padding: "14px 16px", marginBottom: 14, border: "1px solid #1F2937" }}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                잉여자금 합계&nbsp;<span style={{ color: "#10B981", fontWeight: 700 }}>{formatKRW(totalSurplus)}</span>
                &nbsp;·&nbsp;전체 자산의&nbsp;
                <span style={{ color: currentPct.잉여 > 20 ? "#EF4444" : "#10B981", fontWeight: 700 }}>{currentPct.잉여.toFixed(1)}%</span>
              </div>
              {totalSurplus > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    {[{ label: "주식", pct: surplusStockPct, amt: surplusStockAmt, color: "#60A5FA" },
                      { label: "비주식", pct: surplusNonStockPct, amt: surplusNonStockAmt, color: "#FCD34D" }
                    ].map(({ label, pct, amt, color }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                        <span style={{ color: "#9CA3AF" }}>{label}</span>
                        <span style={{ color, fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                        <span style={{ color: "#6B7280", fontSize: 11 }}>({formatKRW(amt)})</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 8, borderRadius: 999, display: "flex", overflow: "hidden", background: "#1F2937" }}>
                    <div style={{ width: `${surplusStockPct}%`, background: "#60A5FA", transition: "width 0.4s ease" }} />
                    <div style={{ width: `${surplusNonStockPct}%`, background: "#FCD34D", transition: "width 0.4s ease" }} />
                  </div>
                </>
              )}
            </div>

            {/* 비주식 섹션 */}
            {["비주식", "주식"].map(type => {
              const filtered = surplusItems.filter(i => i.type === type);
              if (filtered.length === 0 && type === "주식") return null;
              return (
                <div key={type}>
                  <div style={{ fontSize: 11, color: type === "주식" ? "#60A5FA" : "#FCD34D", fontWeight: 700, letterSpacing: 1, margin: type === "주식" ? "16px 0 8px 4px" : "0 0 8px 4px" }}>
                    {type === "주식" ? "📈 주식" : "💵 비주식 (예·적금)"}
                  </div>
                  {filtered.map(item => {
                    const pct = totalSurplus > 0 ? item.amount / totalSurplus * 100 : 0;
                    const barColor = type === "주식" ? "#60A5FA" : "#FCD34D";
                    return (
                      <div key={item.id} style={{ background: "#111827", borderRadius: 12, padding: "14px 16px", marginBottom: 8, border: "1px solid #1F2937" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                          <input value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })}
                            placeholder="항목명 입력"
                            style={{ fontWeight: 600, fontSize: 14, background: "none", border: "none", borderBottom: "1px solid #374151", color: "#F9FAFB", outline: "none", flex: 1, minWidth: 0 }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <select value={item.type} onChange={e => updateItem(item.id, { type: e.target.value })}
                              style={{ background: "#1F2937", border: "1px solid #374151", color: "#9CA3AF", borderRadius: 6, padding: "2px 6px", fontSize: 12, cursor: "pointer" }}>
                              <option value="비주식">비주식</option>
                              <option value="주식">주식</option>
                            </select>
                            <span style={{ color: barColor, fontWeight: 700, fontSize: 13 }}>{pct.toFixed(1)}%</span>
                            <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>✕</button>
                          </div>
                        </div>
                        <div style={{ height: 6, background: "#1F2937", borderRadius: 999, marginBottom: 8 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 999, transition: "width 0.4s ease" }} />
                        </div>
                        <AmountInput value={item.amount} onChange={v => updateItem(item.id, { amount: v })} placeholder="금액 입력" />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* 분류 없는 항목 (새로 추가한 직후) */}
            {surplusItems.filter(i => !["주식","비주식"].includes(i.type)).map(item => (
              <div key={item.id}>{item.name}</div>
            ))}

            {/* 항목 추가 버튼 */}
            <button onClick={addItem} style={{ width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 12, border: "1px dashed #374151", background: "none", color: "#6B7280", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>＋</span> 항목 추가
            </button>
          </div>
        )}

        {/* ════════ 리밸런싱 탭 ════════ */}
        {tab === "리밸런싱" && (
          <div>
            {total <= 0 ? (
              <div style={{ textAlign: "center", color: "#6B7280", marginTop: 60, fontSize: 14 }}>먼저 '현황' 탭에서 자산 금액을 입력해주세요.</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
                  총 자산 <span style={{ color: "#F59E0B", fontWeight: 700 }}>{formatKRW(total)}</span> 기준 리밸런싱
                </div>
                {[
                  { key: "A", label: nameA, emoji: "📈", color: COLORS.A, pct: currentPct.A, target: 40, delta: rebalance.A },
                  { key: "B", label: nameB, emoji: "📊", color: COLORS.B, pct: currentPct.B, target: 40, delta: rebalance.B },
                  { key: "잉여", label: "잉여자금", emoji: "💰", color: COLORS.잉여, pct: currentPct.잉여, target: 20, delta: rebalance.잉여 },
                ].map(({ key, label, emoji, color, pct, target, delta }) => {
                  const isBuy = delta > 0, isOk = Math.abs(delta) < 1000;
                  return (
                    <div key={key} style={{ background: "#111827", borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${isOk ? "#374151" : isBuy ? "#1D4ED8" : "#7F1D1D"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 16 }}>{emoji}</span>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>현재 {pct.toFixed(1)}% → 목표 {target}%</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {isOk ? (
                            <div style={{ color: "#34D399", fontWeight: 700, fontSize: 14 }}>✓ 균형</div>
                          ) : (
                            <>
                              <div style={{ color: isBuy ? "#60A5FA" : "#F87171", fontWeight: 700, fontSize: 18 }}>{isBuy ? "▲ 매수" : "▼ 매도"}</div>
                              <div style={{ color: "#F9FAFB", fontWeight: 700, fontSize: 15 }}>{formatKRW(Math.abs(delta))}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 8, background: "#0F1629", borderRadius: 12, padding: 16, border: "1px solid #1F2937", fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>
                  💡 리밸런싱 후 목표: {nameA} {formatKRW(total * 0.4)} / {nameB} {formatKRW(total * 0.4)} / 잉여자금 {formatKRW(total * 0.2)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

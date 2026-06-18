import { useState, useMemo, useEffect, useRef } from "react";

const STORAGE_KEY = "asset-tracker-v3";

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

// ── 유틸 ─────────────────────────────────────────────────
function formatKRW(n) {
  if (!n && n !== 0) return "—";
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}억`;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e4)}만`;
  return `${n.toLocaleString()}원`;
}
function genId() { return Math.random().toString(36).slice(2, 9); }

const ASSET_COLORS = [
  "#3B82F6","#8B5CF6","#10B981","#F59E0B","#EF4444",
  "#06B6D4","#EC4899","#84CC16","#F97316","#6366F1",
];

// ── 컴포넌트: 금액 입력 ───────────────────────────────────
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
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #374151", background: "#0B0F1A", color: "#F9FAFB", fontSize: 14, outline: "none", boxSizing: "border-box", ...style }} />
  );
}

// ── 컴포넌트: 게이지 바 ───────────────────────────────────
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
        <div style={{ position: "absolute", left: `${Math.min(target,100)}%`, top: -2, width: 2, height: 14, background: "#F59E0B", borderRadius: 1, zIndex: 2 }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: `${Math.min(current, 100)}%`, height: "100%", background: diff > 0 ? "#EF4444" : color, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: diff > 0 ? "#F87171" : diff < 0 ? "#34D399" : "#34D399", textAlign: "right" }}>
        {diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : "목표 달성 ✓"}
      </div>
    </div>
  );
}

// ── 기본 자산 ─────────────────────────────────────────────
const DEFAULT_ASSETS = [
  { id: genId(), name: "주식A", target: 40, amount: 0 },
  { id: genId(), name: "주식B", target: 40, amount: 0 },
  { id: genId(), name: "잉여자금", target: 20, amount: 0 },
];

const DEFAULT_SURPLUS = [];

// ── 메인 앱 ───────────────────────────────────────────────
export default function App() {
  const saved = loadState();

  const [assets, setAssets] = useState(saved?.assets ?? DEFAULT_ASSETS);
  const [deposit, setDeposit] = useState(saved?.deposit ?? 0);
  const [withdraw, setWithdraw] = useState(saved?.withdraw ?? 0);
  const [surplusItems, setSurplusItems] = useState(saved?.surplusItems ?? DEFAULT_SURPLUS);
  const [tab, setTab] = useState("현황");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // auto-save
  useEffect(() => {
    saveState({ assets, deposit, withdraw, surplusItems });
  }, [assets, deposit, withdraw, surplusItems]);

  // 계산
  const totalAmount = assets.reduce((a, i) => a + (i.amount || 0), 0);
  const total = totalAmount + deposit - withdraw;
  const totalTarget = assets.reduce((a, i) => a + (Number(i.target) || 0), 0);
  const targetOk = Math.abs(totalTarget - 100) < 0.01;

  const currentPcts = useMemo(() =>
    assets.map(a => total > 0 ? (a.amount / total * 100) : 0),
    [assets, total]
  );

  const rebalanceDeltas = useMemo(() =>
    assets.map((a, i) => total > 0 ? (total * (Number(a.target) || 0) / 100) - a.amount : 0),
    [assets, total]
  );

  // 잉여자금 주식/비주식
  const totalSurplus = surplusItems.reduce((a, i) => a + (i.amount || 0), 0);
  const surplusStockAmt = surplusItems.filter(i => i.type === "주식").reduce((a, i) => a + i.amount, 0);
  const surplusNonStockAmt = surplusItems.filter(i => i.type === "비주식").reduce((a, i) => a + i.amount, 0);
  const surplusStockPct = totalSurplus > 0 ? surplusStockAmt / totalSurplus * 100 : 0;
  const surplusNonStockPct = totalSurplus > 0 ? surplusNonStockAmt / totalSurplus * 100 : 0;

  // 자산 CRUD
  const addAsset = () => setAssets(prev => [...prev, { id: genId(), name: "", target: 0, amount: 0 }]);
  const removeAsset = (id) => setAssets(prev => prev.filter(a => a.id !== id));
  const updateAsset = (id, patch) => setAssets(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));

  // 잉여 항목 CRUD
  const addSurplusItem = () => setSurplusItems(prev => [...prev, { id: genId(), name: "", amount: 0, type: "비주식" }]);
  const removeSurplusItem = (id) => setSurplusItems(prev => prev.filter(i => i.id !== id));
  const updateSurplusItem = (id, patch) => setSurplusItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  // 초기화
  const handleReset = () => {
    setAssets(DEFAULT_ASSETS.map(a => ({ ...a, id: genId() })));
    setDeposit(0); setWithdraw(0); setSurplusItems([]);
    localStorage.removeItem(STORAGE_KEY);
    setShowResetConfirm(false);
  };

  const TABS = ["현황", "잉여자금", "리밸런싱"];

  const inputStyle = {
    background: "#0B0F1A", border: "1px solid #374151", color: "#F9FAFB",
    borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box",
  };

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
        {(deposit > 0 || withdraw > 0) && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>
            입금 <span style={{ color: "#34D399" }}>+{formatKRW(deposit)}</span>&nbsp;·&nbsp;출금 <span style={{ color: "#F87171" }}>-{formatKRW(withdraw)}</span>
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
            {/* 목표 비중 합계 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>목표 비중 합계</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: targetOk ? "#34D399" : "#F87171" }}>
                {totalTarget.toFixed(1)}% {targetOk ? "✓" : "⚠️ 100%가 아님"}
              </span>
            </div>

            {/* 자산 카드 목록 */}
            {assets.map((asset, idx) => {
              const color = ASSET_COLORS[idx % ASSET_COLORS.length];
              const pct = currentPcts[idx];
              return (
                <div key={asset.id} style={{ background: "#111827", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid #1F2937" }}>
                  {/* 자산명 + 목표 비중 + 삭제 */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <input
                      value={asset.name}
                      onChange={e => updateAsset(asset.id, { name: e.target.value })}
                      placeholder="자산명 입력"
                      style={{ ...inputStyle, flex: 1, minWidth: 0, fontWeight: 700 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <input
                        type="number" min="0" max="100" step="0.1"
                        value={asset.target}
                        onChange={e => updateAsset(asset.id, { target: Number(e.target.value) })}
                        style={{ ...inputStyle, width: 60, textAlign: "center" }}
                      />
                      <span style={{ fontSize: 13, color: "#6B7280" }}>%</span>
                    </div>
                    <button onClick={() => removeAsset(asset.id)} style={{ background: "none", border: "none", color: "#4B5563", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>✕</button>
                  </div>

                  {/* 현재 비중 + 금액 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#6B7280" }}>현재 비중</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color, fontWeight: 700, fontSize: 15 }}>{pct.toFixed(1)}%</span>
                      <span style={{ color: "#6B7280", fontSize: 11, marginLeft: 8 }}>{formatKRW(asset.amount)}</span>
                    </div>
                  </div>

                  {/* 게이지 */}
                  {asset.target > 0 && <GaugeBar current={pct} target={Number(asset.target)} color={color} />}

                  {/* 금액 입력 */}
                  <div style={{ marginTop: 10 }}>
                    <AmountInput value={asset.amount} onChange={v => updateAsset(asset.id, { amount: v })} placeholder="현재 금액 입력 (원)" />
                  </div>
                </div>
              );
            })}

            {/* 자산 추가 버튼 */}
            <button onClick={addAsset} style={{ width: "100%", marginBottom: 16, padding: "12px 0", borderRadius: 12, border: "1px dashed #374151", background: "none", color: "#6B7280", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>＋</span> 자산 추가
            </button>

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
            {total > 0 && assets.length > 0 && (
              <div style={{ background: "#111827", borderRadius: 12, padding: 16, border: "1px solid #1F2937" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>구성 비율</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  {assets.map((a, idx) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: ASSET_COLORS[idx % ASSET_COLORS.length] }} />
                      <span style={{ color: "#9CA3AF" }}>{a.name || `자산${idx+1}`}</span>
                      <span style={{ color: "#F9FAFB", fontWeight: 600 }}>{currentPcts[idx].toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 24, borderRadius: 6, display: "flex", overflow: "hidden", background: "#1F2937" }}>
                  {assets.map((a, idx) => (
                    <div key={a.id} style={{ width: `${currentPcts[idx]}%`, background: ASSET_COLORS[idx % ASSET_COLORS.length], transition: "width 0.4s ease" }} />
                  ))}
                </div>
                {/* 총자산 계산식 */}
                <div style={{ marginTop: 10, fontSize: 11, color: "#4B5563", lineHeight: 2 }}>
                  총자산 = {assets.map(a => `${a.name || "?"}(${formatKRW(a.amount)})`).join(" + ")}
                  {deposit > 0 && ` + 입금(${formatKRW(deposit)})`}
                  {withdraw > 0 && ` - 출금(${formatKRW(withdraw)})`}
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

            {/* 비주식 / 주식 섹션 */}
            {["비주식", "주식"].map(type => {
              const filtered = surplusItems.filter(i => i.type === type);
              if (filtered.length === 0) return (
                <div key={type} style={{ fontSize: 11, color: type === "주식" ? "#60A5FA" : "#FCD34D", fontWeight: 700, letterSpacing: 1, margin: type === "주식" ? "16px 0 8px 4px" : "0 0 8px 4px" }}>
                  {type === "주식" ? "📈 주식" : "💵 비주식 (예·적금)"}
                </div>
              );
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
                          <input value={item.name} onChange={e => updateSurplusItem(item.id, { name: e.target.value })}
                            placeholder="항목명 입력"
                            style={{ fontWeight: 600, fontSize: 14, background: "none", border: "none", borderBottom: "1px solid #374151", color: "#F9FAFB", outline: "none", flex: 1, minWidth: 0 }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <select value={item.type} onChange={e => updateSurplusItem(item.id, { type: e.target.value })}
                              style={{ background: "#1F2937", border: "1px solid #374151", color: "#9CA3AF", borderRadius: 6, padding: "2px 6px", fontSize: 12, cursor: "pointer" }}>
                              <option value="비주식">비주식</option>
                              <option value="주식">주식</option>
                            </select>
                            <span style={{ color: barColor, fontWeight: 700, fontSize: 13 }}>{pct.toFixed(1)}%</span>
                            <button onClick={() => removeSurplusItem(item.id)} style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>✕</button>
                          </div>
                        </div>
                        <div style={{ height: 6, background: "#1F2937", borderRadius: 999, marginBottom: 8 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 999, transition: "width 0.4s ease" }} />
                        </div>
                        <AmountInput value={item.amount} onChange={v => updateSurplusItem(item.id, { amount: v })} placeholder="금액 입력" />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <button onClick={addSurplusItem} style={{ width: "100%", marginTop: 8, padding: "12px 0", borderRadius: 12, border: "1px dashed #374151", background: "none", color: "#6B7280", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>＋</span> 항목 추가
            </button>
          </div>
        )}

        {/* ════════ 리밸런싱 탭 ════════ */}
        {tab === "리밸런싱" && (
          <div>
            {total <= 0 ? (
              <div style={{ textAlign: "center", color: "#6B7280", marginTop: 60, fontSize: 14 }}>먼저 '현황' 탭에서 자산 금액을 입력해주세요.</div>
            ) : !targetOk ? (
              <div style={{ textAlign: "center", color: "#F87171", marginTop: 60, fontSize: 14 }}>
                ⚠️ 목표 비중 합계가 {totalTarget.toFixed(1)}%입니다.<br />
                <span style={{ fontSize: 12, color: "#6B7280" }}>현황 탭에서 합계를 100%로 맞춰주세요.</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
                  총 자산 <span style={{ color: "#F59E0B", fontWeight: 700 }}>{formatKRW(total)}</span> 기준 리밸런싱
                </div>
                {assets.map((asset, idx) => {
                  const color = ASSET_COLORS[idx % ASSET_COLORS.length];
                  const delta = rebalanceDeltas[idx];
                  const pct = currentPcts[idx];
                  const isBuy = delta > 0;
                  const isOk = Math.abs(delta) < 1000;
                  return (
                    <div key={asset.id} style={{ background: "#111827", borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${isOk ? "#374151" : isBuy ? "#1D4ED8" : "#7F1D1D"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{asset.name || `자산${idx+1}`}</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>현재 {pct.toFixed(1)}% → 목표 {asset.target}%</div>
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
                <div style={{ marginTop: 8, background: "#0F1629", borderRadius: 12, padding: 16, border: "1px solid #1F2937", fontSize: 12, color: "#6B7280", lineHeight: 2 }}>
                  💡 리밸런싱 후 목표{assets.map(a => ` · ${a.name || "?"} ${formatKRW(total * (Number(a.target)||0) / 100)}`)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

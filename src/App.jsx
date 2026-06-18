import { useState, useMemo, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "asset-tracker-v4";
const SURPLUS_ASSET_ID = "__surplus__";

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

// ── 기본 자산 (잉여자금은 고정 ID) ───────────────────────
function makeDefaultAssets() {
  return [
    { id: genId(), name: "주식A", target: 40, amount: 0, isSurplus: false },
    { id: genId(), name: "주식B", target: 40, amount: 0, isSurplus: false },
    { id: SURPLUS_ASSET_ID, name: "잉여자금", target: 20, amount: 0, isSurplus: true },
  ];
}

// ── 인라인 편집 가능 셀 (자산명 / 목표비중) ──────────────
function InlineInput({ value, onChange, onBlur, inputMode = "text", style = {}, placeholder = "" }) {
  const ref = useRef();
  return (
    <input
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={e => { if (e.key === "Enter") ref.current?.blur(); }}
      inputMode={inputMode}
      placeholder={placeholder}
      style={{
        background: "none", border: "none", borderBottom: "1px solid #374151",
        color: "#F9FAFB", outline: "none", fontSize: 14, fontWeight: 700,
        WebkitAppearance: "none", padding: "4px 2px",
        ...style,
      }}
    />
  );
}

// ── 금액 입력 (콤마 포맷, 모바일 숫자 키패드) ─────────────
function AmountInput({ value, onChange, placeholder = "금액 입력", style = {}, readOnly = false }) {
  const [raw, setRaw] = useState(value ? value.toLocaleString() : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setRaw(value ? value.toLocaleString() : "");
  }, [value, focused]);

  if (readOnly) {
    return (
      <div style={{
        width: "100%", padding: "10px 12px", borderRadius: 10,
        background: "#0B0F1A", border: "1px solid #1F2937",
        color: "#6B7280", fontSize: 14, boxSizing: "border-box",
        ...style,
      }}>
        {value > 0 ? formatKRW(value) : <span style={{ color: "#374151" }}>자동 계산됨</span>}
      </div>
    );
  }

  return (
    <input
      type="text" inputMode="numeric"
      value={raw}
      onChange={e => {
        const v = e.target.value.replace(/[^0-9]/g, "");
        setRaw(v ? Number(v).toLocaleString() : "");
        onChange(Number(v) || 0);
      }}
      onFocus={() => { setFocused(true); setRaw(value ? String(value) : ""); }}
      onBlur={() => { setFocused(false); setRaw(value ? value.toLocaleString() : ""); }}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "10px 12px", borderRadius: 10,
        border: "1px solid #374151", background: "#0B0F1A",
        color: "#F9FAFB", fontSize: 14, outline: "none",
        boxSizing: "border-box", WebkitAppearance: "none",
        ...style,
      }}
    />
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
        <div style={{ position: "absolute", left: `${Math.min(target, 100)}%`, top: -2, width: 2, height: 14, background: "#F59E0B", borderRadius: 1, zIndex: 2 }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: `${Math.min(current, 100)}%`, height: "100%", background: diff > 0 ? "#EF4444" : color, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: diff > 0 ? "#F87171" : "#34D399", textAlign: "right" }}>
        {diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : "목표 달성 ✓"}
      </div>
    </div>
  );
}

// ── 메인 앱 ───────────────────────────────────────────────
export default function App() {
  const saved = loadState();

  const [assets, setAssets] = useState(() => {
    if (saved?.assets) return saved.assets;
    return makeDefaultAssets();
  });
  const [deposit, setDeposit] = useState(saved?.deposit ?? 0);
  const [withdraw, setWithdraw] = useState(saved?.withdraw ?? 0);
  const [surplusItems, setSurplusItems] = useState(saved?.surplusItems ?? []);
  const [tab, setTab] = useState("현황");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 잉여자금 합계 자동 계산
  const totalSurplus = surplusItems.reduce((a, i) => a + (i.amount || 0), 0);

  // 잉여자금 asset의 amount를 항상 totalSurplus와 동기화
  const assetsWithSurplus = useMemo(() =>
    assets.map(a => a.isSurplus ? { ...a, amount: totalSurplus } : a),
    [assets, totalSurplus]
  );

  // 총자산
  const totalAmount = assetsWithSurplus.reduce((a, i) => a + (i.amount || 0), 0);
  const total = totalAmount + deposit - withdraw;
  const totalTarget = assets.reduce((a, i) => a + (Number(i.target) || 0), 0);
  const targetOk = Math.abs(totalTarget - 100) < 0.01;

  const currentPcts = useMemo(() =>
    assetsWithSurplus.map(a => total > 0 ? (a.amount / total * 100) : 0),
    [assetsWithSurplus, total]
  );

  const rebalanceDeltas = useMemo(() =>
    assetsWithSurplus.map(a => total > 0 ? (total * (Number(a.target) || 0) / 100) - a.amount : 0),
    [assetsWithSurplus, total]
  );

  // 잉여자금 주식/비주식
  const surplusStockAmt = surplusItems.filter(i => i.type === "주식").reduce((a, i) => a + i.amount, 0);
  const surplusNonStockAmt = surplusItems.filter(i => i.type === "비주식").reduce((a, i) => a + i.amount, 0);
  const surplusStockPct = totalSurplus > 0 ? surplusStockAmt / totalSurplus * 100 : 0;
  const surplusNonStockPct = totalSurplus > 0 ? surplusNonStockAmt / totalSurplus * 100 : 0;

  // auto-save (assets에는 isSurplus asset의 amount 저장 불필요, 재계산됨)
  useEffect(() => {
    saveState({ assets, deposit, withdraw, surplusItems });
  }, [assets, deposit, withdraw, surplusItems]);

  // 자산 CRUD
  const addAsset = () => {
    const newAsset = { id: genId(), name: "", target: 0, amount: 0, isSurplus: false };
    setAssets(prev => {
      const idx = prev.findIndex(a => a.isSurplus);
      if (idx === -1) return [...prev, newAsset];
      const next = [...prev];
      next.splice(idx, 0, newAsset);
      return next;
    });
  };
  const removeAsset = (id) => {
    if (id === SURPLUS_ASSET_ID) return; // 잉여자금 삭제 불가
    setAssets(prev => prev.filter(a => a.id !== id));
  };
  const updateAsset = useCallback((id, patch) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);

  // 잉여 항목 CRUD
  const addSurplusItem = () => setSurplusItems(prev => [...prev, { id: genId(), name: "", amount: 0, type: "비주식" }]);
  const removeSurplusItem = (id) => setSurplusItems(prev => prev.filter(i => i.id !== id));
  const updateSurplusItem = useCallback((id, patch) => {
    setSurplusItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  // 초기화
  const handleReset = () => {
    setAssets(makeDefaultAssets());
    setDeposit(0); setWithdraw(0); setSurplusItems([]);
    localStorage.removeItem(STORAGE_KEY);
    setShowResetConfirm(false);
  };

  const TABS = ["현황", "잉여자금", "리밸런싱"];

  return (
    <div style={{
      minHeight: "100vh", background: "#0B0F1A", color: "#F9FAFB",
      fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
      paddingBottom: 80,
      // iOS safe area
      paddingTop: "env(safe-area-inset-top)",
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)",
    }}>

      {/* ── 헤더 ── */}
      <div style={{ background: "#0F1629", borderBottom: "1px solid #1F2937", padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: 2, marginBottom: 4 }}>PORTFOLIO</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>자산 배분 트래커</div>
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            style={{ marginTop: 4, padding: "8px 14px", borderRadius: 10, fontSize: 13, background: "none", border: "1px solid #374151", color: "#6B7280", cursor: "pointer", WebkitTapHighlightColor: "transparent", minHeight: 44 }}
          >초기화</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: "#9CA3AF" }}>
          총 자산&nbsp;
          <span style={{ color: "#F59E0B", fontWeight: 700, fontSize: 17 }}>{total > 0 ? formatKRW(total) : "—"}</span>
          {total > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: "#4B5563" }}>● 자동 저장</span>}
        </div>
        {(deposit > 0 || withdraw > 0) && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>
            입금 <span style={{ color: "#34D399" }}>+{formatKRW(deposit)}</span>
            &nbsp;·&nbsp;출금 <span style={{ color: "#F87171" }}>-{formatKRW(withdraw)}</span>
          </div>
        )}
      </div>

      {/* ── 초기화 모달 ── */}
      {showResetConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#111827", borderRadius: 20, padding: 28, border: "1px solid #374151", maxWidth: 320, width: "88%", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>데이터 초기화</div>
            <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 24 }}>입력한 모든 데이터가 삭제됩니다.<br />계속하시겠어요?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ flex: 1, padding: "14px 0", borderRadius: 12, fontSize: 15, background: "#1F2937", border: "1px solid #374151", color: "#9CA3AF", cursor: "pointer", minHeight: 48 }}>취소</button>
              <button onClick={handleReset} style={{ flex: 1, padding: "14px 0", borderRadius: 12, fontSize: 15, background: "#EF4444", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", minHeight: 48 }}>초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 탭 ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #1F2937", background: "#0F1629" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "14px 0", fontSize: 13, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? "#F59E0B" : "#6B7280",
            background: "none", border: "none", cursor: "pointer",
            borderBottom: tab === t ? "2px solid #F59E0B" : "2px solid transparent",
            minHeight: 48, WebkitTapHighlightColor: "transparent",
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: "16px 14px" }}>

        {/* ════════ 현황 탭 ════════ */}
        {tab === "현황" && (
          <div>
            {/* 목표 비중 합계 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, padding: "10px 14px", background: "#111827", borderRadius: 10, border: "1px solid #1F2937" }}>
              <span style={{ fontSize: 13, color: "#6B7280" }}>목표 비중 합계</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: targetOk ? "#34D399" : "#F87171" }}>
                {totalTarget.toFixed(1)}% {targetOk ? "✓" : "⚠️ 100% 아님"}
              </span>
            </div>

            {/* 자산 카드 */}
            {assetsWithSurplus.map((asset, idx) => {
              const color = ASSET_COLORS[idx % ASSET_COLORS.length];
              const pct = currentPcts[idx];
              return (
                <div key={asset.id} style={{ background: "#111827", borderRadius: 14, padding: "14px 14px 16px", marginBottom: 12, border: "1px solid #1F2937" }}>

                  {/* 행1: 색상점 + 자산명 + 목표% + 삭제 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />

                    {/* 자산명 */}
                    <input
                      value={asset.name}
                      onChange={e => updateAsset(asset.id, { name: e.target.value })}
                      onKeyDown={e => e.key === "Enter" && e.target.blur()}
                      placeholder="자산명"
                      readOnly={asset.isSurplus}
                      style={{
                        flex: 1, minWidth: 0,
                        background: "none", border: "none",
                        borderBottom: asset.isSurplus ? "none" : "1px solid #374151",
                        color: asset.isSurplus ? "#9CA3AF" : "#F9FAFB",
                        fontSize: 15, fontWeight: 700, outline: "none",
                        padding: "4px 2px", WebkitAppearance: "none",
                      }}
                    />

                    {/* 목표 비중 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      <input
                        type="text" inputMode="decimal"
                        value={asset.target}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9.]/g, "");
                          updateAsset(asset.id, { target: v });
                        }}
                        onBlur={e => updateAsset(asset.id, { target: parseFloat(e.target.value) || 0 })}
                        onKeyDown={e => e.key === "Enter" && e.target.blur()}
                        style={{
                          width: 52, textAlign: "center",
                          background: "#0B0F1A", border: "1px solid #374151",
                          color: "#F9FAFB", borderRadius: 8, fontSize: 14,
                          fontWeight: 600, outline: "none", padding: "6px 4px",
                          WebkitAppearance: "none",
                        }}
                      />
                      <span style={{ fontSize: 13, color: "#6B7280" }}>%</span>
                    </div>

                    {/* 삭제 (잉여자금은 숨김) */}
                    {!asset.isSurplus ? (
                      <button
                        onClick={() => removeAsset(asset.id)}
                        style={{ background: "none", border: "none", color: "#4B5563", fontSize: 20, lineHeight: 1, padding: "4px 6px", cursor: "pointer", flexShrink: 0, minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}
                      >✕</button>
                    ) : (
                      <div style={{ width: 36 }} />
                    )}
                  </div>

                  {/* 현재 비중 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#6B7280" }}>현재 비중</span>
                    <div>
                      <span style={{ color, fontWeight: 700, fontSize: 15 }}>{pct.toFixed(1)}%</span>
                      <span style={{ color: "#6B7280", fontSize: 12, marginLeft: 8 }}>{formatKRW(asset.amount)}</span>
                    </div>
                  </div>

                  {/* 게이지 */}
                  {Number(asset.target) > 0 && <GaugeBar current={pct} target={Number(asset.target)} color={color} />}

                  {/* 금액 입력 (잉여자금은 읽기전용) */}
                  <div style={{ marginTop: 10 }}>
                    {asset.isSurplus ? (
                      <div style={{ padding: "10px 12px", borderRadius: 10, background: "#0B0F1A", border: "1px solid #1F2937", fontSize: 14, color: totalSurplus > 0 ? "#10B981" : "#374151" }}>
                        {totalSurplus > 0 ? `${formatKRW(totalSurplus)} (자동 계산)` : "잉여자금 탭에서 입력"}
                      </div>
                    ) : (
                      <AmountInput value={asset.amount} onChange={v => updateAsset(asset.id, { amount: v })} placeholder="현재 금액 입력 (원)" />
                    )}
                  </div>
                </div>
              );
            })}

            {/* 자산 추가 */}
            <button
              onClick={addAsset}
              style={{ width: "100%", marginBottom: 14, padding: "14px 0", borderRadius: 12, border: "1px dashed #374151", background: "none", color: "#6B7280", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, WebkitTapHighlightColor: "transparent" }}
            >
              <span style={{ fontSize: 20 }}>＋</span> 자산 추가
            </button>

            {/* 입금 / 출금 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "입금", emoji: "📥", val: deposit, setVal: setDeposit, color: "#34D399" },
                { label: "출금", emoji: "📤", val: withdraw, setVal: setWithdraw, color: "#F87171" },
              ].map(({ label, emoji, val, setVal, color }) => (
                <div key={label} style={{ background: "#111827", borderRadius: 12, padding: "12px 12px 14px", border: "1px solid #1F2937" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 12, color, fontWeight: 700, marginBottom: 8, minHeight: 18 }}>{val > 0 ? formatKRW(val) : "—"}</div>
                  <AmountInput value={val} onChange={setVal} placeholder="금액 입력" />
                </div>
              ))}
            </div>

            {/* 구성 비율 바 */}
            {total > 0 && (
              <div style={{ background: "#111827", borderRadius: 14, padding: 16, border: "1px solid #1F2937" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>구성 비율</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  {assetsWithSurplus.map((a, idx) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: ASSET_COLORS[idx % ASSET_COLORS.length] }} />
                      <span style={{ color: "#9CA3AF" }}>{a.name || `자산${idx + 1}`}</span>
                      <span style={{ color: "#F9FAFB", fontWeight: 600 }}>{currentPcts[idx].toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 22, borderRadius: 6, display: "flex", overflow: "hidden", background: "#1F2937" }}>
                  {assetsWithSurplus.map((a, idx) => (
                    <div key={a.id} style={{ width: `${currentPcts[idx]}%`, background: ASSET_COLORS[idx % ASSET_COLORS.length], transition: "width 0.4s ease" }} />
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: "#4B5563", lineHeight: 2 }}>
                  총자산 = {assetsWithSurplus.map(a => `${a.name || "?"}(${formatKRW(a.amount)})`).join(" + ")}
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
            {/* 요약 카드 */}
            <div style={{ background: "#111827", borderRadius: 14, padding: "14px 16px", marginBottom: 14, border: "1px solid #1F2937" }}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                잉여자금 합계&nbsp;
                <span style={{ color: "#10B981", fontWeight: 700, fontSize: 15 }}>{formatKRW(totalSurplus)}</span>
                &nbsp;→ 현황 탭 자동 반영
              </div>
              {totalSurplus > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    {[
                      { label: "주식", pct: surplusStockPct, amt: surplusStockAmt, color: "#60A5FA" },
                      { label: "비주식", pct: surplusNonStockPct, amt: surplusNonStockAmt, color: "#FCD34D" },
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
              const sectionColor = type === "주식" ? "#60A5FA" : "#FCD34D";
              const sectionLabel = type === "주식" ? "📈 주식" : "💵 비주식 (예·적금)";
              return (
                <div key={type}>
                  <div style={{ fontSize: 11, color: sectionColor, fontWeight: 700, letterSpacing: 1, margin: type === "주식" ? "16px 0 8px 4px" : "0 0 8px 4px" }}>
                    {sectionLabel}
                  </div>
                  {filtered.map(item => {
                    const pct = totalSurplus > 0 ? item.amount / totalSurplus * 100 : 0;
                    return (
                      <div key={item.id} style={{ background: "#111827", borderRadius: 12, padding: "12px 14px 14px", marginBottom: 8, border: "1px solid #1F2937" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <input
                            value={item.name}
                            onChange={e => updateSurplusItem(item.id, { name: e.target.value })}
                            onKeyDown={e => e.key === "Enter" && e.target.blur()}
                            placeholder="항목명 입력"
                            style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, background: "none", border: "none", borderBottom: "1px solid #374151", color: "#F9FAFB", outline: "none", padding: "4px 2px" }}
                          />
                          <select
                            value={item.type}
                            onChange={e => updateSurplusItem(item.id, { type: e.target.value })}
                            style={{ background: "#1F2937", border: "1px solid #374151", color: "#9CA3AF", borderRadius: 8, padding: "6px 8px", fontSize: 12, cursor: "pointer", minHeight: 36 }}
                          >
                            <option value="비주식">비주식</option>
                            <option value="주식">주식</option>
                          </select>
                          <span style={{ color: sectionColor, fontWeight: 700, fontSize: 13, minWidth: 36, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                          <button
                            onClick={() => removeSurplusItem(item.id)}
                            style={{ background: "none", border: "none", color: "#6B7280", fontSize: 20, lineHeight: 1, padding: "4px 4px", cursor: "pointer", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}
                          >✕</button>
                        </div>
                        <div style={{ height: 6, background: "#1F2937", borderRadius: 999, marginBottom: 10 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: sectionColor, borderRadius: 999, transition: "width 0.4s ease" }} />
                        </div>
                        <AmountInput value={item.amount} onChange={v => updateSurplusItem(item.id, { amount: v })} placeholder="금액 입력" />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <button
              onClick={addSurplusItem}
              style={{ width: "100%", marginTop: 10, padding: "14px 0", borderRadius: 12, border: "1px dashed #374151", background: "none", color: "#6B7280", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 50, WebkitTapHighlightColor: "transparent" }}
            >
              <span style={{ fontSize: 20 }}>＋</span> 항목 추가
            </button>
          </div>
        )}

        {/* ════════ 리밸런싱 탭 ════════ */}
        {tab === "리밸런싱" && (
          <div>
            {total <= 0 ? (
              <div style={{ textAlign: "center", color: "#6B7280", marginTop: 80, fontSize: 14, lineHeight: 2 }}>
                먼저 '현황' 탭에서<br />자산 금액을 입력해주세요.
              </div>
            ) : !targetOk ? (
              <div style={{ textAlign: "center", color: "#F87171", marginTop: 80, fontSize: 14, lineHeight: 2 }}>
                ⚠️ 목표 비중 합계가 {totalTarget.toFixed(1)}%입니다.<br />
                <span style={{ fontSize: 13, color: "#6B7280" }}>현황 탭에서 합계를 100%로 맞춰주세요.</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
                  총 자산 <span style={{ color: "#F59E0B", fontWeight: 700 }}>{formatKRW(total)}</span> 기준 리밸런싱
                </div>

                {assetsWithSurplus.map((asset, idx) => {
                  const color = ASSET_COLORS[idx % ASSET_COLORS.length];
                  const delta = rebalanceDeltas[idx];
                  const pct = currentPcts[idx];
                  const isBuy = delta > 0;
                  const isOk = Math.abs(delta) < 1000;
                  return (
                    <div key={asset.id} style={{ background: "#111827", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${isOk ? "#374151" : isBuy ? "#1D4ED8" : "#7F1D1D"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{asset.name || `자산${idx + 1}`}</span>
                            {asset.isSurplus && <span style={{ fontSize: 11, color: "#4B5563" }}>자동</span>}
                          </div>
                          <div style={{ marginTop: 5, fontSize: 12, color: "#6B7280" }}>현재 {pct.toFixed(1)}% → 목표 {asset.target}%</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {isOk ? (
                            <div style={{ color: "#34D399", fontWeight: 700, fontSize: 14 }}>✓ 균형</div>
                          ) : (
                            <>
                              <div style={{ color: isBuy ? "#60A5FA" : "#F87171", fontWeight: 700, fontSize: 18 }}>{isBuy ? "▲ 매수" : "▼ 매도"}</div>
                              <div style={{ color: "#F9FAFB", fontWeight: 700, fontSize: 16 }}>{formatKRW(Math.abs(delta))}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div style={{ marginTop: 8, background: "#0F1629", borderRadius: 12, padding: 16, border: "1px solid #1F2937", fontSize: 12, color: "#6B7280", lineHeight: 2 }}>
                  💡 리밸런싱 후 목표
                  {assetsWithSurplus.map(a => (
                    <span key={a.id}> · {a.name || "?"} {formatKRW(total * (Number(a.target) || 0) / 100)}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

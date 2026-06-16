import { useState, useMemo, useEffect } from "react";

const STORAGE_KEY = "asset-tracker-v1";

const TARGET = { 삼성전자: 40, TIGER미필반: 40, 잉여자금: 20 };

const SURPLUS_ITEMS = [
  "신한은행", "카카오뱅크", "케이뱅크", "토스뱅크", "국민은행",
  "SK텔레콤", "브이엠", "HL홀딩스", "레드와이어", "스페이스X"
];

const SURPLUS_TYPE = {
  "신한은행": "비주식", "카카오뱅크": "비주식", "케이뱅크": "비주식",
  "토스뱅크": "비주식", "국민은행": "비주식",
  "SK텔레콤": "주식", "브이엠": "주식", "HL홀딩스": "주식",
  "레드와이어": "주식", "스페이스X": "주식",
};

const CATEGORY_META = {
  삼성전자: { color: "#3B82F6", emoji: "📈" },
  TIGER미필반: { color: "#8B5CF6", emoji: "📊" },
  잉여자금: { color: "#10B981", emoji: "💰" },
};

const DEFAULT_SURPLUS = Object.fromEntries(SURPLUS_ITEMS.map(k => [k, 0]));

// localStorage helpers
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function formatKRW(n) {
  if (!n && n !== 0) return "—";
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}억`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}만`;
  return `${n.toLocaleString()}원`;
}

function GaugeBar({ current, target, color }) {
  const diff = current - target;
  const over = diff > 0;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>0%</span>
        <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>목표 {target}%</span>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>100%</span>
      </div>
      <div style={{ position: "relative", height: 10, background: "#1F2937", borderRadius: 999 }}>
        <div style={{
          position: "absolute", left: `${target}%`, top: -2, width: 2, height: 14,
          background: "#F59E0B", borderRadius: 1, zIndex: 2
        }} />
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: `${Math.min(current, 100)}%`, height: "100%",
          background: over ? "#EF4444" : color,
          borderRadius: 999, transition: "width 0.4s ease"
        }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: over ? "#F87171" : "#34D399", textAlign: "right" }}>
        {diff > 0 ? `+${diff.toFixed(1)}%` : diff < 0 ? `${diff.toFixed(1)}%` : "목표 달성 ✓"}
      </div>
    </div>
  );
}

function AmountInput({ value, onChange, placeholder = "금액 입력 (원)" }) {
  const [raw, setRaw] = useState(value ? value.toLocaleString() : "");

  // sync when value resets to 0 (e.g. after reset)
  useEffect(() => {
    if (value === 0) setRaw("");
  }, [value]);

  const handleChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/g, "");
    setRaw(v ? Number(v).toLocaleString() : "");
    onChange(Number(v) || 0);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={handleChange}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "8px 12px", borderRadius: 8,
        border: "1px solid #374151", background: "#111827",
        color: "#F9FAFB", fontSize: 14, outline: "none",
        boxSizing: "border-box"
      }}
    />
  );
}

export default function App() {
  const saved = loadState();

  const [samsung, setSamsung] = useState(saved?.samsung ?? 0);
  const [tiger, setTiger] = useState(saved?.tiger ?? 0);
  const [surplus, setSurplus] = useState(saved?.surplus ?? { ...DEFAULT_SURPLUS });
  const [tab, setTab] = useState("현황");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Auto-save on every change
  useEffect(() => {
    saveState({ samsung, tiger, surplus });
  }, [samsung, tiger, surplus]);

  const totalSurplus = Object.values(surplus).reduce((a, b) => a + b, 0);
  const total = samsung + tiger + totalSurplus;

  const currentPct = total > 0
    ? { 삼성전자: samsung / total * 100, TIGER미필반: tiger / total * 100, 잉여자금: totalSurplus / total * 100 }
    : { 삼성전자: 0, TIGER미필반: 0, 잉여자금: 0 };

  const rebalance = useMemo(() => {
    if (total === 0) return null;
    return {
      삼성전자: total * 0.4 - samsung,
      TIGER미필반: total * 0.4 - tiger,
      잉여자금: total * 0.2 - totalSurplus,
    };
  }, [total, samsung, tiger, totalSurplus]);

  const surplusPctArr = SURPLUS_ITEMS.map(k =>
    totalSurplus > 0 ? surplus[k] / totalSurplus * 100 : 0
  );

  const handleReset = () => {
    setSamsung(0);
    setTiger(0);
    setSurplus({ ...DEFAULT_SURPLUS });
    localStorage.removeItem(STORAGE_KEY);
    setShowResetConfirm(false);
  };

  const tabs = ["현황", "잉여자금", "리밸런싱"];

  return (
    <div style={{
      minHeight: "100vh", background: "#0B0F1A", color: "#F9FAFB",
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      padding: "0 0 40px"
    }}>
      {/* Header */}
      <div style={{ background: "#0F1629", borderBottom: "1px solid #1F2937", padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: 2, marginBottom: 4 }}>PORTFOLIO</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#F9FAFB" }}>자산 배분 트래커</div>
          </div>
          {/* Reset button */}
          <button
            onClick={() => setShowResetConfirm(true)}
            style={{
              marginTop: 4, padding: "6px 12px", borderRadius: 8, fontSize: 12,
              background: "none", border: "1px solid #374151", color: "#6B7280",
              cursor: "pointer"
            }}
          >
            초기화
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: "#9CA3AF" }}>
          총 자산&nbsp;
          <span style={{ color: "#F59E0B", fontWeight: 700, fontSize: 16 }}>
            {total > 0 ? formatKRW(total) : "—"}
          </span>
          {saved && total > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "#4B5563" }}>● 자동 저장됨</span>
          )}
        </div>
      </div>

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
        }}>
          <div style={{
            background: "#111827", borderRadius: 16, padding: 24,
            border: "1px solid #374151", maxWidth: 300, width: "90%", textAlign: "center"
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>데이터 초기화</div>
            <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
              입력한 모든 금액이 삭제됩니다.<br />계속하시겠어요?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14,
                  background: "#1F2937", border: "1px solid #374151", color: "#9CA3AF", cursor: "pointer"
                }}
              >
                취소
              </button>
              <button
                onClick={handleReset}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14,
                  background: "#EF4444", border: "none", color: "#fff",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1F2937", background: "#0F1629" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "12px 0", fontSize: 13, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? "#F59E0B" : "#6B7280",
            background: "none", border: "none", cursor: "pointer",
            borderBottom: tab === t ? "2px solid #F59E0B" : "2px solid transparent"
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: "20px 16px" }}>

        {/* ── 현황 탭 ── */}
        {tab === "현황" && (
          <div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>목표: 삼성전자 40% · TIGER미필반 40% · 잉여자금 20%</div>

            {["삼성전자", "TIGER미필반", "잉여자금"].map((key) => {
              const val = key === "삼성전자" ? samsung : key === "TIGER미필반" ? tiger : totalSurplus;
              const setter = key === "삼성전자" ? setSamsung : key === "TIGER미필반" ? setTiger : null;
              const meta = CATEGORY_META[key];
              return (
                <div key={key} style={{
                  background: "#111827", borderRadius: 12, padding: "16px",
                  marginBottom: 12, border: "1px solid #1F2937"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{key}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: meta.color, fontWeight: 700, fontSize: 15 }}>{currentPct[key].toFixed(1)}%</div>
                      <div style={{ color: "#6B7280", fontSize: 11 }}>{formatKRW(val)}</div>
                    </div>
                  </div>
                  <GaugeBar current={currentPct[key]} target={TARGET[key]} color={meta.color} />
                  {setter && (
                    <div style={{ marginTop: 10 }}>
                      <AmountInput value={val} onChange={setter} placeholder={`${key} 금액 입력`} />
                    </div>
                  )}
                  {key === "잉여자금" && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
                      잉여자금 세부 입력은 '잉여자금' 탭에서
                    </div>
                  )}
                </div>
              );
            })}

            {total > 0 && (
              <div style={{ marginTop: 8, background: "#111827", borderRadius: 12, padding: 16, border: "1px solid #1F2937" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>구성 비율</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["삼성전자", "TIGER미필반", "잉여자금"].map(k => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: CATEGORY_META[k].color }} />
                      <span style={{ color: "#9CA3AF" }}>{k}</span>
                      <span style={{ color: "#F9FAFB", fontWeight: 600 }}>{currentPct[k].toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, height: 24, borderRadius: 6, display: "flex", overflow: "hidden" }}>
                  {["삼성전자", "TIGER미필반", "잉여자금"].map(k => (
                    <div key={k} style={{
                      width: `${currentPct[k]}%`, background: CATEGORY_META[k].color,
                      transition: "width 0.4s ease"
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 잉여자금 탭 ── */}
        {tab === "잉여자금" && (
          <div>
            {/* 요약 헤더 */}
            <div style={{ background: "#111827", borderRadius: 12, padding: "14px 16px", marginBottom: 14, border: "1px solid #1F2937" }}>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                잉여자금 합계&nbsp;
                <span style={{ color: "#10B981", fontWeight: 700 }}>{formatKRW(totalSurplus)}</span>
                &nbsp;·&nbsp;전체 자산의&nbsp;
                <span style={{ color: currentPct["잉여자금"] > 20 ? "#EF4444" : "#10B981", fontWeight: 700 }}>
                  {currentPct["잉여자금"].toFixed(1)}%
                </span>
              </div>
              {totalSurplus > 0 && (() => {
                const stockAmt = SURPLUS_ITEMS.filter(k => SURPLUS_TYPE[k] === "주식").reduce((a, k) => a + surplus[k], 0);
                const nonStockAmt = totalSurplus - stockAmt;
                const stockPct = stockAmt / totalSurplus * 100;
                const nonStockPct = nonStockAmt / totalSurplus * 100;
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#60A5FA" }} />
                        <span style={{ color: "#9CA3AF" }}>주식</span>
                        <span style={{ color: "#60A5FA", fontWeight: 700 }}>{stockPct.toFixed(1)}%</span>
                        <span style={{ color: "#6B7280", fontSize: 11 }}>({formatKRW(stockAmt)})</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#FCD34D" }} />
                        <span style={{ color: "#9CA3AF" }}>비주식</span>
                        <span style={{ color: "#FCD34D", fontWeight: 700 }}>{nonStockPct.toFixed(1)}%</span>
                        <span style={{ color: "#6B7280", fontSize: 11 }}>({formatKRW(nonStockAmt)})</span>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, display: "flex", overflow: "hidden", background: "#1F2937" }}>
                      <div style={{ width: `${stockPct}%`, background: "#60A5FA", transition: "width 0.4s ease" }} />
                      <div style={{ width: `${nonStockPct}%`, background: "#FCD34D", transition: "width 0.4s ease" }} />
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 비주식 섹션 */}
            <div style={{ fontSize: 11, color: "#FCD34D", fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
              💵 비주식 (예·적금)
            </div>
            {SURPLUS_ITEMS.filter(k => SURPLUS_TYPE[k] === "비주식").map((item) => {
              const i = SURPLUS_ITEMS.indexOf(item);
              const pct = surplusPctArr[i];
              return (
                <div key={item} style={{
                  background: "#111827", borderRadius: 12, padding: "14px 16px",
                  marginBottom: 8, border: "1px solid #1F2937"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: "#FCD34D", fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                      <span style={{ color: "#6B7280", fontSize: 11, marginLeft: 8 }}>({formatKRW(surplus[item])})</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: "#1F2937", borderRadius: 999, marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#FCD34D", borderRadius: 999, transition: "width 0.4s ease" }} />
                  </div>
                  <AmountInput value={surplus[item]} onChange={v => setSurplus(prev => ({ ...prev, [item]: v }))} placeholder={`${item} 금액 입력`} />
                </div>
              );
            })}

            {/* 주식 섹션 */}
            <div style={{ fontSize: 11, color: "#60A5FA", fontWeight: 700, letterSpacing: 1, margin: "16px 0 8px 4px" }}>
              📈 주식
            </div>
            {SURPLUS_ITEMS.filter(k => SURPLUS_TYPE[k] === "주식").map((item) => {
              const i = SURPLUS_ITEMS.indexOf(item);
              const pct = surplusPctArr[i];
              return (
                <div key={item} style={{
                  background: "#111827", borderRadius: 12, padding: "14px 16px",
                  marginBottom: 8, border: "1px solid #1F2937"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ color: "#60A5FA", fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                      <span style={{ color: "#6B7280", fontSize: 11, marginLeft: 8 }}>({formatKRW(surplus[item])})</span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: "#1F2937", borderRadius: 999, marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "#60A5FA", borderRadius: 999, transition: "width 0.4s ease" }} />
                  </div>
                  <AmountInput value={surplus[item]} onChange={v => setSurplus(prev => ({ ...prev, [item]: v }))} placeholder={`${item} 금액 입력`} />
                </div>
              );
            })}
          </div>
        )}

        {/* ── 리밸런싱 탭 ── */}
        {tab === "리밸런싱" && (
          <div>
            {total === 0 ? (
              <div style={{ textAlign: "center", color: "#6B7280", marginTop: 60, fontSize: 14 }}>
                먼저 '현황' 탭에서 자산 금액을 입력해주세요.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
                  총 자산 <span style={{ color: "#F59E0B", fontWeight: 700 }}>{formatKRW(total)}</span> 기준 리밸런싱
                </div>

                {["삼성전자", "TIGER미필반", "잉여자금"].map(key => {
                  const delta = rebalance[key];
                  const meta = CATEGORY_META[key];
                  const isBuy = delta > 0;
                  const isOk = Math.abs(delta) < 1000;
                  return (
                    <div key={key} style={{
                      background: "#111827", borderRadius: 12, padding: "16px",
                      marginBottom: 12, border: `1px solid ${isOk ? "#374151" : isBuy ? "#1D4ED8" : "#7F1D1D"}`
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{key}</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>
                            현재 {currentPct[key].toFixed(1)}% → 목표 {TARGET[key]}%
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {isOk ? (
                            <div style={{ color: "#34D399", fontWeight: 700, fontSize: 14 }}>✓ 균형</div>
                          ) : (
                            <>
                              <div style={{ color: isBuy ? "#60A5FA" : "#F87171", fontWeight: 700, fontSize: 18 }}>
                                {isBuy ? "▲ 매수" : "▼ 매도"}
                              </div>
                              <div style={{ color: "#F9FAFB", fontWeight: 700, fontSize: 15 }}>
                                {formatKRW(Math.abs(delta))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div style={{
                  marginTop: 8, background: "#0F1629", borderRadius: 12, padding: 16,
                  border: "1px solid #1F2937", fontSize: 12, color: "#6B7280", lineHeight: 1.8
                }}>
                  💡 리밸런싱 후 목표: 삼성전자 {formatKRW(total * 0.4)} / TIGER미필반 {formatKRW(total * 0.4)} / 잉여자금 {formatKRW(total * 0.2)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

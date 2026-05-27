// src/pages/TeamPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { COLORS } from '../constants';
import { Card, LoadingSpinner } from '../components/Common';
import customerService from '../services/customerService';

function getIcon(type) {
  if (type === '가족') return '👨‍👩‍👧';
  if (type === '펫') return '🐶';
  if (type === '태아') return '👶';
  return '👤';
}

function StatusPill({ status }) {
  const s = status || '상담중';

  const bg =
    s === '가입' || s === '계약중'
      ? '#DCFCE7'
      : s === '가망'
      ? '#FEF3C7'
      : s === '해지'
      ? '#FEE2E2'
      : COLORS.primaryBg;

  const color =
    s === '가입' || s === '계약중'
      ? '#16A34A'
      : s === '가망'
      ? '#D97706'
      : s === '해지'
      ? '#DC2626'
      : COLORS.primary;

  return (
    <span style={{
      background: bg,
      color,
      borderRadius: 999,
      padding: '2px 7px',
      fontSize: 10,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      {s}
    </span>
  );
}

function buildTree(customers = []) {
  const map = {};
  const roots = [];

  customers.forEach((c) => {
    const id = String(c.app_customer_id || c.id || c.db_id);
    map[id] = { ...c, id, children: [] };
  });

  customers.forEach((c) => {
    const id = String(c.app_customer_id || c.id || c.db_id);
    const parentId = c.referrer_app_id ? String(c.referrer_app_id) : '';

    if (parentId && map[parentId]) {
      map[parentId].children.push(map[id]);
    } else {
      roots.push(map[id]);
    }
  });

  return roots;
}

function flatten(nodes = []) {
  let result = [];
  nodes.forEach((n) => {
    result.push(n);
    if (n.children?.length) result = result.concat(flatten(n.children));
  });
  return result;
}

export default function TeamPage() {
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    try {
      const customers = await customerService.list({ status: '전체', search: '' });
      const built = buildTree(customers || []);
      setTree(built);
    } catch (e) {
      console.error(e);
      setTree([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const allPeople = useMemo(() => flatten(tree), [tree]);

  const visiblePeople = useMemo(() => {
    const keyword = search.trim();

    if (!keyword) return allPeople;

    return allPeople.filter((p) =>
      p.name?.includes(keyword) ||
      p.phone?.includes(keyword) ||
      p.status?.includes(keyword) ||
      p.customer_type?.includes(keyword) ||
      p.relation_type?.includes(keyword)
    );
  }, [allPeople, search]);

  const familyCount = allPeople.filter(p => p.customer_type === '가족').length;
  const petCount = allPeople.filter(p => p.customer_type === '펫').length;
  const babyCount = allPeople.filter(p => p.customer_type === '태아').length;
const customerCount = allPeople.filter(p => p.customer_type === '일반' || !p.customer_type).length; // ✅ 추가

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      overflow: 'visible',
    }}>
      <div style={{
        background: COLORS.white,
        padding: '14px 20px',
        borderBottom: `1px solid ${COLORS.border}`,
        textAlign: 'center',
      }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: COLORS.text }}>
          소개트리
        </span>
      </div>

      <div style={{
        flex: 'none',
        overflow: 'visible',
        padding: '14px 16px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <Card>
              <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 14 }}>
                소개 현황
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                {[
                  ['전체', allPeople.length],
                  ['고객', customerCount],  // ✅ 추가
                  ['가족', familyCount],
                  ['펫', petCount],
                  ['태아', babyCount],
                ].map(([label, value]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: COLORS.textGray, marginBottom: 4 }}>
                      {label}
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 20, color: COLORS.text }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text, marginBottom: 10 }}>
                고객 소개트리
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: COLORS.bg,
                borderRadius: 12,
                padding: '10px 12px',
                border: `1px solid ${COLORS.border}`,
                marginBottom: 14,
              }}>
                <span>🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="고객명 / 전화번호 검색"
                  style={{
                    border: 'none',
                    background: 'none',
                    outline: 'none',
                    flex: 1,
                    fontSize: 13,
                    color: COLORS.text,
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visiblePeople.length === 0 ? (
                  <div style={{ fontSize: 12, color: COLORS.textGray, padding: '8px 4px' }}>
                    표시할 고객이 없습니다.
                  </div>
                ) : (
                  visiblePeople.map((p) => {
                    const isOpen = selected?.id === p.id;

                    return (
                      <div key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(isOpen ? null : p)}
                          style={{
                            width: '100%',
                            border: isOpen
                              ? `2px solid ${COLORS.primary}`
                              : `1px solid ${COLORS.border}`,
                            background: isOpen ? COLORS.primaryBg : COLORS.white,
                            borderRadius: 14,
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: 18 }}>
                            {getIcon(p.customer_type)}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: COLORS.text }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: 11, color: COLORS.textGray, marginTop: 2 }}>
                              {p.phone || '-'}
                            </div>
                          </div>

                          <StatusPill status={p.status} />

                          <span style={{
                            color: COLORS.primary,
                            fontWeight: 900,
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                          }}>
                            {p.children?.length || 0}명
                          </span>
                        </button>

                        {isOpen && (
                          <div style={{
                            marginTop: 8,
                            marginBottom: 4,
                            background: COLORS.primaryBg,
                            borderRadius: 16,
                            padding: 14,
                          }}>
                            <div style={{ fontWeight: 900, fontSize: 16, color: COLORS.text }}>
                              {getIcon(p.customer_type)} {p.name}
                            </div>

                            <div style={{ fontSize: 12, color: COLORS.textGray, marginTop: 4 }}>
  {p.phone || '-'} · {p.customer_type || '일반'}
  {p.relation_type ? ` · ${p.relation_type}` : ''}
</div>

{p.referrer_name && (
  <div
    style={{
      marginTop: 6,
      fontSize: 11,
      color: COLORS.primary,
      fontWeight: 800,
    }}
  >
    👥 최초 소개자: {p.referrer_name}
  </div>
)}

                            <div style={{
                              marginTop: 10,
                              fontSize: 13,
                              color: COLORS.primary,
                              fontWeight: 900,
                            }}>
                              소개한 고객 {p.children?.length || 0}명
                            </div>

                            {p.children?.length > 0 ? (
                              <div style={{
                                marginTop: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                              }}>
                                {p.children.map((child) => (
                                  <div key={child.id} style={{
                                    background: '#fff',
                                    border: `1px solid ${COLORS.border}`,
                                    borderRadius: 12,
                                    padding: '10px 12px',
                                  }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: COLORS.text }}>
                                      {getIcon(child.customer_type)} {child.name}
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      marginTop: 4,
                                      flexWrap: 'wrap',
                                    }}>
                                      <span style={{ fontSize: 11, color: COLORS.textGray }}>
                                        {child.phone || '-'}
                                      </span>
                                      <StatusPill status={child.status} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{
                                marginTop: 10,
                                fontSize: 12,
                                color: COLORS.textGray,
                              }}>
                                아직 이 고객이 소개한 고객이 없습니다.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
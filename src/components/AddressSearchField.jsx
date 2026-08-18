import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COLORS } from '../constants';
import { searchRoadAddresses } from '../services/addressSearchService';

function joinAddress(baseAddress, detailAddress) {
  return [baseAddress, detailAddress]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}

function getResultAddress(item) {
  return item?.roadAddress || item?.roadAddr || item?.address || '';
}

export default function AddressSearchField({ value, onChange }) {
  const [baseAddress, setBaseAddress] = useState(value || '');
  const [detailAddress, setDetailAddress] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const lastEmittedValueRef = useRef(value || '');
  const suppressNextAutoSearchRef = useRef(false);
  const userEditedRef = useRef(false);

  useEffect(() => {
    const nextValue = value || '';
    if (nextValue === lastEmittedValueRef.current) return;

    setBaseAddress(nextValue);
    setDetailAddress('');
    setResults([]);
    setError('');
    setSearched(false);
    lastEmittedValueRef.current = nextValue;
    userEditedRef.current = false;
  }, [value]);

  const finalAddress = useMemo(
    () => joinAddress(baseAddress, detailAddress),
    [baseAddress, detailAddress]
  );

  useEffect(() => {
    if (finalAddress === lastEmittedValueRef.current) return;
    lastEmittedValueRef.current = finalAddress;
    onChange(finalAddress);
  }, [finalAddress, onChange]);

  const runSearch = useCallback(async (keyword) => {
    const query = String(keyword || '').trim();

    if (query.length < 2) {
      setResults([]);
      setError('주소를 2글자 이상 입력해주세요.');
      setSearched(true);
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const nextResults = await searchRoadAddresses(query);
      setResults(nextResults);
    } catch (e) {
      setResults([]);
      setError(e?.message || '주소 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const query = String(baseAddress || '').trim();

    if (suppressNextAutoSearchRef.current) {
      suppressNextAutoSearchRef.current = false;
      return undefined;
    }

    if (!userEditedRef.current) {
      return undefined;
    }

    if (query.length < 2) {
      setResults([]);
      setError('');
      setSearched(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      runSearch(query);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [baseAddress, runSearch]);

  function handleSelect(item) {
    const selectedAddress = getResultAddress(item);
    suppressNextAutoSearchRef.current = true;
    userEditedRef.current = false;
    setBaseAddress(selectedAddress);
    setDetailAddress('');
    setResults([]);
    setError('');
    setSearched(false);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.searchRow}>
        <div style={styles.inputShell}>
          <span style={styles.icon}>📍</span>
          <input
            value={baseAddress}
            onChange={(e) => {
              userEditedRef.current = true;
              setBaseAddress(e.target.value);
            }}
            placeholder="주소를 입력하거나 검색하세요"
            style={styles.input}
          />
        </div>
        <button
          type="button"
          onClick={() => runSearch(baseAddress)}
          disabled={loading}
          style={{
            ...styles.searchButton,
            opacity: loading ? 0.65 : 1,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '검색중' : '주소검색'}
        </button>
      </div>

      {baseAddress && (
        <input
          value={detailAddress}
          onChange={(e) => setDetailAddress(e.target.value)}
          placeholder="상세주소를 입력하세요"
          style={styles.detailInput}
        />
      )}

      {loading && <div style={styles.helpText}>도로명주소를 검색하고 있습니다.</div>}
      {!loading && error && <div style={styles.errorText}>{error}</div>}
      {!loading && searched && !error && results.length === 0 && (
        <div style={styles.helpText}>검색 결과가 없습니다. 주소를 직접 입력할 수 있습니다.</div>
      )}

      {results.length > 0 && (
        <div style={styles.resultList}>
          {results.map((item) => {
            const roadAddress = getResultAddress(item);
            const jibunAddress = item.jibunAddress || item.jibunAddr || '';
            const zipNo = item.zipNo || item.postalCode || '';

            return (
              <button
                key={`${zipNo}-${roadAddress}`}
                type="button"
                onClick={() => handleSelect(item)}
                style={styles.resultButton}
              >
                <div style={styles.resultMain}>
                  {zipNo && <span style={styles.zipBadge}>{zipNo}</span>}
                  <span>{roadAddress}</span>
                </div>
                {jibunAddress && <div style={styles.resultSub}>{jibunAddress}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    marginBottom: 10,
    width: '100%',
    boxSizing: 'border-box',
  },
  searchRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'stretch',
    width: '100%',
  },
  inputShell: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: `1.5px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    background: '#FAFAFA',
    boxSizing: 'border-box',
  },
  icon: {
    color: COLORS.textGray,
    fontSize: 16,
    flexShrink: 0,
  },
  input: {
    border: 'none',
    background: 'none',
    outline: 'none',
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: COLORS.text,
    fontFamily: 'inherit',
  },
  searchButton: {
    flexShrink: 0,
    border: 'none',
    borderRadius: 12,
    padding: '0 13px',
    background: COLORS.primary,
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  detailInput: {
    width: '100%',
    marginTop: 8,
    border: `1.5px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: 14,
    color: COLORS.text,
    fontFamily: 'inherit',
  },
  helpText: {
    marginTop: 7,
    fontSize: 12,
    color: COLORS.textGray,
    lineHeight: 1.45,
  },
  errorText: {
    marginTop: 7,
    fontSize: 12,
    color: '#DC2626',
    lineHeight: 1.45,
  },
  resultList: {
    marginTop: 8,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    overflow: 'hidden',
    background: '#fff',
    maxHeight: 240,
    overflowY: 'auto',
  },
  resultButton: {
    width: '100%',
    border: 'none',
    borderBottom: `1px solid ${COLORS.border}`,
    background: '#fff',
    padding: '12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  resultMain: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 7,
    fontSize: 13,
    fontWeight: 800,
    color: COLORS.text,
    lineHeight: 1.45,
  },
  resultSub: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textGray,
    lineHeight: 1.4,
  },
  zipBadge: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '2px 7px',
    background: COLORS.primaryBg,
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: 900,
  },
};
